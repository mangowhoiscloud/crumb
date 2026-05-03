/**
 * Playwright smoke test for QA check — frontier-aligned (P0-2 + 2026 upgrade).
 *
 * Loaded lazily by qa-check.ts via dynamic import. When the `playwright` package
 * is not installed, the dynamic import fails and qa-check.ts handles it
 * (signal-only by default; strict-fail when `CRUMB_QA_REQUIRE_PLAYWRIGHT=1`).
 *
 * Smoke procedure (multi-file PWA aware):
 *   1. Spin up a localhost HTTP server rooted at the artifact's parent dir.
 *      Required because ES module imports + service worker registration
 *      do not work over file:// in Chromium.
 *   2. Launch Chromium headless, navigate to http://127.0.0.1:PORT/<entry>.
 *   3. Wait up to 5s for a `<canvas>` element (Phaser 3.80 creates one in Game.boot).
 *   4. Wait up to 5s for Phaser scene to reach SYS.RUNNING (status === 5) — the
 *      ArtifactsBench-aligned "first_interaction" frontier (arXiv:2507.04952):
 *      a `<canvas>` alone does not prove the game booted, only that Phaser
 *      created its surface. SYS.RUNNING means Scene.create() completed and
 *      update() is firing.
 *   5. Watch console for `error`-level messages and uncaught pageerrors during
 *      the next 1500 ms — any → fail.
 *   6. (PWA path) `context.setOffline(true)` and reload. If the page boots from
 *      service worker cache (canvas + SYS.RUNNING reached again) report
 *      pwaOffline = 'ok'. Skipped silently when no `sw.js` sibling file (the
 *      artifact is not a PWA).
 *
 * Frontier backing:
 *   - SWE-bench Verified 2025 + Cognition Devin Jun 2025 — rule-based exec gate
 *     is the strongest D2 ground truth.
 *   - ArtifactsBench (arXiv:2507.04952) — 94.4% human agreement; "first_interaction"
 *     unit-of-evidence requires multi-step verification beyond <canvas>.
 *   - VideoGameQA-Bench (arXiv:2505.15952, Sony) — boot detection alone is
 *     insufficient; scene-state observation matters.
 *   - Karpathy autoresearch (2026-03) — immutable harness, fixed time-box.
 *
 * cf. wiki/synthesis/bagelcode-scoring-ratchet-frontier-2026-05-02.md §7 P0-2.
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, basename, join, extname, resolve } from 'node:path';

export interface PlaywrightSmokeResult {
  firstInteraction: 'ok' | 'fail';
  crossBrowser: 'ok' | 'fail';
  /** PWA offline second-load test result; 'skipped' when artifact has no sw.js sibling. */
  pwaOffline?: 'ok' | 'fail' | 'skipped';
  /**
   * v0.5 PR-Controls — Phaser game booted (Phaser.Game.isBooted === true).
   * Lighter than `phaserSceneRunning`; a true here + false on scene running
   * usually means the first scene is waiting on user input (MenuScene).
   */
  phaserBooted?: boolean;
  /** Phaser scene reached SYS.RUNNING(5). Stage 2 of the boot probe. */
  phaserSceneRunning?: boolean;
  /**
   * v0.5 PR-Controls — true when Stage 2 (SYS.RUNNING) only succeeded after
   * the controls fallback input loop synthesized a keypress / canvas click.
   * Surfaced into qa.result so verifier knows MenuScene was bridged, not
   * native-booted. PASS verdict still possible but D5.vibe should weigh
   * "premium games auto-advance demo intros" if this is true.
   */
  phaserStartedViaControlsFallback?: boolean;
  /** Failure detail for lint_findings; absent when ok. */
  reason?: string;
}

/**
 * v0.5 PR-Controls — input mapping read from spec.data.controls. Drives
 * qa-check's Stage-2 fallback when the first scene is a MenuScene waiting
 * on user input. See `agents/specialists/game-design.md` §4.5.
 */
export interface ControlsHint {
  start?: string[];
  pointer_fallback?: boolean;
}

const NAV_TIMEOUT_MS = 5000;
const CANVAS_TIMEOUT_MS = 5000;
const PHASER_BOOTED_TIMEOUT_MS = 5000;
// v0.5 PR-212/Controls — bumped from 5000 → 10000. 5s was too tight on
// multi-file PWA builds where the SW + Phaser CDN bootstrap can take 4-6s
// on cold first paint. Stage 1 (booted) still has 5s, which is enough to
// distinguish "Phaser never loaded" from "Phaser loaded but scene blocked".
const SCENE_RUNNING_TIMEOUT_MS = 10000;
const CONTROLS_FALLBACK_RETRY_MS = 5000;
const CONSOLE_WATCH_MS = 1500;
const OFFLINE_RELOAD_TIMEOUT_MS = 5000;

const MIME_BY_EXT: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

/**
 * Spin up an ephemeral http server on 127.0.0.1, run fn(baseUrl), tear down.
 *
 * Exported so `qa-interactive.ts` can reuse the same static-serve primitive
 * for the AC-predicate runner — both layers must serve from the same root
 * (artifact's parent dir) so relative paths and service worker scope match.
 */
export async function withStaticServer<T>(
  rootDir: string,
  fn: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    try {
      const u = new URL(req.url ?? '/', 'http://127.0.0.1');
      let pathname = decodeURIComponent(u.pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const filePath = resolve(rootDir, '.' + pathname);
      if (!filePath.startsWith(rootDir)) {
        res.statusCode = 403;
        res.end('forbidden');
        return;
      }
      if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        res.statusCode = 404;
        res.end('not found');
        return;
      }
      const ext = extname(filePath).toLowerCase();
      const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';
      res.statusCode = 200;
      res.setHeader('Content-Type', mime);
      res.setHeader('Service-Worker-Allowed', '/');
      res.end(readFileSync(filePath));
    } catch (err) {
      res.statusCode = 500;
      res.end(String(err));
    }
  });
  await new Promise<void>((res, rej) => {
    server.once('error', rej);
    server.listen(0, '127.0.0.1', () => res());
  });
  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    server.close();
    throw new Error('static server failed to bind a port');
  }
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  try {
    return await fn(baseUrl);
  } finally {
    await new Promise<void>((res) => server.close(() => res()));
  }
}

/**
 * v0.5 PR-Controls — Stage 1 boot probe. Lighter than SCENE_RUNNING_PROBE:
 * accepts any `Phaser.Game` instance with `isBooted === true`, regardless of
 * scene status. Used to distinguish "Phaser never loaded" (true failure)
 * from "Phaser loaded but first scene blocked on user input" (recoverable
 * via the spec.controls fallback input loop).
 */
export const PHASER_BOOTED_PROBE = `(() => {
  if (typeof window === 'undefined' || typeof Phaser === 'undefined') return false;
  const checkBooted = (g) => g && typeof g === 'object' && g.isBooted === true;
  const named = ['game', '__GAME__', '_game', 'phaserGame', 'GAME', 'gameInstance'];
  for (const k of named) { if (checkBooted(window[k])) return true; }
  try {
    for (const k of Object.keys(window)) {
      if (named.includes(k)) continue;
      try { if (checkBooted(window[k])) return true; } catch { /* cross-origin */ }
    }
  } catch { /* ignore */ }
  return false;
})()`;

/**
 * Probe Phaser SYS.RUNNING(5) without relying on a single window-name convention.
 * Builders may stash the Phaser.Game instance under `window.game` / `window.__GAME__`
 * / `window.phaserGame` etc., so we check common names and fall back to a
 * brute-force walk of window own-properties for any object with `isBooted === true`
 * and `scene.scenes`. ArtifactsBench-aligned (arXiv:2507.04952): the unit of
 * evidence is "any RUNNING scene", not a particular variable name.
 */
export const SCENE_RUNNING_PROBE = `(() => {
  if (typeof window === 'undefined' || typeof Phaser === 'undefined') return false;
  const checkGame = (g) => {
    if (!g || typeof g !== 'object' || g.isBooted !== true) return false;
    const scenes = (g.scene && g.scene.scenes) || [];
    return scenes.some(s => s && s.sys && s.sys.settings && s.sys.settings.status === 5);
  };
  const named = ['game', '__GAME__', '_game', 'phaserGame', 'GAME', 'gameInstance'];
  for (const k of named) { if (checkGame(window[k])) return true; }
  // Fallback: walk own properties looking for a booted Phaser.Game.
  try {
    for (const k of Object.keys(window)) {
      if (named.includes(k)) continue;
      try { if (checkGame(window[k])) return true; } catch { /* cross-origin / accessor throw */ }
    }
  } catch { /* ignore */ }
  return false;
})()`;

export async function runPlaywrightSmoke(
  artifactPath: string,
  controls?: ControlsHint,
): Promise<PlaywrightSmokeResult> {
  // Dynamic import so qa-check.ts can detect the missing-dep case via a single
  // catch block. The string is built at runtime so `tsc --noEmit` doesn't
  // complain when `playwright` is not a declared dependency (optional peer).
  const moduleName = 'playwright';
  const playwright = (await import(moduleName)) as {
    chromium: { launch: (opts?: { headless?: boolean }) => Promise<PlaywrightBrowser> };
  };

  const rootDir = dirname(artifactPath);
  const entryFile = basename(artifactPath);
  const swSibling = join(rootDir, 'sw.js');
  const isPwa = existsSync(swSibling);

  return withStaticServer(rootDir, async (baseUrl) => {
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

      const url = `${baseUrl}/${entryFile}`;
      try {
        await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
      } catch (err) {
        return {
          firstInteraction: 'fail',
          crossBrowser: 'fail',
          pwaOffline: 'skipped',
          reason: `navigation failed: ${(err as Error).message.slice(0, 200)}`,
        };
      }

      try {
        await page.waitForSelector('canvas', {
          timeout: CANVAS_TIMEOUT_MS,
          state: 'attached',
        });
      } catch {
        return {
          firstInteraction: 'fail',
          crossBrowser: 'fail',
          pwaOffline: 'skipped',
          phaserBooted: false,
          reason: `no <canvas> rendered within ${CANVAS_TIMEOUT_MS}ms (Phaser failed to boot)`,
        };
      }

      // v0.5 PR-Controls — Stage 1: Phaser.Game.isBooted true. Fast probe
      // separates "Phaser never loaded" (legitimate failure) from "Phaser
      // loaded but first scene is waiting on input" (recoverable via the
      // controls fallback input loop). Without this split, every MenuScene-
      // first game timed out at Stage 2 SYS.RUNNING and got marked FAIL,
      // even though the game was running fine in the user's hand.
      let phaserBooted = false;
      try {
        await page.waitForFunction(PHASER_BOOTED_PROBE, {
          timeout: PHASER_BOOTED_TIMEOUT_MS,
        });
        phaserBooted = true;
      } catch {
        return {
          firstInteraction: 'fail',
          crossBrowser: 'fail',
          pwaOffline: 'skipped',
          phaserBooted: false,
          phaserSceneRunning: false,
          reason: `Phaser failed to boot — Phaser.Game.isBooted never set true within ${PHASER_BOOTED_TIMEOUT_MS}ms (likely runtime error in BootScene)`,
        };
      }

      // Stage 2: at least one scene reached SYS.RUNNING(5). Failures here
      // with phaserBooted=true mean the first scene is waiting on input —
      // try the spec.controls fallback before declaring fail.
      let phaserSceneRunning = false;
      let phaserStartedViaControlsFallback = false;
      try {
        await page.waitForFunction(SCENE_RUNNING_PROBE, {
          timeout: SCENE_RUNNING_TIMEOUT_MS,
        });
        phaserSceneRunning = true;
      } catch {
        // v0.5 PR-Controls fallback. spec.controls.start[] = synthesizable
        // keys that advance from MenuScene; pointer_fallback enables a canvas
        // click as last resort. We try each input in turn, then re-wait
        // SYS.RUNNING once. If still failing, qa.result records
        // first_interaction='fail' with a clear "input synthesis exhausted"
        // reason so verifier knows the game's controls metadata or
        // MenuScene wiring is the gap, not a generic boot regression.
        const startKeys = controls?.start ?? [];
        const pointerFallback = controls?.pointer_fallback === true;
        let inputAttempted = false;
        for (const key of startKeys) {
          if (typeof key !== 'string' || key.length === 0) continue;
          inputAttempted = true;
          try {
            await page.keyboard.press(key);
          } catch {
            // unsupported key name — try the next one.
            continue;
          }
        }
        if (!inputAttempted && pointerFallback) {
          inputAttempted = true;
          try {
            await page.click('canvas', { timeout: 1000 });
          } catch {
            // canvas not clickable — fall through to fail.
          }
        }
        if (inputAttempted) {
          try {
            await page.waitForFunction(SCENE_RUNNING_PROBE, {
              timeout: CONTROLS_FALLBACK_RETRY_MS,
            });
            phaserSceneRunning = true;
            phaserStartedViaControlsFallback = true;
          } catch {
            // fall through to fail.
          }
        }
        if (!phaserSceneRunning) {
          const ctlSummary =
            startKeys.length > 0
              ? `controls.start=[${startKeys.join(',')}]`
              : pointerFallback
                ? 'pointer_fallback only'
                : 'no controls in spec';
          return {
            firstInteraction: 'fail',
            crossBrowser: 'fail',
            pwaOffline: 'skipped',
            phaserBooted,
            phaserSceneRunning: false,
            reason: `Phaser.Game booted but no scene reached SYS.RUNNING within ${SCENE_RUNNING_TIMEOUT_MS}ms${
              inputAttempted ? ' even after controls fallback synthesis' : ''
            } (${ctlSummary}) — first scene likely waiting on user input that the spec.controls block does not list`,
          };
        }
      }

      await new Promise((r) => setTimeout(r, CONSOLE_WATCH_MS));

      if (pageErrors.length > 0) {
        return {
          firstInteraction: 'fail',
          crossBrowser: 'fail',
          pwaOffline: 'skipped',
          phaserBooted,
          phaserSceneRunning,
          phaserStartedViaControlsFallback,
          reason: `pageerror: ${pageErrors[0]?.slice(0, 200)}`,
        };
      }
      if (consoleErrors.length > 0) {
        return {
          firstInteraction: 'fail',
          crossBrowser: 'fail',
          pwaOffline: 'skipped',
          phaserBooted,
          phaserSceneRunning,
          phaserStartedViaControlsFallback,
          reason: `console error: ${consoleErrors[0]?.slice(0, 200)}`,
        };
      }

      let pwaOffline: 'ok' | 'fail' | 'skipped' = 'skipped';
      if (isPwa) {
        try {
          // Service worker may need a beat to claim clients on first load.
          await new Promise((r) => setTimeout(r, 500));
          await context.setOffline(true);
          const offlineErrors: string[] = [];
          const offlineConsole: string[] = [];
          page.on('console', (msg) => {
            if (msg.type() === 'error') offlineConsole.push(msg.text());
          });
          page.on('pageerror', (err) => offlineErrors.push(err.message));
          await page.reload({ waitUntil: 'load', timeout: OFFLINE_RELOAD_TIMEOUT_MS });
          await page.waitForSelector('canvas', {
            timeout: CANVAS_TIMEOUT_MS,
            state: 'attached',
          });
          await page.waitForFunction(SCENE_RUNNING_PROBE, {
            timeout: SCENE_RUNNING_TIMEOUT_MS,
          });
          pwaOffline = offlineErrors.length === 0 && offlineConsole.length === 0 ? 'ok' : 'fail';
        } catch {
          pwaOffline = 'fail';
        } finally {
          await context.setOffline(false).catch(() => undefined);
        }
      }

      return {
        firstInteraction: 'ok',
        crossBrowser: 'ok',
        pwaOffline,
        phaserBooted,
        phaserSceneRunning,
        phaserStartedViaControlsFallback,
      };
    } finally {
      await browser.close().catch(() => undefined);
    }
  });
}

// Minimal types for the playwright surface we touch — keeps this file
// type-checkable when `playwright` is not installed (devDependency optional).
interface PlaywrightBrowser {
  newContext: () => Promise<PlaywrightContext>;
  close: () => Promise<void>;
}
interface PlaywrightContext {
  newPage: () => Promise<PlaywrightPage>;
  setOffline: (offline: boolean) => Promise<void>;
}
interface PlaywrightPage {
  on(event: 'console', handler: (msg: PlaywrightConsoleMsg) => void): void;
  on(event: 'pageerror', handler: (err: Error) => void): void;
  goto(url: string, opts?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  reload(opts?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  waitForSelector(selector: string, opts?: { timeout?: number; state?: string }): Promise<unknown>;
  waitForFunction(
    fn: string,
    opts?: { timeout?: number; polling?: number | string },
  ): Promise<unknown>;
  // v0.5 PR-Controls — input synthesis surface for the Stage-2 fallback.
  keyboard: { press: (key: string, opts?: { delay?: number }) => Promise<void> };
  click(selector: string, opts?: { timeout?: number; force?: boolean }): Promise<void>;
}
interface PlaywrightConsoleMsg {
  type: () => string;
  text: () => string;
}
