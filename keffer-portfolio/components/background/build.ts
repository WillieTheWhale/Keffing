// Background — ALLOY. The geometry build: every group's pieces swept into
// packed vertex arrays. It runs in a worker (geometry.worker.ts) so the
// ~100 ms of sweeping (several times that on a slow phone) never blocks the
// page; the engine falls back to running it in place when workers are out.
// The same code either way, so the arrays are bit-identical.

import { buildPlate, buildRibbon, companion, newMesh, setTessellation, tines, type MeshData, type RibbonSpec, type Spine } from "./geometry";
import { GROUPS, pageGroups, type GroupDef, type PageFrame, type PageKind, type PieceSet, type ShardSpec } from "./pieces";

export type Quality = "full" | "lite";

/** Inner pages: what their groups are built from (pieces.ts pageGroups). */
export interface PageSpec { kind: PageKind; seed: number; frame: PageFrame }

/** One draw call's vertex data (MeshData as typed arrays). */
export interface PackedMesh {
  position: Float32Array;
  normal: Float32Array;
  data: Float32Array;
  sway: Float32Array;
  wax: Float32Array;
  hax: Float32Array;
  prof: Float32Array;
  axis: Float32Array;
  index: Uint16Array | Uint32Array;
}

/** Opaque chrome, porcelain and glass, in that order (null when empty). */
type Split = [PackedMesh | null, PackedMesh | null, PackedMesh | null];

export interface BuiltGroup {
  /** The rotating core and the static arms. */
  core: Split;
  arms: Split;
  shards: ShardSpec[];
  graphite?: PieceSet["graphite"];
}

export interface Built {
  /** Base meshes for the instanced shards: a spindle blade and a pill. */
  blade: PackedMesh;
  pill: PackedMesh;
  groups: BuiltGroup[];
}

export function groupDefs(page: PageSpec | null): GroupDef[] {
  return page ? pageGroups(page.kind, page.seed, page.frame) : GROUPS;
}

function pack(m: MeshData, wide = m.position.length / 3 > 65535): PackedMesh {
  return {
    position: new Float32Array(m.position),
    normal: new Float32Array(m.normal),
    data: new Float32Array(m.data),
    sway: new Float32Array(m.sway),
    wax: new Float32Array(m.wax),
    hax: new Float32Array(m.hax),
    prof: new Float32Array(m.prof),
    axis: new Float32Array(m.axis),
    index: wide ? new Uint32Array(m.index) : new Uint16Array(m.index),
  };
}

const packOrNull = (m: MeshData) => (m.index.length === 0 ? null : pack(m));

export function buildAll(quality: Quality, page: PageSpec | null): Built {
  if (quality === "full") setTessellation(34, 1);
  else setTessellation(20, 0.75);

  // base shard: a spindle blade along +X; pill: a capsule
  const blade = newMesh();
  buildRibbon(blade, {
    pts: [[-0.5, 0, 0], [-0.17, 0.035, 0], [0.17, 0.035, 0], [0.5, 0, 0]],
    width: 1, profile: "lens", kind: 0, thick: 1, a: 0.85, b: 1.05, twist: 0.9, segs: 22, ring: 7, up: [0, 0, 1], sway: 0,
  });
  const pill = newMesh();
  buildRibbon(pill, {
    pts: [[-0.5, 0, 0], [0.5, 0, 0]], width: 1, profile: "round", kind: 0, a: 0.5, b: 0.5, segs: 18, ring: 12, sway: 0,
  });

  const groups = groupDefs(page).map((def): BuiltGroup => {
    const set = def.build();
    const split = () => {
      const o = newMesh(), g = newMesh(), p = newMesh();
      return { o, g, p, add: (s: RibbonSpec): Spine => buildRibbon(s.kind === 2 ? g : s.kind >= 3 ? p : o, s) };
    };
    const c = split();
    for (const s of set.core) c.add(s);
    for (const s of set.coreP ?? []) c.add(s);
    for (const pl of set.plates ?? []) buildPlate(c.p, pl.c, pl.ring, pl.kind, pl.seed, 0.6);
    const a = split();
    const spines = set.arms.map((s) => a.add(s));
    for (const sp of set.splits ?? []) {
      const parent = set.arms[sp.arm];
      for (const t of tines(spines[sp.arm], parent, sp.from, sp.count, {
        spread: sp.spread, width: sp.width, kind: parent.kind, extend: sp.extend, lift: sp.lift, seed: (parent.seed ?? 0.5) + 0.3,
        roll: parent.roll, twist: 1.1,
      })) a.add(t);
    }
    for (const cr of set.comps ?? []) {
      const parent = set.arms[cr.arm];
      a.add(companion(spines[cr.arm], parent, {
        u0: cr.u0, u1: cr.u1, angle: cr.angle, gap: cr.gap, peel: cr.peel, width: cr.width, kind: cr.kind,
        follow: cr.follow, spin: cr.spin, tube: cr.tube,
      }));
    }
    return {
      core: [packOrNull(c.o), packOrNull(c.p), packOrNull(c.g)],
      arms: [packOrNull(a.o), packOrNull(a.p), packOrNull(a.g)],
      shards: set.shards,
      graphite: set.graphite,
    };
  });

  return { blade: pack(blade, false), pill: pack(pill, false), groups };
}

/** The buffers a Built owns (moved, not copied, across postMessage). */
export function transferables(b: Built): ArrayBuffer[] {
  const out: ArrayBuffer[] = [];
  const add = (m: PackedMesh | null) => {
    if (m) for (const a of Object.values(m)) out.push((a as Float32Array).buffer as ArrayBuffer);
  };
  add(b.blade);
  add(b.pill);
  for (const g of b.groups) { g.core.forEach(add); g.arms.forEach(add); }
  return out;
}
