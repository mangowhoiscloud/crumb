import { describe, expect, it } from 'vitest';

import {
  ABANDONED_THRESHOLD_MS,
  IDLE_THRESHOLD_MS,
  LIVE_THRESHOLD_MS,
  classifyFromMtime,
} from './bootstrap.js';
import type { StudioMessage } from './types.js';

const NOW = 1_700_000_000_000;

function msg(kind: string, extra: Partial<StudioMessage> = {}): StudioMessage {
  return {
    id: `01-${kind}`,
    ts: new Date(NOW).toISOString(),
    session_id: 'sess',
    from: 'system',
    kind,
    ...extra,
  };
}

describe('classifyFromMtime', () => {
  it('classifies fresh activity as live', () => {
    const c = classifyFromMtime(NOW - 5_000, [msg('build')], NOW);
    expect(c.state).toBe('live');
    expect(c.last_event_kind).toBe('build');
    expect(c.has_done).toBe(false);
  });

  it('classifies stale-but-recent as idle', () => {
    const c = classifyFromMtime(NOW - (LIVE_THRESHOLD_MS + 1_000), [msg('build')], NOW);
    expect(c.state).toBe('idle');
  });

  it('classifies multi-minute stale as interrupted', () => {
    const c = classifyFromMtime(NOW - (IDLE_THRESHOLD_MS + 1_000), [msg('spec')], NOW);
    expect(c.state).toBe('interrupted');
  });

  it('classifies day-plus stale as abandoned', () => {
    const c = classifyFromMtime(NOW - (ABANDONED_THRESHOLD_MS + 1_000), [msg('goal')], NOW);
    expect(c.state).toBe('abandoned');
  });

  it('classifies sessions with kind=done as terminal regardless of mtime', () => {
    const events = [
      msg('goal'),
      msg('done', { from: 'system', body: 'verdict_pass', data: { reason: 'verdict_pass' } }),
    ];
    const c = classifyFromMtime(NOW - 5_000, events, NOW);
    expect(c.state).toBe('terminal');
    expect(c.has_done).toBe(true);
    expect(c.done_reason).toBe('verdict_pass');
  });

  it('falls back to body when done.data.reason is absent', () => {
    const events = [msg('done', { body: 'too_many_respec' })];
    const c = classifyFromMtime(NOW - 5_000, events, NOW);
    expect(c.done_reason).toBe('too_many_respec');
  });

  it('preserves last_event_kind/actor for empty/abandoned sessions', () => {
    const events = [msg('build', { from: 'builder' })];
    const c = classifyFromMtime(NOW - (ABANDONED_THRESHOLD_MS + 1_000), events, NOW);
    expect(c.last_event_kind).toBe('build');
    expect(c.last_event_actor).toBe('builder');
  });

  it('handles future mtime (clock skew) without negative age', () => {
    const c = classifyFromMtime(NOW + 5_000, [msg('build')], NOW);
    expect(c.state).toBe('live');
  });

  it('handles empty history (no events yet)', () => {
    const c = classifyFromMtime(NOW - 5_000, [], NOW);
    expect(c.state).toBe('live');
    expect(c.has_done).toBe(false);
    expect(c.last_event_kind).toBeUndefined();
  });
});
