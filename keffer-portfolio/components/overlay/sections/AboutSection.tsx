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

          {/* Philosophy text - §10.1 Act 2 */}
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
            At the intersection of
            <br />
            computation and craft
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
            I build systems that exist at the boundary between algorithmic
            precision and human expression. My work explores how generative
            processes, computational thinking, and careful design can produce
            artifacts that feel both intentional and emergent.
          </motion.p>

          <motion.p
            className="font-sans mb-6"
            style={{
              fontSize: "16px",
              lineHeight: 1.6,
              color: "#1A1A1A",
            }}
            initial={{ opacity: 0, y: 15 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ type: "spring", ...springs.gentle, delay: 0.45 }}
          >
            Every project begins with a question: what happens when we let
            machines participate in the creative process — not as tools to be
            wielded, but as collaborators with their own logic? The answer is
            always surprising, always imperfect, always worth pursuing.
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
            transition={{ type: "spring", ...springs.gentle, delay: 0.6 }}
          >
            This site itself is the proof of concept. Inspired by the abstract
            work of{" "}
            <a
              href="https://www.instagram.com/aletiune/?hl=en"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#0099FF", textDecoration: "none", borderBottom: "1px solid rgba(0, 153, 255, 0.3)" }}
            >
              Aletiune
            </a>
            , nine rendering layers stack from back to front — hand-drawn
            chrome brush strokes on Canvas 2D deform with scroll, sky
            photograph fragments drift on independent sinusoidal paths,
            particle dust and film grain add analog texture, and a glitch
            layer ticks with its own internal clock. Everything composites in
            the browser with no WebGL, no video, and no pre-rendered assets.
          </motion.p>

          {/* Skills as minimal tags */}
          <motion.div
            className="flex flex-wrap gap-2 mt-8"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            {[
              "Next.js 16",
              "React 19",
              "TypeScript",
              "Tailwind CSS 4",
              "Canvas 2D",
              "Framer Motion",
              "Zustand",
              "Lenis",
              "Turbopack",
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
