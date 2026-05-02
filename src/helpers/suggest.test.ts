import { describe, expect, it } from 'vitest';

import type { Message } from '../protocol/types.js';
import { initialState } from '../state/types.js';

import { formatSuggestion, suggestNext } from './suggest.js';

function judge(verdict: 'PASS' | 'PARTIAL' | 'FAIL', audit: string[] = []): Message {
  return {
    id: 'j',
    ts: '2026-05-02T12:00:00.000Z',
    session_id: 'sess',
    from: 'verifier',
    kind: 'judge.score',
    scores: { aggregate: 27, verdict, audit_violations: audit },
    metadata: { cross_provider: true },
  };
}

describe('suggestNext', () => {
  it('PASS verdict + clean audit → /approve', () => {
    const state = initialState('sess');
    state.progress_ledger.score_history = [{ msg_id: 'j', aggregate: 27, verdict: 'PASS' }];
    const r = suggestNext([judge('PASS')], state);
    expect(r.primary.action).toContain('approve');
    expect(r.primary.weight).toBe(1.0);
  });

  it('PARTIAL verdict → user judgment branch', () => {
    const state = initialState('sess');
    state.progress_ledger.score_history = [{ msg_id: 'j', aggregate: 22, verdict: 'PARTIAL' }];
    const r = suggestNext([judge('PARTIAL')], state);
    expect(r.primary.action).toContain('redo or /approve');
  });

  it('FAIL verdict → /redo with hint', () => {
    const state = initialState('sess');
    const r = suggestNext([judge('FAIL')], state);
    expect(r.primary.action).toContain('redo');
    expect(r.alternatives.some((a) => a.action.includes('veto'))).toBe(true);
  });

  it('stuck_count >= 5 overrides everything', () => {
    const state = initialState('sess');
    state.progress_ledger.stuck_count = 5;
    const r = suggestNext([judge('PASS')], state);
    expect(r.primary.action).toContain('pause');
    expect(r.alternatives.some((a) => a.action.includes('debug'))).toBe(true);
  });

  it('build pending → wait for qa.result', () => {
    const state = initialState('sess');
    const build: Message = {
      id: 'b',
      ts: '2026-05-02T12:00:00.000Z',
      session_id: 'sess',
      from: 'builder',
      kind: 'build',
    };
    const r = suggestNext([build], state);
    expect(r.primary.action).toContain('qa.result');
  });

  it('question.socratic → answer prompt', () => {
    const state = initialState('sess');
    const q: Message = {
      id: 'q',
      ts: '2026-05-02T12:00:00.000Z',
      session_id: 'sess',
      from: 'planner-lead',
      kind: 'question.socratic',
      body: '색약 친화 팔레트?',
    };
    const r = suggestNext([q], state);
    expect(r.primary.action).toContain('answer');
  });

  it('done state → open summary', () => {
    const state = initialState('sess');
    state.done = true;
    const r = suggestNext([judge('PASS')], state);
    expect(r.primary.action).toContain('summary.html');
  });

  it('formatSuggestion renders primary + alternatives', () => {
    const state = initialState('sess');
    const out = formatSuggestion(suggestNext([judge('PASS')], state));
    expect(out).toContain('Crumb suggest');
    expect(out).toContain('▶');
    expect(out).toContain('alternatives:');
  });
});
