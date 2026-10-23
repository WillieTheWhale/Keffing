# Background — ALLOY ("one world")

The home page background since 2026-10-21 (`http://localhost:3000/`). Code: `keffer-portfolio/components/background/`; assets: `keffer-portfolio/public/assets/background/`; offline generators: `keffer-portfolio/scripts/background/`. It was chosen from a five-way background lab (CONTOUR, CHROME, OVERCAST, ALLOY, DRAWN); the other variants were removed.

## Design plan (written before the build)

**Idea.** v2's liquid chrome and glass stay the hero material, and v1's porcelain becomes a second
material *inside the same three.js scene*: white tubes with flat shading and drawn black contours
that thread through the chrome vortex with real depth, so a porcelain cable can enter the mass,
pass behind one chrome blade and in front of the next, and leave on the other side. The busy glass
centre of v2 is replaced with v1's shard nucleus (outlined white shards, black chips, a graphite
smudge), also in 3D, sitting *inside* the vortex.

**Keep from v2 (unchanged unless it was a listed weakness).** Paper `#f2f1ec` + paper-grain
(multiply) + scan striation; the swept blades/ribbons/petals and their analytic per-pixel normals;
the three registers; specular-only bloom; the per-section groups and presence windows; the print
layout and keep-out rects; the decelerating camera curve shared by the DOM and GL layers.

**Fix from v2.**
- Mass centre: fewer glass slivers and more dark chrome blades inside r < 0.5·rMax; the shard
  nucleus occupies the core.
- Ice-chrome panes: a second, structured "white room" env (softbox windows with sky in them,
  thin dark mullions, a pale floor with one dark horizon line) used only by the white register,
  so flat panes reflect structure instead of a flat grey (e12).
- Mobile/tablet: the lite path gets a slow core rotation at ~30 fps on non-reduced-motion
  devices, paused when hidden.

**Bring from v1.**
- Porcelain: sweep v2's builder with round/oval profiles; shading = paper-white body + one flat
  cool shade band (no gradient); contours in the fragment shader from `n·v / fwidth(n·v)` (≈1.4 CSS
  px), heavier on the shadow side, pressure noise along the length, small light gaps, broken
  terminator strokes. Flat porcelain ribbons and shards get edge lines from their across/edge
  coordinate the same way, so a twisting ribbon pinches to a line.
- Weight hierarchy per section: ≤ 2 heavy, a few medium, thin cables, hairline wires (solid ink).
  Companions ride a parent (including a porcelain cable riding a chrome blade — the alloy), torn
  ends, eccentric loops partly hidden by chrome.
- Nucleus: ~200 outlined white shards and splinters, black chips, fine edge fragments, in 3D
  around the vortex core; a graphite smudge as a textured plane inside the mass (chrome in front of
  it occludes it).
- Print: v1's title block, crop marks around mounted panels, a schematic overprinted on the hero
  sky panel (r04/r07: the shards sit over a schematic-on-sky), and a paper fold crease.

**Finale — "through the mirror".** In the Dive the camera flies into the contact mass; a broad
liquid-chrome mirror sheet (an analytic ray-traced plane in a full-screen pass, writing depth so
it occludes and is occluded by the scene) swings round to face the camera. Its reflection starts
as the chrome env and, as the sheet flattens and fills the frame, becomes a planar reflection of
the end-card sky; the ripples settle and the canvas *is* the end-card sky (graded from the site's
own photos into the cobalt family; replaces the cyan sky-12). The end card's components each have
their own JS motion on a scroll-scrubbed timeline, smoothed by a critically damped spring: the
eyebrow types on in Server Mono; the heading's letters fly in from reflected positions and a
chrome sheen sweeps them; the paragraph reveals word by word; the CTA frame draws, the fill wipes,
the label tracks in; the back-to-top underline draws and its arrow lifts; the © lands last. Idle
life once arrived: slow sky drift and a rare sheen. Reduced motion: a calm crossfade with a DOM
sky.


## Status (2026-10-21)

Built to the plan above by the round-2 agent. The owner stopped the agent mid-way through its last
polish round, and the orchestrator verified and finished the variant directly (no further agent).

**What is in the build** (`components/background/`):
- `engine.ts` / `shaders.ts`: v2's chrome engine extended with a porcelain material (flat white body,
  one shade band, in-shader contours from `n·v / fwidth`), a graphite plane, a second "white room"
  env for the ice register (`env-white.jpg`), and the Dive's liquid mirror (`MIRROR_FRAG`).
- `build.ts` / `geometry.worker.ts`: the geometry build (pieces swept into packed vertex arrays),
  run in a Web Worker; the engine runs the same code in place if workers are unavailable.
- `porcelain.ts`: v1's weight hierarchy in world units (heavy / medium / cable / hairline wire),
  `tube()` / `pribbon()` builders, the 3D shard nucleus (`nucleus()`, `bold` mode for clear
  silhouettes) and combed sliver sheaves.
- `pieces.ts`: the hero vortex with a hollow, clear centre for the shard nucleus; the heavy
  porcelain tube P1 threading through the chrome (in front of the ice loop, behind the front
  blades, over the plunge) and ending in an eccentric torn hook; companions; per-section sets.
- `layout2d.tsx` / `print.tsx`: v2's print layout plus v1's title block, crop marks, schematic
  overprint and fold crease. Ground = v2's paper exactly.
- `Dive.tsx` / `Dive.module.css` / `bus.ts`: the "through the mirror" finale, each component on its
  own scroll-scrubbed, spring-smoothed timeline (see the file header). This finale was also ported
  into option 2 at the owner's request; the reduced-motion fix and the ≤520 px eyebrow wrap were
  synced there too.

**Orchestrator review notes, all addressed in the build:** the porcelain is now visible at hero
scale (P1 passes through the vortex); the round bottom-right loop became an eccentric hook partly
hidden by the plunge; the nucleus reads as distinct outlined shards and black chips.

**Verification (orchestrator, 1600×1000 @2x, headless Chrome on Metal):**
- Perf, second run: p50 16.7 ms, p95 16.7 ms, max 16.8 ms, 0 frames over 33 ms. No console errors.
  (Measured before the 2026-10-21 centre thinning, which only removes geometry. A re-measure was not
  possible afterwards: another GPU-heavy app was running and slowed every option, including the
  untouched option 2, so those numbers were not representative. Under that same load, three
  alternating runs gave option 2 / option 4 over-33 ms counts of 32/33, 8/23 and 14/27, with a
  16.7 ms median frame for both every time: option 4 tracks option 2, slightly heavier, as expected
  from its extra porcelain and nucleus geometry. Re-run `shoot.mjs 4` on an idle machine for a
  clean number.)
- Every section, the finale forward and backward, phone (390×844 @3x) and reduced motion checked.

**Captures:** `/private/tmp/bg-lab/v4/final/` — `full-0.png`, `bg-0.png`, `sec-*.png`,
`sections-sheet.jpg`, `dive-sheet.jpg` (11-frame sequence + scrub back), `dive-m-sheet.jpg`,
`m-sheet.jpg`.

**Known weaknesses:**
- The white patch just left of the mass is v2's legibility mask lightening chrome behind the name;
  it reads as a halo with the name on top, but as pale mush in a background-only capture.
- The mass centre was thinned on 2026-10-21 (fewer vortex slivers, nucleus splinters/shards,
  sheaf slivers and centre-stream shards) for a cleaner e02 silhouette; it is still the busiest
  spot on the page, by design.
- Phones and tablets get the lite build with a slow rotation (no bloom).

## Performance pass (2026-10-22)

Goal: 60 fps on much weaker devices with no visual change at all. The pre-pass code is the local
branch `pre-optimization`.

- Removed: the retired line canvas, glitch / atmosphere / dust / fragment layers, the density
  choreography and its smoothing loop, a 60 Hz mouse-tracking loop nothing read, per-scroll store
  writes, old textures and an unused motion-spec page, `@react-three/*` and `raw-loader`, dead CSS.
- The geometry build runs in a Web Worker (`build.ts`, `geometry.worker.ts`); shaders compile in
  parallel (KHR_parallel_shader_compile). The frame loop allocates nothing; the print layer and the
  finale skip style writes that would not change anything; the bloom pass skips graphite (it adds
  nothing there) and draws porcelain depth-only; the Hardware canvas redraws only when something
  it shows changed.
- Measured (headless Chrome, CPU throttled): desktop 6× — load blocking time 1007 → 301 ms,
  longest task 797 → 176 ms, script while scrolling 157 → 144 ms/s, style recalcs −45 %; phone
  4× — blocking time 338 → 31 ms, script while scrolling 81 → 68 ms/s. GPU work is unchanged by
  design (same pixels, same shaders).
- Verified with `scripts/visual-diff` (frozen clock, same frames in both builds): bit-exact under
  SwiftShader except where the original differs from itself run to run (the rail numerals' text
  antialiasing, the Mii's wave timing); on the GPU and in Chrome, differences stay within the
  GPU's own frame-to-frame jitter (≈20–50 isolated pixels in the porcelain speckle). Side-by-side
  in Chrome: `Docs/perf-chrome-compare.png`.
- Tried and reverted because they changed pixels: clipping the mirror pass to the sheet's bounds
  (lost the edge-on sliver's AA band) and rewriting two shader branches (one pixel off by one on
  the GPU).

## Leave a message (2026-10-22)

The Pure Signal card keeps its heading and animation; the eyebrow and the paragraph are gone. Under
the heading the address types on (the old eyebrow's caret and decoding glyphs) with a copy link,
and the CTA "Send me a message" unfolds the "Leave a message" sheet in place of the buttons
(`LeaveMessage.tsx`): Bone paper and grain, an offset hairline frame, crop marks, a rule stack,
ledger rows for name and message, the message on ruled lines, a typed receipt once sent. While
the sheet is open the finale holds fully on screen, as it does for focus.

The form posts to the `keffer-contact` Cloudflare Worker (`workers/contact-form`, deployed at
keffer-contact.williamkeffer2005.workers.dev), which emails each message from signal@keffer.cafe to
williamkeffer2005@gmail.com through Cloudflare Email Routing. keffer.cafe's DNS moved from Namecheap
BasicDNS to Cloudflare for it (same website records, DNS only); a catch-all forwards any other
@keffer.cafe mail to the same Gmail.

