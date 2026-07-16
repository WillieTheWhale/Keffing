"use client";

import { useEffect, useState } from "react";

/**
 * Decorative seeded layers render nothing until mounted (W12 CLS fix):
 * SSR would paint them with the fixed hydration seed, and the post-mount
 * daily-seed swap would then MOVE every element — a 0.2 CLS hit. Mounting
 * them client-only means they first paint already at the daily seed, and
 * since they're absolutely/fixed positioned, appearing shifts nothing.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
