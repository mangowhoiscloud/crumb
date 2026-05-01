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
    } else if (req.actor === 'engineering-lead' || req.actor === 'builder-fallback') {
      await writeEngineeringSequence(writer, req, wakeId);
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
    to: 'engineering-lead',
    data: { spec_id: parentId },
  });
}

async function writeEngineeringSequence(
  writer: TranscriptWriter,
  req: SpawnRequest,
  parentId: string,
): Promise<void> {
  for (const step of [
    { kind: 'step.socratic' as const, body: 'mock builder synthesis' },
    { kind: 'step.judge' as const, step: 'grader' as const, body: 'D1=4 D2=5 D3=4 D4=5 D5=4' },
    { kind: 'step.judge' as const, step: 'critic' as const, body: 'D1 too high — AC#3 partial' },
    { kind: 'step.judge' as const, step: 'defender' as const, body: 'AC#3 explicitly v1-only' },
    {
      kind: 'step.judge' as const,
      step: 'regrader' as const,
      body: 'final D1=4 D2=5 D3=4 D4=5 D5=4',
    },
  ]) {
    await writer.append({
      session_id: req.sessionId,
      from: req.actor as Actor,
      parent_event_id: parentId,
      kind: step.kind,
      step: 'step' in step ? step.step : undefined,
      body: step.body,
    });
  }
  await writer.append({
    session_id: req.sessionId,
    from: req.actor as Actor,
    parent_event_id: parentId,
    kind: 'judge.score',
    body: 'mock final scorecard',
    scores: {
      goal_completion: 4,
      collaboration: 5,
      groundedness: 4,
      actionability: 5,
      cost_efficiency: 4,
      aggregate: 22,
      verdict: 'PASS',
      feedback: 'mock — all AC met',
    },
  });
  await writer.append({
    session_id: req.sessionId,
    from: req.actor as Actor,
    parent_event_id: parentId,
    kind: 'verify.result',
    body: 'mock verify result (legacy alias)',
    scores: {
      aggregate: 22,
      verdict: 'PASS',
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
