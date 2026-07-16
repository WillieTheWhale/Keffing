// Shared sky-fragment layout generator — SIGNAL/NOISE roadmap W6.
// One source of truth so the CSS fallback layer and the WebGL layer render
// the same daily-seeded composition.

import { mulberry32 } from "./generative";
import { PHI_INV } from "./tokens";

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
];

export const CLIP_SHAPES = [
  "inset(0)",
  "polygon(5% 0%, 100% 0%, 95% 100%, 0% 100%)",
  "inset(0 round 8px)",
  "polygon(3% 0%, 97% 2%, 100% 98%, 0% 100%)",
  "inset(0 round 12px)",
  "polygon(0% 5%, 100% 0%, 98% 95%, 2% 100%)",
];

export const SKY_PHOTOS_FULL = SKY_PHOTOS.map((p) => p.replace("/thumbs/", "/"));

/** Approximate max scroll in viewport-height units (page ≈ 6.8vh tall). */
export const MAX_SCROLL_VH = 5.8;

export type DeviceTier = "mobile" | "tablet" | "desktop" | "wide";

export interface SkyFragmentData {
  id: string;
  src: string;
  srcIndex: number;
  x: number; // % of viewport width
  y: number; // % of viewport height (can exceed 100% for deep fragments)
  width: number; // px
  height: number; // px
  clipIndex: number;
  /** Horizontal skew factor for the GL discard mask (−0.12..0.12). */
  skew: number;
  parallaxFactor: number;
  opacity: number;
  zIndex: number;
}

export function generateFragments(seed: number, deviceTier: DeviceTier): SkyFragmentData[] {
  const rng = mulberry32(seed + 555);
  const count = deviceTier === "mobile" ? 10 : deviceTier === "tablet" ? 18 : 28;
  const sizeScale = deviceTier === "mobile" ? 0.5 : deviceTier === "tablet" ? 0.75 : 1.0;

  const result: SkyFragmentData[] = [];

  for (let i = 0; i < count; i++) {
    const targetScrollVH = ((i * PHI_INV) % 1) * MAX_SCROLL_VH + (rng() - 0.5) * 0.6;
    const parallaxFactor = 0.06 + rng() * 0.42;
    const viewportOffset = 10 + rng() * 80;
    const y = targetScrollVH * parallaxFactor * 100 + viewportOffset;
    const x = 2 + rng() * 88;

    const sizeRoll = rng();
    let w: number;
    if (sizeRoll < 0.3) {
      w = (60 + rng() * 100) * sizeScale;
    } else if (sizeRoll < 0.7) {
      w = (120 + rng() * 160) * sizeScale;
    } else {
      w = (250 + rng() * 200) * sizeScale;
    }
    const aspectRatio = 0.4 + rng() * 0.9;
    const h = w * aspectRatio;

    const opacity = 0.45 + rng() * 0.45;
    const srcIndex = Math.floor(rng() * SKY_PHOTOS.length);
    const clipIndex = Math.floor(rng() * CLIP_SHAPES.length);

    result.push({
      id: `sky-${i}`,
      src: SKY_PHOTOS[srcIndex],
      srcIndex,
      x,
      y,
      width: w,
      height: h,
      clipIndex,
      skew: clipIndex % 2 === 1 ? (rng() - 0.5) * 0.2 : 0,
      parallaxFactor,
      opacity,
      zIndex: 2 + (i % 3),
    });
  }

  return result;
}
