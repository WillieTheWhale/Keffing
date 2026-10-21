// Section window for placed elements. An element authored for viewport
// `atVH` fades in as that viewport approaches and out once it has passed, so
// each section of the page has its own cast instead of everything from the
// hero lingering on the fixed layers.

const FADE = 0.45;   // viewport heights over which an element fades
const LEAD = 0.55;   // how early (in vh) it starts appearing
const TAIL = 1.15;   // how long after its viewport it stays

/** 0..1 visibility for an element authored at `atVH`, given the scroll position in vh. */
export function windowVis(scrollVH: number, atVH: number): number {
  const start = atVH - LEAD;
  const end = atVH + TAIL;
  const up = atVH <= 0 ? 1 : Math.min(1, Math.max(0, (scrollVH - start) / FADE));
  const down = Math.min(1, Math.max(0, (end + FADE - scrollVH) / FADE));
  return Math.min(up, down);
}
