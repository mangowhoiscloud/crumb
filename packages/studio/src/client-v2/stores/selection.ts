/**
 * selection store — ephemeral UI state for "which session is active".
 *
 * Zustand-style hand-rolled (no external dep) since we have one slice
 * with one consumer per the CLAUDE.md "no new abstraction unless 2+
 * call sites" rule. Becomes a real Zustand slice in M5 when more
 * panels need it.
 */

import { useSyncExternalStore } from 'react';

interface State {
  activeSessionId: string | null;
}

let state: State = { activeSessionId: null };
const listeners = new Set<() => void>();

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  for (const fn of listeners) fn();
}

export function setActiveSession(id: string | null): void {
  if (state.activeSessionId === id) return;
  state = { activeSessionId: id };
  notify();
}

export function useActiveSession(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => state.activeSessionId,
    () => null,
  );
}
