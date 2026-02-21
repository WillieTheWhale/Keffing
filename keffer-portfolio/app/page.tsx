"use client";

import dynamic from "next/dynamic";
import LenisProvider from "@/components/shared/LenisProvider";
import GlitchLayer from "@/components/overlay/glitch/GlitchLayer";
import BlackRectangles from "@/components/overlay/glitch/BlackRectangles";
import SkyFragmentsCSS from "@/components/overlay/glitch/SkyFragmentsCSS";
import ParticleDust from "@/components/overlay/glitch/ParticleDust";
import FilmGrain from "@/components/overlay/glitch/FilmGrain";
import AtmosphereLayer from "@/components/overlay/atmosphere/AtmosphereLayer";
import SectionNav from "@/components/shared/SectionNav";
import SeedTester from "@/components/shared/SeedTester";
import HeroSection from "@/components/overlay/sections/HeroSection";
import AboutSection from "@/components/overlay/sections/AboutSection";
import ProjectsSection from "@/components/overlay/sections/ProjectsSection";
import ResearchSection from "@/components/overlay/sections/ResearchSection";
import ContactSection from "@/components/overlay/sections/ContactSection";

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

      {/* [z:1] Line burst canvas - explosive sweeping curves */}
      <LineCanvas />

      {/* [z:2] Sky photo fragments - large prominent rectangles */}
      <SkyFragmentsCSS />

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

      {/* [z:25] Section navigation dots */}
      <SectionNav />

      {/* Seed tester UI — remove after selecting final seed */}
      <SeedTester />

      {/* [z:20] HTML content - scrollable sections */}
      <main id="main-content" className="content-layer">
        <HeroSection />
        <AboutSection />
        <ProjectsSection />
        <ResearchSection />
        <ContactSection />

        <footer className="py-8 px-6 md:px-12" aria-label="Footer">
          <p
            className="font-mono text-center"
            style={{
              fontSize: "10px",
              letterSpacing: "0.15em",
              color: "#CCCCCC",
            }}
          >
            &copy; {new Date().getFullYear()} William Keffer. All rights reserved.
          </p>
        </footer>
      </main>
    </LenisProvider>
  );
}
