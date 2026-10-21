"use client";

import dynamic from "next/dynamic";
import LenisProvider from "@/components/shared/LenisProvider";
import EntrySequence from "@/components/overlay/EntrySequence";
import SectionNav from "@/components/shared/SectionNav";
import IndexMenu from "@/components/shared/IndexMenu";
import Veil from "@/components/shared/Veil";
import HeroSection from "@/components/overlay/sections/HeroSection";
import AboutSection from "@/components/overlay/sections/AboutSection";
import WorkSection from "@/components/overlay/sections/WorkSection";
import StuffSection from "@/components/overlay/sections/StuffSection";
import ExperienceSection from "@/components/overlay/sections/ExperienceSection";
import ContactSection from "@/components/overlay/sections/ContactSection";
import Dive from "@/components/background/Dive";

// The ALLOY background (components/background): liquid chrome and glass with
// drawn porcelain in one three.js world, over its own paper, sky panels and
// print layout. It replaces the old line canvas and the stock ambient layers
// on the home page; detail pages still use SeededPageShell / DocumentPage.
const Background = dynamic(() => import("@/components/background/Background"), {
  ssr: false,
  loading: () => null,
});

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

      {/* [z:0–3] Background: paper, print layout, the WebGL world */}
      <Background />

      {/* [z:25] Section navigation dots */}
      <SectionNav />

      {/* [z:40/45] Index chip + full-screen menu (W4) */}
      <IndexMenu />

      {/* [z:70] Route veil — the tuning move for navigation (W9) */}
      <Veil />

      {/* [z:20] HTML content - scrollable sections */}
      <main id="main-content" className="content-layer">
        <HeroSection />
        <AboutSection />
        <WorkSection />
        <StuffSection />
        <ExperienceSection />
        <ContactSection />

        {/* The finale — "through the mirror": the camera flies into the
            contact mass and its reflected sky becomes the end card. */}
        <Dive />
      </main>
    </LenisProvider>
  );
}
