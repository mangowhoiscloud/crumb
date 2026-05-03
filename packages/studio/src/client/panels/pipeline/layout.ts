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
 * Forward edges drive dagre's left-to-right ranking. The
 * `researcher → planner-lead` synth handoff is a back-edge — including
 * it in dagre creates a cycle that collapses planner-lead and
 * researcher into the same column (the symptom users saw as "tangled
 * planner-lead + researcher"). We render the back-edge separately as a
 * curved return arrow (smoothstep) so the visual still tells the
 * Phase A → researcher → Phase B story without breaking the ranking.
 */
const FORWARD_EDGES: Array<[Actor, Actor, string]> = [
  ['user', 'coordinator', 'goal'],
  ['coordinator', 'planner-lead', 'spec'],
  ['planner-lead', 'researcher', 'evidence'],
  ['planner-lead', 'builder', 'build'],
  ['builder', 'verifier', 'verify'],
  ['verifier', 'validator', 'audit'],
  // Terminal milestone — kind=done lands here. validator passes the
  // verdict through; verifier's PASS short-circuits straight to done
  // when validator audits clean.
  ['validator', 'done', 'done'],
];

const BACK_EDGES: Array<[Actor, Actor, string]> = [['researcher', 'planner-lead', 'synth']];

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
    label,
    type: 'default',
    animated: false,
  }));

  const back: Edge[] = BACK_EDGES.map(([from, to, label]) => ({
    id: `${from}-${to}`,
    source: from,
    target: to,
    label,
    // smoothstep with curvature reads as a return arrow (researcher
    // hands evidence-synth back to planner-lead's Phase B re-spawn)
    type: 'smoothstep',
    animated: false,
    style: { strokeDasharray: '4 4', stroke: 'var(--ink-tertiary)' },
    labelStyle: { fill: 'var(--ink-tertiary)' },
  }));

  return { nodes, edges: [...forward, ...back] };
}

export const ALL_ACTORS = ACTORS;
