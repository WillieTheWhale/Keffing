"use client";

import { useEffect, useRef, memo } from "react";
import { useStore } from "@/lib/store";

/**
 * Cursor reticle — SIGNAL/NOISE roadmap W7.
 * A viewfinder bounding box that trails the native cursor, so people can
 * find their pointer against the busy background. The native cursor stays
 * (usability); this is just the instrument-frame annotation.
 * Desktop pointers only; disabled for touch and reduced motion.
 */
const CursorReticle = memo(function CursorReticle() {
  const reducedMotion = useStore((s) => s.reducedMotion);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (reducedMotion) {
      // The store flag arrives async — hide again if it flips on after mount.
      if (root) root.style.display = "none";
      return;
    }
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (!root) return;

    root.style.display = "block";
    const pos = { x: -100, y: -100 };
    const cur = { x: -100, y: -100 };
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
    };

    const tick = () => {
      cur.x += (pos.x - cur.x) * 0.22;
      cur.y += (pos.y - cur.y) * 0.22;
      root.style.transform = `translate(${cur.x}px, ${cur.y}px)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  return (
    <div
      ref={rootRef}
      className="fixed top-0 left-0 pointer-events-none"
      style={{ zIndex: 60, display: "none", willChange: "transform" }}
      aria-hidden="true"
    >
      {/* corner brackets around the pointer */}
      <div style={{ position: "absolute", left: -14, top: -14, width: 8, height: 8, borderTop: "1px solid rgba(0,0,0,0.55)", borderLeft: "1px solid rgba(0,0,0,0.55)" }} />
      <div style={{ position: "absolute", right: -14, top: -14, width: 8, height: 8, borderTop: "1px solid rgba(0,0,0,0.55)", borderRight: "1px solid rgba(0,0,0,0.55)", left: 6 }} />
      <div style={{ position: "absolute", left: -14, bottom: -14, width: 8, height: 8, borderBottom: "1px solid rgba(0,0,0,0.55)", borderLeft: "1px solid rgba(0,0,0,0.55)", top: 6 }} />
      <div style={{ position: "absolute", left: 6, top: 6, width: 8, height: 8, borderBottom: "1px solid rgba(0,0,0,0.55)", borderRight: "1px solid rgba(0,0,0,0.55)" }} />
    </div>
  );
});

export default CursorReticle;
