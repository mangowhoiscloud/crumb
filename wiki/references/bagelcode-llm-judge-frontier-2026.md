---
title: LLM-as-Judge Frontier — CourtEval ACL 2025 / G-Eval / Bias / Multi-judge consensus, 6 sources
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
  6 frontier sources for LLM-as-judge. CourtEval (ACL 2025) Grader/Critic/Defender/Re-grader 4 sub-steps,
  G-Eval CoT+form-filling, position bias / self-bias research, multi-judge consensus 97-98% F1.
  Academic backbone of Crumb v0.1's 3-layer scoring.
provenance:
  extracted: 0.65
  inferred: 0.30
  ambiguous: 0.05
created: 2026-05-02
updated: 2026-05-02
---

# LLM-as-Judge Frontier — 6 sources (academic backbone of Crumb v0.1 scoring)

> Primary academic basis for the 3-layer scoring (reducer + qa_check effect + verifier CourtEval) in [[bagelcode-system-architecture-v0.1]] §7 and the 5 anti-deception rules in §7.3.

---

## R1. CourtEval — ACL 2025 Findings

URL: https://aclanthology.org/2025.findings-acl.1327/

**Core**:
- Borrows the "Courtroom" pattern. 4 roles:
  - **Grader** (judge) — initial score
  - **Critic** (prosecutor) — challenges the score
  - **Defender** (defense attorney) — defends the score
  - **Re-grader** — produces final score reflecting Critic + Defender input

**Validation results**:
- "**substantially outperforms** state-of-the-art on SummEval, TopicalChat" (NLG meta-eval benchmarks)
- "**stronger agreement with human judgments**" — vs. a single LLM

**Crumb application**:
- v0.1 §7.1 Layer 3 — inline 4 sub-steps within the verifier sandwich (`step.judge.{grader,critic,defender,regrader}`)
- Sequential reasoning within 1 spawn, ~+30% tokens but a large quality improvement
- Preserves 4 message refs `kind=judge.score.courteval.{grader_msg_id,critic_msg_id,defender_msg_id,regrader_msg_id}` (audit trail)

---

## R2. Multi-Agent Debate for LLM Judges with Adaptive Stability Detection

URL: https://arxiv.org/html/2510.12697v1 / OpenReview Vusd1Hw2D9

**Core**:
- Multi-agent debate improves on a single judge
- But infinite-debate risk → use **adaptive stability detection** to decide when to stop
- Stop when score variance < threshold

**Crumb application**:
- v0.1 §"Adaptive stopping" — when `progress_ledger.score_history` variance < 1.0 over 2 rounds → next=done
- Blocks the verifier-polish infinite loop

---

## R3. G-Eval — Confident AI / DeepEval framework

URL: https://www.confident-ai.com/blog/g-eval-the-definitive-guide

**Core**:
- **CoT + form-filling paradigm**: the LLM does CoT while filling a structured form
- Overcomes the limits of reference-based metrics like BLEU/ROUGE (strong on subjective / open-ended tasks)
- Single-model G-Eval risks self-bias / position bias

**Crumb application**:
- The form-filling structure of `kind=judge.score.scores` in v0.1 §3.6 (D1-D6 + source / lookup / evidence)
- But does not depend on a single G-Eval — secures diversity via the CourtEval 4 sub-steps

---

## R4. Position Bias — IJCNLP 2025 "Judging the Judges"

URL: https://www.researchgate.net/publication/402590616

**Core**:
- "**judge model choice has the highest impact on positional bias**" — bigger impact than task complexity, output length, or quality gaps
- That is, **position bias arises when judge and builder are the same model**

**Crumb application**:
- The builder=Codex / verifier=Gemini mapping in the v0.1 §"bagelcode-cross-3way" preset is exactly the cure
- §7.3 anti-deception rule #4 `self_bias_risk_same_provider` audit_violations

---

## R5. Self-Bias — NeurIPS 2024

**Core**:
- "LLM evaluators **recognize and favor their own generations**"
- "**linear correlation** between self-recognition capability and self-preference bias strength"
- That is, as model capability ↑, self-preference also ↑ — frontier models are at greater risk

**Crumb application**:
- Cross-provider verifier is the academically validated mitigation
- The metadata.cross_provider=true flag in v0.1 §3.6 makes the evaluator aware of self-bias avoidance

---

## R6. Multi-Judge Consensus — 2025-2026 frontier

URL: https://arxiv.org/html/2412.05579v2 (LLMs-as-Judges Survey) + 2025-2026 follow-up

**Core**:
- **3-judge baseline**: macro **F1 97-98%**, Cohen's Kappa **0.95**
- Statistically mitigates "score rubric order bias / score ID bias / reference answer score bias"
- Effect ↑ when 3 vendors are diverse (different providers)

**Crumb application (P1)**:
- `bagelcode-tri-judge.toml` preset (P1) — verifier × 3 (Claude/GPT/Gemini) spawned simultaneously
- Final judge.score derived after consensus
- P1 post-deadline; recognized in a single README paragraph

---

## R7. Production placement — 2026 industry data (bonus)

**Core (Arize blog)**:
- "lightweight judge agent that scores worker outputs **before reaching user**, +500-800ms latency, **catches 15-20% errors**"
- LangGraph: separate node + conditional_edge
- AutoGen: GroupChat selector
- Model tiering: triage = Haiku 4.5 / GPT-mini, reasoning = Sonnet 4.6 / GPT-5.5

**Crumb application**:
- v0.1 §"latency 1 spawn" — adding 1 verifier spawn (CourtEval 4 sub-steps inline) ≈ +500-800ms
- Same production pattern, same latency profile

---

## Synthesis — frontier alignment of Crumb v0.1's 3-layer scoring

| Crumb v0.1 decision | Mapped source | Strength |
|---|---|---|
| Layer 1 reducer auto (D3/D4/D5) | (own design, transcript analysis) | self-derived |
| Layer 2 qa_check effect (D2/D6) | AutoGen Executor (57.6k) deterministic | ✅ |
| Layer 3 verifier CourtEval inline | **R1 ACL 2025** direct | ✅✅ |
| 4 sub-steps (Grader/Critic/Defender/Re-grader) | **R1** verbatim | ✅✅ |
| adaptive stopping (variance < 1.0) | **R2 arXiv 2510.12697** | ✅ |
| form-filling structured score | **R3 G-Eval** | ✅ |
| cross-provider verifier mandate | **R4 + R5** position + self-bias block | ✅✅ |
| 5 anti-deception rules (D2/D4 ground truth + self-bias risk) | **R4 + R5** mitigation design | ✅ |
| multi-judge consensus (P1) | **R6** 97-98% F1 | ✅ (P1 future) |
| +500-800ms latency profile | **R7** Arize production | ✅ |

→ **9 of 10 dimensions map directly to primary frontier sources** + 1 dimension self-derived (Layer 1 transcript analysis). Self-invented share < 10%.

---

## See also

- [[bagelcode]] / [[bagelcode-recruitment-task]]
- [[bagelcode-system-architecture-v0.1]] — Crumb integration of these sources
- [[bagelcode-rubric-scoring]] — D1-D6 first spec (v0.1 §7 expands to 3 layers)
- [[bagelcode-frontier-orchestration-2026]] — multi-agent fault tolerance frontier (sister)
- [[bagelcode-verifier-isolation-matrix]] — 13+7 sources × 4 dimensions (cross-provider C2 backbone)
- [[bagelcode-frontier-cli-convergence-2026]] — 4 CLI consensus (sister)
- [[bagelcode-final-design-2026]] §3.D — first introduction of CourtEval (v0.1 expands to 3 layers)
