/**
 * useTranscriptStream — single shared SSE connection per active session.
 *
 * Earlier this hook created a fresh `EventSource` per consuming
 * component. With 7+ panels (Narrative / Feed / Logs / Output /
 * Transcript / ToolCallTrace / Waterfall / ServiceMap / Scorecard /
 * ErrorBudgetStrip / DesignCheckPanel / DetailRail) all reading the
 * same stream, that meant 7+ concurrent server connections, 7+ separate
 * `events` arrays, and 7+ independent reconnect timers — when the
 * server restarted (rebuild loop) some panels caught the resulting
 * backfill burst and others didn't, producing the "panels flicker on
 * and off, no two views agree" symptom the user reported.
 *
 * Now: a module-scoped singleton store. Exactly one `EventSource` per
 * active session. Every consumer reads the same `events` array via
 * `useSyncExternalStore`. Switching the active session tears down the
 * old connection + clears state once; opening 10 panels spawns 0
 * additional connections.
 *
 * Per AGENTS.md §invariant 1 + 7: append-only, single-source. Client
 * never writes back to transcript.jsonl; never recomputes scores.
 */

import { useSyncExternalStore } from 'react';
import { useActiveSession } from '../stores/selection';

export interface TranscriptEvent {
  id: string;
  ts: string;
  session_id: string;
  from: string;
  kind: string;
  body?: string;
  data?: Record<string, unknown>;
  scores?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface StreamState {
  events: TranscriptEvent[];
  status: 'idle' | 'connecting' | 'streaming' | 'errored';
  reconnectAttempts: number;
}

const IDLE: StreamState = { events: [], status: 'idle', reconnectAttempts: 0 };

const subscribers = new Set<() => void>();
let activeSession: string | null = null;
let activeSource: EventSource | null = null;
// Default window 5000 — long sessions (Phaser builder + multi-round
// CourtEval verifier) hit 700–1500 events; the previous 500 cap evicted
// early agent.wake / step.* records, which made Waterfall miss the
// pre-builder spans the user reported. 5000 covers any reasonable
// session (~25 MB client RAM at 5 KB / event).
let activeWindowSize = 5000;
let state: StreamState = IDLE;

// Backfill burst coalescing — without this, a 700-event backfill fired
// 700 setState calls in <100 ms on session switch, freezing every
// panel's re-render. We accumulate incoming events into a pending
// buffer and flush via microtask, collapsing the burst into one
// commit. Live (post-burst) events still flush per-tick because the
// buffer drains immediately when no further events follow.
let pending: TranscriptEvent[] = [];
let flushScheduled = false;

function scheduleFlush(): void {
  if (flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(() => {
    flushScheduled = false;
    if (pending.length === 0) return;
    const batch = pending;
    pending = [];
    set((prev) => ({
      ...prev,
      status: 'streaming',
      events: [...prev.events, ...batch].slice(-activeWindowSize),
    }));
  });
}

function notify(): void {
  for (const fn of subscribers) fn();
}

function set(next: StreamState | ((prev: StreamState) => StreamState)): void {
  const resolved = typeof next === 'function' ? next(state) : next;
  if (resolved === state) return;
  state = resolved;
  notify();
}

function teardown(): void {
  if (activeSource) {
    activeSource.close();
    activeSource = null;
  }
  // Drop any in-flight backfill batch — it's tied to the closed
  // connection's session, not the next one. Without this, switching
  // sessions while the backfill burst is still queued mixes events
  // from the old session into the new one's first paint.
  pending = [];
}

function ensureConnection(sessionId: string | null, windowSize: number): void {
  // Largest requested window wins (Transcript may want 500, Narrative 200).
  // Trimming uses the active value at append-time, so a later consumer that
  // requests 500 won't lose history that the first 200-cap had already
  // dropped, but it bounds memory growth across navigations.
  if (windowSize > activeWindowSize) activeWindowSize = windowSize;

  if (activeSession === sessionId && activeSource) return;

  // Session change (or first mount). Tear down + reset.
  teardown();
  activeSession = sessionId;
  if (!sessionId) {
    set(IDLE);
    return;
  }
  set({ events: [], status: 'connecting', reconnectAttempts: 0 });
  const es = new EventSource(`/api/stream?session=${encodeURIComponent(sessionId)}`);
  activeSource = es;

  const promote = (): void => {
    set((prev) => (prev.status === 'connecting' ? { ...prev, status: 'streaming' } : prev));
  };

  const onAppend = (e: Event): void => {
    const me = e as MessageEvent;
    try {
      const data = JSON.parse(me.data) as { msg?: TranscriptEvent };
      if (!data.msg) return;
      pending.push(data.msg as TranscriptEvent);
      scheduleFlush();
    } catch {
      /* malformed — drop */
    }
  };

  es.addEventListener('append', onAppend);
  es.addEventListener('heartbeat', promote);
  // Promote on connection open + any unnamed message to cover proxies that
  // strip the `event:` prefix and idle sessions where heartbeat is far away.
  es.addEventListener('open', promote);
  es.addEventListener('message', promote);
  es.onerror = () => {
    set((prev) => ({
      ...prev,
      status: 'errored',
      reconnectAttempts: prev.reconnectAttempts + 1,
    }));
  };

  // Listener-registration race safety net: if the SSE connection is OPEN
  // within 1.5 s but no event listener has fired yet (server's first frame
  // arrived before listeners registered), force-promote so the badge is
  // accurate even on quiet sessions.
  window.setTimeout(() => {
    if (activeSource === es && es.readyState === EventSource.OPEN) promote();
  }, 1500);
}

function subscribe(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
    // Last consumer left → tear down. Re-mounting any consumer kicks the
    // connection back up.
    if (subscribers.size === 0) {
      teardown();
      activeSession = null;
      state = IDLE;
    }
  };
}

export function useTranscriptStream(windowSize = 500): StreamState {
  const sessionId = useActiveSession();
  // Synchronous-on-render to keep the connection in sync with active session.
  // Re-running on every render is safe — `ensureConnection` short-circuits
  // when nothing has changed.
  ensureConnection(sessionId, windowSize);
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => IDLE,
  );
}
