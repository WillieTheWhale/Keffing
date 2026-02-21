"use client";

import { create } from "zustand";
import { SectionName } from "./tokens";
import { getDailySeed } from "./generative";

export interface SceneState {
  scrollProgress: number;
  activeSection: SectionName;
  focalPoint: [number, number];
  mousePosition: [number, number];
  transitionPhase: number;
  viewportSize: [number, number];
  deviceTier: "mobile" | "tablet" | "desktop" | "wide";
  reducedMotion: boolean;
  seed: number;
  lineParams: {
    count: number;
    spread: number;
    complexity: number;
  };
  skyFragments: {
    position: [number, number];
    maskType: "rectangle" | "parallelogram" | "rounded";
    opacity: number;
    scale: number;
  }[];
}

interface StoreState extends SceneState {
  setScrollProgress: (progress: number) => void;
  setActiveSection: (section: SectionName) => void;
  setFocalPoint: (point: [number, number]) => void;
  setMousePosition: (pos: [number, number]) => void;
  setTransitionPhase: (phase: number) => void;
  setViewportSize: (size: [number, number]) => void;
  setDeviceTier: (tier: SceneState["deviceTier"]) => void;
  setReducedMotion: (reduced: boolean) => void;
  setSeed: (seed: number) => void;
  setLineParams: (params: SceneState["lineParams"]) => void;
  setSkyFragments: (fragments: SceneState["skyFragments"]) => void;
}

export const useStore = create<StoreState>((set) => ({
  scrollProgress: 0,
  activeSection: "hero",
  focalPoint: [0.7, 0.3],
  mousePosition: [0.5, 0.5],
  transitionPhase: 0,
  viewportSize: [1920, 1080],
  deviceTier: "desktop",
  reducedMotion: false,
  seed: getDailySeed(),
  lineParams: {
    count: 150,
    spread: 280,
    complexity: 5,
  },
  skyFragments: [],

  setScrollProgress: (progress) => set({ scrollProgress: progress }),
  setActiveSection: (section) => set({ activeSection: section }),
  setFocalPoint: (point) => set({ focalPoint: point }),
  setMousePosition: (pos) => set({ mousePosition: pos }),
  setTransitionPhase: (phase) => set({ transitionPhase: phase }),
  setViewportSize: (size) => set({ viewportSize: size }),
  setDeviceTier: (tier) => set({ deviceTier: tier }),
  setReducedMotion: (reduced) => set({ reducedMotion: reduced }),
  setSeed: (seed) => set({ seed }),
  setLineParams: (params) => set({ lineParams: params }),
  setSkyFragments: (fragments) => set({ skyFragments: fragments }),
}));
