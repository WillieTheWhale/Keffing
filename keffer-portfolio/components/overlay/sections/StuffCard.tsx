"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { StuffCollection, loggedCount } from "@/content/stuff";
import { hashSlug } from "@/lib/generative";
import { openVeil } from "@/components/shared/Veil";

/**
 * Index tile for one "my stuff" collection: file code, an oblique record
 * number, a screen-printed strip under a hairline, the title in the
 * display voice, one typed line, and the entry count. Hover tints the
 * screen the reference's cornflower blue.
 */

interface StuffCardProps {
  collection: StuffCollection;
  index: number;
  /** Smaller variant for the cross-navigation strip on catalogue pages. */
  mini?: boolean;
  /** Marks the collection currently open (mini strip only). */
  current?: boolean;
}

export default function StuffCard({ collection, index, mini = false, current = false }: StuffCardProps) {
  const router = useRouter();
  const code = useMemo(() => "0x" + (hashSlug(collection.id) & 0xffffff).toString(16).padStart(6, "0"), [collection.id]);
  const logged = loggedCount(collection);
  const open = () => {
    if (current) return;
    openVeil(() => router.push(`/stuff/${collection.id}`));
  };

  return (
    <button
      type="button"
      onClick={open}
      className={`stuff-card content-panel text-left${mini ? " stuff-card-mini" : ""}${current ? " stuff-card-current" : ""}`}
      aria-label={`Open ${collection.title}`}
      aria-current={current ? "page" : undefined}
      disabled={current}
    >
      <div className="flex items-center justify-between">
        <span className="mark-caption">{String(index + 1).padStart(2, "0")} / {collection.code.toLowerCase()}</span>
        <span className="mark-caption">{code}</span>
      </div>

      <span className="stuff-card-screen" aria-hidden="true" />

      <h3 className="stuff-card-title">{collection.title}</h3>
      <p className="stuff-card-desc font-mono">{collection.descriptor}</p>

      <span className="stuff-card-cta font-mono">
        {logged > 0 ? `${logged} logged` : "catalogue open"}
        <span aria-hidden="true">&rarr;</span>
      </span>
    </button>
  );
}
