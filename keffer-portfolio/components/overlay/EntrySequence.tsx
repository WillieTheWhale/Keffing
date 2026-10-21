"use client";

import { useEffect, useRef, useState, memo } from "react";
import { useStore } from "@/lib/store";

/**
 * Entry boot sequence — SIGNAL/NOISE roadmap W3.
 * The site boots like a transmission acquiring lock:
 *   acquire (0–900ms)  black frame, timecode spins, hairline draws
 *   lock   (900–1500ms) timecode locks, "SIGNAL ACQUIRED", reticle expands
 *   clear  (1500–2100ms) white beat → overlay dissolves → hero detonates
 * Skippable on any input. Runs once per session. Reduced motion: 400ms fade.
 */

type Stage = "acquire" | "lock" | "clear" | "done";

const SESSION_KEY = "sn-entry-done";

function fmtTimecode(d: Date, frame: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}:${p(frame)}`;
}

const EntrySequence = memo(function EntrySequence() {
  const [stage, setStage] = useState<Stage | null>(null);
  const stageRef = useRef<Stage | null>(null);
  const timecodeRef = useRef<HTMLSpanElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  // Entire sequence is scheduled ONCE at mount — internal stage flips must
  // never clear the pending timers (that bug locked the overlay on screen).
  useEffect(() => {
    const seen = sessionStorage.getItem(SESSION_KEY);
    if (seen) {
      useStore.setState({ entryDone: true });
      setStage("done");
      return;
    }
    setStage("acquire");

    const finish = () => {
      sessionStorage.setItem(SESSION_KEY, "1");
      useStore.setState({ entryDone: true });
      setStage("done");
    };

    const t = (ms: number, fn: () => void) => {
      const id = setTimeout(fn, ms);
      timersRef.current.push(id);
      return id;
    };

    const prefersReduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      t(400, finish);
      return () => timersRef.current.forEach(clearTimeout);
    }

    t(900, () => setStage("lock"));
    t(1500, () => setStage("clear"));
    t(2100, finish);

    // Skip on any input
    const skip = () => {
      if (stageRef.current === "acquire" || stageRef.current === "lock") {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
        setStage("clear");
        timersRef.current.push(setTimeout(finish, 450));
      }
    };
    window.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip);
    window.addEventListener("wheel", skip, { passive: true });
    window.addEventListener("touchstart", skip, { passive: true });

    return () => {
      timersRef.current.forEach(clearTimeout);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("wheel", skip);
      window.removeEventListener("touchstart", skip);
    };
  }, []);

  // Spinning → locking timecode (direct DOM mutation, no re-renders)
  useEffect(() => {
    if (stage !== "acquire" && stage !== "lock") return;
    let raf = 0;
    const tick = () => {
      const el = timecodeRef.current;
      if (el) {
        if (stageRef.current === "acquire") {
          // spin: random plausible timecode
          const d = new Date(Math.random() * 8.64e7);
          el.textContent = fmtTimecode(d, Math.floor(Math.random() * 30));
        } else {
          el.textContent = fmtTimecode(new Date(), Math.floor((performance.now() / 33.3) % 30));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage]);

  if (stage === null || stage === "done") return null;

  const isClear = stage === "clear";
  const isLock = stage === "lock" || isClear;

  return (
    <div
      className="entry-sequence fixed inset-0 flex items-center justify-center"
      style={{
        zIndex: 50,
        backgroundColor: isClear ? "#FFFFFF" : "#000000",
        opacity: isClear ? 0 : 1,
        transition: isClear
          ? "opacity 450ms var(--ease-tune), background-color 140ms linear"
          : "none",
        pointerEvents: isClear ? "none" : "auto",
        cursor: "pointer",
      }}
      aria-hidden="true"
    >
      {/* Drawing hairline */}
      <div
        className="entry-hairline absolute left-0 top-1/2"
        style={{
          height: "1px",
          backgroundColor: isLock ? "rgba(0,153,255,0.9)" : "rgba(255,255,255,0.7)",
        }}
      />
      {/* Vertical reticle line appears at lock */}
      {isLock && (
        <div
          className="entry-vline absolute top-0 left-1/2"
          style={{ width: "1px", backgroundColor: "rgba(0,153,255,0.5)" }}
        />
      )}
      {/* Double rule with a stepped junction — the reference's drafting mark */}
      <div className="entry-corner" style={{ position: "absolute", left: 28, bottom: 32, width: 180, height: 4, borderTop: "1px solid rgba(255,255,255,0.45)", borderBottom: "1px solid rgba(255,255,255,0.45)" }} />
      <div className="entry-corner" style={{ position: "absolute", left: 28, bottom: 32, width: 0, height: 46, borderLeft: "1px solid rgba(255,255,255,0.45)" }} />
      <div className="entry-corner" style={{ position: "absolute", right: 28, top: 32, width: 180, height: 4, borderTop: "1px solid rgba(255,255,255,0.45)", borderBottom: "1px solid rgba(255,255,255,0.45)" }} />
      <div className="entry-corner" style={{ position: "absolute", right: 28, top: 32, width: 0, height: 46, borderLeft: "1px solid rgba(255,255,255,0.45)" }} />
      {/* Timecode + status */}
      <div className="flex flex-col items-center gap-3" style={{ transform: "translateY(-8px)" }}>
        <span
          ref={timecodeRef}
          className="font-mono"
          style={{
            fontSize: "13px",
            letterSpacing: "0.25em",
            color: isLock ? "#0099FF" : "rgba(255,255,255,0.85)",
          }}
        >
          00:00:00:00
        </span>
        <span
          className="font-mono uppercase"
          style={{
            fontSize: "10px",
            letterSpacing: "0.35em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          {isLock ? "signal acquired" : "acquiring signal"}
        </span>
      </div>
    </div>
  );
});

export default EntrySequence;
