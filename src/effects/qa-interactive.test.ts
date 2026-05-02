/**
 * qa-interactive — AC predicate runner unit tests.
 *
 * Real Chromium smokes (boot + interaction) are validated by integration runs
 * against actual builder artifacts (and indirectly by qa-check.test.ts on the
 * playwright-detection contract). These unit tests cover the deterministic
 * edge case that doesn't need a browser:
 *
 *   1. Empty predicate list → returns 0/0 immediately, no browser launch.
 */

import { describe, expect, it } from 'vitest';

import { runACInteractive } from './qa-interactive.js';

describe('runACInteractive — short-circuit paths', () => {
  it('returns empty result when no predicates given (no browser launch)', async () => {
    const r = await runACInteractive('/nonexistent/game.html', []);
    expect(r.total).toBe(0);
    expect(r.passed).toBe(0);
    expect(r.results).toEqual([]);
  });
});
