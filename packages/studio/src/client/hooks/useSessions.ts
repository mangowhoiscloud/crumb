/**
 * useSessions — TanStack Query bridge for `/api/sessions` + SSE state events.
 *
 * Bootstrap is one-shot: the snapshot fetch hydrates the query cache, then
 * the SSE stream takes over via `setQueryData` for incremental updates
 * (per the 2026 ollioddi.dev pattern: bootstrap with HTTP, sync with SSE).
 *
 * Live updates land via `event: state` (lifecycle classifications + metric
 * patches) and `event: append` (transcript event drives metric recompute on
 * the server, which echoes back as a state push).
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api, type SessionsResponse, type SessionRow } from '../lib/api';

const QUERY_KEY = ['sessions'] as const;

export function useSessions() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: api.sessions,
    staleTime: 30_000, // server pushes via SSE, so polling can be lazy
  });
}

/**
 * Bridge SSE → query cache. Mount once at app root. Patches the cached
 * SessionsResponse in place when state events arrive — never refetches
 * the whole snapshot mid-session (that would lose SSE-only fields).
 */
export function useSessionsSseBridge() {
  const qc = useQueryClient();

  useEffect(() => {
    const es = new EventSource('/api/stream?session=*');
    const onState = (e: Event): void => {
      const me = e as MessageEvent;
      try {
        const data = JSON.parse(me.data) as { session_id?: string; state?: Partial<SessionRow> };
        if (!data.session_id) return;
        qc.setQueryData<SessionsResponse | undefined>(QUERY_KEY, (prev) => {
          if (!prev) return prev;
          const idx = prev.sessions.findIndex((s) => s.session_id === data.session_id);
          if (idx === -1) {
            return {
              sessions: [
                ...prev.sessions,
                { session_id: data.session_id!, project_id: '', goal: null, ...data.state },
              ],
            };
          }
          const next = [...prev.sessions];
          next[idx] = { ...next[idx], ...(data.state ?? {}) } as SessionRow;
          return { sessions: next };
        });
      } catch {
        /* malformed event — keep last known state */
      }
    };
    es.addEventListener('state', onState);
    return () => es.close();
  }, [qc]);
}
