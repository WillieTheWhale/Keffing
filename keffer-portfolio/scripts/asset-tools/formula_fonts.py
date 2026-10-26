#!/usr/bin/env python3
"""Cut the formula fonts (app/fonts/formula-*.woff2).

The background's formula blocks (content/formulas.ts) are set in Server Mono
and Shippori Mincho, whose vendored files are Latin-only. These subsets hold
just the Greek letters, sub/superscripts and math symbols those two lack,
scaled to the same x-height (and, for the mono, the same 630-unit advance),
so the browser fills the gaps glyph by glyph from them (app/layout.tsx).

Sources (SIL OFL 1.1, no Reserved Font Names), from github.com/google/fonts:
  ofl/notosansmono/NotoSansMono[wdth,wght].ttf
  ofl/notoserif/NotoSerif[wdth,wght].ttf
  ofl/notosansmath/NotoSansMath-Regular.ttf

Run from keffer-portfolio, with fontTools and brotli installed:
  python3 scripts/asset-tools/formula_fonts.py <folder holding the three sources>
"""

import sys
from pathlib import Path

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

FONTS = Path("app/fonts")

# Everything a formula is likely to need beyond Latin. Keep in step with the
# formula fonts' unicode-range in app/layout.tsx.
WANTED = (
    set(range(0x0391, 0x03AA)) | set(range(0x03B1, 0x03CA)) | {0x03D1, 0x03D5, 0x03F5}
    | set(range(0x2070, 0x209D)) | set(range(0x1D2C, 0x1D6B)) | {0x2C7C, 0x1FB1}
    | {0x0302, 0x0303, 0x0304, 0x0307, 0x0308}
    | set(range(0x2190, 0x2196)) | {0x21A6} | set(range(0x21D0, 0x21D5))
    | {ord(c) for c in "∀∂∃∅∇∈∉∋∏∑∓∗∘∙√∝∞∧∨∩∪∫∼≃≅≈≠≡≤≥≪≫⊂⊃⊆⊇⊕⊗⊙⊤⊥⋅‖′″⟨⟩ℂℕℚℝℤℓ𝔼"}
)


def cmap(path):
    return set(TTFont(path).getBestCmap())


def x_height(font):
    return font["OS/2"].sxHeight


def cut(source, unicodes, family, out, target_x_height, advance=None):
    font = TTFont(source)
    if "fvar" in font:
        font = instantiateVariableFont(font, {"wght": 400, "wdth": 100})
    unicodes = unicodes & set(font.getBestCmap())

    opts = Options()
    opts.layout_features = []
    opts.hinting = False
    opts.notdef_outline = True
    opts.name_IDs = [0, 13, 14]
    sub = Subsetter(opts)
    sub.populate(unicodes=unicodes)
    sub.subset(font)

    # scale every glyph to the base face's x-height; a mono keeps its column
    scale = target_x_height / x_height(font)
    glyphs = font.getGlyphSet()
    glyf, hmtx = font["glyf"], font["hmtx"]
    drawn = {}
    for name in font.getGlyphOrder():
        rec = DecomposingRecordingPen(glyphs)
        glyphs[name].draw(rec)
        drawn[name] = rec
    for name, rec in drawn.items():
        width = hmtx[name][0]
        new_width = advance if advance else round(width * scale)
        dx = (new_width - width * scale) / 2 if advance else 0
        pen = TTGlyphPen(None)
        rec.replay(TransformPen(pen, (scale, 0, 0, scale, dx, 0)))
        g = pen.glyph()
        g.recalcBounds(glyf)
        glyf[name] = g
        hmtx[name] = (new_width, getattr(g, "xMin", 0))

    names = font["name"]
    ps = family.replace(" ", "") + "-Regular"
    for nid, value in ((1, family), (2, "Regular"), (3, ps), (4, family), (6, ps)):
        names.setName(value, nid, 3, 1, 0x409)
    font.flavor = "woff2"
    font.save(FONTS / out)
    print(f"{out}: {len(font.getBestCmap())} glyphs, scale {scale:.3f}, {(FONTS / out).stat().st_size} bytes")


def main():
    src = Path(sys.argv[1])
    mono_src = src / "NotoSansMono[wdth,wght].ttf"
    serif_src = src / "NotoSerif[wdth,wght].ttf"
    math_src = src / "NotoSansMath-Regular.ttf"

    server_mono = TTFont(FONTS / "server-mono.woff2")
    shippori = TTFont(FONTS / "shippori-mincho-400.woff2")
    mono_need = WANTED - set(server_mono.getBestCmap())
    serif_need = WANTED - set(shippori.getBestCmap())
    mono_has, serif_has = cmap(mono_src), cmap(serif_src)
    # what neither Noto text face has comes from Noto Sans Math, in both blocks
    symbols_need = (mono_need - mono_has) | (serif_need - serif_has)

    cut(mono_src, mono_need, "Keffer Formula Mono", "formula-mono.woff2", x_height(server_mono), advance=server_mono["hmtx"]["a"][0])
    cut(serif_src, serif_need, "Keffer Formula Serif", "formula-serif.woff2", x_height(shippori))
    cut(math_src, symbols_need, "Keffer Formula Symbols", "formula-symbols.woff2", x_height(shippori))


if __name__ == "__main__":
    main()
