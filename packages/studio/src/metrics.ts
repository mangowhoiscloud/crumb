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

/**
 * v0.5 PR-O2 — Session-level budget burndown counters.
 *
 * Mirrors the reducer's progress_ledger fields (respec_count, verify_count,
 * session_token_total) without re-importing the reducer (the studio package
 * is a sibling, not a child, of src/). The constants are duplicated; if the
 * reducer caps drift we'll catch it via the e2e test that exercises a full
 * cycle.
 *
 * Why this matters: today the operator can't tell whether a session is
 * about to hit RESPEC_MAX (3) or VERIFY_MAX (5) until the reducer emits
 * `kind=done` with reason=too_many_*. By the time that lands the run has
 * already been spent. Surfacing `*_used / *_max` in the header lets the
 * operator intervene (e.g. /approve a PARTIAL verdict) before the
 * automatic cutoff.
 */
export interface SessionBudget {
  respec_count: number;
  respec_max: number;
  verify_count: number;
  verify_max: number;
  token_total: number;
  token_hard_cap: number;
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
  budget: SessionBudget;
  done: boolean;
}

// Duplicated from src/reducer/index.ts. Both should stay in sync; if the
// reducer raises caps the studio number will lag until this constant is
// bumped — surface drift via the e2e test.
const STUDIO_RESPEC_MAX = 3;
const STUDIO_VERIFY_MAX = 5;
const STUDIO_TOKEN_HARD_CAP_DEFAULT = 300_000;

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

  // v0.5 PR-O2 — budget counters mirrored from the reducer's progress_ledger.
  // We re-derive from transcript instead of importing reducer state because
  // (a) studio is a sibling package that mustn't depend on src/, and
  // (b) reducer state isn't on the SSE wire — but every event that mutates
  //     these counters IS, so a forward scan is sufficient + cheap.
  let respec_count = 0;
  let verify_count = 0;
  let token_total = 0;
  for (const m of transcript) {
    if (m.kind === 'spec.update') respec_count += 1;
    if (m.kind === 'judge.score') verify_count += 1;
    const md = m.metadata ?? {};
    if (typeof md.tokens_in === 'number') token_total += md.tokens_in;
    if (typeof md.tokens_out === 'number') token_total += md.tokens_out;
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

  const tokenHardCap = Number(process.env.CRUMB_TOKEN_BUDGET_HARD) || STUDIO_TOKEN_HARD_CAP_DEFAULT;

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
    budget: {
      respec_count,
      respec_max: STUDIO_RESPEC_MAX,
      verify_count,
      verify_max: STUDIO_VERIFY_MAX,
      token_total,
      token_hard_cap: tokenHardCap,
    },
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
