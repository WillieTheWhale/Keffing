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
            style={{ fontSize: "16px", lineHeight: 1.6, color: "#1A1A1A" }}
            initial={{ opacity: 0, y: 15 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ type: "spring", ...springs.gentle, delay: 0.3 }}
          >
            Open to collaborations, research opportunities, and conversations
            about the future of computational design. Reach out — the best
            projects start with a message.
          </motion.p>

          {/* Contact as a typed ledger */}
          <motion.div
            className="typed-rows"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <a href="mailto:williamkeffer2005@gmail.com" className="typed-row">
              <span className="k">01 / mail</span>
              <span className="v">williamkeffer2005@gmail.com</span>
            </a>
            <a href="https://github.com/WillieTheWhale" target="_blank" rel="noopener noreferrer" className="typed-row">
              <span className="k">02 / github</span>
              <span className="v">WillieTheWhale &#8599;</span>
            </a>
            <a href="https://www.linkedin.com/in/williamkeffer" target="_blank" rel="noopener noreferrer" className="typed-row">
              <span className="k">03 / linkedin</span>
              <span className="v">williamkeffer &#8599;</span>
            </a>
          </motion.div>

          {/* Closing statement */}
          <motion.p
            className="mark-caption mt-16"
            style={{ fontSize: 9, lineHeight: 1.8 }}
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.8, duration: 1 }}
          >
            designed &amp; built with next.js and typescript
          </motion.p>
        </div>
      </div>
    </section>
  );
}
