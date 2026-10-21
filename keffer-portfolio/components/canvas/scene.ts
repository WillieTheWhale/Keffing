// Line-scene description + generator. Pure data: no canvas, no WebGL.
// Consumed by sceneGL.ts (primary renderer) and scene2d.ts (fallback).

import { PHI } from "@/lib/tokens";
import { TUBES, BLADES, SWIPES, type Cubic } from "@/lib/composition";

export interface Pt { x: number; y: number }
export type WidthFn = (t: number) => number;

export interface RawBrush {
  cp: [Pt, Pt, Pt, Pt];
  maxWidth: number;
  opacity: number;
  widthFn: WidthFn;
  seed: number;
}
export interface RawInk {
  cp: [Pt, Pt, Pt, Pt];
  maxWidth: number;
  widthFn: WidthFn;
  seed: number;
  rgb: [number, number, number];
}
export interface RawCyan { p0: Pt; cp?: Pt; p1: Pt; width: number; opacity: number }
export interface RawLine { p0: Pt; p1: Pt; opacity: number; gray: boolean }
export interface RawArc { p0: Pt; cp: Pt; p1: Pt; width: number; opacity: number }
export interface RawAccent { p0: Pt; p1: Pt; cp?: Pt; width: number; opacity: number; hasDot: boolean }
export interface RawDot { x: number; y: number; r: number; opacity: number }
export interface RawWhip { points: Pt[]; maxWidth: number; opacity: number }
export interface RawScratch { p0: Pt; p1: Pt; cp?: Pt; width: number; opacity: number; hasDot: boolean }
export interface RawThrough { p0: Pt; cp?: Pt; p1: Pt; width: number; opacity: number }
export interface RawBundle { lines: { p0: Pt; p1: Pt }[]; width: number; opacity: number }

/** Edge-traced cable: a white tube with a black contour, flung out of the nucleus. */
export interface RawCable { points: Pt[]; width: number; opacity: number }
/** Calligraphic black swipe through the nucleus. */
export interface RawSwipe { cp: [Pt, Pt, Pt, Pt]; widthFn: WidthFn; opacity: number }
/** Bundle of near-parallel hair-fine strands. */
export interface RawFiber { strands: Pt[][]; width: number; opacity: number }
/** Contour-traced scribble: white line with a black outline. */
export interface RawScribble { points: Pt[]; width: number }
/** White burnout glint drawn over the black. */
export interface RawStreak { points: Pt[]; width: number; opacity: number }
/** Jagged wire — a lightning-like polyline. */
export interface RawBolt { points: Pt[]; width: number; opacity: number }
/** Curly hairline wire flung out of the mass. */
export interface RawWire { points: Pt[]; width: number; opacity: number }
/** Ink blot near the core. */
export interface RawBlot { x: number; y: number; r: number; opacity: number }

export interface RawScene {
  focal: Pt;
  focalRadius: number;
  brushes: RawBrush[];
  brushTangles: RawBrush[];
  inks: RawInk[];
  thickCyans: RawInk[];
  cyans: RawCyan[];
  hairlines: RawLine[];
  bundles: RawBundle[];
  throughs: RawThrough[];
  arcs: RawArc[];
  accents: RawAccent[];
  scratches: RawScratch[];
  whips: RawWhip[];
  splatter: RawDot[];
  cables: RawCable[];
  swipes: RawSwipe[];
  fibers: RawFiber[];
  scribbles: RawScribble[];
  streaks: RawStreak[];
  bolts: RawBolt[];
  wires: RawWire[];
  blots: RawBlot[];
}

// ─── Curve helpers ──────────────────────────────────────────

export function sampleCubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

export function samplePath(cp: [Pt, Pt, Pt, Pt], n: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) pts.push(sampleCubic(cp[0], cp[1], cp[2], cp[3], i / n));
  return pts;
}

export function sampleQuadratic(p0: Pt, cp: Pt, p1: Pt, n: number): Pt[] {
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

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// ─── Deformation (shared by the 2D fallback; mirrored in the GL shaders) ───

/** Gentle sinusoidal deformation driven by scroll position. */
export function deform(p: Pt, scrollY: number): Pt {
  const phase = p.x * 0.003 + p.y * 0.002;
  const s = scrollY * 0.0008;
  return { x: p.x + Math.sin(phase + s) * 12, y: p.y + Math.cos(phase * 1.3 + s * 0.7) * 8 };
}

// ─── Width envelopes ────────────────────────────────────────

/**
 * Every brush now EMERGES: width ramps from a point over the first ~12% so a
 * stroke rooted inside the knot visibly grows out of it, and every taper type
 * resolves to a point at the tail — no blunt cut ends floating near the nest.
 */
export function makeWidthFn(maxW: number, taper: number): WidthFn {
  return (t) => {
    const emerge = Math.pow(smoothstep(0, 0.12, t), 0.7);
    let env: number;
    switch (taper) {
      case 0: env = Math.pow(1 - t, 1.5); break;
      case 1: env = (0.35 + 0.65 * Math.sin(t * Math.PI * 0.9 + 0.1)) * Math.pow(1 - t, 0.35); break;
      default: env = Math.sin(t * Math.PI); break;
    }
    const noise = 0.94 + 0.06 * Math.sin(t * 17.3 + maxW);
    return Math.max(0.3, maxW * env * emerge * noise);
  };
}

export function makeInkWidthFn(maxW: number, variant: number): WidthFn {
  return (t) => {
    let env: number;
    if (variant === 0) {
      env = t < 0.15
        ? Math.sin((t / 0.15) * Math.PI / 2)
        : Math.pow(Math.max(0, 1 - (t - 0.15) / 0.85), 1.5);
    } else {
      env = Math.pow(Math.sin(t * Math.PI), 0.55);
    }
    const noise = 0.96 + 0.04 * Math.sin(t * 19.7 + maxW);
    return Math.max(0.3, maxW * env * noise);
  };
}

export function makeBrushCps(p0: Pt, dir: number, len: number, curv: number): [Pt, Pt, Pt, Pt] {
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

// ─── The nucleus ────────────────────────────────────────────

/**
 * The focal mass after Aletiune's cable pieces: a NUCLEUS of edge-traced
 * tubes (white, black contour) flung outward along a few dominant throw
 * directions, calligraphic black swipes cutting through it, hair-fine fibre
 * bundles, contour-traced scribbles, ink clots, and white burnout glints.
 * Everything is curved; nothing is a polygon. Asymmetric by construction —
 * an event, not an object.
 */
function generateNucleus(f: Pt, R: number, scale: number, rng: () => number) {
  const dominants = [rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2];
  const throwAngle = () =>
    rng() < 0.6
      ? dominants[Math.floor(rng() * dominants.length)] + (rng() - 0.5) * 0.8
      : rng() * Math.PI * 2;
  const origin = (spread: number): Pt => {
    const a = rng() * Math.PI * 2, d = Math.pow(rng(), 2) * R * spread;
    return { x: f.x + Math.cos(a) * d, y: f.y + Math.sin(a) * d };
  };
  const bent = (p0: Pt, angle: number, len: number, bend: number, n: number): Pt[] => {
    const p1: Pt = { x: p0.x + Math.cos(angle) * len, y: p0.y + Math.sin(angle) * len };
    const nx = -Math.sin(angle), ny = Math.cos(angle);
    return sampleQuadratic(p0, { x: (p0.x + p1.x) / 2 + nx * len * bend, y: (p0.y + p1.y) / 2 + ny * len * bend }, p1, n);
  };

  // Small cables: the texture inside the nucleus (the major tubes are placed by hand)
  const cables: RawCable[] = [];
  for (let i = 0; i < Math.round(26 * scale); i++) {
    const len = R * (0.3 + Math.pow(rng(), 0.9) * 1.1);
    const cp = makeBrushCps(origin(0.25), throwAngle(), len, (rng() - 0.5) * 1.0);
    cables.push({ points: samplePath(cp, 22), width: 2.2 + rng() * 4.2, opacity: 0.8 + rng() * 0.2 });
  }
  // Short calligraphic flicks through the middle (the big swipes are placed by hand)
  const swipes: RawSwipe[] = [];
  for (let i = 0; i < Math.round(6 * scale); i++) {
    const maxW = 5 + rng() * 10;
    swipes.push({
      cp: makeBrushCps(origin(0.3), throwAngle(), R * (0.3 + rng() * 0.9), (rng() - 0.5) * 1.1),
      widthFn: makeInkWidthFn(maxW, rng() < 0.5 ? 0 : 1),
      opacity: 0.85 + rng() * 0.15,
    });
  }
  // Fibre bundles
  const fibers: RawFiber[] = [];
  for (let i = 0; i < Math.round(9 * scale); i++) {
    const p0 = origin(0.3);
    const a = throwAngle();
    const len = R * (0.6 + rng() * 1.6);
    const bend = (rng() - 0.5) * 1.2;
    const count = 6 + Math.floor(rng() * 9);
    const spread = 1.2 + rng() * 1.6;
    const strands: Pt[][] = [];
    for (let j = 0; j < count; j++) {
      const off = (j - (count - 1) / 2) * spread;
      const nx = -Math.sin(a), ny = Math.cos(a);
      const base = bent({ x: p0.x + nx * off, y: p0.y + ny * off }, a + (rng() - 0.5) * 0.08, len * (0.85 + rng() * 0.3), bend + (rng() - 0.5) * 0.1, 22);
      strands.push(base.map((p) => ({ x: p.x + (rng() - 0.5) * 1.5, y: p.y + (rng() - 0.5) * 1.5 })));
    }
    fibers.push({ strands, width: 0.45 + rng() * 0.4, opacity: 0.3 + rng() * 0.45 });
  }
  // Contour-traced scribbles
  const scribbles: RawScribble[] = [];
  for (let i = 0; i < Math.round(7 * scale); i++) {
    let p = origin(0.6);
    let a = rng() * Math.PI * 2;
    const pts: Pt[] = [p];
    const steps = 30 + Math.floor(rng() * 34);
    for (let j = 0; j < steps; j++) {
      a += (rng() - 0.5) * 1.3 + (rng() < 0.08 ? Math.PI * 0.6 : 0);
      const step = 6 + rng() * 12;
      p = { x: p.x + Math.cos(a) * step, y: p.y + Math.sin(a) * step };
      const dx = p.x - f.x, dy = p.y - f.y;
      if (Math.hypot(dx, dy) > R * 1.6) a = Math.atan2(-dy, -dx) + (rng() - 0.5) * 0.6;
      pts.push(p);
    }
    scribbles.push({ points: pts, width: 1.6 + rng() * 1.2 });
  }
  // White burnout glints
  const streaks: RawStreak[] = [];
  for (let i = 0; i < Math.round(20 * scale); i++) {
    streaks.push({ points: bent(origin(0.45), throwAngle(), R * (0.15 + rng() * 0.85), (rng() - 0.5) * 0.3, 10), width: 1 + rng() * 2.6, opacity: 0.6 + rng() * 0.4 });
  }
  // Jagged bolts
  const bolts: RawBolt[] = [];
  for (let i = 0; i < Math.round(6 * scale); i++) {
    let p = origin(0.35);
    let a = throwAngle();
    const pts: Pt[] = [p];
    const segs = 5 + Math.floor(rng() * 5);
    const total = R * (0.5 + rng() * 1.3);
    for (let j = 0; j < segs; j++) {
      a += (rng() - 0.5) * 1.6;
      const step = (total / segs) * (0.5 + rng());
      p = { x: p.x + Math.cos(a) * step, y: p.y + Math.sin(a) * step };
      pts.push(p);
    }
    bolts.push({ points: pts, width: 0.6 + rng() * 1.1, opacity: 0.45 + rng() * 0.5 });
  }
  // Curly wires
  const wires: RawWire[] = [];
  for (let i = 0; i < Math.round(14 * scale); i++) {
    const p0 = origin(0.4);
    const a = throwAngle();
    const len = R * (0.6 + rng() * 1.6);
    const p1: Pt = { x: p0.x + Math.cos(a) * len, y: p0.y + Math.sin(a) * len };
    const nx = -Math.sin(a), ny = Math.cos(a);
    const cp: Pt = { x: (p0.x + p1.x) / 2 + nx * len * (rng() - 0.5) * 1.4, y: (p0.y + p1.y) / 2 + ny * len * (rng() - 0.5) * 1.4 };
    wires.push({ points: sampleQuadratic(p0, cp, p1, 24), width: 0.5 + rng() * 0.8, opacity: 0.3 + rng() * 0.5 });
  }
  // Blots — a few clots at the heart, the rest is spatter
  const blots: RawBlot[] = [];
  for (let i = 0; i < Math.round(5 * scale); i++) {
    const p = origin(0.25);
    blots.push({ x: p.x, y: p.y, r: 9 + rng() * 16, opacity: 0.85 + rng() * 0.15 });
  }
  for (let i = 0; i < Math.round(32 * scale); i++) {
    const p = origin(0.95);
    blots.push({ x: p.x, y: p.y, r: 1.5 + Math.pow(rng(), 1.6) * 12, opacity: 0.35 + rng() * 0.6 });
  }
  return { cables, swipes, fibers, scribbles, streaks, bolts, wires, blots };
}

// ─── Scene generation ───────────────────────────────────────

/**
 * Build the scene: the hand-placed composition (lib/composition.ts) converted
 * into canvas px, plus frozen-seed texture around it.
 * `overflowPx` is the canvas's top overflow band — hero-space y=0 maps to it.
 */
export function generateRawScene(
  fx: number, fy: number,
  w: number, h: number, vh: number,
  scale: number, rng: () => number,
  overflowPx: number,
): RawScene {
  const diag = Math.sqrt(w * w + h * h);
  const golden = (2 * Math.PI) / (PHI * PHI);
  const focal: Pt = { x: fx, y: fy };
  const R = Math.min(w, vh) * 0.13;
  const toPx = (c: Cubic): [Pt, Pt, Pt, Pt] =>
    c.map(([x, y]) => ({ x: x * w, y: y * vh + overflowPx })) as [Pt, Pt, Pt, Pt];

  const brushes: RawBrush[] = [];
  const splatter: RawDot[] = [];

  // Hand-placed chrome blades
  for (const b of BLADES) {
    brushes.push({ cp: toPx(b.cp), maxWidth: b.width, opacity: 0.96, widthFn: makeWidthFn(b.width, b.taper), seed: rng() * 100 });
  }

  // Every tendril is ROOTED inside the knot (d well under R) so it visibly
  // grows out of the object instead of hanging near it.
  const rooted = (angle: number, dFrac: number): Pt => ({
    x: fx + Math.cos(angle) * R * dFrac,
    y: fy + Math.sin(angle) * R * dFrac,
  });

  const addBrush = (p0: Pt, dir: number, len: number, curv: number, maxW: number, taper: number, op: number, splat = true) => {
    const cp = makeBrushCps(p0, dir, len, curv);
    brushes.push({ cp, maxWidth: maxW, opacity: op, widthFn: makeWidthFn(maxW, taper), seed: rng() * 100 });
    if (!splat) return;
    // Ink splatter only at the far tip (the root is hidden inside the knot)
    for (let d = 0; d < 4; d++) {
      const ep = cp[3];
      splatter.push({ x: ep.x + (rng() - 0.5) * 30, y: ep.y + (rng() - 0.5) * 30, r: 1 + rng() * 3.2, opacity: 0.3 + rng() * 0.5 });
    }
  };

  // Texture strokes: a couple of long sweeps and short accents out of the nucleus
  for (let i = 0; i < Math.ceil(2 * scale); i++) {
    const angle = i * golden + 1.1 + (rng() - 0.5) * 0.5;
    addBrush(rooted(angle, 0.15 + rng() * 0.4), angle, diag * (0.30 + rng() * 0.35), (rng() - 0.5) * 0.35,
      16 + rng() * 22, Math.floor(rng() * 3), 0.88 + rng() * 0.12);
  }
  for (let i = 0; i < Math.ceil(3 * scale); i++) {
    const angle = i * golden + (rng() - 0.5) * 0.8;
    addBrush(rooted(angle, 0.2 + rng() * 0.5), angle + (rng() - 0.5) * 0.6, diag * (0.08 + rng() * 0.12), (rng() - 0.5) * 0.5,
      12 + rng() * 16, rng() < 0.6 ? 0 : 1, 0.85 + rng() * 0.15);
  }
  // Peripheral strokes: sweep from the edges inward, resolving to a point near the knot
  for (let i = 0; i < Math.ceil(3 * scale); i++) {
    const edge = Math.floor(rng() * 4);
    const sx = edge === 1 ? w + 20 : edge === 3 ? -20 : rng() * w;
    const sy = edge === 0 ? -20 : edge === 2 ? h + 20 : rng() * h;
    const aToF = Math.atan2(fy - sy, fx - sx) + (rng() - 0.5) * 0.5;
    addBrush({ x: sx, y: sy }, aToF, diag * (0.18 + rng() * 0.20), (rng() - 0.5) * 0.4,
      14 + rng() * 22, 2, 0.75 + rng() * 0.25, false);
  }
  // Dynamic-symmetry diagonals
  const diagAngles = [Math.atan2(h, w), Math.atan2(h, -w), Math.atan2(w, -h), Math.atan2(-w, -h)];
  for (let i = 0; i < 2; i++) {
    const angle = diagAngles[i] + (rng() - 0.5) * 0.15;
    addBrush(rooted(angle, 0.1 + rng() * 0.35), angle, diag * (0.35 + rng() * 0.25), (rng() - 0.5) * 0.2,
      18 + rng() * 18, Math.floor(rng() * 3), 0.90 + rng() * 0.10);
  }

  // Cyan beams
  const cyans: RawCyan[] = [];
  for (let i = 0; i < Math.floor(30 * scale); i++) {
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

  // Hairlines
  const hairlines: RawLine[] = [];
  for (let i = 0; i < Math.floor(110 * scale); i++) {
    const angle = (i + 0.5) * golden + (rng() - 0.5) * 0.5;
    const len = diag * (0.1 + rng() * 0.8);
    const off = rng() * 15;
    hairlines.push({
      p0: { x: fx + Math.cos(angle) * off, y: fy + Math.sin(angle) * off },
      p1: { x: fx + Math.cos(angle) * len, y: fy + Math.sin(angle) * len },
      opacity: 0.03 + rng() * 0.17, gray: rng() < 0.4,
    });
  }
  for (let i = 0; i < Math.floor(24 * scale); i++) {
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

  // The nucleus (texture) + the hand-placed tubes and swipes
  const { cables, swipes, fibers, scribbles, streaks, bolts, wires, blots } = generateNucleus(focal, R, scale, rng);
  for (const t of TUBES) cables.push({ points: samplePath(toPx(t.cp), 48), width: t.width, opacity: t.opacity ?? 1 });
  for (const s of SWIPES) swipes.push({ cp: toPx(s.cp), widthFn: makeInkWidthFn(s.width, s.variant), opacity: 0.94 });

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

  // Accent marks near harmonic-armature intersections
  const PHI_INV = 1 / PHI;
  const attractors: Pt[] = [
    { x: w / 3, y: h / 3 }, { x: 2 * w / 3, y: h / 3 }, { x: w / 3, y: 2 * h / 3 }, { x: 2 * w / 3, y: 2 * h / 3 },
    { x: w / 4, y: h / 4 }, { x: 3 * w / 4, y: h / 4 }, { x: w / 4, y: 3 * h / 4 }, { x: 3 * w / 4, y: 3 * h / 4 },
    { x: w * PHI_INV, y: h * PHI_INV }, { x: w * (1 - PHI_INV), y: h * PHI_INV },
    { x: w * PHI_INV, y: h * (1 - PHI_INV) }, { x: w * (1 - PHI_INV), y: h * (1 - PHI_INV) },
  ];
  const accents: RawAccent[] = [];
  for (let i = 0; i < Math.floor(24 * scale); i++) {
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

  // Debris: short marks in an annulus OUTSIDE the knot (never on it)
  const scratches: RawScratch[] = [];
  for (let i = 0; i < Math.floor(34 * scale); i++) {
    const a = rng() * Math.PI * 2;
    const d = R * (1.15 + rng() * 1.3);
    const sx = fx + Math.cos(a) * d;
    const sy = fy + Math.sin(a) * d;
    const angle = rng() * Math.PI * 2;
    const len = 8 + rng() * 34;
    const p0: Pt = { x: sx, y: sy };
    const p1: Pt = { x: sx + Math.cos(angle) * len, y: sy + Math.sin(angle) * len };
    const hasCurve = rng() < 0.3;
    scratches.push({
      p0, p1,
      cp: hasCurve ? { x: (p0.x + p1.x) / 2 + (rng() - 0.5) * len * 0.4, y: (p0.y + p1.y) / 2 + (rng() - 0.5) * len * 0.4 } : undefined,
      width: 0.4 + rng() * 2.0, opacity: 0.15 + rng() * 0.4, hasDot: rng() < 0.2,
    });
  }

  // Through lines
  const throughs: RawThrough[] = [];
  for (let i = 0; i < Math.floor(22 * scale); i++) {
    const angle = i < 4 ? diagAngles[i] + (rng() - 0.5) * 0.52 : rng() * Math.PI * 2;
    const jitter = (rng() - 0.5) * 30;
    const perpX = -Math.sin(angle) * jitter;
    const perpY = Math.cos(angle) * jitter;
    const ext = diag * 0.6;
    const p0: Pt = { x: fx + perpX - Math.cos(angle) * ext, y: fy + perpY - Math.sin(angle) * ext };
    const p1: Pt = { x: fx + perpX + Math.cos(angle) * ext, y: fy + perpY + Math.sin(angle) * ext };
    const hasCurve = rng() < 0.4;
    throughs.push({
      p0, p1,
      cp: hasCurve ? { x: (p0.x + p1.x) / 2 + (rng() - 0.5) * ext * 0.06, y: (p0.y + p1.y) / 2 + (rng() - 0.5) * ext * 0.06 } : undefined,
      width: 0.4 + rng() * 1.1, opacity: 0.05 + rng() * 0.15,
    });
  }

  // Whips: medium-weight tapered curves out of the knot
  const whips: RawWhip[] = [];
  for (let i = 0; i < Math.floor(10 * scale); i++) {
    const angle = i * golden + (rng() - 0.5) * 0.6;
    const len = diag * (0.18 + rng() * 0.35);
    const p0 = rooted(angle, 0.2 + rng() * 0.5);
    const p1: Pt = { x: fx + Math.cos(angle) * len, y: fy + Math.sin(angle) * len };
    const cpOff = len * (0.05 + rng() * 0.12) * (rng() < 0.5 ? 1 : -1);
    const cpPt: Pt = {
      x: (p0.x + p1.x) / 2 + Math.cos(angle + Math.PI / 2) * cpOff,
      y: (p0.y + p1.y) / 2 + Math.sin(angle + Math.PI / 2) * cpOff,
    };
    whips.push({ points: sampleQuadratic(p0, cpPt, p1, 20), maxWidth: 2 + rng() * 4, opacity: 0.15 + rng() * 0.35 });
  }

  // Brush tangles: short calligraphic chrome flicks in and around the knot
  const brushTangles: RawBrush[] = [];
  for (let i = 0; i < Math.floor(8 * scale); i++) {
    const angle = rng() * Math.PI * 2;
    const origin = rooted(angle, 0.3 + rng() * 0.8);
    const dir = rng() * Math.PI * 2;
    const len = diag * (0.05 + rng() * 0.07);
    const curv = (rng() - 0.5) * 1.2;
    const maxW = 3 + rng() * 9;
    const taper = rng() < 0.5 ? 0 : 2;
    brushTangles.push({ cp: makeBrushCps(origin, dir, len, curv), maxWidth: maxW, opacity: 0.5 + rng() * 0.35, widthFn: makeWidthFn(maxW, taper), seed: rng() * 100 });
  }

  // Bold ink strokes
  const inks: RawInk[] = [];
  for (let i = 0; i < Math.ceil(1 * scale); i++) {
    const angle = i * golden + (rng() - 0.5) * 0.4;
    const origin = rooted(angle, 0.1 + rng() * 0.4);
    const len = diag * (0.22 + rng() * 0.30);
    const curv = (rng() - 0.5) * 0.25;
    const maxW = 30 + rng() * 28;
    const variant = rng() < 0.6 ? 0 : 1;
    inks.push({ cp: makeBrushCps(origin, angle, len, curv), maxWidth: maxW, widthFn: makeInkWidthFn(maxW, variant), seed: rng() * 100, rgb: [0, 0, 0] });
  }

  // Thick cyan calligraphic strokes
  const thickCyans: RawInk[] = [];
  for (let i = 0; i < Math.ceil(2 * scale); i++) {
    const angle = i * golden + (rng() - 0.5) * 0.5 + Math.PI * 0.3;
    const origin = rooted(angle, 0.2 + rng() * 0.6);
    const len = diag * (0.18 + rng() * 0.30);
    const curv = (rng() - 0.5) * 0.35;
    const maxW = 12 + rng() * 25;
    const variant = rng() < 0.5 ? 0 : 1;
    thickCyans.push({ cp: makeBrushCps(origin, angle, len, curv), maxWidth: maxW, widthFn: makeInkWidthFn(maxW, variant), seed: rng() * 100, rgb: [0, 153, 255] });
  }

  // Parallel line bundles
  const bundles: RawBundle[] = [];
  for (let i = 0; i < Math.ceil(4 * scale); i++) {
    const bAngle = i * golden + (rng() - 0.5) * 0.6;
    const bDist = diag * (0.10 + rng() * 0.35);
    const bx = fx + Math.cos(bAngle) * bDist;
    const by = fy + Math.sin(bAngle) * bDist;
    const angle = bAngle + (rng() - 0.5) * 0.5;
    const count = 5 + Math.floor(rng() * 6);
    const spacing = 3 + rng() * 8;
    const baseLen = diag * (0.08 + rng() * 0.25);
    const lines: { p0: Pt; p1: Pt }[] = [];
    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);
    for (let j = 0; j < count; j++) {
      const offset = (j - (count - 1) / 2) * spacing;
      const lenVar = baseLen * (0.7 + rng() * 0.6);
      lines.push({
        p0: { x: bx + perpX * offset, y: by + perpY * offset },
        p1: { x: bx + perpX * offset + Math.cos(angle) * lenVar, y: by + perpY * offset + Math.sin(angle) * lenVar },
      });
    }
    bundles.push({ lines, width: 0.3 + rng() * 0.7, opacity: 0.06 + rng() * 0.14 });
  }

  return {
    focal, focalRadius: R,
    brushes, brushTangles, inks, thickCyans, cyans, hairlines, bundles, throughs, arcs,
    accents, scratches, whips, splatter, cables, swipes, fibers, scribbles, streaks, bolts, wires, blots,
  };
}
