#!/usr/bin/env node
/**
 * Regenerate `protocol/sandwich-canonical-hashes.json` after an intentional
 * sandwich / skill / specialist edit. Invoked via `npm run sandwich:update-hashes`.
 *
 * Backed by the W2 byte-identical CI gate (see `src/sandwich/canonical.ts`).
 */
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canonicalSandwichHash,
  ACTORS_WITH_CANONICAL_SANDWICH,
} from '../src/sandwich/canonical.ts';

const here = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(here), '..');
const lockPath = resolve(repoRoot, 'protocol', 'sandwich-canonical-hashes.json');

const actors = {};
for (const actor of ACTORS_WITH_CANONICAL_SANDWICH) {
  actors[actor] = await canonicalSandwichHash(repoRoot, actor);
}
const lock = {
  schema_version: 1,
  comment:
    'Byte-identical sandwich SHA-256 lock (W2 CI gate). Regenerate via `npm run sandwich:update-hashes` when a sandwich .md or any inlined skill/specialist .md changes intentionally. Anthropic prompt cache is content-addressed; one whitespace change invalidates every dependent cache entry — keep edits deliberate.',
  actors,
};
await writeFile(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf-8');
// eslint-disable-next-line no-console
console.log(`wrote ${lockPath}`);
for (const [a, h] of Object.entries(actors)) {
  // eslint-disable-next-line no-console
  console.log(`  ${a.padEnd(14)}  ${h}`);
}
