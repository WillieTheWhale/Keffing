"""Small, hand-drawn pixel textures for the Barista Express Blender model."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
import math
import random

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "artwork/hardware/textures"
OUT.mkdir(parents=True, exist_ok=True)
FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"
BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
rng = random.Random(870)


def font(size, bold=False):
    return ImageFont.truetype(BOLD if bold else FONT, size)


def save(im, name):
    im.save(OUT / f"{name}.png", optimize=True)


# Deliberately restrained grain, matching the original collection's finish atlas.
colors = {
    "sesame": (39, 40, 39), "edge": (57, 59, 57),
    "steel": (164, 172, 176), "chrome": (213, 220, 220),
    "coffee": (60, 38, 26), "roast": (79, 49, 30),
    "darkRoast": (39, 27, 23), "rubber": (19, 22, 22),
}
im = Image.new("RGB", (256, 128))
for i, (name, color) in enumerate(colors.items()):
    for y in range(64):
        stripe = rng.choice([-3, -1, 0, 0, 1, 3]) if name in ("steel", "chrome") else 0
        for x in range(64):
            noise = rng.choice([-2, -1, 0, 0, 0, 1, 2]) + stripe
            im.putpixel((i % 4 * 64 + x, i // 4 * 64 + y), tuple(max(0, min(255, c + noise)) for c in color))
save(im, "espresso-finishes")

# Text/face atlas: geometry supplies the silhouette; these supply the fine details.
im = Image.new("RGBA", (512, 512))
d = ImageDraw.Draw(im)
regions = {}


def label(key, text, rect, size=13, color="#c0c4c0", bold=False):
    x, y, w, h = rect
    regions[key] = rect
    d.multiline_text((x+w/2, y+h/2), text, font=font(size, bold), fill=color, anchor="mm", align="center", spacing=1)


label("brand", "Breville", (0, 0, 192, 48), 37, "#929894", True)
label("power", "POWER", (192, 0, 96, 32), 13)
label("grind", "GRIND AMOUNT", (288, 0, 128, 32), 12)
label("filter", "FILTER SIZE", (0, 48, 112, 32), 12)
label("program", "PROGRAM", (112, 48, 112, 32), 12)
label("single", "SINGLE", (224, 48, 80, 24), 11)
label("double", "DOUBLE", (304, 48, 80, 24), 11)
label("clean", "CLEAN ME", (0, 80, 96, 32), 10)
label("steam", "HOT WATER\nSTEAM", (96, 80, 96, 32), 10)
label("tamper", "TAMPER\n▼", (192, 80, 96, 40), 11)
label("grindPush", "AUTO · PUSH ONCE\nMANUAL · PUSH & HOLD\nGRIND", (0, 128, 192, 64), 12, "#303632", True)
label("lock", "INSERT        →        LOCK", (192, 144, 256, 32), 13, "#252b28", True)
label("size", "GRIND SIZE", (0, 192, 128, 32), 12)
label("tank", "MAX\n\n2 L", (448, 128, 64, 96), 13, "#b2b8b4")

for key, ox, count in [("cup", 400, 1), ("cups", 456, 2)]:
    regions[key] = [ox, 48, 56, 36]
    for j in range(count):
        x = ox + (18 if count == 1 else 5) + j*23
        d.rounded_rectangle((x, 55, x+17, 69), radius=2, outline="#c0c4c0", width=2)
        d.arc((x+14, 56, x+22, 65), -90, 90, fill="#c0c4c0", width=2)
        d.line((x-2, 73, x+20, 73), fill="#c0c4c0", width=2)

# Radial brushed button cap, not a photographic reflection.
regions["button"] = [0, 256, 64, 64]
for y in range(64):
    for x in range(64):
        dx, dy = x-31.5, y-31.5
        radius = math.hypot(dx, dy)
        if radius <= 31.5:
            a = math.atan2(dy, dx)
            c = int(184 + 27*math.cos(a*2-.8) + 9*math.sin(a*6) + (3 if int(radius)%3 == 0 else 0))
            im.putpixel((x, y+256), (c, c+3, min(c+5, 255), 255))

# Gauge is a real UV-mapped dial, with a separately modeled red pointer.
regions["gauge"] = [128, 256, 128, 128]
cx, cy = 192, 320
d.ellipse((129, 257, 254, 382), fill="#e1e2d9", outline="#747b77", width=2)
d.arc((139, 267, 245, 373), 145, 395, fill="#8f9990", width=2)
d.arc((144, 272, 240, 368), 220, 307, fill="#b7c4b6", width=8)
for i in range(41):
    a = math.radians(145+i*250/40)
    r1, r2 = (44, 53) if i%5 == 0 else (49, 53)
    d.line((cx+r1*math.cos(a), cy+r1*math.sin(a), cx+r2*math.cos(a), cy+r2*math.sin(a)), fill="#313a33", width=2 if i%5 == 0 else 1)
d.text((192, 300), "ESPRESSO", font=font(9, True), fill="#50584e", anchor="mm")
d.text((192, 345), "PRESSURE", font=font(9, True), fill="#50584e", anchor="mm")
save(im, "espresso-details")
(OUT / "espresso-details.json").write_text(json.dumps(regions, indent=2)+"\n")

# Alpha color is used directly by Blender and glTF; no unsupported transmission.
im = Image.new("RGBA", (32, 32), (145, 152, 145, 30))
save(im, "espresso-smoke")

# A tiled roasted-bean fill gives the hopper depth without thousands of meshes.
im = Image.new("RGB", (256, 128), "#211b18")
for row in range(7):
    for col in range(10):
        tile = Image.new("RGBA", (34, 24))
        td = ImageDraw.Draw(tile)
        tone = rng.choice(["#4d3b2c", "#5a4230", "#3e3128", "#654936", "#483529"])
        td.ellipse((2, 4, 31, 21), fill=tone, outline="#28211b", width=2)
        td.arc((5, 6, 27, 18), 185, 285, fill="#79604a", width=1)
        td.line([(5,13),(12,10),(19,13),(28,12)], fill="#241c17", width=2)
        tile = tile.rotate(rng.randint(-65,65), resample=Image.Resampling.NEAREST, expand=True)
        x, y = col*28-8+(row%2)*13, row*19-8
        im.paste(tile, (x,y), tile)
        if x+tile.width > 256: im.paste(tile, (x-256,y), tile)
save(im, "espresso-beans")
print("Created four espresso texture maps and the detail atlas manifest.")
