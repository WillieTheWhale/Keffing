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
import { buildPlate, buildRibbon, companion, newMesh, setTessellation, tines, type MeshData, type RibbonSpec, type Spine } from "./geometry";
import { GROUPS, type GroupDef, type SectionId, type ShardSpec } from "./pieces";
import { BREATH } from "./bus";
import {
  BLUR_FRAG, CHROME_FRAG, COMPOSITE_FRAG, GRAPHITE_FRAG, GRAPHITE_VERT, MIRROR_FRAG, PORCELAIN_FRAG, QUAD_VERT, RIBBON_VERT, SHARD_VERT,
} from "./shaders";

export const FOV = 32;
const VIS_H = 2 * Math.tan(((FOV / 2) * Math.PI) / 180); // visible height per unit depth
/** World units the camera travels per viewport-height of (camera) scroll. */
const RATE = 0.6 * VIS_H * 10; // a depth-10 group moves at 0.6× content speed

const A = "/assets/background/";

export interface PageLayout {
  /** [top, height] in viewport heights, per section id. */
  sections: Partial<Record<SectionId, [number, number]>>;
  maxScrollVH: number;
}

export interface FrameState {
  scrollVH: number;
  time: number;
  dive: number;
  velocity: number;
  /** Text blocks (client rects, css px) that chrome must whiten behind, with strengths. */
  masks: { rect: DOMRect; amt: number }[];
}

export type Quality = "full" | "lite";

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
  home: number;
  presence: number;
  phase: number;
}

const _q = new THREE.Quaternion();


export class AlloyEngine {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private groups: GroupRT[] = [];
  private shared: Record<string, THREE.IUniform>;
  private textures: THREE.Texture[] = [];
  private layout: PageLayout | null = null;
  private camScroll: (s: number) => number = (s) => s;
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
  private pending = 2; // env + white env
  /** The end-card sky texture is loaded (the canvas can carry the finale). */
  skyReady = false;
  ready = false;
  onReady: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement, quality: Quality) {
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

    const paper = new THREE.Color(0xf2f1ec).convertSRGBToLinear();
    this.shared = {
      uEnv: { value: null },
      uEnvW: { value: null },
      uEnvYaw: { value: 0 },
      uTime: { value: 0 },
      uPaper: { value: new THREE.Vector3(paper.r, paper.g, paper.b) },
      uPaperS: { value: new THREE.Vector3(0xf2 / 255, 0xf1 / 255, 0xec / 255) },
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

    if (quality === "full") setTessellation(34, 1);
    else setTessellation(20, 0.75);

    const loadEnv = (url: string, uniform: string) => {
      new THREE.TextureLoader().load(url, (tex) => {
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
        if (--this.pending === 0) {
          this.warmup();
          this.ready = true;
          this.onReady?.();
          this.loadSky();
        }
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

    // ~80–130 ms on desktop for the whole page (lite: about half) — one time
    this.buildGroups();
  }

  /** The end-card sky, loaded after first light so it never delays it. */
  private loadSky() {
    const url = `${A}end-sky${this.quality === "full" ? "" : "-1k"}.jpg`;
    new THREE.TextureLoader().load(url, (tex) => {
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

  private meshFrom(data: MeshData, mat: THREE.Material): THREE.Mesh | null {
    if (data.index.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(data.position, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(data.normal, 3));
    g.setAttribute("aData", new THREE.Float32BufferAttribute(data.data, 4));
    g.setAttribute("aSway", new THREE.Float32BufferAttribute(data.sway, 1));
    g.setAttribute("aW", new THREE.Float32BufferAttribute(data.wax, 3));
    g.setAttribute("aH", new THREE.Float32BufferAttribute(data.hax, 3));
    g.setAttribute("aProf", new THREE.Float32BufferAttribute(data.prof, 4));
    g.setAttribute("aAxis", new THREE.Float32BufferAttribute(data.axis, 3));
    g.setIndex(data.position.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(data.index, 1) : new THREE.Uint16BufferAttribute(data.index, 1));
    g.computeBoundingSphere();
    if (g.boundingSphere) g.boundingSphere.radius *= 1.1;
    return new THREE.Mesh(g, mat);
  }

  private shardMesh(base: MeshData, shards: ShardSpec[], mat: THREE.Material): THREE.Mesh | null {
    if (!shards.length) return null;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(base.position, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(base.normal, 3));
    g.setAttribute("aData", new THREE.Float32BufferAttribute(base.data, 4));
    g.setIndex(new THREE.Uint16BufferAttribute(base.index, 1));
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

  private buildGroups() {
    // base shard: a spindle blade along +X; pill: a capsule
    const bladeBase = newMesh();
    buildRibbon(bladeBase, {
      pts: [[-0.5, 0, 0], [-0.17, 0.035, 0], [0.17, 0.035, 0], [0.5, 0, 0]],
      width: 1, profile: "lens", kind: 0, thick: 1, a: 0.85, b: 1.05, twist: 0.9, segs: 22, ring: 7, up: [0, 0, 1], sway: 0,
    });
    const pillBase = newMesh();
    buildRibbon(pillBase, {
      pts: [[-0.5, 0, 0], [0.5, 0, 0]], width: 1, profile: "round", kind: 0, a: 0.5, b: 0.5, segs: 18, ring: 12, sway: 0,
    });

    for (const def of GROUPS) {
      const set = def.build();
      const root = new THREE.Group();
      const core = new THREE.Group();
      root.add(core);
      const local = {
        uPresence: { value: 1 },
        uHaze: { value: def.haze ?? 0 },
        uSwayAmp: { value: def.sway ?? 1 },
        uSwayVel: { value: 0 },
      };
      const matO = this.makeMaterial(RIBBON_VERT, CHROME_FRAG, false, local);
      const matG = this.makeMaterial(RIBBON_VERT, CHROME_FRAG, true, local);
      const matP = this.makeMaterial(RIBBON_VERT, PORCELAIN_FRAG, false, local);
      const matSO = this.makeMaterial(SHARD_VERT, CHROME_FRAG, false, local);
      const matSG = this.makeMaterial(SHARD_VERT, CHROME_FRAG, true, local);

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
      const add = (parent: THREE.Object3D, m: THREE.Mesh | null, order: number) => {
        if (!m) return;
        m.renderOrder = order;
        parent.add(m);
      };
      add(core, this.meshFrom(c.o, matO), 0);
      add(core, this.meshFrom(c.p, matP), 0);
      add(core, this.meshFrom(c.g, matG), 10);
      add(root, this.meshFrom(a.o, matO), 0);
      add(root, this.meshFrom(a.p, matP), 0);
      add(root, this.meshFrom(a.g, matG), 10);
      const blades = set.shards.filter((s) => !s.pill);
      const pills = set.shards.filter((s) => s.pill);
      add(root, this.shardMesh(bladeBase, blades.filter((s) => s.kind !== 2), matSO), 1);
      add(root, this.shardMesh(bladeBase, blades.filter((s) => s.kind === 2), matSG), 11);
      add(root, this.shardMesh(pillBase, pills.map((p) => ({ ...p, kind: 0 as const })), matSO), 1);

      if (set.graphite) {
        const gr = set.graphite;
        const gmat = new THREE.ShaderMaterial({
          vertexShader: GRAPHITE_VERT, fragmentShader: GRAPHITE_FRAG,
          uniforms: {
            uTex: { value: null }, uAlpha: { value: gr.alpha }, uPresence: local.uPresence, uBloom: this.shared.uBloom,
            uMasks: this.shared.uMasks, uMaskAmt: this.shared.uMaskAmt, uNameSoft: this.shared.uNameSoft,
          },
          transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
          blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
          blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
          blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
        });
        new THREE.TextureLoader().load(gr.src, (tex) => {
          tex.colorSpace = THREE.NoColorSpace;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.generateMipmaps = true;
          this.textures.push(tex);
          gmat.uniforms.uTex.value = tex;
        });
        const gm = new THREE.Mesh(new THREE.PlaneGeometry(gr.size[0], gr.size[1]), gmat);
        gm.position.set(...gr.pos);
        gm.renderOrder = 5;
        root.add(gm);
      }

      this.scene.add(root);
      const axis = new THREE.Vector3(...(def.axis ?? [0, 1, 0])).normalize();
      this.groups.push({ def, root, core, axis, uniforms: [local], home: 0, presence: 1, phase: this.groups.length * 1.7 });
    }
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
    this.camScroll = makeCamScroll(layout);
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
      const scale = narrow && d.narrow ? d.narrow.scale : aspect < 1.25 ? 0.82 : 1;
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
    if (dv < 0.14 || !this.skyReady) return { on: false, full: false };
    const u = this.mirrorMat.uniforms;
    // the sheet pivots about its long axis from edge-on to facing the camera
    const ar = new THREE.Vector3(0.36, 0.93, 0).normalize();
    const z = new THREE.Vector3(0, 0, 1);
    const side = new THREE.Vector3().crossVectors(ar, z).normalize();
    const turn = smooth01((dv - 0.15) / 0.32);
    const phi = 1.5 * (1 - turn);
    const N = z.clone().multiplyScalar(Math.cos(phi)).addScaledVector(side, Math.sin(phi)).normalize();
    const V = new THREE.Vector3().crossVectors(N, ar).normalize();
    u.uMC.value.copy(this.mirrorCentre());
    u.uMU.value.copy(ar);
    u.uMV.value.copy(V);
    u.uMN.value.copy(N);
    u.uMSize.value.set(0.5, 0.5);
    u.uWidth.value = 0.3 + 0.34 * smooth01((dv - 0.17) / 0.33);
    u.uBow.value = 0.14;
    u.uGrow.value = 1 + 9 * Math.pow(smooth01((dv - 0.4) / 0.3), 2.2);
    u.uRippleAmp.value = 0.05 * (1 - smooth01((dv - 0.48) / 0.3)) + 0.0026;
    u.uCurv.value = 0.26 * (1 - smooth01((dv - 0.45) / 0.3));
    u.uMirror.value = smooth01((dv - 0.2) / 0.32);
    u.uBreath.value = BREATH * smooth01((dv - 0.55) / 0.25);
    const full = dv > 0.74;
    u.uFull.value = full ? 1 : 0;
    u.uDrift.value.set(Math.sin(t * 0.021) * 0.006, Math.sin(t * 0.017 + 1.0) * 0.004);
    return { on: true, full };
  }

  private mirrorCentre(): THREE.Vector3 {
    return this.diveTarget.clone().add(new THREE.Vector3(0.1, 0.02, 0.35));
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
      const am = [0, 0, 0, 0];
      for (let i = 0; i < 4; i++) {
        const m = st.masks[i];
        if (m) {
          rects[i].set(m.rect.left * k, H - m.rect.bottom * k, m.rect.right * k, H - m.rect.top * k);
          am[i] = m.amt;
        } else rects[i].set(-1e4, -1e4, -1e4 + 1, -1e4 + 1);
      }
      amt.set(am[0], am[1], am[2], am[3]);
      sh.uNameSoft.value = 56 * k;
    }
    sh.uEnvYaw.value = 0.18 + t * 0.011 + g * 0.045;

    // camera: travel + a small push into the hero mass + the dive
    const push = -0.9 * smooth01(s / 1.1);
    const base = new THREE.Vector3(0, -RATE * g, push);
    const dv = st.dive;
    if (dv > 0) {
      // 1) fly to the contact mass, looking up into it and rolling
      const e1 = Math.pow(smooth01(dv / 0.42), 1.25);
      const tgt1 = this.diveTarget.clone().add(new THREE.Vector3(0.15, 0.1, 1.6));
      base.lerp(tgt1, e1);
      // 2) settle square-on in front of the mirror, rolling level again
      const e2 = smooth01((dv - 0.3) / 0.42);
      const tgt2 = this.mirrorCentre().add(new THREE.Vector3(0, 0, 0.55));
      base.lerp(tgt2, e2);
      const lift = Math.sin(Math.min(1, dv / 0.42) * Math.PI) * 0.12 * (1 - e2);
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
      // the world falls away behind the mirror once it has filled the frame
      if (dv > 0.5) p *= 1 - smooth01((dv - 0.52) / 0.18);
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
      // 1) highlights only, quarter res
      sh.uBloom.value = 1;
      r.setRenderTarget(this.rtBloom);
      r.setClearColor(0x000000, 0);
      r.clear();
      r.render(this.scene, this.camera);
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
      r.setRenderTarget(null);
      r.setClearColor(0x000000, 0);
      r.clear();
      r.render(this.scene, this.camera);
      // 4) composite glow
      this.quad.material = this.compMat;
      this.compMat.uniforms.uA.value = this.rtB.texture;
      this.compMat.uniforms.uB.value = this.rtD.texture;
      r.autoClear = false;
      r.render(this.quadScene, this.quadCam);
      r.autoClear = true;
    } else {
      r.setRenderTarget(null);
      r.setClearColor(0x000000, 0);
      r.clear();
      if (any) r.render(this.scene, this.camera);
    }
    if (mir.on) {
      const u = this.mirrorMat.uniforms;
      u.uRes.value.set(this.w * this.dpr, this.h * this.dpr);
      u.uInvProj.value.copy(this.camera.projectionMatrixInverse);
      u.uCamWorld.value.copy(this.camera.matrixWorld);
      u.uView.value.copy(this.camera.matrixWorldInverse);
      u.uViewProj.value.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
      u.uCamPos.value.copy(this.camera.position);
      r.autoClear = false;
      r.render(this.mirrorScene, this.camera);
      r.autoClear = true;
      any = true;
    }
    return any;
  }

  /** Screen position (0..1) of the dive target — for the DOM layer's dolly origin. */
  diveScreen(): [number, number] {
    const v = this.diveTarget.clone().project(this.camera);
    return [v.x * 0.5 + 0.5, 0.5 - v.y * 0.5];
  }

  dispose() {
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
