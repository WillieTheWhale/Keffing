"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { springs } from "@/lib/tokens";
import { extracurriculars, Extracurricular } from "@/content/projects";

export default function ResearchSection() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      id="research"
      ref={ref}
      className="relative min-h-screen flex items-center py-32"
      aria-label="Extracurriculars"
    >
      <div className="w-full px-6 md:px-12 lg:px-20">
        <div className="mx-auto md:ml-auto md:mr-[10%] max-w-[560px] content-panel">
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
              05
            </span>
            <div className="h-px w-10" style={{ backgroundColor: "#0099FF" }} />
            <span
              className="font-mono text-[11px] tracking-[0.15em] uppercase"
              style={{ color: "#333333" }}
            >
              Extracurriculars
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
            Extracurriculars
          </motion.h2>

          {/* Extracurricular entries */}
          <div className="space-y-10">
            {extracurriculars.map((entry, i) => (
              <ExtracurricularItem key={entry.id} entry={entry} index={i} isInView={isInView} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ExtracurricularItem({
  entry,
  index,
  isInView,
}: {
  entry: Extracurricular;
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
        style={{ backgroundColor: "rgba(0, 153, 255, 0.4)" }}
        initial={{ scaleY: 0 }}
        animate={isInView ? { scaleY: 1 } : {}}
        transition={{ duration: 0.6, delay: 0.4 + index * 0.12 }}
      />

      {/* Timeline dot */}
      <div
        className="absolute left-[-2.5px] top-[6px] w-[6px] h-[6px] rounded-full"
        style={{ backgroundColor: "#0099FF" }}
      />

      {/* Role */}
      <div className="mb-2">
        <span
          className="font-mono text-[10px] tracking-wider uppercase px-2 py-0.5"
          style={{
            color: "#0099FF",
            backgroundColor: "rgba(0, 153, 255, 0.06)",
          }}
        >
          {entry.role}
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
        className="font-sans mb-3"
        style={{
          fontSize: "15px",
          lineHeight: 1.6,
          color: "#333333",
        }}
      >
        {entry.description}
      </p>

      {/* Link */}
      {entry.url && (
        <a
          href={entry.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[12px] tracking-wide transition-opacity hover:opacity-70"
          style={{ color: "#0099FF" }}
        >
          Visit site &rarr;
        </a>
      )}
    </motion.div>
  );
}
