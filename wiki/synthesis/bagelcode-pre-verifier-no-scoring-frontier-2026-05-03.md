---
title: Pre-verifier scoring? No — qa_check IS the ratchet
date: 2026-05-03
session: 01KQNEYQT53P5JFGD0944NBZ9D
status: synthesis
related:
  - bagelcode-scoring-ratchet-frontier-2026-05-02.md
  - bagelcode-frontier-orchestration-2026.md
  - bagelcode-llm-judge-frontier-2026.md
tags: [scoring, ratchet, verifier, qa-check, frontier-2026]
---

# Pre-verifier scoring? No — `qa_check` IS the ratchet

> The Bagelcode hiring panel will likely ask: *"Crumb's verifier (CourtEval) is invoked only once at the final stage of the artifact. Why is there no LLM scoring on the planner spec or builder intermediate output?"* — this page is the answer. **The current pattern is not an omission, it is frontier-aligned.** Reasons: the `qa_check` effect already plays the role of a deterministic ratchet right after the builder, and adding an LLM judge on top would regress into the very anti-patterns the 2025-26 frontier has been consistently retreating from (PRM saturation, Self-Refine drift, multi-agent debate over-orchestration).

## Conclusion (TL;DR)

| Stage | Evaluation mechanism | Type | Frontier-aligned |
|---|---|---|---|
| **planner-lead → spec.md** | (none — schema validation only, reducer-auto later) | deterministic | ✓ |
| **researcher → step.research** | evidence_refs auto-validation (anti-deception Rule 5) | deterministic | ✓ |
| **builder → artifacts/game/** | **`qa_check` effect — htmlhint + Playwright + AC predicates** | deterministic | ✓ |
| **verifier → judge.score** | **CourtEval (Grader→Critic→Defender→Re-grader)** | LLM, **once only** | ✓ |
| **validator** | `validator/anti-deception.ts` internal Rules 1-7 | deterministic | ✓ |

`qa_check` effectively plays the role of a "post-build pre-verifier ratchet". **In other words, Crumb does not lack step-level scoring — it merely lacks LLM scoring**. In its place sits a deterministic exec gate (the pattern that Anthropic's Claude Code, OpenHands, Aider, and Cursor have all converged on).

## 5 frontier grounds

### 1. DeepSeek-R1 (Jan 2025) — abandoning PRM → returning to rule-based reward

The DeepSeek team tried *Process Reward Model* (PRM, i.e. step-level LLM scoring) during R1 training and reverted to **rule-based reward (exec exit code, format check)** due to reward saturation + game-the-judge problems. Applied here: putting an LLM micro-judge inside the builder hits the same trap. `wiki/synthesis/bagelcode-scoring-ratchet-frontier-2026-05-02.md` §4 / §5 #1.

### 2. Cognition AI "Don't Build Multi-Agents" (June 2025) + Eisenstein DeepMind 2024

Cognition's Devin team reduced multi-agent orchestration and returned to a single agent. Eisenstein 2024 demonstrates Goodhart-on-LLM-judge — **at judge round 4+, only the judge score rises while real quality plateaus**. Applied here: a separate LLM judge over the planner spec is over-orchestration. `wiki/references/bagelcode-frontier-orchestration-2026.md` §B.

### 3. CourtEval (Roy et al., ACL 2025) — assumes "applied once per artifact"

The CourtEval paper itself defines its 4-role (Grader/Critic/Defender/Re-grader) for **meta-evaluation of a final NLG artifact**. There is no step-level recommendation. Crumb invoking the verifier exactly once aligns with the paper's intent. `wiki/references/bagelcode-llm-judge-frontier-2026.md` R1.

### 4. Huang et al. ICLR 2024 / Stechly NeurIPS 2024 — LLMs cannot self-correct without an external verifier

LLM self-critique is noise without external signal. Putting an LLM micro-judge inside the builder is exactly the "self-critique without external signal" pattern. Crumb's `qa_check` is an external deterministic signal (htmlhint exit code, Playwright canvas-render detection) — it is meaningful. `wiki/synthesis/bagelcode-scoring-ratchet-frontier-2026-05-02.md` §8.

### 5. SWE-Bench Verified 2025 top-10 / OpenHands / Aider / Cursor / Claude Code

The industry SWE-style top-10 systems all use **a single outcome-level gate (test pass / exit code)**. No step-level LLM scoring. Crumb is isomorphic. `wiki/synthesis/bagelcode-scoring-ratchet-frontier-2026-05-02.md` §4 + ArtifactsBench (arXiv 2507.04952) per `wiki/findings/bagelcode-frontier-evidence-vs-llm-reasoning-2026-05-03.md`.

## What we *did not* do (and why)

### (a) LLM scoring on the planner spec — REJECT

The spec only contains deterministic items (AC predicates, envelope fields, video evidence schema). **Schema validation is sufficient**. Adding an LLM judge = the trap of grounds #1, #2.

### (b) Micro LLM judge right after build — REJECT

`qa_check` already occupies that slot. An additional LLM judge adds #4 (no external signal = noise) + doubles latency·cost on a 1h budget. CourtEval once = +500-800ms (`wiki/references/bagelcode-llm-judge-frontier-2026.md` R7) × N rounds.

## What we *did* — qa_check IS the pre-verifier ratchet

`src/effects/qa-check.ts` runs automatically right after build:

1. **htmlhint** (DOCTYPE / viewport / Phaser CDN script tag)
2. **Bundle size + file count** (multi-file envelope check, telemetry only since v0.4.0)
3. **Playwright headless smoke** (canvas render + first interaction)
4. **AC predicates** (per-AC deterministic predicate runner, `qa-interactive.ts`)
5. **PWA offline boot** (sw.js + setOffline + reload)

→ `kind=qa.result` (deterministic=true, source-of-truth for D2/D6).

**The verifier uses this result only as a D2/D6 lookup and never "re-evaluates" it via LLM** — anti-deception Rule 1 forces D2=0 to sanitize cases where verdict=PASS but `qa.result.exec_exit_code != 0`. In other words, the LLM cannot bypass the deterministic ratchet — it is firewalled in code.

## What we could not find (limitations)

- **Lightman 2024 PRM800K / Cobbe 2023 ORM** original-paper verbatim citations are missing — secured only through DeepSeek-R1's transitive citation.
- **Step-level scoring in TradingAgents** — its explicit absence/presence is inferred from `wiki/references/bagelcode-tradingagents-paper.md` §4.2, where only portfolio return is identified as the scoring framework.
- **Step-level scoring patterns in AutoGen v0.4 / LangGraph supervisor / CrewAI hierarchical** — secured the deterministic-gate recommendation for AutoGen v0.4 and LangGraph 0.3; CrewAI was not fetched in this investigation.

## Evaluator Q&A cheat sheet

> Q: "Why is there no LLM scoring on the spec?"
> A: Schema validation is sufficient + DeepSeek-R1's Jan 2025 PRM-abandonment precedent.

> Q: "Why is there no evaluation on builder intermediates?"
> A: There is — the `qa_check` effect (deterministic). The fact that it is not an LLM judge is intentional. Huang ICLR 2024 / Stechly NeurIPS 2024 (self-critique without external signal = noise).

> Q: "Is one verifier round enough?"
> A: CourtEval (ACL 2025) itself assumes one application per artifact. At round 4+, judge saturation kicks in (Eisenstein DeepMind 2024).

> Q: "Then how do you catch a broken build?"
> A: `qa_check` catches it immediately — if exec_exit_code=1, the verifier's judge.score is forced to verdict=FAIL (anti-deception Rule 1). Additionally, after 3 consecutive builder failures, the circuit_breaker swaps to builder-fallback.
