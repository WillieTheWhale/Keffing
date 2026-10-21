"use client";

import { useEffect, useRef, memo } from "react";
import { useMounted } from "@/hooks/useMounted";
import { useStore } from "@/lib/store";
import { BLOCKS, placedTop } from "@/lib/composition";
import { bindLayerOpacity } from "@/lib/tuning";
import { windowVis } from "@/lib/window";

/**
 * Flat blocks — hand-placed in lib/composition.ts. Four kinds from the
 * reference: ink (solid black), blue (cornflower, screen-printed, with an
 * optional cut-out star), halftone (a bare dot screen), and blur (a smudged
 * grey rectangle). No hatching, no borders.
 */

function Star() {
  // Five-point star outline, the way the reference cuts it into a blue block.
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 46 : 19;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(50 + Math.cos(a) * r).toFixed(1)},${(50 + Math.sin(a) * r).toFixed(1)}`);
  }
  return (
    <svg viewBox="0 0 100 100" className="cblock-star" aria-hidden="true">
      <polygon points={pts.join(" ")} fill="none" stroke="#ffffff" strokeWidth="3" strokeLinejoin="miter" />
    </svg>
  );
}

const BlackRectangles = memo(function BlackRectangles() {
  const mounted = useMounted();
  const deviceTier = useStore((s) => s.deviceTier);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const containerRef = useRef<HTMLDivElement>(null);

  const blocks = deviceTier === "mobile" ? BLOCKS.filter((_, i) => i % 2 === 0) : BLOCKS;
  const sizeScale = deviceTier === "mobile" ? 0.6 : deviceTier === "tablet" ? 0.8 : 1;

  useEffect(() => {
    if (reducedMotion) return;
    const container = containerRef.current;
    if (!container) return;
    const els = Array.from(container.querySelectorAll<HTMLElement>("[data-pf]"));
    const factors = new Float64Array(els.length);
    const ats = new Float64Array(els.length);
    const base = new Float64Array(els.length);
    for (let i = 0; i < els.length; i++) {
      factors[i] = parseFloat(els[i].dataset.pf!);
      ats[i] = parseFloat(els[i].dataset.at || "0");
      base[i] = parseFloat(els[i].dataset.op || "1");
    }
    let ticking = false;
    const update = () => {
      const sy = window.scrollY;
      const svh = sy / Math.max(1, window.innerHeight);
      for (let i = 0; i < els.length; i++) {
        els[i].style.transform = `translateY(${-sy * factors[i]}px)`;
        els[i].style.opacity = (base[i] * windowVis(svh, ats[i])).toFixed(3);
      }
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => window.removeEventListener("scroll", onScroll);
  }, [reducedMotion, mounted]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    return bindLayerOpacity("rects", el);
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 3 }}
      aria-hidden="true"
    >
      {blocks.map((b, i) => (
        <div
          key={i}
          className={`cblock cblock-${b.kind}`}
          data-pf={b.parallax}
          data-at={b.atVH}
          data-op={b.opacity ?? (b.kind === "ink" ? 0.92 : 1)}
          style={{
            left: `${b.x}%`,
            top: `${placedTop(b.atVH, b.offset, b.parallax)}%`,
            width: `${b.w * sizeScale}px`,
            height: `${b.h * sizeScale}px`,
            opacity: b.atVH > 0 ? 0 : b.opacity,
          }}
        >
          {b.kind === "blue" && b.star && <Star />}
        </div>
      ))}
    </div>
  );
});

export default BlackRectangles;
