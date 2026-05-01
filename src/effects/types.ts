/**
 * Effect types — pure descriptors of side effects emitted by the reducer.
 * Dispatchers (live / replay / test) interpret these.
 */

import type { Actor, DraftMessage } from '../protocol/types.js';

export type Effect =
  | SpawnEffect
  | AppendEffect
  | HookEffect
  | DoneEffect
  | RollbackEffect
  | StopEffect;

export interface SpawnEffect {
  type: 'spawn';
  actor: Actor;
  /** Adapter id (e.g. 'claude-local', 'codex-local'). Resolved by adapter registry. */
  adapter: string;
  /** Override the system prompt path, defaults to agents/<actor>.md */
  sandwich_path?: string;
  /** Optional first prompt payload (e.g. the goal text). */
  prompt?: string;
}

export interface AppendEffect {
  type: 'append';
  message: DraftMessage;
}

export interface HookEffect {
  type: 'hook';
  /** stuck | partial | confirm — the TUI/CLI surfaces this as a modal. */
  kind: 'stuck' | 'partial' | 'confirm' | 'error';
  body: string;
  data?: Record<string, unknown>;
}

export interface DoneEffect {
  type: 'done';
  reason: string;
}

export interface RollbackEffect {
  type: 'rollback';
  /** Roll back to which actor (typically planner-lead for respec). */
  to: Actor;
  feedback: string;
}

export interface StopEffect {
  type: 'stop';
  actor: Actor;
  reason: string;
}
