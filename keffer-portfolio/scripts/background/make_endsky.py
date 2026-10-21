#!/usr/bin/env python3
"""The ALLOY background — the end-card sky ("pure signal").

The stock Dive ends on sky-12, a saturated cyan outside this variant's cobalt
grade. ALLOY's finale flies into a chrome mirror whose reflected sky becomes
the end card, so the end sky is graded into the same family as the chrome's
environment and the mounted panels: sky-10 (a calm cumulus under clear sky,
from the site's own photographs) pulled from cerulean to cobalt, the zenith
deepened, cloud whites capped just under paper white, upscaled 2x with a fine
print grain so the upscale never reads as blur.

  python3 scripts/background/make_endsky.py
"""
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
SKY = os.path.join(ROOT, "public/assets/sky")
OUT = os.path.join(ROOT, "public/assets/background")
rng = np.random.default_rng(4404)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


src = Image.open(os.path.join(SKY, "sky-10.jpg")).convert("RGB")
W, H = src.size[0] * 2, src.size[1] * 2
img = src.resize((W, H), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2.2, percent=40, threshold=2))
a = np.asarray(img).astype(np.float32) / 255.0
r, g, b = a[..., 0], a[..., 1], a[..., 2]
lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
sat = np.clip((b - r) * 1.5, 0, 1)            # 1 in clear sky, 0 in cloud
# cerulean -> cobalt: lift red a little, trim green, in the blue only
r2 = r + 0.045 * sat * sat
g2 = g - 0.045 * sat * sat
b2 = b + 0.02 * sat
out = np.stack([r2, g2, b2], -1)
# deepen the zenith (top of frame) and keep a little air above the cloud
yy = np.linspace(0, 1, H)[:, None]
deep = (1 - smooth(0.0, 0.55, yy))[..., None] * sat[..., None]
out = out * (1 - 0.16 * deep)
# clouds: cool, capped just under paper white
cloud = (1 - sat)[..., None] * smooth(0.45, 0.85, lum)[..., None]
out = out * (1 - 0.25 * cloud) + np.array([0.93, 0.945, 0.965]) * 0.25 * cloud
out = np.minimum(out, 0.955)
# fine print grain
out += rng.normal(0, 0.007, out.shape[:2])[..., None]
img = Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8))
os.makedirs(OUT, exist_ok=True)
img.save(os.path.join(OUT, "end-sky.jpg"), quality=88)
img.resize((W // 2, H // 2), Image.LANCZOS).save(os.path.join(OUT, "end-sky-1k.jpg"), quality=86)
print("wrote end-sky.jpg", img.size)
