# Hardware collection

Ten textured, PS2-inspired models built in Blender 5.2.1 through the
Computer Use plugin. Each `.blend` is self-contained, with packed textures,
editable mesh geometry, named moving assemblies, a preview camera and lights.

The website gallery is at `/stuff/hardware`. Hover or keyboard focus reveals an
object; click, Enter or Space holds it; click again or Escape releases it. Touch
uses the same hold/release control. Reduced-motion preferences select the end
pose immediately. Static rendered images remain available without WebGL.

## Blender files

| Device | Native model | Triangles | Motion |
| --- | --- | ---: | --- |
| 16-inch MacBook Pro, M4 Max, Space Black | [macbook-pro-m4-max.blend](macbook-pro-m4-max.blend) | 7,158 | Display hinge opens to 112° |
| Panasonic Let's Note CF-SX1, Mariana Blue | [panasonic-cf-sx1.blend](panasonic-cf-sx1.blend) | 7,762 | Display hinge opens to 110° |
| Bose QC35, Silver | [bose-qc35.blend](bose-qc35.blend) | 4,012 | Folded earcups unfold |
| AirPods Pro 3, White | [airpods-pro-3.blend](airpods-pro-3.blend) | 10,808 | Case opens, then earbuds rise |
| iPhone 16 Pro Max, Black Titanium | [iphone-16-pro-max.blend](iphone-16-pro-max.blend) | 1,684 | Turns from cameras to display |
| New Nintendo 2DS XL, Hylian Shield Edition | [new-2ds-xl-hylian.blend](new-2ds-xl-hylian.blend) | 2,269 | Shield lid opens to 145° |
| Nintendo DSi XL, Bronze | [dsi-xl-bronze.blend](dsi-xl-bronze.blend) | 4,004 | Lid opens to 146° |
| Mac mini, 2024 | [mac-mini-2024.blend](mac-mini-2024.blend) | 1,290 | Lifts and turns |
| Nintendo Switch, standard neon blue/red | [nintendo-switch.blend](nintendo-switch.blend) | 2,656 | Joy-Cons detach slightly |
| Breville Barista Express, Black Sesame | [breville-barista-express.blend](breville-barista-express.blend) | 9,530 | Inspection turn and steam-wand swivel |

Frame **1** is the resting pose; frame **49** is the revealed pose, at 24 fps.
The native projects open on the revealed pose. The geometry uses centimetres
in Blender, with the scene unit scale set to 0.01. Animation clips retain their
assembly names in the GLB; the website samples all clips together.

Web exports and transparent PNG fallbacks are in `public/assets/hardware/`.
The complete model payload is approximately 4.4 MB before HTTP compression.
The web renderer uses one shared canvas, loads models near the viewport, and
only requests animation frames while a pose changes or a view needs redrawing.

## Construction and textures

Low-segment geometry preserves the recognizable parts: the MacBook's notched
display, broad trackpad and speaker grilles; the Panasonic's bonnet ribs,
circular wheel pad, silver chassis and **top-loading DVD cover**; the Hylian
edition's raised silver trim, Triforce and red crest; the DSi's camera and
speakers; the original Switch's narrow rear kickstand; and the 2024 Mac mini's
vertical front USB-C ports.

The textures in `textures/` combine a small finish palette, UV-mapped labels
and key legends, and low-resolution screens. The MacBook depicts macOS; the
Panasonic shows an **Arch Linux Neofetch-style terminal** with a cyan ASCII logo,
CF-SX1 system details and terminal color swatches. Those terminal details are an
illustrative rendering, not a capture of the owner's installation.

The Switch uses a downsampled [actual HOME menu screenshot](https://www.mariowiki.com/File:Switch_Home_Menu.png),
including Mario Kart 8 Deluxe cover art, the selected tile, status indicators,
and system icons. Nintendo retains the rights to the HOME interface and game art.

The AirPods are a low-poly derivative of [Apple's public AirPods Pro 3 AR model](https://www.apple.com/105/media/us/airpods-pro/2025/7acffb13-4adb-40b1-9393-8f1c99bc6c90/ar/airpods-pro.usdz),
imported and simplified inside Blender via Computer Use. Separate case, lid and
earbud assemblies retain the product's rounded surfaces, silicone tips, vents,
charging wells and hinge. Duplicate coating shells were removed before the
flat-shaded export. The other nine models use original geometry built from
reference photographs.

The bronze DSi now follows the dark brown interior and lighter bronze case edge,
seven-hole speaker clusters, camera/microphone hinge, raised screen surrounds,
small matching brown controls, and plain outer lid. Bose earcups have domed oval
shells, rounded cushions and curved forks. Switch Joy-Cons have straight inner
rails and rounded outer corners.

The Barista Express follows the owner’s black-machine reference: a shaped front
apron, six brushed control faces, a textured pressure dial and red needle,
integrated tamper and grinder cradle, portafilter parked under the grinder,
recessed stainless backsplash, slatted drip tray, side selectors, and separate
hot-water outlet and articulated steam wand. A faceted smoked hopper contains
a tiled bean fill and 36 modeled beans. Its five packed maps use nearest
filtering, as in the rest of the collection.

## Visual references

- **Breville Barista Express:** owner-supplied front photograph of the black machine; [Breville BES870 product page](https://www.breville.com/en-us/product/bes870) confirms the Barista Express name and Black Sesame finish. Geometry is an original stylized interpretation, not a dimensionally exact CAD model.
- **MacBook Pro:** [Apple 16-inch 2024 specifications and imagery](https://support.apple.com/en-us/121554). Space Black was confirmed by the owner.
- **Panasonic CF-SX1:** [PC Watch's original CF-SX1 photographs](https://pc.watch.impress.co.jp/docs/column/hothot/513832.html), including the keyboard, ports, ribs and circular pad. [Panasonic's period promotion](https://ad.impress.co.jp/special/letsnote1206/) provides the Mariana Blue finish swatch (top premium-color option). That swatch is shown on an SX2; only the finish is taken from it. [The SX1 launch coverage](https://www.rbbtoday.com/article/2012/01/26/85528.html) confirms Mariana Blue was offered on SX1.
- **Bose QC35:** [Silver QC35 product photography](https://www.son-video.com/article/casques-bluetooth/bose/quietcomfort-35-silver), studied for headband, cup cushions, yokes and controls.
- **AirPods Pro 3:** [Apple specifications and product views](https://www.apple.com/airpods-pro/specs/), including the taller 62.2 × 47.2 mm case and revised tipped earbuds.
- **iPhone 16 Pro Max:** [Apple specifications and Black Titanium product image](https://support.apple.com/en-us/121032), including camera placement, side controls and 163 × 77.6 × 8.25 mm dimensions.
- **Hylian Shield 2DS XL:** [Nintendo Wire's original front, interior and underside photographs](https://nintendowire.com/news/2018/07/05/gallery-new-2ds-xl-hylian-shield-edition/).
- **Bronze DSi XL:** [Period DSi XL product photograph](https://www.neowin.net/news/nintendo-dsi-xl-hits-stores-on-march-28th/).
- **Mac mini 2024:** [Apple specifications and front/rear port images](https://support.apple.com/en-us/121555).
- **Nintendo Switch:** [Nintendo's hardware comparison](https://www.nintendo.com/fr-fr/Hardware/Gamme-Nintendo-Switch/Quelle-console-Nintendo-Switch-vous-convient-le-mieux-/Quelle-console-Nintendo-Switch-vous-convient-le-mieux--1596110.html), using the standard 6.2-inch LCD model and 239 mm width.

The local reference-image URL ledger is in
`scripts/asset-tools/hardware/references/sources.json`. Product reference photos are
excluded from version control. The sourced HOME screenshot and simplified
AirPods mesh data are retained as build inputs.

## Rebuilding

Texture source: `scripts/asset-tools/hardware/make_textures.py` (Python + Pillow).
Model source: `scripts/asset-tools/hardware/build_models.py`.
AirPods preparation: `scripts/asset-tools/hardware/prepare_airpods.py`, run inside
Blender via `runpy.run_path`. Its retained `references/airpods-low-poly.json`
output lets the normal build run without downloading the USDZ again.

To rebuild geometry, use Blender's Python Console (Shift-F4):

```python
import runpy
hw = runpy.run_path('/absolute/path/to/keffer-portfolio/scripts/asset-tools/hardware/build_models.py', run_name='hardware_builder')
hw['run_batch']()
```

This recreates the original nine projects, GLBs and renders. It resets the manifest
to those nine; run the espresso builder afterward to restore its manifest entry. It switches the
console to a camera-ready 3D viewport before saving the native files. Run
`hw['audit_native']()` to reopen every saved file and verify packed textures,
UV maps and distinct rest/midpoint/revealed poses.

The espresso machine has a separate builder so it can be refined without
regenerating the original collection. First run
`python3 scripts/asset-tools/hardware/make_espresso_textures.py` from the project
root, then run this in Blender’s Python Console:

```python
import runpy
runpy.run_path(
    '/absolute/path/to/keffer-portfolio/scripts/asset-tools/hardware/build_espresso.py'
)['run']()
```

It saves the packed native project, animated GLB and transparent PNG, updates
the manifest, and reopens the native project to verify UVs, packed maps and
distinct resting/midpoint/revealed poses. The original nine files are untouched.

## Verification

- All ten native Blender files reopened successfully, with UVs, packed image
  textures and non-static animation: `native-validation.json`.
- All ten GLBs passed the Khronos glTF Validator with **zero errors and zero
  warnings**: `gltf-validation.json`. Informational notices identify the small
  non-power-of-two screen textures, which are supported by the WebGL2 renderer.
- All nine reveal animations were exercised in the website. Desktop (1440 px)
  and mobile (390 px) layouts, keyboard focus, Space, Escape and hold/release
  were checked. The mobile layout has no horizontal overflow.
- TypeScript, ESLint for the changed page components/data, and the production
  static export passed.

The espresso addition was separately checked in the live gallery for hold/release
Space and Escape, and 390 px / 1440 px layouts with no horizontal overflow.
The browser reported no warnings or errors; TypeScript and the production static
export passed. The final GLB passed validation with zero errors, warnings or infos.
