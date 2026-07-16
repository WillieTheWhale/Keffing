"use client";

import dynamic from "next/dynamic";
import LenisProvider from "@/components/shared/LenisProvider";
import EntrySequence from "@/components/overlay/EntrySequence";
import GlitchLayer from "@/components/overlay/glitch/GlitchLayer";
import BlackRectangles from "@/components/overlay/glitch/BlackRectangles";
import FragmentsLayer from "@/components/canvas/FragmentsLayer";
import ParticleDust from "@/components/overlay/glitch/ParticleDust";
import FilmGrain from "@/components/overlay/glitch/FilmGrain";
import AtmosphereLayer from "@/components/overlay/atmosphere/AtmosphereLayer";
import TuningBeatOverlay from "@/components/overlay/TuningBeatOverlay";
import SectionNav from "@/components/shared/SectionNav";
import IndexMenu from "@/components/shared/IndexMenu";
import CursorReticle from "@/components/shared/CursorReticle";
import Veil from "@/components/shared/Veil";
import HeroSection from "@/components/overlay/sections/HeroSection";
import AboutSection from "@/components/overlay/sections/AboutSection";
import ProjectsSection from "@/components/overlay/sections/ProjectsSection";
import ResearchSection from "@/components/overlay/sections/ResearchSection";
import ContactSection from "@/components/overlay/sections/ContactSection";
import DiveSection from "@/components/overlay/sections/DiveSection";

// Dynamic import canvas-based line system (no SSR)
const LineCanvas = dynamic(
  () => import("@/components/canvas/LineCanvas"),
  { ssr: false, loading: () => null }
);

export default function Home() {
  return (
    <LenisProvider>
      {/* Skip link for accessibility (§15) */}
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      {/* Layer Stack (§3.1, §7.1) - z-index ordering */}

      {/* [z:50] Entry boot sequence — transmission acquiring lock (W3) */}
      <EntrySequence />

      {/* [z:1] Line burst canvas - explosive sweeping curves */}
      <LineCanvas />

      {/* [z:2] Sky photo fragments — WebGL shader planes with CSS fallback (W6-7) */}
      <FragmentsLayer />

      {/* [z:3] Solid black rectangles - visual weight anchors */}
      <BlackRectangles />

      {/* [z:4] Particle dust - tiny scattered dots */}
      <ParticleDust />

      {/* [z:6] Glitch-UI artifacts - crosses, dots, rules, timecodes */}
      <GlitchLayer />

      {/* [z:7] Film grain overlay */}
      <FilmGrain />

      {/* [z:15] Atmospheric text - poetic text with parallax */}
      <AtmosphereLayer />

      {/* [z:16] Tuning beat — full-composition implosion flash (W4, reworked) */}
      <TuningBeatOverlay />

      {/* [z:25] Section navigation dots */}
      <SectionNav />

      {/* [z:40/45] Index chip + full-screen menu (W4) */}
      <IndexMenu />

      {/* [z:60] Cursor reticle — viewfinder annotation (W7) */}
      <CursorReticle />

      {/* [z:70] Route veil — the tuning move for navigation (W9) */}
      <Veil />

      {/* [z:20] HTML content - scrollable sections */}
      <main id="main-content" className="content-layer">
        <HeroSection />
        <AboutSection />
        <ProjectsSection />
        <ResearchSection />
        <ContactSection />

        {/* The Dive — finale: tunnel into the composition, resolve to pure
            signal. Colophon lives inside it (W10). */}
        <DiveSection />
      </main>
    </LenisProvider>
  );
}
