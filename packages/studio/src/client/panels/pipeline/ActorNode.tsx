/**
 * ActorNode — custom React Flow node for one Crumb actor.
 *
 * Per DESIGN.md §4.6: lane-palette fill, 1.5 px hairline stroke, 8 px
 * radius. Selected state: 2 px primary outline + soft accent halo.
 * Active state (latest agent.wake without a matching agent.stop): green
 * halo + dot so the operator sees which actor is currently running.
 *
 * Hard-coded colors prohibited per DESIGN.md §7 — only token reads.
 * Lane palette resolves via `var(--actor-<actor>)` (see tokens.css §2.4).
 */

import { Handle, Position, type NodeProps } from '@xyflow/react';

interface ActorNodeData extends Record<string, unknown> {
  actor: string;
  label: string;
  /** Set by Pipeline when this actor's latest agent.wake has no paired agent.stop. */
  active?: boolean;
}

export function ActorNode({ data, selected }: NodeProps) {
  const d = data as ActorNodeData;
  const ringColor = selected
    ? 'var(--primary-strong)'
    : d.active
      ? 'var(--tone-pass)'
      : 'var(--hairline-strong)';
  const ringWidth = selected || d.active ? 2 : 1.5;
  const haloShadow = selected
    ? '0 0 0 3px rgba(184,116,45,0.22)'
    : d.active
      ? '0 0 0 3px color-mix(in oklab, var(--tone-pass) 30%, transparent), 0 0 16px color-mix(in oklab, var(--tone-pass) 25%, transparent)'
      : 'none';
  return (
    <div
      style={{
        position: 'relative',
        padding: '10px 14px',
        borderRadius: 'var(--r-md)',
        background: `var(--actor-${d.actor}, var(--surface-2))`,
        color: 'var(--surface-card)',
        border: `${ringWidth}px solid ${ringColor}`,
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        fontWeight: 500,
        textAlign: 'center',
        minWidth: 110,
        boxShadow: haloShadow,
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {d.active && (
        <span
          aria-hidden="true"
          title="active — latest agent.wake without a paired agent.stop"
          style={{
            position: 'absolute',
            top: 4,
            right: 6,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--tone-pass)',
            boxShadow: '0 0 8px var(--tone-pass)',
          }}
        />
      )}
      {/* Forward flow: target on left, source on right (Sugiyama LR). */}
      <Handle
        id="left"
        type="target"
        position={Position.Left}
        style={{ background: 'var(--ink-muted)', width: 6, height: 6 }}
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        style={{ background: 'var(--ink-muted)', width: 6, height: 6 }}
      />
      {/* Right-side TARGET handle (separate id from `right` source).
          Used by terminal merges into the `done` node — incoming edges
          loop around to enter from done's right, reading as "session
          exits here" instead of feeding through to a non-existent
          downstream rank. */}
      <Handle
        id="right-target"
        type="target"
        position={Position.Right}
        style={{
          background: 'var(--ink-muted)',
          width: 6,
          height: 6,
          // Offset slightly so it doesn't overlap the source handle.
          transform: 'translate(0, 12px)',
        }}
      />
      {/* Back / rollback: top handles route the return edge as a clear
          arc OVER the row instead of overlapping the forward edge. */}
      <Handle
        id="top-source"
        type="source"
        position={Position.Top}
        style={{ background: 'var(--ink-tertiary)', width: 6, height: 6 }}
      />
      <Handle
        id="top-target"
        type="target"
        position={Position.Top}
        style={{ background: 'var(--ink-tertiary)', width: 6, height: 6 }}
      />
      {d.label}
    </div>
  );
}
