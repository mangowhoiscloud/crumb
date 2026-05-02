import { describe, expect, it } from 'vitest';

import { reduce } from './index.js';
import { initialState } from '../state/types.js';
import type { Message } from '../protocol/types.js';

const fixed = (overrides: Partial<Message>): Message => ({
  id: '01H0000000000000000000000A',
  ts: '2026-05-01T00:00:00.000Z',
  session_id: 'sess-test',
  from: 'user',
  kind: 'goal',
  ...overrides,
});

describe('reducer', () => {
  it('routes goal → spawn(planner-lead, claude-local)', () => {
    const s0 = initialState('sess-test');
    const goal = fixed({ kind: 'goal', body: 'match-3 game' });
    const { state, effects } = reduce(s0, goal);

    expect(state.task_ledger.goal).toBe('match-3 game');
    expect(state.task_ledger.facts).toHaveLength(1);
    expect(state.progress_ledger.next_speaker).toBe('planner-lead');
    expect(effects).toEqual([{ type: 'spawn', actor: 'planner-lead', adapter: 'claude-local' }]);
  });

  it('routes spec → spawn(builder, codex-local) by default', () => {
    const s0 = initialState('sess-test');
    const spec = fixed({
      from: 'planner-lead',
      kind: 'spec',
      data: { acceptance_criteria: ['ac1', 'ac2', 'ac3'] },
    });
    const { state, effects } = reduce(s0, spec);

    expect(state.task_ledger.acceptance_criteria).toEqual(['ac1', 'ac2', 'ac3']);
    expect(state.task_ledger.facts).toHaveLength(3);
    expect(effects).toEqual([{ type: 'spawn', actor: 'builder', adapter: 'codex-local' }]);
  });

  it('v3: routes build → qa_check effect (deterministic, no LLM spawn)', () => {
    const s0 = initialState('sess-test');
    const build = fixed({
      id: '01H0000000000000000000000B',
      from: 'builder',
      kind: 'build',
      artifacts: [{ path: 'artifacts/game.html', sha256: 'a'.repeat(64), role: 'src' }],
    });
    const { effects } = reduce(s0, build);

    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      type: 'qa_check',
      artifact: 'artifacts/game.html',
      build_event_id: '01H0000000000000000000000B',
      artifact_sha256: 'a'.repeat(64),
    });
  });

  it('v3: routes qa.result → spawn(verifier)', () => {
    const s0 = initialState('sess-test');
    const qaResult = fixed({
      id: '01H0000000000000000000000C',
      from: 'system',
      kind: 'qa.result',
      data: { exec_exit_code: 0, lint_passed: true },
      metadata: { deterministic: true, tool: 'qa-check-effect@v1' },
    });
    const { state, effects } = reduce(s0, qaResult);

    expect(state.progress_ledger.next_speaker).toBe('verifier');
    expect(effects).toEqual([{ type: 'spawn', actor: 'verifier', adapter: 'claude-local' }]);
  });

  it('routes spec → builder-fallback when codex circuit OPEN', () => {
    const s0 = initialState('sess-test');
    s0.progress_ledger.circuit_breaker['builder'] = {
      state: 'OPEN',
      consecutive_failures: 3,
    };
    const spec = fixed({
      from: 'planner-lead',
      kind: 'spec',
      data: { acceptance_criteria: ['ac1'] },
    });
    const { effects } = reduce(s0, spec);

    expect(effects[0]).toMatchObject({
      type: 'spawn',
      actor: 'builder',
      adapter: 'claude-local',
    });
  });

  it('routes verify.result PASS → done', () => {
    const s0 = initialState('sess-test');
    const verify = fixed({
      from: 'builder',
      kind: 'verify.result',
      scores: { aggregate: 25, verdict: 'PASS' },
    });
    const { state, effects } = reduce(s0, verify);

    expect(state.done).toBe(true);
    expect(state.progress_ledger.score_history).toHaveLength(1);
    expect(effects).toEqual([{ type: 'done', reason: 'verdict_pass' }]);
  });

  it('routes verify.result FAIL → rollback to planner-lead', () => {
    const s0 = initialState('sess-test');
    const verify = fixed({
      from: 'builder',
      kind: 'verify.result',
      scores: { aggregate: 12, verdict: 'FAIL', feedback: 'AC#3 broken' },
    });
    const { state, effects } = reduce(s0, verify);

    expect(state.done).toBe(false);
    expect(effects[0]).toMatchObject({
      type: 'rollback',
      to: 'planner-lead',
      feedback: 'AC#3 broken',
    });
  });

  it('verify.result PARTIAL → hook(partial)', () => {
    const s0 = initialState('sess-test');
    const verify = fixed({
      from: 'builder',
      kind: 'verify.result',
      scores: { aggregate: 20, verdict: 'PARTIAL' },
    });
    const { effects } = reduce(s0, verify);

    expect(effects[0]).toMatchObject({ type: 'hook', kind: 'partial' });
  });

  it('adaptive stop fires when score variance < 1.0 over 2 rounds', () => {
    const s0 = initialState('sess-test');
    s0.progress_ledger.score_history = [{ msg_id: 'm1', aggregate: 22, verdict: 'PARTIAL' }];
    const verify = fixed({
      from: 'builder',
      kind: 'verify.result',
      scores: { aggregate: 22.3, verdict: 'PARTIAL' },
    });
    const { state, effects } = reduce(s0, verify);

    expect(state.done).toBe(true);
    expect(effects).toEqual([{ type: 'done', reason: 'adaptive_stop' }]);
  });

  it('error from builder trips circuit breaker after 3 failures', () => {
    let state = initialState('sess-test');
    for (let i = 0; i < 3; i++) {
      const err = fixed({
        id: `01H000000000000000000000${i}A`,
        from: 'builder',
        kind: 'error',
      });
      state = reduce(state, err).state;
    }
    expect(state.progress_ledger.circuit_breaker['builder']?.state).toBe('OPEN');
  });

  it('user.intervene records constraint without changing speaker', () => {
    const s0 = initialState('sess-test');
    s0.progress_ledger.next_speaker = 'builder';
    const intervene = fixed({
      from: 'user',
      kind: 'user.intervene',
      body: 'use only red/green palette',
    });
    const { state, effects } = reduce(s0, intervene);

    expect(state.task_ledger.facts.some((f) => f.category === 'constraint')).toBe(true);
    expect(state.progress_ledger.next_speaker).toBe('builder');
    expect(effects).toEqual([]);
  });

  it('determinism: replaying same events produces same state', () => {
    const events: Message[] = [
      fixed({ kind: 'goal', body: 'g' }),
      fixed({
        id: '01H0000000000000000000001A',
        from: 'planner-lead',
        kind: 'spec',
        data: { acceptance_criteria: ['ac'] },
      }),
      fixed({
        id: '01H0000000000000000000002A',
        from: 'builder',
        kind: 'verify.result',
        scores: { aggregate: 25, verdict: 'PASS' },
      }),
    ];
    const replay = (): ReturnType<typeof reduce>['state'] => {
      let s = initialState('sess-test');
      for (const e of events) s = reduce(s, e).state;
      return s;
    };
    const a = replay();
    const b = replay();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
