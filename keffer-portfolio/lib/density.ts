// Density Choreography — SIGNAL/NOISE roadmap W3
// One scalar (0..1) drives the visual volume of every ambient layer.
// The scroll narrative: noise resolves into signal, then breaks apart again.
// Keypoints follow Docs/motion-spec.md "Density choreography map".

export interface DensityKeypoint {
  p: number; // scroll progress 0..1
  d: number; // density 0..1
}

// Hero 100% → About 15% (first silence) → Projects 55% → Research 30%
// → Contact flare 85% → final decay toward the Dive (W10).
// Fallback map, used until the DOM-derived map replaces it on mount.
export const DENSITY_KEYPOINTS: DensityKeypoint[] = [
  { p: 0.0, d: 1.0 },
  { p: 0.15, d: 1.0 },
  { p: 0.24, d: 0.15 },
  { p: 0.33, d: 0.15 },
  { p: 0.4, d: 0.55 },
  { p: 0.66, d: 0.55 },
  { p: 0.74, d: 0.3 },
  { p: 0.85, d: 0.3 },
  { p: 0.92, d: 0.85 },
  { p: 1.0, d: 0.1 },
];

let activeKeypoints: DensityKeypoint[] = DENSITY_KEYPOINTS;

// Progress positions of section boundaries (gap centers between bands),
// populated by deriveDensityKeypointsFromDOM. The tuning transition lives here.
let sectionBoundaries: number[] = [];

/** Half-width of the tuning transition in scroll-progress units. */
const TUNE_HALF_WIDTH = 0.022;

/**
 * Tuning transition intensity 0..1 at a scroll position (roadmap W4).
 * 1 = the beat: composition fully imploded, one frame of near-black.
 * Smooth bell around each section boundary; scrubbable by construction.
 */
export function tuningAt(progress: number): number {
  let max = 0;
  for (const b of sectionBoundaries) {
    const x = Math.abs(progress - b) / TUNE_HALF_WIDTH;
    if (x < 1) {
      // smooth bell: cos ramp
      const v = 0.5 + 0.5 * Math.cos(x * Math.PI);
      if (v > max) max = v;
    }
  }
  return max;
}

/** Target density per section id (the design intent from the motion spec). */
const SECTION_DENSITY: Record<string, number> = {
  hero: 1.0,
  about: 0.15,
  projects: 0.55,
  research: 0.3,
  contact: 0.85,
  dive: 0.05,
};

/**
 * Derive the keypoint map from where sections ACTUALLY sit in the document,
 * so the choreography stays aligned with real content heights. A section's
 * band is [entering-viewport-center, leaving-viewport-center], with ramps
 * (the future tuning transitions) living in the gaps between bands.
 */
export function deriveDensityKeypointsFromDOM(): boolean {
  const ids = ["hero", "about", "projects", "research", "contact", "dive"];
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (maxScroll <= 0) return false;

  const kps: DensityKeypoint[] = [];
  const bandEdges: { start: number; end: number }[] = [];
  let found = 0;
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    found++;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    // Progress at which the section dominates the viewport
    const start = Math.max(0, Math.min(1, (top - window.innerHeight * 0.35) / maxScroll));
    const end = Math.max(0, Math.min(1, (bottom - window.innerHeight * 0.65) / maxScroll));
    const d = SECTION_DENSITY[id] ?? 0.5;
    if (end > start) {
      kps.push({ p: start, d }, { p: end, d });
    } else {
      kps.push({ p: (start + end) / 2, d });
    }
    bandEdges.push({ start, end });
  }
  if (found < 3) return false;

  // Section boundaries (tuning transition centers): midpoint of each gap
  // between consecutive bands. Skip the first (entry handles the top).
  sectionBoundaries = [];
  for (let i = 1; i < bandEdges.length; i++) {
    const gapCenter = (bandEdges[i - 1].end + bandEdges[i].start) / 2;
    if (gapCenter > 0.05 && gapCenter < 0.97) sectionBoundaries.push(gapCenter);
  }

  // Final decay to the Dive threshold
  kps.push({ p: 1.0, d: 0.1 });
  kps.sort((a, b) => a.p - b.p);
  // De-duplicate near-identical progress values (keep later entry)
  const clean: DensityKeypoint[] = [];
  for (const k of kps) {
    const last = clean[clean.length - 1];
    if (last && Math.abs(last.p - k.p) < 0.005) clean[clean.length - 1] = k;
    else clean.push(k);
  }
  activeKeypoints = clean;
  return true;
}

/** Cosine-eased interpolation over the keypoint bands. */
export function densityAt(progress: number): number {
  const kps = activeKeypoints;
  if (progress <= kps[0].p) return kps[0].d;
  for (let i = 1; i < kps.length; i++) {
    if (progress <= kps[i].p) {
      const a = kps[i - 1];
      const b = kps[i];
      const t = (progress - a.p) / (b.p - a.p);
      const eased = 0.5 - 0.5 * Math.cos(t * Math.PI);
      return a.d + (b.d - a.d) * eased;
    }
  }
  return kps[kps.length - 1].d;
}

/**
 * Per-layer response curves. The scalar hits layers differently:
 * peripheral noise dies first, structural signal persists longest,
 * and atmospheric text SURFACES in the quiet (inverse).
 */
export function layerDensities(d: number) {
  return {
    fragments: Math.pow(d, 0.75),
    glitch: Math.pow(d, 1.3),
    dust: Math.pow(d, 1.5),
    rects: Math.pow(d, 1.1),
    // Poetic text lives in the silence: strongest when everything else is gone.
    atmosphere: 0.35 + 0.65 * Math.pow(1 - d, 1.5),
  };
}

// NOTE: applyDensityVars (writes --density-* CSS vars) now lives in
// lib/tuning.ts, which wraps densityAt/tuningAt with velocity-aware temporal
// smoothing — see that file for why (fast scroll used to skip clean over the
// whole tuning band in one frame with zero interpolation, a hard "pop").
