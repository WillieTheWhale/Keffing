"use client";

import { motion } from "framer-motion";
import { springs } from "@/lib/tokens";
import { useStore } from "@/lib/store";
import KineticName from "./KineticName";

export default function HeroSection() {
  // Hero detonates only after the entry sequence clears (W3)
  const entryDone = useStore((s) => s.entryDone);
  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center"
      aria-label="Hero"
    >
      <div className="w-full px-6 md:px-12 lg:px-20">
        {/* Name — kinetic deconstructed lockup, right-of-center per §2.2 (W5) */}
        <div className="mx-auto md:ml-auto md:mr-[8%] max-w-[900px]">
          <KineticName />

          {/* Tagline — no panel, a halo keeps it legible over the field */}
          <motion.p
            className="hero-tagline mt-5 font-sans font-normal inline-block"
            style={{
              fontSize: "clamp(15px, 1.6vw, 18px)",
              lineHeight: 1.5,
              color: "#1A1A1A",
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={entryDone ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ type: "spring", ...springs.gentle, delay: 0.6 }}
          >
            Mostly signal, some noise.
          </motion.p>

          {/* Record line in the reference's caption voice */}
          <motion.div
            className="mt-6"
            initial={{ opacity: 0 }}
            animate={entryDone ? { opacity: 1 } : { opacity: 0 }}
            transition={{ delay: 1.0, duration: 0.8 }}
          >
            <span className="hero-caption">01/portfolio/2026 &nbsp;&middot;&nbsp; chapel hill, nc</span>
          </motion.div>
        </div>

        {/* Scroll cue */}
        <motion.div
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={entryDone ? { opacity: [0, 0.6, 0.6, 0.3] } : { opacity: 0 }}
          transition={{ duration: 3, repeat: Infinity, delay: 2 }}
        >
          <span className="hero-caption">scroll</span>
          <motion.div
            className="w-px h-8"
            style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
            animate={{ scaleY: [0, 1, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </div>
    </section>
  );
}
