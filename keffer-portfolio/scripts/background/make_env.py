#!/usr/bin/env python3
"""The ALLOY background (derived from the CHROME study) — compose the chrome environment map.

Builds a 2048x1024 equirectangular sky from the site's own photographs
(public/assets/sky) so the chrome reflects the same skies the page shows:

  upper dome   sky-4 (centre, the most-reflected direction) and sky-1 (back),
               mirrored so the azimuth wraps seamlessly, cooled to cobalt
  horizon      a white-hot haze band with a crisp lower edge (the chrome break)
  lower band   near-black navy / charcoal with faint horizontal structure
  softboxes    a few pure-white strips (>= 0.98) the shader boosts to HDR

Mapping (matches shaders.ts):  u = 0.5 + atan2(d.x, d.z) / 2pi,
v = acos(d.y) / pi (row 0 = zenith).  u = 0.5 is +Z, i.e. BEHIND the camera,
which is what camera-facing surfaces reflect.

  python3 scripts/background/make_env.py
"""
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
SKY = os.path.join(ROOT, "public/assets/sky")
OUT = os.path.join(ROOT, "public/assets/background")
W, H = 2048, 1024
rng = np.random.default_rng(20261020)


def load(name):
    return np.asarray(Image.open(os.path.join(SKY, name)).convert("RGB"), dtype=np.float32) / 255.0


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def grade_sky(img):
    """Cool, cobalt, slightly crushed clouds so pure white is reserved for softboxes."""
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    # pull cyan toward cobalt: reduce green in the blue areas
    # cobalt, not violet: hold green, trim the most saturated blue a touch
    sat = np.clip((b - r) * 1.6, 0, 1)
    g2 = g + 0.02 * sat
    r2 = r + 0.03 * sat
    b2 = b - 0.03 * sat
    out = np.stack([r2, g2, b2], -1)
    l = (0.2126 * r2 + 0.7152 * g2 + 0.0722 * b2)[..., None]
    out = out * 0.88 + l * 0.12
    # cap clouds at 0.93
    out = np.minimum(out, 0.93 - 0.05 * (1 - lum[..., None]))
    return np.clip(out, 0, 1)


a = grade_sky(load("sky-4.jpg"))   # centre
b = grade_sky(load("sky-1.jpg"))   # back

# Azimuth u in [0,1): 4 tiles of 0.25 — [b mirrored | a | a mirrored | b]
# with a centred on u = 0.5: tiles start at u = 0.125.
EL_LO, EL_HI = np.radians(2.5), np.radians(76.0)

us = (np.arange(W) + 0.5) / W
vs = (np.arange(H) + 0.5) / H
el = (0.5 - vs) * np.pi  # +pi/2 at top
U, EL = np.meshgrid(us, el)


def sample(img, fx, fy):
    """Bilinear sample img at fractional coords fx, fy in [0,1]."""
    h, w = img.shape[:2]
    x = np.clip(fx * (w - 1), 0, w - 1)
    y = np.clip(fy * (h - 1), 0, h - 1)
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int)
    x1 = np.minimum(x0 + 1, w - 1); y1 = np.minimum(y0 + 1, h - 1)
    tx = (x - x0)[..., None]; ty = (y - y0)[..., None]
    return (img[y0, x0] * (1 - tx) * (1 - ty) + img[y0, x1] * tx * (1 - ty)
            + img[y1, x0] * (1 - tx) * ty + img[y1, x1] * tx * ty)


# photo-space vertical coordinate: 1 at EL_LO (photo bottom) .. 0 at EL_HI (top)
fy = np.clip(1 - (EL - EL_LO) / (EL_HI - EL_LO), 0, 1)
ut = ((U - 0.125) % 1.0) / 0.25          # tile coordinate 0..4
tile = np.floor(ut).astype(int)
f = ut - tile                            # 0..1 within tile
# tile 0: a, 1: a mirrored, 2: b, 3: b mirrored  (a centred on u=0.5 → tile edges 0.375..0.625 = tiles 1..)
# remap so u = 0.5 lands in the middle of the a / mirrored-a pair
fx = np.where(tile % 2 == 0, f, 1 - f)
sa = sample(a, fx, fy)
sb = sample(b, fx, fy)
# which photo: tiles 1 and 2 (u in 0.375..0.875)? keep a around u=0.5
ua = np.abs(((U - 0.5 + 0.5) % 1.0) - 0.5)  # angular distance from u=0.5 in turns
wa = 1 - smooth(0.20, 0.27, ua)          # a within ±0.2 turns of centre, crossfade 0.07
sky = sa * wa[..., None] + sb * (1 - wa[..., None])

# zenith: deep cobalt
zen = np.array([0.10, 0.20, 0.52], np.float32)
zt = smooth(np.radians(58), np.radians(74), EL)[..., None]
sky = sky * (1 - zt) + zen * zt

# horizon haze: lift toward white as we approach the horizon from above
haze_up = (1 - smooth(np.radians(0.5), np.radians(9), EL))[..., None]
haze_col = np.array([0.88, 0.92, 0.97], np.float32)
sky = sky * (1 - 0.7 * haze_up) + haze_col * 0.7 * haze_up
# white-hot core just above the horizon
core = np.exp(-((EL - np.radians(1.4)) / np.radians(1.6)) ** 2)[..., None]
sky = np.maximum(sky, sky * (1 - core) + np.array([0.99, 0.995, 1.0]) * core)

# ground: crisp break under the horizon, then deep navy/charcoal
g_t = EL
ground = np.zeros_like(sky)
c0 = np.array([0.32, 0.38, 0.52]); c1 = np.array([0.11, 0.14, 0.23]); c2 = np.array([0.06, 0.075, 0.115]); c3 = np.array([0.09, 0.10, 0.12])
t1 = smooth(np.radians(-0.6), np.radians(-7), g_t)[..., None]
t2 = smooth(np.radians(-7), np.radians(-34), g_t)[..., None]
t3 = smooth(np.radians(-40), np.radians(-90), g_t)[..., None]
ground = c0 * (1 - t1) + c1 * t1
ground = ground * (1 - t2) + c2 * t2
ground = ground * (1 - t3) + c3 * t3
# faint horizontal structure (sea / far land reflections), low frequency in azimuth
n_rows = rng.normal(0, 1, H).astype(np.float32)
n_rows = np.convolve(n_rows, np.ones(9) / 9, mode="same")
az_mod = 0.5 + 0.5 * np.sin(U * 2 * np.pi * 3 + 1.3) * np.sin(U * 2 * np.pi * 7 + 0.4)
ground = ground * (1 + 0.10 * n_rows[:, None, None] * az_mod[..., None])
# a navy reflected-sky sheen band at -16°
sheen = np.exp(-((EL - np.radians(-16)) / np.radians(4.5)) ** 2)[..., None]
ground = ground + np.array([0.06, 0.10, 0.22]) * sheen * (0.6 + 0.4 * az_mod[..., None])

above = smooth(np.radians(-0.6), np.radians(0.6), EL)[..., None]
env = sky * above + ground * (1 - above)


# softboxes — pure white (the shader boosts >= 0.97 into HDR)
def strip(u0, du, e0, e1, val=1.0, soft=0.0015):
    """Axis-aligned rect in (u, el) with soft edges; u0 centre, du half-width (turns)."""
    du_ = np.abs(((U - u0 + 0.5) % 1.0) - 0.5)
    mu = 1 - smooth(du - soft, du + soft, du_)
    me = smooth(np.radians(e0) - 0.004, np.radians(e0) + 0.004, EL) * (1 - smooth(np.radians(e1) - 0.004, np.radians(e1) + 0.004, EL))
    m = (mu * me)[..., None]
    return m * val


box = np.zeros_like(env)
box = np.maximum(box, strip(0.5 + 0.10, 0.006, 9, 58))       # tall thin vertical strip, right of centre
box = np.maximum(box, strip(0.5 - 0.17, 0.012, 6, 44))       # wider vertical strip, left
box = np.maximum(box, strip(0.5 - 0.03, 0.05, 27, 28.6))      # horizontal bar, upper centre
box = np.maximum(box, strip(0.5 + 0.31, 0.018, 18, 30))       # side panel, back right
# white light lines inside the dark band — the white swirls on black chrome (r01)
box = np.maximum(box, strip(0.5 + 0.02, 0.10, -12.6, -11.8, 0.95))
box = np.maximum(box, strip(0.5 - 0.21, 0.07, -23.6, -22.6, 0.85))
box = np.maximum(box, strip(0.5 + 0.19, 0.05, -6.4, -5.8, 0.9))
box = np.maximum(box, strip(0.5 - 0.06, 0.035, -33.5, -32.3, 0.8))
box = np.maximum(box, strip(0.5 + 0.12, 0.004, -40, -4, 0.75))     # a vertical light in the ground
box = np.maximum(box, strip(0.5 - 0.33, 0.006, -30, -3, 0.7))
mask = box.max(-1, keepdims=True)
env = env * (1 - mask) + np.maximum(env, box) * mask
env[..., :] = np.where(mask > 0.5, np.maximum(env, mask * np.array([1.0, 1.0, 1.0]) * (box.max(-1, keepdims=True))), env)

# the sun from sky-1 sits in the back half; make its core hot
lum = env.mean(-1)
env = np.where((lum > 0.9)[..., None] & (EL > np.radians(20))[..., None], np.minimum(1.0, env * 1.08), env)

# fine grain so gradients never band in reflections
env = env + rng.normal(0, 0.0015, env.shape).astype(np.float32)
img = Image.fromarray((np.clip(env, 0, 1) * 255 + 0.5).astype(np.uint8))
os.makedirs(OUT, exist_ok=True)
img.save(os.path.join(OUT, "env-sky.jpg"), quality=94, subsampling=0)
img.resize((1024, 512), Image.LANCZOS).save(os.path.join(OUT, "env-sky-1k.jpg"), quality=92, subsampling=0)
print("wrote", os.path.join(OUT, "env-sky.jpg"))
