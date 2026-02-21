"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { springs } from "@/lib/tokens";

interface TimelineEntry {
  year: string;
  title: string;
  description: string;
  type: "research" | "experience";
}

const timeline: TimelineEntry[] = [
  {
    year: "2026",
    title: "Generative Systems & Computational Aesthetics",
    description:
      "Research into how constrained algorithmic systems produce emergent visual complexity. Exploring the design space between fully deterministic and fully random generative processes.",
    type: "research",
  },
  {
    year: "2025",
    title: "Interactive Data Sculpture",
    description:
      "Investigation into physical-digital hybrid representations of complex datasets. Published methods for encoding temporal data as mathematical surfaces suitable for additive manufacturing.",
    type: "research",
  },
  {
    year: "2025",
    title: "Full-Stack Development & Creative Technology",
    description:
      "Building production web applications with a focus on performance-critical rendering, WebGL integration, and real-time data visualization systems.",
    type: "experience",
  },
  {
    year: "2024",
    title: "Machine Learning for Design Systems",
    description:
      "Exploring neural network architectures that learn design principles from large corpora of typographic and graphic design work. Focus on interpolation between learned styles.",
    type: "research",
  },
  {
    year: "2024",
    title: "Creative Coding & Installations",
    description:
      "Developing real-time generative visual installations for gallery exhibitions. Custom shader pipelines, sensor integration, and audience-responsive systems.",
    type: "experience",
  },
];

export default function ResearchSection() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      id="research"
      ref={ref}
      className="relative min-h-screen flex items-center py-32"
      aria-label="Research & Experience"
    >
      <div className="w-full px-6 md:px-12 lg:px-20">
        <div className="ml-auto mr-[5%] md:mr-[10%] max-w-[560px] content-panel">
          {/* Section header */}
          <motion.div
            className="flex items-center gap-3 mb-6"
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ type: "spring", ...springs.gentle }}
          >
            <span
              className="font-mono text-[11px] tracking-[0.15em] uppercase"
              style={{ color: "#0099FF" }}
            >
              04
            </span>
            <div className="h-px w-10" style={{ backgroundColor: "#0099FF" }} />
            <span
              className="font-mono text-[11px] tracking-[0.15em] uppercase"
              style={{ color: "#333333" }}
            >
              Research & Experience
            </span>
          </motion.div>

          <motion.h2
            className="font-sans font-semibold mb-12"
            style={{
              fontSize: "clamp(25px, 3vw, 31px)",
              lineHeight: 1.2,
              color: "#000000",
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ type: "spring", ...springs.gentle, delay: 0.15 }}
          >
            Depth & Rigor
          </motion.h2>

          {/* Timeline entries - sequential reveal (§7.3) */}
          <div className="space-y-10">
            {timeline.map((entry, i) => (
              <TimelineItem key={i} entry={entry} index={i} isInView={isInView} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TimelineItem({
  entry,
  index,
  isInView,
}: {
  entry: TimelineEntry;
  index: number;
  isInView: boolean;
}) {
  return (
    <motion.div
      className="relative pl-6"
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{
        type: "spring",
        ...springs.gentle,
        delay: 0.3 + index * 0.12,
      }}
    >
      {/* Timeline line */}
      <motion.div
        className="absolute left-0 top-0 w-px h-full origin-top"
        style={{
          backgroundColor:
            entry.type === "research"
              ? "rgba(0, 153, 255, 0.4)"
              : "rgba(0, 0, 0, 0.15)",
        }}
        initial={{ scaleY: 0 }}
        animate={isInView ? { scaleY: 1 } : {}}
        transition={{ duration: 0.6, delay: 0.4 + index * 0.12 }}
      />

      {/* Timeline dot */}
      <div
        className="absolute left-[-2.5px] top-[6px] w-[6px] h-[6px] rounded-full"
        style={{
          backgroundColor:
            entry.type === "research" ? "#0099FF" : "#1A1A1A",
        }}
      />

      {/* Year + type */}
      <div className="flex items-center gap-3 mb-2">
        <span
          className="font-mono text-[11px] tracking-wider"
          style={{ color: "#333333" }}
        >
          {entry.year}
        </span>
        <span
          className="font-mono text-[10px] tracking-wider uppercase px-2 py-0.5"
          style={{
            color: entry.type === "research" ? "#0099FF" : "#333333",
            backgroundColor:
              entry.type === "research"
                ? "rgba(0, 153, 255, 0.06)"
                : "rgba(0, 0, 0, 0.04)",
          }}
        >
          {entry.type}
        </span>
      </div>

      {/* Title */}
      <h3
        className="font-sans font-medium mb-2"
        style={{
          fontSize: "18px",
          lineHeight: 1.4,
          color: "#000000",
        }}
      >
        {entry.title}
      </h3>

      {/* Description */}
      <p
        className="font-sans"
        style={{
          fontSize: "15px",
          lineHeight: 1.6,
          color: "#333333",
        }}
      >
        {entry.description}
      </p>
    </motion.div>
  );
}
