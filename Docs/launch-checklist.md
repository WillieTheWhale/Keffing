# Launch Checklist — SIGNAL / NOISE

*W12 deliverable. State as of 2026-07-16: all 12 roadmap weeks executed; the items below are the human-required steps to ship.*

## Performance certification (measured on the static production build)

| Metric | Budget | Measured | Status |
|---|---|---|---|
| FCP | <1.2s | 56ms (localhost) | ✅ |
| LCP | <2.5s | 140ms (localhost) | ✅ |
| CLS | ≈0 | 0.00001 | ✅ |
| Total transfer (hero load) | — | 2.65MB (was 13.2MB) | ✅ |
| Fonts | — | 183KB (was 3.9MB) | ✅ |
| Runtime | 60fps | 120fps measured w/ WebGL layer | ✅ |

Optimizations applied: 800px fragment thumbs (`assets/sky/thumbs/`), WebP brush textures, logos resized to 160px, font weights trimmed (Shippori 400, JetBrains 400), decorative layers client-mounted (kills the seed-swap CLS), fixed SSR seed + post-mount daily seed (kills the daily hydration mismatch).

## Deploy (Vercel)

- [ ] `vercel` from `keffer-portfolio/` (repo is `output: export` — any static host works; Vercel gives preview URLs + edge cache)
- [ ] Set the production domain; update `metadata.metadataBase` in `app/layout.tsx` once the domain exists (silences OG absolute-URL warning)
- [ ] Verify `/og.jpg` renders in the socials debuggers (opengraph.xyz, Twitter card validator)

## Manual QA

- [x] Safari macOS (2026-07-16): hero, scrolled states, all layers render — validated via real Safari
- [x] iOS Safari (2026-07-16): validated via iPhone 17 Pro simulator — mobile composition intact
- [ ] iOS **real device**: touch feel, Lenis inertia, GL tier fallback under memory pressure
- [ ] Firefox: canvas perf, clip-path transitions on menu/veil (no binary on the dev machine)
- [ ] Mid-range Android: scroll fps, tap targets
- [ ] Keyboard-only full pass done in Chromium; VoiceOver spot-check remains (menu dialog, case pages)

## Figma

- [x] Motion spec + density map placed on "01 · Foundations & Motion" (2026-07-16, via GUI automation after the MCP cap)
- [ ] Weekly: drop latest `scripts/critique.mjs` shots next to designs in "02 · Screens"

## Content (explicitly out of scope for this pass, needed before submissions)

- [ ] Real screenshots/video loops in project card media wells + case-study bodies (structure is ready — cards and `/work/[slug]` accept imagery today)
- [ ] Case study long-form copy per project (design/decision narrative, not just descriptions)
- [ ] Resume/CV pages restyle to the new type system (still on the old look)

## Submissions

- [ ] Film 30–45s trailer (screen capture: entry → hero → tuning beat → BIO silence → cards → case file → the Dive)
- [ ] Awwwards — Site of the Day (design 40 / usability 30 / creativity 20 / content 10)
- [ ] CSS Design Awards, FWA, Godly, Minimal Gallery (free)
- [ ] Post the trailer + write-up (the SIGNAL/NOISE system is itself a story: density choreography, daily seed, per-project re-seeding)

## Rig

`node scripts/critique.mjs <port> <outDir>` — full-scroll screenshot critique.
`npx serve -l 3778 out` + scratch `vitals.js` — production web-vitals measurement.
