import type { EmailMessage } from "cloudflare:email";

export interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  DB: D1Database;
  MAIL: { send(message: EmailMessage): Promise<void> };
  FROM: string;
  TO: string;
  DASHBOARD: string;
  SITE_ORIGINS: string;
  DIGEST: string;
  HITS?: RateLimit;
  LOGIN?: RateLimit;
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export function siteOrigins(env: Env): string[] {
  return env.SITE_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
}

/** Headers every Worker response carries: nothing is cached, framed, or indexed. */
const BASE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "same-origin",
};

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...BASE_HEADERS, "Content-Type": "application/json", ...headers },
  });
}

export function html(body: string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: {
      ...BASE_HEADERS,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; style-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      "X-Frame-Options": "DENY",
      ...headers,
    },
  });
}

export function empty(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers: { ...BASE_HEADERS, ...headers } });
}

/** URL-safe random token from `bytes` random bytes. */
export function token(bytes = 32): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function cookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get("Cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

/**
 * The request came from a page on the dashboard itself (guards every POST
 * there). A form post can carry "Origin: null" under a strict referrer
 * policy; then the browser's own Sec-Fetch-Site, which pages can't set, says.
 */
export function fromDashboard(request: Request, env: Env): boolean {
  const origin = request.headers.get("Origin");
  if (origin === env.DASHBOARD) return true;
  return (origin === null || origin === "null") && request.headers.get("Sec-Fetch-Site") === "same-origin";
}

/** The city, region and country Cloudflare places the request in, for a sign-in record. */
export function place(request: Request): string {
  const cf = (request.cf ?? {}) as Record<string, unknown>;
  return [cf.city, cf.region, cf.country].filter(Boolean).join(", ");
}
