"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { springs } from "@/lib/tokens";

export default function ContactSection() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      id="contact"
      ref={ref}
      className="relative min-h-[80vh] flex items-center py-32"
      aria-label="Contact"
    >
      <div className="w-full px-6 md:px-12 lg:px-20">
        <div className="ml-auto mr-[5%] md:mr-[15%] max-w-[480px] content-panel">
          {/* Section header */}
          <motion.div
            className="flex items-center gap-3 mb-6"
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ type: "spring", ...springs.gentle }}
          >
            <span
              className="font-mono text-[11px] tracking-[0.15em] uppercase"
              style={{ color: "#0099FF" }}
            >
              06
            </span>
            <div className="h-px w-10" style={{ backgroundColor: "#0099FF" }} />
            <span
              className="font-mono text-[11px] tracking-[0.15em] uppercase"
              style={{ color: "#333333" }}
            >
              Contact
            </span>
          </motion.div>

          <motion.h2
            className="font-sans font-semibold mb-6"
            style={{
              fontSize: "clamp(25px, 3vw, 31px)",
              lineHeight: 1.2,
              color: "#000000",
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ type: "spring", ...springs.gentle, delay: 0.15 }}
          >
            Let&apos;s connect
          </motion.h2>

          <motion.p
            className="font-sans mb-10"
            style={{
              fontSize: "16px",
              lineHeight: 1.6,
              color: "#1A1A1A",
            }}
            initial={{ opacity: 0, y: 15 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ type: "spring", ...springs.gentle, delay: 0.3 }}
          >
            Open to collaborations, research opportunities, and conversations
            about the future of computational design. Reach out — the best
            projects start with a message.
          </motion.p>

          {/* Contact links */}
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <a
              href="mailto:williamkeffer2005@gmail.com"
              className="group flex items-center gap-3 transition-opacity hover:opacity-70"
            >
              <div
                className="w-8 h-px"
                style={{ backgroundColor: "#0099FF" }}
              />
              <span
                className="font-mono text-[14px] tracking-wide"
                style={{ color: "#000000" }}
              >
                williamkeffer2005@gmail.com
              </span>
            </a>

            <a
              href="https://github.com/WillieTheWhale"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 transition-opacity hover:opacity-70"
            >
              <div
                className="w-8 h-px"
                style={{ backgroundColor: "#CCCCCC" }}
              />
              <span
                className="font-mono text-[13px] tracking-wide"
                style={{ color: "#333333" }}
              >
                GitHub
              </span>
            </a>

            <a
              href="https://www.linkedin.com/in/williamkeffer"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 transition-opacity hover:opacity-70"
            >
              <div
                className="w-8 h-px"
                style={{ backgroundColor: "#CCCCCC" }}
              />
              <span
                className="font-mono text-[13px] tracking-wide"
                style={{ color: "#333333" }}
              >
                LinkedIn
              </span>
            </a>
          </motion.div>

          {/* Closing statement */}
          <motion.div
            className="mt-20 pt-10"
            style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 0.5 } : {}}
            transition={{ delay: 0.8, duration: 1 }}
          >
            <p
              className="font-mono text-[11px] tracking-[0.1em] leading-relaxed"
              style={{ color: "#999999" }}
            >
              Designed & built with Next.js, TypeScript, and generative algorithms.
              <br />
              The compositions are generative and change daily.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
