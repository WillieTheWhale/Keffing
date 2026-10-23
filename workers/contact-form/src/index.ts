// keffer-contact — the "Leave a message" form's mail drop.
//
// The site posts { name, message, website, page } as JSON (sent as text/plain
// so the browser makes a simple request, no preflight). The message goes out
// through the send_email binding: from an address on keffer.cafe to the
// verified destination, as a plain-text email. `website` is a honeypot:
// people leave it empty, bots fill it in, and get a quiet "ok".

import { EmailMessage } from "cloudflare:email";

interface Env {
  MAIL: { send(message: EmailMessage): Promise<void> };
  FROM: string;
  TO: string;
  ALLOWED_ORIGINS: string;
  LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

const MAX_NAME = 80;
const MAX_MESSAGE = 4000;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") ?? "";
    const allowed = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).includes(origin);
    const cors: Record<string, string> = allowed ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: allowed ? 204 : 403,
        headers: { ...cors, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" },
      });
    }
    if (request.method !== "POST") return reply(405, "method", cors);
    if (!allowed) return reply(403, "origin", cors);

    if (env.LIMITER) {
      const { success } = await env.LIMITER.limit({ key: request.headers.get("CF-Connecting-IP") ?? "unknown" });
      if (!success) return reply(429, "slow down", cors);
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(await request.text());
    } catch {
      return reply(400, "bad request", cors);
    }
    if (typeof data.website === "string" && data.website.trim()) return reply(200, null, cors);

    const name = oneLine(data.name).slice(0, MAX_NAME);
    const message = body(data.message).slice(0, MAX_MESSAGE);
    if (!name || message.length < 2) return reply(400, "empty", cors);
    const page = oneLine(data.page).slice(0, 300);

    const raw = compose({
      from: env.FROM,
      to: env.TO,
      subject: `Pure signal — ${name}`,
      text: `${message}\n\n— ${name}\n\n--\nLeft on the Pure Signal card${page ? ` (${page})` : ""}\n${new Date().toISOString()}`,
    });
    try {
      await env.MAIL.send(new EmailMessage(env.FROM, env.TO, raw));
    } catch (err) {
      console.error("send failed", err);
      return reply(502, "send failed", cors);
    }
    return reply(200, null, cors);
  },
};

function reply(status: number, error: string | null, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(error ? { ok: false, error } : { ok: true }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** One line of text: control characters (CR / LF included) become spaces. */
function oneLine(v: unknown): string {
  return String(v ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
}

/** A message body: newlines kept (normalised), other control characters dropped. */
function body(v: unknown): string {
  return String(v ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** An RFC 2047 header value: plain ASCII as is, anything else as UTF-8 encoded words. */
function header(v: string): string {
  if (/^[\x20-\x7e]*$/.test(v)) return v;
  const enc = new TextEncoder();
  const words: string[] = [];
  let chunk = "";
  for (const ch of v) {
    // each folded line stays under 78 characters: at most 39 bytes of text a word
    if (enc.encode(chunk + ch).length > 39) { words.push(chunk); chunk = ""; }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${b64(enc.encode(w))}?=`).join("\r\n ");
}

function compose({ from, to, subject, text }: { from: string; to: string; subject: string; text: string }): string {
  const domain = from.split("@")[1];
  const lines = b64(new TextEncoder().encode(text)).match(/.{1,76}/g) ?? [];
  return [
    `From: "Pure signal" <${from}>`,
    `To: <${to}>`,
    `Subject: ${header(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    ...lines,
    "",
  ].join("\r\n");
}
