#!/usr/bin/env node
/**
 * Build-time inliner.
 *
 * Reads packages/dashboard/src/client/{dashboard.html, dashboard.css, dashboard.js},
 * substitutes the __CSS__ / __JS__ placeholders, and writes
 * packages/dashboard/src/dashboard-html.generated.ts which exports
 * `DASHBOARD_HTML`.
 *
 * Why a generator instead of runtime fs.readFile:
 *   - Single TypeScript module surface for downstream importers (server.ts).
 *   - Avoids __dirname / import.meta.url path fragility under npm publish /
 *     global install / monorepo workspace symlinks.
 *   - Keeps the build deterministic — no runtime asset resolution.
 *
 * Run from the dashboard package root:
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
const outFile = resolve(pkgRoot, 'src', 'dashboard-html.generated.ts');

const html = readFileSync(resolve(clientDir, 'dashboard.html'), 'utf8');
const css = readFileSync(resolve(clientDir, 'dashboard.css'), 'utf8');
const js = readFileSync(resolve(clientDir, 'dashboard.js'), 'utf8');

if (!html.includes('__CSS__')) throw new Error('dashboard.html missing __CSS__ placeholder');
if (!html.includes('__JS__')) throw new Error('dashboard.html missing __JS__ placeholder');

const inlined = html.replace('__CSS__', css).replace('__JS__', js);

// Escape backticks + ${ for a tagged-template-safe string literal.
const escaped = inlined.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const banner = `/**
 * AUTO-GENERATED — do not edit by hand.
 *
 * Source: packages/dashboard/src/client/{dashboard.html, dashboard.css, dashboard.js}
 * Generator: packages/dashboard/scripts/inline-client.mjs
 *
 * Run \`npm run prebuild\` (or any of \`build\` / \`typecheck\`) inside the
 * dashboard package to regenerate. The 3 source files are the editable surface
 * with full HTML / CSS / JS LSP support; this file is the build artifact that
 * server.ts imports to serve at GET /.
 */

export const DASHBOARD_HTML = \`${escaped}\`;
`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, banner, 'utf8');
console.log(`inline-client: wrote ${outFile} (${inlined.length} bytes inlined)`);
