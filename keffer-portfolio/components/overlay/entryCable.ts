// The entry sequence's porcelain cable (EntrySequence.tsx): the tube's
// geometry and its drawing.
//
// One hand-placed centreline (cubic Béziers in a design frame, one for wide
// screens and one for tall ones) is sampled once at even arc length. The tube
// is the background's porcelain: a white body with a thin ink contour, its
// width swelling and pinching like a brush stroke (references r07, r14), a
// point where it began and a cut, open end where it is still being drawn.
// It is painted front to back along its length in short chunks, each filled
// and then contoured, so where the loop crosses itself the later pass lies
// over the earlier one and cuts its contour. A hairline lead winds round it
// (the background's wires), behind the body for half of each turn and in
// front for the other half; the open end is a hollow, inked cut (r14).

type Pt = readonly [number, number];
type Seg = readonly [Pt, Pt, Pt, Pt];

interface Design {
  /** The frame the points are drawn in; it covers the viewport. */
  frame: readonly [number, number];
  segs: readonly Seg[];
  /** The segment the head rests at the end of while the page loads. */
  hold: number;
  /** The brush: half-width (0..1 of the widest) at points along the path,
   *  each placed as segment index + fraction (2.5 = halfway along segs[2]). */
  brush: readonly (readonly [number, number])[];
  /** Ink slivers hugging one flank (r07's dark streaks): [from, to, side],
   *  placed like the brush. */
  slivers: readonly (readonly [number, number, number])[];
}

// Wide: in low from the left with a small hitch, up into one tilted loop
// right of centre that crosses back over itself, then an S out over the top
// right.
const WIDE: Design = {
  frame: [1600, 1000],
  segs: [
    [[-220, 930], [120, 860], [330, 830], [520, 700]],
    [[520, 700], [640, 615], [700, 520], [830, 500]],
    [[830, 500], [1010, 470], [1110, 380], [1060, 270]],
    [[1060, 270], [1010, 160], [840, 150], [790, 260]],
    [[790, 260], [740, 370], [840, 520], [980, 560]],
    [[980, 560], [1150, 610], [1280, 560], [1360, 430]],
    [[1360, 430], [1430, 310], [1520, 230], [1880, 120]],
  ],
  hold: 5,
  // full up the rise, a twist to almost nothing over the top of the loop,
  // full again through the crossing, easing off towards the open end
  brush: [[0, 0.45], [0.6, 0.7], [1, 0.5], [1.6, 0.9], [2.3, 1], [2.9, 0.62], [3.35, 0.07], [3.75, 0.5], [4.3, 1], [4.8, 0.72], [5.3, 0.95], [5.9, 0.6], [6.5, 0.4], [7, 0.25]],
  slivers: [[1.25, 1.75, 1], [4.45, 4.9, -1], [5.35, 5.6, 1]],
};

// Tall: in low from the left, up into a loop through the middle of the
// screen that crosses back over itself, then up and out past the top right.
const TALL: Design = {
  frame: [900, 1600],
  segs: [
    [[-200, 1500], [60, 1460], [230, 1390], [330, 1250]],
    [[330, 1250], [420, 1130], [540, 1100], [610, 990]],
    [[610, 990], [720, 830], [680, 640], [520, 600]],
    [[520, 600], [360, 560], [230, 700], [300, 850]],
    [[300, 850], [360, 970], [560, 1000], [660, 900]],
    [[660, 900], [770, 790], [760, 600], [660, 470]],
    [[660, 470], [560, 330], [650, 120], [1100, -160]],
  ],
  hold: 5,
  brush: [[0, 0.45], [0.6, 0.7], [1, 0.5], [1.6, 0.9], [2.3, 1], [2.9, 0.62], [3.35, 0.07], [3.75, 0.5], [4.3, 1], [4.8, 0.72], [5.3, 0.95], [5.9, 0.6], [6.5, 0.4], [7, 0.25]],
  slivers: [[1.25, 1.75, 1], [4.45, 4.9, -1], [5.35, 5.6, 1]],
};

export interface Cable {
  n: number;
  x: Float32Array;
  y: Float32Array;
  /** unit normal */
  nx: Float32Array;
  ny: Float32Array;
  /** arc length at each sample (css px) */
  s: Float32Array;
  len: number;
  /** half-width at each sample (css px), before the tail's taper */
  hw: Float32Array;
  /** drawing time at each sample: the pen slows through the curves; 1 at the hold */
  t: Float32Array;
  /** where the head rests (0..1 of len) */
  uHold: number;
  /** tail taper length (css px) */
  taper: number;
  /** slivers, as [from, to] sample indices and side */
  slivers: readonly (readonly [number, number, number])[];
  /** the lead's turn length along the tube (css px), and where it starts (0..1) */
  leadTurn: number;
  leadFrom: number;
}

/** Per-sample displacement along the normal (css px), e.g. a travelling ripple. */
export type Sway = Float32Array | null;

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

function bez(seg: Seg, t: number): [number, number] {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [
    a * seg[0][0] + b * seg[1][0] + c * seg[2][0] + d * seg[3][0],
    a * seg[0][1] + b * seg[1][1] + c * seg[2][1] + d * seg[3][1],
  ];
}

/** Lay the tube out for a viewport W×H (css px). Runs once per size. */
export function buildCable(W: number, H: number): Cable {
  const d = W / H < 0.85 ? TALL : WIDE;
  // cover the viewport with the design frame, centred, but on very wide or
  // very tall screens no more than 1.25× the fit, so the loop is never cut
  const k = Math.min(Math.max(W / d.frame[0], H / d.frame[1]), W / (d.frame[0] * 0.8), H / (d.frame[1] * 0.8));
  const ox = (W - d.frame[0] * k) / 2;
  const oy = (H - d.frame[1] * k) / 2;

  // dense polyline, and where the hold segment ends on it
  const px: number[] = [], py: number[] = [];
  const segAt: number[] = [];
  let holdAt = 0;
  d.segs.forEach((seg, si) => {
    segAt.push(Math.max(0, px.length - 1));
    const steps = 240;
    for (let i = si === 0 ? 0 : 1; i <= steps; i++) {
      const [x, y] = bez(seg, i / steps);
      px.push(ox + x * k);
      py.push(oy + y * k);
    }
    if (si === d.hold) holdAt = px.length - 1;
  });
  segAt.push(px.length - 1);
  const cum = new Float64Array(px.length);
  for (let i = 1; i < px.length; i++) cum[i] = cum[i - 1] + Math.hypot(px[i] - px[i - 1], py[i] - py[i - 1]);
  const len = cum[px.length - 1];
  // a place on the path (segment index + fraction) as 0..1 of its length
  const at = (pos: number) => {
    const si = Math.min(d.segs.length - 1, Math.floor(pos));
    const a = cum[segAt[si]], b = cum[segAt[si + 1]];
    return (a + (b - a) * (pos - si)) / len;
  };

  // resample at even arc length
  const n = Math.max(400, Math.min(1600, Math.round(len / 2.2)));
  const x = new Float32Array(n), y = new Float32Array(n), s = new Float32Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const target = (len * i) / (n - 1);
    while (j < px.length - 2 && cum[j + 1] < target) j++;
    const f = (target - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]);
    x[i] = px[j] + (px[j + 1] - px[j]) * f;
    y[i] = py[j] + (py[j + 1] - py[j]) * f;
    s[i] = target;
  }

  // normals from central differences
  const nx = new Float32Array(n), ny = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 2), b = Math.min(n - 1, i + 2);
    const tx = x[b] - x[a], ty = y[b] - y[a];
    const l = Math.hypot(tx, ty) || 1;
    nx[i] = -ty / l;
    ny[i] = tx / l;
  }

  // the brush: swell and pinch between the design's control points
  const unit = Math.min(W, H);
  const maxHW = Math.max(8, Math.min(26, unit * 0.025));
  const hw = new Float32Array(n);
  const br = d.brush.map(([pos, v]) => [at(pos), v] as const);
  for (let i = 0, j = 0; i < n; i++) {
    const u = i / (n - 1);
    while (j < br.length - 2 && br[j + 1][0] < u) j++;
    const f = smooth(br[j][0], br[j + 1][0], u);
    hw[i] = maxHW * (br[j][1] + (br[j + 1][1] - br[j][1]) * f);
  }

  // the pen's pace: slower where the line turns
  const R0 = unit * 0.2;
  const t = new Float32Array(n);
  for (let i = 1; i < n; i++) {
    const a = Math.max(0, i - 3), b = Math.min(n - 1, i + 3);
    const ax = x[i] - x[a], ay = y[i] - y[a], bx = x[b] - x[i], by = y[b] - y[i];
    const turn = Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by));
    const ds = s[i] - s[i - 1];
    const curv = turn / Math.max(1e-6, s[b] - s[a]);
    t[i] = t[i - 1] + ds * (1 + 1.4 * Math.min(3, curv * R0));
  }
  const uHold = cum[holdAt] / len;
  const iHold = Math.round(uHold * (n - 1));
  const tHold = t[iHold] || 1;
  for (let i = 0; i < n; i++) t[i] /= tHold;

  return { n, x, y, nx, ny, s, len, hw, t, uHold, taper: Math.max(unit * 0.22, len * 0.08),
    slivers: d.slivers.map(([p, q, side]) => [Math.round(at(p) * (n - 1)), Math.round(at(q) * (n - 1)), side] as const),
    leadTurn: Math.max(260, unit * 0.62),
    leadFrom: at(0.55),
  };
}

/** The arc length (0..1) the pen has reached at drawing time `time` (0..1 = to the hold). */
export function headAt(c: Cable, time: number): number {
  if (time <= 0) return 0;
  // binary search the pace table
  let lo = 0, hi = c.n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (c.t[mid] < time) lo = mid; else hi = mid;
  }
  const f = (time - c.t[lo]) / Math.max(1e-6, c.t[hi] - c.t[lo]);
  return Math.min(1, (lo + Math.min(1, Math.max(0, f))) / (c.n - 1));
}

const INK = "#1b1d22";
const BODY = "#ffffff";

/** Stroke the centreline from `u0` to `u1` as one path (for cutting the paper). */
export function traceCentre(ctx: CanvasRenderingContext2D, c: Cable, u0: number, u1: number, dpr: number, sway: Sway) {
  const i0 = Math.max(0, Math.floor(u0 * (c.n - 1)));
  const i1 = Math.min(c.n - 1, Math.ceil(u1 * (c.n - 1)));
  ctx.beginPath();
  for (let i = i0; i <= i1; i++) {
    const o = sway ? sway[i] : 0;
    const X = (c.x[i] + c.nx[i] * o) * dpr, Y = (c.y[i] + c.ny[i] * o) * dpr;
    if (i === i0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
  }
}

/**
 * Paint the tube from `u0` (tail) to `u1` (head), both 0..1 of its length,
 * with its lead running from `lead0` to `lead1`. `sway` bends it along its
 * normals; `cut` draws the open end.
 */
export function drawCable(
  ctx: CanvasRenderingContext2D, c: Cable, u0: number, u1: number, dpr: number, cut: boolean,
  sway: Sway = null, lead0 = 1, lead1 = 0,
) {
  const { n, x, y, nx, ny, s, hw } = c;
  const i0 = Math.max(0, Math.floor(u0 * (n - 1)));
  const i1 = Math.min(n - 1, Math.ceil(u1 * (n - 1)));
  if (i1 - i0 < 2) return;
  const sTail = u0 * c.len;
  // half-width with the tail drawn out to a point
  const w = (i: number) => hw[i] * Math.pow(smooth(0, c.taper, s[i] - sTail), 0.75);
  const cx = (i: number) => x[i] + (sway ? nx[i] * sway[i] : 0);
  const cy = (i: number) => y[i] + (sway ? ny[i] * sway[i] : 0);
  // a point `r` off the centreline along the normal
  const px = (i: number, r: number) => (cx(i) + nx[i] * r) * dpr;
  const py = (i: number, r: number) => (cy(i) + ny[i] * r) * dpr;

  // the lead: a helix round the body, its offset on the page and its depth
  const l0 = Math.max(i0, Math.floor(lead0 * (n - 1)));
  const l1 = Math.min(i1, Math.ceil(lead1 * (n - 1)));
  const phase = (i: number) => (s[i] / c.leadTurn) * Math.PI * 2 + 0.9;
  const leadR = (i: number) => w(i) * 1.1 + 1.6;
  const lead = (a: number, b: number, front: boolean) => {
    const p = Math.max(a, l0), q = Math.min(b, l1);
    if (q - p < 1) return;
    ctx.beginPath();
    let pen = false;
    for (let i = p; i <= q; i++) {
      const ph = phase(i);
      if ((Math.cos(ph) > 0) !== front) { pen = false; continue; }
      // the lead fades in at its start and thins near the tail's point
      const r = leadR(i) * Math.sin(ph);
      const X = px(i, r), Y = py(i, r);
      if (!pen) { ctx.moveTo(X, Y); pen = true; } else ctx.lineTo(X, Y);
    }
    ctx.stroke();
  };

  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const contour = 1.7 * dpr;
  const hair = 1.15 * dpr;
  const CH = 18;
  for (let a = i0; a < i1; a += CH) {
    const b = Math.min(i1, a + CH);
    // the lead's far half, under the body
    ctx.strokeStyle = INK;
    ctx.lineWidth = hair;
    lead(a, b, false);

    // body
    ctx.beginPath();
    for (let i = a; i <= b; i++) {
      const r = w(i);
      if (i === a) ctx.moveTo(px(i, r), py(i, r)); else ctx.lineTo(px(i, r), py(i, r));
    }
    for (let i = b; i >= a; i--) ctx.lineTo(px(i, -w(i)), py(i, -w(i)));
    ctx.closePath();
    ctx.fillStyle = BODY;
    ctx.fill();

    // ink slivers along one flank, swelling in the middle (r07's streaks)
    for (const [m0, m1, side] of c.slivers) {
      const p = Math.max(a, m0), q = Math.min(b, m1);
      if (q - p < 1) continue;
      const thick = (i: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, (i - m0) / (m1 - m0))));
      ctx.beginPath();
      for (let i = p; i <= q; i++) {
        const r = w(i) * side;
        if (i === p) ctx.moveTo(px(i, r), py(i, r)); else ctx.lineTo(px(i, r), py(i, r));
      }
      for (let i = q; i >= p; i--) {
        const r = w(i) * side * (1 - 0.3 * thick(i));
        ctx.lineTo(px(i, r), py(i, r));
      }
      ctx.closePath();
      ctx.fillStyle = INK;
      ctx.fill();
    }

    // the two flanks' contour
    ctx.strokeStyle = INK;
    ctx.lineWidth = contour;
    for (const side of [1, -1]) {
      ctx.beginPath();
      for (let i = a; i <= b; i++) {
        const r = w(i) * side;
        if (i === a) ctx.moveTo(px(i, r), py(i, r)); else ctx.lineTo(px(i, r), py(i, r));
      }
      ctx.stroke();
    }

    // the lead's near half, over it
    ctx.lineWidth = hair;
    lead(a, b, true);
  }

  // the open end the pen is still drawing: a hollow cut cross-section
  if (cut && i1 < n - 1) {
    const r = w(i1);
    if (r > 1) {
      ctx.save();
      ctx.translate(cx(i1) * dpr, cy(i1) * dpr);
      ctx.rotate(Math.atan2(ny[i1], nx[i1]));
      ctx.beginPath();
      ctx.ellipse(0, 0, r * dpr, r * 0.36 * dpr, 0, 0, Math.PI * 2);
      ctx.fillStyle = BODY;
      ctx.fill();
      ctx.lineWidth = contour;
      ctx.strokeStyle = INK;
      ctx.stroke();
      // the bore
      ctx.beginPath();
      ctx.ellipse(r * 0.08 * dpr, 0, r * 0.58 * dpr, r * 0.19 * dpr, 0, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.restore();
    }
  }
}
