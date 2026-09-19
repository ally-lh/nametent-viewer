// Saved configurations ("history"): every tent the user printed or saved,
// so it can be brought back and edited. Pure, no DOM — shared with the tests.
//
// An entry snapshots exactly what is needed to rebuild the tent: which style,
// which character (girl/guy for A, a preset index or a custom-image id for
// B), the name, and that tent's layout in storage form (see tent-layout.js).
// The list is newest-first, capped, and never mutated in place.
import { tentToStored, withStoredTent, DEFAULT_LAYOUT } from './tent-layout.js';

export const HISTORY_MAX = 30;
export const SAVE_SOURCES = Object.freeze(['manual', 'bleed', 'trim']);
const DEFAULT_SOURCE = 'manual';
const TENTS = Object.keys(DEFAULT_LAYOUT);
const BG_KEYS = Object.freeze(['F', 'M']);
const CUSTOM_CHAR = -1;
const MAX_NAME = 40;
const TENT_LABEL = Object.freeze({ A: 'Grunge', B: 'Passport' });
const BG_LABEL = Object.freeze({ F: 'Girl', M: 'Guy' });

const deepFreeze = o => { Object.values(o).forEach(v => { if (v && typeof v === 'object') deepFreeze(v); }); return Object.freeze(o); };
const isStr = v => typeof v === 'string';
const isNonEmptyStr = v => isStr(v) && v.length > 0;
const isCharSel = v => Number.isInteger(v) && v >= CUSTOM_CHAR;

/** Snapshot the current design. Throws on malformed input so nothing bad
 *  ever reaches storage. `thumb` is an optional small data-URL preview. */
export function makeEntry({ tent, bgKey, charSel, name, layout, customImageId }, { id, now, source = DEFAULT_SOURCE, thumb = '' }) {
  if (!TENTS.includes(tent)) throw new Error('history: unknown tent ' + tent);
  if (!isStr(name)) throw new Error('history: name must be a string');
  if (!SAVE_SOURCES.includes(source)) throw new Error('history: unknown source ' + source);
  if (!isNonEmptyStr(id)) throw new Error('history: an entry needs an id');
  if (!Number.isFinite(now)) throw new Error('history: savedAt must be a number');
  const entry = { id, savedAt: now, source, tent, name: name.slice(0, MAX_NAME), layout: tentToStored(layout, tent) };
  if (tent === 'A') entry.bgKey = BG_KEYS.includes(bgKey) ? bgKey : BG_KEYS[0];
  if (tent === 'B') {
    entry.charSel = isCharSel(charSel) ? charSel : 0;
    if (entry.charSel === CUSTOM_CHAR) {
      if (!isNonEmptyStr(customImageId)) throw new Error('history: a custom character needs its image id');
      entry.customImageId = customImageId;
    }
  }
  if (isStr(thumb) && thumb) entry.thumb = thumb;
  return deepFreeze(entry);
}

/** Everything that defines the design (not when / why it was saved). Two
 *  entries with the same key rebuild the same tent. */
export function configKey(entry) {
  const { tent, bgKey, charSel, customImageId, name, layout } = entry;
  return JSON.stringify([tent, bgKey ?? null, charSel ?? null, customImageId ?? null, name, layout]);
}

/** Newest first. A design already in the list is replaced (moved to the top
 *  with the new time / source) rather than duplicated. */
export function addEntry(list, entry, max = HISTORY_MAX) {
  const key = configKey(entry);
  const rest = list.filter(e => configKey(e) !== key);
  return Object.freeze([entry, ...rest].slice(0, Math.max(1, max)));
}

export function removeEntry(list, id) {
  const next = list.filter(e => e.id !== id);
  return next.length === list.length ? list : Object.freeze(next);
}

export const serializeHistory = list => JSON.stringify(list);

/** Parse a stored list. Entries that cannot be rebuilt are dropped, and
 *  every kept entry is re-validated (positions clamped, bad fields replaced). */
export function parseHistory(json) {
  let data = null;
  try { data = json ? JSON.parse(json) : null; } catch (e) { data = null; }
  if (!Array.isArray(data)) return Object.freeze([]);
  const seen = new Set();
  const out = [];
  for (const raw of data) {
    const entry = reviveEntry(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return Object.freeze(out.slice(0, HISTORY_MAX));
}

function reviveEntry(raw) {
  if (!raw || typeof raw !== 'object' || !TENTS.includes(raw.tent)) return null;
  if (!isNonEmptyStr(raw.id) || !isStr(raw.name) || !Number.isFinite(raw.savedAt)) return null;
  if (raw.tent === 'B' && raw.charSel === CUSTOM_CHAR && !isNonEmptyStr(raw.customImageId)) return null;
  // withStoredTent clamps / defaults each item; tentToStored strips it back down
  const layout = withStoredTent({}, raw.tent, raw.layout);
  try {
    return makeEntry(
      { tent: raw.tent, bgKey: raw.bgKey, charSel: raw.charSel, name: raw.name, layout, customImageId: raw.customImageId },
      { id: raw.id, now: raw.savedAt, source: SAVE_SOURCES.includes(raw.source) ? raw.source : DEFAULT_SOURCE, thumb: raw.thumb });
  } catch (e) {
    return null;
  }
}

/** The current layout with the entry's tent restored from the snapshot. */
export const entryLayout = (layout, entry) => withStoredTent(layout, entry.tent, entry.layout);

/** Human-readable label for the list. */
export function describeEntry(entry) {
  const title = entry.name.split('\\n').map(s => s.trim()).filter(Boolean).join(' / ') || '(no name)';
  const who = entry.tent === 'A'
    ? BG_LABEL[entry.bgKey]
    : entry.charSel === CUSTOM_CHAR ? 'Custom image' : 'Character ' + (entry.charSel + 1);
  return { title, subtitle: `${TENT_LABEL[entry.tent]} · ${who}` };
}
