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
    D3: { score: 4, source: 'verifier-llm', semantic: 4 },
    D4: { score: 5, source: 'reducer-auto', lookup: 'scoreHistory' },
    D5: { score: 4, source: 'verifier-llm', quality: 4 },
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

  it('Rule 4: same-provider verifier records self_bias_risk + downgrades PASS → PARTIAL (G-A)', () => {
    const result = checkAntiDeception({
      judgeScore: judgeScore({ metadata: { provider: 'openai' } }),
      qaResult: { exec_exit_code: 0 },
      autoScores: { D3_auto: 4, D4: 5, D5_auto: 4 },
      builderProvider: 'openai',
    });
    expect(result.violations).toContain('self_bias_risk_same_provider');
    expect(result.scores.verdict).toBe('PARTIAL');
  });

  it('Rule 4: cross-provider PASS unchanged (verifier ≠ builder provider)', () => {
    const result = checkAntiDeception({
      judgeScore: judgeScore({ metadata: { provider: 'google' } }),
      qaResult: { exec_exit_code: 0 },
      autoScores: { D3_auto: 4, D4: 5, D5_auto: 4 },
      builderProvider: 'openai',
    });
    expect(result.violations).not.toContain('self_bias_risk_same_provider');
    expect(result.scores.verdict).toBe('PASS');
  });

  it('Rule 4: same-provider FAIL stays FAIL (downgrade only applies to PASS)', () => {
    const result = checkAntiDeception({
      judgeScore: judgeScore({
        metadata: { provider: 'openai' },
        scores: {
          D1: { score: 1, source: 'verifier-llm' },
          D2: { score: 5, source: 'qa-check-effect' },
          D3: { score: 1, source: 'verifier-llm', semantic: 1 },
          D4: { score: 5, source: 'reducer-auto' },
          D5: { score: 1, source: 'verifier-llm', quality: 1 },
          D6: { score: 5, source: 'qa-check-effect' },
          verdict: 'FAIL',
        },
      }),
      qaResult: { exec_exit_code: 0 },
      autoScores: { D3_auto: 1, D4: 5, D5_auto: 1 },
      builderProvider: 'openai',
    });
    expect(result.violations).toContain('self_bias_risk_same_provider');
    expect(result.scores.verdict).toBe('FAIL');
  });

  it('Rule 4: same-provider PARTIAL stays PARTIAL (idempotent with floor downgrade)', () => {
    const result = checkAntiDeception({
      judgeScore: judgeScore({
        metadata: { provider: 'openai' },
        scores: {
          D1: { score: 3, source: 'verifier-llm' },
          D2: { score: 4, source: 'qa-check-effect' },
          D3: { score: 3, source: 'verifier-llm', semantic: 3 },
          D4: { score: 4, source: 'reducer-auto' },
          D5: { score: 3, source: 'verifier-llm', quality: 3 },
          D6: { score: 4, source: 'qa-check-effect' },
          verdict: 'PARTIAL',
        },
      }),
      qaResult: { exec_exit_code: 0 },
      autoScores: { D3_auto: 3, D4: 4, D5_auto: 3 },
      builderProvider: 'openai',
    });
    expect(result.scores.verdict).toBe('PARTIAL');
  });

  it('D3/D5 split: aggregate uses combined (verifier llm + reducer auto) avg', () => {
    // Verifier emits D3=5 (its LLM component); reducer auto says D3_auto=3.
    // combineDimScore averages → 4. D5 same: verifier 4 + auto 2 → 3.
    // Aggregate = D1(5) + D2(5) + D3(4) + D4(5) + D5(3) + D6(5) = 27
    const result = checkAntiDeception({
      judgeScore: judgeScore({
        scores: {
          D1: { score: 5, source: 'verifier-llm' },
          D2: { score: 5, source: 'qa-check-effect' },
          D3: { score: 5, source: 'verifier-llm', semantic: 5 },
          D4: { score: 5, source: 'reducer-auto' },
          D5: { score: 4, source: 'verifier-llm', quality: 4 },
          D6: { score: 5, source: 'qa-check-effect' },
          verdict: 'PASS',
        },
      }),
      qaResult: { exec_exit_code: 0 },
      autoScores: { D3_auto: 3, D4: 5, D5_auto: 2 },
      builderProvider: 'openai',
    });
    expect(result.scores.aggregate).toBe(27);
    // Verifier inflating its LLM-only D3 from a sane 4 to 5 no longer creates a
    // "hybrid inflation" violation — the reducer's auto component (3) is mixed
    // in by combineDimScore, so the aggregate naturally pulls back toward truth.
    expect(result.violations).not.toContain('verifier_inflated_hybrid');
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

  // ── Rule 5 (v3.3) — researcher_video_evidence_missing ──────────────────────

  it('Rule 5: D5 ≥ 4 with video evidence available but no D5.evidence cited → force D5=0', () => {
    const result = checkAntiDeception({
      judgeScore: judgeScore({
        scores: {
          D1: { score: 5, source: 'verifier-llm' },
          D2: { score: 5, source: 'qa-check-effect' },
          D3: { score: 4, source: 'verifier-llm', semantic: 4 },
          D4: { score: 5, source: 'reducer-auto' },
          D5: { score: 5, source: 'verifier-llm', quality: 5 }, // claimed high
          D6: { score: 5, source: 'qa-check-effect' },
          verdict: 'PASS',
          // evidence intentionally absent — verifier did NOT cite the video evidence
        },
      }),
      qaResult: { exec_exit_code: 0 },
      autoScores: { D3_auto: 4, D4: 5, D5_auto: 4 },
      builderProvider: 'openai',
      researchVideoEvidenceIds: ['01H0000000000000000000VID1', '01H0000000000000000000VID2'],
    });
    expect(result.violations).toContain('researcher_video_evidence_missing');
    expect(result.scores.D5?.score).toBe(0);
  });

  it('Rule 5: D5 ≥ 4 with valid evidence_refs citing a video event → no violation', () => {
    const result = checkAntiDeception({
      judgeScore: judgeScore({
        scores: {
          D1: { score: 5, source: 'verifier-llm' },
          D2: { score: 5, source: 'qa-check-effect' },
          D3: { score: 4, source: 'verifier-llm', semantic: 4 },
          D4: { score: 5, source: 'reducer-auto' },
          D5: {
            score: 4,
            source: 'verifier-llm',
            quality: 4,
            evidence: ['01H0000000000000000000VID1'],
          },
          D6: { score: 5, source: 'qa-check-effect' },
          verdict: 'PASS',
        },
      }),
      qaResult: { exec_exit_code: 0 },
      autoScores: { D3_auto: 4, D4: 5, D5_auto: 4 },
      builderProvider: 'openai',
      researchVideoEvidenceIds: ['01H0000000000000000000VID1', '01H0000000000000000000VID2'],
    });
    expect(result.violations).not.toContain('researcher_video_evidence_missing');
    expect(result.scores.D5?.score).toBe(4);
  });

  it('Rule 5: D5 < 4 even with empty evidence_refs → no violation (low score is honest)', () => {
    const result = checkAntiDeception({
      judgeScore: judgeScore({
        scores: {
          D1: { score: 5, source: 'verifier-llm' },
          D2: { score: 5, source: 'qa-check-effect' },
          D3: { score: 4, source: 'verifier-llm', semantic: 4 },
          D4: { score: 5, source: 'reducer-auto' },
          D5: { score: 2, source: 'verifier-llm', quality: 2 },
          D6: { score: 5, source: 'qa-check-effect' },
          verdict: 'PARTIAL',
        },
      }),
      qaResult: { exec_exit_code: 0 },
      autoScores: { D3_auto: 4, D4: 5, D5_auto: 4 },
      builderProvider: 'openai',
      researchVideoEvidenceIds: ['01H0000000000000000000VID1'],
    });
    expect(result.violations).not.toContain('researcher_video_evidence_missing');
    expect(result.scores.D5?.score).toBe(2);
  });

  it('Rule 5: text-only research path (empty researchVideoEvidenceIds) → no violation regardless of D5', () => {
    const result = checkAntiDeception({
      judgeScore: judgeScore({}),
      qaResult: { exec_exit_code: 0 },
      autoScores: { D3_auto: 4, D4: 5, D5_auto: 4 },
      builderProvider: 'openai',
      researchVideoEvidenceIds: [],
    });
    expect(result.violations).not.toContain('researcher_video_evidence_missing');
    expect(result.scores.D5?.score).toBe(4);
  });

  it('Rule 5: D5.evidence cites a non-video event id → still a violation', () => {
    const result = checkAntiDeception({
      judgeScore: judgeScore({
        scores: {
          D1: { score: 5, source: 'verifier-llm' },
          D2: { score: 5, source: 'qa-check-effect' },
          D3: { score: 4, source: 'verifier-llm', semantic: 4 },
          D4: { score: 5, source: 'reducer-auto' },
          D5: {
            score: 5,
            source: 'verifier-llm',
            quality: 5,
            evidence: ['01H0000000000000000000FAKE'], // not in researchVideoEvidenceIds
          },
          D6: { score: 5, source: 'qa-check-effect' },
          verdict: 'PASS',
        },
      }),
      qaResult: { exec_exit_code: 0 },
      autoScores: { D3_auto: 4, D4: 5, D5_auto: 4 },
      builderProvider: 'openai',
      researchVideoEvidenceIds: ['01H0000000000000000000VID1'],
    });
    expect(result.violations).toContain('researcher_video_evidence_missing');
    expect(result.scores.D5?.score).toBe(0);
  });

  // ── Rule 6 — composite_gaming_d1_d5_below_minimum (G-D) ─────────────────────

  it('Rule 6: D1 < 3 demotes PASS → PARTIAL even when aggregate ≥ 24', () => {
    // Builder games D2/D6 (max from qa-check) to overshadow D1 weakness.
    // Aggregate = 2+5+5+5+5+5 = 27 ≥ 24, but D1=2 fails the LLM-judge floor.
    const result = checkAntiDeception({
      judgeScore: judgeScore({
        metadata: { provider: 'google' },
        scores: {
          D1: { score: 2, source: 'verifier-llm' },
          D2: { score: 5, source: 'qa-check-effect' },
          D3: { score: 5, source: 'verifier-llm', semantic: 5 },
          D4: { score: 5, source: 'reducer-auto' },
          D5: { score: 5, source: 'verifier-llm', quality: 5 },
          D6: { score: 5, source: 'qa-check-effect' },
          verdict: 'PASS',
        },
      }),
      qaResult: { exec_exit_code: 0 },
      autoScores: { D3_auto: 5, D4: 5, D5_auto: 5 },
      builderProvider: 'openai',
    });
    expect(result.violations).toContain('composite_gaming_d1_d5_below_minimum');
    expect(result.scores.verdict).toBe('PARTIAL');
  });

  it('Rule 6: D5 < 3 demotes PASS → PARTIAL', () => {
    const result = checkAntiDeception({
      judgeScore: judgeScore({
        metadata: { provider: 'google' },
        scores: {
          D1: { score: 5, source: 'verifier-llm' },
          D2: { score: 5, source: 'qa-check-effect' },
          D3: { score: 5, source: 'verifier-llm', semantic: 5 },
          D4: { score: 5, source: 'reducer-auto' },
          D5: { score: 2, source: 'verifier-llm', quality: 2 },
          D6: { score: 5, source: 'qa-check-effect' },
          verdict: 'PASS',
        },
      }),
      qaResult: { exec_exit_code: 0 },
      autoScores: { D3_auto: 5, D4: 5, D5_auto: 2 },
      builderProvider: 'openai',
    });
    expect(result.violations).toContain('composite_gaming_d1_d5_below_minimum');
    expect(result.scores.verdict).toBe('PARTIAL');
  });

  it('Rule 6: D1 = 3 AND D5 = 3 (at the floor) stays PASS', () => {
    const result = checkAntiDeception({
      judgeScore: judgeScore({
        metadata: { provider: 'google' },
        scores: {
          D1: { score: 3, source: 'verifier-llm' },
          D2: { score: 5, source: 'qa-check-effect' },
          D3: { score: 4, source: 'verifier-llm', semantic: 4 },
          D4: { score: 5, source: 'reducer-auto' },
          D5: { score: 3, source: 'verifier-llm', quality: 3 },
          D6: { score: 5, source: 'qa-check-effect' },
          verdict: 'PASS',
        },
      }),
      qaResult: { exec_exit_code: 0 },
      autoScores: { D3_auto: 4, D4: 5, D5_auto: 3 },
      builderProvider: 'openai',
    });
    expect(result.violations).not.toContain('composite_gaming_d1_d5_below_minimum');
    expect(result.scores.verdict).toBe('PASS');
  });

  it('Rule 6: FAIL stays FAIL even when D1/D5 fall below floor (idempotent)', () => {
    const result = checkAntiDeception({
      judgeScore: judgeScore({
        metadata: { provider: 'google' },
        scores: {
          D1: { score: 1, source: 'verifier-llm' },
          D2: { score: 5, source: 'qa-check-effect' },
          D3: { score: 1, source: 'verifier-llm', semantic: 1 },
          D4: { score: 5, source: 'reducer-auto' },
          D5: { score: 1, source: 'verifier-llm', quality: 1 },
          D6: { score: 5, source: 'qa-check-effect' },
          verdict: 'FAIL',
        },
      }),
      qaResult: { exec_exit_code: 0 },
      autoScores: { D3_auto: 1, D4: 5, D5_auto: 1 },
      builderProvider: 'openai',
    });
    // Rule 6 only fires on PASS (the gaming case). FAIL stays FAIL.
    expect(result.violations).not.toContain('composite_gaming_d1_d5_below_minimum');
    expect(result.scores.verdict).toBe('FAIL');
  });

  it('Rule 6: composes with Rule 4 — same-provider PASS with D1<3 stays PARTIAL via either rule', () => {
    const result = checkAntiDeception({
      judgeScore: judgeScore({
        metadata: { provider: 'openai' }, // same as builder → Rule 4 fires
        scores: {
          D1: { score: 2, source: 'verifier-llm' }, // D1<3 → Rule 6 fires too
          D2: { score: 5, source: 'qa-check-effect' },
          D3: { score: 5, source: 'verifier-llm', semantic: 5 },
          D4: { score: 5, source: 'reducer-auto' },
          D5: { score: 5, source: 'verifier-llm', quality: 5 },
          D6: { score: 5, source: 'qa-check-effect' },
          verdict: 'PASS',
        },
      }),
      qaResult: { exec_exit_code: 0 },
      autoScores: { D3_auto: 5, D4: 5, D5_auto: 5 },
      builderProvider: 'openai',
    });
    expect(result.violations).toContain('self_bias_risk_same_provider');
    expect(result.violations).toContain('composite_gaming_d1_d5_below_minimum');
    expect(result.scores.verdict).toBe('PARTIAL');
  });
});
