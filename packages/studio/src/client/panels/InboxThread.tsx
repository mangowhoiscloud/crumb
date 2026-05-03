/**
 * InboxThread — v0.5 Q&A console (3-tier paired thread).
 *
 * Renders every user.intervene/pause/resume/approve/veto from the active
 * session's transcript as a stacked card with three response tiers:
 *
 *   Tier 1 — `kind=ack` paired by `metadata.ack_for=<user.* id>`
 *            Reducer emits within ≤50ms of the user.* line landing.
 *   Tier 2 — `kind=note` paired by `metadata.in_reply_to=<user.* id>`
 *            Only present for `/ask <enum>` commands; ask-formatter
 *            helper runs deterministic state snapshot in ≤500ms.
 *   Tier 3 — actor emissions (build / artifact.created / step.* /
 *            judge.score / handoff.requested / agent.stop / note)
 *            paired by `metadata.consumed_intervene_ids` containing the
 *            user.* id. Drained at next-spawn-start in the reducer.
 *
 * Backed by AGENTS.md §invariant 1 + 7: studio reads transcript only.
 * Pairing is pure derivation — no client-side state writes back.
 *
 * Lives below the dockview pane group + above SlashBar in App.tsx so
 * the user sees their input cards inline with the input box, no panel
 * switching required (the v0.5 design goal — "answer at the question").
 */

import { useMemo, useState } from 'react';
import { useTranscriptStream, type TranscriptEvent } from '../hooks/useTranscriptStream';
import { useActiveSession } from '../stores/selection';

interface ThreadEntry {
  user: TranscriptEvent;
  ack: TranscriptEvent | null;
  reply: TranscriptEvent | null; // /ask <enum> formatter response
  actorEvents: TranscriptEvent[];
}

const ACTOR_EVENT_KINDS = new Set([
  'build',
  'artifact.created',
  'step.builder',
  'step.concept',
  'step.design',
  'step.research',
  'step.research.video',
  'step.judge',
  'step.socratic',
  'spec',
  'spec.update',
  'qa.result',
  'judge.score',
  'verify.result',
  'handoff.requested',
  'handoff.rollback',
  'note',
  'agent.stop',
]);

function buildThread(events: TranscriptEvent[]): ThreadEntry[] {
  const userEvents = events.filter(
    (e) =>
      e.from === 'user' &&
      (e.kind === 'user.intervene' ||
        e.kind === 'user.pause' ||
        e.kind === 'user.resume' ||
        e.kind === 'user.approve' ||
        e.kind === 'user.veto'),
  );
  const byId = new Map<string, ThreadEntry>();
  for (const u of userEvents) {
    byId.set(u.id, { user: u, ack: null, reply: null, actorEvents: [] });
  }
  for (const e of events) {
    const md = (e.metadata ?? {}) as {
      ack_for?: string;
      in_reply_to?: string;
      consumed_intervene_ids?: string[];
    };
    if (e.kind === 'ack' && md.ack_for) {
      const t = byId.get(md.ack_for);
      if (t && !t.ack) t.ack = e;
      continue;
    }
    if (e.kind === 'note' && md.in_reply_to) {
      const t = byId.get(md.in_reply_to);
      if (t && !t.reply) t.reply = e;
      continue;
    }
    if (Array.isArray(md.consumed_intervene_ids) && md.consumed_intervene_ids.length > 0) {
      if (!ACTOR_EVENT_KINDS.has(e.kind)) continue;
      for (const id of md.consumed_intervene_ids) {
        const t = byId.get(id);
        if (!t) continue;
        if (!t.actorEvents.some((x) => x.id === e.id)) t.actorEvents.push(e);
      }
    }
  }
  return [...byId.values()];
}

function formatTime(ts: string): string {
  return ts.slice(11, 19);
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

export function InboxThread() {
  const sessionId = useActiveSession();
  const stream = useTranscriptStream();
  const [openFolds, setOpenFolds] = useState<Set<string>>(new Set());
  const [showHelp, setShowHelp] = useState(false);

  const thread = useMemo(() => (sessionId ? buildThread(stream.events) : []), [stream.events, sessionId]);

  if (!sessionId) return null;

  const toggleFold = (id: string): void => {
    setOpenFolds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      style={{
        maxHeight: 240,
        overflowY: 'auto',
        borderTop: '1px solid var(--hairline)',
        background: 'var(--surface-1)',
        padding: 'var(--space-2) var(--space-3)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 4,
          color: 'var(--ink-subtle)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontSize: 9,
        }}
      >
        <span>Inbox · {thread.length} input{thread.length === 1 ? '' : 's'}</span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          style={{
            fontSize: 9,
            padding: '1px 6px',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--r-pill)',
            background: 'transparent',
            color: 'var(--ink-muted)',
            cursor: 'pointer',
          }}
        >
          {showHelp ? '× help' : '/help'}
        </button>
      </div>

      {showHelp && <HelpCard />}

      {thread.length === 0 && !showHelp && (
        <div style={{ color: 'var(--ink-tertiary)', fontStyle: 'italic', padding: '8px 0' }}>
          your inputs + responses appear here. type a slash command below ↓
        </div>
      )}

      {thread.map((t) => {
        const isFoldOpen = openFolds.has(t.user.id);
        const errored = t.user.kind === 'user.veto';
        return (
          <div
            key={t.user.id}
            style={{
              borderBottom: '1px dashed var(--hairline)',
              padding: '6px 0',
            }}
          >
            <div>
              <span style={{ color: 'var(--ink-tertiary)' }}>[{formatTime(t.user.ts)}]</span>{' '}
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>you</span>{' '}
              <span style={{ color: errored ? 'var(--audit-fg)' : 'var(--ink)' }}>
                {t.user.body ?? `(${t.user.kind})`}
              </span>
            </div>

            {/* Tier 1 — ack tick */}
            {t.ack ? (
              <div style={{ marginLeft: 8, color: 'var(--ink-muted)', fontSize: 10 }}>
                ✓ {t.ack.body ?? 'applied'}
              </div>
            ) : (
              <div style={{ marginLeft: 8, color: 'var(--ink-tertiary)', fontStyle: 'italic', fontSize: 10 }}>
                … awaiting ack
              </div>
            )}

            {/* Tier 2 — /ask formatter reply card */}
            {t.reply && (
              <div
                style={{
                  marginLeft: 8,
                  marginTop: 2,
                  padding: '4px 6px',
                  background: 'var(--surface-2)',
                  borderRadius: 'var(--r-sm)',
                  color: 'var(--ink)',
                }}
              >
                ◆ {t.reply.body}
              </div>
            )}

            {/* Tier 3 — actor responses fold */}
            {t.actorEvents.length > 0 && (
              <div style={{ marginLeft: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => toggleFold(t.user.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--ink-muted)',
                    fontSize: 10,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {isFoldOpen ? '▾' : '▸'} actor responded · {t.actorEvents.length} event
                  {t.actorEvents.length === 1 ? '' : 's'}
                </button>
                {isFoldOpen && (
                  <div style={{ marginLeft: 12, marginTop: 2 }}>
                    {t.actorEvents.map((e) => (
                      <div
                        key={e.id}
                        style={{
                          padding: '2px 4px',
                          fontSize: 10,
                          borderRadius: 'var(--r-sm)',
                        }}
                      >
                        <span style={{ color: 'var(--ink-tertiary)' }}>{formatTime(e.ts)}</span>{' '}
                        <span style={{ color: 'var(--primary)', fontWeight: 500 }}>{e.from}</span>{' '}
                        <span style={{ color: 'var(--ink-muted)' }}>{e.kind}</span>{' '}
                        <span style={{ color: 'var(--ink)' }}>{truncate(e.body ?? '', 100)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HelpCard() {
  const rows: Array<[string, string]> = [
    ['/approve', 'promote PARTIAL verdict to PASS'],
    ['/veto <reason>', 'reject latest verdict, re-spawn last actor'],
    ['/pause [@<a>] [reason]', 'pause global or per-actor'],
    ['/resume [@<a>]', 'resume global or per-actor'],
    ['/goto <a> [body]', 'force next_speaker; body becomes sandwich_append'],
    ['/swap <from>=<to>', 'BYO adapter swap for one actor'],
    ['/append [@<a>] <text>', 'add to next spawn’s sandwich'],
    ['/note <text>', 'record constraint without re-routing'],
    ['/redo [body]', 're-spawn last actor (alias for free-text)'],
    ['/cancel [@<a>]', 'SIGTERM live spawn (lossy mid-build kill)'],
    ['/reset-circuit <a|all>', 'clear circuit breaker'],
    ['/ask <enum>', 'status / cost / next / stuck / scorecard — instant deterministic answer'],
    ['@<actor> <body>', 'scoped sandwich_append for that actor'],
  ];
  return (
    <div
      style={{
        margin: '4px 0 8px 0',
        padding: 8,
        background: 'var(--surface-2)',
        borderRadius: 'var(--r-sm)',
        border: '1px solid var(--hairline)',
        fontSize: 10,
      }}
    >
      {rows.map(([cmd, desc]) => (
        <div key={cmd} style={{ display: 'flex', gap: 8, padding: '1px 0' }}>
          <code
            style={{
              flex: '0 0 200px',
              color: 'var(--ink)',
              background: 'var(--canvas)',
              padding: '0 4px',
              borderRadius: 3,
            }}
          >
            {cmd}
          </code>
          <span style={{ color: 'var(--ink-muted)' }}>{desc}</span>
        </div>
      ))}
    </div>
  );
}
