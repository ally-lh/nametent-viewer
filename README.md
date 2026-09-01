# Name Tent Viewer

3D table-tent (name tent) generator + viewer, deployed via GitHub Pages.

- `table-tent.html` — the page: pick a tent style, character and name; the A4 artwork is composed on a canvas, wrapped onto a 3D folded tent, and downloadable as a print-ready PNG (3508×2481)
- `three-d-stage.js` — 3D stage module (three.js renderer, lighting, orbit controls, OBJ/GLB export)
- `uploads/` — backgrounds (`grungeFBG.png`, `grungeMBG.png`, `ACHNBG.png`), fonts (Rocket Raccoon, pixelmix) and the Tent B character cut-outs
- `index.html` — redirects to `table-tent.html`

Source of truth for the page is the Claude Design project; assets originate in `../nametent/Showcase/`.

## Deploy

Pages serves the `main` branch root. Push to `main` and the site updates automatically.
