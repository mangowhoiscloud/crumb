/**
 * StickyNoteNode — n8n-style annotation card for the Pipeline canvas.
 *
 * Per migration plan §6.1 + M9 (n8n parity polish). Each sticky carries
 * editable text, persists with the layout, and renders as a soft
 * cream / brown card distinct from actor nodes (no Handle, no edges).
 *
 * Behavior:
 * - Double-click → enter edit mode (textarea); blur or Esc commits.
 * - Hover shows a delete glyph; click removes the sticky.
 * - Drag is provided by React Flow's default node drag — same persistence
 *   path as actor nodes.
 */

import { useEffect, useRef, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { useReactFlow } from '@xyflow/react';

export interface StickyNoteNodeData extends Record<string, unknown> {
  text: string;
}

export function StickyNoteNode({ id, data, selected }: NodeProps) {
  const flow = useReactFlow();
  const text = (data as StickyNoteNodeData).text ?? '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [editing]);

  const commit = (): void => {
    flow.setNodes((nodes) =>
      nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...(n.data as StickyNoteNodeData), text: draft } }
          : n,
      ),
    );
    setEditing(false);
  };

  const cancel = (): void => {
    setDraft(text);
    setEditing(false);
  };

  const remove = (): void => {
    flow.deleteElements({ nodes: [{ id }] });
  };

  return (
    <div
      onDoubleClick={() => setEditing(true)}
      style={{
        minWidth: 160,
        maxWidth: 240,
        padding: 'var(--space-2) var(--space-3)',
        background: 'color-mix(in oklab, var(--accent-warm) 18%, var(--surface-card))',
        border: `1px solid ${selected ? 'var(--accent-warm)' : 'var(--hairline-strong)'}`,
        borderRadius: 'var(--r-md)',
        boxShadow: selected
          ? '0 4px 12px color-mix(in oklab, var(--accent-warm) 30%, transparent)'
          : '0 1px 2px color-mix(in oklab, var(--ink) 8%, transparent)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--ink)',
        position: 'relative',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        cursor: editing ? 'text' : 'grab',
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          remove();
        }}
        title="delete sticky"
        aria-label="delete sticky"
        style={{
          all: 'unset',
          cursor: 'pointer',
          position: 'absolute',
          top: 2,
          right: 6,
          fontSize: 11,
          lineHeight: 1,
          color: 'var(--ink-tertiary)',
          opacity: selected || editing ? 1 : 0.4,
        }}
      >
        ✕
      </button>
      {editing ? (
        <textarea
          ref={ref}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              cancel();
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commit();
            }
          }}
          rows={Math.max(2, draft.split('\n').length)}
          style={{
            width: '100%',
            minHeight: 32,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'none',
            color: 'var(--ink)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            lineHeight: 1.5,
          }}
        />
      ) : (
        <span style={{ display: 'block', lineHeight: 1.5, paddingRight: 12 }}>
          {text || <span style={{ color: 'var(--ink-tertiary)' }}>(double-click to edit)</span>}
        </span>
      )}
    </div>
  );
}
