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
  const rawDensity = densityAt(progress);
  const rawTune = reducedMotion ? 0 : tuningAt(progress);
  const speed = Math.min(1, Math.abs(scrollVelocityRef.current) / VELOCITY_REF);
  const peakScale = reducedMotion ? 0 : 1 - speed * (1 - MIN_PEAK_SCALE);
  return { density: rawDensity, tune: rawTune * peakScale };
}

function writeCssVars(density: number, tune: number) {
  const root = document.documentElement;
  const L = layerDensities(density);
  const duck = 1 - 0.92 * tune;
  root.style.setProperty("--density", density.toFixed(3));
  root.style.setProperty("--tune", tune.toFixed(3));
  root.style.setProperty("--density-fragments", (L.fragments * duck).toFixed(3));
  root.style.setProperty("--density-glitch", (L.glitch * duck).toFixed(3));
  root.style.setProperty("--density-dust", (L.dust * duck).toFixed(3));
  root.style.setProperty("--density-rects", (L.rects * duck).toFixed(3));
  root.style.setProperty("--density-atmosphere", (L.atmosphere * duck).toFixed(3));
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

  writeCssVars(smoothedDensityRef.current, smoothedTuneRef.current);

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
export function applyDensityVars(progress: number, _reducedMotion = false) {
  lastProgress = progress;
  ensureLoop();
}
