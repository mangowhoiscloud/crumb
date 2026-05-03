#!/usr/bin/env node
/**
 * Crumb CLI entry — multi-agent execution harness.
 * See README.md for usage and design/DESIGN.md for the binding game spec.
 */

import { main } from './cli.js';

// Node engine guard — fail with a clear hint instead of an opaque syntax /
// runtime error when invoked under a too-old Node (e.g. system Node 14 on
// macOS, or Debian-shipped 16). Mirrors the n8n bin pattern. Keep cheap and
// dependency-free so it runs before any heavy import work begins.
const minMajor = 18;
const currentMajor = Number(process.versions.node.split('.')[0]);
if (Number.isFinite(currentMajor) && currentMajor < minMajor) {
  // eslint-disable-next-line no-console
  console.error(
    `[crumb] Node.js ${process.versions.node} is too old. Crumb requires Node ${minMajor}+.\n` +
      `        Install via nvm (https://github.com/nvm-sh/nvm) or your OS package manager.`,
  );
  process.exit(1);
}

main(process.argv.slice(2)).catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[crumb] fatal:', err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) {
    // eslint-disable-next-line no-console
    console.error(err.stack);
  }
  process.exit(1);
});
