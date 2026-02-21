// Generative Algorithm Design
// System Design §5 - Mixed Generative/Deterministic Strategy

import { PHI, PHI_INV } from "./tokens";

// Mulberry32 PRNG - seeded pseudo-random number generator
// Same seed = same output (daily seed for consistency)
export function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Get daily seed (changes daily, consistent within a day)
export function getDailySeed(): number {
  const now = new Date();
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

// Generate line control points using Fibonacci spiral + noise
export interface LineConfig {
  origin: [number, number, number];
  controlPoints: [number, number, number][];
  thickness: number;
  isCyan: boolean;
  animationPhase: number;
  length: number;
}

export function generateLineConfigs(
  focalPoint: [number, number],
  count: number,
  spread: number, // degrees
  complexity: number,
  seed: number
): LineConfig[] {
  const rng = mulberry32(seed);
  const lines: LineConfig[] = [];

  for (let i = 0; i < count; i++) {
    // Fibonacci spiral offset for direction
    const goldenAngle = (2 * Math.PI) / (PHI * PHI);
    const baseAngle = i * goldenAngle;
    const spreadRad = (spread * Math.PI) / 180;
    const angle = baseAngle % spreadRad - spreadRad / 2;

    // Log-normal length distribution (most short, few long)
    const lengthBase = Math.exp(rng() * 2.5 - 0.5);
    const length = Math.min(lengthBase * 0.3, 2.0);

    // Number of control points (3-7)
    const numPoints = Math.floor(rng() * (complexity - 2)) + 3;

    // Generate control points along curve
    const controlPoints: [number, number, number][] = [];
    for (let j = 0; j < numPoints; j++) {
      const t = j / (numPoints - 1);
      const r = length * t;

      // Perpendicular noise displacement
      const noiseAmount = 0.15 * Math.sin(t * Math.PI);
      const nx = (rng() - 0.5) * noiseAmount;
      const ny = (rng() - 0.5) * noiseAmount;

      controlPoints.push([
        focalPoint[0] + Math.cos(angle) * r + nx,
        focalPoint[1] + Math.sin(angle) * r + ny,
        (rng() - 0.5) * 0.5, // z variation
      ]);
    }

    lines.push({
      origin: [focalPoint[0], focalPoint[1], 0],
      controlPoints,
      thickness: 0.5 + rng() * 1.5, // 0.5-2px
      isCyan: rng() < 0.12, // ~12% cyan lines
      animationPhase: rng() * Math.PI * 2,
      length,
    });
  }

  return lines;
}

// Phi-derived positioning for elements
export function phiPosition(
  viewportWidth: number,
  viewportHeight: number,
  index: number,
  rng: () => number
): [number, number] {
  const xOffsets = [PHI_INV, 1 - PHI_INV, 0.5, PHI_INV * PHI_INV];
  const yOffsets = [PHI_INV, 0.5, 1 - PHI_INV, PHI_INV * 0.5];

  const xi = index % xOffsets.length;
  const yi = index % yOffsets.length;

  return [
    viewportWidth * (xOffsets[xi] + (rng() - 0.5) * 0.1),
    viewportHeight * (yOffsets[yi] + (rng() - 0.5) * 0.1),
  ];
}
