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

import { memo, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { diveRef, scrollVelocityRef } from "@/lib/scroll";
import { AlloyEngine, makeCamScroll, type PageLayout } from "./engine";
import { alloyBus } from "./bus";
import type { SectionId } from "./pieces";
import { PrintLayers, type KeepOut, type PrintHandle, type ViewClass } from "./layout2d";

const SECTION_IDS: SectionId[] = ["hero", "about", "work", "stuff", "experience", "contact", "dive"];

function measure(): PageLayout {
  const vh = Math.max(1, window.innerHeight);
  const sections: PageLayout["sections"] = {};
  for (const id of SECTION_IDS) {
    const el = document.getElementById(id);
    if (el) sections[id] = [el.offsetTop / vh, el.offsetHeight / vh];
  }
  return { sections, maxScrollVH: (document.documentElement.scrollHeight - vh) / vh };
}

const Background = memo(function Background() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    if (!canvas) return;
    const full = (deviceTier === "desktop" || deviceTier === "wide") && !reducedMotion;
    // phones / tablets: the lite build, but alive — a slow rotation at ~30 fps
    const living = !reducedMotion;
    let engine: AlloyEngine | null = null;
    try {
      engine = new AlloyEngine(canvas, full ? "full" : "lite");
    } catch {
      engine = null; // no WebGL: the print layer alone still composes the page
    }
    canvas.style.display = engine ? "block" : "none";

    let layout = measure();
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
      document.querySelectorAll<HTMLElement>("main h2").forEach((h) => {
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
    let camScroll = makeCamScroll(layout);
    const t0 = performance.now();
    let raf = 0;
    let lastScroll = -1;
    let lastDive = 0;
    let still = 0;
    let frameNo = 0;
    let dirty = true;

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
      return out;
    };
    const doResize = () => {
      layout = measure();
      measureName();
      measureHeads();
      camScroll = makeCamScroll(layout);
      engine?.resize(window.innerWidth, window.innerHeight, dpr());
      engine?.setLayout(layout);
      print.current?.setLayout(layout, camScroll, measureKeepOut());
      dirty = true;
      kick();
    };

    const tick = () => {
      raf = 0;
      const sy = window.scrollY;
      const vh = Math.max(1, window.innerHeight);
      const s = sy / vh;
      const dive = reducedMotion ? 0 : diveRef.current;
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
        const masks: { rect: DOMRect; amt: number }[] = [];
        if (chipBox) masks.push({ rect: chipBox, amt: 0.6 });
        if (nameBox && s < 1.2) masks.push({ rect: new DOMRect(nameBox.x, nameBox.y - sy, nameBox.width, nameBox.height), amt: 0.72 * (1 - Math.min(1, s / 0.8)) });
        for (const hb of heads) {
          if (masks.length >= 4) break;
          const top = hb.y - sy;
          if (top > vh + 80 || top + hb.height < -80) continue;
          masks.push({ rect: new DOMRect(hb.x, top, hb.width, hb.height), amt: 0.72 });
        }
        engine.frame({ scrollVH: s, time, dive, velocity: full ? scrollVelocityRef.current : 0, masks });
      }
      if (s !== lastScroll || dirty) {
        print.current?.update(s, dive, engine ? engine.diveScreen() : [0.66, 0.31]);
      }
      lastScroll = s;
      dirty = false;
      if (living && !document.hidden) raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    if (engine) engine.onReady = () => {
      dirty = true;
      kick();
      // first light: ease the chrome in instead of popping it over the paper
      if (wrapRef.current) wrapRef.current.style.opacity = "1";
    };
    doResize();

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(doResize, 150);
    };
    const onScroll = () => { if (!living) kick(); };
    const onVis = () => { if (!document.hidden) kick(); };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    // section heights settle after fonts / images — re-measure a few times
    const settle = [400, 1200, 2600, 5000].map((ms) => setTimeout(doResize, ms));
    const ro = new ResizeObserver(() => onResize());
    ro.observe(document.body);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVis);
      settle.forEach(clearTimeout);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      alloyBus.glFinale = false;
      engine?.dispose();
      engine = null;
    };
  }, [deviceTier, reducedMotion, print, vclass]);

  return (
    <div ref={rootRef} aria-hidden="true" className="pointer-events-none">
      <PrintLayers ref={print} vclass={vclass} />
      <div ref={wrapRef} className="fixed inset-0" style={{ zIndex: 2, opacity: 0, transition: "opacity 1400ms cubic-bezier(0.16, 1, 0.3, 1)" }}>
        <canvas ref={canvasRef} style={{ width: "100vw", height: "100vh", display: "block" }} />
      </div>
    </div>
  );
});

export default Background;
