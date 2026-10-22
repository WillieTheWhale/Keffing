"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { useStore } from "@/lib/store";
import { useViewport } from "@/hooks/useViewport";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { activeSectionIdAt, deriveSectionBandsFromDOM } from "@/lib/sectionBands";
import { lenisRef, scrollVelocityRef } from "@/lib/scroll";

// SectionNav subscribes to activeSection, so the store is only written when
// the section in view changes (a handful of times per visit), not per frame.
function updateActiveSection(progress: number) {
  const activeSection = activeSectionIdAt(progress);
  if (useStore.getState().activeSection !== activeSection) useStore.setState({ activeSection });
}

export default function LenisProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize viewport detection and the reduced-motion flag
  useViewport();
  useReducedMotion();

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 2,
    });

    lenisRef.current = lenis;

    lenis.on("scroll", (e: { progress: number; velocity: number }) => {
      scrollVelocityRef.current = e.velocity;
      updateActiveSection(e.progress);
    });

    // the section in view before this mount's first measurement
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    updateActiveSection(Math.min(1, window.scrollY / maxScroll));

    let raf = 0;
    function frame(time: number) {
      lenis.raf(time);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    // Align the section bands with real section positions. Fonts/images can
    // shift layout after mount, so measure again shortly after load and on
    // resize.
    const remeasure = () => deriveSectionBandsFromDOM();
    remeasure();
    const t1 = setTimeout(remeasure, 600);
    const t2 = setTimeout(remeasure, 2500);
    window.addEventListener("resize", remeasure);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      lenisRef.current = null;
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", remeasure);
    };
  }, []);

  return <>{children}</>;
}
