"use client";

import { useMemo, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useRouter } from "next/navigation";
import { Project } from "@/content/projects";
import { springs } from "@/lib/tokens";
import { useStore } from "@/lib/store";
import { SKY_PHOTOS } from "@/lib/fragments";
import { hashSlug } from "@/lib/generative";
import { openVeil } from "@/components/shared/Veil";

/**
 * Project card as a file: a screen-printed photograph (straight-cut, with
 * the reference's oblique code in the corner), the title in the display
 * voice, a clamped summary, and the stack as a typed slash-list. Hover
 * frames the photograph in a thin red hairline — the one red the reference
 * allows itself.
 */

interface ProjectCardProps {
  project: Project;
  index: number;
  isLeft?: boolean;
  horizontal?: boolean;
  /** Drum spoke variant: fills its 3D wrapper, no entrance spring of its own. */
  drum?: boolean;
}

export default function ProjectCard({
  project,
  index,
  isLeft = true,
  horizontal = false,
  drum = false,
}: ProjectCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const deviceTier = useStore((s) => s.deviceTier);
  const router = useRouter();
  const isMobile = deviceTier === "mobile";

  const coverSky = useMemo(
    () => SKY_PHOTOS[hashSlug(project.id) % SKY_PHOTOS.length],
    [project.id]
  );
  const code = useMemo(() => "0x" + (hashSlug(project.id) & 0xffffff).toString(16).padStart(6, "0"), [project.id]);

  const openCase = () => openVeil(() => router.push(`/work/${project.id}`));

  return (
    <motion.div
      ref={ref}
      className={`project-card relative content-panel ${
        drum
          ? "w-full"
          : horizontal
            ? "shrink-0 snap-start w-[84vw] sm:w-[66vw] md:w-[520px]"
            : isMobile
              ? "max-w-[520px] mx-auto"
              : isLeft
                ? "max-w-[520px] mr-auto ml-[5%] md:ml-[10%]"
                : "max-w-[520px] ml-auto mr-[5%] md:mr-[10%]"
      }`}
      style={drum || horizontal ? undefined : { marginTop: index === 0 ? 0 : `${60 + (index % 3) * 20}px` }}
      initial={drum ? false : {
        opacity: 0,
        y: isMobile ? 18 : horizontal ? 0 : 30,
        x: isMobile ? 0 : horizontal ? 24 : isLeft ? -20 : 20,
      }}
      animate={isInView ? { opacity: 1, y: 0, x: 0 } : {}}
      transition={{ type: "spring", ...springs.gentle, delay: 0.1 }}
    >
      {/* Photograph */}
      <button
        type="button"
        onClick={openCase}
        className="project-card-media sky-print relative block w-full mb-2"
        style={{ height: "170px", cursor: "pointer", border: "none", padding: 0, background: "none" }}
        aria-label={`Open case study: ${project.title}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverSky}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
          draggable={false}
        />
        {project.image && (
          <span
            className="absolute bottom-3 right-3 flex items-center justify-center"
            style={{ width: 34, height: 34, background: "rgba(255,255,255,0.92)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={project.image}
              alt=""
              style={{ width: 24, height: 24, objectFit: "contain" }}
              decoding="async"
              draggable={false}
            />
          </span>
        )}
      </button>
      <div className="flex items-center justify-between mb-4">
        <span className="mark-caption">{String(index + 1).padStart(2, "0")} / {project.id}</span>
        <span className="mark-caption">{code}</span>
      </div>

      {/* Title in the display voice */}
      <h3
        className="mb-3"
        style={{
          fontFamily: "var(--font-display), var(--font-sans), sans-serif",
          fontWeight: 800,
          fontStretch: "115%",
          fontSize: "clamp(22px, 2.6vw, 30px)",
          lineHeight: 1.05,
          letterSpacing: "-0.01em",
          color: "#000000",
        }}
      >
        {project.title}
      </h3>

      {/* Clamped summary — the full story lives in the case file */}
      <p
        className="font-sans mb-4"
        style={{
          fontSize: "15px",
          lineHeight: 1.6,
          color: "#1A1A1A",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {project.description}
      </p>

      {/* Stack as a typed list */}
      <p className="typed-list mb-5">{project.tags.map((t) => t.toLowerCase()).join(" / ")}</p>

      {/* Links */}
      <div className="flex items-center gap-6">
        <button type="button" onClick={openCase} className="typed-link">
          open case file &rarr;
        </button>
        {project.url && (
          <a href={project.url} target="_blank" rel="noopener noreferrer" className="typed-link">
            live &#8599;
          </a>
        )}
        {project.github && (
          <a href={project.github} target="_blank" rel="noopener noreferrer" className="typed-link">
            source &#8599;
          </a>
        )}
      </div>
    </motion.div>
  );
}
