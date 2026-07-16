"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Route veil — SIGNAL/NOISE roadmap W9.
 * The tuning move applied to navigation: a black field wipes over the page,
 * the route changes underneath, and the destination page reveals itself.
 * Controlled imperatively via openVeil() so any link can use it.
 */

type VeilCallback = () => void;
let _open: ((cb: VeilCallback) => void) | null = null;

/** Cover the screen, then run cb (e.g. router.push). Falls back to cb() if no veil mounted. */
export function openVeil(cb: VeilCallback) {
  if (_open) _open(cb);
  else cb();
}

export default function Veil() {
  const [covering, setCovering] = useState(false);
  const cbRef = useRef<VeilCallback | null>(null);

  useEffect(() => {
    _open = (cb: VeilCallback) => {
      cbRef.current = cb;
      setCovering(true);
      // navigate once fully covered
      setTimeout(() => {
        cbRef.current?.();
        cbRef.current = null;
      }, 430);
    };
    return () => {
      _open = null;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 70,
        backgroundColor: "#020204",
        clipPath: covering ? "inset(0 0 0 0)" : "inset(0 0 100% 0)",
        transition: "clip-path 420ms var(--ease-tune)",
      }}
      aria-hidden="true"
    />
  );
}
