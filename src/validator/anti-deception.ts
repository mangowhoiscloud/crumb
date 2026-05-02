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
  /**
   * Layer 1 reducer auto. Optional so the live reducer (which doesn't carry the
   * full transcript) can run Rules 1, 2, 4, 5 without computing auto scores.
   * When undefined, Rule 3 (D4 ground-truth check, which compares the verifier's
   * D4 against autoScores.D4) is skipped and the aggregate is summed as-is
   * (D3/D5 contribute their LLM-only score). External callers like summary.ts
   * pass a populated AutoScores to enforce all rules + the deterministic combine.
   */
  autoScores?: AutoScores;
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
  if (input.autoScores && scores.D4 && Math.abs(scores.D4.score - input.autoScores.D4) > 0.01) {
    violations.push('verifier_overrode_d4_ground_truth');
    scores.D4 = forceScore(scores.D4, input.autoScores.D4, 'reducer-auto');
  }

  // ── Rule 4 — self_bias_risk_same_provider ──────────────────────────────────
  // Verdict-downgrade enforcement (G-A from
  // [[bagelcode-scoring-ratchet-frontier-2026-05-02]] §7 P1).
  //
  // Stureborg et al. EMNLP 2024 measured PASS-rate inflation of +14-22% when
  // builder and verifier share the same provider. Prior behavior was warn-only
  // (record violation, don't act). New behavior: demote PASS → PARTIAL so the
  // user must explicitly approve via `kind=user.approve` (G1 surface).
  // FAIL/REJECT/PARTIAL are unchanged — self-bias matters when the judge is
  // letting the builder's work through, not when it's already saying no.
  //
  // The verdict downgrade is applied below alongside the aggregate-floor
  // recomputation so the violation list and the verdict update atomically.
  const verifierProvider = input.judgeScore.metadata?.provider;
  const sameProvider = Boolean(
    verifierProvider && input.builderProvider && verifierProvider === input.builderProvider,
  );
  if (sameProvider) {
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

  // Recompute aggregate after force-corrections. With autoScores present, use
  // the deterministic combine (avg of verifier-llm + reducer-auto for D3/D5).
  // Without autoScores (live reducer path), sum D1-D6 as-is — D3/D5 contribute
  // only their LLM-emitted score; summary.ts re-runs with autoScores for the
  // canonical verdict math.
  scores.aggregate = input.autoScores
    ? combineAggregate(scores, input.autoScores)
    : sumDimsAsIs(scores);
  if (scores.verdict === 'PASS' && (scores.aggregate ?? 0) < 24) scores.verdict = 'PARTIAL';

  // G-A — Rule 4 verdict downgrade. Applied AFTER the aggregate-floor check so
  // a PASS that was already demoted to PARTIAL by the floor stays PARTIAL
  // (idempotent) and a PASS that survives the floor still gets demoted on
  // self-bias. Order matters: floor first, then bias.
  if (sameProvider && scores.verdict === 'PASS') {
    scores.verdict = 'PARTIAL';
  }

  // ── Rule 6 — composite_gaming_d1_d5_below_minimum ───────────────────────────
  // G-D from [[bagelcode-scoring-ratchet-frontier-2026-05-02]] §7 P1.
  //
  // The aggregate-floor check above is OR-gate: any combination summing to ≥24
  // passes. Without per-dimension floors, the builder can game cheap-to-saturate
  // deterministic dims (D2 exec / D6 portability — typically 5 each from
  // qa-check-effect ground truth) and overshadow weak LLM-judge dims (D1
  // spec_fit / D5 quality). Example: D1=2 + D2=5 + D3=5 + D4=5 + D5=2 + D6=5
  // sums to 24 = PASS, but the builder is failing on the two LLM-judge
  // dimensions that actually capture spec compliance and player UX.
  //
  // Frontier convergence on AND-gate per-dim floor (release/PASS gate, not
  // training-signal aggregation):
  //   - SWE-bench Verified 2024 — pass/fail is binary (test ground truth)
  //   - RewardBench v2 (Lambert 2025, AI2 §4.2) — explicit "per-category to
  //     prevent compensatory averaging masking safety regressions"
  //   - LiveCodeBench (Jain ICLR 2025) — per-difficulty + per-contest min
  //   - HELM Capabilities (Liang Stanford 2024) — "per-scenario worst-case"
  //     headline metric
  //   - OpenAI Preparedness Framework 2024-12 — AND-gate per-dim floor on
  //     capability eval
  //   - Anthropic RSP v2 2024-10 — every safety dim must clear threshold
  //
  // Threshold = 3/5 (60%): judge variance σ≈0.6 (Zheng et al. NeurIPS 2023
  // MT-Bench analysis) means a 4/5 floor produces too many false negatives;
  // 3/5 catches the gaming case (D1=2 / D5=2) without false-flagging
  // legitimate near-PASS work. Tightening to 4/5 is a P1 once judge variance
  // drops with extended-thinking adopters (Snell ICLR 2025).
  //
  // Order: applied LAST so prior downgrades (aggregate floor, Rule 4) compose;
  // FAIL / PARTIAL verdicts are idempotent under this rule.
  // Note: the violation fires when the floor is breached AND the verifier had
  // emitted a PASS (the gaming case). FAIL/PARTIAL verifiers are not gaming —
  // they're already saying no. We snapshot the *original* verdict so Rule 4's
  // PASS → PARTIAL downgrade above doesn't mask the gaming signal.
  const D1_MIN = 3;
  const D5_MIN = 3;
  const d1Below = (scores.D1?.score ?? 5) < D1_MIN;
  const d5Below = (scores.D5?.score ?? 5) < D5_MIN;
  const verifierIntendedPass = (input.judgeScore.scores?.verdict ?? null) === 'PASS';
  if (verifierIntendedPass && (d1Below || d5Below)) {
    violations.push('composite_gaming_d1_d5_below_minimum');
    if (scores.verdict === 'PASS') scores.verdict = 'PARTIAL';
  }

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

function sumDimsAsIs(scores: Scores): number {
  const dims = [scores.D1, scores.D2, scores.D3, scores.D4, scores.D5, scores.D6];
  return dims.reduce<number>((sum, d) => sum + (d?.score ?? 0), 0);
}
