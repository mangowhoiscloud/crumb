/**
 * Re-export of the build-time inlined dashboard HTML.
 *
 * The editable surface lives in three files for full editor LSP / Prettier /
 * eslint coverage:
 *   src/client/dashboard.html
 *   src/client/dashboard.css
 *   src/client/dashboard.js
 *
 * Before each build (`prebuild` script), `scripts/inline-client.mjs` reads
 * those three files and writes `src/dashboard-html.generated.ts` exporting
 * `DASHBOARD_HTML`. We re-export that constant here so the rest of the
 * package keeps importing `./dashboard-html.js` without knowing about the
 * generator.
 */

export { DASHBOARD_HTML } from './dashboard-html.generated.js';
