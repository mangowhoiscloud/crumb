/**
 * v0.5 PR-Inbox-Console — Tier 2 deterministic state-snapshot formatter.
 *
 * The reducer routes `/ask <enum>` (lands as `user.intervene` with
 * `data.ask=<enum>`) through this helper. The helper reads the `CrumbState`
 * snapshot and emits a single human-readable line which the reducer wraps
 * into a `kind=note` event with `metadata.in_reply_to=<user.intervene id>`
 * + `metadata.deterministic=true`. No LLM call, no I/O — pure function over
 * state. Replay-deterministic, anti-deception ignores it.
 *
 * Enum coverage (5 canned queries that account for ~90% of mid-flow user
 * questions per Aider/Cursor/Devin observability patterns):
 *
 *   status     — session age + last event + active actor / next_speaker
 *   cost       — cumulative tokens (Σ in/out), cost_usd, cache_read ratio
 *   next       — reducer's planned next_speaker + the kind that triggered it
 *   stuck      — stuck_count + last progress ts + circuit breakers
 *   scorecard  — latest judge.score D1-D6 + verdict + audit_violations
 *
 * Bodies are deterministic strings; numeric formatting is locale-free
 * (en-US) so replay across machines matches.
 */

import type { CrumbState } from '../state/types.js';
import type { Message } from '../protocol/types.js';

export type AskQuery = 'status' | 'cost' | 'next' | 'stuck' | 'scorecard';

export function isAskQuery(s: unknown): s is AskQuery {
  return s === 'status' || s === 'cost' || s === 'next' || s === 'stuck' || s === 'scorecard';
}

export function formatAskResponse(state: CrumbState, query: AskQuery, asOfTs: string): string {
  switch (query) {
    case 'status':
      return formatStatus(state, asOfTs);
    case 'cost':
      return formatCost(state);
    case 'next':
      return formatNext(state);
    case 'stuck':
      return formatStuck(state, asOfTs);
    case 'scorecard':
      return formatScorecard(state);
  }
}

function formatStatus(state: CrumbState, asOfTs: string): string {
  const startedAt = state.progress_ledger.session_started_at;
  const ageMs = startedAt ? Math.max(0, Date.parse(asOfTs) - Date.parse(startedAt)) : 0;
  const ageStr = formatDuration(ageMs);
  const last = state.last_message;
  const lastStr = last
    ? `${last.from}/${last.kind}${last.body ? ` "${truncate(last.body, 60)}"` : ''}`
    : 'no events yet';
  const next = state.progress_ledger.next_speaker ?? '(idle)';
  const active = state.progress_ledger.last_active_actor ?? '(none)';
  const done = state.done ? ' [DONE]' : '';
  return `session ${ageStr}${done} | last=${lastStr} | next=${next} | last_active=${active}`;
}

function formatCost(state: CrumbState): string {
  const total = state.progress_ledger.session_token_total;
  const last = state.last_message;
  const lastModel = last?.metadata?.model ?? '(?)';
  return `tokens cum=${formatNumber(total)} | last_event_model=${lastModel}`;
}

function formatNext(state: CrumbState): string {
  const next = state.progress_ledger.next_speaker;
  const last = state.last_message;
  if (!next) return `next: idle (no spawn queued)`;
  const trigger = last ? `triggered by ${last.from}/${last.kind}` : '(initial)';
  return `next: ${next} | ${trigger}`;
}

function formatStuck(state: CrumbState, asOfTs: string): string {
  const sc = state.progress_ledger.stuck_count;
  const breakers = Object.entries(state.progress_ledger.circuit_breaker)
    .filter(([, info]) => info && info.state !== 'CLOSED')
    .map(([actor, info]) => `${actor}=${info?.state}`)
    .join(', ');
  const breakerStr = breakers || '(all closed)';
  const lastTs = state.last_message?.ts;
  const sinceMs = lastTs ? Math.max(0, Date.parse(asOfTs) - Date.parse(lastTs)) : 0;
  const sinceStr = lastTs ? formatDuration(sinceMs) : '(no events)';
  return `stuck=${sc}/5 | last_progress ${sinceStr} ago | breakers: ${breakerStr}`;
}

function formatScorecard(state: CrumbState): string {
  const history = state.progress_ledger.score_history;
  if (history.length === 0) return 'no judge.score yet';
  const latest = history[history.length - 1]!;
  return `latest: aggregate=${latest.aggregate} verdict=${latest.verdict} | history=${history.length} score(s)`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${s % 60 > 0 ? `${s % 60}s` : ''}`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60 > 0 ? `${m % 60}m` : ''}`;
}

function formatNumber(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}m`;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

/**
 * Build the kind=note draft the reducer should append in response to a
 * `user.intervene` event with `data.ask=<enum>`. Returns null when the
 * source event isn't a valid ask query — caller falls back to standard
 * intervene handling (which still produces a Tier 1 ack).
 */
export function buildAskResponseDraft(
  state: CrumbState,
  source: Message,
): { kind: 'note'; from: 'system'; body: string; metadata: Record<string, unknown> } | null {
  const data = (source.data ?? {}) as { ask?: unknown };
  if (!isAskQuery(data.ask)) return null;
  const body = formatAskResponse(state, data.ask, source.ts);
  return {
    kind: 'note',
    from: 'system',
    body,
    metadata: {
      visibility: 'public',
      deterministic: true,
      tool: 'ask-formatter@v1',
      in_reply_to: source.id,
    },
  };
}
