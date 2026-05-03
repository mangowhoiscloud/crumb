/**
 * NodeInspector — Detail Rail content when a Pipeline node is selected.
 *
 * Per migration plan §6.1 — identity / live metrics / binding / recent
 * events / agent.wake-stop spans / active session. Reads metrics.per_actor
 * from the SSE state event (server-derived, §17 audit fix — client never
 * recomputes scores or rollups; we just shape the existing fields).
 */

import { useMemo } from 'react';
import {
  setSelectedNodeActor,
  useActiveSession,
  useSelectedNodeActor,
} from '../../stores/selection';
import { useSessions } from '../../hooks/useSessions';
import { useTranscriptStream, type TranscriptEvent } from '../../hooks/useTranscriptStream';

const ACTOR_DESCRIPTIONS: Record<string, string> = {
  user: 'You. Issues the original goal; intervenes via the slash bar.',
  coordinator: 'Host-inline routing (Hub-Ledger-Spoke). Decides next_speaker per event.',
  'planner-lead': 'Spec authoring. Two-phase spawn: Socratic + Concept → Design + Synth.',
  researcher: 'Video evidence extractor. Gemini 3.1 Pro multimodal, 10fps frame sampling.',
  builder: 'Phaser 3.80 multi-file PWA implementer. Emits artifact.created + build.',
  verifier: 'CourtEval (Grader → Critic → Defender → Re-grader). Reads qa.result for D2/D6.',
  validator: 'Anti-deception schema enforcement. D2/D6 forced to 0 on inconsistent verdicts.',
  system: 'Dispatcher heartbeat: spawn / qa.result / hook effects. Never an LLM-driven actor.',
  done: 'Terminal milestone — `kind=done` event lands here once validator audits clean.',
};

interface ActorTotals {
  turns?: number;
  tokens_in?: number;
  tokens_out?: number;
  cache_read?: number;
  cost_usd?: number;
  latency_ms_total?: number;
  events?: number;
}

const RECENT_EVENT_KINDS_PRIORITY = new Set([
  'agent.wake',
  'agent.stop',
  'step.socratic',
  'step.concept',
  'step.research',
  'step.research.video',
  'step.design',
  'step.judge',
  'spec',
  'spec.update',
  'build',
  'qa.result',
  'verify.result',
  'judge.score',
  'handoff.requested',
  'handoff.rollback',
  'note',
  'audit',
  'error',
]);

export function NodeInspector() {
  const actor = useSelectedNodeActor();
  const sessionId = useActiveSession();
  const sessions = useSessions();
  const stream = useTranscriptStream(500);

  const description = (actor && ACTOR_DESCRIPTIONS[actor]) ?? '(no description)';
  const session = sessions.data?.sessions.find((s) => s.session_id === sessionId);
  const perActor = (session?.metrics as { per_actor?: Record<string, ActorTotals> } | undefined)
    ?.per_actor;
  const totals = actor ? perActor?.[actor] : undefined;

  // Latest binding (harness × provider × model) emitted by this actor.
  const binding = useMemo(() => {
    if (!actor) return null;
    for (let i = stream.events.length - 1; i >= 0; i--) {
      const e = stream.events[i]!;
      if (e.from !== actor) continue;
      const md = (e.metadata ?? {}) as {
        harness?: string;
        provider?: string;
        model?: string;
        adapter_session_id?: string;
        cache_carry_over?: boolean;
        cross_provider?: boolean;
      };
      if (md.harness || md.provider || md.model) return md;
    }
    return null;
  }, [stream.events, actor]);

  // Last 8 narrative-grade events from this actor (skip the noisy
  // tool.call stream-json tap so the rail stays readable).
  const recentEvents = useMemo<TranscriptEvent[]>(() => {
    if (!actor) return [];
    const filtered: TranscriptEvent[] = [];
    for (let i = stream.events.length - 1; i >= 0 && filtered.length < 8; i--) {
      const e = stream.events[i]!;
      if (e.from !== actor) continue;
      if (!RECENT_EVENT_KINDS_PRIORITY.has(e.kind)) continue;
      filtered.push(e);
    }
    return filtered;
  }, [stream.events, actor]);

  // agent.wake → agent.stop spans for this actor (latest 5).
  const spans = useMemo(() => {
    if (!actor) return [] as Array<{ wakeTs: string; stopTs: string | null; durationMs: number | null }>;
    const out: Array<{ wakeTs: string; stopTs: string | null; durationMs: number | null }> = [];
    let openWake: TranscriptEvent | null = null;
    for (const e of stream.events) {
      if (e.from !== actor) continue;
      if (e.kind === 'agent.wake') {
        openWake = e;
      } else if (e.kind === 'agent.stop' && openWake) {
        out.push({
          wakeTs: openWake.ts,
          stopTs: e.ts,
          durationMs: new Date(e.ts).getTime() - new Date(openWake.ts).getTime(),
        });
        openWake = null;
      }
    }
    if (openWake) out.push({ wakeTs: openWake.ts, stopTs: null, durationMs: null });
    return out.slice(-5).reverse();
  }, [stream.events, actor]);

  if (!actor) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        padding: 'var(--space-4)',
        height: '100%',
        overflowY: 'auto',
        background: 'var(--canvas)',
      }}
    >
      <Section title="Identity">
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            color: `var(--actor-${actor}, var(--ink))`,
            fontWeight: 600,
          }}
        >
          {actor}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 4, lineHeight: 1.5 }}>
          {description}
        </div>
      </Section>

      <Section title="Live metrics (per-actor)">
        {totals ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 4,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
            }}
          >
            <KV k="turns" v={String(totals.turns ?? 0)} />
            <KV k="events" v={String(totals.events ?? 0)} />
            <KV k="tokens in" v={formatNum(totals.tokens_in)} />
            <KV k="tokens out" v={formatNum(totals.tokens_out)} />
            <KV k="cache read" v={formatNum(totals.cache_read)} />
            <KV k="cost" v={formatCost(totals.cost_usd)} />
            <KV k="latency total" v={formatMs(totals.latency_ms_total)} />
            <KV
              k="last span"
              v={
                spans[0]?.durationMs != null
                  ? formatMs(spans[0].durationMs)
                  : spans[0]
                    ? 'in-flight'
                    : '—'
              }
            />
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>
            no metrics for {actor} yet — appears once the actor emits its first event
          </div>
        )}
      </Section>

      <Section title="Binding (latest)">
        {binding ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 4,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
            }}
          >
            <KV k="harness" v={binding.harness ?? '—'} />
            <KV k="provider" v={binding.provider ?? '—'} />
            <KV k="model" v={binding.model ?? '—'} />
            <KV k="cross-provider" v={binding.cross_provider ? 'yes' : 'no'} />
            {binding.adapter_session_id && (
              <KV k="adapter session" v={binding.adapter_session_id.slice(0, 10) + '…'} />
            )}
            {binding.cache_carry_over !== undefined && (
              <KV k="cache carry-over" v={binding.cache_carry_over ? 'yes' : 'no'} />
            )}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>
            no binding metadata yet — harness × provider × model arrives with the actor's first
            event
          </div>
        )}
      </Section>

      <Section title={`Recent ${actor} events (${recentEvents.length})`}>
        {recentEvents.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>
            no narrative events from {actor} in the rolling window
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
            }}
          >
            {recentEvents.map((e) => (
              <div
                key={e.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 90px 1fr',
                  gap: 6,
                  alignItems: 'baseline',
                  paddingBottom: 4,
                  borderBottom: '1px solid var(--hairline-soft)',
                }}
              >
                <span style={{ color: 'var(--ink-tertiary)' }}>
                  {e.ts.split('T')[1]?.slice(0, 8)}
                </span>
                <span style={{ color: 'var(--ink-muted)' }}>{e.kind}</span>
                <span
                  style={{
                    color: 'var(--ink)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {e.body ? truncate(e.body, 80) : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="agent.wake → stop spans (last 5)">
        {spans.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>no spawn pairs yet</div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
            }}
          >
            {spans.map((s, i) => (
              <div
                key={`${s.wakeTs}-${i}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '70px 1fr',
                  gap: 8,
                  color: 'var(--ink)',
                }}
              >
                <span style={{ color: 'var(--ink-muted)' }}>
                  {s.wakeTs.split('T')[1]?.slice(0, 8)}
                </span>
                <span>
                  {s.stopTs ? (
                    <>
                      <span style={{ color: 'var(--ink-tertiary)' }}>↦</span>{' '}
                      {s.stopTs.split('T')[1]?.slice(0, 8)}
                      <span style={{ color: 'var(--ink-muted)', marginLeft: 8 }}>
                        {formatMs(s.durationMs ?? 0)}
                      </span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--tone-pass)' }}>in-flight…</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {session && (
        <Section title="Active session">
          <div style={{ fontSize: 11 }}>
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
              {session.session_id.slice(0, 12)}…
            </div>
            <div style={{ color: 'var(--ink)', marginTop: 4 }}>
              {session.goal ?? '(no goal yet)'}
            </div>
            {session.derived_state && (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--ink-subtle)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                }}
              >
                state: {session.derived_state}
                {session.derived_state_reason ? ` · ${session.derived_state_reason}` : ''}
              </div>
            )}
          </div>
        </Section>
      )}

      <button
        type="button"
        onClick={() => setSelectedNodeActor(null)}
        style={{
          alignSelf: 'flex-start',
          background: 'transparent',
          border: '1px solid var(--hairline)',
          color: 'var(--ink-muted)',
          fontSize: 11,
          padding: '4px 10px',
          borderRadius: 'var(--r-sm)',
          cursor: 'pointer',
        }}
      >
        ← back to event detail
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3
        style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.4px',
          color: 'var(--ink-muted)',
          fontWeight: 600,
          margin: 0,
          marginBottom: 'var(--space-2)',
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <>
      <span style={{ color: 'var(--ink-muted)' }}>{k}</span>
      <span style={{ color: 'var(--ink)', textAlign: 'right' }}>{v}</span>
    </>
  );
}

function formatNum(n?: number): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatCost(n?: number): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `$${n.toFixed(3)}`;
}

function formatMs(ms?: number): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}
