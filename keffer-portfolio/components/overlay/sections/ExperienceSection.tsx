"use client";

// Experience — "sky strips". The six entries stand as a colonnade of tall,
// narrow mounted sky prints of different widths (reference e11): roles and
// research in blue sky, the organisations beyond the work in the same skies
// printed mono, so the grouping reads from tone. Opening a strip widens it and
// unfolds its file beside it. On phones the strips lie down as bands.

import { useCallback, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useInView } from "framer-motion";
import SectionTitle from "@/components/shared/SectionTitle";
import { CropMarks } from "@/components/background/print";
import { SKY_PHOTOS_FULL } from "@/lib/fragments";
import { useStore } from "@/lib/store";
import { openVeil } from "@/components/shared/Veil";
import { experienceEntries as ENTRIES, type ExperienceEntry as Entry } from "@/content/experience";
import s from "./ExperienceSection.module.css";

const BANDS = "(max-width: 767px)";
const subscribeBands = (cb: () => void) => {
  const mq = window.matchMedia(BANDS);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

const sky = (n: number) => SKY_PHOTOS_FULL.find((p) => p.endsWith(`/sky-${n}.jpg`)) ?? SKY_PHOTOS_FULL[0];

// one fixed print per entry: its photograph, crop, and closed width (px)
const PRINT: Record<string, { src: string; pos: string; w: number }> = {
  blockd: { src: sky(8), pos: "40% 30%", w: 96 },
  eel: { src: sky(17), pos: "8% 50%", w: 64 },
  duke: { src: sky(4), pos: "55% 50%", w: 84 },
  nscc: { src: sky(9), pos: "62% 60%", w: 110 },
  "unc-sg": { src: sky(15), pos: "38% 50%", w: 58 },
  urc: { src: sky(6), pos: "50% 40%", w: 78 },
};

export default function ExperienceSection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const rowRef = useRef<HTMLDivElement>(null);
  const rowIn = useInView(rowRef, { once: true, amount: 0.2 });
  const reducedMotion = useStore((st) => st.reducedMotion);

  // phone: the strips lie down as bands
  const bands = useSyncExternalStore(subscribeBands, () => window.matchMedia(BANDS).matches, () => false);
  // the colonnade always shows one file (the first until one is chosen); as
  // bands the list starts closed and an open band can close again
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);
  const open = bands ? (chosen ?? null) : (chosen ?? ENTRIES[0].id);
  const toggle = useCallback((id: string) => {
    setChosen(open === id ? (bands ? null : id) : id);
  }, [open, bands]);

  const faces = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const next = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    faces.current[(i + next + ENTRIES.length) % ENTRIES.length]?.focus();
  };

  return (
    <section id="experience" ref={ref} className="relative py-32" aria-label="Experience & Extracurriculars">
      <div className="w-full px-6 md:px-12 lg:px-20">
        <SectionTitle num="05" eyebrow="Roles & orgs" title="EXPERIENCE" inView={inView} />

        <div className={s.mount} data-in={rowIn || reducedMotion ? "" : undefined}>
          <span className={s.offset} aria-hidden="true" />
          <span className={s.marks} aria-hidden="true"><CropMarks off={10} len={14} /></span>
          <div ref={rowRef} className={s.row}>
            {ENTRIES.map((e, i) => (
              <Strip
                key={e.id}
                entry={e}
                index={i}
                open={open === e.id}
                onToggle={() => toggle(e.id)}
                onKey={(ev) => onKey(ev, i)}
                faceRef={(el) => { faces.current[i] = el; }}
              />
            ))}
          </div>
        </div>

        <p className={s.legend}>
          <span><i className={s.swatchSky} aria-hidden="true" />roles &amp; research</span>
          <span><i className={s.swatchMono} aria-hidden="true" />beyond the work</span>
        </p>
      </div>
    </section>
  );
}

function Strip({
  entry: e,
  index,
  open,
  onToggle,
  onKey,
  faceRef,
}: {
  entry: Entry;
  index: number;
  open: boolean;
  onToggle: () => void;
  onKey: (ev: KeyboardEvent<HTMLButtonElement>) => void;
  faceRef: (el: HTMLButtonElement | null) => void;
}) {
  const p = PRINT[e.id];
  const panelId = `exp-${e.id}`;
  const router = useRouter();
  return (
    <article
      className={s.strip}
      data-open={open ? "" : undefined}
      data-kind={e.kind}
      style={{ "--w": `${p.w}px`, "--i": index } as React.CSSProperties}
    >
      <button
        ref={faceRef}
        type="button"
        className={s.face}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        onKeyDown={onKey}
      >
        <span className={`sky-print ${s.photo}`} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.src} alt="" style={{ objectPosition: p.pos }} loading="lazy" decoding="async" draggable={false} />
        </span>
        <span className={s.shade} aria-hidden="true" />
        <span className={s.mark}>{e.mark}</span>
        {e.role && <span className={s.role} aria-hidden="true">{e.role.toLowerCase()}</span>}
        <span className={s.srOnly}>{`${e.org}${e.role ? `, ${e.role}` : ""}`}</span>
        {/* the print's foot label, once it has widened */}
        {(e.role || e.when) && (
          <span className={s.plate} aria-hidden="true">
            {e.role && <span className={s.plateRole}>{e.role}</span>}
            {e.when && <span className={s.plateWhen}>{e.when}</span>}
          </span>
        )}
      </button>

      <div id={panelId} className={s.panel} role="region" aria-label={e.org} aria-hidden={!open} inert={!open}>
        <div className={s.panelIn}>
          {e.org !== e.mark ? <h3 className={s.org}>{e.org}</h3> : <h3 className={s.srOnly}>{e.org}</h3>}
          <p className={s.line}>{e.line}</p>
          <p className={s.detail}>{e.detail}</p>
          {e.tags.length > 0 && <p className={`typed-list ${s.tags}`}>{e.tags.map((t) => t.toLowerCase()).join(" / ")}</p>}
          <p className={s.links}>
            {e.caseFile && (
              <Link
                className="typed-link"
                href={e.caseFile}
                onClick={(ev) => {
                  if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return;
                  ev.preventDefault();
                  const to = e.caseFile!;
                  openVeil(() => router.push(to));
                }}
              >
                case file
              </Link>
            )}
            {e.url && <a className="typed-link" href={e.url} target="_blank" rel="noopener noreferrer">{e.host} &#8599;</a>}
          </p>
        </div>
      </div>
    </article>
  );
}
