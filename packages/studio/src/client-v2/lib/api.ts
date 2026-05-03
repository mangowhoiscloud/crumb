/**
 * Typed API wrappers — single source of HTTP shape for v2 panels.
 *
 * Mirrors the server routes documented in `packages/studio/src/server/server.ts`
 * (M1 location). When a route adds a new field, this file updates first;
 * panels consume the typed result.
 *
 * Per AGENTS.md §invariant 1 + plan §17 audit: derivation is server-side.
 * Panels read enriched fields from `/api/sessions` + SSE state events;
 * never re-derive scores client-side.
 */

export interface AdapterStatus {
  id: string;
  display_name: string;
  binary?: string;
  env_var?: string;
  installed: boolean;
  authenticated: boolean | null;
  version?: string;
  models: string[];
  install_hint?: string;
  auth_hint?: string;
  /** Subscription tier (claude max / codex prolite / apikey / mock / etc.) */
  plan?: string;
  /** ISO-8601 expiry of the OAuth/JWT credential. */
  login_expires_at?: string;
  email?: string;
  auth_source?: 'env' | 'env.local' | 'env-file' | 'keychain' | 'config-file' | 'mock' | 'none';
}

export interface SessionMetrics {
  events: number;
  tokens?: number;
  cache?: number;
  cost?: number;
  p95_latency?: number;
  errors?: number;
  last_verdict?: 'PASS' | 'FAIL' | 'PARTIAL' | 'REJECT' | null;
  last_aggregate?: number | null;
}

export interface SessionRow {
  session_id: string;
  project_id: string;
  goal: string | null;
  metrics?: SessionMetrics;
  derived_state?: 'live' | 'paused' | 'done' | 'errored' | 'terminal' | 'unknown';
  derived_state_reason?: string | null;
  done_reason?: string | null;
  live?: boolean;
}

export interface SessionsResponse {
  sessions: SessionRow[];
}

export interface DoctorResponse {
  adapters: AdapterStatus[];
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  sessions: () => jsonFetch<SessionsResponse>('/api/sessions'),
  doctor: () => jsonFetch<DoctorResponse>('/api/doctor'),
  spawnRun: (body: { goal: string; preset?: string; adapter?: string; bindings?: unknown }) =>
    jsonFetch<{ ok: boolean; pid: number }>('/api/crumb/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  inboxAppend: (sessionId: string, line: string) =>
    jsonFetch<{ ok: boolean; line: string }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/inbox`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ line }),
      },
    ),
};
