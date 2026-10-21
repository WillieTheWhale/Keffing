"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import { motion, useInView } from "framer-motion";
import { springs } from "@/lib/tokens";
import SectionTitle from "@/components/shared/SectionTitle";

const MiiWave = dynamic(() => import("./MiiWave"), { ssr: false, loading: () => null });

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
        <SectionTitle num="02" eyebrow="About" title="BIO" inView={isInView} />
        {/* The Mii stands to the left of the bio panel; both right-of-centre per §2.2 */}
        <div className="about-layout">
        <div className="about-mii">
          <MiiWave />
          <p id="mii-caption" className="mark-caption mt-1" style={{ textAlign: "center" }}>02/mii / click for a surprise</p>
        </div>
        <div className="min-w-0 max-w-[520px] content-panel">
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
            William is a Junior pursuing a BS in Computer Science and
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
            , the page is one composition built in layers: edge-traced cables
            and liquid chrome drawn in WebGL, screen-printed sky photographs,
            flat blocks, typed marginalia. It runs on Next.js 16 with
            TypeScript, Tailwind CSS, and Zustand, and every prominent element
            is placed by hand — only the fine texture is generated, from a
            single fixed seed, so what you see is the same picture every time.
          </motion.p>

          {/* Skills as a typed list */}
          <motion.p
            className="typed-list mt-8"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            python / typescript / rust / machine learning / pytorch / react / next.js / aws / kubernetes
          </motion.p>
        </div>
        </div>
      </div>
    </section>
  );
}
