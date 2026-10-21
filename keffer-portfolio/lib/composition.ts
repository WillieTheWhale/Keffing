// THE composition — one art-directed static design, after Aletiune.
//
// Everything prominent is placed by hand here: the nucleus, the major
// edge-traced tubes, the chrome blades, the calligraphic swipes, every sky
// photograph, every flat block, every typed text column. Only fine texture
// (hairlines, dust, the small cables inside the nucleus, spatter) comes from
// a generator, and that generator runs on ONE frozen seed, so the page is
// identical on every visit. There is no daily seed any more.
//
// Coordinate conventions:
//   hero-space curves: x = fraction of viewport width, y = fraction of
//     viewport height at scroll 0 (values outside 0..1 run off-screen).
//   placed layers (photos, blocks, text): `atVH` = the scroll position (in
//     viewport heights) at which the element sits at `offset` % of the
//     viewport, moving at `parallax` × scroll. atVH 0 = the hero.

export const TEXTURE_SEED = 20260908;

export type Vec = [number, number];
export type Cubic = [Vec, Vec, Vec, Vec];

export const FOCAL: Vec = [0.66, 0.31];

/** Edge-traced tube: white body, black contour. Widths in px. */
export interface TubeSpec { cp: Cubic; width: number; opacity?: number }
/** Chrome matcap blade rooted in the nucleus. */
export interface BladeSpec { cp: Cubic; width: number; taper: 0 | 1 | 2 }
/** Calligraphic black swipe. */
export interface SwipeSpec { cp: Cubic; width: number; variant: 0 | 1 }

export interface PhotoSpec {
  src: number;          // index into SKY_PHOTOS
  x: number;            // % of viewport width (left edge)
  atVH: number;
  offset: number;       // % of viewport height (top edge) when at atVH
  parallax: number;
  w: number;            // px
  h: number;            // px
  opacity: number;
  caption?: string;     // tiny oblique caption under the photo, in the reference's style
  skew?: number;        // parallelogram cut, −0.12..0.12 (most photos are straight)
}

export type BlockKind = "ink" | "blue" | "halftone" | "blur";
export interface BlockSpec {
  kind: BlockKind;
  x: number; atVH: number; offset: number; parallax: number;
  w: number; h: number;
  opacity?: number;
  star?: boolean;       // blue blocks only: a cut-out star
}

export interface TextSpec {
  frag: number;         // index into lyricsPool
  x: number; atVH: number; offset: number; parallax: number;
  accent?: boolean;     // Mincho voice instead of typed mono
  opacity?: number;
}

// ─── The hero ───────────────────────────────────────────────

/** Major tubes — the structural voice. All root in the nucleus. */
export const TUBES: TubeSpec[] = [
  // The long sweep: out of the nucleus, under the name, off bottom-left.
  { cp: [[0.66, 0.31], [0.46, 0.27], [0.24, 0.58], [-0.06, 0.80]], width: 26 },
  // Its harness companion, a few px inside the curve.
  { cp: [[0.66, 0.31], [0.47, 0.30], [0.27, 0.60], [-0.06, 0.86]], width: 11 },
  // Up and out top-right.
  { cp: [[0.66, 0.31], [0.79, 0.19], [0.90, 0.06], [1.06, -0.12]], width: 19 },
  // The S down the right side.
  { cp: [[0.66, 0.31], [0.75, 0.52], [0.86, 0.60], [1.06, 0.98]], width: 22 },
  // Straight down past the right of the name.
  { cp: [[0.66, 0.31], [0.63, 0.52], [0.71, 0.74], [0.66, 1.16]], width: 15 },
  // Long, thin, up-left.
  { cp: [[0.66, 0.31], [0.55, 0.13], [0.34, 0.03], [0.08, -0.14]], width: 12 },
  // A hook: curls out and back into the mass.
  { cp: [[0.66, 0.31], [0.80, 0.37], [0.74, 0.50], [0.61, 0.41]], width: 13 },
  // Flat left run, at name height, behind the letters.
  { cp: [[0.66, 0.31], [0.50, 0.35], [0.30, 0.31], [-0.06, 0.37]], width: 10 },
];

/** Chrome blades — the liquid voice. */
export const BLADES: BladeSpec[] = [
  { cp: [[0.66, 0.31], [0.52, 0.10], [0.24, 0.14], [-0.08, 0.04]], width: 46, taper: 1 },
  { cp: [[0.66, 0.31], [0.86, 0.40], [0.96, 0.70], [1.06, 1.06]], width: 38, taper: 0 },
  { cp: [[0.66, 0.31], [0.60, 0.56], [0.42, 0.78], [0.14, 1.12]], width: 30, taper: 1 },
];

/** Calligraphic swipes — the ink voice. */
export const SWIPES: SwipeSpec[] = [
  // Across the big sky photograph, like the brush over the sky in the reference.
  { cp: [[0.18, 0.70], [0.34, 0.62], [0.50, 0.74], [0.64, 0.66]], width: 14, variant: 1 },
  { cp: [[0.66, 0.31], [0.90, 0.20], [1.00, 0.33], [1.08, 0.24]], width: 18, variant: 0 },
  { cp: [[0.54, 0.16], [0.62, 0.29], [0.71, 0.27], [0.82, 0.10]], width: 10, variant: 0 },
];

// ─── Placed layers (whole page) ─────────────────────────────

export const PHOTOS: PhotoSpec[] = [
  // Hero — the column of three on the far left, captioned, as in the reference.
  { src: 10, x: 3.5, atVH: 0, offset: 12, parallax: 0.08, w: 150, h: 104, opacity: 0.82, caption: "0022/22/1" },
  { src: 3,  x: 3.5, atVH: 0, offset: 36, parallax: 0.08, w: 150, h: 104, opacity: 0.82, caption: "02/2724/232" },
  { src: 7,  x: 3.5, atVH: 0, offset: 60, parallax: 0.08, w: 150, h: 104, opacity: 0.82, caption: "03/help/2" },
  // The big one under the name's left half.
  { src: 4,  x: 21, atVH: 0, offset: 31, parallax: 0.12, w: 320, h: 330, opacity: 0.86 },
  // Wide, under the tagline.
  { src: 0,  x: 50, atVH: 0, offset: 66, parallax: 0.18, w: 430, h: 220, opacity: 0.78, caption: "0x0f38722" },
  // Tall, right.
  { src: 16, x: 84, atVH: 0, offset: 44, parallax: 0.24, w: 190, h: 300, opacity: 0.72, skew: 0.06 },
  // Small, top right of the nucleus.
  { src: 12, x: 74, atVH: 0, offset: 4, parallax: 0.30, w: 120, h: 80, opacity: 0.7 },
  // BIO — near-silence: one faint photograph.
  { src: 8,  x: 8,  atVH: 1.1, offset: 50, parallax: 0.10, w: 260, h: 170, opacity: 0.32 },
  // WORK
  { src: 1,  x: 4,  atVH: 2.0, offset: 22, parallax: 0.16, w: 240, h: 300, opacity: 0.66, caption: "0x0f37390" },
  { src: 14, x: 78, atVH: 2.2, offset: 62, parallax: 0.22, w: 300, h: 190, opacity: 0.62 },
  { src: 5,  x: 40, atVH: 2.6, offset: 80, parallax: 0.34, w: 180, h: 120, opacity: 0.55 },
  // MY STUFF
  { src: 17, x: 70, atVH: 3.3, offset: 14, parallax: 0.14, w: 280, h: 180, opacity: 0.6, skew: -0.05 },
  { src: 2,  x: 10, atVH: 3.6, offset: 70, parallax: 0.28, w: 200, h: 260, opacity: 0.5 },
  // EXPERIENCE
  { src: 9,  x: 6,  atVH: 4.4, offset: 30, parallax: 0.12, w: 320, h: 200, opacity: 0.58, caption: "023/22201/32" },
  { src: 15, x: 66, atVH: 4.9, offset: 74, parallax: 0.20, w: 240, h: 300, opacity: 0.5 },
  { src: 11, x: 30, atVH: 5.3, offset: 10, parallax: 0.30, w: 160, h: 110, opacity: 0.45 },
  // CONTACT — the flare.
  { src: 18, x: 4,  atVH: 5.9, offset: 18, parallax: 0.10, w: 360, h: 240, opacity: 0.72 },
  { src: 6,  x: 60, atVH: 6.0, offset: 56, parallax: 0.18, w: 300, h: 200, opacity: 0.66 },
  { src: 13, x: 82, atVH: 6.2, offset: 8,  parallax: 0.26, w: 180, h: 260, opacity: 0.6, skew: 0.05 },
];

export const BLOCKS: BlockSpec[] = [
  // Hero
  { kind: "blue", x: 9, atVH: 0, offset: 4, parallax: 0.10, w: 150, h: 58, star: true },
  { kind: "ink", x: 41, atVH: 0, offset: 24, parallax: 0.16, w: 120, h: 30 },
  { kind: "halftone", x: 18, atVH: 0, offset: 36, parallax: 0.12, w: 130, h: 34 },
  { kind: "blue", x: 88, atVH: 0, offset: 80, parallax: 0.22, w: 118, h: 118, star: true },
  { kind: "ink", x: 86, atVH: 0, offset: 45, parallax: 0.14, w: 130, h: 46 },
  { kind: "blur", x: 35, atVH: 0, offset: 84, parallax: 0.20, w: 90, h: 44 },
  { kind: "ink", x: 40, atVH: 0, offset: 94, parallax: 0.30, w: 100, h: 60 },
  { kind: "halftone", x: 62, atVH: 0, offset: 64, parallax: 0.26, w: 110, h: 28 },
  // BIO
  { kind: "ink", x: 20, atVH: 1.2, offset: 40, parallax: 0.12, w: 160, h: 22 },
  { kind: "halftone", x: 70, atVH: 1.3, offset: 74, parallax: 0.20, w: 90, h: 90 },
  // WORK
  { kind: "blue", x: 2, atVH: 2.3, offset: 86, parallax: 0.14, w: 52, h: 180 },
  { kind: "ink", x: 60, atVH: 2.1, offset: 16, parallax: 0.24, w: 140, h: 40 },
  { kind: "blur", x: 84, atVH: 2.5, offset: 34, parallax: 0.30, w: 120, h: 70 },
  // MY STUFF
  { kind: "halftone", x: 48, atVH: 3.4, offset: 88, parallax: 0.18, w: 160, h: 40 },
  { kind: "ink", x: 88, atVH: 3.7, offset: 40, parallax: 0.26, w: 90, h: 130 },
  // EXPERIENCE
  { kind: "blue", x: 76, atVH: 4.5, offset: 20, parallax: 0.16, w: 140, h: 54, star: true },
  { kind: "ink", x: 12, atVH: 5.0, offset: 84, parallax: 0.22, w: 220, h: 26 },
  { kind: "halftone", x: 52, atVH: 5.2, offset: 48, parallax: 0.30, w: 100, h: 100 },
  // CONTACT
  { kind: "ink", x: 74, atVH: 6.0, offset: 82, parallax: 0.12, w: 180, h: 44 },
  { kind: "blue", x: 22, atVH: 6.3, offset: 60, parallax: 0.24, w: 90, h: 90, star: true },
  { kind: "blur", x: 50, atVH: 6.1, offset: 30, parallax: 0.34, w: 140, h: 60 },
];

export const TEXTS: TextSpec[] = [
  // Hero — the typed left column and a note under the nucleus.
  { frag: 0, x: 7, atVH: 0, offset: 76, parallax: 0.55 },
  { frag: 4, x: 7, atVH: 0, offset: 88, parallax: 0.55 },
  { frag: 9, x: 73, atVH: 0, offset: 56, parallax: 0.62, accent: true },
  { frag: 2, x: 90, atVH: 0, offset: 22, parallax: 0.70 },
  // BIO — the poetry surfaces in the silence.
  { frag: 3, x: 12, atVH: 1.1, offset: 24, parallax: 0.60, accent: true },
  { frag: 7, x: 30, atVH: 1.3, offset: 78, parallax: 0.66 },
  // WORK
  { frag: 5, x: 8, atVH: 2.2, offset: 60, parallax: 0.58 },
  { frag: 11, x: 84, atVH: 2.4, offset: 18, parallax: 0.72, accent: true },
  // MY STUFF
  { frag: 6, x: 70, atVH: 3.5, offset: 72, parallax: 0.60 },
  // EXPERIENCE
  { frag: 8, x: 4, atVH: 4.6, offset: 52, parallax: 0.56, accent: true },
  { frag: 1, x: 62, atVH: 5.1, offset: 30, parallax: 0.68 },
  // CONTACT
  { frag: 10, x: 14, atVH: 6.1, offset: 40, parallax: 0.58 },
  { frag: 12, x: 78, atVH: 6.2, offset: 68, parallax: 0.74, accent: true },
];

/** Document position (% of viewport height) for a placed element. */
export const placedTop = (atVH: number, offset: number, parallax: number) => atVH * parallax * 100 + offset;
