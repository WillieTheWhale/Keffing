"use client";

import { useMemo, useEffect, useRef, memo } from "react";
import { useStore } from "@/lib/store";
import { mulberry32 } from "@/lib/generative";
import { PHI_INV } from "@/lib/tokens";

/* ─── types ──────────────────────────────────────────────────────── */

interface SkyBlockData {
  id: string;
  src: string;
  x: number;       // % of viewport width
  y: number;       // % of viewport height (can exceed 100% for deep fragments)
  width: number;   // px
  height: number;  // px
  clipPath: string;
  parallaxFactor: number;
  opacity: number;
  zIndex: number;
}

interface FragmentAnim {
  // Drift oscillation (sinusoidal Lissajous path — never resets)
  driftAmpX: number;   // px horizontal amplitude
  driftAmpY: number;   // px vertical amplitude
  driftFreqX: number;  // Hz
  driftFreqY: number;  // Hz (deliberately different from X for organic path)
  driftPhaseX: number; // radians
  driftPhaseY: number;

  // Opacity breathing
  baseOpacity: number;
  opacityAmp: number;  // how much opacity varies (±)
  fadeFreq: number;     // Hz
  fadePhase: number;

  // Scale breathing (very subtle)
  scaleAmp: number;    // ±
  scaleFreq: number;   // Hz
  scalePhase: number;

  // Scroll parallax
  parallaxFactor: number;
}

/* ─── constants ──────────────────────────────────────────────────── */

const SKY_PHOTOS = [
  "/assets/sky/sky-1.jpg",
  "/assets/sky/sky-2.jpg",
  "/assets/sky/sky-3.jpg",
  "/assets/sky/sky-4.jpg",
  "/assets/sky/sky-5.jpg",
  "/assets/sky/sky-6.jpg",
  "/assets/sky/sky-7.jpg",
  "/assets/sky/sky-8.jpg",
  "/assets/sky/sky-9.jpg",
  "/assets/sky/sky-10.jpg",
  "/assets/sky/sky-11.jpg",
  "/assets/sky/sky-12.jpg",
  "/assets/sky/sky-13.jpg",
  "/assets/sky/sky-14.jpg",
  "/assets/sky/sky-15.jpg",
  "/assets/sky/sky-16.jpg",
];

const CLIP_SHAPES = [
  "inset(0)",
  "polygon(5% 0%, 100% 0%, 95% 100%, 0% 100%)",
  "inset(0 round 8px)",
  "polygon(3% 0%, 97% 2%, 100% 98%, 0% 100%)",
  "inset(0 round 12px)",
  "polygon(0% 5%, 100% 0%, 98% 95%, 2% 100%)",
];

/**
 * Approximate max scroll in viewport-height units.
 * Page is ~6.8vh tall, so max scrollY ≈ 5.8 × vh.
 */
const MAX_SCROLL_VH = 5.8;

const TWO_PI = Math.PI * 2;

/* ─── component ──────────────────────────────────────────────────── */

const SkyFragmentsCSS = memo(function SkyFragmentsCSS() {
  const deviceTier = useStore((s) => s.deviceTier);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const seed = useStore((s) => s.seed);
  const containerRef = useRef<HTMLDivElement>(null);

  /* ── generate fragment layout data ──────────────────────────── */
  const blocks = useMemo(() => {
    const rng = mulberry32(seed + 555);
    const count =
      deviceTier === "mobile" ? 10 : deviceTier === "tablet" ? 18 : 28;
    const sizeScale =
      deviceTier === "mobile" ? 0.5 : deviceTier === "tablet" ? 0.75 : 1.0;

    const result: SkyBlockData[] = [];

    for (let i = 0; i < count; i++) {
      /*
       * Target scroll position: distribute fragments evenly across
       * the full page depth using golden-ratio spacing for maximum
       * uniformity with no clustering.
       */
      const targetScrollVH =
        ((i * PHI_INV) % 1) * MAX_SCROLL_VH + (rng() - 0.5) * 0.6;

      /*
       * Parallax factor: fragments deeper in the page need higher
       * factors to be pulled into view. Add randomness for variety.
       */
      const parallaxFactor = 0.06 + rng() * 0.42; // 0.06 – 0.48

      /*
       * Y position: calculated so this fragment is near viewport
       * center when scrollY matches targetScrollVH.
       *
       * Formula: y% = targetScrollVH × parallaxFactor × 100 + viewportOffset
       * viewportOffset is scattered 10–90% for x-axis variety.
       */
      const viewportOffset = 10 + rng() * 80; // 10–90% within viewport
      const y = targetScrollVH * parallaxFactor * 100 + viewportOffset;

      // Horizontal position: full width scatter
      const x = 2 + rng() * 88; // 2–90%

      // Size: mix of small, medium, large fragments (scaled by device tier)
      const sizeRoll = rng();
      let w: number;
      if (sizeRoll < 0.3) {
        w = (60 + rng() * 100) * sizeScale;        // small: 60–160px × scale
      } else if (sizeRoll < 0.7) {
        w = (120 + rng() * 160) * sizeScale;       // medium: 120–280px × scale
      } else {
        w = (250 + rng() * 200) * sizeScale;       // large: 250–450px × scale
      }
      const aspectRatio = 0.4 + rng() * 0.9; // 0.4–1.3
      const h = w * aspectRatio;

      const opacity = 0.45 + rng() * 0.45; // 0.45–0.90

      result.push({
        id: `sky-${i}`,
        src: SKY_PHOTOS[Math.floor(rng() * SKY_PHOTOS.length)],
        x,
        y,
        width: w,
        height: h,
        clipPath: CLIP_SHAPES[Math.floor(rng() * CLIP_SHAPES.length)],
        parallaxFactor,
        opacity,
        zIndex: 2 + (i % 3), // slight z variation
      });
    }

    return result;
  }, [deviceTier, seed]);

  /* ── animation loop ────────────────────────────────────────── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const els = container.querySelectorAll<HTMLElement>("[data-parallax]");
    const count = els.length;
    if (count === 0) return;

    // ── reducedMotion: scroll parallax only ──
    if (reducedMotion) {
      let ticking = false;
      const update = () => {
        const sy = window.scrollY;
        for (let i = 0; i < count; i++) {
          const f = parseFloat(els[i].dataset.parallax || "0");
          els[i].style.transform = `translateY(${sy * -f}px)`;
        }
        ticking = false;
      };
      const onScroll = () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      update();
      return () => window.removeEventListener("scroll", onScroll);
    }

    // ── build per-fragment animation state (seeded, deterministic) ──
    const animRng = mulberry32(seed + 777);
    const anims: FragmentAnim[] = [];
    const driftScale =
      deviceTier === "mobile" ? 0.5 : deviceTier === "tablet" ? 0.75 : 1.0;

    for (let i = 0; i < count; i++) {
      const baseOpacity = parseFloat(els[i].dataset.baseOpacity || "0.7");

      anims.push({
        // Drift: unique frequencies per fragment → never synchronized.
        // Frequency range ~0.015–0.055 Hz = one full cycle every 18–66 seconds.
        driftAmpX: (25 + animRng() * 65) * driftScale,    // 25–90px × scale
        driftAmpY: (12 + animRng() * 30) * driftScale,    // 12–42px × scale
        driftFreqX: 0.015 + animRng() * 0.04,
        driftFreqY: 0.012 + animRng() * 0.035,
        driftPhaseX: animRng() * TWO_PI,
        driftPhaseY: animRng() * TWO_PI,

        // Opacity breathing: gentle ± variation around baseOpacity
        baseOpacity,
        opacityAmp: 0.08 + animRng() * 0.18,  // ±0.08–0.26
        fadeFreq: 0.01 + animRng() * 0.025,    // cycle every 28–100s
        fadePhase: animRng() * TWO_PI,

        // Scale breathing: very subtle
        scaleAmp: 0.015 + animRng() * 0.04,    // ±1.5–5.5%
        scaleFreq: 0.008 + animRng() * 0.018,  // cycle every 38–125s
        scalePhase: animRng() * TWO_PI,

        parallaxFactor: parseFloat(els[i].dataset.parallax || "0"),
      });
    }

    // ── RAF loop ──
    let rafId = 0;
    let startTime = 0;

    const tick = (timestamp: number) => {
      if (startTime === 0) startTime = timestamp;
      const t = (timestamp - startTime) / 1000; // seconds elapsed
      const sy = window.scrollY;

      for (let i = 0; i < count; i++) {
        const a = anims[i];
        const el = els[i];

        // Sinusoidal drift (Lissajous-like path, never resets)
        const dx = Math.sin(t * a.driftFreqX * TWO_PI + a.driftPhaseX) * a.driftAmpX;
        const dy = Math.sin(t * a.driftFreqY * TWO_PI + a.driftPhaseY) * a.driftAmpY;

        // Scroll parallax
        const parallaxY = sy * -a.parallaxFactor;

        // Scale breathing
        const scale = 1 + Math.sin(t * a.scaleFreq * TWO_PI + a.scalePhase) * a.scaleAmp;

        // Opacity breathing: clamp to [0.05, 1.0]
        const rawOpacity =
          a.baseOpacity +
          Math.sin(t * a.fadeFreq * TWO_PI + a.fadePhase) * a.opacityAmp;
        const opacity = rawOpacity < 0.05 ? 0.05 : rawOpacity > 1 ? 1 : rawOpacity;

        // Compose transform (GPU-accelerated)
        el.style.transform = `translate(${dx}px, ${dy + parallaxY}px) scale(${scale})`;
        el.style.opacity = String(opacity);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [blocks, reducedMotion, deviceTier]);

  /* ── render ─────────────────────────────────────────────────── */
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 2 }}
      aria-hidden="true"
    >
      {blocks.map((block) => (
        <div
          key={block.id}
          data-parallax={block.parallaxFactor}
          data-base-opacity={block.opacity}
          className="absolute overflow-hidden"
          style={{
            left: `${block.x}%`,
            top: `${block.y}%`,
            width: `${block.width}px`,
            height: `${block.height}px`,
            clipPath: block.clipPath,
            opacity: block.opacity,
            zIndex: block.zIndex,
            willChange: "transform, opacity",
          }}
        >
          <img
            src={block.src}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
});

export default SkyFragmentsCSS;
