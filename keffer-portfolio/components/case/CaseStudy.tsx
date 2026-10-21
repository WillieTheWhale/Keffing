"use client";

import { useMemo } from "react";
import { Project } from "@/content/projects";
import { SKY_PHOTOS_FULL } from "@/lib/fragments";
import { hashSlug } from "@/lib/generative";
import SeededPageShell from "@/components/shared/SeededPageShell";

/**
 * Case study template — SIGNAL/NOISE roadmap W8-9.
 * The full generative background carries over via SeededPageShell, but
 * RE-SEEDED per project: every case study gets its own line composition in
 * the same family. Density is pinned to "structured medium" — the content
 * is the signal here.
 */

interface CaseStudyProps {
  project: Project;
  kind: "experience" | "project";
}

export default function CaseStudy({ project, kind }: CaseStudyProps) {
  const heroSky = useMemo(
    () => SKY_PHOTOS_FULL[hashSlug(project.id) % SKY_PHOTOS_FULL.length],
    [project.id]
  );

  return (
    <SeededPageShell
      seedKey={project.id}
      densityOverride={0.45}
      breadcrumb={`${kind === "experience" ? "Experience file" : "Project file"} / ${project.id}`}
    >
      {/* Hero band */}
      <header className="px-6 md:px-12 lg:px-20 mt-16 md:mt-24">
        <h1
          className="uppercase"
          style={{
            fontFamily: "var(--font-display), var(--font-sans), sans-serif",
            fontWeight: 800,
            fontStretch: "122%",
            fontSize: "clamp(40px, 7vw, 110px)",
            lineHeight: 0.95,
            letterSpacing: "-0.015em",
            color: "#000000",
            maxWidth: "18ch",
          }}
        >
          {project.title}
        </h1>

        {/* Photograph band, screen-printed */}
        <div
          className="mt-10 relative overflow-hidden sky-print"
          style={{ height: "min(46vh, 460px)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroSky}
            alt=""
            className="w-full h-full object-cover"
            style={{ transform: "scale(1.06)" }}
            decoding="async"
          />
          {project.image && (
            <div
              className="absolute bottom-6 left-6 flex items-center gap-3"
              style={{
                background: "rgba(255,255,255,0.9)",
                padding: "10px 14px",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={project.image} alt={`${project.title} logo`} style={{ width: 28, height: 28, objectFit: "contain" }} />
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: "#1A1A1A" }}>
                {project.title}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Body: sticky metadata rail + prose */}
      <div className="px-6 md:px-12 lg:px-20 mt-16 md:mt-24 pb-32 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-12 md:gap-20">
        <aside className="md:sticky md:top-12 self-start space-y-8">
          <div>
            <div className="caption-rule mb-3"><span>stack</span><i /></div>
            <p className="typed-list">{project.tags.map((t) => t.toLowerCase()).join(" / ")}</p>
          </div>
          {(project.url || project.github) && (
            <div>
              <div className="caption-rule mb-3"><span>channels</span><i /></div>
              <div className="flex flex-col gap-3 items-start">
                {project.url && (
                  <a href={project.url} target="_blank" rel="noopener noreferrer" className="typed-link">live &#8599;</a>
                )}
                {project.github && (
                  <a href={project.github} target="_blank" rel="noopener noreferrer" className="typed-link">source &#8599;</a>
                )}
              </div>
            </div>
          )}
        </aside>

        <article className="content-panel max-w-[720px]">
          <p
            className="font-sans"
            style={{ fontSize: "17px", lineHeight: 1.75, color: "#1A1A1A" }}
          >
            {project.description}
          </p>
        </article>
      </div>
    </SeededPageShell>
  );
}
