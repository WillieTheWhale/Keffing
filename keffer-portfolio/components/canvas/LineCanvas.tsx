"use client";

import { useRef, useEffect, useCallback, memo } from "react";
import { useStore } from "@/lib/store";
import { mulberry32 } from "@/lib/generative";
import { smoothedDensityRef, smoothedTuneRef } from "@/lib/tuning";
import { diveRef } from "@/lib/scroll";
import { FOCAL, TEXTURE_SEED } from "@/lib/composition";
import { generateRawScene, type RawScene } from "./scene";
import { SceneRendererGL, detectWebGL } from "./sceneGL";
import { loadStrokeTextures, renderMain2D, renderGlow2D } from "./scene2d";

// Oversized canvas + CSS parallax: the canvas is 2.6×vh tall so a clamped
// translateY never exposes blank space (maxScroll * PARALLAX < vh * OVERFLOW).
const OVERFLOW = 0.8;
const PARALLAX = 0.12;
const [FOCAL_X, FOCAL_Y] = FOCAL;

/**
 * The line burst. One scene description (scene.ts), two renderers:
 *   - WebGL (sceneGL.ts) on desktop/wide with WebGL and full motion — the
 *     whole composition as static GPU geometry, deform/tune/density in shaders.
 *   - Canvas 2D (scene2d.ts) everywhere else, unchanged in spirit from the
 *     original: main canvas + blurred glow canvas.
 * Rendering is on demand (scroll + a short settle window), never a free-
 * running loop.
 */
const LineCanvas = memo(function LineCanvas() {
  const mainRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rawRef = useRef<RawScene | null>(null);
  const dimsRef = useRef({ w: 0, h: 0, vh: 0, dpr: 1 });
  const lastScrollRef = useRef(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const glRendererRef = useRef<SceneRendererGL | null>(null);
  const glActiveRef = useRef(false);
  const settleRafRef = useRef(0);
  const ambientRafRef = useRef(0);
  const lastTuneSeenRef = useRef(0);

  const deviceTier = useStore((s) => s.deviceTier);
  const renderAllRef = useRef<((scrollY: number) => void) | null>(null);

  // 2D path: keep repainting briefly after the last scroll event so an
  // in-flight tune/density smoothing (lib/tuning.ts) always finishes playing out.
  const ensureSettleLoop = useCallback(() => {
    if (settleRafRef.current) return;
    const tick = () => {
      renderAllRef.current?.(window.scrollY);
      const t = smoothedTuneRef.current;
      const active = Math.abs(t - lastTuneSeenRef.current) > 0.0005 || t > 0.002;
      lastTuneSeenRef.current = t;
      settleRafRef.current = active ? requestAnimationFrame(tick) : 0;
    };
    settleRafRef.current = requestAnimationFrame(tick);
  }, []);

  // GL path: a continuous loop — the field breathes and the knot turns at
  // rest, and a frame costs a handful of draw calls. Paused while hidden.
  const startAmbient = useCallback(() => {
    if (ambientRafRef.current) return;
    const tick = () => {
      renderAllRef.current?.(window.scrollY);
      ambientRafRef.current = requestAnimationFrame(tick);
    };
    ambientRafRef.current = requestAnimationFrame(tick);
  }, []);
  const stopAmbient = useCallback(() => {
    if (ambientRafRef.current) cancelAnimationFrame(ambientRafRef.current);
    ambientRafRef.current = 0;
  }, []);

  const renderAll = useCallback((scrollY: number) => {
    const raw = rawRef.current;
    const dims = dimsRef.current;
    if (!raw) return;

    // Density/tune come from lib/tuning.ts's smoothed refs so this layer can
    // never pop out of sync with the CSS-var-driven overlay layers.
    const { densityOverride } = useStore.getState();
    const density = densityOverride ?? smoothedDensityRef.current;
    const globalAlpha = density < 0.12 ? Math.max(0.08, density / 0.12) : 1;

    if (glActiveRef.current && glRendererRef.current) {
      // Parallax lives in the camera here: the canvas is only viewport-sized,
      // so the window starts at the viewport's slice of the oversized scene
      // (one overflow band down) and slides with scroll.
      const shift = Math.min(dims.vh * OVERFLOW, scrollY * PARALLAX);
      glRendererRef.current.setViewOffset(dims.vh * OVERFLOW + shift);
      glRendererRef.current.render(scrollY, density, globalAlpha, dims.h, performance.now() / 1000);
      return;
    }
    const main = mainRef.current, glow = glowRef.current;
    if (!main || !glow) return;
    const mCtx = main.getContext("2d")!;
    mCtx.setTransform(dims.dpr, 0, 0, dims.dpr, 0, 0);
    renderMain2D(mCtx, raw, scrollY, dims.w, dims.h, density);
    const gCtx = glow.getContext("2d")!;
    gCtx.setTransform(dims.dpr, 0, 0, dims.dpr, 0, 0);
    renderGlow2D(gCtx, raw, scrollY, dims.w, dims.h, density);
    ensureSettleLoop();
  }, [ensureSettleLoop]);

  useEffect(() => {
    renderAllRef.current = renderAll;
  }, [renderAll]);

  const setup = useCallback(() => {
    const main = mainRef.current, glow = glowRef.current, gl = glRef.current, container = containerRef.current;
    if (!main || !glow || !gl || !container) return;

    const dpr = deviceTier === "mobile" ? 1 : Math.min(window.devicePixelRatio, 2);
    const w = Math.round(window.innerWidth);
    const vh = Math.round(window.innerHeight);
    const overflowPx = Math.round(vh * OVERFLOW);
    const canvasH = vh + overflowPx * 2;

    container.style.top = `-${overflowPx}px`;
    container.style.height = `${canvasH}px`;
    container.style.transformOrigin = `${FOCAL_X * 100}% ${FOCAL_Y * vh + overflowPx}px`;

    const fx = FOCAL_X * w;
    const fy = FOCAL_Y * vh + overflowPx;
    const rng = mulberry32(TEXTURE_SEED);
    const scale = deviceTier === "mobile" ? 0.35 : deviceTier === "tablet" ? 0.55 : 1;
    rawRef.current = generateRawScene(fx, fy, w, canvasH, vh, scale, rng, overflowPx);
    dimsRef.current = { w, h: canvasH, vh, dpr };

    const canUseGL =
      (deviceTier === "desktop" || deviceTier === "wide") &&
      !useStore.getState().reducedMotion &&
      detectWebGL();

    let glOk = false;
    if (canUseGL) {
      try {
        if (!glRendererRef.current) {
          const r = new SceneRendererGL(gl);
          r.onTexturesLoaded = () => renderAllRef.current?.(window.scrollY);
          glRendererRef.current = r;
        }
        glRendererRef.current.resize(w, vh, dpr);
        glRendererRef.current.setScene(rawRef.current);
        glOk = true;
      } catch {
        // Context creation can still fail past the capability probe (driver
        // reset, context-limit exhaustion) — fall back rather than go blank.
        glRendererRef.current?.dispose();
        glRendererRef.current = null;
      }
    } else if (glRendererRef.current) {
      glRendererRef.current.dispose();
      glRendererRef.current = null;
    }
    glActiveRef.current = glOk;
    if (glOk && !document.hidden) startAmbient(); else stopAmbient();

    // GL canvas sits exactly over the viewport (container top is -overflowPx).
    gl.style.display = glOk ? "block" : "none";
    gl.style.top = `${overflowPx}px`;
    gl.style.width = `${w}px`;
    gl.style.height = `${vh}px`;
    for (const c of [main, glow]) {
      c.style.display = glOk ? "none" : "block";
      c.width = glOk ? 1 : w * dpr;
      c.height = glOk ? 1 : canvasH * dpr;
      c.style.width = `${w}px`;
      c.style.height = `${canvasH}px`;
    }
    if (!glOk) {
      loadStrokeTextures().then(() => { if (rawRef.current) renderAllRef.current?.(window.scrollY); });
    }

    renderAll(window.scrollY);
  }, [deviceTier, renderAll, startAmbient, stopAmbient]);

  // Don't burn GPU on a hidden tab.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) stopAmbient();
      else if (glActiveRef.current) startAmbient();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [startAmbient, stopAmbient]);

  useEffect(() => {
    setup();
    const onResize = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(setup, 200);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [setup]);

  // Scroll: CSS parallax + dive dolly on the container, redraw with deformation.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let ticking = false;
    const update = () => {
      const scrollY = window.scrollY;
      const maxShift = dimsRef.current.vh * OVERFLOW;
      const dive = diveRef.current;
      const scale = dive > 0 ? `scale(${(1 + dive * 1.7).toFixed(4)})` : "";
      // GL: parallax is in the camera, only the dive dolly moves the container.
      // 2D: the oversized canvases ride the container's translate.
      el.style.transform = glActiveRef.current
        ? scale
        : `translateY(${-Math.min(maxShift, scrollY * PARALLAX)}px) ${scale}`;
      // The GL path repaints every frame on its own; only the 2D path
      // needs scroll-triggered redraws.
      if (!glActiveRef.current && Math.abs(scrollY - lastScrollRef.current) > 2) {
        lastScrollRef.current = scrollY;
        renderAll(scrollY);
      }
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [renderAll]);

  useEffect(() => {
    return () => {
      // Reset the loop handles too: StrictMode re-mounts in dev, and a stale
      // (already cancelled) id would make start*() think a loop is running.
      if (settleRafRef.current) cancelAnimationFrame(settleRafRef.current);
      settleRafRef.current = 0;
      stopAmbient();
      glRendererRef.current?.dispose();
      glRendererRef.current = null;
    };
  }, [stopAmbient]);

  return (
    <div
      ref={containerRef}
      className="fixed left-0 right-0 pointer-events-none will-change-transform"
      style={{ zIndex: 1 }}
      aria-hidden="true"
    >
      {/* 2D fallback pair: blurred glow under the main canvas */}
      <canvas ref={glowRef} className="absolute top-0 left-0" style={{ filter: "blur(20px)", opacity: 0.7 }} />
      <canvas ref={mainRef} className="absolute top-0 left-0" />
      {/* WebGL scene — the whole composition in one canvas */}
      <canvas ref={glRef} className="absolute top-0 left-0" />
    </div>
  );
});

export default LineCanvas;
