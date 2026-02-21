"use client";

import { useStore } from "@/lib/store";

// CSS-based ultra-subtle film grain overlay (§4.4)
// Prevents the white background from feeling sterile
export default function FilmGrain() {
  const reducedMotion = useStore((s) => s.reducedMotion);

  if (reducedMotion) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 7, mixBlendMode: "multiply" }}
      aria-hidden="true"
    >
      <svg width="100%" height="100%" style={{ opacity: 0.04 }}>
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </div>
  );
}
