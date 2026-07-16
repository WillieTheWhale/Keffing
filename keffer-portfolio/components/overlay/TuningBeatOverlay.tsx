"use client";

/**
 * The beat — SIGNAL/NOISE roadmap W4, reworked 2026-07-16 for the
 * velocity-aware transition pass.
 *
 * A full-viewport near-black flash at the heart of each tuning transition.
 * Previously this was a `fillRect` painted only onto LineCanvas's own 2D
 * canvas — but the composition is meant to implode as a WHOLE (per the
 * original roadmap language: "the entire composition collapses..."), and
 * once the chrome tendrils moved to their own WebGL canvas on top of
 * LineCanvas, the old fillRect would sit BEHIND them and no longer visually
 * cover the thing it's meant to black out. A single DOM overlay above every
 * ambient layer (but below the readable content panels) fixes both:
 * it's uniform across 2D canvas, WebGL chrome, sky fragments, and glitch
 * layers, and it never blacks out text someone might be mid-reading.
 *
 * Driven directly by --tune, which lib/tuning.ts already smooths in time
 * and scales down at high scroll velocity — so this needs no logic of its
 * own beyond reading the variable.
 */
export default function TuningBeatOverlay() {
  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 16,
        backgroundColor: "#030306",
        opacity: "calc(var(--tune, 0) * 0.88)",
      }}
      aria-hidden="true"
    />
  );
}
