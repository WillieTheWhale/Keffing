# Pixel diff of two capture folders (same file names).
# usage: python3 scripts/visual-diff/diff.py <dirA> <dirB> [heatmapDir]
import sys, os, numpy as np
from PIL import Image
a, b = sys.argv[1], sys.argv[2]; heat = sys.argv[3] if len(sys.argv) > 3 else None
if heat: os.makedirs(heat, exist_ok=True)
names = sorted(f for f in os.listdir(a) if f.endswith(".png"))
worst = 0; bad = 0
for n in names:
    pb = os.path.join(b, n)
    if not os.path.exists(pb): print(f"MISSING {n}"); bad += 1; continue
    A = np.asarray(Image.open(os.path.join(a, n)).convert("RGB")).astype(np.int16)
    B = np.asarray(Image.open(pb).convert("RGB")).astype(np.int16)
    if A.shape != B.shape: print(f"SIZE {n} {A.shape} {B.shape}"); bad += 1; continue
    d = np.abs(A - B).max(axis=2)
    mx = int(d.max()); cnt = int((d > 0).sum()); cnt2 = int((d > 2).sum())
    worst = max(worst, mx)
    if mx > 0:
        bad += 1
        print(f"{n}: max {mx}  px>0 {cnt}  px>2 {cnt2}  ({100*cnt/d.size:.4f}%)")
        if heat:
            h = np.clip(d * 40, 0, 255).astype(np.uint8)
            Image.fromarray(h).save(os.path.join(heat, n))
print(f"{len(names)} shots, {bad} differ, worst channel delta {worst}")
