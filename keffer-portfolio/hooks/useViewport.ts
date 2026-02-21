"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { breakpoints } from "@/lib/tokens";

export function useViewport() {
  const setViewportSize = useStore((s) => s.setViewportSize);
  const setDeviceTier = useStore((s) => s.setDeviceTier);
  const deviceTier = useStore((s) => s.deviceTier);
  const viewportSize = useStore((s) => s.viewportSize);

  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setViewportSize([w, h]);

      if (w < breakpoints.tablet) {
        setDeviceTier("mobile");
      } else if (w < breakpoints.desktop) {
        setDeviceTier("tablet");
      } else if (w < breakpoints.wide) {
        setDeviceTier("desktop");
      } else {
        setDeviceTier("wide");
      }
    }

    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, [setViewportSize, setDeviceTier]);

  return { deviceTier, viewportSize };
}

// Performance scaling based on device tier (§12.1)
export function getPerformanceParams(tier: string) {
  switch (tier) {
    case "mobile":
      return {
        lineCount: [30, 60],
        skyFragmentCount: [2, 3],
        particleCount: [50, 100],
        shaderComplexity: "simplified" as const,
        postProcessing: ["grain"] as const,
        textureResolution: 512,
        targetFPS: 30,
        atmosphericTextBlocks: [2, 3],
      };
    case "tablet":
      return {
        lineCount: [80, 120],
        skyFragmentCount: [3, 5],
        particleCount: [100, 200],
        shaderComplexity: "full" as const,
        postProcessing: ["bloom", "grain"] as const,
        textureResolution: 1024,
        targetFPS: 60,
        atmosphericTextBlocks: [4, 6],
      };
    case "wide":
      return {
        lineCount: [180, 250],
        skyFragmentCount: [5, 8],
        particleCount: [400, 600],
        shaderComplexity: "full" as const,
        postProcessing: ["bloom", "grain", "chromaticAberration"] as const,
        textureResolution: 2048,
        targetFPS: 60,
        atmosphericTextBlocks: [7, 9],
      };
    default: // desktop
      return {
        lineCount: [150, 200],
        skyFragmentCount: [4, 8],
        particleCount: [300, 500],
        shaderComplexity: "full" as const,
        postProcessing: ["bloom", "grain", "chromaticAberration"] as const,
        textureResolution: 2048,
        targetFPS: 60,
        atmosphericTextBlocks: [6, 8],
      };
  }
}
