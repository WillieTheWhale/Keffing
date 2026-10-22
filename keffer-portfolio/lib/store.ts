"use client";

import { create } from "zustand";
import { SectionName } from "./sections";

export interface SceneState {
  activeSection: SectionName;
  deviceTier: "mobile" | "tablet" | "desktop" | "wide";
  reducedMotion: boolean;
  /** True once the entry boot sequence has cleared (or was skipped). */
  entryDone: boolean;
  seed: number;
}

interface StoreState extends SceneState {
  setDeviceTier: (tier: SceneState["deviceTier"]) => void;
  setReducedMotion: (reduced: boolean) => void;
}

export const useStore = create<StoreState>((set) => ({
  activeSection: "hero",
  deviceTier: "desktop",
  reducedMotion: false,
  entryDone: false,
  // One frozen seed for the hero name's scatter.
  seed: 20260908,

  setDeviceTier: (tier) => set({ deviceTier: tier }),
  setReducedMotion: (reduced) => set({ reducedMotion: reduced }),
}));
