// "My stuff" — the personal index. Five small collections, each a card on the
// home page that opens into its own catalogue page (/stuff/[id]).
//
// Entries are deliberately thin for now: this pass builds the structure, the
// contents get filled in later. Anything not yet known is an explicit
// `pending` slot (rendered as an unlogged row), never an invented fact.

import { hardwareDevices } from "./hardware";
import { mediaEntries } from "./media";

export type StuffId = "hardware" | "software" | "media" | "stussy" | "reading";

export interface StuffItem {
  name: string;
  /** One line: why it's here / what it's for. */
  note?: string;
  /** Mono metadata: model, year, artist, publication, … */
  meta?: string;
  url?: string;
  /** Slot reserved for an entry that hasn't been logged yet. */
  pending?: boolean;
}

export interface StuffCollection {
  id: StuffId;
  /** Two-letter file code in the transmission language. */
  code: string;
  title: string;
  /** Short mono descriptor under the title on the card. */
  descriptor: string;
  /** Standfirst on the catalogue page. */
  standfirst: string;
  /** Column label for `meta` on the catalogue page. */
  metaLabel: string;
  items: StuffItem[];
}

const pending = (n: number): StuffItem[] =>
  Array.from({ length: n }, () => ({ name: "", pending: true }));

export const stuffCollections: StuffCollection[] = [
  {
    id: "hardware",
    code: "HW",
    title: "Hardware",
    descriptor: "the desk, the machines, the peripherals",
    standfirst:
      "The machines, the handhelds, and the things I keep within reach. A small collection, rendered in a few polygons.",
    metaLabel: "Spec",
    items: hardwareDevices,
  },
  {
    id: "software",
    code: "SW",
    title: "Software",
    descriptor: "tools in daily rotation",
    standfirst:
      "The stack I reach for without thinking. Some of it is visible in this site's own source; the rest is the invisible tooling around it.",
    metaLabel: "Role",
    items: [
      { name: "Next.js + TypeScript", note: "The default for anything with a browser in front of it — this site included.", meta: "web", url: "https://nextjs.org" },
      { name: "Three.js", note: "Drives the chrome tendrils and the sky fragments behind you right now.", meta: "graphics", url: "https://threejs.org" },
      { name: "PyTorch", note: "Everything research-shaped: adversarial ML, the Bragg-peak transport model.", meta: "ml", url: "https://pytorch.org" },
      { name: "Figma", note: "Design source of truth for the SIGNAL/NOISE system.", meta: "design", url: "https://figma.com" },
      { name: "Claude Code + Codex", note: "Pair programmers for the long overnight passes.", meta: "agents" },
      ...pending(3),
    ],
  },
  {
    id: "media",
    code: "MD",
    title: "Media",
    descriptor: "records, films, games on loop",
    standfirst:
      "What's playing while the rest of this gets built. Heavy rotation only — nothing here is a recommendation so much as a confession.",
    metaLabel: "Kind",
    items: mediaEntries.map((m) => ({ name: m.title, note: m.note, meta: m.kind, url: m.url })),
  },
  {
    id: "stussy",
    code: "ST",
    title: "Stüssy",
    descriptor: "the archive — pieces, seasons, grails",
    standfirst:
      "A running log of the Stüssy archive: what's in the rotation, what's been tracked down, and what's still being hunted.",
    metaLabel: "Season",
    items: pending(5),
  },
  {
    id: "reading",
    code: "RD",
    title: "Reading",
    descriptor: "articles worth the tab, lately",
    standfirst:
      "Links I keep sending people. Papers, essays, and the occasional thread — recent first, with one line on why it stuck.",
    metaLabel: "Source",
    items: pending(5),
  },
];

export const stuffById = (id: string): StuffCollection | undefined =>
  stuffCollections.find((c) => c.id === id);

export const loggedCount = (c: StuffCollection): number =>
  c.items.filter((i) => !i.pending).length;
