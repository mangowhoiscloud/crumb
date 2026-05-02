#!/usr/bin/env node
/**
 * Build-time inliner.
 *
 * Reads packages/studio/src/client/{studio.html, studio.css, studio.js},
 * substitutes the __CSS__ / __JS__ placeholders, and writes
 * packages/studio/src/studio-html.generated.ts which exports
 * `STUDIO_HTML`.
 *
 * Why a generator instead of runtime fs.readFile:
 *   - Single TypeScript module surface for downstream importers (server.ts).
 *   - Avoids __dirname / import.meta.url path fragility under npm publish /
 *     global install / monorepo workspace symlinks.
 *   - Keeps the build deterministic — no runtime asset resolution.
 *
 * Run from the studio package root:
 *   node scripts/inline-client.mjs
 *
 * Wired into the package's `prebuild` and `pretypecheck` npm scripts so the
 * generated file is always fresh before tsc runs.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const clientDir = resolve(pkgRoot, 'src', 'client');
const outFile = resolve(pkgRoot, 'src', 'studio-html.generated.ts');

const html = readFileSync(resolve(clientDir, 'studio.html'), 'utf8');
const css = readFileSync(resolve(clientDir, 'studio.css'), 'utf8');
const js = readFileSync(resolve(clientDir, 'studio.js'), 'utf8');

if (!html.includes('__CSS__')) throw new Error('studio.html missing __CSS__ placeholder');
if (!html.includes('__JS__')) throw new Error('studio.html missing __JS__ placeholder');

// IMPORTANT: pass a *function* replacer to .replace(). The string-replacer
// form interprets $' / $` / $& / $1.. in the replacement, which silently
// mangles any JS containing a literal `'$'` (e.g. `return '$' + cost`):
// the apostrophe-after-dollar becomes the special "portion after the
// matched substring" pattern, splicing trailing HTML (`</script>...`) into
// the middle of studio.js and breaking the entire client.
const inlined = html.replace('__CSS__', () => css).replace('__JS__', () => js);

// Escape backticks + ${ for a tagged-template-safe string literal.
const escaped = inlined.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const banner = `/**
 * AUTO-GENERATED — do not edit by hand.
 *
 * Source: packages/studio/src/client/{studio.html, studio.css, studio.js}
 * Generator: packages/studio/scripts/inline-client.mjs
 *
 * Run \`npm run prebuild\` (or any of \`build\` / \`typecheck\`) inside the
 * studio package to regenerate. The 3 source files are the editable surface
 * with full HTML / CSS / JS LSP support; this file is the build artifact that
 * server.ts imports to serve at GET /.
 */

export const STUDIO_HTML = \`${escaped}\`;
`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, banner, 'utf8');
console.log(`inline-client: wrote ${outFile} (${inlined.length} bytes inlined)`);
