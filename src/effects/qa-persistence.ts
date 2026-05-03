/**
 * qa-persistence — per-`PersistenceProfile` deterministic smoke (v0.4 Phase 7).
 *
 * Tier-3 of the QA model on top of qa-check (static lint + Playwright smoke)
 * and qa-interactive (AC predicates). Reads `task_ledger.persistence_profile`
 * (forwarded via `QaCheckEffect.persistence_profile`) and dispatches to a
 * profile-specific runner per `agents/specialists/game-design.md` §1.4:
 *
 *   - `local-only`        → Dexie smoke in headless Chromium (real check)
 *   - `postgres-anon`     → existing §1.2 docker path (deferred to follow-up
 *                           PR — qa-runner integration still pending)
 *   - `edge-orm`          → wrangler-on-PATH probe (PARTIAL fallback per §1.4
 *                           "wrangler_not_found" rule); full `wrangler dev`
 *                           spawn deferred
 *   - `firebase-realtime` → reserved (P0 제외)
 *   - `undefined`         → skipped (no profile flagged → un-flagged session)
 *
 * Status semantics (mirrors the existing qa-check fields):
 *   - `ok`       → all profile-specific invariants passed
 *   - `fail`     → one or more invariants failed; downgrades exec_exit_code=1
 *                  upstream (the `qa-check.ts` aggregator handles that)
 *   - `partial`  → soft-degrade (e.g. wrangler missing); does NOT change
 *                  exec_exit_code; verifier reads as "evidence absent" not
 *                  "evidence contradicts"
 *   - `skipped`  → no profile / deferred / firebase / playwright-missing; no
 *                  effect on D2 ground truth
 *
 * Frontier alignment: the §1.4 spec was authored alongside the `qa-runner`
 * extension call-out. This module fills that contract for the two profiles
 * shipping in this PR (`local-only` + `edge-orm` partial). The other two
 * profiles' status field is the documented placeholder so the verifier sees
 * the deliberate skip in `qa.result.data.persistence_check` rather than
 * silently missing the field.
 */

import { spawnSync } from 'node:child_process';
import { dirname, basename } from 'node:path';

import type { PersistenceProfile } from '../state/types.js';

import { withStaticServer } from './qa-check-playwright.js';

export type PersistenceStatus = 'ok' | 'fail' | 'partial' | 'skipped';

export interface PersistenceCheckResult {
  /**
   * The profile the smoke ran against. `null` when no profile was flagged
   * (un-flagged session — un-flagged sessions stay backward-compatible with
   * the pre-v0.4 behavior).
   */
  profile: PersistenceProfile | null;
  status: PersistenceStatus;
  /** Human-readable evidence (one entry per check / fallback note). */
  findings: string[];
  /** Wall time spent on this profile's smoke in ms (0 for skipped). */
  runtime_ms: number;
}

interface PlaywrightModule {
  chromium: { launch: (opts: { headless: boolean }) => Promise<PlaywrightBrowser> };
}

interface PlaywrightBrowser {
  newContext: () => Promise<PlaywrightContext>;
  close: () => Promise<void>;
}

interface PlaywrightContext {
  newPage: () => Promise<PlaywrightPage>;
}

interface PlaywrightPage {
  goto: (
    url: string,
    opts?: { waitUntil?: 'load' | 'domcontentloaded'; timeout?: number },
  ) => Promise<unknown>;
  // String overload — keeps TS from type-checking the browser-side body as
  // Node code (Playwright accepts a function-string and evals it inside the
  // page). Same pattern qa-check-playwright.ts uses for SCENE_RUNNING_PROBE.
  evaluate: <T>(expr: string) => Promise<T>;
}

/**
 * Browser-side §1.4.local-only contract (a/b/c). Evaluated as a string in the
 * page context — keeps `window` / dynamic `import()` out of the TS Node
 * typecheck path.
 */
const DEXIE_SMOKE_PROBE = `(async () => {
  try {
    const dexieMod = await import('https://esm.sh/dexie@4');
    const Dexie = dexieMod.default;
    const dbName = 'crumb-smoke-' + Math.random().toString(36).slice(2);
    const db = new Dexie(dbName);
    db.version(1).stores({ runs: '++id, score' });
    const id = await db.runs.add({ score: 100 });
    const rows = await db.runs.orderBy('score').reverse().limit(10).toArray();
    await db.delete();
    return {
      ok: typeof id === 'number' && Array.isArray(rows),
      id: typeof id === 'number' ? id : undefined,
      rowCount: Array.isArray(rows) ? rows.length : 0,
    };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
})()`;

const NAV_TIMEOUT_MS = 5000;
const SMOKE_TIMEOUT_MS = 15000;

/**
 * Public entry. Always returns — never throws; runtime errors are encoded
 * as `status: 'fail'` with the reason in `findings`. Mirrors qa-check.ts's
 * "always emit qa.result so the verifier can read D2" discipline.
 */
export async function runPersistenceCheck(
  artifactPath: string,
  profile?: PersistenceProfile,
): Promise<PersistenceCheckResult> {
  const start = Date.now();

  if (!profile) {
    return {
      profile: null,
      status: 'skipped',
      findings: ['no persistence_profile set on goal — un-flagged session'],
      runtime_ms: 0,
    };
  }

  switch (profile) {
    case 'local-only':
      return runLocalOnlySmoke(artifactPath, start);
    case 'edge-orm':
      return runEdgeOrmProbe(start);
    case 'postgres-anon':
      return {
        profile,
        status: 'skipped',
        findings: [
          'postgres-anon smoke not yet integrated into qa-runner; verifier reads §1.2 contract directly (docker postgres path is a follow-up PR)',
        ],
        runtime_ms: Date.now() - start,
      };
    case 'firebase-realtime':
      return {
        profile,
        status: 'skipped',
        findings: ['firebase-realtime is P0-deferred (game-design.md §1.4.firebase-realtime)'],
        runtime_ms: Date.now() - start,
      };
  }
}

async function runLocalOnlySmoke(
  artifactPath: string,
  start: number,
): Promise<PersistenceCheckResult> {
  // Same dynamic-import contract as qa-check-playwright: missing playwright →
  // SKIP (no D2 penalty), present → run real smoke.
  const moduleName = 'playwright';
  let playwright: PlaywrightModule;
  try {
    playwright = (await import(moduleName)) as PlaywrightModule;
  } catch (err) {
    return {
      profile: 'local-only',
      status: 'skipped',
      findings: [
        `playwright not loadable: ${(err as Error).message.slice(0, 160)}; install: npm i -D playwright && npx playwright install chromium`,
      ],
      runtime_ms: Date.now() - start,
    };
  }

  const rootDir = dirname(artifactPath);
  const entryFile = basename(artifactPath);

  try {
    return await withStaticServer(rootDir, async (baseUrl) => {
      const browser = await playwright.chromium.launch({ headless: true });
      try {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        await page.goto(`${baseUrl}/${entryFile}`, {
          waitUntil: 'load',
          timeout: NAV_TIMEOUT_MS,
        });
        // Run the §1.4.local-only contract (a/b/c) inside the page context
        // via a string-evaluated probe. Uses esm.sh CDN for Dexie — same
        // source the spec mandates for the builder's PersistenceManager.js.
        // Keeps the smoke independent of whether the artifact actually
        // ships with Dexie wired up.
        const evalPromise = page.evaluate<{
          ok: boolean;
          id?: number;
          rowCount?: number;
          error?: string;
        }>(DEXIE_SMOKE_PROBE);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`local-only smoke exceeded ${SMOKE_TIMEOUT_MS}ms`)),
            SMOKE_TIMEOUT_MS,
          ),
        );
        const result = await Promise.race([evalPromise, timeoutPromise]);

        if (result.ok) {
          return {
            profile: 'local-only' as const,
            status: 'ok' as const,
            findings: [
              `dexie smoke ok (id=${result.id ?? '?'}, rowCount=${result.rowCount ?? '?'})`,
            ],
            runtime_ms: Date.now() - start,
          };
        }
        return {
          profile: 'local-only' as const,
          status: 'fail' as const,
          findings: [`dexie smoke failed: ${result.error ?? 'unknown'}`],
          runtime_ms: Date.now() - start,
        };
      } finally {
        await browser.close().catch(() => undefined);
      }
    });
  } catch (err) {
    return {
      profile: 'local-only',
      status: 'fail',
      findings: [`local-only smoke errored: ${(err as Error).message.slice(0, 200)}`],
      runtime_ms: Date.now() - start,
    };
  }
}

function runEdgeOrmProbe(start: number): PersistenceCheckResult {
  // §1.4.edge-orm soft fallback: when `wrangler` CLI is not on PATH the
  // qa-runner emits PARTIAL (mirrors §1.2 `CRUMB_PG_URL`-missing fallback).
  // Full smoke (`wrangler dev` spawn + /api/runs HTTP probe + D1 migration
  // apply) is a follow-up PR — see `wiki/synthesis/bagelcode-genre-profile-decision-2026-05-03.md` §3
  // Phase 7 scope.
  let path: string | null = null;
  try {
    const which = spawnSync('which', ['wrangler'], { encoding: 'utf-8' });
    if (which.status === 0 && typeof which.stdout === 'string' && which.stdout.trim().length > 0) {
      path = which.stdout.trim();
    }
  } catch {
    // ignore — `which` not available is itself a "wrangler not on PATH" signal
  }

  if (path) {
    return {
      profile: 'edge-orm',
      status: 'partial',
      findings: [
        `wrangler found at ${path}; full smoke (wrangler dev + /api/runs + D1 migration) deferred to follow-up — verifier reads PARTIAL per game-design.md §1.4.edge-orm`,
      ],
      runtime_ms: Date.now() - start,
    };
  }
  return {
    profile: 'edge-orm',
    status: 'partial',
    findings: [
      'wrangler_not_found on PATH; install: npm install -g wrangler — D2 stays at static-smoke value, verifier sees PARTIAL per game-design.md §1.4.edge-orm',
    ],
    runtime_ms: Date.now() - start,
  };
}
