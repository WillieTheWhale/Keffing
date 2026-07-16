"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Project } from "@/content/projects";
import { useStore } from "@/lib/store";
import { SKY_PHOTOS_FULL } from "@/lib/fragments";
import GlitchLayer from "@/components/overlay/glitch/GlitchLayer";
import FilmGrain from "@/components/overlay/glitch/FilmGrain";
import FragmentsLayer from "@/components/canvas/FragmentsLayer";
import Veil, { openVeil } from "@/components/shared/Veil";
import CursorReticle from "@/components/shared/CursorReticle";

const LineCanvas = dynamic(() => import("@/components/canvas/LineCanvas"), {
  ssr: false,
  loading: () => null,
});

/**
 * Case study template — SIGNAL/NOISE roadmap W8-9.
 * The full generative background carries over, but RE-SEEDED per project:
 * every case study gets its own line composition in the same family.
 * Density is pinned to "structured medium" — the content is the signal here.
 */

function hashSlug(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

interface CaseStudyProps {
  project: Project;
  kind: "experience" | "project";
}

export default function CaseStudy({ project, kind }: CaseStudyProps) {
  const router = useRouter();
  const [revealed, setRevealed] = useState(false);

  const heroSky = useMemo(
    () => SKY_PHOTOS_FULL[hashSlug(project.id) % SKY_PHOTOS_FULL.length],
    [project.id]
  );

  // Re-seed the generative background for this project; pin density; restore on leave.
  useEffect(() => {
    const prevSeed = useStore.getState().seed;
    useStore.setState({ seed: hashSlug(project.id), densityOverride: 0.45, entryDone: true });
    const root = document.documentElement;
    const vars: [string, string][] = [
      ["--density-fragments", "0.45"],
      ["--density-glitch", "0.3"],
      ["--density-dust", "0.3"],
      ["--density-rects", "0.35"],
      ["--density-atmosphere", "0.25"],
      ["--tune", "0"],
    ];
    vars.forEach(([k, v]) => root.style.setProperty(k, v));
    const t = setTimeout(() => setRevealed(true), 60);
    return () => {
      clearTimeout(t);
      useStore.setState({ seed: prevSeed, densityOverride: null });
    };
  }, [project.id]);

  const back = () => openVeil(() => router.push("/"));

  return (
    <div className="min-h-screen">
      {/* Reveal wipe on arrival (inverse of the veil) */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 65,
          backgroundColor: "#020204",
          clipPath: revealed ? "inset(100% 0 0 0)" : "inset(0 0 0 0)",
          transition: "clip-path 520ms var(--ease-tune)",
        }}
        aria-hidden="true"
      />

      {/* Generative background, re-seeded for this project */}
      <LineCanvas />
      <FragmentsLayer />
      <GlitchLayer />
      <FilmGrain />
      <CursorReticle />
      <Veil />

      <main className="relative" style={{ zIndex: 20 }}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 md:px-12 pt-8">
          <button
            type="button"
            onClick={back}
            className="font-mono text-[11px] tracking-[0.2em] uppercase"
            style={{
              color: "#1A1A1A",
              background: "rgba(255,255,255,0.85)",
              border: "1px solid rgba(0,0,0,0.25)",
              padding: "10px 14px",
              cursor: "pointer",
            }}
          >
            &larr; Index
          </button>
          <span
            className="font-mono text-[10px] tracking-[0.3em] uppercase"
            style={{ color: "#333333" }}
          >
            {kind === "experience" ? "Experience file" : "Project file"} / {project.id}
          </span>
        </div>

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

          {/* Sky media band in the fragment language */}
          <div
            className="mt-10 relative overflow-hidden"
            style={{
              height: "min(46vh, 460px)",
              clipPath: "polygon(0 4%, 100% 0, 99% 96%, 1% 100%)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroSky}
              alt=""
              className="w-full h-full object-cover"
              style={{ transform: "scale(1.06)" }}
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
              <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-3" style={{ color: "#0099FF" }}>
                Stack
              </div>
              <div className="flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="font-mono text-[10px] tracking-wider uppercase px-2 py-1"
                    style={{ color: "#333333", backgroundColor: "rgba(0,153,255,0.07)" }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            {(project.url || project.github) && (
              <div>
                <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-3" style={{ color: "#0099FF" }}>
                  Channels
                </div>
                <div className="flex flex-col gap-2">
                  {project.url && (
                    <a href={project.url} target="_blank" rel="noopener noreferrer" className="font-mono text-[12px]" style={{ color: "#1A1A1A" }}>
                      Live &rarr;
                    </a>
                  )}
                  {project.github && (
                    <a href={project.github} target="_blank" rel="noopener noreferrer" className="font-mono text-[12px]" style={{ color: "#1A1A1A" }}>
                      Source &rarr;
                    </a>
                  )}
                </div>
              </div>
            )}
            <div>
              <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-3" style={{ color: "#0099FF" }}>
                Signature
              </div>
              <p className="font-mono text-[10px] leading-relaxed" style={{ color: "#666" }}>
                This page&apos;s background composition is seeded by the project id —
                no two case files share a burst.
              </p>
            </div>
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
      </main>
    </div>
  );
}
