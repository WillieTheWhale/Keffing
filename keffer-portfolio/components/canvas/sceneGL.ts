// WebGL line-scene renderer — the primary path for the ambient line burst.
//
// The whole composition is static GPU geometry built once per scene, drawn in
// ~a dozen batched calls, with the scroll deformation, a slow ambient drift
// and the density gating evaluated per-vertex in shaders. Per-frame CPU work
// is a handful of uniform writes.
//
// The chrome tendrils use a matcap ribbon technique: a fake tube normal from
// the LOCAL tangent at every sample, sampled against a ray-traced chrome
// matcap, so the reflection follows every bend. The focal mass itself is
// thrown ink (see generateBurst in scene.ts): black wedges and blots with
// white burnout glints cut back across them.

import * as THREE from "three";
import type { Pt, RawScene, RawBrush, RawInk, WidthFn } from "./scene";
import { samplePath, sampleQuadratic } from "./scene";
import { withBase } from "@/lib/basePath";

export function detectWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

// ─── Shaders ────────────────────────────────────────────────

// Mirrors deform() in scene.ts exactly (plus the ambient time term).
const PRELUDE = /* glsl */ `
  uniform float uScrollY;
  uniform float uTime;
  uniform float uDensity;
  uniform float uGlobalAlpha;

  // Scroll-driven wobble plus a very slow time term so the field breathes
  // at rest (ambient motion: slow and constant, per the motion spec).
  vec2 place(vec2 p) {
    float phase = p.x * 0.003 + p.y * 0.002;
    float s = uScrollY * 0.0008 + uTime * 0.045;
    return p + vec2(sin(phase + s) * 12.0, cos(phase * 1.3 + s * 0.7) * 8.0);
  }
  // Density gating (roadmap W3): element order fraction vs a per-class
  // threshold, soft-faded so nothing pops. The 1.08 keeps the tail of every
  // class fully visible at density 1.
  float gateVis(vec2 g) {
    float thresh = pow(uDensity, g.y) * 1.08;
    return 1.0 - smoothstep(thresh - 0.06, thresh + 0.02, g.x);
  }
`;

const LINE_VERT = PRELUDE + /* glsl */ `
  attribute vec2 aPerp;
  attribute float aCross;
  attribute float aHalfWidth;
  attribute float aT;
  attribute vec4 aColor;
  attribute vec2 aGate;
  attribute float aTaper;
  varying float vCross;
  varying float vT;
  varying vec4 vColor;
  varying vec2 vGate;
  varying float vTaper;
  varying float vCover;
  varying float vHW;
  void main() {
    vec2 c = place(position.xy);
    float hw = max(aHalfWidth, 0.7);
    vCover = min(1.0, aHalfWidth / 0.7);
    vec2 p = c + aPerp * aCross * hw;
    vCross = aCross; vT = aT; vColor = aColor; vGate = aGate; vTaper = aTaper; vHW = hw;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
  }
`;

const LINE_FRAG = PRELUDE + /* glsl */ `
  precision highp float;
  varying float vCross;
  varying float vT;
  varying vec4 vColor;
  varying vec2 vGate;
  varying float vTaper;
  varying float vCover;
  varying float vHW;
  void main() {
    float vis = gateVis(vGate);
    // Fixed ~1px anti-aliasing at the edge, whatever the width — so a wide
    // tube keeps a crisp contour and a solid body, a hairline stays soft.
    float dpx = abs(vCross) * vHW;
    float edge = 1.0 - smoothstep(vHW - 1.0, vHW + 0.15, dpx);
    float ef = vTaper > 0.0
      ? min(smoothstep(0.0, vTaper, vT), smoothstep(0.0, vTaper, 1.0 - vT))
      : 1.0;
    float a = vColor.a * vis * edge * ef * vCover * uGlobalAlpha;
    if (a < 0.002) discard;
    gl_FragColor = vec4(vColor.rgb, a);
  }
`;

const BEAM_VERT = PRELUDE + /* glsl */ `
  attribute vec2 aPerp;
  attribute float aCross;
  attribute float aHalfWidth;
  attribute float aT;
  attribute float aOpacity;
  attribute vec2 aGate;
  varying float vD;
  varying float vHW;
  varying float vT;
  varying float vOp;
  varying vec2 vGate;
  const float GLOW = 14.0;
  void main() {
    vec2 c = place(position.xy);
    float ext = aHalfWidth + GLOW;
    vec2 p = c + aPerp * aCross * ext;
    vD = aCross * ext; vHW = aHalfWidth; vT = aT; vOp = aOpacity; vGate = aGate;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
  }
`;

// Core + aura + glow in one pass.
const BEAM_FRAG = PRELUDE + /* glsl */ `
  precision highp float;
  varying float vD;
  varying float vHW;
  varying float vT;
  varying float vOp;
  varying vec2 vGate;
  void main() {
    float vis = gateVis(vGate);
    float d = abs(vD);
    float core = 1.0 - smoothstep(vHW - 0.7, vHW + 0.7, d);
    float aura = exp(-pow(d / (vHW * 3.0 + 2.0), 2.0)) * 0.14;
    float glow = exp(-pow(d / 12.0, 2.0)) * 0.22;
    float ef = min(smoothstep(0.0, 0.15, vT), smoothstep(0.0, 0.15, 1.0 - vT));
    float a = (core + aura + glow) * vOp * ef * vis * uGlobalAlpha;
    if (a < 0.002) discard;
    gl_FragColor = vec4(0.0, 0.6, 1.0, min(a, 1.0));
  }
`;

const DOT_VERT = PRELUDE + /* glsl */ `
  attribute vec2 aUV;
  attribute float aR;
  attribute float aOpacity;
  attribute vec2 aGate;
  attribute float aSoft;
  varying float vD;
  varying float vR;
  varying float vOp;
  varying vec2 vGate;
  varying float vSoft;
  void main() {
    vec2 c = place(position.xy);
    float ext = aR + 0.7;
    vec2 p = c + aUV * ext;
    vD = length(aUV) * ext; vR = aR; vOp = aOpacity; vGate = aGate; vSoft = aSoft;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
  }
`;

const DOT_FRAG = PRELUDE + /* glsl */ `
  precision highp float;
  varying float vD;
  varying float vR;
  varying float vOp;
  varying vec2 vGate;
  varying float vSoft;
  void main() {
    float vis = gateVis(vGate);
    float hard = 1.0 - smoothstep(vR - 0.7, vR + 0.7, vD);
    float soft = exp(-pow(vD / (vR * 0.55), 2.0));
    float a = mix(hard, soft, vSoft) * vOp * vis * uGlobalAlpha;
    if (a < 0.002) discard;
    gl_FragColor = vec4(0.0, 0.0, 0.0, a);
  }
`;

const RIBBON_VERT = PRELUDE + /* glsl */ `
  attribute vec2 aPerp;
  attribute float aCross;
  attribute float aHalfWidth;
  attribute float aSeed;
  attribute float aOpacity;
  attribute vec2 aGate;
  varying vec2 vNormalXY;
  varying float vWorldY;
  varying float vSeed;
  varying float vOp;
  varying vec2 vGate;
  varying float vCross;
  const float HALF_PI = 1.5707963267948966;
  void main() {
    vec2 c = place(position.xy);
    vec2 p = c + aPerp * aCross * aHalfWidth;
    // Fake tube cross-section: centre faces the camera (matcap centre,
    // bright), edges graze away (matcap rim). aPerp is the LOCAL
    // tangent-perpendicular so the reflection follows every bend.
    vNormalXY = aPerp * sin(aCross * HALF_PI);
    vWorldY = p.y; vSeed = aSeed; vOp = aOpacity; vGate = aGate; vCross = aCross;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
  }
`;

const RIBBON_FRAG = PRELUDE + /* glsl */ `
  precision highp float;
  uniform sampler2D uMatcap;
  uniform vec3 uTint;
  uniform vec3 uTintSky;
  uniform vec3 uTintGround;
  uniform float uViewportH;
  varying vec2 vNormalXY;
  varying float vWorldY;
  varying float vSeed;
  varying float vOp;
  varying vec2 vGate;
  varying float vCross;
  void main() {
    float vis = gateVis(vGate);
    vec2 uv = vNormalXY * 0.5 + 0.5;
    uv += vec2(sin(vSeed * 12.9898) * 0.015, cos(vSeed * 78.233) * 0.015);
    uv = clamp(uv, 0.02, 0.98);
    vec3 mc = texture2D(uMatcap, uv).rgb;
    float envT = clamp(vWorldY / max(uViewportH, 1.0), 0.0, 1.0);
    vec3 envTint = mix(uTintSky, uTintGround, envT);
    vec3 color = mc * mix(vec3(1.0), envTint, 0.28) * uTint;
    float edge = 1.0 - smoothstep(0.84, 1.0, abs(vCross));
    float a = vOp * vis * edge * uGlobalAlpha;
    if (a < 0.002) discard;
    gl_FragColor = vec4(color, a);
  }
`;

// ─── Geometry builders ──────────────────────────────────────

type ExtraSpec = Record<string, number>;

/** Accumulates triangle strips (two verts per sample) into one BufferGeometry. */
class StripBuilder {
  private pos: number[] = [];
  private perp: number[] = [];
  private cross: number[] = [];
  private hw: number[] = [];
  private t: number[] = [];
  private idx: number[] = [];
  private extra: Record<string, { size: number; data: number[] }> = {};
  private vcount = 0;

  constructor(extras: ExtraSpec) {
    for (const [name, size] of Object.entries(extras)) this.extra[name] = { size, data: [] };
  }

  get empty() { return this.vcount === 0; }

  addStrip(
    pts: Pt[],
    hwAt: (i: number, t: number) => number,
    extraAt: (i: number, t: number) => Record<string, number[]>,
  ) {
    const N = pts.length;
    if (N < 2) return;
    const base = this.vcount;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      let tx: number, ty: number;
      if (i === 0) { tx = pts[1].x - pts[0].x; ty = pts[1].y - pts[0].y; }
      else if (i === N - 1) { tx = pts[N - 1].x - pts[N - 2].x; ty = pts[N - 1].y - pts[N - 2].y; }
      else { tx = pts[i + 1].x - pts[i - 1].x; ty = pts[i + 1].y - pts[i - 1].y; }
      const len = Math.sqrt(tx * tx + ty * ty) || 1;
      const nx = -ty / len, ny = tx / len;
      const hw = hwAt(i, t);
      const ex = extraAt(i, t);
      for (const side of [1, -1]) {
        this.pos.push(pts[i].x, pts[i].y, 0);
        this.perp.push(nx, ny);
        this.cross.push(side);
        this.hw.push(hw);
        this.t.push(t);
        for (const [name, { data }] of Object.entries(this.extra)) data.push(...ex[name]);
      }
    }
    for (let i = 0; i < N - 1; i++) {
      const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
      this.idx.push(a, c, b, c, d, b);
    }
    this.vcount += N * 2;
  }

  build(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute("aPerp", new THREE.Float32BufferAttribute(this.perp, 2));
    geo.setAttribute("aCross", new THREE.Float32BufferAttribute(this.cross, 1));
    geo.setAttribute("aHalfWidth", new THREE.Float32BufferAttribute(this.hw, 1));
    geo.setAttribute("aT", new THREE.Float32BufferAttribute(this.t, 1));
    for (const [name, { size, data }] of Object.entries(this.extra)) {
      geo.setAttribute(name, new THREE.Float32BufferAttribute(data, size));
    }
    geo.setIndex(this.idx);
    return geo;
  }
}

/** Quads for dots (splatter, blots, caps, the soft haze). */
class DotBuilder {
  private pos: number[] = [];
  private uv: number[] = [];
  private r: number[] = [];
  private op: number[] = [];
  private gate: number[] = [];
  private soft: number[] = [];
  private idx: number[] = [];
  private vcount = 0;

  get empty() { return this.vcount === 0; }

  add(x: number, y: number, r: number, opacity: number, gate: [number, number], soft = 0) {
    const base = this.vcount;
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      this.pos.push(x, y, 0);
      this.uv.push(u, v);
      this.r.push(r);
      this.op.push(opacity);
      this.gate.push(gate[0], gate[1]);
      this.soft.push(soft);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.vcount += 4;
  }

  build(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute("aUV", new THREE.Float32BufferAttribute(this.uv, 2));
    geo.setAttribute("aR", new THREE.Float32BufferAttribute(this.r, 1));
    geo.setAttribute("aOpacity", new THREE.Float32BufferAttribute(this.op, 1));
    geo.setAttribute("aGate", new THREE.Float32BufferAttribute(this.gate, 2));
    geo.setAttribute("aSoft", new THREE.Float32BufferAttribute(this.soft, 1));
    geo.setIndex(this.idx);
    return geo;
  }
}

// End taper ramp used by the thin-line classes (matches the 2D fallback).
const endRamp = (t: number, frac: number) =>
  t < frac ? t / frac : t > 1 - frac ? (1 - t) / frac : 1;

const straight = (p0: Pt, p1: Pt, n = 8): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push({ x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t });
  }
  return out;
};

const BLACK: [number, number, number] = [0, 0, 0];
const INK: [number, number, number] = [0.02, 0.027, 0.055];
const WHITE: [number, number, number] = [1, 1, 1];

const GRAY160: [number, number, number] = [160 / 255, 160 / 255, 160 / 255];
const GRAY170: [number, number, number] = [170 / 255, 170 / 255, 170 / 255];

/**
 * A synthesized matcap for the edge-traced tubes: near-white at the centre
 * of the sphere, cooling to grey at the rim with a faint upper-left
 * highlight — the shading of a white plastic tube under soft light. Sampled
 * by the ribbon shader through the same fake tube normal as the chrome.
 */
function makePorcelainMatcap(): THREE.DataTexture {
  const N = 64;
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const nx = (x / (N - 1)) * 2 - 1, ny = (y / (N - 1)) * 2 - 1;
      const r = Math.min(1, Math.hypot(nx, ny));
      const rim = Math.pow(r, 2.2);
      const highlight = Math.max(0, 1 - Math.hypot(nx + 0.35, ny - 0.35) / 0.6) * 0.16;
      const base = 0.985 - rim * 0.42 + highlight;
      const i = (y * N + x) * 4;
      data[i] = Math.round(Math.min(1, base) * 255);
      data[i + 1] = Math.round(Math.min(1, base + 0.006) * 255);
      data[i + 2] = Math.round(Math.min(1, base + 0.018) * 255);
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

// ─── Renderer ───────────────────────────────────────────────

interface Batch { mesh: THREE.Mesh; mat: THREE.ShaderMaterial }

export class SceneRendererGL {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private batches: Batch[] = [];
  private matcapA: THREE.Texture;
  private matcapB: THREE.Texture;
  private porcelain: THREE.Texture;
  private disposed = false;
  private viewH = 1;
  /** Fires once the matcaps arrive so the host can repaint. */
  onTexturesLoaded: (() => void) | null = null;

  // Shared uniform objects — one write per frame updates every material.
  private u = {
    uScrollY: { value: 0 },
    uTime: { value: 0 },
    uDensity: { value: 1 },
    uGlobalAlpha: { value: 1 },
    uViewportH: { value: 1000 },
  };

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: false });
    this.renderer.setClearColor(0x000000, 0);
    this.camera = new THREE.OrthographicCamera(0, 1, 0, 1, -1000, 1000);

    const loader = new THREE.TextureLoader();
    const onLoad = () => this.onTexturesLoaded?.();
    this.matcapA = loader.load(withBase("/assets/textures/matcap-chrome-a.webp"), onLoad);
    this.matcapB = loader.load(withBase("/assets/textures/matcap-chrome-b.webp"), onLoad);
    for (const t of [this.matcapA, this.matcapB]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.ClampToEdgeWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      t.generateMipmaps = false;
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
    }
    this.porcelain = makePorcelainMatcap();
  }

  /** Canvas is viewport-sized; the camera looks at a window of the taller scene. */
  resize(w: number, viewH: number, dpr: number) {
    if (this.disposed) return;
    this.viewH = viewH;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, viewH, true);
    this.camera.left = 0;
    this.camera.right = w;
    this.setViewOffset(0);
  }

  /** Slide the camera window down the scene — the parallax, without moving a giant canvas. */
  setViewOffset(y: number) {
    this.camera.top = y;
    this.camera.bottom = y + this.viewH;
    this.camera.updateProjectionMatrix();
  }

  private clear() {
    for (const { mesh, mat } of this.batches) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mat.dispose();
    }
    this.batches = [];
  }

  private addBatch(geo: THREE.BufferGeometry, vert: string, frag: string, extraUniforms: Record<string, { value: unknown }>, order: number) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      uniforms: { ...this.u, ...extraUniforms },
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = order;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.batches.push({ mesh, mat });
  }

  private ribbonUniforms(matcap: THREE.Texture, tint: number) {
    return {
      uMatcap: { value: matcap },
      uTint: { value: new THREE.Color(tint) },
      uTintSky: { value: new THREE.Color(0xd9e4ee) },
      uTintGround: { value: new THREE.Color(0x0b0d12) },
    };
  }

  /** Rebuild all geometry for a freshly generated scene. */
  setScene(raw: RawScene) {
    if (this.disposed) return;
    this.clear();
    const R = raw.focalRadius;
    const frac = (i: number, n: number) => (n > 1 ? i / (n - 1) : 0);
    const lineExtras = { aColor: 4, aGate: 2, aTaper: 1 };
    const lineStrip = (
      b: StripBuilder, pts: Pt[], width: number, rgb: [number, number, number], opacity: number,
      gate: [number, number], taperFrac: number, hwFn?: (t: number) => number,
    ) => {
      b.addStrip(
        pts,
        (_, t) => (hwFn ? hwFn(t) : (width * endRamp(t, taperFrac)) / 2),
        () => ({ aColor: [rgb[0], rgb[1], rgb[2], opacity], aGate: gate, aTaper: [hwFn ? 0 : taperFrac] }),
      );
    };
    // Tube caps: cables and scribbles taper briefly at both ends.
    const cap = (t: number) => Math.min(1, t / 0.06, (1 - t) / 0.06);

    // ── Under-layer: soft photocopy haze around the nucleus ──
    const under = new DotBuilder();
    under.add(raw.focal.x + R * 0.1, raw.focal.y + R * 0.06, R * 1.15, 0.10, [0, 1.6], 1);

    // ── Thin ink field: arcs → throughs → hairlines → bundles → debris → wires → bolts → fibres → whips ──
    const lines = new StripBuilder(lineExtras);
    raw.arcs.forEach((a, i) =>
      lineStrip(lines, sampleQuadratic(a.p0, a.cp, a.p1, 16), a.width, GRAY170, a.opacity, [frac(i, raw.arcs.length), 1.0], 0.15));
    raw.throughs.forEach((t, i) =>
      lineStrip(lines, t.cp ? sampleQuadratic(t.p0, t.cp, t.p1, 16) : straight(t.p0, t.p1), t.width, BLACK, t.opacity, [frac(i, raw.throughs.length), 1.0], 0.12));
    raw.hairlines.forEach((l, i) =>
      lineStrip(lines, straight(l.p0, l.p1, 6), 0.5, l.gray ? GRAY160 : BLACK, l.opacity, [frac(i, raw.hairlines.length), 1.4], 0.15));
    raw.bundles.forEach((b, i) =>
      b.lines.forEach((ln) =>
        lineStrip(lines, straight(ln.p0, ln.p1, 6), b.width, BLACK, b.opacity, [frac(i, raw.bundles.length), 1.2], 0.18)));
    raw.scratches.forEach((s, i) =>
      lineStrip(lines, s.cp ? sampleQuadratic(s.p0, s.cp, s.p1, 8) : straight(s.p0, s.p1, 3), s.width, BLACK, s.opacity, [frac(i, raw.scratches.length), 1.6], 0));
    raw.wires.forEach((w, i) =>
      lineStrip(lines, w.points, w.width, BLACK, w.opacity, [frac(i, raw.wires.length), 1.2], 0.06));
    raw.bolts.forEach((b, i) =>
      lineStrip(lines, b.points, b.width, BLACK, b.opacity, [frac(i, raw.bolts.length), 1.1], 0.05));
    raw.fibers.forEach((fb, i) =>
      fb.strands.forEach((s) => lineStrip(lines, s, fb.width, BLACK, fb.opacity, [frac(i, raw.fibers.length), 1.2], 0.08)));
    raw.whips.forEach((w, i) =>
      lineStrip(lines, w.points, w.maxWidth, BLACK, w.opacity, [frac(i, raw.whips.length), 1.0], 0, (t) => (w.maxWidth * Math.sin(t * Math.PI)) / 2));

    // ── Ink clots + calligraphic swipes (under the chrome) ──
    const blots = new DotBuilder();
    raw.blots.forEach((b, i) => blots.add(b.x, b.y, b.r, b.opacity, [frac(i, raw.blots.length), 1.0], b.r > 6 ? 0.35 : 0));
    const swipes = new StripBuilder(lineExtras);
    raw.swipes.forEach((s, i) =>
      lineStrip(swipes, samplePath(s.cp, 40), 1, INK, s.opacity, [frac(i, raw.swipes.length), 0.85], 0, (t) => s.widthFn(t) / 2));

    // ── Cables: a black contour beneath a porcelain-shaded tube body; contour scribbles the same way ──
    const cableOutline = new StripBuilder(lineExtras);
    const cableFill = new StripBuilder({ aSeed: 1, aOpacity: 1, aGate: 2 });
    raw.cables.forEach((c, i) => {
      const g: [number, number] = [frac(i, raw.cables.length), 0.9];
      const contour = c.width > 8 ? 2.0 : 1.4;
      lineStrip(cableOutline, c.points, 1, BLACK, c.opacity, g, 0, (t) => (c.width * cap(t)) / 2 + contour);
      cableFill.addStrip(c.points, (_, t) => (c.width * cap(t)) / 2, () => ({ aSeed: [i * 7.1], aOpacity: [0.98], aGate: g }));
    });
    raw.scribbles.forEach((s, i) => {
      const g: [number, number] = [frac(i, raw.scribbles.length), 1.1];
      lineStrip(cableOutline, s.points, 1, BLACK, 0.9, g, 0, () => s.width / 2 + 1.2);
      cableFill.addStrip(s.points, () => s.width / 2, () => ({ aSeed: [i * 3.3], aOpacity: [0.98], aGate: g }));
    });

    // ── Chrome ribbons ──
    const ribbonExtras = { aSeed: 1, aOpacity: 1, aGate: 2 };
    const chromeA = new StripBuilder(ribbonExtras);
    const chromeB = new StripBuilder(ribbonExtras);
    const chromeCyan = new StripBuilder(ribbonExtras);
    const addTendril = (b: StripBuilder, cp: RawBrush["cp"], widthFn: WidthFn, seed: number, opacity: number, samples: number, gate: [number, number]) => {
      b.addStrip(samplePath(cp, samples), (_, t) => widthFn(t) / 2, () => ({ aSeed: [seed], aOpacity: [opacity], aGate: gate }));
    };
    raw.inks.forEach((s, i) => addTendril(chromeA, s.cp, s.widthFn, s.seed, 0.92, 50, [frac(i, raw.inks.length), 0.8]));
    raw.brushes.forEach((s, i) => addTendril(chromeA, s.cp, s.widthFn, s.seed, s.opacity, 60, [frac(i, raw.brushes.length), 0.7]));
    raw.brushTangles.forEach((s, i) => addTendril(chromeB, s.cp, s.widthFn, s.seed, s.opacity, 30, [frac(i, raw.brushTangles.length), 1.5]));
    raw.thickCyans.forEach((s: RawInk, i) => addTendril(chromeCyan, s.cp, s.widthFn, s.seed, 0.9, 40, [frac(i, raw.thickCyans.length), 1.0]));

    // ── White burnout glints over the black ──
    const glints = new StripBuilder(lineExtras);
    raw.streaks.forEach((s, i) =>
      lineStrip(glints, s.points, s.width, WHITE, s.opacity, [frac(i, raw.streaks.length), 1.2], 0, (t) => (s.width * Math.sin(Math.min(1, t * 1.15) * Math.PI)) / 2));

    // ── Splatter + accent caps ──
    const dots = new DotBuilder();
    raw.splatter.forEach((d, i) => dots.add(d.x, d.y, d.r, d.opacity, [frac(i, raw.splatter.length), 1.5]));
    raw.scratches.forEach((s, i) => { if (s.hasDot) dots.add(s.p0.x, s.p0.y, s.width * 0.7, s.opacity, [frac(i, raw.scratches.length), 1.6]); });
    raw.accents.forEach((a, i) => { if (a.hasDot) dots.add(a.p0.x, a.p0.y, a.width * 0.8, a.opacity, [frac(i, raw.accents.length), 1.4]); });

    // ── Accent marks (over the chrome, like the 2D order) ──
    const accents = new StripBuilder(lineExtras);
    raw.accents.forEach((a, i) =>
      accents.addStrip(
        a.cp ? sampleQuadratic(a.p0, a.cp, a.p1, 8) : straight(a.p0, a.p1, 3),
        () => a.width / 2,
        () => ({ aColor: [0, 0, 0, a.opacity], aGate: [frac(i, raw.accents.length), 1.4], aTaper: [0] }),
      ));

    // ── Cyan beams (core + aura + glow in-shader) + a glow bed under the thick cyans ──
    const beams = new StripBuilder({ aOpacity: 1, aGate: 2 });
    raw.cyans.forEach((b, i) =>
      beams.addStrip(
        b.cp ? sampleQuadratic(b.p0, b.cp, b.p1, 16) : straight(b.p0, b.p1, 4),
        () => b.width / 2,
        () => ({ aOpacity: [b.opacity], aGate: [frac(i, raw.cyans.length), 1.1] }),
      ));
    raw.thickCyans.forEach((s, i) =>
      beams.addStrip(
        samplePath(s.cp, 24),
        (_, t) => s.widthFn(t) * 0.35,
        () => ({ aOpacity: [0.45], aGate: [frac(i, raw.thickCyans.length), 1.0] }),
      ));

    // ── Assemble in draw order ──
    let order = 0;
    if (!under.empty) this.addBatch(under.build(), DOT_VERT, DOT_FRAG, {}, order++);
    if (!lines.empty) this.addBatch(lines.build(), LINE_VERT, LINE_FRAG, {}, order++);
    if (!blots.empty) this.addBatch(blots.build(), DOT_VERT, DOT_FRAG, {}, order++);
    if (!swipes.empty) this.addBatch(swipes.build(), LINE_VERT, LINE_FRAG, {}, order++);
    if (!chromeA.empty) this.addBatch(chromeA.build(), RIBBON_VERT, RIBBON_FRAG, this.ribbonUniforms(this.matcapA, 0xffffff), order++);
    if (!chromeB.empty) this.addBatch(chromeB.build(), RIBBON_VERT, RIBBON_FRAG, this.ribbonUniforms(this.matcapB, 0xffffff), order++);
    if (!cableOutline.empty) this.addBatch(cableOutline.build(), LINE_VERT, LINE_FRAG, {}, order++);
    if (!cableFill.empty) this.addBatch(cableFill.build(), RIBBON_VERT, RIBBON_FRAG, this.ribbonUniforms(this.porcelain, 0xffffff), order++);
    if (!glints.empty) this.addBatch(glints.build(), LINE_VERT, LINE_FRAG, {}, order++);
    if (!dots.empty) this.addBatch(dots.build(), DOT_VERT, DOT_FRAG, {}, order++);
    if (!accents.empty) this.addBatch(accents.build(), LINE_VERT, LINE_FRAG, {}, order++);
    if (!beams.empty) this.addBatch(beams.build(), BEAM_VERT, BEAM_FRAG, {}, order++);
    // Cyan chrome: the matcap multiplied by a lifted cyan so the highlight stays white-blue.
    if (!chromeCyan.empty) this.addBatch(chromeCyan.build(), RIBBON_VERT, RIBBON_FRAG, this.ribbonUniforms(this.matcapA, 0x33b8ff), order++);
  }

  /** Render one frame; time in seconds drives the ambient drift. */
  render(scrollY: number, density: number, globalAlpha: number, viewportH: number, time: number) {
    if (this.disposed) return;
    this.u.uScrollY.value = scrollY;
    this.u.uTime.value = time;
    this.u.uDensity.value = density;
    this.u.uGlobalAlpha.value = globalAlpha;
    this.u.uViewportH.value = viewportH;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    this.matcapA.dispose();
    this.matcapB.dispose();
    this.porcelain.dispose();
    this.renderer.dispose();
  }
}
