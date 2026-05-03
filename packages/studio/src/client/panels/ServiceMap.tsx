/**
 * Service Map panel — actor → actor handoff aggregation.
 *
 * Per migration plan §6.2 + DESIGN.md (Service Map convention from
 * Datadog APM Service Page): each row is `from → to` with req/s,
 * avg latency, error rate. Hover reveals exact stats; rows sort by
 * count desc.
 *
 * Edge fill encodes traffic; left-rule color encodes error rate
 * (green ≤5% / amber ≤25% / red >25%). Cross-provider tint deferred
 * to M6 when metadata.provider is wired into spans.
 *
 * §8.1 quality bar — empty / loading / streaming states explicit.
 */

import type { IDockviewPanelProps } from 'dockview-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranscriptStream } from '../hooks/useTranscriptStream';
import { useActiveSession } from '../stores/selection';
import { aggregateEdges, deriveSpans, type EdgeStats } from '../lib/spans';

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} m`;
}

function errorTone(errorRate: number): { bg: string; bar: string } {
  if (errorRate > 0.25) return { bg: 'rgba(184,67,28,0.10)', bar: 'var(--audit-fg)' };
  if (errorRate > 0.05) return { bg: 'rgba(196,112,32,0.10)', bar: 'var(--warn)' };
  return { bg: 'transparent', bar: 'var(--lime)' };
}

export function ServiceMap(_props: IDockviewPanelProps) {
  const sessionId = useActiveSession();
  const stream = useTranscriptStream(500);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const edges = useMemo<EdgeStats[]>(() => {
    const spans = deriveSpans(stream.events, now);
    const agg = aggregateEdges(spans);
    return agg.sort((a, b) => b.count - a.count);
  }, [stream.events, now]);

  if (!sessionId) return <Empty>Select a session in the sidebar to see its service map.</Empty>;
  if (edges.length === 0)
    return <Empty>no handoff edges yet — table fills as actors hand off</Empty>;

  const maxCount = Math.max(1, ...edges.map((e) => e.count));

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
        }}
      >
        Service map · {edges.length} edges
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-3)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: 'var(--ink-muted)', textAlign: 'left' }}>
              <th style={th}>handoff</th>
              <th style={th}>count</th>
              <th style={th}>avg latency</th>
              <th style={th}>err</th>
            </tr>
          </thead>
          <tbody>
            {edges.map((e) => {
              const tone = errorTone(e.errorRate);
              const widthPct = (e.count / maxCount) * 100;
              return (
                <tr key={`${e.from}-${e.to}`} style={{ background: tone.bg }}>
                  <td
                    style={{
                      ...td,
                      borderLeft: `2px solid ${tone.bar}`,
                      paddingLeft: 'var(--space-3)',
                    }}
                  >
                    <span style={{ color: `var(--actor-${e.from}, var(--ink))` }}>{e.from}</span>
                    <span style={{ color: 'var(--ink-tertiary)', margin: '0 6px' }}>→</span>
                    <span style={{ color: `var(--actor-${e.to}, var(--ink))` }}>{e.to}</span>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: 'var(--ink)' }}>{e.count}</span>
                      <span
                        style={{
                          width: `${widthPct}%`,
                          maxWidth: 80,
                          height: 4,
                          background: 'var(--surface-2)',
                          borderRadius: 'var(--r-pill)',
                        }}
                      />
                    </div>
                  </td>
                  <td style={{ ...td, color: 'var(--ink-muted)' }}>{formatMs(e.avgLatencyMs)}</td>
                  <td style={{ ...td, color: tone.bar }}>{(e.errorRate * 100).toFixed(0)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
  fontSize: 10,
  padding: '6px var(--space-2)',
  borderBottom: '1px solid var(--hairline-soft)',
};
const td: React.CSSProperties = {
  padding: '6px var(--space-2)',
  borderBottom: '1px solid var(--hairline-soft)',
  whiteSpace: 'nowrap',
};

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
