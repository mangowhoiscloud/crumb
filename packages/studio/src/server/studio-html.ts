/**
 * Re-export of the build-time inlined studio HTML.
 *
 * The editable surface lives in three files for full editor LSP / Prettier /
 * eslint coverage:
 *   src/client/studio.html
 *   src/client/studio.css
 *   src/client/studio.js
 *
 * Before each build (`prebuild` script), `scripts/inline-client.mjs` reads
 * those three files and writes `src/studio-html.generated.ts` exporting
 * `STUDIO_HTML`. We re-export that constant here so the rest of the
 * package keeps importing `./studio-html.js` without knowing about the
 * generator.
 */

export { STUDIO_HTML } from './studio-html.generated.js';
