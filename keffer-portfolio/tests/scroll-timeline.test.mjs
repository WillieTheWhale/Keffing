import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scrollKeyframes } from '../lib/scrollTimeline.ts';

// Evaluate generated @keyframes the way a browser does: find the keyframe
// interval, run its cubic-bezier timing function, interpolate linearly.
function parse(css) {
  const frames = [];
  for (const m of css.matchAll(/([\d.e-]+)%\{v:([-\d.e]+)(?:;animation-timing-function:cubic-bezier\(([^)]*)\))?\}/g)) {
    frames.push({ at: +m[1] / 100, v: +m[2], ease: m[3] ? m[3].split(',').map(Number) : null });
  }
  return frames;
}
function bezier([x1, y1, x2, y2], p) {
  const c = (a, b, t) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (c(x1, x2, m) < p) lo = m; else hi = m; }
  return c(y1, y2, (lo + hi) / 2);
}
function sample(frames, p) {
  if (p <= frames[0].at) return frames[0].v;
  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i], b = frames[i + 1];
    if (p <= b.at) {
      const t = (p - a.at) / (b.at - a.at);
      return a.v + (b.v - a.v) * (a.ease ? bezier(a.ease, t) : t);
    }
  }
  return frames[frames.length - 1].v;
}
function worstError(curve, vh, range) {
  const frames = parse(scrollKeyframes('k', { ...curve, css: (v) => `v:${v}` }, vh, range));
  let worst = 0;
  for (let px = 0; px <= range; px += 3.7) worst = Math.max(worst, Math.abs(sample(frames, px / range) - curve.f(px / vh)));
  return { worst, frames };
}

const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

test('the camera curve (linear, quadratic ease-out, hold) is reproduced exactly', () => {
  const h0 = 5.2, h1 = 6.4, span = h1 - h0, vh = 754;
  const g = (s) => (s <= h0 ? s : h0 + (Math.min(s, h1) - h0) - ((Math.min(s, h1) - h0) ** 2) / (2 * span));
  const { worst, frames } = worstError({ breaks: [h0, h1], f: (s) => -0.5 * g(s) * vh }, vh, 9 * vh);
  assert.equal(frames.length, 4);
  assert.ok(worst < 1e-3, `off by ${worst}px`);
});

test('a smoothstep fade window is reproduced exactly, and a segment cut by the range start is too', () => {
  const vh = 844;
  for (const a0 of [1.3, -0.2]) {
    const a1 = a0 + 1.3;
    const f = (s) => Math.min(smooth((s - a0) / 0.35), 1 - smooth((s - a1) / 0.35));
    const { worst } = worstError({ breaks: [a0, a0 + 0.35, a1, a1 + 0.35], f }, vh, 6 * vh);
    assert.ok(worst < 1e-6, `opacity off by ${worst} (a0 ${a0})`);
  }
});

test('the hero shear (ease-in quadratic, clamped) is reproduced exactly', () => {
  const vh = 754, end = 0.8;
  const e = (s) => (Math.min(s, end) / end) ** 2;
  const { worst } = worstError({ breaks: [end / Math.sqrt(1.15)], f: (s) => Math.max(0, 1 - 1.15 * e(s)) }, vh, end * vh);
  assert.ok(worst < 1e-6, `off by ${worst}`);
});
