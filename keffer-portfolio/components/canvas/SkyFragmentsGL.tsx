"use client";

import { useEffect, useRef, memo } from "react";
import * as THREE from "three";
import { useStore } from "@/lib/store";
import { generateFragments, SKY_PHOTOS } from "@/lib/fragments";
import { scrollVelocityRef } from "@/lib/scroll";

/**
 * WebGL sky-fragment layer — SIGNAL/NOISE roadmap W6.
 * The same daily-seeded composition as the CSS fallback, but each fragment is
 * a subdivided plane with a shader that gives it:
 *   - Lissajous drift + opacity breathing (per-fragment phase, never synced)
 *   - pointer ripple displacement (the fragment behaves like disturbed water)
 *   - scroll-velocity RGB split (fast scrolling literally detunes the image)
 *   - parallelogram edge cuts via UV discard (the collage language)
 * Orthographic camera in CSS-pixel space; parallax = mesh y offset.
 * Density choreography still applies via --density-fragments on the wrapper.
 */

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uHover;       // 0..1 ripple strength
  uniform vec2  uHoverPos;    // local UV of pointer
  uniform float uDriftAmpX;
  uniform float uDriftAmpY;
  uniform float uDriftFx;
  uniform float uDriftFy;
  uniform float uPhase;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 p = position;
    // ripple: radial wave from the pointer, strongest at the pointer
    if (uHover > 0.001) {
      float d = distance(uv, uHoverPos);
      float wave = sin(d * 28.0 - uTime * 7.0) * exp(-d * 4.5);
      p.z += wave * 18.0 * uHover;
      p.x += wave * 6.0 * uHover;
    }
    // ambient drift handled per-vertex for a soft breathing warp
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
  uniform float uSkew;        // parallelogram cut
  uniform float uVel;         // smoothed scroll velocity, signed
  varying vec2 vUv;

  void main() {
    // parallelogram discard: shift the valid x-range by skew across y
    float xShift = uSkew * (vUv.y - 0.5);
    float xm = vUv.x + xShift;
    if (xm < 0.0 || xm > 1.0) discard;

    // velocity detune: RGB split along y proportional to scroll speed
    float split = clamp(uVel * 0.0016, -0.012, 0.012);
    vec2 uv = vec2(xm, vUv.y);
    float r = texture2D(uMap, uv + vec2(0.0, split)).r;
    float g = texture2D(uMap, uv).g;
    float b = texture2D(uMap, uv - vec2(0.0, split)).b;

    float breathe = 1.0 + uBreatheAmp * sin(uTime * uBreatheF * 6.2831 + uPhase);
    gl_FragColor = vec4(r, g, b, uOpacity * breathe);
  }
`;

const SkyFragmentsGL = memo(function SkyFragmentsGL() {
  const containerRef = useRef<HTMLDivElement>(null);
  const deviceTier = useStore((s) => s.deviceTier);
  const seed = useStore((s) => s.seed);

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

    // CSS-pixel orthographic space: x → right, y → down (matches layout math)
    const camera = new THREE.OrthographicCamera(0, w, 0, h, -1000, 1000);
    const scene = new THREE.Scene();

    const fragments = generateFragments(seed, deviceTier);
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
        // scale.y = -1 (y-down ortho space) flips winding — don't cull.
        side: THREE.DoubleSide,
        uniforms: {
          uMap: { value: textures.get(f.srcIndex) },
          uOpacity: { value: f.opacity },
          uTime: { value: 0 },
          uHover: { value: 0 },
          uHoverPos: { value: new THREE.Vector2(0.5, 0.5) },
          uDriftAmpX: { value: 18 + rngPhase(i) * 40 },
          uDriftAmpY: { value: 8 + rngPhase(i + 7) * 22 },
          uDriftFx: { value: 0.015 + rngPhase(i + 13) * 0.04 },
          uDriftFy: { value: 0.012 + rngPhase(i + 29) * 0.035 },
          uPhase: { value: rngPhase(i + 3) * Math.PI * 2 },
          uBreatheAmp: { value: 0.1 + rngPhase(i + 17) * 0.15 },
          uBreatheF: { value: 0.01 + rngPhase(i + 23) * 0.02 },
          uSkew: { value: f.skew },
          uVel: { value: 0 },
        },
      });
      const mesh = new THREE.Mesh(geo, mat);
      // plane is centered; position at fragment center, y-down space via scale
      mesh.position.set(px + f.width / 2, py + f.height / 2, -i * 0.1);
      mesh.scale.y = -1; // flip because ortho top=0
      scene.add(mesh);
      meshes.push({
        mesh,
        mat,
        baseX: px + f.width / 2,
        baseY: py + f.height / 2,
        pf: f.parallaxFactor,
        hover: 0,
        w: f.width,
        h: f.height,
      });
    });

    // Pointer state (viewport px)
    const pointer = { x: -9999, y: -9999 };
    const onPointer = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    let smoothVel = 0;
    let raf = 0;
    const clock = new THREE.Clock();

    const tick = () => {
      const t = clock.getElapsedTime();
      const scrollY = window.scrollY;
      smoothVel += (scrollVelocityRef.current - smoothVel) * 0.12;

      for (const m of meshes) {
        // parallax: same formula as CSS layer (translateY(scrollY * -pf))
        const yNow = m.baseY - scrollY * m.pf;
        m.mesh.position.y = yNow;

        // hover: distance from pointer to fragment rect center (screen px)
        const dx = pointer.x - m.mesh.position.x;
        const dy = pointer.y - yNow;
        const dist = Math.hypot(dx, dy);
        const within = dist < Math.max(m.w, m.h) * 0.75;
        const target = within ? 1 : 0;
        m.hover += (target - m.hover) * (within ? 0.14 : 0.06);
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

    // Pause rendering when tab hidden
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
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", onResize);
      for (const m of meshes) {
        m.mesh.geometry.dispose();
        m.mat.dispose();
      }
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [deviceTier, seed]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{
        zIndex: 2,
        opacity: "var(--density-fragments, 1)",
        transform: "scale(calc(1 + var(--dive, 0) * 1.35))",
        transformOrigin: "70% 30%",
      }}
      aria-hidden="true"
    />
  );
});

export default SkyFragmentsGL;
