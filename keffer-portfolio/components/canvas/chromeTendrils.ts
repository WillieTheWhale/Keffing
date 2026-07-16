// Chrome tendril renderer — feedback pass, 2026-07-16.
//
// The "black tendrils" (brush strokes, brush tangles, ink strokes — the
// bold sweeping curves) used to be a flat perpendicular gradient computed
// ONCE per stroke from an averaged direction, so the "chrome" reflection
// never actually rotated to follow the curve — it read as a solid dark
// shape with a static highlight band. This renders the same strokes as
// matcap-shaded ribbons instead: a per-sample fake tube normal (built from
// the LOCAL tangent, recomputed continuously along the curve) samples a
// real chrome matcap texture (a ray-traced mirror-sphere render against a
// genuine CC0 HDRI — see public/assets/textures/CREDITS.md), so the
// reflection visibly slides along the arc of every stroke as it bends.
// Matcap is the standard "almost-3D, not literally 3D" technique — a tube
// cross-section is faked per-fragment from an interpolated width-parameter,
// not tessellated geometry, so it stays cheap for ~20 strokes.
//
// Deliberately embedded INTO LineCanvas's own container (as a third
// <canvas>) rather than built as a standalone component: this reuses
// LineCanvas's existing DPR/zoom/overflow sizing and its CSS parallax +
// dive-dolly container transform for free, so the chrome tendrils can never
// drift out of alignment with the hairlines/cyan beams that remain in the
// 2D canvas underneath.

import * as THREE from "three";
import type { Pt, RawBrush, RawInk } from "./LineCanvas";
import { smoothedTuneRef } from "@/lib/tuning";

export function detectWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function sampleCubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

// ─── Shaders ────────────────────────────────────────────────

const VERT = /* glsl */ `
  attribute vec2 aPerp;
  attribute float aCross;
  attribute float aHalfWidth;
  uniform float uScrollY;
  uniform float uTune;
  uniform vec2 uFocal;
  varying vec2 vNormalXY;
  varying float vWorldY;

  // Mirrors LineCanvas's deform() exactly (components/canvas/LineCanvas.tsx)
  // so the chrome tendrils wobble in lockstep with the hairlines/tangle
  // that stay on the 2D canvas underneath.
  vec2 deformPt(vec2 p, float scrollY) {
    float phase = p.x * 0.003 + p.y * 0.002;
    float s = scrollY * 0.0008;
    return p + vec2(sin(phase + s) * 12.0, cos(phase * 1.3 + s * 0.7) * 8.0);
  }

  void main() {
    vec2 base = position.xy + aPerp * aCross * aHalfWidth;
    vec2 d = deformPt(base, uScrollY);
    // Mirrors the _tune pull in LineCanvas's deform(): up to 82% of the way
    // to the focal point at full beat intensity.
    float pull = 0.82 * uTune * uTune;
    vec2 p = d + (uFocal - d) * pull;

    // Fake tube cross-section: aCross sweeps -1..+1 across the ribbon width.
    // At the centerline (aCross=0) the normal points straight at the
    // camera (bright, matcap center); at the edges it grazes away (matcap
    // rim). This is what makes the reflection continuously follow the
    // curve instead of sitting flat — aPerp is the LOCAL tangent-
    // perpendicular at THIS sample, not one fixed direction for the whole
    // stroke.
    float HALF_PI = 1.5707963267948966;
    vNormalXY = aPerp * sin(aCross * HALF_PI);
    vWorldY = p.y;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uMatcap;
  uniform float uAlpha;
  uniform float uSeed;
  uniform vec3 uTintSky;
  uniform vec3 uTintGround;
  uniform float uViewportH;
  varying vec2 vNormalXY;
  varying float vWorldY;

  void main() {
    if (uAlpha <= 0.001) discard;
    vec2 uv = vNormalXY * 0.5 + 0.5;
    // Per-stroke seed jitter so identical strokes don't sample identical
    // matcap texels — small, organic, matches the ±1.5% shift trick used
    // by the original 2D chrome gradient.
    uv += vec2(sin(uSeed * 12.9898) * 0.015, cos(uSeed * 78.233) * 0.015);
    uv = clamp(uv, 0.02, 0.98);
    vec3 mc = texture2D(uMatcap, uv).rgb;

    // Subtle vertical environment tint (sky lighter near top, ground
    // darker near bottom) — same compositional cue as the old 2D chrome
    // renderer's "environment reflection overlay".
    float envT = clamp(vWorldY / max(uViewportH, 1.0), 0.0, 1.0);
    vec3 envTint = mix(uTintSky, uTintGround, envT);
    vec3 color = mc * mix(vec3(1.0), envTint, 0.28);

    gl_FragColor = vec4(color, uAlpha);
  }
`;

// ─── Geometry building ──────────────────────────────────────

interface MeshEntry {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  baseOpacity: number;
  strokeFrac: number;
  exponent: number;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export class ChromeTendrilRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private meshes: MeshEntry[] = [];
  private matcapA: THREE.Texture;
  private matcapB: THREE.Texture;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.camera = new THREE.OrthographicCamera(0, 1, 0, 1, -1000, 1000);

    const loader = new THREE.TextureLoader();
    this.matcapA = loader.load("/assets/textures/matcap-chrome-a.webp");
    this.matcapB = loader.load("/assets/textures/matcap-chrome-b.webp");
    for (const t of [this.matcapA, this.matcapB]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.ClampToEdgeWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      t.generateMipmaps = false;
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
    }
  }

  resize(w: number, h: number, dpr: number) {
    if (this.disposed) return;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, true);
    this.camera.left = 0;
    this.camera.right = w;
    this.camera.top = 0;
    this.camera.bottom = h;
    this.camera.near = -1000;
    this.camera.far = 1000;
    this.camera.updateProjectionMatrix();
  }

  private clearMeshes() {
    for (const { mesh, mat } of this.meshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mat.dispose();
    }
    this.meshes = [];
  }

  private addMesh(
    cp: [Pt, Pt, Pt, Pt],
    widthFn: (t: number) => number,
    seed: number,
    opacity: number,
    samples: number,
    matcap: THREE.Texture,
    exponent: number,
    strokeFrac: number,
    renderOrder: number
  ) {
    const N = samples;
    const pts: Pt[] = [];
    for (let i = 0; i <= N; i++) pts.push(sampleCubic(cp[0], cp[1], cp[2], cp[3], i / N));

    const vertCount = (N + 1) * 2;
    const positions = new Float32Array(vertCount * 3);
    const perp = new Float32Array(vertCount * 2);
    const cross = new Float32Array(vertCount);
    const halfWidth = new Float32Array(vertCount);

    for (let i = 0; i <= N; i++) {
      const t = i / N;
      let tx: number, ty: number;
      if (i === 0) { tx = pts[1].x - pts[0].x; ty = pts[1].y - pts[0].y; }
      else if (i === N) { tx = pts[N].x - pts[N - 1].x; ty = pts[N].y - pts[N - 1].y; }
      else { tx = pts[i + 1].x - pts[i - 1].x; ty = pts[i + 1].y - pts[i - 1].y; }
      const len = Math.sqrt(tx * tx + ty * ty) || 1;
      const nx = -ty / len, ny = tx / len;
      const hw = widthFn(t) / 2;

      const iTop = i * 2, iBot = i * 2 + 1;
      positions[iTop * 3] = pts[i].x; positions[iTop * 3 + 1] = pts[i].y; positions[iTop * 3 + 2] = 0;
      positions[iBot * 3] = pts[i].x; positions[iBot * 3 + 1] = pts[i].y; positions[iBot * 3 + 2] = 0;
      perp[iTop * 2] = nx; perp[iTop * 2 + 1] = ny;
      perp[iBot * 2] = nx; perp[iBot * 2 + 1] = ny;
      cross[iTop] = 1; cross[iBot] = -1;
      halfWidth[iTop] = hw; halfWidth[iBot] = hw;
    }

    const indices: number[] = [];
    for (let i = 0; i < N; i++) {
      const top0 = i * 2, bot0 = i * 2 + 1, top1 = (i + 1) * 2, bot1 = (i + 1) * 2 + 1;
      indices.push(top0, top1, bot0, top1, bot1, bot0);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aPerp", new THREE.BufferAttribute(perp, 2));
    geo.setAttribute("aCross", new THREE.BufferAttribute(cross, 1));
    geo.setAttribute("aHalfWidth", new THREE.BufferAttribute(halfWidth, 1));
    geo.setIndex(indices);

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      uniforms: {
        uScrollY: { value: 0 },
        uTune: { value: 0 },
        uFocal: { value: new THREE.Vector2(0, 0) },
        uMatcap: { value: matcap },
        uAlpha: { value: opacity },
        uSeed: { value: seed },
        uTintSky: { value: new THREE.Color(0xd9e4ee) },
        uTintGround: { value: new THREE.Color(0x0b0d12) },
        uViewportH: { value: 1000 },
      },
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = renderOrder;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.meshes.push({ mesh, mat, baseOpacity: opacity, strokeFrac, exponent });
  }

  /** Rebuild the ribbon geometry for a freshly generated scene (setup() / resize). */
  setScene(brushes: RawBrush[], brushTangles: RawBrush[], inks: RawInk[]) {
    if (this.disposed) return;
    this.clearMeshes();
    let order = 0;

    // Draw order matches the original 2D sequence (inks → brushTangles →
    // brushes were items 7, 8, 9 in renderMain) so later strokes still
    // blend on top of earlier ones, same as before.
    const inkTotal = inks.length;
    inks.forEach((s, idx) => {
      this.addMesh(s.cp, s.widthFn, s.seed, 0.92, 50, this.matcapA, 0.8, inkTotal > 0 ? idx / inkTotal : 0, order++);
    });

    const tangleTotal = brushTangles.length;
    brushTangles.forEach((s, idx) => {
      this.addMesh(s.cp, s.widthFn, s.seed, s.opacity, 30, this.matcapB, 1.5, tangleTotal > 0 ? idx / tangleTotal : 0, order++);
    });

    const brushTotal = brushes.length;
    brushes.forEach((s, idx) => {
      this.addMesh(s.cp, s.widthFn, s.seed, s.opacity, 60, this.matcapA, 0.7, brushTotal > 0 ? idx / brushTotal : 0, order++);
    });
  }

  /** Render one frame. tune is read from the shared smoothedTuneRef directly. */
  render(scrollY: number, focalX: number, focalY: number, density: number, globalAlpha: number, viewportH: number) {
    if (this.disposed) return;
    const tune = smoothedTuneRef.current;

    for (const entry of this.meshes) {
      const u = entry.mat.uniforms;
      u.uScrollY.value = scrollY;
      u.uTune.value = tune;
      (u.uFocal.value as THREE.Vector2).set(focalX, focalY);
      u.uViewportH.value = viewportH;

      // Density gating (roadmap W3), same exponents/soft-fade approach as
      // the 2D gate() function, computed here in JS since there are only
      // ~20 meshes total — no need to push it into the shader.
      const thresh = Math.pow(density, entry.exponent);
      const visibility = 1 - smoothstep(thresh - 0.06, thresh + 0.02, entry.strokeFrac);
      u.uAlpha.value = entry.baseOpacity * visibility * globalAlpha;
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clearMeshes();
    this.matcapA.dispose();
    this.matcapB.dispose();
    this.renderer.dispose();
  }
}
