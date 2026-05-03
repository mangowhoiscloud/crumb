/**
 * Pipeline panel — interactive React Flow DAG canvas.
 *
 * Per migration plan §6.1 + DESIGN.md §4.6 — node geometry seeded by
 * dagre against v1 vanilla DAG_NODES coordinates so a fresh session
 * opens identical to today. User drags then deviate; layout persists
 * to localStorage; "Reset layout" restores the seed.
 *
 * Click an actor node → DetailRail flips to node-inspector mode (M4
 * detail-rail tri-mode). Selection is shared via stores/selection.ts.
 *
 * M9 polish (n8n parity):
 * - "+ Sticky" button adds a draggable annotation node (StickyNoteNode)
 *   that persists alongside actor positions.
 * - "Save default" pins the current layout as the project's default —
 *   sessions in the same project hydrate from this default before
 *   falling through to the global seed.
 * - "Export" / "Import" round-trips the layout JSON via download / file
 *   picker so layouts can move between machines.
 * - Minimap toggle (mini button + ⌘K palette entry) hides/shows the
 *   bottom-right minimap; persists per-user.
 *
 * §8.1 quality bar: keyboard-navigable (React Flow exposes ARIA),
 * reduced-motion respected (CSS-driven transitions inherit the global
 * media query), tone tokens only.
 */

import type { IDockviewPanelProps } from 'dockview-react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildDefaultLayout, type ActorNodeData } from './pipeline/layout';
import { ActorNode } from './pipeline/ActorNode';
import { StickyNoteNode, type StickyNoteNodeData } from './pipeline/StickyNoteNode';
import { setSelectedNodeActor, useActiveSession, useSelectedNodeActor } from '../stores/selection';
import { useSessions } from '../hooks/useSessions';
import { useTranscriptStream } from '../hooks/useTranscriptStream';

const NODE_TYPES = { actor: ActorNode, sticky: StickyNoteNode };

const SESSION_LAYOUT_KEY = (sessionId: string) => `crumb.studio.pipeline.layout.${sessionId}`;
const PROJECT_LAYOUT_KEY = (projectId: string) =>
  `crumb.studio.pipeline.layout.project.${projectId}`;
const MINIMAP_KEY = 'crumb.studio.pipeline.minimap';

interface PersistedLayout {
  /** Map node id → position. Includes both actor + sticky nodes. */
  positions: Record<string, { x: number; y: number }>;
  /** Sticky annotation nodes (id, position, text). Empty when none added. */
  stickies: Array<{ id: string; position: { x: number; y: number }; text: string }>;
}

function newStickyId(): string {
  return `sticky-${Math.random().toString(36).slice(2, 10)}`;
}

function serializeLayout(nodes: Node[]): PersistedLayout {
  const positions: PersistedLayout['positions'] = {};
  const stickies: PersistedLayout['stickies'] = [];
  for (const n of nodes) {
    positions[n.id] = { x: n.position.x, y: n.position.y };
    if (n.type === 'sticky') {
      stickies.push({
        id: n.id,
        position: { x: n.position.x, y: n.position.y },
        text: (n.data as StickyNoteNodeData).text ?? '',
      });
    }
  }
  return { positions, stickies };
}

function readPersisted(key: string): PersistedLayout | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedLayout> | Record<string, { x: number; y: number }>;
    // v0 shape: bare positions map. v1 shape: { positions, stickies }.
    if ('positions' in parsed && 'stickies' in parsed) {
      return parsed as PersistedLayout;
    }
    return { positions: parsed as Record<string, { x: number; y: number }>, stickies: [] };
  } catch {
    return null;
  }
}

function writePersisted(key: string, layout: PersistedLayout): void {
  try {
    localStorage.setItem(key, JSON.stringify(layout));
  } catch {
    /* localStorage may be blocked */
  }
}

function PipelineInner() {
  const sessionId = useActiveSession();
  const sessions = useSessions();
  const projectId =
    sessions.data?.sessions.find((s) => s.session_id === sessionId)?.project_id ?? null;

  const seed = useMemo(buildDefaultLayout, []);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(seed.nodes as Node[]);
  const [edges, , onEdgesChange] = useEdgesState(seed.edges);
  const selected = useSelectedNodeActor();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showMinimap, setShowMinimap] = useState<boolean>(() => {
    try {
      return localStorage.getItem(MINIMAP_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const [toast, setToast] = useState<string | null>(null);

  // Hydrate persisted layout. Resolution order:
  //   1. session-specific override (`crumb.studio.pipeline.layout.<sessionId>`)
  //   2. project default (`crumb.studio.pipeline.layout.project.<projectId>`)
  //   3. dagre seed (default constructor)
  //
  // Re-runs when active session / project changes so switching sessions
  // pulls the right layout without a hard reload.
  useEffect(() => {
    let layout: PersistedLayout | null = null;
    if (sessionId) layout = readPersisted(SESSION_LAYOUT_KEY(sessionId));
    if (!layout && projectId) layout = readPersisted(PROJECT_LAYOUT_KEY(projectId));
    if (!layout) {
      // Fall back to legacy global key (pre-M9) for one-time migration.
      layout = readPersisted('crumb.studio.pipeline.layout');
    }
    if (!layout) return;
    setNodes((prev) => {
      // Reposition existing actor nodes; add sticky annotations from layout.
      const stickyNodes: Node[] = (layout?.stickies ?? []).map((s) => ({
        id: s.id,
        type: 'sticky',
        position: s.position,
        data: { text: s.text } as StickyNoteNodeData,
      }));
      const repositionedActors = prev
        .filter((n) => n.type !== 'sticky')
        .map((n) => {
          const p = layout?.positions[n.id];
          return p ? { ...n, position: { x: p.x, y: p.y } } : n;
        });
      return [...repositionedActors, ...stickyNodes];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, projectId]);

  // Persist current layout to the session-specific key (debounced).
  useEffect(() => {
    if (!sessionId) return;
    const id = setTimeout(() => {
      writePersisted(SESSION_LAYOUT_KEY(sessionId), serializeLayout(nodes));
    }, 250);
    return () => clearTimeout(id);
  }, [nodes, sessionId]);

  const onNodeClick: NodeMouseHandler = useCallback((_, node: Node) => {
    // Only actor nodes drive the DetailRail node-inspector mode.
    if (node.type === 'sticky') return;
    setSelectedNodeActor((node.data as ActorNodeData).actor);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeActor(null);
  }, []);

  // Active actors = those whose latest agent.wake hasn't been paired
  // with an agent.stop yet. Drives the green pulse halo on ActorNode so
  // the operator can see at a glance which actor is currently spawning.
  const stream = useTranscriptStream(500);
  const activeActors = useMemo(() => {
    const wakeOpen = new Set<string>();
    for (const e of stream.events) {
      if (e.kind === 'agent.wake') wakeOpen.add(e.from);
      else if (e.kind === 'agent.stop') wakeOpen.delete(e.from);
    }
    return wakeOpen;
  }, [stream.events]);

  // Recent rollback edges — bright + animated when the matching
  // `handoff.rollback` event surfaced in the last ~30 s of the rolling
  // window. Static rollback edges (verifier→builder, validator→
  // planner-lead) stay dashed-pink as a "this can happen" hint;
  // recent-fired ones glow.
  const recentRollbacks = useMemo(() => {
    const cutoff = Date.now() - 30_000;
    const recent = new Set<string>();
    for (const e of stream.events) {
      if (e.kind !== 'handoff.rollback') continue;
      if (new Date(e.ts).getTime() < cutoff) continue;
      const target =
        (e.data as { to?: string } | undefined)?.to ??
        (e.data as { target_actor?: string } | undefined)?.target_actor ??
        '';
      if (e.from && target) recent.add(`${e.from}->${target}`);
    }
    return recent;
  }, [stream.events]);

  const styledNodes = useMemo(
    () =>
      nodes.map((n) => {
        if (n.type === 'sticky') return { ...n, selected: false };
        return {
          ...n,
          selected: selected === n.id,
          data: {
            ...(n.data as ActorNodeData),
            active: activeActors.has(n.id),
          },
        };
      }),
    [nodes, selected, activeActors],
  );

  const styledEdges = useMemo(
    () =>
      edges.map((edge) => {
        const data = edge.data as { rollback?: boolean } | undefined;
        if (!data?.rollback) return edge;
        const fired = recentRollbacks.has(`${edge.source}->${edge.target}`);
        if (!fired) return edge;
        return {
          ...edge,
          animated: true,
          style: {
            ...(edge.style ?? {}),
            stroke: 'var(--tone-fail)',
            strokeWidth: 2,
          },
        };
      }),
    [edges, recentRollbacks],
  );

  const flashToast = (msg: string): void => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const handleAddSticky = (): void => {
    // Place at viewport center-ish (50/50 in screen coords). React Flow's
    // default coordinate is canvas-space; we approximate by stacking near
    // origin with a small random jitter so consecutive adds don't overlap.
    const jitter = () => Math.round(Math.random() * 40) - 20;
    setNodes((prev) => [
      ...prev,
      {
        id: newStickyId(),
        type: 'sticky',
        position: { x: 80 + jitter(), y: 240 + jitter() },
        data: { text: '' } as StickyNoteNodeData,
      } satisfies Node,
    ]);
  };

  const handleResetLayout = (): void => {
    setNodes(seed.nodes);
    flashToast('layout reset to seed');
  };

  const handleSaveProjectDefault = (): void => {
    if (!projectId) return;
    writePersisted(PROJECT_LAYOUT_KEY(projectId), serializeLayout(nodes));
    flashToast(`saved as default for project ${projectId.slice(0, 10)}…`);
  };

  const handleExport = (): void => {
    const layout = serializeLayout(nodes);
    const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-layout-${(sessionId ?? projectId ?? 'session').slice(0, 12)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = (): void => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const layout = JSON.parse(text) as PersistedLayout;
      setNodes((prev) => {
        const stickyNodes: Node[] = (layout.stickies ?? []).map((s) => ({
          id: s.id,
          type: 'sticky',
          position: s.position,
          data: { text: s.text } as StickyNoteNodeData,
        }));
        const repositionedActors = prev
          .filter((n) => n.type !== 'sticky')
          .map((n) => {
            const p = layout.positions?.[n.id];
            return p ? { ...n, position: { x: p.x, y: p.y } } : n;
          });
        return [...repositionedActors, ...stickyNodes];
      });
      flashToast('layout imported');
    } catch (err) {
      flashToast(`import failed: ${(err as Error).message}`);
    }
  };

  const handleToggleMinimap = (): void => {
    setShowMinimap((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MINIMAP_KEY, next ? '1' : '0');
      } catch {
        /* blocked */
      }
      return next;
    });
  };

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        background: 'var(--canvas)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <Toolbar
        canSaveDefault={!!projectId}
        showMinimap={showMinimap}
        onAddSticky={handleAddSticky}
        onReset={handleResetLayout}
        onSaveDefault={handleSaveProjectDefault}
        onExport={handleExport}
        onImport={handleImportClick}
        onToggleMinimap={handleToggleMinimap}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleImportFile}
        style={{ display: 'none' }}
      />
      <div style={{ flex: 1, minHeight: 0 }}>
        <ReactFlow
          nodes={styledNodes}
          edges={styledEdges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="var(--hairline-soft)"
          />
          <Controls position="bottom-left" />
          {showMinimap && (
            <MiniMap
              position="bottom-right"
              pannable
              zoomable
              nodeColor={(n) =>
                n.type === 'sticky'
                  ? 'var(--accent-warm)'
                  : `var(--actor-${(n.data as ActorNodeData).actor}, var(--surface-2))`
              }
              maskColor="rgba(64,30,8,0.08)"
            />
          )}
        </ReactFlow>
      </div>
      {toast && (
        <div
          role="status"
          style={{
            position: 'absolute',
            bottom: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '4px 10px',
            background: 'var(--surface-card)',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--r-pill)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink)',
            boxShadow: '0 4px 12px color-mix(in oklab, var(--ink) 12%, transparent)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function Toolbar({
  canSaveDefault,
  showMinimap,
  onAddSticky,
  onReset,
  onSaveDefault,
  onExport,
  onImport,
  onToggleMinimap,
}: {
  canSaveDefault: boolean;
  showMinimap: boolean;
  onAddSticky: () => void;
  onReset: () => void;
  onSaveDefault: () => void;
  onExport: () => void;
  onImport: () => void;
  onToggleMinimap: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: '4px var(--space-3)',
        borderBottom: '1px solid var(--hairline-soft)',
        background: 'var(--surface-1)',
      }}
    >
      <ToolbarButton onClick={onAddSticky} title="add a sticky-note annotation (n8n parity)">
        + sticky
      </ToolbarButton>
      <ToolbarButton onClick={onReset} title="reset all positions to the dagre-seeded layout">
        ↺ reset
      </ToolbarButton>
      <ToolbarButton
        onClick={onSaveDefault}
        title={
          canSaveDefault
            ? 'pin current layout as the default for this project — sessions in the same project hydrate from here'
            : 'no active project — save default disabled'
        }
        disabled={!canSaveDefault}
      >
        ★ save default
      </ToolbarButton>
      <ToolbarButton onClick={onExport} title="download current layout as JSON">
        ↓ export
      </ToolbarButton>
      <ToolbarButton onClick={onImport} title="import a previously exported layout JSON">
        ↑ import
      </ToolbarButton>
      <span style={{ flex: 1 }} />
      <ToolbarButton
        onClick={onToggleMinimap}
        title="toggle minimap"
        active={showMinimap}
      >
        {showMinimap ? '◧ minimap on' : '◨ minimap off'}
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  title,
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        all: 'unset',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
        padding: '3px 8px',
        border: `1px solid ${active ? 'var(--accent-warm)' : 'var(--hairline)'}`,
        borderRadius: 'var(--r-sm)',
        background: active
          ? 'color-mix(in oklab, var(--accent-warm) 12%, var(--canvas))'
          : 'var(--canvas)',
        color: active ? 'var(--accent-warm)' : 'var(--ink-muted)',
      }}
    >
      {children}
    </button>
  );
}

export function Pipeline(_props: IDockviewPanelProps) {
  return (
    <ReactFlowProvider>
      <PipelineInner />
    </ReactFlowProvider>
  );
}
