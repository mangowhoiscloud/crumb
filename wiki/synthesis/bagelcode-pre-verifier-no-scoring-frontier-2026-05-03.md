---
title: Pre-verifier scoring? No — qa_check IS the ratchet
date: 2026-05-03
session: 01KQNEYQT53P5JFGD0944NBZ9D
status: synthesis
related:
  - bagelcode-scoring-ratchet-frontier-2026-05-02.md
  - bagelcode-frontier-orchestration-2026.md
  - bagelcode-llm-judge-frontier-2026.md
  - bagelcode-no-pass-n-decision-2026-05-03.md
  - bagelcode-caching-strategy.md
  - bagelcode-caching-frontier-2026.md
tags: [scoring, ratchet, verifier, qa-check, frontier-2026, deterministic-gate, prompt-cache]
---

# Pre-verifier scoring? No — `qa_check` IS the ratchet

> The Bagelcode hiring panel will likely ask: *"Crumb's verifier (CourtEval) is invoked only once at the final stage of the artifact. Why is there no LLM scoring on the planner spec or builder intermediate output?"* — this page is the answer. **The current pattern is not an omission, it is frontier-aligned.** Reasons: the `qa_check` effect already plays the role of a deterministic ratchet right after the builder, and adding an LLM judge on top would regress into the very anti-patterns the 2025-26 frontier has been consistently retreating from (PRM saturation, Self-Refine drift, multi-agent debate over-orchestration).

## Conclusion (TL;DR)

| Stage | Evaluation mechanism | Type | Frontier-aligned |
|---|---|---|---|
| **planner-lead → spec.md** | schema validation + AC predicate compile-check (deterministic only) | deterministic | ✓ |
| **researcher → step.research** | evidence_refs auto-validation (anti-deception Rule 5) | deterministic | ✓ |
| **planner-lead → step.design** | **eligible deterministic gate** (palette ⊂ named retro palette / touch hit zone WCAG 2.5.5 AAA = 44×44 / motion timing within evidence_ref deviation) — see §"LLM-judge gate ≠ deterministic gate" below | deterministic | ✓ |
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

## LLM-judge gate ≠ deterministic gate (2026-05-03 distinction)

A clarification added after the post-merge token-quality audit and the
follow-up frontier survey on "step-gate-with-cached-retry":

> **The rejection on this page is specifically about *LLM-judge per-step
> gates*, not about deterministic per-step gates.** The 2025-26 frontier is
> split into two camps. Camp A (outcome-only) and Camp B (per-step gate
> with cheap retry). Both camps reject *LLM-judge* per-step gates. Both
> camps accept *deterministic* per-step gates.

| Gate type | Frontier verdict | Crumb stance |
|---|---|---|
| **LLM-judge gate** per intermediate step (PRM, Self-Refine LLM-critique, CrewAI quality_score router) | **Reject** — DeepSeek-R1 PRM abandonment (Jan 2025), Cognition "Don't Build Multi-Agents" (Jun 2025), Eisenstein DeepMind 2024 round 4+ saturation, Huang ICLR 2024 / Stechly NeurIPS 2024 self-critique noise | Reject. CourtEval is the *only* LLM-judge in the pipeline (one round). |
| **Deterministic gate** per step (schema validate, exit code, structure check, AC predicate compile) | **Accept** — Cursor 2.0 typecheck-after-5-writes, DSPy `dspy.Suggest` rule-based assertion, OpenHands ReAct deterministic observation, Aider diff-format parser retry | Accept. `qa_check` after build is one such gate. **Eligible to add: `design_check` after step.design** (same pattern, different artifact: DESIGN.md instead of artifacts/game/). |

**Why this distinction was implicit before**: the original page was written
to deflect reviewer questions about why there is no LLM scoring on
spec/builder intermediates. It implicitly conflated "no scoring at all"
with "no LLM scoring", because the only scoring that *was* present
(`qa_check`) was discussed under its own heading. Reviewers and future
session agents reading the TL;DR table can mistake the "(none)" cell on
the planner-lead row as "no gate is allowed" rather than "no LLM gate is
allowed". This section makes the distinction load-bearing.

**What this enables**: deterministic gates on `step.design` (palette ⊂
named retro palette, touch hit zone ≥ W3C WCAG 2.5.5 Target Size
Enhanced AAA = 44×44 px, motion timing within evidence_ref measured
deviation) become a frontier-aligned addition rather than a regression.
See companion page on cheap retry via prompt caching.

**What it does not enable**: adding a *second* LLM judge anywhere
(e.g. an LLM scoring on planner spec output) remains rejected. The
4-grounds at the top of this page still apply to every LLM judge above
the one CourtEval round.

## Sandwich layout for cached retry (Anthropic numbers)

When a deterministic gate fails and the step is retried, the retry must
hit the prompt cache to be cheap. **Anthropic ephemeral prompt cache
official numbers** (`platform.claude.com/docs/en/build-with-claude/prompt-caching`):

| Item | Value |
|---|---|
| Breakpoints per request | **4** (max) |
| TTL | 5 min default / 1 hour option |
| Write multiplier | 5 min: **1.25×** / 1 hour: **2.0×** |
| Read multiplier | **0.1×** (90% off) |
| Min cacheable tokens | Opus 4.7/4.6/4.5: **4096** / Sonnet 4.6: **2048** / Sonnet 4.5: **1024** / Haiku 4.5: **4096** |
| Break-even on read count | 5m TTL: **0.28 reads** / 1h TTL: **1.11 reads** (i.e. 1 read on 5m TTL, 2 reads on 1h TTL = profitable) |
| Cacheable | tools / system / text messages / images / tool_use / tool_result |
| Not cacheable | thinking blocks (directly), sub-content (citations), empty text |

**Layout strategy** (4 breakpoints + 1 rolling tail):

```
[1] AGENTS.md (universal contract, byte-frozen)        ─★ bp1 (1h TTL, write 1.25× / read 0.1×)
[2] agents/<actor>.md (sandwich §1-§4, byte-frozen)    ─★ bp2 (1h TTL)
[3] inline skills/specialists + tool defs              ─★ bp3 (1h TTL)
[4] transcript stable prefix (goal + locked spec)      ─★ bp4 (5m TTL)
[5] retry feedback / latest event tail                  ── no cache (rolling)
```

**Byte-identical discipline** is load-bearing — known footguns:
- Claude Code [#43657](https://github.com/anthropics/claude-code/issues/43657) — `cc_version=…;cch=…;` dynamic header in prefix → cache miss
- Cline [#9892](https://github.com/cline/cline/discussions/9892) — system-reminder position drift → 90%+ prefix cache invalidated
- Hermes-agent [#13631](https://github.com/NousResearch/hermes-agent/issues/13631) — auto-injected context every N turns rebuilds system prompt → KV cache invalidated

Crumb implication: sandwich §1-§4 must be file-read verbatim, no string
interpolation of `${timestamp}` / `${session_id}` / `${cwd}` into the
cacheable prefix. CI test asserts SHA-256 equality across two
back-to-back same-actor spawns. Retry feedback goes to [5] rolling
tail only.

**Retry budget** (Eisenstein DeepMind 2024 round 4+ saturation):
verifier round 1 + retry round 2-3 = **cumulative cap of 3** before
escalating to user via `circuit_breaker` OPEN.

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

> Q: "Could you not add a quality gate after the design phase to catch bad palette / motion / layout decisions before builder commits?"
> A: Yes — but it must be a *deterministic* gate, not an LLM judge. Eligible: palette ⊂ named retro palette set (Lospec / PICO-8 / NES / GameBoy DMG); touch hit zones ≥ W3C WCAG 2.5.5 Target Size Enhanced AAA (44×44 px); motion timing within the deviation of researcher's evidence_ref measurement. See §"LLM-judge gate ≠ deterministic gate" — this is Camp B (Cursor 2.0 / DSPy `dspy.Suggest` pattern), still frontier-aligned.

> Q: "Why not retry every step on failure to push quality up?"
> A: Retries are bounded by Eisenstein DeepMind 2024 round 4+ saturation — verifier round 1 + retry rounds 2-3 = cumulative cap of 3. Beyond that, returns plateau. Crumb's `circuit_breaker` already encodes this: 3 consecutive failures → OPEN → user-surface.
