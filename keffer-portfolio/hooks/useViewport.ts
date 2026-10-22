"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { breakpoints } from "@/lib/tokens";

/** Keeps the store's device tier in step with the window width. */
export function useViewport() {
  const setDeviceTier = useStore((s) => s.setDeviceTier);

  useEffect(() => {
    function update() {
      const w = window.innerWidth;
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
  }, [setDeviceTier]);
}
