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
  | StopEffect
  | QaCheckEffect;

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

/**
 * v3 qa_check — deterministic ground-truth check (no LLM).
 *
 * Pattern: AutoGen Executor (57.6k⭐, "Assistant writes code, Executor executes deterministically").
 * Emitted by reducer after kind=build; dispatcher runs htmlhint + optional playwright;
 * result becomes kind=qa.result transcript event with metadata.deterministic=true.
 *
 * See [[bagelcode-system-architecture-v3]] §3.5 (qa.result schema), §7 (3-layer scoring),
 * skills/verification-before-completion.md.
 */
export interface QaCheckEffect {
  type: 'qa_check';
  /** Path to artifact to check (e.g., "artifacts/game.html"). Relative to session dir. */
  artifact: string;
  /** Source build event id (for parent_event_id chain). */
  build_event_id: string;
  /** sha256 of the artifact (for tamper detection between build and qa). */
  artifact_sha256?: string;
}
