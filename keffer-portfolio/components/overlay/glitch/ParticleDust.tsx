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

interface Particle {
  id: string;
  x: number;
  y: number;
  size: number;
  opacity: number;
  delay: number;
  driftX: number;
  driftY: number;
  duration: number;
  parallaxFactor: number;
}

const ParticleDust = memo(function ParticleDust() {
  const deviceTier = useStore((s) => s.deviceTier);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const seed = useStore((s) => s.seed);
  const containerRef = useRef<HTMLDivElement>(null);

  const particles = useMemo(() => {
    const rng = mulberry32(seed + 888);
    const count = deviceTier === "mobile" ? 60 : deviceTier === "tablet" ? 110 : 180;
    const result: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const targetScrollVH = ((i * PHI_INV) % 1) * MAX_SCROLL_VH + (rng() - 0.5) * 0.4;
      const parallaxFactor = 0.06 + rng() * 0.38;
      const viewportOffset = 3 + rng() * 90;
      const y = targetScrollVH * parallaxFactor * 100 + viewportOffset;

      result.push({
        id: `dust-${i}`,
        x: rng() * 100,
        y,
        size: 1 + rng() * 2.5,
        opacity: 0.15 + rng() * 0.45,
        delay: rng() * 5,
        driftX: (rng() - 0.5) * 30,
        driftY: (rng() - 0.5) * 20,
        duration: 8 + rng() * 12,
        parallaxFactor,
      });
    }
    return result;
  }, [deviceTier, seed]);

  // CSS keyframes for drift animation on inner particle div.
  // Scroll parallax is handled by CSS calc on the outer wrapper.
  const styleContent = useMemo(() => {
    return particles.map((p) =>
      `@keyframes ${p.id}{0%{transform:translate(0,0);opacity:${p.opacity * 0.5}}50%{transform:translate(${p.driftX}px,${p.driftY}px);opacity:${p.opacity}}100%{transform:translate(0,0);opacity:${p.opacity * 0.3}}}`
    ).join("");
  }, [particles]);

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

  if (reducedMotion) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 4 }}
      aria-hidden="true"
    >
      <style dangerouslySetInnerHTML={{ __html: styleContent }} />
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute"
          data-pf={p.parallaxFactor}
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            willChange: "transform",
          }}
        >
          <div
            className="rounded-full"
            style={{
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: `rgba(0,0,0,${p.opacity})`,
              animation: `${p.id} ${p.duration}s ease-in-out ${p.delay}s infinite`,
            }}
          />
        </div>
      ))}
    </div>
  );
});

export default ParticleDust;
