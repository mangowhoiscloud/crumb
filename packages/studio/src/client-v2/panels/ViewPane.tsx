import type { IDockviewPanelProps } from 'dockview-react';

export function ViewPane(_props: IDockviewPanelProps) {
  return (
    <div
      style={{
        padding: 'var(--space-5)',
        color: 'var(--ink-subtle)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        height: '100%',
        background: 'var(--canvas)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      <strong style={{ color: 'var(--ink-muted)', fontSize: 13 }}>View pane (M4)</strong>
      <ul style={{ listStyle: 'none', padding: 0, lineHeight: 1.8 }}>
        <li>· Pipeline (interactive React Flow DAG, drag/pan/zoom/click → inspector)</li>
        <li>· Waterfall (wall-clock spans + BubbleUp drag-select outliers)</li>
        <li>· Service Map (edge aggregation: req/s, p50/p95, error rate)</li>
        <li>· Critical-path overlay toggle (shared across all three)</li>
        <li>· Logs / Output / Transcript</li>
      </ul>
      <div style={{ marginTop: 'auto', color: 'var(--ink-tertiary)' }}>
        Tabs above will switch between these views; right-rail Detail panel reflects current
        selection.
      </div>
    </div>
  );
}
