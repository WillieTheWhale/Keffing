"use client";

import { useEffect, useRef, memo } from "react";
import * as THREE from "three";
import { useStore } from "@/lib/store";
import { generateFragments, SKY_PHOTOS } from "@/lib/fragments";
import { scrollVelocityRef, diveRef } from "@/lib/scroll";
import { bindLayerOpacity } from "@/lib/tuning";
import { windowVis } from "@/lib/window";

/**
 * WebGL sky-photograph layer. Each photo is a subdivided plane with a shader
 * that gives it a screen-print dot halftone, a slow Lissajous drift with
 * opacity breathing, pointer ripple displacement, scroll-velocity RGB split,
 * and an optional parallelogram cut via UV discard. Orthographic camera in
 * CSS-pixel space; parallax = mesh y offset. Captions (the reference's tiny
 * oblique codes under photographs) are DOM spans moved in the same loop.
 */

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uHover;
  uniform vec2  uHoverPos;
  uniform float uDriftAmpX;
  uniform float uDriftAmpY;
  uniform float uDriftFx;
  uniform float uDriftFy;
  uniform float uPhase;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 p = position;
    if (uHover > 0.001) {
      float d = distance(uv, uHoverPos);
      float wave = sin(d * 28.0 - uTime * 7.0) * exp(-d * 4.5);
      p.z += wave * 18.0 * uHover;
      p.x += wave * 6.0 * uHover;
    }
    p.x += sin(uTime * uDriftFx * 6.2831 + uPhase) * uDriftAmpX;
    p.y += sin(uTime * uDriftFy * 6.2831 + uPhase * 1.7) * uDriftAmpY;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uPhase;
  uniform float uBreatheAmp;
  uniform float uBreatheF;
  uniform float uSkew;
  uniform float uVel;
  uniform vec2 uSize;
  varying vec2 vUv;

  void main() {
    float xShift = uSkew * (vUv.y - 0.5);
    float xm = vUv.x + xShift;
    if (xm < 0.0 || xm > 1.0) discard;

    float split = clamp(uVel * 0.0016, -0.012, 0.012);
    vec2 uv = vec2(xm, vUv.y);
    float r = texture2D(uMap, uv + vec2(0.0, split)).r;
    float g = texture2D(uMap, uv).g;
    float b = texture2D(uMap, uv - vec2(0.0, split)).b;

    // Screen-print halftone: a fine dot grid in pixel space, lightening
    // between the dots so the photograph reads as printed, not pasted.
    vec2 cell = fract(uv * uSize / 3.2) - 0.5;
    float dot = 1.0 - smoothstep(0.24, 0.46, length(cell));
    float screen = mix(0.80, 1.0, dot);

    float breathe = 1.0 + uBreatheAmp * sin(uTime * uBreatheF * 6.2831 + uPhase);
    gl_FragColor = vec4(r, g, b, uOpacity * breathe * screen);
  }
`;

const SkyFragmentsGL = memo(function SkyFragmentsGL() {
  const containerRef = useRef<HTMLDivElement>(null);
  const deviceTier = useStore((s) => s.deviceTier);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const w = window.innerWidth;
    const h = window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);

    const camera = new THREE.OrthographicCamera(0, w, 0, h, -1000, 1000);
    const scene = new THREE.Scene();

    const fragments = generateFragments(deviceTier);
    const loader = new THREE.TextureLoader();
    const textures = new Map<number, THREE.Texture>();

    interface MeshState {
      mesh: THREE.Mesh;
      mat: THREE.ShaderMaterial;
      baseX: number;
      baseY: number;
      pf: number;
      hover: number;
      w: number;
      h: number;
      caption: HTMLSpanElement | null;
      atVH: number;
      opacity: number;
    }
    const meshes: MeshState[] = [];
    const rngPhase = (i: number) => ((i * 2654435761) % 1000) / 1000;

    fragments.forEach((f, i) => {
      const px = (f.x / 100) * w;
      const py = (f.y / 100) * h;
      if (!textures.has(f.srcIndex)) {
        const t = loader.load(SKY_PHOTOS[f.srcIndex]);
        t.colorSpace = THREE.SRGBColorSpace;
        textures.set(f.srcIndex, t);
      }
      const geo = new THREE.PlaneGeometry(f.width, f.height, 14, 10);
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          uMap: { value: textures.get(f.srcIndex) },
          uOpacity: { value: f.opacity },
          uTime: { value: 0 },
          uHover: { value: 0 },
          uHoverPos: { value: new THREE.Vector2(0.5, 0.5) },
          uDriftAmpX: { value: 14 + rngPhase(i) * 30 },
          uDriftAmpY: { value: 6 + rngPhase(i + 7) * 18 },
          uDriftFx: { value: 0.015 + rngPhase(i + 13) * 0.04 },
          uDriftFy: { value: 0.012 + rngPhase(i + 29) * 0.035 },
          uPhase: { value: rngPhase(i + 3) * Math.PI * 2 },
          uBreatheAmp: { value: 0.08 + rngPhase(i + 17) * 0.12 },
          uBreatheF: { value: 0.01 + rngPhase(i + 23) * 0.02 },
          uSkew: { value: f.skew },
          uVel: { value: 0 },
          uSize: { value: new THREE.Vector2(f.width, f.height) },
        },
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(px + f.width / 2, py + f.height / 2, -i * 0.1);
      mesh.scale.y = -1;
      scene.add(mesh);

      let caption: HTMLSpanElement | null = null;
      if (f.caption) {
        caption = document.createElement("span");
        caption.className = "sky-caption";
        caption.textContent = f.caption;
        caption.style.left = `${px}px`;
        container.appendChild(caption);
      }
      meshes.push({ mesh, mat, baseX: px + f.width / 2, baseY: py + f.height / 2, pf: f.parallaxFactor, hover: 0, w: f.width, h: f.height, caption, atVH: f.atVH, opacity: f.opacity });
    });

    const pointer = { x: -9999, y: -9999 };
    const onPointer = (e: PointerEvent) => { pointer.x = e.clientX; pointer.y = e.clientY; };
    window.addEventListener("pointermove", onPointer, { passive: true });

    let smoothVel = 0;
    let raf = 0;
    let lastDive = -1;
    const clock = new THREE.Clock();
    const unbind = bindLayerOpacity("fragments", container);

    const tick = () => {
      const t = clock.getElapsedTime();
      const scrollY = window.scrollY;
      smoothVel += (scrollVelocityRef.current - smoothVel) * 0.12;
      const dv = diveRef.current;
      if (dv !== lastDive) {
        lastDive = dv;
        container.style.transform = dv > 0 ? `scale(${(1 + dv * 1.35).toFixed(4)})` : "";
      }

      const scrollVH = scrollY / Math.max(1, window.innerHeight);
      for (const m of meshes) {
        const yNow = m.baseY - scrollY * m.pf;
        m.mesh.position.y = yNow;
        const vis = windowVis(scrollVH, m.atVH);
        m.mesh.visible = vis > 0.001;
        m.mat.uniforms.uOpacity.value = m.opacity * vis;
        if (m.caption) {
          m.caption.style.transform = `translateY(${(yNow + m.h / 2 + 4).toFixed(1)}px)`;
          m.caption.style.opacity = vis.toFixed(2);
        }

        const dx = pointer.x - m.mesh.position.x;
        const dy = pointer.y - yNow;
        const dist = Math.hypot(dx, dy);
        const within = dist < Math.max(m.w, m.h) * 0.75;
        m.hover += ((within ? 1 : 0) - m.hover) * (within ? 0.14 : 0.06);
        m.mat.uniforms.uHover.value = m.hover;
        if (within) {
          m.mat.uniforms.uHoverPos.value.set(
            Math.min(1, Math.max(0, dx / m.w + 0.5)),
            Math.min(1, Math.max(0, 0.5 - dy / m.h))
          );
        }
        m.mat.uniforms.uTime.value = t;
        m.mat.uniforms.uVel.value = smoothVel;
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(tick);
    };
    document.addEventListener("visibilitychange", onVis);

    const onResize = () => {
      const nw = window.innerWidth;
      const nh = window.innerHeight;
      renderer.setSize(nw, nh);
      camera.right = nw;
      camera.bottom = nh;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      unbind();
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", onResize);
      for (const m of meshes) {
        m.mesh.geometry.dispose();
        m.mat.dispose();
        m.caption?.remove();
      }
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [deviceTier]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 2, transformOrigin: "66% 31%" }}
      aria-hidden="true"
    />
  );
});

export default SkyFragmentsGL;
