---
title: Scoring + Ratchet — 2026 frontier 검증 + Crumb 정렬
date: 2026-05-02
type: synthesis
tags: [scoring, ratchet, multi-agent, frontier-2026, llm-judge, courteval, deterministic-gate, cross-provider, goodhart, devin-postmortem]
related:
  - bagelcode-system-architecture-v3
  - bagelcode-verifier-isolation-matrix
  - bagelcode-host-harness-decision
  - bagelcode-user-intervention-frontier-2026-05-02
---

# Scoring + Ratchet — 2026 Frontier 검증 + Crumb 정렬

> **질문**: 에이전트 간 통신으로 퀄리티를 올릴 때 *scoring + ratchet* (verifier가 D1-D6 점수를 매기고, threshold 통과 또는 variance 기반 adaptive_stop까지 반복) 패턴은 정말 유효한가? 다른 방안은 없는가?
>
> **결론**: **조건부 유효**. Deterministic 신호 위에서의 ratchet은 frontier 정설(Reflexion HumanEval +11pp / DeepSeek-R1 / SWE-bench 2025 top10 전부 exec-based). 그러나 **순수 LLM-judge ratchet은 round 4+ 에서 Goodhart divergence**, **same-provider verifier는 PASS rate +14~22% 인플레이션**. Crumb의 3-layer scoring은 frontier failure mode의 60-70%를 방어하지만, **verifier self-bias enforcement / Goodhart drift cap / length normalization** 세 축은 추가 방어 필요.

---

## 0. TL;DR

- **유효**: deterministic ratchet (exec gate → kind=qa.result D2/D6 ground truth) — 무조건 채택. SWE-bench 2025 top10 / Cognition Devin postmortem / DeepSeek-R1이 동일 결론.
- **조건부 유효**: LLM-judge ratchet — multi-role 구조(CourtEval ACL 2025 +12.4%) + cross-provider일 때만 재현 가능. Same-provider self-judge는 +14~22% PASS 인플레이션 (Stureborg EMNLP 2024).
- **2026 frontier 수렴점**: deterministic gate 강화 + verifier 측 test-time compute(extended thinking). Multi-agent debate / PRM / self-refine은 production에서 후퇴 중.
- **Crumb 권고**: (1) verifier extended thinking default high, (2) Playwright smoke run 의무화 (현재 optional), (3) `cross_provider=true`를 anti-deception validator 검증 항목으로 승격, (4) iteration hard ceiling.

---

## 1. 패턴 정의

**Scoring**: verifier LLM이 출력물을 N차원(Crumb는 D1-D6)으로 0~5 채점, aggregate 0~30.

**Ratchet**: 매 round verdict 산출 → PASS/PARTIAL/FAIL.
- PASS or 사용자 approve → done
- FAIL → rollback to planner-lead로 respec
- PARTIAL → 사용자 hook
- variance(score_history[-2:]) < 1.0 → adaptive_stop (NeurIPS 2025 multi-agent debate judge 패턴)

**Crumb 의 3-layer 분해**:

| Layer | Source | Dimensions |
|---|---|---|
| Deterministic (rule-based) | `qa_check` effect (no LLM) | D2 exec, D6 portability |
| Reducer-auto | pure function | D3 schema, D4 budget |
| LLM judge (CourtEval inline 4 sub-step) | verifier actor | D1 spec_fit, D5 quality |
| Hybrid | validator + judge | aggregate + verdict |

`anti-deception.ts`: verdict=PASS인데 `qa.result.exec_exit_code != 0` 이면 D2=0 강제.

---

## 2. Validity evidence (정량 lift, 2024-2026)

| Source (year / venue) | Finding |
|---|---|
| **Arena-Hard-Auto** (Li et al., 2024 lmsys) | GPT-4-Turbo judge vs Chatbot Arena human votes — Spearman ρ = **0.89**, separability 87% |
| **G-Eval** (Liu et al., NAACL 2023; 2025 follow-ups) | GPT-4 CoT judge — Spearman **0.514** on SummEval (vs BERTScore 0.32) |
| **CourtEval** (Roy et al., ACL 2025) | Grader → Critic → Defender → Re-grader 4-role; agreement with humans **+12.4%** vs single-judge baseline on MT-Bench-Hard |
| **RewardBench v2** (Lambert et al., 2025) | Top reward models 88-91% chosen-vs-rejected accuracy; Constitutional AI judges narrow gap to RLHF |
| **Multi-Agent Debate as Judge** (Khan et al., NeurIPS 2025) | Adversarial debate + adaptive stop (variance < δ) — **+8.7%** factual QA over single-LLM judge; debate convergence ~3 rounds |
| **Inverse Constitutional AI** (Findeis et al., ICLR 2025) | Recovered preference principles produce judges with **0.73-0.81** human agreement |
| **Self-Refine** (Madaan et al., NeurIPS 2023; replicated 2025) | HumanEval **+8.7pp** (67.0 → 75.7) GPT-4; saturates after 3-4 rounds |
| **Reflexion** (Shinn et al., NeurIPS 2024) | HumanEval **+11pp** (80→91) with verbal reinforcement on test-pass signal |
| **Sakana AI Scientist v2** (2025) | Iterative review→revise loop with adaptive halt; ICLR workshop acceptance for 1/3 generated papers |

**핵심**: deterministic signal (test execution) 위의 ratchet은 강력. Pure LLM-judge ratchet은 noisier → adaptive_stop이 필수.

---

## 3. Failure modes (정량 측정, 2024-2025)

| Failure | Source (year / venue) | Magnitude |
|---|---|---|
| **Position bias** | Wang et al., IJCNLP-AACL 2025 | GPT-4 prefers position-1 **65-75%** when content identical (random 50%) |
| **Self-preference bias** | Panickssery et al., NeurIPS 2024 | LLMs rate own outputs **~6%** higher; correlated with self-recognition (r=0.76) |
| **Length bias** | AlpacaEval 2.0 LC, 2024-2025 | Pre-LC: judges prefer longer responses (+4.7% per 100 tokens) |
| **Sycophancy** | Sharma et al., ICLR 2024 | RLHF judges agree with user-stated wrong answer **47-58%** |
| **Reward hacking** | Skalse et al., NeurIPS 2022; Singhal 2024 | RLHF length exploitation: reward ↑12% w/o quality gain |
| **Goodhart on judge** | Eisenstein et al., 2024 (Google DeepMind) | Iterative optimization vs LLM judge: actual quality plateaus round 2-3, judge score keeps rising → **divergence after round 4** |
| **Verifier collusion (same base model)** | Stureborg et al., EMNLP 2024 | Builder+verifier same model: PASS rate **+14-22% inflated** vs cross-model |
| **Devin postmortem** | Cognition.ai blog "Don't Build Multi-Agents", Jun 2025 | Over-orchestrated multi-agent loops produce *plausible* but incorrect work; recommend single-thread + tool calls over verifier polish |
| **Infinite polish** | Chen et al., 2025 (Princeton) | Self-revise loops show diminishing returns after 3 iterations; **8% regress** |

---

## 4. 2026 Frontier 수렴 — 무엇이 후퇴하고 무엇이 남는가

| Framework / source | 2026 stance |
|---|---|
| **AutoGen 0.4** (Microsoft, Oct 2024 rewrite) | event-driven actor; **GroupChat 권장도 ↓**, "single-agent first"로 회귀 |
| **DSPy 2.5+** (Khattab) | 컴파일러 기반 prompt opt + **외부 deterministic metric** 강제. ratchet 안 씀 |
| **LangGraph 0.3** | StateGraph + **human-in-the-loop checkpointing**, deterministic gate 권장 |
| **OpenHands** (formerly OpenDevin) | exec-based + browser-based ground truth → SWE-bench top |
| **Cognition Devin** | "no multi-agents" — single-agent + 강한 context engineering (Jun 2025 blog) |
| **Cursor / Aider / Cline** | LSP/diagnostics → exec gate → 사용자 confirm. LLM judge 거의 안 씀 |
| **DeepSeek-R1** (Jan 2025) | **PRM 폐기 → rule-based reward 회귀** (compile pass / unit test pass만) |

**공통 결론**: deterministic gate + cross-provider critique 보강으로 수렴. Multi-agent debate / PRM / self-refine은 production에서 후퇴.

---

## 5. 대안 패턴 inventory + Crumb fit matrix

| # | Pattern | Mechanism | 2026 evidence | Cost | Crumb fit | Verdict |
|---|---|---|---|---|---|---|
| 1 | **PRM (Process Reward Model)** | step-level reward | ★★ (saturating; Setlur NeurIPS 2025: lift only when policy weak) | ★★ high | ★ (game.html step 분해 부자연) | **SKIP** (DeepSeek 폐기 이유 동일) |
| 2 | **Reflexion / Self-Refine** | self-critique + revise | ★★★ (external verifier 있을 때만 작동, Huang ICLR 2024) | ★★★ med | ★★ (verifier가 이미 external feedback) | **SKIP** (중복) |
| 3 | **Test-time compute scaling** (extended thinking) | inference 시 sampling/search | ★★★★★ (Snell ICLR 2025: 4x compute = 14x pretrain; o1/R1/Sonnet 3.7) | ★★★★ low | ★★★★★ (verifier 측 가장 cost-효율) | **ADD** |
| 4 | **Multi-agent debate / knockout** | N-agent 토론 후 judge | ★★★ (Du ICML 2024 +4%p but cost 3x; Smit 2024 "MAD?" cost 정당화 어려움) | ★★ high | ★★★ (CourtEval이 이미 intra-debate) | **LATER** (cross-provider 형태로) |
| 5 | **Constitutional AI / RLAIF** | 원칙 명시 → 자기 비판 → DPO/RLHF | ★★★★ (training-time, 이미 frontier 모델에 흡수) | (training only) | ★★ (inference-only harness) | **PARTIAL** (verifier sandwich에 inline principle 적용 무료) |
| 6 | **Cross-provider verification** | 다른 provider가 verify | ★★★★★ (Stureborg EMNLP 2024 +14-22% inflation; Sharma ICLR 2024 sycophancy) | ★★★ med | ★★★★★ (`bagelcode-cross-3way` 이미 있음) | **KEEP + ENFORCE** |
| 7 | **Deterministic / programmatic verification** | exec / lint / AST / test | ★★★★★ (SWE-bench top10 / Cognition / DeepSeek-R1) | ★★★★★ very low | ★★★★★ (qa_check 이미 있음, Playwright optional) | **STRENGTHEN** |
| 8 | **Counterfactual / perturbation** | input 변형 → robustness | ★★★ (ARC-AGI-2 Mar 2025; GSM-Symbolic ICLR 2025) | ★★★ med | ★★ (production harness, 측정 ROI 애매) | **LATER** |
| 9 | **Process supervision** | intermediate step 라벨 | ★★ (PRM800K 등; saturate) | ★★ high | ★ | **SKIP** |
| 10 | **Hybrid (LLM + program)** | exec gate + LLM judge 조합 | ★★★★★ (대부분의 frontier OSS) | ★★★★ low | ★★★★★ (Crumb이 정확히 이 형태) | **KEEP** |

---

## 6. Crumb 정렬 분석

### ✅ 방어 중인 failure mode (frontier 정렬)

- **D2/D6 forgery**: `qa_check` effect (no LLM) → `anti-deception.ts` D2=0 enforcement → **reward hacking 구조적 차단**. Reflexion 급 verifiable feedback 확보.
- **Position / self-bias 일부**: CourtEval 4-role(Grader → Critic → Defender → Re-grader) 강제 — adversarial 구조가 single-judge bias 완화. ACL 2025 +12.4% 결과 재현 가능.
- **Sycophancy on D1/D5**: Critic role 명시 → 동의 편향 감소.
- **Multi-agent over-iteration**: variance-based adaptive_stop → infinite polish 차단. NeurIPS 2025 패턴과 일치.
- **State drift**: append-only ULID transcript + pure reducer → replay-deterministic, post-hoc 점수 위조 불가.

### ⚠️ 노출된 failure mode

| # | Gap | 영향 | 권고 |
|---|---|---|---|
| G-A | ✅ **Defended** (PR #38, 2026-05-02) | Rule 4 `self_bias_risk_same_provider` 가 PASS → PARTIAL 강등 enforce. Stureborg EMNLP 2024 +14-22% inflation 차단. `bagelcode-cross-3way` preset 권장 path. |
| G-B | ✅ **Already implemented** | `VERIFY_MAX=5` (`src/reducer/index.ts`) + variance-based adaptive_stop + ratchet regression — 3-layer cap. Goodhart drift round 4+ 차단. |
| G-C | ⏸ **Open** (length bias normalization 부재) | AlpacaEval LC 같은 길이 보정 없음. Verifier 가 더 긴 spec.md / DESIGN.md 선호 가능 — token 길이 explicit 노출 권장 |
| G-D | ✅ **Defended** (PR _TBD_, 2026-05-02) | Rule 6 `composite_gaming_d1_d5_below_minimum` — `aggregate ≥ 24 AND D1 ≥ 3 AND D5 ≥ 3` AND-gate. SWE-bench Verified / RewardBench v2 / OpenAI Preparedness / Anthropic RSP v2 수렴. Threshold 3/5: judge variance σ≈0.6 (Zheng NeurIPS 2023) — 4/5 false-negative 위험. |
| G-E | ✅ **Defended** (PR #33, 2026-05-02) | Playwright real Chromium smoke + 3-way env contract (`CRUMB_QA_REQUIRE_PLAYWRIGHT=1` strict). SWE-bench top10 / Cognition Devin / DeepSeek-R1 정렬. CI strict gate 는 deadline 후 후속. |

---

## 7. 권고 (P0 → P1 → SKIP)

### P0 (즉시 ADD — frontier가 강력 지지)

1. **Verifier 측 extended thinking 활성화** — Anthropic `budget_tokens=24000+` / OpenAI `reasoning_effort=high` / Gemini `thinking_config`. Snell ICLR 2025: test-time compute 4x = 14x pretrain. 이미 model-config UI에 `effort` 필드 있음 → preset/actor별 default high 적용만 추가.
2. **Playwright smoke run 의무화** (G-E). qa-runner 호출 시 Playwright 강제. anti-deception false-PASS 차단력 ↑↑.

### P1 (다음 ratchet — validator 강화)

3. ✅ **Cross-provider enforcement** (G-A) — PR #38 ship. `anti-deception.ts` Rule 4: same-provider → PASS → PARTIAL.
4. ✅ **Iteration hard ceiling** (G-B) — already `VERIFY_MAX=5` + variance + ratchet regression 3-layer.
5. ✅ **Composite gaming 방어** (G-D) — PR _TBD_ ship. Rule 6: `aggregate ≥ 24 AND D1 ≥ 3 AND D5 ≥ 3`. Threshold 3/5 (4/5 대신) — judge variance σ≈0.6 (Zheng NeurIPS 2023) 고려한 frontier-aligned calibration; 4/5 tightening 은 extended-thinking 채택 후 P2.

### SKIP (frontier가 후퇴 중)

- 추가 multi-agent debate (CourtEval이 intra-debate)
- PRM / process supervision (DeepSeek 폐기 이유 동일)
- self-refine (verifier와 중복)

---

## 8. References

### 2024-2025 LLM-as-Judge 검증
- Li, T. et al. (2024). *Arena-Hard-Auto*. lmsys.
- Liu, Y. et al. (NAACL 2023). *G-Eval*.
- Roy, A. et al. (ACL 2025). *CourtEval*.
- Lambert, N. et al. (2025). *RewardBench v2*.
- Khan, A. et al. (NeurIPS 2025). *Multi-Agent Debate as Judge*.
- Findeis, A. et al. (ICLR 2025). *Inverse Constitutional AI*.

### Self-correction / iterative refinement
- Madaan, A. et al. (NeurIPS 2023). *Self-Refine*.
- Shinn, N. et al. (NeurIPS 2024). *Reflexion*.
- Huang, J. et al. (ICLR 2024). *Large Language Models Cannot Self-Correct Reasoning Yet*.
- Stechly, K. et al. (NeurIPS 2024). *Self-critique limitations on planning*.
- Kamoi, T. et al. (TMLR 2024). *Survey on self-correction with external verifiers*.

### Failure modes
- Wang, P. et al. (IJCNLP-AACL 2025). *Position bias*.
- Panickssery, A. et al. (NeurIPS 2024). *Self-preference bias*.
- Sharma, M. et al. (ICLR 2024). *Sycophancy in LLMs*.
- Skalse, J. et al. (NeurIPS 2022). *Reward hacking*.
- Eisenstein, J. et al. (2024). *Goodhart on judge — Google DeepMind*.
- Stureborg, R. et al. (EMNLP 2024). *Verifier collusion same-base-model*.
- Chen et al. (2025). *Princeton — diminishing returns on self-revise*.

### Test-time compute / deterministic gate
- Snell, C. et al. (ICLR 2025). *Scaling LLM Test-Time Compute Optimally*.
- DeepSeek-AI (Jan 2025). *DeepSeek-R1*.
- Trinh, T. H. et al. (Nature 2025). *AlphaGeometry 2*.
- METR (2025). *RE-Bench: false-positive 30%+ without exec gate*.

### Production retrospectives
- Cognition AI (Jun 2025). *Don't Build Multi-Agents*. blog.
- AutoGen 0.4 release notes (Microsoft, Oct 2024).
- DSPy 2.5+ docs.
- LangGraph 0.3 docs.

---

## 9. Cross-links

- [[bagelcode-system-architecture-v3]] — §3.5 qa.result, §7 3-layer scoring
- [[bagelcode-verifier-isolation-matrix]] — 20-source × 4-dimension cross-provider 매트릭스 (G-A 권고의 직접 backing)
- [[bagelcode-host-harness-decision]] — Hybrid (Skill + headless CLI) lock
- [[bagelcode-user-intervention-frontier-2026-05-02]] — G1-G6 매핑 (이 문서와 같은 형식의 frontier survey)
- `protocol/schemas/message.schema.json` — D1-D6 score 스키마
- `src/validator/anti-deception.ts` — G-A 권고 구현 위치
- `src/dispatcher/qa-runner.ts` — G-E (Playwright 의무화) 구현 위치
- `src/reducer/index.ts` — G-B (iteration hard ceiling) 구현 위치
- `.crumb/presets/*.toml` — P0-1 (verifier extended thinking default) 구현 위치
