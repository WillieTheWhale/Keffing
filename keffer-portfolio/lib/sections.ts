// Canonical section registry — single source of truth for section order and
// labels. Consumed by lib/sectionBands.ts (which section is in view),
// SectionNav (the channel rail) and IndexMenu (the full-screen index).

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
  /** Punctuation color — reserved for the terminal Dive entry. */
  red?: boolean;
  /** Excluded from the SectionNav dot rail (Dive has its own red IndexMenu entry only). */
  hideFromNav?: boolean;
}

export const SECTIONS: SectionMeta[] = [
  { id: "hero", num: "01", indexLabel: "SIGNAL", indexNote: "the burst" },
  { id: "about", num: "02", indexLabel: "BIO", indexNote: "first silence" },
  { id: "work", num: "03", indexLabel: "WORK", indexNote: "selected projects" },
  { id: "stuff", num: "04", indexLabel: "MY STUFF", indexNote: "hardware · software · media · stüssy · reading" },
  { id: "experience", num: "05", indexLabel: "EXPERIENCE", indexNote: "roles & extracurriculars" },
  { id: "contact", num: "06", indexLabel: "CONTACT", indexNote: "open channel" },
  { id: "dive", num: "07", indexLabel: "THE DIVE", indexNote: "pure signal", red: true, hideFromNav: true },
];

export const SECTION_IDS: SectionName[] = SECTIONS.map((s) => s.id);
