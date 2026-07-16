"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import SkyFragmentsCSS from "@/components/overlay/glitch/SkyFragmentsCSS";

const SkyFragmentsGL = dynamic(() => import("./SkyFragmentsGL"), {
  ssr: false,
  loading: () => null,
});

/**
 * Performance gate for the fragment layer — SIGNAL/NOISE roadmap W7.
 * Desktop + WebGL2 + full motion → shader fragments (ripple, RGB split).
 * Everything else → the proven CSS layer. The gate is decided once per mount;
 * failure of WebGL context creation falls back silently.
 */
export default function FragmentsLayer() {
  const deviceTier = useStore((s) => s.deviceTier);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const [glOk, setGlOk] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl2") ||
        canvas.getContext("webgl");
      setGlOk(!!gl);
    } catch {
      setGlOk(false);
    }
  }, []);

  const useGL =
    glOk === true &&
    !reducedMotion &&
    (deviceTier === "desktop" || deviceTier === "wide");

  // Until capability is known, render the CSS layer (no flash of nothing).
  if (useGL) return <SkyFragmentsGL />;
  return <SkyFragmentsCSS />;
}
