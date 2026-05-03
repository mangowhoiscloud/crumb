/**
 * /crumb status — current session progress + last N events + scores + cost.
 *
 * Read-only. Reads transcript + reduced state.
 *
 * See [[bagelcode-system-architecture-v0.1]] §12 (자연어 보조 장치 5종).
 */

import { DIMENSIONS, type Dimension, type Message } from '../protocol/types.js';
import type { CrumbState } from '../state/types.js';

const SIGNAL_KINDS = new Set<Message['kind']>([
  'goal',
  'spec',
  'spec.update',
  'build',
  'qa.result',
  'verify.result',
  'judge.score',
  'done',
  'error',
  'handoff.requested',
  'handoff.rollback',
  'user.intervene',
  'user.veto',
  'user.approve',
  'user.pause',
  'user.resume',
]);

export interface StatusReport {
  session_id: string;
  goal: string | null;
  done: boolean;
  next_speaker: string | null;
  last_active_actor: string | null;
  stuck_count: number;
  events_total: number;
  recent_events: Array<{
    ts: string;
    elapsed: string;
    from: string;
    kind: string;
    summary: string;
    deterministic: boolean;
  }>;
  latest_score: {
    aggregate?: number;
    verdict?: string;
    cross_provider?: boolean;
    audit_violations: string[];
    dimensions: Record<string, { score: number; source: string }>;
  } | null;
  totals: {
    tokens_in: number;
    tokens_out: number;
    cache_read: number;
    cache_ratio: number;
    cost_usd: number;
    wall_ms: number;
  };
}

export function computeStatus(transcript: Message[], state: CrumbState, limit = 10): StatusReport {
  const t0 = transcript[0] ? Date.parse(transcript[0].ts) : Date.now();
  const recent = transcript
    .filter((m) => SIGNAL_KINDS.has(m.kind))
    .slice(-limit)
    .map((m) => ({
      ts: m.ts,
      elapsed: formatElapsed(Date.parse(m.ts) - t0),
      from: m.from,
      kind: m.kind,
      summary: summarize(m),
      deterministic: m.metadata?.deterministic === true,
    }));

  let tokens_in = 0;
  let tokens_out = 0;
  let cache_read = 0;
  let cost_usd = 0;
  for (const m of transcript) {
    const md = m.metadata;
    if (!md) continue;
    tokens_in += md.tokens_in ?? 0;
    tokens_out += md.tokens_out ?? 0;
    cache_read += md.cache_read ?? 0;
    cost_usd += md.cost_usd ?? 0;
  }

  const judge = findLast(transcript, (m) => m.kind === 'judge.score');
  const latest_score = judge
    ? {
        aggregate: judge.scores?.aggregate,
        verdict: judge.scores?.verdict,
        cross_provider: judge.metadata?.cross_provider,
        audit_violations: judge.scores?.audit_violations ?? judge.metadata?.audit_violations ?? [],
        dimensions: extractDims(judge),
      }
    : null;

  const wall_ms =
    transcript.length >= 2
      ? Date.parse(transcript[transcript.length - 1]!.ts) - Date.parse(transcript[0]!.ts)
      : 0;

  return {
    session_id: state.session_id,
    goal: state.task_ledger.goal,
    done: state.done,
    next_speaker: state.progress_ledger.next_speaker,
    last_active_actor: state.progress_ledger.last_active_actor,
    stuck_count: state.progress_ledger.stuck_count,
    events_total: transcript.length,
    recent_events: recent,
    latest_score,
    totals: {
      tokens_in,
      tokens_out,
      cache_read,
      cache_ratio: tokens_in > 0 ? cache_read / tokens_in : 0,
      cost_usd,
      wall_ms,
    },
  };
}

export function formatStatus(s: StatusReport): string {
  const lines: string[] = [];
  lines.push(`# Crumb status · ${s.session_id}`);
  lines.push('');
  if (s.goal) lines.push(`Goal: ${s.goal}`);
  lines.push(
    `Status: ${s.done ? 'done' : 'in_progress'} · next=${s.next_speaker ?? '?'} · stuck=${s.stuck_count}/5 · events=${s.events_total}`,
  );
  lines.push('');
  lines.push(`## Recent ${s.recent_events.length} events`);
  for (const e of s.recent_events) {
    const star = e.deterministic ? ' ★' : '';
    lines.push(`  [${e.elapsed}] ${pad(e.from, 16)} ${pad(e.kind, 18)} ${e.summary}${star}`);
  }
  lines.push('');
  if (s.latest_score) {
    const cp = s.latest_score.cross_provider ? '✓' : '⚠';
    lines.push(`## Latest judge.score`);
    lines.push(
      `  ${s.latest_score.verdict ?? '—'}  ${s.latest_score.aggregate?.toFixed(1) ?? '—'}/30   cross_provider=${cp}`,
    );
    for (const [k, v] of Object.entries(s.latest_score.dimensions)) {
      lines.push(`  ${k}=${v.score.toFixed(1)} (${v.source})`);
    }
    if (s.latest_score.audit_violations.length > 0) {
      lines.push(`  audit_violations: ${s.latest_score.audit_violations.join(', ')}`);
    }
    lines.push('');
  }
  lines.push(`## Totals`);
  lines.push(
    `  tokens=${s.totals.tokens_in} → ${s.totals.tokens_out} · cache=${Math.round(s.totals.cache_ratio * 100)}% · cost=$${s.totals.cost_usd.toFixed(3)} · wall=${formatElapsed(s.totals.wall_ms)}`,
  );
  return lines.join('\n');
}

function summarize(m: Message): string {
  if (m.body) return truncate(m.body.replace(/\s+/g, ' '), 80);
  if (m.kind === 'qa.result' && m.data) {
    const d = m.data as Record<string, unknown>;
    return `lint=${d.lint_passed ?? '?'} exit=${d.exec_exit_code ?? '?'} phaser=${d.phaser_loaded ?? '?'}`;
  }
  if (m.kind === 'judge.score' && m.scores) {
    return `${m.scores.verdict ?? '—'} ${m.scores.aggregate?.toFixed(1) ?? '—'}/30`;
  }
  return '';
}

function extractDims(m: Message): Record<Dimension, { score: number; source: string }> {
  const out = {} as Record<Dimension, { score: number; source: string }>;
  for (const k of DIMENSIONS) {
    const dim = m.scores?.[k];
    if (dim) out[k] = { score: dim.score, source: dim.source };
  }
  return out;
}

function findLast<T>(arr: T[], pred: (x: T) => boolean): T | undefined {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i]!)) return arr[i];
  }
  return undefined;
}

function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}
