/**
 * Span derivation — pair `agent.wake` with subsequent `agent.stop` per actor.
 *
 * Pure derivation from a transcript event window; no I/O, no clock reads
 * (passes `now` from caller for in-flight span widths). Used by:
 *   - Waterfall panel — wall-clock bar layout
 *   - ServiceMap panel — edge aggregation (req/s + p50/p95 + error rate)
 *
 * Per AGENTS.md §invariant 1: derivation is reducible. Same input event
 * stream + same `now` timestamp → byte-identical output.
 */

import type { TranscriptEvent } from '../hooks/useTranscriptStream';

export interface Span {
  id: string;
  actor: string;
  startTs: number;
  endTs: number;
  inFlight: boolean;
  errored: boolean;
  qaExitCode: number | null;
  /** ULID of the agent.wake event for click → detail-rail event-detail */
  wakeId: string;
  /** ULID of the agent.stop event when present */
  stopId: string | null;
}

export function deriveSpans(events: TranscriptEvent[], now: number): Span[] {
  const spans: Span[] = [];
  const open = new Map<string, { startTs: number; wakeId: string }>();
  let lastQaExit: number | null = null;

  for (const e of events) {
    const ts = Date.parse(e.ts);
    if (!Number.isFinite(ts)) continue;

    if (e.kind === 'qa.result') {
      const data = e.data as { exec_exit_code?: number } | undefined;
      lastQaExit = typeof data?.exec_exit_code === 'number' ? data.exec_exit_code : lastQaExit;
      continue;
    }

    if (e.kind === 'agent.wake') {
      open.set(e.from, { startTs: ts, wakeId: e.id });
      continue;
    }

    if (e.kind === 'agent.stop') {
      const opened = open.get(e.from);
      if (!opened) continue;
      open.delete(e.from);
      const meta = e.metadata as { latency_ms?: number; exit_code?: number } | undefined;
      const exitCode = typeof meta?.exit_code === 'number' ? meta.exit_code : null;
      spans.push({
        id: `${opened.wakeId}-${e.id}`,
        actor: e.from,
        startTs: opened.startTs,
        endTs: ts,
        inFlight: false,
        errored: exitCode !== null && exitCode !== 0,
        qaExitCode: lastQaExit,
        wakeId: opened.wakeId,
        stopId: e.id,
      });
    }
  }

  // Open spans (no agent.stop yet) — show as in-flight bars at "now".
  for (const [actor, opened] of open) {
    spans.push({
      id: `${opened.wakeId}-inflight`,
      actor,
      startTs: opened.startTs,
      endTs: now,
      inFlight: true,
      errored: false,
      qaExitCode: lastQaExit,
      wakeId: opened.wakeId,
      stopId: null,
    });
  }

  return spans;
}

export interface EdgeStats {
  from: string;
  to: string;
  count: number;
  /** Avg latency from agent.wake of `from` to next agent.wake of `to`. */
  avgLatencyMs: number;
  /** Error rate 0..1 — share of edges where qa.result.exec_exit_code !== 0 */
  errorRate: number;
}

/** Aggregate handoff edges from a span list. */
export function aggregateEdges(spans: Span[]): EdgeStats[] {
  // Sort by startTs so adjacent ordered pairs reflect actual handoffs.
  const ordered = [...spans].sort((a, b) => a.startTs - b.startTs);
  const groups = new Map<string, { count: number; totalLatency: number; errors: number }>();
  for (let i = 0; i < ordered.length - 1; i++) {
    const a = ordered[i];
    const b = ordered[i + 1];
    if (!a || !b) continue;
    if (a.actor === b.actor) continue;
    const key = `${a.actor}→${b.actor}`;
    const cur = groups.get(key) ?? { count: 0, totalLatency: 0, errors: 0 };
    cur.count += 1;
    cur.totalLatency += Math.max(0, b.startTs - a.endTs);
    if (a.errored || (a.qaExitCode !== null && a.qaExitCode !== 0)) cur.errors += 1;
    groups.set(key, cur);
  }
  return Array.from(groups.entries()).map(([key, v]) => {
    const [from, to] = key.split('→') as [string, string];
    return {
      from,
      to,
      count: v.count,
      avgLatencyMs: v.count > 0 ? v.totalLatency / v.count : 0,
      errorRate: v.count > 0 ? v.errors / v.count : 0,
    };
  });
}
