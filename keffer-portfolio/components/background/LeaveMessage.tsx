"use client";

// Background — ALLOY. The finale's "Leave a message" sheet: a mounted print
// on the end card (Bone paper and grain, an offset hairline frame, crop
// marks), its fields typed ledger rows, the message written on ruled lines.
// It unfolds in place of the card's buttons (Dive.tsx) and posts to the
// contact Worker, which emails it on (lib/contact.ts).

import { useEffect, useRef, useState, type FormEvent } from "react";
import { withBase } from "@/lib/basePath";
import { CONTACT_EMAIL, CONTACT_ENDPOINT } from "@/lib/contact";
import { PAPER } from "./paper";
import { CropMarks } from "./print";
import s from "./LeaveMessage.module.css";

const GRAIN = `url(${withBase("/assets/background/paper-grain.png")})`;
const MAX_NAME = 80;
const MAX_MESSAGE = 4000;

type State = "idle" | "sending" | "sent" | "error";

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
function stamp(d: Date) {
  return `RX ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} · ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function LeaveMessage({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<State>("idle");
  const [note, setNote] = useState("");
  const [rx, setRx] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const msgRef = useRef<HTMLTextAreaElement>(null);
  const trapRef = useRef<HTMLInputElement>(null);
  const againRef = useRef<HTMLButtonElement>(null);

  // the name field takes focus once the sheet has unfolded (not on touch
  // screens, where it would throw the keyboard up unasked)
  useEffect(() => {
    if (!open || state === "sent") return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const t = setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 420);
    return () => clearTimeout(t);
  }, [open, state]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (state === "sending") return;
    const n = name.trim(), m = message.trim();
    if (!n) { setNote("a name, please"); nameRef.current?.focus(); return; }
    if (m.length < 2) { setNote("a few words, please"); msgRef.current?.focus(); return; }
    setState("sending");
    setNote("");
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15000);
    try {
      // text/plain keeps it a simple request (no CORS preflight); the Worker parses the JSON
      const res = await fetch(CONTACT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ name: n, message: m, website: trapRef.current?.value ?? "", page: location.href }),
        signal: ctl.signal,
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (!res.ok || !body.ok) throw new Error(String(res.status));
      setRx(stamp(new Date()));
      setState("sent");
      setTimeout(() => againRef.current?.focus({ preventScroll: true }), 80);
    } catch {
      setState("error");
    } finally {
      clearTimeout(timer);
    }
  };

  const again = () => {
    setName("");
    setMessage("");
    setState("idle");
    setNote("");
  };

  const status =
    state === "sending" ? "transmitting" :
    state === "error" ? "" :
    note || "goes straight to my inbox";

  return (
    <div className={s.wrap} data-open={open ? "" : undefined} aria-hidden={!open} inert={!open}>
      <div className={s.clip}>
        <div className={s.pad}>
        <form className={s.sheet} onSubmit={submit} noValidate data-state={state} aria-label="Leave a message">
          <span className={s.offset} aria-hidden="true" />
          <span className={s.marks} aria-hidden="true"><CropMarks off={8} len={12} /></span>
          <span className={s.paper} aria-hidden="true" style={{ background: PAPER }}>
            <span className={s.grain} style={{ backgroundImage: GRAIN }} />
          </span>

          <div className={s.form}>
            <header className={`${s.item} ${s.head}`}>
              <h3 className={s.title}>Leave a message</h3>
              <span className={s.ref}>to w. keffer</span>
            </header>
            <span className={`${s.item} ${s.rules}`} aria-hidden="true"><i /><i /><i /></span>

            <label className={`${s.item} ${s.row}`}>
              <span className={s.k}>01 / name</span>
              <input
                ref={nameRef}
                className={s.input}
                name="name"
                autoComplete="name"
                maxLength={MAX_NAME}
                value={name}
                onChange={(e) => { setName(e.target.value); if (note) setNote(""); }}
                disabled={state === "sending"}
                required
              />
            </label>

            <label className={`${s.item} ${s.rowCol}`}>
              <span className={s.kRow}>
                <span className={s.k}>02 / message</span>
                <span className={s.count} aria-hidden="true">{pad(message.length, 4)} / {MAX_MESSAGE}</span>
              </span>
              <textarea
                ref={msgRef}
                className={s.text}
                name="message"
                rows={5}
                maxLength={MAX_MESSAGE}
                value={message}
                onChange={(e) => { setMessage(e.target.value); if (note) setNote(""); }}
                disabled={state === "sending"}
                data-lenis-prevent
                required
              />
            </label>

            {/* left empty by people; bots fill it in */}
            <input ref={trapRef} className={s.trap} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />

            <footer className={`${s.item} ${s.foot}`}>
              <span className={s.status} role="status" aria-live="polite">
                {state === "error" ? (
                  <>didn&rsquo;t go through &mdash; write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></>
                ) : (
                  <>{status}{state === "sending" && <span className={s.dots} aria-hidden="true" />}</>
                )}
              </span>
              <button type="button" className={s.cancel} onClick={onClose}>cancel</button>
              <button type="submit" className={s.send} disabled={state === "sending"}>
                <span className={s.sendLabel}>{state === "sending" ? "sending" : state === "error" ? "try again" : "send"}</span>
              </button>
            </footer>
          </div>

          <div className={s.receipt} aria-hidden={state !== "sent"} inert={state !== "sent"}>
            <span className={s.rxHead}>Received</span>
            <span className={s.rxRule} aria-hidden="true" />
            <p className={s.rxLine}>Thank you{name.trim() ? `, ${name.trim()}` : ""} &mdash; it&rsquo;s in my inbox.</p>
            <span className={s.rxStamp}>{rx}</span>
            <span className={s.rxActions}>
              <button ref={againRef} type="button" className={s.cancel} onClick={again}>write another</button>
              <button type="button" className={s.cancel} onClick={() => { onClose(); setTimeout(again, 600); }}>close</button>
            </span>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
