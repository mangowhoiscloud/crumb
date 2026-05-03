/**
 * useTranscriptStream — SSE bridge for the active session's transcript.
 *
 * Live append events for the selected session. Returns a rolling window
 * of the last `windowSize` events (default 200) so panels render in O(1)
 * regardless of total session length. The full transcript is server-side
 * (paths.ts → JsonlTail); panels never mirror the entire history.
 *
 * Per AGENTS.md §invariant 1 + 7: append-only, single-source. Client
 * never writes back to transcript.jsonl; never recomputes scores.
 */

import { useEffect, useState } from 'react';
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

export function useTranscriptStream(windowSize = 200): StreamState {
  const sessionId = useActiveSession();
  const [state, setState] = useState<StreamState>({
    events: [],
    status: 'idle',
    reconnectAttempts: 0,
  });

  useEffect(() => {
    if (!sessionId) {
      setState({ events: [], status: 'idle', reconnectAttempts: 0 });
      return;
    }
    setState({ events: [], status: 'connecting', reconnectAttempts: 0 });
    const es = new EventSource(`/api/stream?session=${encodeURIComponent(sessionId)}`);

    const promote = (): void => {
      setState((prev) => (prev.status === 'connecting' ? { ...prev, status: 'streaming' } : prev));
    };

    const onAppend = (e: Event): void => {
      const me = e as MessageEvent;
      try {
        const data = JSON.parse(me.data) as { msg?: TranscriptEvent };
        if (!data.msg) return;
        setState((prev) => ({
          ...prev,
          status: 'streaming',
          events: [...prev.events, data.msg as TranscriptEvent].slice(-windowSize),
        }));
      } catch {
        /* malformed — drop */
      }
    };

    es.addEventListener('append', onAppend);
    es.addEventListener('heartbeat', promote);
    // Promote on connection open too — covers idle sessions where the
    // next append + next 15 s heartbeat are both far away. EventSource's
    // readyState transition (CONNECTING → OPEN) is enough confirmation.
    es.addEventListener('open', promote);
    // Also promote on any unnamed message — some proxies strip `event:`
    // prefixes; same effect: confirms a frame round-tripped.
    es.addEventListener('message', promote);
    es.onerror = () => {
      setState((prev) => ({
        ...prev,
        status: 'errored',
        reconnectAttempts: prev.reconnectAttempts + 1,
      }));
    };

    // Safety net for the listener-registration race: if the SSE
    // connection is OPEN within 1.5 s but no event listener has fired
    // yet (server's first frame arrived before listeners registered),
    // force-promote so the user sees an accurate "streaming" badge.
    const grace = window.setTimeout(() => {
      if (es.readyState === EventSource.OPEN) promote();
    }, 1500);

    return () => {
      window.clearTimeout(grace);
      es.close();
    };
  }, [sessionId, windowSize]);

  return state;
}
