"use client";

import { useMemo, useEffect, useRef, memo } from "react";
import { useStore } from "@/lib/store";
import { lyricsPool } from "@/content/lyrics";
import { mulberry32, phiPosition } from "@/lib/generative";
import { PHI_INV } from "@/lib/tokens";

/**
 * Approximate max scroll depth in viewport-height units.
 * Page is ~6.8vh tall, so maxScrollY ≈ 5.8 × vh.
 */
const MAX_SCROLL_VH = 5.8;

interface TextBlock {
  id: string;
  text: string;
  x: number;
  y: number;
  parallaxFactor: number;
  opacity: number;
  delay: number;
  highlightWords: number[];
}

function HighlightedText({ text, highlightWords }: { text: string; highlightWords: number[] }) {
  const words = text.split(/(\s+)/);
  let wordIndex = 0;
  return (
    <>
      {words.map((seg, i) => {
        if (/^\s+$/.test(seg)) return <span key={i}>{seg}</span>;
        const hl = highlightWords.includes(wordIndex);
        wordIndex++;
        return (
          <span
            key={i}
            style={{
              backgroundColor: hl ? "rgba(0, 153, 255, 0.18)" : "transparent",
              padding: hl ? "1px 3px" : "0",
            }}
          >
            {seg}
          </span>
        );
      })}
    </>
  );
}

const AtmosphereLayer = memo(function AtmosphereLayer() {
  const reducedMotion = useStore((s) => s.reducedMotion);
  const deviceTier = useStore((s) => s.deviceTier);
  const seed = useStore((s) => s.seed);
  const containerRef = useRef<HTMLDivElement>(null);

  const textBlocks = useMemo(() => {
    const rng = mulberry32(seed + 777);
    const blockCount = deviceTier === "mobile" ? 10 : deviceTier === "tablet" ? 18 : 30;
    const shuffled = [...lyricsPool].sort(() => rng() - 0.5);

    const blocks: TextBlock[] = [];

    for (let i = 0; i < blockCount; i++) {
      const lyric = shuffled[i % shuffled.length];
      const [px] = phiPosition(100, 100, i, rng);
      const wordCount = lyric.text.split(/\s+/).length;
      const highlightCount = 1 + Math.floor(rng() * 3);
      const highlightWords: number[] = [];
      for (let h = 0; h < highlightCount; h++) {
        highlightWords.push(Math.floor(rng() * wordCount));
      }

      // Distribute across full page depth using golden-ratio spacing
      const targetScrollVH = ((i * PHI_INV) % 1) * MAX_SCROLL_VH + (rng() - 0.5) * 0.5;
      // Distinctly faster parallax range than other layers (0.50–0.92)
      const parallaxFactor = 0.50 + rng() * 0.42;
      const viewportOffset = 5 + rng() * 85;
      const y = targetScrollVH * parallaxFactor * 100 + viewportOffset;

      blocks.push({
        id: `atmo-${i}`,
        text: lyric.text,
        x: px,
        y,
        parallaxFactor,
        opacity: 0.35 + rng() * 0.45,
        delay: Math.min(i * 0.15 + rng() * 0.8, 3),
        highlightWords,
      });
    }

    return blocks;
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

  if (reducedMotion) {
    return (
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 15 }} aria-hidden="true">
        {textBlocks.map((block) => (
          <div
            key={block.id}
            className="absolute"
            style={{
              left: `${block.x}%`,
              top: `${block.y}%`,
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              lineHeight: "2.0",
              letterSpacing: "0.05em",
              color: "#1A1A1A",
              opacity: block.opacity,
              maxWidth: "300px",
              whiteSpace: "pre-line",
            }}
          >
            {block.text}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 15 }}
      aria-hidden="true"
    >
      {/* Opacity-only fade-in. No transform in keyframes — that would
          override the CSS calc parallax via animation fill-mode. */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes atmo-fade {
          from { opacity: 0; }
          to { opacity: var(--atmo-op, 0.5); }
        }
      `}} />
      {textBlocks.map((block) => (
        <div
          key={block.id}
          className="absolute"
          data-pf={block.parallaxFactor}
          style={{
            left: `${block.x}%`,
            top: `${block.y}%`,
            willChange: "transform",
          }}
        >
          <div
            className="pointer-events-none select-none"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              lineHeight: "2.0",
              letterSpacing: "0.05em",
              color: "#1A1A1A",
              maxWidth: "300px",
              textAlign: "left",
              whiteSpace: "pre-line",
              opacity: 0,
              "--atmo-op": block.opacity,
              animation: `atmo-fade 0.6s ease ${block.delay}s forwards`,
            } as React.CSSProperties}
          >
            <HighlightedText text={block.text} highlightWords={block.highlightWords} />
          </div>
        </div>
      ))}
    </div>
  );
});

export default AtmosphereLayer;
