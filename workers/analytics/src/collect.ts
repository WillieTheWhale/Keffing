// POST /e — what the site reports (keffer-portfolio/lib/analytics.ts).
//
// Sent with navigator.sendBeacon as a text/plain JSON body, so it's a simple
// request (no preflight). Three kinds:
//   pv    a page view began: path, referrer, screen, language…
//   ping  it's still going: time in view, deepest scroll, sections reached
//   ev    a click worth counting: a link out, a download, a message sent
// Where the reader is comes from Cloudflare (request.cf), never the page.
// No IP address is stored; a browser that keeps no id of its own is counted
// by a hash of IP + UA salted with a random value that's replaced each day.

import { type Env, DAY, empty, sha256, siteOrigins, token } from "./env";
import { parseAgent } from "./ua";
import { classify, referrerHost } from "./sources";

type Body = Record<string, unknown>;

const ID = /^[A-Za-z0-9_-]{8,40}$/;
const EVENT = /^[a-z][a-z0-9-]{0,31}$/;
const isId = (v: unknown): v is string => typeof v === "string" && ID.test(v);

function str(v: unknown, max: number): string {
  return String(v ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max);
}

function int(v: unknown, lo: number, hi: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
}

/** "host/path" of a URL — the query and fragment can carry search terms or tokens. */
function cleanReferrer(v: unknown): string {
  try {
    const u = new URL(String(v));
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return (u.hostname.replace(/^www\./, "") + u.pathname).replace(/\/$/, "").slice(0, 300);
  } catch {
    return "";
  }
}

function cleanPath(v: unknown): string {
  const p = str(v, 300).split(/[?#]/)[0];
  return p.startsWith("/") ? p : "/";
}

let salt: { day: string; value: string } | null = null;

async function dailySalt(env: Env, now: number): Promise<string> {
  const day = new Date(now).toISOString().slice(0, 10);
  if (salt?.day === day) return salt.value;
  await env.DB.prepare("INSERT OR IGNORE INTO salts (day, salt) VALUES (?, ?)").bind(day, token(24)).run();
  const row = await env.DB.prepare("SELECT salt FROM salts WHERE day = ?").bind(day).first<{ salt: string }>();
  salt = { day, value: row!.salt };
  return salt.value;
}

export async function collect(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = siteOrigins(env).includes(origin);
  const cors: Record<string, string> = allowed ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};

  if (request.method === "OPTIONS") {
    return empty(allowed ? 204 : 403, {
      ...cors,
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    });
  }
  if (request.method !== "POST") return empty(405, cors);
  if (!allowed) return empty(403, cors);

  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  if (env.HITS && !(await env.HITS.limit({ key: ip })).success) return empty(429, cors);

  const text = await request.text();
  if (text.length > 8192) return empty(413, cors);
  let d: Body;
  try {
    d = JSON.parse(text);
  } catch {
    return empty(400, cors);
  }
  if (!d || typeof d !== "object" || !isId(d.id)) return empty(400, cors);

  const now = Date.now();
  const ua = request.headers.get("User-Agent") ?? "";
  const id = d.id as string;
  const visitor = isId(d.v) ? d.v : "h" + (await sha256(`${await dailySalt(env, now)}|${ip}|${ua}`)).slice(0, 24);
  // without a session of its own, a hashed visitor's visit is its half hour
  const session = isId(d.s) ? d.s : `${visitor}.${Math.floor(now / 1_800_000)}`;

  if (d.t === "pv") await pageview(request, env, d, { id, visitor, session, now, ua, origin });
  else if (d.t === "ping") await ping(env, d, id, now);
  else if (d.t === "ev" && typeof d.name === "string" && EVENT.test(d.name)) {
    await env.DB.prepare("INSERT INTO events (ts, view, visitor, session, name, label, path) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(now, id, visitor, session, d.name, str(d.label, 300) || null, cleanPath(d.p))
      .run();
  } else return empty(400, cors);

  return empty(204, cors);
}

interface Ids { id: string; visitor: string; session: string; now: number; ua: string; origin: string }

async function pageview(request: Request, env: Env, d: Body, { id, visitor, session, now, ua, origin }: Ids) {
  const cf = (request.cf ?? {}) as IncomingRequestCfProperties;
  const agent = parseAgent(ua, request.headers, int(d.tp, 0, 20));
  const host = new URL(origin).host;
  const siteHosts = siteOrigins(env).map((o) => new URL(o).hostname.replace(/^www\./, ""));

  const query = new URLSearchParams(str(d.q, 600));
  const utm = (k: string) => str(query.get(`utm_${k}`), 100) || null;
  const utmSource = utm("source") ?? (str(query.get("ref") ?? query.get("via"), 100) || null);
  const referrer = cleanReferrer(d.r);
  const source = classify(referrerHost(String(d.r ?? "")), siteHosts, utmSource ?? "", ua);
  // a navigation inside the site isn't an entry, even if the page reloaded
  const entry = d.nav ? null : source;

  const lat = cf.latitude ? Number(cf.latitude) : null;
  const lon = cf.longitude ? Number(cf.longitude) : null;
  const size = (w: unknown, h: unknown) => (int(w, 0, 20000) && int(h, 0, 20000) ? `${int(w, 0, 20000)}x${int(h, 0, 20000)}` : null);

  await env.DB.prepare(
    `INSERT OR IGNORE INTO views (id, ts, last, visitor, session, new_visitor, host, path, title, referrer, source,
       utm_source, utm_medium, utm_campaign, country, region, region_code, city, postal, continent, lat, lon, timezone,
       asn, org, colo, browser, browser_ver, os, os_ver, device, screen, viewport, lang, sections, bot)
     VALUES (${Array(36).fill("?").join(", ")})`,
  )
    .bind(
      id, now, now, visitor, session, d.n ? 1 : 0, host, cleanPath(d.p), str(d.ti, 200) || null,
      referrer && !siteHosts.includes(referrerHost(String(d.r))) ? referrer : null, entry,
      utmSource, utm("medium"), utm("campaign"),
      (cf.country as string) ?? null, cf.region ?? null, cf.regionCode ?? null, cf.city ?? null, cf.postalCode ?? null,
      cf.continent ?? null, Number.isFinite(lat) ? lat : null, Number.isFinite(lon) ? lon : null, cf.timezone ?? null,
      cf.asn ?? null, cf.asOrganization ?? null, cf.colo ?? null,
      agent.browser, agent.browserVer || null, agent.os, agent.osVer || null, agent.device,
      size(d.sw, d.sh), size(d.vw, d.vh), str(d.l, 35) || null, str(d.se, 200), agent.bot || d.wd ? 1 : 0,
    )
    .run();
}

async function ping(env: Env, d: Body, id: string, now: number) {
  // only the page that began the view knows its id; a day on, the view is closed
  await env.DB.prepare(
    `UPDATE views SET last = ?1, engaged = MAX(engaged, ?2), scroll = MAX(scroll, ?3),
       sections = CASE WHEN length(?4) > length(sections) THEN ?4 ELSE sections END
     WHERE id = ?5 AND ts > ?6`,
  )
    .bind(now, int(d.e, 0, DAY), int(d.sc, 0, 100), str(d.se, 200), id, now - DAY)
    .run();
}
