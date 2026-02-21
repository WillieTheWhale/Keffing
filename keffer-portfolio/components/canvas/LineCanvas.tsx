"use client";

import { useRef, useEffect, useCallback, memo } from "react";
import { useStore } from "@/lib/store";
import { mulberry32 } from "@/lib/generative";
import { PHI } from "@/lib/tokens";

// ─── Constants ──────────────────────────────────────────────

const OVERFLOW = 0.8;
const PARALLAX = 0.12;
const FOCAL_X = 0.7;
const FOCAL_Y = 0.3;

// ─── Types ──────────────────────────────────────────────────

interface Pt { x: number; y: number }

interface RawBrush {
  cp: [Pt, Pt, Pt, Pt];
  maxWidth: number;
  taperType: number;
  opacity: number;
  widthFn: (t: number) => number;
  seed: number;
}

interface RawCyan {
  p0: Pt; cp?: Pt; p1: Pt;
  width: number; opacity: number;
}

interface RawLine {
  p0: Pt; p1: Pt;
  opacity: number; gray: boolean;
}

interface RawTangle {
  points: Pt[];
  width: number; opacity: number;
}

interface RawArc {
  p0: Pt; cp: Pt; p1: Pt;
  width: number; opacity: number;
}

interface RawAccent {
  p0: Pt; p1: Pt; cp?: Pt;
  width: number; opacity: number;
  hasDot: boolean;
}

interface RawDot {
  x: number; y: number;
  r: number; opacity: number;
}

interface RawWhip {
  points: Pt[];
  maxWidth: number;
  opacity: number;
}

interface RawScratch {
  p0: Pt; p1: Pt; cp?: Pt;
  width: number; opacity: number;
  hasDot: boolean;
}

interface RawThrough {
  p0: Pt; cp?: Pt; p1: Pt;
  width: number; opacity: number;
}

interface RawInk {
  cp: [Pt, Pt, Pt, Pt];
  maxWidth: number;
  widthFn: (t: number) => number;
  seed: number;
  rgb: [number, number, number];
}

interface RawBundle {
  lines: { p0: Pt; p1: Pt }[];
  width: number;
  opacity: number;
}

interface RawScene {
  brushes: RawBrush[];
  brushTangles: RawBrush[];
  cyans: RawCyan[];
  hairlines: RawLine[];
  tangles: RawTangle[];
  whips: RawWhip[];
  scratches: RawScratch[];
  throughs: RawThrough[];
  arcs: RawArc[];
  accents: RawAccent[];
  splatter: RawDot[];
  inks: RawInk[];
  thickCyans: RawInk[];
  bundles: RawBundle[];
}

// ─── Math Helpers ───────────────────────────────────────────

function sampleCubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

function samplePath(cp: [Pt, Pt, Pt, Pt], n: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) pts.push(sampleCubic(cp[0], cp[1], cp[2], cp[3], i / n));
  return pts;
}

function sampleQuadratic(p0: Pt, cp: Pt, p1: Pt, n: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push({
      x: u * u * p0.x + 2 * u * t * cp.x + t * t * p1.x,
      y: u * u * p0.y + 2 * u * t * cp.y + t * t * p1.y,
    });
  }
  return pts;
}

/** Gentle sinusoidal deformation driven by scroll position. */
function deform(p: Pt, scrollY: number): Pt {
  const phase = p.x * 0.003 + p.y * 0.002;
  const s = scrollY * 0.0008;
  return {
    x: p.x + Math.sin(phase + s) * 12,
    y: p.y + Math.cos(phase * 1.3 + s * 0.7) * 8,
  };
}

function makeWidthFn(maxW: number, taper: number): (t: number) => number {
  return (t: number) => {
    let env: number;
    switch (taper) {
      case 0: env = Math.pow(Math.max(0, 1 - t), 1.6); break;
      case 1: env = 0.15 + 0.85 * Math.sin(t * Math.PI * 0.85 + 0.15); break;
      default: env = Math.sin(t * Math.PI); break;
    }
    const noise = 0.93 + 0.07 * Math.sin(t * 17.3 + maxW);
    return Math.max(0.5, maxW * env * noise);
  };
}

function makeInkWidthFn(maxW: number, variant: number): (t: number) => number {
  return (t: number) => {
    let env: number;
    if (variant === 0) {
      // Smooth calligraphic taper: gradual onset then flowing taper to point
      env = t < 0.15
        ? Math.sin(t / 0.15 * Math.PI / 2)  // smooth ease-in
        : Math.pow(Math.max(0, 1 - (t - 0.15) / 0.85), 1.5);
    } else {
      // Organic body: thin at both tips, broad in the middle
      env = Math.pow(Math.sin(t * Math.PI), 0.55);
    }
    const noise = 0.96 + 0.04 * Math.sin(t * 19.7 + maxW);
    return Math.max(1.0, maxW * env * noise);
  };
}

function makeBrushCps(p0: Pt, dir: number, len: number, curv: number): [Pt, Pt, Pt, Pt] {
  const p3: Pt = { x: p0.x + Math.cos(dir) * len, y: p0.y + Math.sin(dir) * len };
  const px = -(p3.y - p0.y), py = p3.x - p0.x;
  const pl = Math.sqrt(px * px + py * py) || 1;
  const nx = px / pl, ny = py / pl;
  return [
    p0,
    { x: p0.x + (p3.x - p0.x) * 0.33 + nx * len * curv, y: p0.y + (p3.y - p0.y) * 0.33 + ny * len * curv },
    { x: p0.x + (p3.x - p0.x) * 0.66 + nx * len * curv * 0.6, y: p0.y + (p3.y - p0.y) * 0.66 + ny * len * curv * 0.6 },
    p3,
  ];
}

function edgeNoise(t: number, seed: number, side: number): number {
  const s = seed + side * 137.5;
  return Math.sin(t * 41.3 + s * 3.71) * 0.40
       + Math.sin(t * 123.7 + s * 7.29) * 0.25
       + Math.sin(t * 347.1 + s * 13.13) * 0.20
       + Math.sin(t * 22.7 + s * 2.07) * 0.15;
}

// ─── Chrome Stroke Renderer ─────────────────────────────────

/**
 * Draws a brush stroke with glassy chrome shading using a perpendicular
 * linear gradient — smooth dark edges → bright specular center → dark edges.
 * Creates a realistic chrome cylinder illusion without any texture assets.
 * Uses filled polygons from perpendicular normals along smooth Bezier paths.
 */
function drawChromeStroke(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  widthFn: (t: number) => number,
  seed: number,
) {
  const N = pts.length;
  if (N < 2) return;

  // Precompute unit normals at each sample point
  const norms: Pt[] = [];
  for (let i = 0; i < N; i++) {
    let tx: number, ty: number;
    if (i === 0) { tx = pts[1].x - pts[0].x; ty = pts[1].y - pts[0].y; }
    else if (i === N - 1) { tx = pts[N - 1].x - pts[N - 2].x; ty = pts[N - 1].y - pts[N - 2].y; }
    else { tx = pts[i + 1].x - pts[i - 1].x; ty = pts[i + 1].y - pts[i - 1].y; }
    const len = Math.sqrt(tx * tx + ty * ty) || 1;
    norms.push({ x: -ty / len, y: tx / len });
  }

  // Build and fill a polygon at given width fraction
  const fillPoly = (frac: number, fill: string | CanvasGradient) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const hw = widthFn(t) * frac / 2;
      const x = pts[i].x + norms[i].x * hw;
      const y = pts[i].y + norms[i].y * hw;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    for (let i = N - 1; i >= 0; i--) {
      const t = i / (N - 1);
      const hw = widthFn(t) * frac / 2;
      ctx.lineTo(pts[i].x - norms[i].x * hw, pts[i].y - norms[i].y * hw);
    }
    ctx.closePath();
    ctx.fill();
    // Rounded end caps
    const r0 = widthFn(0) * frac / 2;
    const r1 = widthFn(1) * frac / 2;
    if (r0 > 1.5) { ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, r0, 0, Math.PI * 2); ctx.fill(); }
    if (r1 > 1.5) { ctx.beginPath(); ctx.arc(pts[N - 1].x, pts[N - 1].y, r1, 0, Math.PI * 2); ctx.fill(); }
  };

  // === Perpendicular chrome gradient ===
  // Weighted average of normals (center-heavy) for gradient axis direction
  let avgNx = 0, avgNy = 0;
  for (let i = 0; i < N; i++) {
    const w = Math.sin((i / (N - 1)) * Math.PI); // Weight center of stroke
    avgNx += norms[i].x * w;
    avgNy += norms[i].y * w;
  }
  const avgLen = Math.sqrt(avgNx * avgNx + avgNy * avgNy) || 1;
  avgNx /= avgLen;
  avgNy /= avgLen;

  // Gradient spans the full width at the widest point along the stroke
  let maxW = 0;
  let maxIdx = 0;
  for (let i = 0; i < N; i++) {
    const w = widthFn(i / (N - 1));
    if (w > maxW) { maxW = w; maxIdx = i; }
  }
  const cx = pts[maxIdx].x;
  const cy = pts[maxIdx].y;
  const extent = maxW * 0.55;

  // Chrome cylinder gradient: asymmetric lighting (sky-biased specular peak)
  // Fresnel edge brightening + ground-bounce secondary highlight
  const shift = ((seed * 7.3) % 1) * 0.03 - 0.015; // ±1.5% offset variance
  const peakShift = ((seed * 3.7) % 1) * 0.08 - 0.04; // ±0.04 peak position variance
  const peak = 0.44 + peakShift; // specular peak biased toward light source (sky side)

  // Per-stroke color temperature variation via seed
  const tempT = ((seed * 5.1) % 1);
  // Cool: #d8e4f8, Warm: #f0e8d8, Neutral: #e0e8f4
  const specR = tempT < 0.33 ? 0xd8 : tempT < 0.66 ? 0xf0 : 0xe0;
  const specG = tempT < 0.33 ? 0xe4 : tempT < 0.66 ? 0xe8 : 0xe8;
  const specB = tempT < 0.33 ? 0xf8 : tempT < 0.66 ? 0xd8 : 0xf4;
  const specColor = `rgb(${specR},${specG},${specB})`;
  // Corresponding mid-tone
  const midR = Math.round(specR * 0.6);
  const midG = Math.round(specG * 0.66);
  const midB = Math.round(specB * 0.78);
  const midColor = `rgb(${midR},${midG},${midB})`;

  const grad = ctx.createLinearGradient(
    cx - avgNx * extent, cy - avgNy * extent,
    cx + avgNx * extent, cy + avgNy * extent,
  );
  grad.addColorStop(0.00, "#0d1018");               // Fresnel edge brightening (dark blue-gray, not pure void)
  grad.addColorStop(0.06 + shift, "#07080e");
  grad.addColorStop(0.16 + shift, "#141824");
  grad.addColorStop(0.27, "#2e3448");
  grad.addColorStop(0.35, "#586880");
  grad.addColorStop(Math.max(0.36, peak - 0.04), midColor); // approach specular — temp-varied
  grad.addColorStop(peak, specColor);                        // specular peak — shifted sky-side, temp-varied
  grad.addColorStop(Math.min(0.59, peak + 0.06), midColor);  // steeper falloff on ground side
  grad.addColorStop(0.60, "#586880");
  grad.addColorStop(0.70, "#2e3448");
  grad.addColorStop(0.82 - shift, "#141824");
  grad.addColorStop(0.86, "#1e2438");                 // ground-bounce secondary highlight
  grad.addColorStop(0.92 - shift, "#07080e");
  grad.addColorStop(1.00, "#0d1018");                 // Fresnel edge brightening

  // Soft outer halo
  fillPoly(1.25, "rgba(0,0,0,0.025)");

  // Main chrome fill with perpendicular gradient
  fillPoly(1.0, grad);

  // Stroke-aligned environment reflection overlay (sky side = lighter, ground side = darker)
  // Uses the stroke's perpendicular normal so angled strokes reflect environment differently
  const envGrad = ctx.createLinearGradient(
    cx - avgNx * extent, cy - avgNy * extent,
    cx + avgNx * extent, cy + avgNy * extent,
  );
  // Determine which side faces "up" (sky) based on normal's Y component
  const skyFacing = avgNy < 0 ? 0 : 1; // 0 = start side faces sky, 1 = end side faces sky
  if (skyFacing === 0) {
    envGrad.addColorStop(0, "rgba(170,190,220,0.07)");
    envGrad.addColorStop(0.5, "rgba(0,0,0,0)");
    envGrad.addColorStop(1, "rgba(0,0,0,0.05)");
  } else {
    envGrad.addColorStop(0, "rgba(0,0,0,0.05)");
    envGrad.addColorStop(0.5, "rgba(0,0,0,0)");
    envGrad.addColorStop(1, "rgba(170,190,220,0.07)");
  }
  fillPoly(0.92, envGrad);

  // Sharp specular highlight line along center
  fillPoly(0.05, "rgba(210,220,240,0.22)");

  // Additive specular bloom — overexposed highlight for chrome intensity
  ctx.globalCompositeOperation = "lighter";
  fillPoly(0.12, "rgba(180,195,220,0.06)"); // wide soft bloom
  fillPoly(0.04, "rgba(220,230,245,0.10)"); // narrow intense bloom
  ctx.globalCompositeOperation = "source-over";

  // Edge texture: thin rough outlines along both edges to break up smooth polygon boundary
  ctx.strokeStyle = "rgba(5,8,20,0.10)";
  ctx.lineWidth = maxW * 0.012 + 0.3;
  ctx.lineCap = "round";
  for (const side of [1, -1]) {
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const hw = widthFn(t) / 2;
      const roughness = hw * 0.05;
      const disp = roughness * edgeNoise(t * N, seed, side);
      const x = pts[i].x + norms[i].x * (hw * side + disp);
      const y = pts[i].y + norms[i].y * (hw * side + disp);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// ─── Dark Chrome Stroke Renderer (sleek reflective black) ────

/**
 * Draws a calligraphic stroke with dark chrome shading — near-black base
 * with subtle cool specular highlights. Same perpendicular-gradient polygon
 * technique as drawChromeStroke but dramatically darker palette.
 * For black strokes: obsidian/black chrome look.
 * For cyan strokes: deep saturated cyan chrome.
 */
function drawDarkChromeStroke(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  widthFn: (t: number) => number,
  seed: number,
  rgb: [number, number, number] = [0, 0, 0],
) {
  const N = pts.length;
  if (N < 2) return;

  const isCyan = rgb[2] > 200;

  // Precompute unit normals
  const norms: Pt[] = [];
  for (let i = 0; i < N; i++) {
    let tx: number, ty: number;
    if (i === 0) { tx = pts[1].x - pts[0].x; ty = pts[1].y - pts[0].y; }
    else if (i === N - 1) { tx = pts[N - 1].x - pts[N - 2].x; ty = pts[N - 1].y - pts[N - 2].y; }
    else { tx = pts[i + 1].x - pts[i - 1].x; ty = pts[i + 1].y - pts[i - 1].y; }
    const len = Math.sqrt(tx * tx + ty * ty) || 1;
    norms.push({ x: -ty / len, y: tx / len });
  }

  // Polygon builder with very subtle organic edge displacement
  const fillPoly = (frac: number, fill: string | CanvasGradient, roughness = 0.025) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const hw = widthFn(t) * frac / 2;
      const disp = hw * roughness * edgeNoise(t * N, seed, 0);
      const x = pts[i].x + norms[i].x * (hw + disp);
      const y = pts[i].y + norms[i].y * (hw + disp);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    for (let i = N - 1; i >= 0; i--) {
      const t = i / (N - 1);
      const hw = widthFn(t) * frac / 2;
      const disp = hw * roughness * edgeNoise(t * N, seed, 1);
      ctx.lineTo(pts[i].x - norms[i].x * (hw + disp), pts[i].y - norms[i].y * (hw + disp));
    }
    ctx.closePath();
    ctx.fill();
    // Rounded end caps
    const r0 = widthFn(0) * frac / 2;
    const r1 = widthFn(1) * frac / 2;
    if (r0 > 1.5) { ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, r0, 0, Math.PI * 2); ctx.fill(); }
    if (r1 > 1.5) { ctx.beginPath(); ctx.arc(pts[N - 1].x, pts[N - 1].y, r1, 0, Math.PI * 2); ctx.fill(); }
  };

  // === Perpendicular dark chrome gradient ===
  let avgNx = 0, avgNy = 0;
  for (let i = 0; i < N; i++) {
    const w = Math.sin((i / (N - 1)) * Math.PI);
    avgNx += norms[i].x * w;
    avgNy += norms[i].y * w;
  }
  const avgLen = Math.sqrt(avgNx * avgNx + avgNy * avgNy) || 1;
  avgNx /= avgLen;
  avgNy /= avgLen;

  let maxW = 0, maxIdx = 0;
  for (let i = 0; i < N; i++) {
    const w = widthFn(i / (N - 1));
    if (w > maxW) { maxW = w; maxIdx = i; }
  }
  const cx = pts[maxIdx].x;
  const cy = pts[maxIdx].y;
  const extent = maxW * 0.55;

  const shift = ((seed * 7.3) % 1) * 0.03 - 0.015;
  const peak = 0.44 + ((seed * 3.7) % 1) * 0.08 - 0.04;

  const grad = ctx.createLinearGradient(
    cx - avgNx * extent, cy - avgNy * extent,
    cx + avgNx * extent, cy + avgNy * extent,
  );

  if (isCyan) {
    // Deep saturated cyan chrome
    grad.addColorStop(0.00, "#020810");
    grad.addColorStop(0.08 + shift, "#011018");
    grad.addColorStop(0.20, "#03192e");
    grad.addColorStop(0.32, "#0a3858");
    grad.addColorStop(Math.max(0.36, peak - 0.04), "#1a6890");
    grad.addColorStop(peak, "#2a99cc");               // cyan specular peak
    grad.addColorStop(Math.min(0.58, peak + 0.06), "#1a6890");
    grad.addColorStop(0.65, "#0a3858");
    grad.addColorStop(0.78, "#03192e");
    grad.addColorStop(0.88, "#041828");               // subtle secondary
    grad.addColorStop(0.94 - shift, "#011018");
    grad.addColorStop(1.00, "#020810");
  } else {
    // Obsidian / black chrome — near-black with visible cool specular
    grad.addColorStop(0.00, "#060810");
    grad.addColorStop(0.07 + shift, "#030406");
    grad.addColorStop(0.16, "#080c14");
    grad.addColorStop(0.26, "#121820");
    grad.addColorStop(0.34, "#1e2838");
    grad.addColorStop(Math.max(0.37, peak - 0.04), "#2e3c54");
    grad.addColorStop(peak, "#4a6480");               // specular peak — polished dark metal
    grad.addColorStop(Math.min(0.57, peak + 0.06), "#2e3c54");
    grad.addColorStop(0.64, "#1e2838");
    grad.addColorStop(0.73, "#121820");
    grad.addColorStop(0.82, "#080c14");
    grad.addColorStop(0.87, "#101828");               // ground-bounce secondary
    grad.addColorStop(0.93 - shift, "#030406");
    grad.addColorStop(1.00, "#060810");
  }

  // Soft outer halo
  if (isCyan) {
    fillPoly(1.18, "rgba(0,80,160,0.04)", 0.03);
  } else {
    fillPoly(1.18, "rgba(0,0,0,0.06)", 0.03);
  }

  // Main dark chrome fill
  fillPoly(1.0, grad);

  // Environment reflection overlay
  const envGrad = ctx.createLinearGradient(
    cx - avgNx * extent, cy - avgNy * extent,
    cx + avgNx * extent, cy + avgNy * extent,
  );
  const skyFacing = avgNy < 0 ? 0 : 1;
  if (skyFacing === 0) {
    envGrad.addColorStop(0, isCyan ? "rgba(100,180,240,0.06)" : "rgba(80,100,130,0.05)");
    envGrad.addColorStop(0.5, "rgba(0,0,0,0)");
    envGrad.addColorStop(1, "rgba(0,0,0,0.03)");
  } else {
    envGrad.addColorStop(0, "rgba(0,0,0,0.03)");
    envGrad.addColorStop(0.5, "rgba(0,0,0,0)");
    envGrad.addColorStop(1, isCyan ? "rgba(100,180,240,0.06)" : "rgba(80,100,130,0.05)");
  }
  fillPoly(0.90, envGrad, 0.015);

  // Thin specular highlight line
  if (isCyan) {
    fillPoly(0.06, "rgba(120,200,255,0.18)", 0);
  } else {
    fillPoly(0.06, "rgba(150,165,195,0.16)", 0);
  }

  // Additive specular bloom
  ctx.globalCompositeOperation = "lighter";
  if (isCyan) {
    fillPoly(0.14, "rgba(0,120,200,0.05)", 0);
    fillPoly(0.04, "rgba(80,180,240,0.08)", 0);
  } else {
    fillPoly(0.14, "rgba(70,85,110,0.05)", 0);
    fillPoly(0.04, "rgba(110,125,155,0.08)", 0);
  }
  ctx.globalCompositeOperation = "source-over";
}

// ─── Tapering Line Renderers ────────────────────────────────

/**
 * Draws a straight line as a filled polygon that tapers width to a point
 * and fades opacity at both endpoints. Uses 10 sample points per side.
 * color is an rgb triplet string like "0,0,0" or "160,160,160".
 */
function drawTaperingLine(
  ctx: CanvasRenderingContext2D,
  p0: Pt, p1: Pt,
  width: number, opacity: number,
  color: string, taperFrac = 0.15,
) {
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  // Unit normal (perpendicular)
  const nx = -dy / len, ny = dx / len;

  // Gradient along the line: transparent → full → full → transparent
  const grad = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
  grad.addColorStop(0, `rgba(${color},0)`);
  grad.addColorStop(Math.min(taperFrac, 0.49), `rgba(${color},${opacity})`);
  grad.addColorStop(Math.max(1 - taperFrac, 0.51), `rgba(${color},${opacity})`);
  grad.addColorStop(1, `rgba(${color},0)`);

  // Build polygon with width taper at both ends
  const SAMPLES = 10;
  ctx.fillStyle = grad;
  ctx.beginPath();
  // Forward side (p0 → p1)
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    // Width ramp: 0 at t=0, full by t=taperFrac, full until t=1-taperFrac, 0 at t=1
    let wScale: number;
    if (t < taperFrac) wScale = t / taperFrac;
    else if (t > 1 - taperFrac) wScale = (1 - t) / taperFrac;
    else wScale = 1;
    const hw = width * wScale * 0.5;
    const x = p0.x + dx * t + nx * hw;
    const y = p0.y + dy * t + ny * hw;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  // Return side (p1 → p0)
  for (let i = SAMPLES; i >= 0; i--) {
    const t = i / SAMPLES;
    let wScale: number;
    if (t < taperFrac) wScale = t / taperFrac;
    else if (t > 1 - taperFrac) wScale = (1 - t) / taperFrac;
    else wScale = 1;
    const hw = width * wScale * 0.5;
    ctx.lineTo(p0.x + dx * t - nx * hw, p0.y + dy * t - ny * hw);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Draws a curved path (array of sampled points) as a filled polygon that
 * tapers width and fades opacity at both endpoints.
 * color is an rgb triplet string like "170,170,170".
 */
function drawTaperingCurve(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  width: number, opacity: number,
  color: string, taperFrac = 0.15,
) {
  const N = pts.length;
  if (N < 2) return;

  // Per-point unit normals
  const norms: Pt[] = [];
  for (let i = 0; i < N; i++) {
    let tx: number, ty: number;
    if (i === 0) { tx = pts[1].x - pts[0].x; ty = pts[1].y - pts[0].y; }
    else if (i === N - 1) { tx = pts[N - 1].x - pts[N - 2].x; ty = pts[N - 1].y - pts[N - 2].y; }
    else { tx = pts[i + 1].x - pts[i - 1].x; ty = pts[i + 1].y - pts[i - 1].y; }
    const len = Math.sqrt(tx * tx + ty * ty) || 1;
    norms.push({ x: -ty / len, y: tx / len });
  }

  // Gradient along chord from first to last point
  const grad = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[N - 1].x, pts[N - 1].y);
  grad.addColorStop(0, `rgba(${color},0)`);
  grad.addColorStop(Math.min(taperFrac, 0.49), `rgba(${color},${opacity})`);
  grad.addColorStop(Math.max(1 - taperFrac, 0.51), `rgba(${color},${opacity})`);
  grad.addColorStop(1, `rgba(${color},0)`);

  // Build polygon with width taper
  ctx.fillStyle = grad;
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    let wScale: number;
    if (t < taperFrac) wScale = t / taperFrac;
    else if (t > 1 - taperFrac) wScale = (1 - t) / taperFrac;
    else wScale = 1;
    const hw = width * wScale * 0.5;
    const x = pts[i].x + norms[i].x * hw;
    const y = pts[i].y + norms[i].y * hw;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  for (let i = N - 1; i >= 0; i--) {
    const t = i / (N - 1);
    let wScale: number;
    if (t < taperFrac) wScale = t / taperFrac;
    else if (t > 1 - taperFrac) wScale = (1 - t) / taperFrac;
    else wScale = 1;
    const hw = width * wScale * 0.5;
    ctx.lineTo(pts[i].x - norms[i].x * hw, pts[i].y - norms[i].y * hw);
  }
  ctx.closePath();
  ctx.fill();
}

// ─── Smooth Path ────────────────────────────────────────────

function drawSmoothPath(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 2) {
    ctx.lineTo(pts[1].x, pts[1].y);
  } else {
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  }
  ctx.stroke();
}

// ─── Whip Stroke (variable-width dark polygon, no chrome gradient) ───

function drawWhipStroke(ctx: CanvasRenderingContext2D, pts: Pt[], maxWidth: number, opacity: number) {
  const N = pts.length;
  if (N < 2) return;

  // Compute unit normals
  const norms: Pt[] = [];
  for (let i = 0; i < N; i++) {
    let tx: number, ty: number;
    if (i === 0) { tx = pts[1].x - pts[0].x; ty = pts[1].y - pts[0].y; }
    else if (i === N - 1) { tx = pts[N - 1].x - pts[N - 2].x; ty = pts[N - 1].y - pts[N - 2].y; }
    else { tx = pts[i + 1].x - pts[i - 1].x; ty = pts[i + 1].y - pts[i - 1].y; }
    const len = Math.sqrt(tx * tx + ty * ty) || 1;
    norms.push({ x: -ty / len, y: tx / len });
  }

  // Sinusoidal taper: thin at ends, full at center
  ctx.fillStyle = `rgba(0,0,0,${opacity})`;
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const hw = maxWidth * Math.sin(t * Math.PI) * 0.5;
    const x = pts[i].x + norms[i].x * hw;
    const y = pts[i].y + norms[i].y * hw;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  for (let i = N - 1; i >= 0; i--) {
    const t = i / (N - 1);
    const hw = maxWidth * Math.sin(t * Math.PI) * 0.5;
    ctx.lineTo(pts[i].x - norms[i].x * hw, pts[i].y - norms[i].y * hw);
  }
  ctx.closePath();
  ctx.fill();
}

// ─── Scene Generation ───────────────────────────────────────

function generateRawScene(
  fx: number, fy: number,
  w: number, h: number,
  scale: number, rng: () => number,
): RawScene {
  const diag = Math.sqrt(w * w + h * h);
  const golden = (2 * Math.PI) / (PHI * PHI);
  const brushes: RawBrush[] = [];
  const splatter: RawDot[] = [];

  const addBrush = (p0: Pt, dir: number, len: number, curv: number, maxW: number, taper: number, op: number) => {
    const cp = makeBrushCps(p0, dir, len, curv);
    brushes.push({ cp, maxWidth: maxW, taperType: taper, opacity: op, widthFn: makeWidthFn(maxW, taper), seed: rng() * 100 });
    // Ink splatter at endpoints
    for (let d = 0; d < 6; d++) {
      const ep = d < 2 ? cp[0] : cp[3];
      splatter.push({ x: ep.x + (rng() - 0.5) * 28, y: ep.y + (rng() - 0.5) * 28, r: 1 + rng() * 3.5, opacity: 0.3 + rng() * 0.5 });
    }
  };

  // Hero brush strokes: long sweeping curves from focal
  for (let i = 0; i < Math.ceil(5 * scale); i++) {
    const angle = i * golden + (rng() - 0.5) * 0.5;
    const d = rng() * diag * 0.06;
    addBrush(
      { x: fx + Math.cos(angle) * d, y: fy + Math.sin(angle) * d },
      angle, diag * (0.30 + rng() * 0.35), (rng() - 0.5) * 0.35,
      20 + rng() * 35, Math.floor(rng() * 3), 0.88 + rng() * 0.12,
    );
  }

  // Accent strokes: shorter, bolder, radiating from near focal
  for (let i = 0; i < Math.ceil(4 * scale); i++) {
    const angle = i * golden + (rng() - 0.5) * 0.8;
    const d = rng() * diag * 0.08;
    addBrush(
      { x: fx + Math.cos(angle) * d, y: fy + Math.sin(angle) * d },
      angle + (rng() - 0.5) * 0.6, diag * (0.08 + rng() * 0.12), (rng() - 0.5) * 0.5,
      16 + rng() * 20, rng() < 0.6 ? 0 : 1, 0.85 + rng() * 0.15,
    );
  }

  // Peripheral strokes: sweep from edges inward
  for (let i = 0; i < Math.ceil(3 * scale); i++) {
    const edge = Math.floor(rng() * 4);
    const sx = edge === 1 ? w + 20 : edge === 3 ? -20 : rng() * w;
    const sy = edge === 0 ? -20 : edge === 2 ? h + 20 : rng() * h;
    const aToF = Math.atan2(fy - sy, fx - sx) + (rng() - 0.5) * 0.5;
    addBrush(
      { x: sx, y: sy }, aToF, diag * (0.18 + rng() * 0.20), (rng() - 0.5) * 0.4,
      14 + rng() * 22, 2, 0.75 + rng() * 0.25,
    );
  }

  // Dynamic symmetry diagonal strokes: 4 structural strokes aligned to frame diagonals
  const diagAngles = [
    Math.atan2(h, w),    // baroque: lower-left to upper-right
    Math.atan2(h, -w),   // sinister: upper-left to lower-right
    Math.atan2(w, -h),   // reciprocal of baroque
    Math.atan2(-w, -h),  // reciprocal of sinister
  ];
  for (let i = 0; i < 3; i++) {
    const angle = diagAngles[i] + (rng() - 0.5) * 0.15; // slight variation
    const d = rng() * diag * 0.04;
    addBrush(
      { x: fx + Math.cos(angle) * d, y: fy + Math.sin(angle) * d },
      angle, diag * (0.35 + rng() * 0.25), (rng() - 0.5) * 0.2,
      22 + rng() * 22, Math.floor(rng() * 3), 0.90 + rng() * 0.10,
    );
  }

  // Cyan beams
  const cyans: RawCyan[] = [];
  for (let i = 0; i < Math.floor(55 * scale); i++) {
    const angle = i * golden + (rng() - 0.5) * 0.3;
    const len = diag * (0.2 + rng() * 0.7);
    const off = rng() * 15;
    const p0: Pt = { x: fx + Math.cos(angle) * off, y: fy + Math.sin(angle) * off };
    const p1: Pt = { x: fx + Math.cos(angle) * len, y: fy + Math.sin(angle) * len };
    const hasCp = rng() < 0.3;
    cyans.push({
      p0, p1,
      cp: hasCp ? { x: (p0.x + p1.x) / 2 + (rng() - 0.5) * len * 0.08, y: (p0.y + p1.y) / 2 + (rng() - 0.5) * len * 0.08 } : undefined,
      width: 0.8 + rng() * 4.2, opacity: 0.3 + rng() * 0.5,
    });
  }

  // Hairlines (high density for depth field)
  const hairlines: RawLine[] = [];
  for (let i = 0; i < Math.floor(200 * scale); i++) {
    const angle = (i + 0.5) * golden + (rng() - 0.5) * 0.5;
    const len = diag * (0.1 + rng() * 0.8);
    const off = rng() * 15;
    hairlines.push({
      p0: { x: fx + Math.cos(angle) * off, y: fy + Math.sin(angle) * off },
      p1: { x: fx + Math.cos(angle) * len, y: fy + Math.sin(angle) * len },
      opacity: 0.03 + rng() * 0.17, gray: rng() < 0.4,
    });
  }
  // Scattered hairlines: placed along focal radiation for mid-page coverage
  for (let i = 0; i < Math.floor(40 * scale); i++) {
    const sAngle = i * golden + (rng() - 0.5) * 0.8;
    const sDist = diag * (0.15 + rng() * 0.45);
    const sx = fx + Math.cos(sAngle) * sDist;
    const sy = fy + Math.sin(sAngle) * sDist;
    const angle = sAngle + (rng() - 0.5) * 0.7;
    const len = diag * (0.05 + rng() * 0.3);
    hairlines.push({
      p0: { x: sx, y: sy },
      p1: { x: sx + Math.cos(angle) * len, y: sy + Math.sin(angle) * len },
      opacity: 0.03 + rng() * 0.12, gray: rng() < 0.5,
    });
  }

  // Tangle (increased density)
  const tangles: RawTangle[] = [];
  const tangleRad = Math.min(w, h) * 0.14;
  for (let i = 0; i < Math.floor(80 * scale); i++) {
    const numPts = 10 + Math.floor(rng() * 15);
    let cx = fx + (rng() - 0.5) * tangleRad * 0.6;
    let cy = fy + (rng() - 0.5) * tangleRad * 0.6;
    let dir = rng() * Math.PI * 2;
    const pts: Pt[] = [{ x: cx, y: cy }];
    const escape = rng() < 0.25;
    const escAt = Math.floor(numPts * (0.3 + rng() * 0.4));
    for (let j = 1; j < numPts; j++) {
      dir += (rng() - 0.5) * Math.PI * 1.8;
      let step = 25 + rng() * 55;
      if (escape && j === escAt) step = 150 + rng() * 300;
      cx += Math.cos(dir) * step;
      cy += Math.sin(dir) * step;
      const dx = cx - fx, dy = cy - fy;
      if (Math.sqrt(dx * dx + dy * dy) > tangleRad * 0.7) {
        cx -= dx * 0.4; cy -= dy * 0.4;
        dir = Math.atan2(fy - cy, fx - cx) + (rng() - 0.5) * 0.7;
      }
      pts.push({ x: cx, y: cy });
    }
    tangles.push({ points: pts, width: 0.5 + rng() * 2.5, opacity: 0.10 + rng() * 0.35 });
  }

  // Dense core: extra-tight short curves in inner 20% of tangle radius
  for (let i = 0; i < Math.floor(45 * scale); i++) {
    const coreRad = tangleRad * 0.2;
    const numPts = 4 + Math.floor(rng() * 5);
    let cx = fx + (rng() - 0.5) * coreRad;
    let cy = fy + (rng() - 0.5) * coreRad;
    let dir = rng() * Math.PI * 2;
    const pts: Pt[] = [{ x: cx, y: cy }];
    for (let j = 1; j < numPts; j++) {
      dir += (rng() - 0.5) * Math.PI * 1.8;
      const step = 10 + rng() * 30;
      cx += Math.cos(dir) * step;
      cy += Math.sin(dir) * step;
      const dx = cx - fx, dy = cy - fy;
      if (Math.sqrt(dx * dx + dy * dy) > coreRad * 1.2) {
        cx -= dx * 0.6; cy -= dy * 0.6;
        dir = Math.atan2(fy - cy, fx - cx) + (rng() - 0.5) * 0.5;
      }
      pts.push({ x: cx, y: cy });
    }
    tangles.push({ points: pts, width: 0.4 + rng() * 3.0, opacity: 0.15 + rng() * 0.35 });
  }

  // Background arcs
  const arcs: RawArc[] = [];
  const edgePt = (e: number): Pt => {
    if (e === 0) return { x: rng() * w, y: -40 };
    if (e === 1) return { x: w + 40, y: rng() * h };
    if (e === 2) return { x: rng() * w, y: h + 40 };
    return { x: -40, y: rng() * h };
  };
  for (let i = 0; i < Math.floor(12 * scale); i++) {
    const se = Math.floor(rng() * 4);
    const ee = (se + 1 + Math.floor(rng() * 3)) % 4;
    arcs.push({
      p0: edgePt(se),
      cp: { x: fx + (rng() - 0.5) * w * 0.5, y: fy + (rng() - 0.5) * h * 0.5 },
      p1: edgePt(ee), width: 0.4 + rng() * 0.8, opacity: 0.04 + rng() * 0.1,
    });
  }

  // Accent marks — clustered near harmonic armature intersection points
  const PHI_INV = 1 / PHI; // ≈0.618
  const attractors: Pt[] = [
    // Rule of thirds
    { x: w / 3, y: h / 3 }, { x: 2 * w / 3, y: h / 3 },
    { x: w / 3, y: 2 * h / 3 }, { x: 2 * w / 3, y: 2 * h / 3 },
    // Quarter points
    { x: w / 4, y: h / 4 }, { x: 3 * w / 4, y: h / 4 },
    { x: w / 4, y: 3 * h / 4 }, { x: 3 * w / 4, y: 3 * h / 4 },
    // Phi intersections
    { x: w * PHI_INV, y: h * PHI_INV }, { x: w * (1 - PHI_INV), y: h * PHI_INV },
    { x: w * PHI_INV, y: h * (1 - PHI_INV) }, { x: w * (1 - PHI_INV), y: h * (1 - PHI_INV) },
  ];
  const accents: RawAccent[] = [];
  for (let i = 0; i < Math.floor(24 * scale); i++) {
    // Pick a random attractor and scatter within ±8% of canvas dimensions
    const att = attractors[Math.floor(rng() * attractors.length)];
    const x = att.x + (rng() - 0.5) * w * 0.16;
    const y = att.y + (rng() - 0.5) * h * 0.16;
    const angle = rng() * Math.PI * 2;
    const len = 20 + rng() * 50;
    const p0: Pt = { x, y };
    const p1: Pt = { x: x + Math.cos(angle) * len, y: y + Math.sin(angle) * len };
    const hasCurve = rng() < 0.35;
    accents.push({
      p0, p1,
      cp: hasCurve ? { x: (p0.x + p1.x) / 2 + (rng() - 0.5) * len * 0.3, y: (p0.y + p1.y) / 2 + (rng() - 0.5) * len * 0.3 } : undefined,
      width: 0.5 + rng() * 3, opacity: 0.2 + rng() * 0.4, hasDot: rng() < 0.4,
    });
  }

  // Inner scratches: short chaotic marks clustered near focal
  const scratches: RawScratch[] = [];
  for (let i = 0; i < Math.floor(80 * scale); i++) {
    const scatter = tangleRad * 2.0;
    const sx = fx + (rng() - 0.5) * scatter;
    const sy = fy + (rng() - 0.5) * scatter;
    const angle = rng() * Math.PI * 2;
    const len = 8 + rng() * 37;
    const p0: Pt = { x: sx, y: sy };
    const p1: Pt = { x: sx + Math.cos(angle) * len, y: sy + Math.sin(angle) * len };
    const hasCurve = rng() < 0.3;
    scratches.push({
      p0, p1,
      cp: hasCurve ? { x: (p0.x + p1.x) / 2 + (rng() - 0.5) * len * 0.4, y: (p0.y + p1.y) / 2 + (rng() - 0.5) * len * 0.4 } : undefined,
      width: 0.4 + rng() * 2.1,
      opacity: 0.15 + rng() * 0.4,
      hasDot: rng() < 0.2,
    });
  }

  // Through lines: edge-to-edge lines crossing near focal (4 diagonal-biased + 12 random)
  const throughs: RawThrough[] = [];
  for (let i = 0; i < Math.floor(22 * scale); i++) {
    // First 4 biased toward frame diagonals (±15°)
    const angle = i < 4
      ? diagAngles[i] + (rng() - 0.5) * 0.52 // ±15° of diagonal
      : rng() * Math.PI * 2;
    const jitter = (rng() - 0.5) * 30; // pass within 30px of focal
    const perpX = -Math.sin(angle) * jitter;
    const perpY = Math.cos(angle) * jitter;
    const ext = diag * 0.6;
    const p0: Pt = { x: fx + perpX - Math.cos(angle) * ext, y: fy + perpY - Math.sin(angle) * ext };
    const p1: Pt = { x: fx + perpX + Math.cos(angle) * ext, y: fy + perpY + Math.sin(angle) * ext };
    const hasCurve = rng() < 0.4;
    throughs.push({
      p0, p1,
      cp: hasCurve ? { x: (p0.x + p1.x) / 2 + (rng() - 0.5) * ext * 0.06, y: (p0.y + p1.y) / 2 + (rng() - 0.5) * ext * 0.06 } : undefined,
      width: 0.4 + rng() * 1.1,
      opacity: 0.05 + rng() * 0.15,
    });
  }

  // Whip lines: medium-weight tapered curves radiating from focal
  const whips: RawWhip[] = [];
  for (let i = 0; i < Math.floor(22 * scale); i++) {
    const angle = i * golden + (rng() - 0.5) * 0.6;
    const len = diag * (0.18 + rng() * 0.35);
    const off = rng() * 20;
    const p0: Pt = { x: fx + Math.cos(angle) * off, y: fy + Math.sin(angle) * off };
    const p1: Pt = { x: fx + Math.cos(angle) * len, y: fy + Math.sin(angle) * len };
    // Quadratic curve control point for gentle bend
    const cpOff = len * (0.05 + rng() * 0.12) * (rng() < 0.5 ? 1 : -1);
    const cpPt: Pt = {
      x: (p0.x + p1.x) / 2 + Math.cos(angle + Math.PI / 2) * cpOff,
      y: (p0.y + p1.y) / 2 + Math.sin(angle + Math.PI / 2) * cpOff,
    };
    // Sample 20 points along the quadratic curve
    const pts: Pt[] = [];
    for (let t = 0; t <= 1; t += 0.05) {
      const u = 1 - t;
      pts.push({
        x: u * u * p0.x + 2 * u * t * cpPt.x + t * t * p1.x,
        y: u * u * p0.y + 2 * u * t * cpPt.y + t * t * p1.y,
      });
    }
    whips.push({ points: pts, maxWidth: 2 + rng() * 4, opacity: 0.15 + rng() * 0.35 });
  }

  // Brush tangles: calligraphic chrome strokes confined to tangle area
  const brushTangles: RawBrush[] = [];
  for (let i = 0; i < Math.floor(8 * scale); i++) {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * tangleRad * 1.2;
    const origin: Pt = { x: fx + Math.cos(angle) * dist, y: fy + Math.sin(angle) * dist };
    const dir = rng() * Math.PI * 2;
    const len = diag * (0.05 + rng() * 0.07);
    const curv = (rng() - 0.5) * 1.2;
    const maxW = 3 + rng() * 9;
    const taper = rng() < 0.5 ? 0 : 2; // sharp taper or sinusoidal
    const cp = makeBrushCps(origin, dir, len, curv);
    brushTangles.push({
      cp, maxWidth: maxW, taperType: taper, opacity: 0.5 + rng() * 0.35,
      widthFn: makeWidthFn(maxW, taper), seed: rng() * 100,
    });
  }

  // Bold dark-chrome ink strokes: sleek calligraphic forms with reflective shading
  const inks: RawInk[] = [];
  for (let i = 0; i < Math.ceil(3 * scale); i++) {
    const angle = i * golden + (rng() - 0.5) * 0.4;
    const d = rng() * diag * 0.05;
    const origin: Pt = { x: fx + Math.cos(angle) * d, y: fy + Math.sin(angle) * d };
    const len = diag * (0.22 + rng() * 0.30);
    const curv = (rng() - 0.5) * 0.25;
    const maxW = 30 + rng() * 28; // 30-58px
    const variant = rng() < 0.6 ? 0 : 1;
    const cp = makeBrushCps(origin, angle, len, curv);
    inks.push({ cp, maxWidth: maxW, widthFn: makeInkWidthFn(maxW, variant), seed: rng() * 100, rgb: [0, 0, 0] });
  }

  // Thick cyan calligraphic strokes
  const thickCyans: RawInk[] = [];
  for (let i = 0; i < Math.ceil(3 * scale); i++) {
    const angle = i * golden + (rng() - 0.5) * 0.5 + Math.PI * 0.3;
    const d = rng() * diag * 0.06;
    const origin: Pt = { x: fx + Math.cos(angle) * d, y: fy + Math.sin(angle) * d };
    const len = diag * (0.18 + rng() * 0.30);
    const curv = (rng() - 0.5) * 0.35;
    const maxW = 12 + rng() * 25; // 12-37px
    const variant = rng() < 0.5 ? 0 : 1;
    const cp = makeBrushCps(origin, angle, len, curv);
    thickCyans.push({ cp, maxWidth: maxW, widthFn: makeInkWidthFn(maxW, variant), seed: rng() * 100, rgb: [0, 153, 255] });
  }

  // Parallel line bundles: groups of 5-10 lines radiating from focal region
  const bundles: RawBundle[] = [];
  for (let i = 0; i < Math.ceil(7 * scale); i++) {
    const bAngle = i * golden + (rng() - 0.5) * 0.6;
    const bDist = diag * (0.10 + rng() * 0.35);
    const bx = fx + Math.cos(bAngle) * bDist;
    const by = fy + Math.sin(bAngle) * bDist;
    const angle = bAngle + (rng() - 0.5) * 0.5;
    const count = 5 + Math.floor(rng() * 6); // 5-10 lines
    const spacing = 3 + rng() * 8; // 3-11px
    const baseLen = diag * (0.08 + rng() * 0.25);
    const lines: { p0: Pt; p1: Pt }[] = [];
    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);
    for (let j = 0; j < count; j++) {
      const offset = (j - (count - 1) / 2) * spacing;
      const lenVar = baseLen * (0.7 + rng() * 0.6); // per-line length variation
      lines.push({
        p0: { x: bx + perpX * offset, y: by + perpY * offset },
        p1: { x: bx + perpX * offset + Math.cos(angle) * lenVar, y: by + perpY * offset + Math.sin(angle) * lenVar },
      });
    }
    bundles.push({ lines, width: 0.3 + rng() * 0.7, opacity: 0.06 + rng() * 0.14 });
  }

  return { brushes, brushTangles, cyans, hairlines, tangles, whips, scratches, throughs, arcs, accents, splatter, inks, thickCyans, bundles };
}

// ─── Rendering ──────────────────────────────────────────────

function renderMain(ctx: CanvasRenderingContext2D, raw: RawScene, scrollY: number, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);

  // 1. Background arcs (tapered)
  for (const a of raw.arcs) {
    const dp0 = deform(a.p0, scrollY), dcp = deform(a.cp, scrollY), dp1 = deform(a.p1, scrollY);
    const pts = sampleQuadratic(dp0, dcp, dp1, 16);
    drawTaperingCurve(ctx, pts, a.width, a.opacity, "170,170,170", 0.15);
  }

  // 2. Through lines (tapered structural lines crossing focal)
  for (const t of raw.throughs) {
    const dp0 = deform(t.p0, scrollY), dp1 = deform(t.p1, scrollY);
    if (t.cp) {
      const dcp = deform(t.cp, scrollY);
      const pts = sampleQuadratic(dp0, dcp, dp1, 16);
      drawTaperingCurve(ctx, pts, t.width, t.opacity, "0,0,0", 0.12);
    } else {
      drawTaperingLine(ctx, dp0, dp1, t.width, t.opacity, "0,0,0", 0.12);
    }
  }

  // 3. Hairlines + parallel bundles (tapered)
  for (const l of raw.hairlines) {
    const dp0 = deform(l.p0, scrollY), dp1 = deform(l.p1, scrollY);
    drawTaperingLine(ctx, dp0, dp1, 0.5, l.opacity, l.gray ? "160,160,160" : "0,0,0");
  }
  for (const bun of raw.bundles) {
    for (const ln of bun.lines) {
      const dp0 = deform(ln.p0, scrollY), dp1 = deform(ln.p1, scrollY);
      drawTaperingLine(ctx, dp0, dp1, bun.width, bun.opacity, "0,0,0", 0.18);
    }
  }

  // 4. Inner scratches (short chaotic marks near focal)
  ctx.lineCap = "round";
  for (const s of raw.scratches) {
    const dp0 = deform(s.p0, scrollY), dp1 = deform(s.p1, scrollY);
    ctx.strokeStyle = `rgba(0,0,0,${s.opacity})`;
    ctx.lineWidth = s.width;
    ctx.beginPath(); ctx.moveTo(dp0.x, dp0.y);
    if (s.cp) { const dcp = deform(s.cp, scrollY); ctx.quadraticCurveTo(dcp.x, dcp.y, dp1.x, dp1.y); }
    else { ctx.lineTo(dp1.x, dp1.y); }
    ctx.stroke();
    if (s.hasDot) {
      ctx.fillStyle = `rgba(0,0,0,${s.opacity})`;
      ctx.beginPath(); ctx.arc(dp0.x, dp0.y, s.width * 0.7, 0, Math.PI * 2); ctx.fill();
    }
  }

  // 5. Tangle
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const c of raw.tangles) {
    const dPts = c.points.map(p => deform(p, scrollY));
    ctx.strokeStyle = `rgba(0,0,0,${c.opacity})`;
    ctx.lineWidth = c.width;
    drawSmoothPath(ctx, dPts);
  }

  // 6. Whip lines (medium-weight tapered curves)
  for (const wh of raw.whips) {
    const dPts = wh.points.map(p => deform(p, scrollY));
    drawWhipStroke(ctx, dPts, wh.maxWidth, wh.opacity);
  }

  // 7. Ink strokes (ultra-bold black calligraphic, behind chrome)
  for (const ink of raw.inks) {
    const dCp = ink.cp.map(p => deform(p, scrollY)) as [Pt, Pt, Pt, Pt];
    const samples = samplePath(dCp, 50);
    drawDarkChromeStroke(ctx, samples, ink.widthFn, ink.seed, ink.rgb);
  }

  // 8. Brush tangles (calligraphic chrome strokes at center)
  for (const bt of raw.brushTangles) {
    const dCp = bt.cp.map(p => deform(p, scrollY)) as [Pt, Pt, Pt, Pt];
    const samples = samplePath(dCp, 30);
    drawChromeStroke(ctx, samples, bt.widthFn, bt.seed);
  }

  // 9. Chrome brush strokes (hero + accent + peripheral)
  for (const b of raw.brushes) {
    const dCp = b.cp.map(p => deform(p, scrollY)) as [Pt, Pt, Pt, Pt];
    const samples = samplePath(dCp, 60);
    drawChromeStroke(ctx, samples, b.widthFn, b.seed);
  }

  // 10. Ink splatter
  for (const dot of raw.splatter) {
    const d = deform({ x: dot.x, y: dot.y }, scrollY);
    ctx.fillStyle = `rgba(0,0,0,${dot.opacity})`;
    ctx.beginPath(); ctx.arc(d.x, d.y, dot.r, 0, Math.PI * 2); ctx.fill();
  }

  // 11. Accent marks
  ctx.lineCap = "round";
  for (const a of raw.accents) {
    const dp0 = deform(a.p0, scrollY), dp1 = deform(a.p1, scrollY);
    ctx.strokeStyle = `rgba(0,0,0,${a.opacity})`;
    ctx.lineWidth = a.width;
    ctx.beginPath(); ctx.moveTo(dp0.x, dp0.y);
    if (a.cp) { const dcp = deform(a.cp, scrollY); ctx.quadraticCurveTo(dcp.x, dcp.y, dp1.x, dp1.y); }
    else { ctx.lineTo(dp1.x, dp1.y); }
    ctx.stroke();
    if (a.hasDot) {
      ctx.fillStyle = `rgba(0,0,0,${a.opacity})`;
      ctx.beginPath(); ctx.arc(dp0.x, dp0.y, a.width * 0.8, 0, Math.PI * 2); ctx.fill();
    }
  }

  // 12. Cyan beam auras (soft wide glow, gradient-faded endpoints)
  ctx.lineCap = "round";
  for (const b of raw.cyans) {
    const dp0 = deform(b.p0, scrollY), dp1 = deform(b.p1, scrollY);
    const auraGrad = ctx.createLinearGradient(dp0.x, dp0.y, dp1.x, dp1.y);
    const auraOp = b.opacity * 0.2;
    auraGrad.addColorStop(0, `rgba(0,153,255,0)`);
    auraGrad.addColorStop(0.15, `rgba(0,153,255,${auraOp})`);
    auraGrad.addColorStop(0.85, `rgba(0,153,255,${auraOp})`);
    auraGrad.addColorStop(1, `rgba(0,153,255,0)`);
    ctx.strokeStyle = auraGrad;
    ctx.lineWidth = b.width * 4;
    ctx.beginPath(); ctx.moveTo(dp0.x, dp0.y);
    if (b.cp) { const dcp = deform(b.cp, scrollY); ctx.quadraticCurveTo(dcp.x, dcp.y, dp1.x, dp1.y); }
    else { ctx.lineTo(dp1.x, dp1.y); }
    ctx.stroke();
  }

  // 13. Thick cyan calligraphic strokes
  for (const tc of raw.thickCyans) {
    const dCp = tc.cp.map(p => deform(p, scrollY)) as [Pt, Pt, Pt, Pt];
    const samples = samplePath(dCp, 40);
    drawDarkChromeStroke(ctx, samples, tc.widthFn, tc.seed, tc.rgb);
  }

  // 14. Cyan beams (sharp core, gradient-faded endpoints)
  ctx.lineCap = "round";
  for (const b of raw.cyans) {
    const dp0 = deform(b.p0, scrollY), dp1 = deform(b.p1, scrollY);
    const coreGrad = ctx.createLinearGradient(dp0.x, dp0.y, dp1.x, dp1.y);
    coreGrad.addColorStop(0, `rgba(0,153,255,0)`);
    coreGrad.addColorStop(0.15, `rgba(0,153,255,${b.opacity})`);
    coreGrad.addColorStop(0.85, `rgba(0,153,255,${b.opacity})`);
    coreGrad.addColorStop(1, `rgba(0,153,255,0)`);
    ctx.strokeStyle = coreGrad;
    ctx.lineWidth = b.width;
    ctx.beginPath(); ctx.moveTo(dp0.x, dp0.y);
    if (b.cp) { const dcp = deform(b.cp, scrollY); ctx.quadraticCurveTo(dcp.x, dcp.y, dp1.x, dp1.y); }
    else { ctx.lineTo(dp1.x, dp1.y); }
    ctx.stroke();
  }
}

function renderGlow(ctx: CanvasRenderingContext2D, raw: RawScene, scrollY: number, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = "round";
  for (const b of raw.cyans) {
    const dp0 = deform(b.p0, scrollY), dp1 = deform(b.p1, scrollY);
    const glowGrad = ctx.createLinearGradient(dp0.x, dp0.y, dp1.x, dp1.y);
    glowGrad.addColorStop(0, `rgba(0,153,255,0)`);
    glowGrad.addColorStop(0.15, `rgba(0,153,255,${b.opacity})`);
    glowGrad.addColorStop(0.85, `rgba(0,153,255,${b.opacity})`);
    glowGrad.addColorStop(1, `rgba(0,153,255,0)`);
    ctx.strokeStyle = glowGrad;
    ctx.lineWidth = b.width;
    ctx.beginPath(); ctx.moveTo(dp0.x, dp0.y);
    if (b.cp) { const dcp = deform(b.cp, scrollY); ctx.quadraticCurveTo(dcp.x, dcp.y, dp1.x, dp1.y); }
    else { ctx.lineTo(dp1.x, dp1.y); }
    ctx.stroke();
  }
  // Thick cyan strokes on glow canvas for blur halo
  for (const tc of raw.thickCyans) {
    const dCp = tc.cp.map(p => deform(p, scrollY)) as [Pt, Pt, Pt, Pt];
    const samples = samplePath(dCp, 40);
    drawDarkChromeStroke(ctx, samples, tc.widthFn, tc.seed, tc.rgb);
  }
}

// ─── Component ──────────────────────────────────────────────

const LineCanvas = memo(function LineCanvas() {
  const mainRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rawRef = useRef<RawScene | null>(null);
  const dimsRef = useRef({ w: 0, h: 0, vh: 0, dpr: 1 });
  const lastScrollRef = useRef(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const deviceTier = useStore((s) => s.deviceTier);
  const seed = useStore((s) => s.seed);

  // Render scene with scroll deformation (reads from refs, no React re-renders)
  const renderAll = useCallback((scrollY: number) => {
    const raw = rawRef.current;
    const dims = dimsRef.current;
    if (!raw) return;
    const main = mainRef.current;
    const glow = glowRef.current;
    if (!main || !glow) return;

    const mCtx = main.getContext("2d")!;
    mCtx.setTransform(dims.dpr, 0, 0, dims.dpr, 0, 0);
    renderMain(mCtx, raw, scrollY, dims.w, dims.h);

    const gCtx = glow.getContext("2d")!;
    gCtx.setTransform(dims.dpr, 0, 0, dims.dpr, 0, 0);
    renderGlow(gCtx, raw, scrollY, dims.w, dims.h);
  }, []);

  // Generate raw scene data + initial render
  const setup = useCallback(() => {
    const main = mainRef.current;
    const glow = glowRef.current;
    const container = containerRef.current;
    if (!main || !glow || !container) return;

    const dpr = deviceTier === "mobile" ? 1 : Math.min(window.devicePixelRatio, 2);
    // CSS zoom on <html> shrinks rendered canvas but window.innerWidth
    // returns the physical viewport width — divide by zoom so the canvas
    // CSS size fills the full visible viewport after zoom scaling.
    const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    const w = Math.round(window.innerWidth / zoom);
    const vh = Math.round(window.innerHeight / zoom);
    const overflowPx = Math.round(vh * OVERFLOW);
    const canvasH = vh + overflowPx * 2;

    for (const c of [main, glow]) {
      c.width = w * dpr;
      c.height = canvasH * dpr;
      c.style.width = `${w}px`;
      c.style.height = `${canvasH}px`;
    }
    container.style.top = `-${overflowPx}px`;
    container.style.height = `${canvasH}px`;

    const fx = FOCAL_X * w;
    const fy = FOCAL_Y * vh + overflowPx;
    const rng = mulberry32(seed);
    const scale = deviceTier === "mobile" ? 0.35 : deviceTier === "tablet" ? 0.55 : 1;

    rawRef.current = generateRawScene(fx, fy, w, canvasH, scale, rng);
    dimsRef.current = { w, h: canvasH, vh, dpr };

    renderAll(window.scrollY);
  }, [deviceTier, seed, renderAll]);

  // Mount + debounced resize
  useEffect(() => {
    setup();
    const onResize = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(setup, 200);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [setup]);

  // Scroll: CSS parallax + canvas deformation redraw
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let ticking = false;

    const update = () => {
      const scrollY = window.scrollY;
      // Clamped CSS parallax
      const maxShift = dimsRef.current.vh * OVERFLOW;
      el.style.transform = `translateY(${-Math.min(maxShift, scrollY * PARALLAX)}px)`;
      // Redraw with deformation when scrolled enough
      if (Math.abs(scrollY - lastScrollRef.current) > 4) {
        lastScrollRef.current = scrollY;
        renderAll(scrollY);
      }
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [renderAll]);

  return (
    <div
      ref={containerRef}
      className="fixed left-0 right-0 pointer-events-none will-change-transform"
      style={{ zIndex: 1 }}
      aria-hidden="true"
    >
      <canvas ref={glowRef} className="absolute top-0 left-0" style={{ filter: "blur(20px)", opacity: 0.70 }} />
      <canvas ref={mainRef} className="absolute top-0 left-0" />
    </div>
  );
});

export default LineCanvas;
