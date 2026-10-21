# Launch Checklist — SIGNAL / NOISE

*W12 deliverable, updated 2026-07-17. All 12 roadmap weeks executed, deployed live at williamkeffer.com (GitHub Pages, custom domain), plus a feedback pass (chrome matcap tendrils, velocity-aware transitions) and an overnight structural overhaul (Writing section, section reorder). Remaining items below are human-required.*

## Performance certification (measured on the static production build)

| Metric | Budget | Measured | Status |
|---|---|---|---|
| FCP | <1.2s | 56ms (localhost) | ✅ |
| LCP | <2.5s | 140ms (localhost) | ✅ |
| CLS | ≈0 | 0.00001 | ✅ |
| Total transfer (hero load) | — | 2.65MB (was 13.2MB) | ✅ |
| Fonts | — | 183KB (was 3.9MB) | ✅ |
| Runtime | 60fps | 120fps measured w/ WebGL layer | ✅ |
| Scroll main-thread busy (4s scroll, 1920×1200@2x, headless, ambient GL loop live) | <60% | 58% (was 95% before 2026-09-08) | ✅ |
| Scroll style-recalc time (same probe) | — | 0.32s (was 2.34s) | ✅ |
| p95 frame gap while scrolling (same probe) | <16.7ms | 9.4ms (was 17.2ms); 0 frames >33ms | ✅ |

Optimizations applied: 800px fragment thumbs (`assets/sky/thumbs/`), WebP brush textures, logos resized to 160px, font weights trimmed (Shippori 400, JetBrains 400), decorative layers client-mounted (kills the seed-swap CLS), fixed SSR seed + post-mount daily seed (kills the daily hydration mismatch).

2026-09-09 — ONE STATIC COMPOSITION (art-directed after Aletiune): the daily-seed generator is gone. `lib/composition.ts` hand-places the focal nucleus, eight edge-traced tubes, three chrome blades, three calligraphic swipes, every sky photograph (with the reference's oblique captions), every flat block (ink / cornflower-blue with star cut-outs / halftone / blur) and every typed text column; only fine texture runs from one frozen seed (`TEXTURE_SEED`). Placed elements have a scroll window (`lib/window.ts`) so each section keeps its own cast. The section-boundary beat/flash is retired. Fonts are self-hosted (`app/fonts`, OFL): Archivo (wght+wdth), Inter, Shippori Mincho, and **Server Mono** (Internet Development) replaces JetBrains Mono. Detail vocabulary rebuilt from the reference: schematic traces, dotted rows, double rules with stepped junctions, italic codes, dial arcs, star outlines, halftone patches; typed slash-lists for tags; hairline "leader" links; pointer guides instead of the bracket reticle; no chips, no corner brackets, no cyan stubs. Detail pages get a white wash over the same composition. Figma pages 04–06 hold the reference study, the detail language, and the v3 captures.

2026-09-08 overhaul: the whole line field moved from Canvas 2D (~700 gradient polygons + a full-canvas CSS blur per scroll frame) to one WebGL scene (`components/canvas/sceneGL.ts`, ~10 batched draw calls, scroll deform / tune pull / density gating in shaders, glow in-shader, viewport-sized canvas with camera parallax). The bigger win was outside the canvas: `--density-*`/`--tune`/`--dive` custom-property writes on `<html>` were re-styling every overlay node each frame — replaced by direct `opacity`/`transform` writes on the six layer containers (`bindLayerOpacity` in `lib/tuning.ts`). Canvas 2D (`scene2d.ts`) remains the mobile / reduced-motion / no-WebGL fallback.

## Deploy (GitHub Pages, custom domain — done)

- [x] Live at **williamkeffer.com** via GitHub Pages (`.github/workflows/deploy.yml`, triggers on push to `main`), custom domain already DNS-configured from a prior site, `public/CNAME` + `public/.nojekyll` committed
- [x] `metadata.metadataBase` set to `https://williamkeffer.com` in `app/layout.tsx`
- [ ] Verify `/og.jpg` renders in the socials debuggers (opengraph.xyz, Twitter card validator)

## Manual QA

- [x] Safari macOS (2026-07-16): hero, scrolled states, all layers render — validated via real Safari
- [x] iOS Safari (2026-07-16): validated via iPhone 17 Pro simulator — mobile composition intact
- [ ] iOS **real device**: touch feel, Lenis inertia, GL tier fallback under memory pressure
- [ ] Firefox: canvas perf, clip-path transitions on menu/veil (no binary on the dev machine)
- [ ] Mid-range Android: scroll fps, tap targets
- [ ] Keyboard-only full pass done in Chromium; VoiceOver spot-check remains (menu dialog, case pages)

## Figma

- [x] Motion spec + density map placed on "01 · Foundations & Motion" of the ORIGINAL file (2026-07-16, via GUI automation after the MCP cap)
- [x] 2026-09-08: design source of truth moved to a NEW file under the wilk05 student team — "KEFFER — SIGNAL/NOISE v2" (key `7L3EPFIFzdLn16fsMIIJ52`): SN/Color variables, SN text styles, My Stuff tile + catalogue frames, background before/after study, captures. The old Starter-plan file is read-only from this account and no longer needed.
- [ ] Weekly: drop latest `scripts/critique.mjs` shots on "03 · Captures"

## Content (explicitly out of scope for this pass, needed before submissions)

- [ ] Real screenshots/video loops in project card media wells + case-study bodies (structure is ready — cards and `/work/[slug]` accept imagery today)
- [ ] Case study long-form copy per project (design/decision narrative, not just descriptions)
- [ ] Resume/CV pages restyle to the new type system (still on the old look)
- [x] **Mii** (2026-09-13) — William's live 3D Mii uses skeletal transitions between the scroll wave, click/keyboard celebration, and idle, with facial expressions. Larger layout stays to the left of the desktop bio. Local GLBs in `public/assets/mii/`; source/provenance in `scripts/asset-tools/mii-source/`. Rebuild with `node scripts/asset-tools/prepare-mii.mjs`; motion regression tests in `tests/mii-motion.test.mjs`.
- [ ] "My stuff" catalogues — the Writing section was retired (2026-09-08, no blog planned). `content/stuff.ts` holds five collections (hardware, software, media, Stüssy, reading); each renders a tile on the home page and a ledger page at `/stuff/[id]`. Fill the `pending` slots with real entries (`name`, `note`, `meta`, optional `url`) — media now holds nine records with cover art (`content/media.ts`, `public/assets/media/`) — films (as stills, not posters) are next; Stüssy and reading are still unlogged.

## Submissions

- [ ] Film 30–45s trailer (screen capture: entry → hero → tuning beat → BIO silence → cards → case file → the Dive)
- [ ] Awwwards — Site of the Day (design 40 / usability 30 / creativity 20 / content 10)
- [ ] CSS Design Awards, FWA, Godly, Minimal Gallery (free)
- [ ] Post the trailer + write-up (the SIGNAL/NOISE system is itself a story: density choreography, daily seed, per-project re-seeding)

## Rig

`node scripts/critique.mjs <port> <outDir>` — full-scroll screenshot critique.
`npx serve -l 3778 out` + scratch `vitals.js` — production web-vitals measurement.
