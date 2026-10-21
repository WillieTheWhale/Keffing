#!/usr/bin/env python3
"""The ALLOY background — the "white room" environment for the ice-chrome register.

v2's white register reflected the same sky env as the dark chrome with its
darks lifted, so flat panes magnified a large, flat region of it and read as
grey paper. This env is structured on purpose (ref e12 / e06): a pale room
with tall windows that hold cobalt sky (graded from the site's own photos),
thin dark mullions, a few white-hot softboxes, one crisp dark horizon line and
a pale floor that carries dimmed reflections of the windows. On a flat pane
that gives blue sky patches, hard white, and thin dark contour lines.

Mapping matches shaders.ts: u = 0.5 + atan2(d.x, d.z) / 2pi, row 0 = zenith.
u = 0.5 is +Z (behind the camera), which camera-facing surfaces reflect.

  python3 scripts/background/make_env_white.py
"""
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
SKY = os.path.join(ROOT, "public/assets/sky")
OUT = os.path.join(ROOT, "public/assets/background")
W, H = 2048, 1024
rng = np.random.default_rng(4401)


def load(name):
    return np.asarray(Image.open(os.path.join(SKY, name)).convert("RGB"), dtype=np.float32) / 255.0


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def grade(img, lift=0.0):
    """Cobalt (not cyan), clouds capped below the softbox white."""
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    sat = np.clip((b - r) * 1.6, 0, 1)
    out = np.stack([r + 0.03 * sat, g - 0.01 * sat, b - 0.02 * sat], -1)
    l = (0.2126 * out[..., 0] + 0.7152 * out[..., 1] + 0.0722 * out[..., 2])[..., None]
    out = out * 0.9 + l * 0.1
    out = out * (1 - lift) + lift
    return np.clip(np.minimum(out, 0.93), 0, 1)


def sample(img, fx, fy):
    h, w = img.shape[:2]
    x = np.clip(fx * (w - 1), 0, w - 1)
    y = np.clip(fy * (h - 1), 0, h - 1)
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int)
    x1 = np.minimum(x0 + 1, w - 1); y1 = np.minimum(y0 + 1, h - 1)
    tx = (x - x0)[..., None]; ty = (y - y0)[..., None]
    return (img[y0, x0] * (1 - tx) * (1 - ty) + img[y0, x1] * tx * (1 - ty)
            + img[y1, x0] * (1 - tx) * ty + img[y1, x1] * tx * ty)


us = (np.arange(W) + 0.5) / W
vs = (np.arange(H) + 0.5) / H
el = (0.5 - vs) * 180.0  # degrees, +90 top
U, EL = np.meshgrid(us, el)

# ── room: pale walls, a little bluer toward the ceiling ──────────────────
wall_lo = np.array([0.935, 0.945, 0.958])
wall_hi = np.array([0.84, 0.87, 0.925])
t = smooth(4, 80, EL)[..., None]
room = wall_lo * (1 - t) + wall_hi * t
# very soft large-scale light falloff around the room
az = 0.5 + 0.5 * np.cos((U - 0.5) * 2 * np.pi)
room = room * (0.94 + 0.06 * az[..., None])

# floor: pale grey-blue, darkening toward the nadir
f_t = smooth(-1, -70, EL)[..., None]
floor = np.array([0.80, 0.83, 0.88]) * (1 - f_t) + np.array([0.60, 0.645, 0.72]) * f_t
above = smooth(-0.15, 0.15, EL)[..., None]
env = room * above + floor * (1 - above)

skies = [grade(load("sky-4.jpg"), 0.08), grade(load("sky-14.jpg"), 0.0), grade(load("sky-1.jpg"), 0.1), grade(load("sky-10.jpg"), 0.04)]


def wrapdu(u0):
    return ((U - u0 + 0.5) % 1.0) - 0.5  # signed turns from u0


def window(u0, du, e0, e1, img, cols, rows, mull=0.22, frame=0.42):
    """A window at azimuth u0 (half-width du turns), elevation e0..e1 deg,
    showing `img`, divided by `cols` x `rows` dark mullions."""
    global env
    d = wrapdu(u0)
    inside = (np.abs(d) < du) & (EL > e0) & (EL < e1)
    fx = (d + du) / (2 * du)
    fy = 1 - (EL - e0) / (e1 - e0)
    pic = sample(img, np.clip(fx, 0, 1), np.clip(fy, 0, 1))
    m = inside[..., None].astype(np.float32)
    env = env * (1 - m) + pic * m
    # mullions + frame (dark navy-grey lines), in degrees
    xdeg = d * 360.0
    wdeg = du * 360.0
    lines = np.zeros_like(EL)
    for k in range(cols + 1):
        x = -wdeg + 2 * wdeg * k / cols
        th = frame if k in (0, cols) else mull
        lines = np.maximum(lines, (np.abs(xdeg - x) < th) & (EL > e0 - frame) & (EL < e1 + frame))
    for k in range(rows + 1):
        y = e0 + (e1 - e0) * k / rows
        th = frame if k in (0, rows) else mull
        lines = np.maximum(lines, (np.abs(EL - y) < th) & (np.abs(xdeg) < wdeg + frame))
    lm = lines[..., None].astype(np.float32)
    env = env * (1 - lm) + np.array([0.10, 0.13, 0.20]) * lm
    # floor reflection of the window (dimmed, softened later)
    insr = (np.abs(d) < du) & (-EL > e0) & (-EL < e1 * 0.55)
    picr = sample(img, np.clip(fx, 0, 1), np.clip(1 - (-EL - e0) / (e1 - e0), 0, 1))
    mr = insr[..., None].astype(np.float32) * 0.28
    env = env * (1 - mr) + (picr * 0.85) * mr


# the most reflected direction (behind the camera) gets the big window
window(0.50, 0.075, 10, 52, skies[0], 3, 2)
window(0.50 - 0.205, 0.045, 6, 44, skies[1], 2, 3)
window(0.50 + 0.215, 0.05, 14, 40, skies[2], 2, 1)
window(0.02, 0.09, 8, 46, skies[3], 4, 2)
window(0.50 + 0.36, 0.03, 4, 58, skies[1], 1, 4)


def rect(u0, du, e0, e1, val, soft=0.25):
    d = np.abs(wrapdu(u0)) * 360.0
    w = du * 360.0
    m = (1 - smooth(w - soft, w + soft, d)) * smooth(e0 - soft, e0 + soft, EL) * (1 - smooth(e1 - soft, e1 + soft, EL))
    return m[..., None], val


# softboxes (pure white — the shader boosts >= 0.97 into HDR)
for (u0, du, e0, e1) in [(0.5 - 0.115, 0.012, 16, 50), (0.5 + 0.13, 0.008, 6, 62), (0.5, 0.06, 60, 63.5), (0.5 - 0.33, 0.02, 20, 34), (0.5 + 0.29, 0.016, 44, 60)]:
    m, v = rect(u0, du, e0, e1, 1.0)
    env = env * (1 - m) + np.array([1.0, 1.0, 1.0]) * m

# thin dark verticals (room edges / columns) — e12's fine dark contour lines
for (u0, e0, e1, th) in [(0.5 - 0.15, -6, 74, 0.16), (0.5 + 0.17, -6, 70, 0.14), (0.5 + 0.43, -8, 80, 0.2), (0.5 - 0.40, -8, 76, 0.18), (0.5 - 0.27, -3, 60, 0.1)]:
    d = np.abs(wrapdu(u0)) * 360.0
    m = ((d < th) & (EL > e0) & (EL < e1))[..., None].astype(np.float32)
    env = env * (1 - m * 0.8) + np.array([0.16, 0.19, 0.27]) * m * 0.8

# the horizon: one crisp dark line, with a white-hot haze just above it
hz = np.exp(-((EL - 0.0) / 0.32) ** 2)[..., None]
env = env * (1 - 0.92 * hz) + np.array([0.06, 0.08, 0.14]) * 0.92 * hz
haze = np.exp(-((EL - 1.6) / 1.1) ** 2)[..., None]
env = np.maximum(env, env * (1 - 0.5 * haze) + 0.99 * 0.5 * haze)

img = Image.fromarray((np.clip(env, 0, 1) * 255 + 0.5).astype(np.uint8))
# a touch of softness so mullions don't alias when magnified, plus print grain
img = img.filter(ImageFilter.GaussianBlur(0.6))
arr = np.asarray(img).astype(np.float32)
arr += rng.normal(0, 1.2, arr.shape[:2])[..., None]
img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
os.makedirs(OUT, exist_ok=True)
img.save(os.path.join(OUT, "env-white.jpg"), quality=90)
img.resize((1024, 512), Image.LANCZOS).save(os.path.join(OUT, "env-white-1k.jpg"), quality=88)
print("wrote env-white.jpg, env-white-1k.jpg")
