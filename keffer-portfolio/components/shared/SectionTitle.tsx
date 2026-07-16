"use client";

import { motion } from "framer-motion";

/**
 * Section title as a typographic event — SIGNAL/NOISE roadmap W5.
 * Viewport-scale Archivo display type that breaks out of the content panel,
 * with a rotated mono eyebrow in the Japanese-editorial manner.
 * Reveal is a mask-wipe (clip) so the type arrives like a transmission line.
 */

interface SectionTitleProps {
  num: string;
  eyebrow: string;
  title: string;
  inView: boolean;
  /** Optional smaller scale for secondary titles within a section. */
  small?: boolean;
}

export default function SectionTitle({ num, eyebrow, title, inView, small }: SectionTitleProps) {
  return (
    <div className="relative flex items-end gap-4 md:gap-6 mb-12 md:mb-16 select-none">
      {/* Rotated eyebrow: number + label reading upward */}
      <div
        className="hidden md:flex items-center gap-2 origin-bottom-left"
        style={{
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          paddingBottom: "0.15em",
        }}
        aria-hidden="true"
      >
        <span
          className="font-mono text-[10px] tracking-[0.3em] uppercase"
          style={{ color: "#333333" }}
        >
          {eyebrow}
        </span>
        <span
          className="font-mono text-[10px] tracking-[0.3em]"
          style={{ color: "#0099FF" }}
        >
          {num}
        </span>
      </div>

      {/* Mobile eyebrow (horizontal) */}
      <div className="md:hidden absolute -top-6 left-0 flex items-center gap-2" aria-hidden="true">
        <span className="font-mono text-[10px] tracking-[0.2em]" style={{ color: "#0099FF" }}>
          {num}
        </span>
        <span
          className="font-mono text-[10px] tracking-[0.2em] uppercase"
          style={{ color: "#333333" }}
        >
          {eyebrow}
        </span>
      </div>

      {/* Display title with mask-wipe reveal */}
      <div style={{ overflow: "hidden" }}>
        <motion.h2
          className="uppercase"
          style={{
            fontFamily: "var(--font-display), var(--font-sans), sans-serif",
            fontWeight: 800,
            fontStretch: "125%",
            fontSize: small
              ? "clamp(34px, 5vw, 68px)"
              : "clamp(44px, 7.5vw, 104px)",
            lineHeight: 0.95,
            letterSpacing: "-0.015em",
            color: "#000000",
            whiteSpace: "nowrap",
          }}
          initial={{ y: "110%" }}
          animate={inView ? { y: "0%" } : { y: "110%" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        >
          {title}
        </motion.h2>
      </div>
    </div>
  );
}
