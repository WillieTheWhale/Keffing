"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { scrollToSection } from "@/lib/scroll";

/**
 * Index menu — SIGNAL/NOISE roadmap W4.
 * A persistent chip (wordmark + live timecode) opens a full-screen index
 * in the transmission language: black field, mono metadata, display-scale
 * entries that de-tune on hover. Escape or any entry closes it.
 */

const ENTRIES: { id: string; num: string; label: string; note: string; red?: boolean }[] = [
  { id: "hero", num: "01", label: "SIGNAL", note: "the burst" },
  { id: "about", num: "02", label: "BIO", note: "first silence" },
  { id: "projects", num: "03", label: "WORK", note: "experience + selected projects" },
  { id: "research", num: "04", label: "RESEARCH", note: "adversarial ML · VLM security" },
  { id: "contact", num: "05", label: "CONTACT", note: "open channel" },
  { id: "dive", num: "06", label: "THE DIVE", note: "pure signal", red: true },
];

function fmtNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export default function IndexMenu() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false); // for exit transition
  const timecodeRef = useRef<HTMLSpanElement>(null);
  const chipTimeRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // Live clock on chip + overlay (direct DOM, 1fps)
  useEffect(() => {
    const tick = () => {
      const t = fmtNow();
      if (chipTimeRef.current) chipTimeRef.current.textContent = t;
      if (timecodeRef.current) timecodeRef.current.textContent = t;
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const openMenu = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setVisible(true);
    // double-RAF so the initial state paints before the transition starts
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
  }, []);

  const closeMenu = useCallback(() => {
    setOpen(false);
    closeTimer.current = setTimeout(() => setVisible(false), 550);
  }, []);

  // Escape closes; focus moves into the dialog on open and back on close
  useEffect(() => {
    if (!visible) return;
    const chip = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Open index menu"]'
    );
    const closeBtn = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Close index menu"]'
    );
    closeBtn?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      chip?.focus();
    };
  }, [visible, closeMenu]);

  const go = (id: string) => {
    closeMenu();
    // let the overlay start dissolving before the scroll begins
    setTimeout(() => scrollToSection(id), 120);
  };

  return (
    <>
      {/* Persistent chip */}
      <button
        type="button"
        onClick={openMenu}
        className="fixed top-6 right-6 flex items-center gap-3 font-mono uppercase"
        style={{
          zIndex: 40,
          fontSize: "10px",
          letterSpacing: "0.2em",
          padding: "10px 14px",
          color: "#1A1A1A",
          backgroundColor: "rgba(255,255,255,0.85)",
          border: "1px solid rgba(0,0,0,0.25)",
          backdropFilter: "blur(6px)",
          cursor: "pointer",
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open index menu"
      >
        <span ref={chipTimeRef} style={{ color: "#0099FF" }}>00:00:00</span>
        <span>Index</span>
      </button>

      {/* Full-screen index */}
      {visible && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Site index"
          className="fixed inset-0 flex flex-col"
          style={{
            zIndex: 45,
            backgroundColor: "#020204",
            clipPath: open ? "inset(0 0 0% 0)" : "inset(0 0 100% 0)",
            transition: "clip-path 550ms var(--ease-tune)",
          }}
        >
          {/* Header row */}
          <div className="flex items-center justify-between px-6 md:px-12 pt-8">
            <span
              className="font-mono uppercase"
              style={{ fontSize: "10px", letterSpacing: "0.35em", color: "rgba(255,255,255,0.4)" }}
            >
              Signal index
            </span>
            <span
              ref={timecodeRef}
              className="font-mono"
              style={{ fontSize: "11px", letterSpacing: "0.25em", color: "#0099FF" }}
            >
              00:00:00
            </span>
            <button
              type="button"
              onClick={closeMenu}
              className="font-mono uppercase"
              style={{
                fontSize: "10px",
                letterSpacing: "0.25em",
                color: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(255,255,255,0.25)",
                padding: "8px 14px",
                cursor: "pointer",
                background: "transparent",
              }}
              aria-label="Close index menu"
            >
              Close
            </button>
          </div>

          {/* Entries */}
          <nav className="flex-1 flex flex-col justify-center px-6 md:px-16 gap-1">
            {ENTRIES.map((e, i) => (
              <button
                key={e.id}
                type="button"
                onClick={() => go(e.id)}
                className="index-entry group text-left flex items-baseline gap-5 md:gap-8"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px 0",
                  opacity: open ? 1 : 0,
                  transform: open ? "translateY(0)" : "translateY(24px)",
                  transition: `opacity 500ms var(--ease-reveal) ${180 + i * 60}ms, transform 500ms var(--ease-reveal) ${180 + i * 60}ms`,
                }}
              >
                <span
                  className="font-mono"
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.2em",
                    color: e.red ? "var(--signal-red)" : "#0099FF",
                  }}
                >
                  {e.num}
                </span>
                <span
                  className="index-entry-label"
                  style={{
                    fontFamily: "var(--font-display), var(--font-sans), sans-serif",
                    fontWeight: 800,
                    fontStretch: "125%",
                    fontSize: "clamp(40px, 7.5vw, 96px)",
                    lineHeight: 1.05,
                    letterSpacing: "-0.01em",
                    color: "#FFFFFF",
                  }}
                >
                  {e.label}
                </span>
                <span
                  className="hidden md:inline font-mono lowercase"
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.15em",
                    color: "rgba(255,255,255,0.35)",
                  }}
                >
                  {e.note}
                </span>
              </button>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-6 md:px-12 pb-8 flex justify-between">
            <span
              className="font-mono uppercase"
              style={{ fontSize: "9px", letterSpacing: "0.3em", color: "rgba(255,255,255,0.3)" }}
            >
              William Keffer — portfolio
            </span>
            <span
              className="font-mono uppercase"
              style={{ fontSize: "9px", letterSpacing: "0.3em", color: "rgba(255,255,255,0.3)" }}
            >
              esc to close
            </span>
          </div>
        </div>
      )}
    </>
  );
}
