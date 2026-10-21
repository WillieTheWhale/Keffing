// Design Token Specification
// Based on system design document §8

export const colors = {
  bgPrimary: "#FFFFFF",
  fgPrimary: "#1A1A1A",
  fgBlack: "#000000",
  accentCyan: "#0099FF",
  /** Punctuation only (~1% frequency): active states, the world portal. */
  signalRed: "#FF3300",
  uiGhost: "#CCCCCC",
  uiDark: "#333333",
} as const;

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 40,
  7: 64,
  8: 104, // ~64 × φ
  9: 168, // ~104 × φ
} as const;

export const breakpoints = {
  mobile: 0,
  tablet: 640,
  desktop: 1024,
  wide: 1440,
} as const;

export const easing = {
  outExpo: [0.16, 1, 0.3, 1] as const,
  inOutQuint: [0.83, 0, 0.17, 1] as const,
};

export const springs = {
  gentle: { stiffness: 100, damping: 15 },
  snappy: { stiffness: 300, damping: 25 },
};

export const durations = {
  fast: 0.15,
  transition: 0.3,
  driftMin: 8,
  driftMax: 12,
};

// Golden ratio
export const PHI = 1.6180339887;
export const PHI_INV = 0.6180339887;

// Section order, labels, and density targets now live in lib/sections.ts —
// the old fixed-fraction ranges here were only consumed by the retired
// lib/choreography.ts, and would have silently drifted the moment section
// order or proportions changed (which is exactly what happened).
