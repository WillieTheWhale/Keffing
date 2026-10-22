// Background — ALLOY. The authored 3D composition (v2 CHROME's groups, with
// v1 CONTOUR's porcelain woven through them and a shard nucleus at the heart
// of each mass).
//
// Units: group-local world units. Groups sit at depth `depth` in front of
// the camera; at depth 10 one unit is ~1/5.7 of the viewport height
// (~175 css px on a 1000 px tall window). Hand-placed: every long gesture,
// every section piece. Generated (fixed seed): only the inner tangle of the
// two masses and the splinter streams.

import { createNoise3D } from "simplex-noise";
import { mulberry32 } from "@/lib/generative";
import type { Kind, Profile, RibbonSpec, TubeOpts, V3 } from "./geometry";
import { nucleus, pribbon, sheaf, tube, W_CABLE, W_MED, W_WIRE, type PlateSpec } from "./porcelain";
import { withBase } from "@/lib/basePath";

export interface ShardSpec {
  pos: V3;
  dir: V3;       // long axis
  len: number;
  wid: number;
  thick: number;
  kind: Kind;
  spin: number;  // tumble rad/s
  drift: number; // slide amplitude along the axis
  pill?: boolean;
}

export interface PieceSet {
  /** Rotating core (the vortex) — spun slowly around `axis`. */
  core: RibbonSpec[];
  /** Static arms (sway only). */
  arms: RibbonSpec[];
  shards: ShardSpec[];
  /** Tine requests: [index into arms, from, count, spread, width]. */
  splits?: { arm: number; from: number; count: number; spread: number; width: number; extend?: number; lift?: number }[];
  /** Outlined porcelain shards and black chips (rotate with the core). */
  plates?: PlateSpec[];
  /** Porcelain pieces that rotate with the core (nucleus splinters, fragments). */
  coreP?: RibbonSpec[];
  /** Companions grown from an arm's spine after it is built. */
  comps?: CompReq[];
  /** A graphite smudge plane inside the mass. */
  graphite?: { src: string; pos: V3; size: [number, number]; alpha: number };
}

export interface CompReq {
  arm: number;
  u0: number; u1: number;
  angle: number;
  gap: number;
  peel?: [number, number];
  width: number;
  kind: Kind;
  follow?: boolean;
  spin?: number;
  tube?: TubeOpts;
}

export type SectionId = "hero" | "about" | "work" | "stuff" | "experience" | "contact" | "dive";

export interface GroupDef {
  id: string;
  /** Section and fraction through it whose centring scroll position is "home". */
  section: SectionId;
  t: number;
  /** Viewport anchor at home (fractions) and distance from the camera. */
  anchor: [number, number];
  depth: number;
  /** Portrait / narrow override for the anchor and a scale factor. */
  narrow?: { anchor: [number, number]; scale: number };
  /** Scale on landscape viewports (default 1; inner pages size to their free space). */
  scale?: number;
  /** Vortex axis for the core spin, rad/s. */
  axis?: V3;
  spin?: number;
  /** Breathing tilt amplitude (rad). */
  breathe?: number;
  /** Scroll window (in vh relative to home) where the group is present. */
  window: [number, number];
  /** Haze toward paper (0..1), depth cue. */
  haze?: number;
  sway?: number;
  build: () => PieceSet;
}

// ─── helpers ────────────────────────────────────────────────

type Rng = () => number;
const R = (rng: Rng, a: number, b: number) => a + (b - a) * rng();
const pick = <T,>(rng: Rng, xs: T[]) => xs[Math.floor(rng() * xs.length) % xs.length];

function norm(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function add(a: V3, b: V3, s = 1): V3 { return [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s]; }

interface VortexOpts {
  axis: V3;
  /** offset of the vortex centre inside the group */
  center?: V3;
  sheets: number;
  blades: number;
  slivers: number;
  wires: number;
  rMax: number;
  /** probability a piece is white chrome / glass */
  white: number;
  glass: number;
  /** curl-noise strength relative to the swirl (organic-ness) */
  turbulence?: number;
  /** No glass (and little ice) for pieces seeded inside this radius fraction —
   *  the centre reads as dark chrome around the shard nucleus, not grey glass. */
  clearCore?: number;
  /** Blades and slivers are seeded outside this radius fraction, leaving the
   *  heart of the vortex open for the shard nucleus. */
  hollow?: number;
  seed: number;
}

/**
 * The dense nucleus: streamlines of a vortex flow field (swirl around a
 * tilted axis + outward drift + flattening toward the swirl plane + curl
 * noise). Every ribbon follows the same current — the mass has ONE
 * direction of flow — but no two paths are concentric.
 */
function vortex(o: VortexOpts): RibbonSpec[] {
  const rng = mulberry32(o.seed);
  const nx = createNoise3D(rng), ny = createNoise3D(rng), nz = createNoise3D(rng);
  const A = norm(o.axis);
  const C: V3 = o.center ?? [0, 0, 0];
  const turb = o.turbulence ?? 0.5;
  const F = 0.55 / o.rMax; // noise frequency
  const curl = (p: V3): V3 => {
    const e = 0.05;
    const x = p[0] * F, y = p[1] * F, z = p[2] * F;
    const dPz_dy = (nz(x, y + e, z) - nz(x, y - e, z)) / (2 * e), dPy_dz = (ny(x, y, z + e) - ny(x, y, z - e)) / (2 * e);
    const dPx_dz = (nx(x, y, z + e) - nx(x, y, z - e)) / (2 * e), dPz_dx = (nz(x + e, y, z) - nz(x - e, y, z)) / (2 * e);
    const dPy_dx = (ny(x + e, y, z) - ny(x - e, y, z)) / (2 * e), dPx_dy = (nx(x, y + e, z) - nx(x, y - e, z)) / (2 * e);
    return [dPz_dy - dPy_dz, dPx_dz - dPz_dx, dPy_dx - dPx_dy];
  };
  const field = (p: V3): V3 => {
    const d: V3 = [p[0] - C[0], p[1] - C[1], p[2] - C[2]];
    const h = d[0] * A[0] + d[1] * A[1] + d[2] * A[2];
    const radial: V3 = [d[0] - A[0] * h, d[1] - A[1] * h, d[2] - A[2] * h];
    const r = Math.hypot(radial[0], radial[1], radial[2]) + 1e-4;
    const rn = r / o.rMax;
    const tan = cross(A, radial);
    const sw = 1.0 / (0.35 + rn);          // swirl strongest inside
    const out = 0.18 + 0.35 * rn;          // outward drift grows with radius
    const c = curl(p);
    let v: V3 = [0, 0, 0];
    v = add(v, tan, sw / r);
    v = add(v, radial, out / r);
    v = add(v, A, -1.2 * h / o.rMax);      // flatten toward the plane
    v = add(v, c, turb * (0.6 + rn));
    return norm(v);
  };
  const trace = (seed: V3, back: number, fwd: number, step = 0.025): V3[] => {
    const pts: V3[] = [];
    const run = (dir: number, L: number) => {
      const out: V3[] = [];
      let p = seed;
      for (let s = 0; s < L; s += step) {
        const v = field(p);
        p = add(p, v, step * dir);
        out.push(p);
      }
      return out;
    };
    const b = run(-1, back).reverse();
    const f = run(1, fwd);
    const all = [...b, seed, ...f];
    // resample to control points every ~0.18 units
    const every = Math.max(1, Math.round(0.18 / step));
    for (let i = 0; i < all.length; i += every) pts.push(all[i]);
    if (pts[pts.length - 1] !== all[all.length - 1]) pts.push(all[all.length - 1]);
    return pts;
  };
  let lastR = 1;
  const seedPt = (rMin: number, rMaxS: number): V3 => {
    const e1 = norm(cross(A, [0, 0, 1]));
    const e2 = norm(cross(A, e1));
    const rf = rMin + (rMaxS - rMin) * Math.sqrt(rng());
    lastR = rf;
    const r = rf * o.rMax;
    const a = rng() * Math.PI * 2;
    const h = (rng() - 0.5) * 0.5 * o.rMax;
    return add(add(add(C, e1, r * Math.cos(a)), e2, r * Math.sin(a)), A, h);
  };
  const kindOf = (forceGlass = false): Kind => {
    if (forceGlass) return 2;
    const x = rng();
    const inner = lastR < (o.clearCore ?? 0);
    const g = inner ? 0 : o.glass, w = inner ? o.white * 0.3 : o.white;
    return x < g ? 2 : x < g + w ? 1 : 0;
  };
  const out: RibbonSpec[] = [];

  for (let i = 0; i < o.sheets; i++) {
    const pts = trace(seedPt(0.25, 0.7), R(rng, 0.2, 0.6) * o.rMax, R(rng, 0.9, 1.8) * o.rMax);
    out.push({
      pts, width: R(rng, 0.3, 0.55) * o.rMax, profile: pick<Profile>(rng, ["crescent", "sheet", "crescent"]),
      kind: kindOf(i === 1 && lastR >= (o.clearCore ?? 0)), bow: R(rng, 0.6, 1.6), curl: R(rng, 0, 1.2), wave: R(rng, 0.2, 0.7), thick: 0.06,
      twist: R(rng, 0.4, 1.2) * Math.PI * (rng() < 0.5 ? -1 : 1), roll: R(rng, 0, Math.PI),
      a: R(rng, 0.5, 0.9), b: R(rng, 0.9, 1.5), tear: R(rng, 0, 0.18), serrate: rng() < 0.45 ? R(rng, 0.2, 0.5) : 0,
      teeth: Math.round(R(rng, 5, 11)), seed: rng(), sway: 0.6, up: [rng() - 0.5, rng() - 0.5, 1],
    });
  }
  for (let i = 0; i < o.blades; i++) {
    const pts = trace(seedPt(Math.max(0.05, o.hollow ?? 0), 0.8), R(rng, 0.2, 0.8) * o.rMax, R(rng, 0.9, 2.4) * o.rMax);
    out.push({
      pts, width: R(rng, 0.08, 0.2) * o.rMax, profile: pick<Profile>(rng, ["lens", "plano", "tear", "lens", "crescent"]),
      kind: kindOf(), bow: R(rng, 0.3, 1.0), thick: R(rng, 0.08, 0.16),
      twist: R(rng, 1, 3.2) * Math.PI * (rng() < 0.5 ? -1 : 1), roll: R(rng, 0, Math.PI),
      a: R(rng, 0.35, 0.8), b: R(rng, 1.0, 2.2), tear: R(rng, 0, 0.25), serrate: rng() < 0.35 ? R(rng, 0.25, 0.6) : 0,
      teeth: Math.round(R(rng, 6, 14)), seed: rng(), sway: 0.8, up: [rng() - 0.5, rng() - 0.5, 1],
    });
  }
  for (let i = 0; i < o.slivers; i++) {
    const escape = rng() < 0.35;
    const pts = trace(seedPt(o.hollow ?? 0, 0.9), R(rng, 0.1, 0.6) * o.rMax, (escape ? R(rng, 2.2, 3.4) : R(rng, 0.7, 1.8)) * o.rMax);
    out.push({
      pts, width: R(rng, 0.02, 0.06) * o.rMax, profile: pick<Profile>(rng, ["lens", "lens", "plano", "tear"]),
      kind: kindOf(), thick: R(rng, 0.12, 0.22),
      twist: R(rng, 0.5, 2.5) * Math.PI, roll: R(rng, 0, Math.PI),
      a: R(rng, 0.4, 1.0), b: R(rng, 1.0, 2.4), tear: R(rng, 0, 0.2), seed: rng(), sway: 1,
    });
  }
  for (let i = 0; i < o.wires; i++) {
    const pts = trace(seedPt(0.3, 0.9), R(rng, 0.5, 1.0) * o.rMax, R(rng, 1.6, 3.0) * o.rMax);
    out.push({
      pts, width: R(rng, 0.006, 0.012) * o.rMax, profile: "round", kind: 0, a: 0.12, b: 0.25, seed: rng(), sway: 1, ring: 8,
    });
  }
  return out;
}

interface StreamOpts {
  from: V3;
  /** control points of the outflow path (local) */
  path: V3[];
  count: number;
  size: [number, number];
  spread: number;
  white: number;
  glass: number;
  seed: number;
  pills?: number;
}

/** Splinters thrown off along an outflow path, thinning and shrinking. */
function stream(o: StreamOpts): ShardSpec[] {
  const rng = mulberry32(o.seed);
  const pts = [o.from, ...o.path];
  const at = (t: number): [V3, V3] => {
    const f = t * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(f));
    const s = f - i;
    const a = pts[i], b = pts[i + 1];
    const p: V3 = [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s];
    return [p, norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]])];
  };
  const out: ShardSpec[] = [];
  for (let i = 0; i < o.count; i++) {
    const t = Math.pow(rng(), 1.35);
    const [p, d] = at(t);
    const sp = o.spread * (0.3 + t * 1.2);
    const pos: V3 = [p[0] + R(rng, -sp, sp), p[1] + R(rng, -sp, sp), p[2] + R(rng, -sp, sp) * 0.8];
    const dir = norm([d[0] + R(rng, -0.6, 0.6), d[1] + R(rng, -0.6, 0.6), d[2] + R(rng, -0.6, 0.6)]);
    const size = (o.size[0] + (o.size[1] - o.size[0]) * Math.pow(rng(), 2.2)) * (1.15 - t * 0.6);
    const x = rng();
    const pill = (o.pills ?? 0) > 0 && rng() < (o.pills ?? 0);
    out.push({
      pos, dir, len: pill ? size * 0.55 : size, wid: pill ? size * 0.16 : size * R(rng, 0.05, 0.15), thick: R(rng, 0.25, 0.5),
      kind: x < o.glass ? 2 : x < o.glass + o.white ? 1 : 0,
      spin: R(rng, 0.05, 0.22) * (rng() < 0.5 ? -1 : 1), drift: R(rng, 0.0, 0.05), pill,
    });
  }
  return out;
}

// ─── The hero ───────────────────────────────────────────────
// Anchor = FOCAL (0.66, 0.31) at depth 10. On a 16:10 window the viewport
// spans local x ∈ [-6.05, 3.1], y ∈ [-3.95, 1.78]; the name occupies roughly
// x ∈ [-3.1, 0.75], y ∈ [-1.5, -0.2]. The shader pulls chrome behind the
// letters toward white and lightens porcelain contours there (nameMask).

const HERO_AXIS: V3 = [-0.42, 0.62, 0.66];
const HERO_C: V3 = [0.05, 0.18, 0];

function heroSet(): PieceSet {
  const core = vortex({
    axis: HERO_AXIS, center: HERO_C,
    sheets: 7, blades: 22, slivers: 13, wires: 5, rMax: 1.2,
    white: 0.08, glass: 0.1, clearCore: 0.5, hollow: 0.34, seed: 7101,
  });
  const nuc = nucleus({ axis: HERO_AXIS, center: [0.08, 0.16, 0.24], r: 0.8, flat: 0.3, shards: 34, chips: 14, splinters: 26, frags: 0, seed: 7171, scale: 1.0, comb: 0.55, bold: true });

  const arms: RibbonSpec[] = [
    // 0 — the great sweep: drops past the right of the name, cradles the
    //     whole text block from below, and runs off the left edge
    {
      pts: [[0.45, -0.05, 0.3], [0.95, -1.0, 0.55], [0.6, -2.3, 0.75], [-0.8, -2.95, 0.8], [-2.6, -2.85, 0.6], [-4.4, -2.2, 0.2], [-6.3, -1.15, -0.4]],
      width: 0.48, profile: "sheet", kind: 0, bow: 0.9, curl: 0.4, wave: 0.6, thick: 0.07, twist: Math.PI * 2.6, roll: 0.4,
      a: 0.55, b: 0.85, tear: 0.12, serrate: 0.35, teeth: 7, seed: 0.11, sway: 0.5, up: [0, 1, 0.3],
    },
    // 1 — the upper arc: a dark blade lifting up and over to the top edge
    {
      pts: [[0.1, 0.35, 0.1], [-0.5, 1.15, 0.3], [-1.45, 2.05, 0.1], [-2.15, 2.75, -0.3], [-2.55, 3.6, -0.7]],
      width: 0.26, profile: "lens", kind: 0, thick: 0.11, twist: Math.PI * 2.2, roll: 1.2,
      a: 0.5, b: 1.3, tear: 0.2, seed: 0.23, sway: 0.7,
    },
    // 2 — the plunge: down-right, out through the lower right edge, splitting into tines
    {
      pts: [[0.45, -0.15, 0.2], [1.3, -1.0, 0.4], [2.2, -2.0, 0.35], [2.95, -3.0, 0.1], [3.6, -3.95, -0.2]],
      width: 0.3, profile: "tear", kind: 0, thick: 0.12, twist: Math.PI * 1.6, roll: 0.2,
      a: 0.5, b: 0.8, seed: 0.37, sway: 0.6,
    },
    // 3 — the loop-back: a thin ice blade that runs right, curls back on itself, exits right
    {
      pts: [[0.6, 0.35, 0.0], [1.85, 0.95, 0.35], [2.75, 0.35, 0.5], [2.45, -0.55, 0.3], [1.55, -0.35, 0.1], [1.95, 0.55, -0.1], [3.4, 1.35, -0.3], [5.6, 1.9, -0.6]],
      width: 0.15, profile: "plano", kind: 1, thick: 0.12, twist: Math.PI * 2.6, roll: 0.0,
      a: 0.4, b: 1.4, tear: 0.15, seed: 0.41, sway: 0.8,
    },
    // 4 — the long needle to the top-right corner (a hairline coils around it)
    {
      pts: [[0.45, 0.6, -0.1], [1.35, 1.55, -0.2], [2.6, 2.55, -0.45], [3.9, 3.4, -0.8]],
      width: 0.085, profile: "lens", kind: 0, thick: 0.16, twist: Math.PI * 1.2,
      a: 0.6, b: 1.8, seed: 0.53, sway: 0.9,
    },
    // 5 — a glass petal flaring off the right side of the mass (r16)
    {
      pts: [[0.55, 0.05, 0.1], [1.25, 0.2, 0.55], [2.05, -0.15, 0.85], [2.75, -0.75, 0.7]],
      width: 0.75, profile: "crescent", kind: 2, bow: 1.4, curl: 1.4, thick: 0.05, twist: Math.PI * 0.55, roll: 1.3,
      a: 0.9, b: 1.1, tear: 0.1, serrate: 0.25, teeth: 6, seed: 0.61, sway: 0.5,
    },
    // 6 — a wide dark sheet behind the mass, top (the r01 swell)
    {
      pts: [[-0.85, 0.75, -0.6], [-0.1, 1.25, -0.4], [0.85, 1.2, -0.3], [1.6, 0.65, -0.35]],
      width: 0.7, profile: "sheet", kind: 0, bow: 1.0, thick: 0.05, twist: Math.PI * 0.7, roll: 0.2,
      a: 0.8, b: 1.0, tear: 0.15, seed: 0.67, sway: 0.4,
    },
    // 7 — long thin wire crossing the frame behind everything (slight sag)
    {
      pts: [[-8.5, 2.4, -2.5], [-3.0, 1.75, -2.4], [2.5, 1.05, -2.2], [8.5, 0.15, -2.0]],
      width: 0.022, profile: "round", kind: 0, a: 0.02, b: 0.02, seed: 0.71, sway: 0.15, ring: 8,
    },
    // 8 — second wire, steeper, crossing the lower right
    {
      pts: [[-1.2, 3.6, -1.6], [0.8, 0.9, -1.4], [2.5, -1.6, -1.2], [4.0, -3.9, -1.0]],
      width: 0.016, profile: "round", kind: 0, a: 0.02, b: 0.02, seed: 0.79, sway: 0.2, ring: 8,
    },
    // 9 — pill droplets near the mass (e02)
    {
      pts: [[1.15, -0.75, 0.6], [1.32, -1.12, 0.65]],
      width: 0.11, profile: "round", kind: 0, a: 0.5, b: 0.5, seed: 0.83, sway: 1, ring: 14, segs: 24,
    },
    {
      pts: [[-0.75, 0.95, 0.5], [-0.98, 1.08, 0.55]],
      width: 0.07, profile: "round", kind: 0, a: 0.5, b: 0.5, seed: 0.87, sway: 1, ring: 12, segs: 20,
    },

    // ── porcelain (v1's hierarchy, threaded through the chrome) ──
    // 11 — P1, the heavy porcelain tube: enters from the right edge across
    //      the open sky of the mounted panel (white on cobalt), passes IN
    //      FRONT of the ice loop-back, BEHIND the vortex's front blades,
    //      leaves the mass under the great sweep's root, crosses OVER the
    //      plunge, and finishes in a long eccentric hook that thins on its
    //      far side and slides back UNDER the plunge, ending torn.
    tube({
      pts: [[3.6, 1.05, -0.05], [2.6, 0.82, 0.32], [1.6, 0.6, 0.5], [0.85, 0.38, 0.2], [0.3, 0.12, -0.12], [0.08, -0.42, -0.28], [0.4, -1.08, 0.12],
        [1.12, -1.5, 0.62], [1.95, -1.78, 0.78], [2.7, -2.22, 0.6], [2.98, -2.95, 0.3], [2.6, -3.4, 0.0], [2.05, -3.0, -0.3], [1.9, -2.42, -0.4]],
      w: 0.25, seed: 0.141, sway: 0.4, start: "open", end: "torn", taper: [0, 0],
      wmul: [[0, 1], [0.58, 1], [0.76, 0.72], [0.9, 0.55], [1, 0.58]],
    }),
    // 12 — P3, a thin cable arcing out of the mass over the top-left (a hairline rides it)
    tube({
      pts: [[-0.15, 0.55, 0.38], [-0.9, 1.12, 0.48], [-2.0, 1.42, 0.42], [-3.1, 1.5, 0.25], [-4.1, 1.78, 0.05], [-4.9, 2.3, -0.1]],
      w: W_CABLE, seed: 0.233, sway: 0.8, taper: [0.06, 0.12], start: "cut", end: "point",
    }),
    // 13 — P4, a flat porcelain ribbon with one twist, falling from the top
    //      edge into the mass, behind the upper arc
    pribbon({
      pts: [[-0.95, 2.45, -0.38], [-0.72, 1.72, -0.28], [-0.38, 1.05, -0.14], [-0.08, 0.56, -0.02], [0.12, 0.26, 0.04]],
      w: 0.15, twist: Math.PI * 1.0, roll: 0.35, seed: 0.313, sway: 0.5, taper: [0, 0.3],
    }),
  ];

  const shards = [
    ...stream({ from: [0.6, -0.1, 0.2], path: [[1.6, -0.6, 0.5], [2.8, -1.4, 0.6], [4.4, -2.0, 0.3]], count: 110, size: [0.04, 0.32], spread: 0.28, white: 0.2, glass: 0.15, seed: 31, pills: 0.06 }),
    ...stream({ from: [-0.3, 0.6, 0.1], path: [[-1.1, 1.3, 0.3], [-2.1, 1.6, 0.2], [-3.4, 1.5, -0.2]], count: 64, size: [0.03, 0.24], spread: 0.22, white: 0.35, glass: 0.2, seed: 37 }),
    ...stream({ from: [0.0, 0.0, 0.0], path: [[0.5, 0.6, 0.4], [-0.4, 0.5, 0.6], [0.2, -0.3, 0.6]], count: 18, size: [0.02, 0.14], spread: 0.45, white: 0.15, glass: 0.0, seed: 41, pills: 0.08 }),
  ];

  return {
    core, arms, shards,
    splits: [{ arm: 2, from: 0.62, count: 3, spread: 0.32, width: 0.12, extend: 0.6, lift: 0.15 }],
    plates: nuc.plates,
    coreP: [
      ...nuc.blades,
      // a combed sheaf of long outlined slivers leaving the heart up and to the
      // left, over the typed sky (r07 / r04), every one bending the same way
      ...sheaf({ from: [-0.05, 0.28, 0.3], dir: [-0.82, 0.52, 0.12], axis: HERO_AXIS, n: 17, len: [0.5, 1.55], w: [0.03, 0.085], spread: 0.32, bend: 0.55, seed: 7191 }),
      // and a shorter one down the right, into the sky panel
      ...sheaf({ from: [0.3, 0.05, 0.3], dir: [0.75, -0.35, 0.2], axis: HERO_AXIS, n: 8, len: [0.35, 0.95], w: [0.025, 0.07], spread: 0.28, bend: 0.45, seed: 7193 }),
    ],
    comps: [
      // companions of P1: a cable along its outer side, a hairline coiling round it
      { arm: 11, u0: 0.02, u1: 0.46, angle: 1.35, gap: 0.19, peel: [0.0, 0.42], width: W_CABLE * 1.15, kind: 3, tube: { taper: [0, 0.18], start: "cut", end: "point" } },
      { arm: 11, u0: 0.5, u1: 0.84, angle: 0.0, gap: 0.16, width: W_WIRE, kind: 4, spin: 1.6, tube: { taper: [0.05, 0.1], start: "cut", end: "point" } },
      // P2 — a porcelain cable laid along the great sweep's inner edge, peeling away at both ends
      { arm: 0, u0: 0.34, u1: 0.8, angle: Math.PI * 0.5, gap: 0.24, peel: [0.2, 0.05], width: W_MED, kind: 3, tube: { taper: [0, 0.2], start: "cut", end: "point" } },
      // a hairline riding P3
      { arm: 12, u0: 0.12, u1: 0.86, angle: 0.4, gap: 0.05, peel: [0.04, 0.12], width: W_WIRE, kind: 4, tube: { taper: [0.05, 0.1], start: "cut", end: "point" } },
      // a hairline coiling around the needle
      { arm: 4, u0: 0.04, u1: 0.7, angle: 0, gap: 0.062, width: W_WIRE, kind: 4, spin: 4.5, tube: { taper: [0.03, 0.08], start: "cut", end: "point" } },
    ],
    graphite: { src: withBase("/assets/background/graphite-nucleus.png"), pos: [1.5, 0.48, -0.08], size: [1.5, 1.65], alpha: 1.0 },
  };
}

// ─── Contact: the second mass ───────────────────────────────

const CONTACT_AXIS: V3 = [0.5, 0.55, 0.67];

function contactSet(): PieceSet {
  const core = vortex({
    axis: CONTACT_AXIS,
    sheets: 6, blades: 17, slivers: 18, wires: 4, rMax: 1.05,
    white: 0.12, glass: 0.12, clearCore: 0.45, hollow: 0.3, seed: 9203,
  });
  const nuc = nucleus({ axis: CONTACT_AXIS, center: [0, 0, 0.2], r: 0.66, flat: 0.3, shards: 34, chips: 12, splinters: 34, frags: 0, seed: 9271, scale: 0.9, comb: 0.5, bold: true });
  const arms: RibbonSpec[] = [
    // sweeping down-left behind the heading's tail, off the bottom
    {
      pts: [[-0.2, -0.2, 0.2], [-1.0, -1.1, 0.5], [-1.6, -2.4, 0.5], [-1.7, -3.9, 0.1]],
      width: 0.42, profile: "crescent", kind: 1, bow: 1.0, curl: 0.5, thick: 0.07, twist: Math.PI * 1.1,
      a: 0.55, b: 0.9, tear: 0.12, serrate: 0.3, teeth: 7, seed: 0.13, sway: 0.5,
    },
    // up and out of the top
    {
      pts: [[0.2, 0.3, 0.0], [0.6, 1.2, 0.2], [0.4, 2.2, 0.1], [0.9, 3.4, -0.2]],
      width: 0.2, profile: "lens", kind: 0, thick: 0.11, twist: Math.PI * 2.0, roll: 0.6,
      a: 0.5, b: 1.3, tear: 0.2, seed: 0.29, sway: 0.7,
    },
    // a long needle across to the right edge
    {
      pts: [[0.4, -0.1, 0.1], [1.4, -0.3, 0.2], [2.6, -0.2, -0.1], [3.8, 0.2, -0.4]],
      width: 0.1, profile: "plano", kind: 0, thick: 0.14, twist: Math.PI * 1.4,
      a: 0.5, b: 1.6, seed: 0.47, sway: 0.9,
    },
    // glass petal
    {
      pts: [[-0.4, 0.2, 0.2], [-1.1, 0.55, 0.5], [-1.8, 0.4, 0.6], [-2.3, -0.1, 0.4]],
      width: 0.55, profile: "crescent", kind: 2, bow: 1.3, curl: 1.2, thick: 0.05, twist: Math.PI * 0.5, roll: 0.8,
      a: 0.9, b: 1.1, tear: 0.1, serrate: 0.2, seed: 0.59, sway: 0.5,
    },
    // a wire crossing
    {
      pts: [[-6, 1.6, -2.0], [-1.5, 0.95, -1.8], [3, 0.2, -1.6], [7, -0.5, -1.5]],
      width: 0.018, profile: "round", kind: 0, a: 0.02, b: 0.02, seed: 0.73, sway: 0.15, ring: 8,
    },
    // 5 — the heavy porcelain echo: from the top edge through the vortex,
    //     down the right of the contact card and an eccentric loop in the
    //     lower right corner, ending torn
    tube({
      pts: [[0.85, 2.3, -0.3], [0.62, 1.4, -0.05], [0.3, 0.55, 0.06], [0.12, -0.15, -0.04], [0.55, -0.75, 0.25], [1.0, -1.55, 0.35], [1.15, -2.45, 0.3],
        [0.95, -3.2, 0.15], [1.55, -3.55, 0.0], [2.1, -3.05, -0.1], [1.85, -2.6, -0.2], [1.4, -2.9, -0.1], [1.6, -3.7, 0.05]],
      w: 0.17, seed: 0.517, sway: 0.4, start: "cut", end: "torn", taper: [0, 0],
      wmul: [[0, 1], [0.6, 1], [0.78, 0.66], [1, 0.8]],
    }),
    // 6 — a cable out of the mass, up and off the top-left (well above the heading)
    tube({
      pts: [[-0.25, 0.45, 0.3], [-1.1, 1.2, 0.4], [-2.3, 1.62, 0.3], [-3.7, 1.86, 0.1], [-4.9, 2.4, -0.1]],
      w: W_CABLE, seed: 0.613, sway: 0.8, taper: [0.05, 0.2], start: "cut", end: "point",
    }),
  ];
  const shards = [
    ...stream({ from: [0.3, -0.2, 0.2], path: [[1.1, -0.9, 0.4], [2.0, -1.6, 0.3], [3.2, -2.1, 0.0]], count: 72, size: [0.03, 0.26], spread: 0.25, white: 0.2, glass: 0.15, seed: 53, pills: 0.06 }),
    ...stream({ from: [-0.2, 0.3, 0.1], path: [[-0.9, 0.9, 0.3], [-1.9, 1.3, 0.2]], count: 40, size: [0.03, 0.2], spread: 0.2, white: 0.3, glass: 0.2, seed: 59 }),
  ];
  return {
    core, arms, shards, splits: [{ arm: 0, from: 0.66, count: 2, spread: 0.25, width: 0.14, extend: 0.4 }],
    plates: nuc.plates, coreP: nuc.blades,
    comps: [
      { arm: 6, u0: 0.1, u1: 0.9, angle: 0.3, gap: 0.05, peel: [0.03, 0.1], width: W_WIRE, kind: 4, tube: { taper: [0.05, 0.1], start: "cut", end: "point" } },
      { arm: 5, u0: 0.18, u1: 0.62, angle: Math.PI * 0.5, gap: 0.16, peel: [0.12, 0.3], width: W_CABLE, kind: 3, tube: { taper: [0.08, 0.2], start: "cut", end: "point" } },
    ],
    graphite: { src: withBase("/assets/background/graphite-contact.png"), pos: [0.98, -0.32, -0.12], size: [1.2, 1.1], alpha: 0.92 },
  };
}

// ─── Section margin pieces (quiet) ──────────────────────────

function aboutSet(): PieceSet {
  // near silence: one glass blade and one dark sliver crossing the bottom-right
  // corner, and one porcelain ribbon with a single twist that ends in a point
  // shedding a few outlined splinters (v1's bio)
  const nuc = nucleus({ axis: [0.2, 0.3, 0.93], center: [-3.75, -0.85, 0.1], r: 0.16, shards: 8, chips: 3, splinters: 9, frags: 5, seed: 3301, scale: 0.8 });
  return {
    core: [],
    arms: [
      {
        pts: [[2.2, 0.55, -0.3], [0.9, 0.12, 0.0], [-0.5, -0.35, 0.2], [-1.6, -1.0, 0.1], [-2.5, -1.9, -0.2]],
        width: 0.26, profile: "crescent", kind: 2, bow: 1.0, curl: 0.5, thick: 0.07, twist: Math.PI * 1.3, roll: 0.3,
        a: 0.6, b: 1.0, tear: 0.18, serrate: 0.3, seed: 0.19, sway: 0.6,
      },
      {
        pts: [[2.2, 0.15, -0.2], [1.1, -0.15, 0.05], [0.1, -0.6, 0.1], [-0.7, -1.3, 0.0]],
        width: 0.06, profile: "lens", kind: 0, thick: 0.15, twist: Math.PI * 1.6, a: 0.5, b: 1.6, seed: 0.31, sway: 0.9,
      },
      // behind the bio card, out under its bottom edge, ending in a point
      pribbon({
        pts: [[2.3, 1.25, -0.2], [0.7, 0.35, 0.0], [-1.1, -0.52, 0.1], [-2.5, -0.95, 0.15], [-3.8, -0.84, 0.05]],
        w: 0.105, twist: Math.PI, roll: 0.2, seed: 0.331, sway: 0.6, taper: [0, 0.3],
      }),
    ],
    shards: stream({ from: [0.2, -0.3, 0.1], path: [[-0.4, -0.5, 0.2], [-1.0, -0.6, 0.1]], count: 9, size: [0.03, 0.12], spread: 0.15, white: 0.4, glass: 0.3, seed: 61 }),
    plates: nuc.plates, coreP: nuc.blades,
  };
}

function workTopSet(): PieceSet {
  // three blades crossing the navy panel at the top right and leaving the
  // frame; a porcelain cable weaves over and under them, a hairline with it
  const arms: RibbonSpec[] = [
    {
      pts: [[-2.0, -0.6, -0.2], [-0.8, 0.0, 0.1], [0.3, 0.35, 0.2], [1.5, 0.3, 0.0], [2.5, -0.15, -0.2]],
      width: 0.24, profile: "lens", kind: 0, thick: 0.1, twist: Math.PI * 1.8, roll: 0.5, a: 0.4, b: 1.2, tear: 0.2, serrate: 0.3, seed: 0.21, sway: 0.6,
    },
    {
      pts: [[-2.0, -0.9, -0.1], [-0.6, -0.35, 0.15], [0.6, -0.3, 0.25], [1.7, -0.75, 0.1]],
      width: 0.12, profile: "plano", kind: 1, thick: 0.12, twist: Math.PI * 2.4, a: 0.4, b: 1.4, tear: 0.15, seed: 0.33, sway: 0.8,
    },
    {
      pts: [[-2.0, -0.2, -0.3], [-0.9, 0.55, -0.1], [0.1, 1.05, 0.0], [0.9, 1.6, -0.2]],
      width: 0.36, profile: "crescent", kind: 2, bow: 1.2, curl: 0.8, thick: 0.06, twist: Math.PI * 0.8, a: 0.7, b: 1.0, tear: 0.1, seed: 0.43, sway: 0.5,
    },
    tube({
      pts: [[-2.6, -0.95, 0.0], [-1.5, -0.25, 0.3], [-0.4, -0.05, -0.12], [0.75, 0.05, 0.32], [1.8, -0.35, -0.1], [2.8, -0.55, 0.15]],
      w: W_CABLE * 1.1, seed: 0.217, sway: 0.7, taper: [0.08, 0], start: "cut", end: "open",
    }),
  ];
  return {
    core: [], arms,
    shards: stream({ from: [1.4, 0.2, 0.1], path: [[2.2, -0.1, 0.2], [3.2, -0.5, 0.0]], count: 26, size: [0.03, 0.18], spread: 0.18, white: 0.2, glass: 0.2, seed: 67 }),
    comps: [{ arm: 3, u0: 0.18, u1: 1.0, angle: 0.5, gap: 0.045, peel: [0.08, 0], width: W_WIRE, kind: 4, tube: { taper: [0.06, 0], start: "cut", end: "open" } }],
  };
}

function workRightSet(): PieceSet {
  // a frosted petal rising from below the right edge; a medium porcelain hook
  // climbs beside it and curls back behind the dark blade, ending torn
  return {
    core: [],
    arms: [
      {
        pts: [[0.6, -1.8, -0.2], [0.2, -0.8, 0.1], [-0.3, 0.1, 0.3], [-0.5, 0.9, 0.2]],
        width: 0.6, profile: "crescent", kind: 2, bow: 1.5, curl: 1.3, thick: 0.05, twist: Math.PI * 0.6, roll: 0.9, a: 0.9, b: 1.1, tear: 0.12, serrate: 0.3, seed: 0.51, sway: 0.4,
      },
      {
        pts: [[0.9, -1.6, -0.1], [0.4, -0.5, 0.2], [0.25, 0.6, 0.3], [0.5, 1.5, 0.1]],
        width: 0.1, profile: "lens", kind: 0, thick: 0.14, twist: Math.PI * 1.7, a: 0.5, b: 1.5, tear: 0.2, seed: 0.57, sway: 0.8,
      },
      tube({
        pts: [[0.05, -2.1, 0.12], [-0.12, -1.05, 0.38], [-0.55, -0.1, 0.42], [-1.2, 0.22, 0.25], [-1.55, -0.3, 0.1], [-1.15, -0.78, 0.18], [-0.5, -0.55, 0.4], [-0.05, 0.2, 0.05], [0.45, 0.55, 0.36]],
        w: W_MED, seed: 0.571, sway: 0.5, start: "cut", end: "torn", taper: [0, 0],
        wmul: [[0, 1], [0.35, 1], [0.55, 0.62], [0.75, 0.8], [1, 0.9]],
      }),
    ],
    shards: stream({ from: [-0.3, 0.4, 0.2], path: [[-0.8, 0.9, 0.3], [-1.4, 1.2, 0.1]], count: 16, size: [0.03, 0.14], spread: 0.18, white: 0.3, glass: 0.3, seed: 71 }),
  };
}

function stuffSet(): PieceSet {
  // a small satellite knot over the mono panel, two blades leaving the
  // frame, and a thin porcelain loop thrown round the knot (eccentric, half
  // behind it) with a hairline
  const ax: V3 = [0.35, 0.6, 0.72];
  const core = vortex({
    axis: ax, sheets: 2, blades: 5, slivers: 9, wires: 1, rMax: 0.48,
    white: 0.25, glass: 0.2, clearCore: 0.4, seed: 6301,
  });
  const nuc = nucleus({ axis: ax, center: [0, 0, 0], r: 0.14, shards: 22, chips: 7, splinters: 14, frags: 10, seed: 6371, scale: 0.75 });
  return {
    core,
    arms: [
      {
        pts: [[0.1, 0.05, 0.1], [0.9, 0.35, 0.25], [1.9, 0.3, 0.1], [3.0, 0.75, -0.2]],
        width: 0.2, profile: "lens", kind: 0, thick: 0.1, twist: Math.PI * 2.4, roll: 0.4, a: 0.45, b: 1.3, tear: 0.22, serrate: 0.35, teeth: 10, seed: 0.27, sway: 0.7,
      },
      {
        pts: [[-0.1, 0.2, 0.0], [-0.4, 0.9, 0.15], [-0.2, 1.7, 0.0], [0.3, 2.4, -0.2]],
        width: 0.12, profile: "plano", kind: 1, thick: 0.12, twist: Math.PI * 1.6, a: 0.5, b: 1.5, tear: 0.15, seed: 0.39, sway: 0.9,
      },
      tube({
        pts: [[-2.6, -0.62, -0.1], [-1.4, -0.42, 0.1], [-0.5, -0.38, 0.32], [0.42, -0.32, 0.3], [0.78, 0.22, 0.0], [0.38, 0.66, -0.3], [-0.42, 0.46, -0.32], [-0.62, -0.12, -0.05], [-0.1, -0.6, 0.25], [0.9, -0.9, 0.2], [2.0, -0.8, 0.0]],
        w: W_CABLE, seed: 0.277, sway: 0.7, taper: [0.06, 0.14], start: "cut", end: "point",
        wmul: [[0, 1], [0.38, 1], [0.55, 0.7], [0.7, 0.85], [1, 1]],
      }),
    ],
    shards: stream({ from: [-0.2, -0.1, 0.2], path: [[-0.8, -0.4, 0.3], [-1.6, -0.5, 0.1]], count: 22, size: [0.025, 0.14], spread: 0.16, white: 0.3, glass: 0.25, seed: 73 }),
    plates: nuc.plates, coreP: nuc.blades,
    comps: [{ arm: 2, u0: 0.04, u1: 0.42, angle: -0.6, gap: 0.035, peel: [0.1, 0.04], width: W_WIRE, kind: 4, tube: { taper: [0.1, 0.1], start: "cut", end: "point" } }],
  };
}

function expRightSet(): PieceSet {
  // a long ribbon descending the right margin (lingers through the long
  // section) — braided with a porcelain cable that winds round it
  return {
    core: [],
    arms: [
      {
        pts: [[0.8, 2.2, -0.3], [0.1, 1.0, 0.1], [0.35, -0.4, 0.2], [-0.05, -1.8, 0.1], [0.35, -3.2, 0.0], [0.05, -4.6, -0.2], [0.6, -5.8, -0.4]],
        width: 0.15, profile: "crescent", kind: 0, bow: 0.8, thick: 0.08, twist: Math.PI * 2.4, roll: 0.3, a: 0.5, b: 1.0, tear: 0.15, serrate: 0.25, seed: 0.17, sway: 0.5,
      },
      {
        pts: [[0.9, 0.6, -0.2], [0.2, -0.2, 0.1], [-0.2, -1.2, 0.2], [0.2, -2.2, 0.0]],
        width: 0.05, profile: "lens", kind: 0, thick: 0.15, twist: Math.PI * 1.5, a: 0.5, b: 1.5, seed: 0.37, sway: 0.9,
      },
    ],
    shards: stream({ from: [0.1, -0.5, 0.2], path: [[-0.5, -0.9, 0.3], [-1.1, -1.1, 0.1]], count: 12, size: [0.025, 0.12], spread: 0.15, white: 0.3, glass: 0.3, seed: 79 }),
    comps: [
      { arm: 0, u0: 0.06, u1: 0.9, angle: 0.4, gap: 0.13, peel: [0.2, 0.3], width: 0.058, kind: 3, spin: 2.2, tube: { taper: [0, 0.12], start: "cut", end: "point" } },
      { arm: 0, u0: 0.2, u1: 0.75, angle: 2.4, gap: 0.16, peel: [0.1, 0.2], width: W_WIRE, kind: 4, spin: 1.6, tube: { taper: [0.05, 0.1], start: "cut", end: "point" } },
    ],
  };
}

function expLeftSet(): PieceSet {
  // a split dark blade + a wire entering from the left edge; a porcelain
  // cable comes in under the blade and ends in a point
  return {
    core: [],
    arms: [
      {
        pts: [[-1.6, 0.9, -0.2], [-0.5, 0.35, 0.1], [0.4, -0.25, 0.2], [1.1, -0.95, 0.1]],
        width: 0.26, profile: "tear", kind: 0, thick: 0.12, twist: Math.PI * 1.5, roll: 0.3, a: 0.45, b: 0.8, seed: 0.23, sway: 0.6,
      },
      {
        pts: [[-3.0, -0.6, -1.0], [-0.5, -0.9, -0.8], [2.0, -1.5, -0.7], [4.5, -2.4, -0.6]],
        width: 0.014, profile: "round", kind: 0, a: 0.02, b: 0.02, seed: 0.45, sway: 0.2, ring: 8,
      },
      tube({
        pts: [[-2.2, 0.2, -0.05], [-1.1, -0.05, -0.1], [-0.1, -0.2, -0.02], [0.75, -0.62, 0.35], [1.4, -1.25, 0.3]],
        w: W_CABLE * 1.15, seed: 0.233, sway: 0.7, taper: [0, 0.22], start: "cut", end: "point",
      }),
    ],
    shards: stream({ from: [0.9, -0.7, 0.2], path: [[1.4, -1.1, 0.3], [1.9, -1.3, 0.1]], count: 14, size: [0.025, 0.12], spread: 0.15, white: 0.25, glass: 0.25, seed: 83 }),
    splits: [{ arm: 0, from: 0.6, count: 3, spread: 0.22, width: 0.09, extend: 0.35, lift: 0.1 }],
  };
}

function expWeaveSet(): PieceSet {
  // quiet porcelain in the two empty bays between the cards (the cards are
  // translucent, so nothing crosses them): a medium tube from the right edge
  // makes a long eccentric J in the lower-right bay — its lower arm thinner,
  // passing back out under the chrome ribbon at the margin — and a thin cable
  // with a hairline drops into the upper-left bay and ends in a point
  const arms: RibbonSpec[] = [
    tube({
      pts: [[5.9, 0.25, 0.15], [4.18, -0.34, 0.22], [2.42, -1.24, 0.18], [1.2, -2.2, 0.1], [1.05, -3.0, 0.0], [1.9, -3.38, -0.12], [3.6, -3.02, -0.25], [4.95, -2.45, -0.35], [6.1, -2.0, -0.3]],
      w: W_MED * 1.05, seed: 0.443, sway: 0.5, start: "cut", end: "open", taper: [0, 0],
      wmul: [[0, 1], [0.42, 1], [0.62, 0.62], [1, 0.55]],
    }),
    tube({
      pts: [[-2.3, 3.6, 0.0], [-2.85, 2.3, 0.1], [-2.3, 1.35, 0.15], [-1.25, 0.95, 0.1], [-0.75, 0.9, 0.05]],
      w: W_CABLE, seed: 0.457, sway: 0.7, start: "cut", end: "point", taper: [0, 0.22],
    }),
  ];
  return {
    core: [], arms, shards: [],
    comps: [
      { arm: 0, u0: 0.03, u1: 0.45, angle: 1.9, gap: 0.09, peel: [0.04, 0.32], width: W_CABLE * 0.8, kind: 3, tube: { taper: [0, 0.18], start: "cut", end: "point" } },
      { arm: 1, u0: 0.05, u1: 0.8, angle: -1.2, gap: 0.05, peel: [0.02, 0.12], width: W_WIRE, kind: 4, tube: { taper: [0.06, 0.1], start: "cut", end: "point" } },
    ],
  };
}

function expKnotSet(): PieceSet {
  const ax: V3 = [-0.3, 0.7, 0.65];
  const core = vortex({
    axis: ax, sheets: 1, blades: 4, slivers: 8, wires: 1, rMax: 0.42,
    white: 0.4, glass: 0.25, clearCore: 0.4, seed: 5511,
  });
  const nuc = nucleus({ axis: ax, center: [0, 0, 0], r: 0.12, shards: 16, chips: 5, splinters: 10, frags: 8, seed: 5571, scale: 0.7 });
  return {
    core, arms: [],
    shards: stream({ from: [0, 0, 0], path: [[-0.5, -0.3, 0.2], [-1.1, -0.5, 0.1]], count: 14, size: [0.02, 0.1], spread: 0.15, white: 0.3, glass: 0.3, seed: 89 }),
    plates: nuc.plates, coreP: nuc.blades,
  };
}

export const GROUPS: GroupDef[] = [
  {
    id: "hero", section: "hero", t: 0, anchor: [0.66, 0.31], depth: 10,
    narrow: { anchor: [0.72, 0.22], scale: 0.52 },
    axis: HERO_AXIS, spin: 0.018, breathe: 0.05, window: [-9, 0.6], build: heroSet,
  },
  {
    id: "about", section: "about", t: 0.5, anchor: [0.9, 0.8], depth: 12,
    narrow: { anchor: [1.0, 0.16], scale: 0.6 },
    breathe: 0.03, window: [-0.7, 0.6], haze: 0.05, build: aboutSet,
  },
  {
    id: "workTop", section: "work", t: 0.45, anchor: [0.84, 0.13], depth: 11,
    narrow: { anchor: [0.8, 0.1], scale: 0.55 },
    breathe: 0.04, window: [-0.75, 0.6], build: workTopSet,
  },
  {
    id: "workR", section: "work", t: 0.6, anchor: [0.92, 0.8], depth: 12,
    narrow: { anchor: [0.98, 0.9], scale: 0.55 },
    breathe: 0.04, window: [-0.75, 0.6], haze: 0.05, build: workRightSet,
  },
  {
    id: "stuff", section: "stuff", t: 0.5, anchor: [0.78, 0.22], depth: 11,
    narrow: { anchor: [0.9, 0.08], scale: 0.55 },
    axis: [0.35, 0.6, 0.72], spin: 0.025, breathe: 0.04, window: [-0.75, 0.6], build: stuffSet,
  },
  {
    id: "expR", section: "experience", t: 0.2, anchor: [0.93, 0.32], depth: 12,
    narrow: { anchor: [1.0, 0.3], scale: 0.55 },
    breathe: 0.03, window: [-0.75, 1.2], haze: 0.04, build: expRightSet,
  },
  {
    id: "expW", section: "experience", t: 0.42, anchor: [0.5, 0.45], depth: 12,
    narrow: { anchor: [0.5, 0.5], scale: 0.5 },
    breathe: 0.02, window: [-0.8, 0.8], haze: 0.03, build: expWeaveSet,
  },
  {
    id: "expL", section: "experience", t: 0.55, anchor: [0.06, 0.66], depth: 11,
    narrow: { anchor: [0.02, 0.75], scale: 0.55 },
    breathe: 0.04, window: [-0.75, 0.6], build: expLeftSet,
  },
  {
    id: "expK", section: "experience", t: 0.86, anchor: [0.88, 0.36], depth: 11,
    narrow: { anchor: [0.92, 0.2], scale: 0.6 },
    axis: [-0.3, 0.7, 0.65], spin: 0.03, breathe: 0.04, window: [-0.75, 0.6], build: expKnotSet,
  },
  {
    id: "contact", section: "contact", t: 0.5, anchor: [0.79, 0.26], depth: 10,
    narrow: { anchor: [0.72, 0.17], scale: 0.5 },
    axis: CONTACT_AXIS, spin: 0.022, breathe: 0.05, window: [-0.8, 9], build: contactSet,
  },
];

// ─── Inner pages (project, catalogue, document) ─────────────
//
// The same materials in a quieter, page-shaped arrangement: one mass anchored
// in a free top corner beside the page title, its long ribbon falling down
// the free margin, and a small knot that sits near the bottom of the page
// (anchored to the page's end, so it arrives as the content runs out). The
// slug seeds the vortex, so no two pages have the same mass.

export type PageKind = "case" | "catalogue" | "document";

/** Gentle camera drift per scrolled screen on each page kind (the home page uses its section curve). */
export const PAGE_PARALLAX: Record<PageKind, number> = { case: 0.35, catalogue: 0.5, document: 0.4 };

function pageMassSet(seed: number, axis: V3): PieceSet {
  const core = vortex({
    axis, sheets: 4, blades: 12, slivers: 10, wires: 2, rMax: 0.8,
    white: 0.1, glass: 0.1, clearCore: 0.45, hollow: 0.3, seed: 7000 + (seed % 997),
  });
  const nuc = nucleus({ axis, center: [0.04, 0.08, 0.18], r: 0.5, flat: 0.3, shards: 22, chips: 8, splinters: 18, frags: 0, seed: 8000 + (seed % 991), scale: 0.85, comb: 0.5, bold: true });
  const arms: RibbonSpec[] = [
    // 0 — the page's main gesture: out of the mass and down the free margin, off the bottom
    {
      pts: [[0.1, -0.2, 0.2], [0.55, -1.1, 0.45], [0.35, -2.3, 0.55], [0.75, -3.6, 0.35], [0.45, -5.0, 0.05], [0.8, -6.6, -0.3]],
      width: 0.36, profile: "sheet", kind: 0, bow: 0.9, curl: 0.4, wave: 0.5, thick: 0.07, twist: Math.PI * 2.2, roll: 0.4,
      a: 0.55, b: 0.85, tear: 0.12, serrate: 0.3, teeth: 6, seed: 0.211, sway: 0.5, up: [0, 1, 0.3],
    },
    // 1 — up and out of the top edge
    {
      pts: [[0.2, 0.3, 0.0], [0.5, 0.9, 0.2], [0.9, 1.6, 0.1], [1.3, 2.4, -0.2]],
      width: 0.16, profile: "lens", kind: 0, thick: 0.11, twist: Math.PI * 1.8, roll: 0.6,
      a: 0.5, b: 1.3, tear: 0.2, seed: 0.293, sway: 0.7,
    },
    // 2 — a needle to the right edge
    {
      pts: [[0.3, 0.0, 0.1], [1.1, -0.2, 0.2], [2.0, -0.1, -0.1], [2.9, 0.2, -0.4]],
      width: 0.08, profile: "plano", kind: 0, thick: 0.14, twist: Math.PI * 1.3, a: 0.5, b: 1.6, seed: 0.347, sway: 0.9,
    },
    // 3 — a glass petal reaching toward the page, not into it
    {
      pts: [[-0.3, 0.15, 0.2], [-0.8, 0.4, 0.45], [-1.25, 0.3, 0.5], [-1.5, -0.05, 0.35]],
      width: 0.45, profile: "crescent", kind: 2, bow: 1.3, curl: 1.2, thick: 0.05, twist: Math.PI * 0.5, roll: 0.8,
      a: 0.9, b: 1.1, tear: 0.1, serrate: 0.2, seed: 0.419, sway: 0.5,
    },
    // 4 — the porcelain tube: from the top edge through the vortex, down the
    //     ribbon's inside and an eccentric loop low in the margin, ending torn
    tube({
      pts: [[0.6, 1.6, -0.3], [0.4, 0.8, -0.05], [0.15, 0.1, 0.06], [0.35, -0.8, 0.25], [0.7, -1.9, 0.35], [0.55, -3.0, 0.25],
        [0.95, -3.6, 0.1], [1.3, -3.1, 0.0], [1.05, -2.7, -0.1], [0.75, -3.1, 0.0], [0.9, -4.2, 0.05]],
      w: 0.14, seed: 0.523, sway: 0.4, start: "cut", end: "torn", taper: [0, 0],
      wmul: [[0, 1], [0.55, 1], [0.75, 0.66], [1, 0.8]],
    }),
    // 5 — a cable out of the mass, up and off the top
    tube({
      pts: [[-0.25, 0.4, 0.3], [-0.8, 1.0, 0.4], [-1.3, 1.6, 0.3], [-1.6, 2.4, 0.1]],
      w: W_CABLE, seed: 0.613, sway: 0.8, taper: [0.05, 0.2], start: "cut", end: "point",
    }),
  ];
  const shards = [
    ...stream({ from: [0.3, -0.2, 0.2], path: [[0.8, -0.9, 0.4], [1.1, -1.8, 0.3], [1.4, -2.8, 0.0]], count: 46, size: [0.03, 0.22], spread: 0.22, white: 0.2, glass: 0.15, seed: 61 + (seed % 89), pills: 0.06 }),
    ...stream({ from: [-0.2, 0.3, 0.1], path: [[-0.6, 0.8, 0.3], [-0.9, 1.4, 0.2]], count: 22, size: [0.02, 0.16], spread: 0.18, white: 0.3, glass: 0.2, seed: 67 + (seed % 83) }),
  ];
  return {
    core, arms, shards, splits: [{ arm: 0, from: 0.7, count: 2, spread: 0.22, width: 0.12, extend: 0.4 }],
    plates: nuc.plates, coreP: nuc.blades,
    comps: [
      { arm: 4, u0: 0.12, u1: 0.62, angle: 0.4, gap: 0.12, peel: [0.05, 0.2], width: W_WIRE, kind: 4, spin: 1.4, tube: { taper: [0.05, 0.1], start: "cut", end: "point" } },
      { arm: 0, u0: 0.3, u1: 0.78, angle: Math.PI * 0.5, gap: 0.2, peel: [0.15, 0.05], width: W_CABLE, kind: 3, tube: { taper: [0, 0.2], start: "cut", end: "point" } },
    ],
    graphite: { src: withBase("/assets/background/graphite-contact.png"), pos: [0.7, -0.25, -0.12], size: [0.9, 0.85], alpha: 0.85 },
  };
}

const knotAxis = (seed: number): V3 => [0.3 - (seed % 7) * 0.08, 0.7, 0.65];

function pageKnotSet(seed: number): PieceSet {
  const ax = knotAxis(seed);
  const core = vortex({
    axis: ax, sheets: 1, blades: 5, slivers: 8, wires: 1, rMax: 0.45,
    white: 0.35, glass: 0.25, clearCore: 0.4, seed: 5600 + (seed % 409),
  });
  const nuc = nucleus({ axis: ax, center: [0, 0, 0], r: 0.13, shards: 14, chips: 5, splinters: 10, frags: 6, seed: 5700 + (seed % 401), scale: 0.7 });
  return {
    core,
    arms: [
      // a short porcelain loop around the knot, thinning on its far side
      tube({
        pts: [[-0.9, 0.5, -0.1], [-0.35, 0.2, 0.1], [0.25, -0.15, 0.2], [0.6, 0.25, 0.1], [0.3, 0.6, -0.05], [-0.1, 0.25, 0.05], [0.15, -0.55, 0.1], [0.4, -1.4, 0.0]],
        w: W_MED, seed: 0.733, sway: 0.5, start: "cut", end: "point", taper: [0, 0.2],
        wmul: [[0, 1], [0.4, 1], [0.6, 0.7], [1, 0.9]],
      }),
    ],
    shards: stream({ from: [0, 0, 0], path: [[-0.5, -0.3, 0.2], [-1.1, -0.5, 0.1]], count: 14, size: [0.02, 0.1], spread: 0.15, white: 0.3, glass: 0.3, seed: 97 + (seed % 71) }),
    plates: nuc.plates, coreP: nuc.blades,
  };
}

/**
 * Where an inner page's content leaves room, measured from the rendered page
 * (Background.tsx), in viewport fractions. The page compositions lay
 * themselves into it rather than assuming one layout.
 */
export interface PageFrame {
  /** Left edge of the free column on the right (where the content ends). */
  colX: number;
  /** Right edge of the free margin on the left (document pages; 0 otherwise). */
  leftX: number;
  /** Right edge of the page title's text. */
  titleX: number;
  /** Top of a wide media band under the title (project pages), at scroll 0; 1 if none. */
  bandY: number;
}

/** Where the mass and the knot go for a page kind, given its frame. */
export function pagePlacement(kind: PageKind, f: PageFrame) {
  const cw = Math.max(0, 1 - f.colX - 0.01);
  if (kind === "document") {
    const rw = cw, lw = Math.max(0, f.leftX - 0.01);
    return {
      mass: { anchor: [f.colX + Math.max(rw, 0.12) * 0.55, 0.15] as [number, number], scale: Math.min(1, Math.max(0.5, rw / 0.3)) * 0.78 },
      knot: [Math.max(0.05, lw * 0.45), 0.72] as [number, number],
      knotScale: Math.min(1, Math.max(0.55, lw / 0.25)),
    };
  }
  if (kind === "case") {
    // above the full-width hero band, right of the title; it falls behind the band
    const room = Math.max(0.12, f.bandY);
    return {
      mass: { anchor: [Math.min(0.88, Math.max(0.8, f.titleX + 0.3)), Math.max(0.1, room * 0.48)] as [number, number], scale: Math.min(1, Math.max(0.5, room / 0.32)) * 0.8 },
      knot: [f.colX + cw * 0.55, 0.74] as [number, number],
      knotScale: Math.min(1, Math.max(0.55, cw / 0.25)),
    };
  }
  // catalogue: the free column beside the grid; a narrow column tucks the mass against the edge
  const tight = cw < 0.16;
  return {
    mass: { anchor: [tight ? 0.965 : f.colX + cw * 0.55, 0.16] as [number, number], scale: tight ? 0.6 : Math.min(1, Math.max(0.6, cw / 0.3)) * 0.85 },
    knot: [tight ? 0.97 : f.colX + cw * 0.5, 0.62] as [number, number],
    knotScale: tight ? 0.55 : Math.min(1, Math.max(0.6, cw / 0.25)),
  };
}

/** The 3D groups for an inner page. `seed` comes from the page's slug. */
export function pageGroups(kind: PageKind, seed: number, frame: PageFrame): GroupDef[] {
  const axis: V3 = norm([-0.42 + ((seed % 11) - 5) * 0.03, 0.62, 0.66]);
  const at = pagePlacement(kind, frame);
  const forever: [number, number] = [-99, 99];
  return [
    {
      id: "pageMass", section: "hero", t: 0, anchor: at.mass.anchor, depth: 10, scale: at.mass.scale,
      narrow: { anchor: [0.95, 0.05], scale: 0.42 },
      axis, spin: 0.018, breathe: 0.045, window: forever, build: () => pageMassSet(seed, axis),
    },
    {
      // "contact" here is the page's last screen (see Background's page layout)
      id: "pageKnot", section: "contact", t: 0.5, anchor: at.knot, depth: 11, scale: at.knotScale * 0.9,
      narrow: { anchor: [0.96, 0.86], scale: 0.4 },
      axis: knotAxis(seed), spin: 0.03, breathe: 0.04, window: forever, haze: 0.04, build: () => pageKnotSet(seed),
    },
  ];
}
