"use client";

import { memo } from "react";
import { useStore } from "@/lib/store";

const sectionList = [
  { id: "hero", label: "01" },
  { id: "about", label: "02" },
  { id: "projects", label: "03–04" },
  { id: "research", label: "05" },
  { id: "contact", label: "06" },
];

const sectionOrder: Record<string, number> = {
  hero: 0, about: 1, projects: 2, research: 3, contact: 4,
};

const SectionNav = memo(function SectionNav() {
  // Subscribe to activeSection (changes ~5 times) instead of scrollProgress (changes 60fps)
  const activeSection = useStore((s) => s.activeSection);
  const activeIdx = sectionOrder[activeSection] ?? 0;

  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav
      className="fixed right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-3 z-[25]"
      aria-label="Section navigation"
    >
      {sectionList.map((section, i) => (
        <button
          key={section.id}
          onClick={() => handleClick(section.id)}
          className="group relative flex items-center"
          aria-label={`Go to ${section.id}`}
          aria-current={i === activeIdx ? "true" : undefined}
        >
          <div
            className="w-2 h-2 rounded-full transition-all duration-300"
            style={{
              backgroundColor: i === activeIdx ? "#0099FF" : "rgba(0,0,0,0.2)",
              transform: i === activeIdx ? "scale(1.3)" : "scale(1)",
            }}
          />
          <span
            className="absolute right-5 font-mono text-[9px] tracking-[0.15em] opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap"
            style={{ color: "#333333" }}
          >
            {section.label}
          </span>
        </button>
      ))}
    </nav>
  );
});

export default SectionNav;
