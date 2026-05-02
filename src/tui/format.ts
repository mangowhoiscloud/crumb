/**
 * TUI row / status formatters — pure string functions, vitest-friendly.
 *
 * blessed mounts these into list/box widgets. Keeping format pure means we can
 * test color codes + truncation without spinning up a screen.
 */

import type { Actor, Message } from '../protocol/types.js';
import type { CrumbState } from '../state/types.js';

/** ANSI 256-color hex → nearest blessed color tag. CDS v1 1:1 mapping. */
const ACTOR_TAG: Record<Actor, string> = {
  user: 'white',
  coordinator: 'green',
  'planner-lead': 'blue',
  researcher: 'cyan',
  builder: 'magenta',
  verifier: 'yellow',
  'builder-fallback': 'red',
  validator: 'gray',
  system: 'gray',
};

const ACTOR_GLYPH: Record<Actor, string> = {
  user: '👤',
  coordinator: '🟢',
  'planner-lead': '🔵',
  researcher: '🔍',
  builder: '🟣',
  verifier: '🟠',
  'builder-fallback': '🌹',
  validator: '⚙',
  system: '⚙',
};

/** One timeline row: `[mm:ss] glyph actor kind body★` with blessed color tags. */
export function formatRow(msg: Message, t0Ms: number): string {
  const elapsedMs = Math.max(0, Date.parse(msg.ts) - t0Ms);
  const ts = formatElapsed(elapsedMs);
  const tag = ACTOR_TAG[msg.from] ?? 'gray';
  const glyph = ACTOR_GLYPH[msg.from] ?? '·';
  const det = msg.metadata?.deterministic ? '{yellow-fg}★{/}' : '';
  const cp = msg.metadata?.cross_provider === false ? '{red-fg}⚠{/}' : '';
  const audit = (msg.metadata?.audit_violations?.length ?? 0) > 0 ? '{red-fg}!{/}' : '';
  const body = msg.body ?? summarizeData(msg);
  const truncated = truncate(body.replace(/\s+/g, ' '), 80);
  return `{gray-fg}[${ts}]{/} ${glyph} {${tag}-fg}${pad(msg.from, 14)}{/} {gray-fg}${pad(msg.kind, 18)}{/} ${truncated}${det}${cp}${audit}`;
}

/** Status footer: cost / cache / stuck / wall / scores. Single line. */
export function formatStatus(state: CrumbState, transcript: Message[]): string {
  const totals = transcript.reduce(
    (acc, m) => {
      const md = m.metadata;
      if (!md) return acc;
      acc.tokens_in += md.tokens_in ?? 0;
      acc.cache_read += md.cache_read ?? 0;
      acc.cost_usd += md.cost_usd ?? 0;
      return acc;
    },
    { tokens_in: 0, cache_read: 0, cost_usd: 0 },
  );
  const cacheRatio = totals.tokens_in > 0 ? totals.cache_read / totals.tokens_in : 0;
  const wall =
    transcript.length >= 2
      ? Date.parse(transcript[transcript.length - 1]!.ts) - Date.parse(transcript[0]!.ts)
      : 0;
  const lastScore =
    state.progress_ledger.score_history[state.progress_ledger.score_history.length - 1];
  const verdictLabel = lastScore ? `${lastScore.verdict} ${lastScore.aggregate.toFixed(1)}` : '—';
  const verdictColor =
    lastScore?.verdict === 'PASS' ? 'green' : lastScore?.verdict === 'FAIL' ? 'red' : 'yellow';
  return [
    `Cost {bold}${'$' + totals.cost_usd.toFixed(3)}{/}`,
    `Cache {bold}${Math.round(cacheRatio * 100)}%{/}`,
    `Stuck ${state.progress_ledger.stuck_count}/5`,
    `Wall ${formatElapsed(wall)}`,
    `Verdict {${verdictColor}-fg}${verdictLabel}{/}`,
  ].join(' · ');
}

/** Per-actor + adapter pane: name → harness/model. */
export function formatActorList(transcript: Message[]): string[] {
  const seen = new Map<Actor, { harness?: string; model?: string }>();
  for (const m of transcript) {
    if (m.from === 'user' || m.from === 'system') continue;
    if (!seen.has(m.from)) {
      seen.set(m.from, { harness: m.metadata?.harness, model: m.metadata?.model });
    }
  }
  return [...seen.entries()].map(([actor, b]) => {
    const tag = ACTOR_TAG[actor];
    const glyph = ACTOR_GLYPH[actor];
    return `${glyph} {${tag}-fg}${pad(actor, 14)}{/} {gray-fg}${b.harness ?? '?'}/${b.model ?? '?'}{/}`;
  });
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

function pad(s: string, n: number): string {
  if (s.length >= n) return s.slice(0, n);
  return s + ' '.repeat(n - s.length);
}

function summarizeData(m: Message): string {
  if (m.kind === 'qa.result' && m.data) {
    const d = m.data as Record<string, unknown>;
    return `lint=${d.lint_passed ?? '?'} exit=${d.exec_exit_code ?? '?'} phaser=${d.phaser_loaded ?? '?'}`;
  }
  if (m.kind === 'judge.score' && m.scores) {
    return `${m.scores.verdict ?? '—'} ${m.scores.aggregate?.toFixed(1) ?? '—'}/30`;
  }
  return '';
}
