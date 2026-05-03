---
title: Verifier hard input isolation — judge-input bundle pattern
date: 2026-05-03
type: synthesis
tags: [verifier, llm-judge, context-isolation, anti-deception, frontier-2026, complex-eval-bench, preference-leakage, anthropic-bloom]
related:
  - bagelcode-same-provider-discount-2026-05-03
  - bagelcode-scoring-ratchet-frontier-2026-05-02
  - bagelcode-verifier-isolation-matrix
  - bagelcode-llm-judge-frontier-2026
---

# Verifier hard input isolation — judge-input bundle pattern

> **Question**: When the verifier evaluates, should it read the entire transcript.jsonl, or should it only see the minimal context needed for evaluation (spec / build / qa.result / artifacts / step.research.video)?
>
> **Conclusion**: **Isolate to a minimal context (hard isolation)**. The dispatcher prepares a `judge-input.jsonl` bundle right before spawning the verifier, and the sandwich enforces reading only that path. The previous prompt-only enforcement (writing "DOES NOT read agent.thought_summary" in the sandwich text) contradicts 2025-2026 frontier evidence — consistent with the Anthropic 2026 Hybrid Normalization claim that prompt mitigation only covers ~50%, **isolation is promoted to file-level enforcement**.

---

## 0. TL;DR

- **Before**: the verifier read nearly all events via `cat transcript.jsonl` or `crumb event tail` (after PR #69). The "DOES NOT read agent.thought_summary" line in AGENTS.md was prompt-only.
- **After**: the dispatcher auto-generates `agent-workspace/verifier/judge-input.jsonl` on every verifier spawn. **Includes**: latest `goal` / `spec` / `build` / `qa.result` / `artifact.created` / `step.research.video`. **Excludes**: `step.concept`, `step.design`, `step.research` synthesis (planner-internal reasoning), prior `judge.score` / `verify.result` (avoid anchor bias), `agent.thought_summary` (private CoT), `dispatch.spawn` / `note` (dispatcher meta).
- **env**: add `CRUMB_JUDGE_INPUT_PATH`, with the sandwich pointing at it. `CRUMB_TRANSCRIPT_PATH` is retained for emission only.
- **scope**: verifier actor only. Other actors continue to read the full transcript (spec_authoring is unaffected since prior research/concept is its input).
- **anti-deception**: lookups of `qa.result.exec_exit_code` against the full transcript are performed by the reducer/validator — independent of verifier subprocess isolation.

---

## 1. Problem — frontier-mismatch of prompt-only enforcement

### 1.1 Current behavior

The Reads column at `agents/verifier.md:32`:

> **Reads** | `kind=spec` (sealed) + `kind=build` + `kind=qa.result` (REQUIRED) + `artifacts/{game/, game.html, spec.md, DESIGN.md}` + `kind=step.research.video` (D5 evidence). **DOES NOT** read `kind=agent.thought_summary` from builder (private chain-of-thought)

PR #69's `crumb event tail` strips only visibility=private. But `step.concept` / `step.design` / `step.research` synthesis / prior `judge.score` are visibility=public, so they remain exposed to the verifier.

### 1.2 Frontier 2025-2026 evidence — "less context"

| Source | Key measurement |
|---|---|
| **ComplexEval Bench (EMNLP 2025 Findings §805)** | "Bias magnitude scales with task complexity. Auxiliary information / reference knowledge **biases LLM evaluation** ('curse of knowledge')." Explicitly recommends **less context**. |
| **Preference Leakage (Li et al. ICLR 2026, arXiv 2502.01534)** | When the judge sees reasoning produced by a generator from the same family/inheritance, **systematic score inflation** results. Undetectable by CoT inspection. |
| **Anthropic Bloom (alignment 2025)** | 4-stage (Understanding → Ideation → Rollout → **Judgment**) separation. The Judgment stage isolates prior reasoning. |
| **Anthropic Demystifying Evals (engineering 2026)** | "grade each dimension with an **isolated** LLM-as-judge rather than using one to grade all dimensions." |
| **Context Over Content (arXiv 2604.15224)** | The judge adjusts its verdict from contextual framing signals. Invisible in CoT. |
| **Anthropic Hybrid Normalization 2026** | "Prompt-only mitigation reaches **~50% effect reduction**; the residual is *your* responsibility." → recommends a hybrid 2-stage approach. |

### 1.3 Mapping — Crumb's gap

PR #69's visibility filter covers half of the prompt-mitigation frontier-50% (blocking private CoT). The remaining 50% must be closed with file-level isolation to complete frontier alignment.

Specific concerns:
- If the verifier reads `step.concept` → it absorbs planner framing like "this is a hard requirement" → leniency bias (Context Over Content arXiv 2604.15224)
- If the verifier reads prior `judge.score` (round 1, 2) → anchor bias (Tversky-Kahneman 1974, reproducible in LLM judges per Schoenegger NeurIPS 2024)
- If the verifier sees the reasoning of a same-provider builder → preference leakage effect (ICLR 2026)

---

## 2. Change specification

### 2.1 Bundle composition (whitelist)

Right before spawning the verifier, the dispatcher walks transcript.jsonl and copies only the following kinds into a fresh `judge-input.jsonl`:

```
goal                   1×  (always)
spec                   latest sealed
spec.update            latest if newer than spec
build                  latest
qa.result              latest paired with build
artifact.created       latest paired with build
step.research.video    all (mandatory citation as D5 evidence → Rule 5)
```

**Excluded (block list)**:

| Kind | Reason |
|---|---|
| `step.concept` | planner reasoning, framing bias |
| `step.design` | same |
| `step.research` (synthesis) | planner reasoning |
| `step.judge` × 4 (Grader/Critic/Defender/Re-grader) | sub-step from prior round, anchor bias |
| `judge.score` / `verify.result` | prior round verdict, anchor bias |
| `agent.thought_summary` | private CoT |
| `dispatch.spawn` / `note` | dispatcher meta |
| `agent.start` / `agent.stop` | turn boundary, irrelevant to evaluation |
| `handoff.requested` / `handoff.rollback` | routing meta |
| `user.intervene` / `user.approve` / `user.veto` | user hints leaking to the verifier would be framing |
| `audit` (validator-emitted) | avoid recursion |

### 2.2 Implementation site

Add a `buildVerifierInputBundle(transcriptPath, sessionDir): Promise<string>` helper in `src/dispatcher/live.ts`:
1. read transcript.jsonl line by line
2. allowed-kind filter + only the latest N (latest 1 for spec/build/qa.result/artifact.created, all for step.research.video)
3. write to `<sessionDir>/agent-workspace/verifier/judge-input.jsonl`
4. return the path

Invoke before the dispatcher spawn:
```ts
if (effect.actor === 'verifier') {
  const judgeInputPath = await buildVerifierInputBundle(deps.transcriptPath, deps.sessionDir);
  // env via SpawnRequest (next section)
}
```

### 2.3 env wiring

Add `judgeInputPath?: string` to `SpawnRequest`, with `buildAdapterEnv` propagating it as `CRUMB_JUDGE_INPUT_PATH`.

### 2.4 sandwich update

Update the Reads column in `agents/verifier.md`:

```
Reads | $CRUMB_JUDGE_INPUT_PATH (only — dispatcher-prepared minimal bundle).
       Direct cat / Read of transcript.jsonl is forbidden — the bundle is
       the canonical view. Bundle includes: goal, spec (latest), build,
       qa.result, artifact.created, step.research.video. Excludes:
       planner reasoning (step.concept/design/research), prior judge.score
       (anchor bias), agent.thought_summary, dispatch.spawn.
```

Narrow the Bash tool's read scope to `$CRUMB_JUDGE_INPUT_PATH` (note that `crumb event` emission continues to use `$CRUMB_TRANSCRIPT_PATH`).

### 2.5 No anti-deception impact

Rules 1/2 of `validator/anti-deception.ts` use `next.last_qa_result` (stashed by the reducer). The reducer reads the full transcript, so it is independent of verifier subprocess isolation. **The D2/D6 ground truth firewall continues to operate as is**.

Rule 5 (researcher_video_evidence_missing) keeps `step.research.video` in the bundle, so the verifier can cite normally.

### 2.6 Deterministic replay preserved

The bundle is a deterministic projection of the transcript (kind whitelist + latest-K filter). It is regenerated on each spawn and persisted on disk. Under `crumb replay`, the same transcript → the same bundle is regenerated.

---

## 3. Risk + handling

| Risk | Handling |
|---|---|
| **Is planner reasoning required for D1 spec_fit evaluation?** | No — the acceptance_criteria in spec.md is **itself** the binding spec. Planner reasoning is the derivation process, not the evaluation criterion. It actually induces anchor bias. |
| **Context sharing across CourtEval sub-steps (Grader/Critic/Defender/Re-grader)?** | Within a single verifier spawn, the 4 sub-steps share the same context — what is blocked is only **prior round** verifier output. |
| **Can the builder's audit_violations be cited?** | A validation result emitted explicitly by the builder is transcript meta, not the sandwich. Judging the evaluation-target artifact itself takes priority, so blocking is intentional. |
| **After a rebuild, how does the verifier learn the change?** | A fresh build / qa.result / artifact.created is generated on each spawn. Round-by-round comparison is performed by the reducer (score_history). |

---

## 4. Decision impact

| Item | Impact |
|---|---|
| `src/dispatcher/live.ts` | Add `buildVerifierInputBundle()` function, verifier spawn branch |
| `src/adapters/types.ts` | `judgeInputPath?: string` on SpawnRequest |
| `src/adapters/_shared.ts` | Propagate `CRUMB_JUDGE_INPUT_PATH` env |
| `agents/verifier.md` | Tighten Reads column, narrow Bash scope |
| studio | If a UI reads the bundle file (none currently) — no impact |
| anti-deception / reducer | No impact (uses the full transcript as is) |
| replay determinism | No impact (the bundle is a deterministic projection of the transcript) |

---

## 5. References

- **Li et al. ICLR 2026** (arXiv 2502.01534) — *Preference Leakage: A Contamination Problem in LLM-as-a-judge*. Same family/inheritance inflation, undetectable in CoT.
- **EMNLP 2025 Findings §805** (ComplexEval Bench) — 6 unexplored biases × 12 basic + 3 advanced scenarios. Explicitly recommends **less context**.
- **Anthropic 2025** (alignment.anthropic.com/2025/bloom-auto-evals) — Bloom 4-stage isolation. Claude Opus 4.1 vs human Spearman 0.86.
- **Anthropic Engineering 2026** (demystifying-evals-for-ai-agents) — recommends "grade each dimension with an isolated LLM-as-judge".
- **arXiv 2604.15224** — *Context Over Content: Exposing Evaluation Faking in Automated Judges*. Verdict-shifting effects of contextual framing.
- **Anthropic Hybrid Normalization 2026** — prompt-only mitigation covers 50%, the rest is the hybrid's responsibility.
- **Schoenegger NeurIPS 2024** — anchor bias in LLM judges (Tversky-Kahneman 1974 reproduction).

## 6. Cross-links

- ★ **[[bagelcode-system-architecture-v0.4]]** §6.1 — this page's bundle decision is promoted to file-level enforcement in the v0.4 dispatcher
- ★ **[[bagelcode-system-diagrams-v0.4]]** §4 — judge-input bundle projection Mermaid
- [[bagelcode-same-provider-discount-2026-05-03]] §2.2 — paired with the other half of Anthropic Hybrid 2-stage (numerical correction)
- [[bagelcode-scoring-ratchet-frontier-2026-05-02]] §3 — failure modes
- [[bagelcode-verifier-isolation-matrix]] row #2 — Anthropic "fresh context only" mapping
- [[bagelcode-llm-judge-frontier-2026]] R3-R5 — judge bias inventory
