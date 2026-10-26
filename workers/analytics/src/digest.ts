// The Monday email: last week's visitors, where they were, how they got
// there and what they read, against the week before. Then a sweep of spent
// sign-in links, expired sessions and salts no longer needed.

import { type Env, DAY } from "./env";
import { sendMail } from "./mail";

const COUNTED = "bot = 0 AND host NOT LIKE 'localhost%' AND visitor NOT IN (SELECT visitor FROM ignored)";

const countryName = (() => {
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  return (code: string | null) => {
    if (!code) return "Unknown";
    try { return names.of(code) ?? code; } catch { return code; }
  };
})();

function duration(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

function delta(now: number, before: number): string {
  if (!before) return now ? "(new)" : "";
  const d = now - before;
  return d === 0 ? "(same as the week before)" : `(${d > 0 ? "+" : ""}${d} vs the week before)`;
}

function list(rows: { label: string; n: number }[]): string[] {
  if (!rows.length) return ["  —"];
  const w = Math.max(...rows.map((r) => r.label.length));
  return rows.map((r) => `  ${r.label.padEnd(w)}  ${r.n}`);
}

export async function weekly(env: Env): Promise<void> {
  const db = env.DB;
  const to = Date.now();
  const from = to - 7 * DAY;
  const in_ = `ts >= ${from} AND ts < ${to} AND ${COUNTED}`;

  const totals = (a: number, b: number) =>
    db.prepare(`SELECT COUNT(DISTINCT visitor) AS visitors, COUNT(DISTINCT session) AS visits, COUNT(*) AS views,
                       COALESCE(SUM(engaged), 0) AS engaged FROM views WHERE ts >= ? AND ts < ? AND ${COUNTED}`)
      .bind(a, b).first<{ visitors: number; visits: number; views: number; engaged: number }>();

  const [now, before, countries, cities, sources, pages, fresh, contact] = await Promise.all([
    totals(from, to),
    totals(from - 7 * DAY, from),
    db.prepare(`SELECT country, COUNT(DISTINCT visitor) AS n FROM views WHERE ${in_} GROUP BY country ORDER BY n DESC LIMIT 6`).all<{ country: string | null; n: number }>(),
    db.prepare(`SELECT city, region, country, COUNT(DISTINCT visitor) AS n FROM views WHERE ${in_} AND city IS NOT NULL
                GROUP BY city, region, country ORDER BY n DESC LIMIT 6`).all<{ city: string; region: string | null; country: string | null; n: number }>(),
    db.prepare(`SELECT source, COUNT(DISTINCT session) AS n FROM views WHERE ${in_} AND source IS NOT NULL GROUP BY source ORDER BY n DESC LIMIT 6`).all<{ source: string; n: number }>(),
    db.prepare(`SELECT path, COUNT(*) AS n FROM views WHERE ${in_} GROUP BY path ORDER BY n DESC LIMIT 6`).all<{ path: string; n: number }>(),
    db.prepare(`SELECT DISTINCT country FROM views WHERE ${in_} AND country IS NOT NULL AND country NOT IN
                (SELECT country FROM views WHERE ts < ${from} AND ${COUNTED} AND country IS NOT NULL)`).all<{ country: string }>(),
    db.prepare(`SELECT COUNT(DISTINCT session) AS n FROM views WHERE ${in_} AND path = '/' AND (sections LIKE '%contact%' OR sections LIKE '%dive%')`).first<{ n: number }>(),
  ]);
  if (!now) return;

  const day = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
  const avg = now.visits ? now.engaged / now.visits : 0;
  const text = [
    `keffer.cafe, ${day(from)} – ${day(to - 1)}`,
    "",
    `  ${now.visitors} visitor${now.visitors === 1 ? "" : "s"}  ${delta(now.visitors, before?.visitors ?? 0)}`,
    `  ${now.visits} visit${now.visits === 1 ? "" : "s"}, ${now.views} page view${now.views === 1 ? "" : "s"}`,
    `  ${duration(avg)} on the site per visit`,
    `  ${contact?.n ?? 0} read the home page down to Contact`,
    "",
    "Where they were",
    ...list(countries.results.map((r) => ({ label: countryName(r.country), n: r.n }))),
    ...(fresh.results.length ? ["", `First visits from: ${fresh.results.map((r) => countryName(r.country)).join(", ")}`] : []),
    "",
    "Cities",
    ...list(cities.results.map((r) => ({ label: [r.city, r.region, r.country].filter(Boolean).join(", "), n: r.n }))),
    "",
    "How they got there",
    ...list(sources.results.map((r) => ({ label: r.source, n: r.n }))),
    "",
    "Most viewed",
    ...list(pages.results.map((r) => ({ label: r.path, n: r.n }))),
    "",
    `Everything else: ${env.DASHBOARD}`,
  ].join("\n");

  await sendMail(env, `keffer.cafe this week: ${now.visitors} visitor${now.visitors === 1 ? "" : "s"}`, text);
}

export async function sweep(env: Env): Promise<void> {
  const now = Date.now();
  const yesterday = new Date(now - 2 * DAY).toISOString().slice(0, 10);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM logins WHERE expires < ?").bind(now - DAY),
    env.DB.prepare("DELETE FROM sessions WHERE expires < ?").bind(now),
    env.DB.prepare("DELETE FROM salts WHERE day < ?").bind(yesterday),
  ]);
}
