"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useViewport } from "@/hooks/useViewport";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import Veil, { openVeil } from "@/components/shared/Veil";
import type { PageKind } from "@/components/background/pieces";

// The home page's ALLOY background, in its page arrangement (pieces.ts
// pageGroups, layout2d pageItems): a mass by the title in the free top
// corner, its ribbon down the free margin, seeded by the page's slug.
const Background = dynamic(() => import("@/components/background/Background"), {
  ssr: false,
  loading: () => null,
});

/**
 * Shared shell for the inner pages (project and experience files, the My
 * stuff catalogues): the ALLOY background in a page-shaped arrangement seeded
 * by the item, the arrival wipe, and the top bar.
 */

interface SeededPageShellProps {
  /** Stable id (project slug, post slug, …) — the background's seed. */
  seedKey: string;
  /** Which page arrangement of the background: project files or catalogues. */
  kind?: Extract<PageKind, "case" | "catalogue">;
  /** Mono breadcrumb in the top bar, e.g. "Project file / blockd". */
  breadcrumb: string;
  children: React.ReactNode;
}

export default function SeededPageShell({
  seedKey,
  kind = "case",
  breadcrumb,
  children,
}: SeededPageShellProps) {
  const router = useRouter();
  const [revealed, setRevealed] = useState(false);
  // the background picks its quality from the device tier and motion setting
  useViewport();
  useReducedMotion();

  useEffect(() => {
    useStore.setState({ entryDone: true });
    const t = setTimeout(() => setRevealed(true), 60);
    return () => clearTimeout(t);
  }, [seedKey]);

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

      {/* [z:0–3] Background: paper, print layout, the WebGL world — seeded by this item */}
      <Background pageKind={kind} pageSlug={seedKey} />
      <Veil />

      {/* overflow-x clip: a long title must not widen the page on a phone (see .content-layer) */}
      <main className="relative" style={{ zIndex: 20, overflowX: "clip" }}>
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
