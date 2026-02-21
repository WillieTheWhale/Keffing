// Scroll Choreography System
// System Design §6 - Scroll-to-Scene Mapping

import { sections, SectionName, PHI_INV } from "./tokens";

export interface SceneKeyframe {
  focalPoint: [number, number];
  lineCount: number;
  spread: number;
  complexity: number;
  burstDirection: number;
  skyFragments: {
    position: [number, number];
    maskType: "rectangle" | "parallelogram" | "rounded";
    opacity: number;
    scale: number;
  }[];
  transitionType: "convergence" | "explosion" | "sweep" | "radial" | "settle";
}

// Deterministic keyframes at section boundaries (§5.3)
const keyframes: Record<SectionName, SceneKeyframe> = {
  hero: {
    focalPoint: [0.75, 0.25],
    lineCount: 180,
    spread: 120,
    complexity: 5,
    burstDirection: -45,
    skyFragments: [
      { position: [0.15, 0.3], maskType: "rectangle", opacity: 0.7, scale: 0.8 },
      { position: [0.85, 0.7], maskType: "parallelogram", opacity: 0.5, scale: 0.6 },
    ],
    transitionType: "explosion",
  },
  about: {
    focalPoint: [0.6, 0.5],
    lineCount: 120,
    spread: 220,
    complexity: 6,
    burstDirection: 30,
    skyFragments: [
      { position: [0.2, 0.4], maskType: "rounded", opacity: 0.8, scale: 1.2 },
      { position: [0.8, 0.2], maskType: "rectangle", opacity: 0.5, scale: 0.7 },
      { position: [0.1, 0.8], maskType: "parallelogram", opacity: 0.4, scale: 0.5 },
    ],
    transitionType: "convergence",
  },
  projects: {
    focalPoint: [0.4, 0.45],
    lineCount: 160,
    spread: 280,
    complexity: 5,
    burstDirection: 0,
    skyFragments: [
      { position: [0.85, 0.35], maskType: "rectangle", opacity: 0.6, scale: 1.0 },
      { position: [0.1, 0.6], maskType: "rounded", opacity: 0.7, scale: 0.9 },
      { position: [0.7, 0.8], maskType: "parallelogram", opacity: 0.5, scale: 0.7 },
      { position: [0.3, 0.15], maskType: "rectangle", opacity: 0.4, scale: 0.6 },
    ],
    transitionType: "sweep",
  },
  research: {
    focalPoint: [0.5, 0.5],
    lineCount: 140,
    spread: 340,
    complexity: 4,
    burstDirection: 90,
    skyFragments: [
      { position: [0.8, 0.3], maskType: "rectangle", opacity: 0.6, scale: 0.8 },
      { position: [0.2, 0.7], maskType: "rounded", opacity: 0.7, scale: 1.0 },
      { position: [0.6, 0.9], maskType: "parallelogram", opacity: 0.4, scale: 0.5 },
    ],
    transitionType: "radial",
  },
  contact: {
    focalPoint: [0.5, 0.6],
    lineCount: 80,
    spread: 360,
    complexity: 3,
    burstDirection: 180,
    skyFragments: [
      { position: [0.3, 0.4], maskType: "rounded", opacity: 0.8, scale: 1.1 },
      { position: [0.75, 0.6], maskType: "rectangle", opacity: 0.6, scale: 0.8 },
    ],
    transitionType: "settle",
  },
};

// Cubic bezier interpolation
function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpPoint(a: [number, number], b: [number, number], t: number): [number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

// Get the current section and local progress within it
export function getCurrentSection(progress: number): {
  section: SectionName;
  localProgress: number;
  isTransitioning: boolean;
  transitionProgress: number;
} {
  const sectionEntries = Object.entries(sections) as [SectionName, { start: number; end: number }][];
  const hysteresis = 0.02;

  for (const [name, range] of sectionEntries) {
    if (progress >= range.start && progress <= range.end) {
      const localProgress = (progress - range.start) / (range.end - range.start);
      const nearStart = localProgress < hysteresis / (range.end - range.start);
      const nearEnd = localProgress > 1 - hysteresis / (range.end - range.start);

      return {
        section: name,
        localProgress,
        isTransitioning: nearStart || nearEnd,
        transitionProgress: nearEnd
          ? (localProgress - (1 - hysteresis / (range.end - range.start))) /
            (hysteresis / (range.end - range.start))
          : nearStart
          ? 1 - localProgress / (hysteresis / (range.end - range.start))
          : 0,
      };
    }
  }

  return { section: "contact", localProgress: 1, isTransitioning: false, transitionProgress: 0 };
}

// Main function: map scroll progress to complete scene state (§6.4)
export function getSceneState(progress: number): {
  focalPoint: [number, number];
  lineParams: { count: number; spread: number; complexity: number };
  skyFragments: SceneKeyframe["skyFragments"];
  transitionPhase: number;
  activeSection: SectionName;
  burstDirection: number;
} {
  const { section, localProgress, isTransitioning, transitionProgress } =
    getCurrentSection(progress);

  const currentKeyframe = keyframes[section];
  const sectionNames = Object.keys(sections) as SectionName[];
  const currentIndex = sectionNames.indexOf(section);
  const nextSection = sectionNames[Math.min(currentIndex + 1, sectionNames.length - 1)];
  const nextKeyframe = keyframes[nextSection];

  // Smooth easing for interpolation
  const eased = cubicBezier(localProgress, 0, 0.1, 0.9, 1);

  // Interpolate focal point with phi-derived drift
  const driftX = Math.sin(localProgress * Math.PI * 2) * 0.03 * PHI_INV;
  const driftY = Math.cos(localProgress * Math.PI * 2) * 0.02 * PHI_INV;

  const baseFocal = lerpPoint(currentKeyframe.focalPoint, nextKeyframe.focalPoint, eased * 0.3);
  const focalPoint: [number, number] = [baseFocal[0] + driftX, baseFocal[1] + driftY];

  // Interpolate line params
  const lineParams = {
    count: Math.round(
      lerp(currentKeyframe.lineCount, nextKeyframe.lineCount, eased * 0.2)
    ),
    spread: lerp(currentKeyframe.spread, nextKeyframe.spread, eased * 0.3),
    complexity: Math.round(
      lerp(currentKeyframe.complexity, nextKeyframe.complexity, eased * 0.2)
    ),
  };

  // Sky fragments from current keyframe with smooth opacity transitions
  const skyFragments = currentKeyframe.skyFragments.map((frag, i) => ({
    ...frag,
    opacity: frag.opacity * (0.8 + 0.2 * Math.sin(localProgress * Math.PI)),
  }));

  return {
    focalPoint,
    lineParams,
    skyFragments,
    transitionPhase: isTransitioning ? transitionProgress : 0,
    activeSection: section,
    burstDirection: lerp(
      currentKeyframe.burstDirection,
      nextKeyframe.burstDirection,
      eased * 0.3
    ),
  };
}
