import type { IDockviewPanelProps } from 'dockview-react';

export function DetailRail(_props: IDockviewPanelProps) {
  return (
    <div
      style={{
        padding: 'var(--space-4)',
        color: 'var(--ink-subtle)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        height: '100%',
        background: 'var(--canvas)',
      }}
    >
      <strong style={{ color: 'var(--ink-muted)' }}>Detail rail (M4 / M6)</strong>
      <p style={{ marginTop: 'var(--space-3)', lineHeight: 1.7 }}>
        Tri-mode panel: (1) event detail (default), (2) node inspector when a Pipeline node is
        selected — binding / metrics / sandwich preview / style override / recent events, (3)
        outlier baseline-vs-selection histograms when a Waterfall band is drag-selected. Also hosts
        the DesignCheckPanel mode in M6 (W3 surface).
      </p>
    </div>
  );
}
