/**
 * Score-source attribution badge — AGENTS.md invariant 4 surface.
 *
 * Every Scorecard / radar / drilldown row that surfaces a D1-D6 score
 * MUST cite which layer produced it: `verifier-llm` (LLM judgment),
 * `qa-check-effect` (deterministic dispatcher ground truth, D2/D6),
 * or `reducer-auto` (D4 + auto components of D3/D5).
 *
 * Per migration plan §8.1 quality bar "Anti-deception alignment" + §17.4
 * LLM hygiene rule #1 — never silently render a score without source.
 */

import { SCORE_SOURCE_LABELS, type ScoreSource } from '../../server/types';

interface Props {
  source: ScoreSource | null;
  size?: 'sm' | 'md';
}

const TONE: Record<ScoreSource, string> = {
  'verifier-llm': 'var(--src-llm)',
  'qa-check-effect': 'var(--src-qa)',
  'reducer-auto': 'var(--src-auto)',
};

const TITLE: Record<ScoreSource, string> = {
  'verifier-llm': 'verifier LLM judgment (CourtEval)',
  'qa-check-effect': 'qa_check deterministic effect (no LLM)',
  'reducer-auto': 'reducer auto-derived',
};

export function SourceBadge({ source, size = 'sm' }: Props) {
  if (!source) {
    return (
      <span
        title="awaiting"
        style={{
          fontSize: size === 'sm' ? 9 : 10,
          fontFamily: 'var(--font-mono)',
          color: 'var(--ink-tertiary)',
          padding: size === 'sm' ? '1px 4px' : '2px 6px',
          border: '1px solid var(--hairline)',
          borderRadius: 'var(--r-pill)',
          letterSpacing: '0.4px',
        }}
      >
        —
      </span>
    );
  }
  const tone = TONE[source];
  return (
    <span
      title={TITLE[source]}
      style={{
        fontSize: size === 'sm' ? 9 : 10,
        fontFamily: 'var(--font-mono)',
        color: tone,
        padding: size === 'sm' ? '1px 4px' : '2px 6px',
        border: `1px solid ${tone}`,
        borderRadius: 'var(--r-pill)',
        letterSpacing: '0.4px',
        textTransform: 'uppercase',
        background: `color-mix(in oklab, ${tone} 12%, transparent)`,
      }}
    >
      {SCORE_SOURCE_LABELS[source]}
    </span>
  );
}
