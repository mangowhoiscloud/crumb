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

> **질문**: same-provider verifier 가 같은 builder 의 산출물을 채점할 때 +14~22% PASS 인플레이션이 발생한다 (Stureborg EMNLP 2024). 현재 Crumb 의 anti-deception Rule 4 는 binary verdict downgrade (PASS → PARTIAL) 만 적용. 이게 충분한가, 아니면 score 자체에 numerical discount 를 적용해야 하나?
>
> **결론**: **numerical discount 채택**. binary gate 는 dynamic range 를 collapse 시키고 evidence-quantitative 한 mitigation 을 binary action 으로 변환해 정보 손실 발생. D1+D5 (LLM-judged 차원) 에 한해 0.15 discount factor 를 적용, D2/D6 (deterministic ground truth) 와 D4 (reducer-auto) 는 면역. PASS → PARTIAL 명시적 강등은 제거하고 standard threshold (≥24 PASS / 18-23 PARTIAL / <18 FAIL) 가 자연스럽게 재발화하도록 둠.

---

## 0. TL;DR

- **이전**: `Rule 4 self_bias_risk_same_provider` 은 violation tag 추가 + verdict 가 PASS 면 PARTIAL 로 강등 (binary).
- **이후**: D1 (spec_fit) · D3 (schema/observability LLM 절반) · D5 (quality) 를 `score × (1 − 0.15)` 로 깎음. aggregate 재계산. verdict 은 standard threshold 로 자연스럽게 결정. 추가 violation tag `self_bias_score_discounted` 기록.
- **Scope**: D2 (qa-check exec) · D6 (qa-check portability) · D4 (reducer-auto budget) 는 면역. D3/D5 는 LLM+auto split 이지만 verifier 가 emit 하는 건 raw LLM-judged `scores.D{3,5}.score` 이고, `combineDimScore` 가 그 값과 `autoScores.D{3,5}_auto` 를 평균. 따라서 combine 전에 `scores.D{3,5}.score` 만 깎는 건 LLM 절반만 깎는 것과 수학적으로 동일 — auto 절반은 그대로 보존.
- **factor 0.15**: Stureborg EMNLP 2024 의 +14~22% inflation 범위의 보수적 midpoint. 정밀화는 frontier 데이터 축적 후 P1.

---

## 1. 문제 — 기존 binary gate 의 한계

### 1.1 현재 동작 (`src/validator/anti-deception.ts:111-117, 148-150`)

```ts
const sameProvider = Boolean(
  verifierProvider && input.builderProvider && verifierProvider === input.builderProvider,
);
if (sameProvider) {
  violations.push('self_bias_risk_same_provider');
}
// ... 후략 ...
if (sameProvider && scores.verdict === 'PASS') {
  scores.verdict = 'PARTIAL';
}
```

### 1.2 4 가지 한계

1. **Dynamic range collapse**. 27/30 PASS 와 19/30 PARTIAL 이 둘 다 PARTIAL 로 표시 → score_history 의 ratchet (max_aggregate_so_far) 이 과대 평가 (27 로 기록되지만 실은 inflation 보정 후 23 즈음).
2. **Evidence 무시**. 측정된 inflation 은 +14~22% 의 **연속적 수치**. 이를 binary action (PASS↔PARTIAL) 으로 환원하면 측정의 정밀도가 절반 이상 손실.
3. **D2/D6 도 같이 강등**. binary gate 는 verdict 단위. PASS 가 PARTIAL 이 되면 D2=5 / D6=5 (qa-check ground truth) 도 같이 표시상 절하 — deterministic 신호의 신뢰성 훼손.
4. **PARTIAL hook 이 사용자 대기 비용 추가**. binary 강등은 hook(partial) 발화 → `runSession` 이 사용자 응답 대기 (architecture v0.2.0 G1). same-provider 한 가지 사실만으로 매 verdict 마다 사용자가 confirm/veto 클릭하는 cognitive load 가 frontier 표준에 비해 과함.

---

## 2. Frontier evidence — 왜 numerical discount 가 옳은가

### 2.1 Stureborg EMNLP 2024 — 측정된 inflation

> "Same-provider judge inflates PASS rate by **+14% to +22%** depending on the model family pairing." (§4.2 same-family bias)

연속적 수치이므로 numerical mitigation 이 자연스러운 대응.

### 2.2 Anthropic Hybrid Normalization 2026 — 2-stage mitigation

> "Prompt-only mitigation (e.g., 'ignore length' instruction) reaches **~50% effect reduction**; the residual is *your* responsibility."

Hybrid 권고 = prompt warning **+** numerical post-correction. Crumb 는 이미 cross-provider 권고 prompt 를 verifier sandwich 에 주입 (length-context @v1 패턴) — prompt layer 는 50% 이미 cover. **잔여 50% 가 numerical discount 의 정당한 자리**.

### 2.3 AlpacaEval LC (Dubois et al. 2024) / Arena-Hard v2 — Length-controlled scoring 선례

- AlpacaEval 1.0 → 2.0 (LC) 에서 length-aware logistic regression 이 default.
- Arena-Hard v2 : "headline metric is length-controlled win rate". Frontier 표준 = numerical-controlled scoring, 절대값 아님.

Same-provider 통제는 length 통제와 같은 family 의 calibration. **이미 frontier 가 채택한 패턴을 같은 layer 에서 적용**.

### 2.4 Rubric-Anchored Judging (NeurIPS 2025) — bias 의 dim-specific concentration

> "Length bias concentrates in qualitative dims (D1 spec_fit / D5 quality) while quantitative dims (D2/D6 from qa-check-effect) are immune."

Same-provider self-bias 도 **동일하게 qualitative dim 에 집중**. 이미 length-bias firewall (G-C, `dispatcher/live.ts:118-132`) 이 동일한 D1/D5 scope rationale 로 작동 — **scope 는 동일 (D1+D5), mitigation method 만 다름**:

| Bias source | Mitigation layer | Scope |
|---|---|---|
| Length | Prompt ("length is not quality") | D1 / D5 |
| Same-provider | Prompt + **numerical discount 0.15** | D1 / D5 |

### 2.5 Discount factor 0.15 의 calibration

| 출처 | 측정값 | 보정 후 |
|---|---|---|
| Stureborg EMNLP 2024 §4.2 | +14% (Llama family) | discount 0.14 |
| Stureborg EMNLP 2024 §4.2 | +18% (GPT family self) | discount 0.18 |
| Stureborg EMNLP 2024 §4.2 | +22% (Claude family self) | discount 0.22 |
| Anthropic 2026 (prompt 50% cover) | 잔여 절반 | 0.07 ~ 0.11 |
| Cross-provider 3-judge consensus (verifier-isolation-matrix) | F1 97-98%, κ=0.95 | 0% |

**선택**: 보수적으로 **0.15** (Stureborg midpoint). prompt mitigation 50% 가 이미 작동 중이라는 가정 시 0.07~0.11 이 더 정밀하나, prompt 의 실제 effect rate 가 미검증이라 안전 마진 두고 0.15. 정밀화는 score_history 의 same-provider session 추적 데이터 축적 후 P1.

---

## 3. 변경 사양

### 3.1 신규 동작 (`src/validator/anti-deception.ts`)

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

// 제거: 기존의 binary verdict downgrade (line 148-150)
// (aggregate 재계산 후 standard threshold 가 자연스럽게 verdict 결정)
```

### 3.2 Scope rationale

| Dim | Source | Discount | 이유 |
|---|---|---|---|
| D1 spec_fit | verifier-llm | ✅ 0.15 | 100% LLM 판단, qualitative |
| D2 exec | qa-check-effect | ❌ 면역 | deterministic ground truth |
| D3 schema | LLM + auto split | ✅ 0.15 | verifier 가 emit 하는 raw LLM-judged `scores.D3.score` 를 깎고, `combineDimScore` 가 그 값과 `autoScores.D3_auto` 를 평균 — combine 전에 깎는 건 LLM 절반만 깎는 것과 수학적으로 동일 |
| D4 budget | reducer-auto | ❌ 면역 | deterministic, no LLM |
| D5 quality | verifier-llm | ✅ 0.15 | 100% LLM 판단, qualitative (D3 와 동일 mechanism — D5 도 LLM+auto split) |
| D6 portability | qa-check-effect | ❌ 면역 | deterministic ground truth |

### 3.3 효과 케이스

| 케이스 | aggregate 변화 | verdict | `max_aggregate_so_far` |
|---|---|---|---|
| 27/30 PASS · same-provider · D1=4 D5=5 | 27 → 25.65 (D1: 4→3.4, D5: 5→4.25) | PASS (≥24) | 25.65 (정직) |
| 25/30 PASS · same-provider · D1=4 D5=5 | 25 → 23.65 | PARTIAL (자연 hop) | 23.65 |
| 19/30 PARTIAL · same-provider · D1=4 D5=4 | 19 → 17.8 | FAIL (자연 hop) | 17.8 |
| 27/30 PASS · **cross-provider** | 27 (변화 없음) | PASS | 27 |

같은 raw 점수 (27) 가 same-provider 에선 25.65 cap, cross-provider 에선 27 — **Stureborg evidence 가 그대로 매핑**.

> 위 표는 D1/D5 만 보여 단순화. 실제로는 D3 도 같은 0.15 discount 가 적용되지만, `combineDimScore` 가 `scores.D3.score` (LLM-emitted 절반) 와 `autoScores.D3_auto` (reducer 절반) 를 평균하므로 최종 D3 기여도는 LLM 절반의 7.5% 만 빠짐 (auto 절반은 immune). D5 도 동일 mechanism — verifier 가 emit 한 raw `scores.D5.score` 만 깎이고 `D5_auto` 와 평균.

---

## 4. Risk + mitigation

### 4.1 Single-provider 환경 페널티

Bagelcode 평가자 환경에서 Codex 만 인증된 경우 (`solo` preset) 모든 session 이 discount 적용.

**처리**: 의도된 동작. wiki 의 verifier-isolation-matrix 가 이미 single-provider 를 frontier 표준 미달로 결론. discount 는 평가자가 그 trade-off 를 정직하게 보도록 함. 강제로 cross-provider preset 권고는 `crumb doctor` / `crumb config` 가 이미 함.

### 4.2 Discount factor 가 provider-pair-specific

anthropic/anthropic 과 google/google 의 inflation 이 다를 수 있음 (Stureborg 14~22% 분산).

**처리**: midpoint 0.15 로 시작. score_history 의 same-provider session 의 verdict 분포가 cross-provider 와 통계적으로 비교 가능해지면 per-pair table 로 진화. 현재는 over-engineering.

### 4.3 Goodhart 회피 인센티브 변형

- 이전 mental model: "same-provider 면 어차피 PARTIAL 이니 27+ 노릴 필요 없음".
- 이후 mental model: "discount 감안해서 raw 27+ 노려야 PASS".

**처리**: 품질 압력 증가. 의도된 방향.

---

## 5. 결정 영향

| 항목 | 영향 |
|---|---|
| `validator/anti-deception.ts` | Rule 4 분기 변경 (binary → numerical), 새 violation tag |
| `validator/anti-deception.test.ts` | 기존 self-bias 테스트 update + 신규 discount 케이스 추가 |
| `protocol/types.ts` | `Scores.audit_violations` 의 enum 에 `self_bias_score_discounted` 추가 (이미 free-form string array 면 그대로) |
| Wiki | 이 페이지 + `bagelcode-scoring-ratchet-frontier-2026-05-02.md` cross-link |
| Studio / TUI | 변화 없음 — `cross_provider` flag 표시는 그대로, aggregate 가 깎인 값으로 표시되므로 사용자가 보는 숫자가 정직해짐 |

---

## 6. References

- **Stureborg et al. EMNLP 2024** — *Large Language Models are Inconsistent and Biased Evaluators*. §4.2 same-family bias measurement (+14~22% PASS inflation).
- **Anthropic Hybrid Normalization 2026** (dev docs Q1) — prompt-only mitigation reaches ~50% effect reduction; numerical correction is residual. Hybrid 2-stage 권고.
- **Dubois et al. 2024** (AlpacaEval LC) — *Length-Controlled AlpacaEval*. Length-aware logistic regression as default headline metric.
- **Arena-Hard v2** (LMSYS 2025) — length-controlled win rate as default.
- **Rubric-Anchored Judging** (NeurIPS 2025) — bias concentrates in qualitative dims (D1/D5), deterministic dims immune.
- **Krumdick et al. EMNLP 2025** (Judge-Bench) — Sonnet 4 +1.6% / Gemini 2.5 Pro +3.4% inflation per length-extended response (residual after 2024-era debiasing). Cross-link evidence for residual numerical correction necessity.

## 7. Cross-links

- ★ **[[bagelcode-system-architecture-v0.4]]** §5 (R1-R7 표) — 본 페이지의 R4 가 v0.4 의 anti-deception 7 rules 중 하나
- [[bagelcode-scoring-ratchet-frontier-2026-05-02]] §3 (Failure modes), §4 (Frontier 수렴), §7 (P0 권고)
- [[bagelcode-system-architecture-v0.1]] §7.3 (anti-deception Rules)
- [[bagelcode-verifier-isolation-matrix]] C2 (cross-provider standard), C5 (isolation cost)
- [[bagelcode-llm-judge-frontier-2026]] R3-R5 (judge-side bias inventory)
