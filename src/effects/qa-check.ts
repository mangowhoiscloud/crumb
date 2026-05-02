/**
 * qa-check — deterministic ground-truth quality check for builder artifacts.
 *
 * No LLM call. Runs:
 *   1. HTML lint (DOCTYPE / viewport meta / script tag) — built-in regex parser, no dep
 *   2. file size check (≤60KB own code constraint)
 *   3. Phaser CDN reference check (script tag pattern)
 *   4. Playwright headless smoke (auto-detect — runs when `playwright` is installed)
 *   5. Cross-browser portability (single-browser chromium smoke as P0 ground truth)
 *
 * Output: QaResult — fed back to transcript as kind=qa.result with metadata.deterministic=true.
 *
 * Pattern: AutoGen Executor (57.6k⭐). See [[bagelcode-system-architecture-v3]] §7.
 * Sister: skills/verification-before-completion.md (verifier reads qa.result as D2 ground truth).
 *
 * Frontier backing (P0-2 of `wiki/synthesis/bagelcode-scoring-ratchet-frontier-2026-05-02.md`):
 * SWE-bench Verified 2025 top10 / Cognition Devin "Don't Build Multi-Agents" Jun 2025 /
 * DeepSeek-R1 Jan 2025 — all converge on rule-based exec gate as the strongest D2 signal.
 *
 * Playwright detection contract:
 *   - Auto-detected via dynamic import. Install locally with:
 *       npm i -D playwright && npx playwright install chromium
 *   - When installed and smoke run succeeds → `first_interaction='ok'`, `cross_browser_smoke='ok'`.
 *   - When installed and smoke run fails → `first_interaction='fail'`, `exec_exit_code=1`.
 *   - When NOT installed (default behavior):
 *       `first_interaction='skipped'`, lint_findings includes guidance, `exec_exit_code` unchanged.
 *   - When `CRUMB_QA_REQUIRE_PLAYWRIGHT=1` is set and Playwright is missing →
 *       `first_interaction='fail'`, `exec_exit_code=1` (strict gate; recommended for CI).
 *   - When `CRUMB_QA_PLAYWRIGHT_OPTIONAL=1` is set → suppress the missing-dep finding
 *       (silent skip — prior behavior, kept for backward-compat).
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

export interface QaResult {
  /** Overall lint pass — DOCTYPE + viewport + script tag all present. */
  lint_passed: boolean;
  /** Exit code analog: 0 = lint+size+phaser all OK, 1 = any fail. */
  exec_exit_code: number;
  /** Phaser CDN reference detected. */
  phaser_loaded: boolean;
  /** Optional playwright smoke result; "ok" / "fail" / "skipped". */
  first_interaction: 'ok' | 'fail' | 'skipped';
  /** sha256 of the checked artifact. */
  artifact_sha256: string;
  /** Wall time of the check in ms. */
  runtime_ms: number;
  /** D6 portability — cross-browser smoke result. Optional, skipped by default. */
  cross_browser_smoke?: 'ok' | 'fail' | 'skipped';
  /** Own-code size in bytes (excluding CDN-loaded scripts). */
  loc_own_bytes: number;
  /** Detailed lint findings (one per failed check). */
  lint_findings: string[];
}

const LINT_RULES: Array<{ name: string; test: (html: string) => boolean; message: string }> = [
  {
    name: 'doctype',
    test: (html) => /<!doctype\s+html>/i.test(html),
    message: 'missing <!DOCTYPE html>',
  },
  {
    name: 'viewport',
    test: (html) => /<meta[^>]+name=["']viewport["'][^>]+>/i.test(html),
    message: 'missing <meta name="viewport">',
  },
  {
    name: 'phaser_cdn',
    test: (html) => /<script[^>]+src=["'][^"']*phaser[^"']*["']/i.test(html),
    message: 'missing Phaser CDN <script src=...>',
  },
  {
    name: 'has_script_body',
    test: (html) => /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/i.test(html),
    message: 'missing inline <script> body (game logic)',
  },
];

const MAX_OWN_CODE_BYTES = 60_000;

/**
 * Run the deterministic check. Pure function of (artifact path) → result.
 *
 * Mock fixtures (path ending in `.mock.html`) return deterministic PASS.
 *
 * **Missing artifact is NOT a fixture — it's a builder failure.** v3.4 splits
 * the two cases that used to share a fall-through: a real builder spawn that
 * crashed before writing any file must NOT be rewarded with a fake PASS,
 * because the verifier reads `qa.result.exec_exit_code` as D2 ground truth
 * and a phantom 0 would force D2=5 + verdict=PASS through anti-deception
 * Rules 1–2. Now: missing artifact returns `exec_exit_code=1 + lint_passed=false
 * + lint_findings=['artifact_missing: ...']` so D2 collapses to 0 and the
 * audit trail surfaces the real failure mode.
 */
export async function runQaCheck(artifactPath: string): Promise<QaResult> {
  const start = Date.now();

  // Mock fixture path — deterministic PASS (CI / mock adapter only).
  if (artifactPath.endsWith('.mock.html')) {
    return {
      lint_passed: true,
      exec_exit_code: 0,
      phaser_loaded: true,
      first_interaction: 'skipped',
      artifact_sha256: 'a'.repeat(64),
      runtime_ms: Date.now() - start,
      cross_browser_smoke: 'skipped',
      loc_own_bytes: 0,
      lint_findings: [],
    };
  }

  // Real builder run — missing artifact = builder failure, NOT a fixture.
  // Surface it as a hard FAIL so anti-deception D2/D6 force D2=0.
  if (!existsSync(artifactPath)) {
    return {
      lint_passed: false,
      exec_exit_code: 1,
      phaser_loaded: false,
      first_interaction: 'fail',
      artifact_sha256: '',
      runtime_ms: Date.now() - start,
      cross_browser_smoke: 'fail',
      loc_own_bytes: 0,
      lint_findings: [`artifact_missing: ${artifactPath} not written by builder`],
    };
  }

  const html = readFileSync(artifactPath, 'utf-8');
  const sha256 = createHash('sha256').update(html).digest('hex');
  const stat = statSync(artifactPath);

  const findings: string[] = [];
  for (const rule of LINT_RULES) {
    if (!rule.test(html)) findings.push(rule.message);
  }

  const phaserLoaded = LINT_RULES[2]!.test(html);
  const lintPassed = findings.length === 0;

  // Compute own-code bytes (file size minus rough CDN-script-tag length estimates).
  // For single-file HTML this is a bound, not exact; CDN external doesn't count anyway.
  const ownBytes = stat.size;
  if (ownBytes > MAX_OWN_CODE_BYTES) {
    findings.push(`own-code exceeds ${MAX_OWN_CODE_BYTES} bytes (got ${ownBytes})`);
  }

  // Playwright smoke — auto-detect via dynamic import.
  // See module header for the full detection contract (env: CRUMB_QA_REQUIRE_PLAYWRIGHT,
  // CRUMB_QA_PLAYWRIGHT_OPTIONAL).
  let firstInteraction: QaResult['first_interaction'] = 'skipped';
  let crossBrowserSmoke: QaResult['cross_browser_smoke'] = 'skipped';
  const requirePlaywright = process.env.CRUMB_QA_REQUIRE_PLAYWRIGHT === '1';
  const playwrightOptional = process.env.CRUMB_QA_PLAYWRIGHT_OPTIONAL === '1';
  let playwrightUnavailable = false;
  try {
    const { runPlaywrightSmoke } = await import('./qa-check-playwright.js');
    const smoke = await runPlaywrightSmoke(artifactPath);
    firstInteraction = smoke.firstInteraction;
    crossBrowserSmoke = smoke.crossBrowser;
    if (smoke.firstInteraction === 'fail') {
      findings.push(`playwright smoke failed: ${smoke.reason ?? 'unknown'}`);
    }
  } catch (err) {
    // Distinguish "playwright not installed" (module-not-found) from "smoke errored".
    const msg = (err as Error)?.message ?? String(err);
    const isMissing = /Cannot find (module|package)|MODULE_NOT_FOUND|playwright/i.test(msg);
    playwrightUnavailable = isMissing;
    if (isMissing) {
      if (requirePlaywright) {
        firstInteraction = 'fail';
        findings.push(
          'playwright required (CRUMB_QA_REQUIRE_PLAYWRIGHT=1) but not installed; install: npm i -D playwright && npx playwright install chromium',
        );
      } else if (!playwrightOptional) {
        // Default: signal the gap without failing — verifier sees the warning in lint_findings.
        findings.push(
          'playwright not installed (D6 portability unverified); install: npm i -D playwright && npx playwright install chromium',
        );
      }
      // If CRUMB_QA_PLAYWRIGHT_OPTIONAL=1 → silent skip, no finding.
    } else {
      // Real runtime error in the smoke run itself (not a missing-dep): always surface as fail.
      firstInteraction = 'fail';
      findings.push(`playwright smoke errored: ${msg}`);
    }
  }

  const playwrightFailed = firstInteraction === 'fail';
  const playwrightBlocks = playwrightFailed || (playwrightUnavailable && requirePlaywright);
  const allOk = lintPassed && ownBytes <= MAX_OWN_CODE_BYTES && !playwrightBlocks;

  return {
    lint_passed: lintPassed,
    exec_exit_code: allOk ? 0 : 1,
    phaser_loaded: phaserLoaded,
    first_interaction: firstInteraction,
    artifact_sha256: sha256,
    runtime_ms: Date.now() - start,
    cross_browser_smoke: crossBrowserSmoke,
    loc_own_bytes: ownBytes,
    lint_findings: findings,
  };
}
