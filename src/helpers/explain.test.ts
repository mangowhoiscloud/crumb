import { describe, expect, it } from 'vitest';

import { KIND_REGISTRY, explainKind, formatExplain } from './explain.js';

describe('KIND_REGISTRY coverage', () => {
  it('covers every Kind in the union (35 after PR-Prune-1)', () => {
    // 35 = 4 system + 10 workflow + 2 dialogue + 6 step + 5 user + 2 handoff + 5 meta + 1 version.
    // PR-Prune-1 dropped 9 never-emitted kinds (session.forked, verify.request, question,
    // answer, debate, version.refinement, ack, handoff.accepted, hook). agent.thought_summary
    // kept for verifier input filtering; tool.call/tool.result kept as the dispatcher's
    // stream-json tap pair (live.ts:322 emits tool.call).
    expect(Object.keys(KIND_REGISTRY)).toHaveLength(35);
    const required = [
      'qa.result',
      'judge.score',
      'spec',
      'build',
      'done',
      'user.intervene',
      'step.judge',
      'tool.call',
    ];
    for (const k of required) expect(KIND_REGISTRY).toHaveProperty(k);
  });
});

describe('explainKind', () => {
  it('exact match returns kind info', () => {
    const r = explainKind('qa.result');
    expect(r.found).toBe(true);
    expect(r.kind?.kind).toBe('qa.result');
    expect(r.kind?.source_of_truth).toContain('D2');
  });

  it('case-insensitive', () => {
    expect(explainKind('JUDGE.SCORE').found).toBe(true);
  });

  it('partial match returns suggestions', () => {
    const r = explainKind('user');
    expect(r.found).toBe(false);
    expect(r.suggestions).toContain('user.intervene');
    expect(r.suggestions).toContain('user.veto');
  });

  it('unknown kind returns empty suggestions', () => {
    const r = explainKind('totally-fake-kind-xyz');
    expect(r.found).toBe(false);
    expect(r.suggestions).toHaveLength(0);
  });

  it('formatExplain renders structured output', () => {
    const out = formatExplain(explainKind('judge.score'));
    expect(out).toContain('judge.score');
    expect(out).toContain('emitter:');
    expect(out).toContain('★ truth:');
    expect(out).toContain('ref:');
  });

  it('formatExplain shows did-you-mean for partial', () => {
    const out = formatExplain(explainKind('handoff'));
    expect(out).toContain('did you mean');
    expect(out).toContain('handoff.requested');
  });
});
