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
            I&apos;m William. I build software for people doing other kinds of
            work: a coding-agent harness for UNC&apos;s computer science classes,
            the controls for a fluid dynamics lab&apos;s thirty-piston wave maker,
            and websites for the labs and student groups around campus. The
            ideas I keep coming back to are in machine learning, especially
            reinforcement learning and the alignment problems that come with
            it, and in the places where analysis and abstract algebra turn
            into something you can compute. Away from that, I build redstone
            in technical Minecraft, make espresso, and keep Feng and Lamp on
            repeat. I&apos;m a junior at UNC Chapel Hill studying computer science
            and math.
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
            The site runs on Next.js and TypeScript, with the background
            rendered in three.js between two layers of printed paper.
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
