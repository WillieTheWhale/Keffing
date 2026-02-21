"use client";

import { motion } from "framer-motion";
import { springs } from "@/lib/tokens";

export default function HeroSection() {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center"
      aria-label="Hero"
    >
      <div className="w-full px-6 md:px-12 lg:px-20">
        {/* Name - positioned right-of-center per §2.2 */}
        <div className="mx-auto md:ml-auto md:mr-[15%] max-w-[600px] content-panel-hero">
          <motion.h1
            className="font-sans font-semibold tracking-tight leading-none"
            style={{
              fontSize: "clamp(39px, 6vw, 49px)",
              color: "#000000",
            }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              type: "spring",
              ...springs.gentle,
              delay: 0.3,
            }}
          >
            William Keffer
          </motion.h1>

          {/* Tagline */}
          <motion.p
            className="mt-4 font-sans font-normal"
            style={{
              fontSize: "clamp(16px, 2vw, 20px)",
              lineHeight: 1.5,
              color: "#1A1A1A",
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
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
            animate={{ opacity: 1 }}
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
          animate={{ opacity: [0, 0.6, 0.6, 0.3] }}
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
