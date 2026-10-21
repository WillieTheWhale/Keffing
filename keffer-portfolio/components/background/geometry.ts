// Background — ALLOY. Swept-profile geometry (from v2 CHROME, extended).
//
// Every piece is a 2D cross-section swept along a centripetal Catmull-Rom
// spine with rotation-minimising (double-reflection) frames plus an authored
// twist. Chrome cross-sections are flattened and asymmetric — lens,
// plano-convex, teardrop, crescent, S-sheet — built as SEPARATE surface
// strips so the knife edges stay creased. Width envelopes run to razor tips;
// tips can be torn or split into tines.
//
// ALLOY adds the porcelain material's needs (v1 CONTOUR, in 3D):
//   - round / oval tubes of CONSTANT width with cut, pointed or torn ends
//     (`tube`), plus a piecewise width multiplier for eccentric loops that
//     thin on their far side;
//   - end caps whose rim carries an edge coordinate (drawn contour);
//   - flat outlined plates (the nucleus shards and chips) as fans whose
//     edge coordinate runs 0 at the centre to 1 at the rim;
//   - a per-vertex spine-centre attribute so the porcelain shader can find a
//     round tube's true silhouette analytically.
//
// Output is plain typed arrays merged per draw call: position, normal,
// aData = (u along, s across, kind, seed), aSway (0 at root .. 1 at tip).

import { CatmullRomCurve3, Vector3 } from "three";

export type V3 = [number, number, number];
export type Profile = "lens" | "plano" | "tear" | "crescent" | "sheet" | "round";
/** 0 dark liquid chrome · 1 white "ice" chrome · 2 glass (blended pass) ·
 *  3 porcelain (flat white body, drawn contour) · 4 ink (solid black).
 *  Opaque chrome carries a continuous whiteness (aData.z in 0..1) so one
 *  blade can run from ice to dark chrome along its length. */
export type Kind = 0 | 1 | 2 | 3 | 4;

export interface TubeOpts {
  /** Taper length (fraction of the run) at start / end; 0 = blunt. */
  taper?: [number, number];
  /** Piecewise-linear width multiplier along u: [[u, m], ...]. */
  wmul?: [number, number][];
  /** End treatment: "cut" (flat cap with a drawn rim), "torn" (ragged cap), "open" (no cap, runs off-frame). */
  start?: "cut" | "open";
  end?: "cut" | "torn" | "open" | "point";
}

export interface RibbonSpec {
  pts: V3[];
  /** Max width (world units). */
  width: number;
  profile: Profile;
  kind: Kind;
  /** Whiteness ramp along the length for opaque chrome: [u0, u1, w0, w1]. */
  whiteAlong?: [number, number, number, number];
  /** Thickness as a fraction of width (default 0.10; round = 1, < 1 = oval). */
  thick?: number;
  /** Crescent / sheet bow, in half-widths (default 0.5 / 0.35). */
  bow?: number;
  /** Bow growth toward the tip (petals curl): bow *= 1 + curl*u. */
  curl?: number;
  /** Bow undulation along the length (wavy sheets reflect more structure). */
  wave?: number;
  /** Total twist along the length (radians) and initial roll. */
  twist?: number;
  roll?: number;
  /** Width envelope: Beta-like u^a (1-u)^b, normalised. */
  a?: number;
  b?: number;
  /** Torn tip: the "left" edge stops early (fraction of length, 0..0.4). */
  tear?: number;
  /** Serration amount near the tip (0..1) and tooth count. */
  serrate?: number;
  teeth?: number;
  /** Sway weight multiplier (0 = rigid). */
  sway?: number;
  /** Samples along the spine (default from arc length). */
  segs?: number;
  /** Profile points per surface strip (default by width). */
  ring?: number;
  /** Frame hint for the initial normal (default world +Z). */
  up?: V3;
  seed?: number;
  /** Constant-width tube (porcelain): replaces the Beta envelope. */
  tube?: TubeOpts;
  /** Map this piece's u onto a parent's u range for the sway weight, so a
   *  companion sways exactly with the piece it rides. */
  swayU?: [number, number];
}

export interface MeshData {
  position: number[];
  normal: number[];
  data: number[];
  sway: number[];
  /** cross-section axes (object space) for the per-pixel analytic normal */
  wax: number[];
  hax: number[];
  /** (k = half-thickness / half-width, bow, profile id, strip side);
   *  porcelain round tubes: (half-width, thick ratio, -1, side);
   *  plates / caps: (0, 0, -2, side) */
  prof: number[];
  /** spine centre point for this vertex's ring (object space) */
  axis: number[];
  index: number[];
}

export const newMesh = (): MeshData => ({ position: [], normal: [], data: [], sway: [], wax: [], hax: [], prof: [], axis: [], index: [] });

const PROFILE_ID: Record<Profile, number> = { lens: 0, plano: 1, tear: 2, crescent: 3, sheet: 4, round: -1 };

/** Sampled spine with frames — returned so children (tines, companions) can ride it. */
export interface Spine {
  P: Vector3[];
  T: Vector3[];
  N: Vector3[];
  B: Vector3[];
  len: number;
}

/** Tessellation density: samples per world unit of spine (set per tier). */
let SEG_DENSITY = 34;
let RING_SCALE = 1;
export function setTessellation(segDensity: number, ringScale: number) {
  SEG_DENSITY = segDensity;
  RING_SCALE = ringScale;
}

export function sampleSpine(pts: V3[], n: number, up: V3 = [0, 0, 1]): Spine {
  const curve = new CatmullRomCurve3(pts.map((p) => new Vector3(p[0], p[1], p[2])), false, "centripetal");
  const P = curve.getSpacedPoints(n - 1);
  const len = curve.getLength();
  const T: Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
    T.push(new Vector3().subVectors(b, a).normalize());
  }
  const hint = new Vector3(up[0], up[1], up[2]);
  let N0 = hint.clone().addScaledVector(T[0], -hint.dot(T[0]));
  if (N0.lengthSq() < 1e-6) N0 = new Vector3(1, 0, 0).addScaledVector(T[0], -T[0].x);
  N0.normalize();
  const N: Vector3[] = [N0];
  // double reflection (Wang et al. 2008) — rotation-minimising
  const v1 = new Vector3(), rL = new Vector3(), tL = new Vector3(), v2 = new Vector3();
  for (let i = 0; i < n - 1; i++) {
    v1.subVectors(P[i + 1], P[i]);
    const c1 = v1.dot(v1);
    if (c1 < 1e-12) { N.push(N[i].clone()); continue; }
    rL.copy(N[i]).addScaledVector(v1, (-2 / c1) * v1.dot(N[i]));
    tL.copy(T[i]).addScaledVector(v1, (-2 / c1) * v1.dot(T[i]));
    v2.subVectors(T[i + 1], tL);
    const c2 = v2.dot(v2);
    const r = rL.clone();
    if (c2 > 1e-12) r.addScaledVector(v2, (-2 / c2) * v2.dot(rL));
    r.addScaledVector(T[i + 1], -r.dot(T[i + 1])).normalize();
    N.push(r);
  }
  const B = T.map((t, i) => new Vector3().crossVectors(t, N[i]).normalize());
  return { P, T, N, B, len };
}

// ─── Cross-sections ─────────────────────────────────────────

type Strip = [number, number][];

function chebyshev(m: number): number[] {
  const xs: number[] = [];
  for (let k = 0; k < m; k++) xs.push(-Math.cos((Math.PI * k) / (m - 1)));
  return xs;
}

function profileStrips(kind: Profile, m: number, bow: number): Strip[] {
  const xs = chebyshev(m);
  const top: Strip = [], bot: Strip = [];
  switch (kind) {
    case "lens": {
      for (const x of xs) top.push([x, 1 - x * x]);
      for (const x of xs) bot.push([x, -(1 - x * x)]);
      break;
    }
    case "plano": {
      for (const x of xs) top.push([x, 1.25 * (1 - x * x)]);
      for (const x of xs) bot.push([x, -0.18 * (1 - x * x)]);
      break;
    }
    case "tear": {
      for (const x of xs) {
        const h = Math.sqrt(Math.max(0, 1 - x * x)) * (1 - x) * 0.75;
        top.push([x, h]);
      }
      for (const x of xs) {
        const h = Math.sqrt(Math.max(0, 1 - x * x)) * (1 - x) * 0.75;
        bot.push([x, -h]);
      }
      break;
    }
    case "crescent": {
      for (const x of xs) {
        const c = bow * (1 - x * x);
        const h = Math.pow(Math.max(0, 1 - x * x), 0.8);
        top.push([x, c + h]);
        bot.push([x, c - h]);
      }
      break;
    }
    case "sheet": {
      for (const x of xs) {
        const c = bow * Math.sin(Math.PI * x * 0.92) * 0.5 + bow * 0.25 * (1 - x * x);
        const h = 0.6 * Math.pow(Math.max(0, 1 - x * x), 0.6);
        top.push([x, c + h]);
        bot.push([x, c - h]);
      }
      break;
    }
    case "round": {
      const ring: Strip = [];
      for (let k = 0; k < m; k++) {
        const a = (-2 * Math.PI * k) / (m - 1); // clockwise → outward normals
        ring.push([Math.cos(a), Math.sin(a)]);
      }
      return [ring];
    }
  }
  bot.reverse();
  return [top, bot];
}

// ─── Width envelopes ────────────────────────────────────────

function betaEnv(u: number, a: number, b: number): number {
  const peak = a / (a + b);
  const norm = Math.pow(peak, a) * Math.pow(1 - peak, b);
  return (Math.pow(Math.max(0, u), a) * Math.pow(Math.max(0, 1 - u), b)) / norm;
}

function tubeEnv(u: number, t: TubeOpts): number {
  let m = 1;
  const w = t.wmul;
  if (w && w.length) {
    if (u <= w[0][0]) m = w[0][1];
    else if (u >= w[w.length - 1][0]) m = w[w.length - 1][1];
    else {
      for (let i = 1; i < w.length; i++) {
        if (u <= w[i][0]) {
          const f = (u - w[i - 1][0]) / Math.max(1e-6, w[i][0] - w[i - 1][0]);
          const s = f * f * (3 - 2 * f);
          m = w[i - 1][1] + (w[i][1] - w[i - 1][1]) * s;
          break;
        }
      }
    }
  }
  const [t0, t1] = t.taper ?? [0, 0];
  if (t0 > 0 && u < t0) m *= Math.pow(u / t0, 0.7);
  if (t1 > 0 && u > 1 - t1) m *= Math.pow(Math.max(0, (1 - u) / t1), 0.85);
  return m;
}

function fract(x: number) { return x - Math.floor(x); }
function hash1(x: number) { return fract(Math.sin(x * 127.1 + 311.7) * 43758.5453); }

/**
 * Build one ribbon / tube into `mesh`. Returns its spine so tines and
 * companions can be grown from it.
 */
export function buildRibbon(mesh: MeshData, spec: RibbonSpec): Spine {
  const prof = spec.profile;
  const roughLen = polyLen(spec.pts);
  const segs = spec.segs ?? Math.max(24, Math.min(520, Math.round(roughLen * SEG_DENSITY)));
  const spine = sampleSpine(spec.pts, segs, spec.up);
  const m = Math.max(5, Math.round((spec.ring ?? (prof === "round" ? 10 : spec.width > 0.28 ? 13 : spec.width > 0.1 ? 10 : 7)) * RING_SCALE));
  const bow0 = spec.bow ?? (prof === "crescent" ? 0.5 : prof === "sheet" ? 0.35 : 0);
  const thick = spec.thick ?? (prof === "round" ? 1 : 0.1);
  const a = spec.a ?? 0.45, b = spec.b ?? 1.15;
  const tear = spec.tear ?? 0;
  const serr = spec.serrate ?? 0;
  const teeth = spec.teeth ?? 9;
  const twist = spec.twist ?? 0, roll = spec.roll ?? 0;
  const kind = spec.kind;
  const seed = spec.seed ?? 0.5;
  const swayW = spec.sway ?? 1;
  const curl = spec.curl ?? 0;
  const tube = spec.tube;
  const round = prof === "round";

  const W = new Vector3(), H = new Vector3(), p = new Vector3();

  // Per-sample half-widths (left / right edge) and thickness.
  const hl: number[] = [], hr: number[] = [], ht: number[] = [];
  for (let i = 0; i < segs; i++) {
    const u = i / (segs - 1);
    if (tube) {
      const half = spec.width * 0.5 * tubeEnv(u, tube);
      hl.push(half); hr.push(half);
      ht.push(Math.max(1e-4, half * 2 * (round ? 1 : thick * 2)));
      continue;
    }
    const base = (spec.width * 0.5) * betaEnv(u, a, b);
    const uL = tear > 0 ? Math.min(1, u / (1 - tear)) : u;
    let left = (spec.width * 0.5) * betaEnv(uL, a, b);
    if (uL >= 1) left = 0;
    let right = base;
    if (serr > 0) {
      const ramp = Math.max(0, (u - 0.55) / 0.45);
      const tooth = Math.pow(fract(u * teeth + seed * 3.1), 2.2);
      left *= 1 - serr * ramp * tooth;
      const tooth2 = Math.pow(fract(u * teeth * 0.73 + seed * 7.7), 2.4);
      right *= 1 - serr * 0.6 * ramp * tooth2;
    }
    hl.push(Math.max(left, 0));
    hr.push(Math.max(right, 0));
    ht.push(Math.max(1e-4, (left + right) * 0.5 * (round ? 1 : thick * 2)));
  }

  // Torn end (round tubes): each ring column stops at its own row, so the
  // end boundary is ragged; the cap below closes it.
  const torn = !!tube && tube.end === "torn" && round;
  const endRow: number[] = [];
  if (torn) {
    const maxRows = Math.max(3, Math.round(segs * 0.035));
    for (let k = 0; k < m; k++) {
      const h = hash1(seed * 91.7 + k * 3.31);
      endRow.push(segs - 1 - Math.round(Math.pow(h, 1.6) * maxRows));
    }
    endRow[m - 1] = endRow[0]; // the ring is closed
  }

  const wave = spec.wave ?? 0;
  const bowAt = (u: number) => bow0 * (1 + curl * u) * (1 + wave * Math.sin(u * Math.PI * 4.6 + seed * 6.28));
  const strips = (u: number) => profileStrips(prof, m, bowAt(u));
  const pid = PROFILE_ID[prof];
  const nStrips = round ? 1 : 2;
  const wa = spec.whiteAlong;
  const kindAt = (u: number) => {
    if (kind >= 2) return kind;
    if (!wa) return kind;
    const t = Math.min(1, Math.max(0, (u - wa[0]) / Math.max(1e-4, wa[1] - wa[0])));
    return wa[2] + (wa[3] - wa[2]) * t * t * (3 - 2 * t);
  };
  let lastRing: Vector3[] = [];
  let firstRing: Vector3[] = [];
  const frameAt: { w: Vector3; h: Vector3 }[] = [];
  for (let sI = 0; sI < nStrips; sI++) {
    const grid: Vector3[][] = [];
    const sCoord: number[] = [];
    const axes: { w: Vector3; h: Vector3; bow: number; k: number[] }[] = [];
    for (let i = 0; i < segs; i++) {
      const u = i / (segs - 1);
      const strip = strips(u)[sI];
      const th = roll + twist * u;
      const c = Math.cos(th), s = Math.sin(th);
      W.copy(spine.N[i]).multiplyScalar(c).addScaledVector(spine.B[i], s);
      H.copy(spine.N[i]).multiplyScalar(-s).addScaledVector(spine.B[i], c);
      const row: Vector3[] = [];
      const ks: number[] = [];
      for (let k = 0; k < strip.length; k++) {
        const [x, y] = strip[k];
        const half = round ? (hl[i] + hr[i]) * 0.5 : x < 0 ? hl[i] : hr[i];
        if (round) ks.push(half);
        else ks.push(Math.min(4, (ht[i] * 0.5) / Math.max(1e-5, half)));
        const xx = x * half;
        const yy = round ? y * half * thick : y * ht[i] * 0.5;
        p.copy(spine.P[i]).addScaledVector(W, xx).addScaledVector(H, yy);
        row.push(p.clone());
        if (i === 0) sCoord.push(x);
      }
      grid.push(row);
      axes.push({ w: W.clone(), h: H.clone(), bow: round ? thick : bowAt(u), k: ks });
      if (sI === 0) frameAt.push({ w: W.clone(), h: H.clone() });
    }
    if (torn) {
      for (let k = 0; k < m; k++) {
        const e = endRow[k];
        for (let i = e + 1; i < segs; i++) grid[i][k] = grid[e][k];
      }
    }
    emitGrid(mesh, grid, spine, sCoord, kindAt, seed, swayW, sI === 1 ? -1 : 1, round, axes, pid, torn ? endRow : null, spec.swayU);
    if (sI === 0) {
      firstRing = grid[0];
      lastRing = torn ? grid[0].map((_, k) => grid[endRow[k]][k]) : grid[segs - 1];
    }
  }

  // caps on blunt ends of porcelain tubes
  if (tube && round) {
    const kd = kindAt(1);
    if (tube.start === "cut" && (tube.taper?.[0] ?? 0) === 0) {
      emitCap(mesh, spine.P[0], firstRing, spine.T[0].clone().negate(), frameAt[0], kindAt(0), seed, 0, 0);
    }
    if ((tube.end === "cut" || tube.end === "torn") && (tube.taper?.[1] ?? 0) === 0) {
      let c = spine.P[segs - 1];
      let tdir = spine.T[segs - 1];
      if (torn) {
        const mid = Math.round(endRow.reduce((s, v) => s + v, 0) / endRow.length);
        c = spine.P[Math.min(segs - 1, mid)];
        tdir = spine.T[Math.min(segs - 1, mid)];
      }
      const ue = spec.swayU ? spec.swayU[1] : 1;
      emitCap(mesh, c, lastRing, tdir.clone(), frameAt[segs - 1], kd, seed, 1, swayW * ue * ue);
    }
  }
  return spine;
}

const _du = new Vector3(), _ds = new Vector3(), _n = new Vector3();

function emitGrid(
  mesh: MeshData, grid: Vector3[][], spine: Spine, sCoord: number[],
  kindAt: (u: number) => number, seed: number, swayW: number, side: number, closed: boolean,
  axes: { w: Vector3; h: Vector3; bow: number; k: number[] }[], pid: number, endRow: number[] | null, swayU?: [number, number],
) {
  const su = (u: number) => (swayU ? swayU[0] + (swayU[1] - swayU[0]) * u : u);
  const rows = grid.length, cols = grid[0].length;
  const base = mesh.position.length / 3;
  for (let i = 0; i < rows; i++) {
    for (let k = 0; k < cols; k++) {
      const ii = endRow ? Math.min(i, endRow[k]) : i;
      const u = ii / (rows - 1);
      const kind = kindAt(u);
      const P = grid[i][k];
      const ip = Math.min(rows - 1, ii + 1), im = Math.max(0, ii - 1);
      _du.subVectors(grid[ip][k], grid[im][k]);
      let kp = k + 1, km = k - 1;
      if (closed) { if (kp >= cols) kp = 1; if (km < 0) km = cols - 2; }
      else { kp = Math.min(cols - 1, kp); km = Math.max(0, km); }
      _ds.subVectors(grid[ii][kp], grid[ii][km]);
      _n.crossVectors(_du, _ds);
      if (_n.lengthSq() < 1e-14) {
        _n.copy(spine.N[ii]).multiplyScalar(side);
      }
      _n.normalize();
      mesh.position.push(P.x, P.y, P.z);
      mesh.normal.push(_n.x, _n.y, _n.z);
      mesh.data.push(u, sCoord[k] ?? 0, kind, seed);
      mesh.sway.push(swayW * su(u) * su(u));
      const ax = axes[ii];
      mesh.wax.push(ax.w.x, ax.w.y, ax.w.z);
      mesh.hax.push(ax.h.x, ax.h.y, ax.h.z);
      if (closed) mesh.prof.push(ax.k[k], ax.bow, -1, side);
      else mesh.prof.push(ax.k[k], ax.bow, pid, side);
      const C = spine.P[ii];
      mesh.axis.push(C.x, C.y, C.z);
    }
  }
  for (let i = 0; i < rows - 1; i++) {
    for (let k = 0; k < cols - 1; k++) {
      const a = base + i * cols + k, b = a + 1, c = a + cols, d = c + 1;
      mesh.index.push(a, c, b, b, c, d);
    }
  }
}

/** A flat-ish cap: a fan from the centre to the end ring; edge coordinate 0 → 1 at the rim. */
function emitCap(mesh: MeshData, c: Vector3, ring: Vector3[], n: Vector3, fr: { w: Vector3; h: Vector3 }, kind: number, seed: number, u: number, swayW: number) {
  const base = mesh.position.length / 3;
  const push = (P: Vector3, e: number) => {
    mesh.position.push(P.x, P.y, P.z);
    mesh.normal.push(n.x, n.y, n.z);
    mesh.data.push(u, e, kind, seed);
    mesh.sway.push(swayW);
    mesh.wax.push(fr.w.x, fr.w.y, fr.w.z);
    mesh.hax.push(fr.h.x, fr.h.y, fr.h.z);
    mesh.prof.push(0, 0, -2, 1);
    mesh.axis.push(c.x, c.y, c.z);
  };
  push(c, 0);
  for (const P of ring) push(P, 1);
  for (let k = 0; k < ring.length - 1; k++) mesh.index.push(base, base + 1 + k, base + 2 + k);
}

/**
 * A flat outlined plate: a star-shaped polygon fanned from its centre (the
 * nucleus shards and chips). `ring` is in order around the centre.
 */
export function buildPlate(mesh: MeshData, c: V3, ring: V3[], kind: Kind, seed: number, sway = 1) {
  const C = new Vector3(...c);
  // plate normal from the polygon (Newell)
  const n = new Vector3();
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    n.x += (a[1] - b[1]) * (a[2] + b[2]);
    n.y += (a[2] - b[2]) * (a[0] + b[0]);
    n.z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  if (n.lengthSq() < 1e-12) n.set(0, 0, 1);
  n.normalize();
  const w = new Vector3(ring[0][0] - c[0], ring[0][1] - c[1], ring[0][2] - c[2]).normalize();
  const h = new Vector3().crossVectors(n, w).normalize();
  const base = mesh.position.length / 3;
  const push = (P: V3, e: number) => {
    mesh.position.push(P[0], P[1], P[2]);
    mesh.normal.push(n.x, n.y, n.z);
    mesh.data.push(0.5, e, kind, seed);
    mesh.sway.push(sway);
    mesh.wax.push(w.x, w.y, w.z);
    mesh.hax.push(h.x, h.y, h.z);
    mesh.prof.push(0, 0, -2, 1);
    mesh.axis.push(C.x, C.y, C.z);
  };
  push(c, 0);
  for (const P of ring) push(P, 1);
  const nr = ring.length;
  for (let k = 0; k < nr; k++) mesh.index.push(base, base + 1 + k, base + 1 + ((k + 1) % nr));
}

function polyLen(pts: V3[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1], dz = pts[i][2] - pts[i - 1][2];
    L += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return L * 1.08;
}

/**
 * Tines: child blades that emerge from the parent's surface near its tip
 * and fan apart — a split end. Returns specs for the caller to build.
 */
export function tines(
  parent: Spine, parentSpec: RibbonSpec, from: number, count: number,
  opts: { spread: number; lift?: number; extend?: number; width: number; kind: Kind; profile?: Profile; twist?: number; seed?: number; roll?: number },
): RibbonSpec[] {
  const out: RibbonSpec[] = [];
  const n = parent.P.length;
  const i0 = Math.floor(from * (n - 1));
  const steps = 6;
  for (let j = 0; j < count; j++) {
    const side = count === 1 ? 0 : (j / (count - 1)) * 2 - 1;
    const pts: V3[] = [];
    for (let q = 0; q <= steps; q++) {
      const t = q / steps;
      const i = Math.min(n - 1, Math.round(i0 + t * (n - 1 - i0)));
      const P = parent.P[i], T = parent.T[i];
      const uu = i / (n - 1);
      const th = (parentSpec.roll ?? 0) + (parentSpec.twist ?? 0) * uu;
      const c = Math.cos(th), sn = Math.sin(th);
      const N = new Vector3().copy(parent.N[i]).multiplyScalar(c).addScaledVector(parent.B[i], sn);
      const B = new Vector3().copy(parent.N[i]).multiplyScalar(-sn).addScaledVector(parent.B[i], c);
      const lat = side * (parentSpec.width * 0.25 + opts.spread * Math.pow(t, 1.4));
      const lift = (opts.lift ?? 0) * Math.pow(t, 2) * (j % 2 === 0 ? 1 : -1);
      const ext = (opts.extend ?? 0) * Math.pow(t, 1.2) * (1 - Math.abs(side) * 0.3);
      pts.push([
        P.x + N.x * lat + B.x * lift + T.x * ext,
        P.y + N.y * lat + B.y * lift + T.y * ext,
        P.z + N.z * lat + B.z * lift + T.z * ext,
      ]);
    }
    out.push({
      pts, width: opts.width * (1 - Math.abs(side) * 0.35), profile: opts.profile ?? "lens", kind: opts.kind,
      a: 0.7, b: 1.3, twist: (opts.twist ?? 1.2) * (side >= 0 ? 1 : -1), roll: opts.roll ?? 0,
      seed: (opts.seed ?? 0.3) + j * 0.17, tear: 0.08, thick: 0.12,
    });
  }
  return out;
}

/**
 * A companion: a thinner cable (or ink wire) riding alongside a parent's
 * spine at a lateral offset, peeling away at its ends (v1's harness, ref
 * r07). `side` is the lateral direction in the parent's (rolled) frame, as
 * an angle; `gap` is centre-to-centre distance in world units.
 */
export function companion(
  parent: Spine, parentSpec: RibbonSpec, o: { u0: number; u1: number; angle: number; gap: number; peel?: [number, number]; width: number; kind: Kind; profile?: Profile; thick?: number; tube?: TubeOpts; seed?: number; sway?: number; steps?: number; follow?: boolean; spin?: number },
): RibbonSpec {
  const n = parent.P.length;
  const steps = o.steps ?? Math.max(8, Math.round((o.u1 - o.u0) * 40), Math.round((o.spin ?? 0) * 14));
  const pts: V3[] = [];
  const [pe0, pe1] = o.peel ?? [0, 0];
  for (let q = 0; q <= steps; q++) {
    const t = q / steps;
    const u = o.u0 + (o.u1 - o.u0) * t;
    const i = Math.min(n - 1, Math.round(u * (n - 1)));
    const P = parent.P[i];
    const th = (o.follow ? (parentSpec.roll ?? 0) + (parentSpec.twist ?? 0) * u : 0) + o.angle + (o.spin ?? 0) * Math.PI * 2 * t;
    const c = Math.cos(th), sn = Math.sin(th);
    const D = new Vector3().copy(parent.N[i]).multiplyScalar(c).addScaledVector(parent.B[i], sn);
    // peel: the gap opens up over the first / last 15 % of the run
    const pk = pe0 * Math.pow(Math.max(0, 1 - t / 0.18), 2) + pe1 * Math.pow(Math.max(0, (t - 0.82) / 0.18), 2);
    const g = o.gap + pk;
    pts.push([P.x + D.x * g, P.y + D.y * g, P.z + D.z * g]);
  }
  return {
    pts, width: o.width, profile: o.profile ?? "round", kind: o.kind, thick: o.thick ?? 1,
    tube: o.tube ?? { taper: [0.04, 0.12], end: "point" }, seed: o.seed ?? (parentSpec.seed ?? 0.5) + 0.0013, sway: o.sway ?? (parentSpec.sway ?? 1),
    ring: o.kind === 4 ? 6 : 12, swayU: [o.u0, o.u1], up: parentSpec.up,
  };
}
