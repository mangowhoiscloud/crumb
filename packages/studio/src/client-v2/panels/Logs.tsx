/**
 * Logs panel — per-actor concatenated spawn-*.log tail.
 *
 * Per migration plan §6 + DESIGN.md. Picks an actor (drop-down derived
 * from active session events), GETs /api/sessions/:id/logs/:actor for
 * the latest snapshot. Live-tail SSE on
 * /api/sessions/:id/logs/:actor/stream lands in M6b.
 *
 * §8.1 quality bar — empty / loading / error states explicit. Uses
 * mono font for log readability (same as v1).
 */

import type { IDockviewPanelProps } from 'dockview-react';
import { useEffect, useMemo, useState } from 'react';
import { useActiveSession } from '../stores/selection';
import { useTranscriptStream } from '../hooks/useTranscriptStream';
import { ALL_ACTORS } from './pipeline/layout';

export function Logs(_props: IDockviewPanelProps) {
  const sessionId = useActiveSession();
  const stream = useTranscriptStream(500);
  const [actor, setActor] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Active actors = those that have agent.wake events in the stream.
  const activeActors = useMemo(() => {
    const set = new Set<string>();
    for (const e of stream.events) {
      if (e.kind === 'agent.wake') set.add(e.from);
    }
    return ALL_ACTORS.filter((a) => set.has(a));
  }, [stream.events]);

  useEffect(() => {
    if (!actor && activeActors.length > 0) setActor(activeActors[0] ?? '');
  }, [activeActors, actor]);

  useEffect(() => {
    if (!sessionId || !actor) {
      setContent('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/sessions/${encodeURIComponent(sessionId)}/logs/${encodeURIComponent(actor)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((t) => {
        if (!cancelled) setContent(t);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, actor]);

  if (!sessionId) return <Empty>Select a session in the sidebar.</Empty>;

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--canvas)',
      }}
    >
      <div
        style={{
          padding: '4px var(--space-3)',
          borderBottom: '1px solid var(--hairline-soft)',
          display: 'flex',
          gap: 'var(--space-2)',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            color: 'var(--ink-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
          }}
        >
          actor
        </span>
        <select
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          disabled={activeActors.length === 0}
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            padding: '4px 8px',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--r-sm)',
            background: 'var(--canvas)',
            color: 'var(--ink)',
          }}
        >
          {activeActors.length === 0 && <option>(no spawned actors yet)</option>}
          {activeActors.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <span style={{ flex: 1 }} />
        {loading && <span style={{ fontSize: 10, color: 'var(--ink-tertiary)' }}>loading…</span>}
      </div>
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 'var(--space-2) var(--space-3)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          color: 'var(--ink)',
        }}
      >
        {error ? (
          <span style={{ color: 'var(--audit-fg)' }}>error: {error}</span>
        ) : content ? (
          content
        ) : (
          <span style={{ color: 'var(--ink-tertiary)' }}>(no log content)</span>
        )}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 'var(--space-4)',
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
        color: 'var(--ink-tertiary)',
        background: 'var(--canvas)',
        height: '100%',
      }}
    >
      {children}
    </div>
  );
}
