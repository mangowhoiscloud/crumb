/**
 * M2 placeholder — sidebar panel container for the brand wordmark + adapters
 * list + sessions list. M3 fills these with real components per §6 mapping.
 *
 * §8.1 quality bar: every panel renders 4 explicit states. M2 placeholders
 * surface only the empty state — real states (loading / error / reconnecting)
 * land alongside the data-bound implementation in M3.
 */

import type { IDockviewPanelProps } from 'dockview-react';

export function Sidebar(_props: IDockviewPanelProps) {
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
      <div style={{ marginBottom: 'var(--space-3)', color: 'var(--ink-muted)' }}>
        <strong>Sidebar (M3)</strong>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, lineHeight: 1.7 }}>
        <li>· Brand mark + CRUMB STUDIO wordmark</li>
        <li>· Adapters list (with auth-detail badges per #161)</li>
        <li>· Sessions list (project-grouped)</li>
        <li>· New-session form (cascading harness → model)</li>
        <li>· ⌘K command palette</li>
      </ul>
    </div>
  );
}
