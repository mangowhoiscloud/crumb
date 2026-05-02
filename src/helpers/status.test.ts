import { describe, expect, it } from 'vitest';

import type { Message } from '../protocol/types.js';
import { initialState } from '../state/types.js';

import { computeStatus, formatStatus } from './status.js';

function fixture(): { transcript: Message[]; state: ReturnType<typeof initialState> } {
  const state = initialState('sess');
  state.task_ledger.goal = '60s match-3';
  state.progress_ledger.next_speaker = 'verifier';
  state.progress_ledger.last_active_actor = 'builder';
  state.progress_ledger.stuck_count = 1;
  state.progress_ledger.score_history = [{ msg_id: 'j', aggregate: 27, verdict: 'PASS' }];
  const transcript: Message[] = [
    {
      id: 'a',
      ts: '2026-05-02T12:00:00.000Z',
      session_id: 'sess',
      from: 'user',
      kind: 'goal',
      body: '60s match-3',
    },
    {
      id: 'b',
      ts: '2026-05-02T12:01:00.000Z',
      session_id: 'sess',
      from: 'planner-lead',
      kind: 'spec',
      body: 'spec',
      metadata: { tokens_in: 1000, tokens_out: 400, cache_read: 700, cost_usd: 0.05 },
    },
    {
      id: 'c',
      ts: '2026-05-02T12:02:00.000Z',
      session_id: 'sess',
      from: 'system',
      kind: 'qa.result',
      data: { lint_passed: true, exec_exit_code: 0 },
      metadata: { deterministic: true },
    },
    {
      id: 'j',
      ts: '2026-05-02T12:03:00.000Z',
      session_id: 'sess',
      from: 'verifier',
      kind: 'judge.score',
      scores: {
        D1: { score: 4.5, source: 'verifier-llm' },
        D2: { score: 5, source: 'qa-check-effect' },
        aggregate: 27,
        verdict: 'PASS',
        audit_violations: [],
      },
      metadata: { cross_provider: true },
    },
  ];
  return { transcript, state };
}

describe('computeStatus', () => {
  it('returns last 10 signal events', () => {
    const { transcript, state } = fixture();
    const r = computeStatus(transcript, state);
    expect(r.recent_events).toHaveLength(4);
    expect(r.recent_events[0]!.kind).toBe('goal');
    expect(r.recent_events[3]!.kind).toBe('judge.score');
  });

  it('marks deterministic events', () => {
    const { transcript, state } = fixture();
    const r = computeStatus(transcript, state);
    const qa = r.recent_events.find((e) => e.kind === 'qa.result')!;
    expect(qa.deterministic).toBe(true);
  });

  it('extracts latest_score with dimensions', () => {
    const { transcript, state } = fixture();
    const r = computeStatus(transcript, state);
    expect(r.latest_score?.verdict).toBe('PASS');
    expect(r.latest_score?.cross_provider).toBe(true);
    expect(r.latest_score?.dimensions.D2?.source).toBe('qa-check-effect');
  });

  it('totals aggregate tokens / cache / cost', () => {
    const { transcript, state } = fixture();
    const r = computeStatus(transcript, state);
    expect(r.totals.tokens_in).toBe(1000);
    expect(r.totals.cache_read).toBe(700);
    expect(r.totals.cache_ratio).toBeCloseTo(0.7);
    expect(r.totals.cost_usd).toBeCloseTo(0.05);
  });

  it('formatStatus contains key sections', () => {
    const { transcript, state } = fixture();
    const out = formatStatus(computeStatus(transcript, state));
    expect(out).toContain('Crumb status');
    expect(out).toContain('Recent');
    expect(out).toContain('judge.score');
    expect(out).toContain('cross_provider=✓');
    expect(out).toContain('Totals');
  });

  it('handles empty transcript', () => {
    const r = computeStatus([], initialState('empty'));
    expect(r.events_total).toBe(0);
    expect(r.latest_score).toBeNull();
    expect(r.totals.cost_usd).toBe(0);
  });
});
