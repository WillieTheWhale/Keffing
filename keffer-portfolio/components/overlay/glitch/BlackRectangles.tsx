"use client";

import { useMemo, useEffect, useRef, memo } from "react";
import { useStore } from "@/lib/store";
import { mulberry32 } from "@/lib/generative";
import { PHI_INV } from "@/lib/tokens";

/**
 * Approximate max scroll depth in viewport-height units.
 * Page is ~6.8vh tall, so maxScrollY ≈ 5.8 × vh.
 */
const MAX_SCROLL_VH = 5.8;

interface BlackRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hasHatch: boolean;
  opacity: number;
  delay: number;
  parallaxFactor: number;
}

const BlackRectangles = memo(function BlackRectangles() {
  const deviceTier = useStore((s) => s.deviceTier);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const seed = useStore((s) => s.seed);
  const containerRef = useRef<HTMLDivElement>(null);

  const rects = useMemo(() => {
    const rng = mulberry32(seed + 333);
    const count = deviceTier === "mobile" ? 10 : deviceTier === "tablet" ? 16 : 25;
    const result: BlackRect[] = [];

    const MAX_RECT_AREA = 14000; // cap per-rect area to prevent dominant blocks

    const wRanges = [[60, 160], [100, 220], [120, 240], [80, 180], [90, 200], [50, 140]];
    const hRanges = [[25, 60], [35, 80], [40, 90], [30, 65], [35, 75], [25, 55]];

    for (let i = 0; i < count; i++) {
      const targetScrollVH = ((i * PHI_INV) % 1) * MAX_SCROLL_VH + (rng() - 0.5) * 0.5;
      const parallaxFactor = 0.06 + rng() * 0.38;
      const viewportOffset = 5 + rng() * 85;
      const y = targetScrollVH * parallaxFactor * 100 + viewportOffset;
      const x = 2 + rng() * 90;

      const wRange = wRanges[i % wRanges.length];
      const hRange = hRanges[i % hRanges.length];
      let w = wRange[0] + rng() * (wRange[1] - wRange[0]);
      let h = hRange[0] + rng() * (hRange[1] - hRange[0]);

      // Scale down proportionally if area exceeds cap
      const area = w * h;
      if (area > MAX_RECT_AREA) {
        const scale = Math.sqrt(MAX_RECT_AREA / area);
        w *= scale;
        h *= scale;
      }

      result.push({
        id: `black-rect-${i}`,
        x, y,
        width: w, height: h,
        hasHatch: rng() < 0.3,
        opacity: 0.85 + rng() * 0.15,
        delay: Math.min(i * 0.05, 1.5),
        parallaxFactor,
      });
    }

    return result;
  }, [deviceTier, seed]);

  // Direct per-element transform writes — compositor-only, no CSS custom property cascade.
  useEffect(() => {
    if (reducedMotion) return;
    const container = containerRef.current;
    if (!container) return;

    const nodes = container.querySelectorAll<HTMLElement>("[data-pf]");
    const els = Array.from(nodes);
    const factors = new Float64Array(els.length);
    for (let i = 0; i < els.length; i++) {
      factors[i] = parseFloat(els[i].dataset.pf!);
    }

    let ticking = false;
    const update = () => {
      const sy = window.scrollY;
      for (let i = 0; i < els.length; i++) {
        els[i].style.transform = `translateY(${-sy * factors[i]}px)`;
      }
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => window.removeEventListener("scroll", onScroll);
  }, [reducedMotion]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 3 }}
      aria-hidden="true"
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes br-fade { from { opacity: 0; } to { opacity: var(--br-op, 1); } }
      `}} />
      {rects.map((rect) => (
        <div
          key={rect.id}
          className="absolute"
          data-pf={rect.parallaxFactor}
          style={{
            left: `${rect.x}%`,
            top: `${rect.y}%`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            willChange: "transform",
            backgroundColor: rect.hasHatch ? "transparent" : `rgba(0, 0, 0, ${rect.opacity})`,
            backgroundImage: rect.hasHatch
              ? `repeating-linear-gradient(
                  45deg,
                  rgba(0,0,0,0.9) 0px,
                  rgba(0,0,0,0.9) 1px,
                  transparent 1px,
                  transparent 4px
                ),
                repeating-linear-gradient(
                  -45deg,
                  rgba(0,0,0,0.9) 0px,
                  rgba(0,0,0,0.9) 1px,
                  transparent 1px,
                  transparent 4px
                )`
              : "none",
            "--br-op": rect.opacity,
            opacity: 0,
            animation: `br-fade 0.6s ease ${rect.delay}s forwards`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
});

export default BlackRectangles;
