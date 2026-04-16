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

// ─── Brush Stroke Texture Loading ───────────────────────────

let _strokeTextures: HTMLImageElement[] = [];
let _strokeTexturesLoaded = false;

function loadStrokeTextures(): Promise<void> {
  if (_strokeTexturesLoaded) return Promise.resolve();
  const paths = [
    "/assets/textures/brush/stroke.png",
    "/assets/textures/brush/stroke2.png",
  ];
  return new Promise((resolve) => {
    let loaded = 0;
    _strokeTextures = paths.map((src) => {
      const img = new Image();
      img.onload = img.onerror = () => { if (++loaded >= paths.length) { _strokeTexturesLoaded = true; resolve(); } };
      img.src = src;
      return img;
    });
  });
}

function getStrokeTexture(seed: number): HTMLImageElement | null {
  if (!_strokeTexturesLoaded || _strokeTextures.length === 0) return null;
  const idx = Math.floor(Math.abs(seed * 7.3) % _strokeTextures.length);
  const img = _strokeTextures[idx];
  return (img.complete && img.naturalWidth > 0) ? img : null;
}

// ─── Mesh-Warp Texture Mapping Along Curve ──────────────────
//
// Maps a full-length brush stroke texture along a bezier curve by
// subdividing both the texture and curve into thin vertical slices.
// Each slice is drawn as a transformed quad that follows the curve's
// position, tangent direction, and width at that point.
//
// This makes the texture's bristle marks follow the stroke direction
// because the texture is physically deformed to match the curve.

/**
 * Maps a brush stroke texture along a bezier curve using affine-
 * transformed triangle strips. For each pair of adjacent sample
 * points, a quad is formed (top-left, top-right, bottom-right,
 * bottom-left) and split into two triangles. Each triangle is drawn
 * by computing the affine transform that maps the source texture
 * triangle to the destination canvas triangle, then clipping and
 * drawing. This produces smooth, continuous texture deformation
 * that follows the curve — the bristle marks in the texture flow
 * along the stroke direction naturally.
 */
function drawTexturedStroke(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  widthFn: (t: number) => number,
  seed: number,
  opacity = 1.0,
) {
  const tex = getStrokeTexture(seed);
  if (!tex) return;

  const N = pts.length;
  if (N < 2) return;

  // Precompute normals
  const norms: Pt[] = [];
  for (let i = 0; i < N; i++) {
    let tx: number, ty: number;
    if (i === 0) { tx = pts[1].x - pts[0].x; ty = pts[1].y - pts[0].y; }
    else if (i === N - 1) { tx = pts[N - 1].x - pts[N - 2].x; ty = pts[N - 1].y - pts[N - 2].y; }
    else { tx = pts[i + 1].x - pts[i - 1].x; ty = pts[i + 1].y - pts[i - 1].y; }
    const len = Math.sqrt(tx * tx + ty * ty) || 1;
    norms.push({ x: -ty / len, y: tx / len });
  }

  const texW = tex.naturalWidth;
  const texH = tex.naturalHeight;

  // Use every sample point for maximum smoothness along the curve.
  // Pre-build the top and bottom edge vertices of the stroke ribbon.
  const top: Pt[] = [];
  const bot: Pt[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const hw = widthFn(t) / 2;
    top.push({ x: pts[i].x + norms[i].x * hw, y: pts[i].y + norms[i].y * hw });
    bot.push({ x: pts[i].x - norms[i].x * hw, y: pts[i].y - norms[i].y * hw });
  }

  ctx.save();
  ctx.globalAlpha = opacity;

  // Draw texture-mapped triangle strip.
  // For each pair of adjacent points (i, i+1), we have a quad:
  //   top[i] ---- top[i+1]
  //     |            |
  //   bot[i] ---- bot[i+1]
  //
  // Split into two triangles and affine-map the corresponding
  // texture region into each triangle.

  for (let i = 0; i < N - 1; i++) {
    const t0 = i / (N - 1);
    const t1 = (i + 1) / (N - 1);

    // Source texture coordinates (x along texture, y is 0=top, texH=bottom)
    const su0 = t0 * texW;
    const su1 = t1 * texW;

    // Destination quad corners
    const dTL = top[i];
    const dTR = top[i + 1];
    const dBL = bot[i];
    const dBR = bot[i + 1];

    // Skip degenerate quads
    const hw0 = widthFn(t0) / 2;
    const hw1 = widthFn(t1) / 2;
    if (hw0 < 0.2 && hw1 < 0.2) continue;

    // Triangle 1: TL, TR, BL
    // Source: (su0, 0), (su1, 0), (su0, texH)
    // Dest:   dTL,       dTR,      dBL
    drawTexturedTriangle(ctx, tex,
      su0, 0,    su1, 0,    su0, texH,
      dTL.x, dTL.y,  dTR.x, dTR.y,  dBL.x, dBL.y,
    );

    // Triangle 2: TR, BR, BL
    // Source: (su1, 0), (su1, texH), (su0, texH)
    // Dest:   dTR,       dBR,         dBL
    drawTexturedTriangle(ctx, tex,
      su1, 0,    su1, texH,    su0, texH,
      dTR.x, dTR.y,  dBR.x, dBR.y,  dBL.x, dBL.y,
    );
  }

  ctx.restore();
}

/**
 * Draws a single affine-textured triangle.
 * Maps source triangle (s0,s1,s2) in the texture image to
 * destination triangle (d0,d1,d2) on the canvas.
 *
 * Uses ctx.transform() (not setTransform) so it composes with
 * the existing DPR scaling transform on the canvas.
 */
function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  // Source triangle (texture coordinates)
  sx0: number, sy0: number,
  sx1: number, sy1: number,
  sx2: number, sy2: number,
  // Destination triangle (canvas coordinates)
  dx0: number, dy0: number,
  dx1: number, dy1: number,
  dx2: number, dy2: number,
) {
  ctx.save();

  // Clip to the destination triangle
  ctx.beginPath();
  ctx.moveTo(dx0, dy0);
  ctx.lineTo(dx1, dy1);
  ctx.lineTo(dx2, dy2);
  ctx.closePath();
  ctx.clip();

  // Compute the affine transform that maps:
  //   (sx0, sy0) -> (dx0, dy0)
  //   (sx1, sy1) -> (dx1, dy1)
  //   (sx2, sy2) -> (dx2, dy2)
  //
  // The transform is: [a b c d e f] where
  //   destX = a * srcX + c * srcY + e
  //   destY = b * srcX + d * srcY + f

  const det = (sx0 - sx2) * (sy1 - sy2) - (sx1 - sx2) * (sy0 - sy2);
  if (Math.abs(det) < 0.001) { ctx.restore(); return; }
  const invDet = 1 / det;

  const a = ((dx0 - dx2) * (sy1 - sy2) - (dx1 - dx2) * (sy0 - sy2)) * invDet;
  const b = ((dy0 - dy2) * (sy1 - sy2) - (dy1 - dy2) * (sy0 - sy2)) * invDet;
  const c = ((dx1 - dx2) * (sx0 - sx2) - (dx0 - dx2) * (sx1 - sx2)) * invDet;
  const d = ((dy1 - dy2) * (sx0 - sx2) - (dy0 - dy2) * (sx1 - sx2)) * invDet;
  const e = dx0 - a * sx0 - c * sy0;
  const f = dy0 - b * sx0 - d * sy0;

  // Use transform() which composes with the current DPR transform,
  // NOT setTransform() which would replace it.
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

// ─── Chrome Stroke Renderer (Paint Brush) ───────────────────

/**
 * Draws a paint brush stroke by mesh-warping a real brush stroke
 * texture image along the bezier curve path. The texture's bristle
 * marks follow the stroke direction because the texture is physically
 * deformed to match the curve. Falls back to original chrome rendering
 * if textures haven't loaded yet.
 */
function drawChromeStroke(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  widthFn: (t: number) => number,
  seed: number,
) {
  // Always render the fallback polygon first for base visibility
  drawChromeStrokeFallback(ctx, pts, widthFn, seed);

  // Then overlay the texture if available
  const tex = getStrokeTexture(seed);
  if (tex) {
    drawTexturedStroke(ctx, pts, widthFn, seed, 1.0);
  }
}

/** Original chrome renderer used as fallback before textures load. */
function drawChromeStrokeFallback(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  widthFn: (t: number) => number,
  seed: number,
) {
  const N = pts.length;
  if (N < 2) return;

  const norms: Pt[] = [];
  for (let i = 0; i < N; i++) {
    let tx: number, ty: number;
    if (i === 0) { tx = pts[1].x - pts[0].x; ty = pts[1].y - pts[0].y; }
    else if (i === N - 1) { tx = pts[N - 1].x - pts[N - 2].x; ty = pts[N - 1].y - pts[N - 2].y; }
    else { tx = pts[i + 1].x - pts[i - 1].x; ty = pts[i + 1].y - pts[i - 1].y; }
    const len = Math.sqrt(tx * tx + ty * ty) || 1;
    norms.push({ x: -ty / len, y: tx / len });
  }

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
  };

  let maxW = 0;
  for (let i = 0; i < N; i++) {
    const w = widthFn(i / (N - 1));
    if (w > maxW) maxW = w;
  }

  fillPoly(1.0, "rgba(5,7,14,0.9)");
}

// ─── Dark Chrome Stroke Renderer (Paint Brush) ──────────────

/**
 * Draws a bold calligraphic paint brush stroke using mesh-warped texture.
 * For cyan strokes: falls back to original rendering (texture is black only).
 */
function drawDarkChromeStroke(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  widthFn: (t: number) => number,
  seed: number,
  rgb: [number, number, number] = [0, 0, 0],
) {
  const isCyan = rgb[2] > 200;

  // Always draw base polygon first for guaranteed visibility
  const N = pts.length;
  if (N < 2) return;

  const norms: Pt[] = [];
  for (let i = 0; i < N; i++) {
    let tx: number, ty: number;
    if (i === 0) { tx = pts[1].x - pts[0].x; ty = pts[1].y - pts[0].y; }
    else if (i === N - 1) { tx = pts[N - 1].x - pts[N - 2].x; ty = pts[N - 1].y - pts[N - 2].y; }
    else { tx = pts[i + 1].x - pts[i - 1].x; ty = pts[i + 1].y - pts[i - 1].y; }
    const len = Math.sqrt(tx * tx + ty * ty) || 1;
    norms.push({ x: -ty / len, y: tx / len });
  }

  const fillPoly = (frac: number, fill: string) => {
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
  };

  if (isCyan) {
    fillPoly(1.0, "rgba(0,80,140,0.85)");
  } else {
    fillPoly(1.0, "rgba(5,7,14,0.92)");
  }

  // Overlay brush texture on black strokes if available
  if (!isCyan && getStrokeTexture(seed)) {
    drawTexturedStroke(ctx, pts, widthFn, seed, 0.9);
  }
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

  const localSeed = maxWidth * 73.1 + opacity * 137.3 + pts[0].x * 0.01;
  const widthFn = (t: number) => maxWidth * Math.sin(t * Math.PI);

  // Always draw base polygon first
  const norms: Pt[] = [];
  for (let i = 0; i < N; i++) {
    let tx: number, ty: number;
    if (i === 0) { tx = pts[1].x - pts[0].x; ty = pts[1].y - pts[0].y; }
    else if (i === N - 1) { tx = pts[N - 1].x - pts[N - 2].x; ty = pts[N - 1].y - pts[N - 2].y; }
    else { tx = pts[i + 1].x - pts[i - 1].x; ty = pts[i + 1].y - pts[i - 1].y; }
    const len = Math.sqrt(tx * tx + ty * ty) || 1;
    norms.push({ x: -ty / len, y: tx / len });
  }

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

  // Overlay brush texture on wider whips
  if (maxWidth > 4 && getStrokeTexture(localSeed)) {
    drawTexturedStroke(ctx, pts, widthFn, localSeed, opacity * 0.7);
  }
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

    // Load brush stroke textures; re-render when ready
    loadStrokeTextures().then(() => {
      if (rawRef.current && dimsRef.current) renderAll(window.scrollY);
    });

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
