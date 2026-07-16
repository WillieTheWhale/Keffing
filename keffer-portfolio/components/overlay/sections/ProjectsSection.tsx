"use client";

import { useRef } from "react";
import { useInView } from "framer-motion";
import { experience, projects } from "@/content/projects";
import ProjectCard from "./ProjectCard";
import SectionTitle from "@/components/shared/SectionTitle";

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
        <SectionTitle num="03" eyebrow="Experience" title="EXPERIENCE" inView={isInView} />

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

        <div className="mt-32">
          <SectionTitle num="04" eyebrow="Selected work" title="WORK" inView={isInView} />
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
