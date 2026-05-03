import { describe, expect, it } from 'vitest';

import { runPersistenceCheck } from './qa-persistence.js';

describe('qa-persistence', () => {
  it('skipped when no profile is set (un-flagged session)', async () => {
    const r = await runPersistenceCheck('/tmp/nonexistent.html');
    expect(r.profile).toBeNull();
    expect(r.status).toBe('skipped');
    expect(r.findings.join(' ')).toMatch(/un-flagged session/);
    expect(r.runtime_ms).toBe(0);
  });

  it('skipped for postgres-anon (deferred to follow-up PR)', async () => {
    const r = await runPersistenceCheck('/tmp/nonexistent.html', 'postgres-anon');
    expect(r.profile).toBe('postgres-anon');
    expect(r.status).toBe('skipped');
    expect(r.findings.join(' ')).toMatch(/not yet integrated/);
  });

  it('skipped for firebase-realtime (P0 deferred)', async () => {
    const r = await runPersistenceCheck('/tmp/nonexistent.html', 'firebase-realtime');
    expect(r.profile).toBe('firebase-realtime');
    expect(r.status).toBe('skipped');
    expect(r.findings.join(' ')).toMatch(/P0-deferred/);
  });

  it('partial for edge-orm (wrangler-on-PATH probe — fast, no network)', async () => {
    // The probe shells out to `which wrangler`. Whether wrangler is installed
    // or not, the result is `partial` (full smoke is deferred). We assert the
    // status, profile, and that findings mention the §1.4 fallback rule.
    const r = await runPersistenceCheck('/tmp/nonexistent.html', 'edge-orm');
    expect(r.profile).toBe('edge-orm');
    expect(r.status).toBe('partial');
    expect(r.findings.join(' ')).toMatch(/§1\.4\.edge-orm/);
  });

  it('local-only with missing artifact still returns a structured result (no throw)', async () => {
    // The local-only path needs Playwright. In environments without Playwright
    // installed (some CI runners), we expect SKIP. With Playwright the page
    // navigation will fail (artifact path missing), bubbling up as `fail`. We
    // accept either since this is environment-dependent — the contract is
    // "always returns, never throws".
    const r = await runPersistenceCheck('/tmp/definitely-missing-artifact.html', 'local-only');
    expect(r.profile).toBe('local-only');
    expect(['ok', 'fail', 'skipped']).toContain(r.status);
    expect(r.findings.length).toBeGreaterThan(0);
    expect(r.runtime_ms).toBeGreaterThanOrEqual(0);
  });
});
