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
import type { SectionId } from "./pieces";
import { AsciiField, CropMarks, Crease, RingStar, Schematic, TitleBlock } from "./print";
import { lyricsPool } from "@/content/lyrics";
import { ASCII_SKY } from "./asciiSky";
import { withBase } from "@/lib/basePath";

const BLUE = "#7d9fdb";
const BLUE_2 = "#8eacdf";
const PAPER = "#f2f1ec";
const INK = "#1b1d22";
const P = withBase("/assets/background/panels/");
const GRAIN = `url(${withBase("/assets/background/paper-grain.png")})`;

type Layer = "under" | "over";

interface Item {
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

const ITEMS: Item[] = [
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

function geo(it: Item, vc: ViewClass): { x: number; y: number; w: number; h?: number } | null {
  if (vc === "compact" && it.compactHide) return null;
  if (vc !== "narrow" || it.m === undefined) return { x: it.x, y: it.y, w: it.w, h: it.h };
  if (it.m === null) return null;
  return { x: it.m.x ?? it.x, y: it.m.y ?? it.y, w: it.m.w ?? it.w, h: it.m.h ?? it.h };
}

const PrintLayersImpl = forwardRef<PrintHandle, { vclass: ViewClass }>(function PrintLayers({ vclass }, ref) {
  const under = useRef<HTMLDivElement>(null);
  const over = useRef<HTMLDivElement>(null);
  const els = useRef<(HTMLDivElement | null)[]>([]);
  const state = useRef<{ home: Float64Array; homeS: Float64Array; camScroll: (s: number) => number; hidden: Uint8Array; op: Float32Array; vc: ViewClass; blocked: Uint8Array }>({
    home: new Float64Array(ITEMS.length), homeS: new Float64Array(ITEMS.length), camScroll: (s) => s,
    hidden: new Uint8Array(ITEMS.length), op: new Float32Array(ITEMS.length).fill(-1), vc: vclass,
    blocked: new Uint8Array(ITEMS.length),
  });
  useEffect(() => { state.current.vc = vclass; state.current.op.fill(-1); state.current.hidden.fill(0); }, [vclass]);

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
        const gm = geo(it, st.vc);
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
    },
    update(s, dive, diveAt) {
      const st = state.current;
      const g = st.camScroll(s);
      const vh = window.innerHeight;
      for (let i = 0; i < ITEMS.length; i++) {
        const el = els.current[i];
        if (!el) continue;
        const it = ITEMS[i];
        const gm = geo(it, st.vc);
        if (!gm) continue;
        const dy = -(g - st.home[i]) * it.pf; // in vh
        const top = gm.y + dy * 100;
        const hgt = it.sq ? (gm.w * window.innerWidth) / vh : gm.h ?? 10;
        const [w0, w1] = it.win ?? (it.sec === "hero" ? [-99, 0.42] : [-0.75, 0.55]);
        const rel = s - st.homeS[i];
        const vis = Math.min(sm((rel - w0) / FADE), 1 - sm((rel - w1) / FADE));
        const off = st.blocked[i] === 1 || vis <= 0.001 || top > 140 || top + hgt < -40;
        if (off) {
          if (st.hidden[i] !== 1) { el.style.visibility = "hidden"; st.hidden[i] = 1; }
          continue;
        }
        if (st.hidden[i] !== 2) { el.style.visibility = "visible"; st.hidden[i] = 2; }
        el.style.transform = `translate3d(0, ${(dy * vh).toFixed(1)}px, 0)`;
        const o = Math.round(vis * 100) / 100;
        if (o !== st.op[i]) { el.style.opacity = String(o); st.op[i] = o; }
      }
      // the Dive: the print layer is carried past the camera, then burns off
      const e = Math.pow(Math.min(1, Math.max(0, dive / 0.42)), 1.4);
      const tf = e > 0 ? `scale(${(1 + e * 1.3).toFixed(4)})` : "";
      const op = (1 - Math.min(1, Math.max(0, (dive - 0.06) / 0.26))).toFixed(3);
      for (const c of [under.current, over.current]) {
        if (!c) continue;
        c.style.transformOrigin = `${(diveAt[0] * 100).toFixed(1)}% ${(diveAt[1] * 100).toFixed(1)}%`;
        c.style.transform = tf;
        c.style.opacity = op;
      }
    },
  }), []);

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
