// Plain-text mail through the send_email binding (as in workers/contact-form):
// from an address on keffer.cafe to the one verified destination.

import { EmailMessage } from "cloudflare:email";
import type { Env } from "./env";

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

export async function sendMail(env: Env, subject: string, text: string): Promise<void> {
  const domain = env.FROM.split("@")[1];
  const lines = b64(new TextEncoder().encode(text)).match(/.{1,76}/g) ?? [];
  const raw = [
    `From: "keffer.cafe signal" <${env.FROM}>`,
    `To: <${env.TO}>`,
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
  await env.MAIL.send(new EmailMessage(env.FROM, env.TO, raw));
}
