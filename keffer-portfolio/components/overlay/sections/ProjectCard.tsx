"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Project } from "@/content/projects";
import { springs } from "@/lib/tokens";

interface ProjectCardProps {
  project: Project;
  index: number;
  isLeft: boolean;
}

export default function ProjectCard({ project, index, isLeft }: ProjectCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      className={`relative max-w-[480px] content-panel ${
        isLeft ? "mr-auto ml-[5%] md:ml-[10%]" : "ml-auto mr-[5%] md:mr-[10%]"
      }`}
      style={{
        marginTop: index === 0 ? 0 : `${60 + (index % 3) * 20}px`,
      }}
      initial={{ opacity: 0, y: 30, x: isLeft ? -20 : 20 }}
      animate={isInView ? { opacity: 1, y: 0, x: 0 } : {}}
      transition={{
        type: "spring",
        ...springs.gentle,
        delay: 0.1,
      }}
      whileHover={{
        scale: 1.02,
        transition: { type: "spring", ...springs.snappy },
      }}
    >
      {/* Project number */}
      <div className="flex items-center gap-3 mb-4">
        <span
          className="font-mono text-[11px] tracking-[0.15em]"
          style={{ color: "#0099FF" }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="h-px flex-grow max-w-[40px]" style={{ backgroundColor: "#CCCCCC" }} />
      </div>

      {/* Title */}
      <h3
        className="font-sans font-semibold mb-3"
        style={{
          fontSize: "clamp(20px, 2.5vw, 25px)",
          lineHeight: 1.3,
          color: "#000000",
        }}
      >
        {project.title}
      </h3>

      {/* Description */}
      <p
        className="font-sans mb-4"
        style={{
          fontSize: "16px",
          lineHeight: 1.6,
          color: "#1A1A1A",
        }}
      >
        {project.description}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-4">
        {project.tags.map((tag) => (
          <span
            key={tag}
            className="font-mono text-[10px] tracking-wider uppercase px-2 py-0.5"
            style={{
              color: "#333333",
              backgroundColor: "rgba(0, 153, 255, 0.06)",
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Links */}
      <div className="flex items-center gap-4">
        {project.url && (
          <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 font-mono text-[12px] tracking-wide transition-colors"
            style={{ color: "#0099FF" }}
          >
            <span>View Project</span>
            <motion.span
              className="inline-block"
              whileHover={{ x: 3 }}
              transition={{ type: "spring", ...springs.snappy }}
            >
              &rarr;
            </motion.span>
          </a>
        )}
        {project.github && (
          <a
            href={project.github}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[12px] tracking-wide transition-colors hover:opacity-70"
            style={{ color: "#333333" }}
          >
            Source
          </a>
        )}
      </div>

      {/* Decorative border accent */}
      <motion.div
        className="absolute -left-4 top-0 w-px h-full origin-top"
        style={{ backgroundColor: "rgba(0, 153, 255, 0.2)" }}
        initial={{ scaleY: 0 }}
        animate={isInView ? { scaleY: 1 } : {}}
        transition={{ duration: 0.8, delay: 0.3 }}
      />
    </motion.div>
  );
}
