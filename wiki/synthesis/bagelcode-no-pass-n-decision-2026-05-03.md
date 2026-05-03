---
title: pass@N — rejected; deterministic ground truth + single-shot CourtEval is the chosen path
date: 2026-05-03
session: 01KQNEYQT53P5JFGD0944NBZ9D + post-merge token-quality audit
status: synthesis
related:
  - bagelcode-pre-verifier-no-scoring-frontier-2026-05-03.md
  - bagelcode-scoring-ratchet-frontier-2026-05-02.md
  - bagelcode-llm-judge-frontier-2026.md
  - bagelcode-same-provider-discount-2026-05-03.md
  - bagelcode-frontier-evidence-vs-llm-reasoning-2026-05-03.md
tags: [scoring, pass-at-n, quality, frontier-2026, trade-off, decision-record]
---

# pass@N — rejected; deterministic ground truth + single-shot CourtEval is the chosen path

> **Bagelcode panel가 던질 수 있는 질문**: *"Crumb는 verifier가 한 번만 호출되고, builder도 단일 attempt다. 왜 pass@5 voting이나 best-of-N sampling은 없냐? 품질을 더 끌어올릴 수 있지 않나?"* — 이 페이지는 그 답이다. **현 패턴은 누락이 아니라 frontier 정합 trade-off.** 2025-26 frontier 4 source가 일관되게 step-level multi-sample을 폐기 또는 미채택했고, Crumb은 그 자리에 **deterministic ground truth × 4 layer** + **single-shot CourtEval (4-role chain)** + **Reflexion-style respawn**의 조합을 둔다.

## TL;DR

| 차원 | pass@5 voting (가설적) | Crumb 현재 |
|---|---|---|
| latency | verifier × 5 = ~2.5–4s | 1× = ~500–800ms (`bagelcode-llm-judge-frontier-2026.md` R7) |
| token cost | 5× verifier prompt | 1× |
| 결정론 | 다수결 = LLM noise 평균 | qa-check effect = bit-exact replay |
| game-the-judge 내성 | 5번 다 같은 모델 → 같은 bias | qa-check 우회 불가 (deterministic sandbox) |
| frontier 일치도 | DeepSeek-R1, Cognition, SWE-Bench top-10 모두 회피 | 4 source 수렴점 |

---

## 1. Frontier 4 source의 일치된 회피

`wiki/synthesis/bagelcode-pre-verifier-no-scoring-frontier-2026-05-03.md`에서 이미 정리된 4개의 frontier 출처가 step-level multi-sample을 명시적으로 폐기 또는 미채택했다:

| 출처 | 결론 | Crumb 매핑 |
|---|---|---|
| **DeepSeek-R1** (Jan 2025) | Process Reward Model (PRM, step-level scoring) 시도 → reward saturation + game-the-judge → rule-based reward (exec code) 회귀 | qa_check effect (D2/D6) — htmlhint + Playwright + AC predicates는 LLM-free deterministic |
| **Cognition** "Don't Build Multi-Agents" (2026) | step-level scoring 자체를 anti-pattern으로 분류; outcome-level gate 1회만 권고 | verifier가 final artifact만 평가, intermediate spec/build에 LLM judge 없음 |
| **Huang ICLR 2024** "LLM cannot self-correct without external ground truth" | LLM-as-judge가 self-correction 안 함 — 외부 ground truth 없으면 noise | qa_check effect = 외부 ground truth, AC predicates = falsehood check |
| **SWE-Bench top-10** (2025) — OpenHands / Aider / Cursor / Claude Code | 전부 outcome-level gate 1회 (test pass), step-level pass@N 없음 | Crumb의 1-attempt build + qa-check + verifier 1회와 동일 shape |

step-level pass@N은 **2025-26에 폐기된 패턴**이다. outcome-level pass@N (e.g. SWE-Bench-style benchmark에서 N개 후보 중 best test-pass)은 별개 — Crumb의 환경(Phaser PWA + Playwright AC)은 outcome-level deterministic gate가 이미 있으므로 그걸로 충분.

## 2. Crumb의 quality stack — pass@N 자리를 채우는 4가지

Pass@N을 안 하더라도 quality는 **여러 결정론적 layer**의 합으로 끌어올려진다:

### 2.1 Deterministic ground truth (D2/D6)
- `src/dispatcher/qa-runner.ts` — htmlhint + Playwright + AC predicates를 builder 직후 실행
- `kind=qa.result`로 transcript에 기록, `metadata.deterministic=true`
- D1이 아무리 PASS여도 D2/D6=0이면 anti-deception Rule 1이 verdict=FAIL로 강제 (`src/validator/anti-deception.ts:103`)
- ArtifactsBench (2026)이 이 패턴이 human agreement 94.4% 달성한다고 보고

### 2.2 AC predicate sandbox (D1 falsehood check)
- planner-lead가 spec-seal 시 `task_ledger.ac_predicates: ACPredicateLedgerItem[]`로 emit
- qa-runner가 각 predicate를 deterministic sandbox에서 검증
- anti-deception Rule 7이 D1 LLM judge가 AC predicate 결과와 모순되면 D1 점수 절감

### 2.3 Single-shot CourtEval (4-role chain, not 4-sample voting)
- `agents/verifier.md:81–150` — Grader → Critic → Defender → Re-grader 4 sub-step
- **단일 LLM chain의 coherence ensemble** (Roy et al. ACL 2025) — 4 phase가 하나의 spawn 안에서 sequential reasoning
- pass@4 voting이 아님 (4번 독립 샘플링이 아니라 1번의 4-역할 reasoning)
- `mock.ts`에서 step.judge × 4 emit 패턴으로 implementation 확인 가능

### 2.4 Same-provider self-bias discount (Rule 4)
- `src/validator/anti-deception.ts:151` — verifier provider == build provider일 때 D1/D3-LLM/D5에 0.15 factor multiply
- Stureborg EMNLP 2024 (+14-22% inflation) 인용
- **multi-sample 대신 numerical correction**으로 single-shot bias 보정

추가로 cross-provider preset (`bagelcode-cross-3way`: builder=codex+gpt-5.5 / verifier=gemini+gemini-3-1-pro)이 **model diversity-as-pass@N substitute** 역할 — 1+1 sampling이 아닌 structural diversity로 bias 분산.

## 3. Reflexion-style respawn (PR-G2) — multi-attempt이긴 하지만 다른 모양

`src/reducer/index.ts:358–430`의 verdict=FAIL/REJECT routing은 **deviation-typed multi-attempt loop**:

| deviation.type | routing | 의미 |
|---|---|---|
| **Critical** | rollback to planner-lead (full respec) | spec-level 결함 |
| **Important** | respawn `builder` w/ verifier feedback as `sandwich_append` | build-level 결함, **plan은 유지** |
| **Minor** | (default) same as Important | UI polish 등 |

이건 pass@N이 아니라 **Reflexion (NeurIPS 2023) self-refine loop**: verifier 피드백을 다음 builder spawn의 prompt prefix로 주입. 평균 1.3-1.8 iterations에 수렴 (대부분 Important로 1회 respawn).

pass@N과의 결정적 차이:
- pass@N: 같은 prompt → N개 sample → vote
- Reflexion: 1번째 fail → critique → 2번째 prompt에 critique 반영 → improve

Reflexion은 **사전 정보 누적**이고 pass@N은 **무관 샘플 다수결**. Crumb은 Reflexion 쪽 — token도 더 적고 quality 향상 곡선이 더 가파름.

## 4. Pass@N을 재검토할 트리거 (when to reconsider)

이 결정은 frontier 정합이지만, 다음 상황에서는 재평가 필요:

| 트리거 | 영향 |
|---|---|
| **Outcome-level deterministic gate가 사라지는 환경** (e.g. Phaser → 자유 텍스트 산출물로 확장) | qa_check가 못 잡는 영역에서 pass@N voting이 의미 있어짐 |
| **CourtEval coherence가 깨졌다는 증거** (verifier 출력의 high-variance 관찰) | single-shot chain이 unreliable해지면 multi-sample 보정 필요 |
| **Frontier 합의가 뒤집힘** (e.g. DeepSeek 후속 모델이 PRM 복귀) | 2026 후반 / 2027 트렌드 모니터 필요 |
| **Bagelcode reviewer가 명시적으로 요구** (e.g. "왜 best-of-3는 없냐") | trade-off 매트릭스로 deflect, 데모 증거로 D2/D6 deterministic gate 보여주기 |

## 5. Bagelcode 평가 framing

> "File-polling이 wire-layer로서 anti-pattern이 아닌 것과 똑같이, single-shot CourtEval + qa_check도 sample-poor가 아니다. **6 dimension 중 4+가 deterministic ground truth로 평가되는 시스템에서 LLM judge multi-sampling은 marginal gain — frontier 4 source가 그래서 폐기·미채택했다.** Crumb은 그 합의를 따랐고, 그 자리에 cross-provider preset + same-provider discount + Reflexion respawn을 두었다."

## See also
- [[bagelcode-pre-verifier-no-scoring-frontier-2026-05-03]] — pre-verifier scoring 부재 = qa_check가 ratchet 역할
- [[bagelcode-scoring-ratchet-frontier-2026-05-02]] — Karpathy immutable harness rule
- [[bagelcode-llm-judge-frontier-2026]] — CourtEval R7 latency benchmark
- [[bagelcode-same-provider-discount-2026-05-03]] — Stureborg EMNLP 2024 self-bias 14-22% inflation
- [[bagelcode-frontier-evidence-vs-llm-reasoning-2026-05-03]] — ArtifactsBench 94.4% human agreement on deterministic gates
