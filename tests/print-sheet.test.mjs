import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSheet, mmToPx, a4ToSheet, sheetToA4, rectContains, bleedRects, fitSheet, mmLabel, PX_PER_MM } from '../print-sheet.js';

test('300 dpi conversions', () => {
  assert.equal(mmToPx(297), 3508);
  assert.equal(mmToPx(210), 2480);
  assert.equal(mmToPx(3.175), 38);
  assert.ok(Math.abs(PX_PER_MM - 11.811) < 0.001);
});

test('default sheet is A4 plus 3.175 mm bleed on every side', () => {
  const s = makeSheet();
  assert.equal(s.w, 3584);
  assert.equal(s.h, 2556);
  assert.deepEqual(s.trim, { x: 38, y: 38, w: 3508, h: 2480 });
  assert.ok(Math.abs(s.wMm - 303.35) < 1e-9);
  assert.ok(Math.abs(s.hMm - 216.35) < 1e-9);
  assert.equal(s.trimWMm, 297);
  assert.equal(s.trimHMm, 210);
  assert.ok(Object.isFrozen(s) && Object.isFrozen(s.trim));
});

test('trim is centred on the sheet (equal bleed left/right and top/bottom)', () => {
  const s = makeSheet();
  assert.equal(s.trim.x, s.w - s.trim.x - s.trim.w);
  assert.equal(s.trim.y, s.h - s.trim.y - s.trim.h);
});

test('A4 <-> sheet coordinates round-trip', () => {
  const s = makeSheet();
  const p = { x: 1754, y: 1240 };
  assert.deepEqual(a4ToSheet(s, p), { x: 1792, y: 1278 });
  assert.deepEqual(sheetToA4(s, a4ToSheet(s, p)), p);
});

test('bleed rects tile exactly the area outside the trim', () => {
  const s = makeSheet();
  const rects = bleedRects(s);
  const area = rects.reduce((a, r) => a + r.w * r.h, 0);
  assert.equal(area, s.w * s.h - s.trim.w * s.trim.h);
  assert.ok(rects.every(r => r.w >= 0 && r.h >= 0));
});

test('rectContains handles null and edges', () => {
  assert.equal(rectContains(null, { x: 0, y: 0 }), false);
  const r = { x: 10, y: 10, w: 20, h: 5 };
  assert.equal(rectContains(r, { x: 10, y: 10 }), true);
  assert.equal(rectContains(r, { x: 30, y: 15 }), true);
  assert.equal(rectContains(r, { x: 31, y: 15 }), false);
});

test('fitSheet letterboxes and centres', () => {
  const s = makeSheet();
  const wide = fitSheet(s, 1000, 1000);
  assert.ok(Math.abs(wide.w - 1000) < 1e-9);
  assert.ok(wide.h < 1000 && Math.abs(wide.y - (1000 - wide.h) / 2) < 1e-9 && wide.x === 0);
  const tall = fitSheet(s, 400, 2000);
  assert.ok(Math.abs(tall.w - 400) < 1e-9 && tall.x === 0 && tall.y > 0);
});

test('mmLabel trims trailing zeros', () => {
  assert.equal(mmLabel(303.35, 216.35), '303.35 × 216.35 mm');
  assert.equal(mmLabel(297, 210), '297 × 210 mm');
});
