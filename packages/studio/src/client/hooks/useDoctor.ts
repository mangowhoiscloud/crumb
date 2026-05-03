/**
 * useDoctor — TanStack Query bridge for `/api/doctor`.
 *
 * Refetches every 30s (cheap — keychain/config-file pure reads).
 * Used by the AdapterList panel to surface plan / login-expiry / install
 * hint per #173 server-side probe.
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useDoctor() {
  return useQuery({
    queryKey: ['doctor'],
    queryFn: api.doctor,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
