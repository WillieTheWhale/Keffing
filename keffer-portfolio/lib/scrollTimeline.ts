// Scroll-linked motion on touch devices.
//
// A finger scroll runs on the compositor (at 120 Hz on ProMotion phones),
// while requestAnimationFrame runs on the main thread at 60 Hz at best and a
// frame behind the scroll. Anything that moved with the page from JavaScript
// stepped against the text there. These helpers let that motion run on the
// compositor as CSS scroll-driven animations instead: exact keyframes for a
// piecewise curve of the scroll, laid on the root scroller over a fixed
// pixel range so the browser's toolbars (which change the scroll range) never
// stretch them. Desktop keeps its JavaScript path: Lenis drives its scroll
// from the same frame, so there was nothing to fix there.

let coarseQuery: MediaQueryList | null = null;
/** Touch is the primary input (the page scrolls natively, on the compositor). */
function touchFirst(): boolean {
  coarseQuery ??= window.matchMedia("(pointer: coarse)");
  return coarseQuery.matches;
}

/** Touch-first device whose browser runs scroll-driven animations. */
export function compositorScroll(): boolean {
  if (typeof window === "undefined" || typeof CSS === "undefined") return false;
  return (
    CSS.supports("animation-timeline: scroll()") &&
    CSS.supports("animation-range: 0px 1px") &&
    touchFirst() &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

let probe: HTMLDivElement | null = null;
let cached = 0;
let cachedW = 0;

/**
 * The viewport height scroll positions are measured in. On touch devices
 * this is the large viewport (CSS `vh`/`lvh`, toolbars retracted), which the
 * page's own vh-sized layout uses too; `innerHeight` grows and shrinks with
 * the toolbars on every change of scroll direction. Elsewhere `innerHeight`.
 */
export function viewportHeight(): number {
  if (typeof window === "undefined") return 1;
  if (!touchFirst()) return Math.max(1, window.innerHeight);
  if (!cached || cachedW !== window.innerWidth) measure();
  return cached;
}

function measure() {
  if (!probe) {
    probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "position:fixed;top:0;left:0;width:0;height:100vh;height:100lvh;visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);
    window.addEventListener("resize", () => { cached = 0; });
  }
  cached = Math.max(1, probe.getBoundingClientRect().height || window.innerHeight);
  cachedW = window.innerWidth;
}

// ─── Keyframes ──────────────────────────────────────────────

/**
 * One animated property as a function of the scroll position `s` (in
 * viewport heights), polynomial of degree ≤ 3 between consecutive
 * `breaks`. Each piece becomes one keyframe interval whose cubic-bezier
 * timing function reproduces that polynomial exactly (x control points at
 * 1/3 and 2/3 keep the bezier's x linear in t).
 */
export interface ScrollCurve {
  breaks: number[];
  f: (s: number) => number;
  /** The CSS declaration for a value, e.g. (v) => `opacity: ${v}`. */
  css: (v: number) => string;
}

/**
 * The faded-out opacity of a scroll-animated layer. Chrome rasterizes no
 * layer at opacity 0, so a fade-in run by the compositor would draw it with
 * missing tiles for its first frames; at 0.001 it stays rasterized and adds
 * under a quarter of an 8-bit step to any pixel (it was hidden by JS before).
 */
export const FADED = 0.001;

/** A number for generated CSS: full precision, no exponent for tiny values. */
export const cssNum = (v: number) => (Math.abs(v) < 1e-9 ? "0" : String(+v.toPrecision(12)));
const num = cssNum;

/**
 * `@keyframes name {…}` for a curve over the scroll range [0, rangePx]
 * (use with `animation-range: 0px <rangePx>px`); `vh` converts `s` to px.
 */
export function scrollKeyframes(name: string, c: ScrollCurve, vh: number, rangePx: number): string {
  const end = rangePx / vh;
  const xs = [...new Set([0, ...c.breaks.filter((b) => b > 0 && b < end), end].map((b) => +b.toFixed(9)))].sort((a, b) => a - b);
  const pct = (s: number) => num(Math.min(100, (s * vh * 100) / rangePx));
  let out = `@keyframes ${name}{`;
  for (let i = 0; i < xs.length; i++) {
    const a = xs[i];
    const va = c.f(a);
    let timing = "";
    if (i < xs.length - 1) {
      const b = xs[i + 1];
      const vb = c.f(b);
      const dv = vb - va;
      if (Math.abs(dv) > 1e-9) {
        // end-point slopes (second-order one-sided differences: exact for
        // quadratics, ~1e-7 relative for cubics)
        const h = (b - a) * 1e-3;
        const d0 = (-3 * va + 4 * c.f(a + h) - c.f(a + 2 * h)) / (2 * h);
        const d1 = (3 * vb - 4 * c.f(b - h) + c.f(b - 2 * h)) / (2 * h);
        const y1 = ((b - a) * d0) / (3 * dv);
        const y2 = 1 - ((b - a) * d1) / (3 * dv);
        if (Math.abs(y1 - 1 / 3) > 1e-6 || Math.abs(y2 - 2 / 3) > 1e-6) timing = `;animation-timing-function:cubic-bezier(0.333333333333,${num(y1)},0.666666666667,${num(y2)})`;
      }
    }
    out += `${pct(a)}%{${c.css(va)}${timing}}`;
  }
  return out + "}";
}

/** A <style> element in <head> for generated keyframes; `set("")` empties it. */
export function styleSheet(): { set: (css: string) => void; remove: () => void } {
  const el = document.createElement("style");
  document.head.appendChild(el);
  let last = "";
  return {
    set: (css) => { if (css !== last) el.textContent = last = css; },
    remove: () => el.remove(),
  };
}

let seq = 0;
/** A fresh prefix for generated keyframe names. */
export const scrollTag = (base: string) => `${base}${++seq}`;
