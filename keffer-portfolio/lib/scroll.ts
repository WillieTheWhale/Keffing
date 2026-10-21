// Shared access to the Lenis instance (set by LenisProvider) so UI like the
// index menu can smooth-scroll to sections through the same pipeline.

import type Lenis from "lenis";

export const lenisRef: { current: Lenis | null } = { current: null };

/** Smoothed scroll velocity (px/frame-ish, signed), updated by LenisProvider. */
export const scrollVelocityRef = { current: 0 };

/** Dive progress 0..1 (the finale), written by components/background/Dive.tsx. */
export const diveRef = { current: 0 };

export function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  if (lenisRef.current) {
    lenisRef.current.scrollTo(el, { duration: 1.4 });
  } else {
    el.scrollIntoView({ behavior: "smooth" });
  }
}
