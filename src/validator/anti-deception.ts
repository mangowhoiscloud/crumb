/**
 * Anti-deception validator — 5 rules enforcing scoring ground-truth integrity.
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
 * Rule 5 (v3.3) — researcher_video_evidence_missing — fires when the
 * researcher actor produced video evidence (≥1 kind=step.research.video event
 * exists for this session) but the verifier's D5 quality score is high (≥ 4)
 * with an empty evidence array. Same firewall pattern as Rule 1
 * (verify_pass_without_exec_zero) for D2 — high score requires citing the
 * deterministic ground truth.
 *
 * See [[bagelcode-system-architecture-v3]] §7.3 + [[bagelcode-llm-judge-frontier-2026]] R3-R5
 *  + agents/specialists/game-design.md §3 (video evidence schema) + §4 (synth schema).
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
  /**
   * v3.3 — IDs of `kind=step.research.video` events that the researcher actor
   * emitted earlier in this session. When non-empty, Rule 5 enforces that
   * D5.evidence cites at least one of these IDs (otherwise the verifier is
   * claiming high quality without citing the deterministic ground truth).
   */
  researchVideoEvidenceIds?: string[];
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

  // ── Rule 5 (v3.3) — researcher_video_evidence_missing ──────────────────────
  // If the researcher emitted ≥1 step.research.video events but the verifier's
  // D5 (intervention/quality) is ≥ 4 with no D5.evidence citing those events,
  // force D5=0 + violation. Mirrors Rule 1's pattern for D2: high score
  // requires citing the deterministic ground truth.
  const evidenceIds = input.researchVideoEvidenceIds ?? [];
  if (evidenceIds.length > 0 && scores.D5 && scores.D5.score >= 4) {
    const cited = scores.D5.evidence ?? [];
    const validCitation = cited.some((id) => evidenceIds.includes(id));
    if (!validCitation) {
      violations.push('researcher_video_evidence_missing');
      scores.D5 = forceScore(scores.D5, 0, scores.D5.source);
    }
  }

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
