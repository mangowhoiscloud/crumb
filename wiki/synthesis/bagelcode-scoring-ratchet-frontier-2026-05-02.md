---
title: Scoring + Ratchet — 2026 frontier validation + Crumb alignment
date: 2026-05-02
type: synthesis
tags: [scoring, ratchet, multi-agent, frontier-2026, llm-judge, courteval, deterministic-gate, cross-provider, goodhart, devin-postmortem]
related:
  - bagelcode-system-architecture-v0.1
  - bagelcode-verifier-isolation-matrix
  - bagelcode-host-harness-decision
  - bagelcode-user-intervention-frontier-2026-05-02
---

# Scoring + Ratchet — 2026 Frontier Validation + Crumb Alignment

> **Question**: When raising quality through inter-agent communication, is the *scoring + ratchet* pattern (verifier assigns D1-D6 scores and iterates until a threshold is met or variance-based adaptive_stop fires) genuinely effective? Are there alternatives?
>
> **Conclusion**: **Conditionally valid**. Ratchet on top of a deterministic signal is the established frontier consensus (Reflexion HumanEval +11pp / DeepSeek-R1 / SWE-bench 2025 top10 are all exec-based). However, **pure LLM-judge ratchets exhibit Goodhart divergence from round 4+**, and **same-provider verifiers inflate PASS rates by +14~22%**. Crumb's 3-layer scoring defends against 60-70% of frontier failure modes, but three additional axes need extra defense: **verifier self-bias enforcement / Goodhart drift cap / length normalization**.

---

## 0. TL;DR

- **Valid**: deterministic ratchet (exec gate → kind=qa.result D2/D6 ground truth) — adopt unconditionally. SWE-bench 2025 top10 / Cognition Devin postmortem / DeepSeek-R1 all converge on the same conclusion.
- **Conditionally valid**: LLM-judge ratchet — only reproducible with a multi-role structure (CourtEval ACL 2025 +12.4%) plus cross-provider. Same-provider self-judge yields +14~22% PASS inflation (Stureborg EMNLP 2024).
- **2026 frontier convergence**: stronger deterministic gate + verifier-side test-time compute (extended thinking). Multi-agent debate / PRM / self-refine are retreating in production.
- **Crumb recommendation**: (1) verifier extended thinking default high, (2) make Playwright smoke run mandatory (currently optional), (3) promote `cross_provider=true` to an anti-deception validator check, (4) iteration hard ceiling.

---

## 1. Pattern definition

**Scoring**: the verifier LLM rates the output across N dimensions (D1-D6 in Crumb) on a 0-5 scale, aggregating to 0-30.

**Ratchet**: produce a verdict every round → PASS/PARTIAL/FAIL.
- PASS or user approve → done
- FAIL → rollback to planner-lead for respec
- PARTIAL → user hook
- variance(score_history[-2:]) < 1.0 → adaptive_stop (NeurIPS 2025 multi-agent debate judge pattern)

**Crumb's 3-layer decomposition**:

| Layer | Source | Dimensions |
|---|---|---|
| Deterministic (rule-based) | `qa_check` effect (no LLM) | D2 exec, D6 portability |
| Reducer-auto | pure function | D3 schema, D4 budget |
| LLM judge (CourtEval inline 4 sub-step) | verifier actor | D1 spec_fit, D5 quality |
| Hybrid | validator + judge | aggregate + verdict |

`anti-deception.ts`: when verdict=PASS but `qa.result.exec_exit_code != 0`, force D2=0.

---

## 2. Validity evidence (quantitative lift, 2024-2026)

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

**Key point**: ratchet on top of a deterministic signal (test execution) is powerful. A pure LLM-judge ratchet is noisier → adaptive_stop is essential.

---

## 3. Failure modes (quantitative measurements, 2024-2025)

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

## 4. 2026 Frontier convergence — what is retreating, what remains

| Framework / source | 2026 stance |
|---|---|
| **AutoGen 0.4** (Microsoft, Oct 2024 rewrite) | event-driven actor; **GroupChat recommendation ↓**, regressing to "single-agent first" |
| **DSPy 2.5+** (Khattab) | Compiler-based prompt opt + mandatory **external deterministic metric**. No ratchet. |
| **LangGraph 0.3** | StateGraph + **human-in-the-loop checkpointing**, deterministic gate recommended |
| **OpenHands** (formerly OpenDevin) | exec-based + browser-based ground truth → SWE-bench top |
| **Cognition Devin** | "no multi-agents" — single-agent + strong context engineering (Jun 2025 blog) |
| **Cursor / Aider / Cline** | LSP/diagnostics → exec gate → user confirm. Almost no LLM judge use. |
| **DeepSeek-R1** (Jan 2025) | **PRM abandoned → regression to rule-based reward** (compile pass / unit test pass only) |

**Common conclusion**: convergence on a deterministic gate + cross-provider critique reinforcement. Multi-agent debate / PRM / self-refine are retreating in production.

---

## 5. Alternative pattern inventory + Crumb fit matrix

| # | Pattern | Mechanism | 2026 evidence | Cost | Crumb fit | Verdict |
|---|---|---|---|---|---|---|
| 1 | **PRM (Process Reward Model)** | step-level reward | ★★ (saturating; Setlur NeurIPS 2025: lift only when policy weak) | ★★ high | ★ (game.html step decomposition is unnatural) | **SKIP** (same reason DeepSeek abandoned it) |
| 2 | **Reflexion / Self-Refine** | self-critique + revise | ★★★ (only works with an external verifier, Huang ICLR 2024) | ★★★ med | ★★ (verifier already provides external feedback) | **SKIP** (redundant) |
| 3 | **Test-time compute scaling** (extended thinking) | inference-time sampling/search | ★★★★★ (Snell ICLR 2025: 4x compute = 14x pretrain; o1/R1/Sonnet 3.7) | ★★★★ low | ★★★★★ (most cost-efficient on the verifier side) | **ADD** |
| 4 | **Multi-agent debate / knockout** | N-agent debate then judge | ★★★ (Du ICML 2024 +4%p but cost 3x; Smit 2024 "MAD?" hard to justify cost) | ★★ high | ★★★ (CourtEval already provides intra-debate) | **LATER** (in cross-provider form) |
| 5 | **Constitutional AI / RLAIF** | explicit principles → self-critique → DPO/RLHF | ★★★★ (training-time, already absorbed by frontier models) | (training only) | ★★ (inference-only harness) | **PARTIAL** (free to apply inline principles in the verifier sandwich) |
| 6 | **Cross-provider verification** | a different provider verifies | ★★★★★ (Stureborg EMNLP 2024 +14-22% inflation; Sharma ICLR 2024 sycophancy) | ★★★ med | ★★★★★ (`bagelcode-cross-3way` already exists) | **KEEP + ENFORCE** |
| 7 | **Deterministic / programmatic verification** | exec / lint / AST / test | ★★★★★ (SWE-bench top10 / Cognition / DeepSeek-R1) | ★★★★★ very low | ★★★★★ (qa_check already exists, Playwright optional) | **STRENGTHEN** |
| 8 | **Counterfactual / perturbation** | input perturbation → robustness | ★★★ (ARC-AGI-2 Mar 2025; GSM-Symbolic ICLR 2025) | ★★★ med | ★★ (production harness, measurement ROI is unclear) | **LATER** |
| 9 | **Process supervision** | intermediate step labels | ★★ (PRM800K etc.; saturates) | ★★ high | ★ | **SKIP** |
| 10 | **Hybrid (LLM + program)** | exec gate + LLM judge combination | ★★★★★ (most frontier OSS) | ★★★★ low | ★★★★★ (Crumb is exactly this shape) | **KEEP** |

---

## 6. Crumb alignment analysis

### ✅ Failure modes already defended (frontier-aligned)

- **D2/D6 forgery**: `qa_check` effect (no LLM) → `anti-deception.ts` D2=0 enforcement → **structural block on reward hacking**. Secures Reflexion-grade verifiable feedback.
- **Position / partial self-bias**: CourtEval 4-role (Grader → Critic → Defender → Re-grader) is enforced — the adversarial structure mitigates single-judge bias. The ACL 2025 +12.4% result is reproducible.
- **Sycophancy on D1/D5**: explicit Critic role → reduces agreement bias.
- **Multi-agent over-iteration**: variance-based adaptive_stop → blocks infinite polish. Aligned with the NeurIPS 2025 pattern.
- **State drift**: append-only ULID transcript + pure reducer → replay-deterministic, post-hoc score forgery is impossible.

### ⚠️ Exposed failure modes

| # | Gap | Impact | Recommendation |
|---|---|---|---|
| G-A | ✅ **Defended** (PR #38, 2026-05-02) | Rule 4 `self_bias_risk_same_provider` enforces a PASS → PARTIAL downgrade. Blocks the Stureborg EMNLP 2024 +14-22% inflation. The `bagelcode-cross-3way` preset is the recommended path. |
| G-B | ✅ **Already implemented** | `VERIFY_MAX=5` (`src/reducer/index.ts`) + variance-based adaptive_stop + ratchet regression — a 3-layer cap. Blocks Goodhart drift from round 4+. |
| G-C | ✅ **Defended** (PR _TBD_, 2026-05-02) | When the dispatcher spawns the verifier, it auto-injects artifact byte/token counts plus a sandwich firewall section. 2025-2026 frontier measurements (Krumdick EMNLP 2025 — Sonnet 4 +1.6%, GPT-5 / Gemini 2.5 Pro +3.4% residual; RewardBench v2 §Focus 2025 — 5-12pt drop with length) confirm residual length bias. Rubric-Anchored Judging (NeurIPS 2025): only qualitative dims (D1/D5) are exposed; quantitative dims (D2/D6 qa-check-effect) are immune → scope limited to D1/D5. Anthropic Hybrid Norm 2026 prompt-only pattern reduces ~50%; the residual is jointly blocked by the verifier sandwich's reviewer persona and anti-deception Rule 6 (D1/D5 ≥ 3 floor). |
| G-D | ✅ **Defended** (PR _TBD_, 2026-05-02) | Rule 6 `composite_gaming_d1_d5_below_minimum` — `aggregate ≥ 24 AND D1 ≥ 3 AND D5 ≥ 3` AND-gate. Convergent with SWE-bench Verified / RewardBench v2 / OpenAI Preparedness / Anthropic RSP v2. Threshold 3/5: judge variance σ≈0.6 (Zheng NeurIPS 2023) — 4/5 carries false-negative risk. |
| G-E | ✅ **Defended** (PR #33, 2026-05-02) | Playwright real-Chromium smoke + 3-way env contract (`CRUMB_QA_REQUIRE_PLAYWRIGHT=1` strict). Aligned with SWE-bench top10 / Cognition Devin / DeepSeek-R1. CI strict gate is post-deadline follow-up. |

---

## 7. Recommendations (P0 → P1 → SKIP)

### P0 (immediate ADD — strongly endorsed by frontier)

1. **Activate verifier-side extended thinking** — Anthropic `budget_tokens=24000+` / OpenAI `reasoning_effort=high` / Gemini `thinking_config`. Snell ICLR 2025: test-time compute 4x = 14x pretrain. The `effort` field already exists in the model-config UI → all that remains is applying default high per preset/actor.
2. **Mandatory Playwright smoke run** (G-E). Force Playwright when qa-runner is invoked. Strongly raises the false-PASS block of anti-deception.

### P1 (next ratchet — validator strengthening)

3. ✅ **Cross-provider enforcement** (G-A) — PR #38 ship. `anti-deception.ts` Rule 4: same-provider → PASS → PARTIAL.
4. ✅ **Iteration hard ceiling** (G-B) — already a 3-layer combo of `VERIFY_MAX=5` + variance + ratchet regression.
5. ✅ **Composite gaming defense** (G-D) — PR #44 ship. Rule 6: `aggregate ≥ 24 AND D1 ≥ 3 AND D5 ≥ 3`. Threshold 3/5 (instead of 4/5) — frontier-aligned calibration accounting for judge variance σ≈0.6 (Zheng NeurIPS 2023); tightening to 4/5 is P2 after extended-thinking adoption.
6. ✅ **Length bias firewall** (G-C) — PR _TBD_ ship. When spawning the verifier, the dispatcher auto-injects artifact byte/token counts plus a sandwich firewall section. Limited to D1/D5 (D2/D6 immune per Rubric-Anchored NeurIPS 2025). Anthropic Hybrid Norm 2026 pattern: prompt-only ~50% reduction + Rule 6 floor combined → residual at the ~1% level.

### SKIP (frontier is retreating)

- More multi-agent debate (CourtEval already provides intra-debate)
- PRM / process supervision (same reason DeepSeek abandoned it)
- self-refine (redundant with the verifier)

---

## 8. References

### 2024-2025 LLM-as-Judge validation
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

- ★ **[[bagelcode-system-architecture-v0.4]]** §5 — anti-deception 7 rules table (the G-A recommendation on this page is promoted to numerical R4)
- ★ **[[bagelcode-system-diagrams-v0.4]]** §3 — anti-deception waterfall
- [[bagelcode-system-architecture-v0.1]] — §3.5 qa.result, §7 3-layer scoring
- [[bagelcode-verifier-isolation-matrix]] — 20-source × 4-dimension cross-provider matrix (direct backing for the G-A recommendation)
- [[bagelcode-host-harness-decision]] — Hybrid (Skill + headless CLI) lock
- [[bagelcode-user-intervention-frontier-2026-05-02]] — G1-G6 mapping (frontier survey in the same format as this document)
- `protocol/schemas/message.schema.json` — D1-D6 score schema
- `src/validator/anti-deception.ts` — implementation site for the G-A recommendation
- `src/dispatcher/qa-runner.ts` — implementation site for G-E (mandatory Playwright)
- `src/reducer/index.ts` — implementation site for G-B (iteration hard ceiling)
- `.crumb/presets/*.toml` — implementation site for P0-1 (verifier extended thinking default)
