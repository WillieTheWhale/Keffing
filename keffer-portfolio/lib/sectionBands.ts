// Which section is in view, by scroll progress — drives SectionNav's active
// channel. Bands are measured from where the sections actually sit in the
// document, so they stay aligned with real content heights.

import { SECTION_IDS, SectionName } from "./sections";

// Per-section [start, end] scroll-progress bands from the last DOM
// measurement pass.
let bandRanges: { id: SectionName; start: number; end: number }[] = [];

/**
 * Measure each section's band: [entering-viewport-centre,
 * leaving-viewport-centre] in scroll progress. Fonts and images shift layout
 * after mount, so callers measure again shortly after load and on resize.
 */
export function deriveSectionBandsFromDOM(): boolean {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (maxScroll <= 0) return false;

  const bandEdges: { id: SectionName; start: number; end: number }[] = [];
  for (const id of SECTION_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    // Progress at which the section dominates the viewport
    const start = Math.max(0, Math.min(1, (top - window.innerHeight * 0.35) / maxScroll));
    const end = Math.max(0, Math.min(1, (bottom - window.innerHeight * 0.65) / maxScroll));
    bandEdges.push({ id, start, end });
  }
  if (bandEdges.length < 3) return false;
  bandRanges = bandEdges;
  return true;
}

/**
 * Which section dominates the viewport at a given scroll progress. Falls back
 * to "hero" before the first DOM measurement pass has run.
 */
export function activeSectionIdAt(progress: number): SectionName {
  if (bandRanges.length === 0) return "hero";
  for (const b of bandRanges) {
    if (progress >= b.start && progress <= b.end) return b.id;
  }
  // Between bands — nearest band centre wins.
  let best: SectionName = bandRanges[0].id;
  let bestDist = Infinity;
  for (const b of bandRanges) {
    const d = Math.abs(progress - (b.start + b.end) / 2);
    if (d < bestDist) {
      bestDist = d;
      best = b.id;
    }
  }
  return best;
}
