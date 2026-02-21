"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";

export function useReducedMotion() {
  const setReducedMotion = useStore((s) => s.setReducedMotion);
  const reducedMotion = useStore((s) => s.reducedMotion);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [setReducedMotion]);

  return reducedMotion;
}
