/**
 * Transcript message types — TypeScript mirror of protocol/schemas/message.schema.json.
 * Keep field names + enums aligned with the JSON Schema; ajv enforces at runtime.
 */

export type Actor =
  | 'user'
  | 'coordinator'
  | 'planner-lead'
  | 'engineering-lead'
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
  // verification
  | 'verify.request'
  | 'verify.result'
  | 'judge.score'
  | 'done'
  // agent thinking + dialog
  | 'agent.thought_summary'
  | 'question'
  | 'answer'
  | 'debate'
  | 'note'
  // step markers (Lead-internal sequential roles)
  | 'step.socratic'
  | 'step.concept'
  | 'step.research'
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
  | 'handoff.accepted'
  | 'handoff.rollback'
  | 'artifact.created'
  | 'ack'
  | 'error'
  | 'audit'
  | 'tool.call'
  | 'tool.result'
  | 'hook';

export type Step =
  | 'socratic'
  | 'concept'
  | 'research'
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

export interface Scores {
  goal_completion?: number;
  collaboration?: number;
  groundedness?: number;
  actionability?: number;
  cost_efficiency?: number;
  intervention_response?: number;
  aggregate?: number;
  verdict?: Verdict;
  feedback?: string;
  audit_violations?: string[];
}

export interface Content {
  format: 'markdown' | 'json' | 'text' | 'xml';
  text: string;
}

export interface Metadata {
  visibility?: 'public' | 'private';
  model?: string;
  turn?: number;
  tokens_in?: number;
  tokens_out?: number;
  cache_read?: number;
  cache_write?: number;
  latency_ms?: number;
  cost_usd?: number;
  thinking_tokens?: number;
  audit_violations?: string[];
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
