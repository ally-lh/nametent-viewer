// Print-sheet geometry (pure, no DOM — shared with the node tests).
//
// The sheet the shop prints is A4 plus a uniform bleed on every side,
// rasterised at 300 dpi. "Sheet px" are pixels on that sheet; "A4 px" are
// relative to the trim's top-left corner, so anything positioned in A4 px
// stays anchored to the finished tent no matter how wide the bleed is.
export const DPI = 300;
export const PX_PER_MM = DPI / 25.4;
export const A4_MM = Object.freeze({ w: 297, h: 210 });
export const BLEED_MM = 3.175; // 0.125 in on every side

export const mmToPx = mm => Math.round(mm * PX_PER_MM);

/** Sheet = A4 + bleed. 303.35 x 216.35 mm -> 3584 x 2556 px; trim 3508 x 2480 px at (38, 38). */
export function makeSheet(a4Mm = A4_MM, bleedMm = BLEED_MM) {
  const trimW = mmToPx(a4Mm.w), trimH = mmToPx(a4Mm.h), bleed = mmToPx(bleedMm);
  return Object.freeze({
    wMm: a4Mm.w + 2 * bleedMm,
    hMm: a4Mm.h + 2 * bleedMm,
    trimWMm: a4Mm.w,
    trimHMm: a4Mm.h,
    bleedMm,
    w: trimW + 2 * bleed,
    h: trimH + 2 * bleed,
    trim: Object.freeze({ x: bleed, y: bleed, w: trimW, h: trimH }),
  });
}

export const a4ToSheet = (sheet, p) => ({ x: p.x + sheet.trim.x, y: p.y + sheet.trim.y });
export const sheetToA4 = (sheet, p) => ({ x: p.x - sheet.trim.x, y: p.y - sheet.trim.y });

export const rectContains = (r, p) =>
  !!r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/** The bleed margins as four rects (top, bottom, left, right) around the trim. */
export function bleedRects(sheet) {
  const { trim: t, w, h } = sheet;
  return [
    { x: 0, y: 0, w, h: t.y },
    { x: 0, y: t.y + t.h, w, h: h - t.y - t.h },
    { x: 0, y: t.y, w: t.x, h: t.h },
    { x: t.x + t.w, y: t.y, w: w - t.x - t.w, h: t.h },
  ];
}

/** Uniform scale and offset that fit the whole sheet inside a box, centred. */
export function fitSheet(sheet, boxW, boxH) {
  const scale = Math.min(boxW / sheet.w, boxH / sheet.h);
  const w = sheet.w * scale, h = sheet.h * scale;
  return { scale, x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
}

/** How far an image's aspect ratio is from the sheet's, as a fraction
 *  (0 = identical). Used to warn before a preview file is stretched. */
export function ratioMismatch(sheet, imgW, imgH) {
  if (!(imgW > 0) || !(imgH > 0)) return NaN;
  return Math.abs((imgW / imgH) / (sheet.w / sheet.h) - 1);
}

/** "303.35 × 216.35 mm" style label, trailing zeros trimmed. */
export const mmLabel = (w, h) => `${trimNum(w)} × ${trimNum(h)} mm`;
const trimNum = n => String(Math.round(n * 100) / 100);
