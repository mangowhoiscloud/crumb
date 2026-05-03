/**
 * Pipeline default layout — dagre-seeded positions for the 8 actor nodes.
 *
 * Per migration plan §6.1: seed positions are calibrated against v1
 * vanilla DAG_NODES geometry so a fresh session opens identical to today.
 * User drags then deviate; "Reset layout" restores it.
 *
 * Layout direction: left-to-right (rankdir=LR). Sugiyama-style ranking:
 *   user → coordinator → planner-lead → researcher → builder → verifier
 *   → validator. system observer floats at bottom.
 */

import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';

const ACTORS = [
  'user',
  'coordinator',
  'planner-lead',
  'researcher',
  'builder',
  'verifier',
  'validator',
  'system',
  'done',
] as const;

export type Actor = (typeof ACTORS)[number];

export interface ActorNodeData extends Record<string, unknown> {
  actor: Actor;
  label: string;
}

const NODE_W = 132;
const NODE_H = 48;

/**
 * Forward edges drive dagre's left-to-right ranking. Back / rollback
 * edges render as separate React Flow edges routed through the top
 * handles (see ActorNode) so they arc clearly over the forward flow
 * instead of overlapping it. Including back-edges in dagre's input
 * collapses adjacent columns ("tangled planner-lead + researcher").
 */
const FORWARD_EDGES: Array<[Actor, Actor, string]> = [
  ['user', 'coordinator', 'goal'],
  ['coordinator', 'planner-lead', 'spec'],
  ['planner-lead', 'researcher', 'evidence'],
  ['planner-lead', 'builder', 'build'],
  ['builder', 'verifier', 'verify'],
  ['verifier', 'validator', 'audit'],
  // Terminal milestone — kind=done lands here.
  ['validator', 'done', 'done'],
];

/** Cooperative back-edges (normal flow). Phase A → researcher → Phase B. */
const BACK_EDGES: Array<[Actor, Actor, string]> = [['researcher', 'planner-lead', 'synth']];

/**
 * Rollback edges — fire only on FAIL / Critical deviation. Rendered as
 * dashed reddish curves so the operator sees the "did NOT pass the bar"
 * routing. Pipeline.tsx tints them brighter when an actual
 * `kind=handoff.rollback` event surfaced in the rolling stream.
 */
const ROLLBACK_EDGES: Array<[Actor, Actor, string]> = [
  // verifier FAIL / Important deviation → respawn builder with feedback.
  ['verifier', 'builder', 'rollback (FAIL)'],
  // verifier Critical deviation OR validator audit caught fabrication
  // → unwind all the way to planner-lead Phase B re-spec.
  ['validator', 'planner-lead', 'rollback (Critical)'],
];

export function buildDefaultLayout(): { nodes: Node<ActorNodeData>[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 32, ranksep: 96, marginx: 24, marginy: 24 });

  for (const actor of ACTORS) {
    g.setNode(actor, { width: NODE_W, height: NODE_H });
  }
  for (const [from, to] of FORWARD_EDGES) {
    g.setEdge(from, to);
  }
  dagre.layout(g);

  const nodes: Node<ActorNodeData>[] = ACTORS.map((actor) => {
    const pos = g.node(actor);
    return {
      id: actor,
      type: 'actor',
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
      data: { actor, label: actor },
    };
  });

  const forward: Edge[] = FORWARD_EDGES.map(([from, to, label]) => ({
    id: `${from}-${to}`,
    source: from,
    target: to,
    sourceHandle: 'right',
    targetHandle: 'left',
    label,
    type: 'default',
    animated: false,
  }));

  const back: Edge[] = BACK_EDGES.map(([from, to, label]) => ({
    id: `${from}-${to}`,
    source: from,
    target: to,
    // Top → top routes the back-edge as a clear arc above the row, so
    // the "researcher hands synth back to planner-lead" return doesn't
    // overlap the forward `evidence` edge between the same pair.
    sourceHandle: 'top-source',
    targetHandle: 'top-target',
    label,
    type: 'smoothstep',
    animated: false,
    style: { strokeDasharray: '4 4', stroke: 'var(--ink-tertiary)' },
    labelStyle: { fill: 'var(--ink-tertiary)' },
  }));

  const rollback: Edge[] = ROLLBACK_EDGES.map(([from, to, label]) => ({
    id: `rollback-${from}-${to}`,
    source: from,
    target: to,
    // Same top-handle routing, but distinct rollback styling. Pipeline
    // bumps `data.recent` when a kind=handoff.rollback event lands in
    // the rolling stream, which animates + brightens this edge.
    sourceHandle: 'top-source',
    targetHandle: 'top-target',
    label,
    type: 'smoothstep',
    animated: false,
    data: { rollback: true },
    style: {
      strokeDasharray: '6 4',
      stroke: 'color-mix(in oklab, var(--tone-fail) 70%, var(--ink-tertiary))',
    },
    labelStyle: {
      fill: 'var(--tone-fail)',
      fontSize: 10,
      fontFamily: 'var(--font-mono)',
    },
  }));

  return { nodes, edges: [...forward, ...back, ...rollback] };
}

export const ALL_ACTORS = ACTORS;
