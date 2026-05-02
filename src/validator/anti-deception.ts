/**
 * Anti-deception validator — 4 rules enforcing scoring ground-truth integrity.
 *
 * Frontier backbone:
 *   - NeurIPS 2024 self-bias linear correlation (cross-provider mitigation)
 *   - IJCNLP 2025 position bias (judge-model-choice has highest impact)
 *   - Karpathy P4 anti-deception ratchet (no fake green)
 *
 * Runs after a kind=judge.score event. Mutates the score in-place if a non-LLM
 * dimension was overridden by verifier; appends violation strings for audit.
 *
 * The previous Rule 5 (verifier_inflated_hybrid) was removed when D3/D5 were
 * split into single-origin dims. The verifier emits its LLM component, the
 * reducer's auto component is computed independently, and combineDimScore() in
 * src/state/scorer.ts merges the two in code — no merged number for an LLM to
 * inflate.
 *
 * See [[bagelcode-system-architecture-v3]] §7.3 + [[bagelcode-llm-judge-frontier-2026]] R3-R5.
 */

import type { Message, Scores, ScoreDimension } from '../protocol/types.js';
import { combineAggregate, type AutoScores } from '../state/scorer.js';

export interface QaResultLike {
  exec_exit_code: number;
  cross_browser_smoke?: 'ok' | 'fail' | 'skipped';
}

export interface AntiDeceptionInput {
  judgeScore: Message; // kind=judge.score event being validated
  qaResult: QaResultLike | null; // latest kind=qa.result event's data field (null if missing)
  autoScores: AutoScores; // Layer 1 reducer auto
  builderProvider?: string | null; // metadata.provider on the build event
}

export interface AntiDeceptionOutput {
  /** Mutated/sanitized scores (D2/D4 force-corrected if overrides detected). */
  scores: Scores;
  /** Violation tags appended to scores.audit_violations. */
  violations: string[];
}

/**
 * Run anti-deception checks. Returns sanitized scores + violation list.
 * The caller is responsible for re-emitting the corrected judge.score event
 * (or appending a kind=audit event with the violations).
 */
export function checkAntiDeception(input: AntiDeceptionInput): AntiDeceptionOutput {
  const scores: Scores = { ...(input.judgeScore.scores ?? {}) };
  const violations: string[] = [...(scores.audit_violations ?? [])];

  // ── Rule 1 — verify_pass_without_exec_zero ──────────────────────────────────
  if (scores.verdict === 'PASS' && (!input.qaResult || input.qaResult.exec_exit_code !== 0)) {
    violations.push('verify_pass_without_exec_zero');
    if (scores.D2) scores.D2 = forceScore(scores.D2, 0, 'qa-check-effect');
    // Downgrade verdict if math no longer reaches PASS.
    scores.verdict = 'FAIL';
  }

  // ── Rule 2 — verifier_overrode_d2_ground_truth ──────────────────────────────
  if (input.qaResult) {
    const expectedD2 = input.qaResult.exec_exit_code === 0 ? 5 : 0;
    if (scores.D2 && scores.D2.score !== expectedD2) {
      violations.push('verifier_overrode_d2_ground_truth');
      scores.D2 = forceScore(scores.D2, expectedD2, 'qa-check-effect');
    }
  }

  // ── Rule 3 — verifier_overrode_d4_ground_truth ──────────────────────────────
  if (scores.D4 && Math.abs(scores.D4.score - input.autoScores.D4) > 0.01) {
    violations.push('verifier_overrode_d4_ground_truth');
    scores.D4 = forceScore(scores.D4, input.autoScores.D4, 'reducer-auto');
  }

  // ── Rule 4 — self_bias_risk_same_provider ──────────────────────────────────
  // Warn-only (does not force-correct).
  const verifierProvider = input.judgeScore.metadata?.provider;
  if (verifierProvider && input.builderProvider && verifierProvider === input.builderProvider) {
    violations.push('self_bias_risk_same_provider');
  }

  // (Rule 5 removed when D3/D5 split — see file header comment.)

  // Recompute aggregate after force-corrections using the deterministic combine
  // rule for D3/D5 (avg of verifier-llm component + reducer-auto component).
  scores.aggregate = combineAggregate(scores, input.autoScores);
  if (scores.verdict === 'PASS' && (scores.aggregate ?? 0) < 24) scores.verdict = 'PARTIAL';

  scores.audit_violations = violations;
  return { scores, violations };
}

function forceScore(
  prev: ScoreDimension,
  newScore: number,
  source: ScoreDimension['source'],
): ScoreDimension {
  return { ...prev, score: newScore, source, lookup: prev.lookup ?? (null as never) };
}
