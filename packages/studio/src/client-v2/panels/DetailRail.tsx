/**
 * DetailRail — quad-mode right-side panel.
 *
 * Per migration plan §6.1 + §6.7 + DESIGN.md §4.9:
 *   1. node-inspector — when a Pipeline node is selected (highest precedence)
 *   2. design-check  — when active session has a qa.result carrying a
 *                      `design_check` block (W3 surface)
 *   3. event-detail  — default placeholder for individual event drill-down
 *   4. outlier baseline-vs-selection — M4 BubbleUp drag-select (future)
 *
 * M6c (this PR) wires mode 2 on top of M4a's modes 1+3. Mode 4 arrives
 * with the Waterfall drag-select interaction.
 */

import { useMemo } from 'react';
import type { IDockviewPanelProps } from 'dockview-react';
import { useSelectedNodeActor, useActiveSession } from '../stores/selection';
import { useTranscriptStream } from '../hooks/useTranscriptStream';
import { NodeInspector } from './pipeline/NodeInspector';
import { DesignCheckPanel } from './DesignCheckPanel';

export function DetailRail(_props: IDockviewPanelProps) {
  const selectedNode = useSelectedNodeActor();
  const sessionId = useActiveSession();
  const stream = useTranscriptStream(500);

  const hasDesignCheck = useMemo(() => {
    if (!sessionId) return false;
    for (let i = stream.events.length - 1; i >= 0; i--) {
      const e = stream.events[i]!;
      if (e.kind !== 'qa.result') continue;
      const data = (e.data ?? {}) as Record<string, unknown>;
      if (data.design_check && typeof data.design_check === 'object') return true;
    }
    return false;
  }, [stream.events, sessionId]);

  if (selectedNode) return <NodeInspector />;
  if (hasDesignCheck) return <DesignCheckPanel />;

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
      <strong style={{ color: 'var(--ink-muted)' }}>Detail rail</strong>
      <p style={{ marginTop: 'var(--space-3)', lineHeight: 1.7 }}>
        Click a Pipeline node to inspect its identity, binding, and live metrics. Once a qa.result
        event with a <code>design_check</code> block lands, this rail switches to the design-check
        audit (palette / touch / motion). Drag-select a Waterfall band (future) for outlier
        baseline-vs-selection histograms.
      </p>
    </div>
  );
}
