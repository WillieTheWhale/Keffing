// Velocity-aware tuning smoothing — feedback pass, 2026-07-16.
//
// THE PROBLEM: density/tune used to be pure functions of instantaneous
// scroll progress, recomputed only when a scroll event fired. A fast flick
// can move scrollY across the ENTIRE ~2.2%-wide tuning band between two
// consecutive animation frames — the composition would jump straight from
// "before" to "mid-implosion" or past it with zero interpolating frames
// rendered in between. That reads as a hard pop, not a transition.
//
// THE FIX: two independent things, both needed:
//  1. Temporal smoothing — the DISPLAYED density/tune lerp toward their
//     scroll-derived targets on a real-time constant (not a scroll-distance
//     constant), via a self-scheduling rAF loop that keeps ticking for a
//     brief settle window even after scrolling stops. This guarantees a
//     transition always spans multiple rendered frames, however big the
//     triggering scroll jump was.
//  2. Velocity-scaled peak reduction — a fast flick also caps the MAXIMUM
//     implosion intensity (the "beat" reads as a quick soft dip instead of
//     a full violent implosion+blackout). Slow scroll gets the full
//     cinematic beat; fast scroll gets a quiet, quick cut. The bottom-of-page
//     Dive transition is untouched — it's already continuously scroll-driven
//     and was never using this discrete "tune" mechanism.
//
// This module is the single source of truth for both the 2D canvas
// (LineCanvas) and the WebGL chrome-tendril layer, so they always implode
// toward the identical focal point in lockstep.

import { densityAt, tuningAt, layerDensities } from "./density";
import { scrollVelocityRef } from "./scroll";
import { useStore } from "./store";

/** Current smoothed tune (0..1). Read directly by LineCanvas/ChromeTendrils each frame — no store subscription needed. */
export const smoothedTuneRef = { current: 0 };
/** Current smoothed density (0..1). */
export const smoothedDensityRef = { current: 1 };

// Calibrated against Lenis's velocity units (roughly px/frame-scale).
const VELOCITY_REF = 14;
// A fast flick caps the implosion at this fraction of full intensity.
const MIN_PEAK_SCALE = 0.35;
// Smoothing time constant — fast enough to feel responsive at rest,
// slow enough to always spread a transition across several frames.
const TAU_MS = 70;

let lastProgress = 0;
let lastTs = 0;
let rafId = 0;

function computeTargets(progress: number, reducedMotion: boolean) {
  // Case-study pages pin density explicitly (per-project re-seed, W8) and
  // never run the section-boundary tuning beat — respect that unconditionally
  // so this module can never clobber their pinned CSS vars with scroll-
  // derived values computed from the WRONG page's section geometry.
  const densityOverride = useStore.getState().densityOverride;
  if (densityOverride != null) {
    return { density: densityOverride, tune: 0 };
  }
  // The section-boundary "beat" (implosion + near-black flash) is retired
  // (2026-09-08): it read as a flash between sections. Density still eases
  // between bands via the time-constant smoothing below; tune stays 0.
  void tuningAt; void scrollVelocityRef; void VELOCITY_REF; void MIN_PEAK_SCALE; void reducedMotion;
  return { density: densityAt(progress), tune: 0 };
}

// ─── Layer opacity registry ─────────────────────────────────
//
// These values used to be written as --density-* / --tune custom properties
// on <html> every frame. Custom properties inherit, so each write
// invalidated style for every one of the ~600 absolutely-positioned overlay
// nodes — measured at ~65% of main-thread time during scroll, far more than
// the canvas itself. Now each ambient layer binds its container here and
// receives a plain `opacity` write: six elements, compositor-only.

export type LayerKey = "fragments" | "glitch" | "dust" | "rects" | "atmosphere" | "beat";

const layerTargets: Record<LayerKey, Set<HTMLElement>> = {
  fragments: new Set(), glitch: new Set(), dust: new Set(), rects: new Set(), atmosphere: new Set(), beat: new Set(),
};
const layerValues: Record<LayerKey, number> = { fragments: 1, glitch: 1, dust: 1, rects: 1, atmosphere: 1, beat: 0 };
let pinned: Partial<Record<LayerKey, number>> | null = null;

function setLayer(key: LayerKey, v: number) {
  if (Math.abs(layerValues[key] - v) < 0.0005) return;
  layerValues[key] = v;
  const s = v.toFixed(3);
  for (const el of layerTargets[key]) el.style.opacity = s;
}

/** Bind an ambient layer's container; it gets the current value immediately. Returns unbind. */
export function bindLayerOpacity(key: LayerKey, el: HTMLElement): () => void {
  layerTargets[key].add(el);
  el.style.opacity = layerValues[key].toFixed(3);
  return () => { layerTargets[key].delete(el); };
}

/** Pin explicit per-layer values (detail pages); null resumes the choreography. */
export function pinLayers(values: Partial<Record<LayerKey, number>> | null) {
  pinned = values;
  if (values) for (const [k, v] of Object.entries(values)) setLayer(k as LayerKey, v as number);
}

function writeLayers(density: number, tune: number) {
  if (pinned) return;
  const L = layerDensities(density);
  const duck = 1 - 0.92 * tune;
  setLayer("fragments", L.fragments * duck);
  setLayer("glitch", L.glitch * duck);
  setLayer("dust", L.dust * duck);
  setLayer("rects", L.rects * duck);
  setLayer("atmosphere", L.atmosphere * duck);
  setLayer("beat", tune * 0.88);
}

function stepSmoothing(ts: number): boolean {
  // Defensive: this is a bare module-level rAF loop, not tied to any
  // component's lifecycle, so a client-side route change away from the
  // choreographed home page (e.g. into a case study, which doesn't mount
  // LenisProvider at all) won't stop it by itself. Bail out explicitly
  // rather than animate against stale section geometry from the old page.
  if (typeof document === "undefined" || !document.getElementById("hero")) {
    lastTs = 0;
    return false;
  }

  const dtMs = lastTs ? Math.min(64, ts - lastTs) : 16;
  lastTs = ts;

  const reducedMotion = useStore.getState().reducedMotion;
  const { density: targetDensity, tune: targetTune } = computeTargets(lastProgress, reducedMotion);

  const alpha = 1 - Math.exp(-dtMs / TAU_MS);
  const prevTune = smoothedTuneRef.current;
  const prevDensity = smoothedDensityRef.current;
  smoothedTuneRef.current += (targetTune - smoothedTuneRef.current) * alpha;
  smoothedDensityRef.current += (targetDensity - smoothedDensityRef.current) * alpha;

  writeLayers(smoothedDensityRef.current, smoothedTuneRef.current);

  const settled =
    smoothedTuneRef.current < 0.002 &&
    Math.abs(smoothedTuneRef.current - prevTune) < 0.0004 &&
    Math.abs(smoothedDensityRef.current - targetDensity) < 0.003 &&
    Math.abs(smoothedDensityRef.current - prevDensity) < 0.0006;
  return !settled;
}

function loop(ts: number) {
  if (stepSmoothing(ts)) {
    rafId = requestAnimationFrame(loop);
  } else {
    rafId = 0;
    lastTs = 0; // reset dt baseline so the next activation isn't penalized
  }
}

function ensureLoop() {
  if (rafId || typeof window === "undefined") return;
  rafId = requestAnimationFrame(loop);
}

/**
 * Call on every scroll update (Lenis 'scroll' event). Records the target
 * progress and (re)starts the smoothing loop if it isn't already running —
 * the loop itself keeps ticking through the transition and for a brief
 * settle window after scrolling stops, so the beat always finishes playing
 * out even if the user stops flicking mid-transition.
 */
export function applyDensityVars(progress: number) {
  lastProgress = progress;
  ensureLoop();
}
