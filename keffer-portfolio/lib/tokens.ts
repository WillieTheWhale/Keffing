// Design Token Specification
// Based on system design document §8

export const colors = {
  bgPrimary: "#FFFFFF",
  fgPrimary: "#1A1A1A",
  fgBlack: "#000000",
  accentCyan: "#0099FF",
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

// Section scroll ranges
export const sections = {
  hero: { start: 0.0, end: 0.18 },
  about: { start: 0.18, end: 0.35 },
  projects: { start: 0.35, end: 0.70 },
  research: { start: 0.70, end: 0.88 },
  contact: { start: 0.88, end: 1.0 },
} as const;

export type SectionName = keyof typeof sections;
