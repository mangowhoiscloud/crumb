/**
 * Playwright smoke test for QA check — real implementation (P0-2).
 *
 * Loaded lazily by qa-check.ts via dynamic import. When the `playwright` package
 * is not installed, the dynamic import fails and qa-check.ts handles it
 * (signal-only by default; strict-fail when `CRUMB_QA_REQUIRE_PLAYWRIGHT=1`).
 *
 * Smoke procedure:
 *   1. Launch Chromium headless
 *   2. Navigate to `file://${artifactPath}`
 *   3. Wait up to 5s for a `<canvas>` element (Phaser 3.80 creates one in Game.boot)
 *   4. Watch console for the first 1500 ms — any `error` level message → fail
 *   5. cross_browser_smoke is reported as 'ok' (chromium) when single-browser smoke passes;
 *      true cross-browser is a P1 (firefox + webkit), this is the SWE-bench-style P0 gate.
 *
 * Frontier backing: SWE-bench Verified 2025 top10 / Cognition Devin Jun 2025 / DeepSeek-R1 —
 * rule-based exec gate is the strongest D2 ground truth (cf. wiki/synthesis/
 * bagelcode-scoring-ratchet-frontier-2026-05-02.md §7 P0-2).
 */

export interface PlaywrightSmokeResult {
  firstInteraction: 'ok' | 'fail';
  crossBrowser: 'ok' | 'fail';
  /** Failure detail for lint_findings; absent when ok. */
  reason?: string;
}

const SMOKE_TIMEOUT_MS = 5000;
const CONSOLE_WATCH_MS = 1500;

export async function runPlaywrightSmoke(artifactPath: string): Promise<PlaywrightSmokeResult> {
  // Dynamic import so qa-check.ts can detect the missing-dep case via a single
  // catch block. The import throws "Cannot find module 'playwright'" when the
  // package is not installed — qa-check.ts pattern-matches on that.
  // The string is built at runtime so `tsc --noEmit` doesn't complain when
  // `playwright` is not a declared dependency (it's an optional peer).
  const moduleName = 'playwright';
  const playwright = (await import(moduleName)) as {
    chromium: { launch: (opts?: { headless?: boolean }) => Promise<PlaywrightBrowser> };
  };

  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.goto(`file://${artifactPath}`, { waitUntil: 'load', timeout: SMOKE_TIMEOUT_MS });

    // Phaser creates a <canvas> in Game.boot — wait for it (signals scene mounted).
    try {
      await page.waitForSelector('canvas', { timeout: SMOKE_TIMEOUT_MS, state: 'attached' });
    } catch {
      return {
        firstInteraction: 'fail',
        crossBrowser: 'fail',
        reason: `no <canvas> rendered within ${SMOKE_TIMEOUT_MS}ms (Phaser failed to boot)`,
      };
    }

    // Watch console for an additional window — runtime errors after mount.
    await new Promise((r) => setTimeout(r, CONSOLE_WATCH_MS));

    if (pageErrors.length > 0) {
      return {
        firstInteraction: 'fail',
        crossBrowser: 'fail',
        reason: `pageerror: ${pageErrors[0].slice(0, 200)}`,
      };
    }
    if (consoleErrors.length > 0) {
      return {
        firstInteraction: 'fail',
        crossBrowser: 'fail',
        reason: `console error: ${consoleErrors[0].slice(0, 200)}`,
      };
    }

    return { firstInteraction: 'ok', crossBrowser: 'ok' };
  } finally {
    await browser.close().catch(() => undefined);
  }
}

// Minimal types for the playwright surface we touch — keeps this file
// type-checkable when `playwright` is not installed (devDependency optional).
interface PlaywrightBrowser {
  newContext: () => Promise<PlaywrightContext>;
  close: () => Promise<void>;
}
interface PlaywrightContext {
  newPage: () => Promise<PlaywrightPage>;
}
interface PlaywrightPage {
  on(event: 'console', handler: (msg: PlaywrightConsoleMsg) => void): void;
  on(event: 'pageerror', handler: (err: Error) => void): void;
  goto(url: string, opts?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  waitForSelector(selector: string, opts?: { timeout?: number; state?: string }): Promise<unknown>;
}
interface PlaywrightConsoleMsg {
  type: () => string;
  text: () => string;
}
