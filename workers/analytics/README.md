# keffer-analytics

keffer.cafe's own visitor analytics: how many people read the site, where
they are, how they found it, what they read and how far they got. The
dashboard is **https://signal.keffer.cafe**: sign in with a link emailed to
williamkeffer2005@gmail.com (no password; the link works once, for 15 minutes,
and opens a 90-day session on that device).

## How it fits together

- The site (`keffer-portfolio/lib/analytics.ts`, mounted by
  `components/shared/Analytics.tsx` in the root layout) sends each page view
  to `POST https://signal.keffer.cafe/e` with `navigator.sendBeacon`, then
  keeps it updated every 20 s and on leaving: time in view (stops a minute
  after the last input), deepest scroll, home sections reached. It also
  reports links out, mailto links, downloads, a message sent from the Pure
  Signal card and the copy buttons.
- No cookies on the site. A random id per browser in `localStorage` (`kf:id`)
  so a returning reader counts once; a visit ends after 30 idle minutes
  (`kf:visit`). With Global Privacy Control, or when storage is blocked, the
  Worker counts the browser by a hash of IP + UA salted with a random value
  that is replaced every day. No IP address is stored.
- Location is Cloudflare's own lookup (`request.cf`): country, region, city,
  postcode, coordinates, time zone, network (ASN / organisation).
- The endpoint is on a keffer.cafe subdomain on purpose: uBlock Origin blocks
  every third-party beacon (`$ping,3p`), so a `workers.dev` address would lose
  most readers who run a blocker. `signal.keffer.cafe/e` passes EasyList,
  EasyPrivacy, uBlock filters/privacy and AdGuard Spyware.
- D1 database `keffer-analytics` holds the raw rows (`migrations/`). The
  dashboard (`public/`, static assets) fetches raw rows for a range and counts
  everything in the browser, so every row, the map and the tiles filter the
  whole board with a click.
- Every Monday at 13:00 UTC the Worker emails a digest of the past week
  (`DIGEST = "weekly"` in `wrangler.toml`; `"off"` stops it).

## Not counting yourself

Open `https://keffer.cafe/?notrack` once in each of your browsers
(`?notrack=0` undoes it), or open one of your visits in the dashboard and
press "This is me". Crawlers, headless browsers and localhost are kept apart
too; "Include bots & my own visits" shows them.

## Deploying

Cloudflare Workers Builds is connected to the repo (keffer-analytics >
Settings > Builds: branch main, root directory `workers/analytics`, watch path
`workers/analytics/*`), so a push to main that touches this folder redeploys
it. By hand: `npx wrangler deploy` from this folder.

A schema change is a new file in `migrations/`, applied before the deploy:

    npx wrangler d1 migrations apply keffer-analytics --remote

## Local development

    npx wrangler d1 migrations apply keffer-analytics --local
    npx wrangler dev --port 8787

with a `.dev.vars` (git-ignored) holding
`DASHBOARD="http://signal.keffer.cafe"` (wrangler dev rewrites a same-host
Origin to the route's host) and `SITE_ORIGINS="http://localhost:3000"`.
Sign-in emails land as `.eml` files under `.wrangler/tmp/email/`. To send the
site's own reports there, run it with
`NEXT_PUBLIC_ANALYTICS_ENDPOINT=http://localhost:8787/e` and set
`localStorage["kf:debug"] = "1"` on localhost:3000.

## Third-party pieces in public/

- `vendor/`: d3-array 3.2.4, d3-geo 3.1.1, topojson-client 3.1.0 (ISC).
- `geo/world.json`: Natural Earth 1:110m countries via world-atlas 2.0.2
  (public domain / ISC), tagged with ISO alpha-2 codes; `geo/us.json`: US
  Census states via us-atlas 3.0.1 (ISC). Rebuilt by `scripts/build-geo.mjs`.
- `fonts/server-mono.woff2`: Server Mono (SIL OFL 1.1), as on the site.
