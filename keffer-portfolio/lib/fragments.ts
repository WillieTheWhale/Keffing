// Sky-photograph placement — hand-authored in lib/composition.ts (PHOTOS).
// One source of truth so the CSS fallback layer and the WebGL layer render
// the same composition.

import { PHOTOS, placedTop } from "./composition";
import { withBase } from "@/lib/basePath";

// Fragment layers use 800px thumbs (fragments render ≤450px wide) — W12.
// Full-viewport moments (case hero bands, the Dive) use SKY_PHOTOS_FULL.
export const SKY_PHOTOS = [
  "/assets/sky/thumbs/sky-1.jpg",
  "/assets/sky/thumbs/sky-2.jpg",
  "/assets/sky/thumbs/sky-4.jpg",
  "/assets/sky/thumbs/sky-5.jpg",
  "/assets/sky/thumbs/sky-6.jpg",
  "/assets/sky/thumbs/sky-7.jpg",
  "/assets/sky/thumbs/sky-8.jpg",
  "/assets/sky/thumbs/sky-9.jpg",
  "/assets/sky/thumbs/sky-10.jpg",
  "/assets/sky/thumbs/sky-11.jpg",
  "/assets/sky/thumbs/sky-12.jpg",
  "/assets/sky/thumbs/sky-13.jpg",
  "/assets/sky/thumbs/sky-14.jpg",
  "/assets/sky/thumbs/sky-15.jpg",
  "/assets/sky/thumbs/sky-16.jpg",
  "/assets/sky/thumbs/sky-17.jpg",
  "/assets/sky/thumbs/sky-18.jpg",
  "/assets/sky/thumbs/sky-19.jpg",
  "/assets/sky/thumbs/sky-20.jpg",
].map(withBase);

export const SKY_PHOTOS_FULL = SKY_PHOTOS.map((p) => p.replace("/thumbs/", "/"));

/** Straight rectangle, or a slight parallelogram when the composition asks for one. */
export function clipFor(skew: number): string {
  if (!skew) return "inset(0)";
  const s = Math.abs(skew) * 100;
  return skew > 0
    ? `polygon(${s}% 0, 100% 0, ${100 - s}% 100%, 0 100%)`
    : `polygon(0 0, ${100 - s}% 0, 100% 100%, ${s}% 100%)`;
}

export type DeviceTier = "mobile" | "tablet" | "desktop" | "wide";

export interface SkyFragmentData {
  id: string;
  src: string;
  srcIndex: number;
  x: number; // % of viewport width
  y: number; // % of viewport height (can exceed 100% for deep fragments)
  width: number; // px
  height: number; // px
  /** Horizontal skew factor for the parallelogram cut (−0.12..0.12). */
  skew: number;
  parallaxFactor: number;
  opacity: number;
  zIndex: number;
  caption?: string;
  /** Viewport (in vh) this photograph belongs to — drives its scroll window. */
  atVH: number;
}

export function generateFragments(deviceTier: DeviceTier): SkyFragmentData[] {
  const list =
    deviceTier === "mobile" ? PHOTOS.filter((_, i) => i % 2 === 0)
    : deviceTier === "tablet" ? PHOTOS.filter((_, i) => i % 4 !== 3)
    : PHOTOS;
  const sizeScale = deviceTier === "mobile" ? 0.55 : deviceTier === "tablet" ? 0.8 : 1;

  return list.map((p, i) => {
    const srcIndex = p.src % SKY_PHOTOS.length;
    return {
      id: `sky-${i}`,
      src: SKY_PHOTOS[srcIndex],
      srcIndex,
      x: p.x,
      y: placedTop(p.atVH, p.offset, p.parallax),
      width: p.w * sizeScale,
      height: p.h * sizeScale,
      skew: p.skew ?? 0,
      parallaxFactor: p.parallax,
      opacity: p.opacity,
      zIndex: 2 + (i % 3),
      caption: p.caption,
      atVH: p.atVH,
    };
  });
}
