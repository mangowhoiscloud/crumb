import { describe, it, expect } from 'vitest';

import { EventBus } from './event-bus.js';

describe('EventBus', () => {
  it('delivers events to per-session subscribers', () => {
    const bus = new EventBus();
    const seen: string[] = [];
    bus.subscribe('A', (e) => seen.push(e.type));
    bus.publish({ type: 'session_start', session_id: 'A', goal: null, preset: null });
    bus.publish({ type: 'session_start', session_id: 'B', goal: null, preset: null });
    expect(seen).toEqual(['session_start']);
  });

  it('delivers all events to wildcard subscribers', () => {
    const bus = new EventBus();
    const seen: string[] = [];
    bus.subscribe('*', (e) => seen.push('session_id' in e ? e.session_id : 'hb'));
    bus.publish({ type: 'session_start', session_id: 'A', goal: null, preset: null });
    bus.publish({ type: 'session_start', session_id: 'B', goal: null, preset: null });
    bus.publish({ type: 'heartbeat', ts: 't' });
    expect(seen).toEqual(['A', 'B', 'hb']);
  });

  it('unsubscribe stops further deliveries', () => {
    const bus = new EventBus();
    let count = 0;
    const off = bus.subscribe('A', () => count++);
    bus.publish({ type: 'session_start', session_id: 'A', goal: null, preset: null });
    off();
    bus.publish({ type: 'session_start', session_id: 'A', goal: null, preset: null });
    expect(count).toBe(1);
  });

  it('isolates subscriber errors', () => {
    const bus = new EventBus();
    bus.subscribe('A', () => {
      throw new Error('boom');
    });
    let okCalled = 0;
    bus.subscribe('A', () => {
      okCalled++;
    });
    bus.publish({ type: 'session_start', session_id: 'A', goal: null, preset: null });
    expect(okCalled).toBe(1);
  });
});
