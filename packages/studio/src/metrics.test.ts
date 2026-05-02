import { describe, it, expect } from 'vitest';

import { computeMetrics } from './metrics.js';
import type { DashboardMessage } from './types.js';

const m = (over: Partial<DashboardMessage>): DashboardMessage => ({
  id: '01H',
  ts: '2026-05-02T12:00:00.000Z',
  session_id: 's',
  from: 'user',
  kind: 'note',
  ...over,
});

describe('computeMetrics', () => {
  it('returns zeros for empty transcript', () => {
    const r = computeMetrics([]);
    expect(r.events).toBe(0);
    expect(r.tokens_in).toBe(0);
    expect(r.cache_ratio).toBe(0);
    expect(r.last_verdict).toBeNull();
  });

  it('aggregates tokens / cost / cache across events', () => {
    const r = computeMetrics([
      m({
        from: 'planner-lead',
        kind: 'spec',
        metadata: { tokens_in: 1000, tokens_out: 500, cache_read: 800, cost_usd: 0.05 },
      }),
      m({
        from: 'builder',
        kind: 'build',
        metadata: { tokens_in: 2000, tokens_out: 1000, cache_read: 1200, cost_usd: 0.12 },
      }),
    ]);
    expect(r.tokens_in).toBe(3000);
    expect(r.tokens_out).toBe(1500);
    expect(r.cache_read).toBe(2000);
    expect(r.cost_usd).toBeCloseTo(0.17);
    expect(r.cache_ratio).toBeCloseTo(2000 / 3000);
  });

  it('counts errors and audit events', () => {
    const r = computeMetrics([m({ kind: 'error' }), m({ kind: 'audit' }), m({ kind: 'audit' })]);
    expect(r.error_count).toBe(1);
    expect(r.audit_count).toBe(2);
  });

  it('captures last verdict + aggregate from judge.score', () => {
    const r = computeMetrics([
      m({ from: 'verifier', kind: 'judge.score', scores: { aggregate: 22.5, verdict: 'PARTIAL' } }),
      m({ from: 'verifier', kind: 'judge.score', scores: { aggregate: 27.0, verdict: 'PASS' } }),
    ]);
    expect(r.last_verdict).toBe('PASS');
    expect(r.last_aggregate).toBe(27.0);
  });

  it('computes p50 / p95 latency from metadata.latency_ms', () => {
    const events = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((lat) =>
      m({ kind: 'note', metadata: { latency_ms: lat } }),
    );
    const r = computeMetrics(events);
    expect(r.latency_p50_ms).toBeGreaterThanOrEqual(50);
    expect(r.latency_p95_ms).toBeGreaterThanOrEqual(90);
  });

  it('builds per-actor breakdown', () => {
    const r = computeMetrics([
      m({ from: 'planner-lead', kind: 'agent.wake' }),
      m({ from: 'planner-lead', kind: 'spec', metadata: { tokens_in: 1000, cost_usd: 0.04 } }),
      m({ from: 'builder', kind: 'agent.wake' }),
      m({ from: 'builder', kind: 'build', metadata: { tokens_in: 2000, cost_usd: 0.1 } }),
    ]);
    expect(r.per_actor['planner-lead']?.turns).toBe(1);
    expect(r.per_actor['planner-lead']?.tokens_in).toBe(1000);
    expect(r.per_actor['builder']?.tokens_in).toBe(2000);
  });
});
