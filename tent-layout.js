// Where the movable pieces (name, character) sit on each tent, and the
// pure updates the UI applies to them. Every update returns a new layout
// object; nothing is mutated.
//
// Positions are A4 px (300 dpi, relative to the trim's top-left), so they
// are centred on the finished A4 tent rather than on the bleed sheet.
//   text: x,y = centre of the box the name is fitted into; w,h = that box;
//         size = largest font size tried before shrinking to fit.
//   char: x,y = bottom-centre anchor; maxW,maxH = fit box for the cut-out.
//   scale multiplies the box / font / fit sizes (1 = as designed).
//   align (text only): 'center' centres each line on x; 'left' starts each
//         line at the box's left edge (x - w/2).
import { A4_MM, mmToPx } from './print-sheet.js';

export const DEFAULT_LAYOUT = Object.freeze({
  A: Object.freeze({
    text: Object.freeze({ x: 2272, y: 2000, w: 1880, h: 920, size: 900, scale: 1, align: 'center' }),
  }),
  B: Object.freeze({
    text: Object.freeze({ x: 1971, y: 1864, w: 1470, h: 400, size: 340, scale: 1, align: 'center' }),
    char: Object.freeze({ x: 714, y: 2560, maxW: 950, maxH: 1330, scale: 1 }),
  }),
});
export const SCALE_RANGE = Object.freeze({ min: 0.5, max: 1.6 });
export const TEXT_ALIGNS = Object.freeze(['left', 'center']);

const A4_PX = Object.freeze({ w: mmToPx(A4_MM.w), h: mmToPx(A4_MM.h) });
const POS_MARGIN_PX = mmToPx(60); // how far off the page an item may be dragged
const SCALED_FIELDS = ['w', 'h', 'size', 'maxW', 'maxH'];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const deepFreeze = o => { Object.values(o).forEach(v => { if (v && typeof v === 'object') deepFreeze(v); }); return Object.freeze(o); };
const isNum = v => typeof v === 'number' && Number.isFinite(v);

/** The item with its scale applied to every size field. */
export function effectiveItem(item) {
  const s = isNum(item.scale) ? item.scale : 1;
  const scaled = Object.fromEntries(SCALED_FIELDS.filter(k => isNum(item[k])).map(k => [k, item[k] * s]));
  return { ...item, ...scaled };
}

function updateItem(layout, tent, key, patch) {
  const t = layout[tent];
  if (!t || !t[key]) return layout;
  return { ...layout, [tent]: { ...t, [key]: { ...t[key], ...patch } } };
}

export function moveItem(layout, tent, key, dx, dy) {
  const it = layout[tent] && layout[tent][key];
  if (!it || !isNum(dx) || !isNum(dy)) return layout;
  return updateItem(layout, tent, key, {
    x: clamp(it.x + dx, -POS_MARGIN_PX, A4_PX.w + POS_MARGIN_PX),
    y: clamp(it.y + dy, -POS_MARGIN_PX, A4_PX.h + POS_MARGIN_PX),
  });
}

export function scaleItem(layout, tent, key, scale) {
  if (!isNum(scale)) return layout;
  return updateItem(layout, tent, key, { scale: clamp(scale, SCALE_RANGE.min, SCALE_RANGE.max) });
}

export function alignItem(layout, tent, key, align) {
  const it = layout[tent] && layout[tent][key];
  if (!it || it.align === undefined || !TEXT_ALIGNS.includes(align)) return layout;
  return updateItem(layout, tent, key, { align });
}

export function resetTent(layout, tent) {
  return DEFAULT_LAYOUT[tent] ? { ...layout, [tent]: DEFAULT_LAYOUT[tent] } : layout;
}

/** Only the user-adjustable fields are stored, so improved defaults for
 *  box sizes still apply after an update. */
export function serializeLayout(layout) {
  const out = {};
  for (const tent of Object.keys(DEFAULT_LAYOUT)) {
    out[tent] = {};
    for (const key of Object.keys(DEFAULT_LAYOUT[tent])) {
      const { x, y, scale, align } = layout[tent][key];
      out[tent][key] = align === undefined ? { x, y, scale } : { x, y, scale, align };
    }
  }
  return JSON.stringify(out);
}

/** Parse a stored layout. Anything missing or malformed falls back to the
 *  default for that item, so a bad localStorage value can never break the page. */
export function parseLayout(json) {
  let data = null;
  try { data = json ? JSON.parse(json) : null; } catch (e) { data = null; }
  const out = {};
  for (const tent of Object.keys(DEFAULT_LAYOUT)) {
    out[tent] = {};
    for (const key of Object.keys(DEFAULT_LAYOUT[tent])) {
      const def = DEFAULT_LAYOUT[tent][key];
      const got = data && data[tent] && data[tent][key];
      out[tent][key] = validStoredItem(got) ? applyStored(def, got) : def;
    }
  }
  return deepFreeze(out);
}

function validStoredItem(got) {
  return !!got && typeof got === 'object' && isNum(got.x) && isNum(got.y)
    && (got.scale === undefined || isNum(got.scale));
}

function applyStored(def, got) {
  return {
    ...def,
    x: clamp(got.x, -POS_MARGIN_PX, A4_PX.w + POS_MARGIN_PX),
    y: clamp(got.y, -POS_MARGIN_PX, A4_PX.h + POS_MARGIN_PX),
    scale: clamp(got.scale === undefined ? 1 : got.scale, SCALE_RANGE.min, SCALE_RANGE.max),
    ...(def.align !== undefined && TEXT_ALIGNS.includes(got.align) ? { align: got.align } : {}),
  };
}
