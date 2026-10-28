// Deterministic captures of one build (served by serve.mjs, ?freeze) at fixed
// scroll positions across the home page, the finale and the inner pages.
// usage: node scripts/visual-diff/capture.mjs <origin> <outDir> [views] [pages] [positions]
//   views: desk,phone,tab,rm,touch (comma lists; all when omitted). `touch` is
//         the phone without Chrome's mobile layout viewport, which widens to
//         any overflowing content and then reports a taller innerHeight than
//         CSS vh: use it to compare builds whose scroll math differs in that.
//   SW=1  render with SwiftShader — bit-exact run to run, unlike the GPU,
//         whose output jitters by a few dozen pixels per frame on this Mac
//   STEP=50 DPR=1  fewer, larger clock steps and 1x pixels (software is slow)
//   CHROME=/path/to/chrome  (default: the macOS Google Chrome app)
import { createRequire } from "module";
import fs from "fs";
const require = createRequire(new URL("../../package.json", import.meta.url));
const { chromium } = require("playwright-core");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [origin, out, only, onlyPage, onlyPos] = process.argv.slice(2);
// virtual ms per advanced frame (software rendering is slow: bigger steps, same totals)
const STEP = +(process.env.STEP || 1000 / 60);
fs.mkdirSync(out, { recursive: true });
// DPR=1: software-rendering sweeps (same code paths, a quarter of the pixels)
const D = process.env.DPR ? +process.env.DPR : null;
const VIEWS = {
  desk: { viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  tab: { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2 },
  rm: { viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, reducedMotion: "reduce" },
  touch: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true },
};
// positions: [label, js expression for scrollY, frames to advance]
const sec = (id, f) => `(document.getElementById('${id}').offsetTop + ${f}*innerHeight)`;
const dive = (d) => `(document.getElementById('dive').offsetTop + ${d}*(document.getElementById('dive').offsetHeight-innerHeight))`;
const end = (f) => `(${f}*(document.documentElement.scrollHeight-innerHeight))`;
const HOME = [
  ["top", "0", 120], ["hero45", "0.45*innerHeight", 120], ["about", sec("about", 0.1), 200], ["about2", sec("about", 0.6), 160],
  ["work", sec("work", 0.2), 200], ["work2", sec("work", 0.7), 160], ["stuff", sec("stuff", 0.2), 200], ["exp", sec("experience", 0.3), 200],
  ["exp2", sec("experience", 0.85), 160], ["contact", sec("contact", 0), 200], ["contact2", sec("contact", 0.5), 200],
  ...[0.04, 0.12, 0.2, 0.28, 0.36, 0.44, 0.52, 0.6, 0.7, 0.8, 0.9, 1].map((d) => [`dive${Math.round(d * 100)}`, dive(d), 480]),
];
const PAGE = [["top", "0", 160], ["mid", end(0.5), 160], ["end", end(1), 160]];
const PLAN = {
  desk: [["home", "/", HOME], ["bragg", "/work/bragg-peak", PAGE], ["eel", "/work/eel", PAGE], ["hardware", "/stuff/hardware", PAGE], ["software", "/stuff/software", PAGE], ["media", "/stuff/media", PAGE.slice(0, 1)], ["resume", "/resume", PAGE], ["cv", "/CV", PAGE.slice(0, 1)]],
  phone: [["home", "/", HOME.filter((_, i) => i % 2 === 0)], ["bragg", "/work/bragg-peak", PAGE], ["hardware", "/stuff/hardware", PAGE.slice(0, 1)], ["resume", "/resume", PAGE.slice(0, 1)]],
  tab: [["home", "/", HOME.filter((_, i) => i % 3 === 0)], ["bragg", "/work/bragg-peak", PAGE.slice(0, 1)]],
  rm: [["home", "/", HOME.filter((_, i) => [0, 2, 9, 11, 16, 22].includes(i))], ["bragg", "/work/bragg-peak", PAGE.slice(0, 1)]],
  touch: [["home", "/", HOME.filter((_, i) => i % 2 === 0)], ["bragg", "/work/bragg-peak", PAGE], ["hardware", "/stuff/hardware", PAGE.slice(0, 1)], ["resume", "/resume", PAGE.slice(0, 1)]],
};
const browser = await chromium.launch({ executablePath: CHROME, args: [...(process.env.SW ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--use-angle=metal"]), "--ignore-gpu-blocklist", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--hide-scrollbars"] });
const report = {};
for (const [view, pages] of Object.entries(PLAN)) {
  if (only && !only.split(",").includes(view)) continue;
  for (const [name, route, positionsAll] of pages) {
    if (onlyPage && !onlyPage.split(",").includes(name)) continue;
    const positions = onlyPos ? positionsAll.filter(([l]) => onlyPos.split(",").includes(l)) : positionsAll;
    const ctx = await browser.newContext(D ? { ...VIEWS[view], deviceScaleFactor: D } : VIEWS[view]);
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + ": " + m.text()); });
    await page.goto(origin + route + "?freeze", { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(4500); // entry sequence + settle timers run on real time; the clock stays frozen
    // every font face now (the rail's oblique numerals otherwise load on first use, mid-capture)
    await page.evaluate(() => Promise.all([...document.fonts].map((f) => f.load().catch(() => {}))));
    await page.evaluate((ms) => window.__clock.advance(Math.ceil(90 * 16.67 / ms), ms), STEP);
    let k = 0;
    for (const [label, yExpr, frames] of positions) {
      k++;
      const n = Math.ceil(frames * 16.67 / STEP);
      if (label.startsWith("dive")) {
        // the finale's spring steps on every frame it sees: start the clock with the scroll, no frozen frames
        await page.evaluate(([e, n, ms]) => { window.scrollTo(0, Math.round(eval(e))); return window.__clock.advance(n, ms); }, [yExpr, n, STEP]);
      } else {
        await page.evaluate((e) => window.scrollTo(0, Math.round(eval(e))), yExpr);
        await page.waitForTimeout(1500); // async loads (images, the Mii) land before any virtual time passes
        await page.evaluate(([n, ms]) => window.__clock.advance(n, ms), [n, STEP]);
      }
      await page.waitForTimeout(900); // CSS transitions (real time)
      // real-time CSS / WAAPI animations: finite ones to their end, looping ones to a fixed phase
      // (scroll-driven ones already sit where the scroll puts them)
      await page.evaluate(() => { for (const a of document.getAnimations()) { if (a.timeline !== document.timeline) continue; const it = a.effect?.getComputedTiming?.().iterations; if (it === Infinity) { a.pause(); a.currentTime = 1000; } else { try { a.finish(); } catch {} } } });
      await page.evaluate(() => window.__clock.set(Math.ceil(window.__clock.now() / 1000) * 1000 + 234));
      await page.evaluate(() => new Promise((r) => { let n = 0; const f = () => (++n < 6 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }));
      await page.screenshot({ path: `${out}/${view}-${name}-${String(k).padStart(2, "0")}-${label}.png` });
    }
    report[`${view}-${name}`] = errs;
    await ctx.close();
    process.stdout.write(`${view}-${name} done (${errs.length} msgs)\n`);
  }
}
fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
await browser.close();
