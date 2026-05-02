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
  category: 'goal' | 'spec' | 'constraint' | 'feedback' | 'note';
}

export interface TaskLedger {
  facts: TaskFact[];
  goal: string | null;
  acceptance_criteria: string[];
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
   * v3.2 — global pause state. When true, the reducer emits `kind: 'hook'` instead of
   * `kind: 'spawn'` so dispatched effects can surface the pause without losing the
   * routing decision. `kind=user.resume` clears it. Mirrors LangGraph's interrupt-then-
   * resume pattern (interrupt() + Command(resume=...)).
   */
  paused: boolean;
}

export interface CrumbState {
  session_id: string;
  task_ledger: TaskLedger;
  progress_ledger: ProgressLedger;
  // Last message we have observed — useful for routing decisions in the reducer.
  last_message: Message | null;
  // Has the session reached a terminal state?
  done: boolean;
}

export const initialState = (sessionId: string): CrumbState => ({
  session_id: sessionId,
  task_ledger: {
    facts: [],
    goal: null,
    acceptance_criteria: [],
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
  },
  last_message: null,
  done: false,
});
