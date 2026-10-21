// Canvas 2D fallback renderer — mobile / tablet / no-WebGL / reduced-motion.
// Same RawScene as the GL path, drawn with the original tapered-polygon and
// textured-brush techniques. Not the primary path any more: see sceneGL.ts.

import type { Pt, RawScene, WidthFn } from "./scene";
import { deform, samplePath, sampleQuadratic } from "./scene";
import { withBase } from "@/lib/basePath";

// ─── Brush stroke textures ──────────────────────────────────

let _strokeTextures: HTMLImageElement[] = [];
let _strokeTexturesLoaded = false;

export function loadStrokeTextures(): Promise<void> {
  if (_strokeTexturesLoaded) return Promise.resolve();
  const paths = ["/assets/textures/brush/stroke.webp", "/assets/textures/brush/stroke2.webp"].map(withBase);
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
  return img.complete && img.naturalWidth > 0 ? img : null;
}

function normals(pts: Pt[]): Pt[] {
  const N = pts.length;
  const out: Pt[] = [];
  for (let i = 0; i < N; i++) {
    let tx: number, ty: number;
    if (i === 0) { tx = pts[1].x - pts[0].x; ty = pts[1].y - pts[0].y; }
    else if (i === N - 1) { tx = pts[N - 1].x - pts[N - 2].x; ty = pts[N - 1].y - pts[N - 2].y; }
    else { tx = pts[i + 1].x - pts[i - 1].x; ty = pts[i + 1].y - pts[i - 1].y; }
    const len = Math.sqrt(tx * tx + ty * ty) || 1;
    out.push({ x: -ty / len, y: tx / len });
  }
  return out;
}

// Maps a brush-stroke texture along a curve as an affine-warped triangle strip.
function drawTexturedStroke(ctx: CanvasRenderingContext2D, pts: Pt[], widthFn: WidthFn, seed: number, opacity = 1) {
  const tex = getStrokeTexture(seed);
  if (!tex) return;
  const N = pts.length;
  if (N < 2) return;
  const norms = normals(pts);
  const texW = tex.naturalWidth, texH = tex.naturalHeight;
  const top: Pt[] = [], bot: Pt[] = [];
  for (let i = 0; i < N; i++) {
    const hw = widthFn(i / (N - 1)) / 2;
    top.push({ x: pts[i].x + norms[i].x * hw, y: pts[i].y + norms[i].y * hw });
    bot.push({ x: pts[i].x - norms[i].x * hw, y: pts[i].y - norms[i].y * hw });
  }
  ctx.save();
  ctx.globalAlpha = opacity;
  for (let i = 0; i < N - 1; i++) {
    const t0 = i / (N - 1), t1 = (i + 1) / (N - 1);
    const su0 = t0 * texW, su1 = t1 * texW;
    if (widthFn(t0) / 2 < 0.2 && widthFn(t1) / 2 < 0.2) continue;
    drawTexturedTriangle(ctx, tex, su0, 0, su1, 0, su0, texH, top[i].x, top[i].y, top[i + 1].x, top[i + 1].y, bot[i].x, bot[i].y);
    drawTexturedTriangle(ctx, tex, su1, 0, su1, texH, su0, texH, top[i + 1].x, top[i + 1].y, bot[i + 1].x, bot[i + 1].y, bot[i].x, bot[i].y);
  }
  ctx.restore();
}

function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement,
  sx0: number, sy0: number, sx1: number, sy1: number, sx2: number, sy2: number,
  dx0: number, dy0: number, dx1: number, dy1: number, dx2: number, dy2: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(dx0, dy0); ctx.lineTo(dx1, dy1); ctx.lineTo(dx2, dy2);
  ctx.closePath();
  ctx.clip();
  const det = (sx0 - sx2) * (sy1 - sy2) - (sx1 - sx2) * (sy0 - sy2);
  if (Math.abs(det) < 0.001) { ctx.restore(); return; }
  const invDet = 1 / det;
  const a = ((dx0 - dx2) * (sy1 - sy2) - (dx1 - dx2) * (sy0 - sy2)) * invDet;
  const b = ((dy0 - dy2) * (sy1 - sy2) - (dy1 - dy2) * (sy0 - sy2)) * invDet;
  const c = ((dx1 - dx2) * (sx0 - sx2) - (dx0 - dx2) * (sx1 - sx2)) * invDet;
  const d = ((dy1 - dy2) * (sx0 - sx2) - (dy0 - dy2) * (sx1 - sx2)) * invDet;
  const e = dx0 - a * sx0 - c * sy0;
  const f = dy0 - b * sx0 - d * sy0;
  // transform() composes with the DPR transform; setTransform would replace it.
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

function fillRibbon(ctx: CanvasRenderingContext2D, pts: Pt[], widthFn: WidthFn, fill: string) {
  const N = pts.length;
  if (N < 2) return;
  const norms = normals(pts);
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const hw = widthFn(i / (N - 1)) / 2;
    const x = pts[i].x + norms[i].x * hw, y = pts[i].y + norms[i].y * hw;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  for (let i = N - 1; i >= 0; i--) {
    const hw = widthFn(i / (N - 1)) / 2;
    ctx.lineTo(pts[i].x - norms[i].x * hw, pts[i].y - norms[i].y * hw);
  }
  ctx.closePath();
  ctx.fill();
}

function drawChromeStroke(ctx: CanvasRenderingContext2D, pts: Pt[], widthFn: WidthFn, seed: number) {
  fillRibbon(ctx, pts, widthFn, "rgba(5,7,14,0.9)");
  if (getStrokeTexture(seed)) drawTexturedStroke(ctx, pts, widthFn, seed, 1.0);
}

function drawDarkChromeStroke(ctx: CanvasRenderingContext2D, pts: Pt[], widthFn: WidthFn, seed: number, rgb: [number, number, number] = [0, 0, 0]) {
  const isCyan = rgb[2] > 200;
  fillRibbon(ctx, pts, widthFn, isCyan ? "rgba(0,80,140,0.85)" : "rgba(5,7,14,0.92)");
  if (!isCyan && getStrokeTexture(seed)) drawTexturedStroke(ctx, pts, widthFn, seed, 0.9);
}

// ─── Tapering line renderers ────────────────────────────────

function drawTaperingLine(ctx: CanvasRenderingContext2D, p0: Pt, p1: Pt, width: number, opacity: number, color: string, taperFrac = 0.15) {
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  const nx = -dy / len, ny = dx / len;
  const grad = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
  grad.addColorStop(0, `rgba(${color},0)`);
  grad.addColorStop(Math.min(taperFrac, 0.49), `rgba(${color},${opacity})`);
  grad.addColorStop(Math.max(1 - taperFrac, 0.51), `rgba(${color},${opacity})`);
  grad.addColorStop(1, `rgba(${color},0)`);
  const S = 10;
  const wScale = (t: number) => (t < taperFrac ? t / taperFrac : t > 1 - taperFrac ? (1 - t) / taperFrac : 1);
  ctx.fillStyle = grad;
  ctx.beginPath();
  for (let i = 0; i <= S; i++) {
    const t = i / S, hw = width * wScale(t) * 0.5;
    const x = p0.x + dx * t + nx * hw, y = p0.y + dy * t + ny * hw;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  for (let i = S; i >= 0; i--) {
    const t = i / S, hw = width * wScale(t) * 0.5;
    ctx.lineTo(p0.x + dx * t - nx * hw, p0.y + dy * t - ny * hw);
  }
  ctx.closePath();
  ctx.fill();
}

function drawTaperingCurve(ctx: CanvasRenderingContext2D, pts: Pt[], width: number, opacity: number, color: string, taperFrac = 0.15) {
  const N = pts.length;
  if (N < 2) return;
  const norms = normals(pts);
  const grad = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[N - 1].x, pts[N - 1].y);
  grad.addColorStop(0, `rgba(${color},0)`);
  grad.addColorStop(Math.min(taperFrac, 0.49), `rgba(${color},${opacity})`);
  grad.addColorStop(Math.max(1 - taperFrac, 0.51), `rgba(${color},${opacity})`);
  grad.addColorStop(1, `rgba(${color},0)`);
  const wScale = (t: number) => (t < taperFrac ? t / taperFrac : t > 1 - taperFrac ? (1 - t) / taperFrac : 1);
  ctx.fillStyle = grad;
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), hw = width * wScale(t) * 0.5;
    const x = pts[i].x + norms[i].x * hw, y = pts[i].y + norms[i].y * hw;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  for (let i = N - 1; i >= 0; i--) {
    const t = i / (N - 1), hw = width * wScale(t) * 0.5;
    ctx.lineTo(pts[i].x - norms[i].x * hw, pts[i].y - norms[i].y * hw);
  }
  ctx.closePath();
  ctx.fill();
}

function drawSmoothPath(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 2) {
    ctx.lineTo(pts[1].x, pts[1].y);
  } else {
    for (let i = 1; i < pts.length - 1; i++) {
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  }
  ctx.stroke();
}

function drawWhipStroke(ctx: CanvasRenderingContext2D, pts: Pt[], maxWidth: number, opacity: number) {
  const widthFn = (t: number) => maxWidth * Math.sin(t * Math.PI);
  fillRibbon(ctx, pts, widthFn, `rgba(0,0,0,${opacity})`);
  const localSeed = maxWidth * 73.1 + opacity * 137.3 + pts[0].x * 0.01;
  if (maxWidth > 4 && getStrokeTexture(localSeed)) drawTexturedStroke(ctx, pts, widthFn, localSeed, opacity * 0.7);
}

// ─── Density gating ─────────────────────────────────────────

function gate<T>(arr: T[], density: number, exponent: number): T[] {
  const d = Math.min(1, Math.max(0, Math.pow(density, exponent)));
  if (d >= 1) return arr;
  return arr.slice(0, Math.round(arr.length * d));
}

const dpts = (pts: Pt[], scrollY: number) => pts.map((p) => deform(p, scrollY));

// ─── Frame renderers ────────────────────────────────────────

export function renderMain2D(ctx: CanvasRenderingContext2D, raw: RawScene, scrollY: number, w: number, h: number, density = 1) {
  ctx.clearRect(0, 0, w, h);
  ctx.globalAlpha = density < 0.12 ? Math.max(0.08, density / 0.12) : 1;
  const R = raw.focalRadius;

  for (const a of gate(raw.arcs, density, 1.0)) {
    const pts = sampleQuadratic(deform(a.p0, scrollY), deform(a.cp, scrollY), deform(a.p1, scrollY), 16);
    drawTaperingCurve(ctx, pts, a.width, a.opacity, "170,170,170", 0.15);
  }
  for (const t of gate(raw.throughs, density, 1.0)) {
    const dp0 = deform(t.p0, scrollY), dp1 = deform(t.p1, scrollY);
    if (t.cp) drawTaperingCurve(ctx, sampleQuadratic(dp0, deform(t.cp, scrollY), dp1, 16), t.width, t.opacity, "0,0,0", 0.12);
    else drawTaperingLine(ctx, dp0, dp1, t.width, t.opacity, "0,0,0", 0.12);
  }
  for (const l of gate(raw.hairlines, density, 1.4)) {
    drawTaperingLine(ctx, deform(l.p0, scrollY), deform(l.p1, scrollY), 0.5, l.opacity, l.gray ? "160,160,160" : "0,0,0");
  }
  for (const bun of gate(raw.bundles, density, 1.2)) {
    for (const ln of bun.lines) drawTaperingLine(ctx, deform(ln.p0, scrollY), deform(ln.p1, scrollY), bun.width, bun.opacity, "0,0,0", 0.18);
  }

  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const s of gate(raw.scratches, density, 1.6)) {
    const dp0 = deform(s.p0, scrollY), dp1 = deform(s.p1, scrollY);
    ctx.strokeStyle = `rgba(0,0,0,${s.opacity})`;
    ctx.lineWidth = s.width;
    ctx.beginPath(); ctx.moveTo(dp0.x, dp0.y);
    if (s.cp) { const dcp = deform(s.cp, scrollY); ctx.quadraticCurveTo(dcp.x, dcp.y, dp1.x, dp1.y); } else ctx.lineTo(dp1.x, dp1.y);
    ctx.stroke();
    if (s.hasDot) { ctx.fillStyle = `rgba(0,0,0,${s.opacity})`; ctx.beginPath(); ctx.arc(dp0.x, dp0.y, s.width * 0.7, 0, Math.PI * 2); ctx.fill(); }
  }

  // The nucleus: wires, bolts, fibres, then clots and calligraphic swipes.
  for (const w of gate(raw.wires, density, 1.2)) {
    ctx.strokeStyle = `rgba(0,0,0,${w.opacity})`;
    ctx.lineWidth = w.width;
    drawSmoothPath(ctx, dpts(w.points, scrollY));
  }
  const polyline = (pts: Pt[]) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
  };
  for (const b of gate(raw.bolts, density, 1.1)) {
    ctx.strokeStyle = `rgba(0,0,0,${b.opacity})`;
    ctx.lineWidth = b.width;
    polyline(dpts(b.points, scrollY));
  }
  for (const fb of gate(raw.fibers, density, 1.2)) {
    ctx.strokeStyle = `rgba(0,0,0,${fb.opacity})`;
    ctx.lineWidth = fb.width;
    for (const s of fb.strands) polyline(dpts(s, scrollY));
  }
  for (const b of gate(raw.blots, density, 1.0)) {
    const d = deform({ x: b.x, y: b.y }, scrollY);
    ctx.fillStyle = `rgba(0,0,0,${b.opacity})`;
    ctx.beginPath(); ctx.arc(d.x, d.y, b.r, 0, Math.PI * 2); ctx.fill();
  }
  for (const s of gate(raw.swipes, density, 0.85)) {
    fillRibbon(ctx, samplePath(s.cp.map((p) => deform(p, scrollY)) as [Pt, Pt, Pt, Pt], 40), s.widthFn, `rgba(5,7,14,${s.opacity})`);
  }

  for (const wh of gate(raw.whips, density, 1.0)) drawWhipStroke(ctx, dpts(wh.points, scrollY), wh.maxWidth, wh.opacity);

  for (const ink of gate(raw.inks, density, 0.8)) {
    drawDarkChromeStroke(ctx, samplePath(ink.cp.map((p) => deform(p, scrollY)) as [Pt, Pt, Pt, Pt], 50), ink.widthFn, ink.seed, ink.rgb);
  }
  for (const bt of gate(raw.brushTangles, density, 1.5)) {
    drawChromeStroke(ctx, samplePath(bt.cp.map((p) => deform(p, scrollY)) as [Pt, Pt, Pt, Pt], 30), bt.widthFn, bt.seed);
  }
  for (const b of gate(raw.brushes, density, 0.7)) {
    drawChromeStroke(ctx, samplePath(b.cp.map((p) => deform(p, scrollY)) as [Pt, Pt, Pt, Pt], 60), b.widthFn, b.seed);
  }
  // Cables and contour scribbles: black contour under a white tube
  const tube = (pts: Pt[], hw: (t: number) => number, opacity: number) => {
    fillRibbon(ctx, pts, (t) => hw(t) * 2 + 2.4, `rgba(0,0,0,${opacity})`);
    fillRibbon(ctx, pts, (t) => hw(t) * 2, "rgba(244,246,249,0.96)");
  };
  const cap = (t: number) => Math.min(1, t / 0.06, (1 - t) / 0.06);
  for (const c of gate(raw.cables, density, 0.9)) tube(dpts(c.points, scrollY), (t) => (c.width * cap(t)) / 2, c.opacity);
  for (const s of gate(raw.scribbles, density, 1.1)) tube(dpts(s.points, scrollY), () => s.width / 2, 0.9);
  // White burnout glints over the black
  for (const s of gate(raw.streaks, density, 1.2)) {
    fillRibbon(ctx, dpts(s.points, scrollY), (t) => s.width * Math.sin(Math.min(1, t * 1.15) * Math.PI), `rgba(255,255,255,${s.opacity})`);
  }

  for (const dot of gate(raw.splatter, density, 1.5)) {
    const d = deform({ x: dot.x, y: dot.y }, scrollY);
    ctx.fillStyle = `rgba(0,0,0,${dot.opacity})`;
    ctx.beginPath(); ctx.arc(d.x, d.y, dot.r, 0, Math.PI * 2); ctx.fill();
  }

  ctx.lineCap = "round";
  for (const a of gate(raw.accents, density, 1.4)) {
    const dp0 = deform(a.p0, scrollY), dp1 = deform(a.p1, scrollY);
    ctx.strokeStyle = `rgba(0,0,0,${a.opacity})`;
    ctx.lineWidth = a.width;
    ctx.beginPath(); ctx.moveTo(dp0.x, dp0.y);
    if (a.cp) { const dcp = deform(a.cp, scrollY); ctx.quadraticCurveTo(dcp.x, dcp.y, dp1.x, dp1.y); } else ctx.lineTo(dp1.x, dp1.y);
    ctx.stroke();
    if (a.hasDot) { ctx.fillStyle = `rgba(0,0,0,${a.opacity})`; ctx.beginPath(); ctx.arc(dp0.x, dp0.y, a.width * 0.8, 0, Math.PI * 2); ctx.fill(); }
  }

  const beam = (b: RawScene["cyans"][number], widthMul: number, opMul: number) => {
    const dp0 = deform(b.p0, scrollY), dp1 = deform(b.p1, scrollY);
    const g = ctx.createLinearGradient(dp0.x, dp0.y, dp1.x, dp1.y);
    const op = b.opacity * opMul;
    g.addColorStop(0, "rgba(0,153,255,0)");
    g.addColorStop(0.15, `rgba(0,153,255,${op})`);
    g.addColorStop(0.85, `rgba(0,153,255,${op})`);
    g.addColorStop(1, "rgba(0,153,255,0)");
    ctx.strokeStyle = g;
    ctx.lineWidth = b.width * widthMul;
    ctx.beginPath(); ctx.moveTo(dp0.x, dp0.y);
    if (b.cp) { const dcp = deform(b.cp, scrollY); ctx.quadraticCurveTo(dcp.x, dcp.y, dp1.x, dp1.y); } else ctx.lineTo(dp1.x, dp1.y);
    ctx.stroke();
  };
  const beams = gate(raw.cyans, density, 1.1);
  for (const b of beams) beam(b, 4, 0.2);
  for (const tc of gate(raw.thickCyans, density, 1.0)) {
    drawDarkChromeStroke(ctx, samplePath(tc.cp.map((p) => deform(p, scrollY)) as [Pt, Pt, Pt, Pt], 40), tc.widthFn, tc.seed, tc.rgb);
  }
  for (const b of beams) beam(b, 1, 1);
}

export function renderGlow2D(ctx: CanvasRenderingContext2D, raw: RawScene, scrollY: number, w: number, h: number, density = 1) {
  ctx.clearRect(0, 0, w, h);
  ctx.globalAlpha = density < 0.12 ? Math.max(0.08, density / 0.12) : 1;
  ctx.lineCap = "round";
  for (const b of gate(raw.cyans, density, 1.1)) {
    const dp0 = deform(b.p0, scrollY), dp1 = deform(b.p1, scrollY);
    const g = ctx.createLinearGradient(dp0.x, dp0.y, dp1.x, dp1.y);
    g.addColorStop(0, "rgba(0,153,255,0)");
    g.addColorStop(0.15, `rgba(0,153,255,${b.opacity})`);
    g.addColorStop(0.85, `rgba(0,153,255,${b.opacity})`);
    g.addColorStop(1, "rgba(0,153,255,0)");
    ctx.strokeStyle = g;
    ctx.lineWidth = b.width;
    ctx.beginPath(); ctx.moveTo(dp0.x, dp0.y);
    if (b.cp) { const dcp = deform(b.cp, scrollY); ctx.quadraticCurveTo(dcp.x, dcp.y, dp1.x, dp1.y); } else ctx.lineTo(dp1.x, dp1.y);
    ctx.stroke();
  }
  for (const tc of gate(raw.thickCyans, density, 1.0)) {
    drawDarkChromeStroke(ctx, samplePath(tc.cp.map((p) => deform(p, scrollY)) as [Pt, Pt, Pt, Pt], 40), tc.widthFn, tc.seed, tc.rgb);
  }
}
