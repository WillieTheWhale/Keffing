# William's Mii assets

`william.miic` is William's original custom character exported from [Mii Creator](https://mii.nxw.pw/app) on September 13, 2026. Blond hair, blue eyes, height 127, build 49, with a navy sweater, white trim, dark pants, and white shoes.

The site renders **one live 3D character**, with a skinned Miitomo body and William's head following the head bone. It uses locally hosted GLB files and does not contact an external renderer at runtime.

- `body.glb`: the Miitomo male skeleton and animation clips from [Mii Creator's source](https://github.com/datkat21/mii-creator/blob/dev/public/assets/models/miiBodyM_miitomo.glb). Runtime vertex colors supply William's navy/white outfit. Animation names: `Wait`, `Pose.04`, `Pose.08`.
- `william-head.glb`: William's exact Studio data converted with [Arian Kordi's FFL renderer](https://mii-unsecure.ariankordi.net/swagger/). Includes Normal (0), Smile (1), Blink (5), and smiling wink (17) material variants on the same face mesh. Creator's own model export dialog did not produce a file; its portable character data was used for this conversion.
- `neutral.png`: original transparent render, used only as a loading/error poster.
- `blink.png`, `wave.webm`, `celebrate.webm`: archived original render exports; no longer used by the runtime.
- `legacy-reference.glb`: retired placeholder, retained outside public assets.

The head's source Studio data is:

```
080031030c040402020c04060404010209000000000b000804000a5400377f0400021c031303160d04000a040109
```

It was converted with `shaderType=miitomo`, `expression=normal,smile,blink,like_wink_left`, and `texResolution=512` through the documented `/miis/image.glb` API. Mii Creator is by kat21 and contributors; the FFL exporter is by Arian Kordi using AboodXD's FFL work. The Mii character system is Nintendo's.

Run `node scripts/asset-tools/prepare-mii.mjs` from `keffer-portfolio` to restore the local model assets and regenerate the poster.

`lib/mii-motion.ts` blends the original skeletal clips with eased weights over 650 ms (800 ms back to idle). It retains all current weights when interrupted. Clip keyframes are sampled along eased cycles to avoid loop seams. No model opacity changes, sprite sheets, image crossfades, or mesh duplication are involved. The component starts a smiling wave on entering the bio, a winking celebration on click/keyboard, and returns to idle. Rendering pauses offscreen and in background tabs; reduced motion uses only a brief facial reaction.

Regression checks load the actual body GLB and verify joint movement, pose continuity under interruption, loop continuity, and the return to idle:

```
node --experimental-strip-types --test tests/mii-motion.test.mjs
```
