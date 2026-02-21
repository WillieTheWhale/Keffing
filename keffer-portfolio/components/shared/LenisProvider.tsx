"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";
import { useScrollProgress, useMouseTracking } from "@/hooks/useScrollProgress";
import { useViewport } from "@/hooks/useViewport";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export default function LenisProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const lenisRef = useRef<Lenis | null>(null);
  const { updateSceneFromScroll } = useScrollProgress();

  // Initialize viewport detection and mouse tracking
  useViewport();
  useMouseTracking();
  useReducedMotion();

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 2,
    });

    lenisRef.current = lenis;

    // Connect scroll to scene state
    lenis.on("scroll", (e: { progress: number }) => {
      updateSceneFromScroll(e.progress);
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, [updateSceneFromScroll]);

  return <>{children}</>;
}
