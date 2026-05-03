/**
 * Loose Message shape used by the studio.
 *
 * The studio package is intentionally decoupled from `crumb` core types so
 * the two can version independently. We only depend on the *protocol surface*
 * documented in protocol/schemas/message.schema.json — not the TS types in
 * src/protocol/types.ts. Any field here is best-effort.
 */

export interface StudioMessage {
  id: string;
  ts: string;
  session_id: string;
  from: string;
  kind: string;
  to?: string;
  parent_event_id?: string | null;
  in_reply_to?: string | null;
  step?: string;
  body?: string;
  data?: Record<string, unknown>;
  scores?: {
    aggregate?: number;
    verdict?: 'PASS' | 'PARTIAL' | 'FAIL' | 'REJECT';
    audit_violations?: string[];
    [k: string]: unknown;
  };
  metadata?: {
    harness?: string;
    provider?: string;
    model?: string;
    tokens_in?: number;
    tokens_out?: number;
    cache_read?: number;
    cache_write?: number;
    cost_usd?: number;
    latency_ms?: number;
    deterministic?: boolean;
    cross_provider?: boolean;
    audit_violations?: string[];
    [k: string]: unknown;
  };
}

export type Verdict = 'PASS' | 'PARTIAL' | 'FAIL' | 'REJECT';

/**
 * D1-D6 dimension constants — Studio-local mirror of `src/protocol/types.ts`.
 *
 * Resolves the §17.3 #2 leak (D1-D6 strings hardcoded in v1 studio.js +
 * panel renderers). Studio panels MUST import from here rather than
 * inlining literals; lint catches drift.
 *
 * Mirror discipline: keep aligned with `src/protocol/types.ts`. The studio
 * is decoupled from crumb core types by design (§17.2), so we mirror
 * rather than re-export. If labels drift, an e2e test catches it.
 */
export type Dimension = 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6';

export const DIMENSIONS: readonly Dimension[] = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'] as const;

export const DIMENSION_LABELS: Record<Dimension, string> = {
  D1: 'spec_fit',
  D2: 'exec',
  D3: 'schema',
  D4: 'reflection',
  D5: 'quality',
  D6: 'portability',
};

export const DIMENSION_MAX = 5;
export const AGGREGATE_MAX = 30;

export type ScoreSource = 'verifier-llm' | 'qa-check-effect' | 'reducer-auto';

export const SCORE_SOURCE_LABELS: Record<ScoreSource, string> = {
  'verifier-llm': 'LLM',
  'qa-check-effect': 'QA',
  'reducer-auto': 'AUTO',
};
