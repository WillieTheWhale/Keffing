"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { hardwareDevices } from "@/content/hardware";
import styles from "./HardwareGallery.module.css";

const HardwareCanvas = dynamic(() => import("./HardwareCanvas"), { ssr: false });

export default function HardwareGallery() {
  const galleryRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [held, setHeld] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const active = held ?? hovered ?? focused;
  return (
    <section aria-label="Hardware collection" className={styles.collection}>
      <div className={styles.instructions}>
        <span>{hardwareDevices.length} objects / in use</span>
        <span>{failed ? "Still views" : "Hover to explore · tap to hold"}</span>
      </div>
      <div className={styles.gallery} ref={galleryRef}>
        {!failed && <HardwareCanvas hostRef={galleryRef} active={active} reducedMotion={reducedMotion}
          onReady={(id) => setLoaded((previous) => new Set(previous).add(id))}
          onFailure={() => setFailed(true)} />}
        {hardwareDevices.map((device, index) => {
          const isHeld = held === device.id;
          const isActive = active === device.id;
          const ready = loaded.has(device.id) && !failed;
          return (
            <article key={device.id} className={`${styles.card} ${isActive ? styles.active : ""}`}>
              <div className={styles.fileLabel}>
                <span>HW / {String(index + 1).padStart(2, "0")}</span>
                <span>{device.category}</span>
              </div>
              <button type="button" className={styles.preview} data-hardware-id={device.id}
                disabled={failed}
                data-state={ready ? (isActive ? "revealed" : "resting") : "poster"}
                aria-label={`${isHeld ? "Release" : "Explore"} ${device.name}${device.id === "new-2ds-xl-hylian" ? " Hylian Shield Edition" : ""}`}
                aria-describedby={`${device.id}-details`} aria-pressed={isHeld}
                onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(device.id); }}
                onPointerLeave={() => setHovered((id) => id === device.id ? null : id)}
                onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) setFocused(device.id); }}
                onBlur={() => setFocused((id) => id === device.id ? null : id)}
                onClick={() => { setHeld(isHeld ? null : device.id); if (isHeld) { setHovered(null); setFocused(null); } }}
                onKeyDown={(event) => { if (event.key === "Escape") { setHeld(null); setHovered(null); setFocused(null); } }}>
                <Image src={`/assets/hardware/${device.id}.png`} alt="" width={720} height={620}
                  className={styles.poster} style={{ opacity: ready ? 0 : 1 }} loading={index < 3 ? "eager" : "lazy"} unoptimized />
                <span className={styles.ground} aria-hidden="true" />
                <span className={styles.action} aria-hidden="true">
                  <span>{failed ? "Still view" : isHeld ? "Release" : isActive ? "Hold this view" : device.interaction === "open" ? "Open" : device.interaction === "unfold" ? "Unfold" : "Inspect"}</span>
                  {!failed && <span>{isHeld ? "−" : "+"}</span>}
                </span>
              </button>
              <div className={styles.details} id={`${device.id}-details`}>
                <h2>{device.name}</h2>
                <p>{device.note}</p>
                <span className={styles.finish}>{device.meta}</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
