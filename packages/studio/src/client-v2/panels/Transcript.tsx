/**
 * Transcript panel — raw event view (virtualized would be a M6 polish; for
 * now a flat scroll with grep filter).
 *
 * Per migration plan §6 + DESIGN.md §4. Reads from useTranscriptStream
 * (rolling window 500). Filter by kind / from / body substring.
 *
 * §8.1 quality bar — empty / streaming / errored states explicit. No
 * client-side score derivation; all fields rendered verbatim from the
 * server-side schema.
 */

import type { IDockviewPanelProps } from 'dockview-react';
import { useMemo, useState } from 'react';
import { useTranscriptStream } from '../hooks/useTranscriptStream';
import { useActiveSession } from '../stores/selection';

export function Transcript(_props: IDockviewPanelProps) {
  const sessionId = useActiveSession();
  const stream = useTranscriptStream(500);
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    if (!filter) return stream.events;
    const f = filter.toLowerCase();
    return stream.events.filter(
      (e) =>
        e.kind.toLowerCase().includes(f) ||
        e.from.toLowerCase().includes(f) ||
        (e.body ?? '').toLowerCase().includes(f),
    );
  }, [stream.events, filter]);

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
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="grep · kind / from / body"
          style={{
            flex: 1,
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            padding: '4px 8px',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--r-sm)',
            background: 'var(--canvas)',
            color: 'var(--ink)',
          }}
        />
        <span
          style={{ fontSize: 10, color: 'var(--ink-tertiary)', fontFamily: 'var(--font-mono)' }}
        >
          {filtered.length}/{stream.events.length}
        </span>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-2) var(--space-3)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          lineHeight: 1.6,
        }}
      >
        {filtered.map((e) => (
          <div
            key={e.id}
            style={{ display: 'grid', gridTemplateColumns: '78px 110px 1fr', gap: 8 }}
          >
            <span style={{ color: 'var(--ink-tertiary)' }}>{e.ts.split('T')[1]?.slice(0, 12)}</span>
            <span style={{ color: `var(--actor-${e.from}, var(--ink-muted))` }}>{e.from}</span>
            <span style={{ color: 'var(--ink)', minWidth: 0 }}>
              <span style={{ color: 'var(--ink-muted)' }}>{e.kind}</span>
              {e.body ? ' · ' + e.body.slice(0, 200) : ''}
            </span>
          </div>
        ))}
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
