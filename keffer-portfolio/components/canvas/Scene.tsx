"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Preload } from "@react-three/drei";
import LineBurstSystem from "./LineBurstSystem";
import SkyFragments from "./SkyFragments";
import ParticleDust from "./ParticleDust";
import PostProcessing from "./PostProcessing";
import { useStore } from "@/lib/store";
import { getPerformanceParams } from "@/hooks/useViewport";

function SceneContent() {
  const deviceTier = useStore((s) => s.deviceTier);
  const params = getPerformanceParams(deviceTier);

  return (
    <>
      {/* Camera positioned to see the full scene */}
      {/* Sky fragments at z: -20 to -10 (§4.1) */}
      <Suspense fallback={null}>
        <SkyFragments />
      </Suspense>

      {/* Line burst system at z: -10 to 0 (§4.1) */}
      <LineBurstSystem />

      {/* Particle dust at z: -5 to 5 (§4.1) */}
      <ParticleDust count={params.particleCount[0]} />

      {/* Post-processing (§4.4) */}
      <PostProcessing />

      <Preload all />
    </>
  );
}

export default function Scene() {
  return (
    <div
      className="fixed inset-0 w-full h-full"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      <Canvas
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        }}
        camera={{
          position: [0, 0, 5],
          fov: 60,
          near: 0.1,
          far: 100,
        }}
        dpr={[1, 2]}
        style={{ background: "transparent" }}
      >
        <color attach="background" args={["#FFFFFF"]} />
        <ambientLight intensity={0.5} />
        <SceneContent />
      </Canvas>
    </div>
  );
}
