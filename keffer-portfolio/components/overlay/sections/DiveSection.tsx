"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { scrollToSection, diveRef } from "@/lib/scroll";

/**
 * The Dive — SIGNAL/NOISE roadmap W10 (finale).
 * Scrolling past Contact crosses the one signal-red threshold on the site and
 * tunnels INTO the composition: the line burst and fragments scale past the
 * viewer (CSS dolly via --dive), noise thins to nothing, and the journey
 * resolves into one full-viewport calm sky — pure signal — holding the final
 * CTA and colophon. Scrubbable both directions. Reduced motion: crossfade.
 */

export default function DiveSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);
  const whiteRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useStore((s) => s.reducedMotion);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    let ticking = false;

    const update = () => {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      // D: 0 when the section top reaches the viewport bottom,
      //    1 when the sticky viewport is fully pinned (one section-height in).
      const total = section.offsetHeight - vh;
      const d = Math.min(1, Math.max(0, -rect.top / Math.max(1, total)));

      // Dolly the ambient layers (LineCanvas reads diveRef; fragment
      // containers read the CSS var).
      const dv = reducedMotion ? 0 : d;
      diveRef.current = dv;
      document.documentElement.style.setProperty("--dive", dv.toFixed(3));

      // Whiteout rises through the middle of the dive…
      if (whiteRef.current) {
        const w = Math.min(1, Math.max(0, (d - 0.15) / 0.5));
        whiteRef.current.style.opacity = String(w);
      }
      // …and the calm sky resolves at the end.
      if (skyRef.current) {
        const sk = Math.min(1, Math.max(0, (d - 0.55) / 0.35));
        skyRef.current.style.opacity = String(sk);
      }
      if (contentRef.current) {
        const c = Math.min(1, Math.max(0, (d - 0.7) / 0.25));
        contentRef.current.style.opacity = String(c);
        contentRef.current.style.transform = `translateY(${(1 - c) * 24}px)`;
      }
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      diveRef.current = 0;
      document.documentElement.style.setProperty("--dive", "0");
    };
  }, [reducedMotion]);

  return (
    <section
      id="dive"
      ref={sectionRef}
      className="relative"
      style={{ height: "260vh" }}
      aria-label="Finale"
    >
      {/* The one red element on the site: the threshold */}
      <div className="absolute top-0 left-0 right-0 flex flex-col items-center gap-3 pt-2">
        <div style={{ width: "100%", height: "1px", backgroundColor: "var(--signal-red)" }} />
        <span
          className="font-mono text-[10px] tracking-[0.35em] uppercase"
          style={{ color: "var(--signal-red)" }}
        >
          Threshold — diving to pure signal
        </span>
      </div>

      {/* Sticky viewport for the dive */}
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Whiteout as noise burns off */}
        <div
          ref={whiteRef}
          className="absolute inset-0"
          style={{ backgroundColor: "#FFFFFF", opacity: 0 }}
        />
        {/* Pure signal: one calm sky */}
        <div ref={skyRef} className="absolute inset-0" style={{ opacity: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/sky/sky-12.jpg"
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        {/* Final content */}
        <div
          ref={contentRef}
          className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6 text-center"
          style={{ opacity: 0 }}
        >
          <span
            className="font-mono text-[10px] tracking-[0.35em] uppercase"
            style={{ color: "#333333" }}
          >
            Signal acquired — end of transmission
          </span>
          <h2
            className="uppercase"
            style={{
              fontFamily: "var(--font-display), var(--font-sans), sans-serif",
              fontWeight: 800,
              fontStretch: "122%",
              fontSize: "clamp(34px, 5.5vw, 84px)",
              lineHeight: 1,
              letterSpacing: "-0.015em",
              color: "#000000",
            }}
          >
            Pure signal
          </h2>
          <p
            className="font-sans max-w-[440px]"
            style={{ fontSize: "16px", lineHeight: 1.6, color: "#1A1A1A" }}
          >
            The noise resolves. If something here resonated, open a channel.
          </p>
          <div className="flex items-center gap-6 mt-2">
            <a
              href="mailto:williamkeffer2005@gmail.com"
              className="font-mono text-[12px] tracking-[0.15em] uppercase"
              style={{
                color: "#FFFFFF",
                backgroundColor: "#000000",
                padding: "14px 22px",
              }}
            >
              Open channel
            </a>
            <button
              type="button"
              onClick={() => scrollToSection("hero")}
              className="font-mono text-[12px] tracking-[0.15em] uppercase"
              style={{
                color: "#1A1A1A",
                background: "transparent",
                border: "1px solid rgba(0,0,0,0.35)",
                padding: "13px 22px",
                cursor: "pointer",
              }}
            >
              Re-tune &uarr;
            </button>
          </div>
          <span
            className="font-mono text-[9px] tracking-[0.25em] uppercase mt-8"
            style={{ color: "#999999" }}
          >
            &copy; {new Date().getFullYear()} William Keffer — designed &amp; built as a generative system
          </span>
        </div>
      </div>
    </section>
  );
}
