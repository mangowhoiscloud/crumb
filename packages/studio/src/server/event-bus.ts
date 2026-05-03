/**
 * EventBus — fan-out of live events to SSE subscribers.
 *
 * Per-session set + wildcard '*' set. Synchronous publish; subscriber errors
 * are isolated so one bad client cannot break the bus.
 */

import type { StudioMessage } from './types.js';
import type { SessionMetrics } from './metrics.js';
import type { SessionState } from './bootstrap.js';

export type LiveEvent =
  | { type: 'append'; session_id: string; msg: StudioMessage }
  | {
      type: 'session_start';
      session_id: string;
      project_id: string;
      goal: string | null;
      preset: string | null;
    }
  | {
      type: 'state';
      session_id: string;
      metrics: SessionMetrics;
      // v0.5 PR-O1.5 — push the classifier output alongside metrics so the
      // client can transition the header pill / sidebar dot in real time
      // instead of waiting for a next-poll. Adds one classifyFromMtime call
      // per change batch (no fs syscall, just stat already cached).
      lifecycle?: {
        state: SessionState;
        last_activity_at: number;
        done_reason?: string;
      };
    }
  | { type: 'heartbeat'; ts: string };

export type Subscriber = (evt: LiveEvent) => void;

export class EventBus {
  private readonly perSession = new Map<string, Set<Subscriber>>();
  private readonly wildcard = new Set<Subscriber>();

  subscribe(sessionId: string | '*', sub: Subscriber): () => void {
    if (sessionId === '*') {
      this.wildcard.add(sub);
      return () => this.wildcard.delete(sub);
    }
    let set = this.perSession.get(sessionId);
    if (!set) {
      set = new Set();
      this.perSession.set(sessionId, set);
    }
    set.add(sub);
    return () => {
      set!.delete(sub);
      if (set!.size === 0) this.perSession.delete(sessionId);
    };
  }

  publish(evt: LiveEvent): void {
    const sessionId = 'session_id' in evt ? evt.session_id : null;
    if (sessionId) {
      const set = this.perSession.get(sessionId);
      if (set) {
        for (const sub of set) {
          try {
            sub(evt);
          } catch {
            // subscriber error must not break the bus
          }
        }
      }
    }
    for (const sub of this.wildcard) {
      try {
        sub(evt);
      } catch {
        // ignore
      }
    }
  }

  subscriberCount(sessionId?: string): number {
    if (!sessionId) return this.wildcard.size;
    return (this.perSession.get(sessionId)?.size ?? 0) + this.wildcard.size;
  }
}
