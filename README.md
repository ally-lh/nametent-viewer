# Name Tent Viewer

3D table-tent (name tent) generator + viewer, deployed via GitHub Pages.

- `table-tent.html` — the page: pick a tent style, character and name; the artwork is composed on a 300 dpi canvas, shown on a 3D folded tent (left) and as a flat, unfolded sheet (right), and exported as a print-ready PDF — either **with bleed** (the full 303.35 × 216.35 mm sheet) or **without bleed** (A4 297 × 210 mm, cropped to the trim). In the flat view the bleed is always tinted red with a red cut line at the A4 edge, and the name / character can be dragged into place; "Show bleed on the 3D tent" adds the same tint to the 3D preview only.
- `print-sheet.js` — sheet geometry (A4 + 3.175 mm / 0.125 in bleed on every side at 300 dpi = 3584 × 2556 px; A4 trim 3508 × 2480 px centred at (38, 38)). Pure, no DOM.
- `tent-layout.js` — default positions of the name and character per tent (A4 px, so they are centred on the finished tent, not on the bleed sheet), and the immutable move / scale / reset / parse / serialize helpers. Positions and sizes persist in `localStorage` (`tabletent-layout`).
- `tent-artwork.js` — draws background + character + name onto the sheet canvas and returns where each landed.
- `flat-view.js` — the flat sheet on the right: bleed guide, fold line, hover outlines and drag handling.
- `three-d-stage.js` — 3D stage module (three.js renderer, lighting, orbit controls, OBJ/GLB export)
- `uploads/` — bleed backgrounds (`grungeFBG-bleed.jpg`, `grungeMBG-bleed.jpg`, `ACHNBG-bleed.jpg`, 3584 × 2556 px: the `*-BLEED.pdf` exports rasterised at 300 dpi and centre-cropped to A4 + 3.175 mm), fonts (Rocket Raccoon, pixelmix) and the Tent B character cut-outs
- `tests/` — node tests for the pure modules (`npm test`, needs Node 20+; no dependencies)
- `index.html` — redirects to `table-tent.html`

The bleed PDFs live in `../nametent/` (`grungeFBG-bleed.pdf`, `grungeMBG-BLEED.pdf`, `ANCHT-BLEED.pdf`, exported at 306.07 × 219.46 mm — a little larger than the print sheet, so they are cropped, not scaled). PDF export uses jsPDF, fetched from cdnjs on first use.

## Deploy

Pages serves the `main` branch root. Push to `main` and the site updates automatically.
