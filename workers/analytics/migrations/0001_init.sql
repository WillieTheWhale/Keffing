-- One row per page view. The page makes the id and keeps updating the row
-- (time in view, scroll depth, sections reached) until the reader leaves.
CREATE TABLE views (
  id           TEXT PRIMARY KEY,
  ts           INTEGER NOT NULL,          -- ms since epoch, when the view began
  last         INTEGER NOT NULL,          -- ms, the latest report for it
  visitor      TEXT NOT NULL,             -- the browser's own random id, or a daily hash when it keeps none
  session      TEXT NOT NULL,             -- a visit: ends after 30 idle minutes
  new_visitor  INTEGER NOT NULL DEFAULT 0, -- the browser had no id before this view
  host         TEXT NOT NULL,
  path         TEXT NOT NULL,
  title        TEXT,
  referrer     TEXT,                      -- host + path of the page that sent them, no query
  source       TEXT,                      -- "Google", "LinkedIn", "Direct", … (entry views only)
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  country      TEXT,                      -- ISO 3166-1 alpha-2
  region       TEXT,
  region_code  TEXT,
  city         TEXT,
  postal       TEXT,
  continent    TEXT,
  lat          REAL,
  lon          REAL,
  timezone     TEXT,
  asn          INTEGER,
  org          TEXT,                      -- the network: ISP, university, company
  colo         TEXT,                      -- the Cloudflare data centre that answered
  browser      TEXT,
  browser_ver  TEXT,
  os           TEXT,
  os_ver       TEXT,
  device       TEXT,                      -- desktop / mobile / tablet
  screen       TEXT,                      -- "1512x982"
  viewport     TEXT,
  lang         TEXT,
  engaged      INTEGER NOT NULL DEFAULT 0, -- ms the page was in view and in use
  scroll       INTEGER NOT NULL DEFAULT 0, -- deepest point reached, % of the page
  sections     TEXT NOT NULL DEFAULT '',   -- home sections reached, in order: "hero,about,work"
  bot          INTEGER NOT NULL DEFAULT 0  -- 1: crawler / headless browser
);
CREATE INDEX views_ts ON views (ts);
CREATE INDEX views_visitor ON views (visitor, ts);
CREATE INDEX views_last ON views (last);

-- Clicks worth knowing about: links out, downloads, messages sent, copies.
CREATE TABLE events (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      INTEGER NOT NULL,
  view    TEXT NOT NULL,
  visitor TEXT NOT NULL,
  session TEXT NOT NULL,
  name    TEXT NOT NULL,
  label   TEXT,
  path    TEXT
);
CREATE INDEX events_ts ON events (ts);
CREATE INDEX events_visitor ON events (visitor, ts);

-- Browsers left out of the numbers (William's own).
CREATE TABLE ignored (
  visitor TEXT PRIMARY KEY,
  note    TEXT,
  created INTEGER NOT NULL
);

-- One random salt per UTC day for the fallback visitor hash; swept after two days.
CREATE TABLE salts (
  day  TEXT PRIMARY KEY,
  salt TEXT NOT NULL
);

-- Emailed sign-in links (hash of the token) and the dashboard sessions they open.
CREATE TABLE logins (
  token   TEXT PRIMARY KEY,
  created INTEGER NOT NULL,
  expires INTEGER NOT NULL,
  used    INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE sessions (
  id      TEXT PRIMARY KEY,
  created INTEGER NOT NULL,
  expires INTEGER NOT NULL,
  ua      TEXT,
  place   TEXT
);
