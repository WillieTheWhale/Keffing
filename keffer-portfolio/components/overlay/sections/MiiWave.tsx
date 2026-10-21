"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useStore } from "@/lib/store";
import { MiiMotion, type MiiPose } from "@/lib/mii-motion";

export default function MiiWave() {
  const hostRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playRef = useRef<() => void>(() => {});
  const reducedMotion = useStore((s) => s.reducedMotion);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    let disposed = false;
    let visible = false;
    let greeted = false;
    let loading = false;
    let loaded = false;
    let raf = 0;
    let lastTime = 0;
    let time = 0;
    let nextBlink = 4.2;
    let renderer: THREE.WebGLRenderer | undefined;
    let motion: MiiMotion | undefined;
    let stillTimer: ReturnType<typeof setTimeout> | undefined;
    let body: THREE.Group | undefined;
    let head: THREE.Group | undefined;
    let headBone: THREE.Object3D | undefined;
    let face: THREE.Mesh | undefined;
    const faceMaterials: THREE.MeshStandardMaterial[] = [];
    const scene = new THREE.Scene();
    const character = new THREE.Group();
    scene.add(character);
    // Stable framing: the larger character stays beside the bio as it gestures.
    const camera = new THREE.PerspectiveCamera(24, 0.75, 0.1, 150);
    camera.position.set(0, 11.7, 57);
    camera.lookAt(0, 11.3, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc5c9db, 2.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.65);
    key.position.set(-12, 25, 30);
    scene.add(key);
    const headPosition = new THREE.Vector3();
    const headRotation = new THREE.Quaternion();
    const headScale = new THREE.Vector3();
    const headCorrection = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);

    const selectPose = (next: MiiPose) => { if (loaded) motion?.select(next); };

    const render = () => {
      if (!renderer || !motion || !body || !head || !headBone) return;
      const { pose, weights } = motion;
      body.updateMatrixWorld(true);
      headBone.matrixWorld.decompose(headPosition, headRotation, headScale);
      character.worldToLocal(headPosition);
      head.position.copy(headPosition);
      head.quaternion.copy(headRotation).multiply(headCorrection);
      head.scale.setScalar(0.12);
      if (time > nextBlink + 0.16) nextBlink = time + 3.8 + Math.random() * 2;
      // Expressions are texture variants on the same face surface.
      const expression = pose === "celebrate" && weights.celebrate > 0.55 ? 3
        : pose === "wave" && weights.wave > 0.55 ? 1
        : !reducedMotion && time >= nextBlink ? 2 : 0;
      if (face && faceMaterials[expression]) face.material = faceMaterials[expression];
      host.dataset.animation = pose;
      host.dataset.transition = motion.blending ? "blending-bones" : "playing";
      renderer.render(scene, camera);
    };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; lastTime = 0; };
    const tick = (now: number) => {
      raf = 0;
      if (disposed || !visible || document.hidden || !loaded) { lastTime = 0; return; }
      const delta = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
      if (!reducedMotion) motion?.update(delta);
      time += delta;
      lastTime = now;
      render();
      if (!reducedMotion) raf = requestAnimationFrame(tick);
    };
    const resume = () => {
      if (!raf && loaded && visible && !document.hidden) raf = requestAnimationFrame(tick);
    };
    const resize = () => {
      if (!renderer) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(host.clientWidth, host.clientHeight, false);
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      render();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.NoToneMapping;
        const loader = new GLTFLoader();
        const [bodyAsset, headAsset] = await Promise.all([
          loader.loadAsync("/assets/mii/body.glb"),
          loader.loadAsync("/assets/mii/william-head.glb"),
        ]);
        body = bodyAsset.scene;
        head = headAsset.scene;
        character.add(body, head);
        if (disposed) { disposeScene(); return; }
        // William's saved height (127) and build (49), using Mii body scaling.
        const width = (49 * (127 * 0.003671875 + 0.4)) / 128 + 127 * 0.001796875 + 0.4;
        body.scale.set(width, 127 * 0.006015625 + 0.5, width);
        const navy = new THREE.Color("#14213f");
        const white = new THREE.Color("#f5f3ef");
        const pants = new THREE.Color("#202128");
        const skin = new THREE.Color("#ffd3ad");
        body.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          const positions = object.geometry.getAttribute("position");
          const colors = new Float32Array(positions.count * 3);
          for (let i = 0; i < positions.count; i++) {
            const x = Math.abs(positions.getX(i));
            const y = positions.getY(i);
            let color = skin;
            if (object.name === "body_m") color = y > 12.35 || y < 6.8 || x > 5.35 ? white : navy;
            if (object.name === "legs_m") color = y < 0.95 ? white : pants;
            color.toArray(colors, i * 3);
          }
          object.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
          for (const old of Array.isArray(object.material) ? object.material : [object.material]) old.dispose();
          object.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
          object.frustumCulled = false;
        });
        const prepareMaterial = (material: THREE.MeshStandardMaterial) => {
          material.roughness = 1;
          material.metalness = 0;
          return material;
        };
        head.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          prepareMaterial(object.material as THREE.MeshStandardMaterial);
          if ((object.material as THREE.Material).name === "Material_XluMask_0") face = object;
        });
        for (const index of [4, 5, 6, 7]) {
          faceMaterials.push(prepareMaterial(await headAsset.parser.getDependency("material", index)));
        }
        if (disposed) { disposeScene(); return; }
        headBone = body.getObjectByName("Head");
        if (!headBone || !face) throw new Error("Mii skeleton or face is missing");
        motion = new MiiMotion(body, bodyAsset.animations);
        loaded = true;
        host.dataset.renderer = "skeletal-3d";
        host.dataset.animation = "idle";
        resize();
        setReady(true);
        if (visible && greeted && !reducedMotion) selectPose("wave");
        resume();
      } catch (error) {
        if (!disposed) console.warn("[MiiWave] Could not initialize the 3D character:", error);
        disposeScene();
      }
    };
    const preload = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { preload.disconnect(); void load(); }
    }, { rootMargin: "400px" });
    preload.observe(host);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        if (entry.intersectionRatio >= 0.35 && !greeted) {
          greeted = true;
          if (!reducedMotion) selectPose("wave");
        }
        resume();
      } else {
        stop();
        greeted = false;
        selectPose("idle");
      }
    }, { threshold: [0, 0.35] });
    observer.observe(host);
    playRef.current = () => {
      if (!loaded || !visible) return;
      if (reducedMotion) {
        // An expression-only reaction respects reduced motion.
        if (face) face.material = faceMaterials[3];
        renderer?.render(scene, camera);
        clearTimeout(stillTimer);
        stillTimer = setTimeout(render, 1200);
        return;
      }
      selectPose("celebrate");
      resume();
    };
    const onVisibility = () => { stop(); if (!document.hidden) resume(); };
    document.addEventListener("visibilitychange", onVisibility);
    function disposeScene() {
      motion?.dispose();
      const materials = new Set<THREE.Material>(faceMaterials);
      const textures = new Set<THREE.Texture>();
      character.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      });
      for (const material of materials) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        material.dispose();
      }
      for (const texture of textures) texture.dispose();
      renderer?.dispose();
    }
    return () => {
      disposed = true;
      clearTimeout(stillTimer);
      stop();
      preload.disconnect();
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      playRef.current = () => {};
      disposeScene();
    };
  }, [reducedMotion]);

  return (
    <button ref={hostRef} type="button" className="mii-wave" onClick={() => playRef.current()}
      aria-label="Play William's Mii celebration" aria-describedby="mii-caption"
      title="Click for a little celebration"
      style={{ width: "100%", aspectRatio: "3 / 4", backgroundImage: ready ? "none" : "url(/assets/mii/neutral.webp)" }}>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} aria-hidden="true" />
    </button>
  );
}
