/**
 * qa-runner — dispatcher handler for QaCheckEffect.
 *
 * Reads artifact, runs deterministic qa-check, appends kind=qa.result with metadata.deterministic=true.
 * Source-of-truth for D2 (exec) and D6 (portability) per [[bagelcode-system-architecture-v3]] §7.
 */

import { resolve as resolvePath } from 'node:path';

import type { QaCheckEffect } from '../effects/types.js';
import { runQaCheck } from '../effects/qa-check.js';
import type { TranscriptWriter } from '../transcript/writer.js';

export interface QaRunnerDeps {
  writer: TranscriptWriter;
  sessionId: string;
  sessionDir: string;
}

/** Resolve a QaCheckEffect: run check, append kind=qa.result. Always emits, even on error. */
export async function runQaCheckEffect(effect: QaCheckEffect, deps: QaRunnerDeps): Promise<void> {
  const artifactPath = resolvePath(deps.sessionDir, effect.artifact);

  let result;
  try {
    result = await runQaCheck(artifactPath);
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
