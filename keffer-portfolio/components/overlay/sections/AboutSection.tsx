"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { springs } from "@/lib/tokens";

export default function AboutSection() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      id="about"
      ref={ref}
      className="relative min-h-screen flex items-center py-32"
      aria-label="About"
    >
      <div className="w-full px-6 md:px-12 lg:px-20">
        {/* Content positioned right-of-center per §2.2 */}
        <div className="ml-auto mr-[5%] md:mr-[10%] max-w-[520px] content-panel">
          {/* Section marker */}
          <motion.div
            className="flex items-center gap-3 mb-10"
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ type: "spring", ...springs.gentle }}
          >
            <span
              className="font-mono text-[11px] tracking-[0.15em] uppercase"
              style={{ color: "#0099FF" }}
            >
              02
            </span>
            <div className="h-px w-10" style={{ backgroundColor: "#0099FF" }} />
            <span
              className="font-mono text-[11px] tracking-[0.15em] uppercase"
              style={{ color: "#333333" }}
            >
              About
            </span>
          </motion.div>

          {/* Bio heading */}
          <motion.h2
            className="font-sans font-semibold mb-8"
            style={{
              fontSize: "clamp(25px, 3vw, 31px)",
              lineHeight: 1.2,
              color: "#000000",
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ type: "spring", ...springs.gentle, delay: 0.15 }}
          >
            Bio
          </motion.h2>

          <motion.p
            className="font-sans mb-6"
            style={{
              fontSize: "16px",
              lineHeight: 1.6,
              color: "#1A1A1A",
            }}
            initial={{ opacity: 0, y: 15 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ type: "spring", ...springs.gentle, delay: 0.3 }}
          >
            William is a sophomore pursuing a BS in Computer Science and
            Mathematics at UNC Chapel Hill. His research includes adversarial
            machine learning, vision-language model security, and
            satellite-economic analysis. His primary interests now are machine
            learning and the intersections of analysis and abstract algebra
            with computational methods. He loves talking about all things
            related to these fields. In his free time William enjoys designing
            redstone contraptions in technical Minecraft, tending his Stardew
            Valley farm, and listening to Pitcher 56 and Aphex Twin.
          </motion.p>

          <motion.p
            className="font-sans"
            style={{
              fontSize: "16px",
              lineHeight: 1.6,
              color: "#1A1A1A",
            }}
            initial={{ opacity: 0, y: 15 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ type: "spring", ...springs.gentle, delay: 0.45 }}
          >
            I built this site to reflect some of the design styles and
            aesthetics that resonate with me. Inspired by the abstract work
            of{" "}
            <a
              href="https://www.instagram.com/aletiune/?hl=en"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#0099FF", textDecoration: "none", borderBottom: "1px solid rgba(0, 153, 255, 0.3)" }}
            >
              Aletiune
            </a>
            , nine rendering layers stack from back to front forming a highly
            chaotic and variable scene. This portfolio runs on Next.js 16 with
            TypeScript, Tailwind CSS, and Zustand, rendering a multi-layered
            composition of canvas-drawn chrome strokes, drifting sky fragments,
            particle dust, and glitch artifacts at 60fps. A date-derived seed
            feeds a Mulberry32 pseudo-random number generator each day,
            deterministically driving the placement, curvature, and styling of
            every visual element so the composition stays consistent within a
            single day. When the date changes, the seed advances and the entire
            visual landscape regenerates, ensuring the site looks different
            every day while maintaining its cohesive aesthetic.
          </motion.p>

          {/* Skills as minimal tags */}
          <motion.div
            className="flex flex-wrap gap-2 mt-8"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            {[
              "Python",
              "TypeScript",
              "Rust",
              "Machine Learning",
              "PyTorch",
              "React",
              "Next.js",
              "AWS",
              "Kubernetes",
            ].map((skill, i) => (
              <motion.span
                key={skill}
                className="px-3 py-1 font-mono text-[11px] tracking-wide"
                style={{
                  border: "1px solid rgba(0, 153, 255, 0.3)",
                  color: "#333333",
                }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={isInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: 0.9 + i * 0.05 }}
              >
                {skill}
              </motion.span>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
