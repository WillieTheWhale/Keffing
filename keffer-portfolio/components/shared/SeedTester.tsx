"use client";

import { useCallback } from "react";
import { useStore } from "@/lib/store";

export default function SeedTester() {
  const seed = useStore((s) => s.seed);
  const setSeed = useStore((s) => s.setSeed);

  const prev = useCallback(() => setSeed(seed - 1), [seed, setSeed]);
  const next = useCallback(() => setSeed(seed + 1), [seed, setSeed]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: "32px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: "16px",
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        borderRadius: "8px",
        padding: "8px 16px",
        fontFamily: "var(--font-mono), monospace",
        fontSize: "14px",
        color: "#e0e0e0",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        userSelect: "none",
        pointerEvents: "auto",
      }}
    >
      <button
        onClick={prev}
        style={{
          background: "none",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          borderRadius: "4px",
          color: "#e0e0e0",
          cursor: "pointer",
          padding: "4px 12px",
          fontSize: "16px",
          lineHeight: "1",
        }}
        aria-label="Previous seed"
      >
        &larr;
      </button>
      <span style={{ minWidth: "90px", textAlign: "center", letterSpacing: "0.05em" }}>
        {seed}
      </span>
      <button
        onClick={next}
        style={{
          background: "none",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          borderRadius: "4px",
          color: "#e0e0e0",
          cursor: "pointer",
          padding: "4px 12px",
          fontSize: "16px",
          lineHeight: "1",
        }}
        aria-label="Next seed"
      >
        &rarr;
      </button>
    </div>
  );
}
