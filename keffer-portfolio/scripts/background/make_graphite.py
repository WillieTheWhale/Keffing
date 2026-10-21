#!/usr/bin/env python3
"""
The ALLOY background (derived from the CONTOUR study) — offline graphite generator.

Writes single-channel "darkness" PNGs (0 = bare paper, 255 = full graphite)
into public/assets/background/. The page tints them with a graphite colour
and alpha-blends them under the nucleus shards, so white shards occlude the
pencil exactly like cut paper laid over a drawing (ref r04 / r07).

Model: every pencil stroke is stamped as pressure into an accumulation field
(per stroke-width class, then blurred to that width), and the deposit is
  D = 1 - exp(-P * gain * tooth)
where `tooth` is a fine anisotropic paper-grain field — light pressure only
catches the peaks of the paper (grainy), heavy pressure fills it (solid).
A blurred copy of the pressure adds the rubbed haze around the mass.

Everything is seeded; re-running produces identical files.

  python3 scripts/background/make_graphite.py
"""
import os
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

OUT = os.path.join(os.path.dirname(__file__), "../../public/assets/background")


def tooth_field(rng, h, w):
    a = gaussian_filter(rng.standard_normal((h, w)), (0.55, 1.3))
    b = gaussian_filter(rng.standard_normal((h, w)), 2.2)
    t = a / a.std() * 0.8 + b / b.std() * 0.35
    t = 1 / (1 + np.exp(-t * 1.6))  # 0..1, mid 0.5
    return t


class Pressure:
    """Per-width-class accumulators; strokes are stamped as bilinear dots."""

    def __init__(self, h, w, sigmas=(0.55, 0.9, 1.5, 2.6)):
        self.h, self.w = h, w
        self.sig = sigmas
        self.acc = [np.zeros((h, w), np.float64) for _ in sigmas]

    def stroke(self, pts, cls, pressure, taper=0.25):
        pts = np.asarray(pts, np.float64)
        seg = np.diff(pts, axis=0)
        L = np.hypot(seg[:, 0], seg[:, 1])
        tot = L.sum()
        if tot < 1:
            return
        n = max(2, int(tot / 0.45))
        cum = np.concatenate([[0], np.cumsum(L)])
        s = np.linspace(0, tot, n)
        x = np.interp(s, cum, pts[:, 0])
        y = np.interp(s, cum, pts[:, 1])
        u = s / tot
        # pressure profile: quick attack, long body, lifted tail
        prof = np.clip(u / max(1e-3, taper * 0.5), 0, 1) * np.clip((1 - u) / max(1e-3, taper), 0, 1)
        prof = prof ** 0.7
        wgt = pressure * prof * 0.45
        ix = np.floor(x).astype(int)
        iy = np.floor(y).astype(int)
        fx = x - ix
        fy = y - iy
        acc = self.acc[cls]
        for dx, dy, ww in ((0, 0, (1 - fx) * (1 - fy)), (1, 0, fx * (1 - fy)), (0, 1, (1 - fx) * fy), (1, 1, fx * fy)):
            xx = ix + dx
            yy = iy + dy
            m = (xx >= 0) & (xx < self.w) & (yy >= 0) & (yy < self.h)
            np.add.at(acc, (yy[m], xx[m]), (wgt * ww)[m])

    def field(self):
        out = np.zeros((self.h, self.w))
        for a, s in zip(self.acc, self.sig):
            # normalise so a stamped line keeps ~unit peak whatever its width
            out += gaussian_filter(a, s) * (s * 2.2)
        return out


def curve(rng, p0, ang, length, bend, wobble=0.6, step=3.0):
    pts = [np.array(p0, float)]
    a = ang
    n = max(2, int(length / step))
    for i in range(n):
        a += bend / n + rng.normal(0, wobble * 0.02)
        pts.append(pts[-1] + step * np.array([np.cos(a), np.sin(a)]))
    return pts


def ellipse(rng, c, rx, ry, rot, turns=1.08, jitter=0.6):
    t = np.linspace(0, 2 * np.pi * turns, int(120 * turns))
    r = 1 + gaussian_filter(rng.normal(0, 0.06, t.size), 6)
    x = np.cos(t) * rx * r
    y = np.sin(t) * ry * r
    cr, sr = np.cos(rot), np.sin(rot)
    pts = np.stack([c[0] + x * cr - y * sr, c[1] + x * sr + y * cr], 1)
    pts += rng.normal(0, jitter, pts.shape)
    return pts


def mass_mask(h, w, blobs):
    yy, xx = np.mgrid[0:h, 0:w]
    m = np.zeros((h, w))
    for (cx, cy, rx, ry, rot, wt) in blobs:
        cr, sr = np.cos(rot), np.sin(rot)
        dx, dy = xx - cx, yy - cy
        u = (dx * cr + dy * sr) / rx
        v = (-dx * sr + dy * cr) / ry
        m = np.maximum(m, wt * np.exp(-(u * u + v * v) * 1.6))
    return m


def sample_in(rng, mask, n):
    flat = mask.ravel() / mask.sum()
    idx = rng.choice(flat.size, n, p=flat)
    y, x = np.divmod(idx, mask.shape[1])
    return np.stack([x + rng.random(n), y + rng.random(n)], 1)


def finish(P, tooth, gain, haze, haze_sigma=16):
    D = 1 - np.exp(-P * gain * (0.25 + 1.1 * tooth))
    H = gaussian_filter(P, haze_sigma)
    H = H / (H.max() + 1e-9)
    D = 1 - (1 - D) * (1 - haze * H * (0.6 + 0.6 * tooth))
    return np.clip(D, 0, 1)


def save(D, name):
    im = Image.fromarray((D * 255 + 0.5).astype(np.uint8), "L")
    im.save(os.path.join(OUT, name), optimize=True)
    print("wrote", name, im.size)


def zigzag_fill(rng, P, mask, center, ang, extent, spacing, pressure, cls, thr=0.18, jitter=3.0, overshoot=6.0):
    """A pencil scribbling back and forth across the mask. Each pass is its
    own lightly tapered stroke, so the turn points (where the pencil lifts)
    stay soft and the silhouette ragged (ref r04)."""
    d = np.array([np.cos(ang), np.sin(ang)])
    nrm = np.array([-d[1], d[0]])
    k = -extent / 2
    ts = np.arange(-650, 650, 4.0)
    while k < extent / 2:
        base = np.asarray(center, float) + nrm * k
        line = base[None, :] + ts[:, None] * d[None, :]
        vals = np.array([mask_at(mask, q) for q in line])
        inside = np.where(vals > thr)[0]
        if inside.size:
            t0 = ts[inside[0]] + rng.normal(0, overshoot)
            t1 = ts[inside[-1]] + rng.normal(0, overshoot)
            mid = vals[inside].mean()
            a0 = base + d * t0 + rng.normal(0, jitter, 2)
            a1 = base + d * t1 + rng.normal(0, jitter, 2)
            bow = nrm * rng.normal(0, 2.5)
            P.stroke([a0, (a0 + a1) / 2 + bow, a1], cls, pressure * (0.55 + 0.6 * mid), taper=0.35)
        k += spacing * rng.uniform(0.6, 1.4)


def ragged(rng, m, amount=0.55, sigma=18):
    n = gaussian_filter(rng.standard_normal(m.shape), sigma)
    n = n / (n.std() + 1e-9)
    n2 = gaussian_filter(rng.standard_normal(m.shape), sigma / 4)
    n2 = n2 / (n2.std() + 1e-9)
    return np.clip(m * (1 + amount * (0.7 * n + 0.3 * n2)), 0, 1)


def poly_mask(h, w, poly, soft=24):
    from PIL import ImageDraw
    im = Image.new("L", (w, h), 0)
    ImageDraw.Draw(im).polygon([tuple(p) for p in poly], fill=255)
    return gaussian_filter(np.asarray(im, np.float64) / 255.0, soft)


def nucleus_smudge():
    """The big smudge right of the name: a slanted wedge of scribbled graphite
    with a darker core, a hatched flank, rubbed haze, loose pencil lines and
    drawn circles (ref r04 right half, r07 right edge)."""
    rng = np.random.default_rng(20261020)
    W, H = 1000, 1100
    tooth = tooth_field(rng, H, W)
    P = Pressure(H, W)
    # a slanted wedge: wide shoulder top-right, narrowing to a dragged tail
    outer = poly_mask(H, W, [(560, 170), (760, 260), (700, 520), (640, 760), (560, 1000), (430, 960), (380, 720), (420, 420), (470, 250)], soft=26)
    outer = ragged(rng, outer, 0.6)
    core = poly_mask(H, W, [(600, 270), (690, 320), (640, 560), (590, 760), (520, 740), (520, 480)], soft=20)
    core = ragged(rng, core, 0.7, sigma=12)
    # broad light scribble passes build the tone
    for ang, sp, pr in ((-100, 7.0, 0.35), (-84, 9.0, 0.3), (-110, 11.0, 0.25)):
        zigzag_fill(rng, P, outer, (530, 600), np.radians(ang), 520, sp, pr, 3, thr=0.22)
    # medium passes, tighter, on the core
    for ang, sp, pr in ((-98, 4.5, 0.55), (-92, 6.0, 0.45)):
        zigzag_fill(rng, P, core, (545, 560), np.radians(ang), 300, sp, pr, 2, thr=0.25, jitter=2.0)
    # short dark accents (pressure flicks) inside the core
    for p in sample_in(rng, core ** 2, 140):
        a = np.radians(rng.normal(-97, 7))
        L = rng.uniform(25, 90)
        P.stroke(curve(rng, p, a, L, rng.normal(0, 0.1)), 1, rng.uniform(0.6, 1.2), taper=0.3)
    # a few heavy, nearly black pressure strokes down the spine
    spine = poly_mask(H, W, [(610, 300), (650, 330), (600, 640), (560, 700), (548, 640)], soft=10)
    for p in sample_in(rng, spine, 70):
        a = np.radians(rng.normal(-98, 5))
        P.stroke(curve(rng, p, a, rng.uniform(60, 200), rng.normal(0, 0.08)), 3, rng.uniform(1.2, 2.2), taper=0.25)
    # hatched flank (left), crisp parallel lines at ~ -58 deg
    hatch = mass_mask(H, W, [(310, 560, 105, 190, np.radians(-20), 1.0)])
    ang = np.radians(-58)
    d = np.array([np.cos(ang), np.sin(ang)])
    nrm = np.array([-d[1], d[0]])
    for k in range(-55, 55):
        c = np.array([310, 560]) + nrm * k * 5.2 + d * rng.normal(0, 10)
        m = mask_at(hatch, c)
        if m < 0.15:
            continue
        L = rng.uniform(50, 150) * m ** 0.5
        P.stroke(curve(rng, c - d * L * 0.5, ang, L, rng.normal(0, 0.03), wobble=0.2), 0, rng.uniform(0.6, 1.0) * m ** 0.4, taper=0.12)
    # loose long pencil lines escaping the mass (few)
    for _ in range(11):
        p = sample_in(rng, outer, 1)[0]
        a = np.radians(rng.choice([rng.normal(-95, 15), rng.normal(165, 20), rng.normal(15, 20)]))
        P.stroke(curve(rng, p, a, rng.uniform(180, 480), rng.normal(0, 0.4), wobble=0.35), 0, rng.uniform(0.5, 0.9), taper=0.12)
    for c, rx, ry, rot in (((770, 260), 44, 38, 0.3), ((300, 230), 28, 31, -0.2), ((800, 900), 17, 15, 0.0)):
        P.stroke(ellipse(rng, c, rx, ry, rot), 0, 1.0, taper=0.05)
        P.stroke(ellipse(rng, c, rx * 0.95, ry * 1.03, rot + 0.1, turns=0.55), 0, 0.6, taper=0.1)
    z = [np.array([650.0, 960.0])]
    for i in range(12):
        z.append(z[-1] + np.array([rng.normal(8, 3), (-1) ** i * rng.uniform(12, 26)]))
    P.stroke(z, 0, 0.8, taper=0.1)
    D = finish(P.field(), tooth, gain=1.75, haze=0.36, haze_sigma=22)
    D = np.minimum(D, 0.9)
    D *= edge_fade(H, W, 40)
    save(D, "graphite-nucleus.png")


def contact_smudge():
    """A smaller, lighter hatch patch for the contact burst."""
    rng = np.random.default_rng(20261021)
    W, H = 700, 640
    tooth = tooth_field(rng, H, W)
    P = Pressure(H, W)
    mask = mass_mask(H, W, [(360, 320, 150, 110, np.radians(-35), 1.0), (250, 380, 80, 70, 0, 0.6)])
    ang = np.radians(-35)
    d = np.array([np.cos(ang), np.sin(ang)])
    nrm = np.array([-d[1], d[0]])
    for layer, (a_off, gap) in enumerate(((0, 4.2), (62, 6.5))):
        aa = ang + np.radians(a_off)
        dd = np.array([np.cos(aa), np.sin(aa)])
        nn = np.array([-dd[1], dd[0]])
        for k in range(-70, 70):
            c = np.array([350, 320]) + nn * k * gap + dd * rng.normal(0, 10)
            m = mask_at(mask, c)
            if m < 0.1:
                continue
            L = rng.uniform(50, 180) * m ** 0.4
            pts = curve(rng, c - dd * L * 0.5, aa, L, rng.normal(0, 0.03), wobble=0.2)
            P.stroke(pts, 0, rng.uniform(0.5, 1.1) * (0.8 if layer else 1.0), taper=0.12)
    for p in sample_in(rng, mask, 160):
        a = np.radians(rng.normal(-100, 10))
        L = rng.uniform(30, 120)
        P.stroke(curve(rng, p, a, L, rng.normal(0, 0.2)), 1, rng.uniform(0.3, 0.8))
    for _ in range(9):
        p = sample_in(rng, mask, 1)[0]
        P.stroke(curve(rng, p, np.radians(rng.normal(160, 30)), rng.uniform(120, 300), rng.normal(0, 0.4), wobble=0.4), 0, 0.8, taper=0.1)
    P.stroke(ellipse(rng, (520, 170), 26, 24, 0.2), 0, 1.0, taper=0.05)
    D = finish(P.field(), tooth, gain=1.1, haze=0.14)
    D *= edge_fade(H, W, 30)
    save(D, "graphite-contact.png")


def mask_at(mask, p):
    x, y = int(p[0]), int(p[1])
    if 0 <= x < mask.shape[1] and 0 <= y < mask.shape[0]:
        return mask[y, x]
    return 0.0


def edge_fade(h, w, m):
    y = np.minimum(np.arange(h), np.arange(h)[::-1]) / m
    x = np.minimum(np.arange(w), np.arange(w)[::-1]) / m
    return np.clip(y, 0, 1)[:, None] * np.clip(x, 0, 1)[None, :]


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    nucleus_smudge()
    contact_smudge()
