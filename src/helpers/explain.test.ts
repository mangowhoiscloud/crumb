import { describe, expect, it } from 'vitest';

import { KIND_REGISTRY, explainKind, formatExplain } from './explain.js';

describe('KIND_REGISTRY coverage', () => {
  it('covers every Kind in the union (44 in v0.3.0; +session.forked +version.released +version.refinement +step.research.video)', () => {
    // 44 = 5 system + 11 workflow + 5 dialogue + 6 step + 5 user + 3 handoff + 7 meta + 2 version.
    // v0.3.0 storage refactor added session.forked under "system" and 2 "version" kinds.
    // v0.3.0 researcher actor added step.research.video under "step" for per-clip video evidence.
    expect(Object.keys(KIND_REGISTRY)).toHaveLength(44);
    const required = [
      'qa.result',
      'judge.score',
      'spec',
      'build',
      'done',
      'user.intervene',
      'step.judge',
      'hook',
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
