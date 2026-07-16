"use client";

import { useMemo, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useRouter } from "next/navigation";
import { Project } from "@/content/projects";
import { springs } from "@/lib/tokens";
import { useStore } from "@/lib/store";
import { SKY_PHOTOS } from "@/lib/fragments";
import { openVeil } from "@/components/shared/Veil";

/**
 * Project card as an editorial spread — SIGNAL/NOISE roadmap W8.
 * Media well in the sky-fragment language, display-face title, clamped
 * summary (full story lives in the case file), and a case-study link that
 * departs through the veil. Hover assembles the card: the media well and
 * accent settle into place.
 */

interface ProjectCardProps {
  project: Project;
  index: number;
  isLeft: boolean;
}

function hashSlug(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

export default function ProjectCard({ project, index, isLeft }: ProjectCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const deviceTier = useStore((s) => s.deviceTier);
  const router = useRouter();
  const isMobile = deviceTier === "mobile";

  const coverSky = useMemo(
    () => SKY_PHOTOS[hashSlug(project.id) % SKY_PHOTOS.length],
    [project.id]
  );

  const openCase = () => openVeil(() => router.push(`/work/${project.id}`));

  return (
    <motion.div
      ref={ref}
      className={`project-card relative max-w-[520px] content-panel ${
        isMobile
          ? "mx-auto"
          : isLeft
            ? "mr-auto ml-[5%] md:ml-[10%]"
            : "ml-auto mr-[5%] md:mr-[10%]"
      }`}
      style={{
        marginTop: index === 0 ? 0 : `${60 + (index % 3) * 20}px`,
      }}
      initial={{ opacity: 0, y: 30, x: isMobile ? 0 : isLeft ? -20 : 20 }}
      animate={isInView ? { opacity: 1, y: 0, x: 0 } : {}}
      transition={{ type: "spring", ...springs.gentle, delay: 0.1 }}
    >
      {/* Media well — seeded sky fragment, cut in the collage language */}
      <button
        type="button"
        onClick={openCase}
        className="project-card-media relative block w-full overflow-hidden mb-5"
        style={{
          height: "170px",
          clipPath: "polygon(0 3%, 100% 0, 98% 97%, 2% 100%)",
          cursor: "pointer",
          border: "none",
          padding: 0,
          background: "none",
        }}
        aria-label={`Open case study: ${project.title}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverSky}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
          draggable={false}
        />
        <span
          className="absolute top-3 left-3 font-mono text-[10px] tracking-[0.2em]"
          style={{ color: "#FFFFFF", textShadow: "0 0 6px rgba(0,0,0,0.5)" }}
        >
          {String(index + 1).padStart(2, "0")} / FILE:{project.id.toUpperCase()}
        </span>
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
              draggable={false}
            />
          </span>
        )}
      </button>

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

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-5">
        {project.tags.map((tag) => (
          <span
            key={tag}
            className="font-mono text-[10px] tracking-wider uppercase px-2 py-0.5"
            style={{ color: "#333333", backgroundColor: "rgba(0, 153, 255, 0.06)" }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Links */}
      <div className="flex items-center gap-5">
        <button
          type="button"
          onClick={openCase}
          className="font-mono text-[12px] tracking-wide"
          style={{ color: "#0099FF", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          Open case file &rarr;
        </button>
        {project.url && (
          <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[12px] tracking-wide transition-colors hover:opacity-70"
            style={{ color: "#333333" }}
          >
            Live
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

      {/* Accent border assembles on hover */}
      {!isMobile && (
        <motion.div
          className="project-card-accent absolute -left-4 top-0 w-px h-full origin-top"
          style={{ backgroundColor: "rgba(0, 153, 255, 0.2)" }}
          initial={{ scaleY: 0 }}
          animate={isInView ? { scaleY: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.3 }}
        />
      )}
    </motion.div>
  );
}
