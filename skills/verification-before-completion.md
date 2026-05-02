---
name: verification-before-completion
description: |
  Evidence-over-claims gate for Crumb's verifier. Ported from obra/superpowers (176k⭐) skills/verification-before-completion.
  Read inline by `agents/verifier.md` before emitting kind=judge.score.
when_to_use: verifier spawn 안에서 grader/critic/defender/regrader 진입 전 + judge.score emit 직전 final check
source: https://github.com/obra/superpowers (verification-before-completion skill family)
adapted_for: Crumb v0.1 verifier (CourtEval + 3-layer scoring + anti-deception)
---

# Verification Before Completion (Crumb adaptation)

## The Gate

> **"Don't claim PASS without evidence. The implementer's self-assessment is suspect by default."**

superpowers verbatim: "**distrust the implementer's self-assessment**" (code-reviewer.md). For Crumb, the implementer is structurally a different provider per `bagelcode-cross-3way` preset — your independence is the design.

## 5-check gate before kind=judge.score verdict=PASS

Before final Re-grader step emits `kind=judge.score` with verdict PASS, verify ALL five:

| # | Check | Source | Failure mode |
|---|---|---|---|
| 1 | `kind=qa.result` event exists in transcript | dispatcher emit | If absent → cannot verify D2/D6 → MUST verdict=FAIL |
| 2 | `qa.result.exec_exit_code === 0` | qa-check effect (htmlhint + playwright) | exit_code≠0 → D2=0 → aggregate likely <24 → verdict downgrades |
| 3 | spec.md AC count ≥ 3 (validator anti-deception rule) | spec event | empty AC → D1=0 force → handoff.rollback to planner-lead |
| 4 | All 4 CourtEval msg refs populated (grader_msg_id / critic_msg_id / defender_msg_id / regrader_msg_id) | this spawn's own emits | missing any → audit_violations += "courteval_incomplete" |
| 5 | metadata.cross_provider compared and set | verifier_provider !== builder_provider | same provider → audit_violations += "self_bias_risk_same_provider" (warn-only, don't block) |

## Ground-truth lookups (NOT computed by verifier)

Per [[bagelcode-system-architecture-v0.1]] §7.2 source-of-truth matrix:

| Dim | Lookup | Forbidden recompute |
|---|---|---|
| D2 exec | `qa.result.exec_exit_code === 0 ? 5 : 0` | ❌ Verifier cannot re-run code |
| D4 convergence | reducer auto from `progress_ledger.score_history` + spec_update count | ❌ Verifier cannot count events |
| D6 portability | `qa.result.crossBrowserSmoke` (if present, else N/A) | ❌ Verifier cannot run browsers |

LLM judgment dimensions (where verifier IS the source):
- D1 spec_fit (read AC list, evaluate game.html against each)
- D3.semantic (information value of message bodies)
- D5.quality (whether user.intervene actually shaped next spec/build)

Hybrid (auto + LLM):
- D3 = blend(reducer auto kind-diversity score, semantic information value)
- D5 = blend(reducer auto reflection score, quality of reflection)

## Anti-deception self-check (validator runs after, but verifier should pre-check)

If verifier is about to emit:
- D2 ≠ qa.result lookup → STOP. Force-correct before emit.
- D4 ≠ reducer auto → STOP. Force-correct.
- D3 score - D3.auto > 1.5 → reduce semantic component or add evidence in scores.D3.evidence
- D5 score - D5.auto > 1.5 → reduce quality component or add evidence

Validator will catch and audit if verifier doesn't self-check. Easier to self-correct.

## Adaptive stopping (NeurIPS 2025)

If `progress_ledger.score_history` shows variance < 1.0 over the last 2 verify rounds:
- Coordinator routes to `kind=done` regardless of your current verdict
- Don't fight it — system has converged
- Emit your judge.score normally; coordinator's adaptive_stop wins

## See also

- [[bagelcode-system-architecture-v0.1]] §7 + §3.6 (judge.score schema)
- [[bagelcode-llm-judge-frontier-2026]] — academic backbone (CourtEval / G-Eval / bias)
- `agents/verifier.md` — uses this skill inline
- `skills/code-review-protocol.md` — reviewer persona handoff
- `skills/tdd-iron-law.md` — sister skill for builder
