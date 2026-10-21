"use client";

import { useEffect, useRef, memo } from "react";
import { useMounted } from "@/hooks/useMounted";
import { useStore } from "@/lib/store";
import { lyricsPool } from "@/content/lyrics";
import { TEXTS, placedTop } from "@/lib/composition";
import { bindLayerOpacity } from "@/lib/tuning";
import { windowVis } from "@/lib/window";

/**
 * Typed text columns — hand-placed in lib/composition.ts. The reference
 * uses blocks of typewritten text as texture: small, tight-leaded, either
 * the mono voice or the Mincho accent voice. They surface in the quiet
 * sections (opacity from the density choreography) and move at a faster
 * parallax than the photographs so they read as the nearest layer.
 */
const AtmosphereLayer = memo(function AtmosphereLayer() {
  const mounted = useMounted();
  const reducedMotion = useStore((s) => s.reducedMotion);
  const deviceTier = useStore((s) => s.deviceTier);
  const containerRef = useRef<HTMLDivElement>(null);

  const blocks = deviceTier === "mobile" ? TEXTS.filter((_, i) => i % 2 === 0) : TEXTS;

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
      base[i] = parseFloat(els[i].dataset.op || "0.7");
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
    return bindLayerOpacity("atmosphere", el);
  }, [mounted, reducedMotion]);

  if (!mounted) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 15 }}
      aria-hidden="true"
    >
      {blocks.map((b, i) => {
        const lyric = lyricsPool[b.frag % lyricsPool.length];
        return (
          <div
            key={i}
            className={`typed${b.accent ? " typed-accent" : ""}`}
            data-pf={reducedMotion ? undefined : b.parallax}
            data-at={b.atVH}
            data-op={b.opacity ?? 0.7}
            style={{
              left: `${b.x}%`,
              top: `${placedTop(b.atVH, b.offset, b.parallax)}%`,
              opacity: b.atVH > 0 && !reducedMotion ? 0 : (b.opacity ?? 0.7),
            }}
          >
            {lyric.text}
          </div>
        );
      })}
    </div>
  );
});

export default AtmosphereLayer;
