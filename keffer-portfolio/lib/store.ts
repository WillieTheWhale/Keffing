"use client";

import { create } from "zustand";
import { SectionName } from "./sections";

export interface SceneState {
  scrollProgress: number;
  activeSection: SectionName;
  mousePosition: [number, number];
  viewportSize: [number, number];
  deviceTier: "mobile" | "tablet" | "desktop" | "wide";
  reducedMotion: boolean;
  /** True once the entry boot sequence has cleared (or was skipped). */
  entryDone: boolean;
  /** When set, pins the line-canvas density (case pages). Null = choreography. */
  densityOverride: number | null;
  seed: number;
}

interface StoreState extends SceneState {
  setScrollProgress: (progress: number) => void;
  setActiveSection: (section: SectionName) => void;
  setMousePosition: (pos: [number, number]) => void;
  setViewportSize: (size: [number, number]) => void;
  setDeviceTier: (tier: SceneState["deviceTier"]) => void;
  setReducedMotion: (reduced: boolean) => void;
  setSeed: (seed: number) => void;
}

export const useStore = create<StoreState>((set) => ({
  scrollProgress: 0,
  activeSection: "hero",
  mousePosition: [0.5, 0.5],
  viewportSize: [1920, 1080],
  deviceTier: "desktop",
  reducedMotion: false,
  entryDone: false,
  densityOverride: null,
  // One frozen seed for fine texture — the composition is static (lib/composition.ts).
  seed: 20260908,

  setScrollProgress: (progress) => set({ scrollProgress: progress }),
  setActiveSection: (section) => set({ activeSection: section }),
  setMousePosition: (pos) => set({ mousePosition: pos }),
  setViewportSize: (size) => set({ viewportSize: size }),
  setDeviceTier: (tier) => set({ deviceTier: tier }),
  setReducedMotion: (reduced) => set({ reducedMotion: reduced }),
  setSeed: (seed) => set({ seed }),
}));
