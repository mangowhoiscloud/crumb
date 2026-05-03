/**
 * DetailRail — tri-mode right-side panel.
 *
 * Per migration plan §6.1 + DESIGN.md §4.9:
 *   1. event-detail (default — empty placeholder until M6)
 *   2. node-inspector — when a Pipeline node is selected
 *   3. outlier baseline-vs-selection (M4 BubbleUp drag-select — future)
 *
 * M4a (this PR) wires modes 1+2. Mode 3 + DesignCheckPanel mode lands in
 * M6 alongside the W3 surface.
 */

import type { IDockviewPanelProps } from 'dockview-react';
import { useSelectedNodeActor } from '../stores/selection';
import { NodeInspector } from './pipeline/NodeInspector';

export function DetailRail(_props: IDockviewPanelProps) {
  const selectedNode = useSelectedNodeActor();

  if (selectedNode) {
    return <NodeInspector />;
  }

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
        Click a Pipeline node to inspect its identity, binding, and live metrics. Click an event
        chip in Logs / Transcript / Waterfall (M6) to see its detail. Drag-select a Waterfall band
        (M6) for outlier baseline-vs-selection histograms.
      </p>
    </div>
  );
}
