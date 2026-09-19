// Renders page 1 of a PDF to a canvas for preview mode. pdf.js is fetched
// from cdnjs on first use through the page's import map (integrity-pinned
// there, next to three.js); the worker script is loaded by pdf.js itself.
const PDFJS_VERSION = '4.10.38';
export const PDFJS_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`;
export const PDFJS_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;
const MAX_RENDER_PX = 4096; // longest side of the rendered page

/** True for a File / name that looks like a PDF (by MIME type or extension). */
export function isPdfFile(file) {
  if (!file) return false;
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  return type === 'application/pdf' || (!type && name.endsWith('.pdf')) || name.endsWith('.pdf');
}

/** Scale that renders a page (viewport size in pt) at the target width,
 *  capped so the longest side stays under MAX_RENDER_PX. */
export function pdfRenderScale(viewportW, viewportH, targetW, maxPx = MAX_RENDER_PX) {
  if (!(viewportW > 0) || !(viewportH > 0) || !(targetW > 0)) return 1;
  const wanted = targetW / viewportW;
  const cap = maxPx / Math.max(viewportW, viewportH);
  return Math.min(wanted, cap);
}

let pdfjsLoading = null;
function loadPdfJs() {
  if (!pdfjsLoading) {
    pdfjsLoading = import('pdfjs-dist').then(lib => {
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return lib;
    }).catch(err => {
      pdfjsLoading = null;
      throw new Error('could not download the PDF renderer — check your connection (' + (err && err.message ? err.message : err) + ')');
    });
  }
  return pdfjsLoading;
}

/** Render the first page of `file` to a canvas about `targetW` px wide.
 *  Resolves { canvas, pageW, pageH } (page size in pt); rejects with a
 *  user-readable message on any failure. */
export async function renderPdfFirstPage(file, targetW) {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  let doc;
  try {
    doc = await pdfjs.getDocument({ data }).promise;
  } catch (err) {
    throw new Error('this PDF could not be opened' + (err && err.message ? ': ' + err.message : ''));
  }
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: pdfRenderScale(base.width, base.height, targetW) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return { canvas, pageW: base.width, pageH: base.height };
  } finally {
    doc.destroy();
  }
}
