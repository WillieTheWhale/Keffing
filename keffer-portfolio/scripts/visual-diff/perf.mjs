// Performance of one build under CPU throttling.
// usage: node scripts/visual-diff/perf.mjs <origin> <label> [cpuRate=6] [route=/] [view=desk|phone]
// Reports: load (long tasks / TBT), a scripted scroll through the whole page
// (rAF intervals, main-thread time split from CDP metrics), idle cost at rest,
// and a CPU profile of the scroll (top self-time functions).
import { createRequire } from "module";
const require = createRequire(new URL("../../package.json", import.meta.url));
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const { chromium } = require("playwright-core");
const [origin, label, rateArg, routeArg, viewArg] = process.argv.slice(2);
const rate = +(rateArg ?? 6), route = routeArg ?? "/", view = viewArg ?? "desk";
const V = view === "phone" ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 };
const browser = await chromium.launch({ executablePath: CHROME, args: [...(process.env.SW ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--use-angle=metal"]), "--ignore-gpu-blocklist", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--hide-scrollbars"] });
const ctx = await browser.newContext(V);
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Performance.enable");
await cdp.send("Emulation.setCPUThrottlingRate", { rate });
await page.addInitScript(() => {
  window.__lt = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: "longtask", buffered: true });
  try { sessionStorage.setItem("sn-entry-done", "1"); } catch {}
});
await page.goto(origin + route, { waitUntil: "load", timeout: 180000 });
await page.waitForTimeout(9000);
const lt = await page.evaluate(() => window.__lt);
const tbt = lt.reduce((a, [, d]) => a + Math.max(0, d - 50), 0);
const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
const res = { label, rate, route, view, load: { longTasks: lt.length, tbtMs: Math.round(tbt), longestMs: Math.round(Math.max(0, ...lt.map((x) => x[1]))) } };

// idle at the top: main-thread cost per second
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1500);
let m0 = await metrics();
await page.waitForTimeout(4000);
let m1 = await metrics();
res.idle = { taskMsPerS: +((m1.TaskDuration - m0.TaskDuration) * 1000 / 4).toFixed(1), scriptMsPerS: +((m1.ScriptDuration - m0.ScriptDuration) * 1000 / 4).toFixed(1) };

// scripted scroll: wheel steps through the whole page
await page.mouse.move(V.viewport.width / 2, V.viewport.height / 2);
await page.evaluate(() => { window.__ft = []; let l = performance.now(); const t = (n) => { window.__ft.push(n - l); l = n; if (!window.__stopFt) requestAnimationFrame(t); }; requestAnimationFrame(t); });
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
await cdp.send("Profiler.start");
m0 = await metrics();
const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
const steps = Math.ceil(total / 100);
for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(33); }
await page.waitForTimeout(2500);
m1 = await metrics();
const prof = (await cdp.send("Profiler.stop")).profile;
await page.evaluate(() => { window.__stopFt = true; });
const ft = (await page.evaluate(() => window.__ft.slice(3))).sort((a, b) => a - b);
const q = (p) => ft[Math.min(ft.length - 1, Math.floor(p * ft.length))];
const dur = m1.Timestamp - m0.Timestamp;
res.scroll = {
  frames: ft.length, p50: +q(0.5).toFixed(1), p90: +q(0.9).toFixed(1), p95: +q(0.95).toFixed(1), p99: +q(0.99).toFixed(1), max: +ft[ft.length - 1].toFixed(1),
  over20: ft.filter((x) => x > 20).length, over34: ft.filter((x) => x > 34).length,
  fps: +(ft.length / ft.reduce((a, b) => a + b, 0) * 1000).toFixed(1),
  msPerS: Object.fromEntries(["TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration"].map((k) => [k.replace("Duration", ""), +((m1[k] - m0[k]) * 1000 / dur).toFixed(1)])),
  layouts: m1.LayoutCount - m0.LayoutCount, styleRecalcs: m1.RecalcStyleCount - m0.RecalcStyleCount,
};
// top self time by function
const self = new Map();
const byId = new Map(prof.nodes.map((n) => [n.id, n]));
const counts = new Map();
for (const s of prof.samples) counts.set(s, (counts.get(s) || 0) + 1);
for (const [id, c] of counts) {
  const n = byId.get(id); const f = n.callFrame;
  const key = `${f.functionName || "(anon)"} ${f.url.split("/").pop()}:${f.lineNumber}`;
  self.set(key, (self.get(key) || 0) + c);
}
const totalSamples = prof.samples.length;
res.top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, c]) => `${(100 * c / totalSamples).toFixed(1)}% ${k}`);
console.log(JSON.stringify(res, null, 1));
await browser.close();
