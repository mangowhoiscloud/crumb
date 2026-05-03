/**
 * Session state classifier.
 *
 * The transcript is the single source of truth (AGENTS.md invariant #1) — we
 * derive liveness purely from `kind=done` presence + transcript mtime, no PID
 * files or daemon required. Pattern lifted from VS Code's workspaceStorage
 * (mtime + meta scan) + Kubernetes' init-container vs liveness-probe split.
 *
 * Wiki ref: bagelcode-fault-tolerance-design.md F1-F5.
 */

import { stat } from 'node:fs/promises';

import type { StudioMessage } from './types.js';

export type SessionState = 'live' | 'idle' | 'interrupted' | 'abandoned' | 'terminal';

export interface SessionClassification {
  state: SessionState;
  last_activity_at: number;
  has_done: boolean;
  done_reason?: string;
  last_event_kind?: string;
  last_event_actor?: string;
}

/** Tunables — kept as exports so tests can override without monkey-patching. */
export const LIVE_THRESHOLD_MS = 10_000; //  active write within 10s → live
export const IDLE_THRESHOLD_MS = 5 * 60_000; // 5min → idle (still recent)
export const ABANDONED_THRESHOLD_MS = 24 * 3600_000; // 1d → abandoned

/**
 * Classify a session's lifecycle state from its transcript file + parsed history.
 * Pure function modulo `stat` syscall; no LLM, no spawn.
 *
 *   has_done                     → terminal
 *   age < LIVE_THRESHOLD          → live
 *   age < IDLE_THRESHOLD          → idle
 *   age < ABANDONED_THRESHOLD     → interrupted (Resume CTA)
 *   age ≥ ABANDONED_THRESHOLD     → abandoned
 */
export async function classifySessionState(
  transcriptPath: string,
  history: StudioMessage[],
  now: number = Date.now(),
): Promise<SessionClassification> {
  const st = await stat(transcriptPath);
  const lastActivityAt = st.mtimeMs;
  const ageMs = Math.max(0, now - lastActivityAt);
  const lastEvent = history[history.length - 1];
  const doneEvent = history.find((e) => e.kind === 'done');
  const hasDone = !!doneEvent;

  let state: SessionState;
  if (hasDone) state = 'terminal';
  else if (ageMs < LIVE_THRESHOLD_MS) state = 'live';
  else if (ageMs < IDLE_THRESHOLD_MS) state = 'idle';
  else if (ageMs < ABANDONED_THRESHOLD_MS) state = 'interrupted';
  else state = 'abandoned';

  const doneReason =
    doneEvent && typeof doneEvent.data?.reason === 'string'
      ? (doneEvent.data.reason as string)
      : doneEvent?.body;

  return {
    state,
    last_activity_at: lastActivityAt,
    has_done: hasDone,
    ...(doneReason ? { done_reason: doneReason } : {}),
    ...(lastEvent?.kind ? { last_event_kind: lastEvent.kind } : {}),
    ...(lastEvent?.from ? { last_event_actor: lastEvent.from } : {}),
  };
}

/**
 * Pure variant — no fs syscall. Used by the periodic probe path which already
 * has a fresh `mtimeMs` from chokidar's stat cache, and by tests.
 */
export function classifyFromMtime(
  mtimeMs: number,
  history: StudioMessage[],
  now: number = Date.now(),
): SessionClassification {
  const ageMs = Math.max(0, now - mtimeMs);
  const lastEvent = history[history.length - 1];
  const doneEvent = history.find((e) => e.kind === 'done');
  const hasDone = !!doneEvent;

  let state: SessionState;
  if (hasDone) state = 'terminal';
  else if (ageMs < LIVE_THRESHOLD_MS) state = 'live';
  else if (ageMs < IDLE_THRESHOLD_MS) state = 'idle';
  else if (ageMs < ABANDONED_THRESHOLD_MS) state = 'interrupted';
  else state = 'abandoned';

  const doneReason =
    doneEvent && typeof doneEvent.data?.reason === 'string'
      ? (doneEvent.data.reason as string)
      : doneEvent?.body;

  return {
    state,
    last_activity_at: mtimeMs,
    has_done: hasDone,
    ...(doneReason ? { done_reason: doneReason } : {}),
    ...(lastEvent?.kind ? { last_event_kind: lastEvent.kind } : {}),
    ...(lastEvent?.from ? { last_event_actor: lastEvent.from } : {}),
  };
}
