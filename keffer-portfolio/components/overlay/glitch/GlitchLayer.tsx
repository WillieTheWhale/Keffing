"use client";

import { useEffect, useRef, useMemo, memo } from "react";
import { useStore } from "@/lib/store";
import { mulberry32 } from "@/lib/generative";
import { PHI_INV } from "@/lib/tokens";

// ─── Module-level timecode loop (zero React overhead) ────────

const timecodeEls = new Set<HTMLElement>();
let tcRaf = 0;
let tcLast = 0;

function pad(n: number): string { return String(n).padStart(2, "0"); }

function startTimecodeLoop() {
  if (tcRaf) return;
  const tick = (now: number) => {
    if (now - tcLast > 66) { // ~15fps
      tcLast = now;
      const d = new Date();
      const str = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}:${pad(Math.floor(d.getMilliseconds() / 33.33))}`;
      for (const el of timecodeEls) el.textContent = str;
    }
    tcRaf = requestAnimationFrame(tick);
  };
  tcRaf = requestAnimationFrame(tick);
}

function stopTimecodeLoop() {
  if (timecodeEls.size === 0 && tcRaf) {
    cancelAnimationFrame(tcRaf);
    tcRaf = 0;
  }
}

/**
 * Approximate max scroll depth in viewport-height units.
 * Page is ~6.8vh tall, so maxScrollY ≈ 5.8 × vh.
 */
const MAX_SCROLL_VH = 5.8;

// ─── Timecode (ref-based, no state) ──────────────────────────

function Timecode({ scale }: { scale?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    timecodeEls.add(el);
    startTimecodeLoop();
    return () => { timecodeEls.delete(el); stopTimecodeLoop(); };
  }, []);

  return (
    <div
      ref={ref}
      className="font-mono"
      style={{
        fontSize: `${(scale || 1) * 11}px`,
        letterSpacing: "0.08em",
        color: "#333333",
        fontFamily: "var(--font-mono)",
        backgroundColor: "rgba(0, 153, 255, 0.12)",
        padding: "1px 4px",
      }}
    >
      00:00:00:00
    </div>
  );
}

// ─── Static element renderers (return inline JSX, no positioning) ──

function CrossMarkerInner({ size, weight }: { size: number; weight: number }) {
  return (
    <div style={{ width: `${size}px`, height: `${size}px`, position: "relative" }}>
      <div style={{ position: "absolute", left: "50%", top: 0, width: `${weight}px`, height: "100%", backgroundColor: "rgba(0,0,0,0.4)", transform: "translateX(-50%)" }} />
      <div style={{ position: "absolute", top: "50%", left: 0, height: `${weight}px`, width: "100%", backgroundColor: "rgba(0,0,0,0.4)", transform: "translateY(-50%)" }} />
    </div>
  );
}

function DotGridInner({ cols, rows, spacing }: { cols: number; rows: number; spacing: number }) {
  const dots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push(
        <div key={`${r}-${c}`} className="rounded-full" style={{ position: "absolute", left: `${c * spacing}px`, top: `${r * spacing}px`, width: "2px", height: "2px", backgroundColor: "rgba(0,0,0,0.35)" }} />
      );
    }
  }
  return <div style={{ position: "relative", width: `${(cols - 1) * spacing + 2}px`, height: `${(rows - 1) * spacing + 2}px` }}>{dots}</div>;
}

// ─── Main component ──────────────────────────────────────────

const GlitchLayer = memo(function GlitchLayer() {
  const reducedMotion = useStore((s) => s.reducedMotion);
  const deviceTier = useStore((s) => s.deviceTier);
  const seed = useStore((s) => s.seed);
  const containerRef = useRef<HTMLDivElement>(null);

  const elements = useMemo(() => {
    const rng = mulberry32(seed + 42);
    const items: React.ReactElement[] = [];
    const count = deviceTier === "mobile" ? 80 : deviceTier === "tablet" ? 150 : 240;

    for (let i = 0; i < count; i++) {
      const type = rng();
      const x = rng() * 95;

      // Distribute across full page depth using golden-ratio spacing
      const targetScrollVH = ((i * PHI_INV) % 1) * MAX_SCROLL_VH + (rng() - 0.5) * 0.4;
      const parallaxFactor = 0.08 + rng() * 0.35; // 0.08–0.43
      const viewportOffset = 5 + rng() * 85;
      const y = targetScrollVH * parallaxFactor * 100 + viewportOffset;

      // Build inner content based on type
      let inner: React.ReactElement;

      if (type < 0.06) {
        inner = <Timecode key={`tc-inner-${i}`} scale={0.9 + rng() * 0.4} />;
      } else if (type < 0.15) {
        inner = <CrossMarkerInner key={`cross-inner-${i}`} size={10 + rng() * 25} weight={1 + Math.floor(rng() * 2)} />;
      } else if (type < 0.22) {
        inner = <DotGridInner key={`dots-inner-${i}`} cols={3 + Math.floor(rng() * 8)} rows={2 + Math.floor(rng() * 5)} spacing={4 + rng() * 4} />;
      } else if (type < 0.34) {
        const w = 30 + rng() * 180;
        const label = rng() < 0.35 ? `${Math.floor(rng() * 9999)}` : undefined;
        inner = (
          <div key={`rule-inner-${i}`}>
            <div style={{ width: `${w}px`, height: "1px", backgroundColor: "rgba(0,0,0,0.2)" }} />
            {label && <span className="font-mono" style={{ position: "absolute", top: "-8px", right: 0, fontSize: "8px", color: "#999", letterSpacing: "0.1em" }}>{label}</span>}
          </div>
        );
      } else if (type < 0.42) {
        const bw = 30 + rng() * 120, bh = 20 + rng() * 80;
        const bc = "rgba(0,0,0,0.35)";
        const s = { position: "absolute" as const, width: "8px", height: "8px" };
        inner = (
          <div key={`corners-inner-${i}`} style={{ width: `${bw}px`, height: `${bh}px`, position: "relative" }}>
            <div style={{ ...s, top: 0, left: 0, borderTop: `1px solid ${bc}`, borderLeft: `1px solid ${bc}` }} />
            <div style={{ ...s, top: 0, right: 0, borderTop: `1px solid ${bc}`, borderRight: `1px solid ${bc}` }} />
            <div style={{ ...s, bottom: 0, left: 0, borderBottom: `1px solid ${bc}`, borderLeft: `1px solid ${bc}` }} />
            <div style={{ ...s, bottom: 0, right: 0, borderBottom: `1px solid ${bc}`, borderRight: `1px solid ${bc}` }} />
          </div>
        );
      } else if (type < 0.50) {
        inner = <div key={`dotted-inner-${i}`} style={{ width: `${40 + rng() * 150}px`, height: `${20 + rng() * 80}px`, border: "1px dotted rgba(0,0,0,0.2)" }} />;
      } else if (type < 0.60) {
        const mw = 8 + rng() * 50;
        const vert = rng() < 0.3;
        inner = <div key={`bar-inner-${i}`} style={{ width: vert ? "2px" : `${mw}px`, height: vert ? `${mw}px` : "2px", backgroundColor: "rgba(0,0,0,0.5)" }} />;
      } else if (type < 0.67) {
        const bh = 10 + rng() * 25;
        inner = (
          <div key={`dbl-inner-${i}`}>
            <div style={{ width: "2px", height: `${bh}px`, backgroundColor: "rgba(0,0,0,0.4)", display: "inline-block" }} />
            <div style={{ width: "2px", height: `${bh}px`, backgroundColor: "rgba(0,0,0,0.4)", display: "inline-block", marginLeft: "3px" }} />
          </div>
        );
      } else if (type < 0.74) {
        const labels = [
          `x:${Math.floor(rng() * 9999)} y:${Math.floor(rng() * 9999)}`,
          `${Math.floor(rng() * 360)}\u00B0`,
          `r:${(rng() * 10).toFixed(2)}`,
          `t:${(rng() * 100).toFixed(1)}ms`,
          `idx:${Math.floor(rng() * 999)}`,
          `${Math.floor(rng() * 1920)}\u00D7${Math.floor(rng() * 1080)}`,
        ];
        inner = (
          <div key={`coord-inner-${i}`} className="font-mono" style={{ fontSize: "8px", letterSpacing: "0.12em", color: "#AAAAAA", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
            {labels[Math.floor(rng() * labels.length)]}
          </div>
        );
      } else if (type < 0.82) {
        const cl = 20 + rng() * 100;
        const cv = rng() < 0.4;
        inner = <div key={`cyan-inner-${i}`} style={{ width: cv ? "1px" : `${cl}px`, height: cv ? `${cl}px` : "1px", backgroundColor: "rgba(0,153,255,0.35)" }} />;
      } else if (type < 0.88) {
        const cs = 8 + rng() * 30;
        inner = <div key={`circle-inner-${i}`} className="rounded-full" style={{ width: `${cs}px`, height: `${cs}px`, border: "1px solid rgba(0,0,0,0.2)", marginLeft: `${-cs / 2}px`, marginTop: `${-cs / 2}px` }} />;
      } else if (type < 0.93) {
        const ts = 6 + rng() * 12;
        const rot = rng() * 360;
        inner = <div key={`tri-inner-${i}`} style={{ width: 0, height: 0, borderLeft: `${ts / 2}px solid transparent`, borderRight: `${ts / 2}px solid transparent`, borderBottom: `${ts}px solid rgba(0,0,0,0.3)`, transform: `rotate(${rot}deg)` }} />;
      } else {
        inner = <div key={`micro-inner-${i}`} style={{ width: `${3 + rng() * 18}px`, height: `${3 + rng() * 12}px`, backgroundColor: `rgba(0,0,0,${0.3 + rng() * 0.5})` }} />;
      }

      items.push(
        <div
          key={`g-${i}`}
          className="absolute"
          data-pf={parallaxFactor}
          style={{
            left: `${x}%`,
            top: `${y}%`,
            willChange: "transform",
          }}
        >
          {inner}
        </div>
      );
    }
    return items;
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

  if (reducedMotion) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 6 }}
      aria-hidden="true"
    >
      {elements}
    </div>
  );
});

export default GlitchLayer;
