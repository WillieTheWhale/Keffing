"use client";

import { useEffect, useState } from "react";
import { PAPERS, getPaper, onPaper, pickerEnabled, setPaper } from "./paper";

/**
 * A small swatch strip for trying paper colours on the home background.
 * Shown in development, or on any build with `?paper` in the URL; hidden for
 * visitors. The pick persists (localStorage) and applies live to the paper
 * layer and the 3D haze — no reload.
 */
export default function PaperPicker() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(true);
  const [hex, setHex] = useState(getPaper);

  useEffect(() => {
    // after mount only: the static export has no window, and the first client
    // render must match it
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabled(pickerEnabled());
    return onPaper(setHex);
  }, []);

  if (!enabled) return null;
  const current = PAPERS.find((p) => p.hex === hex);

  return (
    <div
      role="group"
      aria-label="Background colour"
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 8,
        padding: open ? "10px 12px" : "6px 10px",
        background: "rgba(255, 255, 255, 0.94)",
        border: "1px solid rgba(0, 0, 0, 0.18)",
        boxShadow: "0 6px 20px rgba(20, 24, 40, 0.08)",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.06em",
        color: "#1a1a1a",
        lineHeight: 1,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit", color: "inherit", textTransform: "uppercase" }}
      >
        paper{current ? ` · ${current.name.toLowerCase()} ${current.hex}` : ""} {open ? "−" : "+"}
      </button>
      {open && (
        <div style={{ display: "flex", gap: 6 }}>
          {PAPERS.map((p) => {
            const on = p.hex === hex;
            return (
              <button
                key={p.hex}
                type="button"
                title={`${p.name} ${p.hex}`}
                aria-label={`${p.name} ${p.hex}`}
                aria-pressed={on}
                onClick={() => setPaper(p.hex)}
                style={{
                  width: 22,
                  height: 22,
                  padding: 0,
                  cursor: "pointer",
                  background: p.hex,
                  border: on ? "1.5px solid #000" : "1px solid rgba(0, 0, 0, 0.22)",
                  outlineOffset: 2,
                  boxShadow: on ? "0 0 0 2px #fff inset" : "none",
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
