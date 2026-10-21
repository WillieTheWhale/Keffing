"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { pinLayers } from "@/lib/tuning";
import GlitchLayer from "@/components/overlay/glitch/GlitchLayer";
import FilmGrain from "@/components/overlay/glitch/FilmGrain";
import FragmentsLayer from "@/components/canvas/FragmentsLayer";
import Veil, { openVeil } from "@/components/shared/Veil";

const LineCanvas = dynamic(() => import("@/components/canvas/LineCanvas"), {
  ssr: false,
  loading: () => null,
});

/**
 * Shared shell for any full-page detail view whose background should be
 * re-seeded per item (case studies, articles, …) — the full generative
 * background carries over but gets its OWN line composition, pinned to a
 * quiet fixed density since the content is the signal on these pages.
 * Extracted from the original CaseStudy template (roadmap W8-9) once the
 * Writing section needed the identical pattern for article pages, rather
 * than re-copy the background-layer + re-seed + reveal-wipe plumbing.
 */

interface SeededPageShellProps {
  /** Stable id (project slug, post slug, …) — the background's seed. */
  seedKey: string;
  /** Pinned line-canvas density while on this page. */
  densityOverride?: number;
  /** Mono breadcrumb in the top bar, e.g. "Project file / blockd". */
  breadcrumb: string;
  children: React.ReactNode;
}

export default function SeededPageShell({
  seedKey,
  densityOverride = 0.45,
  breadcrumb,
  children,
}: SeededPageShellProps) {
  const router = useRouter();
  const [revealed, setRevealed] = useState(false);

  // Same composition as the home page, held at a quiet fixed density with the
  // ambient layers pinned; restored on leave.
  useEffect(() => {
    useStore.setState({ densityOverride, entryDone: true });
    pinLayers({ fragments: 0.55, glitch: 0.3, dust: 0.3, rects: 0.45, atmosphere: 0.3, beat: 0 });
    const t = setTimeout(() => setRevealed(true), 60);
    return () => {
      clearTimeout(t);
      pinLayers(null);
      useStore.setState({ densityOverride: null });
    };
  }, [seedKey, densityOverride]);

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

      {/* Generative background, re-seeded for this item */}
      <LineCanvas />
      <FragmentsLayer />
      <GlitchLayer />
      <FilmGrain />
      <Veil />

      {/* Same composition, lifted toward white — the detail pages read quieter */}
      <div className="page-wash" aria-hidden="true" />

      <main className="relative" style={{ zIndex: 20 }}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 md:px-12 pt-8">
          <button type="button" onClick={back} className="typed-link">
            &larr; index
          </button>
          <span className="mark-caption" style={{ fontSize: 9 }}>
            {breadcrumb.toLowerCase().replace(/\s*\/\s*/g, "/")}
          </span>
        </div>

        {children}
      </main>
    </div>
  );
}
