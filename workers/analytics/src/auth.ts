// Signing in to the dashboard, without a password: "Email me a link" sends a
// one-time link to the single verified address (env.TO, the only place the
// send_email binding can deliver to). Opening it and pressing Continue (a
// POST, so a mail scanner that fetches links can't spend it) opens a 90-day
// session. Only SHA-256 hashes of link tokens and session ids are stored.

import { type Env, DAY, MINUTE, cookie, empty, fromDashboard, html, json, place, sha256, token } from "./env";
import { sendMail } from "./mail";

const COOKIE = "__Host-signal";
const LINK_TTL = 15 * MINUTE;
const SESSION_TTL = 90 * DAY;

export async function signedIn(request: Request, env: Env): Promise<boolean> {
  const id = cookie(request, COOKIE);
  if (!id) return false;
  const row = await env.DB.prepare("SELECT expires FROM sessions WHERE id = ?").bind(await sha256(id)).first<{ expires: number }>();
  return !!row && row.expires > Date.now();
}

export async function auth(request: Request, env: Env, path: string): Promise<Response> {
  if (path === "/auth/link" && request.method === "POST") return link(request, env);
  if (path === "/auth/verify" && request.method === "GET") return confirmPage(new URL(request.url).searchParams.get("t") ?? "");
  if (path === "/auth/verify" && request.method === "POST") return verify(request, env);
  if (path === "/auth/logout" && request.method === "POST") return logout(request, env);
  return empty(404);
}

async function link(request: Request, env: Env): Promise<Response> {
  if (!fromDashboard(request, env)) return json({ ok: false, error: "origin" }, 403);
  if (env.LOGIN && !(await env.LOGIN.limit({ key: "link" })).success) return json({ ok: false, error: "slow down" }, 429);
  const now = Date.now();
  // a second cap that outlives isolates: ten links an hour
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM logins WHERE created > ?").bind(now - 60 * MINUTE).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 10) return json({ ok: false, error: "slow down" }, 429);

  const t = token();
  await env.DB.prepare("INSERT INTO logins (token, created, expires) VALUES (?, ?, ?)").bind(await sha256(t), now, now + LINK_TTL).run();
  const where = place(request);
  await sendMail(
    env,
    "Your keffer.cafe signal sign-in link",
    [
      "Open this link to sign in to your keffer.cafe analytics:",
      "",
      `${env.DASHBOARD}/auth/verify?t=${t}`,
      "",
      `It works once, for 15 minutes.${where ? ` Asked for from ${where}.` : ""}`,
      "If you didn't ask for it, ignore this email; nothing happens without the link.",
    ].join("\n"),
  );
  return json({ ok: true, to: env.TO.replace(/^(.).*?(@.*)$/, "$1•••$2") });
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><link rel="stylesheet" href="/app.css"></head><body class="gate">${body}</body></html>`;
}

function confirmPage(t: string): Response {
  const safe = t.replace(/[^A-Za-z0-9_-]/g, "");
  return html(page("Sign in — signal", `<main class="gate-card">
<p class="eyebrow">keffer.cafe · signal</p>
<h1>Sign in</h1>
<p>Continue to open the dashboard on this device.</p>
<form method="post" action="/auth/verify"><input type="hidden" name="t" value="${safe}"><button type="submit" class="primary">Continue</button></form>
</main>`));
}

function failPage(): Response {
  return html(page("Link expired — signal", `<main class="gate-card">
<p class="eyebrow">keffer.cafe · signal</p>
<h1>That link has expired</h1>
<p>Sign-in links work once, for 15 minutes. <a href="/">Ask for a new one</a>.</p>
</main>`), 400);
}

async function verify(request: Request, env: Env): Promise<Response> {
  if (!fromDashboard(request, env)) return failPage();
  const form = await request.formData();
  const t = String(form.get("t") ?? "");
  if (!t) return failPage();
  const now = Date.now();
  // spend the token in the same statement that checks it
  const spent = await env.DB.prepare("UPDATE logins SET used = 1 WHERE token = ? AND used = 0 AND expires > ?")
    .bind(await sha256(t), now)
    .run();
  if (!spent.meta.changes) return failPage();

  const id = token();
  await env.DB.prepare("INSERT INTO sessions (id, created, expires, ua, place) VALUES (?, ?, ?, ?, ?)")
    .bind(await sha256(id), now, now + SESSION_TTL, (request.headers.get("User-Agent") ?? "").slice(0, 300), place(request))
    .run();
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/",
      "Set-Cookie": `${COOKIE}=${id}; Path=/; Max-Age=${SESSION_TTL / 1000}; HttpOnly; Secure; SameSite=Lax`,
      "Cache-Control": "no-store",
    },
  });
}

async function logout(request: Request, env: Env): Promise<Response> {
  if (!fromDashboard(request, env)) return json({ ok: false }, 403);
  const id = cookie(request, COOKIE);
  if (id) await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(await sha256(id)).run();
  return json({ ok: true }, 200, { "Set-Cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` });
}
