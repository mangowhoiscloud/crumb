/**
 * qa-runner timeout regression — guards against the hung-Playwright scenario
 * observed in session 01KQNAK1 (2 builds → 0 qa.results before wall_clock cap).
 *
 * Strategy: vi.mock `../effects/qa-check.js` so `runQaCheck` returns a Promise
 * that never resolves. With the timeout in place, runQaCheckEffect must emit
 * a FAIL qa.result within the timeout window and the writer.append call must
 * carry `exec_exit_code: 2` + lint_findings explaining the timeout.
 */

import { describe, expect, it, vi } from 'vitest';

import type { QaCheckEffect } from '../effects/types.js';

const noopAppend = vi.fn();

class StubWriter {
  append = noopAppend;
}

describe('runQaCheckEffect timeout', () => {
  it('emits FAIL qa.result when runQaCheck hangs past timeout', async () => {
    vi.resetModules();
    vi.doMock('../effects/qa-check.js', () => ({
      runQaCheck: () => new Promise(() => {}), // never resolves
    }));
    process.env.CRUMB_QA_CHECK_TIMEOUT_MS = '120';
    const append = vi.fn();
    const { runQaCheckEffect } = await import('./qa-runner.js');

    const effect: QaCheckEffect = {
      type: 'qa_check',
      artifact: 'artifacts/game.html',
      build_event_id: '01HBUILD',
      artifact_sha256: 'sha-stub',
    };

    const t0 = Date.now();
    await runQaCheckEffect(effect, {
      writer: { append } as unknown as StubWriter as never,
      sessionId: 'sess-qa-timeout',
      sessionDir: '/tmp/sess-qa-timeout',
    });
    const elapsed = Date.now() - t0;

    expect(append).toHaveBeenCalledTimes(1);
    const msg = append.mock.calls[0]![0] as Record<string, unknown>;
    expect(msg.kind).toBe('qa.result');
    expect((msg.data as Record<string, unknown>).exec_exit_code).toBe(2);
    const findings = (msg.data as Record<string, unknown>).lint_findings as string[];
    expect(findings.some((f) => /timeout|exceeded|hung/i.test(f))).toBe(true);
    // Must complete shortly after the 120ms timeout — not hang indefinitely.
    expect(elapsed).toBeLessThan(2000);
    expect(elapsed).toBeGreaterThanOrEqual(100);

    delete process.env.CRUMB_QA_CHECK_TIMEOUT_MS;
    vi.doUnmock('../effects/qa-check.js');
    vi.resetModules();
  }, 5000);

  it('passes through the normal qa-check result when it returns in time', async () => {
    vi.resetModules();
    vi.doMock('../effects/qa-check.js', () => ({
      runQaCheck: async () => ({
        lint_passed: true,
        exec_exit_code: 0,
        phaser_loaded: true,
        first_interaction: 'ok',
        artifact_sha256: 'sha-real',
        runtime_ms: 42,
        cross_browser_smoke: 'ok',
        loc_own_bytes: 1234,
        lint_findings: [],
      }),
    }));
    const append = vi.fn();
    const { runQaCheckEffect } = await import('./qa-runner.js');

    const effect: QaCheckEffect = {
      type: 'qa_check',
      artifact: 'artifacts/game.html',
      build_event_id: '01HBUILD',
      artifact_sha256: 'sha-real',
    };
    await runQaCheckEffect(effect, {
      writer: { append } as unknown as StubWriter as never,
      sessionId: 'sess-qa-passthrough',
      sessionDir: '/tmp/sess-qa-passthrough',
    });

    expect(append).toHaveBeenCalledTimes(1);
    const msg = append.mock.calls[0]![0] as Record<string, unknown>;
    expect((msg.data as Record<string, unknown>).exec_exit_code).toBe(0);
    expect(msg.body).toMatch(/qa-check PASS/);

    vi.doUnmock('../effects/qa-check.js');
    vi.resetModules();
  });
});
