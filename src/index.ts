#!/usr/bin/env node
/**
 * Crumb CLI entry — multi-agent execution harness.
 * See README.md for usage and design/DESIGN.md for the binding game spec.
 */

import { main } from './cli.js';

main(process.argv.slice(2)).catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[crumb] fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
