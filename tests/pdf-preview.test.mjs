import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPdfFile, pdfRenderScale, PDFJS_URL, PDFJS_WORKER_URL } from '../pdf-preview.js';

test('isPdfFile checks MIME type and extension', () => {
  assert.equal(isPdfFile({ type: 'application/pdf', name: 'x' }), true);
  assert.equal(isPdfFile({ type: '', name: 'Export.PDF' }), true);
  assert.equal(isPdfFile({ type: 'image/png', name: 'a.png' }), false);
  assert.equal(isPdfFile(null), false);
});

test('pdfRenderScale hits the target width but caps the longest side', () => {
  assert.ok(Math.abs(pdfRenderScale(867.6, 622.08, 3584) - 3584 / 867.6) < 1e-12);
  assert.ok(Math.abs(pdfRenderScale(867.6, 622.08, 100000) - 4096 / 867.6) < 1e-12);
  assert.ok(Math.abs(pdfRenderScale(600, 900, 3584) - 4096 / 900) < 1e-12); // portrait: height is the long side
  assert.equal(pdfRenderScale(0, 0, 100), 1);
});

test('pdf.js is pinned to one version on cdnjs', () => {
  assert.match(PDFJS_URL, /^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/pdf\.js\/\d+\.\d+\.\d+\/pdf\.min\.mjs$/);
  assert.equal(PDFJS_WORKER_URL.replace('pdf.worker.min.mjs', 'pdf.min.mjs'), PDFJS_URL);
});
