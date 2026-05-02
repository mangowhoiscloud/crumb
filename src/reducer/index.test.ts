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
    expect(effects).toEqual([
      { type: 'spawn', actor: 'planner-lead', adapter: 'claude-local', sandwich_appends: [] },
    ]);
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
    expect(effects).toEqual([
      { type: 'spawn', actor: 'builder', adapter: 'codex-local', sandwich_appends: [] },
    ]);
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
    expect(effects).toEqual([
      { type: 'spawn', actor: 'verifier', adapter: 'claude-local', sandwich_appends: [] },
    ]);
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

  // v3.2 G1 — 5 user.* event reducer completeness (LangGraph interrupt+Command pattern)

  it('v3.2 G1: user.pause sets progress_ledger.paused=true and emits hook', () => {
    const s0 = initialState('sess-test');
    const pause = fixed({ from: 'user', kind: 'user.pause', body: 'lunch break' });
    const { state, effects } = reduce(s0, pause);

    expect(state.progress_ledger.paused).toBe(true);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ type: 'hook', kind: 'confirm' });
  });

  it('v3.2 G1: while paused, spawn effects are demoted to hook (LangGraph interrupt)', () => {
    const s0 = initialState('sess-test');
    s0.progress_ledger.paused = true;
    const spec = fixed({
      from: 'planner-lead',
      kind: 'spec',
      data: { acceptance_criteria: ['ac1', 'ac2', 'ac3'] },
    });
    const { effects } = reduce(s0, spec);

    // Would have been spawn(builder); paused demotes to hook.
    expect(effects.every((e) => e.type !== 'spawn')).toBe(true);
    expect(effects.find((e) => e.type === 'hook')).toMatchObject({
      type: 'hook',
      data: { actor: 'builder', queued: true, paused: true },
    });
  });

  it('v3.2 G1: user.resume clears paused and re-spawns the queued next_speaker', () => {
    const s0 = initialState('sess-test');
    s0.progress_ledger.paused = true;
    s0.progress_ledger.next_speaker = 'builder';
    const resume = fixed({ from: 'user', kind: 'user.resume' });
    const { state, effects } = reduce(s0, resume);

    expect(state.progress_ledger.paused).toBe(false);
    expect(effects.find((e) => e.type === 'spawn')).toMatchObject({
      type: 'spawn',
      actor: 'builder',
    });
  });

  it('v3.2 G1: user.approve promotes most recent PARTIAL verdict to done', () => {
    const s0 = initialState('sess-test');
    s0.progress_ledger.score_history.push({
      msg_id: '01H0000000000000000000PART',
      aggregate: 19,
      verdict: 'PARTIAL',
    });
    const approve = fixed({ from: 'user', kind: 'user.approve' });
    const { state, effects } = reduce(s0, approve);

    expect(state.done).toBe(true);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ type: 'done' });
    expect((effects[0] as { reason: string }).reason).toContain('user_approve_partial');
  });

  // v3.2 G3 — actor-targeted intervention (AutoGen UserProxyAgent + GroupChatManager pattern)

  it('v3.2 G3: user.intervene with target_actor tags the fact with @<actor>', () => {
    const s0 = initialState('sess-test');
    const ev = fixed({
      from: 'user',
      kind: 'user.intervene',
      body: '콤보 보너스 좀 더 짧게',
      data: { target_actor: 'planner-lead' },
    });
    const { state } = reduce(s0, ev);
    expect(state.task_ledger.facts).toHaveLength(1);
    expect(state.task_ledger.facts[0].text).toContain('@planner-lead');
    expect(state.task_ledger.facts[0].text).toContain('콤보 보너스 좀 더 짧게');
  });

  // v3.2 G6 — LangGraph Command(goto/update) pattern

  it('v3.2 G6: user.intervene with goto forces next_speaker and spawns', () => {
    const s0 = initialState('sess-test');
    const ev = fixed({
      from: 'user',
      kind: 'user.intervene',
      body: 'redo from spec',
      data: { goto: 'planner-lead' },
    });
    const { state, effects } = reduce(s0, ev);
    expect(state.progress_ledger.next_speaker).toBe('planner-lead');
    expect(effects.find((e) => e.type === 'spawn')).toMatchObject({
      type: 'spawn',
      actor: 'planner-lead',
      prompt: 'redo from spec',
    });
  });

  it('v3.2 G6: user.intervene with swap updates adapter_override (Paperclip swap pattern)', () => {
    const s0 = initialState('sess-test');
    const ev = fixed({
      from: 'user',
      kind: 'user.intervene',
      data: { swap: { from: 'builder', to: 'mock' } },
    });
    const { state } = reduce(s0, ev);
    expect(state.progress_ledger.adapter_override.builder).toBe('mock');
  });

  it('v3.2 G6: user.intervene with reset_circuit clears the named breaker', () => {
    const s0 = initialState('sess-test');
    s0.progress_ledger.circuit_breaker.builder = {
      state: 'OPEN',
      consecutive_failures: 3,
    };
    const ev = fixed({
      from: 'user',
      kind: 'user.intervene',
      data: { reset_circuit: 'builder' },
    });
    const { state } = reduce(s0, ev);
    expect(state.progress_ledger.circuit_breaker.builder).toBeUndefined();
  });

  // v3.2 G5 — per-actor pause (Paperclip "pause any agent" pattern)

  it('v3.2 G5: user.pause with data.actor adds to paused_actors only', () => {
    const s0 = initialState('sess-test');
    const ev = fixed({
      from: 'user',
      kind: 'user.pause',
      data: { actor: 'builder' },
    });
    const { state } = reduce(s0, ev);
    expect(state.progress_ledger.paused).toBe(false);
    expect(state.progress_ledger.paused_actors).toContain('builder');
  });

  it("v3.2 G5: per-actor pause demotes only that actor's spawn (others continue)", () => {
    const s0 = initialState('sess-test');
    s0.progress_ledger.paused_actors = ['builder'];
    // spec event would normally spawn builder
    const spec = fixed({
      from: 'planner-lead',
      kind: 'spec',
      data: { acceptance_criteria: ['ac1', 'ac2', 'ac3'] },
    });
    const { effects } = reduce(s0, spec);
    expect(effects.find((e) => e.type === 'spawn')).toBeUndefined();
    const hook = effects.find((e) => e.type === 'hook') as
      | { data?: { scope?: string } }
      | undefined;
    expect(hook?.data?.scope).toBe('actor');
  });

  it('v3.2 G5: per-actor pause does NOT block a different actor', () => {
    const s0 = initialState('sess-test');
    s0.progress_ledger.paused_actors = ['builder']; // builder is paused...
    // ...but goal would spawn planner-lead, not builder
    const goal = fixed({ from: 'user', kind: 'goal', body: 'match-3' });
    const { effects } = reduce(s0, goal);
    expect(effects.find((e) => e.type === 'spawn')).toMatchObject({
      type: 'spawn',
      actor: 'planner-lead',
    });
  });

  it('v3.2 G5: user.resume with data.actor removes only that actor from paused_actors', () => {
    const s0 = initialState('sess-test');
    s0.progress_ledger.paused_actors = ['builder', 'verifier'];
    const ev = fixed({
      from: 'user',
      kind: 'user.resume',
      data: { actor: 'builder' },
    });
    const { state } = reduce(s0, ev);
    expect(state.progress_ledger.paused_actors).toEqual(['verifier']);
  });

  it('v3.2 G5: user.resume without data clears global AND all per-actor pauses', () => {
    const s0 = initialState('sess-test');
    s0.progress_ledger.paused = true;
    s0.progress_ledger.paused_actors = ['builder', 'verifier'];
    s0.progress_ledger.next_speaker = 'verifier';
    const ev = fixed({ from: 'user', kind: 'user.resume' });
    const { state, effects } = reduce(s0, ev);
    expect(state.progress_ledger.paused).toBe(false);
    expect(state.progress_ledger.paused_actors).toEqual([]);
    expect(effects.find((e) => e.type === 'spawn')).toMatchObject({
      type: 'spawn',
      actor: 'verifier',
    });
  });

  // v3.2 G4 — sandwich override (user.intervene with data.sandwich_append)

  it('v3.2 G4: user.intervene with sandwich_append records a sandwich_append fact', () => {
    const s0 = initialState('sess-test');
    const ev = fixed({
      from: 'user',
      kind: 'user.intervene',
      body: 'context drift',
      data: { sandwich_append: 'Always emit kind=note before kind=verify.result.' },
    });
    const { state } = reduce(s0, ev);
    const appends = state.task_ledger.facts.filter((f) => f.category === 'sandwich_append');
    expect(appends).toHaveLength(1);
    expect(appends[0].text).toBe('Always emit kind=note before kind=verify.result.');
    expect(appends[0].target_actor).toBeUndefined();
  });

  it('v3.2 G4: sandwich_append with target_actor scopes to that actor only', () => {
    const s0 = initialState('sess-test');
    // Append scoped to builder
    const ev1 = fixed({
      from: 'user',
      kind: 'user.intervene',
      data: {
        target_actor: 'builder',
        sandwich_append: 'Use Phaser 3.80 only.',
      },
    });
    const { state: s1 } = reduce(s0, ev1);
    // Now spawn builder via spec
    const spec = fixed({
      id: '01H0000000000000000000000B',
      from: 'planner-lead',
      kind: 'spec',
      data: { acceptance_criteria: ['ac1'] },
    });
    const { effects } = reduce(s1, spec);
    const spawn = effects.find((e) => e.type === 'spawn') as
      | { sandwich_appends?: { source_id: string; text: string }[]; actor: string }
      | undefined;
    expect(spawn?.actor).toBe('builder');
    expect(spawn?.sandwich_appends).toHaveLength(1);
    expect(spawn?.sandwich_appends?.[0].text).toBe('Use Phaser 3.80 only.');
  });

  it('v3.2 G4: sandwich_append targeted to builder is NOT included in verifier spawn', () => {
    const s0 = initialState('sess-test');
    const ev1 = fixed({
      from: 'user',
      kind: 'user.intervene',
      data: {
        target_actor: 'builder',
        sandwich_append: 'builder-only note',
      },
    });
    const { state: s1 } = reduce(s0, ev1);
    // qa.result spawns verifier
    const qa = fixed({
      id: '01H0000000000000000000000C',
      from: 'system',
      kind: 'qa.result',
      data: { exec_exit_code: 0, lint_passed: true },
      metadata: { deterministic: true, tool: 'qa-check-effect@v1' },
    });
    const { effects } = reduce(s1, qa);
    const spawn = effects.find((e) => e.type === 'spawn') as
      | { sandwich_appends?: { source_id: string; text: string }[]; actor: string }
      | undefined;
    expect(spawn?.actor).toBe('verifier');
    expect(spawn?.sandwich_appends).toEqual([]);
  });

  it('v3.2 G4: untargeted sandwich_append applies to every actor spawn', () => {
    const s0 = initialState('sess-test');
    const ev = fixed({
      from: 'user',
      kind: 'user.intervene',
      data: { sandwich_append: 'global rule applies everywhere' },
    });
    const { state: s1 } = reduce(s0, ev);
    // Spawn builder
    const spec = fixed({
      id: '01H0000000000000000000000B',
      from: 'planner-lead',
      kind: 'spec',
      data: { acceptance_criteria: ['ac1'] },
    });
    const r1 = reduce(s1, spec);
    const builderSpawn = r1.effects.find((e) => e.type === 'spawn') as
      | { sandwich_appends?: { source_id: string; text: string }[] }
      | undefined;
    expect(builderSpawn?.sandwich_appends).toHaveLength(1);

    // Spawn verifier
    const qa = fixed({
      id: '01H0000000000000000000000C',
      from: 'system',
      kind: 'qa.result',
      data: { exec_exit_code: 0, lint_passed: true },
      metadata: { deterministic: true, tool: 'qa-check-effect@v1' },
    });
    const r2 = reduce(r1.state, qa);
    const verifierSpawn = r2.effects.find((e) => e.type === 'spawn') as
      | { sandwich_appends?: { source_id: string; text: string }[] }
      | undefined;
    expect(verifierSpawn?.sandwich_appends).toHaveLength(1);
    expect(verifierSpawn?.sandwich_appends?.[0].text).toBe('global rule applies everywhere');
  });

  it('v3.2 G4: multiple sandwich_appends accumulate in order', () => {
    const s0 = initialState('sess-test');
    const ev1 = fixed({
      id: '01H0000000000000000000001A',
      from: 'user',
      kind: 'user.intervene',
      data: { target_actor: 'builder', sandwich_append: 'first' },
    });
    const { state: s1 } = reduce(s0, ev1);
    const ev2 = fixed({
      id: '01H0000000000000000000002A',
      from: 'user',
      kind: 'user.intervene',
      data: { target_actor: 'builder', sandwich_append: 'second' },
    });
    const { state: s2 } = reduce(s1, ev2);
    const spec = fixed({
      id: '01H0000000000000000000003A',
      from: 'planner-lead',
      kind: 'spec',
      data: { acceptance_criteria: ['ac1'] },
    });
    const { effects } = reduce(s2, spec);
    const spawn = effects.find((e) => e.type === 'spawn') as
      | { sandwich_appends?: { source_id: string; text: string }[] }
      | undefined;
    expect(spawn?.sandwich_appends).toHaveLength(2);
    expect(spawn?.sandwich_appends?.[0].text).toBe('first');
    expect(spawn?.sandwich_appends?.[1].text).toBe('second');
  });

  it('v3.2 G1: user.approve is no-op when last verdict was PASS or absent', () => {
    const s0 = initialState('sess-test');
    // No score_history
    const approve1 = fixed({ from: 'user', kind: 'user.approve' });
    const r1 = reduce(s0, approve1);
    expect(r1.state.done).toBe(false);
    expect(r1.effects).toHaveLength(0);

    // PASS history
    const s1 = initialState('sess-test');
    s1.progress_ledger.score_history.push({
      msg_id: '01H0000000000000000000PASS',
      aggregate: 28,
      verdict: 'PASS',
    });
    const approve2 = fixed({ from: 'user', kind: 'user.approve' });
    const r2 = reduce(s1, approve2);
    expect(r2.effects).toHaveLength(0);
  });

  it('resets circuit breaker on successful event from previously-failing actor', () => {
    // Simulate the breaker having opened on builder after 3 consecutive errors.
    const s0 = initialState('sess-test');
    s0.progress_ledger.circuit_breaker['builder'] = {
      state: 'OPEN',
      consecutive_failures: 3,
      last_failure_id: '01H0000000000000000000000F',
    };
    // A non-error event from builder (a successful build) should close the breaker.
    const build = fixed({
      id: '01H0000000000000000000000C',
      from: 'builder',
      kind: 'build',
      artifacts: [{ path: 'artifacts/game.html', sha256: 'a'.repeat(64), role: 'src' }],
    });
    const { state } = reduce(s0, build);
    const breaker = state.progress_ledger.circuit_breaker['builder'];
    expect(breaker).toBeDefined();
    expect(breaker?.state).toBe('CLOSED');
    expect(breaker?.consecutive_failures).toBe(0);
    // last_failure_id is preserved for audit / debugging.
    expect(breaker?.last_failure_id).toBe('01H0000000000000000000000F');
  });

  it('does not touch the breaker if no prior failures recorded', () => {
    const s0 = initialState('sess-test');
    const build = fixed({
      id: '01H0000000000000000000000D',
      from: 'builder',
      kind: 'build',
      artifacts: [{ path: 'artifacts/game.html', sha256: 'a'.repeat(64), role: 'src' }],
    });
    const { state } = reduce(s0, build);
    expect(state.progress_ledger.circuit_breaker['builder']).toBeUndefined();
  });
});
