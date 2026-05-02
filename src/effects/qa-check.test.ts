/**
 * qa-check tests — exec_exit_code logic + Playwright detection contract.
 *
 * Frontier backing (P0-2): wiki/synthesis/bagelcode-scoring-ratchet-frontier-2026-05-02.md §7.
 */

import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runQaCheck } from './qa-check.js';

const VALID_HTML = `<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width"></head>
<body>
<script src="https://cdn.jsdelivr.net/npm/phaser@3.80.0/dist/phaser.min.js"></script>
<script>
  // game logic
  console.log('boot');
</script>
</body>
</html>`;

let tmp: string;
let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'crumb-qa-'));
  savedEnv = { ...process.env };
  delete process.env.CRUMB_QA_REQUIRE_PLAYWRIGHT;
  delete process.env.CRUMB_QA_PLAYWRIGHT_OPTIONAL;
  vi.resetModules();
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
  process.env = savedEnv;
  vi.unstubAllGlobals();
  vi.doUnmock('./qa-check-playwright.js');
});

describe('runQaCheck — mock fixture vs missing artifact', () => {
  it('returns deterministic pass for .mock.html paths (fixture path)', async () => {
    const r = await runQaCheck('/nonexistent/foo.mock.html');
    expect(r.exec_exit_code).toBe(0);
    expect(r.lint_passed).toBe(true);
    expect(r.first_interaction).toBe('skipped');
    expect(r.cross_browser_smoke).toBe('skipped');
  });

  it('FAILs hard when a real-path artifact is missing (builder crashed)', async () => {
    // v3.4 anti-deception split — a missing artifact at a non-fixture path
    // means the builder spawn failed before writing the game; we must NOT
    // reward that with a phantom PASS. D2 ground truth must collapse to 0.
    const r = await runQaCheck('/nonexistent/path/game.html');
    expect(r.exec_exit_code).toBe(1);
    expect(r.lint_passed).toBe(false);
    expect(r.first_interaction).toBe('fail');
    expect(r.cross_browser_smoke).toBe('fail');
    expect(r.lint_findings.some((f) => f.includes('artifact_missing'))).toBe(true);
  });
});

describe('runQaCheck — lint + size on real artifact', () => {
  it('PASSes a valid Phaser HTML when Playwright unavailable (default mode)', async () => {
    const path = join(tmp, 'game.html');
    writeFileSync(path, VALID_HTML);
    const r = await runQaCheck(path);
    // Default: missing Playwright → finding emitted but exec doesn't fail.
    expect(r.lint_passed).toBe(true);
    expect(r.exec_exit_code).toBe(0);
    expect(r.first_interaction).toBe('skipped');
    expect(r.lint_findings.some((f) => /playwright not installed/i.test(f))).toBe(true);
  });

  it('FAILs when DOCTYPE / viewport / phaser script all missing', async () => {
    const path = join(tmp, 'game.html');
    writeFileSync(path, '<html><body>nothing here</body></html>');
    const r = await runQaCheck(path);
    expect(r.lint_passed).toBe(false);
    expect(r.exec_exit_code).toBe(1);
    expect(r.lint_findings.length).toBeGreaterThanOrEqual(3);
  });

  it('FAILs when own-code exceeds 60KB', async () => {
    const path = join(tmp, 'game.html');
    const padding = 'x'.repeat(61_000);
    writeFileSync(path, VALID_HTML.replace('// game logic', `// ${padding}`));
    const r = await runQaCheck(path);
    expect(r.exec_exit_code).toBe(1);
    expect(r.lint_findings.some((f) => /60000 bytes/.test(f))).toBe(true);
  });
});

describe('runQaCheck — Playwright detection contract', () => {
  it('CRUMB_QA_REQUIRE_PLAYWRIGHT=1 + Playwright missing → exec_exit_code=1', async () => {
    process.env.CRUMB_QA_REQUIRE_PLAYWRIGHT = '1';
    const path = join(tmp, 'game.html');
    writeFileSync(path, VALID_HTML);
    const r = await runQaCheck(path);
    expect(r.exec_exit_code).toBe(1);
    expect(r.first_interaction).toBe('fail');
    expect(r.lint_findings.some((f) => /CRUMB_QA_REQUIRE_PLAYWRIGHT.*not installed/i.test(f))).toBe(
      true,
    );
  });

  it('CRUMB_QA_PLAYWRIGHT_OPTIONAL=1 → silent skip (no warning, no fail)', async () => {
    process.env.CRUMB_QA_PLAYWRIGHT_OPTIONAL = '1';
    const path = join(tmp, 'game.html');
    writeFileSync(path, VALID_HTML);
    const r = await runQaCheck(path);
    expect(r.exec_exit_code).toBe(0);
    expect(r.first_interaction).toBe('skipped');
    expect(r.lint_findings.some((f) => /playwright/i.test(f))).toBe(false);
  });

  it('Playwright smoke success → first_interaction=ok + cross_browser_smoke=ok', async () => {
    vi.doMock('./qa-check-playwright.js', () => ({
      runPlaywrightSmoke: vi.fn().mockResolvedValue({ firstInteraction: 'ok', crossBrowser: 'ok' }),
    }));
    const { runQaCheck: rerunQaCheck } = await import('./qa-check.js');
    const path = join(tmp, 'game.html');
    writeFileSync(path, VALID_HTML);
    const r = await rerunQaCheck(path);
    expect(r.exec_exit_code).toBe(0);
    expect(r.first_interaction).toBe('ok');
    expect(r.cross_browser_smoke).toBe('ok');
    expect(r.lint_findings.some((f) => /playwright/i.test(f))).toBe(false);
  });

  it('Playwright smoke fail → first_interaction=fail + exec_exit_code=1', async () => {
    vi.doMock('./qa-check-playwright.js', () => ({
      runPlaywrightSmoke: vi.fn().mockResolvedValue({
        firstInteraction: 'fail',
        crossBrowser: 'fail',
        reason: 'no canvas rendered within 5000ms',
      }),
    }));
    const { runQaCheck: rerunQaCheck } = await import('./qa-check.js');
    const path = join(tmp, 'game.html');
    writeFileSync(path, VALID_HTML);
    const r = await rerunQaCheck(path);
    expect(r.exec_exit_code).toBe(1);
    expect(r.first_interaction).toBe('fail');
    expect(r.lint_findings.some((f) => /smoke failed.*canvas/i.test(f))).toBe(true);
  });

  it('Playwright runtime error (not missing-dep) → fail with reason', async () => {
    vi.doMock('./qa-check-playwright.js', () => ({
      runPlaywrightSmoke: vi.fn().mockRejectedValue(new Error('chromium binary not found')),
    }));
    const { runQaCheck: rerunQaCheck } = await import('./qa-check.js');
    const path = join(tmp, 'game.html');
    writeFileSync(path, VALID_HTML);
    const r = await rerunQaCheck(path);
    expect(r.exec_exit_code).toBe(1);
    expect(r.first_interaction).toBe('fail');
    expect(r.lint_findings.some((f) => /smoke errored.*chromium binary/i.test(f))).toBe(true);
  });
});
