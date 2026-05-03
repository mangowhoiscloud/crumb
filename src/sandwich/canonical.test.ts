/**
 * Byte-identical sandwich CI gate (W2). Tests assert the canonical-assembled
 * sandwich for each actor matches the SHA-256 locked in
 * `protocol/sandwich-canonical-hashes.json`. A drift means the prompt cache
 * for that actor will miss on the next session — either intentionally
 * (regenerate the lock with `npm run sandwich:update-hashes`) or
 * accidentally (revert the offending edit).
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalSandwichHash, ACTORS_WITH_CANONICAL_SANDWICH } from './canonical.js';

// Walk up from the compiled module to the repo root (tsconfig + AGENTS.md
// markers). Mirrors `inferRepoRoot()` in src/cli.ts so the test works under
// both `tsx` and `tsc` build outputs.
function inferRepoRoot(): string {
  const here = fileURLToPath(import.meta.url);
  let dir = resolve(here, '..', '..', '..');
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'AGENTS.md')) && existsSync(resolve(dir, 'agents'))) {
      return dir;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('inferRepoRoot: AGENTS.md not found walking up from canonical.test.ts');
}

const repoRoot = inferRepoRoot();
const lockPath = resolve(repoRoot, 'protocol', 'sandwich-canonical-hashes.json');

interface SandwichLock {
  schema_version: 1;
  comment?: string;
  actors: Record<string, string>;
}

function readLock(): SandwichLock {
  return JSON.parse(readFileSync(lockPath, 'utf-8')) as SandwichLock;
}

describe('canonical sandwich byte-identical CI gate (W2)', () => {
  it('lock file exists at protocol/sandwich-canonical-hashes.json', () => {
    expect(existsSync(lockPath)).toBe(true);
  });

  it('lock file declares schema_version: 1', () => {
    const lock = readLock();
    expect(lock.schema_version).toBe(1);
  });

  it('lock covers every actor in ACTORS_WITH_CANONICAL_SANDWICH', () => {
    const lock = readLock();
    const expected = new Set(ACTORS_WITH_CANONICAL_SANDWICH);
    const actual = new Set(Object.keys(lock.actors));
    expect(actual).toEqual(expected);
  });

  it.each(ACTORS_WITH_CANONICAL_SANDWICH)(
    'hash for actor "%s" matches lock (cache-discipline gate)',
    async (actor) => {
      const lock = readLock();
      const expected = lock.actors[actor];
      expect(expected).toBeDefined();
      expect(expected).toMatch(/^[a-f0-9]{64}$/);

      const actual = await canonicalSandwichHash(repoRoot, actor);
      if (actual !== expected) {
        throw new Error(
          `Sandwich drift detected for actor "${actor}".\n` +
            `  expected: ${expected}\n` +
            `  actual:   ${actual}\n` +
            `\n` +
            `If this change is intentional (you edited a sandwich .md or an\n` +
            `inlined skill/specialist), regenerate the lock:\n` +
            `  npm run sandwich:update-hashes\n` +
            `Then re-commit. Anthropic prompt cache is content-addressed —\n` +
            `every dependent cache entry will miss on the next session.`,
        );
      }
      expect(actual).toBe(expected);
    },
  );
});
