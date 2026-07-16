"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { springs } from "@/lib/tokens";
import SectionTitle from "@/components/shared/SectionTitle";

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
        <SectionTitle num="06" eyebrow="Open channel" title="LET'S CONNECT" inView={isInView} />
        <div className="mx-auto md:ml-auto md:mr-[15%] max-w-[480px] content-panel">
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
