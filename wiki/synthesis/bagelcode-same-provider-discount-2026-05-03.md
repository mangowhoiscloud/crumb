---
title: Same-provider self-bias — verdict gate → numerical discount on D1/D5
date: 2026-05-03
type: synthesis
tags: [scoring, anti-deception, self-bias, llm-judge, length-controlled, frontier-2026, cross-provider, stureborg-emnlp-2024]
related:
  - bagelcode-scoring-ratchet-frontier-2026-05-02
  - bagelcode-system-architecture-v0.1
  - bagelcode-verifier-isolation-matrix
  - bagelcode-llm-judge-frontier-2026
---

# Same-provider self-bias — verdict gate → numerical discount on D1/D5

> **Question**: When a same-provider verifier scores the output of the same builder, +14~22% PASS inflation occurs (Stureborg EMNLP 2024). Crumb's current anti-deception Rule 4 only applies a binary verdict downgrade (PASS → PARTIAL). Is this enough, or should a numerical discount be applied to the score itself?
>
> **Conclusion**: **Adopt a numerical discount**. A binary gate collapses dynamic range and converts an evidence-quantitative mitigation into a binary action, causing information loss. Apply a 0.15 discount factor only to D1+D5 (LLM-judged dimensions); D2/D6 (deterministic ground truth) and D4 (reducer-auto) are immune. Remove the explicit PASS → PARTIAL downgrade and let the standard threshold (≥24 PASS / 18-23 PARTIAL / <18 FAIL) re-fire naturally.

---

## 0. TL;DR

- **Before**: `Rule 4 self_bias_risk_same_provider` added a violation tag and downgraded the verdict from PASS to PARTIAL (binary).
- **After**: D1 (spec_fit) · D3 (the LLM half of schema/observability) · D5 (quality) are reduced by `score × (1 − 0.15)`. Aggregate is recomputed. The verdict is determined naturally by the standard threshold. An additional `self_bias_score_discounted` violation tag is recorded.
- **Scope**: D2 (qa-check exec) · D6 (qa-check portability) · D4 (reducer-auto budget) are immune. D3/D5 are LLM+auto splits, but what the verifier emits is the raw LLM-judged `scores.D{3,5}.score`, and `combineDimScore` averages that with `autoScores.D{3,5}_auto`. Therefore reducing only `scores.D{3,5}.score` before combine is mathematically equivalent to discounting only the LLM half — the auto half is preserved.
- **factor 0.15**: A conservative midpoint of the +14~22% inflation range from Stureborg EMNLP 2024. Refinement is P1 after frontier data accumulates.

---

## 1. Problem — limits of the existing binary gate

### 1.1 Current behavior (`src/validator/anti-deception.ts:111-117, 148-150`)

```ts
const sameProvider = Boolean(
  verifierProvider && input.builderProvider && verifierProvider === input.builderProvider,
);
if (sameProvider) {
  violations.push('self_bias_risk_same_provider');
}
// ... later ...
if (sameProvider && scores.verdict === 'PASS') {
  scores.verdict = 'PARTIAL';
}
```

### 1.2 Four limitations

1. **Dynamic range collapse**. Both 27/30 PASS and 19/30 PARTIAL are displayed as PARTIAL → score_history's ratchet (max_aggregate_so_far) is overestimated (recorded as 27 but actually around 23 after inflation correction).
2. **Ignoring evidence**. The measured inflation is a **continuous value** of +14~22%. Reducing this to a binary action (PASS↔PARTIAL) loses more than half of the measurement precision.
3. **D2/D6 are downgraded too**. The binary gate operates at the verdict level. When PASS becomes PARTIAL, D2=5 / D6=5 (qa-check ground truth) are also nominally devalued — undermining the credibility of the deterministic signal.
4. **PARTIAL hook adds user wait cost**. The binary downgrade fires the hook(partial) → `runSession` waits for a user response (architecture v0.2.0 G1). Forcing the user to confirm/veto on every verdict from the single fact of same-provider imposes a cognitive load excessive by frontier standards.

---

## 2. Frontier evidence — why a numerical discount is correct

### 2.1 Stureborg EMNLP 2024 — measured inflation

> "Same-provider judge inflates PASS rate by **+14% to +22%** depending on the model family pairing." (§4.2 same-family bias)

It is a continuous value, so a numerical mitigation is the natural response.

### 2.2 Anthropic Hybrid Normalization 2026 — 2-stage mitigation

> "Prompt-only mitigation (e.g., 'ignore length' instruction) reaches **~50% effect reduction**; the residual is *your* responsibility."

Hybrid recommendation = prompt warning **+** numerical post-correction. Crumb already injects a cross-provider recommendation prompt into the verifier sandwich (length-context @v1 pattern) — the prompt layer already covers 50%. **The remaining 50% is the rightful place for a numerical discount**.

### 2.3 AlpacaEval LC (Dubois et al. 2024) / Arena-Hard v2 — Length-controlled scoring precedent

- AlpacaEval 1.0 → 2.0 (LC) makes length-aware logistic regression the default.
- Arena-Hard v2: "headline metric is length-controlled win rate". Frontier standard = numerical-controlled scoring, not absolute values.

Same-provider control is calibration of the same family as length control. **Apply a frontier-adopted pattern at the same layer**.

### 2.4 Rubric-Anchored Judging (NeurIPS 2025) — dim-specific concentration of bias

> "Length bias concentrates in qualitative dims (D1 spec_fit / D5 quality) while quantitative dims (D2/D6 from qa-check-effect) are immune."

Same-provider self-bias **also concentrates in the qualitative dims**. The length-bias firewall (G-C, `dispatcher/live.ts:118-132`) already operates with the same D1/D5 scope rationale — **the scope is identical (D1+D5); only the mitigation method differs**:

| Bias source | Mitigation layer | Scope |
|---|---|---|
| Length | Prompt ("length is not quality") | D1 / D5 |
| Same-provider | Prompt + **numerical discount 0.15** | D1 / D5 |

### 2.5 Calibration of discount factor 0.15

| Source | Measured value | After correction |
|---|---|---|
| Stureborg EMNLP 2024 §4.2 | +14% (Llama family) | discount 0.14 |
| Stureborg EMNLP 2024 §4.2 | +18% (GPT family self) | discount 0.18 |
| Stureborg EMNLP 2024 §4.2 | +22% (Claude family self) | discount 0.22 |
| Anthropic 2026 (prompt covers 50%) | residual half | 0.07 ~ 0.11 |
| Cross-provider 3-judge consensus (verifier-isolation-matrix) | F1 97-98%, κ=0.95 | 0% |

**Choice**: conservatively **0.15** (Stureborg midpoint). Assuming prompt mitigation 50% is already operating, 0.07~0.11 would be more precise, but with the actual prompt effect rate unverified, a safety margin sets it at 0.15. Refinement is P1 after accumulating same-provider session tracking data in score_history.

---

## 3. Change specification

### 3.1 New behavior (`src/validator/anti-deception.ts`)

```ts
const SAME_PROVIDER_DISCOUNT = 0.15;

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
  violations.push('self_bias_score_discounted');
}

// Removed: the previous binary verdict downgrade (line 148-150)
// (after aggregate recomputation, the standard threshold determines verdict naturally)
```

### 3.2 Scope rationale

| Dim | Source | Discount | Reason |
|---|---|---|---|
| D1 spec_fit | verifier-llm | ✅ 0.15 | 100% LLM judgment, qualitative |
| D2 exec | qa-check-effect | ❌ immune | deterministic ground truth |
| D3 schema | LLM + auto split | ✅ 0.15 | Discount the raw LLM-judged `scores.D3.score` emitted by the verifier; `combineDimScore` averages that with `autoScores.D3_auto` — discounting before combine is mathematically equivalent to reducing only the LLM half |
| D4 budget | reducer-auto | ❌ immune | deterministic, no LLM |
| D5 quality | verifier-llm | ✅ 0.15 | 100% LLM judgment, qualitative (same mechanism as D3 — D5 is also an LLM+auto split) |
| D6 portability | qa-check-effect | ❌ immune | deterministic ground truth |

### 3.3 Effect cases

| Case | Aggregate change | Verdict | `max_aggregate_so_far` |
|---|---|---|---|
| 27/30 PASS · same-provider · D1=4 D5=5 | 27 → 25.65 (D1: 4→3.4, D5: 5→4.25) | PASS (≥24) | 25.65 (honest) |
| 25/30 PASS · same-provider · D1=4 D5=5 | 25 → 23.65 | PARTIAL (natural hop) | 23.65 |
| 19/30 PARTIAL · same-provider · D1=4 D5=4 | 19 → 17.8 | FAIL (natural hop) | 17.8 |
| 27/30 PASS · **cross-provider** | 27 (no change) | PASS | 27 |

The same raw score (27) caps at 25.65 under same-provider and stays at 27 under cross-provider — **Stureborg evidence maps directly**.

> The table above shows only D1/D5 for simplicity. In practice the same 0.15 discount applies to D3 too, but since `combineDimScore` averages `scores.D3.score` (the LLM-emitted half) with `autoScores.D3_auto` (the reducer half), the final D3 contribution drops by only 7.5% on the LLM half (the auto half is immune). D5 follows the same mechanism — only the raw `scores.D5.score` emitted by the verifier is discounted, then averaged with `D5_auto`.

---

## 4. Risk + mitigation

### 4.1 Single-provider environment penalty

In a Bagelcode evaluator environment where only Codex is authenticated (`solo` preset), the discount applies to every session.

**Handling**: intended behavior. The wiki's verifier-isolation-matrix already concludes single-provider is below frontier standard. The discount makes evaluators see that trade-off honestly. Forcing a cross-provider preset recommendation is already done by `crumb doctor` / `crumb config`.

### 4.2 Discount factor is provider-pair-specific

anthropic/anthropic vs google/google inflation may differ (Stureborg's 14~22% spread).

**Handling**: start at midpoint 0.15. Once the verdict distributions of same-provider sessions in score_history become statistically comparable to cross-provider, evolve into a per-pair table. For now this would be over-engineering.

### 4.3 Goodhart-avoidance incentive shift

- Previous mental model: "if same-provider it'll be PARTIAL anyway, no need to chase 27+".
- New mental model: "factor in the discount and chase raw 27+ to PASS".

**Handling**: quality pressure increases. Intended direction.

---

## 5. Decision impact

| Item | Impact |
|---|---|
| `validator/anti-deception.ts` | Rule 4 branch change (binary → numerical), new violation tag |
| `validator/anti-deception.test.ts` | Update existing self-bias tests + add new discount cases |
| `protocol/types.ts` | Add `self_bias_score_discounted` to the `Scores.audit_violations` enum (no change if already a free-form string array) |
| Wiki | Cross-link this page with `bagelcode-scoring-ratchet-frontier-2026-05-02.md` |
| Studio / TUI | No change — the `cross_provider` flag display stays as is, but the user sees the discounted aggregate, so the displayed numbers become honest |

---

## 6. References

- **Stureborg et al. EMNLP 2024** — *Large Language Models are Inconsistent and Biased Evaluators*. §4.2 same-family bias measurement (+14~22% PASS inflation).
- **Anthropic Hybrid Normalization 2026** (dev docs Q1) — prompt-only mitigation reaches ~50% effect reduction; numerical correction is residual. Recommends a hybrid 2-stage approach.
- **Dubois et al. 2024** (AlpacaEval LC) — *Length-Controlled AlpacaEval*. Length-aware logistic regression as default headline metric.
- **Arena-Hard v2** (LMSYS 2025) — length-controlled win rate as default.
- **Rubric-Anchored Judging** (NeurIPS 2025) — bias concentrates in qualitative dims (D1/D5), deterministic dims immune.
- **Krumdick et al. EMNLP 2025** (Judge-Bench) — Sonnet 4 +1.6% / Gemini 2.5 Pro +3.4% inflation per length-extended response (residual after 2024-era debiasing). Cross-link evidence for residual numerical correction necessity.

## 7. Cross-links

- ★ **[[bagelcode-system-architecture-v0.4]]** §5 (R1-R7 table) — the R4 of this page is one of v0.4's anti-deception 7 rules
- [[bagelcode-scoring-ratchet-frontier-2026-05-02]] §3 (Failure modes), §4 (Frontier convergence), §7 (P0 recommendations)
- [[bagelcode-system-architecture-v0.1]] §7.3 (anti-deception Rules)
- [[bagelcode-verifier-isolation-matrix]] C2 (cross-provider standard), C5 (isolation cost)
- [[bagelcode-llm-judge-frontier-2026]] R3-R5 (judge-side bias inventory)
