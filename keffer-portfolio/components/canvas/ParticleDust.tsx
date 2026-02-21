"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "@/lib/store";
import { mulberry32, getDailySeed } from "@/lib/generative";

interface ParticleDustProps {
  count?: number;
}

export default function ParticleDust({ count = 400 }: ParticleDustProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const reducedMotion = useStore((s) => s.reducedMotion);

  const { positions, sizes, phases } = useMemo(() => {
    const rng = mulberry32(getDailySeed() + 999);
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const ph = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Distribute particles across the viewport volume
      pos[i * 3] = (rng() - 0.5) * 10;     // x: spread wide
      pos[i * 3 + 1] = (rng() - 0.5) * 8;  // y: spread tall
      pos[i * 3 + 2] = (rng() - 0.5) * 6;  // z: depth variation

      sz[i] = rng() * 2 + 0.5; // size 0.5-2.5
      ph[i] = rng() * Math.PI * 2; // random phase
    }

    return { positions: pos, sizes: sz, phases: ph };
  }, [count]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    return geo;
  }, [positions, sizes, phases]);

  // Custom shader for particles
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: `
          attribute float aSize;
          attribute float aPhase;
          uniform float uTime;
          varying float vAlpha;

          void main() {
            vec3 pos = position;

            // Diagonal drift: upper-left to lower-right (§11.3)
            float drift = mod(uTime * 0.05 + aPhase, 10.0) - 5.0;
            pos.x += drift * 0.3;
            pos.y -= drift * 0.2;

            // Gentle sine wave oscillation
            pos.x += sin(uTime * 0.2 + aPhase) * 0.05;
            pos.y += cos(uTime * 0.15 + aPhase * 1.3) * 0.05;

            // Wrap particles that drift off screen
            pos.x = mod(pos.x + 5.0, 10.0) - 5.0;
            pos.y = mod(pos.y + 4.0, 8.0) - 4.0;

            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = aSize * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;

            // Fade based on depth
            vAlpha = smoothstep(8.0, 2.0, -mvPosition.z) * 0.3;
          }
        `,
        fragmentShader: `
          varying float vAlpha;

          void main() {
            // Soft circular particle
            float dist = length(gl_PointCoord - vec2(0.5));
            float alpha = smoothstep(0.5, 0.2, dist) * vAlpha;

            // Mostly black particles, subtle
            gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
          }
        `,
        uniforms: {
          uTime: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
      }),
    []
  );

  useFrame((state) => {
    if (!material || reducedMotion) return;
    material.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />;
}
