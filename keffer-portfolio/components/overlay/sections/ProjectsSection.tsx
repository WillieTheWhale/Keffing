"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { experience, projects } from "@/content/projects";
import ProjectCard from "./ProjectCard";
import { springs } from "@/lib/tokens";

export default function ProjectsSection() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      id="projects"
      ref={ref}
      className="relative py-32"
      aria-label="Experience & Projects"
      style={{ minHeight: "200vh" }}
    >
      <div className="w-full px-6 md:px-12 lg:px-20">
        {/* Experience sub-header */}
        <div className="mx-auto md:ml-auto md:mr-[15%] max-w-[520px] mb-20 content-panel">
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
              03
            </span>
            <div className="h-px w-10" style={{ backgroundColor: "#0099FF" }} />
            <span
              className="font-mono text-[11px] tracking-[0.15em] uppercase"
              style={{ color: "#333333" }}
            >
              Experience
            </span>
          </motion.div>

          <motion.h2
            className="font-sans font-semibold"
            style={{
              fontSize: "clamp(25px, 3vw, 31px)",
              lineHeight: 1.2,
              color: "#000000",
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ type: "spring", ...springs.gentle, delay: 0.15 }}
          >
            Experience
          </motion.h2>
        </div>

        {/* Experience cards */}
        <div className="space-y-12 md:space-y-20">
          {experience.map((project, i) => (
            <ProjectCard
              key={project.id}
              project={project}
              index={i}
              isLeft={i % 2 === 0}
            />
          ))}
        </div>

        {/* Projects sub-header */}
        <div className="mx-auto md:ml-auto md:mr-[15%] max-w-[520px] mt-32 mb-20 content-panel">
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
              Selected Work
            </span>
          </motion.div>

          <motion.h2
            className="font-sans font-semibold"
            style={{
              fontSize: "clamp(25px, 3vw, 31px)",
              lineHeight: 1.2,
              color: "#000000",
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ type: "spring", ...springs.gentle, delay: 0.15 }}
          >
            Projects
          </motion.h2>
        </div>

        {/* Project cards */}
        <div className="space-y-12 md:space-y-20">
          {projects.map((project, i) => (
            <ProjectCard
              key={project.id}
              project={project}
              index={i + experience.length}
              isLeft={(i + experience.length) % 2 === 0}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
