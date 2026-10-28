"use client";

import { useEffect, useMemo, useRef } from "react";
import { useStore } from "@/lib/store";
import { mulberry32 } from "@/lib/generative";
import { compositorScroll, cssNum, FADED, scrollKeyframes, scrollTag, styleSheet, viewportHeight } from "@/lib/scrollTimeline";

/**
 * Kinetic deconstructed hero lockup — SIGNAL/NOISE roadmap W5.
 * Each letter begins scattered among the collage layers (its own offset,
 * rotation, depth-blur) and locks into place once the entry sequence clears.
 * On scroll the lockup shears apart again — scrubbable, driven directly by
 * scroll position via one listener and direct DOM writes (no re-renders); on
 * touch devices by the same curves as scroll-driven keyframes, so the shear
 * runs with the finger on the compositor (lib/scrollTimeline.ts).
 *
 * Two nested spans per letter so the two motions never fight:
 *   outer = entry assembly (CSS transition, staggered)
 *   inner = scroll shear   (JS transform, per frame)
 */

const LINES = ["WILLIAM", "KEFFER"] as const;

interface Scatter {
  dx: number;
  dy: number;
  rot: number;
  delay: number;
  // scroll shear vector (direction the letter departs on scroll-out)
  sx: number;
  sy: number;
  sr: number;
}

export default function KineticName() {
  const entryDone = useStore((s) => s.entryDone);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const seed = useStore((s) => s.seed);
  const wrapRef = useRef<HTMLHeadingElement>(null);

  const scatters = useMemo(() => {
    const rng = mulberry32(seed + 4242);
    const all: Scatter[][] = [];
    let i = 0;
    for (const line of LINES) {
      const row: Scatter[] = [];
      for (const _ of line) {
        row.push({
          dx: (rng() - 0.5) * 340,
          dy: (rng() - 0.5) * 260 - 60,
          rot: (rng() - 0.5) * 40,
          delay: 120 + i * 42 + rng() * 60,
          sx: (rng() - 0.5) * 260,
          sy: -40 - rng() * 180,
          sr: (rng() - 0.5) * 30,
        });
        i++;
      }
      all.push(row);
    }
    return all;
  }, [seed]);

  // Scroll shear: hero exit progress 0..1 over the first ~80vh of scroll
  useEffect(() => {
    if (reducedMotion) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const inners = Array.from(wrap.querySelectorAll<HTMLElement>("[data-shear]"));
    const vec = inners.map((el) => [parseFloat(el.dataset.sx || "0"), parseFloat(el.dataset.sy || "0"), parseFloat(el.dataset.sr || "0")]);

    if (compositorScroll()) {
      // shear e = (scroll / 0.8vh)², opacity 1 − 1.15·e: the curves below, exactly
      const vh = viewportHeight(), end = 0.8, range = end * vh;
      const ease = (s: number) => (Math.min(s, end) / end) ** 2;
      const tag = scrollTag("shear");
      const timeline = `animation-timeline:scroll(root block),scroll(root block);animation-range:0px ${range}px`;
      let css = scrollKeyframes(`${tag}o`, { breaks: [end / Math.sqrt(1.15)], f: (s) => Math.max(0, 1 - ease(s) * 1.15), css: (v) => `opacity:${cssNum(Math.max(FADED, v))}` }, vh, range);
      inners.forEach((el, i) => {
        const [sx, sy, sr] = vec[i];
        const name = `${tag}-${i}`;
        css += scrollKeyframes(name, { breaks: [], f: ease, css: (e) => `transform:translate(${cssNum(sx * e)}px,${cssNum(sy * e)}px) rotate(${cssNum(sr * e)}deg)` }, vh, range);
        css += `[data-shear="${name}"]{animation:${name} linear both,${tag}o linear both;${timeline}}`;
        el.dataset.shear = name;
      });
      const sheet = styleSheet();
      sheet.set(css);
      return () => {
        sheet.remove();
        inners.forEach((el) => { el.dataset.shear = ""; });
      };
    }

    let ticking = false;
    let last = -1;

    const update = () => {
      ticking = false;
      const shear = Math.min(1, Math.max(0, window.scrollY / (viewportHeight() * 0.8)));
      const eased = shear * shear;
      // past the hero the shear is pinned at 1: nothing to rewrite
      if (eased === last) return;
      last = eased;
      inners.forEach((el, i) => {
        const [sx, sy, sr] = vec[i];
        if (eased < 0.004) {
          el.style.transform = "";
          el.style.opacity = "1";
        } else {
          el.style.transform = `translate(${sx * eased}px, ${sy * eased}px) rotate(${sr * eased}deg)`;
          el.style.opacity = String(Math.max(0, 1 - eased * 1.15));
        }
      });
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <h1
      ref={wrapRef}
      aria-label="William Keffer"
      className="kinetic-name"
      style={{
        fontFamily: "var(--font-display), var(--font-sans), sans-serif",
        fontWeight: 800,
        fontStretch: "118%",
        fontSize: "clamp(52px, 8.5vw, 132px)",
        lineHeight: 0.92,
        letterSpacing: "-0.02em",
        color: "#000000",
        margin: 0,
      }}
    >
      {LINES.map((line, li) => (
        <span key={line} className="block" aria-hidden="true">
          {Array.from(line).map((ch, ci) => {
            const s = scatters[li][ci];
            const outerStyle = reducedMotion
              ? { opacity: entryDone ? 1 : 0, transition: "opacity 400ms linear" }
              : {
                  transform: entryDone
                    ? "translate(0px, 0px) rotate(0deg)"
                    : `translate(${s.dx}px, ${s.dy}px) rotate(${s.rot}deg)`,
                  opacity: entryDone ? 1 : 0,
                  filter: entryDone ? "blur(0px)" : "blur(3px)",
                  transition: `transform 900ms cubic-bezier(0.16, 1, 0.3, 1) ${s.delay}ms, opacity 700ms linear ${s.delay}ms, filter 900ms linear ${s.delay}ms`,
                };
            return (
              <span
                key={`${li}-${ci}`}
                className="inline-block will-change-transform"
                style={outerStyle}
              >
                <span
                  data-shear
                  data-sx={s.sx}
                  data-sy={s.sy}
                  data-sr={s.sr}
                  className="inline-block will-change-transform"
                >
                  {ch}
                </span>
              </span>
            );
          })}
        </span>
      ))}
    </h1>
  );
}
