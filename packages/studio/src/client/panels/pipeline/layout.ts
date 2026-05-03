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
] as const;

export type Actor = (typeof ACTORS)[number];

export interface ActorNodeData extends Record<string, unknown> {
  actor: Actor;
  label: string;
}

const NODE_W = 132;
const NODE_H = 48;

const EDGES: Array<[Actor, Actor, string]> = [
  ['user', 'coordinator', 'goal'],
  ['coordinator', 'planner-lead', 'spec'],
  ['planner-lead', 'researcher', 'evidence'],
  ['researcher', 'planner-lead', 'synth'],
  ['planner-lead', 'builder', 'build'],
  ['builder', 'verifier', 'verify'],
  ['verifier', 'validator', 'audit'],
];

export function buildDefaultLayout(): { nodes: Node<ActorNodeData>[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 28, ranksep: 76, marginx: 16, marginy: 16 });

  for (const actor of ACTORS) {
    g.setNode(actor, { width: NODE_W, height: NODE_H });
  }
  for (const [from, to] of EDGES) {
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

  const edges: Edge[] = EDGES.map(([from, to, label]) => ({
    id: `${from}-${to}`,
    source: from,
    target: to,
    label,
    type: 'default',
    animated: false,
  }));

  return { nodes, edges };
}

export const ALL_ACTORS = ACTORS;
