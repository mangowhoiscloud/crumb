/**
 * qa-interactive — deterministic AC predicate runner (v3.5).
 *
 * Tier-2 of the two-tier QA model (see `agents/specialists/game-design.md`
 * §AC-Predicate-Compile). Tier-1 = static smoke (`qa-check-playwright.ts`,
 * boot + Phaser SYS.RUNNING + offline reload). Tier-2 = state-observable AC
 * verification by replaying planner-compiled `predicate_js` strings against
 * the live game.
 *
 * Frontier backing:
 *   - ArtifactsBench (arXiv:2507.04952) — sandbox + 3 sequential screenshots +
 *     10-dim checklist hits 94.4% human agreement; LLM-only judgement lags.
 *   - VideoGameQA-Bench (arXiv:2505.15952) — VLMs hit 82.8% on glitch detection
 *     from images but collapse on body-config / clipping / common-sense; AC
 *     verification needs deterministic predicate evaluation, not VLM grading.
 *   - Karpathy autoresearch (2026-03) — immutable harness: predicates compiled
 *     ONCE by planner-lead at spec-seal time, replayed identically by every
 *     verifier round (no per-round re-compilation drift).
 *
 * cf. `wiki/findings/bagelcode-frontier-evidence-vs-llm-reasoning-2026-05-03.md`
 * — the AC8 LLM-vs-evidence divergence case that motivated this layer.
 */

import { dirname, basename } from 'node:path';

import { withStaticServer, SCENE_RUNNING_PROBE } from './qa-check-playwright.js';

/**
 * One AC compiled to a browser-side deterministic predicate. Authored by
 * planner-lead at spec-seal time per `agents/specialists/game-design.md`
 * §AC-Predicate-Compile.1.
 */
export interface ACPredicateItem {
  /** Stable identifier (e.g. `AC1`, `AC2-cluster-tap`). */
  id: string;
  /** One-line natural language; for diagnostic logs. */
  intent: string;
  /** JS expression evaluated in browser context; truthy = PASS. */
  predicate_js: string;
  /** Optional pre-action evaluated in browser context before predicate. */
  action_js?: string | null;
  /** Sleep between action and first predicate eval (ms; default 250). */
  wait_ms?: number;
  /** Max wait for predicate to become truthy (ms; default 3000). */
  timeout_ms?: number;
}

export interface ACResult {
  ac_id: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  reason?: string;
  /** Wall time spent on this AC in ms (action + wait + predicate poll). */
  runtime_ms: number;
}

export interface ACInteractiveResult {
  results: ACResult[];
  total: number;
  passed: number;
}

const DEFAULT_WAIT_MS = 250;
const DEFAULT_TIMEOUT_MS = 3000;
const NAV_TIMEOUT_MS = 5000;
const CANVAS_TIMEOUT_MS = 5000;
const SCENE_RUNNING_TIMEOUT_MS = 5000;

/**
 * Run all `ACPredicateItem`s sequentially against the artifact in one Chromium
 * instance (one context per AC for state isolation). Always returns — never
 * throws; setup failures are encoded as per-AC SKIP with a reason.
 */
export async function runACInteractive(
  artifactPath: string,
  items: ACPredicateItem[],
): Promise<ACInteractiveResult> {
  if (items.length === 0) {
    return { results: [], total: 0, passed: 0 };
  }

  // Cap timeouts at the env override if set (CI hardening).
  const envCapMs = Number(process.env.CRUMB_QA_AC_TIMEOUT_MS);
  const capMs = Number.isFinite(envCapMs) && envCapMs > 0 ? envCapMs : DEFAULT_TIMEOUT_MS;

  // Dynamic import — same detection contract as qa-check-playwright.
  const moduleName = 'playwright';
  let playwright: PlaywrightModule;
  try {
    playwright = (await import(moduleName)) as PlaywrightModule;
  } catch (err) {
    const reason = `playwright not loadable: ${(err as Error).message.slice(0, 160)}`;
    return {
      results: items.map((it) => ({ ac_id: it.id, status: 'SKIP', reason, runtime_ms: 0 })),
      total: items.length,
      passed: 0,
    };
  }

  const rootDir = dirname(artifactPath);
  const entryFile = basename(artifactPath);

  return withStaticServer(rootDir, async (baseUrl) => {
    const browser = await playwright.chromium.launch({ headless: true });
    try {
      const results: ACResult[] = [];
      for (const item of items) {
        const start = Date.now();
        try {
          const result = await runOneAC(browser, baseUrl, entryFile, item, capMs);
          results.push({ ...result, runtime_ms: Date.now() - start });
        } catch (err) {
          results.push({
            ac_id: item.id,
            status: 'FAIL',
            reason: `runner_error: ${(err as Error).message.slice(0, 200)}`,
            runtime_ms: Date.now() - start,
          });
        }
      }
      const passed = results.filter((r) => r.status === 'PASS').length;
      return { results, total: items.length, passed };
    } finally {
      await browser.close().catch(() => undefined);
    }
  });
}

async function runOneAC(
  browser: PlaywrightBrowser,
  baseUrl: string,
  entryFile: string,
  item: ACPredicateItem,
  capMs: number,
): Promise<Omit<ACResult, 'runtime_ms'>> {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture errors that occur within this AC's window so a runtime error
  // mid-action triggers FAIL with diagnostic.
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));

  try {
    await page.goto(`${baseUrl}/${entryFile}`, {
      waitUntil: 'load',
      timeout: NAV_TIMEOUT_MS,
    });
    await page.waitForSelector('canvas', {
      timeout: CANVAS_TIMEOUT_MS,
      state: 'attached',
    });
    await page.waitForFunction(SCENE_RUNNING_PROBE, {
      timeout: SCENE_RUNNING_TIMEOUT_MS,
    });
  } catch (err) {
    return {
      ac_id: item.id,
      status: 'FAIL',
      reason: `setup_failed: ${(err as Error).message.slice(0, 200)}`,
    };
  } finally {
    // Defer context.close() to the success path so we can collect errors
    // through the predicate eval; close in tail finally below.
  }

  try {
    if (item.action_js && item.action_js.trim().length > 0) {
      try {
        await page.evaluate(item.action_js);
      } catch (err) {
        return {
          ac_id: item.id,
          status: 'FAIL',
          reason: `action_js_threw: ${(err as Error).message.slice(0, 200)}`,
        };
      }
    }

    const waitMs =
      typeof item.wait_ms === 'number' && item.wait_ms >= 0 ? item.wait_ms : DEFAULT_WAIT_MS;
    if (waitMs > 0) {
      await new Promise((r) => setTimeout(r, waitMs));
    }

    const timeoutMs = Math.min(
      typeof item.timeout_ms === 'number' && item.timeout_ms > 0
        ? item.timeout_ms
        : DEFAULT_TIMEOUT_MS,
      capMs,
    );
    const wrappedPredicate = `(() => { return ${item.predicate_js}; })()`;
    try {
      await page.waitForFunction(wrappedPredicate, { timeout: timeoutMs });
    } catch (err) {
      // Capture predicate's last value for diagnostic.
      let lastValue: unknown = undefined;
      try {
        lastValue = await page.evaluate(wrappedPredicate);
      } catch {
        // ignore
      }
      const lastValueStr = lastValue === undefined ? '<eval-threw>' : JSON.stringify(lastValue);
      return {
        ac_id: item.id,
        status: 'FAIL',
        reason: `predicate_did_not_become_truthy within ${timeoutMs}ms; last=${lastValueStr}; err=${(err as Error).message.slice(0, 100)}`,
      };
    }

    if (pageErrors.length > 0) {
      return {
        ac_id: item.id,
        status: 'FAIL',
        reason: `pageerror: ${pageErrors[0]?.slice(0, 200)}`,
      };
    }
    if (consoleErrors.length > 0) {
      return {
        ac_id: item.id,
        status: 'FAIL',
        reason: `console_error: ${consoleErrors[0]?.slice(0, 200)}`,
      };
    }
    return { ac_id: item.id, status: 'PASS' };
  } finally {
    await context.close().catch(() => undefined);
  }
}

interface PlaywrightModule {
  chromium: { launch: (opts?: { headless?: boolean }) => Promise<PlaywrightBrowser> };
}
interface PlaywrightBrowser {
  newContext: () => Promise<PlaywrightContext>;
  close: () => Promise<void>;
}
interface PlaywrightContext {
  newPage: () => Promise<PlaywrightPage>;
  close: () => Promise<void>;
}
interface PlaywrightPage {
  on(event: 'console', handler: (msg: PlaywrightConsoleMsg) => void): void;
  on(event: 'pageerror', handler: (err: Error) => void): void;
  goto(url: string, opts?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  evaluate(fn: string): Promise<unknown>;
  waitForSelector(selector: string, opts?: { timeout?: number; state?: string }): Promise<unknown>;
  waitForFunction(
    fn: string,
    opts?: { timeout?: number; polling?: number | string },
  ): Promise<unknown>;
}
interface PlaywrightConsoleMsg {
  type: () => string;
  text: () => string;
}
