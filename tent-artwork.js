// Composes one tent (background, character cut-out, name) onto a
// sheet-sized 2D canvas and reports where each movable item landed, in
// sheet px, so the flat view can outline and hit-test it.
import { a4ToSheet } from './print-sheet.js';
import { effectiveItem } from './tent-layout.js';

const MIN_FONT_PX = 40;
const FONT_STEP_PX = 10;
const HIT_PAD = 0.1; // extra grab area around the name, as a fraction of the font size

export const TENT_STYLE = Object.freeze({
  A: Object.freeze({
    font: 'TentFont', ink: '#241c14', lineHeight: 0.95,
    outline: '#f7f2dc', outlineW: 0.16,
    shadow: Object.freeze({ color: 'rgba(20,15,8,0.45)', blur: 18, x: 14, y: 18 }),
  }),
  B: Object.freeze({ font: 'PixelMix', ink: '#111111', lineHeight: 1.25, fauxBoldW: 0.09 }),
});
const CHAR_SHADOW = Object.freeze({ color: 'rgba(30,20,10,0.38)', blur: 34, x: 22, y: 28 });

/** The name field accepts a literal "\n" for a manual line break. */
export const normaliseName = raw => String(raw || '').replace(/\\n/g, '\n').trim();

function applyShadow(ctx, s) {
  ctx.shadowColor = s.color; ctx.shadowBlur = s.blur;
  ctx.shadowOffsetX = s.x; ctx.shadowOffsetY = s.y;
}

function wrapLines(ctx, text, size, maxW, font) {
  ctx.font = `${size}px ${font}`;
  const lines = [];
  for (const seg of text.split('\n')) {
    const words = seg.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width <= maxW) cur = t;
      else { if (cur) lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
  }
  return lines;
}

function fitText(ctx, text, box, font, maxSize, lh) {
  for (let size = maxSize; size >= MIN_FONT_PX; size -= FONT_STEP_PX) {
    const lines = wrapLines(ctx, text, size, box.w, font);
    const lineH = size * lh;
    ctx.font = `${size}px ${font}`;
    const tooWide = lines.some(l => ctx.measureText(l).width > box.w);
    if (!tooWide && lines.length * lineH <= box.h) return { lines, size, lineH };
  }
  return { lines: wrapLines(ctx, text, MIN_FONT_PX, box.w, font), size: MIN_FONT_PX, lineH: MIN_FONT_PX * lh };
}

function measureBlock(ctx, lines, size, lineH, font) {
  ctx.font = `${size}px ${font}`;
  const ms = lines.map(l => ctx.measureText(l));
  const width = Math.max(0, ...ms.map(m => m.width));
  const ascent = ms[0].actualBoundingBoxAscent;
  const descent = ms[ms.length - 1].actualBoundingBoxDescent;
  return { width, ascent, height: (lines.length - 1) * lineH + ascent + descent };
}

/** Draws the name in the box centred on the item's (x, y), each line centred
 *  or flush left per item.align; returns its bounds in sheet px. */
export function drawName(ctx, sheet, item, text, style, opts = {}) {
  if (!text) return null;
  const it = effectiveItem(item);
  const c = a4ToSheet(sheet, it);
  const { lines, size, lineH } = fitText(ctx, text, it, style.font, it.size, style.lineHeight);
  const m = measureBlock(ctx, lines, size, lineH, style.font);
  const firstBase = c.y - m.height / 2 + m.ascent;
  const left = it.align === 'left';
  const anchorX = left ? c.x - it.w / 2 : c.x;
  const each = fn => lines.forEach((l, i) => fn(l, anchorX, firstBase + i * lineH));

  ctx.save();
  ctx.font = `${size}px ${style.font}`;
  ctx.textAlign = left ? 'left' : 'center';
  ctx.textBaseline = 'alphabetic';
  if (style.outline) {
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = size * style.outlineW;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.save();
    applyShadow(ctx, style.shadow);
    each((l, x, y) => ctx.strokeText(l, x, y));
    ctx.restore();
  }
  if (style.fauxBoldW && opts.fauxBold) {
    ctx.strokeStyle = style.ink;
    ctx.lineWidth = size * style.fauxBoldW;
    ctx.lineJoin = 'miter';
    each((l, x, y) => ctx.strokeText(l, x, y));
  }
  ctx.fillStyle = style.ink;
  each((l, x, y) => ctx.fillText(l, x, y));
  ctx.restore();

  const pad = size * HIT_PAD;
  const blockLeft = left ? anchorX : c.x - m.width / 2;
  return { x: blockLeft - pad, y: firstBase - m.ascent - pad, w: m.width + 2 * pad, h: m.height + 2 * pad };
}

/** Draws the cut-out with its bottom centre on the item's (x, y); returns its bounds. */
export function drawCharacter(ctx, sheet, item, img) {
  if (!img) return null;
  const it = effectiveItem(item);
  const s = Math.min(it.maxW / img.width, it.maxH / img.height);
  const w = img.width * s, h = img.height * s;
  const a = a4ToSheet(sheet, it);
  const x = a.x - w / 2, y = a.y - h;
  ctx.save();
  applyShadow(ctx, CHAR_SHADOW);
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
  return { x, y, w, h };
}

/** Full composition. Returns { text, char } bounds (sheet px, or null when absent). */
export function composeTent({ ctx, sheet, tent, background, name, charImg, layout, fauxBold }) {
  const L = layout[tent];
  if (!L) throw new Error(`unknown tent style "${tent}"`);
  ctx.clearRect(0, 0, sheet.w, sheet.h);
  ctx.drawImage(background, 0, 0, sheet.w, sheet.h);
  const char = L.char ? drawCharacter(ctx, sheet, L.char, charImg) : null;
  const text = drawName(ctx, sheet, L.text, normaliseName(name), TENT_STYLE[tent], { fauxBold });
  return { text, char };
}
