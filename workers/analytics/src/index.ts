// keffer-analytics — keffer.cafe's own visitor counter and its dashboard.
//
//   POST /e        the site's reports (collect.ts)
//   /auth/*        emailed-link sign-in (auth.ts)
//   /api/*         the dashboard's data, signed in only (api.ts)
//   everything else is the dashboard itself, from public/ (static assets)
//
// A Monday cron mails the weekly digest (digest.ts).

import { type Env, empty, json } from "./env";
import { collect } from "./collect";
import { auth, signedIn } from "./auth";
import { api } from "./api";
import { sweep, weekly } from "./digest";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    try {
      if (path === "/e") return await collect(request, env);
      if (path.startsWith("/auth/")) return await auth(request, env, path);
      if (path === "/api/me") return json({ signedIn: await signedIn(request, env) });
      if (path.startsWith("/api/")) {
        if (!(await signedIn(request, env))) return json({ error: "sign in" }, 401);
        return await api(request, env, path);
      }
      return empty(404);
    } catch (err) {
      console.error(path, err);
      return json({ error: "server" }, 500);
    }
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (env.DIGEST === "weekly") ctx.waitUntil(weekly(env).catch((err) => console.error("digest", err)));
    ctx.waitUntil(sweep(env));
  },
};
