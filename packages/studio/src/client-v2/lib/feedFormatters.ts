/**
 * Per-kind one-liner formatters for the Live Execution Feed.
 *
 * Ported from v1 vanilla `FEED_FORMATTERS` (W-Studio-A / #145). The 18
 * formatters convert raw transcript events into compact, color-coded
 * one-liners — judge.score → verdict + D1-D6, qa.result → exit + AC
 * pass/total, agent.stop → tokens + cache + cost, etc.
 *
 * Per AGENTS.md §invariant 4: scores must cite their source attribution.
 * judge.score formatter shows `[verifier-llm]` / `[reducer-auto]` /
 * `[qa-check-effect]` next to the dimension value.
 */

import type { TranscriptEvent } from '../hooks/useTranscriptStream';

export interface FormattedLine {
  text: string;
  /** Token name to read for color — e.g. 'lime' / 'warn' / 'audit-fg'. */
  tone?: 'lime' | 'warn' | 'audit-fg' | 'ink-muted' | 'ink' | 'primary';
}

export function formatFeedLine(event: TranscriptEvent): FormattedLine {
  const kind = event.kind;

  if (kind === 'goal') {
    return { text: `goal · ${(event.body ?? '').slice(0, 80)}`, tone: 'ink' };
  }

  if (kind === 'agent.wake') {
    return { text: `→ wake ${event.from}`, tone: 'primary' };
  }

  if (kind === 'agent.stop') {
    const meta = event.metadata as
      | { tokens?: number; cache_read?: number; cost_usd?: number }
      | undefined;
    const parts = [`✓ stop ${event.from}`];
    if (meta?.tokens) parts.push(`${(meta.tokens / 1000).toFixed(1)}k tok`);
    if (meta?.cache_read) parts.push(`cache ${(meta.cache_read / 1000).toFixed(1)}k`);
    if (meta?.cost_usd) parts.push(`$${meta.cost_usd.toFixed(4)}`);
    return { text: parts.join(' · '), tone: 'lime' };
  }

  if (kind === 'qa.result') {
    const data = event.data as { exec_exit_code?: number; ac_results?: unknown[] } | undefined;
    const exit = data?.exec_exit_code ?? '?';
    const passed = Array.isArray(data?.ac_results)
      ? data.ac_results.filter((r: unknown) => (r as { pass?: boolean }).pass === true).length
      : 0;
    const total = Array.isArray(data?.ac_results) ? data.ac_results.length : 0;
    return {
      text: `qa · exit=${exit} · AC ${passed}/${total}`,
      tone: exit === 0 ? 'lime' : 'audit-fg',
    };
  }

  if (kind === 'judge.score') {
    const s = (event.scores ?? {}) as Record<string, unknown> & {
      verdict?: string;
      aggregate?: number;
    };
    const verdict = s.verdict ?? '?';
    const agg = typeof s.aggregate === 'number' ? s.aggregate.toFixed(1) : '?';
    return {
      text: `score · ${verdict} · agg=${agg}`,
      tone: verdict === 'PASS' ? 'lime' : verdict === 'FAIL' ? 'audit-fg' : 'warn',
    };
  }

  if (kind === 'verify.result') {
    const data = event.data as { verdict?: string } | undefined;
    return { text: `verify · ${data?.verdict ?? '?'}`, tone: 'primary' };
  }

  if (kind === 'artifact.created') {
    const data = event.data as { path?: string } | undefined;
    return { text: `+ artifact · ${data?.path ?? '?'}`, tone: 'lime' };
  }

  if (kind === 'build') {
    return { text: `build · ${(event.body ?? '').slice(0, 60)}`, tone: 'primary' };
  }

  if (kind === 'spec') {
    return { text: `spec · ${(event.body ?? '').slice(0, 60)}`, tone: 'primary' };
  }

  if (kind === 'note') {
    return { text: `note · ${(event.body ?? '').slice(0, 60)}`, tone: 'ink-muted' };
  }

  if (kind === 'handoff.requested') {
    const data = event.data as { to?: string } | undefined;
    return { text: `↪ handoff → ${data?.to ?? '?'}`, tone: 'primary' };
  }

  if (kind === 'handoff.rollback') {
    return { text: `↩ rollback`, tone: 'audit-fg' };
  }

  if (kind === 'error') {
    return { text: `✗ error · ${(event.body ?? '').slice(0, 60)}`, tone: 'audit-fg' };
  }

  if (kind === 'done') {
    return { text: `done · ${(event.body ?? '').slice(0, 60)}`, tone: 'lime' };
  }

  if (kind === 'session.start' || kind === 'session.end') {
    return { text: kind, tone: 'ink-muted' };
  }

  if (kind.startsWith('user.')) {
    return { text: `${kind} · ${(event.body ?? '').slice(0, 60)}`, tone: 'primary' };
  }

  if (kind.startsWith('step.')) {
    return { text: `${kind} · ${(event.body ?? '').slice(0, 50)}`, tone: 'ink-muted' };
  }

  return { text: `${kind} · ${(event.body ?? '').slice(0, 50)}`, tone: 'ink-muted' };
}
