/**
 * mock adapter — deterministic synthetic agent for tests + the P0 demo without
 * spending subscription tokens. It writes a canned sequence of transcript events
 * and exits 0.
 */

import { ulid } from 'ulid';

import type { Actor } from '../protocol/types.js';
import { TranscriptWriter } from '../transcript/writer.js';
import type { Adapter, SpawnRequest, SpawnResult } from './types.js';

export class MockAdapter implements Adapter {
  readonly id = 'mock';

  async health(): Promise<{ ok: boolean }> {
    return { ok: true };
  }

  async spawn(req: SpawnRequest): Promise<SpawnResult> {
    const start = Date.now();
    const writer = new TranscriptWriter({
      path: req.transcriptPath,
      sessionId: req.sessionId,
    });
    const wakeId = ulid();
    await writer.append({
      id: wakeId,
      session_id: req.sessionId,
      from: req.actor,
      kind: 'agent.wake',
      body: `${req.actor} starting (mock adapter)`,
    });

    if (req.actor === 'planner-lead') {
      await writePlannerSequence(writer, req, wakeId);
    } else if (req.actor === 'builder' || req.actor === 'builder-fallback') {
      await writeBuilderSequence(writer, req, wakeId);
    } else if (req.actor === 'verifier') {
      await writeVerifierSequence(writer, req, wakeId);
    }

    return {
      exitCode: 0,
      stdout: `mock ${req.actor} completed`,
      stderr: '',
      durationMs: Date.now() - start,
    };
  }
}

async function writePlannerSequence(
  writer: TranscriptWriter,
  req: SpawnRequest,
  parentId: string,
): Promise<void> {
  for (const step of ['socratic', 'concept', 'research', 'design'] as const) {
    await writer.append({
      session_id: req.sessionId,
      from: req.actor as Actor,
      parent_event_id: parentId,
      kind: `step.${step}` as 'step.socratic' | 'step.concept' | 'step.research' | 'step.design',
      body: `mock ${step} step`,
    });
  }
  await writer.append({
    session_id: req.sessionId,
    from: req.actor as Actor,
    parent_event_id: parentId,
    kind: 'spec',
    body: 'mock spec — 60s match-3 game',
    data: {
      acceptance_criteria: [
        'Phaser 3.80 loads via CDN without 404',
        'Touch input registers within 100ms on 320x568 viewport',
        '60-second timer counts down and ends the run at 0',
      ],
    },
  });
  await writer.append({
    session_id: req.sessionId,
    from: req.actor as Actor,
    parent_event_id: parentId,
    kind: 'handoff.requested',
    to: 'builder',
    data: { spec_id: parentId },
  });
}

/**
 * v3: Builder emits build-only. qa-check effect (deterministic, dispatcher-side)
 * produces qa.result. Verifier (separate spawn) produces judge.score.
 * See [[bagelcode-system-architecture-v3]] §4.2 (per-turn flow).
 */
async function writeBuilderSequence(
  writer: TranscriptWriter,
  req: SpawnRequest,
  parentId: string,
): Promise<void> {
  // Mock artifact: write a fixture path; qa-check effect uses .mock.html fallback for deterministic PASS.
  const artifactPath = 'artifacts/game.mock.html';
  await writer.append({
    session_id: req.sessionId,
    from: req.actor as Actor,
    parent_event_id: parentId,
    kind: 'artifact.created',
    artifacts: [
      {
        path: artifactPath,
        sha256: 'a'.repeat(64),
        role: 'src',
      },
    ],
  });
  await writer.append({
    session_id: req.sessionId,
    from: req.actor as Actor,
    parent_event_id: parentId,
    kind: 'build',
    body: 'mock build complete — game.mock.html ≤60KB',
    artifacts: [
      {
        path: artifactPath,
        sha256: 'a'.repeat(64),
        role: 'src',
      },
    ],
    data: {
      phaser_version: '3.80.1',
      loc_own_code: 5234,
      ac_addressed: ['AC-1', 'AC-2', 'AC-3'],
    },
    metadata: {
      harness: 'mock',
      provider: 'none',
      model: 'fixture-v1',
    },
  });
  await writer.append({
    session_id: req.sessionId,
    from: req.actor as Actor,
    parent_event_id: parentId,
    kind: 'handoff.requested',
    to: 'coordinator',
    data: { next_expected: 'qa.result' },
  });
}

/**
 * v3: Verifier reads qa.result (D2/D6 ground truth) + spec.md (D1) + reducer auto (D3/D4/D5).
 * CourtEval 4 sub-step inline → judge.score with D1-D6 source matrix.
 */
async function writeVerifierSequence(
  writer: TranscriptWriter,
  req: SpawnRequest,
  parentId: string,
): Promise<void> {
  for (const step of [
    { kind: 'step.judge' as const, step: 'grader' as const, body: 'initial D1-D6 grading' },
    { kind: 'step.judge' as const, step: 'critic' as const, body: 'challenge D1 spec_fit' },
    { kind: 'step.judge' as const, step: 'defender' as const, body: 'rebuttal: AC v1 scope' },
    {
      kind: 'step.judge' as const,
      step: 'regrader' as const,
      body: 'final scores after CourtEval',
    },
  ]) {
    await writer.append({
      session_id: req.sessionId,
      from: req.actor as Actor,
      parent_event_id: parentId,
      kind: step.kind,
      step: step.step,
      body: step.body,
    });
  }
  await writer.append({
    session_id: req.sessionId,
    from: req.actor as Actor,
    parent_event_id: parentId,
    kind: 'judge.score',
    body: 'mock verifier scorecard (CourtEval inline)',
    scores: {
      D1: { score: 4.5, source: 'verifier-llm', evidence: ['AC-1 ✓', 'AC-2 ✓', 'AC-3 partial'] },
      D2: { score: 5, source: 'qa-check-effect', lookup: 'qa.result.exec_exit_code' },
      D3: { score: 4, source: 'hybrid', auto: 4, semantic: 4 },
      D4: { score: 5, source: 'reducer-auto', lookup: 'scoreHistory' },
      D5: { score: 5, source: 'hybrid', auto: 5, quality: 5 },
      D6: { score: 4.5, source: 'qa-check-effect', lookup: 'qa.result.crossBrowserSmoke' },
      aggregate: 28,
      verdict: 'PASS',
      feedback: 'mock — all AC met, cross-provider verifier (mock)',
      courteval: {
        grader_msg_id: parentId,
        critic_msg_id: parentId,
        defender_msg_id: parentId,
        regrader_msg_id: parentId,
      },
      audit_violations: [],
    },
    metadata: {
      harness: 'mock',
      provider: 'none',
      model: 'fixture-v1',
      cross_provider: true,
    },
  });
  await writer.append({
    session_id: req.sessionId,
    from: req.actor as Actor,
    parent_event_id: parentId,
    kind: 'handoff.requested',
    to: 'coordinator',
    data: { verdict: 'PASS' },
  });
}
