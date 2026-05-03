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

/**
 * v0.4 — genre profile axis. See `agents/specialists/game-design.md` §1.3.
 * `auto-detect` (default) hands the choice to the researcher's named-game
 * lock-in + the planner's confidence gate; explicit values bypass that.
 */
export type GenreProfile =
  | 'auto-detect'
  | 'casual-portrait'
  | 'pixel-arcade'
  | 'sidescroll-2d'
  | 'flash-3d-arcade';

export const GENRE_PROFILES: readonly GenreProfile[] = [
  'auto-detect',
  'casual-portrait',
  'pixel-arcade',
  'sidescroll-2d',
  'flash-3d-arcade',
] as const;

export const isGenreProfile = (v: unknown): v is GenreProfile =>
  typeof v === 'string' && (GENRE_PROFILES as readonly string[]).includes(v);

/**
 * v0.4 — persistence profile axis. See `agents/specialists/game-design.md` §1.4.
 * `local-only` is the new default (Dexie); `postgres-anon` activates on
 * leaderboard markers (existing §1.2 trigger); `edge-orm` opt-in only
 * (lifts §1.1 "no worker tier"); `firebase-realtime` reserved (P0 제외).
 */
export type PersistenceProfile = 'local-only' | 'postgres-anon' | 'edge-orm' | 'firebase-realtime';

export const PERSISTENCE_PROFILES: readonly PersistenceProfile[] = [
  'local-only',
  'postgres-anon',
  'edge-orm',
  'firebase-realtime',
] as const;

export const isPersistenceProfile = (v: unknown): v is PersistenceProfile =>
  typeof v === 'string' && (PERSISTENCE_PROFILES as readonly string[]).includes(v);

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
  /**
   * v0.5 PR-Controls — input mapping captured from `kind=spec.data.controls`.
   * `start[]` = synthesizable keys that advance from MenuScene (Playwright
   * qa-runner uses `page.keyboard.press`). `pointer_fallback=true` lets the
   * runner click the canvas as a last resort. See
   * `agents/specialists/game-design.md` §4.5.
   */
  controls?: { start?: string[]; pointer_fallback?: boolean };
  artifacts: { path: string; sha256: string }[];
  /**
   * v0.4 — genre profile (auto-detect | casual-portrait | pixel-arcade |
   * sidescroll-2d | flash-3d-arcade). Populated from `goal.data.genre_profile`
   * (CLI `--genre` / Studio picker) or stays `undefined` for the auto-detect
   * default. Read by planner-lead step.design (resolves auto-detect via
   * researcher proposal) and builder step 1 (selects file-tree template per
   * `agents/specialists/game-design.md` §1.3).
   */
  genre_profile?: GenreProfile;
  /**
   * v0.4 — persistence profile (local-only | postgres-anon | edge-orm |
   * firebase-realtime). Populated from `goal.data.persistence_profile`
   * (CLI `--persistence` / Studio picker) or stays `undefined`; planner-lead
   * runs the §1.4 trigger logic (leaderboard markers → postgres-anon, else
   * local-only) when undefined.
   */
  persistence_profile?: PersistenceProfile;
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

  /**
   * v0.5 PR-Inbox-Console — Tier 3 pairing buffer. Reducer pushes the id of
   * every `user.intervene/pause/resume/approve/veto` event here; dispatcher
   * drains the list at the next spawn-start and stamps
   * `metadata.consumed_intervene_ids = [<drained ids>]` on every event the
   * actor emits during that spawn. Studio inbox panel uses the stamp to
   * group actor responses under the originating user input.
   *
   * Drain timing = spawn-start (not per-event), so a single user input that
   * cascades into multiple spawns gets credit on the first one only — keeps
   * the inbox UI grouping unambiguous.
   */
  pending_intervene_ids: string[];
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
  /**
   * v0.3.5 — per-AC predicate results from the deterministic AC layer.
   * Read by anti-deception Rule 7 (PASS verdict + AC FAIL → D1 ≤ 2).
   */
  ac_results?: Array<{ ac_id: string; status: 'PASS' | 'FAIL' | 'SKIP' }>;
  /**
   * v0.5 PR-Juice — JuiceManager.js (or TIMINGS/SHAKE/POOLS export trio)
   * present in the multi-file bundle. Source-of-truth for anti-deception
   * Rule 9 (`juice_manager_missing`). Undefined for legacy single-file
   * artifacts (mock fixtures only in v0.4+).
   */
  juice_manager_present?: boolean;
  /**
   * v0.5 PR-Juice — coarse polish density signal (count of tween / shake /
   * particle / Web-Audio call sites in src/**). Surface for verifier D5
   * weighting; not gated on directly.
   */
  juice_density?: number;
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
    pending_intervene_ids: [],
  },
  last_message: null,
  last_qa_result: null,
  last_builder_provider: null,
  research_video_evidence_ids: [],
  goal_has_video_refs: false,
  done: false,
});
