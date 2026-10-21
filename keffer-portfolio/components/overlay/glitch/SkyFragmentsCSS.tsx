"use client";

import { useMemo, useEffect, useRef, memo } from "react";
import { useMounted } from "@/hooks/useMounted";
import { useStore } from "@/lib/store";
import { mulberry32 } from "@/lib/generative";
import { generateFragments, clipFor } from "@/lib/fragments";
import { TEXTURE_SEED } from "@/lib/composition";
import { diveRef } from "@/lib/scroll";
import { bindLayerOpacity } from "@/lib/tuning";
import { windowVis } from "@/lib/window";

/**
 * CSS sky-photograph layer — the fallback for mobile / tablet / reduced
 * motion / no WebGL. Same hand-placed composition as the GL layer; each
 * photo is a screen-printed rectangle with a slow Lissajous drift.
 */

interface FragmentAnim {
  driftAmpX: number; driftAmpY: number; driftFreqX: number; driftFreqY: number; driftPhaseX: number; driftPhaseY: number;
  baseOpacity: number; opacityAmp: number; fadeFreq: number; fadePhase: number;
  scaleAmp: number; scaleFreq: number; scalePhase: number;
  parallaxFactor: number;
}

const TWO_PI = Math.PI * 2;

const SkyFragmentsCSS = memo(function SkyFragmentsCSS() {
  const mounted = useMounted();
  const deviceTier = useStore((s) => s.deviceTier);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const containerRef = useRef<HTMLDivElement>(null);

  const blocks = useMemo(() => generateFragments(deviceTier), [deviceTier]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const els = container.querySelectorAll<HTMLElement>("[data-parallax]");
    const count = els.length;
    if (count === 0) return;

    const atVH = Array.from(els, (el) => parseFloat(el.dataset.at || "0"));
    if (reducedMotion) {
      let ticking = false;
      const update = () => {
        const sy = window.scrollY;
        const svh = sy / Math.max(1, window.innerHeight);
        for (let i = 0; i < count; i++) {
          const f = parseFloat(els[i].dataset.parallax || "0");
          els[i].style.transform = `translateY(${sy * -f}px)`;
          els[i].style.opacity = (parseFloat(els[i].dataset.baseOpacity || "0.7") * windowVis(svh, atVH[i])).toFixed(3);
        }
        ticking = false;
      };
      const onScroll = () => {
        if (!ticking) { ticking = true; requestAnimationFrame(update); }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      update();
      return () => window.removeEventListener("scroll", onScroll);
    }

    const animRng = mulberry32(TEXTURE_SEED + 777);
    const anims: FragmentAnim[] = [];
    const driftScale = deviceTier === "mobile" ? 0.5 : deviceTier === "tablet" ? 0.75 : 1.0;
    for (let i = 0; i < count; i++) {
      anims.push({
        driftAmpX: (18 + animRng() * 40) * driftScale,
        driftAmpY: (8 + animRng() * 22) * driftScale,
        driftFreqX: 0.015 + animRng() * 0.04,
        driftFreqY: 0.012 + animRng() * 0.035,
        driftPhaseX: animRng() * TWO_PI,
        driftPhaseY: animRng() * TWO_PI,
        baseOpacity: parseFloat(els[i].dataset.baseOpacity || "0.7"),
        opacityAmp: 0.06 + animRng() * 0.12,
        fadeFreq: 0.01 + animRng() * 0.025,
        fadePhase: animRng() * TWO_PI,
        scaleAmp: 0.01 + animRng() * 0.03,
        scaleFreq: 0.008 + animRng() * 0.018,
        scalePhase: animRng() * TWO_PI,
        parallaxFactor: parseFloat(els[i].dataset.parallax || "0"),
      });
    }

    let rafId = 0;
    let startTime = 0;
    let lastDive = -1;
    const tick = (timestamp: number) => {
      if (startTime === 0) startTime = timestamp;
      const t = (timestamp - startTime) / 1000;
      const sy = window.scrollY;
      const svh = sy / Math.max(1, window.innerHeight);
      const dv = diveRef.current;
      if (dv !== lastDive) {
        lastDive = dv;
        container.style.transform = dv > 0 ? `scale(${(1 + dv * 1.35).toFixed(4)})` : "";
      }
      for (let i = 0; i < count; i++) {
        const a = anims[i];
        const el = els[i];
        const dx = Math.sin(t * a.driftFreqX * TWO_PI + a.driftPhaseX) * a.driftAmpX;
        const dy = Math.sin(t * a.driftFreqY * TWO_PI + a.driftPhaseY) * a.driftAmpY;
        const parallaxY = sy * -a.parallaxFactor;
        const scale = 1 + Math.sin(t * a.scaleFreq * TWO_PI + a.scalePhase) * a.scaleAmp;
        const rawOpacity = a.baseOpacity + Math.sin(t * a.fadeFreq * TWO_PI + a.fadePhase) * a.opacityAmp;
        el.style.transform = `translate(${dx}px, ${dy + parallaxY}px) scale(${scale})`;
        el.style.opacity = ((rawOpacity < 0.05 ? 0.05 : rawOpacity > 1 ? 1 : rawOpacity) * windowVis(svh, atVH[i])).toFixed(3);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [blocks, reducedMotion, deviceTier]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    return bindLayerOpacity("fragments", el);
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 2, transformOrigin: "66% 31%" }}
      aria-hidden="true"
    >
      {blocks.map((block) => (
        <div
          key={block.id}
          data-parallax={block.parallaxFactor}
          data-base-opacity={block.opacity}
          data-at={block.atVH}
          className="absolute"
          style={{
            left: `${block.x}%`,
            top: `${block.y}%`,
            width: `${block.width}px`,
            opacity: block.opacity,
            zIndex: block.zIndex,
            willChange: "transform, opacity",
          }}
        >
          <div className="sky-print" style={{ height: `${block.height}px`, clipPath: clipFor(block.skew) }}>
            <img src={block.src} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" draggable={false} />
          </div>
          {block.caption && <span className="sky-caption sky-caption-static">{block.caption}</span>}
        </div>
      ))}
    </div>
  );
});

export default SkyFragmentsCSS;
