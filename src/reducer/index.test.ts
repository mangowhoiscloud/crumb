import { describe, expect, it } from 'vitest';

import { reduce } from './index.js';
import { initialState } from '../state/types.js';
import type { Message } from '../protocol/types.js';
import { fixedMessage } from '../test-helpers/fixtures.js';

const fixed = (overrides: Partial<Message>): Message => fixedMessage(overrides, 'goal');

describe('reducer', () => {
  it('routes goal → spawn(planner-lead, claude-local)', () => {
    const s0 = initialState('sess-test');
    const goal = fixed({ kind: 'goal', body: 'match-3 game' });
    const { state, effects } = reduce(s0, goal);

    expect(state.task_ledger.goal).toBe('match-3 game');
    expect(state.task_ledger.facts).toHaveLength(1);
    expect(state.progress_ledger.next_speaker).toBe('planner-lead');
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      type: 'spawn',
      actor: 'planner-lead',
      adapter: 'claude-local',
      sandwich_appends: [],
    });
    // v0.3.0: planner-lead spawn carries the goal as kickoff prompt to avoid
    // ambiguous "awaiting input" stalls (run 01KQMCCR6M observability finding).
    expect((effects[0] as { prompt?: string }).prompt).toContain('match-3 game');
    expect((effects[0] as { prompt?: string }).prompt).toContain('Begin your turn');
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

  it('v0.1: routes build → qa_check effect (deterministic, no LLM spawn)', () => {
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

  it('v0.1: routes qa.result → spawn(verifier)', () => {
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
    // Invariant #5: PASS without a preceding qa.result with exec_exit_code=0 is
    // anti-deception flagged. Stash a clean qa.result first to model the real flow.
    const s0 = initialState('sess-test');
    s0.last_qa_result = { build_event_id: 'b1', exec_exit_code: 0 };
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

  it('anti-deception: PASS without qa.result → audit emitted, verdict downgraded', () => {
    // Architecture invariant #5: judge.score with verdict=PASS but no qa.result
    // (or exec_exit_code !== 0) MUST be anti-deception flagged. The reducer
    // appends a kind=audit event AND downgrades verdict to FAIL for routing.
    const s0 = initialState('sess-test'); // no last_qa_result
    const judge = fixed({
      id: '01H0000000000000000000000J',
      from: 'verifier',
      kind: 'judge.score',
      scores: {
        D1: { score: 4, source: 'verifier-llm' },
        D2: { score: 5, source: 'qa-check-effect' },
        D3: { score: 4, source: 'verifier-llm' },
        D4: { score: 5, source: 'reducer-auto' },
        D5: { score: 4, source: 'verifier-llm' },
        D6: { score: 4, source: 'qa-check-effect' },
        aggregate: 26,
        verdict: 'PASS',
      },
    });
    const { state, effects } = reduce(s0, judge);

    const auditEffect = effects.find((e) => e.type === 'append');
    expect(auditEffect).toMatchObject({
      type: 'append',
      message: {
        from: 'validator',
        kind: 'audit',
        parent_event_id: '01H0000000000000000000000J',
        metadata: { deterministic: true, tool: 'anti-deception@v1' },
      },
    });
    // PASS gets downgraded — not done, no done effect.
    expect(state.done).toBe(false);
    expect(effects.some((e) => e.type === 'done')).toBe(false);
  });

  it('anti-deception: PASS with exec_exit_code=1 → D2 forced to 0, FAIL', () => {
    const s0 = initialState('sess-test');
    s0.last_qa_result = { build_event_id: 'b1', exec_exit_code: 1 };
    const judge = fixed({
      id: '01H0000000000000000000000K',
      from: 'verifier',
      kind: 'judge.score',
      scores: {
        D1: { score: 4, source: 'verifier-llm' },
        D2: { score: 5, source: 'qa-check-effect' }, // verifier lied
        aggregate: 26,
        verdict: 'PASS',
      },
    });
    const { effects } = reduce(s0, judge);
    const auditEffect = effects.find((e) => e.type === 'append');
    expect(auditEffect).toBeDefined();
    if (auditEffect && auditEffect.type === 'append') {
      const violations = auditEffect.message.metadata?.audit_violations ?? [];
      expect(violations).toContain('verify_pass_without_exec_zero');
    }
  });

  it('anti-deception: clean qa.result before judge.score does NOT emit audit', () => {
    const s0 = initialState('sess-test');
    s0.last_qa_result = { build_event_id: 'b1', exec_exit_code: 0 };
    const judge = fixed({
      from: 'verifier',
      kind: 'judge.score',
      scores: {
        D1: { score: 5, source: 'verifier-llm' },
        D2: { score: 5, source: 'qa-check-effect' },
        D3: { score: 4, source: 'verifier-llm' },
        D4: { score: 5, source: 'reducer-auto' },
        D5: { score: 4, source: 'verifier-llm' },
        D6: { score: 4, source: 'qa-check-effect' },
        aggregate: 27,
        verdict: 'PASS',
      },
    });
    const { effects } = reduce(s0, judge);
    expect(effects.some((e) => e.type === 'append')).toBe(false);
    expect(effects.some((e) => e.type === 'done')).toBe(true);
  });

  it('anti-deception: step.research.video event ids tracked in state', () => {
    const s0 = initialState('sess-test');
    const v1 = fixed({
      id: '01H000000000000000000000V1',
      from: 'researcher',
      kind: 'step.research.video',
    });
    const v2 = fixed({
      id: '01H000000000000000000000V2',
      from: 'researcher',
      kind: 'step.research.video',
    });
    const s1 = reduce(s0, v1).state;
    const s2 = reduce(s1, v2).state;
    expect(s2.research_video_evidence_ids).toEqual([
      '01H000000000000000000000V1',
      '01H000000000000000000000V2',
    ]);
  });

  it('routes verify.result FAIL deviation=Critical → rollback to planner-lead', () => {
    // PR-G2 — only Critical deviations rollback to planner. Important / Minor
    // (default) respawn the builder with the verifier feedback as a one-shot
    // sandwich_append. Tests for Important/Minor are below.
    const s0 = initialState('sess-test');
    const verify = fixed({
      from: 'verifier',
      kind: 'verify.result',
      scores: {
        aggregate: 12,
        verdict: 'FAIL',
        feedback: 'AC#3 broken',
        deviation: { type: 'Critical' },
      },
    });
    const { state, effects } = reduce(s0, verify);

    expect(state.done).toBe(false);
    expect(effects[0]).toMatchObject({
      type: 'rollback',
      to: 'planner-lead',
      feedback: 'AC#3 broken',
    });
  });

  it('routes verify.result FAIL deviation=Important → respawn builder w/ sandwich_append', () => {
    // PR-G2 — tightly-scoped fixes (e.g. "missing entry redirector") should
    // not burn a full plan-cycle. Builder respawns with verifier feedback +
    // suggested_change injected as a one-shot sandwich_append.
    const s0 = initialState('sess-test');
    const verify = fixed({
      from: 'verifier',
      kind: 'verify.result',
      scores: {
        aggregate: 14,
        verdict: 'FAIL',
        feedback: 'qa-check expects artifacts/game.html',
        deviation: { type: 'Important' },
        suggested_change: 'Add a 1-line redirector at artifacts/game.html',
      },
    });
    const { state, effects } = reduce(s0, verify);

    expect(state.done).toBe(false);
    expect(effects[0]).toMatchObject({ type: 'spawn', actor: 'builder' });
    const append = state.task_ledger.facts.find(
      (f) => f.category === 'sandwich_append' && f.target_actor === 'builder',
    );
    expect(append).toBeDefined();
    expect(append!.text).toContain('Important');
    expect(append!.text).toContain('redirector');
  });

  it('routes verify.result FAIL with no deviation field → defaults to Important (builder respawn)', () => {
    const s0 = initialState('sess-test');
    const verify = fixed({
      from: 'verifier',
      kind: 'verify.result',
      scores: { aggregate: 12, verdict: 'FAIL', feedback: 'AC#3 broken' },
    });
    const { effects } = reduce(s0, verify);
    expect(effects[0]).toMatchObject({ type: 'spawn', actor: 'builder' });
  });

  it('routes verify.result FAIL with builder circuit OPEN → audit + builder-fallback spawn', () => {
    // v0.3.1: agents/builder-fallback.md §"in" promises kind=audit
    // event=fallback_activated as an input the actor reads. Without this
    // emission the sandwich's documented input never arrives.
    //
    // from='verifier' (not 'builder') matters: the reducer's circuit-breaker
    // recovery branch resets the failure streak on any non-error event from
    // the actor whose breaker is OPEN. A verify.result emitted by builder
    // would reset builder's breaker before this case runs. The real flow has
    // verifier emit verify.result/judge.score, so the test mirrors that.
    const s0 = initialState('sess-test');
    s0.progress_ledger.circuit_breaker['builder'] = {
      state: 'OPEN',
      consecutive_failures: 3,
      last_failure_id: '01H0000000000000000000099A',
    };
    const verify = fixed({
      from: 'verifier',
      kind: 'verify.result',
      scores: { aggregate: 12, verdict: 'FAIL', feedback: 'AC#3 broken' },
    });
    const { effects } = reduce(s0, verify);

    // Expect: append(audit fallback_activated) FIRST, then spawn(builder-fallback).
    // Order matters — the audit must land on the transcript before the spawn so
    // the fallback subprocess actually sees it on read.
    const audit = effects.find((e) => e.type === 'append');
    const spawn = effects.find((e) => e.type === 'spawn');
    expect(audit).toBeDefined();
    expect(spawn).toBeDefined();
    expect(effects.indexOf(audit!)).toBeLessThan(effects.indexOf(spawn!));
    if (audit?.type !== 'append') throw new Error('unreachable');
    expect(audit.message).toMatchObject({
      from: 'system',
      kind: 'audit',
      data: {
        event: 'fallback_activated',
        reason: 'builder_circuit_open',
        consecutive_failures: 3,
        last_failure_id: '01H0000000000000000000099A',
      },
    });
    expect(audit.message.metadata).toMatchObject({
      deterministic: true,
      tool: 'reducer-fallback-route@v1',
    });
    expect(spawn).toMatchObject({
      type: 'spawn',
      actor: 'builder-fallback',
      adapter: 'claude-local',
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

  // v0.2.0 G1 — 5 user.* event reducer completeness (LangGraph interrupt+Command pattern)

  it('v0.2.0 G1: user.pause sets progress_ledger.paused=true and emits hook', () => {
    const s0 = initialState('sess-test');
    const pause = fixed({ from: 'user', kind: 'user.pause', body: 'lunch break' });
    const { state, effects } = reduce(s0, pause);

    expect(state.progress_ledger.paused).toBe(true);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ type: 'hook', kind: 'confirm' });
  });

  it('v0.2.0 G1: while paused, spawn effects are demoted to hook (LangGraph interrupt)', () => {
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

  it('v0.2.0 G1: user.resume clears paused and re-spawns the queued next_speaker', () => {
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

  it('v0.2.0 G1: user.approve promotes most recent PARTIAL verdict to done', () => {
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

  // v0.2.0 G3 — actor-targeted intervention (AutoGen UserProxyAgent + GroupChatManager pattern)

  it('v0.2.0 G3: user.intervene with target_actor tags the fact with @<actor>', () => {
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

  it('PR-G7-A: @<actor> body shorthand spawns the actor with body as prompt', () => {
    // Live session 01KQNAK1 inbox had 5 of 6 lines as `@builder ...` shorthand.
    // Old behavior recorded a fact and dropped — actor never woke up. New
    // behavior treats target_actor + body (with no other intent fields) as an
    // explicit spawn request.
    const s0 = initialState('sess-test');
    const ev = fixed({
      from: 'user',
      kind: 'user.intervene',
      body: 'codex 쓰지 말고 claude-local 사용해',
      data: { target_actor: 'builder' },
    });
    const { state, effects } = reduce(s0, ev);
    expect(state.progress_ledger.next_speaker).toBe('builder');
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ type: 'spawn', actor: 'builder' });
    expect((effects[0] as { prompt?: string }).prompt).toContain('codex');
  });

  it('PR-G7-A: @<actor> shorthand respects per-actor pause (no spawn)', () => {
    const s0 = initialState('sess-test');
    s0.progress_ledger.paused_actors = ['builder'];
    const ev = fixed({
      from: 'user',
      kind: 'user.intervene',
      body: 'do it',
      data: { target_actor: 'builder' },
    });
    const { effects } = reduce(s0, ev);
    expect(effects).toHaveLength(0);
  });

  it('PR-G7-A: @<actor> shorthand does NOT spawn when sandwich_append is set (append-only intent)', () => {
    // sandwich_append is the long-lived note pattern; target_actor scopes the
    // append. We must not double-fire (append + spawn) for that intent.
    const s0 = initialState('sess-test');
    const ev = fixed({
      from: 'user',
      kind: 'user.intervene',
      data: {
        target_actor: 'builder',
        sandwich_append: 'always use Phaser.Scale.FIT',
      },
    });
    const { effects } = reduce(s0, ev);
    expect(effects).toHaveLength(0);
  });

  it('PR-G2: handoff.rollback Important → spawn(builder) w/ suggested_change as sandwich_append', () => {
    const s0 = initialState('sess-test');
    const ev = fixed({
      from: 'verifier',
      kind: 'handoff.rollback',
      data: {
        deviation: { type: 'Important' },
        suggested_change: 'Add artifacts/game.html redirector',
      },
    });
    const { state, effects } = reduce(s0, ev);
    expect(effects[0]).toMatchObject({ type: 'spawn', actor: 'builder' });
    const append = state.task_ledger.facts.find(
      (f) => f.category === 'sandwich_append' && f.target_actor === 'builder',
    );
    expect(append?.text).toContain('redirector');
  });

  it('PR-G2: handoff.rollback Critical → spawn(planner-lead)', () => {
    const s0 = initialState('sess-test');
    const ev = fixed({
      from: 'verifier',
      kind: 'handoff.rollback',
      data: { deviation: { type: 'Critical' }, suggested_change: 'AC1 contradicts AC3' },
    });
    const { state, effects } = reduce(s0, ev);
    expect(state.progress_ledger.next_speaker).toBe('planner-lead');
    expect(effects[0]).toMatchObject({ type: 'spawn', actor: 'planner-lead' });
  });

  // v0.2.0 G6 — LangGraph Command(goto/update) pattern

  it('v0.2.0 G6: user.intervene with goto forces next_speaker and spawns', () => {
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

  it('v0.2.0 G6: user.intervene with swap updates adapter_override (Paperclip swap pattern)', () => {
    const s0 = initialState('sess-test');
    const ev = fixed({
      from: 'user',
      kind: 'user.intervene',
      data: { swap: { from: 'builder', to: 'mock' } },
    });
    const { state } = reduce(s0, ev);
    expect(state.progress_ledger.adapter_override.builder).toBe('mock');
  });

  it('v0.2.0 G6: user.intervene with reset_circuit clears the named breaker', () => {
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

  // v0.2.0 G5 — per-actor pause (Paperclip "pause any agent" pattern)

  it('v0.2.0 G5: user.pause with data.actor adds to paused_actors only', () => {
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

  it("v0.2.0 G5: per-actor pause demotes only that actor's spawn (others continue)", () => {
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

  it('v0.2.0 G5: per-actor pause does NOT block a different actor', () => {
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

  it('v0.2.0 G5: user.resume with data.actor removes only that actor from paused_actors', () => {
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

  it('v0.2.0 G5: user.resume without data clears global AND all per-actor pauses', () => {
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

  // v0.2.0 G4 — sandwich override (user.intervene with data.sandwich_append)

  it('v0.2.0 G4: user.intervene with sandwich_append records a sandwich_append fact', () => {
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

  it('v0.2.0 G4: sandwich_append with target_actor scopes to that actor only', () => {
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

  it('v0.2.0 G4: sandwich_append targeted to builder is NOT included in verifier spawn', () => {
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

  it('v0.2.0 G4: untargeted sandwich_append applies to every actor spawn', () => {
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

  it('v0.2.0 G4: multiple sandwich_appends accumulate in order', () => {
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

  it('v0.2.0 G1: user.approve is no-op when last verdict was PASS or absent', () => {
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

  // OpenHands #5500 regression — a chatty user must not mask a broken actor.
  // Cross-frontier evidence: All-Hands-AI/OpenHands #5500 + #5480 documented
  // a stuck-detector that *did* count user messages as activity, locking
  // users out of recovery flows. See
  // wiki/references/bagelcode-nl-intervention-12-systems-2026-05-02.md §4.1
  // (steal: stuck-detector excludes user.* events).

  it('OpenHands #5500: user.intervene does not reset an OPEN circuit breaker', () => {
    const s0 = initialState('sess-test');
    s0.progress_ledger.circuit_breaker['builder'] = {
      state: 'OPEN',
      consecutive_failures: 3,
      last_failure_id: '01H0000000000000000000000F',
    };
    const intervene = fixed({
      id: '01H0000000000000000000000U',
      from: 'user',
      kind: 'user.intervene',
      body: 'try harder',
    });
    const { state } = reduce(s0, intervene);
    const breaker = state.progress_ledger.circuit_breaker['builder'];
    expect(breaker?.state).toBe('OPEN');
    expect(breaker?.consecutive_failures).toBe(3);
    expect(breaker?.last_failure_id).toBe('01H0000000000000000000000F');
  });

  it('OpenHands #5500: user.* events never increment stuck_count', () => {
    const s0 = initialState('sess-test');
    expect(s0.progress_ledger.stuck_count).toBe(0);
    const events = [
      fixed({ id: '01H0000000000000000000U01', from: 'user', kind: 'user.intervene', body: 'a' }),
      fixed({ id: '01H0000000000000000000U02', from: 'user', kind: 'user.veto', body: 'b' }),
      fixed({ id: '01H0000000000000000000U03', from: 'user', kind: 'user.pause' }),
      fixed({ id: '01H0000000000000000000U04', from: 'user', kind: 'user.resume' }),
    ];
    let s = s0;
    for (const e of events) s = reduce(s, e).state;
    expect(s.progress_ledger.stuck_count).toBe(0);
  });

  // v0.3.0 → v0.3.1 — researcher actor routing.
  // v0.3.1 split: pickAdapter('researcher') routes by goal.data.video_refs presence
  // (set in the goal reducer case → state.goal_has_video_refs):
  //   - has video → 'gemini-sdk' (programmatic SDK, frame sampling)
  //   - no video  → 'claude-local' (LLM-driven text research, real wiki refs)
  // Replaces v0.3.0 stub which always returned 'gemini-sdk' even for empty videos.

  it('v0.3.1: handoff.requested(to=researcher) with no video_refs → spawn(researcher, claude-local)', () => {
    const s0 = initialState('sess-test');
    // No prior goal → goal_has_video_refs stays false (initial state default).
    const handoff = fixed({
      from: 'planner-lead',
      kind: 'handoff.requested',
      to: 'researcher',
      data: { phase: 'A', concept_id: '01H0000000000000000000CONC' },
    });
    const { state, effects } = reduce(s0, handoff);

    expect(state.progress_ledger.next_speaker).toBe('researcher');
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      type: 'spawn',
      actor: 'researcher',
      adapter: 'claude-local',
    });
  });

  it('v0.3.1: handoff.requested(to=researcher) with video_refs → spawn(researcher, gemini-sdk)', () => {
    let s = initialState('sess-test');
    // Prime state via a goal event that carries video_refs.
    const goal = fixed({
      kind: 'goal',
      body: 'match-3 with reference videos',
      data: { video_refs: ['https://www.youtube.com/watch?v=abc'] },
    });
    s = reduce(s, goal).state;
    expect(s.goal_has_video_refs).toBe(true);
    const handoff = fixed({
      id: '01H0000000000000000000HND',
      from: 'planner-lead',
      kind: 'handoff.requested',
      to: 'researcher',
    });
    const { effects } = reduce(s, handoff);
    expect(effects[0]).toMatchObject({
      type: 'spawn',
      actor: 'researcher',
      adapter: 'gemini-sdk',
    });
  });

  it('v0.4: handoff.requested(to=other) emits a note (no routing change)', () => {
    const s0 = initialState('sess-test');
    const handoff = fixed({
      from: 'builder',
      kind: 'handoff.requested',
      to: 'coordinator',
    });
    const { state, effects } = reduce(s0, handoff);

    // Routing is still not changed (next_speaker stays null) — but a kind=note
    // append effect is now produced for observability so silent stalls become
    // visible warnings in the transcript.
    expect(state.progress_ledger.next_speaker).toBe(null);
    expect(effects).toHaveLength(1);
    expect(effects[0]!.type).toBe('append');
    const appendEff = effects[0] as {
      type: 'append';
      message: { kind: string; data?: { event?: string } };
    };
    expect(appendEff.message.kind).toBe('note');
    expect(appendEff.message.data?.event).toBe('handoff_unrouted');
  });

  it('v0.3.0: step.research from researcher → resume planner-lead for phase B', () => {
    const s0 = initialState('sess-test');
    const research = fixed({
      from: 'researcher',
      kind: 'step.research',
      body: 'synthesis from 2 video evidence events',
      data: { evidence_kind: 'video' },
    });
    const { state, effects } = reduce(s0, research);

    expect(state.progress_ledger.next_speaker).toBe('planner-lead');
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      type: 'spawn',
      actor: 'planner-lead',
    });
  });

  it('v0.3.0: step.research from planner-lead (legacy inline) is a no-op', () => {
    const s0 = initialState('sess-test');
    const research = fixed({
      from: 'planner-lead',
      kind: 'step.research',
      body: 'pre-v0.3.0 inline-read marker',
    });
    const { state, effects } = reduce(s0, research);

    // Backwards-compat: pre-v0.3.0 transcripts where planner-lead emitted
    // step.research as an inline marker must NOT trigger a phase-B spawn.
    expect(state.progress_ledger.next_speaker).toBe(null);
    expect(effects).toHaveLength(0);
  });

  // ────────────────────────────────────────────────────────────────────
  // v0.4 P1 #6 + #7: circuit breaker dead-end termination
  // ────────────────────────────────────────────────────────────────────

  it('v0.4 P1 #6: judge.score FAIL with builder + builder-fallback both OPEN → done(all_builders_open)', () => {
    const s0 = initialState('sess-test');
    s0.progress_ledger.circuit_breaker['builder'] = {
      state: 'OPEN',
      consecutive_failures: 3,
      last_failure_id: '01HBLDFAIL',
    };
    s0.progress_ledger.circuit_breaker['builder-fallback'] = {
      state: 'OPEN',
      consecutive_failures: 3,
      last_failure_id: '01HFALLFAIL',
    };
    const judge = fixed({
      from: 'verifier',
      kind: 'judge.score',
      scores: { verdict: 'FAIL', aggregate: 4.2, audit_violations: [] },
    });
    const { state, effects } = reduce(s0, judge);

    expect(state.done).toBe(true);
    const doneEff = effects.find((e) => e.type === 'done') as { type: 'done'; reason: string };
    expect(doneEff).toBeDefined();
    expect(doneEff.reason).toBe('all_builders_open');
    // No spawn-builder-fallback effect should slip through.
    expect(effects.find((e) => e.type === 'spawn')).toBeUndefined();
  });

  it('v0.4 P1 #6: judge.score FAIL with only builder OPEN still spawns builder-fallback (regression guard)', () => {
    const s0 = initialState('sess-test');
    s0.progress_ledger.circuit_breaker['builder'] = {
      state: 'OPEN',
      consecutive_failures: 3,
      last_failure_id: '01HBLDFAIL',
    };
    const judge = fixed({
      from: 'verifier',
      kind: 'judge.score',
      scores: { verdict: 'FAIL', aggregate: 4.2, audit_violations: [] },
    });
    const { state, effects } = reduce(s0, judge);

    expect(state.done).toBe(false);
    const spawn = effects.find((e) => e.type === 'spawn') as { type: 'spawn'; actor: string };
    expect(spawn).toBeDefined();
    expect(spawn.actor).toBe('builder-fallback');
  });

  it('v0.4 P1 #7: qa.result with verifier OPEN → done(verifier_unavailable)', () => {
    const s0 = initialState('sess-test');
    s0.progress_ledger.circuit_breaker['verifier'] = {
      state: 'OPEN',
      consecutive_failures: 3,
      last_failure_id: '01HVERIFFAIL',
    };
    const qa = fixed({
      from: 'system',
      kind: 'qa.result',
      data: { exec_exit_code: 0, build_event_id: '01HBUILD' },
    });
    const { state, effects } = reduce(s0, qa);

    expect(state.done).toBe(true);
    const doneEff = effects.find((e) => e.type === 'done') as { type: 'done'; reason: string };
    expect(doneEff).toBeDefined();
    expect(doneEff.reason).toBe('verifier_unavailable');
    // No spawn-verifier effect should slip through.
    expect(effects.find((e) => e.type === 'spawn')).toBeUndefined();
  });
});
