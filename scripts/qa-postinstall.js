#!/usr/bin/env node
/**
 * Crumb QA postinstall — idempotent chromium browser installer.
 *
 * Runs once after `npm install`. Detects whether:
 *   1. `playwright` npm package is resolvable
 *   2. Chromium browser binary is already cached (~/.cache/ms-playwright)
 * and installs the binary only when (1) is true AND (2) is missing.
 *
 * Why postinstall: builds a frictionless cross-machine setup. The Bagelcode
 * evaluator runs `npm install && npm run build && npm link && crumb run` —
 * if Playwright's chromium isn't pre-cached, the qa-check D6 portability
 * gate stays skipped, leaving the LLM verifier to forge AC8 calls (the very
 * gap documented in `wiki/findings/bagelcode-frontier-evidence-vs-llm-
 * reasoning-2026-05-03.md`). Auto-install closes that loop without making
 * the evaluator memorize a multi-step setup.
 *
 * Opt-out: set `CRUMB_SKIP_PLAYWRIGHT_INSTALL=1` to skip (CI, air-gapped
 * environments, or `--ignore-scripts` is honored automatically by npm).
 *
 * Idempotent: re-running this script when the binary already exists is a
 * no-op (logs "already installed" and exits 0).
 *
 * Failures are non-fatal: a chromium download timeout / proxy / disk-space
 * issue will log a warning and exit 0. The user can run
 * `npx playwright install chromium` manually later. We DON'T want
 * `npm install` to fail just because we couldn't pre-cache a browser.
 */

import { existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir, platform } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const SKIP_ENV = 'CRUMB_SKIP_PLAYWRIGHT_INSTALL';

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[crumb-qa-postinstall] ${msg}`);
}

function warn(msg) {
  // eslint-disable-next-line no-console
  console.warn(`[crumb-qa-postinstall] WARN: ${msg}`);
}

if (process.env[SKIP_ENV] === '1') {
  log(`${SKIP_ENV}=1 — skipping chromium install.`);
  process.exit(0);
}

// ── Step 1: Is the `playwright` package resolvable? ─────────────────────────
const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, '..');
const require = createRequire(join(projectRoot, 'package.json'));

let playwrightAvailable = false;
try {
  require.resolve('playwright/package.json');
  playwrightAvailable = true;
} catch {
  playwrightAvailable = false;
}

if (!playwrightAvailable) {
  log('playwright package not resolvable — skipping chromium install (D6 portability will stay skipped).');
  process.exit(0);
}

// ── Step 2: Is chromium binary already installed? ───────────────────────────
const cacheRoot = process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), 'Library', 'Caches', 'ms-playwright');
const linuxCache = join(homedir(), '.cache', 'ms-playwright');
const winCache = join(process.env.LOCALAPPDATA ?? homedir(), 'ms-playwright');
const candidateCaches = [cacheRoot, linuxCache, winCache];

function chromiumInstalled() {
  for (const root of candidateCaches) {
    if (!existsSync(root)) continue;
    let entries;
    try {
      entries = readdirSync(root);
    } catch {
      continue;
    }
    if (entries.some((e) => /^chromium(_headless_shell)?(-\d+)?$/.test(e))) {
      return true;
    }
  }
  return false;
}

if (chromiumInstalled()) {
  log('chromium browser already cached — nothing to do.');
  process.exit(0);
}

// ── Step 3: Install chromium ────────────────────────────────────────────────
log(`installing chromium for playwright (platform=${platform()})…`);
const args = ['playwright', 'install', 'chromium'];
// Linux: also install system deps (libnss / libatk / etc.) when running with sudo or root.
if (platform() === 'linux' && (process.geteuid?.() === 0 || process.env.CI === 'true')) {
  args.push('--with-deps');
}

const result = spawnSync('npx', args, {
  cwd: projectRoot,
  stdio: 'inherit',
  env: process.env,
});

if (result.status === 0) {
  log('chromium installed successfully.');
  process.exit(0);
} else {
  warn(`chromium install exited ${result.status}. Run 'npx playwright install chromium' manually if you need D6 portability scoring.`);
  // Non-fatal — don't break npm install.
  process.exit(0);
}
