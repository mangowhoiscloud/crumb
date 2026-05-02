/**
 * MetricsAggregator — pure (transcript) → SessionMetrics. No I/O, no time.
 *
 * Single derivation point that the SSE server publishes alongside append events.
 * The browser can therefore stay dumb (just render the JSON it receives).
 */

import type { DashboardMessage, Verdict } from './types.js';

export interface ActorTotals {
  turns: number;
  tokens_in: number;
  tokens_out: number;
  cache_read: number;
  cost_usd: number;
  latency_ms_total: number;
  events: number;
}

export interface SessionMetrics {
  events: number;
  turns: number;
  tokens_in: number;
  tokens_out: number;
  cache_read: number;
  cache_write: number;
  cost_usd: number;
  cache_ratio: number;
  wall_ms: number;
  latency_p50_ms: number;
  latency_p95_ms: number;
  error_count: number;
  audit_count: number;
  per_actor: Record<string, ActorTotals>;
  last_verdict: Verdict | null;
  last_aggregate: number | null;
  done: boolean;
}

export function computeMetrics(transcript: DashboardMessage[]): SessionMetrics {
  let tokens_in = 0;
  let tokens_out = 0;
  let cache_read = 0;
  let cache_write = 0;
  let cost_usd = 0;
  let turns = 0;
  let error_count = 0;
  let audit_count = 0;
  const latencies: number[] = [];
  const perActor: Record<string, ActorTotals> = {};

  let lastVerdict: Verdict | null = null;
  let lastAggregate: number | null = null;
  let done = false;

  for (const m of transcript) {
    const md = m.metadata;
    let bucket = perActor[m.from];
    if (!bucket) {
      bucket = perActor[m.from] = blank();
    }
    bucket.events += 1;

    if (md) {
      if (typeof md.tokens_in === 'number') {
        tokens_in += md.tokens_in;
        bucket.tokens_in += md.tokens_in;
      }
      if (typeof md.tokens_out === 'number') {
        tokens_out += md.tokens_out;
        bucket.tokens_out += md.tokens_out;
      }
      if (typeof md.cache_read === 'number') {
        cache_read += md.cache_read;
        bucket.cache_read += md.cache_read;
      }
      if (typeof md.cache_write === 'number') cache_write += md.cache_write;
      if (typeof md.cost_usd === 'number') {
        cost_usd += md.cost_usd;
        bucket.cost_usd += md.cost_usd;
      }
      if (typeof md.latency_ms === 'number' && md.latency_ms > 0) {
        latencies.push(md.latency_ms);
        bucket.latency_ms_total += md.latency_ms;
      }
    }
    if (m.kind === 'agent.wake') {
      turns += 1;
      bucket.turns += 1;
    }
    if (m.kind === 'error') error_count += 1;
    if (m.kind === 'audit') audit_count += 1;
    if (m.kind === 'judge.score' || m.kind === 'verify.result') {
      const v = m.scores?.verdict;
      if (v) lastVerdict = v;
      const agg = m.scores?.aggregate;
      if (typeof agg === 'number') lastAggregate = agg;
    }
    if (m.kind === 'done' || m.kind === 'session.end') done = true;
  }

  // Anthropic API conventions:
  //   `usage.input_tokens`               = cache-miss prefix
  //   `usage.cache_read_input_tokens`    = cache hit
  //   `usage.cache_creation_input_tokens`= cache write
  // Hit rate = read / (read + write + miss). The earlier divide-by-`tokens_in`
  // returned 1000%+ when the cached prefix dwarfed the miss tokens.
  const cache_total_input = cache_read + cache_write + tokens_in;
  const cache_ratio = cache_total_input > 0 ? cache_read / cache_total_input : 0;
  let wall_ms = 0;
  if (transcript.length >= 2) {
    const first = Date.parse(transcript[0]!.ts);
    const last = Date.parse(transcript[transcript.length - 1]!.ts);
    if (Number.isFinite(first) && Number.isFinite(last)) wall_ms = Math.max(0, last - first);
  }
  const sorted = [...latencies].sort((a, b) => a - b);

  return {
    events: transcript.length,
    turns,
    tokens_in,
    tokens_out,
    cache_read,
    cache_write,
    cost_usd,
    cache_ratio,
    wall_ms,
    latency_p50_ms: percentile(sorted, 0.5),
    latency_p95_ms: percentile(sorted, 0.95),
    error_count,
    audit_count,
    per_actor: perActor,
    last_verdict: lastVerdict,
    last_aggregate: lastAggregate,
    done,
  };
}

function blank(): ActorTotals {
  return {
    turns: 0,
    tokens_in: 0,
    tokens_out: 0,
    cache_read: 0,
    cost_usd: 0,
    latency_ms_total: 0,
    events: 0,
  };
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * q));
  return sorted[idx] ?? 0;
}

/** v0.3.0 actor lane order — consumed by the swimlane renderer. */
export const ACTOR_LANE_ORDER: string[] = [
  'user',
  'coordinator',
  'planner-lead',
  'researcher',
  'builder',
  'verifier',
  'builder-fallback',
  'validator',
  'system',
];
