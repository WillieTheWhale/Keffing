// The home background's paper colour: one value shared by the DOM paper layer
// (layout2d.tsx) and the WebGL depth haze (engine.ts), swappable at runtime by
// PaperPicker. The picker shows in development, or on any build when the URL
// has `?paper`; a pick is remembered in localStorage only where the picker is
// available, so visitors always get DEFAULT_PAPER.

export interface PaperOption {
  name: string;
  hex: string;
}

/** Lightest-to-darkest is not the order: warm → neutral → cool, then whites. */
export const PAPERS: PaperOption[] = [
  { name: "Current paper", hex: "#f2f1ec" },
  { name: "Egg white", hex: "#f6f5f1" },
  { name: "Bone", hex: "#f3f3f1" },
  { name: "Neutral", hex: "#f1f1f1" },
  { name: "Light gray", hex: "#ecedee" },
  { name: "Mist", hex: "#eff1f3" },
  { name: "Cloud", hex: "#f5f6f8" },
  { name: "Porcelain", hex: "#f9f9f8" },
];

export const DEFAULT_PAPER = "#f2f1ec";

const KEY = "keffer:paper";
const subs = new Set<(hex: string) => void>();

export function pickerEnabled(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).has("paper");
}

function stored(): string | null {
  if (typeof window === "undefined" || !pickerEnabled()) return null;
  try {
    const v = window.localStorage.getItem(KEY);
    return v && PAPERS.some((p) => p.hex === v) ? v : null;
  } catch {
    return null;
  }
}

let current = stored() ?? DEFAULT_PAPER;

export const getPaper = () => current;

export function setPaper(hex: string) {
  current = hex;
  try {
    window.localStorage.setItem(KEY, hex);
  } catch {
    // private mode / blocked storage: the pick still applies for this visit
  }
  subs.forEach((fn) => fn(hex));
}

/** Subscribe to paper changes; returns the unsubscribe. */
export function onPaper(fn: (hex: string) => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}
