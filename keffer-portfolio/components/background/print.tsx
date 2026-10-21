"use client";

// Background — ALLOY (from v2 CHROME + v1 CONTOUR). Print primitives for the 2D layout: an original
// schematic printout (generated, deterministic), a dot-matrix ASCII field,
// ring stars (r01's outlined star), hex-code columns.

import { memo, useEffect, useRef } from "react";
import { mulberry32 } from "@/lib/generative";

const INK = "#1b1d22";

// ─── Schematic ──────────────────────────────────────────────

type El = React.ReactElement;

/** A generated circuit-diagram sheet: ICs, passives, orthogonal nets, labels. */
export const Schematic = memo(function Schematic({ seed, w, h, title, noTitle = false }: { seed: number; w: number; h: number; title?: string; noTitle?: boolean }) {
  const rng = mulberry32(seed);
  const els: El[] = [];
  let k = 0;
  const key = () => `s${k++}`;
  const G = 12; // grid px
  const cols = Math.floor(w / G), rows = Math.floor(h / G);
  const snap = (v: number) => Math.round(v / G) * G;
  const ri = (a: number, b: number) => Math.floor(a + rng() * (b - a + 1));
  const txt = (x: number, y: number, s: string, size = 6.5, anchor: "start" | "middle" | "end" = "start", rot = 0) => (
    <text key={key()} x={x} y={y} fontSize={size} textAnchor={anchor} fill={INK}
      transform={rot ? `rotate(${rot} ${x} ${y})` : undefined}>{s}</text>
  );
  const pins: [number, number][] = [];

  // ICs
  const nIC = ri(2, 3);
  for (let i = 0; i < nIC; i++) {
    const bw = G * ri(4, 6), bh = G * ri(5, 9);
    const x = snap(G * 3 + rng() * (w - bw - G * 6)), y = snap(G * 2 + rng() * (h - bh - G * 4));
    els.push(<rect key={key()} x={x} y={y} width={bw} height={bh} fill="none" stroke={INK} strokeWidth={0.9} />);
    els.push(txt(x + bw / 2, y + bh / 2, `U${ri(3, 24)}`, 7, "middle"));
    els.push(txt(x + bw / 2, y + bh / 2 + 9, pick(rng, ["8701", "6581", "74LS08", "MC4044", "SID", "VIC-II"]), 5.5, "middle"));
    const np = Math.floor(bh / G) - 1;
    for (let p = 1; p <= np; p++) {
      const py = y + p * G;
      els.push(<line key={key()} x1={x - G} y1={py} x2={x} y2={py} stroke={INK} strokeWidth={0.8} />);
      els.push(<line key={key()} x1={x + bw} y1={py} x2={x + bw + G} y2={py} stroke={INK} strokeWidth={0.8} />);
      els.push(txt(x - 2, py - 2, String(p), 4.5, "end"));
      els.push(txt(x + bw + 2, py - 2, String(np * 2 + 1 - p), 4.5));
      pins.push([x - G, py], [x + bw + G, py]);
    }
  }
  // passives
  const nP = ri(9, 14);
  for (let i = 0; i < nP; i++) {
    const x = snap(G + rng() * (w - G * 4)), y = snap(G + rng() * (h - G * 3));
    const vert = rng() < 0.4;
    const kind = rng();
    const g = vert ? `rotate(90 ${x} ${y})` : undefined;
    if (kind < 0.45) {
      // resistor (box)
      els.push(<g key={key()} transform={g}>
        <line x1={x - G} y1={y} x2={x - 7} y2={y} stroke={INK} strokeWidth={0.8} />
        <rect x={x - 7} y={y - 2.6} width={14} height={5.2} fill="none" stroke={INK} strokeWidth={0.8} />
        <line x1={x + 7} y1={y} x2={x + G} y2={y} stroke={INK} strokeWidth={0.8} />
      </g>);
      els.push(txt(x + (vert ? 6 : -6), y + (vert ? 0 : -6), `R${ri(1, 40)} ${pick(rng, ["100K", "1K", "4.7K", "220", "10K", "1M"])}`, 5));
    } else if (kind < 0.8) {
      // capacitor
      els.push(<g key={key()} transform={g}>
        <line x1={x - G} y1={y} x2={x - 1.6} y2={y} stroke={INK} strokeWidth={0.8} />
        <line x1={x - 1.6} y1={y - 4.5} x2={x - 1.6} y2={y + 4.5} stroke={INK} strokeWidth={1} />
        <line x1={x + 1.6} y1={y - 4.5} x2={x + 1.6} y2={y + 4.5} stroke={INK} strokeWidth={1} />
        <line x1={x + 1.6} y1={y} x2={x + G} y2={y} stroke={INK} strokeWidth={0.8} />
      </g>);
      els.push(txt(x + 5, y - 6, `C${ri(1, 80)} ${pick(rng, ["470pF", "1000pF", "22μF", "0.1", "10"])}`, 5));
    } else {
      // transistor
      els.push(<g key={key()}>
        <circle cx={x} cy={y} r={7} fill="none" stroke={INK} strokeWidth={0.8} />
        <line x1={x - 3} y1={y - 4} x2={x - 3} y2={y + 4} stroke={INK} strokeWidth={1} />
        <line x1={x - 3} y1={y - 1.5} x2={x + 4} y2={y - 6} stroke={INK} strokeWidth={0.8} />
        <line x1={x - 3} y1={y + 1.5} x2={x + 4} y2={y + 6} stroke={INK} strokeWidth={0.8} />
        <line x1={x - G} y1={y} x2={x - 3} y2={y} stroke={INK} strokeWidth={0.8} />
      </g>);
      els.push(txt(x + 9, y + 2, `Q${ri(1, 6)} ${pick(rng, ["2SC1815", "2N3904", "BC547"])}`, 5));
    }
    pins.push([x - G, y], [x + G, y]);
  }
  // nets: orthogonal polylines between random pins, junction dots
  for (let i = 0; i < Math.min(pins.length - 1, 22); i++) {
    const a = pins[ri(0, pins.length - 1)], b = pins[ri(0, pins.length - 1)];
    if (a === b) continue;
    const mx = snap((a[0] + b[0]) / 2 + (rng() - 0.5) * G * 4);
    const d = `M${a[0]} ${a[1]} H${mx} V${b[1]} H${b[0]}`;
    els.push(<path key={key()} d={d} fill="none" stroke={INK} strokeWidth={0.7} strokeDasharray={rng() < 0.12 ? "3 2" : undefined} />);
    if (rng() < 0.5) els.push(<circle key={key()} cx={mx} cy={a[1]} r={1.6} fill={INK} />);
  }
  // rails, grounds, labels
  for (let i = 0; i < 4; i++) {
    const x = snap(G * 2 + rng() * (w - G * 4)), y = snap(G * 2 + rng() * (h - G * 4));
    els.push(<g key={key()}>
      <line x1={x} y1={y} x2={x} y2={y + 6} stroke={INK} strokeWidth={0.8} />
      <line x1={x - 5} y1={y + 6} x2={x + 5} y2={y + 6} stroke={INK} strokeWidth={0.8} />
      <line x1={x - 3} y1={y + 8} x2={x + 3} y2={y + 8} stroke={INK} strokeWidth={0.8} />
      <line x1={x - 1} y1={y + 10} x2={x + 1} y2={y + 10} stroke={INK} strokeWidth={0.8} />
    </g>);
  }
  const labels = ["+5V", "GND", "AUD OUT", "VCC", "EXT IN", "RF OUT", "SYNC", "LUM", "COMP", "+12V", "DOT CLOCK", "RES"];
  for (let i = 0; i < 6; i++) {
    const x = snap(G + rng() * (w - G * 6)), y = snap(G + rng() * (h - G * 2));
    els.push(txt(x, y, pick(rng, labels), 6));
  }
  // title block
  if (!noTitle) els.push(<g key={key()}>
    <rect x={w - G * 14} y={h - G * 3} width={G * 14 - 2} height={G * 3 - 2} fill="none" stroke={INK} strokeWidth={0.8} />
    <line x1={w - G * 14} y1={h - G * 1.6} x2={w - 2} y2={h - G * 1.6} stroke={INK} strokeWidth={0.6} />
  </g>);
  const dwg = ri(1000, 9999);
  if (!noTitle) {
    els.push(txt(w - G * 13.6, h - G * 2.05, title ?? "SIGNAL / NOISE — SHEET 2 OF 4", 5.5));
    els.push(txt(w - G * 13.6, h - G * 0.55, `REV B   DWG ${dwg}   0x0f38722`, 5));
  }
  void cols; void rows;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet"
      style={{ fontFamily: "var(--font-mono), monospace", display: "block", overflow: "visible" }}>
      {els}
    </svg>
  );
});

function pick<T>(rng: () => number, xs: T[]): T { return xs[Math.floor(rng() * xs.length) % xs.length]; }

// ─── ASCII field ────────────────────────────────────────────

/** Dot-matrix glyph field (r01 / r16 texture): a typed rendering of a sky
 *  photo (asciiSky.ts), drawn once into a canvas at device resolution. */
export const AsciiField = memo(function AsciiField({ lines, opacity = 0.5, cell = [4.2, 6.2] }: { lines: string[]; opacity?: number; cell?: [number, number] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    let cancelled = false;
    const draw = () => {
      if (cancelled) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const [cw, chh] = cell;
      const cols = Math.max(...lines.map((l) => l.length));
      c.width = Math.round(cols * cw * dpr);
      c.height = Math.round(lines.length * chh * dpr);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = INK;
      const fam = getComputedStyle(document.body).getPropertyValue("--font-servermono").trim();
      ctx.font = `5.4px ${fam || "monospace"}, monospace`;
      ctx.textBaseline = "top";
      lines.forEach((l, y) => {
        for (let x = 0; x < l.length; x++) {
          const ch = l[x];
          if (ch === " ") continue;
          ctx.fillText(ch, x * cw, y * chh);
        }
      });
    };
    if (document.fonts?.ready) document.fonts.ready.then(draw); else draw();
    return () => { cancelled = true; };
  }, [lines, cell]);
  // intrinsic size in css px: the glyph grid never stretches with the viewport
  const cols = Math.max(...lines.map((l) => l.length));
  return <canvas ref={ref} style={{ width: cols * cell[0], height: lines.length * cell[1], opacity, display: "block" }} />;
});

// ─── Ring star ──────────────────────────────────────────────

function starPath(cx: number, cy: number, R: number, r: number): string {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? R : r;
    d += `${i === 0 ? "M" : "L"}${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`;
  }
  return d + "Z";
}

/** r01's outlined star: a white band between two crisp black contours. */
export const RingStar = memo(function RingStar({ band = 0.16, stroke = 1.1 }: { band?: number; stroke?: number }) {
  const R = 50, r = 21;
  const inner = 1 - band;
  return (
    <svg viewBox="-2 -2 104 104" width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
      <path d={starPath(50, 52, R, r) + starPath(50, 52 + (1 - inner) * 4, R * inner, r * inner * 0.92)}
        fill="#fbfbf8" fillRule="evenodd" stroke={INK} strokeWidth={stroke} vectorEffect="non-scaling-stroke" strokeLinejoin="miter" />
    </svg>
  );
});

// ─── v1 CONTOUR's drawing furniture ─────────────────────────

/** A drawing title block (v1 / e10): double frame, a small figure cell
 *  (registration target + a decaying trace), and the sheet's typed rows. */
export const TitleBlock = memo(function TitleBlock({ rows, seed = 4 }: { rows: string[]; seed?: number }) {
  const W = 224, H = 100;
  const split = Math.round(W * 0.42);
  const rh = (H - 7) / rows.length;
  const rng = mulberry32(seed);
  const ph = rng() * 6;
  const fx0 = 10, fy0 = 10, fw = split - 18, fh = H - 20;
  const cx = fx0 + fw * 0.3, cy = fy0 + fh * 0.42, r = Math.min(fw, fh) * 0.22;
  const x0 = fx0 + fw * 0.58, x1 = fx0 + fw * 0.98, yb = fy0 + fh * 0.82;
  let trace = "";
  for (let i = 0; i <= 40; i++) {
    const x = x0 + ((x1 - x0) * i) / 40;
    const y = yb - fh * 0.3 * (0.5 + 0.5 * Math.sin(i * 0.55 + ph) * Math.exp(-i / 30));
    trace += `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMinYMin meet"
      style={{ display: "block", overflow: "visible", fontFamily: "var(--font-mono), monospace" }}>
      <g fill="none" stroke={INK} strokeWidth={0.7} vectorEffect="non-scaling-stroke">
        <rect x={0.5} y={0.5} width={W - 1} height={H - 1} />
        <rect x={3.5} y={3.5} width={W - 7} height={H - 7} />
        <line x1={split} y1={3.5} x2={split} y2={H - 3.5} />
        {rows.slice(0, -1).map((_, i) => <line key={i} x1={split} y1={3.5 + rh * (i + 1)} x2={W - 3.5} y2={3.5 + rh * (i + 1)} />)}
        <circle cx={cx} cy={cy} r={r} />
        <circle cx={cx} cy={cy} r={r * 0.45} />
        <line x1={cx - r * 1.4} y1={cy} x2={cx + r * 1.4} y2={cy} />
        <line x1={cx} y1={cy - r * 1.4} x2={cx} y2={cy + r * 1.4} />
        <path d={trace} />
        <line x1={x0} y1={yb} x2={x1} y2={yb} />
        <line x1={x0} y1={yb} x2={x0} y2={fy0 + fh * 0.3} />
        {Array.from({ length: 9 }, (_, i) => <line key={i} x1={x0 + ((x1 - x0) * i) / 8} y1={yb} x2={x0 + ((x1 - x0) * i) / 8} y2={yb + 2.6} />)}
      </g>
      {rows.map((t, i) => (
        <text key={i} x={split + 5} y={3.5 + rh * (i + 0.5) + 2.3} fontSize={6.6} fill={INK}>{t}</text>
      ))}
    </svg>
  );
});

/** Registration / crop marks just outside a mounted panel's corners (r05, r11). */
export const CropMarks = memo(function CropMarks({ off = 10, len = 14, color = "rgba(27,29,34,0.6)" }: { off?: number; len?: number; color?: string }) {
  const s: React.CSSProperties = { position: "absolute", background: color };
  const marks: React.ReactElement[] = [];
  const corners: [string, string, number, number][] = [["left", "top", -1, -1], ["right", "top", 1, -1], ["left", "bottom", -1, 1], ["right", "bottom", 1, 1]];
  corners.forEach(([hx, vy], i) => {
    // horizontal tick, outside the corner
    marks.push(<div key={`h${i}`} style={{ ...s, [hx]: -(off + len), [vy]: -0.5, width: len, height: 1 }} />);
    // vertical tick
    marks.push(<div key={`v${i}`} style={{ ...s, [vy]: -(off + len), [hx]: -0.5, width: 1, height: len }} />);
  });
  return <div style={{ position: "absolute", inset: 0 }}>{marks}</div>;
});

/** A paper fold crease (r04): a soft valley with a light ridge along it. */
export const Crease = memo(function Crease({ vertical = false }: { vertical?: boolean }) {
  const dir = vertical ? "90deg" : "180deg";
  return (
    <div style={{
      position: "absolute", inset: 0,
      background: `linear-gradient(${dir}, rgba(20,24,40,0) 0%, rgba(20,24,40,0.035) 30%, rgba(20,24,40,0.075) 47%, rgba(255,255,255,0.55) 49.5%, rgba(255,255,255,0.0) 52%, rgba(20,24,40,0.05) 56%, rgba(20,24,40,0) 100%)`,
    }} />
  );
});
