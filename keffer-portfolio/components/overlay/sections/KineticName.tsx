"use client";

import { useEffect, useMemo, useRef } from "react";
import { useStore } from "@/lib/store";
import { mulberry32 } from "@/lib/generative";

/**
 * Kinetic deconstructed hero lockup — SIGNAL/NOISE roadmap W5.
 * Each letter begins scattered among the collage layers (its own offset,
 * rotation, depth-blur) and locks into place once the entry sequence clears.
 * On scroll the lockup shears apart again — scrubbable, driven directly by
 * scroll position via one listener and direct DOM writes (no re-renders).
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
    let ticking = false;
    let last = -1;

    const update = () => {
      ticking = false;
      const shear = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.8)));
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
