// Background — ALLOY. The porcelain vocabulary (v1 CONTOUR, rebuilt in 3D).
//
// v1's weight hierarchy, in world units at depth 10 (1 unit ≈ 175 css px on
// a 1000 px tall window):
//   heavy   0.17–0.21  (≤ 2 per section)
//   medium  0.07–0.09
//   cable   0.03–0.045
//   wire    0.0065–0.008, solid ink (a hairline, no body)
// Tubes are constant width (r14), with cut, pointed or torn ends, and a
// piecewise width multiplier so an eccentric loop thins on its far side.
//
// The shard nucleus (r04 / r07 / e10): outlined white shards and splinters,
// black chips and short ink edge fragments, distributed with a Laplace
// falloff around the vortex core in the swirl plane, each oriented along the
// flow — so the detail is concentrated in the heart of the chrome mass and
// falls off hard with distance (r12).

import { mulberry32 } from "@/lib/generative";
import type { Kind, RibbonSpec, TubeOpts, V3 } from "./geometry";

export const W_HEAVY = 0.19;
export const W_MED = 0.08;
export const W_CABLE = 0.038;
export const W_WIRE = 0.0072;

export interface PTube {
  pts: V3[];
  w: number;
  thick?: number;
  taper?: [number, number];
  start?: TubeOpts["start"];
  end?: TubeOpts["end"];
  wmul?: [number, number][];
  seed: number;
  sway?: number;
  ink?: boolean;
  ring?: number;
  up?: V3;
}

/** A porcelain (or ink) tube as a RibbonSpec. */
export function tube(o: PTube): RibbonSpec {
  const ink = !!o.ink || o.w < 0.012;
  const ring = o.ring ?? (ink ? 6 : o.w > 0.14 ? 22 : o.w > 0.06 ? 16 : 12);
  return {
    pts: o.pts, width: o.w, profile: "round", kind: (ink ? 4 : 3) as Kind, thick: o.thick ?? 1,
    tube: { taper: o.taper ?? [0, 0.1], start: o.start ?? "cut", end: o.end ?? "point", wmul: o.wmul },
    seed: o.seed, sway: o.sway ?? 0.7, ring, up: o.up,
  };
}

/** A flat porcelain ribbon (one or more twists): lens profile, thin, constant width. */
export function pribbon(o: { pts: V3[]; w: number; twist: number; roll?: number; seed: number; sway?: number; taper?: [number, number]; up?: V3 }): RibbonSpec {
  return {
    pts: o.pts, width: o.w, profile: "lens", kind: 3, thick: 0.05, twist: o.twist, roll: o.roll ?? 0,
    tube: { taper: o.taper ?? [0, 0.12], start: "cut", end: "point" }, seed: o.seed, sway: o.sway ?? 0.6, ring: 9, up: o.up,
  };
}

export interface PlateSpec {
  c: V3;
  ring: V3[];
  kind: Kind;
  seed: number;
}

export interface NucleusOpts {
  axis: V3;
  center: V3;
  /** Laplace scale along the swirl plane / along the axis (world units). */
  r: number;
  flat?: number;
  shards: number;
  chips: number;
  splinters: number;
  frags: number;
  seed: number;
  /** Size multiplier. */
  scale?: number;
  /** 0..1: how strongly the splinters comb outward along the flow (r07's sheaves). */
  comb?: number;
  /** Fewer, larger pieces with clear silhouettes (reads at 1x, not as grey noise). */
  bold?: boolean;
}

type Rng = () => number;
const R = (rng: Rng, a: number, b: number) => a + (b - a) * rng();
function norm(v: V3): V3 { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function cross(a: V3, b: V3): V3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function add(a: V3, b: V3, s = 1): V3 { return [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s]; }
function gauss(rng: Rng) { return (rng() + rng() + rng() - 1.5) * 1.15; }

/** The shard nucleus: plates (shards, chips), splinter blades and ink fragments. */
export function nucleus(o: NucleusOpts): { plates: PlateSpec[]; blades: RibbonSpec[] } {
  const rng = mulberry32(o.seed);
  const A = norm(o.axis);
  const e1 = norm(cross(A, Math.abs(A[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
  const e2 = norm(cross(A, e1));
  const S = o.scale ?? 1;
  const flat = o.flat ?? 0.35;
  const lap = () => -Math.log(1 - rng() * 0.985) * 0.42;
  const place = (spread = 1) => {
    const rr = lap() * o.r * spread;
    const a = rng() * Math.PI * 2;
    const h = gauss(rng) * o.r * flat * spread * 0.6;
    const radial = add(add([0, 0, 0], e1, Math.cos(a)), e2, Math.sin(a));
    const p = add(add(o.center, radial, rr), A, h);
    // flow: around the axis (one direction), bending outward with distance
    const tan = cross(A, radial);
    const out = Math.min(0.75, (rr / o.r) * 0.35);
    const dir = norm(add(add(tan, radial, out), [gauss(rng) * 0.25, gauss(rng) * 0.25, gauss(rng) * 0.25]));
    return { p, dir, rn: rr / o.r };
  };
  const plates: PlateSpec[] = [];
  const blades: RibbonSpec[] = [];

  for (let q = 0; q < o.shards + o.chips; q++) {
    const chip = q >= o.shards;
    const { p, dir, rn } = place(chip ? 0.75 : 1);
    const size = (o.bold
      ? (chip ? 0.035 + Math.pow(rng(), 1.3) * 0.06 : 0.07 + Math.pow(rng(), 1.4) * 0.2 * (0.7 + 0.4 * Math.min(1.5, rn)))
      : (chip ? 0.009 + Math.pow(rng(), 1.6) * 0.05 : 0.02 + Math.pow(rng(), 2.2) * 0.17 * (0.6 + 0.5 * Math.min(1.5, rn)))) * S;
    const elong = o.bold ? R(rng, 1.3, 3.0) : R(rng, 1.4, 4.0);
    // plate normal: perpendicular to the flow, randomly rolled about it
    const side0 = norm(cross(dir, A));
    const up0 = norm(cross(side0, dir));
    const roll = R(rng, -1.2, 1.2);
    const side = norm(add([side0[0] * Math.cos(roll), side0[1] * Math.cos(roll), side0[2] * Math.cos(roll)], up0, Math.sin(roll)));
    const nv = 5 + Math.floor(rng() * 5);
    const angs = Array.from({ length: nv }, () => rng() * Math.PI * 2).sort((x, y) => x - y);
    const ring: V3[] = [];
    for (let j = 0; j < nv; j++) {
      let rr = size * R(rng, 0.45, 1);
      if (rng() < 0.18) rr *= 0.45;
      const lx = Math.cos(angs[j]) * rr * elong * 0.5, ly = Math.sin(angs[j]) * rr * 0.5;
      ring.push(add(add(p, dir, lx), side, ly));
    }
    plates.push({ c: p, ring, kind: chip ? 4 : 3, seed: rng() });
  }

  const comb = o.comb ?? 0;
  for (let q = 0; q < o.splinters; q++) {
    const pl = place(1.05);
    const { p, rn } = pl;
    // combed: the splinter leans outward from the core, every one bending the
    // same way round the axis, so the burst reads as a flow (r07), not rays
    const radial = norm([p[0] - o.center[0], p[1] - o.center[1], p[2] - o.center[2]]);
    const dir = norm(add(pl.dir, radial, comb * (0.6 + 0.8 * Math.min(1, rn))));
    const len = (o.bold ? 0.22 + Math.pow(rng(), 1.3) * 0.7 : 0.06 + Math.pow(rng(), 1.7) * 0.62) * (0.55 + 0.6 * Math.min(1.4, rn)) * S;
    const wmax = (o.bold ? 0.04 + Math.pow(rng(), 1.2) * 0.075 : 0.016 + Math.pow(rng(), 1.5) * 0.055) * S;
    const bend = gauss(rng) * 0.25;
    const side = norm(cross(dir, A));
    const n = 5;
    const pts: V3[] = [];
    let d = dir;
    let cur = add(p, dir, -len * 0.35);
    for (let j = 0; j <= n; j++) {
      pts.push(cur);
      const c = Math.cos(bend / n), s = Math.sin(bend / n);
      d = norm(add([d[0] * c, d[1] * c, d[2] * c], side, s));
      cur = add(cur, d, len / n);
    }
    const black = rng() < 0.06;
    blades.push({
      pts, width: wmax, profile: "lens", kind: black ? 4 : 3, thick: 0.18, a: R(rng, 0.35, 0.8), b: R(rng, 0.9, 1.6),
      twist: R(rng, -1.2, 1.2), roll: R(rng, 0, Math.PI), tear: rng() < 0.3 ? R(rng, 0.05, 0.2) : 0,
      seed: rng(), sway: 0.9, segs: 12, ring: 5, up: [rng() - 0.5, rng() - 0.5, 1],
    });
  }

  for (let q = 0; q < o.frags; q++) {
    const { p, dir } = place(1.2);
    const len = R(rng, 0.02, 0.1) * S;
    const pts: V3[] = [p];
    let d = dir, cur = p;
    for (let j = 0; j < 3; j++) {
      d = norm(add(d, [gauss(rng) * 0.5, gauss(rng) * 0.5, gauss(rng) * 0.5]));
      cur = add(cur, d, len / 3);
      pts.push(cur);
    }
    blades.push({
      pts, width: W_WIRE * R(rng, 0.7, 1.0) * S, profile: "round", kind: 4, tube: { taper: [0.2, 0.3], start: "cut", end: "point" },
      seed: rng(), sway: 1, segs: 8, ring: 5,
    });
  }
  return { plates, blades };
}

/**
 * A combed sheaf (r07): long outlined slivers leaving the core in one
 * direction, every one bending the same way, widths tiling down to needles.
 */
export function sheaf(o: { from: V3; dir: V3; axis: V3; n: number; len: [number, number]; w: [number, number]; spread: number; bend: number; seed: number; jitter?: number }): RibbonSpec[] {
  const rng = mulberry32(o.seed);
  const D0 = norm(o.dir);
  const A = norm(o.axis);
  const out: RibbonSpec[] = [];
  const rot = (v: V3, ax: V3, a: number): V3 => {
    // Rodrigues
    const c = Math.cos(a), s = Math.sin(a);
    const k = ax, d = v[0] * k[0] + v[1] * k[1] + v[2] * k[2];
    const cr = cross(k, v);
    return [v[0] * c + cr[0] * s + k[0] * d * (1 - c), v[1] * c + cr[1] * s + k[1] * d * (1 - c), v[2] * c + cr[2] * s + k[2] * d * (1 - c)];
  };
  const side = norm(cross(D0, A));
  const j = o.jitter ?? 0.12;
  for (let i = 0; i < o.n; i++) {
    const a = gauss(rng) * o.spread;
    let d = norm(rot(D0, A, a));
    d = norm(add(d, side, gauss(rng) * 0.12));
    const L = R(rng, o.len[0], o.len[1]) * (0.7 + 0.5 * Math.pow(rng(), 0.6));
    const bend = o.bend * (0.4 + 0.6 * rng());
    let p = add(add(o.from, [gauss(rng) * j, gauss(rng) * j, gauss(rng) * j * 0.6]), d, R(rng, 0.05, 0.25));
    const pts: V3[] = [p];
    for (let k = 1; k <= 5; k++) {
      d = norm(rot(d, A, bend / 5));
      p = add(p, d, L / 5);
      pts.push(p);
    }
    const w = R(rng, o.w[0], o.w[1]) * (rng() < 0.25 ? 0.5 : 1);
    out.push({
      pts, width: w, profile: "lens", kind: rng() < 0.06 ? 4 : 3, thick: 0.16,
      a: R(rng, 0.3, 0.6), b: R(rng, 1.1, 1.8), twist: R(rng, -0.8, 0.8), roll: R(rng, 0, Math.PI),
      tear: rng() < 0.35 ? R(rng, 0.05, 0.22) : 0, seed: rng(), sway: 0.9, segs: 20, ring: 5, up: A,
    });
  }
  return out;
}
