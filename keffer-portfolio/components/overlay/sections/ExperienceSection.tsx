"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { springs } from "@/lib/tokens";
import { experience, extracurriculars, Extracurricular } from "@/content/projects";
import ProjectCard from "./ProjectCard";
import SectionTitle from "@/components/shared/SectionTitle";

/**
 * Experience section — bundles roles/research (formerly half of
 * ProjectsSection) with Extracurriculars (formerly its own ResearchSection),
 * per the overnight reorder. One SectionTitle ("EXPERIENCE"), two labeled
 * sub-blocks underneath rather than two competing display-scale titles.
 */

function SubHeader({ eyebrow, isInView }: { eyebrow: string; isInView: boolean }) {
  return (
    <motion.div
      className="caption-rule mb-8"
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ type: "spring", ...springs.gentle }}
    >
      <span>{eyebrow.toLowerCase()}</span>
      <i />
    </motion.div>
  );
}

export default function ExperienceSection() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      id="experience"
      ref={ref}
      className="relative py-32"
      aria-label="Experience & Extracurriculars"
      style={{ minHeight: "160vh" }}
    >
      <div className="w-full px-6 md:px-12 lg:px-20">
        <SectionTitle num="05" eyebrow="Roles & orgs" title="EXPERIENCE" inView={isInView} />

        <SubHeader eyebrow="Roles & research" isInView={isInView} />
        <div className="space-y-12 md:space-y-20 mb-28">
          {experience.map((project, i) => (
            <ProjectCard
              key={project.id}
              project={project}
              index={i}
              isLeft={i % 2 === 0}
            />
          ))}
        </div>

        <SubHeader eyebrow="Beyond the work" isInView={isInView} />
        <div className="mx-auto md:ml-auto md:mr-[10%] max-w-[560px] content-panel">
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
      {/* Ledger rule */}
      <motion.div
        className="absolute left-0 top-0 w-px h-full origin-top"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.22)" }}
        initial={{ scaleY: 0 }}
        animate={isInView ? { scaleY: 1 } : {}}
        transition={{ duration: 0.6, delay: 0.4 + index * 0.12 }}
      />

      {/* Role */}
      <div className="mb-2">
        <span className="mark-caption">{String(index + 1).padStart(2, "0")} / {entry.role.toLowerCase()}</span>
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
        <a href={entry.url} target="_blank" rel="noopener noreferrer" className="typed-link">
          visit site &#8599;
        </a>
      )}
    </motion.div>
  );
}
