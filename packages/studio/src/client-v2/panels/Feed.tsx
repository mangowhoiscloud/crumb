/**
 * Live Execution Feed — per-kind one-liner stream of the active session.
 *
 * Per DESIGN.md §4.5 + plan §0.0.1 (vanilla last-call sparklines port).
 * Subscribes via useTranscriptStream; each event runs through
 * formatFeedLine() to produce a compact, color-coded line.
 *
 * Independently dockable via dockview — drag the tab out for a popout
 * window (F6 absorbed per §0.0.2). State preserved across docking.
 *
 * §8.1 quality bar — empty / connecting / streaming / errored states all
 * rendered explicitly. Reduced-motion respected via tokens.css media rule.
 */

import type { IDockviewPanelProps } from 'dockview-react';
import { useEffect, useRef } from 'react';
import { useTranscriptStream } from '../hooks/useTranscriptStream';
import { formatFeedLine } from '../lib/feedFormatters';
import { useActiveSession } from '../stores/selection';

const TONE_COLOR: Record<string, string> = {
  lime: 'var(--lime)',
  warn: 'var(--warn)',
  'audit-fg': 'var(--audit-fg)',
  'ink-muted': 'var(--ink-muted)',
  ink: 'var(--ink)',
  primary: 'var(--primary)',
};

export function Feed(_props: IDockviewPanelProps) {
  const sessionId = useActiveSession();
  const stream = useTranscriptStream(200);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [stream.events.length]);

  if (!sessionId) {
    return <Empty>Select a session in the sidebar to tail its live feed.</Empty>;
  }
  if (stream.status === 'connecting' && stream.events.length === 0) {
    return <Empty>connecting…</Empty>;
  }

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
          alignItems: 'center',
        }}
      >
        <span>Live feed</span>
        <span style={{ color: 'var(--ink-tertiary)' }}>tailing {sessionId.slice(0, 12)}…</span>
        <span style={{ flex: 1 }} />
        <span
          style={{
            color:
              stream.status === 'streaming'
                ? 'var(--lime)'
                : stream.status === 'errored'
                  ? 'var(--audit-fg)'
                  : 'var(--ink-tertiary)',
          }}
        >
          {stream.status}
          {stream.reconnectAttempts > 0 ? ` (retry ${stream.reconnectAttempts})` : ''}
        </span>
      </div>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-2) var(--space-3)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          lineHeight: 1.6,
        }}
      >
        {stream.events.map((evt) => {
          const line = formatFeedLine(evt);
          const tone = line.tone ? (TONE_COLOR[line.tone] ?? 'var(--ink)') : 'var(--ink)';
          const ts = evt.ts.split('T')[1]?.slice(0, 8) ?? '';
          return (
            <div key={evt.id} style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <span style={{ color: 'var(--ink-tertiary)', flex: '0 0 auto' }}>{ts}</span>
              <span
                style={{
                  color: 'var(--ink-subtle)',
                  flex: '0 0 auto',
                  width: 100,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {evt.from}
              </span>
              <span style={{ color: tone, minWidth: 0, flex: 1 }}>{line.text}</span>
            </div>
          );
        })}
        {stream.events.length === 0 && stream.status !== 'connecting' && (
          <div style={{ color: 'var(--ink-tertiary)', padding: 'var(--space-3) 0' }}>
            no events yet — feed updates as the session runs
          </div>
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
