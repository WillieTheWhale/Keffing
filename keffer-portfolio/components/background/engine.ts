// Background — ALLOY. The three.js engine (from v2 CHROME, extended).
//
// One renderer, one scene, one camera, ONE depth buffer: liquid chrome and
// glass (v2) and drawn porcelain (v1, in 3D) are built into the same groups,
// so a porcelain tube can fall into a chrome vortex and pass behind one blade
// and in front of the next. Section groups are placed in world space so that
// each sits at its authored viewport anchor when the camera is at that
// group's "home" scroll position; the camera travels down with scroll (one
// rate, so depth alone gives the parallax), decelerates and holds as the page
// reaches Contact, and in the Dive flies into the contact mass, where a
// liquid mirror swings round to face it and its reflected sky becomes the
// end card ("through the mirror"). Bloom is a cheap custom chain fed only by
// HDR excess.

import * as THREE from "three";
import { buildAll, groupDefs, type Built, type PackedMesh, type PageSpec, type Quality } from "./build";
import type { GroupDef, SectionId, ShardSpec } from "./pieces";
import { BREATH } from "./bus";
import {
  BLUR_FRAG, CHROME_FRAG, COMPOSITE_FRAG, GRAPHITE_FRAG, GRAPHITE_VERT, MIRROR_FRAG, PORCELAIN_FRAG, QUAD_VERT, RIBBON_VERT, SHARD_VERT,
} from "./shaders";
import { withBase } from "@/lib/basePath";
import { PAPER } from "./paper";

export const FOV = 32;
const VIS_H = 2 * Math.tan(((FOV / 2) * Math.PI) / 180); // visible height per unit depth
/** World units the camera travels per viewport-height of (camera) scroll. */
const RATE = 0.6 * VIS_H * 10; // a depth-10 group moves at 0.6× content speed

const A = withBase("/assets/background/");

export interface PageLayout {
  /** [top, height] in viewport heights, per section id. */
  sections: Partial<Record<SectionId, [number, number]>>;
  maxScrollVH: number;
}

/** A text block (client rect, css px) that chrome must whiten behind, with its strength. */
export interface Mask { x: number; y: number; w: number; h: number; amt: number }

export interface FrameState {
  scrollVH: number;
  time: number;
  dive: number;
  velocity: number;
  /** Up to four masks; only the first `maskCount` entries are live. */
  masks: Mask[];
  maskCount: number;
}

export type { Quality };

/** Inner pages: their own groups and a plain drift instead of the home page's section curve. */
export interface PageScene {
  /** What the page's groups are built from (pieces.ts pageGroups). */
  spec: PageSpec;
  /** Camera travel per scrolled screen (the home page moves 1:1 until Contact). */
  parallax: number;
}

/** Camera scroll: linear, then decelerates over [h0,h1] and holds. */
export function makeCamScroll(layout: PageLayout): (s: number) => number {
  const c = layout.sections.contact, d = layout.sections.dive;
  const h0 = c ? c[0] - 0.25 : 1e9;
  const h1 = d ? d[0] + 0.1 : h0 + 1;
  const span = Math.max(0.3, h1 - h0);
  return (s: number) => {
    if (s <= h0) return s;
    const x = Math.min(s, h1) - h0;
    return h0 + x - (x * x) / (2 * span);
  };
}

export function homeScroll(layout: PageLayout, section: SectionId, t: number): number {
  if (section === "hero") return 0;
  const sec = layout.sections[section];
  if (!sec) return 0;
  return Math.max(0, sec[0] + t * sec[1] - 0.5);
}

interface GroupRT {
  def: GroupDef;
  root: THREE.Group;
  core: THREE.Group;
  axis: THREE.Vector3;
  uniforms: Record<string, THREE.IUniform>[];
  /** opaque chrome, glass, porcelain; instanced shards opaque and glass */
  mats: { o: THREE.ShaderMaterial; g: THREE.ShaderMaterial; p: THREE.ShaderMaterial; so: THREE.ShaderMaterial; sg: THREE.ShaderMaterial };
  home: number;
  presence: number;
  phase: number;
}

const _q = new THREE.Quaternion();
// per-frame scratch (the frame loop allocates nothing)
const _base = new THREE.Vector3();
const _tgt = new THREE.Vector3();
const _v = new THREE.Vector3();
const DIVE_OFF1 = new THREE.Vector3(0.15, 0.1, 1.6);
const DIVE_OFF2 = new THREE.Vector3(0, 0, 0.55);
const MIRROR_OFF = new THREE.Vector3(0.1, 0.02, 0.35);
// the mirror sheet pivots about its long axis AR, from edge-on (SIDE) to facing +Z
const MIRROR_AR = new THREE.Vector3(0.36, 0.93, 0).normalize();
const MIRROR_Z = new THREE.Vector3(0, 0, 1);
const MIRROR_SIDE = new THREE.Vector3().crossVectors(MIRROR_AR, MIRROR_Z).normalize();


export class AlloyEngine {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private groups: GroupRT[] = [];
  /** Draw nothing into the bloom source: graphite (skipped there) and porcelain (depth only there). */
  private graphite: THREE.Mesh[] = [];
  private porcelainMats: THREE.ShaderMaterial[] = [];
  private mir = { on: false, full: false };
  private shared: Record<string, THREE.IUniform>;
  private textures: THREE.Texture[] = [];
  private layout: PageLayout | null = null;
  private camScroll: (s: number) => number = (s) => s;
  private groupDefs: GroupDef[];
  private page: PageScene | null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private quality: Quality;
  private bloomOn: boolean;
  private rtBloom: THREE.WebGLRenderTarget | null = null;
  private rtA: THREE.WebGLRenderTarget | null = null;
  private rtB: THREE.WebGLRenderTarget | null = null;
  private rtC: THREE.WebGLRenderTarget | null = null;
  private rtD: THREE.WebGLRenderTarget | null = null;
  private quad: THREE.Mesh | null = null;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private blurMat: THREE.ShaderMaterial | null = null;
  private compMat: THREE.ShaderMaterial | null = null;
  private mirrorScene = new THREE.Scene();
  private mirrorMat: THREE.ShaderMaterial;
  private diveTarget = new THREE.Vector3();
  private pending = 3; // env + white env + built and compiled (+ each graphite texture)
  /** The geometry build in flight (geometry.worker.ts). */
  private worker: Worker | null = null;
  /** The end-card sky texture is loaded (the canvas can carry the finale). */
  skyReady = false;
  /** Set by dispose(): texture loads that land afterwards are dropped. */
  private disposed = false;
  ready = false;
  onReady: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement, quality: Quality, page: PageScene | null = null) {
    this.page = page;
    this.groupDefs = groupDefs(page ? page.spec : null);
    this.quality = quality;
    // ?nobloom (dev aid) compares the frame without the glow chain
    this.bloomOn = quality === "full" && !(typeof location !== "undefined" && location.search.includes("nobloom"));
    this.renderer = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: true, premultipliedAlpha: true,
      powerPreference: "high-performance", stencil: false,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // the shaders write sRGB themselves
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.sortObjects = true;
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 80);

    this.shared = {
      uEnv: { value: null },
      uEnvW: { value: null },
      uEnvYaw: { value: 0 },
      uTime: { value: 0 },
      uPaper: { value: new THREE.Vector3() },
      uPaperS: { value: new THREE.Vector3() },
      uHot: { value: 2.6 },
      uBloom: { value: 0 },
      uRipple: { value: 0.1 },
      uTiltDark: { value: -0.42 },
      uTiltWhite: { value: 0.3 },
      uFrost: { value: 1.6 },
      uMasks: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(-1e4, -1e4, -1e4 + 1, -1e4 + 1)) },
      uMaskAmt: { value: new THREE.Vector4() },
      uNameSoft: { value: 60 },
      uDpr: { value: 1 },
      uLineW: { value: 1.38 },
      uLight: { value: new THREE.Vector3(-0.5, 0.72, 0.48).normalize() },
    };
    this.setPaper(PAPER);

    const loadEnv = (url: string, uniform: string) => {
      new THREE.TextureLoader().load(url, (tex) => {
        if (this.disposed) { tex.dispose(); return; }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.mapping = THREE.EquirectangularReflectionMapping;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        tex.anisotropy = 1;
        this.textures.push(tex);
        this.shared[uniform].value = tex;
        this.loaded();
      });
    };
    const k = quality === "full" ? "" : "-1k";
    loadEnv(`${A}env-sky${k}.jpg`, "uEnv");
    loadEnv(`${A}env-white${k}.jpg`, "uEnvW");

    this.mirrorMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: MIRROR_FRAG,
      uniforms: {
        uEnv: this.shared.uEnv, uEnvW: this.shared.uEnvW, uEnvYaw: this.shared.uEnvYaw, uTime: this.shared.uTime,
        uPresence: { value: 1 }, uHaze: { value: 0 }, uPaper: this.shared.uPaper, uHot: this.shared.uHot,
        uBloom: { value: 0 }, uRipple: { value: 0 }, uTiltDark: this.shared.uTiltDark,
        uSky: { value: null }, uSkyAspect: { value: 1.5 }, uRes: { value: new THREE.Vector2(1, 1) },
        uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uViewProj: { value: new THREE.Matrix4() },
        uView: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() },
        uMC: { value: new THREE.Vector3() }, uMU: { value: new THREE.Vector3(1, 0, 0) }, uMV: { value: new THREE.Vector3(0, 1, 0) },
        uMN: { value: new THREE.Vector3(0, 0, 1) }, uMSize: { value: new THREE.Vector2(1, 1) },
        uWidth: { value: 0.4 }, uBow: { value: 0.12 }, uGrow: { value: 1 }, uRippleAmp: { value: 0.05 }, uMirror: { value: 0 },
        uCurv: { value: 0.2 }, uFull: { value: 0 }, uDrift: { value: new THREE.Vector2() }, uMirTilt: { value: 0.32 }, uBreath: { value: 0 },
      },
      depthTest: true, depthWrite: true, transparent: true,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    const mgeo = new THREE.BufferGeometry();
    mgeo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const mq = new THREE.Mesh(mgeo, this.mirrorMat);
    mq.frustumCulled = false;
    this.mirrorScene.add(mq);

    this.makeGroups();
    this.requestBuild();
  }

  /**
   * The geometry (~80–130 ms on desktop for the whole page, lite about half;
   * several times that on a slow phone) is swept in a worker while the
   * textures download; in place if workers are unavailable.
   */
  private requestBuild() {
    const page = this.page ? this.page.spec : null;
    const done = (built: Built) => {
      this.worker?.terminate();
      this.worker = null;
      if (this.disposed) return;
      this.attach(built);
      this.compileAll();
    };
    try {
      const w = new Worker(new URL("./geometry.worker.ts", import.meta.url), { type: "module" });
      this.worker = w;
      w.onmessage = (e: MessageEvent<Built>) => done(e.data);
      w.onerror = (e) => {
        e.preventDefault();
        done(buildAll(this.quality, page));
      };
      w.postMessage({ quality: this.quality, page });
    } catch {
      done(buildAll(this.quality, page));
    }
  }

  /** Compile every program without blocking the main thread on it (KHR_parallel_shader_compile). */
  private compileAll() {
    const mats = [...this.renderer.compile(this.scene, this.camera), ...this.renderer.compile(this.mirrorScene, this.camera)];
    const ready = (m: THREE.Material) => (this.renderer.properties.get(m) as { currentProgram?: { isReady(): boolean } }).currentProgram?.isReady();
    const poll = () => {
      if (this.disposed) return;
      if (mats.every(ready)) this.loaded();
      else setTimeout(poll, 10);
    };
    poll();
  }

  /** An env map, a graphite texture or the build + compile is done; the last one brings first light. */
  private loaded() {
    if (--this.pending !== 0) return;
    this.warmup();
    this.ready = true;
    this.onReady?.();
    if (!this.page) this.loadSky(); // the end-card sky is a home-page finale only
  }

  /** The paper colour the depth haze fades toward (paper.ts; "#rrggbb"). */
  private setPaper(hex: string) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    (this.shared.uPaperS.value as THREE.Vector3).set(r / 255, g / 255, b / 255);
    const lin = new THREE.Color(n).convertSRGBToLinear();
    (this.shared.uPaper.value as THREE.Vector3).set(lin.r, lin.g, lin.b);
  }

  /** The end-card sky, loaded after first light so it never delays it. */
  private loadSky() {
    const url = `${A}end-sky${this.quality === "full" ? "" : "-1k"}.jpg`;
    new THREE.TextureLoader().load(url, (tex) => {
      if (this.disposed) { tex.dispose(); return; }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = true;
      this.textures.push(tex);
      const img = tex.image as { width: number; height: number };
      this.mirrorMat.uniforms.uSky.value = tex;
      this.mirrorMat.uniforms.uSkyAspect.value = img.width / Math.max(1, img.height);
      // upload now, not on the first dive frame
      this.renderer.initTexture(tex);
      this.skyReady = true;
    });
  }

  // ─── construction ─────────────────────────────────────────

  private makeMaterial(vert: string, frag: string, glass: boolean, local: Record<string, THREE.IUniform>) {
    return new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { ...this.shared, ...local },
      side: THREE.DoubleSide,
      transparent: glass,
      depthWrite: !glass,
      depthTest: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
  }

  private meshFrom(data: PackedMesh | null, mat: THREE.Material): THREE.Mesh | null {
    if (!data) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(data.position, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(data.normal, 3));
    g.setAttribute("aData", new THREE.BufferAttribute(data.data, 4));
    g.setAttribute("aSway", new THREE.BufferAttribute(data.sway, 1));
    g.setAttribute("aW", new THREE.BufferAttribute(data.wax, 3));
    g.setAttribute("aH", new THREE.BufferAttribute(data.hax, 3));
    g.setAttribute("aProf", new THREE.BufferAttribute(data.prof, 4));
    g.setAttribute("aAxis", new THREE.BufferAttribute(data.axis, 3));
    g.setIndex(new THREE.BufferAttribute(data.index, 1));
    g.computeBoundingSphere();
    if (g.boundingSphere) g.boundingSphere.radius *= 1.1;
    return new THREE.Mesh(g, mat);
  }

  private shardMesh(base: PackedMesh, shards: ShardSpec[], mat: THREE.Material): THREE.Mesh | null {
    if (!shards.length) return null;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(base.position, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(base.normal, 3));
    g.setAttribute("aData", new THREE.BufferAttribute(base.data, 4));
    g.setIndex(new THREE.BufferAttribute(base.index, 1));
    const n = shards.length;
    const pos = new Float32Array(n * 3), quat = new Float32Array(n * 4), scl = new Float32Array(n * 3), meta = new Float32Array(n * 4);
    const q = new THREE.Quaternion(), x = new THREE.Vector3(1, 0, 0), d = new THREE.Vector3();
    const sphere = new THREE.Sphere();
    const pts: THREE.Vector3[] = [];
    let maxLen = 0;
    shards.forEach((s, i) => {
      pos.set(s.pos, i * 3);
      d.set(s.dir[0], s.dir[1], s.dir[2]).normalize();
      q.setFromUnitVectors(x, d);
      quat.set([q.x, q.y, q.z, q.w], i * 4);
      scl.set([s.len, s.wid * s.thick, s.wid], i * 3);
      meta.set([s.kind, (i * 0.618034) % 1, s.spin, s.drift], i * 4);
      pts.push(new THREE.Vector3(...s.pos));
      maxLen = Math.max(maxLen, s.len);
    });
    g.setAttribute("iPos", new THREE.InstancedBufferAttribute(pos, 3));
    g.setAttribute("iQuat", new THREE.InstancedBufferAttribute(quat, 4));
    g.setAttribute("iScale", new THREE.InstancedBufferAttribute(scl, 3));
    g.setAttribute("iMeta", new THREE.InstancedBufferAttribute(meta, 4));
    g.instanceCount = n;
    sphere.setFromPoints(pts);
    sphere.radius += maxLen + 0.2;
    g.boundingSphere = sphere;
    return new THREE.Mesh(g, mat);
  }

  /** The groups' scene graph and materials, before their geometry arrives. */
  private makeGroups() {
    for (const def of this.groupDefs) {
      const root = new THREE.Group();
      const core = new THREE.Group();
      root.add(core);
      const local = {
        uPresence: { value: 1 },
        uHaze: { value: def.haze ?? 0 },
        uSwayAmp: { value: def.sway ?? 1 },
        uSwayVel: { value: 0 },
      };
      const mats = {
        o: this.makeMaterial(RIBBON_VERT, CHROME_FRAG, false, local),
        g: this.makeMaterial(RIBBON_VERT, CHROME_FRAG, true, local),
        p: this.makeMaterial(RIBBON_VERT, PORCELAIN_FRAG, false, local),
        so: this.makeMaterial(SHARD_VERT, CHROME_FRAG, false, local),
        sg: this.makeMaterial(SHARD_VERT, CHROME_FRAG, true, local),
      };
      this.porcelainMats.push(mats.p);
      this.scene.add(root);
      const axis = new THREE.Vector3(...(def.axis ?? [0, 1, 0])).normalize();
      this.groups.push({ def, root, core, axis, uniforms: [local], mats, home: 0, presence: 1, phase: this.groups.length * 1.7 });
    }
  }

  /** Each group's meshes, from the built vertex arrays. */
  private attach(built: Built) {
    built.groups.forEach((set, i) => {
      const { root, core, mats, uniforms } = this.groups[i];
      const add = (parent: THREE.Object3D, m: THREE.Mesh | null, order: number) => {
        if (!m) return;
        m.renderOrder = order;
        parent.add(m);
      };
      add(core, this.meshFrom(set.core[0], mats.o), 0);
      add(core, this.meshFrom(set.core[1], mats.p), 0);
      add(core, this.meshFrom(set.core[2], mats.g), 10);
      add(root, this.meshFrom(set.arms[0], mats.o), 0);
      add(root, this.meshFrom(set.arms[1], mats.p), 0);
      add(root, this.meshFrom(set.arms[2], mats.g), 10);
      const blades = set.shards.filter((s) => !s.pill);
      const pills = set.shards.filter((s) => s.pill);
      add(root, this.shardMesh(built.blade, blades.filter((s) => s.kind !== 2), mats.so), 1);
      add(root, this.shardMesh(built.blade, blades.filter((s) => s.kind === 2), mats.sg), 11);
      add(root, this.shardMesh(built.pill, pills.map((p) => ({ ...p, kind: 0 as const })), mats.so), 1);

      if (set.graphite) {
        const gr = set.graphite;
        const gmat = new THREE.ShaderMaterial({
          vertexShader: GRAPHITE_VERT, fragmentShader: GRAPHITE_FRAG,
          uniforms: {
            uTex: { value: null }, uAlpha: { value: gr.alpha }, uPresence: uniforms[0].uPresence, uBloom: this.shared.uBloom,
            uMasks: this.shared.uMasks, uMaskAmt: this.shared.uMaskAmt, uNameSoft: this.shared.uNameSoft,
          },
          transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
          blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
          blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
          blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
        });
        // first light waits for it, so the smudge is there from the first frame
        this.pending++;
        new THREE.TextureLoader().load(gr.src, (tex) => {
          if (this.disposed) { tex.dispose(); return; }
          tex.colorSpace = THREE.NoColorSpace;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.generateMipmaps = true;
          this.textures.push(tex);
          gmat.uniforms.uTex.value = tex;
          this.loaded();
        });
        const gm = new THREE.Mesh(new THREE.PlaneGeometry(gr.size[0], gr.size[1]), gmat);
        gm.position.set(...gr.pos);
        gm.renderOrder = 5;
        root.add(gm);
        this.graphite.push(gm);
      }
    });
  }

  /**
   * Upload every group's buffers and the env mips once, up front: otherwise
   * each section's geometry is uploaded the first time it scrolls into view
   * — a 100 ms hitch mid-scroll.
   */
  private warmup() {
    const rt = new THREE.WebGLRenderTarget(4, 4);
    const culled: THREE.Object3D[] = [];
    this.scene.traverse((o) => { if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; } });
    const vis = this.groups.map((g) => g.root.visible);
    this.groups.forEach((g) => { g.root.visible = true; });
    try {
      this.renderer.setRenderTarget(rt);
      this.renderer.render(this.scene, this.camera);
      this.renderer.compile(this.mirrorScene, this.camera);
    } finally {
      this.renderer.setRenderTarget(null);
      this.groups.forEach((g, i) => { g.root.visible = vis[i]; });
      culled.forEach((o) => { o.frustumCulled = true; });
      rt.dispose();
    }
  }

  // ─── layout ───────────────────────────────────────────────

  setLayout(layout: PageLayout) {
    this.layout = layout;
    const k = this.page?.parallax;
    this.camScroll = k != null ? (s) => s * k : makeCamScroll(layout);
    this.place();
  }

  private place() {
    if (!this.layout) return;
    const aspect = this.w / this.h;
    const narrow = aspect < 0.9;
    for (const g of this.groups) {
      const d = g.def;
      g.home = homeScroll(this.layout, d.section, d.t);
      const anchor = narrow && d.narrow ? d.narrow.anchor : d.anchor;
      const scale = narrow && d.narrow ? d.narrow.scale : (d.scale ?? 1) * (aspect < 1.25 ? 0.82 : 1);
      const visH = VIS_H * d.depth;
      const visW = visH * aspect;
      const camY = -RATE * this.camScroll(g.home);
      g.root.position.set((anchor[0] - 0.5) * visW, camY + (0.5 - anchor[1]) * visH, -d.depth);
      g.root.scale.setScalar(scale);
      if (d.id === "contact") this.diveTarget.copy(g.root.position);
    }
  }

  resize(w: number, h: number, dpr: number) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.dpr = dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
    this.shared.uDpr.value = dpr;
    if (this.bloomOn) this.setupBloom();
    this.place();
  }

  private setupBloom() {
    const bw = Math.max(64, Math.round((this.w * this.dpr) / 4));
    const bh = Math.max(64, Math.round((this.h * this.dpr) / 4));
    const opts = { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.rtBloom?.dispose(); this.rtA?.dispose(); this.rtB?.dispose(); this.rtC?.dispose(); this.rtD?.dispose();
    this.rtBloom = new THREE.WebGLRenderTarget(bw, bh, { ...opts, depthBuffer: true });
    this.rtA = new THREE.WebGLRenderTarget(bw, bh, opts);
    this.rtB = new THREE.WebGLRenderTarget(bw, bh, opts);
    this.rtC = new THREE.WebGLRenderTarget(Math.round(bw / 2), Math.round(bh / 2), opts);
    this.rtD = new THREE.WebGLRenderTarget(Math.round(bw / 2), Math.round(bh / 2), opts);
    if (!this.quad) {
      this.blurMat = new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT, fragmentShader: BLUR_FRAG,
        uniforms: { uSrc: { value: null }, uDir: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false,
      });
      this.compMat = new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT, fragmentShader: COMPOSITE_FRAG,
        uniforms: { uA: { value: null }, uB: { value: null }, uStrength: { value: 0.9 } },
        depthTest: false, depthWrite: false, transparent: true,
        blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
      this.quad = new THREE.Mesh(geo, this.blurMat);
      this.quad.frustumCulled = false;
      this.quadScene.add(this.quad);
    }
  }

  // ─── the mirror (Dive) ────────────────────────────────────

  /** Mirror state for dive progress dv; returns false while it is not in play. */
  private mirror(dv: number, t: number): { on: boolean; full: boolean } {
    const mir = this.mir;
    if (dv < 0.08 || !this.skyReady) { mir.on = false; mir.full = false; return mir; }
    const u = this.mirrorMat.uniforms;
    // the sheet pivots about its long axis from edge-on to facing the camera
    // timeline (dv): swing 0.10–0.50, the eye opens 0.18–0.54, the reflection
    // turns to sky 0.30–0.64, the sheet grows to fill the frame 0.46–0.80
    const turn = smooth01((dv - 0.1) / 0.4);
    const phi = 1.5 * (1 - turn);
    const N = u.uMN.value.copy(MIRROR_Z).multiplyScalar(Math.cos(phi)).addScaledVector(MIRROR_SIDE, Math.sin(phi)).normalize();
    u.uMV.value.crossVectors(N, MIRROR_AR).normalize();
    this.mirrorCentre(u.uMC.value);
    u.uMU.value.copy(MIRROR_AR);
    u.uMSize.value.set(0.5, 0.5);
    u.uWidth.value = 0.3 + 0.34 * smooth01((dv - 0.18) / 0.36);
    u.uBow.value = 0.14;
    u.uGrow.value = 1 + 9 * Math.pow(smooth01((dv - 0.46) / 0.34), 2.2);
    u.uRippleAmp.value = 0.05 * (1 - smooth01((dv - 0.52) / 0.3)) + 0.0026;
    u.uCurv.value = 0.26 * (1 - smooth01((dv - 0.5) / 0.3));
    u.uMirror.value = smooth01((dv - 0.3) / 0.34);
    u.uBreath.value = BREATH * smooth01((dv - 0.66) / 0.22);
    const full = dv > 0.84;
    u.uFull.value = full ? 1 : 0;
    u.uDrift.value.set(Math.sin(t * 0.021) * 0.006, Math.sin(t * 0.017 + 1.0) * 0.004);
    mir.on = true;
    mir.full = full;
    return mir;
  }

  private mirrorCentre(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.diveTarget).add(MIRROR_OFF);
  }

  // ─── frame ────────────────────────────────────────────────

  /** Returns true if anything is on screen (callers may skip work otherwise). */
  frame(st: FrameState): boolean {
    if (!this.ready || !this.layout) return false;
    const t = st.time;
    const s = st.scrollVH;
    const g = this.camScroll(s);
    const sh = this.shared;
    sh.uTime.value = t;
    {
      const k = this.dpr, H = this.h * k;
      const rects = sh.uMasks.value as THREE.Vector4[];
      const amt = sh.uMaskAmt.value as THREE.Vector4;
      amt.set(0, 0, 0, 0);
      for (let i = 0; i < 4; i++) {
        if (i < st.maskCount) {
          const m = st.masks[i];
          rects[i].set(m.x * k, H - (m.y + m.h) * k, (m.x + m.w) * k, H - m.y * k);
          amt.setComponent(i, m.amt);
        } else rects[i].set(-1e4, -1e4, -1e4 + 1, -1e4 + 1);
      }
      sh.uNameSoft.value = 56 * k;
    }
    sh.uEnvYaw.value = 0.18 + t * 0.011 + g * 0.045;

    // camera: travel + a small push into the hero mass + the dive
    const push = this.page ? 0 : -0.9 * smooth01(s / 1.1);
    const base = _base.set(0, -RATE * g, push);
    const dv = st.dive;
    if (dv > 0) {
      // 1) fly to the contact mass, looking up into it and rolling
      const e1 = Math.pow(smooth01(dv / 0.5), 1.25);
      base.lerp(_tgt.copy(this.diveTarget).add(DIVE_OFF1), e1);
      // 2) settle square-on in front of the mirror, rolling level again
      const e2 = smooth01((dv - 0.32) / 0.46);
      base.lerp(this.mirrorCentre(_tgt).add(DIVE_OFF2), e2);
      const lift = Math.sin(Math.min(1, dv / 0.5) * Math.PI) * 0.12 * (1 - e2);
      this.camera.rotation.set(lift, 0, e1 * 0.2 * (1 - e2));
    } else {
      this.camera.rotation.set(0, 0, 0);
    }
    this.camera.position.copy(base);
    this.camera.updateMatrixWorld();

    const mir = this.mirror(dv, t);

    const vel = Math.min(1.2, Math.abs(st.velocity) * 0.025);
    let any = false;
    for (const gr of this.groups) {
      const d = gr.def;
      const relS = s - gr.home;
      const [w0, w1] = d.window;
      let p = Math.min(smooth01((relS - w0) / 0.4), 1 - smooth01((relS - w1) / 0.45));
      if (d.id === "contact" && dv > 0) p = 1;
      // in the Dive every other piece fades out while the mirror is still a
      // sliver (0.04–0.28), so the camera flies through the mirror alone
      if (dv > 0) p *= 1 - smooth01((dv - 0.04) / 0.24);
      if (mir.full) p = 0;
      gr.presence = p;
      gr.root.visible = p > 0.002;
      if (!gr.root.visible) continue;
      any = true;
      const u = gr.uniforms[0];
      u.uPresence.value = p;
      u.uSwayVel.value = vel;
      if (d.spin) {
        _q.setFromAxisAngle(gr.axis, t * d.spin + gr.phase);
        gr.core.quaternion.copy(_q);
      }
      const br = d.breathe ?? 0;
      gr.root.rotation.set(br * 0.6 * Math.sin(t * 0.05 + gr.phase), br * Math.sin(t * 0.041 + gr.phase * 2.1), br * 0.5 * Math.sin(t * 0.063 + gr.phase));
    }

    const r = this.renderer;
    if (this.bloomOn && this.rtBloom && this.rtA && this.rtB && this.rtC && this.rtD && this.quad && this.blurMat && this.compMat && any) {
      // 1) highlights only, quarter res. Graphite and porcelain add nothing
      // to it (their bloom output is zero): graphite is skipped, porcelain
      // only lays down the depth that hides chrome behind it.
      sh.uBloom.value = 1;
      for (const m of this.graphite) m.visible = false;
      for (const m of this.porcelainMats) m.colorWrite = false;
      r.setRenderTarget(this.rtBloom);
      r.setClearColor(0x000000, 0);
      r.clear();
      r.render(this.scene, this.camera);
      for (const m of this.graphite) m.visible = true;
      for (const m of this.porcelainMats) m.colorWrite = true;
      sh.uBloom.value = 0;
      // 2) separable blur: a tight pass at quarter res, a wide one (x2) at eighth res
      this.quad.material = this.blurMat;
      const bu = this.blurMat.uniforms;
      const pass = (src: THREE.WebGLRenderTarget, dst: THREE.WebGLRenderTarget, dx: number, dy: number) => {
        bu.uSrc.value = src.texture;
        bu.uDir.value.set(dx / src.width, dy / src.height);
        r.setRenderTarget(dst);
        r.render(this.quadScene, this.quadCam);
      };
      pass(this.rtBloom, this.rtA, 1.5, 0);
      pass(this.rtA, this.rtB, 0, 1.5);
      pass(this.rtB, this.rtC, 1.5, 0);
      pass(this.rtC, this.rtD, 0, 1.5);
      pass(this.rtD, this.rtC, 2.5, 0);
      pass(this.rtC, this.rtD, 0, 2.5);
      pass(this.rtD, this.rtC, 3.5, 0);
      pass(this.rtC, this.rtD, 0, 3.5);
      // 3) main
      this.drawMain(mir.on, true);
      // 4) composite glow
      this.quad.material = this.compMat;
      this.compMat.uniforms.uA.value = this.rtB.texture;
      this.compMat.uniforms.uB.value = this.rtD.texture;
      r.autoClear = false;
      r.render(this.quadScene, this.quadCam);
      r.autoClear = true;
    } else {
      this.drawMain(mir.on, any);
    }
    return any || mir.on;
  }

  /** Clear, then the mirror (it writes depth), then the scene over it. */
  private drawMain(mirror: boolean, scene: boolean) {
    const r = this.renderer;
    r.setRenderTarget(null);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.autoClear = false;
    if (mirror) {
      const u = this.mirrorMat.uniforms;
      u.uRes.value.set(this.w * this.dpr, this.h * this.dpr);
      u.uInvProj.value.copy(this.camera.projectionMatrixInverse);
      u.uCamWorld.value.copy(this.camera.matrixWorld);
      u.uView.value.copy(this.camera.matrixWorldInverse);
      u.uViewProj.value.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
      u.uCamPos.value.copy(this.camera.position);
      r.render(this.mirrorScene, this.camera);
    }
    if (scene) r.render(this.scene, this.camera);
    r.autoClear = true;
  }

  /** Screen position (0..1) of the dive target — for the DOM layer's dolly origin. */
  diveScreen(out: [number, number]): [number, number] {
    const v = _v.copy(this.diveTarget).project(this.camera);
    out[0] = v.x * 0.5 + 0.5;
    out[1] = 0.5 - v.y * 0.5;
    return out;
  }

  dispose() {
    this.disposed = true;
    this.onReady = null;
    this.worker?.terminate();
    this.worker = null;
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | undefined;
      if (mat) mat.dispose();
    });
    this.mirrorScene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.mirrorMat.dispose();
    for (const t of this.textures) t.dispose();
    this.rtBloom?.dispose(); this.rtA?.dispose(); this.rtB?.dispose(); this.rtC?.dispose(); this.rtD?.dispose();
    this.blurMat?.dispose(); this.compMat?.dispose();
    this.renderer.dispose();
  }
}

function smooth01(x: number) {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}
