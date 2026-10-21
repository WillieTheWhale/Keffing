#!/usr/bin/env python3
"""The ALLOY background (derived from the CHROME study) — mounted sky panels + paper grain.

Crops and grades the site's own sky photographs into the large mounted
panels the chrome passes in front of, plus a paper-grain tile.
Grades: 'cobalt' (dusty cobalt, the e02/r01 sky), 'navy' (deep navy, e06),
'mono' (cool grey, e11). Every panel gets a faint print grain so it reads
as a printed sheet, not a screen image.

  python3 scripts/background/make_panels.py
"""
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
SKY = os.path.join(ROOT, "public/assets/sky")
OUT = os.path.join(ROOT, "public/assets/background")
rng = np.random.default_rng(20261020)


def grade(img, mode):
    a = np.asarray(img.convert("RGB"), np.float32) / 255.0
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if mode == "cobalt":
        sat = np.clip((b - r) * 1.5, 0, 1)
        g = g - 0.09 * sat
        r = r + 0.05 * sat
        out = np.stack([r, g, b], -1)
        out = 0.04 + 0.94 * out
    elif mode == "navy":
        out = np.stack([r * 0.72, g * 0.8, b * 0.98], -1)
        # deepen the blue, keep cloud whites
        k = np.clip(lum * 1.4 - 0.2, 0, 1)[..., None]
        navy = np.array([0.10, 0.16, 0.36])
        out = navy * (1 - k) + out * k * 1.05 + navy * 0.15 * k
    elif mode == "mono":
        l = lum[..., None]
        out = np.concatenate([l * 0.95, l * 0.98, l * 1.04], -1)
        out = 0.12 + 0.86 * out
    elif mode == "soft":
        # pale cerulean: desaturate a blue-violet sky toward the site blue
        l = lum[..., None]
        out = a * 0.55 + l * 0.45
        out = out * np.array([0.92, 1.0, 1.04]) + np.array([0.02, 0.03, 0.04])
    else:
        out = a
    # print grain + slight lift of blacks
    out = out + rng.normal(0, 0.018, out.shape).astype(np.float32)
    return Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8))


def panel(name, src, box, size, mode, q=86):
    im = Image.open(os.path.join(SKY, src)).convert("RGB")
    if box:
        im = im.crop(box)
    im = im.resize(size, Image.LANCZOS)
    im = grade(im, mode)
    p = os.path.join(OUT, "panels", name + ".webp")
    im.save(p, quality=q, method=6)
    print(name, im.size, os.path.getsize(p) // 1024, "KB")


# hero: deep cobalt with white wisps along the bottom (sky-5 2048x1365)
panel("hero-cobalt", "sky-5.jpg", (300, 80, 2000, 1365), (1360, 1028), "cobalt")
# hero small navy chip (sky-9, 1024x683)
panel("navy-chip", "sky-9.jpg", (80, 60, 900, 640), (820, 580), "navy")
# work: wide navy altocumulus sheet (sky-6 2048x1536)
panel("work-navy", "sky-6.jpg", (0, 200, 2048, 1300), (1400, 752), "navy")
# stuff: cool mono band (sky-13 1200x1800)
panel("stuff-mono", "sky-13.jpg", (0, 300, 1200, 1100), (1200, 800), "mono")
# experience: a tall contrail strip (sky-17 1600x2955)
panel("exp-contrail", "sky-17.jpg", (200, 300, 1400, 2700), (700, 1400), "soft")
# experience: tall cumulus strip, mono (sky-8 1200x2196)
panel("exp-mono", "sky-8.jpg", (200, 200, 1000, 2000), (600, 1350), "mono")
# contact: towering cumulus behind the second mass (sky-16 1200x1800)
panel("contact-cumulus", "sky-16.jpg", (0, 250, 1200, 1250), (1200, 1000), "cobalt")
# about: one small mono chip (sky-12 1200x800)
panel("about-chip", "sky-12.jpg", (300, 120, 1100, 700), (800, 580), "mono")

# paper grain tile, 512 px shown at 256 css px (crisp at 2x): fine noise +
# a few fibres, centred on 0.5 grey for multiply / overlay use
n = rng.normal(0, 1, (512, 512)).astype(np.float32)
img = Image.fromarray(((np.clip(n * 0.5 + 0, -3, 3) / 6 + 0.5) * 255).astype(np.uint8))
img = img.filter(ImageFilter.GaussianBlur(0.55))
a = np.asarray(img, np.float32) / 255.0
# fibres: short soft strokes
fib = np.zeros_like(a)
for _ in range(140):
    x, y = rng.integers(0, 512, 2)
    L = rng.integers(12, 46)
    ang = rng.uniform(0, np.pi)
    for t in range(L):
        xx = int(x + np.cos(ang) * t) % 512
        yy = int(y + np.sin(ang) * t) % 512
        fib[yy, xx] += 0.6
fib = np.asarray(Image.fromarray((np.clip(fib, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)), np.float32) / 255.0
a = a - fib * 0.25
# map to a multiply tile: mostly white, darker specks
tile = 1.0 - np.clip((0.5 - a) * 0.22, 0, 0.12) - np.clip((a - 0.5) * 0.0, 0, 1)
tile = np.clip(tile, 0, 1)
Image.fromarray((tile * 255 + 0.5).astype(np.uint8), "L").save(os.path.join(OUT, "paper-grain.png"), optimize=True)
print("paper-grain", os.path.getsize(os.path.join(OUT, "paper-grain.png")) // 1024, "KB")
