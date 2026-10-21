import { withBase } from "@/lib/basePath";
// Background — ALLOY. Module-level state shared between this variant's
// Background (the canvas) and its Dive (the finale's DOM). Plain mutable
// object: read every frame, never rendered from.

export const alloyBus = {
  /** The WebGL canvas is alive, animating and has the end-card sky loaded,
   *  so it carries the finale itself ("through the mirror"); otherwise the
   *  Dive shows its own DOM sky (reduced motion, no WebGL, still loading). */
  glFinale: false,
};

export const END_SKY = withBase("/assets/background/end-sky.jpg");

/** Strength of the haze ("a breath on the glass") behind the end card's type,
 *  shared by the GL mirror and the DOM fallback sky. */
export const BREATH = 0.34;
