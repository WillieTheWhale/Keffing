"use client";

import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Noise,
} from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import * as THREE from "three";
import { useStore } from "@/lib/store";

function FullPostProcessing({ chromaticOffset }: { chromaticOffset: number }) {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={0.3}
        luminanceThreshold={0.6}
        luminanceSmoothing={0.9}
        kernelSize={KernelSize.MEDIUM}
        mipmapBlur
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={new THREE.Vector2(chromaticOffset, chromaticOffset)}
        radialModulation={false}
        modulationOffset={0}
      />
      <Noise premultiply blendFunction={BlendFunction.ADD} opacity={0.03} />
    </EffectComposer>
  );
}

function BloomAndNoise() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={0.3}
        luminanceThreshold={0.6}
        luminanceSmoothing={0.9}
        kernelSize={KernelSize.MEDIUM}
        mipmapBlur
      />
      <Noise premultiply blendFunction={BlendFunction.ADD} opacity={0.03} />
    </EffectComposer>
  );
}

function NoiseOnly() {
  return (
    <EffectComposer multisampling={0}>
      <Noise premultiply blendFunction={BlendFunction.ADD} opacity={0.03} />
    </EffectComposer>
  );
}

export default function PostProcessing() {
  const transitionPhase = useStore((s) => s.transitionPhase);
  const deviceTier = useStore((s) => s.deviceTier);
  const reducedMotion = useStore((s) => s.reducedMotion);

  if (reducedMotion) return null;

  const chromaticOffset = transitionPhase > 0 ? 0.002 * transitionPhase : 0.0005;

  if (deviceTier === "desktop" || deviceTier === "wide") {
    return <FullPostProcessing chromaticOffset={chromaticOffset} />;
  }

  if (deviceTier === "tablet") {
    return <BloomAndNoise />;
  }

  return <NoiseOnly />;
}
