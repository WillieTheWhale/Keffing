// Canonical section registry — single source of truth for section order,
// labels, and density targets. Consumed by lib/density.ts (DOM-derived
// choreography), SectionNav (dot rail), and IndexMenu (full-screen index).
//
// Previously this information was split across three places that could
// silently drift: tokens.ts's fixed-fraction `sections` ranges (used only
// by the now-retired lib/choreography.ts), density.ts's own id list, and
// hardcoded entry arrays in SectionNav/IndexMenu. Reordering sections meant
// updating all of them by hand — exactly the kind of thing that goes stale.

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used only as a type source (typeof below)
const SECTION_ID_LIST = ["hero", "about", "work", "stuff", "experience", "contact", "dive"] as const;

export type SectionName = (typeof SECTION_ID_LIST)[number];

export interface SectionMeta {
  id: SectionName;
  /** Short label for the SectionNav dot-rail tooltip and IndexMenu number. */
  num: string;
  /** Display-scale word in the IndexMenu. */
  indexLabel: string;
  /** Lowercase descriptor next to the IndexMenu entry. */
  indexNote: string;
  /** Target ambient density 0..1 (roadmap W3 choreography). */
  density: number;
  /** Punctuation color — reserved for the terminal Dive entry. */
  red?: boolean;
  /** Excluded from the SectionNav dot rail (Dive has its own red IndexMenu entry only). */
  hideFromNav?: boolean;
}

export const SECTIONS: SectionMeta[] = [
  { id: "hero", num: "01", indexLabel: "SIGNAL", indexNote: "the burst", density: 1.0 },
  { id: "about", num: "02", indexLabel: "BIO", indexNote: "first silence", density: 0.15 },
  { id: "work", num: "03", indexLabel: "WORK", indexNote: "selected projects", density: 0.55 },
  { id: "stuff", num: "04", indexLabel: "MY STUFF", indexNote: "hardware · software · media · stüssy · reading", density: 0.35 },
  { id: "experience", num: "05", indexLabel: "EXPERIENCE", indexNote: "roles & extracurriculars", density: 0.3 },
  { id: "contact", num: "06", indexLabel: "CONTACT", indexNote: "open channel", density: 0.85 },
  { id: "dive", num: "07", indexLabel: "THE DIVE", indexNote: "pure signal", density: 0.05, red: true, hideFromNav: true },
];

export const SECTION_IDS: SectionName[] = SECTIONS.map((s) => s.id);
