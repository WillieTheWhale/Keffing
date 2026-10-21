#!/usr/bin/env node
/**
 * Weekly screenshot critique rig (design roadmap working agreement).
 * Boots headless Chrome against a running dev server and captures:
 *   - the entry sequence mid-flight
 *   - each section at viewport center
 *   - the tuning beat at the first section boundary
 *   - the index menu open
 * Usage: node scripts/critique.mjs [port] [outDir]
 * Requires: playwright-core + a "Chrome for Testing" build in the
 * ms-playwright cache (any recent chromium-* folder works).
 */
import { createRequire } from "module";
import path from "path";
import fs from "fs";
import os from "os";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright-core"));
} catch {
  console.error("playwright-core not found. npm i -D playwright-core");
  process.exit(1);
}

const port = process.argv[2] || "3000";
const outDir = process.argv[3] || "critique-shots";
fs.mkdirSync(outDir, { recursive: true });

const cache = path.join(os.homedir(), "Library/Caches/ms-playwright");
const chromeDir = fs
  .readdirSync(cache)
  .filter((d) => /^chromium-\d+$/.test(d))
  .sort()
  .pop();
const exe = path.join(
  cache,
  chromeDir,
  "chrome-mac-arm64",
  "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
);

const url = `http://localhost:${port}`;
const shot = (page, name) =>
  page.screenshot({ path: path.join(outDir, `${name}.png`) });

const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

// Entry sequence
await page.goto(url, { waitUntil: "commit" });
await page.waitForTimeout(600);
await shot(page, "00-entry");
await page.waitForTimeout(3000);
await shot(page, "01-hero");

// Sections
for (const id of ["about", "work", "stuff", "experience", "contact"]) {
  await page.evaluate((sid) => {
    const el = document.getElementById(sid);
    if (el) window.scrollTo(0, el.offsetTop + el.offsetHeight / 2 - innerHeight / 2);
  }, id);
  await page.waitForTimeout(2000);
  await shot(page, `02-${id}`);
}

// Tuning beat (hero→about boundary)
await page.evaluate(() => {
  const hero = document.getElementById("hero");
  const about = document.getElementById("about");
  if (!hero || !about) return;
  const maxScroll = document.documentElement.scrollHeight - innerHeight;
  const heroEnd = (hero.offsetTop + hero.offsetHeight - innerHeight * 0.65) / maxScroll;
  const aboutStart = (about.offsetTop - innerHeight * 0.35) / maxScroll;
  window.scrollTo(0, ((heroEnd + aboutStart) / 2) * maxScroll);
});
await page.waitForTimeout(1800);
await shot(page, "03-tuning-beat");

// Index menu
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(600);
const chip = await page.$('button[aria-label="Open index menu"]');
if (chip) {
  await chip.click();
  await page.waitForTimeout(900);
  await shot(page, "04-index-menu");
}

await browser.close();
console.log(`critique shots written to ${outDir}/`);
