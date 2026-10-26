"use client";

// The entry sequence: the porcelain cable. On the site's paper, one porcelain tube
// (the background's own material: white body, ink contour, a soft shadow on
// the sheet) draws itself in a single gesture, a hairline lead winding round
// it: in from off-screen, one loop that crosses over itself, and on towards
// the top right, where its open end rests, breathing, while the page loads.
// Then the tube pulls through and out, and the paper is cut open along the
// path it took and parts, uncovering the page beneath. It waits for the
// background's first frame (alloyBus.sceneReady) so the page it uncovers is
// ready, plays once per visit, and any input skips it; reduced motion gets
// the finished tube, still, and one crossfade.

import { useEffect, useRef, useState } from "react";
import { withBase } from "@/lib/basePath";
import { useStore } from "@/lib/store";
import { PAPER } from "@/components/background/paper";
import { alloyBus } from "@/components/background/bus";
import { buildCable, drawCable, headAt, traceCentre, type Cable } from "./entryCable";
import s from "./EntrySequence.module.css";

const SESSION_KEY = "sn-entry-done";
const GRAIN_SRC = withBase("/assets/background/paper-grain.png");
const GRAIN = `url(${GRAIN_SRC})`;
const DRAW = 1500; // the pen, from off-screen through the loop to the hold
const MIN = 1900; // the page is never uncovered before this
const EXIT = 1250; // the tail pulls through and out; the paper parts
const SKIP_EXIT = 520;
const DRIFT = 0.022; // how far the open end creeps on while the page loads
const LAG = 0.045; // how far the lead trails the pen while drawing (0..1 of length)

const easeOut = (k: number) => 1 - Math.pow(1 - k, 2.3);
const easeIn = (k: number) => k * k * k;
const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const clamp01 = (k: number) => Math.min(1, Math.max(0, k));

/** Resolves once the background has drawn its first frame (or has no WebGL),
 *  or after `max` ms, whichever comes first. */
function sceneReady(max: number): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const poll = () => {
      if (alloyBus.sceneReady || performance.now() - t0 > max) resolve();
      else setTimeout(poll, 50);
    };
    poll();
  });
}

/** The hero assembles from here on (the name, the tagline). */
const revealPage = () => useStore.setState({ entryDone: true });

const markSeen = () => {
  try { sessionStorage.setItem(SESSION_KEY, "1"); } catch {}
};

const seen = () => {
  try { return !!sessionStorage.getItem(SESSION_KEY); } catch { return false; }
};

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Calls `skip` on the first pointer, key, wheel or touch input; returns the cleanup. */
function onFirstInput(skip: () => void) {
  const evs = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
  const fire = () => { off(); skip(); };
  const off = () => evs.forEach((e) => window.removeEventListener(e, fire));
  evs.forEach((e) => window.addEventListener(e, fire, { passive: true }));
  return off;
}

export default function EntrySequence() {
  const [done, setDone] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // once per visit: later loads go straight to the page
    if (seen()) {
      revealPage();
      const t = setTimeout(() => setDone(true), 0);
      return () => clearTimeout(t);
    }
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const paperCv = paperRef.current;
    const ctx = canvas?.getContext("2d");
    const pctx = paperCv?.getContext("2d");
    if (!root || !canvas || !ctx || !paperCv || !pctx) {
      // no canvas: nothing to draw, so the page is simply handed over
      const t = setTimeout(() => { revealPage(); markSeen(); setDone(true); }, 0);
      return () => clearTimeout(t);
    }
    const calm = prefersReducedMotion() || useStore.getState().reducedMotion;

    // the sheet, drawn once per size into a buffer the exit cuts copies of
    const sheet = document.createElement("canvas");
    const sctx = sheet.getContext("2d");
    let grain: HTMLImageElement | null = null;
    const paintSheet = () => {
      if (!sctx) return;
      sheet.width = paperCv.width;
      sheet.height = paperCv.height;
      sctx.fillStyle = PAPER;
      sctx.fillRect(0, 0, sheet.width, sheet.height);
      if (grain) {
        const pat = sctx.createPattern(grain, "repeat");
        if (pat) {
          pat.setTransform(new DOMMatrix().scale(dpr * (256 / grain.width)));
          sctx.globalCompositeOperation = "multiply";
          sctx.globalAlpha = 0.6;
          sctx.fillStyle = pat;
          sctx.fillRect(0, 0, sheet.width, sheet.height);
          sctx.globalCompositeOperation = "source-over";
          sctx.globalAlpha = 1;
        }
      }
      pctx.clearRect(0, 0, paperCv.width, paperCv.height);
      pctx.drawImage(sheet, 0, 0);
    };

    let dpr = 1;
    let W = 0, H = 0;
    const layout = (): Cable => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth;
      H = window.innerHeight;
      for (const cv of [canvas, paperCv]) {
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
      }
      paintSheet();
      return buildCable(W, H);
    };
    let cable = layout();
    let sway = new Float32Array(cable.n);

    // the server-drawn paper stays until the canvas sheet carries the grain too
    const img = new Image();
    img.src = GRAIN_SRC;
    const takeGrain = () => { grain = img; paintSheet(); root.dataset.sheet = ""; };
    img.decode().then(takeGrain, () => { root.dataset.sheet = ""; });

    let alive = true;
    let raf = 0;
    let head = 0, tail = 0, lead1 = 0, swayAmp = 0;
    let exitAt = -1, exitDur = EXIT;
    let from = { head: 0, tail: 0, lead1: 0, swayAmp: 0 };
    let ready = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    // a ripple travelling along the tube, gentle, strongest mid-length
    const ripple = (time: number, amp: number) => {
      const lambda = Math.max(260, Math.min(W, H) * 0.7);
      for (let i = 0; i < cable.n; i++) {
        const u = i / (cable.n - 1);
        const env = Math.sin(Math.PI * clamp01((u - 0.05) / 0.9));
        sway[i] = amp * env * Math.sin((cable.s[i] / lambda - time / 2600) * Math.PI * 2);
      }
    };

    const paint = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawCable(ctx, cable, tail, head, dpr, true, swayAmp > 0.01 ? sway : null, Math.max(tail, cable.leadFrom), lead1);
    };
    const finish = () => {
      if (!alive) return;
      alive = false;
      markSeen();
      setDone(true);
    };
    const uncover = () => {
      root.dataset.exit = "";
      delete root.dataset.live;
      revealPage();
    };

    const onResize = () => {
      cable = layout();
      sway = new Float32Array(cable.n);
      paint();
    };
    window.addEventListener("resize", onResize);

    // reduced motion: the finished tube, still, then a calm crossfade
    if (calm) {
      root.dataset.calm = "";
      head = cable.uHold;
      lead1 = head - LAG * 0.5;
      paint();
      const go = () => {
        if (root.dataset.exit !== undefined) return;
        uncover();
        timers.push(setTimeout(finish, 450));
      };
      const t0 = performance.now();
      sceneReady(3600).then(() => timers.push(setTimeout(go, Math.max(0, 300 - (performance.now() - t0)))));
      const off = onFirstInput(go);
      return () => {
        alive = false;
        off();
        timers.forEach(clearTimeout);
        window.removeEventListener("resize", onResize);
      };
    }

    const t0 = performance.now();
    sceneReady(3600).then(() => { ready = true; });

    const startExit = (dur: number) => {
      if (exitAt >= 0) return;
      exitAt = performance.now();
      exitDur = dur;
      from = { head, tail, lead1, swayAmp };
      uncover();
    };

    // the paper, cut open along the path the tube took, the cut widening
    const cutPaper = (k: number) => {
      const diag = Math.hypot(W, H);
      const wide = (cable.hw.reduce((m, v) => Math.max(m, v), 0) * 2.2) + easeIn(clamp01((k - 0.06) / 0.8)) * diag * 1.3;
      pctx.globalCompositeOperation = "source-over";
      pctx.clearRect(0, 0, paperCv.width, paperCv.height);
      pctx.drawImage(sheet, 0, 0);
      pctx.globalCompositeOperation = "destination-out";
      pctx.lineCap = "round";
      pctx.lineJoin = "round";
      pctx.lineWidth = wide * dpr;
      traceCentre(pctx, cable, 0, Math.max(from.head, head), dpr, null);
      pctx.stroke();
      pctx.globalCompositeOperation = "source-over";
    };

    const frame = (now: number) => {
      raf = 0;
      if (!alive) return;
      const el = now - t0;
      if (exitAt < 0) {
        if (el < DRAW) {
          head = headAt(cable, easeOut(el / DRAW));
          lead1 = Math.max(0, head - LAG * (1 - 0.5 * clamp01(el / DRAW)));
        } else {
          head = Math.min(1, cable.uHold + DRIFT * (1 - Math.exp(-(el - DRAW) / 1400)));
          lead1 = head - LAG * 0.5;
          // the tube settles into a slow breath while the page loads
          swayAmp = 2.6 * clamp01((el - DRAW) / 700);
        }
        if (ready && el >= MIN) startExit(EXIT);
      }
      if (exitAt >= 0) {
        const k = Math.min(1, (now - exitAt) / exitDur);
        // the head runs on out of frame; the tail follows, slow, then all at once
        head = from.head + (1 - from.head) * easeInOut(Math.min(1, k * 1.5));
        tail = from.tail + (1 - from.tail) * Math.pow(k, 2.1);
        lead1 = Math.min(head, from.lead1 + (1 - from.lead1) * easeInOut(Math.min(1, k * 1.35)));
        swayAmp = from.swayAmp * (1 - clamp01(k / 0.45));
        cutPaper(k);
        if (k >= 1) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          finish();
          return;
        }
      }
      if (swayAmp > 0.01) ripple(now - t0, swayAmp);
      paint();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const off = onFirstInput(() => startExit(SKIP_EXIT));

    return () => {
      alive = false;
      off();
      if (raf) cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  if (done) return null;
  return (
    <div ref={rootRef} className={s.root} data-live="" aria-hidden="true">
      {/* the first frame, from the server: paper and grain */}
      <div className={s.paper} style={{ background: PAPER }}>
        <span className={s.grain} style={{ backgroundImage: GRAIN }} />
      </div>
      <canvas ref={paperRef} className={s.sheet} />
      <canvas ref={canvasRef} className={s.canvas} />
    </div>
  );
}
