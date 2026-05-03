/**
 * Scorecard derivation — pure functions over judge.score / verify.result events.
 *
 * Per migration plan §17.3 #2 + AGENTS.md invariant 4: the dimension keys
 * (D1-D6), human labels, and source-attribution badges live in
 * `packages/studio/src/server/types.ts` — Studio-local mirror of
 * `src/protocol/types.ts` per §17.2 decoupling. Panels MUST import here
 * and never re-declare; lint catches drift.
 *
 * v1 reference: `packages/studio/src/client/studio.js` lines 988-1167
 * (renderScorecard / sumDims / deriveSanitizeNote / renderRadar). Behavior
 * is preserved verbatim; rendering is moved to React in panels/Scorecard.tsx.
 */

import {
  DIMENSIONS,
  DIMENSION_LABELS,
  type Dimension,
  type ScoreSource,
  type Verdict,
} from '../../server/types';
import type { TranscriptEvent } from '../hooks/useTranscriptStream';

export interface DimRecord {
  key: Dimension;
  name: string;
  score: number | null;
  source: ScoreSource | null;
  sanitized: { note: string } | null;
}

export interface JudgeSnapshot {
  event: TranscriptEvent;
  scores: Record<string, unknown>;
  aggregate: number | null;
  verdict: Verdict | null;
  records: DimRecord[];
  violations: string[];
}

interface RawDim {
  score?: number;
  source?: ScoreSource;
}

/** Filter rolling window for judge.score / verify.result, oldest-first. */
export function extractJudgeEvents(events: TranscriptEvent[]): TranscriptEvent[] {
  return events.filter((e) => e.kind === 'judge.score' || e.kind === 'verify.result');
}

/**
 * Per-rule sanitize note (v1 deriveSanitizeNote port).
 * Returns null when no anti-deception rule altered this dim.
 */
export function deriveSanitizeNote(dim: Dimension, violations: string[]): { note: string } | null {
  if (violations.length === 0) return null;
  if (dim === 'D2') {
    if (violations.includes('verify_pass_without_exec_zero')) return { note: 'forced 0 (Rule 1)' };
    if (violations.includes('verifier_overrode_d2_ground_truth'))
      return { note: 'forced to qa (Rule 2)' };
  }
  if (dim === 'D4' && violations.includes('verifier_overrode_d4_ground_truth')) {
    return { note: 'forced to auto (Rule 3)' };
  }
  if (
    (dim === 'D1' || dim === 'D3' || dim === 'D5') &&
    violations.includes('self_bias_score_discounted')
  ) {
    return { note: '−15% self-bias' };
  }
  if (dim === 'D5' && violations.includes('researcher_video_evidence_missing')) {
    return { note: 'forced 0 (Rule 5)' };
  }
  if (dim === 'D1' && violations.includes('verify_pass_with_ac_failure')) {
    return { note: 'cap 2 (Rule 7)' };
  }
  return null;
}

/** Build per-dim records (score + source + sanitize note) from a judge event. */
export function buildJudgeSnapshot(event: TranscriptEvent): JudgeSnapshot {
  const scores = (event.scores ?? {}) as Record<string, unknown>;
  const dataRaw = (event.data ?? {}) as Record<string, unknown>;
  const violations = ((scores.audit_violations as string[] | undefined) ??
    (dataRaw.audit_violations as string[] | undefined) ??
    []) as string[];
  const records: DimRecord[] = DIMENSIONS.map((d) => {
    const dim = scores[d] as RawDim | undefined;
    const score = typeof dim?.score === 'number' ? dim.score : null;
    return {
      key: d,
      name: DIMENSION_LABELS[d],
      score,
      source: dim?.source ?? null,
      sanitized: deriveSanitizeNote(d, violations),
    };
  });
  const aggregate =
    typeof scores.aggregate === 'number'
      ? (scores.aggregate as number)
      : records.reduce((a, r) => a + (r.score ?? 0), 0);
  const verdict = (scores.verdict as Verdict | undefined) ?? null;
  return { event, scores, aggregate, verdict, records, violations };
}

/** Per-dim score series across all rounds (oldest → newest). For sparklines. */
export function dimSeries(events: TranscriptEvent[]): Record<Dimension, number[]> {
  const out = {} as Record<Dimension, number[]>;
  for (const d of DIMENSIONS) out[d] = [];
  for (const e of events) {
    const scores = (e.scores ?? {}) as Record<string, unknown>;
    for (const d of DIMENSIONS) {
      const dim = scores[d] as RawDim | undefined;
      if (typeof dim?.score === 'number') out[d].push(dim.score);
    }
  }
  return out;
}

/** Tone token name for a verdict (consumed via `var(--tone-${tone})`). */
export function verdictTone(v: Verdict | null): 'pass' | 'partial' | 'fail' | 'pending' {
  if (v === 'PASS') return 'pass';
  if (v === 'PARTIAL') return 'partial';
  if (v === 'FAIL' || v === 'REJECT') return 'fail';
  return 'pending';
}
