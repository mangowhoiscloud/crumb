import { describe, expect, it } from 'vitest';

import { computeAutoScores } from './scorer.js';
import type { Message } from '../protocol/types.js';

const fixed = (overrides: Partial<Message>): Message => ({
  id: '01H0000000000000000000000A',
  ts: '2026-05-01T00:00:00.000Z',
  session_id: 'sess-test',
  from: 'user',
  kind: 'note',
  ...overrides,
});

describe('Layer 1 auto-scorer', () => {
  it('D4=5 for clean 1-pass session', () => {
    const transcript: Message[] = [
      fixed({ kind: 'goal' }),
      fixed({ kind: 'spec' }),
      fixed({ kind: 'build' }),
      fixed({ kind: 'qa.result' }),
      fixed({ kind: 'verify.result' }),
      fixed({ kind: 'done' }),
    ];
    const auto = computeAutoScores(transcript);
    expect(auto.D4).toBe(5);
  });

  it('D4 drops with spec.update count', () => {
    const transcript: Message[] = [
      fixed({ kind: 'goal' }),
      fixed({ kind: 'spec.update' }),
      fixed({ kind: 'spec.update' }),
      fixed({ kind: 'spec.update' }),
    ];
    const auto = computeAutoScores(transcript);
    expect(auto.D4).toBe(2); // 3 spec.updates → score 2
  });

  it('D5=5 when no user.intervene events present', () => {
    const transcript: Message[] = [fixed({ kind: 'goal' }), fixed({ kind: 'spec' })];
    const auto = computeAutoScores(transcript);
    expect(auto.D5_auto).toBe(5);
  });

  it('D5 reflects user.intervene followed by spec.update', () => {
    const transcript: Message[] = [
      fixed({ kind: 'goal' }),
      fixed({ kind: 'user.intervene', body: 'change color' }),
      fixed({ kind: 'spec.update' }),
    ];
    const auto = computeAutoScores(transcript);
    expect(auto.D5_auto).toBe(5); // 1/1 reflected
  });

  it('D3 increases with kind diversity + body length', () => {
    const transcript: Message[] = [
      fixed({ kind: 'goal', body: 'a'.repeat(80) }),
      fixed({ kind: 'spec', body: 'b'.repeat(80) }),
      fixed({ kind: 'build', body: 'c'.repeat(80) }),
      fixed({ kind: 'qa.result', body: 'd'.repeat(80) }),
      fixed({ kind: 'verify.result', body: 'e'.repeat(80) }),
      fixed({ kind: 'done', body: 'f'.repeat(80) }),
    ];
    const auto = computeAutoScores(transcript);
    expect(auto.D3_auto).toBe(5); // full diversity (3) + full density (2)
  });
});
