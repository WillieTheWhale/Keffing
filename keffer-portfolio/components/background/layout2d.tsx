"use client";

// Background — ALLOY. The 2D print layout, composed per section: v2 CHROME's
// layout plus v1 CONTOUR's drawing furniture — a title block, crop marks at
// the mounted panels, a schematic overprinted on a sky panel, a fold crease.
//
// Two fixed layers: UNDER the GL canvas (paper, mounted sky panels, dusty
// blue blocks, schematic sheets, ASCII fields, hex columns) and OVER it
// (ring stars, hairline offset frames, rule stacks, vellum, captions) — so
// the chrome passes in front of the photographs and behind the frames, as
// in r01 / e06. Every element is hand-placed: x/w in vw, y/h in vh at its
// section's home scroll position, moving at `pf` × the camera scroll (the
// same decelerating camera curve the GL layer uses, so the two never drift
// apart). Transforms only; nothing is written to :root.

import { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { homeScroll, type PageLayout } from "./engine";
import type { PageFrame, PageKind, SectionId } from "./pieces";
import { AsciiField, CropMarks, Crease, RingStar, Schematic, TitleBlock } from "./print";
import { lyricsPool } from "@/content/lyrics";
import { ASCII_SKY } from "./asciiSky";
import { withBase } from "@/lib/basePath";
import { PAPER } from "./paper";

const BLUE = "#7d9fdb";
const BLUE_2 = "#8eacdf";
const INK = "#1b1d22";
const P = withBase("/assets/background/panels/");
const GRAIN = `url(${withBase("/assets/background/paper-grain.png")})`;

type Layer = "under" | "over";

export interface Item {
  layer: Layer;
  sec: SectionId;
  t: number;
  x: number;
  y: number;
  w: number;
  h?: number;
  /** square in vw (overrides h) */
  sq?: boolean;
  pf: number;
  /** narrow-viewport (portrait) override; null hides the item there. */
  m?: { x?: number; y?: number; w?: number; h?: number } | null;
  /** hidden on mid-width (tablet-landscape / small laptop) windows where the name shifts left */
  compactHide?: boolean;
  /** visible for (scroll − home) in [win0 + FADE, win1], fading outside (vh). */
  win?: [number, number];
  z?: number;
  node: ReactNode;
  style?: CSSProperties;
}

const hexStyle: CSSProperties = {
  fontFamily: "var(--font-shippori), serif",
  fontStyle: "italic",
  color: INK,
  whiteSpace: "nowrap",
  lineHeight: 1,
};
const monoStyle: CSSProperties = {
  fontFamily: "var(--font-mono), monospace",
  fontStyle: "italic",
  color: INK,
  whiteSpace: "nowrap",
  lineHeight: 1.35,
  letterSpacing: "0.02em",
};

function Panel({ src, shadow = true, grain = true }: { src: string; shadow?: boolean; grain?: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, boxShadow: shadow ? "0 1px 0 rgba(0,0,0,0.05), 6px 10px 22px -10px rgba(20,24,40,0.28)" : undefined }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={P + src} alt="" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      {grain && <div style={{ position: "absolute", inset: 0, backgroundImage: GRAIN, backgroundSize: "256px 256px", mixBlendMode: "multiply", opacity: 0.6 }} />}
    </div>
  );
}

function Block({ color = BLUE, to, grain = true }: { color?: string; to?: string; grain?: boolean }) {
  return (
    <div style={{
      position: "absolute", inset: 0,
      background: to ? `linear-gradient(180deg, ${color}, ${to})` : color,
    }}>
      {grain && <div style={{ position: "absolute", inset: 0, backgroundImage: GRAIN, backgroundSize: "256px 256px", mixBlendMode: "multiply", opacity: 0.9 }} />}
    </div>
  );
}

function Frame({ color = "rgba(27,29,34,0.55)", dashed = false }: { color?: string; dashed?: boolean }) {
  return <div style={{ position: "absolute", inset: 0, border: `1px ${dashed ? "dashed" : "solid"} ${color}` }} />;
}

function Rules({ n, gap, weights }: { n: number; gap: number; weights?: number[] }) {
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: 0, right: 0, top: i * gap, height: weights?.[i % weights.length] ?? 1, background: INK, opacity: 0.8 }} />
      ))}
    </div>
  );
}

function Hex({ items }: { items: [number, string, number][] }) {
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {items.map(([dy, s, size], i) => (
        <div key={i} style={{ ...hexStyle, position: "absolute", left: 0, top: `${dy}vh`, fontSize: size }}>{s}</div>
      ))}
    </div>
  );
}

function hexRows(rows: number, seed: number): [string, string][] {
  let x = (seed * 2654435761) >>> 0;
  const h = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x; };
  const hex = (n: number) => h().toString(16).padStart(8, "0").slice(0, n);
  return Array.from({ length: rows }, () => [hex(7), `${hex(2)} ${hex(2)} ${hex(2)} ${hex(2)}`]);
}

function HexDump({ rows, seed }: { rows: number; seed: number }) {
  const data = useMemo(() => hexRows(rows, seed), [rows, seed]);
  return (
    <div style={{ ...hexStyle, fontSize: 9.5, lineHeight: 1.5, opacity: 0.85 }}>
      {data.map(([a, b], i) => (
        <div key={i}>0x{a}&nbsp;&nbsp;&nbsp;<span style={{ opacity: 0.6 }}>{b}</span></div>
      ))}
    </div>
  );
}

function Typed({ frag, accent = false }: { frag: number; accent?: boolean }) {
  const text = lyricsPool[frag % lyricsPool.length].text;
  return (
    <div style={accent
      ? { fontFamily: "var(--font-accent), serif", fontSize: 12, lineHeight: 1.85, letterSpacing: "0.07em", color: "#1a1a1a", whiteSpace: "pre", opacity: 0.62 }
      : { fontFamily: "var(--font-mono), monospace", fontSize: 9.5, lineHeight: 1.55, letterSpacing: "0.02em", color: "#1a1a1a", whiteSpace: "pre", opacity: 0.58 }}>
      {text}
    </div>
  );
}

function Caption({ lines, size = 9 }: { lines: string[]; size?: number }) {
  return (
    <div style={{ ...monoStyle, fontSize: size, opacity: 0.75 }}>
      {lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}


// ─── The layout ─────────────────────────────────────────────

const HEX_A = "0x0f38722", HEX_B = "0xff37390", HEX_C = "0x3d63b8f";

const HOME_ITEMS: Item[] = [
  // ══ HERO ══════════════════════════════════════════════════
  // right: the big mounted cobalt sky the mass sits on (e02 in a frame)
  { layer: "under", sec: "hero", t: 0, x: 55.5, y: 5, w: 36, h: 46, pf: 0.5, m: { x: 40, y: 4, w: 56, h: 24 }, node: <Panel src="hero-cobalt.webp" /> },
  { layer: "over", sec: "hero", t: 0, x: 56.6, y: 6.6, w: 36, h: 46, pf: 0.5, m: { x: 42, y: 5.2, w: 56, h: 24 }, node: <Frame color="rgba(27,29,34,0.42)" /> },
  // the schematic continues onto the sky as an overprint (r04 / r07): the shards burst over it
  { layer: "under", sec: "hero", t: 0, x: 55.5, y: 5, w: 17, h: 25, pf: 0.5, m: null, node: <div style={{ position: "absolute", inset: 0, opacity: 0.5, mixBlendMode: "multiply", overflow: "hidden" }}><Schematic seed={11} w={272} h={250} title="SIGNAL / NOISE — OVERPRINT" /></div> },
  { layer: "over", sec: "hero", t: 0, x: 55.5, y: 5, w: 36, h: 46, pf: 0.5, m: { x: 40, y: 4, w: 56, h: 24 }, node: <CropMarks /> },
  // a fold crease across the sheet, under everything
  { layer: "under", sec: "hero", t: 0, x: 0, y: 70.5, w: 100, h: 2.4, pf: 0.6, m: { x: 0, y: 66, w: 100, h: 1.6 }, node: <Crease /> },
  { layer: "over", sec: "hero", t: 0, x: 55.5, y: 52.4, w: 22, pf: 0.5, m: { x: 40, y: 28.8, w: 56 }, node: <Caption lines={["FIG. 02 — CUMULUS / 14:02:07", `${HEX_A}  ·  r=0.66 θ=0.31`]} size={8.5} /> },
  { layer: "over", sec: "hero", t: 0, x: 84.5, y: 52.4, w: 8, pf: 0.5, m: null, node: <Caption lines={["SPECULAR", "ENV 2048 · SKY-04"]} size={7.5} /> },
  { layer: "over", sec: "hero", t: 0, x: 63, y: 2.4, w: 33, h: 2, pf: 0.5, m: { x: 30, y: 1.6, w: 66 }, node: <Rules n={3} gap={5} weights={[1, 1, 2]} /> },
  // top-left specimen: a navy sky strip, a blue band, one star over an offset square, a hex dump
  { layer: "under", sec: "hero", t: 0, x: 3.6, y: 7, w: 6.4, h: 34, pf: 0.55, m: null, node: <Panel src="navy-chip.webp" /> },
  { layer: "over", sec: "hero", t: 0, x: 4.3, y: 8.3, w: 6.4, h: 34, pf: 0.55, m: null, node: <Frame color="rgba(27,29,34,0.4)" /> },
  { layer: "over", sec: "hero", t: 0, x: 3.6, y: 42.8, w: 8, pf: 0.55, m: null, node: <Caption lines={["ALT 3400 M", HEX_A]} size={7.5} /> },
  { layer: "under", sec: "hero", t: 0, x: 11.4, y: 27, w: 14.5, h: 6.5, pf: 0.55, m: { x: 5, y: 20, w: 28, h: 2.6 }, node: <Block color={BLUE} /> },
  { layer: "under", sec: "hero", t: 0, x: 11.6, y: 36, w: 14, h: 14, pf: 0.55, m: null, compactHide: true, node: <HexDump rows={6} seed={5} /> },
  { layer: "under", sec: "hero", t: 0, x: 11.6, y: 28.3, w: 8, pf: 0.55, m: { x: 5.6, y: 20.4, w: 24 }, node: <div style={{ ...hexStyle, fontSize: 7.5, color: "#f3f4f8" }}>{HEX_A}</div> },
  // centre top: dot-matrix field above the name
  { layer: "under", sec: "hero", t: 0, x: 37.5, y: 6.5, w: 15, h: 22, pf: 0.58, m: null, node: <AsciiField lines={ASCII_SKY.cumulus} opacity={0.5} /> },
  // lower left: the big ring star over an offset blue square — the sweep runs between them
  { layer: "under", sec: "hero", t: 0, x: 9.6, y: 66.5, w: 10.5, sq: true, pf: 0.64, m: { x: 12, y: 9.5, w: 16 }, node: <Block color={BLUE} to={BLUE_2} /> },
  { layer: "over", sec: "hero", t: 0, x: 4.8, y: 59.5, w: 13.5, sq: true, pf: 0.64, m: { x: 5, y: 5.5, w: 24 }, node: <RingStar band={0.17} stroke={1.2} /> },
  { layer: "under", sec: "hero", t: 0, x: 4.6, y: 86, w: 16, pf: 0.66, m: { x: 6, y: 84, w: 70 }, node: <Typed frag={0} /> },
  // lower right: a schematic sheet the plunge passes over
  { layer: "under", sec: "hero", t: 0, x: 63.5, y: 66, w: 25, h: 24, pf: 0.62, m: { x: 40, y: 72, w: 58, h: 20 }, node: <div style={{ position: "absolute", inset: 0, opacity: 0.4 }}><Schematic seed={3} w={400} h={240} noTitle /></div> },
  { layer: "over", sec: "hero", t: 0, x: 82.2, y: 84.6, w: 14, h: 10, pf: 0.62, m: null, node: <TitleBlock rows={["DWG  WK-2610-04", "SCALE  1 : 1", "SHEET  4 / 7", "REV  C", "DRN  W.K.  10/26"]} /> },
  { layer: "under", sec: "hero", t: 0, x: 88.5, y: 61.5, w: 6, h: 4.2, pf: 0.62, m: { x: 82, y: 58, w: 12, h: 2.6 }, node: <Block color={BLUE} /> },
  { layer: "under", sec: "hero", t: 0, x: 45.5, y: 74, w: 14, pf: 0.62, m: null, node: <Typed frag={9} accent /> },

  // ══ ABOUT — first silence ═════════════════════════════════
  { layer: "under", sec: "about", t: 0.5, x: 3.2, y: 72, w: 8.5, h: 11, pf: 0.55, m: { x: 5, y: 74, w: 22, h: 9 }, node: <Panel src="about-chip.webp" /> },
  { layer: "over", sec: "about", t: 0.5, x: 3.2, y: 84.2, w: 12, pf: 0.55, m: { x: 5, y: 84, w: 60 }, node: <Caption lines={[`${HEX_B} — overcast, 09:40`]} size={8} /> },
  { layer: "under", sec: "about", t: 0.5, x: 1.6, y: 18, w: 0.1, h: 48, pf: 0.55, m: null, node: <div style={{ position: "absolute", inset: 0, background: INK, opacity: 0.35 }} /> },
  { layer: "over", sec: "about", t: 0.5, x: 10.4, y: 69.6, w: 2.4, sq: true, pf: 0.55, win: [-0.35, 0.5], m: { x: 24, y: 72, w: 6 }, node: <RingStar /> },

  // ══ WORK ══════════════════════════════════════════════════
  { layer: "under", sec: "work", t: 0.5, x: 60, y: 2.5, w: 36.5, h: 20, pf: 0.5, m: { x: 30, y: 3, w: 66, h: 14 }, node: <Panel src="work-navy.webp" /> },
  { layer: "over", sec: "work", t: 0.5, x: 59, y: 1.2, w: 36.5, h: 20, pf: 0.5, m: { x: 28, y: 2, w: 66, h: 14 }, node: <Frame color="rgba(27,29,34,0.38)" /> },
  { layer: "over", sec: "work", t: 0.5, x: 60, y: 2.5, w: 36.5, h: 20, pf: 0.5, m: null, node: <CropMarks off={8} len={12} /> },
  { layer: "over", sec: "work", t: 0.5, x: 60, y: 23.5, w: 20, pf: 0.5, m: { x: 30, y: 18, w: 66 }, node: <Caption lines={["FIG. 03 — ALTOCUMULUS, NAVY GRADE", `${HEX_C} / 0.55`]} size={8} /> },
  { layer: "over", sec: "work", t: 0.5, x: 88, y: 24, w: 8, h: 4, pf: 0.5, m: null, node: <Rules n={7} gap={4} weights={[1, 2, 1, 1, 3, 1, 1]} /> },
  { layer: "under", sec: "work", t: 0.5, x: 1.2, y: 72, w: 1.2, h: 24, pf: 0.52, m: { x: 2, y: 74, w: 2.5, h: 20 }, node: <Block color={BLUE} /> },
  { layer: "under", sec: "work", t: 0.5, x: 3.0, y: 76, w: 8, h: 20, pf: 0.52, m: null, node: <Hex items={[[0, HEX_A, 12], [8, HEX_C, 12], [16, HEX_A, 12]]} /> },
  { layer: "under", sec: "work", t: 0.5, x: 88.5, y: 79, w: 7.5, sq: true, pf: 0.55, m: { x: 80, y: 84, w: 16 }, node: <Block color={BLUE} to={BLUE_2} /> },

  // ══ STUFF ═════════════════════════════════════════════════
  { layer: "under", sec: "stuff", t: 0.5, x: 63, y: 7, w: 21, h: 21, pf: 0.5, m: { x: 56, y: 6, w: 40, h: 16 }, node: <Panel src="stuff-mono.webp" /> },
  { layer: "over", sec: "stuff", t: 0.5, x: 62.2, y: 8.2, w: 21, h: 21, pf: 0.5, m: { x: 54, y: 7, w: 40, h: 16 }, node: <Frame color="rgba(27,29,34,0.38)" /> },
  { layer: "under", sec: "stuff", t: 0.5, x: 63, y: 7, w: 21, h: 21, pf: 0.5, m: null, node: <div style={{ position: "absolute", inset: 0, opacity: 0.42, mixBlendMode: "multiply", overflow: "hidden" }}><Schematic seed={23} w={336} h={210} title="SIGNAL / NOISE — SHEET 5 OF 7" /></div> },
  { layer: "under", sec: "stuff", t: 0.5, x: 85.5, y: 11, w: 5.5, h: 30, pf: 0.52, m: { x: 88, y: 10, w: 7, h: 22 }, node: <Block color={BLUE} to={BLUE_2} /> },
  { layer: "over", sec: "stuff", t: 0.5, x: 81.6, y: 24.8, w: 3.4, sq: true, pf: 0.5, m: null, node: <RingStar /> },
  { layer: "over", sec: "stuff", t: 0.5, x: 63, y: 30, w: 14, pf: 0.5, m: null, node: <Caption lines={["FIG. 04 — STRATUS, MONO", HEX_B]} size={8} /> },
  { layer: "over", sec: "stuff", t: 0.5, x: 85.5, y: 42.5, w: 10, pf: 0.52, m: null, node: <Caption lines={[HEX_A, HEX_C]} size={8} /> },

  { layer: "under", sec: "stuff", t: 0.5, x: 66, y: 78, w: 17, h: 12, pf: 0.55, m: null, node: <AsciiField lines={ASCII_SKY.eddies} opacity={0.38} /> },
  { layer: "over", sec: "stuff", t: 0.5, x: 66, y: 91, w: 17, pf: 0.55, m: null, node: <Caption lines={["SL3-121-2371 — STRATOCUMULUS EDDIES, TYPED"]} size={7.5} /> },

  // ══ EXPERIENCE — long, quiet margins ══════════════════════
  { layer: "under", sec: "experience", t: 0.2, x: 90.5, y: 8, w: 6.5, h: 68, pf: 0.5, m: { x: 86, y: 8, w: 11, h: 50 }, node: <Panel src="exp-contrail.webp" /> },
  { layer: "over", sec: "experience", t: 0.2, x: 89.6, y: 9.4, w: 6.5, h: 68, pf: 0.5, m: { x: 84.5, y: 9, w: 11, h: 50 }, node: <Frame color="rgba(27,29,34,0.38)" /> },
  { layer: "over", sec: "experience", t: 0.2, x: 90.5, y: 77.5, w: 8, pf: 0.5, m: null, node: <Caption lines={["CONTRAIL", HEX_A]} size={7.5} /> },
  { layer: "under", sec: "experience", t: 0.55, x: 2.2, y: 14, w: 5.5, h: 58, pf: 0.5, m: { x: 3, y: 14, w: 10, h: 44 }, node: <Panel src="exp-mono.webp" /> },
  { layer: "under", sec: "experience", t: 0.55, x: 8.4, y: 14, w: 1.1, h: 40, pf: 0.52, m: { x: 14, y: 14, w: 2, h: 30 }, node: <Block color={BLUE} /> },
  { layer: "under", sec: "experience", t: 0.55, x: 96.2, y: 30, w: 4, h: 50, pf: 0.52, m: null, node: <Hex items={[[0, "0x0f", 11], [10, "0x38", 11], [20, "0x72", 11], [30, "0x2f", 11]]} /> },
  { layer: "under", sec: "experience", t: 0.86, x: 2.5, y: 70, w: 26, h: 25, pf: 0.55, m: { x: 4, y: 76, w: 60, h: 20 }, node: <div style={{ position: "absolute", inset: 0, opacity: 0.32 }}><Schematic seed={17} w={416} h={250} title="SIGNAL / NOISE — SHEET 3 OF 4" /></div> },
  { layer: "over", sec: "experience", t: 0.86, x: 27.2, y: 67.4, w: 2.6, sq: true, pf: 0.55, m: null, node: <RingStar /> },

  // ══ CONTACT — the second mass ═════════════════════════════
  { layer: "under", sec: "contact", t: 0.5, x: 63, y: 4, w: 33, h: 40, pf: 0.5, win: [-0.75, 99], m: { x: 40, y: 3, w: 56, h: 22 }, node: <Panel src="contact-cumulus.webp" /> },
  { layer: "over", sec: "contact", t: 0.5, x: 62, y: 2.6, w: 33, h: 40, pf: 0.5, win: [-0.75, 99], m: { x: 38.5, y: 2, w: 56, h: 22 }, node: <Frame color="rgba(27,29,34,0.42)" /> },
  { layer: "over", sec: "contact", t: 0.5, x: 63, y: 4, w: 33, h: 40, pf: 0.5, win: [-0.75, 99], m: { x: 40, y: 3, w: 56, h: 22 }, node: <CropMarks /> },
  { layer: "under", sec: "contact", t: 0.5, x: 0, y: 51, w: 100, h: 2.4, pf: 0.55, win: [-0.75, 99], m: null, node: <Crease /> },
  { layer: "over", sec: "contact", t: 0.5, x: 63, y: 45, w: 20, pf: 0.5, win: [-0.75, 99], m: null, node: <Caption lines={["FIG. 06 — OPEN CHANNEL", `${HEX_A} → ${HEX_B}`]} size={8.5} /> },
  { layer: "over", sec: "contact", t: 0.5, x: 63, y: 0.8, w: 33, h: 1.5, pf: 0.5, win: [-0.75, 99], m: { x: 40, y: 1, w: 56 }, node: <Rules n={2} gap={4} /> },
  { layer: "under", sec: "contact", t: 0.5, x: 3.8, y: 58, w: 1.3, h: 34, pf: 0.52, win: [-0.75, 99], m: { x: 4, y: 70, w: 2.5, h: 20 }, node: <Block color={BLUE} /> },
  { layer: "under", sec: "contact", t: 0.5, x: 6.2, y: 60, w: 8, h: 30, pf: 0.52, win: [-0.75, 99], m: null, node: <Hex items={[[0, HEX_A, 13], [13, HEX_A, 13], [26, HEX_B, 13]]} /> },
  // the eye of a typhoon, typed — the open channel
  { layer: "under", sec: "contact", t: 0.5, x: 17.5, y: 62, w: 16, h: 24, pf: 0.55, win: [-0.75, 99], m: { x: 22, y: 76, w: 50, h: 22 }, node: <AsciiField lines={ASCII_SKY.eye} opacity={0.72} /> },
  { layer: "over", sec: "contact", t: 0.5, x: 17.5, y: 86.5, w: 18, pf: 0.55, win: [-0.75, 99], m: null, node: <Caption lines={["STS-44 — EYE OF THE STORM, TYPED", HEX_B]} size={7.5} /> },
  { layer: "under", sec: "contact", t: 0.5, x: 31.5, y: 58, w: 4.2, sq: true, pf: 0.55, win: [-0.75, 99], m: null, node: <Block color={BLUE} to={BLUE_2} /> },
  { layer: "over", sec: "contact", t: 0.5, x: 32.6, y: 59.8, w: 5.4, sq: true, pf: 0.55, win: [-0.75, 99], m: null, node: <RingStar /> },
];

// ─── Inner pages ────────────────────────────────────────────
//
// Laid out in the page's free column (project and catalogue pages keep their
// content in the left two-thirds; documents are centred), anchored to the top
// ("hero") or to the page's last screen ("contact": see Background's page
// layout). Always present; they drift with the page's gentle parallax.

const PAGE_PANELS = ["hero-cobalt.webp", "work-navy.webp", "contact-cumulus.webp", "stuff-mono.webp", "exp-contrail.webp"];
// wide, short crops above a project page's hero band: skies with texture all over
const CASE_PANELS = ["work-navy.webp", "contact-cumulus.webp", "stuff-mono.webp"];
// below the top bar's breadcrumb
const TOP_Y = 8;
const ALWAYS: [number, number] = [-99, 99];
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** Print items for an inner page, laid into the free space its frame measured. */
export function pageItems(kind: PageKind, seed: number, f: PageFrame): Item[] {
  const panel = PAGE_PANELS[seed % PAGE_PANELS.length];
  const hex = `0x${(seed & 0xffffff).toString(16).padStart(6, "0")}`;
  const sheet = `SHEET ${1 + (seed % 7)} / 7`;
  const dwg = `DWG  WK-${String(2600 + (seed % 97)).padStart(4, "0")}`;
  const top = (it: Omit<Item, "sec" | "t" | "win">): Item => ({ sec: "hero", t: 0, win: ALWAYS, ...it });
  const end = (it: Omit<Item, "sec" | "t" | "win">): Item => ({ sec: "contact", t: 0.5, win: ALWAYS, ...it });
  const titleBlock = (x: number, w: number) =>
    end({ layer: "over", x, y: 84, w, h: 10, pf: 0.6, m: null, node: <TitleBlock rows={[dwg, "SCALE  1 : 1", sheet, "REV  C", "DRN  W.K.  10/26"]} seed={seed % 9} /> });
  // a mounted panel with its offset hairline frame and crop marks (behind the mass)
  const mounted = (x: number, y: number, w: number, h: number, src: string, pf = 0.5, m?: Item["m"]): Item[] => [
    top({ layer: "under", x, y, w, h, pf, m, node: <Panel src={src} /> }),
    top({ layer: "over", x: x - 0.8, y: y + 1.2, w, h, pf, m: m && { ...m, x: (m.x ?? x) - 1.5, y: (m.y ?? y) + 1 }, node: <Frame color="rgba(27,29,34,0.4)" /> }),
    top({ layer: "over", x, y, w, h, pf, m: null, node: <CropMarks off={8} len={12} /> }),
  ];
  // phones: one small panel just under the top bar's breadcrumb row
  const phonePanel = { x: 54, y: 6.5, w: 42, h: 8 };
  const items: Item[] = [];

  if (kind === "document") {
    const lw = f.leftX * 100 - 5, rx = f.colX * 100 + 2, rw = 100 - f.colX * 100 - 4;
    if (lw >= 6) {
      const sw = Math.min(7, lw * 0.5);
      items.push(
        top({ layer: "under", x: 2.5, y: 8, w: sw, h: 36, pf: 0.55, m: null, node: <Panel src="navy-chip.webp" /> }),
        top({ layer: "over", x: 3.2, y: 9.3, w: sw, h: 36, pf: 0.55, m: null, node: <Frame color="rgba(27,29,34,0.4)" /> }),
        top({ layer: "over", x: 2.5, y: 45.4, w: lw, pf: 0.55, m: null, node: <Caption lines={["ALT 3400 M", hex]} size={7.5} /> }),
        top({ layer: "under", x: 2.5, y: 52, w: lw * 0.8, h: 4.5, pf: 0.55, m: null, node: <Block color={BLUE} /> }),
        top({ layer: "under", x: 2.7, y: 60, w: lw, h: 14, pf: 0.55, m: null, node: <HexDump rows={6} seed={seed % 13} /> }),
      );
    }
    if (rw >= 6) {
      items.push(...mounted(rx, TOP_Y, rw, 22, panel, 0.5, phonePanel));
      items.push(end({ layer: "under", x: rx, y: 40, w: rw, h: 22, pf: 0.55, m: null, node: <div style={{ position: "absolute", inset: 0, opacity: 0.4 }}><Schematic seed={seed % 29} w={230} h={220} noTitle /></div> }));
      items.push(end({ layer: "under", x: 100 - 7, y: 66, w: 4.5, h: 14, pf: 0.55, m: null, node: <Block color={BLUE} to={BLUE_2} /> }));
      if (rw >= 12) items.push(titleBlock(100 - 2 - Math.min(14, rw), Math.min(14, rw)));
    }
    return items;
  }

  const cx = f.colX * 100 + 1.5, cw = 100 - f.colX * 100 - 3;

  if (kind === "case") {
    // above the hero band, between the title and the right edge, behind the mass
    const px = clamp(f.titleX * 100 + 10, 66, 78), ph = f.bandY * 100 - TOP_Y - 3;
    if (ph >= 8) items.push(...mounted(px, TOP_Y, Math.min(20, 96 - px), ph, CASE_PANELS[seed % CASE_PANELS.length], 0.5, phonePanel));
    // the column beside the text card, under the band
    if (cw >= 10) {
      const y0 = clamp(f.bandY * 100 + 52, 60, 90);
      items.push(
        top({ layer: "under", x: cx, y: y0, w: Math.min(cw, 22), h: 18, pf: 0.58, m: null, node: <div style={{ position: "absolute", inset: 0, opacity: 0.38 }}><Schematic seed={seed % 31} w={320} h={200} noTitle /></div> }),
        top({ layer: "over", x: cx, y: y0 + 19.5, w: Math.min(cw, 18), pf: 0.58, m: null, node: <Caption lines={[`FIG. ${String(1 + (seed % 9)).padStart(2, "0")} — ${hex}`, "SPECULAR · ENV 2048"]} size={8} /> }),
        top({ layer: "under", x: 100 - 6, y: y0 - 6, w: 4, h: 22, pf: 0.58, m: null, node: <Block color={BLUE} to={BLUE_2} /> }),
        top({ layer: "over", x: 100 - 8.4, y: y0 - 8.4, w: 3.4, sq: true, pf: 0.58, m: null, node: <RingStar /> }),
        end({ layer: "under", x: cx, y: 44, w: Math.min(cw, 16), h: 13, pf: 0.6, m: null, node: <AsciiField lines={seed % 2 ? ASCII_SKY.eddies : ASCII_SKY.cumulus} opacity={0.36} /> }),
      );
      if (cw >= 15) items.push(titleBlock(100 - 16, 14));
    }
    return items;
  }

  // catalogue: the free column beside the grid
  if (cw < 13) {
    // a narrow column: one tall strip and a blue band, nothing with text in it
    items.push(...mounted(cx, TOP_Y, Math.max(4, cw), 30, panel, 0.5, phonePanel));
    items.push(top({ layer: "under", x: cx, y: 42, w: Math.max(2, Math.min(4, cw)), h: 26, pf: 0.55, m: null, node: <Block color={BLUE} to={BLUE_2} /> }));
    items.push(end({ layer: "under", x: cx, y: 10, w: Math.max(4, cw), h: 30, pf: 0.58, m: null, node: <Panel src="exp-contrail.webp" /> }));
    return items;
  }
  const pw = Math.min(cw, 26);
  items.push(...mounted(cx, TOP_Y, pw, 26, panel, 0.5, phonePanel));
  items.push(
    top({ layer: "over", x: cx, y: 34, w: Math.min(cw, 18), pf: 0.5, m: null, node: <Caption lines={[`FIG. ${String(1 + (seed % 9)).padStart(2, "0")} — ${hex}`, "SPECULAR · ENV 2048"]} size={8} /> }),
    top({ layer: "under", x: 100 - 6, y: 40, w: 4, h: 26, pf: 0.55, m: null, node: <Block color={BLUE} to={BLUE_2} /> }),
    top({ layer: "over", x: 100 - 8.4, y: 37.6, w: 3.4, sq: true, pf: 0.55, m: null, node: <RingStar /> }),
    top({ layer: "under", x: cx, y: 48, w: Math.min(cw - 7, 22), h: 18, pf: 0.58, m: null, node: <div style={{ position: "absolute", inset: 0, opacity: 0.38 }}><Schematic seed={seed % 31} w={320} h={200} noTitle /></div> }),
    top({ layer: "under", x: cx, y: 70, w: Math.min(cw, 12), h: 12, pf: 0.6, m: null, node: <Hex items={[[0, HEX_A, 11], [8, hex, 11], [16, HEX_C, 11]]} /> }),
    end({ layer: "under", x: cx + 2, y: 8, w: 8, h: 30, pf: 0.58, m: null, node: <Panel src="exp-contrail.webp" /> }),
    end({ layer: "over", x: cx + 2.8, y: 9.2, w: 8, h: 30, pf: 0.58, m: null, node: <Frame color="rgba(27,29,34,0.36)" /> }),
    end({ layer: "under", x: cx, y: 46, w: Math.min(cw, 16), h: 13, pf: 0.6, m: null, node: <AsciiField lines={seed % 2 ? ASCII_SKY.eddies : ASCII_SKY.cumulus} opacity={0.36} /> }),
  );
  if (cw >= 15) items.push(titleBlock(100 - 16, 14));
  return items;
}

// ─── Component ──────────────────────────────────────────────

const FADE = 0.35;
const sm = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

/** A text block (document coordinates, css px) no print graphic may sit under. */
export interface KeepOut { x: number; y: number; w: number; h: number }

export interface PrintHandle {
  setLayout: (layout: PageLayout, camScroll: (s: number) => number, keepOut?: KeepOut[]) => void;
  update: (scrollVH: number, dive: number, diveAt: [number, number]) => void;
}

/** Item geometry for the current viewport class (narrow = portrait phones). */
export type ViewClass = "narrow" | "compact" | "full";

/** Sky panels and hairline frames may pass under type; nothing else may. */
function isSoft(it: Item): boolean {
  return it.node != null && typeof it.node === "object" && "type" in it.node && (it.node.type === Panel || it.node.type === Frame || it.node.type === Crease || it.node.type === CropMarks);
}

type Geo = { x: number; y: number; w: number; h?: number };

function geo(it: Item, vc: ViewClass): Geo | null {
  if (vc === "compact" && it.compactHide) return null;
  if (vc !== "narrow" || it.m === undefined) return { x: it.x, y: it.y, w: it.w, h: it.h };
  if (it.m === null) return null;
  return { x: it.m.x ?? it.x, y: it.m.y ?? it.y, w: it.m.w ?? it.w, h: it.m.h ?? it.h };
}

const PrintLayersImpl = forwardRef<PrintHandle, { vclass: ViewClass; items?: Item[] }>(function PrintLayers({ vclass, items: itemsProp }, ref) {
  // fixed for the life of the component (a page passes its own list once)
  const ITEMS = useMemo(() => itemsProp ?? HOME_ITEMS, []); // eslint-disable-line react-hooks/exhaustive-deps
  const under = useRef<HTMLDivElement>(null);
  const over = useRef<HTMLDivElement>(null);
  const els = useRef<(HTMLDivElement | null)[]>([]);
  // each item's fade window (scroll − home, vh)
  const wins = useMemo(() => ITEMS.map((it) => it.win ?? (it.sec === "hero" ? [-99, 0.42] : [-0.75, 0.55])), [ITEMS]);
  const state = useRef<{
    home: Float64Array; homeS: Float64Array; camScroll: (s: number) => number; hidden: Uint8Array; op: Float32Array; vc: ViewClass; blocked: Uint8Array;
    /** item geometry for the current view class */
    geo: (Geo | null)[];
    /** last values written to the DOM (skip unchanged writes) */
    tf: string[]; layer: [string, string, string];
  }>({
    home: new Float64Array(ITEMS.length), homeS: new Float64Array(ITEMS.length), camScroll: (s) => s,
    hidden: new Uint8Array(ITEMS.length), op: new Float32Array(ITEMS.length).fill(-1), vc: vclass,
    blocked: new Uint8Array(ITEMS.length), geo: ITEMS.map((it) => geo(it, vclass)),
    tf: ITEMS.map(() => ""), layer: ["", "", ""],
  });
  useEffect(() => {
    const st = state.current;
    st.vc = vclass;
    st.geo = ITEMS.map((it) => geo(it, vclass));
    st.op.fill(-1);
    st.hidden.fill(0);
    st.tf.fill("");
  }, [vclass, ITEMS]);

  useImperativeHandle(ref, () => ({
    setLayout(layout, camScroll, keepOut = []) {
      const st = state.current;
      st.camScroll = camScroll;
      const vw = window.innerWidth, vh = window.innerHeight, M = 14;
      ITEMS.forEach((it, i) => {
        st.homeS[i] = homeScroll(layout, it.sec, it.t);
        st.home[i] = camScroll(st.homeS[i]);
        // Any graphic that would land on a text block at its home position is
        // dropped for this viewport (panels and hairline frames may pass under
        // type — "clouds behind the name" — stars, blocks, hex and captions may not).
        st.blocked[i] = 0;
        const gm = st.geo[i];
        if (!gm || isSoft(it)) return;
        const x0 = (gm.x / 100) * vw, y0 = (gm.y / 100) * vh + st.homeS[i] * vh;
        const x1 = x0 + (gm.w / 100) * vw;
        const y1 = y0 + (it.sq ? (gm.w / 100) * vw : gm.h != null ? (gm.h / 100) * vh : 24);
        for (const k of keepOut) {
          if (x1 > k.x - M && x0 < k.x + k.w + M && y1 > k.y - M && y0 < k.y + k.h + M) { st.blocked[i] = 1; break; }
        }
      });
      st.hidden.fill(0);
      st.op.fill(-1);
      st.tf.fill("");
    },
    update(s, dive, diveAt) {
      const st = state.current;
      const g = st.camScroll(s);
      const vh = window.innerHeight;
      for (let i = 0; i < ITEMS.length; i++) {
        const el = els.current[i];
        if (!el) continue;
        const it = ITEMS[i];
        const gm = st.geo[i];
        if (!gm) continue;
        const dy = -(g - st.home[i]) * it.pf; // in vh
        const top = gm.y + dy * 100;
        const hgt = it.sq ? (gm.w * window.innerWidth) / vh : gm.h ?? 10;
        const w0 = wins[i][0], w1 = wins[i][1];
        const rel = s - st.homeS[i];
        const vis = Math.min(sm((rel - w0) / FADE), 1 - sm((rel - w1) / FADE));
        const off = st.blocked[i] === 1 || vis <= 0.001 || top > 140 || top + hgt < -40;
        if (off) {
          if (st.hidden[i] !== 1) { el.style.visibility = "hidden"; st.hidden[i] = 1; }
          continue;
        }
        if (st.hidden[i] !== 2) { el.style.visibility = "visible"; st.hidden[i] = 2; }
        const tf = `translate3d(0, ${(dy * vh).toFixed(1)}px, 0)`;
        if (tf !== st.tf[i]) { el.style.transform = tf; st.tf[i] = tf; }
        const o = Math.round(vis * 100) / 100;
        if (o !== st.op[i]) { el.style.opacity = String(o); st.op[i] = o; }
      }
      // the Dive: the print layer is carried past the camera, then burns off
      // (same pacing as the 3D pieces, which fade over 0.04–0.28: engine.ts)
      const e = Math.pow(Math.min(1, Math.max(0, dive / 0.5)), 1.4);
      const tf = e > 0 ? `scale(${(1 + e * 1.3).toFixed(4)})` : "";
      const op = (1 - Math.min(1, Math.max(0, (dive - 0.04) / 0.24))).toFixed(3);
      const origin = `${(diveAt[0] * 100).toFixed(1)}% ${(diveAt[1] * 100).toFixed(1)}%`;
      const last = st.layer;
      if (origin === last[0] && tf === last[1] && op === last[2]) return;
      last[0] = origin; last[1] = tf; last[2] = op;
      for (const c of [under.current, over.current]) {
        if (!c) continue;
        c.style.transformOrigin = origin;
        c.style.transform = tf;
        c.style.opacity = op;
      }
    },
  }), [ITEMS, wins]);

  const render = (layer: Layer) =>
    ITEMS.map((it, i) => {
      if (it.layer !== layer) return null;
      const gm = geo(it, vclass);
      if (!gm) return null;
      return (
        <div
          key={i}
          ref={(el) => { els.current[i] = el; }}
          style={{
            position: "absolute",
            left: `${gm.x}vw`,
            top: `${gm.y}vh`,
            width: `${gm.w}vw`,
            height: it.sq ? `${gm.w}vw` : gm.h != null ? `${gm.h}vh` : undefined,
            willChange: "transform",
            ...it.style,
          }}
        >
          {it.node}
        </div>
      );
    });

  // (memo'd component: this only re-renders when the view class flips)
  const underNodes = render("under");
  const overNodes = render("over");

  return (
    <>
      {/* paper ground: never moves */}
      <div className="fixed inset-0" style={{ zIndex: 0, background: PAPER }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: GRAIN, backgroundSize: "256px 256px", mixBlendMode: "multiply", opacity: 0.85 }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(90deg, rgba(20,24,40,0.018) 0 1px, transparent 1px 3px)", opacity: 0.8 }} />
      </div>
      <div ref={under} className="fixed inset-0 overflow-hidden" style={{ zIndex: 1 }}>{underNodes}</div>
      <div ref={over} className="fixed inset-0 overflow-hidden" style={{ zIndex: 3 }}>{overNodes}</div>
    </>
  );
});

export const PrintLayers = memo(PrintLayersImpl);
