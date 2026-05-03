/**
 * qa-runner — dispatcher handler for QaCheckEffect.
 *
 * Reads artifact, runs deterministic qa-check, appends kind=qa.result with metadata.deterministic=true.
 * Source-of-truth for D2 (exec) and D6 (portability) per [[bagelcode-system-architecture-v0.1]] §7.
 */

import { resolve as resolvePath } from 'node:path';

import type { QaCheckEffect } from '../effects/types.js';
import { runQaCheck } from '../effects/qa-check.js';
import type { ACPredicateItem } from '../effects/qa-interactive.js';
import type { PersistenceProfile } from '../state/types.js';
import type { TranscriptWriter } from '../transcript/writer.js';

export interface QaRunnerDeps {
  writer: TranscriptWriter;
  sessionId: string;
  sessionDir: string;
}

/**
 * Hard timeout on `runQaCheck` so a hung Playwright (chromium zombie / network
 * hang / service-worker bootstrap stall) cannot stall the entire pipeline.
 *
 * Without this, session 01KQNAK1 saw 2 builds → 0 qa.results: builder finished,
 * runQaCheck started Playwright, Playwright never returned, the dispatcher's
 * `await runQaCheckEffect` hung indefinitely, no qa.result event was emitted,
 * the verifier was never spawned, and the wall-clock cap eventually killed the
 * session. This timeout converts a hang into a deterministic FAIL qa.result so
 * the verifier still gets D2 ground truth and the pipeline keeps moving.
 *
 * Default 120s = 2× the per-step Playwright internal timeouts (5s nav + 5s
 * canvas + 5s scene-running + 1.5s console + 5s offline-reload + cross-browser
 * pass + smoke iframe = ~30-90s total budget). Env override:
 * `CRUMB_QA_CHECK_TIMEOUT_MS` for CI smoke runs (drop to 30s) or debugging
 * (raise to 5min).
 */
const QA_CHECK_TIMEOUT_MS = Number(process.env.CRUMB_QA_CHECK_TIMEOUT_MS) || 120_000;

class QaCheckTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`qa-check exceeded ${timeoutMs}ms wall-clock — Playwright likely hung`);
    this.name = 'QaCheckTimeoutError';
  }
}

async function runQaCheckWithTimeout(
  artifactPath: string,
  acPredicates: ACPredicateItem[],
  controls: { start?: string[]; pointer_fallback?: boolean } | undefined,
  timeoutMs: number,
  persistenceProfile?: PersistenceProfile,
): Promise<Awaited<ReturnType<typeof runQaCheck>>> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const work = runQaCheck(artifactPath, acPredicates, persistenceProfile, controls);
    const sentinel = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new QaCheckTimeoutError(timeoutMs)), timeoutMs);
    });
    return await Promise.race([work, sentinel]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Resolve a QaCheckEffect: run check, append kind=qa.result. Always emits, even on error. */
export async function runQaCheckEffect(effect: QaCheckEffect, deps: QaRunnerDeps): Promise<void> {
  const artifactPath = resolvePath(deps.sessionDir, effect.artifact);

  let result;
  try {
    result = await runQaCheckWithTimeout(
      artifactPath,
      effect.ac_predicates ?? [],
      effect.controls,
      QA_CHECK_TIMEOUT_MS,
      effect.persistence_profile,
    );
  } catch (err) {
    // Even hard failures must produce a qa.result so the verifier can read D2.
    await deps.writer.append({
      session_id: deps.sessionId,
      from: 'system',
      parent_event_id: effect.build_event_id,
      kind: 'qa.result',
      body: `qa-check exception: ${(err as Error).message}`,
      data: {
        lint_passed: false,
        exec_exit_code: 2,
        phaser_loaded: false,
        first_interaction: 'fail',
        artifact_sha256: effect.artifact_sha256 ?? '',
        runtime_ms: 0,
        cross_browser_smoke: 'fail',
        loc_own_bytes: 0,
        lint_findings: [`exception: ${(err as Error).message}`],
      },
      metadata: {
        visibility: 'public',
        tool: 'qa-check-effect@v1',
        deterministic: true,
      },
    });
    return;
  }

  await deps.writer.append({
    session_id: deps.sessionId,
    from: 'system',
    parent_event_id: effect.build_event_id,
    kind: 'qa.result',
    body:
      result.exec_exit_code === 0
        ? `qa-check PASS (${result.runtime_ms}ms, ${result.loc_own_bytes}B)`
        : `qa-check FAIL: ${result.lint_findings.join('; ')}`,
    data: {
      lint_passed: result.lint_passed,
      exec_exit_code: result.exec_exit_code,
      phaser_loaded: result.phaser_loaded,
      first_interaction: result.first_interaction,
      artifact_sha256: result.artifact_sha256,
      runtime_ms: result.runtime_ms,
      cross_browser_smoke: result.cross_browser_smoke,
      ...(result.pwa_offline_boot ? { pwa_offline_boot: result.pwa_offline_boot } : {}),
      ...(result.phaser_scene_running !== undefined
        ? { phaser_scene_running: result.phaser_scene_running }
        : {}),
      ...(result.phaser_booted !== undefined ? { phaser_booted: result.phaser_booted } : {}),
      ...(result.phaser_started_via_controls_fallback
        ? { phaser_started_via_controls_fallback: true }
        : {}),
      ...(result.juice_manager_present !== undefined
        ? { juice_manager_present: result.juice_manager_present }
        : {}),
      ...(result.juice_density !== undefined ? { juice_density: result.juice_density } : {}),
      ...(result.ac_results
        ? {
            ac_results: result.ac_results,
            ac_pass_count: result.ac_pass_count,
            ac_total: result.ac_total,
          }
        : {}),
      ...(result.persistence_check ? { persistence_check: result.persistence_check } : {}),
      loc_own_bytes: result.loc_own_bytes,
      lint_findings: result.lint_findings,
    },
    metadata: {
      visibility: 'public',
      tool: 'qa-check-effect@v1',
      deterministic: true,
    },
  });
}
