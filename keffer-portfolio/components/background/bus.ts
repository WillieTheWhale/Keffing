import { withBase } from "@/lib/basePath";
// Background — ALLOY. Module-level state shared between this variant's
// Background (the canvas) and its Dive (the finale's DOM). Plain mutable
// object: read every frame, never rendered from.

export const alloyBus = {
  /** The WebGL canvas is alive, animating and has the end-card sky loaded,
   *  so it carries the finale itself ("through the mirror"); otherwise the
   *  Dive shows its own DOM sky (reduced motion, no WebGL, still loading). */
  glFinale: false,
  /** The finale timeline: dive progress smoothed by Dive.tsx's spring (0..1).
   *  The canvas follows this, not the raw scroll, so the mirror's swing plays
   *  out at its own pace however fast the page is scrolled. */
  dive: 0,
  /** True while a Dive is mounted and writing `dive`. */
  diveLive: false,
  /** The background has drawn its first frame (or has no WebGL to wait for),
   *  so a loader can uncover the page. */
  sceneReady: false,
};

export const END_SKY = withBase("/assets/background/end-sky.jpg");

/** Strength of the haze ("a breath on the glass") behind the end card's type,
 *  shared by the GL mirror and the DOM fallback sky. */
export const BREATH = 0.34;
