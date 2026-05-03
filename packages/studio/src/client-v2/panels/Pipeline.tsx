/**
 * Pipeline panel — interactive React Flow DAG canvas.
 *
 * Per migration plan §6.1 + DESIGN.md §4.6 — node geometry seeded by
 * dagre against v1 vanilla DAG_NODES coordinates so a fresh session
 * opens identical to today. User drags then deviate; layout persists
 * to localStorage; "Reset layout" restores the seed.
 *
 * Click a node → DetailRail flips to node-inspector mode (M4 detail-rail
 * tri-mode). Selection is shared via stores/selection.ts so the rail
 * panel reads it independently.
 *
 * §8.1 quality bar: keyboard-navigable (React Flow exposes ARIA),
 * reduced-motion respected (canvas pan/zoom transitions are CSS-driven
 * and inherit the global media query).
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
import { useCallback, useEffect, useMemo } from 'react';
import { buildDefaultLayout, type ActorNodeData } from './pipeline/layout';
import { ActorNode } from './pipeline/ActorNode';
import { setSelectedNodeActor, useSelectedNodeActor } from '../stores/selection';

const NODE_TYPES = { actor: ActorNode };

function PipelineInner() {
  const seed = useMemo(buildDefaultLayout, []);
  const [nodes, setNodes, onNodesChange] = useNodesState(seed.nodes);
  const [edges, , onEdgesChange] = useEdgesState(seed.edges);
  const selected = useSelectedNodeActor();

  // Persist node positions to localStorage (per §6.1 layout persistence).
  // Future M9 polish: per-session vs per-project default layout choice.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const positions = nodes.reduce<Record<string, { x: number; y: number }>>((acc, n) => {
          acc[n.id] = { x: n.position.x, y: n.position.y };
          return acc;
        }, {});
        localStorage.setItem('crumb.studio.pipeline.layout', JSON.stringify(positions));
      } catch (_) {
        /* localStorage may be blocked */
      }
    }, 250);
    return () => clearTimeout(id);
  }, [nodes]);

  // Hydrate persisted positions on first mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('crumb.studio.pipeline.layout');
      if (!raw) return;
      const persisted = JSON.parse(raw) as Record<string, { x: number; y: number }>;
      setNodes((prev) =>
        prev.map((n) => {
          const p = persisted[n.id];
          return p ? { ...n, position: { x: p.x, y: p.y } } : n;
        }),
      );
    } catch (_) {
      /* malformed or blocked — fall back to seed */
    }
    // intentionally one-shot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external selection state (toolbar reset / inspector open).
  const onNodeClick: NodeMouseHandler = useCallback((_, node: Node) => {
    const actor = (node.data as ActorNodeData).actor;
    setSelectedNodeActor(actor);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeActor(null);
  }, []);

  // Reflect external selection into RF's selected state so user keyboard
  // navigation matches what the rail thinks is selected.
  const styledNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        selected: selected === n.id,
      })),
    [nodes, selected],
  );

  return (
    <div style={{ height: '100%', width: '100%', background: 'var(--canvas)' }}>
      <ReactFlow
        nodes={styledNodes}
        edges={edges}
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
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          nodeColor={(n) => `var(--actor-${(n.data as ActorNodeData).actor}, var(--surface-2))`}
          maskColor="rgba(64,30,8,0.08)"
        />
      </ReactFlow>
    </div>
  );
}

export function Pipeline(_props: IDockviewPanelProps) {
  return (
    <ReactFlowProvider>
      <PipelineInner />
    </ReactFlowProvider>
  );
}
