"use client";

import { useRef } from "react";
import { useInView } from "framer-motion";
import { stuffCollections } from "@/content/stuff";
import StuffCard from "./StuffCard";
import SectionTitle from "@/components/shared/SectionTitle";

/**
 * My stuff — the personal index. Replaces the Writing section: five small
 * file cards (hardware, software, media, Stüssy, reading) that each open
 * into a full catalogue page. Kept deliberately compact — a strip of tiles,
 * not a wall of editorial cards — so it reads as a different content type
 * from Projects and Experience.
 */
export default function StuffSection() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="stuff" ref={ref} className="relative py-32" aria-label="My stuff">
      <div className="w-full px-6 md:px-12 lg:px-20">
        <SectionTitle num="04" eyebrow="Personal index" title="MY STUFF" inView={isInView} />

        <div className="stuff-grid">
          {stuffCollections.map((c, i) => (
            <div
              key={c.id}
              className="stuff-grid-cell"
              style={{
                opacity: isInView ? 1 : 0,
                transform: isInView ? "translateY(0)" : "translateY(18px)",
                transition: `opacity 600ms var(--ease-reveal) ${140 + i * 70}ms, transform 600ms var(--ease-reveal) ${140 + i * 70}ms`,
              }}
            >
              <StuffCard collection={c} index={i} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
