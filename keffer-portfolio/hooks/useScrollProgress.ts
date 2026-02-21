"use client";

import { useEffect, useCallback, useRef } from "react";
import { useStore } from "@/lib/store";
import { getSceneState } from "@/lib/choreography";

export function useScrollProgress() {
  const updateSceneFromScroll = useCallback(
    (progress: number) => {
      const state = getSceneState(progress);
      // SINGLE batched Zustand set() call instead of 6 separate ones
      useStore.setState({
        scrollProgress: progress,
        activeSection: state.activeSection,
        focalPoint: state.focalPoint,
        transitionPhase: state.transitionPhase,
        lineParams: state.lineParams,
        skyFragments: state.skyFragments,
      });
    },
    []
  );

  return { updateSceneFromScroll };
}

export function useMouseTracking() {
  const rafRef = useRef<number>(0);
  const latestRef = useRef<[number, number]>([0.5, 0.5]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      latestRef.current = [
        e.clientX / window.innerWidth,
        e.clientY / window.innerHeight,
      ];
    };

    // Throttle store updates to ~30fps via RAF
    let lastUpdate = 0;
    const tick = (now: number) => {
      if (now - lastUpdate > 33) {
        lastUpdate = now;
        const current = useStore.getState().mousePosition;
        const next = latestRef.current;
        // Only update if actually moved (avoid unnecessary re-renders)
        if (Math.abs(current[0] - next[0]) > 0.002 || Math.abs(current[1] - next[1]) > 0.002) {
          useStore.setState({ mousePosition: next });
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);
}
