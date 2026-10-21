"use client";

import { memo } from "react";
import { useStore } from "@/lib/store";
import { SECTIONS } from "@/lib/sections";
import { scrollToSection } from "@/lib/scroll";

const sectionList = SECTIONS.filter((s) => !s.hideFromNav);
const sectionOrder: Record<string, number> = Object.fromEntries(sectionList.map((s, i) => [s.id, i]));

/**
 * Channel rail — the section indicator as a tuning dial rather than generic
 * dots: a column of ticks, the active channel drawn long and cyan with its
 * number beside it. Subscribes to activeSection (changes a handful of times
 * per visit), never to scrollProgress.
 */
const SectionNav = memo(function SectionNav() {
  const activeSection = useStore((s) => s.activeSection);
  // The Dive is hidden from the rail: while it's active, nothing lights up.
  const activeIdx = sectionOrder[activeSection] ?? -1;

  return (
    <nav className="section-rail fixed z-[25]" aria-label="Section navigation">
      {sectionList.map((section, i) => {
        const on = i === activeIdx;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => scrollToSection(section.id)}
            className={`section-rail-item${on ? " on" : ""}`}
            aria-label={`Go to ${section.indexLabel.toLowerCase()}`}
            aria-current={on ? "true" : undefined}
          >
            <span className="section-rail-num font-mono">{section.num}</span>
            <span className="section-rail-tick" aria-hidden="true" />
            <span className="section-rail-label font-mono">{section.indexLabel}</span>
          </button>
        );
      })}
    </nav>
  );
});

export default SectionNav;
