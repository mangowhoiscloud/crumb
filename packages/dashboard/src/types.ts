/**
 * Loose Message shape used by the dashboard.
 *
 * The dashboard package is intentionally decoupled from `crumb` core types so
 * the two can version independently. We only depend on the *protocol surface*
 * documented in protocol/schemas/message.schema.json — not the TS types in
 * src/protocol/types.ts. Any field here is best-effort.
 */

export interface DashboardMessage {
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
