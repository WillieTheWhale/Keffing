#!/usr/bin/env python3
"""
Build a chrome matcap PNG from a real CC0 equirectangular HDRI (Poly Haven)
by ray-tracing a mirror sphere: for every pixel in the output disc, compute
the reflected view direction and sample the HDRI, then tonemap.

This is the standard "render a chrome ball" matcap-generation technique,
just done offline against a real environment map instead of hand-authoring
gradient stops.
"""
import sys
import numpy as np
from PIL import Image

def read_radiance_hdr(path):
    with open(path, "rb") as f:
        data = f.read()

    # --- header ---
    pos = 0
    def readline():
        nonlocal pos
        end = data.index(b"\n", pos)
        line = data[pos:end]
        pos = end + 1
        return line

    magic = readline()
    assert magic.startswith(b"#?"), f"not a radiance hdr: {magic}"
    width = height = None
    while True:
        line = readline()
        if line == b"":
            break  # blank line ends header
    dims = readline().split()
    # Expect: -Y H +X W
    assert dims[0] == b"-Y" and dims[2] == b"+X", f"unsupported orientation: {dims}"
    height = int(dims[1])
    width = int(dims[3])

    img = np.zeros((height, width, 3), dtype=np.float32)

    for y in range(height):
        # scanline record header (4 bytes) for new-format RLE
        b0, b1, b2, b3 = data[pos], data[pos+1], data[pos+2], data[pos+3]
        if b0 == 2 and b1 == 2 and ((b2 << 8) | b3) == width and width >= 8 and width < 32768:
            pos += 4
            planes = np.zeros((4, width), dtype=np.uint8)
            for ch in range(4):
                x = 0
                while x < width:
                    cnt = data[pos]; pos += 1
                    if cnt > 128:
                        cnt -= 128
                        val = data[pos]; pos += 1
                        planes[ch, x:x+cnt] = val
                        x += cnt
                    else:
                        planes[ch, x:x+cnt] = np.frombuffer(data, dtype=np.uint8, count=cnt, offset=pos)
                        pos += cnt
                        x += cnt
            r, g, b, e = planes[0].astype(np.int32), planes[1].astype(np.int32), planes[2].astype(np.int32), planes[3].astype(np.int32)
            mask = e > 0
            f = np.zeros(width, dtype=np.float32)
            f[mask] = np.ldexp(1.0, e[mask] - 128 - 8).astype(np.float32)
            img[y, :, 0] = r * f
            img[y, :, 1] = g * f
            img[y, :, 2] = b * f
        else:
            # old-format flat RGBE (fallback, uncommon for modern Poly Haven files)
            raise RuntimeError(f"old-format HDR scanline not supported at row {y}")

    return img  # linear float32 HxWx3, equirectangular (lat-long)


def sample_bilinear(img, u, v):
    """u,v in [0,1); img is HxWx3."""
    h, w = img.shape[0], img.shape[1]
    x = (u % 1.0) * w
    y = np.clip(v, 0, 0.999999) * h
    x0 = np.floor(x).astype(np.int32) % w
    y0 = np.floor(y).astype(np.int32)
    x1 = (x0 + 1) % w
    y1 = np.clip(y0 + 1, 0, h - 1)
    fx = (x - x0).reshape(-1, 1)
    fy = (y - y0).reshape(-1, 1)
    c00 = img[y0, x0]
    c10 = img[y0, x1]
    c01 = img[y1, x0]
    c11 = img[y1, x1]
    top = c00 * (1 - fx) + c10 * fx
    bot = c01 * (1 - fx) + c11 * fx
    return top * (1 - fy) + bot * fy


def make_matcap(hdr_path, out_path, size=512, exposure=1.0, rotate=0.0, desaturate=0.0, cool_tint=0.0, black_lift=0.0, contrast=1.0):
    env = read_radiance_hdr(hdr_path)
    print(f"loaded {hdr_path}: {env.shape}, max={env.max():.2f}")

    N = size
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    # NDC in [-1,1], y flipped so image row 0 = top = matcap "up"
    nx = (xx + 0.5) / N * 2 - 1
    ny = -((yy + 0.5) / N * 2 - 1)
    r2 = nx * nx + ny * ny
    valid = r2 <= 1.0
    nz = np.zeros_like(nx)
    nz[valid] = np.sqrt(np.clip(1 - r2[valid], 0, 1))

    # View direction looking at the sphere from +Z (camera at +Z looking toward -Z)
    vx, vy, vz = 0.0, 0.0, 1.0
    # Reflect V around N: R = 2*(N.V)*N - V
    ndotv = nx * vx + ny * vy + nz * vz
    rx = 2 * ndotv * nx - vx
    ry = 2 * ndotv * ny - vy
    rz = 2 * ndotv * nz - vz

    # Reflection direction -> equirectangular UV
    theta = np.arctan2(rx, -rz) + rotate       # azimuth
    phi = np.arcsin(np.clip(ry, -1, 1))         # elevation
    u = (theta / (2 * np.pi) + 0.5)
    v = (0.5 - phi / np.pi)

    flat_u = u[valid]
    flat_v = v[valid]
    cols = sample_bilinear(env, flat_u, flat_v) * exposure

    # Filmic-ish tonemap (Reinhard extended) + gamma
    cols = cols / (1.0 + cols)
    cols = np.clip(cols, 0, 1) ** (1 / 2.2)

    # Black lift: even the darkest reflected surfaces (unlit ceiling, etc.)
    # keep SOME visible tonal gradient instead of crushing to flat 0 — a
    # flat-black region of the matcap is exactly the "solid filled color"
    # look we're trying to get away from. Contrast then re-expands the
    # midtones around 0.5 so lifting blacks doesn't just wash everything out.
    if black_lift > 0:
        cols = cols * (1 - black_lift) + black_lift
    if contrast != 1.0:
        cols = np.clip((cols - 0.5) * contrast + 0.5, 0, 1)

    # Site palette is strictly white / black / cyan / signal-red — desaturate
    # the raw environment reflection (removes stray warm reds/greens picked
    # up from studio light fixtures) and push a cool cyan-blue grade, same
    # treatment already applied to the sky photography in this project.
    if desaturate > 0:
        luma = (cols[:, 0] * 0.2126 + cols[:, 1] * 0.7152 + cols[:, 2] * 0.0722)[:, None]
        cols = cols * (1 - desaturate) + luma * desaturate
    if cool_tint > 0:
        cool = np.array([0.92, 0.97, 1.06], dtype=np.float32)  # slight cyan-blue push
        cols = np.clip(cols * (cool * cool_tint + (1 - cool_tint)), 0, 1)

    out = np.zeros((N, N, 4), dtype=np.uint8)
    rgb = np.zeros((N, N, 3), dtype=np.float32)
    rgb_flat = rgb.reshape(-1, 3)
    valid_flat = valid.reshape(-1)
    rgb_flat[valid_flat] = cols
    rgb = rgb_flat.reshape(N, N, 3)

    out[..., :3] = np.clip(rgb * 255, 0, 255).astype(np.uint8)
    out[..., 3] = np.where(valid, 255, 0).astype(np.uint8)
    # Fill outside-circle area with the sphere's own edge-average color
    # (fully opaque square image; the ribbon shader only ever samples the
    # inscribed circle, but keep it visually sane for previewing).
    edge_val = out[..., :3][valid].mean(axis=0).astype(np.uint8)
    out[~valid, :3] = edge_val
    out[~valid, 3] = 255

    Image.fromarray(out, mode="RGBA").save(out_path)
    print("wrote", out_path)


if __name__ == "__main__":
    hdr = sys.argv[1]
    out = sys.argv[2]
    exposure = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
    rotate = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
    desaturate = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
    cool_tint = float(sys.argv[6]) if len(sys.argv) > 6 else 0.0
    black_lift = float(sys.argv[7]) if len(sys.argv) > 7 else 0.0
    contrast = float(sys.argv[8]) if len(sys.argv) > 8 else 1.0
    make_matcap(hdr, out, size=512, exposure=exposure, rotate=rotate, desaturate=desaturate, cool_tint=cool_tint, black_lift=black_lift, contrast=contrast)
