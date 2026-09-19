import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LAYOUT, moveItem, scaleItem, alignItem } from '../tent-layout.js';
import {
  HISTORY_MAX, SAVE_SOURCES, makeEntry, configKey, addEntry, removeEntry,
  parseHistory, serializeHistory, describeEntry, entryLayout,
} from '../tent-history.js';

const NOW = 1_760_000_000_000;
const baseState = { tent: 'B', bgKey: 'F', charSel: 3, name: 'Lorraine', layout: DEFAULT_LAYOUT, customImageId: null };
const mk = (state = {}, extra = {}) =>
  makeEntry({ ...baseState, ...state }, { id: extra.id ?? 'id-1', now: extra.now ?? NOW, source: extra.source ?? 'manual', thumb: extra.thumb ?? '' });

test('makeEntry snapshots only the fields that matter for the chosen tent', () => {
  const e = mk();
  assert.equal(e.id, 'id-1');
  assert.equal(e.savedAt, NOW);
  assert.equal(e.source, 'manual');
  assert.equal(e.tent, 'B');
  assert.equal(e.charSel, 3);
  assert.equal(e.name, 'Lorraine');
  assert.equal(e.bgKey, undefined);          // tent B has no girl/guy background
  assert.equal(e.customImageId, undefined);  // preset character, no upload
  assert.deepEqual(Object.keys(e.layout).sort(), ['char', 'text']);
  assert.deepEqual(e.layout.text, { x: 1971, y: 1860, scale: 1, align: 'center' });
  assert.deepEqual(e.layout.char, { x: 714, y: 2560, scale: 1 });
  assert.ok(Object.isFrozen(e) && Object.isFrozen(e.layout) && Object.isFrozen(e.layout.text));
  const a = mk({ tent: 'A', bgKey: 'M' });
  assert.equal(a.bgKey, 'M');
  assert.equal(a.charSel, undefined);
  assert.deepEqual(Object.keys(a.layout), ['text']);
});

test('makeEntry keeps the custom image id only for custom characters', () => {
  assert.equal(mk({ charSel: -1, customImageId: 'img-9' }).customImageId, 'img-9');
  assert.equal(mk({ charSel: 2, customImageId: 'img-9' }).customImageId, undefined);
});

test('makeEntry rejects bad input instead of storing garbage', () => {
  assert.throws(() => mk({ tent: 'Z' }), /tent/);
  assert.throws(() => mk({ name: 5 }), /name/);
  assert.throws(() => mk({}, { source: 'email' }), /source/);
  assert.throws(() => mk({}, { id: '' }), /id/);
});

test('configKey ignores id, time, source and thumbnail', () => {
  const a = mk({}, { id: 'x', now: 1, source: 'bleed', thumb: 'data:1' });
  const b = mk({}, { id: 'y', now: 2, source: 'trim', thumb: 'data:2' });
  assert.equal(configKey(a), configKey(b));
  assert.notEqual(configKey(a), configKey(mk({ name: 'Bob' })));
  assert.notEqual(configKey(a), configKey(mk({ layout: moveItem(DEFAULT_LAYOUT, 'B', 'char', 1, 0) })));
  assert.equal(configKey(a), configKey(mk({ layout: moveItem(DEFAULT_LAYOUT, 'A', 'text', 1, 0) }))); // other tent's layout is irrelevant
  assert.notEqual(configKey(mk({ charSel: -1, customImageId: 'p' })), configKey(mk({ charSel: -1, customImageId: 'q' })));
});

test('addEntry prepends, replaces an identical configuration and never mutates', () => {
  const first = mk({}, { id: '1', now: 1 });
  const list1 = addEntry([], first);
  assert.deepEqual(list1.map(e => e.id), ['1']);
  assert.ok(Object.isFrozen(list1));
  const second = mk({ name: 'Bob' }, { id: '2', now: 2 });
  const list2 = addEntry(list1, second);
  assert.deepEqual(list2.map(e => e.id), ['2', '1']);
  assert.deepEqual(list1.map(e => e.id), ['1']);
  const again = mk({}, { id: '3', now: 3, source: 'trim' });
  const list3 = addEntry(list2, again);
  assert.deepEqual(list3.map(e => e.id), ['3', '2']); // same config as '1' → moved to top, once
});

test('addEntry caps the list at HISTORY_MAX (oldest dropped)', () => {
  let list = [];
  for (let i = 0; i < HISTORY_MAX + 5; i++) list = addEntry(list, mk({ name: 'n' + i }, { id: 'id' + i, now: i }));
  assert.equal(list.length, HISTORY_MAX);
  assert.equal(list[0].name, 'n' + (HISTORY_MAX + 4));
  assert.equal(list[list.length - 1].name, 'n5');
  assert.equal(addEntry([], mk(), 2).length, 1);
});

test('removeEntry drops by id and returns the same list when nothing matches', () => {
  const list = addEntry(addEntry([], mk({}, { id: 'a' })), mk({ name: 'B' }, { id: 'b' }));
  const less = removeEntry(list, 'a');
  assert.deepEqual(less.map(e => e.id), ['b']);
  assert.equal(list.length, 2);
  assert.equal(removeEntry(list, 'zzz'), list);
});

test('serialize / parse round-trips and tolerates garbage', () => {
  const list = addEntry(addEntry([], mk({ tent: 'A', bgKey: 'M' }, { id: 'a', thumb: 'data:image/jpeg;base64,AAAA' })),
    mk({ charSel: -1, customImageId: 'img-1' }, { id: 'b', source: 'bleed' }));
  const back = parseHistory(serializeHistory(list));
  assert.deepEqual(back, list);
  assert.ok(Object.isFrozen(back) && Object.isFrozen(back[0]));
  assert.deepEqual(parseHistory(null), []);
  assert.deepEqual(parseHistory('nope'), []);
  assert.deepEqual(parseHistory('{"a":1}'), []);
  const [newest, oldest] = list; // 'b' then 'a'
  const mixed = parseHistory(JSON.stringify([newest, { id: 'junk' }, 7, { ...oldest, tent: 'Q' }, { ...oldest, id: 'c', layout: 'bad' }]));
  assert.deepEqual(mixed.map(e => e.id), ['b', 'c']); // a bad layout falls back to defaults, a bad tent is dropped
  assert.deepEqual(mixed[1].layout.text, { x: 2272, y: 1860, scale: 1, align: 'center' });
  assert.equal(parseHistory(JSON.stringify([{ ...list[0], id: 'dup' }, { ...list[0], id: 'dup' }])).length, 1);
});

test('parseHistory clamps stored positions and drops unknown sources', () => {
  const wild = { ...mk({}, { id: 'w' }), layout: { text: { x: -99999, y: 99999, scale: 50, align: 'weird' } }, source: 'nope' };
  const [e] = parseHistory(JSON.stringify([wild]));
  assert.ok(e.layout.text.x >= -800 && e.layout.text.y <= 2480 + 800);
  assert.equal(e.layout.text.scale, 1.6);
  assert.equal(e.layout.text.align, 'center');
  assert.equal(e.source, 'manual');
  assert.ok(SAVE_SOURCES.includes(e.source));
});

test('entryLayout restores the saved tent into the current layout and leaves the other tent alone', () => {
  const saved = alignItem(scaleItem(moveItem(DEFAULT_LAYOUT, 'B', 'char', 40, -10), 'B', 'text', 1.3), 'B', 'text', 'left');
  const e = mk({ layout: saved });
  const current = moveItem(DEFAULT_LAYOUT, 'A', 'text', 77, 0);
  const out = entryLayout(current, e);
  assert.deepEqual(out.B, saved.B);
  assert.equal(out.A, current.A);
  assert.ok(Object.isFrozen(out) && Object.isFrozen(out.B.char));
  assert.equal(current.A.text.x, DEFAULT_LAYOUT.A.text.x + 77);
});

test('describeEntry gives a readable title and subtitle', () => {
  assert.deepEqual(describeEntry(mk({ tent: 'A', bgKey: 'F', name: 'Lorraine' })), { title: 'Lorraine', subtitle: 'Grunge · Girl' });
  assert.deepEqual(describeEntry(mk({ tent: 'A', bgKey: 'M', name: '' })), { title: '(no name)', subtitle: 'Grunge · Guy' });
  assert.deepEqual(describeEntry(mk({ charSel: 3, name: 'Kim\\nLee' })), { title: 'Kim / Lee', subtitle: 'Passport · Character 4' });
  assert.deepEqual(describeEntry(mk({ charSel: -1, customImageId: 'i', name: 'Sam' })), { title: 'Sam', subtitle: 'Passport · Custom image' });
});
