/**
 * Transcript message types — TypeScript mirror of protocol/schemas/message.schema.json.
 * Keep field names + enums aligned with the JSON Schema; ajv enforces at runtime.
 */

export type Actor =
  | 'user'
  | 'coordinator'
  | 'planner-lead'
  | 'researcher'
  | 'builder'
  | 'verifier'
  | 'builder-fallback'
  | 'validator'
  | 'system';

export type Kind =
  // session lifecycle
  | 'session.start'
  | 'session.end'
  | 'agent.wake'
  | 'agent.stop'
  // planning
  | 'goal'
  | 'question.socratic'
  | 'answer.socratic'
  | 'spec'
  | 'spec.update'
  | 'build'
  // v0.1: deterministic ground truth (dispatcher emit, no LLM)
  | 'qa.result'
  // verification
  | 'verify.result'
  | 'judge.score'
  | 'done'
  // agent thinking + dialog (agent.thought_summary kept for verifier input filtering)
  | 'agent.thought_summary'
  | 'note'
  // step markers (Lead-internal sequential roles)
  | 'step.socratic'
  | 'step.concept'
  | 'step.research'
  | 'step.research.video'
  | 'step.design'
  | 'step.judge'
  // user intervention
  | 'user.intervene'
  | 'user.veto'
  | 'user.approve'
  | 'user.pause'
  | 'user.resume'
  // routing + audit
  | 'handoff.requested'
  | 'handoff.rollback'
  | 'artifact.created'
  // v0.3.0: version milestones (immutable releases under projects/<id>/versions/<vN>/)
  | 'version.released'
  | 'error'
  | 'audit'
  // tool tap (dispatcher emits tool.call from stream-json; tool.result reserved for paired emit)
  | 'tool.call'
  | 'tool.result';

export type Step =
  | 'socratic'
  | 'concept'
  | 'research'
  | 'research.video'
  | 'design'
  | 'builder'
  | 'qa'
  | 'verifier'
  | 'grader'
  | 'critic'
  | 'defender'
  | 'regrader'
  | 'synth';

export type Verdict = 'PASS' | 'PARTIAL' | 'FAIL' | 'REJECT';

export interface Artifact {
  path: string;
  sha256: string;
  role?: 'src' | 'doc' | 'config' | 'screenshot' | 'data';
}

/**
 * v0.1 score dimension (D1-D6 source-of-truth matrix).
 * source field encodes which layer produced the score (single origin per dim):
 *   - "verifier-llm": verifier sandwich CourtEval reasoning (D1, plus the LLM component of D3/D5)
 *   - "qa-check-effect": dispatcher deterministic effect (D2/D6)
 *   - "reducer-auto": reducer auto-computed (D4, plus the auto component of D3/D5)
 *
 * D3 / D5 are split: the verifier emits its LLM component as a single dim with
 * source='verifier-llm'; the reducer-auto component is computed separately by
 * computeAutoScores() and combined deterministically by combineDimScore() in
 * src/state/scorer.ts. The combine rule lives in code, not in the verifier — no
 * LLM can inflate a merged number. The legacy 'hybrid' source value was removed.
 *
 * lookup encodes the source-of-truth pointer for non-LLM dimensions.
 * anti-deception validator forbids verifier override of non-LLM sources.
 */
export interface ScoreDimension {
  score: number;
  source: 'verifier-llm' | 'qa-check-effect' | 'reducer-auto';
  lookup?: string;
  evidence?: string[];
  /**
   * Optional informational mirror of the reducer-auto component for D3/D5.
   * The canonical auto value is recomputed from transcript via computeAutoScores();
   * this field is kept for replay convenience and side-by-side display.
   */
  auto?: number;
  /** Verifier LLM component for D3 — same as `score` when source='verifier-llm'. */
  semantic?: number;
  /** Verifier LLM component for D5 — same as `score` when source='verifier-llm'. */
  quality?: number;
}

export interface Scores {
  // v0.1 D1-D6 (preferred)
  D1?: ScoreDimension;
  D2?: ScoreDimension;
  D3?: ScoreDimension;
  D4?: ScoreDimension;
  D5?: ScoreDimension;
  D6?: ScoreDimension;
  aggregate?: number;
  verdict?: Verdict;
  feedback?: string;
  /** CourtEval (ACL 2025) sub-step msg id refs for audit trail. */
  courteval?: {
    grader_msg_id?: string;
    critic_msg_id?: string;
    defender_msg_id?: string;
    regrader_msg_id?: string;
  };
  audit_violations?: string[];
  /**
   * PR-G2 — verifier-emitted deviation classification used by the reducer's
   * FAIL/REJECT routing. `Critical` rolls back to planner-lead; `Important`
   * (default) and `Minor` respawn the original builder with feedback +
   * suggested_change injected as a one-shot sandwich_append. Mirrors the
   * code-review-protocol.md taxonomy.
   */
  deviation?: { type?: 'Critical' | 'Important' | 'Minor' };
  /** PR-G2 — concrete fix instruction the builder receives via sandwich_append. */
  suggested_change?: string;
  // v0.1.x deprecated aliases (kept for replay of old transcripts)
  /** @deprecated use D1 */
  goal_completion?: number;
  /** @deprecated use D3 */
  collaboration?: number;
  /** @deprecated */
  groundedness?: number;
  /** @deprecated use D2 */
  actionability?: number;
  /** @deprecated */
  cost_efficiency?: number;
  /** @deprecated use D5 */
  intervention_response?: number;
}

export interface Content {
  format: 'markdown' | 'json' | 'text' | 'xml';
  text: string;
}

/** v0.1 harness identifier — mirrors preset binding 3-tuple. v0.3.0 added gemini-sdk for the researcher actor's video understanding path (Gemini 3.1 Pro native YouTube URL + 10fps frame sampling — gemini-cli has p1-unresolved video bugs). */
export type Harness =
  | 'claude-code'
  | 'codex'
  | 'gemini-cli'
  | 'gemini-sdk'
  | 'anthropic-sdk'
  | 'openai-sdk'
  | 'google-sdk'
  | 'mock'
  | 'none';

export type Provider = 'anthropic' | 'openai' | 'google' | 'none';

export interface Metadata {
  visibility?: 'public' | 'private';
  // v0.1: 3-tuple actor binding
  harness?: Harness;
  provider?: Provider;
  model?: string;
  /** v0.1: native session id from host harness for cache carry-over (S15). */
  adapter_session_id?: string;
  /** v0.1: signals next spawn may use --resume <adapter_session_id> for cache hit. */
  cache_carry_over?: boolean;
  /** v0.1: true on judge.score events when verifier provider !== builder provider. */
  cross_provider?: boolean;
  /** v0.1: true for events emitted by dispatcher effects (qa_check / validator / reducer audit). */
  deterministic?: boolean;
  /** v0.1: tool/effect identifier for deterministic events (e.g., 'qa-check-effect@v1'). */
  tool?: string;
  /** v0.3.0: classifies researcher / verifier evidence source for D5 anti-deception checks. */
  evidence_kind?: 'video' | 'screenshot' | 'text';
  /** v0.3.0: sha256(video_ref + model + prompt_version) for the gemini-sdk adapter's replay cache. */
  cache_key?: string;
  turn?: number;
  tokens_in?: number;
  tokens_out?: number;
  cache_read?: number;
  cache_write?: number;
  latency_ms?: number;
  cost_usd?: number;
  thinking_tokens?: number;
  audit_violations?: string[];
  /**
   * v0.3.0: 5-layer hierarchy markers (project → session → run → turn → step → event).
   * project lives on the filesystem; session_id and step are top-level Message fields;
   * run_id / turn_id are reducer-derived. parent_session_id / fork_event_id appear
   * only on the first event of a forked session.
   */
  crumb?: {
    run_id?: string;
    turn_id?: string;
    parent_session_id?: string;
    fork_event_id?: string;
  };
  /**
   * v0.3.0: OpenTelemetry GenAI Semantic Conventions aliases.
   * conversation_id ≡ session_id, agent_id ≡ from, workflow_name = 'crumb.coordinator'.
   * Filled in by the OTel exporter or by the writer when emitting cross-provider events.
   */
  gen_ai?: {
    conversation_id?: string;
    agent_id?: string;
    workflow_name?: string;
  };
}

export interface Message {
  id: string;
  ts: string;
  session_id: string;
  task_id?: string;
  from: Actor;
  to?: string;
  parent_event_id?: string | null;
  in_reply_to?: string | null;
  kind: Kind;
  topic?: string;
  step?: Step;
  body?: string;
  data?: Record<string, unknown>;
  content?: Content;
  artifacts?: Artifact[];
  scores?: Scores;
  ack_required?: boolean;
  blocking?: boolean;
  metadata?: Metadata;
}

/** Fields the writer fills in (id + ts) — caller supplies the rest. */
export type DraftMessage = Omit<Message, 'id' | 'ts'> & { id?: string; ts?: string };
