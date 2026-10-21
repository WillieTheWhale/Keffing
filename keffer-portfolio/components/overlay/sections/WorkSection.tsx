"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { projects } from "@/content/projects";
import ProjectCard from "./ProjectCard";
import SectionTitle from "@/components/shared/SectionTitle";
import { useStore } from "@/lib/store";

/**
 * Work section — the project archive as a picker-wheel drum (redesign
 * 2026-07-20, "Option A + T2"). Cards ride an invisible 3D cylinder:
 * each card wrapper is a static spoke (rotateY(i·step) translateZ(R));
 * the drum element carries the single animated transform.
 *
 * Desktop / tablet: arrow-paged, 30° steps on a large-radius arc (only a
 * shallow slice of the cylinder is ever visible), keyboard ← → supported.
 * Mobile: a true full wheel — step = 360/N so all N cards close the
 * cylinder — driven by touch with momentum + snap, no arrow buttons.
 */

const N = projects.length;
const DESK_STEP = 30;
const DESK_RADIUS = 940;
const DESK_CARD_W = 400;
/** Finger travel that advances one card on the mobile wheel. */
const PX_PER_STEP = 130;

const pad = (n: number) => String(n + 1).padStart(2, "0");
const mod = (n: number, m: number) => ((n % m) + m) % m;

export default function WorkSection() {
  const ref = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drumRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const deviceTier = useStore((s) => s.deviceTier);
  const isMobile = deviceTier === "mobile";

  // Continuous virtual index — unbounded so the reel wraps forever in both
  // directions on every tier; the real file index is v mod N.
  const [v, setV] = useState(0);
  const [cardW, setCardW] = useState(DESK_CARD_W);
  const vRef = useRef(0);
  vRef.current = v;
  const active = mod(v, N);

  // Geometry. Mobile closes the full cylinder; radius keeps adjacent
  // chords a card-width-plus-gap apart so spokes never interleave.
  const step = isMobile ? 360 / N : DESK_STEP;
  const radius = isMobile
    ? Math.round((cardW + 28) / (2 * Math.sin(Math.PI / N)))
    : DESK_RADIUS;

  useEffect(() => {
    if (!isMobile) {
      setCardW(DESK_CARD_W);
      return;
    }
    const size = () => setCardW(Math.min(Math.round(window.innerWidth * 0.8), 320));
    size();
    window.addEventListener("resize", size);
    return () => window.removeEventListener("resize", size);
  }, [isMobile]);

  // The drum's transform is written imperatively: touch drags update it
  // every frame, and re-rendering 31 spokes at 60fps is exactly the kind
  // of scroll-frame React work the perf overhaul removed elsewhere.
  const thetaRef = useRef(0);
  const applyTheta = useCallback(
    (deg: number, transition: string) => {
      const drum = drumRef.current;
      if (!drum) return;
      drum.style.transition = transition;
      drum.style.transform = `translateZ(${-radius}px) rotateY(${deg}deg)`;
      thetaRef.current = deg;
    },
    [radius]
  );

  // Desktop paging. The first application is instant so the drum doesn't
  // visibly assemble on load. Mobile is driven by the touch effect below —
  // rendering here mid-snap would kill the settle animation.
  const firstApply = useRef(true);
  useEffect(() => {
    if (isMobile) return;
    const instant = firstApply.current;
    firstApply.current = false;
    applyTheta(
      -vRef.current * DESK_STEP,
      instant ? "none" : "transform 900ms var(--ease-tune)"
    );
  }, [v, isMobile, applyTheta]);

  // Geometry changes (tier flips, phone rotation): re-pin without animating.
  useEffect(() => {
    if (!isMobile) return;
    applyTheta(thetaRef.current, "none");
  }, [isMobile, applyTheta]);

  const go = useCallback((dir: -1 | 1) => {
    setV((x) => x + dir);
  }, []);

  // Mobile wheel: touch drag with momentum + snap. Listeners are attached
  // manually because React registers touchmove as passive at the root.
  useEffect(() => {
    const stage = stageRef.current;
    if (!isMobile || !stage) return;

    applyTheta(-vRef.current * step, "none");

    let startX = 0;
    let startY = 0;
    let startTheta = 0;
    let lastX = 0;
    let lastT = 0;
    let vel = 0; // px/ms, EMA
    let axis: "h" | "v" | null = null;
    const degPerPx = step / PX_PER_STEP;

    const syncActive = (theta: number) => {
      const nv = Math.round(-theta / step);
      if (nv !== vRef.current) setV(nv);
    };

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startX = lastX = t.clientX;
      startY = t.clientY;
      startTheta = thetaRef.current;
      lastT = performance.now();
      vel = 0;
      axis = null;
    };

    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (!axis) {
        if (Math.abs(dx) > Math.abs(dy) + 4) axis = "h";
        else if (Math.abs(dy) > Math.abs(dx) + 4) axis = "v";
      }
      if (axis !== "h") return;
      e.preventDefault();
      const now = performance.now();
      const dt = Math.max(1, now - lastT);
      vel = 0.8 * vel + 0.2 * ((t.clientX - lastX) / dt);
      lastX = t.clientX;
      lastT = now;
      const theta = startTheta + dx * degPerPx;
      applyTheta(theta, "none");
      syncActive(theta);
    };

    const onEnd = () => {
      if (axis !== "h") return;
      // ~160ms of momentum lookahead, then snap to the nearest spoke.
      const projected = thetaRef.current + vel * 160 * degPerPx;
      const target = Math.round(projected / step) * step;
      applyTheta(target, "transform 650ms var(--ease-reveal)");
      syncActive(target);
    };

    stage.addEventListener("touchstart", onStart, { passive: true });
    stage.addEventListener("touchmove", onMove, { passive: false });
    stage.addEventListener("touchend", onEnd, { passive: true });
    stage.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      stage.removeEventListener("touchstart", onStart);
      stage.removeEventListener("touchmove", onMove);
      stage.removeEventListener("touchend", onEnd);
      stage.removeEventListener("touchcancel", onEnd);
    };
  }, [isMobile, step, applyTheta]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      go(-1);
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      go(1);
      e.preventDefault();
    }
  };

  // Angular offset to the active card, shortest way around the reel.
  const offsetFor = (i: number) => {
    let off = mod(i - active, N);
    if (off > N / 2) off -= N;
    return off;
  };

  const opacityFor = (abs: number) =>
    isMobile
      ? abs === 0 ? 1 : abs === 1 ? 0.6 : abs === 2 ? 0.35 : abs === 3 ? 0.15 : 0
      : abs === 0 ? 1 : abs === 1 ? 0.55 : abs === 2 ? 0.22 : 0;

  return (
    <section
      id="work"
      ref={ref}
      className="relative flex flex-col justify-center py-20"
      aria-label="Work and project archive"
      style={{ minHeight: "100vh" }}
    >
      <div className="w-full">
        <div className="px-6 md:px-12 lg:px-20">
          <SectionTitle num="03" eyebrow="Project archive" title="WORK" inView={isInView} />

          <p className="mark-caption max-w-[68ch] -mt-4 mb-2 md:mb-0" style={{ fontSize: 10, lineHeight: 1.7 }}>
            the full archive on one reel — {N} files.{" "}
            {isMobile ? "swipe the wheel." : "page with the arrows, or ← → from the keyboard."}
          </p>
        </div>

        <div
          ref={stageRef}
          className="work-stage"
          style={{ "--card-w": `${cardW}px` } as React.CSSProperties}
          tabIndex={isMobile ? undefined : 0}
          onKeyDown={isMobile ? undefined : onKeyDown}
          role="group"
          aria-roledescription="carousel"
          aria-label={`${N} projects. ${isMobile ? "Swipe horizontally to rotate the wheel." : "Use the previous and next buttons or arrow keys."}`}
        >
          <div ref={drumRef} className="work-drum">
            {projects.map((project, i) => {
              const off = offsetFor(i);
              const abs = Math.abs(off);
              // Mobile spokes close a literal cylinder. Desktop keeps the
              // 30° reel look but lays spokes out by wrapped offset from
              // the continuous index — visible cards keep stable absolute
              // angles as v moves, and the reel never runs out of drum.
              const angle = isMobile ? i * step : (v + off) * step;
              return (
                <div
                  key={project.id}
                  className="drum-card"
                  style={{
                    transform: `rotateY(${angle}deg) translateZ(${radius}px)`,
                    opacity: opacityFor(abs),
                    zIndex: 20 - Math.min(abs, 19),
                    pointerEvents: off === 0 ? "auto" : "none",
                  }}
                  aria-hidden={off !== 0}
                >
                  <ProjectCard project={project} index={i} drum />
                </div>
              );
            })}
          </div>

          {/* Arrows flank the drum — clear visual cue on a busy field */}
          {!isMobile && (
            <>
              <button
                type="button"
                className="ctl-stub drum-nav drum-nav-prev"
                onClick={() => go(-1)}
                aria-label="Previous project"
              >
                <span className="ctl-eyebrow">
                  file {pad(mod(active - 1, N))} / {pad(N - 1)}
                </span>
                <span className="ctl-label">
                  <span className="ctl-rule" aria-hidden="true" />
                  Prev
                </span>
              </button>
              <button
                type="button"
                className="ctl-stub drum-nav drum-nav-next"
                onClick={() => go(1)}
                aria-label="Next project"
              >
                <span className="ctl-eyebrow">
                  file {pad(mod(active + 1, N))} / {pad(N - 1)}
                </span>
                <span className="ctl-label">
                  Next
                  <span className="ctl-rule" aria-hidden="true" />
                </span>
              </button>
            </>
          )}
        </div>

        {/* Position readout — counter over the tick strip, centered below */}
        <div className="relative z-30 flex flex-col items-center gap-2 px-6 mt-4">
          <span className="mark-caption" style={{ fontSize: 10 }} aria-live="polite">
            <span style={{ color: "#000" }}>{pad(active)}</span> / {pad(N - 1)}
          </span>
          <div className="drum-ticks" aria-hidden="true">
            {projects.map((p, i) => (
              <i key={p.id} className={i === active ? "on" : undefined} />
            ))}
          </div>
          {isMobile && (
            <span className="mark-caption">← swipe →</span>
          )}
        </div>
      </div>
    </section>
  );
}
