---
title: LLM-as-Judge Frontier — CourtEval ACL 2025 / G-Eval / Bias / Multi-judge 합의 6 사료
category: references
tags: [bagelcode, llm-as-judge, courteval, g-eval, bias, multi-judge, scoring, frontier, 2026]
sources:
  - "CourtEval — ACL 2025 Findings (aclanthology.org/2025.findings-acl.1327)"
  - "Multi-Agent Debate for LLM Judges with Adaptive Stability (arXiv 2510.12697)"
  - "G-Eval (Confident AI / DeepEval framework)"
  - "Position Bias in LLM-as-a-Judge (IJCNLP 2025)"
  - "Self-bias in LLM evaluators (NeurIPS 2024)"
  - "Multi-judge consensus 97-98% F1 / Cohen's Kappa 0.95 (2025-2026)"
  - "When AIs Judge AIs — Agent-as-a-Judge survey (arXiv 2508.02994)"
summary: >-
  LLM-as-judge frontier 6 사료. CourtEval (ACL 2025) Grader/Critic/Defender/Re-grader 4 sub-step,
  G-Eval CoT+form-filling, position bias / self-bias 연구, multi-judge consensus 97-98% F1. Crumb v0.1
  scoring 3 layer 의 학술 backbone.
provenance:
  extracted: 0.65
  inferred: 0.30
  ambiguous: 0.05
created: 2026-05-02
updated: 2026-05-02
---

# LLM-as-Judge Frontier — 6 사료 (Crumb v0.1 scoring 학술 backbone)

> [[bagelcode-system-architecture-v0.1]] §7 의 3 layer scoring (reducer + qa_check effect + verifier CourtEval) 와 §7.3 의 anti-deception 5 룰의 1차 학술 근거.

---

## R1. CourtEval — ACL 2025 Findings

URL: https://aclanthology.org/2025.findings-acl.1327/

**핵심**:
- "Courtroom" 패턴 차용. 4 role:
  - **Grader** (judge) — initial score
  - **Critic** (prosecutor) — score 도전
  - **Defender** (defense attorney) — score 변호
  - **Re-grader** — Critic + Defender 입력 반영해 final score

**검증 결과**:
- "**substantially outperforms** state-of-the-art on SummEval, TopicalChat" (NLG meta-eval benchmarks)
- "**stronger agreement with human judgments**" — 단일 LLM 대비

**Crumb 적용**:
- v0.1 §7.1 Layer 3 — verifier sandwich 안 inline 4 sub-step (`step.judge.{grader,critic,defender,regrader}`)
- 1 spawn 안 sequential reasoning, 토큰 ~+30% but quality 큰 향상
- `kind=judge.score.courteval.{grader_msg_id,critic_msg_id,defender_msg_id,regrader_msg_id}` 4 message ref 보존 (audit trail)

---

## R2. Multi-Agent Debate for LLM Judges with Adaptive Stability Detection

URL: https://arxiv.org/html/2510.12697v1 / OpenReview Vusd1Hw2D9

**핵심**:
- multi-agent debate 가 단일 judge 대비 향상
- 단 무한 debate 위험 → **adaptive stability detection** 으로 종료 시점 결정
- 점수 variance < threshold 시 stop

**Crumb 적용**:
- v0.1 §"Adaptive stopping" — `progress_ledger.score_history` variance < 1.0 over 2 rounds → next=done
- verifier polish 무한 루프 차단

---

## R3. G-Eval — Confident AI / DeepEval framework

URL: https://www.confident-ai.com/blog/g-eval-the-definitive-guide

**핵심**:
- **CoT + form-filling paradigm**: LLM 이 구조화된 form 채우면서 CoT
- BLEU/ROUGE 같은 reference-based metric 의 한계 극복 (subjective / open-ended task 강함)
- 단일 model 의 G-Eval 은 self-bias / position bias 위험

**Crumb 적용**:
- v0.1 §3.6 `kind=judge.score.scores` 의 form-filling 구조 (D1-D6 + source / lookup / evidence)
- 단 단일 G-Eval 의존 안 함 — CourtEval 4 sub-step 으로 다양성 확보

---

## R4. Position Bias — IJCNLP 2025 "Judging the Judges"

URL: https://www.researchgate.net/publication/402590616

**핵심**:
- "**judge model choice has the highest impact on positional bias**" — task complexity, output length, quality gaps 보다 큰 영향
- 즉 **judge 와 builder 가 같은 model 이면 위치 편향 발생**

**Crumb 적용**:
- v0.1 §"bagelcode-cross-3way" preset 의 builder=Codex / verifier=Gemini 매핑이 정확히 cure
- §7.3 anti-deception 룰 #4 `self_bias_risk_same_provider` audit_violations

---

## R5. Self-Bias — NeurIPS 2024

**핵심**:
- "LLM evaluators **recognize and favor their own generations**"
- "**linear correlation** between self-recognition capability and self-preference bias strength"
- 즉 model 능력 ↑ 시 self-preference 도 ↑ — frontier 모델일수록 위험

**Crumb 적용**:
- cross-provider verifier 가 학술 검증된 mitigation
- v0.1 §3.6 metadata.cross_provider=true flag 가 평가자에게 self-bias 회피 인지

---

## R6. Multi-Judge Consensus — 2025-2026 frontier

URL: https://arxiv.org/html/2412.05579v2 (LLMs-as-Judges Survey) + 2025-2026 follow-up

**핵심**:
- **3-judge baseline**: macro **F1 97-98%**, Cohen's Kappa **0.95**
- 통계적으로 "score rubric order bias / score ID bias / reference answer score bias" 모두 완화
- 3 vendor 다양성 (provider 다름) 시 효과 ↑

**Crumb 적용 (P1)**:
- `bagelcode-tri-judge.toml` preset (P1) — verifier × 3 (Claude/GPT/Gemini) 동시 spawn
- consensus 도출 후 final judge.score
- 마감 후 P1, README 한 단락 인지 노출

---

## R7. Production placement — 2026 산업 데이터 (보너스)

**핵심 (Arize blog)**:
- "lightweight judge agent that scores worker outputs **before reaching user**, +500-800ms latency, **catches 15-20% errors**"
- LangGraph: 별도 node + conditional_edge
- AutoGen: GroupChat selector
- Model tiering: triage = Haiku 4.5 / GPT-mini, reasoning = Sonnet 4.6 / GPT-5.5

**Crumb 적용**:
- v0.1 §"latency 1 spawn" — verifier 1 spawn 추가 (CourtEval 4 sub-step inline) ≈ +500-800ms
- 동일 production 패턴, 동일 latency profile

---

## 종합 — Crumb v0.1 scoring 3 layer 의 frontier 정합

| Crumb v0.1 결정 | 매핑 사료 | 강도 |
|---|---|---|
| Layer 1 reducer auto (D3/D4/D5) | (자체 설계, transcript 분석) | self-derived |
| Layer 2 qa_check effect (D2/D6) | AutoGen Executor (57.6k) deterministic | ✅ |
| Layer 3 verifier CourtEval inline | **R1 ACL 2025** 직접 | ✅✅ |
| 4 sub-step (Grader/Critic/Defender/Re-grader) | **R1** verbatim | ✅✅ |
| adaptive stopping (variance < 1.0) | **R2 arXiv 2510.12697** | ✅ |
| form-filling structured score | **R3 G-Eval** | ✅ |
| cross-provider verifier 의무 | **R4 + R5** position + self-bias 차단 | ✅✅ |
| anti-deception 5 룰 (D2/D4 ground truth + self-bias risk) | **R4 + R5** mitigation 설계 | ✅ |
| multi-judge consensus (P1) | **R6** 97-98% F1 | ✅ (P1 future) |
| +500-800ms latency profile | **R7** Arize production | ✅ |

→ **10 차원 중 9 차원이 1차 frontier 사료 직접 매핑** + 1 차원 self-derived (Layer 1 transcript 분석). 자체 발명 비중 < 10%.

---

## See also

- [[bagelcode]] / [[bagelcode-recruitment-task]]
- [[bagelcode-system-architecture-v0.1]] — 본 사료의 Crumb 통합
- [[bagelcode-rubric-scoring]] — D1-D6 1차 spec (v0.1 §7 가 3 layer 로 확장)
- [[bagelcode-frontier-orchestration-2026]] — multi-agent fault tolerance frontier (sister)
- [[bagelcode-verifier-isolation-matrix]] — 13+7 사료 × 4 차원 (cross-provider C2 backbone)
- [[bagelcode-frontier-cli-convergence-2026]] — 4 CLI 합의 (sister)
- [[bagelcode-final-design-2026]] §3.D — CourtEval 1차 도입 (v0.1 가 3 layer 로 확장)
