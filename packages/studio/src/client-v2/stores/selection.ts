/**
 * selection store — ephemeral UI state.
 *
 * Two slices:
 *   activeSessionId — which session is selected in the sidebar
 *   selectedNodeActor — which Pipeline DAG node is currently selected
 *                       (drives DetailRail tri-mode → node-inspector)
 *
 * Hand-rolled subscription (no Zustand dep yet, per CLAUDE.md "no new
 * abstraction unless 2+ call sites" — promotes to Zustand at M5 when
 * narrative + feed + slash bar all need shared ephemeral state).
 */

import { useSyncExternalStore } from 'react';

/**
 * Output panel source pointer. `session` mode renders the live session's
 * artifacts/ via /api/sessions/:id/artifact/*. `version` mode renders a
 * frozen release manifest's artifacts/ via /api/projects/:pid/versions/:v/
 * artifact/*. M7 Versions panel writes this on row click.
 */
export type OutputSource =
  | { mode: 'session' }
  | { mode: 'version'; projectId: string; versionDir: string };

interface State {
  activeSessionId: string | null;
  selectedNodeActor: string | null;
  outputSource: OutputSource;
}

let state: State = {
  activeSessionId: null,
  selectedNodeActor: null,
  outputSource: { mode: 'session' },
};
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
  // Switching session also clears the node selection + resets output source —
  // node IDs are session-agnostic but the inspector is session-bound, and a
  // frozen-version preview pinned to a different project would be misleading.
  state = {
    ...state,
    activeSessionId: id,
    selectedNodeActor: null,
    outputSource: { mode: 'session' },
  };
  notify();
}

export function setSelectedNodeActor(actor: string | null): void {
  if (state.selectedNodeActor === actor) return;
  state = { ...state, selectedNodeActor: actor };
  notify();
}

export function setOutputSource(src: OutputSource): void {
  state = { ...state, outputSource: src };
  notify();
}

export function useActiveSession(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => state.activeSessionId,
    () => null,
  );
}

export function useSelectedNodeActor(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => state.selectedNodeActor,
    () => null,
  );
}

export function useOutputSource(): OutputSource {
  return useSyncExternalStore(
    subscribe,
    () => state.outputSource,
    () => ({ mode: 'session' }) as OutputSource,
  );
}
