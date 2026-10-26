// Signal — keffer.cafe's analytics dashboard.
//
// Fetches the raw page views for the chosen range (and the period before it,
// for the deltas) and does all the counting here, so a click on any row, the
// map or a tile re-slices the whole board without another request. Every
// string from the data goes into the DOM as text, never as HTML.

const $app = document.getElementById("app");
const $tip = document.getElementById("tooltip");
const SVG = "http://www.w3.org/2000/svg";

// the home page's sections, in scroll order (keffer-portfolio/lib/sections.ts)
const SECTIONS = [
  ["hero", "Signal"], ["about", "Bio"], ["work", "Work"], ["stuff", "My stuff"],
  ["experience", "Experience"], ["contact", "Contact"], ["dive", "The Dive"],
];

const RANGES = [
  ["today", "Today"], ["yesterday", "Yesterday"], ["7d", "7 days"], ["30d", "30 days"],
  ["90d", "90 days"], ["12m", "12 months"], ["all", "All time"],
];

const METRICS = {
  visitors: { label: "Visitors", noun: ["visitor", "visitors"] },
  visits: { label: "Visits", noun: ["visit", "visits"] },
  views: { label: "Page views", noun: ["page view", "page views"] },
  time: { label: "Time per visit", noun: ["per visit", "per visit"], duration: true },
};

const EVENT_NAMES = {
  outbound: "Link out", download: "Download", email: "Email link",
  "message-sent": "Sent a message", copy: "Copied",
};

const LIVE_EVERY = 20_000;
const REFRESH_EVERY = 60_000;

// ---------- formatting ----------

const nf = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const fmtN = (n) => (n >= 10000 ? compact.format(n) : nf.format(n));
const pct = (n) => `${Math.round(n * 100)}%`;
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

function fmtDur(ms) {
  const s = Math.round((ms || 0) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

function countryName(c) {
  if (!c || c === "XX") return "Unknown";
  if (c === "T1") return "Tor network";
  try { return regionNames.of(c) ?? c; } catch { return c; }
}

function flag(c) {
  if (!c || !/^[A-Z]{2}$/.test(c) || c === "XX" || c === "T1") return "·";
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

function languageName(tag) {
  try { return languageNames.of(tag) ?? tag; } catch { return tag; }
}

const plural = (n, [one, many]) => `${fmtN(n)} ${n === 1 ? one : many}`;
const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const fmtDay = (t) => new Date(t).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
const fmtDayYear = (t) => new Date(t).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

function ago(t, now) {
  const s = (now - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return fmtDay(t);
}

// ---------- DOM ----------

function h(tag, props, ...kids) {
  const svg = tag.startsWith("svg:");
  const el = svg ? document.createElementNS(SVG, tag.slice(4)) : document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === "style") Object.assign(el.style, v);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "text") el.textContent = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : String(kid));
  }
  return el;
}

/** replaceChildren with h()'s rules: arrays flattened, null / false skipped. */
function fill(el, ...kids) {
  el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false).map((k) => (k instanceof Node ? k : String(k))));
}

function tip(evt, ...lines) {
  fill($tip, lines);
  $tip.hidden = false;
  const pad = 14;
  const { innerWidth: W, innerHeight: H } = window;
  const r = $tip.getBoundingClientRect();
  let x = evt.clientX + pad;
  let y = evt.clientY + pad;
  if (x + r.width > W - 8) x = evt.clientX - r.width - pad;
  if (y + r.height > H - 8) y = evt.clientY - r.height - pad;
  $tip.style.left = `${Math.max(8, x)}px`;
  $tip.style.top = `${Math.max(8, y)}px`;
}
const untip = () => { $tip.hidden = true; };

// ---------- time ranges ----------

function startOfDay(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
function addDays(t, n) { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); }
function addMonths(t, n) { const d = new Date(t); d.setMonth(d.getMonth() + n); return d.getTime(); }
function startOfMonth(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(1); return d.getTime(); }

/** The range's own span [from, to) for buckets, and the matching span before it. */
function rangeOf(key, now) {
  const today = startOfDay(now);
  const days = (n) => ({
    from: addDays(today, 1 - n), to: addDays(today, 1), unit: "day",
    prev: [addDays(today, 1 - 2 * n), addDays(now, -n)],
  });
  switch (key) {
    case "today": return { from: today, to: addDays(today, 1), unit: "hour", prev: [addDays(today, -1), addDays(now, -1)] };
    case "yesterday": return { from: addDays(today, -1), to: today, unit: "hour", prev: [addDays(today, -2), addDays(today, -1)] };
    case "7d": return days(7);
    case "30d": return days(30);
    case "90d": return days(90);
    case "12m": {
      const m = startOfMonth(now);
      return { from: addMonths(m, -11), to: addMonths(m, 1), unit: "month", prev: [addMonths(m, -23), addMonths(now, -12)] };
    }
    default: return { from: 0, to: addDays(today, 1), unit: "day", prev: null, all: true };
  }
}

function buckets(r) {
  const out = [];
  let t = r.from;
  while (t < r.to && out.length < 400) {
    const next = r.unit === "hour" ? t + 3_600_000 : r.unit === "day" ? addDays(t, 1) : addMonths(t, 1);
    out.push({ start: t, end: next, views: [] });
    t = next;
  }
  return out;
}

function bucketLabel(t, unit, long) {
  const d = new Date(t);
  if (unit === "hour") {
    const hr = d.toLocaleTimeString([], { hour: "numeric" });
    return long ? `${fmtDay(t)}, ${hr}` : hr;
  }
  if (unit === "day") return long ? fmtDay(t) : d.toLocaleDateString([], { month: "short", day: "numeric" });
  return d.toLocaleDateString([], long ? { month: "long", year: "numeric" } : { month: "short" });
}

// ---------- state ----------

const state = {
  range: "7d",
  metric: "visitors",
  filters: {},
  everyone: false,
  tabs: {},
  expanded: {},
  visitsShown: 25,
  map: "world",
  chartTable: false,
};
let D = null; // the loaded data, prepared

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (RANGES.some(([k]) => k === p.get("range"))) state.range = p.get("range");
  if (METRICS[p.get("metric")]) state.metric = p.get("metric");
  state.everyone = p.get("everyone") === "1";
  state.filters = {};
  for (const k of Object.keys(DIMS)) if (p.has(k)) state.filters[k] = p.get(k);
}

function writeHash() {
  const p = new URLSearchParams({ range: state.range });
  if (state.metric !== "visitors") p.set("metric", state.metric);
  if (state.everyone) p.set("everyone", "1");
  for (const [k, v] of Object.entries(state.filters)) p.set(k, v);
  history.replaceState(null, "", `#${p}`);
}

// ---------- dimensions: what a row, the map or a chip can filter by ----------

const cityKey = (v) => (v.city ? [v.city, v.region ?? "", v.country ?? ""].join("|") : null);
const regionKey = (v) => (v.region ? [v.region, v.country ?? ""].join("|") : null);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const DIMS = {
  country: { label: "Country", get: (v) => v.country ?? "XX", show: (k) => [flagEl(k), countryName(k)] },
  region: {
    label: "Region", get: regionKey,
    show: (k) => { const [r, c] = k.split("|"); return [flagEl(c), r, c ? h("small", {}, c) : null]; },
  },
  city: {
    label: "City", get: cityKey,
    show: (k) => { const [ci, r, c] = k.split("|"); return [flagEl(c), ci, h("small", {}, [r, c].filter(Boolean).join(", "))]; },
  },
  source: { label: "Source", get: (v) => v.s.source },
  referrer: { label: "Referrer", get: (v) => v.s.referrer },
  campaign: { label: "Campaign", get: (v) => v.s.campaign },
  page: { label: "Page", get: (v) => v.path },
  entry: { label: "Entry page", get: (v) => v.s.entry.path },
  device: { label: "Device", get: (v) => v.device, show: (k) => [cap(k)] },
  browser: { label: "Browser", get: (v) => v.browser },
  os: { label: "OS", get: (v) => v.os },
  screen: { label: "Screen", get: (v) => v.screen },
  lang: { label: "Language", get: (v) => v.lang, show: (k) => [languageName(k), h("small", {}, k)] },
  org: { label: "Network", get: (v) => v.org },
  timezone: { label: "Time zone", get: (v) => v.timezone },
  kind: { label: "Visitor", get: (v) => (v.s.isNew ? "New" : "Returning") },
};

const flagEl = (c) => h("span", { class: "flag", "aria-hidden": "true" }, flag(c));
const showKey = (dim, k) => (DIMS[dim].show ? DIMS[dim].show(k) : [k]);
const showText = (dim, k) => showKey(dim, k)
  .filter((x) => x != null && !(x instanceof Element && x.classList.contains("flag")))
  .map((x) => (x instanceof Node ? x.textContent : x))
  .join(" ");

// ---------- data ----------

async function getJSON(url, opts) {
  const res = await fetch(url, { credentials: "same-origin", ...opts });
  if (res.status === 401) { stopTimers(); renderGate(); throw new Error("signed out"); }
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

const objects = ({ cols, rows }) => rows.map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]])));

function prepare(raw) {
  const views = objects(raw.views);
  const events = objects(raw.events);
  const sessions = new Map();
  for (const v of views) {
    let s = sessions.get(v.session);
    if (!s) {
      s = { id: v.session, visitor: v.visitor, views: [], events: [], start: v.ts, end: v.last, engaged: 0 };
      sessions.set(v.session, s);
    }
    s.views.push(v);
    s.end = Math.max(s.end, v.last);
    s.engaged += v.engaged;
    v.s = s;
  }
  for (const s of sessions.values()) {
    s.entry = s.views[0];
    const src = s.views.find((v) => v.source != null);
    s.source = src?.source ?? "Direct";
    s.referrer = src?.referrer ?? null;
    s.campaign = src?.utm_campaign ?? (src?.utm_source && src?.utm_medium ? `${src.utm_source} / ${src.utm_medium}` : null);
    s.isNew = s.entry.first >= s.start;
  }
  for (const e of events) {
    e.s = sessions.get(e.session);
    e.s?.events.push(e);
  }
  return { views, events, sessions, ignored: new Map(raw.ignored.map((i) => [i.visitor, i])), now: raw.now };
}

const counted = (v) => state.everyone || (!v.bot && !String(v.host).startsWith("localhost") && !D.ignored.has(v.visitor));
const passes = (v) => Object.entries(state.filters).every(([k, val]) => String(DIMS[k].get(v)) === val);

function summarize(vs, from) {
  const visitors = new Set();
  const fresh = new Set();
  const visits = new Set();
  const countries = new Set();
  let engaged = 0;
  for (const v of vs) {
    visitors.add(v.visitor);
    if (v.first >= from) fresh.add(v.visitor);
    visits.add(v.session);
    if (v.country && v.country !== "XX") countries.add(v.country);
    engaged += v.engaged;
  }
  return {
    visitors: visitors.size, fresh: fresh.size, visits: visits.size, views: vs.length,
    time: visits.size ? engaged / visits.size : 0, countries: countries.size,
  };
}

function metricOf(vs, metric) {
  if (metric === "views") return vs.length;
  if (metric === "visitors") return new Set(vs.map((v) => v.visitor)).size;
  const visits = new Set(vs.map((v) => v.session)).size;
  if (metric === "visits") return visits;
  return visits ? vs.reduce((a, v) => a + v.engaged, 0) / visits : 0;
}

/** Rows for a table: [{key, n, aux}] sorted by n. */
function group(vs, dim, measure, aux) {
  const m = new Map();
  for (const v of vs) {
    const k = DIMS[dim].get(v);
    if (k == null || k === "") continue;
    let g = m.get(k);
    if (!g) m.set(k, (g = { key: String(k), set: new Set(), n: 0, engaged: 0 }));
    g.n++;
    g.engaged += v.engaged;
    g.set.add(measure === "visitors" ? v.visitor : v.session);
  }
  return [...m.values()]
    .map((g) => ({ key: g.key, n: measure === "views" ? g.n : g.set.size, aux: aux === "time" ? fmtDur(g.engaged / g.n) : null }))
    .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
}

// ---------- load + refresh ----------

let loadSeq = 0;
let liveTimer = 0;
let refreshTimer = 0;

async function load({ quiet = false } = {}) {
  const seq = ++loadSeq;
  const now = Date.now();
  const r = rangeOf(state.range, now);
  if (!quiet) document.body.classList.add("loading");
  try {
    const raw = await getJSON(`/api/data?from=${r.prev ? r.prev[0] : 0}&to=${now + 1}`);
    if (seq !== loadSeq) return;
    D = prepare(raw);
    if (r.all) {
      const firstTs = D.views.find(counted)?.ts ?? now;
      const span = now - firstTs;
      r.unit = span <= 2 * 86_400_000 ? "hour" : span <= 120 * 86_400_000 ? "day" : "month";
      r.from = r.unit === "month" ? startOfMonth(firstTs) : startOfDay(firstTs);
    }
    D.range = r;
    render();
  } catch (err) {
    if (String(err.message) !== "signed out") showError(err);
  } finally {
    if (seq === loadSeq) document.body.classList.remove("loading");
  }
}

function startTimers() {
  stopTimers();
  pollLive();
  liveTimer = setInterval(pollLive, LIVE_EVERY);
  refreshTimer = setInterval(() => {
    if (document.visibilityState === "visible" && D && D.now < D.range.to) load({ quiet: true });
  }, REFRESH_EVERY);
}
function stopTimers() { clearInterval(liveTimer); clearInterval(refreshTimer); }

let live = { views: [], now: 0 };
async function pollLive() {
  if (document.visibilityState !== "visible") return;
  try {
    live = await getJSON("/api/live");
    paintLive();
  } catch { /* the next poll tries again */ }
}

function paintLive() {
  const el = document.querySelector(".live");
  if (!el) return;
  const people = new Set(live.views.map((v) => v.visitor)).size;
  el.classList.toggle("on", people > 0);
  el.replaceChildren(h("span", { class: "dot", "aria-hidden": "true" }), h("span", {}, h("b", {}, fmtN(people)), " viewing now"));
  const pop = document.querySelector(".live-pop");
  if (pop) fillLivePop(pop);
}

function fillLivePop(pop) {
  const latest = new Map();
  for (const v of live.views) if (!latest.has(v.visitor)) latest.set(v.visitor, v);
  const rows = [...latest.values()];
  fill(pop, 
    h("p", { class: "eyebrow" }, "On the site in the last 2 minutes"),
    rows.length
      ? h("ul", {}, rows.map((v) => h("li", {},
          h("span", {}, flag(v.country), " ", [v.city, v.region].filter(Boolean).join(", ") || countryName(v.country)),
          h("span", {}, v.path, " · ", ago(v.last, live.now)))))
      : h("p", { class: "empty" }, "Nobody right now."),
  );
}

// ---------- sign-in ----------

function renderGate() {
  document.body.className = "gate";
  const btn = h("button", { class: "primary", type: "button" }, "Email me a sign-in link");
  const note = h("p", { class: "note" }, "It goes to the one address this dashboard trusts, and works once, for 15 minutes.");
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Sending…";
    try {
      const res = await fetch("/auth/link", { method: "POST", credentials: "same-origin" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || res.status);
      btn.textContent = "Link sent";
      note.textContent = `Sent to ${body.to}. Open it on this device within 15 minutes.`;
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Email me a sign-in link";
      note.textContent = String(err.message) === "slow down" ? "A link was just sent. Wait a minute before asking again." : "That didn't go through. Try again in a moment.";
    }
  });
  $app.replaceChildren(h("main", { class: "gate-card" },
    h("p", { class: "eyebrow" }, "keffer.cafe · signal"),
    h("h1", {}, "Who's reading"),
    h("p", {}, "Visitors to keffer.cafe: how many, where they're from, how they found it, and what they read."),
    btn, note,
  ));
}

function showError(err) {
  console.error(err);
  const board = document.querySelector(".board");
  const msg = h("div", { class: "notice" }, "Couldn't load the numbers. They'll retry in a minute; reload to try now.");
  if (board) board.prepend(msg);
  else $app.replaceChildren(h("div", { class: "shell" }, msg));
}

// ---------- the board ----------

function render() {
  if (!D) return;
  writeHash();
  const r = D.range;
  const now = D.now;
  const filtered = D.views.filter((v) => counted(v) && passes(v));
  const cur = filtered.filter((v) => v.ts >= r.from && v.ts <= now);
  const prev = r.prev ? filtered.filter((v) => v.ts >= r.prev[0] && v.ts < r.prev[1]) : null;
  const K = summarize(cur, r.from);
  const P = prev && summarize(prev, r.prev[0]);
  const curSessions = new Set(cur.map((v) => v.session));
  const events = D.events.filter((e) => e.ts >= r.from && e.ts <= now && curSessions.has(e.session));

  document.body.classList.remove("gate");
  const scrollY = window.scrollY;

  const chartBox = h("div", { class: "chart" });
  const mapBox = h("div", { class: "map" });

  const shell = h("div", { class: "shell" },
    header(),
    filterRow(),
    h("div", { class: "board" },
      kpis(K, P),
      h("section", { class: "card span-12" },
        h("div", { class: "card-head" },
          h("h2", {}, METRICS[state.metric].label, h("span", { class: "sub" }, r.unit === "hour" ? "by hour" : r.unit === "day" ? "by day" : "by month")),
          h("div", { class: "tabs" }, h("button", {
            type: "button", "aria-pressed": state.chartTable,
            onclick: () => { state.chartTable = !state.chartTable; render(); },
          }, state.chartTable ? "Chart" : "Table")),
        ),
        chartBox,
      ),
      h("section", { class: "card span-12" },
        h("div", { class: "card-head" },
          h("h2", {}, "Where they're from", h("span", { class: "sub" }, `${plural(K.countries, ["country", "countries"])}`)),
          h("div", { class: "tabs" },
            [["world", "World"], ["us", "United States"]].map(([k, l]) => h("button", {
              type: "button", "aria-pressed": state.map === k, onclick: () => { state.map = k; render(); },
            }, l))),
        ),
        mapBox,
      ),
      panel("location", "Location", cur, [
        { id: "country", label: "Countries", dim: "country", measure: "visitors" },
        { id: "region", label: "Regions", dim: "region", measure: "visitors" },
        { id: "city", label: "Cities", dim: "city", measure: "visitors" },
      ]),
      panel("sources", "How they found it", cur, [
        { id: "source", label: "Sources", dim: "source", measure: "visits" },
        { id: "referrer", label: "Referrers", dim: "referrer", measure: "visits" },
        { id: "campaign", label: "Campaigns", dim: "campaign", measure: "visits" },
      ]),
      panel("pages", "What they read", cur, [
        { id: "page", label: "Pages", dim: "page", measure: "views", aux: "time" },
        { id: "entry", label: "Entry pages", dim: "entry", measure: "visits" },
      ]),
      reachPanel(cur),
      panel("tech", "Devices", cur, [
        { id: "device", label: "Device", dim: "device", measure: "visitors" },
        { id: "browser", label: "Browser", dim: "browser", measure: "visitors" },
        { id: "os", label: "OS", dim: "os", measure: "visitors" },
        { id: "screen", label: "Screen", dim: "screen", measure: "visitors" },
      ]),
      panel("audience", "Audience", cur, [
        { id: "kind", label: "New vs returning", dim: "kind", measure: "visitors" },
        { id: "org", label: "Networks", dim: "org", measure: "visitors" },
        { id: "lang", label: "Languages", dim: "lang", measure: "visitors" },
        { id: "timezone", label: "Time zones", dim: "timezone", measure: "visitors" },
      ]),
      eventsPanel(events),
      heatPanel(cur),
      visitsCard(cur, now),
    ),
    footer(),
  );
  $app.replaceChildren(shell);
  window.scrollTo(0, scrollY);

  const bs = buckets(r);
  let i = 0;
  for (const v of cur) {
    while (i < bs.length - 1 && v.ts >= bs[i].end) i++;
    if (v.ts >= bs[i].start && v.ts < bs[i].end) bs[i].views.push(v);
  }
  drawChart(chartBox, bs, r.unit, now);
  drawMap(mapBox, cur);
  paintLive();
}

function header() {
  const liveBtn = h("button", { class: "live", type: "button", "aria-haspopup": "dialog" });
  liveBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = document.querySelector(".live-pop");
    if (open) return open.remove();
    const pop = h("div", { class: "live-pop", role: "dialog", "aria-label": "Viewing now" });
    fillLivePop(pop);
    document.body.append(pop);
    const close = (ev) => { if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener("click", close); } };
    setTimeout(() => document.addEventListener("click", close));
  });
  return h("header", { class: "top" },
    h("div", { class: "brand" },
      h("h1", {}, h("a", { href: "https://keffer.cafe", target: "_blank", rel: "noopener" }, "keffer.cafe")),
      h("p", { class: "eyebrow" }, "signal"),
    ),
    h("div", { class: "top-right" },
      liveBtn,
      h("button", {
        class: "ghost", type: "button",
        onclick: async () => {
          await fetch("/auth/logout", { method: "POST", credentials: "same-origin" });
          stopTimers();
          renderGate();
        },
      }, "Sign out"),
    ),
  );
}

function filterRow() {
  const chips = Object.entries(state.filters).map(([k, v]) => h("button", {
    class: "chip", type: "button", title: "Remove this filter",
    onclick: () => { delete state.filters[k]; render(); },
  }, h("span", { class: "k" }, DIMS[k].label), " ", showText(k, v), h("span", { class: "x", "aria-hidden": "true" }, "×")));
  const all = h("input", { type: "checkbox" });
  all.checked = state.everyone;
  all.addEventListener("change", () => { state.everyone = all.checked; render(); });
  return h("div", { class: "filters" },
    h("div", { class: "seg", role: "group", "aria-label": "Time range" },
      RANGES.map(([k, l]) => h("button", {
        type: "button", "aria-pressed": state.range === k,
        onclick: () => { if (state.range !== k) { state.range = k; load(); } },
      }, l))),
    chips,
    h("label", { class: "toggle", title: "Crawlers, headless browsers, local testing, and browsers you've marked as yours" },
      all, "Include bots & my own visits"),
  );
}

function deltaBadge(now, before, { duration } = {}) {
  if (before == null) return null;
  if (!before) return now ? h("span", { class: "delta up" }, "▲ new") : h("span", { class: "delta flat" }, "–");
  const d = (now - before) / before;
  if (Math.abs(d) < 0.005) return h("span", { class: "delta flat" }, "– 0%");
  const label = duration ? fmtDur(Math.abs(now - before)) : `${Math.round(Math.abs(d) * 100)}%`;
  return h("span", { class: `delta ${d > 0 ? "up" : "down"}` }, d > 0 ? "▲ " : "▼ ", label);
}

function kpis(K, P) {
  const vs = state.range === "today" ? "vs yesterday" : P ? "vs the period before" : "";
  const tile = (metric, value, meta, hero) => h("button", {
    class: `kpi${hero ? " hero" : ""}`, type: "button", "aria-pressed": state.metric === metric,
    onclick: () => { state.metric = metric; render(); },
  },
  h("span", { class: "label" }, METRICS[metric].label),
  h("span", { class: "value" }, value),
  h("span", { class: "meta" }, meta));
  return h("div", { class: "kpis" },
    tile("visitors", fmtN(K.visitors), [deltaBadge(K.visitors, P?.visitors), h("span", {}, `${fmtN(K.fresh)} new · ${fmtN(K.visitors - K.fresh)} returning`)], true),
    tile("visits", fmtN(K.visits), [deltaBadge(K.visits, P?.visits), h("span", {}, vs)]),
    tile("views", fmtN(K.views), [deltaBadge(K.views, P?.views), h("span", {}, K.visits ? `${(K.views / K.visits).toFixed(1)} per visit` : "")]),
    tile("time", fmtDur(K.time), [deltaBadge(K.time, P?.time, { duration: true }), h("span", {}, "in view")]),
    h("div", { class: "kpi static" },
      h("span", { class: "label" }, "Countries"),
      h("span", { class: "value" }, fmtN(K.countries)),
      h("span", { class: "meta" }, deltaBadge(K.countries, P?.countries))),
  );
}

// ---------- the time chart: one series, columns from a single baseline ----------

function niceStep(max, count) {
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const e = raw / mag;
  return (e >= 7.5 ? 10 : e >= 3.5 ? 5 : e >= 1.5 ? 2 : 1) * mag;
}

function drawChart(box, bs, unit, now) {
  const m = METRICS[state.metric];
  const values = bs.map((b) => metricOf(b.views, state.metric));
  const fmt = m.duration ? fmtDur : fmtN;

  if (state.chartTable) {
    box.replaceChildren(h("div", { class: "table-scroll" }, h("table", { class: "data" },
      h("thead", {}, h("tr", {}, h("th", {}, unit === "hour" ? "Hour" : unit === "day" ? "Day" : "Month"), h("th", { class: "n" }, m.label))),
      h("tbody", {}, bs.map((b, i) => h("tr", {}, h("td", {}, bucketLabel(b.start, unit, true)), h("td", { class: "n" }, b.start > now ? "–" : fmt(values[i]))))))));
    return;
  }

  const W = Math.max(280, box.clientWidth);
  const H = 220;
  const M = { t: 10, r: 6, b: 26, l: m.duration ? 52 : 40 };
  const pw = W - M.l - M.r;
  const ph = H - M.t - M.b;

  // ticks: whole counts, or whole seconds/minutes for time
  const max = Math.max(...values, 0);
  const scaleMax = m.duration ? Math.max(max / 1000, 10) : Math.max(max, 4);
  let step = niceStep(scaleMax, 4);
  if (!m.duration) step = Math.max(1, step);
  else if (step > 60) step = Math.ceil(step / 60) * 60;
  const top = Math.ceil(scaleMax / step) * step;
  const yTop = m.duration ? top * 1000 : top;
  const y = (v) => M.t + ph - (v / yTop) * ph;

  const band = pw / bs.length;
  const bw = Math.max(1, Math.min(24, band - 2));
  const svg = h("svg:svg", { viewBox: `0 0 ${W} ${H}`, height: H, role: "img", "aria-label": `${m.label} ${unit === "hour" ? "by hour" : unit === "day" ? "by day" : "by month"}` });

  const grid = h("svg:g", { class: "grid" });
  const ticks = h("svg:g", { class: "tick" });
  for (let t = 0; t <= top + 1e-9; t += step) {
    const yy = Math.round(y(m.duration ? t * 1000 : t)) + 0.5;
    if (t > 0) grid.append(h("svg:line", { x1: M.l, x2: W - M.r, y1: yy, y2: yy }));
    ticks.append(h("svg:text", { x: M.l - 8, y: yy + 4, "text-anchor": "end" }, m.duration ? fmtDur(t * 1000) : compact.format(t)));
  }
  svg.append(grid, ticks);

  // x labels at least ~64px apart
  const every = Math.max(1, Math.ceil(64 / band));
  const xl = h("svg:g", { class: "tick" });
  bs.forEach((b, i) => {
    if (i % every) return;
    xl.append(h("svg:text", { x: M.l + band * i + band / 2, y: H - 8, "text-anchor": "middle" }, bucketLabel(b.start, unit, false)));
  });
  svg.append(xl);

  const hover = h("svg:rect", { class: "hover-band", y: M.t, height: ph, width: band, visibility: "hidden" });
  svg.append(hover);

  const bars = h("svg:g", {});
  bs.forEach((b, i) => {
    const v = values[i];
    if (!v) return;
    const x = M.l + band * i + (band - bw) / 2;
    const yy = y(v);
    const hgt = M.t + ph - yy;
    const r = Math.min(4, bw / 2, hgt);
    // 4px rounded data end, square at the baseline
    const d = `M${x},${M.t + ph}V${yy + r}Q${x},${yy} ${x + r},${yy}H${x + bw - r}Q${x + bw},${yy} ${x + bw},${yy + r}V${M.t + ph}Z`;
    bars.append(h("svg:path", { class: `bar${b.start > now ? " dim" : ""}`, d }));
  });
  svg.append(bars);
  svg.append(h("svg:line", { class: "base", x1: M.l, x2: W - M.r, y1: M.t + ph + 0.5, y2: M.t + ph + 0.5 }));

  // one hit target per bucket: the whole band, not the bar
  const hits = h("svg:g", {});
  bs.forEach((b, i) => {
    const rect = h("svg:rect", { class: "hit", x: M.l + band * i, y: M.t, width: band, height: ph + M.b });
    rect.addEventListener("pointermove", (e) => {
      hover.setAttribute("x", M.l + band * i);
      hover.setAttribute("visibility", "visible");
      const v = values[i];
      const vs = b.views;
      tip(e,
        h("b", {}, b.start > now ? "–" : m.duration ? fmtDur(v) : fmtN(v)), " ",
        h("span", {}, m.duration ? "per visit" : (v === 1 ? m.noun[0] : m.noun[1])),
        h("span", { class: "t-sub" }, bucketLabel(b.start, unit, true)),
        vs.length && state.metric !== "views" ? h("span", { class: "t-sub" }, plural(vs.length, METRICS.views.noun)) : null,
      );
    });
    rect.addEventListener("pointerleave", () => { hover.setAttribute("visibility", "hidden"); untip(); });
    hits.append(rect);
  });
  svg.append(hits);
  box.replaceChildren(svg);
}

// ---------- the map: countries (or states) by visitors, cities as dots ----------

const geo = { world: null, us: null };
async function geoData(which) {
  if (!geo[which]) geo[which] = fetch(`/geo/${which}.json`).then((r) => r.json());
  return geo[which];
}

/** Up to six thresholds over 1…max, so small sites still get distinct steps. */
function bins(max) {
  if (max <= 6) return Array.from({ length: Math.max(1, max) }, (_, i) => i + 1);
  const t = [1];
  for (const f of [0.06, 0.15, 0.3, 0.55, 0.8]) {
    const v = Math.max(t[t.length - 1] + 1, Math.round(max * f));
    if (v <= max) t.push(v);
  }
  return t.slice(0, 6);
}

async function drawMap(box, cur) {
  const which = state.map;
  const topo = await geoData(which);
  if (!box.isConnected) return;
  const W = Math.max(280, box.clientWidth);

  const us = which === "us";
  let features = topojson.feature(topo, topo.objects[us ? "states" : "countries"]).features;
  if (!us) features = features.filter((f) => f.properties.a2 !== "AQ");
  const fc = { type: "FeatureCollection", features };
  const H = Math.round(W * (us ? 0.58 : 0.47));
  const proj = (us ? d3.geoAlbersUsa() : d3.geoNaturalEarth1()).fitExtent([[4, 4], [W - 4, H - 4]], fc);
  const path = d3.geoPath(proj);

  // visitors per country / state, and per city
  const scope = us ? cur.filter((v) => v.country === "US") : cur;
  const areaKey = (v) => (us ? v.region : v.country);
  const byArea = new Map();
  const byCity = new Map();
  for (const v of scope) {
    const a = areaKey(v);
    if (a) (byArea.get(a) ?? byArea.set(a, new Set()).get(a)).add(v.visitor);
    const c = cityKey(v);
    if (c && v.lat != null && v.lon != null) {
      let g = byCity.get(c);
      if (!g) byCity.set(c, (g = { key: c, v, set: new Set() }));
      g.set.add(v.visitor);
    }
  }
  const max = Math.max(0, ...[...byArea.values()].map((s) => s.size));
  const th = bins(max);
  const ramp = th.length <= 1 ? [4] : th.map((_, i) => 1 + Math.round((i * 5) / (th.length - 1)));
  const color = (n) => {
    if (!n) return null;
    let i = 0;
    while (i < th.length - 1 && n >= th[i + 1]) i++;
    return `var(--seq-${ramp[i]})`;
  };

  const svg = h("svg:svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": us ? "Visitors by US state" : "Visitors by country" });
  const picked = us ? state.filters.region?.split("|")[0] : state.filters.country;
  for (const f of features) {
    const id = us ? f.properties.name : f.properties.a2;
    const n = byArea.get(id)?.size ?? 0;
    const d = path(f);
    if (!d) continue;
    const el = h("svg:path", { d, class: `land${n ? " has" : ""}${picked && picked === id ? " picked" : ""}` });
    const fill = color(n);
    if (fill) el.style.fill = fill;
    el.addEventListener("pointermove", (e) => tip(e,
      h("b", {}, plural(n, METRICS.visitors.noun)),
      h("span", { class: "t-sub" }, us ? f.properties.name : `${flag(id)} ${countryName(id)}`)));
    el.addEventListener("pointerleave", untip);
    if (n) el.addEventListener("click", () => {
      untip();
      if (us) toggleFilter("region", `${id}|US`);
      else toggleFilter("country", id);
    });
    svg.append(el);
  }

  const cities = [...byCity.values()].sort((a, b) => b.set.size - a.set.size);
  const cmax = Math.max(1, ...cities.map((c) => c.set.size));
  for (const c of cities) {
    const p = proj([c.v.lon, c.v.lat]);
    if (!p) continue;
    const r = 4 + 8 * Math.sqrt(c.set.size / cmax);
    const dot = h("svg:circle", { class: "city", cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: r.toFixed(1) });
    dot.addEventListener("pointermove", (e) => tip(e,
      h("b", {}, plural(c.set.size, METRICS.visitors.noun)),
      h("span", { class: "t-sub" }, `${flag(c.v.country)} ${[c.v.city, c.v.region, countryName(c.v.country)].filter(Boolean).join(", ")}`)));
    dot.addEventListener("pointerleave", untip);
    dot.addEventListener("click", () => { untip(); toggleFilter("city", c.key); });
    svg.append(dot);
  }

  const legend = h("div", { class: "map-legend" },
    max
      ? h("span", { class: "scale-wrap" }, "Visitors",
          h("span", { class: "scale" }, th.map((t, i) => {
            const hi = th[i + 1] ? th[i + 1] - 1 : max;
            const sw = h("i");
            sw.style.background = `var(--seq-${ramp[i]})`;
            return h("span", { class: "bin" }, sw, h("small", {}, hi > t ? `${t}–${compact.format(hi)}` : compact.format(t)));
          })))
      : h("span", {}, us ? "No visitors from the US in this range." : "No visitors in this range."),
    cities.length ? h("span", {}, h("span", { class: "key-dot" }), "a city, sized by its visitors") : null,
  );
  box.replaceChildren(svg, legend);
}

function toggleFilter(dim, key) {
  if (state.filters[dim] === key) delete state.filters[dim];
  else state.filters[dim] = key;
  render();
}

// ---------- tables ----------

function panel(id, title, cur, tabs) {
  const tab = tabs.find((t) => t.id === state.tabs[id]) ?? tabs[0];
  const rows = group(cur, tab.dim, tab.measure, tab.aux);
  const ek = `${id}:${tab.id}`;
  const limit = state.expanded[ek] ? 100 : 8;
  return h("section", { class: "card span-6" },
    h("div", { class: "card-head" },
      h("h2", {}, title),
      tabs.length > 1 ? h("div", { class: "tabs" }, tabs.map((t) => h("button", {
        type: "button", "aria-pressed": t === tab, onclick: () => { state.tabs[id] = t.id; render(); },
      }, t.label))) : null,
    ),
    barList(rows, tab, limit, ek),
  );
}

function barList(rows, tab, limit, ek) {
  if (!rows.length) return h("p", { class: "empty" }, "Nothing here for this range.");
  const max = rows[0].n;
  const list = h("div", { class: "list" },
    h("div", { class: "list-head" }, h("span", {}, DIMS[tab.dim].label), h("span", {}, tab.aux ? "Avg time · Views" : cap(tab.measure === "views" ? "page views" : tab.measure))),
    rows.slice(0, limit).map((r) => {
      const picked = state.filters[tab.dim] === r.key;
      const fill = h("span", { class: "fill" });
      fill.style.width = `${(r.n / max) * 100}%`;
      return h("button", {
        class: `row${picked ? " picked" : ""}`, type: "button",
        title: picked ? "Remove this filter" : "Filter everything by this",
        onclick: () => toggleFilter(tab.dim, r.key),
      }, fill, h("span", { class: "lbl" }, showKey(tab.dim, r.key)),
      r.aux ? h("span", { class: "aux" }, r.aux) : null,
      h("span", { class: "num" }, fmtN(r.n)));
    }),
  );
  if (rows.length > 8) {
    list.append(h("button", {
      class: "ghost more", type: "button",
      onclick: () => { state.expanded[ek] = !state.expanded[ek]; render(); },
    }, state.expanded[ek] ? "Show fewer" : `Show all ${fmtN(rows.length)}`));
  }
  return list;
}

/** How far down the home page visits got: ordered stages, one hue. */
function reachPanel(cur) {
  const home = new Map();
  for (const v of cur) {
    if (v.path !== "/") continue;
    const set = home.get(v.session) ?? home.set(v.session, new Set()).get(v.session);
    for (const s of String(v.sections || "").split(",")) if (s) set.add(s);
  }
  const n = home.size;
  const body = n
    ? h("div", { class: "list funnel" },
        h("div", { class: "list-head" }, h("span", {}, "Section"), h("span", {}, "Share · Visits")),
        SECTIONS.map(([id, label]) => {
          const k = [...home.values()].filter((s) => s.has(id)).length;
          const fill = h("span", { class: "fill" });
          fill.style.width = `${(k / n) * 100}%`;
          return h("div", { class: "row static" }, fill, h("span", { class: "lbl" }, label), h("span", { class: "aux" }, pct(k / n)), h("span", { class: "num" }, fmtN(k)));
        }))
    : h("p", { class: "empty" }, "No visits to the home page in this range.");
  return h("section", { class: "card span-6" },
    h("div", { class: "card-head" }, h("h2", {}, "How far they read", h("span", { class: "sub" }, n ? `of ${plural(n, ["home page visit", "home page visits"])}` : ""))),
    body,
  );
}

function eventsPanel(events) {
  const tabs = [
    { id: "outbound", label: "Links out", match: (e) => e.name === "outbound" },
    { id: "download", label: "Downloads", match: (e) => e.name === "download" },
    { id: "actions", label: "Actions", match: (e) => e.name !== "outbound" && e.name !== "download" },
  ];
  const tab = tabs.find((t) => t.id === state.tabs.events) ?? tabs[0];
  const m = new Map();
  for (const e of events.filter(tab.match)) {
    const key = tab.id === "actions" ? `${EVENT_NAMES[e.name] ?? e.name}${e.label ? ` · ${e.label}` : ""}` : e.label || "(unknown)";
    const g = m.get(key) ?? m.set(key, { key, n: 0, people: new Set() }).get(key);
    g.n++;
    g.people.add(e.visitor);
  }
  const rows = [...m.values()].sort((a, b) => b.n - a.n);
  const ek = `events:${tab.id}`;
  const limit = state.expanded[ek] ? 100 : 8;
  const max = rows[0]?.n ?? 1;
  return h("section", { class: "card span-6" },
    h("div", { class: "card-head" },
      h("h2", {}, "What they clicked"),
      h("div", { class: "tabs" }, tabs.map((t) => h("button", {
        type: "button", "aria-pressed": t === tab, onclick: () => { state.tabs.events = t.id; render(); },
      }, t.label))),
    ),
    rows.length
      ? h("div", { class: "list" },
          h("div", { class: "list-head" }, h("span", {}, tab.id === "actions" ? "Action" : tab.id === "download" ? "File" : "Link"), h("span", {}, "People · Clicks")),
          rows.slice(0, limit).map((r) => {
            const fill = h("span", { class: "fill" });
            fill.style.width = `${(r.n / max) * 100}%`;
            return h("div", { class: "row static" }, fill, h("span", { class: "lbl" }, r.key), h("span", { class: "aux" }, fmtN(r.people.size)), h("span", { class: "num" }, fmtN(r.n)));
          }),
          rows.length > 8 ? h("button", { class: "ghost more", type: "button", onclick: () => { state.expanded[ek] = !state.expanded[ek]; render(); } },
            state.expanded[ek] ? "Show fewer" : `Show all ${fmtN(rows.length)}`) : null)
      : h("p", { class: "empty" }, "No clicks like that in this range."),
  );
}

/** When visits start, by weekday and hour, in this browser's time zone. */
function heatPanel(cur) {
  const starts = new Map();
  for (const v of cur) if (!starts.has(v.session) || v.ts < starts.get(v.session)) starts.set(v.session, v.ts);
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const t of starts.values()) {
    const d = new Date(t);
    grid[(d.getDay() + 6) % 7][d.getHours()]++;
  }
  const max = Math.max(0, ...grid.flat());
  const th = bins(max);
  const ramp = th.length <= 1 ? [4] : th.map((_, i) => 1 + Math.round((i * 5) / (th.length - 1)));
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const cell = 18;
  const gap = 2;
  const L = 34;
  const T = 16;
  const W = L + 24 * (cell + gap);
  const Hh = T + 7 * (cell + gap);
  const svg = h("svg:svg", { viewBox: `0 0 ${W} ${Hh}`, role: "img", "aria-label": "Visits by weekday and hour", style: { width: "100%", maxWidth: `${W * 1.25}px` } });
  for (const [hr, l] of [[0, "12a"], [6, "6a"], [12, "12p"], [18, "6p"]]) {
    svg.append(h("svg:text", { class: "axis-label", x: L + hr * (cell + gap), y: 11 }, l));
  }
  grid.forEach((row, di) => {
    svg.append(h("svg:text", { class: "axis-label", x: 0, y: T + di * (cell + gap) + 13 }, days[di]));
    row.forEach((n, hr) => {
      let i = 0;
      while (i < th.length - 1 && n >= th[i + 1]) i++;
      const rect = h("svg:rect", { x: L + hr * (cell + gap), y: T + di * (cell + gap), width: cell, height: cell, rx: 3 });
      rect.style.fill = n ? `var(--seq-${ramp[i]})` : "var(--nodata)";
      rect.addEventListener("pointermove", (e) => {
        const from = new Date(2026, 0, 5 + di, hr).toLocaleTimeString([], { hour: "numeric" });
        tip(e, h("b", {}, plural(n, METRICS.visits.noun)), h("span", { class: "t-sub" }, `${days[di]}, ${from}`));
      });
      rect.addEventListener("pointerleave", untip);
      svg.append(rect);
    });
  });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return h("section", { class: "card span-6" },
    h("div", { class: "card-head" }, h("h2", {}, "When they visit", h("span", { class: "sub" }, `visit starts, ${tz.replace(/_/g, " ")}`))),
    max ? svg : h("p", { class: "empty" }, "No visits in this range."),
  );
}

// ---------- recent visits + one visitor's history ----------

function visitsCard(cur, now) {
  const sessions = new Map();
  for (const v of cur) sessions.set(v.session, v.s);
  const list = [...sessions.values()].sort((a, b) => b.start - a.start);
  const shown = list.slice(0, state.visitsShown);
  return h("section", { class: "card span-12" },
    h("div", { class: "card-head" }, h("h2", {}, "Recent visits", h("span", { class: "sub" }, `${plural(list.length, METRICS.visits.noun)} · newest first · click one for that visitor's whole history`))),
    list.length ? h("div", { class: "visits" }, shown.map((s) => visitRow(s, now))) : h("p", { class: "empty" }, "No visits in this range yet."),
    list.length > shown.length ? h("button", {
      class: "ghost more", type: "button", onclick: () => { state.visitsShown += 50; render(); },
    }, `Show ${fmtN(Math.min(50, list.length - shown.length))} more`) : null,
  );
}

function trail(views) {
  const paths = views.map((v) => v.path);
  const cut = paths.length > 6 ? [...paths.slice(0, 5), `+${paths.length - 5} more`] : paths;
  return cut.join(" → ");
}

function reachedLabel(s) {
  const reached = new Set(s.views.filter((v) => v.path === "/").flatMap((v) => String(v.sections || "").split(",")));
  for (const [id, label] of [...SECTIONS].reverse()) if (reached.has(id)) return id === "hero" ? null : `read to ${label}`;
  return null;
}

function eventBadges(evs) {
  const out = [];
  const count = (name) => evs.filter((e) => e.name === name).length;
  if (count("message-sent")) out.push("sent a message");
  if (count("download")) out.push(`downloaded ${count("download") === 1 ? evs.find((e) => e.name === "download").label : `${count("download")} files`}`);
  if (count("outbound")) out.push(`${count("outbound")} link${count("outbound") === 1 ? "" : "s"} out`);
  if (count("copy")) out.push("copied the address");
  if (count("email")) out.push("opened an email link");
  return out;
}

function visitRow(s, now) {
  const e = s.entry;
  const place = [e.city, e.region].filter(Boolean).join(", ");
  const ignored = D.ignored.has(s.visitor);
  return h("button", { class: "visit", type: "button", onclick: () => openVisitor(s.visitor) },
    h("div", { class: "when" }, h("b", {}, now - s.start < 86_400_000 ? ago(s.start, now) : fmtDay(s.start)), h("span", {}, `${fmtTime(s.start)} · ${fmtDur(s.engaged)}`)),
    h("div", { class: "where" },
      h("div", {}, h("span", { class: "flag" }, flag(e.country)), h("b", {}, place || countryName(e.country))),
      h("div", { class: "muted" }, place ? countryName(e.country) : "", e.org ? `${place ? " · " : ""}${e.org}` : ""),
    ),
    h("div", { class: "trail" },
      h("div", {}, h("span", { class: "muted" }, "via "), s.source, s.referrer && s.referrer !== s.source ? h("span", { class: "muted" }, ` (${s.referrer})`) : null),
      h("div", {}, trail(s.views)),
    ),
    h("div", { class: "tech" },
      h("div", {}, [cap(e.device), [e.browser, e.browser_ver].filter(Boolean).join(" "), [e.os, e.os_ver].filter(Boolean).join(" ")].filter(Boolean).join(" · ")),
      h("div", { class: "badges" },
        h("span", { class: `badge${s.isNew ? " new" : ""}` }, s.isNew ? "new" : "returning"),
        reachedLabel(s) ? h("span", { class: "badge" }, reachedLabel(s)) : null,
        eventBadges(s.events).map((b) => h("span", { class: "badge" }, b)),
        e.bot ? h("span", { class: "badge" }, "bot") : null,
        ignored ? h("span", { class: "badge" }, "you") : null,
      ),
    ),
  );
}

async function openVisitor(id) {
  closeDrawer();
  const scrim = h("div", { class: "scrim", onclick: closeDrawer });
  const drawer = h("aside", { class: "drawer", role: "dialog", "aria-modal": "true", "aria-label": "Visitor history", tabindex: "-1" },
    h("p", { class: "eyebrow" }, "Loading…"));
  document.body.append(scrim, drawer);
  drawer.focus();
  let data;
  try {
    data = await getJSON(`/api/visitor?id=${encodeURIComponent(id)}`);
  } catch {
    fill(drawer, h("p", {}, "Couldn't load this visitor."));
    return;
  }
  const views = objects(data.views);
  const events = objects(data.events);
  const bySession = new Map();
  for (const v of views) (bySession.get(v.session) ?? bySession.set(v.session, []).get(v.session)).push(v);
  const sessions = [...bySession.entries()].map(([sid, vs]) => ({ id: sid, views: vs, start: vs[0].ts, engaged: vs.reduce((a, v) => a + v.engaged, 0), events: events.filter((e) => e.session === sid) }))
    .sort((a, b) => b.start - a.start);
  const last = views[views.length - 1];
  const first = views[0];
  const places = [...new Set(views.map((v) => [v.city, v.region, countryName(v.country)].filter(Boolean).join(", ")))];
  const nets = [...new Set(views.map((v) => v.org).filter(Boolean))];
  const ignored = D.ignored.has(id);

  const mark = h("button", { class: "ghost", type: "button" }, ignored ? "Count this browser again" : "This is me: stop counting it");
  mark.addEventListener("click", async () => {
    mark.disabled = true;
    await getJSON("/api/ignore", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor: id, note: "me", on: !ignored }),
    });
    closeDrawer();
    load({ quiet: true });
  });

  fill(drawer, 
    h("button", { class: "ghost close", type: "button", onclick: closeDrawer }, "Close"),
    h("p", { class: "eyebrow" }, id.startsWith("h") ? "Visitor without a stored id" : "Visitor"),
    h("h2", {}, flag(last.country), " ", places[places.length - 1] || "Unknown place"),
    h("p", { class: "muted" }, [cap(last.device), [last.browser, last.browser_ver].filter(Boolean).join(" "), [last.os, last.os_ver].filter(Boolean).join(" "), last.screen, last.lang].filter(Boolean).join(" · ")),
    id.startsWith("h") ? h("p", { class: "muted" }, "This browser keeps no id (private window or storage blocked), so it's counted by a hash that changes daily: its visits on other days look like someone new.") : null,
    h("div", { class: "facts" },
      h("div", {}, h("b", {}, fmtDayYear(first.ts)), h("span", {}, "first seen")),
      h("div", {}, h("b", {}, fmtN(sessions.length)), h("span", {}, sessions.length === 1 ? "visit" : "visits")),
      h("div", {}, h("b", {}, fmtN(views.length)), h("span", {}, "page views")),
      h("div", {}, h("b", {}, fmtDur(views.reduce((a, v) => a + v.engaged, 0))), h("span", {}, "time in view")),
    ),
    places.length > 1 ? h("p", {}, h("span", { class: "muted" }, "Seen from "), places.join("; ")) : null,
    nets.length ? h("p", {}, h("span", { class: "muted" }, "Network "), nets.join("; ")) : null,
    h("div", { class: "actions" }, mark),
    sessions.map((s) => {
      const src = s.views.find((v) => v.source != null);
      const e = s.views[0];
      return h("div", { class: "sess" },
        h("h3", {}, `${fmtDay(s.start)}, ${fmtTime(s.start)}`),
        h("div", { class: "muted" }, [`via ${src?.source ?? "Direct"}${src?.referrer && src.referrer !== src.source ? ` (${src.referrer})` : ""}`, fmtDur(s.engaged), [e.city, e.region, e.country].filter(Boolean).join(", ")].join(" · ")),
        h("ol", {}, s.views.map((v) => h("li", {},
          v.path, h("span", { class: "muted" }, ` · ${fmtDur(v.engaged)} · ${v.scroll}% down`,
            v.path === "/" && v.sections ? ` · ${v.sections.split(",").map((x) => SECTIONS.find(([id]) => id === x)?.[1] ?? x).join(", ")}` : "")))),
        s.events.length ? h("ol", {}, s.events.map((ev) => h("li", {}, `${EVENT_NAMES[ev.name] ?? ev.name}${ev.label ? `: ${ev.label}` : ""}`, h("span", { class: "muted" }, ` · ${fmtTime(ev.ts)}`)))) : null,
      );
    }),
  );
}

function closeDrawer() {
  document.querySelector(".drawer")?.remove();
  document.querySelector(".scrim")?.remove();
}

function footer() {
  return h("footer", { class: "foot" },
    h("p", {}, "Counted by keffer.cafe itself: no cookies, no third parties, no IP addresses kept. Locations are Cloudflare's reading of each visitor's network, usually right to the city. To stop counting one of your own browsers, open ",
      h("a", { href: "https://keffer.cafe/?notrack", target: "_blank", rel: "noopener" }, "keffer.cafe/?notrack"),
      " in it once, or open one of your visits here and mark it as you."),
    h("p", {}, `Updated ${fmtTime(D.now)}`),
  );
}

// ---------- start ----------

document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeDrawer(); document.querySelector(".live-pop")?.remove(); } });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && D) pollLive(); });
let resizeTimer = 0;
let lastWidth = window.innerWidth;
window.addEventListener("resize", () => {
  if (window.innerWidth === lastWidth) return;
  lastWidth = window.innerWidth;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(render, 150);
});
window.addEventListener("hashchange", () => {
  const before = state.range;
  readHash();
  if (state.range !== before) load();
  else render();
});

(async function start() {
  readHash();
  const me = await fetch("/api/me", { credentials: "same-origin" }).then((r) => r.json()).catch(() => ({ signedIn: false }));
  if (!me.signedIn) return renderGate();
  $app.replaceChildren(h("div", { class: "shell" }, h("p", { class: "eyebrow" }, "Loading…")));
  await load();
  startTimers();
})();
