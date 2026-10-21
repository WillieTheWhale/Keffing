"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";
import { useScrollProgress, useMouseTracking } from "@/hooks/useScrollProgress";
import { useViewport } from "@/hooks/useViewport";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { deriveDensityKeypointsFromDOM } from "@/lib/density";
import { lenisRef as sharedLenisRef, scrollVelocityRef } from "@/lib/scroll";

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
    sharedLenisRef.current = lenis;

    // Connect scroll to scene state
    lenis.on("scroll", (e: { progress: number; velocity: number }) => {
      scrollVelocityRef.current = e.velocity;
      updateSceneFromScroll(e.progress);
    });
    // Kick the choreography once so the ambient layers take their initial
    // values before the first scroll event (matters when arriving back from
    // a detail page that had them pinned).
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    updateSceneFromScroll(Math.min(1, window.scrollY / maxScroll));

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    // Align the density choreography with real section positions (W3).
    // Fonts/images can shift layout after mount, so measure again shortly
    // after load and on resize.
    deriveDensityKeypointsFromDOM();
    const remeasure = () => deriveDensityKeypointsFromDOM();
    const t1 = setTimeout(remeasure, 600);
    const t2 = setTimeout(remeasure, 2500);
    window.addEventListener("resize", remeasure);

    return () => {
      lenis.destroy();
      sharedLenisRef.current = null;
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", remeasure);
    };
  }, [updateSceneFromScroll]);

  return <>{children}</>;
}
