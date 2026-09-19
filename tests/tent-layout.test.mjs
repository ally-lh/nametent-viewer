import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LAYOUT, SCALE_RANGE, effectiveItem, moveItem, scaleItem, resetTent, parseLayout, serializeLayout } from '../tent-layout.js';

const deepFrozen = o => Object.isFrozen(o) && Object.values(o).every(v => typeof v !== 'object' || deepFrozen(v));

test('defaults are frozen and complete', () => {
  assert.ok(deepFrozen(DEFAULT_LAYOUT));
  assert.deepEqual(Object.keys(DEFAULT_LAYOUT.A), ['text']);
  assert.deepEqual(Object.keys(DEFAULT_LAYOUT.B), ['text', 'char']);
});

test('moveItem returns a new layout and leaves the old one untouched', () => {
  const before = JSON.stringify(DEFAULT_LAYOUT);
  const next = moveItem(DEFAULT_LAYOUT, 'B', 'char', 10, -20);
  assert.notEqual(next, DEFAULT_LAYOUT);
  assert.equal(next.B.char.x, DEFAULT_LAYOUT.B.char.x + 10);
  assert.equal(next.B.char.y, DEFAULT_LAYOUT.B.char.y - 20);
  assert.equal(next.B.text, DEFAULT_LAYOUT.B.text); // untouched sibling is shared
  assert.equal(next.A, DEFAULT_LAYOUT.A);
  assert.equal(JSON.stringify(DEFAULT_LAYOUT), before);
});

test('moveItem clamps to a margin around the A4 page', () => {
  const far = moveItem(DEFAULT_LAYOUT, 'A', 'text', 1e6, -1e6);
  assert.ok(far.A.text.x < 3508 + 800 && far.A.text.x > 3508);
  assert.ok(far.A.text.y > -800 && far.A.text.y < 0);
});

test('moveItem ignores unknown items and bad deltas', () => {
  assert.equal(moveItem(DEFAULT_LAYOUT, 'A', 'char', 5, 5), DEFAULT_LAYOUT);
  assert.equal(moveItem(DEFAULT_LAYOUT, 'Z', 'text', 5, 5), DEFAULT_LAYOUT);
  assert.equal(moveItem(DEFAULT_LAYOUT, 'A', 'text', NaN, 5), DEFAULT_LAYOUT);
});

test('scaleItem clamps to the allowed range', () => {
  assert.equal(scaleItem(DEFAULT_LAYOUT, 'B', 'char', 99).B.char.scale, SCALE_RANGE.max);
  assert.equal(scaleItem(DEFAULT_LAYOUT, 'B', 'char', 0).B.char.scale, SCALE_RANGE.min);
  assert.equal(scaleItem(DEFAULT_LAYOUT, 'B', 'char', 1.2).B.char.scale, 1.2);
  assert.equal(scaleItem(DEFAULT_LAYOUT, 'B', 'char', 'big'), DEFAULT_LAYOUT);
});

test('effectiveItem applies the scale to every size field only', () => {
  const t = effectiveItem({ ...DEFAULT_LAYOUT.A.text, scale: 2 });
  assert.equal(t.w, DEFAULT_LAYOUT.A.text.w * 2);
  assert.equal(t.size, DEFAULT_LAYOUT.A.text.size * 2);
  assert.equal(t.x, DEFAULT_LAYOUT.A.text.x);
  const c = effectiveItem({ ...DEFAULT_LAYOUT.B.char, scale: 0.5 });
  assert.equal(c.maxW, DEFAULT_LAYOUT.B.char.maxW / 2);
  assert.equal(c.maxH, DEFAULT_LAYOUT.B.char.maxH / 2);
  assert.equal(effectiveItem(DEFAULT_LAYOUT.B.char).maxW, DEFAULT_LAYOUT.B.char.maxW);
});

test('resetTent restores one tent and keeps the other', () => {
  const moved = moveItem(moveItem(DEFAULT_LAYOUT, 'A', 'text', 50, 50), 'B', 'text', 50, 50);
  const reset = resetTent(moved, 'A');
  assert.equal(reset.A, DEFAULT_LAYOUT.A);
  assert.equal(reset.B, moved.B);
  assert.equal(resetTent(moved, 'nope'), moved);
});

test('serialize / parse round-trips the adjustable fields', () => {
  const l = scaleItem(moveItem(DEFAULT_LAYOUT, 'B', 'char', -30, 12), 'B', 'char', 1.25);
  const back = parseLayout(serializeLayout(l));
  assert.deepEqual(back.B.char, l.B.char);
  assert.deepEqual(back.A.text, DEFAULT_LAYOUT.A.text);
  assert.ok(!serializeLayout(l).includes('maxW')); // sizes come from defaults
});

test('parseLayout falls back to defaults for garbage, partial and out-of-range data', () => {
  assert.deepEqual(parseLayout(null), DEFAULT_LAYOUT);
  assert.deepEqual(parseLayout('not json'), DEFAULT_LAYOUT);
  assert.deepEqual(parseLayout('[]'), DEFAULT_LAYOUT);
  assert.deepEqual(parseLayout('{"A":{"text":{"x":"1","y":2}}}'), DEFAULT_LAYOUT);
  const partial = parseLayout('{"B":{"text":{"x":100,"y":200}}}');
  assert.equal(partial.B.text.x, 100);
  assert.equal(partial.B.text.scale, 1);
  assert.deepEqual(partial.B.char, DEFAULT_LAYOUT.B.char);
  const wild = parseLayout('{"B":{"char":{"x":-99999,"y":99999,"scale":50}}}');
  assert.ok(wild.B.char.x >= -800 && wild.B.char.y <= 2480 + 800);
  assert.equal(wild.B.char.scale, SCALE_RANGE.max);
});

test('parseLayout output is deeply frozen', () => {
  const l = parseLayout('{"A":{"text":{"x":10,"y":20}}}');
  assert.ok(Object.isFrozen(l) && Object.isFrozen(l.A) && Object.isFrozen(l.A.text) && Object.isFrozen(l.B.char));
  assert.throws(() => { 'use strict'; l.A.text.x = 0; });
});

test('alignItem only accepts known alignments on text items', async () => {
  const { alignItem, TEXT_ALIGNS } = await import('../tent-layout.js');
  assert.deepEqual(TEXT_ALIGNS, ['left', 'center']);
  assert.equal(DEFAULT_LAYOUT.A.text.align, 'center');
  const l = alignItem(DEFAULT_LAYOUT, 'A', 'text', 'left');
  assert.equal(l.A.text.align, 'left');
  assert.equal(DEFAULT_LAYOUT.A.text.align, 'center');
  assert.equal(alignItem(DEFAULT_LAYOUT, 'A', 'text', 'justify'), DEFAULT_LAYOUT);
  assert.equal(alignItem(DEFAULT_LAYOUT, 'B', 'char', 'left'), DEFAULT_LAYOUT);
  const back = parseLayout(serializeLayout(l));
  assert.equal(back.A.text.align, 'left');
  assert.equal(back.B.text.align, 'center');
  assert.ok(!('align' in JSON.parse(serializeLayout(l)).B.char));
  assert.equal(parseLayout('{"A":{"text":{"x":1,"y":2,"align":"weird"}}}').A.text.align, 'center');
});

test('tentToStored / withStoredTent move one tent in and out of storage form', async () => {
  const { alignItem, tentToStored, withStoredTent } = await import('../tent-layout.js');
  const l = alignItem(scaleItem(moveItem(DEFAULT_LAYOUT, 'B', 'char', -30, 12), 'B', 'text', 1.25), 'B', 'text', 'left');
  const stored = tentToStored(l, 'B');
  assert.deepEqual(stored, { text: { x: 1971, y: 1860, scale: 1.25, align: 'left' }, char: { x: 684, y: 2572, scale: 1 } });
  assert.ok(Object.isFrozen(stored) && Object.isFrozen(stored.text));
  const other = moveItem(DEFAULT_LAYOUT, 'A', 'text', 5, 5);
  const merged = withStoredTent(other, 'B', stored);
  assert.deepEqual(merged.B, l.B);
  assert.equal(merged.A, other.A);
  assert.ok(Object.isFrozen(merged) && Object.isFrozen(merged.B.char));
  const junk = withStoredTent(other, 'B', { text: 'bad', char: { x: 'no' } });
  assert.deepEqual(junk.B, DEFAULT_LAYOUT.B);
  assert.equal(withStoredTent(other, 'Q', stored), other);
  assert.equal(tentToStored(l, 'Q'), null);
});

test('centreItem centres on the A4 front face, ignoring the bleed', async () => {
  const { centreItem, FRONT_CENTRE } = await import('../tent-layout.js');
  assert.deepEqual(FRONT_CENTRE, { x: 1754, y: 1860 });
  const t = centreItem(DEFAULT_LAYOUT, 'A', 'text');
  assert.deepEqual([t.A.text.x, t.A.text.y], [1754, 1860]);
  assert.equal(t.A.text.w, DEFAULT_LAYOUT.A.text.w); // only the position changes
  const c = centreItem(DEFAULT_LAYOUT, 'B', 'char', 1000);
  assert.deepEqual([c.B.char.x, c.B.char.y], [1754, 1860 + 500]); // bottom anchor sits half the height below centre
  assert.equal(centreItem(DEFAULT_LAYOUT, 'B', 'char').B.char.y, 1860 + DEFAULT_LAYOUT.B.char.maxH / 2);
  assert.equal(centreItem(DEFAULT_LAYOUT, 'A', 'char'), DEFAULT_LAYOUT);
  assert.equal(DEFAULT_LAYOUT.A.text.x, 2272);
});

test('default name positions sit at the vertical centre of the A4 front face', async () => {
  const { FRONT_CENTRE } = await import('../tent-layout.js');
  assert.equal(DEFAULT_LAYOUT.A.text.y, FRONT_CENTRE.y);
  assert.equal(DEFAULT_LAYOUT.B.text.y, FRONT_CENTRE.y);
  assert.equal(FRONT_CENTRE.y, (2480 / 2 + 2480) / 2); // halfway between the fold and the A4 bottom
});
