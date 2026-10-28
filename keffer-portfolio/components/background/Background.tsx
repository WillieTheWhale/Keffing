"use client";

// Background — ALLOY: one world. v2's liquid chrome and glass lead; v1's
// drawn porcelain lives inside the same three.js scene with true depth.
//
// Layers (all below the content at z:20):
//   z:0  paper ground + grain + scan striation + the "under" print layout
//        (sky panels, schematic overprint, blue blocks, title block, crop
//        marks, fold crease) — layout2d.tsx
//   z:2  the WebGL world: chrome, glass, porcelain, shard nucleus, graphite,
//        and in the Dive the liquid mirror that becomes the end-card sky
//   z:3  the "over" print layout (ring stars, hairline frames, rule stacks)
// One rAF loop drives both: GL frame + DOM transforms. Desktop/wide run the
// loop continuously with bloom (paused when hidden). Tablet/mobile run the
// lite path (lower tessellation, no bloom) with a slow living rotation at
// ~30 fps; reduced motion renders a still, on demand only.
//
// Touch devices scroll on the compositor, ahead of (and on ProMotion phones
// twice as often as) the main thread. There the print layout moves as
// scroll-driven keyframes (layout2d.tsx), and the canvas is carried between
// its frames: it renders a margin above and below the viewport, and the
// compositor slides it at the 3D groups' own screen speed (CARRY) by however
// far the scroll has moved since the frame was drawn, which each new frame
// takes back. Scroll positions there are in the large viewport height
// (lib/scrollTimeline.ts), which the browser's toolbars don't change.

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { scrollVelocityRef } from "@/lib/scroll";
import { AlloyEngine, camBends, makeCamScroll, type Mask, type PageLayout, type PageScene } from "./engine";
import { alloyBus } from "./bus";
import { PAGE_PARALLAX, type PageFrame, type PageKind, type SectionId } from "./pieces";
import { hashSlug } from "@/lib/generative";
import { PrintLayers, pageItems, type KeepOut, type PrintHandle, type ViewClass } from "./layout2d";
import { compositorScroll, cssNum, scrollKeyframes, scrollTag, styleSheet, viewportHeight } from "@/lib/scrollTimeline";

const SECTION_IDS: SectionId[] = ["hero", "about", "work", "stuff", "experience", "contact", "dive"];

/** Screen speed of the 3D groups per unit of camera scroll: 6 / depth, and
 *  they sit at depth 10–12 (pieces.ts). The compositor carries the canvas at this. */
const CARRY = 6 / 11;
/** Canvas overscan for that carry, css px (rounded to whole drawing-buffer pixels). */
const PAD = 48;

function measure(page: boolean): PageLayout {
  const vh = viewportHeight();
  if (page) {
    // inner pages: "hero" is the top of the page, "contact" its last screen
    // (page groups and print items anchor to one or the other)
    const docVH = document.documentElement.scrollHeight / vh;
    return { sections: { hero: [0, docVH], contact: [Math.max(0, docVH - 1), 1] }, maxScrollVH: Math.max(0, docVH - 1) };
  }
  const sections: PageLayout["sections"] = {};
  for (const id of SECTION_IDS) {
    const el = document.getElementById(id);
    if (el) sections[id] = [el.offsetTop / vh, el.offsetHeight / vh];
  }
  return { sections, maxScrollVH: (document.documentElement.scrollHeight - vh) / vh };
}

// Inner pages: where the content leaves room (see PageFrame), from the rendered
// page at scroll 0. Rounded to 2 % so tiny reflows don't rebuild the scene.
function measureFrame(): PageFrame {
  const vw = Math.max(1, window.innerWidth), vh = viewportHeight(), sy = window.scrollY;
  const q = (x: number) => Math.round(x * 50) / 50;
  const textRect = (el: Element) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
  let L = vw, R = 0, titleX = 0, bandY = 1;
  for (const el of document.querySelectorAll<HTMLElement>("main h1, main h2, main p, main img, main canvas, main .content-panel, main li, main table")) {
    const cs = getComputedStyle(el);
    if (cs.position === "fixed" || cs.visibility === "hidden") continue;
    const box = el.getBoundingClientRect();
    if (box.width < 2 || box.height < 2 || box.top + sy < 70) continue; // the top bar (index link, breadcrumb)
    // headings and paragraphs: their text, not their (often full-width) block
    const r = el.tagName === "H1" || el.tagName === "H2" || el.tagName === "P" ? textRect(el) : box;
    if (el.tagName === "IMG" && box.width > vw * 0.5) {
      // a wide media band (project pages): its frame, not the scaled image
      const band = el.parentElement?.getBoundingClientRect() ?? box;
      bandY = Math.min(bandY, (band.top + sy) / vh);
      continue;
    }
    if (el.tagName === "H1") titleX = Math.max(titleX, r.right / vw);
    L = Math.min(L, r.left);
    R = Math.max(R, r.right);
  }
  return { colX: q(Math.min(0.97, R / vw + 0.01)), leftX: q(Math.max(0, L / vw - 0.01)), titleX: q(titleX), bandY: q(bandY) };
}

interface BackgroundProps {
  /** Inner pages: the page's kind and slug (its seed). Omitted on the home page. */
  pageKind?: PageKind;
  pageSlug?: string;
}

const Background = memo(function Background({ pageKind, pageSlug = "" }: BackgroundProps) {
  const pageSeed = useMemo(() => (pageKind ? hashSlug(`${pageKind}/${pageSlug}`) : 0), [pageKind, pageSlug]);
  // inner pages wait for their frame: the scene is laid into the measured free space
  const [frame, setFrame] = useState<PageFrame | null>(null);
  const frameKey = frame ? `${frame.colX}/${frame.leftX}/${frame.titleX}/${frame.bandY}` : "";
  useEffect(() => {
    if (!pageKind) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const take = () => {
      const f = measureFrame();
      setFrame((old) => (old && old.colX === f.colX && old.leftX === f.leftX && old.titleX === f.titleX && old.bandY === f.bandY ? old : f));
    };
    const later = () => { if (t) clearTimeout(t); t = setTimeout(take, 250); };
    take();
    // fonts and images settle the layout after mount
    const settle = [300, 1200].map((ms) => setTimeout(take, ms));
    document.fonts?.ready.then(take);
    window.addEventListener("resize", later);
    return () => {
      settle.forEach(clearTimeout);
      if (t) clearTimeout(t);
      window.removeEventListener("resize", later);
    };
  }, [pageKind]);
  const pagePrint = useMemo(() => (pageKind && frame ? pageItems(pageKind, pageSeed, frame) : undefined), [pageKind, pageSeed, frame]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const carryRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const deviceTier = useStore((s) => s.deviceTier);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const print = useRef<PrintHandle>(null);
  // portrait phones get their own print layout (layout2d `m` overrides)
  const viewClass = (): ViewClass => {
    if (typeof window === "undefined") return "full";
    if (window.innerWidth / Math.max(1, window.innerHeight) < 0.8) return "narrow";
    return window.innerWidth < 1200 ? "compact" : "full";
  };
  const [vclass, setVclass] = useState<ViewClass>(viewClass);
  useEffect(() => {
    const upd = () => setVclass(viewClass());
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || (pageKind && !frame)) return;
    const full = (deviceTier === "desktop" || deviceTier === "wide") && !reducedMotion;
    // phones / tablets: the lite build, but alive — a slow rotation at ~30 fps
    const living = !reducedMotion;
    // touch: the compositor carries the canvas and the print layout
    const cmp = living && compositorScroll();
    const carryEl = carryRef.current;
    let engine: AlloyEngine | null = null;
    // set in cleanup: a disposed engine's late texture callback (onReady) must
    // not restart this effect's loop. StrictMode and device-tier changes re-run
    // the effect, and a stray loop with no engine kept writing glFinale = false.
    let disposed = false;
    try {
      const scene: PageScene | null = pageKind && frame ? { spec: { kind: pageKind, seed: pageSeed, frame }, parallax: PAGE_PARALLAX[pageKind] } : null;
      engine = new AlloyEngine(canvas, full ? "full" : "lite", scene);
    } catch {
      engine = null; // no WebGL: the print layer alone still composes the page
    }
    canvas.style.display = engine ? "block" : "none";
    if (!engine) alloyBus.sceneReady = true;
    const camSheet = cmp && engine ? styleSheet() : null;
    let camName = "";
    if (camSheet && carryEl) {
      canvas.style.position = "relative";
      carryEl.style.willChange = "transform";
    }

    const camFor = (l: PageLayout) => (pageKind ? (s: number) => s * PAGE_PARALLAX[pageKind] : makeCamScroll(l));
    let layout = measure(!!pageKind);
    // tight union of the name's letters, in document coordinates
    let nameBox: DOMRect | null = null;
    const measureName = () => {
      const letters = document.querySelectorAll<HTMLElement>("#hero h1 [data-shear]");
      if (!letters.length || window.scrollY > 50) return;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      letters.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 1) return;
        x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
      });
      if (x1 > x0) nameBox = new DOMRect(x0, y0 + window.scrollY, x1 - x0, y1 - y0);
    };
    // section headings: tight text width (Range), stable line box (the
    // overflow-hidden wrapper — the h2 itself is mid mask-wipe until in view)
    let heads: DOMRect[] = [];
    let chipBox: DOMRect | null = null; // the fixed INDEX chip, top right
    const measureHeads = () => {
      const chip = document.querySelector<HTMLElement>(".index-chip");
      chipBox = chip ? chip.getBoundingClientRect() : null;
      const sy = window.scrollY;
      heads = [];
      // inner pages: their titles are h1s, and the top bar's breadcrumb sits over the top-right corner
      document.querySelectorAll<HTMLElement>(pageKind ? "main h1, main h2, main .mark-caption" : "main h2").forEach((h) => {
        if (h.closest("#dive")) return;
        const wrap = h.parentElement ?? h;
        const pr = wrap.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(h);
        const rr = range.getBoundingClientRect();
        if (rr.width < 1) return;
        heads.push(new DOMRect(rr.left, pr.top + sy, rr.width, pr.height));
      });
    };
    let camScroll = camFor(layout);
    const t0 = performance.now();
    let raf = 0;
    let lastScroll = -1;
    let lastDive = 0;
    let still = 0;
    let frameNo = 0;
    let dirty = true;
    // reused every frame: the masks handed to the engine, the dive origin
    const masks: Mask[] = [0, 1, 2, 3].map(() => ({ x: 0, y: 0, w: 0, h: 0, amt: 0 }));
    const diveAt: [number, number] = [0.66, 0.31];

    // DPR cap 2 (lite 1.5), and a pixel budget so 4K-class windows don't
    // quadruple the fill cost: ~8 MP drawing buffer at most
    const dpr = () => {
      const cap = Math.min(window.devicePixelRatio || 1, full ? 2 : 1.5);
      const budget = Math.sqrt(8.2e6 / Math.max(1, window.innerWidth * window.innerHeight));
      return Math.max(1, Math.min(cap, budget));
    };
    // text blocks the print layer must keep clear of (document coordinates)
    const measureKeepOut = (): KeepOut[] => {
      const out: KeepOut[] = [];
      const sy = window.scrollY;
      const push = (r: DOMRect) => { if (r.width > 0 && r.height > 0) out.push({ x: r.left, y: r.top + sy, w: r.width, h: r.height }); };
      if (nameBox) out.push({ x: nameBox.x, y: nameBox.y, w: nameBox.width, h: nameBox.height });
      document.querySelectorAll<HTMLElement>("#hero .hero-tagline, #hero .hero-caption").forEach((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        push(range.getBoundingClientRect());
      });
      for (const h of heads) out.push({ x: h.x, y: h.y, w: h.width, h: h.height });
      // inner pages: text panels and cards (print graphics stay out from under them)
      if (pageKind) document.querySelectorAll<HTMLElement>("main .content-panel, main article, main img").forEach((el) => push(el.getBoundingClientRect()));
      return out;
    };
    const doResize = () => {
      layout = measure(!!pageKind);
      measureName();
      measureHeads();
      camScroll = camFor(layout);
      const vh = viewportHeight(), k = dpr();
      const pad = camSheet ? Math.round(PAD * k) / k : 0;
      engine?.resize(window.innerWidth, vh, k, pad);
      engine?.setLayout(layout);
      const bends = pageKind ? [] : camBends(layout);
      if (camSheet) {
        // the canvas: −pad, 2·pad taller, and its carry as keyframes of the camera curve
        canvas.style.top = `${-pad}px`;
        canvas.style.height = `calc(100vh + ${2 * pad}px)`;
        const range = Math.ceil((layout.maxScrollVH + 1.5) * vh);
        camName = scrollTag("carry");
        camSheet.set(
          scrollKeyframes(camName, { breaks: bends, f: (s) => -CARRY * camScroll(s) * vh, css: (v) => `transform:translate3d(0,${cssNum(v)}px,0)` }, vh, range) +
          `[data-carry="${camName}"]{animation:${camName} linear both;animation-timeline:scroll(root block);animation-range:0px ${range}px}`,
        );
        if (carrying) canvas.setAttribute("data-carry", camName);
      }
      print.current?.setLayout(layout, camScroll, measureKeepOut(), cmp ? { bends } : null);
      dirty = true;
      kick();
    };

    // The carry: while the page moves, the canvas sits CARRY × (camera scroll
    // at this frame) lower than its place, and the compositor's keyframes
    // lift it by CARRY × (camera scroll now), so between frames it follows
    // the scroll. Off at rest, so a settled frame is never resampled.
    let carrying = false;
    let quiet = 0;
    const carry = (moving: boolean, s: number) => {
      if (!camSheet || !carryEl) return;
      quiet = moving ? 0 : quiet + 1;
      if (quiet < 8) {
        carryEl.style.transform = `translate3d(0,${CARRY * camScroll(s) * viewportHeight()}px,0)`;
        if (!carrying) { canvas.setAttribute("data-carry", camName); carrying = true; }
      } else if (carrying) {
        carryEl.style.transform = "";
        canvas.removeAttribute("data-carry");
        carrying = false;
      }
    };

    const tick = () => {
      raf = 0;
      if (disposed) return;
      const sy = window.scrollY;
      const vh = viewportHeight();
      const s = sy / vh;
      // the finale timeline (spring-smoothed by Dive.tsx; none without a Dive)
      const dive = reducedMotion ? 0 : alloyBus.diveLive ? alloyBus.dive : 0;
      const time = living ? (performance.now() - t0) / 1000 : 0;
      // at rest the motion is slow drift: render every other frame (halves
      // idle GPU); the lite path always runs at half rate
      const moving = s !== lastScroll || dirty || dive !== lastDive;
      still = moving ? 0 : still + 1;
      frameNo++;
      const skip = living && (full ? still > 30 : !moving) && (frameNo & 1) === 1;
      lastDive = dive;
      alloyBus.glFinale = !!engine && engine.ready && engine.skyReady && !reducedMotion;
      if (engine && !skip) {
        let n = 0;
        const mask = (x: number, y: number, w: number, h: number, amt: number) => {
          const m = masks[n++];
          m.x = x; m.y = y; m.w = w; m.h = h; m.amt = amt;
        };
        if (chipBox) mask(chipBox.left, chipBox.top, chipBox.width, chipBox.height, 0.6);
        if (nameBox && s < 1.2) mask(nameBox.x, nameBox.y - sy, nameBox.width, nameBox.height, 0.72 * (1 - Math.min(1, s / 0.8)));
        for (const hb of heads) {
          if (n >= 4) break;
          const top = hb.y - sy;
          if (top > vh + 80 || top + hb.height < -80) continue;
          mask(hb.x, top, hb.width, hb.height, 0.72);
        }
        engine.frame({ scrollVH: s, time, dive, velocity: full ? scrollVelocityRef.current : 0, masks, maskCount: n });
        if (engine.ready) carry(moving, s);
      }
      // also while the finale timeline is still moving after the scroll stops
      if (moving) {
        print.current?.update(s, dive, engine ? engine.diveScreen(diveAt) : diveAt);
      }
      lastScroll = s;
      dirty = false;
      if (living && !document.hidden) raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf && !disposed) raf = requestAnimationFrame(tick);
    };

    if (engine) engine.onReady = () => {
      dirty = true;
      kick();
      // first light: ease the chrome in instead of popping it over the paper
      if (wrapRef.current) wrapRef.current.style.opacity = "1";
      alloyBus.sceneReady = true;
    };
    doResize();

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(doResize, 150);
    };
    // a window resize that leaves the width and the (large) viewport height
    // alone is a toolbar sliding in or out: nothing to measure or reallocate
    let winSize = `${window.innerWidth}x${viewportHeight()}`;
    const onWinResize = () => {
      const now = `${window.innerWidth}x${viewportHeight()}`;
      if (now === winSize) return;
      winSize = now;
      onResize();
    };
    const onScroll = () => { if (!living) kick(); };
    const onVis = () => { if (!document.hidden) kick(); };
    window.addEventListener("resize", onWinResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    // section heights settle after fonts / images — re-measure a few times
    const settle = [400, 1200, 2600, 5000].map((ms) => setTimeout(doResize, ms));
    const ro = new ResizeObserver(() => onResize());
    ro.observe(document.body);

    return () => {
      disposed = true;
      if (engine) engine.onReady = null;
      window.removeEventListener("resize", onWinResize);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVis);
      settle.forEach(clearTimeout);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      alloyBus.glFinale = false;
      if (camSheet) {
        camSheet.remove();
        canvas.removeAttribute("data-carry");
        canvas.style.position = canvas.style.top = "";
        canvas.style.height = "100vh";
        if (carryEl) carryEl.style.transform = carryEl.style.willChange = "";
      }
      engine?.dispose();
      engine = null;
    };
  }, [deviceTier, reducedMotion, print, vclass, pageKind, pageSeed, frame]);

  return (
    <div ref={rootRef} aria-hidden="true" className="pointer-events-none">
      {(!pageKind || pagePrint) && <PrintLayers key={frameKey} ref={print} vclass={vclass} items={pagePrint} />}
      <div ref={wrapRef} className="fixed inset-0" style={{ zIndex: 2, opacity: 0, transition: "opacity 1400ms cubic-bezier(0.16, 1, 0.3, 1)" }}>
        <div ref={carryRef}>
          <canvas ref={canvasRef} style={{ width: "100vw", height: "100vh", display: "block" }} />
        </div>
      </div>
    </div>
  );
});

export default Background;
