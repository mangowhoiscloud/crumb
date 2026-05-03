/**
 * Effect types — pure descriptors of side effects emitted by the reducer.
 * Dispatchers (live / replay / test) interpret these.
 */

import type { Actor, DraftMessage } from '../protocol/types.js';
import type { ACPredicateLedgerItem, PersistenceProfile } from '../state/types.js';

export type Effect =
  | SpawnEffect
  | AppendEffect
  | HookEffect
  | DoneEffect
  | RollbackEffect
  | StopEffect
  | CancelSpawnEffect
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
  /**
   * v0.2.0 G4 — runtime sandwich appends pulled from task_ledger.facts where
   * category === 'sandwich_append' and target_actor matches (or is undefined).
   * The dispatcher concatenates these onto the base sandwich (and any
   * file-based agents/<actor>.local.md override) before writing the assembled
   * sandwich for the adapter to read.
   */
  sandwich_appends?: { source_id: string; text: string }[];
}

export interface AppendEffect {
  type: 'append';
  message: DraftMessage;
}

export interface HookEffect {
  type: 'hook';
  /**
   * Hook kind surfaced to the TUI/CLI as a modal:
   * - stuck         — too many errors (stuck_count >= 5)
   * - partial       — verifier verdict=PARTIAL, user confirm/veto
   * - confirm       — generic confirmation
   * - error         — adapter/runtime error
   * - token_budget  — v0.2.0: session_token_total crossed 40K (50K = hard done)
   * - time_budget   — v0.2.0: session_wall_clock crossed 24min (30min = hard done)
   */
  kind: 'stuck' | 'partial' | 'confirm' | 'error' | 'token_budget' | 'time_budget';
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
 * v0.4.2 — user-driven mid-spawn cancellation. Reducer emits this when
 * `kind=user.intervene` carries `data.cancel = <actor> | 'all'`. The live
 * dispatcher looks up the active AbortController in its in-memory
 * `activeSpawns` registry and fires `controller.abort()`, sending SIGTERM to
 * the running subprocess via the adapter signal handler. Trade-off: the
 * subprocess is killed mid-edit so partially-written artifacts may be
 * inconsistent — that's the user's explicit ask when they typed `/cancel`.
 *
 * `actor: 'all'` cancels every registered spawn (e.g. user types `/cancel`
 * with no target during a parallel multi-actor flow).
 */
export interface CancelSpawnEffect {
  type: 'cancel_spawn';
  actor: Actor | 'all';
  reason: string;
}

/**
 * v0.1 qa_check — deterministic ground-truth check (no LLM).
 *
 * Pattern: AutoGen Executor (57.6k⭐, "Assistant writes code, Executor executes deterministically").
 * Emitted by reducer after kind=build; dispatcher runs htmlhint + optional playwright;
 * result becomes kind=qa.result transcript event with metadata.deterministic=true.
 *
 * See [[bagelcode-system-architecture-v0.1]] §3.5 (qa.result schema), §7 (3-layer scoring),
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
  /**
   * v0.3.5 — deterministic AC predicates compiled by planner-lead at spec-seal,
   * pulled from `state.task_ledger.ac_predicates` by the reducer's `build`
   * case. The dispatcher passes these to `runQaCheck` so the AC layer runs
   * alongside the static smoke. Empty when the spec emitted no predicates.
   */
  ac_predicates?: ACPredicateLedgerItem[];
  /**
   * v0.4 Phase 7 — persistence profile pulled from
   * `state.task_ledger.persistence_profile` by the reducer's `build` case.
   * The dispatcher forwards this to `runQaCheck` which dispatches to
   * `runPersistenceCheck` for the per-profile smoke. Undefined → no
   * persistence profile flagged → smoke skipped (un-flagged sessions stay
   * backward-compatible with pre-v0.4 behavior). See
   * `agents/specialists/game-design.md` §1.4.
   */
  persistence_profile?: PersistenceProfile;
}
