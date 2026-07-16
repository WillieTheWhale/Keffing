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

          {/* Tagline */}
          <motion.p
            className="mt-5 font-sans font-normal inline-block"
            style={{
              fontSize: "clamp(15px, 1.6vw, 18px)",
              lineHeight: 1.5,
              color: "#1A1A1A",
              backgroundColor: "rgba(255,255,255,0.78)",
              backdropFilter: "blur(5px)",
              padding: "6px 12px",
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={entryDone ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{
              type: "spring",
              ...springs.gentle,
              delay: 0.6,
            }}
          >
            Computer Science &times; Mathematics &times; Machine Learning
          </motion.p>

          {/* Subtle descriptor line */}
          <motion.div
            className="mt-8 flex items-center gap-3"
            initial={{ opacity: 0 }}
            animate={entryDone ? { opacity: 1 } : { opacity: 0 }}
            transition={{ delay: 1.0, duration: 0.8 }}
          >
            <div
              className="h-px flex-grow max-w-[60px]"
              style={{ backgroundColor: "#0099FF" }}
            />
            <span
              className="font-mono text-[11px] tracking-[0.15em] uppercase"
              style={{ color: "#333333" }}
            >
              Portfolio website
            </span>
          </motion.div>
        </div>

        {/* Scroll cue */}
        <motion.div
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={entryDone ? { opacity: [0, 0.6, 0.6, 0.3] } : { opacity: 0 }}
          transition={{
            duration: 3,
            repeat: Infinity,
            delay: 2,
          }}
        >
          <span
            className="font-mono text-[10px] tracking-[0.2em] uppercase"
            style={{ color: "#999999" }}
          >
            Scroll
          </span>
          <motion.div
            className="w-px h-8"
            style={{ backgroundColor: "#CCCCCC" }}
            animate={{ scaleY: [0, 1, 0] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </motion.div>
      </div>
    </section>
  );
}
