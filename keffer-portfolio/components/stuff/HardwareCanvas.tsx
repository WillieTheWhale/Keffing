"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { hardwareDevices } from "@/content/hardware";
import styles from "./HardwareGallery.module.css";
import { withBase } from "@/lib/basePath";

type Props = {
  hostRef: RefObject<HTMLDivElement | null>;
  active: string | null;
  reducedMotion: boolean;
  onReady: (id: string) => void;
  onFailure: () => void;
};
type Exhibit = {
  id: string;
  element: HTMLElement;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  model: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: THREE.AnimationAction[];
  bounds: THREE.Vector3[];
  progress: number;
};

function disposeModel(model: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    material.dispose();
  }
  textures.forEach((texture) => texture.dispose());
}

/** A single scissored WebGL canvas serves every card, with demand rendering. */
export default function HardwareCanvas({ hostRef, active, reducedMotion, onReady, onFailure }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef({ active, reducedMotion, onReady, onFailure });
  const wake = useRef<() => void>(() => {});
  useEffect(() => {
    state.current = { active, reducedMotion, onReady, onFailure };
    wake.current();
  }, [active, reducedMotion, onReady, onFailure]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    let disposed = false;
    let lost = false;
    let frame = 0;
    let previous = 0;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power" });
    } catch {
      state.current.onFailure(); return;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.autoClear = false;
    const exhibits: Exhibit[] = [];
    const pending = new Set<string>();
    const loader = new GLTFLoader();
    const corner = new THREE.Vector3();
    const projected = new THREE.Vector3();

    const sample = (exhibit: Exhibit, progress: number) => {
      for (const action of exhibit.actions) {
        // Blender's first pose starts at frame 1 (1/24 s), not time zero.
        const start = 1 / 24;
        action.time = start + (action.getClip().duration - start) * progress;
      }
      exhibit.mixer.update(0);
      exhibit.model.updateMatrixWorld(true);
    };

    const fit = (exhibit: Exhibit, aspect: number) => {
      const camera = exhibit.camera;
      camera.updateMatrixWorld(true);
      let width = 0;
      let height = 0;
      for (const point of exhibit.bounds) {
        projected.copy(point).applyMatrix4(camera.matrixWorldInverse);
        width = Math.max(width, Math.abs(projected.x) * 2);
        height = Math.max(height, Math.abs(projected.y) * 2);
      }
      const halfHeight = Math.max(height, width / aspect) * 0.56;
      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
    };

    const render = (now: number) => {
      frame = 0;
      if (disposed || lost || document.hidden) { previous = 0; return; }
      const dt = previous ? Math.min((now - previous) / 1000, .05) : 1 / 60;
      previous = now;
      const area = host.getBoundingClientRect();
      renderer.setScissorTest(false);
      renderer.clear();
      renderer.setScissorTest(true);
      let moving = false;
      for (const exhibit of exhibits) {
        const rect = exhibit.element.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
        const target = state.current.active === exhibit.id ? 1 : 0;
        const gap = target - exhibit.progress;
        exhibit.progress = state.current.reducedMotion || Math.abs(gap) < .001
          ? target : exhibit.progress + gap * (1 - Math.exp(-dt * 8));
        moving ||= exhibit.progress !== target;
        sample(exhibit, exhibit.progress);
        exhibit.element.dataset.progress = exhibit.progress.toFixed(3);
        // Reserve the bottom strip for the accessible action label.
        const width = rect.width;
        const height = Math.max(1, rect.height - 26);
        const x = rect.left - area.left;
        const y = area.bottom - rect.bottom + 26;
        fit(exhibit, width / height);
        renderer.setViewport(x, y, width, height);
        renderer.setScissor(x, y, width, height);
        renderer.render(exhibit.scene, exhibit.camera);
      }
      if (moving) frame = requestAnimationFrame(render);
      else previous = 0;
    };
    const request = () => {
      if (!frame && !disposed && !lost && !document.hidden) frame = requestAnimationFrame(render);
    };
    wake.current = request;

    const load = async (element: HTMLElement) => {
      const id = element.dataset.hardwareId;
      const device = hardwareDevices.find((entry) => entry.id === id);
      if (!id || !device || pending.has(id)) return;
      pending.add(id);
      try {
        const asset = await loader.loadAsync(withBase(`/assets/hardware/${id}.glb`));
        if (disposed) { disposeModel(asset.scene); return; }
        if (!asset.animations.length) throw new Error(`Missing reveal animation: ${id}`);
        const scene = new THREE.Scene();
        const model = asset.scene;
        const holder = new THREE.Group();
        holder.add(model); scene.add(holder);
        // Nearest filtering retains the intentionally small painted textures.
        model.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            const standard = material as THREE.MeshStandardMaterial;
            if (standard.map) {
              standard.map.magFilter = THREE.NearestFilter;
              standard.map.minFilter = THREE.NearestMipmapNearestFilter;
              standard.map.needsUpdate = true;
            }
          }
        });
        scene.add(new THREE.HemisphereLight(0xffffff, 0x8893a4, 2.1));
        const light = new THREE.DirectionalLight(0xfffaf0, 2.25);
        light.position.set(-3, 6, 5); scene.add(light);
        const fill = new THREE.DirectionalLight(0xdce7ff, 1.1);
        fill.position.set(4, 2, -3); scene.add(fill);
        const mixer = new THREE.AnimationMixer(model);
        const actions = asset.animations.map((clip) => {
          const action = mixer.clipAction(clip);
          action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play(); action.paused = true;
          return action;
        });
        const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, .01, 100);
        const exhibit: Exhibit = { id, element, scene, camera, model, mixer, actions, bounds: [], progress: 0 };
        // Fit the entire movement envelope once. Opening never zooms or crops.
        const union = new THREE.Box3();
        for (const progress of [0, .25, .5, .75, 1]) {
          sample(exhibit, progress);
          union.union(new THREE.Box3().setFromObject(model));
        }
        const center = union.getCenter(new THREE.Vector3());
        const scale = 3 / Math.max(...union.getSize(new THREE.Vector3()).toArray());
        holder.scale.setScalar(scale);
        holder.position.copy(center).multiplyScalar(-scale);
        for (const x of [union.min.x, union.max.x]) for (const y of [union.min.y, union.max.y]) for (const z of [union.min.z, union.max.z]) {
          exhibit.bounds.push(corner.set(x, y, z).sub(center).multiplyScalar(scale).clone());
        }
        camera.position.fromArray(device.view).normalize().multiplyScalar(8);
        camera.lookAt(0, 0, 0);
        sample(exhibit, 0);
        exhibits.push(exhibit);
        state.current.onReady(id);
        request();
      } catch (error) {
        if (!disposed) console.warn("[Hardware] Still image retained:", id, error);
      }
    };

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) { void load(entry.target as HTMLElement); observer.unobserve(entry.target); }
      }
      request();
    }, { rootMargin: "300px" });
    host.querySelectorAll<HTMLElement>("[data-hardware-id]").forEach((element) => observer.observe(element));
    const resize = () => {
      renderer.setSize(host.clientWidth, host.clientHeight, false);
      request();
    };
    const resizer = new ResizeObserver(resize);
    resizer.observe(host);
    const visibility = () => { cancelAnimationFrame(frame); frame = 0; previous = 0; request(); };
    const contextLost = (event: Event) => {
      event.preventDefault(); lost = true; cancelAnimationFrame(frame); frame = 0; state.current.onFailure();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", resize);
    canvas.addEventListener("webglcontextlost", contextLost);
    resize();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      wake.current = () => {};
      observer.disconnect(); resizer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("webglcontextlost", contextLost);
      for (const exhibit of exhibits) {
        exhibit.mixer.stopAllAction(); exhibit.mixer.uncacheRoot(exhibit.model); disposeModel(exhibit.model);
      }
      // React Strict Mode immediately remounts on the same canvas. Forcing
      // context loss here would asynchronously break the replacement renderer.
      renderer.dispose();
    };
  }, [hostRef]);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}
