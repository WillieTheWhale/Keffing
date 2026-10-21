"use client";

import { useEffect, useRef, useMemo, memo } from "react";
import { useMounted } from "@/hooks/useMounted";
import { useStore } from "@/lib/store";
import { mulberry32 } from "@/lib/generative";
import { PHI_INV } from "@/lib/tokens";
import { TEXTURE_SEED } from "@/lib/composition";
import { bindLayerOpacity } from "@/lib/tuning";
import { windowVis } from "@/lib/window";

/**
 * Marginalia — the small drafting marks scattered through the composition,
 * in the reference's own vocabulary: schematic traces with component boxes,
 * rows of dots, double hairline rules with a stepped junction, tiny oblique
 * codes, dial arcs with tick marks, star outlines, halftone patches, plain
 * timecodes. Fixed seed; the placement is texture, not design.
 */

// ─── Module-level timecode loop (zero React overhead) ────────

const timecodeEls = new Set<HTMLElement>();
let tcRaf = 0;
let tcLast = 0;
const pad = (n: number) => String(n).padStart(2, "0");

function startTimecodeLoop() {
  if (tcRaf) return;
  const tick = (now: number) => {
    if (now - tcLast > 66) {
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
  if (timecodeEls.size === 0 && tcRaf) { cancelAnimationFrame(tcRaf); tcRaf = 0; }
}

function Timecode() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    timecodeEls.add(el);
    startTimecodeLoop();
    return () => { timecodeEls.delete(el); stopTimecodeLoop(); };
  }, []);
  return <span ref={ref} className="mark-code">00:00:00:00</span>;
}

// ─── Marks ───────────────────────────────────────────────────

const MAX_SCROLL_VH = 5.8;
const WORDS = ["help", "proxy", "tmp", "null", "echo", "sync", "idle", "ref", "pass", "seam"];

function codeFor(rng: () => number): string {
  const r = rng();
  if (r < 0.4) return "0x" + Math.floor(rng() * 0xffffff).toString(16).padStart(6, "0");
  if (r < 0.7) return `${pad(Math.floor(rng() * 40))}${pad(Math.floor(rng() * 30))}/${pad(Math.floor(rng() * 30))}/${Math.floor(rng() * 9)}`;
  return `${pad(Math.floor(rng() * 40))}/${WORDS[Math.floor(rng() * WORDS.length)]}/${Math.floor(rng() * 9)}`;
}

/** Orthogonal trace with small hollow component boxes, like a fragment of a PCB schematic. */
function Schematic({ rng }: { rng: () => number }) {
  const segs = 2 + Math.floor(rng() * 3);
  let x = 0, y = 0, horiz = rng() < 0.5;
  const pts = [[0, 0]];
  const boxes: [number, number][] = [];
  for (let i = 0; i < segs; i++) {
    const len = 18 + rng() * 80;
    if (horiz) x += len * (rng() < 0.8 ? 1 : -1); else y += len * (rng() < 0.7 ? 1 : -1);
    pts.push([x, y]);
    if (rng() < 0.55) boxes.push([x, y]);
    horiz = !horiz;
  }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs) - 8, minY = Math.min(...ys) - 8;
  const w = Math.max(...xs) - minX + 8, h = Math.max(...ys) - minY + 8;
  return (
    <svg width={w} height={h} viewBox={`${minX} ${minY} ${w} ${h}`} className="mark-svg" aria-hidden="true">
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="rgba(0,0,0,0.38)" strokeWidth="1" />
      {boxes.map(([bx, by], i) => {
        const s = 5 + rng() * 7;
        return <rect key={i} x={bx - s / 2} y={by - s / 2} width={s} height={s} fill="#fff" stroke="rgba(0,0,0,0.45)" strokeWidth="1" />;
      })}
      <circle cx={pts[0][0]} cy={pts[0][1]} r="1.4" fill="rgba(0,0,0,0.5)" />
    </svg>
  );
}

function Dial({ rng }: { rng: () => number }) {
  const r = 12 + rng() * 20;
  const ticks = 10 + Math.floor(rng() * 16);
  const arc = 0.45 + rng() * 0.55;
  const t0 = rng() * Math.PI * 2;
  const lines = Array.from({ length: ticks }, (_, i) => {
    const a = t0 + (i / ticks) * Math.PI * 2 * arc;
    const long = i % 5 === 0;
    return [r + Math.cos(a) * (r - (long ? 6 : 3)), r + Math.sin(a) * (r - (long ? 6 : 3)), r + Math.cos(a) * r, r + Math.sin(a) * r];
  });
  return (
    <svg width={r * 2 + 2} height={r * 2 + 2} viewBox={`-1 -1 ${r * 2 + 2} ${r * 2 + 2}`} className="mark-svg" aria-hidden="true">
      <circle cx={r} cy={r} r={r} fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="0.8" />
      {lines.map((l, i) => <line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="rgba(0,0,0,0.4)" strokeWidth="0.8" />)}
    </svg>
  );
}

function Star({ size, blue }: { size: number; blue: boolean }) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? 46 : 19;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(50 + Math.cos(a) * rr).toFixed(1)},${(50 + Math.sin(a) * rr).toFixed(1)}`);
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="mark-svg" aria-hidden="true">
      <polygon points={pts.join(" ")} fill="none" stroke={blue ? "#6f93d6" : "rgba(0,0,0,0.6)"} strokeWidth="4" />
    </svg>
  );
}

// ─── Layer ───────────────────────────────────────────────────

const GlitchLayer = memo(function GlitchLayer() {
  const mounted = useMounted();
  const reducedMotion = useStore((s) => s.reducedMotion);
  const deviceTier = useStore((s) => s.deviceTier);
  const containerRef = useRef<HTMLDivElement>(null);

  const elements = useMemo(() => {
    const rng = mulberry32(TEXTURE_SEED + 42);
    const items: React.ReactElement[] = [];
    const count = deviceTier === "mobile" ? 60 : deviceTier === "tablet" ? 110 : 170;

    for (let i = 0; i < count; i++) {
      const type = rng();
      const x = rng() * 95;
      const targetScrollVH = ((i * PHI_INV) % 1) * MAX_SCROLL_VH + (rng() - 0.5) * 0.4;
      const parallaxFactor = 0.08 + rng() * 0.35;
      const viewportOffset = 5 + rng() * 85;
      const y = targetScrollVH * parallaxFactor * 100 + viewportOffset;

      let inner: React.ReactElement;
      if (type < 0.16) {
        inner = <Schematic rng={rng} />;
      } else if (type < 0.30) {
        const n = 5 + Math.floor(rng() * 10);
        inner = <span className="mark-dots" style={{ width: n * 6 }} />;
      } else if (type < 0.44) {
        const len = 60 + rng() * 260;
        const step = rng() < 0.4;
        const stepLen = 26 + rng() * 60;
        inner = (
          <span className="mark-rule" style={{ width: len }}>
            {step && <span className="mark-rule-step" style={{ height: stepLen, [rng() < 0.5 ? "left" : "right"]: 0, [rng() < 0.5 ? "top" : "bottom"]: 0 }} />}
          </span>
        );
      } else if (type < 0.60) {
        inner = <span className="mark-caption">{codeFor(rng)}</span>;
      } else if (type < 0.65) {
        inner = <Dial rng={rng} />;
      } else if (type < 0.68) {
        inner = <Star size={10 + rng() * 14} blue={rng() < 0.5} />;
      } else if (type < 0.76) {
        inner = <span className="mark-halftone" style={{ width: 40 + rng() * 90, height: 18 + rng() * 60 }} />;
      } else if (type < 0.86) {
        inner = <span className="mark-rect" style={{ width: 3 + rng() * 18, height: 3 + rng() * 12, opacity: 0.35 + rng() * 0.55 }} />;
      } else if (type < 0.92) {
        const s = 8 + rng() * 8;
        inner = <span className="mark-plus" style={{ width: s, height: s }} />;
      } else {
        inner = <Timecode />;
      }

      items.push(
        <div key={i} className="absolute" data-pf={parallaxFactor} data-at={Math.max(0, targetScrollVH).toFixed(2)} style={{ left: `${x}%`, top: `${y}%`, willChange: "transform", opacity: targetScrollVH > 0.3 ? 0 : 1 }}>
          {inner}
        </div>
      );
    }
    return items;
  }, [deviceTier]);

  useEffect(() => {
    if (reducedMotion) return;
    const container = containerRef.current;
    if (!container) return;
    const els = Array.from(container.querySelectorAll<HTMLElement>("[data-pf]"));
    const factors = new Float64Array(els.length);
    const ats = new Float64Array(els.length);
    for (let i = 0; i < els.length; i++) {
      factors[i] = parseFloat(els[i].dataset.pf!);
      ats[i] = parseFloat(els[i].dataset.at || "0");
    }
    let ticking = false;
    const update = () => {
      const sy = window.scrollY;
      const svh = sy / Math.max(1, window.innerHeight);
      for (let i = 0; i < els.length; i++) {
        els[i].style.transform = `translateY(${-sy * factors[i]}px)`;
        els[i].style.opacity = windowVis(svh, ats[i]).toFixed(3);
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
    return bindLayerOpacity("glitch", el);
  }, [mounted, reducedMotion]);

  if (reducedMotion) return null;
  if (!mounted) return null;

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
