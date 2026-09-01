# Name Tent Viewer

3D table-tent (name tent) generator + viewer, deployed via GitHub Pages.

- `table-tent.html` — the page: pick a tent style, character and name; the artwork is composed on a 300 dpi canvas, wrapped onto a 3D folded tent, and exported as a print-ready PDF — either **with bleed** (the full 306 × 216 mm sheet) or **without bleed** (A4 297 × 210 mm, cropped to the trim). "Show bleed area" tints everything outside the A4 trim red in the 3D preview only.
- `three-d-stage.js` — 3D stage module (three.js renderer, lighting, orbit controls, OBJ/GLB export)
- `uploads/` — bleed backgrounds (`grungeFBG-bleed.jpg`, `grungeMBG-bleed.jpg`, `ACHNBG-bleed.jpg`, 3615 × 2556 px rasterised from the `*-BLEED.pdf` exports at 300 dpi), fonts (Rocket Raccoon, pixelmix) and the Tent B character cut-outs
- `index.html` — redirects to `table-tent.html`

Source of truth for the page is the Claude Design project; the bleed PDFs live in `../` (`grungeFBG-BLEED.pdf`, `grungeMBG-Bleed.pdf`, `ANCHTBG-BLEED.pdf`). PDF export uses jsPDF, fetched from cdnjs on first use.

## Deploy

Pages serves the `main` branch root. Push to `main` and the site updates automatically.
