/**
 * State types — what the Coordinator reduces over.
 *
 * The CrumbState is the *full* observable view of a session; it is purely derived
 * from the transcript (state = reduce(initial, [event0, event1, ...])).
 * No state is stored anywhere except the transcript.jsonl + sessions/<id>/ledgers/*
 * (the ledgers are write-through caches; if lost, replay rebuilds them).
 */

import type { Actor, Message, Verdict } from '../protocol/types.js';

export interface TaskFact {
  source_id: string; // message id that produced this fact
  text: string; // human-readable
  category: 'goal' | 'spec' | 'constraint' | 'feedback' | 'note' | 'sandwich_append';
  /**
   * v0.2.0 G4 — when category is 'sandwich_append', optional actor scoping.
   * If set, the override applies only to spawns of that actor; otherwise the
   * append applies to every spawned actor in the session.
   */
  target_actor?: Actor;
}

/**
 * Deterministic AC predicate compiled by planner-lead at spec-seal. Mirrors
 * `src/effects/qa-interactive.ts::ACPredicateItem` but typed in the state
 * layer (state/types.ts is zero-dep — no import from effects/).
 */
export interface ACPredicateLedgerItem {
  id: string;
  intent: string;
  predicate_js: string;
  action_js?: string | null;
  wait_ms?: number;
  timeout_ms?: number;
}

export interface TaskLedger {
  facts: TaskFact[];
  goal: string | null;
  acceptance_criteria: string[];
  /**
   * v0.3.5 — deterministic AC predicates compiled by planner-lead at spec-seal.
   * The dispatcher's `qa-runner` passes these to `runQaCheck` so the AC layer
   * runs alongside the static smoke. Empty when planner emits no predicates.
   */
  ac_predicates: ACPredicateLedgerItem[];
  artifacts: { path: string; sha256: string }[];
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitInfo {
  state: CircuitState;
  consecutive_failures: number;
  last_failure_id?: string;
}

export interface ScoreEntry {
  msg_id: string;
  aggregate: number;
  verdict: Verdict;
}

export interface ProgressLedger {
  step: number;
  next_speaker: Actor | null;
  last_active_actor: Actor | null;
  stuck_count: number;
  score_history: ScoreEntry[];
  adapter_override: Partial<Record<Actor, string>>;
  circuit_breaker: Partial<Record<Actor, CircuitInfo>>;
  /**
   * v0.2.0 — global pause state. When true, the reducer emits effect `type: 'hook'`
   * instead of `type: 'spawn'` so dispatched effects can surface the pause without
   * losing the routing decision. `kind=user.resume` clears it. Mirrors LangGraph's
   * interrupt-then-resume pattern (interrupt() + Command(resume=...)).
   */
  paused: boolean;
  /**
   * v0.2.0 G5 — per-actor pause set (Paperclip "pause any agent" pattern). When non-empty,
   * spawn effects targeting any actor in this set are demoted to hooks even if the global
   * `paused` is false. `kind=user.pause` with `data.actor=<name>` adds an entry;
   * `kind=user.resume` with `data.actor=<name>` removes one; `kind=user.resume` without
   * `data.actor` clears the entire set (and global pause).
   */
  paused_actors: Actor[];

  // v0.2.0 budget guardrails (autoresearch P3 wall-clock + spec budget-guardrails P0).
  // Reducer increments/aggregates these from event metadata; loop + dispatcher enforce
  // the corresponding hard caps (wall-clock / per-spawn timeout). See
  // wiki/concepts/bagelcode-budget-guardrails.md and .skills/karpathy-patterns/SKILL.md P3.
  respec_count: number; // # of spec.update events (rollback re-entry to planner)
  verify_count: number; // # of judge.score events (caps verifier loop)
  session_token_total: number; // Σ metadata.tokens_in + tokens_out across all events
  session_started_at: string; // ISO-8601, set on first session.start event
  per_spawn_started_at: string | null; // current spawn ts (loop watchdog SIGTERMs after 5min)

  // v0.2.0 ratchet (autoresearch P4 keep/revert). Tracks the best aggregate score so
  // far; if a later judge.score regresses by RATCHET_THRESHOLD points, the session
  // is auto-terminated with reason='ratchet_revert' to prevent unbounded loops.
  max_aggregate_so_far: number;
  max_aggregate_msg_id: string | null;
}

/**
 * Anti-deception inputs the reducer keeps stashed so it can run Rules 1, 2, 4, 5
 * on every kind=judge.score / kind=verify.result without re-walking the full
 * transcript. Stays in state because all state must be derivable from the
 * transcript via reduce() (architecture invariant #1).
 */
export interface QaSnapshot {
  build_event_id: string;
  exec_exit_code: number;
  cross_browser_smoke?: 'ok' | 'fail' | 'skipped';
}

export interface CrumbState {
  session_id: string;
  task_ledger: TaskLedger;
  progress_ledger: ProgressLedger;
  // Last message we have observed — useful for routing decisions in the reducer.
  last_message: Message | null;
  /**
   * Latest qa.result snapshot. Populated on kind=qa.result; consumed by the
   * reducer's anti-deception pass on kind=judge.score / kind=verify.result.
   */
  last_qa_result: QaSnapshot | null;
  /**
   * Provider on the most recent kind=build event. Used to detect self-bias
   * (Rule 4: same-provider builder/verifier) at judge.score time.
   */
  last_builder_provider: string | null;
  /**
   * IDs of kind=step.research.video events emitted in this session. Drives
   * anti-deception Rule 5 (researcher_video_evidence_missing) at judge.score
   * time without re-walking the transcript.
   */
  research_video_evidence_ids: string[];
  /**
   * Whether the session's `kind=goal` carried `data.video_refs: string[]` with
   * at least one entry. Set in the goal reducer case; consumed by
   * `pickAdapter('researcher')` to route the spawn:
   *   true  → gemini-sdk (programmatic video evidence path, real SDK calls)
   *   false → claude-local / ambient (LLM-driven text research, real reasoning)
   * Replaces the previous gemini-sdk text-only stub branch (which emitted
   * empty reference_games[] + design_lessons[] regardless of input).
   */
  goal_has_video_refs: boolean;
  // Has the session reached a terminal state?
  done: boolean;
}

export const initialState = (sessionId: string): CrumbState => ({
  session_id: sessionId,
  task_ledger: {
    facts: [],
    goal: null,
    acceptance_criteria: [],
    ac_predicates: [],
    artifacts: [],
  },
  progress_ledger: {
    step: 0,
    next_speaker: null,
    last_active_actor: null,
    stuck_count: 0,
    score_history: [],
    adapter_override: {},
    circuit_breaker: {},
    paused: false,
    paused_actors: [],
    respec_count: 0,
    verify_count: 0,
    session_token_total: 0,
    session_started_at: '',
    per_spawn_started_at: null,
    max_aggregate_so_far: 0,
    max_aggregate_msg_id: null,
  },
  last_message: null,
  last_qa_result: null,
  last_builder_provider: null,
  research_video_evidence_ids: [],
  goal_has_video_refs: false,
  done: false,
});
