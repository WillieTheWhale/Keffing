# Keffer Portfolio — 12-Week Visual Design Roadmap

*Written 2026-07-15. Companion to `keffer-portfolio-system-design.docx` (v1.0). This document assumes the performance-overhaul-v4 codebase as the starting point.*

---

## Part 1 — Investigation Findings

### What exists today

**Main site** (`keffer-portfolio/`): Next.js 16 + Canvas 2D + Lenis + Zustand. A single ~8.4-viewport scroll page with a 9-layer composite: chrome-gradient line bursts, sky photo fragments, black rectangles, particle dust, glitch artifacts/timecodes, film grain, atmospheric text, content sections, dot nav. Palette: white / black / cyan `#0099FF` / sky photography. Type: Inter + JetBrains Mono.

**The world** (`keffer-world/`): a separate Vite + Three.js walkable brutalist-monument world ("The Quiet Monuments") — foggy conifer clearing, wisp avatar, placeholder exhibit dialogs. Not linked from the main site.

**Design lineage** (from the system design doc): deconstructed Japanese graphic design (2much, Rikako Nagashima, Yoshirotten) × Y2K futurism × generative art. Anti-grid, tension-based composition, golden-ratio spacing, typography-as-texture.

### What's genuinely working

1. **The aesthetic is ownable.** The hero composition — chrome line bursts converging on a tangle, sky fragments as counterweights, glitch timecodes — is distinctive and cannot be mistaken for a template. This is the hardest part of an award-level site and it already exists.
2. **The engineering discipline is real.** 60fps canvas choreography, layer batching, the documented failed-approach log. Juries can't see this, but it's what makes the ambitious moves below feasible.
3. **The world experiment is a sleeping giant.** A walkable 3D exhibit space is exactly the kind of "second act" that separates Site of the Day contenders from nice landing pages.

### The honest critique (screenshots taken 2026-07-15 at 0/25/50/75/100% scroll)

1. **Uniform density = no rhythm.** Every viewport at every scroll position has the same visual volume: max lines, max fragments, max noise. The composition never breathes. Award juries score dynamic range — tension *and* release. Right now the site is one fortissimo chord held for 8 viewports.
2. **Typography is the weakest layer.** Inter + JetBrains Mono are defaults. The cited lineage (Nagashima, Yoshirotten) is *typography-first* design — the type IS the artwork. Currently type is a neutral delivery vehicle sitting in translucent white panels.
3. **Content presentation fights the background.** Long unbroken paragraphs float in ghost panels over maximum noise. At 25–75% scroll, reading is fatiguing and the work itself has no imagery — projects are text blobs.
4. **Structure is a poster, not a site.** One flat scroll, dot nav, no entry sequence, no transitions, no case-study depth, no menu-as-design-object. "Short page you scroll down" is exactly right.
5. **Asset inconsistency.** Some sky images are real photography; several (e.g. `sky-3.jpg`, `sky-13.jpg`) are obviously procedural blue noise and cheapen the collage next to real clouds.
6. **Interaction is scroll-only.** No hover states that mean anything, no cursor identity, minimal mouse reactivity, no punctuated moments.
7. **Fragile fundamentals.** `html { zoom: 0.8/0.9 }` for desktop scaling is a cross-browser hazard; should be replaced by a real fluid type/space scale.
8. **The two properties don't know about each other.** keffer-world's fog-sage palette and the main site's white/cyan world are unrelated experiences with no bridge.

### How "3D" can this get? (answering the Three.js question)

You don't need a fully 3D site, and you shouldn't want one — the flat deconstructed-collage language is the identity. What you need is **depth and light**, which WebGL gives you cheaply:

- **Keep the 2D composition, add a WebGL compositor.** Render lines/fragments into a scene with real z-depth, then add post-processing: bloom on the cyan beams, chromatic aberration keyed to scroll velocity, subtle depth-of-field between layers. The site still *reads* flat; it *feels* dimensional.
- **Shader-displaced sky fragments.** Fragments as textured planes that ripple/refract on hover — the single most beloved WebGL portfolio pattern, and here it's earned (they're photographs of sky; making them behave like water/glass fits).
- **The world is where full 3D lives.** Don't force the homepage into 3D; make keffer-world the destination for it.

Three.js is not the limiting factor — it's already in the repo (orphaned components in `components/canvas/`) and running the whole world project. The limiting factor is choreography and art direction, which is what this plan attacks.

---

## Part 2 — Design North Star

**Concept name: "SIGNAL / NOISE."** The site is a transmission being tuned. It opens as pure noise (the burst), and scrolling is the act of tuning: noise resolves into signal (readable content, calm space), then breaks apart again between sections. The final act tunes into another frequency entirely — the world.

This gives every existing element a *reason*: timecodes are the broadcast clock, glitch artifacts are interference, sky fragments are moments of clear reception, the chrome lines are the carrier wave. And it dictates the missing ingredient: **dynamic range**.

### Design tokens to lock in Phase 1

- **Palette:** unchanged — white, ink black, cyan `#0099FF`, sky photography. Add only `--signal-red` (a single warning-red used at ~1% frequency for punctuation: active states, the world portal). Restraint is the brand.
- **Type (proposal, finalize in Phase 1):**
  - *Display:* a characterful grotesk with real personality at 200px+ — candidates: **Neue Haas Grotesk Display**, **PP Neue Montreal**, **Founders Grotesk**; free-budget fallback: **Archivo Expanded/Condensed pair** (variable, good for kinetic width animation).
  - *Accent:* a Mincho-style serif for tiny Japanese-editorial moments — **Shippori Mincho** (Google Fonts) used sparingly for section epigraphs.
  - *Utility:* keep JetBrains Mono for timecodes/metadata (it's working).
  - *Body:* Inter can stay for long-form only, or unify on the grotesk's text cut.
- **Motion language:** one easing family (`expo.out` for reveals, `quint.inOut` for transitions), scroll-velocity as a global input, and a rule: *ambient motion is slow and constant; interaction motion is fast and rare.*
- **Signature element:** the **tuning transition** — at each section boundary, the entire composition collapses toward the focal point (lines implode, fragments scatter, one frame of near-black) and re-explodes into the next section's arrangement. One reusable, unmistakable move.

---

## Part 3 — The 12-Week Plan

> Cadence per week: ~2 days design (Figma), ~3 days build, screenshot critique at week's end. Figma MCP is the design-side tool throughout. **Skip the Framer MCP** — Framer is a site-builder that would parallel-track your custom Next.js stack, not feed it. Figma (design source of truth) + code is the right pipeline.

### Phase 1 — Art Direction Lockdown (Weeks 1–2)

*Goal: every later decision becomes derivable instead of debatable.*

- **W1: Reference & moodboard in Figma.** Create the file via Figma MCP: import the original three reference images, current-site screenshots, keffer-world shots, and 10–15 curated exemplars (Yoshirotten, Nagashima, plus current Awwwards SOTD winners in the deconstructed/brutalist space). Annotate what each earns.
- **W1: Asset audit.** Cull the procedural skies; replace with 8–12 *curated* photographs with consistent color grade (cold cyan-blue, high contrast, no warm sunsets). Add 3–4 non-sky textures for variety: contrails, wire grids, satellite imagery — same palette.
- **W2: Type selection + tokens.** License/choose display face, build the full scale in Figma variables (display → micro-label), define the vertical/rotated label system. Sync tokens to `globals.css` custom properties. Kill the `zoom` hack; replace with fluid `clamp()` scale.
- **W2: Motion spec.** One page: every animated element, its trigger, easing, duration, and *rest state*. Includes the reduced-motion version of each.
- **Deliverable:** Figma styleguide + updated tokens in code + curated asset library.

### Phase 2 — Narrative Structure & Scroll Choreography (Weeks 3–4)

*Goal: from poster to composition-in-time. This phase is the answer to "the short scroll page isn't creative."*

- **W3: Entry sequence.** The site boots like a transmission acquiring lock: black frame, timecode spins up, hairlines draw, then the burst detonates into the hero (1.5–2.5s, skippable, once per session). Loading is masked by it.
- **W3: Density choreography map.** Redesign the scroll timeline with dynamic range: Hero = 100% density → About = collapse to 15% (near-white silence, one line, one fragment — the first "signal" moment) → Projects = structured medium density → Research = asymmetric quiet → Contact = slow decay to a single point + the portal. The background *reacts to what section it's behind* instead of being uniform wallpaper.
- **W4: The tuning transition.** Build the signature section-boundary move (implode → beat → re-explode) driven by scroll position with Lenis; must be scrubbable both directions, not a triggered animation.
- **W4: Navigation as design object.** Replace dot nav with a real index: a full-screen overlay menu in the glitch language (timecoded entries, hover distortions), plus a persistent minimal wordmark/menu chip. Menu open/close uses the tuning move.
- **Deliverable:** restructured page with entry sequence, choreographed density, signature transition, real nav.

### Phase 3 — Typography as Artwork (Week 5)

*Goal: make the type layer as strong as the line layer.*

- Hero name set at display scale as a **kinetic, deconstructed lockup**: letters begin scattered among the collage layers (each letter has its own parallax depth) and lock into place; on scroll they shear apart again.
- Section titles become large typographic events (viewport-scale, cropped by the frame, Japanese-editorial rotation/vertical setting for their micro-labels).
- Atmospheric text layer upgraded: the poetic fragments get the Mincho accent face, opacity choreography tied to the density map (they surface in the quiet sections, drown in the loud ones).
- **Deliverable:** new type system live across all sections.

### Phase 4 — Signature WebGL Moments (Weeks 6–7)

*Goal: depth and light without abandoning the 2D identity.*

- **W6: WebGL compositor.** Stand up a Three.js layer (reuse/replace the orphaned `components/canvas/` files): port the sky fragments to textured planes with real z-depth and a hover displacement/refraction shader. Keep the Canvas 2D chrome-line system if porting is too costly — it composites fine underneath.
- **W6: Post-processing pass.** Bloom on cyan beams, chromatic aberration + slight RGB-split keyed to scroll *velocity* (fast scroll literally detunes the image), fine film grain moved into the shader (replacing the SVG overlay).
- **W7: Mouse as tuner.** Global pointer input: focal-point drift, fragment repulsion/attraction within a dead-zoned radius, cursor replaced by a small crosshair + timecode readout that inverts over content. Touch equivalent: gyroscope-lite drift on mobile (respecting reduced motion).
- **W7: Performance gate.** Tiering system (high/medium/low) with auto-degrade; the WebGL layer must fail gracefully to the current CSS/canvas stack. Budget: 60fps desktop, 40+ mobile, <200KB deferred Three.js chunk (per the original doc).
- **Deliverable:** dimensional, reactive background with a hard fallback tier.

### Phase 5 — Work Presentation as Editorial Design (Weeks 8–9)

*Goal: the projects section stops being text blobs — structure only, real copy can come later.*

- **W8: Card redesign.** Each project card becomes a designed spread: a media well (screenshot/video loop placeholder), title at display scale, 2-line editorial summary (long paragraphs move to case pages), stack tags in the mono metadata language. Hover: the card assembles from scattered fragments (the collage language applied to UI).
- **W8–9: Case study template.** `/work/[slug]` route with an art-directed template: hero image treated as a sky-fragment (masked, displaced), sticky metadata rail, generous white "signal" sections for body content, and — the creative kicker — **each project re-seeds the generative background** with its own motif/seed so every case study's line composition is unique but familial.
- **W9: Page transitions.** Route changes use the tuning move (View Transitions API or manual): the list page collapses to noise and resolves into the case page.
- **Deliverable:** project system ready to receive real content, with 2 placeholder case studies proving the template.

### Phase 6 — "The Dive" finale (Week 10) — *rewritten 2026-07-15*

*Original plan (world portal into keffer-world) is void: the user deleted `keffer-world/` and `abito/` on 2026-07-15 — they were never part of the actual website. The finale now lives entirely inside the main site.*

*Goal: give the scroll a destination — the final act of the tuning narrative.*

- **The Dive.** Scrolling past Contact doesn't just end — the camera tunnels *into* the line-burst focal point: lines stream past like light trails, sky fragments scale up and dolly by (pseudo-3D parallax through the collage), noise thins with depth, and the journey resolves into one full-viewport calm sky — pure signal — holding the final CTA and colophon.
- **Signal-red punctuation retained:** the entry threshold to the dive is marked by the one red element on the site.
- Builds directly on the W6–7 WebGL layer (depth-sorted fragment planes make the dolly nearly free). Reduced-motion: a slow crossfade to the calm sky.
- **Deliverable:** the "is this all?" scroll problem is solved in-site — the page ends with its strongest moment instead of a footer.

### Phase 7 — Optimization, Mobile & Launch (Weeks 11–12)

*Goal: award-submission-grade fit and finish.*

- **W11: Mobile as its own composition.** Not just reduced counts — re-choreograph: fewer, larger fragments; the burst reframed for portrait; touch-specific project cards; the entry sequence shortened. Test on real mid-range Android + iPhone Safari.
- **W11: Accessibility & robustness.** Full reduced-motion narrative (the site as a calm editorial page — this should be *designed*, not just disabled), focus order through the overlay stack, contrast audit of text-over-noise moments, keyboard access to menu/portal. Cross-browser sweep (Safari canvas perf, Firefox).
- **W12: Performance certification.** LCP < 2.5s, CLS ≈ 0, entry sequence masks loading, image `srcset`/AVIF for skies, font subsetting, bundle audit.
- **W12: Launch kit.** OG images in the site's language, meta/SEO, custom 404 (a "lost signal" page — free creativity win), 30–45s screen-capture trailer, then submissions: **Awwwards (SOTD), CSS Design Awards, FWA, Godly, Minimal Gallery**. Awwwards weights Design 40 / Usability 30 / Creativity 20 / Content 10 — this plan invests in exactly that order.
- **Deliverable:** deployed on Vercel, submitted, trailer published.

---

## Part 4 — Working Agreements

- **Figma MCP cadence:** each phase starts by designing the key screens/states in the Figma file (Claude can generate and iterate layouts there via MCP), and ends by screenshotting the built result back into Figma next to the design for diffing.
- **Screenshot critique ritual:** the Playwright rig from this investigation (scratchpad `shoot.js` — dev server + scroll-position captures) should be promoted into the repo as `scripts/critique.mjs` so every week ends with fresh full-scroll captures.
- **The failed-approaches log stays.** It's already preventing repeated mistakes (chrome gradients, fragment drift); keep appending to it in project memory.
- **One risk per phase.** Each phase has exactly one bold move (entry sequence, tuning transition, kinetic type, velocity detune, re-seeded case studies, the portal). If a week runs long, cut scope from the quiet parts, never the signature moves.
