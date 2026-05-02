/**
 * Anti-deception validator — 7 rules enforcing scoring ground-truth integrity.
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
 * Rule 5 (v0.3.0) — researcher_video_evidence_missing — fires when the
 * researcher actor produced video evidence (≥1 kind=step.research.video event
 * exists for this session) but the verifier's D5 quality score is high (≥ 4)
 * with an empty evidence array. Same firewall pattern as Rule 1
 * (verify_pass_without_exec_zero) for D2 — high score requires citing the
 * deterministic ground truth.
 *
 * See [[bagelcode-system-architecture-v0.1]] §7.3 + [[bagelcode-llm-judge-frontier-2026]] R3-R5
 *  + agents/specialists/game-design.md §3 (video evidence schema) + §4 (synth schema).
 */

import type { Message, Scores, ScoreDimension } from '../protocol/types.js';
import { combineAggregate, type AutoScores } from '../state/scorer.js';

/**
 * Same-provider self-bias numerical discount factor for Rule 4. Applied to
 * D1 (spec_fit), D3 (schema/observability LLM half), and D5 (quality) — the
 * LLM-judged qualitative dims where Stureborg EMNLP 2024 §4.2 measured
 * +14-22% PASS-rate inflation when the verifier shares the provider with
 * the builder. 0.15 is the conservative midpoint of that 14-22% range,
 * accounting for the prompt-mitigation 50% coverage from Anthropic Hybrid
 * Normalization 2026.
 *
 * D2 (qa-check exec) / D6 (qa-check portability) / D4 (reducer-auto budget)
 * are deterministic and immune. D3 / D5 are split LLM/auto via
 * combineDimScore in src/state/scorer.ts, which averages scores.D{3,5}.score
 * (the verifier's raw LLM-emitted value) with autoScores.D{3,5}_auto. So
 * discounting scores.D{3,5}.score before that combine is mathematically
 * equivalent to discounting only the LLM half — exactly the symmetric
 * treatment we want.
 *
 * See [[bagelcode-same-provider-discount-2026-05-03]] for the full rationale.
 */
const SAME_PROVIDER_DISCOUNT = 0.15;

export interface QaResultLike {
  exec_exit_code: number;
  cross_browser_smoke?: 'ok' | 'fail' | 'skipped';
  /**
   * v0.3.5 — per-AC predicate results from the deterministic AC layer (see
   * `src/effects/qa-interactive.ts` and `agents/specialists/game-design.md`
   * §AC-Predicate-Compile). Empty / undefined when the spec emitted no
   * predicates. Rule 7 reads `status === 'FAIL'` entries as ground truth
   * that contradicts a high D1 functional fit.
   */
  ac_results?: Array<{
    ac_id: string;
    status: 'PASS' | 'FAIL' | 'SKIP';
  }>;
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
   * v0.3.0 — IDs of `kind=step.research.video` events that the researcher actor
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

  // ── Rule 4 — self_bias_risk_same_provider + numerical D1/D5 discount ──────
  // [[bagelcode-same-provider-discount-2026-05-03]] (replaces the v0.3.0 binary
  // verdict downgrade). Stureborg EMNLP 2024 §4.2 measured +14-22% PASS-rate
  // inflation when builder and verifier share the provider. The previous
  // binary PASS → PARTIAL gate collapsed dynamic range and treated a
  // measured continuous bias as a discrete action.
  //
  // New behavior: discount D1 (spec_fit), D3 (schema), and D5 (quality) —
  // the LLM-judged qualitative dims where same-provider bias concentrates
  // per Rubric-Anchored Judging (NeurIPS 2025) — by SAME_PROVIDER_DISCOUNT
  // (0.15, Stureborg midpoint, conservative). D2/D6 (qa-check ground truth)
  // and D4 (reducer-auto) are immune. Aggregate is recomputed below;
  // standard verdict thresholds (≥24=PASS, 18-23=PARTIAL, <18=FAIL) re-fire
  // naturally — no special PASS demotion. Anthropic Hybrid Normalization
  // 2026: prompt mitigation reaches ~50% effect reduction; numerical
  // correction is the residual half.
  //
  // D3 / D5 are split LLM/auto via combineDimScore (src/state/scorer.ts),
  // which averages scores.D{3,5}.score (the verifier's raw LLM-emitted
  // value) with autoScores.D{3,5}_auto. Discounting scores.D{3,5}.score
  // here, before that combine runs, is mathematically equivalent to
  // discounting only the LLM half — the auto half stays untouched.
  const verifierProvider = input.judgeScore.metadata?.provider;
  const sameProvider = Boolean(
    verifierProvider && input.builderProvider && verifierProvider === input.builderProvider,
  );
  if (sameProvider) {
    violations.push('self_bias_risk_same_provider');
    if (scores.D1) {
      scores.D1 = forceScore(
        scores.D1,
        scores.D1.score * (1 - SAME_PROVIDER_DISCOUNT),
        scores.D1.source,
      );
    }
    if (scores.D3) {
      scores.D3 = forceScore(
        scores.D3,
        scores.D3.score * (1 - SAME_PROVIDER_DISCOUNT),
        scores.D3.source,
      );
    }
    if (scores.D5) {
      scores.D5 = forceScore(
        scores.D5,
        scores.D5.score * (1 - SAME_PROVIDER_DISCOUNT),
        scores.D5.source,
      );
    }
    if (scores.D1 || scores.D3 || scores.D5) {
      violations.push('self_bias_score_discounted');
    }
  }

  // ── Rule 5 (v0.3.0) — researcher_video_evidence_missing ──────────────────────
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

  // ── Rule 7 (v0.3.5) — verify_pass_with_ac_failure ─────────────────────────────
  // The deterministic AC layer (qa-interactive.ts) replays planner-compiled
  // predicates against the running game. When the verifier emits PASS but the
  // ground-truth AC results show ≥1 FAIL, the verifier is contradicting a
  // sandbox+predicate measurement — same firewall pattern as Rule 1 for D2's
  // exec_exit_code, applied to D1 (spec_fit / functional fit).
  //
  // Why cap D1 at 2 instead of forcing 0: D1 spans more than the deterministic
  // AC layer (subjective AC strings + spec_fit prose), so a hard 0 over-
  // penalizes mostly-passing builds. 2 is the soft cap matching Rule 6's D1_MIN
  // floor — combined with the aggregate recompute below it pushes the verdict
  // to PARTIAL automatically without claiming the artifact is worthless.
  //
  // Frontier backing: ArtifactsBench (arXiv:2507.04952) shows sandbox-derived
  // ground truth outranks LLM-only judgement at 94.4% human agreement;
  // VideoGameQA-Bench (arXiv:2505.15952) confirms VLM judges collapse on
  // state-observable assertions. Karpathy autoresearch immutable-harness rule:
  // a high LLM score that contradicts the deterministic harness is a false
  // positive, not a judgement call.
  const acResults = input.qaResult?.ac_results ?? [];
  const acFailed = acResults.some((r) => r.status === 'FAIL');
  if (scores.verdict === 'PASS' && acFailed) {
    violations.push('verify_pass_with_ac_failure');
    if (scores.D1 && scores.D1.score > 2) {
      scores.D1 = forceScore(scores.D1, 2, scores.D1.source);
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

  // Note: the v0.3.0 binary `if (sameProvider && verdict === 'PASS') verdict =
  // 'PARTIAL'` was removed in v0.3.1 — Rule 4's numerical D1/D5 discount above
  // already lowered the aggregate; the standard threshold check (line above)
  // now demotes to PARTIAL or FAIL naturally when warranted.

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
