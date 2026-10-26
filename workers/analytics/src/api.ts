// The dashboard's data, for a signed-in browser only. The dashboard asks for
// raw rows (views, events) for a time range and does the counting itself, so
// every table, the map and the chart can be filtered by a click without
// another round trip. Rows go out as arrays under one column list.

import { type Env, MINUTE, empty, fromDashboard, json } from "./env";

const VIEW_COLUMNS = [
  "id", "ts", "last", "visitor", "session", "new_visitor", "host", "path", "title", "referrer", "source",
  "utm_source", "utm_medium", "utm_campaign", "country", "region", "region_code", "city", "postal", "continent",
  "lat", "lon", "timezone", "asn", "org", "browser", "browser_ver", "os", "os_ver", "device", "screen", "viewport",
  "lang", "engaged", "scroll", "sections", "bot",
];
const EVENT_COLUMNS = ["ts", "view", "visitor", "session", "name", "label", "path"];
const LIVE_WINDOW = 2 * MINUTE;

async function table(stmt: D1PreparedStatement) {
  const [cols, ...rows] = await stmt.raw({ columnNames: true });
  return { cols: cols ?? [], rows };
}

function range(url: URL): [number, number] | null {
  const from = Number(url.searchParams.get("from"));
  const to = Number(url.searchParams.get("to"));
  return Number.isFinite(from) && Number.isFinite(to) && from < to ? [from, to] : null;
}

export async function api(request: Request, env: Env, path: string): Promise<Response> {
  const url = new URL(request.url);
  const db = env.DB;

  if (path === "/api/data" && request.method === "GET") {
    const r = range(url);
    if (!r) return json({ error: "range" }, 400);
    // each visitor's first view ever, to tell new from returning
    const views = db.prepare(
      `SELECT ${VIEW_COLUMNS.map((c) => `v.${c}`).join(", ")}, f.first
       FROM views v JOIN (
         SELECT visitor, MIN(ts) AS first FROM views
         WHERE visitor IN (SELECT visitor FROM views WHERE ts >= ?1 AND ts < ?2) GROUP BY visitor
       ) f ON f.visitor = v.visitor
       WHERE v.ts >= ?1 AND v.ts < ?2 ORDER BY v.ts`,
    ).bind(r[0], r[1]);
    const events = db.prepare(`SELECT ${EVENT_COLUMNS.join(", ")} FROM events WHERE ts >= ? AND ts < ? ORDER BY ts`).bind(r[0], r[1]);
    const [v, e, ignored] = await Promise.all([
      table(views),
      table(events),
      db.prepare("SELECT visitor, note, created FROM ignored").all(),
    ]);
    return json({ now: Date.now(), views: v, events: e, ignored: ignored.results });
  }

  if (path === "/api/live" && request.method === "GET") {
    const now = Date.now();
    const rows = await db.prepare(
      `SELECT visitor, session, path, city, region, country, device, source, ts, last FROM views
       WHERE last >= ? AND bot = 0 AND host NOT LIKE 'localhost%' AND visitor NOT IN (SELECT visitor FROM ignored)
       ORDER BY last DESC LIMIT 100`,
    ).bind(now - LIVE_WINDOW).all();
    return json({ now, window: LIVE_WINDOW, views: rows.results });
  }

  if (path === "/api/visitor" && request.method === "GET") {
    const id = url.searchParams.get("id") ?? "";
    const [v, e] = await Promise.all([
      table(db.prepare(`SELECT ${VIEW_COLUMNS.join(", ")} FROM views WHERE visitor = ? ORDER BY ts`).bind(id)),
      table(db.prepare(`SELECT ${EVENT_COLUMNS.join(", ")} FROM events WHERE visitor = ? ORDER BY ts`).bind(id)),
    ]);
    return json({ views: v, events: e });
  }

  if (path === "/api/ignore" && request.method === "POST") {
    if (!fromDashboard(request, env)) return json({ error: "origin" }, 403);
    const body = (await request.json().catch(() => ({}))) as { visitor?: string; note?: string; on?: boolean };
    const visitor = String(body.visitor ?? "").slice(0, 64);
    if (!visitor) return json({ error: "visitor" }, 400);
    if (body.on === false) await db.prepare("DELETE FROM ignored WHERE visitor = ?").bind(visitor).run();
    else {
      await db.prepare("INSERT OR REPLACE INTO ignored (visitor, note, created) VALUES (?, ?, ?)")
        .bind(visitor, String(body.note ?? "").slice(0, 100) || null, Date.now())
        .run();
    }
    return json({ ok: true });
  }

  return empty(404);
}
