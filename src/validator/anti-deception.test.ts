import { describe, expect, it } from 'vitest';

import { checkAntiDeception } from './anti-deception.js';
import type { Message } from '../protocol/types.js';

const judgeScore = (overrides: Partial<Message>): Message => ({
  id: '01H0000000000000000000000A',
  ts: '2026-05-01T00:00:00.000Z',
  session_id: 'sess-test',
  from: 'verifier',
  kind: 'judge.score',
  scores: {
    D1: { score: 5, source: 'verifier-llm' },
    D2: { score: 5, source: 'qa-check-effect', lookup: 'qa.result.exec_exit_code' },
    D3: { score: 4, source: 'hybrid', auto: 4, semantic: 4 },
    D4: { score: 5, source: 'reducer-auto', lookup: 'scoreHistory' },
    D5: { score: 4, source: 'hybrid', auto: 4, quality: 4 },
    D6: { score: 5, source: 'qa-check-effect' },
    aggregate: 28,
    verdict: 'PASS',
  },
  metadata: { provider: 'google' },
  ...overrides,
});

describe('anti-deception validator', () => {
  it('Rule 1: PASS without exec_zero downgrades to FAIL', () => {
    const result = checkAntiDeception({
      judgeScore: judgeScore({}),
      qaResult: { exec_exit_code: 1 },
      autoScores: { D3_auto: 4, D4: 5, D5_auto: 4 },
      builderProvider: 'openai',
    });
    expect(result.violations).toContain('verify_pass_without_exec_zero');
    expect(result.scores.verdict).toBe('FAIL');
    expect(result.scores.D2?.score).toBe(0);
  });

  it('Rule 2: D2 override force-corrected to ground truth', () => {
    const result = checkAntiDeception({
      judgeScore: judgeScore({
        scores: {
          D2: { score: 3, source: 'verifier-llm' },
          D4: { score: 5, source: 'reducer-auto' },
          verdict: 'PASS',
        },
      }),
      qaResult: { exec_exit_code: 0 },
      autoScores: { D3_auto: 4, D4: 5, D5_auto: 4 },
      builderProvider: 'openai',
    });
    expect(result.violations).toContain('verifier_overrode_d2_ground_truth');
    expect(result.scores.D2?.score).toBe(5);
  });

  it('Rule 3: D4 override force-corrected to reducer auto', () => {
    const result = checkAntiDeception({
      judgeScore: judgeScore({
        scores: {
          D4: { score: 5, source: 'verifier-llm' },
          verdict: 'PASS',
        },
      }),
      qaResult: { exec_exit_code: 0 },
      autoScores: { D3_auto: 4, D4: 2, D5_auto: 4 },
      builderProvider: 'openai',
    });
    expect(result.violations).toContain('verifier_overrode_d4_ground_truth');
    expect(result.scores.D4?.score).toBe(2);
  });

  it('Rule 4: same-provider verifier raises self_bias_risk warn', () => {
    const result = checkAntiDeception({
      judgeScore: judgeScore({ metadata: { provider: 'openai' } }),
      qaResult: { exec_exit_code: 0 },
      autoScores: { D3_auto: 4, D4: 5, D5_auto: 4 },
      builderProvider: 'openai',
    });
    expect(result.violations).toContain('self_bias_risk_same_provider');
  });

  it('Rule 5: D3 inflation flagged when score - auto > 1.5', () => {
    const result = checkAntiDeception({
      judgeScore: judgeScore({
        scores: {
          D3: { score: 5, source: 'hybrid', auto: 3, semantic: 5 },
          verdict: 'PASS',
        },
      }),
      qaResult: { exec_exit_code: 0 },
      autoScores: { D3_auto: 3, D4: 5, D5_auto: 4 },
      builderProvider: 'openai',
    });
    expect(result.violations).toContain('verifier_inflated_hybrid');
  });

  it('No violations on clean cross-provider PASS', () => {
    const result = checkAntiDeception({
      judgeScore: judgeScore({}),
      qaResult: { exec_exit_code: 0 },
      autoScores: { D3_auto: 4, D4: 5, D5_auto: 4 },
      builderProvider: 'openai',
    });
    expect(result.violations).toEqual([]);
    expect(result.scores.verdict).toBe('PASS');
  });
});
