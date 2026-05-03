/**
 * ActorNode — custom React Flow node for one Crumb actor.
 *
 * Per DESIGN.md §4.6: lane-palette fill, 1.5 px hairline stroke, 8 px
 * radius. Selected state: 2 px primary outline + soft accent halo.
 *
 * Hard-coded colors prohibited per DESIGN.md §7 — only token reads.
 * Lane palette resolves via `var(--actor-<actor>)` (see tokens.css §2.4).
 */

import { Handle, Position, type NodeProps } from '@xyflow/react';

interface ActorNodeData extends Record<string, unknown> {
  actor: string;
  label: string;
}

export function ActorNode({ data, selected }: NodeProps) {
  const d = data as ActorNodeData;
  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: 'var(--r-md)',
        background: `var(--actor-${d.actor}, var(--surface-2))`,
        color: 'var(--surface-card)',
        border: selected ? '2px solid var(--primary-strong)' : '1.5px solid var(--hairline-strong)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        fontWeight: 500,
        textAlign: 'center',
        minWidth: 110,
        boxShadow: selected ? '0 0 0 3px rgba(184,116,45,0.22)' : 'none',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: 'var(--ink-muted)', width: 6, height: 6 }}
      />
      {d.label}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: 'var(--ink-muted)', width: 6, height: 6 }}
      />
    </div>
  );
}
