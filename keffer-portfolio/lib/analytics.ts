// Visitor analytics, counted by the site itself: each page view (how long it
// stayed in view, how far it was scrolled, which home sections it reached)
// and a few clicks (links out, downloads, a message sent) go to the
// keffer-analytics Worker (workers/analytics at the repo root), which adds
// where the reader is from Cloudflare's own lookup and keeps it in D1. The
// private dashboard is https://signal.keffer.cafe.
//
// No cookies: one random id per browser in localStorage (so a returning
// reader counts once), one per visit that lapses after 30 idle minutes.
// Opening the site with ?notrack stops this browser being counted
// (?notrack=0 undoes it). localhost isn't counted unless localStorage has
// kf:debug = 1 (then point NEXT_PUBLIC_ANALYTICS_ENDPOINT at `wrangler dev`).

import { useStore } from "./store";
import { BASE_PATH } from "./basePath";

export const ANALYTICS_ENDPOINT = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT || "https://signal.keffer.cafe/e";

const COUNTED_HOSTS = ["keffer.cafe", "www.keffer.cafe", "williethewhale.github.io"];
const VISIT_GAP = 30 * 60_000;
const IDLE = 60_000; // time in view stops counting a minute after the last input
const HEARTBEAT = 20_000;

const K_ID = "kf:id";
const K_VISIT = "kf:visit";
const K_OFF = "kf:off";
const K_DEBUG = "kf:debug";

interface View {
  id: string;
  path: string;
  engaged: number;
  mark: number;
  maxY: number;   // deepest scroll position reached, px
  height: number; // the page's height when last measured
  sections: string[];
  sent: string;
}

let enabled = false;
let visitor = "";
let isNew = false;
let view: View | null = null;
let lastInput = 0;
let started = false;

function rid(): string {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(b, (x) => x.toString(36).padStart(2, "0")).join("").slice(0, 20);
}

function store(): Storage | null {
  try {
    const s = window.localStorage;
    s.setItem("kf:t", "1");
    s.removeItem("kf:t");
    return s;
  } catch {
    return null;
  }
}

/** This visit's id: kept while the reader keeps coming back within half an hour. */
function visit(now: number): string {
  const s = store();
  if (!s) return "";
  try {
    const v = JSON.parse(s.getItem(K_VISIT) ?? "null") as { id: string; at: number } | null;
    const id = v && now - v.at < VISIT_GAP ? v.id : rid();
    s.setItem(K_VISIT, JSON.stringify({ id, at: now }));
    return id;
  } catch {
    return "";
  }
}

function send(body: Record<string, unknown>) {
  if (!enabled) return;
  const data = JSON.stringify({ v: visitor, s: visit(Date.now()), ...body });
  try {
    // a string body goes as text/plain: a simple request, no preflight
    if (navigator.sendBeacon?.(ANALYTICS_ENDPOINT, data)) return;
  } catch { /* fall through */ }
  fetch(ANALYTICS_ENDPOINT, { method: "POST", body: data, keepalive: true, mode: "no-cors" }).catch(() => {});
}

/** Fold the time since the last mark into the view, if the page was in view and in use. */
function accrue(now: number) {
  if (!view) return;
  if (document.visibilityState === "visible") {
    const until = Math.min(now, lastInput + IDLE);
    if (until > view.mark) view.engaged += until - view.mark;
  }
  view.mark = now;
}

const trim = (p: string) => p.replace(/\/+$/, "") || "/";

function measureScroll() {
  if (!view) return;
  // once the URL is the next route's, the page on screen isn't this view's
  if (trim(location.pathname.slice(BASE_PATH.length)) !== trim(view.path)) return;
  view.maxY = Math.max(view.maxY, window.scrollY);
  view.height = document.documentElement.scrollHeight;
}

/** % of the page seen, against its latest height (it grows as the loader clears and images land). */
function depth(v: View): number {
  return v.height > 0 ? Math.min(100, Math.round(((v.maxY + window.innerHeight) / v.height) * 100)) : 0;
}

/** Send the view's latest numbers. `measure` is false once the next route has rendered. */
function report(measure = true) {
  if (!view) return;
  accrue(Date.now());
  if (measure) measureScroll();
  const body = { t: "ping", id: view.id, e: Math.round(view.engaged), sc: depth(view), se: view.sections.join(",") };
  const key = `${body.e}|${body.sc}|${body.se}`;
  if (key === view.sent) return;
  view.sent = key;
  send(body);
}

function onInput() {
  const now = Date.now();
  if (now - lastInput > IDLE) accrue(now);
  lastInput = now;
}

function setup() {
  if (started) return;
  started = true;
  const s = store();
  const params = new URLSearchParams(location.search);
  if (params.has("notrack")) {
    const off = params.get("notrack") !== "0";
    try { if (off) s?.setItem(K_OFF, "1"); else s?.removeItem(K_OFF); } catch { /* storage blocked */ }
    params.delete("notrack");
    const q = params.toString();
    history.replaceState(history.state, "", `${location.pathname}${q ? `?${q}` : ""}${location.hash}`);
    console.info(off ? "keffer.cafe: this browser is no longer counted (?notrack=0 to undo)" : "keffer.cafe: this browser is counted again");
  }
  enabled = (COUNTED_HOSTS.includes(location.hostname) || s?.getItem(K_DEBUG) === "1") && !s?.getItem(K_OFF);
  if (!enabled) return;

  // Global Privacy Control: count the view, keep no id
  const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
  if (s && !gpc) {
    visitor = s.getItem(K_ID) ?? "";
    if (!visitor) {
      visitor = rid();
      isNew = true;
      try { s.setItem(K_ID, visitor); } catch { visitor = ""; }
    }
  }

  lastInput = Date.now();
  for (const type of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"]) {
    window.addEventListener(type, onInput, { passive: true, capture: true });
  }
  let scrollRaf = 0;
  window.addEventListener("scroll", () => {
    if (!scrollRaf) scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; measureScroll(); });
  }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") report();
    else if (view) { view.mark = Date.now(); lastInput = Date.now(); }
  });
  window.addEventListener("pagehide", () => report());
  setInterval(() => { if (document.visibilityState === "visible") report(); }, HEARTBEAT);

  // the home page's sections, as the reader reaches them (lib/sections.ts)
  useStore.subscribe((st, prev) => {
    if (view && view.path === "/" && st.activeSection !== prev.activeSection && !view.sections.includes(st.activeSection)) {
      view.sections.push(st.activeSection);
    }
  });

  // links out, mailto links and downloads, wherever they are on the page
  document.addEventListener("click", (e) => {
    const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a) return;
    const url = new URL(a.href, location.href);
    if (url.protocol === "mailto:") track("email", url.pathname);
    else if (a.hasAttribute("download") || /\.(pdf|zip|docx?)$/i.test(url.pathname)) track("download", url.pathname.split("/").pop() ?? url.pathname);
    else if (/^https?:$/.test(url.protocol) && url.hostname !== location.hostname) track("outbound", (url.hostname.replace(/^www\./, "") + url.pathname).replace(/\/$/, ""));
  }, { capture: true });
}

/** A page view began (first load or a client-side navigation). */
export function trackPageview(path: string) {
  setup();
  if (!enabled) return;
  const first = !view;
  // the new route is already on screen: the old view keeps the depth it reached
  if (view) report(false);
  const now = Date.now();
  view = { id: rid(), path, engaged: 0, mark: now, maxY: 0, height: 0, sections: [], sent: "" };
  if (path === "/") view.sections.push(useStore.getState().activeSection);
  const nav = navigator as Navigator & { webdriver?: boolean };
  send({
    t: "pv",
    id: view.id,
    n: first && isNew ? 1 : 0,
    p: path,
    q: first ? location.search : "",
    r: first ? document.referrer : "",
    nav: first ? 0 : 1,
    ti: document.title,
    sw: screen.width,
    sh: screen.height,
    vw: window.innerWidth,
    vh: window.innerHeight,
    tp: navigator.maxTouchPoints || 0,
    l: navigator.language,
    se: view.sections.join(","),
    wd: nav.webdriver ? 1 : 0,
  });
}

/** Something worth counting: `name` is lowercase-dashed, `label` says which. */
export function track(name: string, label?: string) {
  if (!enabled || !view) return;
  send({ t: "ev", id: view.id, name, label: label ?? "", p: view.path });
}
