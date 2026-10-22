"use client";

import { useRouter } from "next/navigation";
import { StuffCollection, stuffCollections, loggedCount } from "@/content/stuff";
import SeededPageShell from "@/components/shared/SeededPageShell";
import StuffCard from "@/components/overlay/sections/StuffCard";
import { openVeil } from "@/components/shared/Veil";
import HardwareGallery from "@/components/stuff/HardwareGallery";
import MediaGallery from "@/components/stuff/MediaGallery";

/**
 * Catalogue page for one "my stuff" collection. A ledger, not an essay:
 * file header, standfirst, then a mono-ruled table of entries. Unlogged
 * slots render as explicit empty rows (the catalogue is honestly in
 * progress), and the other four collections sit in a strip at the end so
 * the index can be browsed end to end without going back home.
 */
export default function StuffPage({ collection }: { collection: StuffCollection }) {
  const router = useRouter();
  const logged = loggedCount(collection);
  const total = collection.items.length;
  const others = stuffCollections.filter((c) => c.id !== collection.id);
  const ordinal = stuffCollections.findIndex((c) => c.id === collection.id);

  const goHome = () => openVeil(() => router.push("/#stuff"));

  return (
    <SeededPageShell
      seedKey={`stuff-${collection.id}`}
      kind="catalogue"
      densityOverride={0.2}
      breadcrumb={`My stuff / ${collection.id}`}
    >
      <article className={`px-6 md:px-12 lg:px-20 mt-14 md:mt-20 pb-28 ${collection.id === "hardware" ? "max-w-[1440px]" : collection.id === "media" ? "max-w-[1180px]" : "max-w-[1080px]"}`}>
        {/* File header */}
        <div className="flex items-center gap-4 mb-6">
          <span className="mark-caption" style={{ fontSize: 10 }}>
            {String(ordinal + 1).padStart(2, "0")} / {collection.code.toLowerCase()} / {logged} of {total} logged
          </span>
        </div>

        <h1
          className="uppercase mb-6"
          style={{
            fontFamily: "var(--font-display), var(--font-sans), sans-serif",
            fontWeight: 800,
            fontStretch: "122%",
            fontSize: "clamp(44px, 8vw, 118px)",
            lineHeight: 0.92,
            letterSpacing: "-0.015em",
            color: "#000000",
          }}
        >
          {collection.title}
        </h1>

        {collection.id !== "hardware" && <p
          className="content-panel inline-block mb-14"
          style={{
            fontFamily: "var(--font-accent), Georgia, serif",
            fontSize: "clamp(17px, 1.9vw, 21px)",
            lineHeight: 1.55,
            color: "#1A1A1A",
            maxWidth: "640px",
          }}
        >
          {collection.standfirst}
        </p>}

        {/* Ledger */}
        {collection.id === "hardware" ? <HardwareGallery /> : collection.id === "media" ? <MediaGallery /> : <div className="stuff-ledger content-panel">
          <div className="stuff-row stuff-row-head font-mono" aria-hidden="true">
            <span>#</span>
            <span>Entry</span>
            <span>Note</span>
            <span>{collection.metaLabel}</span>
          </div>
          {collection.items.map((item, i) =>
            item.pending ? (
              <div key={i} className="stuff-row stuff-row-pending font-mono">
                <span>{String(i + 1).padStart(2, "0")}</span>
                <span className="stuff-pending-label">unlogged entry</span>
                <span className="stuff-pending-line" />
                <span className="stuff-pending-line" />
              </div>
            ) : (
              <div key={i} className="stuff-row">
                <span className="font-mono">{String(i + 1).padStart(2, "0")}</span>
                <span className="stuff-row-name">
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      {item.name} <span aria-hidden="true">&#8599;</span>
                    </a>
                  ) : (
                    item.name
                  )}
                </span>
                <span className="stuff-row-note">{item.note}</span>
                <span className="font-mono stuff-row-meta">{item.meta}</span>
              </div>
            )
          )}
        </div>}

        {logged < total && (
          <p className="mark-caption mt-4" style={{ fontSize: 9 }}>
            catalogue in progress — {total - logged} slot{total - logged === 1 ? "" : "s"} still open
          </p>
        )}

        {/* Cross-navigation */}
        <div className="mt-24">
          <div className="caption-rule mb-6">
            <span>other files</span>
            <i />
          </div>
          <div className="stuff-grid stuff-grid-mini">
            {others.map((c) => (
              <div key={c.id} className="stuff-grid-cell">
                <StuffCard collection={c} index={stuffCollections.indexOf(c)} mini />
              </div>
            ))}
          </div>
          <button type="button" onClick={goHome} className="typed-link mt-12" aria-label="Back to the index">
            &larr; back to index
          </button>
        </div>
      </article>
    </SeededPageShell>
  );
}
