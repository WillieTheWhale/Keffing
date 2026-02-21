"use client";

import { useRef, useMemo } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "@/lib/store";

import skyFragmentVertexShader from "./shaders/skyFragmentVertex.glsl";
import skyFragmentFragShader from "./shaders/skyFragmentFrag.glsl";

interface SkyFragmentProps {
  textureUrl: string;
  position: [number, number, number];
  scale: [number, number, number];
  maskType: number; // 0=rect, 1=parallelogram, 2=rounded
  opacity: number;
  parallaxFactor: number;
  skewAngle?: number;
  cornerRadius?: number;
}

function SkyFragment({
  textureUrl,
  position,
  scale,
  maskType,
  opacity,
  parallaxFactor,
  skewAngle = 0.3,
  cornerRadius = 0.1,
}: SkyFragmentProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const texture = useLoader(THREE.TextureLoader, textureUrl);
  const scrollProgress = useStore((s) => s.scrollProgress);
  const mousePosition = useStore((s) => s.mousePosition);
  const reducedMotion = useStore((s) => s.reducedMotion);

  const uniforms = useMemo(
    () => ({
      uTexture: { value: texture },
      uTime: { value: 0 },
      uScrollProgress: { value: 0 },
      uParallaxFactor: { value: parallaxFactor },
      uOpacity: { value: opacity },
      uMaskType: { value: maskType },
      uSkewAngle: { value: skewAngle },
      uCornerRadius: { value: cornerRadius },
      uMaskSize: { value: new THREE.Vector2(0.85, 0.85) },
    }),
    [texture, parallaxFactor, opacity, maskType, skewAngle, cornerRadius]
  );

  useFrame((state) => {
    if (!materialRef.current || !meshRef.current) return;

    const time = reducedMotion ? 0 : state.clock.elapsedTime;
    materialRef.current.uniforms.uTime.value = time;
    materialRef.current.uniforms.uScrollProgress.value = scrollProgress;

    // Counter-parallax: sky fragments shift opposite to cursor (§11.1)
    const mouseOffsetX = (mousePosition[0] - 0.5) * -0.04;
    const mouseOffsetY = (mousePosition[1] - 0.5) * -0.04;
    meshRef.current.position.x = position[0] + mouseOffsetX;
    meshRef.current.position.y = position[1] + mouseOffsetY;
  });

  return (
    <mesh ref={meshRef} position={position} scale={scale}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={skyFragmentVertexShader}
        fragmentShader={skyFragmentFragShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export default function SkyFragments() {
  const skyFragmentState = useStore((s) => s.skyFragments);

  // Map sky textures to fragments
  const skyTextures = [
    "/assets/sky/sky-1.jpg",
    "/assets/sky/sky-2.jpg",
    "/assets/sky/sky-3.jpg",
    "/assets/sky/sky-4.jpg",
    "/assets/sky/sky-5.jpg",
    "/assets/sky/sky-6.jpg",
  ];

  const maskTypeMap = {
    rectangle: 0,
    parallelogram: 1,
    rounded: 2,
  };

  // Default fragments if store is empty
  const fragments =
    skyFragmentState.length > 0
      ? skyFragmentState
      : [
          { position: [0.15, 0.3] as [number, number], maskType: "rectangle" as const, opacity: 0.7, scale: 0.8 },
          { position: [0.85, 0.7] as [number, number], maskType: "parallelogram" as const, opacity: 0.5, scale: 0.6 },
        ];

  return (
    <group>
      {fragments.map((frag, i) => (
        <SkyFragment
          key={i}
          textureUrl={skyTextures[i % skyTextures.length]}
          position={[
            (frag.position[0] - 0.5) * 6,
            (frag.position[1] - 0.5) * -4,
            -15 + i * 2,
          ]}
          scale={[frag.scale * 2, frag.scale * 1.4, 1]}
          maskType={maskTypeMap[frag.maskType]}
          opacity={frag.opacity}
          parallaxFactor={0.2 + i * 0.08}
          skewAngle={frag.maskType === "parallelogram" ? 0.3 : 0}
          cornerRadius={frag.maskType === "rounded" ? 0.15 : 0}
        />
      ))}
    </group>
  );
}
