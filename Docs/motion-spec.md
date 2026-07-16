# Motion Spec — SIGNAL / NOISE

*Week 2 deliverable of the 12-week design roadmap. Every animated element on the site, its trigger, easing, duration, and rest state. Mirrored in Figma (`01 · Foundations & Motion`).*

## The two laws

1. **Ambient motion is slow and constant; interaction motion is fast and rare.** Ambient = drift, breathing, grain (8–20s periods, imperceptible starts). Interaction = hover, click, transition (150–900ms, decisive).
2. **Everything scroll-driven is scrubbable.** Scroll choreography maps position → state; it never triggers one-way animations. Reverse scrolling reverses the motion perfectly.

## Easing family

| Token | Curve | Used for |
|---|---|---|
| `--ease-reveal` | `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out) | Elements entering: text reveals, card assembly, menu items |
| `--ease-tune` | `cubic-bezier(0.83, 0, 0.17, 1)` (quint-inOut) | State-to-state moves: tuning transition, menu open/close, route changes |
| linear | — | Timecodes, tickers, grain — machine motion never eases |

Springs (Framer Motion, HTML overlay only): `gentle {100/15}` for content, `snappy {300/25}` for micro-interactions.

## Durations

| Token | Value | Used for |
|---|---|---|
| `--duration-fast` | 150ms | Hover states, focus rings, cursor morphs |
| `--duration-transition` | 300ms | Small reveals, tag fades |
| `--duration-reveal` | 700ms | Content panel entrances |
| `--duration-tune` | 900ms | The tuning transition beat (scrubbed, so this is the *feel* at natural scroll speed) |
| Entry sequence | 1.8–2.4s total | Once per session, skippable on any input |

## Element-by-element catalog

| Element | Trigger | Motion | Easing | Rest state |
|---|---|---|---|---|
| Chrome line bursts | scroll position | deform ±12px H / ±8px V sinusoidal; density per choreography map | scrubbed | full composition, focal point NE |
| Cyan beams | scroll velocity | brightness/bloom rises with velocity | linear | steady 55-beam fan |
| Sky fragments | RAF ambient | Lissajous drift, opacity/scale breathing (unique freqs) | sinusoidal | drifting, 0.5–0.9 opacity |
| Sky fragments (W6) | hover | shader displacement ripple, 400ms decay | expo-out | flat plane |
| Glitch artifacts | RAF ambient | timecode ticks (frame-accurate), artifact flicker | linear/stepped | visible, low contrast |
| Black rectangles | section enter | opacity 0→1 fade, 700ms staggered 80ms | `--ease-reveal` | solid anchors |
| Atmospheric text | scroll position | parallax drift + opacity per density map (surface in quiet sections) | scrubbed | 0.15–0.4 opacity |
| Hero name (W5) | load + scroll | letters converge from layer depths on load; shear apart on scroll-out | `--ease-tune` / scrubbed | locked lockup |
| Section titles (W5) | section enter | viewport-scale reveal, cropped by frame | `--ease-reveal` | static, cropped |
| Tuning transition (W4) | section boundary (scroll) | implode to focal point → 1 beat near-black → re-explode | `--ease-tune`, scrubbed | n/a (transient) |
| Entry sequence (W3) | first load | black → timecode spin-up → hairlines draw → burst detonation | staged, linear→expo | hero state |
| Menu overlay (W4) | click | tuning move: page collapses behind, index resolves | `--ease-tune`, 600ms | closed |
| Project cards (W8) | hover | assemble from 4–6 scattered fragments, 350ms | `--ease-reveal` | assembled |
| Route change (W9) | navigation | tuning move between pages | `--ease-tune`, 900ms | new page |
| Custom cursor (W7) | pointer | crosshair + timecode readout; inverts over content; 30fps throttle, dead-zone | linear follow | crosshair |
| Scroll velocity detune (W6) | fast scroll | chromatic aberration/RGB split ∝ velocity, decays 300ms | linear | zero split |
| Film grain | RAF ambient | shader noise, constant | linear | always on |
| World portal (W10) | end of scroll | lines converge into red doorway; pulse 4s period | `--ease-tune` | pulsing slowly |

## Density choreography map (governs everything ambient)

| Scroll range | Section | Density | Notes |
|---|---|---|---|
| 0.00–0.18 | Hero | 100% | full burst, max fragments — the "noise" thesis |
| 0.18–0.35 | About | 15% | first silence: 1–2 lines, 1 fragment, atmospheric text surfaces |
| 0.35–0.70 | Projects | 55% | structured; density pulses down at each project card |
| 0.70–0.88 | Research | 30% | asymmetric quiet, right-weighted |
| 0.88–1.00 | Contact | 100% → 5% | decays to a single point + portal |

Transitions between bands happen inside the **tuning transition** (~0.03 scroll width at each boundary).

## Reduced motion (`prefers-reduced-motion: reduce`) — a designed mode, not a kill switch

- Ambient drift, breathing, grain, timecode ticks: **off** (static composition at each section's designed rest state).
- Scroll choreography: density still changes per section but as **crossfades** (no positional motion).
- Entry sequence: replaced by a 400ms opacity fade.
- Tuning transition: crossfade through white (not black implosion).
- Hover states: opacity/color only, no movement.
- The site should read as a **calm editorial page** — same hierarchy, zero kinetics.

## Performance rules (carried from v4 overhaul)

- Single scroll listener; single `useStore.setState` per frame; no per-element `useScroll`.
- Mouse input throttled ~30fps + dead-zone.
- CSS `@keyframes` for anything that never reads scroll; RAF loops are module-level with DOM refs.
- Never subscribe canvas layers to per-frame store values (focalPoint lesson).
