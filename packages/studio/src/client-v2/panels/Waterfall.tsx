/**
 * Waterfall panel — wall-clock spans of `agent.wake → agent.stop` pairs.
 *
 * Per migration plan §6.3 + DESIGN.md §4.7. Bars per actor lane, color
 * = `var(--actor-<actor>)`, errored bars get `var(--audit-fg)` overlay
 * stripe, in-flight spans animate via diagonal stripes.
 *
 * Click bar → DetailRail event-detail mode (M6 wires the actual detail
 * content; for now, falls back to selected-actor → NodeInspector).
 *
 * §8.1 quality bar — empty / loading / streaming states explicit.
 * Hard-coded colors prohibited (token reads only). Reduced-motion
 * collapses the in-flight stripe animation per global rule.
 */

import type { IDockviewPanelProps } from 'dockview-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranscriptStream } from '../hooks/useTranscriptStream';
import { useActiveSession, setSelectedNodeActor } from '../stores/selection';
import { deriveSpans, type Span } from '../lib/spans';
import { ALL_ACTORS } from './pipeline/layout';

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} m`;
}

export function Waterfall(_props: IDockviewPanelProps) {
  const sessionId = useActiveSession();
  const stream = useTranscriptStream(500);
  const [now, setNow] = useState(() => Date.now());

  // Tick `now` every second so in-flight bars grow live.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const spans = useMemo(() => deriveSpans(stream.events, now), [stream.events, now]);

  if (!sessionId) return <Empty>Select a session in the sidebar to see its waterfall.</Empty>;
  if (spans.length === 0)
    return <Empty>no spans yet — bars appear as agent.wake / agent.stop events arrive</Empty>;

  const t0 = Math.min(...spans.map((s) => s.startTs));
  const t1 = Math.max(...spans.map((s) => s.endTs), now);
  const total = Math.max(1, t1 - t0);

  const lanes = ALL_ACTORS.filter((actor) => spans.some((s) => s.actor === actor));

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
          fontSize: 10,
          color: 'var(--ink-muted)',
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.4px',
          borderBottom: '1px solid var(--hairline-soft)',
          display: 'flex',
          gap: 'var(--space-2)',
        }}
      >
        <span>Waterfall</span>
        <span style={{ color: 'var(--ink-tertiary)' }}>
          {spans.length} spans · {formatMs(total)} total
        </span>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        {lanes.map((actor) => (
          <Lane
            key={actor}
            actor={actor}
            spans={spans.filter((s) => s.actor === actor)}
            t0={t0}
            total={total}
          />
        ))}
      </div>
    </div>
  );
}

function Lane({
  actor,
  spans,
  t0,
  total,
}: {
  actor: string;
  spans: Span[];
  t0: number;
  total: number;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '110px 1fr',
        gap: 'var(--space-3)',
        alignItems: 'center',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--ink-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.3px',
          textAlign: 'right',
        }}
      >
        {actor}
      </span>
      <div
        style={{
          position: 'relative',
          height: 18,
          background: 'var(--surface-1)',
          borderRadius: 'var(--r-xs)',
        }}
      >
        {spans.map((s) => {
          const left = ((s.startTs - t0) / total) * 100;
          const width = Math.max(0.5, ((s.endTs - s.startTs) / total) * 100);
          const isQaError = s.qaExitCode !== null && s.qaExitCode !== 0;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedNodeActor(actor)}
              title={`${actor} · ${formatMs(s.endTs - s.startTs)}${s.inFlight ? ' (in flight)' : ''}${isQaError ? ' · qa exit ' + s.qaExitCode : ''}`}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${left}%`,
                width: `${width}%`,
                background: s.errored || isQaError ? 'var(--audit-fg)' : `var(--actor-${actor})`,
                border: '1px solid var(--hairline-strong)',
                borderRadius: 'var(--r-xs)',
                cursor: 'pointer',
                opacity: s.inFlight ? 0.6 : 1,
                padding: 0,
                color: 'var(--surface-card)',
                fontSize: 9,
                fontFamily: 'var(--font-mono)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {width > 4 ? formatMs(s.endTs - s.startTs) : ''}
            </button>
          );
        })}
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
