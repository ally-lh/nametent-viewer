// Flat 2D view of the whole print sheet (both faces, unfolded) with the
// bleed marked in red, and drag handling for the movable items.
//
// The host owns the composition: it passes the clean sheet canvas as
// `source`, tells the view where the items are after every redraw
// (setItems), and applies drags through onDragMove / onDragEnd.
import { fitSheet, bleedRects, rectContains } from './print-sheet.js';

const GUIDE = Object.freeze({
  bleedTint: 'rgba(220, 40, 40, 0.30)',
  cutLine: '#d42828', cutLineW: 3,
  foldLine: 'rgba(20, 20, 19, 0.55)', foldDash: [16, 12],
  itemIdle: 'rgba(30, 110, 220, 0.55)', itemActive: 'rgba(30, 110, 220, 1)', itemDash: [12, 8],
});
const ITEM_ORDER = ['text', 'char']; // topmost first, for hit-testing
const MAX_DPR = 3;

export function createFlatView({ canvas, sheet, source, onDragMove, onDragEnd }) {
  const ctx = canvas.getContext('2d');
  let items = {};
  let hover = null;
  let drag = null;
  let dpr = 1;
  let fit = fitSheet(sheet, 1, 1);

  const setCursor = () => { canvas.style.cursor = drag ? 'grabbing' : hover ? 'grab' : 'default'; };

  function toSheet(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left - fit.x) / fit.scale, y: (e.clientY - r.top - fit.y) / fit.scale };
  }
  const hitTest = p => ITEM_ORDER.find(k => rectContains(items[k], p)) || null;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    fit = fitSheet(sheet, w, h);
    draw();
  }

  function draw() {
    const px = 1 / fit.scale; // one screen pixel, in sheet units
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.save();
    ctx.translate(fit.x, fit.y);
    ctx.scale(fit.scale, fit.scale);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0);
    drawBleedGuide(px);
    drawItems(px);
    ctx.restore();
  }

  function drawBleedGuide(px) {
    ctx.fillStyle = GUIDE.bleedTint;
    bleedRects(sheet).forEach(r => ctx.fillRect(r.x, r.y, r.w, r.h));
    const t = sheet.trim;
    ctx.setLineDash([]);
    ctx.strokeStyle = GUIDE.cutLine;
    ctx.lineWidth = GUIDE.cutLineW * px;
    ctx.strokeRect(t.x, t.y, t.w, t.h);
    ctx.setLineDash(GUIDE.foldDash.map(d => d * px));
    ctx.strokeStyle = GUIDE.foldLine;
    ctx.lineWidth = 1.5 * px;
    ctx.beginPath();
    ctx.moveTo(t.x, sheet.h / 2);
    ctx.lineTo(t.x + t.w, sheet.h / 2);
    ctx.stroke();
  }

  function drawItems(px) {
    ctx.setLineDash(GUIDE.itemDash.map(d => d * px));
    for (const k of ITEM_ORDER) {
      const r = items[k];
      if (!r) continue;
      const on = drag ? drag.key === k : hover === k;
      ctx.strokeStyle = on ? GUIDE.itemActive : GUIDE.itemIdle;
      ctx.lineWidth = (on ? 2.5 : 1.5) * px;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }
  }

  function onDown(e) {
    if (e.button !== 0 || drag) return; // one drag at a time: a second finger must not steal it
    const p = toSheet(e);
    const key = hitTest(p);
    if (!key) return;
    drag = { key, last: p, pointerId: e.pointerId };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or already-released pointer: drag still works while the cursor stays on the canvas */ }
    e.preventDefault();
    setCursor();
    draw();
  }
  function onMove(e) {
    const p = toSheet(e);
    if (drag) {
      if (e.pointerId !== drag.pointerId) return;
      onDragMove(drag.key, p.x - drag.last.x, p.y - drag.last.y);
      drag = { ...drag, last: p };
      return;
    }
    const h = hitTest(p);
    if (h !== hover) { hover = h; setCursor(); draw(); }
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const key = drag.key;
    drag = null;
    hover = hitTest(toSheet(e));
    setCursor();
    draw();
    onDragEnd(key);
  }
  function onLeave() {
    if (drag || hover === null) return;
    hover = null; setCursor(); draw();
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  return {
    /** Item bounds in sheet px, keyed 'text' / 'char' (null = not drawn). */
    setItems(next) { items = { ...next }; draw(); },
    draw,
    resize,
    isDragging: () => drag !== null,
    destroy() {
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
    },
  };
}
