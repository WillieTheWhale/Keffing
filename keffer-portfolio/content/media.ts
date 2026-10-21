// Media — the records (and, later, the films) on loop. Cover art lives in
// public/assets/media/<id>.jpg (800px square). Notes are the owner's voice;
// anything not yet written stays empty rather than invented.

export type MediaKind = "album" | "single" | "film" | "game";

export interface MediaEntry {
  id: string;
  title: string;
  /** Artist, director, or studio. */
  by: string;
  kind: MediaKind;
  year?: string;
  /** One line in the owner's voice — why it's here. */
  note?: string;
  url?: string;
  /** Romanised or translated title, shown small under a non-Latin title. */
  alt?: string;
}

export const mediaMusic: MediaEntry[] = [
  { id: "pitcher56-her-abiding-memory", title: "Her Abiding Memory", by: "Pitcher56", kind: "album", year: "2026", note: "Current loop." },
  { id: "lamp-ranpu-genso", title: "ランプ幻想", alt: "Lamp Gensō", by: "Lamp", kind: "album", year: "2008" },
  { id: "lamp-yume", title: "ゆめ", alt: "Yume", by: "Lamp", kind: "album", year: "2014" },
  { id: "ichiko-aoba-windswept-adan", title: "Windswept Adan", by: "Ichiko Aoba", kind: "album", year: "2020", url: "https://ichikoaoba.bandcamp.com/album/windswept-adan" },
  { id: "feng-what-the-feng", title: "What The Feng", by: "Feng", kind: "album", year: "2026" },
  { id: "feng-walk-in-the-park", title: "Walk in the park", by: "Feng", kind: "single", year: "2025" },
  { id: "ryo-fukui-scenery", title: "Scenery", by: "Ryo Fukui", kind: "album", year: "1976" },
  { id: "lcd-soundsystem-this-is-happening", title: "This Is Happening", by: "LCD Soundsystem", kind: "album", year: "2010", note: "For “Dance Yrself Clean”." },
  { id: "grimes-visions", title: "Visions", by: "Grimes", kind: "album", year: "2012" },
];

export const mediaGames: MediaEntry[] = [
  { id: "technical-minecraft", title: "Technical Minecraft", by: "Mojang", kind: "game", note: "Redstone contraptions as an unreasonably good intuition pump for clocked logic." },
  { id: "stardew-valley", title: "Stardew Valley", by: "ConcernedApe", kind: "game", note: "The farm gets tended between builds." },
];

export const mediaEntries: MediaEntry[] = [...mediaMusic, ...mediaGames];
