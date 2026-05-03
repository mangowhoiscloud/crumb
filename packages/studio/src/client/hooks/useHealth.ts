/**
 * useHealth — TanStack Query bridge for `/api/health`.
 *
 * Per migration plan §6.8 — exposes `pause_resume_lifecycle` so the
 * Status Bar HealthBadge can render green / amber / red dot.
 *
 * Refetches every 60 s. Cheap on the server side (the report is cached
 * 30 s before it hits the reducer self-check helper).
 */

import { useQuery } from '@tanstack/react-query';

export interface SelfCheckStep {
  step: string;
  status: 'pass' | 'fail';
  detail?: string;
}

export interface HealthSnapshot {
  ok: boolean;
  watcher_paths_tracked: number;
  sessions: { total: number; by_state: Record<string, number> };
  pause_resume_lifecycle?: {
    verdict: 'ok' | 'degraded' | 'broken';
    duration_ms: number;
    steps_failed: number;
    steps?: SelfCheckStep[];
    cached_at: string;
  };
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const r = await fetch('/api/health');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()) as HealthSnapshot;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
