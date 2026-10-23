"use client";

// Background — ALLOY. The finale: "through the mirror".
//
// The background carries you here: in the Dive the camera flies into the
// contact mass, a liquid mirror swings round to face it, and the sky it
// reflects settles into the end-card sky (engine.ts). This component owns
// the end card's DOM. Every component has its own motion, written in
// JavaScript on a scroll-scrubbed timeline (scrubbable both ways) that is
// smoothed by a critically damped spring, so a fast flick never pops:
//
//   threshold   the red rule draws out from the centre, its label types on
//   heading     letters rise out of their reflection (mirrored → upright)
//               from scattered positions, staggered, then a chrome sheen
//               sweeps across them
//   contact     the address types on character by character, a block caret
//               leading it and two decoding glyphs running ahead of it
//   CTA         the frame draws, the fill wipes, the label tracks in, then
//               a hairline offset frame settles behind it; it unfolds the
//               "Leave a message" sheet in place of the buttons
//               (LeaveMessage.tsx)
//   back to top the label slides in, its underline draws, the arrow lifts
//   ©           lands last, with a small settle
//
// Idle life once arrived: a slow sheen across the heading every few
// seconds, a glint through the CTA, the arrow's slow bob (the sky drifts in
// the canvas). Reduced motion: a calm crossfade with a DOM sky, everything
// readable. Publishes the timeline as alloyBus.dive (the canvas follows it).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { scrollToSection } from "@/lib/scroll";
import { CONTACT_EMAIL } from "@/lib/contact";
import { alloyBus, BREATH, END_SKY } from "./bus";
import LeaveMessage from "./LeaveMessage";
import css from "./Dive.module.css";

const LABEL = "Threshold — diving to pure signal";
const HEAD = "Pure signal";
const MAIL = CONTACT_EMAIL;
const CTA = "Send me a message";
const BACK = "back to the top";
const GLYPHS = "01░▒/\\|—·:+×#";

// timeline windows, in dive progress (0..1)
const W = {
  head: [0.62, 0.8],
  sheen: [0.79, 0.9],
  mail: [0.7, 0.81],
  mailCopy: [0.8, 0.86],
  frame: [0.78, 0.845],
  fill: [0.835, 0.885],
  label: [0.865, 0.91],
  offset: [0.89, 0.94],
  back: [0.85, 0.9],
  line: [0.875, 0.93],
  arrow: [0.9, 0.945],
  copy: [0.925, 0.985],
} as const;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
// The background's swing-and-open takes up the first part of the timeline;
// the end card's type (the windows in W) starts once the mirror has turned
// to sky.
const TEXT_FROM = 0.3;
const textT = (t: number) => clamp01((t - TEXT_FROM) / (1 - TEXT_FROM));
// Spring rates (rad/s) for the finale timeline: slow going in, so the
// mirror's swing always plays out over ~2 s however hard the flick; quicker
// on the way back out.
const W_IN = 2.4;
const W_OUT = 5.5;
// Speed limit (timeline units / s) going in: a glide through the mirror's
// swing and opening (~0.1–0.6) so even a hard flick plays it over ~1.5 s,
// freer before and after. Normal scrolling stays under it.
const rateIn = (x: number) => 0.9 - 0.58 * smooth01((x - 0.04) / 0.1) * (1 - smooth01((x - 0.56) / 0.1));
function smooth01(x: number) { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); }
const win = (t: number, w: readonly [number, number]) => clamp01((t - w[0]) / (w[1] - w[0]));
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const backOut = (x: number, k = 1.5) => 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2);
function hash(n: number) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

/** Critically damped spring toward a moving target. */
function springStep(st: { x: number; v: number }, target: number, dt: number, w: number) {
  // semi-implicit Euler with substeps: stable for any frame time we accept
  const n = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const a = w * w * (target - st.x) - 2 * w * st.v;
    st.v += a * h;
    st.x += st.v * h;
  }
}

export default function Dive() {
  const reducedMotion = useStore((s) => s.reducedMotion);
  const [year] = useState(() => new Date().getFullYear());
  const sectionRef = useRef<HTMLElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);
  const breathRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const ruleRef = useRef<HTMLDivElement>(null);
  const ruleChars = useRef<(HTMLSpanElement | null)[]>([]);
  const mailChars = useRef<(HTMLSpanElement | null)[]>([]);
  const caretRef = useRef<HTMLSpanElement>(null);
  const mailCopyRef = useRef<HTMLButtonElement>(null);
  const letters = useRef<(HTMLSpanElement | null)[]>([]);
  const sheenRef = useRef<HTMLSpanElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<SVGRectElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const offsetRef = useRef<HTMLSpanElement>(null);
  const glintRef = useRef<HTMLSpanElement>(null);
  const ctaChars = useRef<(HTMLSpanElement | null)[]>([]);
  const backRef = useRef<HTMLButtonElement>(null);
  const backLabelRef = useRef<HTMLSpanElement>(null);
  const backLineRef = useRef<HTMLSpanElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);
  const copyRef = useRef<HTMLSpanElement>(null);

  // the message sheet: open, it holds the card fully on screen (like focus does)
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const kickRef = useRef<() => void>(() => {});
  const openSheet = () => { openRef.current = true; setOpen(true); kickRef.current(); };
  const closeSheet = useCallback(() => {
    openRef.current = false;
    setOpen(false);
    kickRef.current();
  }, []);
  // closed again: focus goes back to the button it came from (once it is no longer inert)
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) ctaRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);
  const [copied, setCopied] = useState(false);
  const copyMail = () => {
    navigator.clipboard?.writeText(MAIL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }, () => {});
  };

  const headLetters = useMemo(() => HEAD.split(""), []);
  // per-letter scatter: where each letter's reflection starts
  const scatter = useMemo(() => headLetters.map((_, i) => ({
    dx: (hash(i + 1) - 0.5) * 120,
    dy: 46 + hash(i + 7) * 70,
    rot: (hash(i + 13) - 0.5) * 34,
  })), [headLetters]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    let raf = 0;
    let last = performance.now();
    const tl = { x: 0, v: 0 };       // the end card's timeline
    const th = { x: 0, v: 0 };       // the threshold's own timeline
    let forced = false;
    let arrivedAt = -1;
    let caretX: number[] = [];
    const measureCaret = () => {
      caretX = mailChars.current.map((el) => (el ? el.offsetLeft : 0));
      const lastEl = mailChars.current[mailChars.current.length - 1];
      if (lastEl) caretX.push(lastEl.offsetLeft + lastEl.offsetWidth);
    };
    measureCaret();
    if (document.fonts?.ready) document.fonts.ready.then(measureCaret);

    const geometry = () => {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = Math.max(1, section.offsetHeight - vh);
      const d = clamp01(-rect.top / total);
      const q = clamp01((vh - rect.top) / (vh * 0.75));
      const near = rect.top < vh * 1.3 && rect.bottom > -vh * 0.2;
      return { d, q, near };
    };

    // the last value written per element and property: the timeline rewrites
    // every component each frame, but most of them hold still
    const written = new WeakMap<Element, Record<string, string>>();
    const put = (el: HTMLElement | SVGElement, prop: string, v: string) => {
      let w = written.get(el);
      if (!w) { w = {}; written.set(el, w); }
      if (w[prop] === v) return;
      w[prop] = v;
      if (prop.startsWith("--")) el.style.setProperty(prop, v);
      else (el.style as unknown as Record<string, string>)[prop] = v;
    };

    let finalApplied = false;
    const applyFinal = () => {
      const show = (el: HTMLElement | SVGElement | null) => { if (el) { put(el, "opacity", "1"); put(el, "transform", ""); } };
      mailChars.current.forEach((el, i) => { if (el) { el.textContent = MAIL[i]; el.dataset.s = "1"; show(el); } });
      if (caretRef.current) put(caretRef.current, "opacity", "0");
      show(mailCopyRef.current);
      letters.current.forEach(show);
      if (sheenRef.current) put(sheenRef.current, "opacity", "0");
      if (frameRef.current) { put(frameRef.current, "strokeDashoffset", "0"); put(frameRef.current, "opacity", "1"); }
      if (fillRef.current) put(fillRef.current, "clipPath", "inset(0 0 0 0)");
      ctaChars.current.forEach(show);
      if (offsetRef.current) { put(offsetRef.current, "opacity", "0.9"); put(offsetRef.current, "transform", "translate(5px, 5px)"); }
      if (backLabelRef.current) { show(backLabelRef.current); put(backLabelRef.current, "clipPath", "none"); }
      if (backLineRef.current) put(backLineRef.current, "transform", "scaleX(1)");
      show(arrowRef.current);
      show(copyRef.current);
    };

    const render = (now: number) => {
      const t = tl.x;
      const time = now / 1000;
      // ── the sky: the canvas carries it when it can; otherwise a DOM sky
      const gl = alloyBus.glFinale && !reducedMotion;
      if (skyRef.current) {
        const sk = gl ? 0 : reducedMotion ? clamp01((t - 0.25) / 0.35) : clamp01((t - 0.35) / 0.3);
        put(skyRef.current, "opacity", sk.toFixed(3));
      }
      if (breathRef.current) {
        const b = gl ? 0 : reducedMotion ? clamp01((t - 0.4) / 0.3) : clamp01((t - 0.55) / 0.25);
        put(breathRef.current, "opacity", b.toFixed(3));
      }
      // ── threshold
      const tq = th.x;
      if (ruleRef.current) put(ruleRef.current, "transform", `scaleX(${easeInOut(clamp01(tq / 0.6)).toFixed(4)})`);
      const nRule = ruleChars.current.length;
      const shownRule = Math.round(clamp01((tq - 0.25) / 0.6) * nRule);
      ruleChars.current.forEach((el, i) => { if (el) put(el, "opacity", i < shownRule ? "1" : "0"); });

      if (reducedMotion) {
        // a calm crossfade: every component in its final state, faded as one
        if (!finalApplied) { applyFinal(); finalApplied = true; }
        const c = clamp01((t - 0.55) / 0.3).toFixed(3);
        if (contentRef.current) {
          put(contentRef.current, "opacity", c);
          put(contentRef.current, "pointerEvents", t > 0.6 ? "auto" : "none");
        }
        return;
      }
      const tx = textT(t);
      if (contentRef.current) {
        put(contentRef.current, "opacity", "1");
        put(contentRef.current, "pointerEvents", tx > 0.84 || forced || openRef.current ? "auto" : "none");
      }

      // ── heading: letters rise out of their reflection, staggered
      const nl = letters.current.length;
      const [h0, h1] = W.head;
      const span = h1 - h0;
      const dur = span * 0.45;
      letters.current.forEach((el, i) => {
        if (!el) return;
        const s0 = h0 + (span - dur) * (i / Math.max(1, nl - 1));
        const p = clamp01((tx - s0) / dur);
        const e = backOut(p, 1.2);
        const sc = scatter[i];
        // the letter swings up out of its reflection: it starts folded down
        // under its baseline (mirrored) and rotates upright about it
        const fold = (1 - e) * 158;
        put(el, "transform", p >= 1 ? "" : `perspective(520px) translate3d(${((1 - e) * sc.dx).toFixed(2)}px, ${((1 - e) * sc.dy).toFixed(2)}px, 0) rotate(${((1 - e) * sc.rot).toFixed(2)}deg) rotateX(${fold.toFixed(2)}deg)`);
        put(el, "opacity", p <= 0 ? "0" : (0.22 + 0.78 * clamp01(p * 1.8)).toFixed(3));
      });
      // chrome sheen: once on arrival, then a slow one every ~7 s at rest
      if (sheenRef.current) {
        let sp = win(tx, W.sheen);
        let a = sp > 0 && sp < 1 ? 1 : 0;
        if (t >= 0.995 && arrivedAt >= 0) {
          const cyc = ((time - arrivedAt) % 7.5) / 2.1; // 2.1 s sweep in a 7.5 s cycle
          if (cyc < 1) { sp = cyc; a = 0.85; } else { a = 0; }
        }
        put(sheenRef.current, "opacity", String(a));
        if (a > 0) put(sheenRef.current, "backgroundPosition", `${(115 - easeInOut(sp) * 130).toFixed(2)}% 0`);
      }

      // ── contact: types on, a caret leading, two decoding glyphs ahead
      const ne = mailChars.current.length;
      const pe = win(tx, W.mail);
      const k = Math.floor(pe * ne);
      mailChars.current.forEach((el, i) => {
        if (!el) return;
        if (i < k) {
          if (el.dataset.s !== "1") { el.textContent = MAIL[i]; put(el, "opacity", "1"); el.dataset.s = "1"; }
        } else if (i < k + 2 && pe > 0 && pe < 1) {
          el.textContent = GLYPHS[Math.floor(hash(i * 7.3 + Math.floor(time * 18)) * GLYPHS.length)];
          put(el, "opacity", i === k ? "0.55" : "0.25");
          el.dataset.s = "2";
        } else if (el.dataset.s !== "0") {
          el.textContent = MAIL[i]; put(el, "opacity", "0"); el.dataset.s = "0";
        }
      });
      if (caretRef.current) {
        const cx = caretX[Math.min(k, caretX.length - 1)] ?? 0;
        const done = clamp01((tx - W.mail[1]) / 0.03);
        put(caretRef.current, "transform", `translateX(${cx.toFixed(1)}px)`);
        put(caretRef.current, "opacity", pe > 0 ? (0.9 * (1 - done)).toFixed(3) : "0");
      }
      if (mailCopyRef.current) {
        const p = easeOut(win(tx, W.mailCopy));
        put(mailCopyRef.current, "opacity", p.toFixed(3));
        put(mailCopyRef.current, "transform", p >= 1 ? "" : `translateX(${((1 - p) * -6).toFixed(2)}px)`);
      }

      // ── CTA: frame draws, fill wipes, label tracks in, offset frame settles
      if (frameRef.current) put(frameRef.current, "strokeDashoffset", (1 - easeInOut(win(tx, W.frame))).toFixed(4));
      if (frameRef.current) put(frameRef.current, "opacity", win(tx, W.frame) > 0 ? "1" : "0");
      if (fillRef.current) put(fillRef.current, "clipPath", `inset(0 ${((1 - easeInOut(win(tx, W.fill))) * 100).toFixed(2)}% 0 0)`);
      const pl = win(tx, W.label);
      const nc = ctaChars.current.length;
      ctaChars.current.forEach((el, i) => {
        if (!el) return;
        const p = clamp01(pl * (nc * 0.5 + 2) - i * 0.5);
        const e = easeOut(p);
        put(el, "opacity", e.toFixed(3));
        put(el, "transform", p >= 1 ? "" : `translateX(${((1 - e) * 10).toFixed(2)}px)`);
      });
      if (offsetRef.current) {
        const p = easeOut(win(tx, W.offset));
        put(offsetRef.current, "opacity", (p * 0.9).toFixed(3));
        put(offsetRef.current, "transform", `translate(${(5 + (1 - p) * 9).toFixed(2)}px, ${(5 + (1 - p) * 9).toFixed(2)}px)`);
      }
      if (glintRef.current) {
        let g = -120;
        if (t >= 0.995 && arrivedAt >= 0) {
          const cyc = ((time - arrivedAt + 3.6) % 9) / 1.4;
          if (cyc < 1) g = -120 + easeInOut(cyc) * 380;
        }
        put(glintRef.current, "--glint", `${g.toFixed(1)}%`);
      }

      // ── back to the top: label slides in, underline draws, arrow lifts (then bobs)
      if (backLabelRef.current) {
        const p = easeOut(win(tx, W.back));
        put(backLabelRef.current, "opacity", p.toFixed(3));
        put(backLabelRef.current, "clipPath", `inset(0 ${((1 - p) * 100).toFixed(2)}% 0 0)`);
      }
      if (backLineRef.current) put(backLineRef.current, "transform", `scaleX(${easeInOut(win(tx, W.line)).toFixed(4)})`);
      if (arrowRef.current) {
        const p = win(tx, W.arrow);
        const bob = t >= 0.995 && arrivedAt >= 0 ? Math.sin((time - arrivedAt) * 2.4) * 1.6 : 0;
        put(arrowRef.current, "opacity", easeOut(p).toFixed(3));
        put(arrowRef.current, "transform", `translateY(${((1 - backOut(p, 2)) * 9 + bob).toFixed(2)}px)`);
      }

      // ── ©: lands last
      if (copyRef.current) {
        const p = win(tx, W.copy);
        const e = backOut(p, 2.2);
        put(copyRef.current, "opacity", clamp01(p * 2).toFixed(3));
        put(copyRef.current, "transform", p >= 1 ? "" : `translateY(${((1 - e) * -14).toFixed(2)}px) rotate(${((1 - e) * -5).toFixed(2)}deg)`);
      }
    };

    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      const g = geometry();
      const target = forced || openRef.current ? 1 : g.d;
      // far from the finale (e.g. after "back to the top") nothing should lag
      if (reducedMotion || !g.near) { tl.x = target; tl.v = 0; th.x = g.q; th.v = 0; }
      else {
        const prevX = tl.x;
        springStep(tl, target, dt, target >= tl.x ? W_IN : W_OUT);
        if (tl.x > prevX) {
          const cap = rateIn(prevX);
          if (tl.x - prevX > cap * dt) { tl.x = prevX + cap * dt; tl.v = Math.min(tl.v, cap); }
        }
        springStep(th, g.q, dt, 6);
      }
      alloyBus.dive = reducedMotion ? 0 : tl.x;
      if (tl.x >= 0.995 && Math.abs(tl.v) < 0.01) { if (arrivedAt < 0) arrivedAt = now / 1000; }
      else arrivedAt = -1;
      render(now);
      const settled = Math.abs(tl.x - target) < 1e-4 && Math.abs(tl.v) < 1e-4 && Math.abs(th.x - g.q) < 1e-4 && Math.abs(th.v) < 1e-4;
      // keep running while moving, and at rest only for the idle life
      const idle = arrivedAt >= 0 && !reducedMotion && g.near;
      if (!document.hidden && (!settled || idle) && (g.near || !settled)) raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    };
    kickRef.current = kick;
    const onScroll = () => kick();
    const onFocus = () => { forced = true; kick(); };
    const onBlur = (e: FocusEvent) => {
      if (!section.contains(e.relatedTarget as Node | null)) { forced = false; kick(); }
    };
    const onVis = () => { if (!document.hidden) kick(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    const onResize = () => { measureCaret(); kick(); };
    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    section.addEventListener("focusin", onFocus);
    section.addEventListener("focusout", onBlur);
    // start from the current position without a spring run-up (reload mid-dive)
    const g0 = geometry();
    tl.x = g0.d; th.x = g0.q;
    alloyBus.dive = reducedMotion ? 0 : g0.d;
    alloyBus.diveLive = true;
    render(performance.now());
    kick();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      section.removeEventListener("focusin", onFocus);
      section.removeEventListener("focusout", onBlur);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      kickRef.current = () => {};
      alloyBus.dive = 0;
      alloyBus.diveLive = false;
    };
  }, [reducedMotion, scatter]);

  return (
    <section id="dive" ref={sectionRef} className="relative" style={{ height: "480vh" }} aria-label="Finale">
      {/* The one red element on the site: the threshold */}
      <div className={css.threshold}>
        <div ref={ruleRef} className={css.rule} />
        <span className={css.ruleLabel}>
          <span className={css.srOnly}>{LABEL}</span>
          <span aria-hidden="true">
            {LABEL.split("").map((c, i) => (
              <span key={i} ref={(el) => { ruleChars.current[i] = el; }} style={{ opacity: 0 }}>{c}</span>
            ))}
          </span>
        </span>
      </div>

      <div className={css.stage}>
        {/* DOM sky: reduced motion / no WebGL. The canvas carries it otherwise. */}
        <div ref={skyRef} className={css.sky} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={END_SKY} alt="" decoding="async" loading="lazy" />
          <div ref={breathRef} className={css.breath} style={{ opacity: 0, ["--breath" as string]: String(BREATH) }} />
        </div>

        <div ref={contentRef} className={css.content} style={{ opacity: 0 }}>
          <h2 className={css.head}>
            <span className={css.srOnly}>{HEAD}</span>
            <span aria-hidden="true">
              {headLetters.map((c, i) => (
                <span key={i} ref={(el) => { letters.current[i] = el; }} className={css.letter} style={{ opacity: 0 }}>
                  {c === " " ? " " : c}
                </span>
              ))}
            </span>
            <span ref={sheenRef} className={css.sheen} aria-hidden="true">{HEAD}</span>
          </h2>

          <span className={css.mailRow}>
            <span className={css.mail}>
              <span className={css.srOnly}>{MAIL}</span>
              <span aria-hidden="true">
                {MAIL.split("").map((c, i) => (
                  <span key={i} ref={(el) => { mailChars.current[i] = el; }} data-s="0" style={{ opacity: 0 }}>{c}</span>
                ))}
              </span>
              <span ref={caretRef} className={css.caret} aria-hidden="true" />
            </span>
            <button ref={mailCopyRef} type="button" className={css.mailCopy} onClick={copyMail} style={{ opacity: 0 }} aria-label={copied ? "Address copied" : `Copy ${MAIL}`}>
              {copied ? "copied" : "copy"}
            </button>
          </span>

          <div className={css.swap} data-open={open ? "" : undefined}>
          <div className={css.rowWrap} aria-hidden={open} inert={open}>
          <div className={css.rowClip}>
          <div className={css.row}>
            <button ref={ctaRef} type="button" className={css.cta} onClick={openSheet} aria-expanded={open}>
              <span ref={offsetRef} className={css.ctaOffset} aria-hidden="true" />
              <span ref={fillRef} className={css.ctaFill} aria-hidden="true" />
              <span ref={glintRef} className={css.ctaGlint} aria-hidden="true" />
              <svg className={css.ctaFrame} aria-hidden="true" preserveAspectRatio="none">
                <rect ref={frameRef} x="0" y="0" width="100%" height="100%" pathLength={1} strokeDasharray="1" style={{ strokeDashoffset: 1, opacity: 0 }} />
              </svg>
              <span className={css.ctaLabel}>
                <span className={css.srOnly}>{CTA}</span>
                <span aria-hidden="true">
                  {CTA.split("").map((c, i) => (
                    <span key={i} ref={(el) => { ctaChars.current[i] = el; }} style={{ opacity: 0 }}>{c === " " ? " " : c}</span>
                  ))}
                </span>
              </span>
            </button>
            <button ref={backRef} type="button" onClick={() => scrollToSection("hero")} className={css.back}>
              <span ref={backLabelRef} className={css.backLabel} style={{ opacity: 0 }}>{BACK}</span>
              <span ref={arrowRef} className={css.backArrow} aria-hidden="true" style={{ opacity: 0 }}>&uarr;</span>
              <span ref={backLineRef} className={css.backLine} aria-hidden="true" />
            </button>
          </div>
          </div>
          </div>
          <LeaveMessage open={open} onClose={closeSheet} />
          </div>

          <span ref={copyRef} className={`mark-caption ${css.copy}`} style={{ opacity: 0 }}>
            &copy; {year} william keffer
          </span>
        </div>
      </div>
    </section>
  );
}
