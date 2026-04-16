"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { springs } from "@/lib/tokens";
import GlitchLayer from "@/components/overlay/glitch/GlitchLayer";
import BlackRectangles from "@/components/overlay/glitch/BlackRectangles";
import SkyFragmentsCSS from "@/components/overlay/glitch/SkyFragmentsCSS";
import ParticleDust from "@/components/overlay/glitch/ParticleDust";
import FilmGrain from "@/components/overlay/glitch/FilmGrain";
import AtmosphereLayer from "@/components/overlay/atmosphere/AtmosphereLayer";
import { useViewport } from "@/hooks/useViewport";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const LineCanvas = dynamic(
  () => import("@/components/canvas/LineCanvas"),
  { ssr: false, loading: () => null }
);

interface DocumentPageProps {
  /** Paths to page images in /public (e.g. ["/docs/resume-1.png"]) */
  images: string[];
  /** Document title shown in the header marker */
  title: string;
  /** Section number displayed in the marker (e.g. "01") */
  sectionNumber?: string;
  /** Path to the original PDF for download */
  pdfPath: string;
}

export default function DocumentPage({
  images,
  title,
  sectionNumber = "01",
  pdfPath,
}: DocumentPageProps) {
  // Initialize viewport detection and reduced motion preference
  useViewport();
  useReducedMotion();

  return (
    <>
      {/* Background layer stack -- identical to main site */}
      <LineCanvas />
      <SkyFragmentsCSS />
      <BlackRectangles />
      <ParticleDust />
      <GlitchLayer />
      <FilmGrain />
      <AtmosphereLayer />

      {/* Content layer */}
      <main id="main-content" className="content-layer">
        <section
          className="relative flex items-center justify-center py-32 px-6 md:px-12 lg:px-20"
          style={{ minHeight: "100vh" }}
          aria-label={title}
        >
          <div
            className="w-full"
            style={{ maxWidth: "960px" }}
          >
            {/* Frosted-glass panel */}
            <div className="content-panel">
              {/* Section marker -- matches site pattern */}
              <motion.div
                className="flex items-center gap-3 mb-8"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", ...springs.gentle }}
              >
                <a
                  href="/"
                  className="font-mono"
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.15em",
                    color: "#0099FF",
                    textDecoration: "none",
                  }}
                >
                  {sectionNumber}
                </a>
                <div
                  className="h-px w-10"
                  style={{ backgroundColor: "#0099FF" }}
                />
                <span
                  className="font-mono"
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.15em",
                    color: "#333333",
                    textTransform: "uppercase",
                  }}
                >
                  {title}
                </span>
              </motion.div>

              {/* Document image(s) */}
              {images.map((src, i) => (
                <motion.div
                  key={src}
                  style={{
                    marginBottom: i < images.length - 1 ? "12px" : "0",
                  }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    type: "spring",
                    ...springs.gentle,
                    delay: 0.15 + i * 0.15,
                  }}
                >
                  <div
                    style={{
                      border: "1px solid rgba(0, 0, 0, 0.06)",
                      lineHeight: 0,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`${title} — page ${i + 1}`}
                      style={{
                        width: "100%",
                        height: "auto",
                        display: "block",
                      }}
                    />
                  </div>
                </motion.div>
              ))}

              {/* Actions row */}
              <motion.div
                className="flex items-center justify-between mt-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.6 }}
              >
                <a
                  href="/"
                  className="font-mono"
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.15em",
                    color: "#0099FF",
                    textDecoration: "none",
                    borderBottom: "1px solid rgba(0, 153, 255, 0.3)",
                    paddingBottom: "2px",
                  }}
                >
                  &larr; BACK
                </a>
                <a
                  href={pdfPath}
                  download
                  className="font-mono"
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.15em",
                    color: "#0099FF",
                    textDecoration: "none",
                    borderBottom: "1px solid rgba(0, 153, 255, 0.3)",
                    paddingBottom: "2px",
                  }}
                >
                  DOWNLOAD PDF &darr;
                </a>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-6 md:px-12" aria-label="Footer">
          <p
            className="font-mono text-center"
            style={{
              fontSize: "10px",
              letterSpacing: "0.15em",
              color: "#CCCCCC",
            }}
          >
            &copy; {new Date().getFullYear()} William Keffer. All rights
            reserved.
          </p>
        </footer>
      </main>
    </>
  );
}
