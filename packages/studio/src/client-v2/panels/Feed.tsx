import type { IDockviewPanelProps } from 'dockview-react';

export function Feed(_props: IDockviewPanelProps) {
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
      <strong style={{ color: 'var(--ink-muted)' }}>Live Execution Feed (M5)</strong>
      <p style={{ marginTop: 'var(--space-3)', lineHeight: 1.7 }}>
        Per-kind formatters render adapter spawn / artifact.created / qa.result / judge.score /
        agent.stop into compact one-liners. SSE-driven; grep filter; pause/clear actions.
        Independently dockable — siblings of Agent Narrative in the bottom group.
      </p>
    </div>
  );
}
