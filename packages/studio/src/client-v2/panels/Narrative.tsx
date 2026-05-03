import type { IDockviewPanelProps } from 'dockview-react';

export function Narrative(_props: IDockviewPanelProps) {
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
      <strong style={{ color: 'var(--ink-muted)' }}>Agent Narrative (M5)</strong>
      <p style={{ marginTop: 'var(--space-3)', lineHeight: 1.7 }}>
        Stream-json bubbles: ⏺ assistant text · ⎿ tool result · ✓ turn complete. Independently
        dockable — drag this tab out into a separate window via dockview's popout (F6 absorbed).
      </p>
    </div>
  );
}
