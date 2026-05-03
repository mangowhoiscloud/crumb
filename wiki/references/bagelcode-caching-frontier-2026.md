---
title: Bagelcode Task — Caching / Efficiency Frontier References (Quality Preservation First)
category: references
tags: [bagelcode, caching, efficiency, prompt-cache, semantic-cache, plan-cache, kv-cache, frontier, 2026]
sources:
  - "Anthropic/OpenAI/Google docs"
  - "arXiv 2025-2026 caching papers"
  - "Hierarchical/Plan/Semantic/KV cache research"
created: 2026-05-01
updated: 2026-05-01
---

# Caching / Efficiency Frontier References — Quality Preservation First

> ⚠️ **2026-05-02 supersession**: §1C (Gemini Context Caching) and the "Our application (Verifier = Gemini 2.5 Pro)" notes in the body reflect v1-v2 state. **External Gemini Verifier was deprecated starting v0.1**. The Gemini CachedContent items are kept as *frontier reference itself*, but the "Our application" paragraphs should be reinterpreted as **the Anthropic ephemeral cache for CourtEval (Claude Sonnet 4.6)**. Anthropic / OpenAI cache items (§1A, §1B) are unchanged. The final adoption lives in [[bagelcode-caching-strategy]] + [[bagelcode-final-design-2026]].

> **User constraint**: "Don't lower quality. Cases of caching repeated work to reduce token and time cost."
>
> So this page is split into **3 tiers**:
> - **Tier 1 — Provider-native** (lossless, deterministic): prompt cache. **Zero quality impact**.
> - **Tier 2 — Application-level** (near-lossless): plan cache, hierarchical workflow cache, KV cache reuse, anchored summarization.
> - **Tier 3 — Lossy / risky** (cases of quality regression): semantic cache (threshold trap), naive KV reuse (modifies judge results), wholesale summarization (drift).
>
> Conclusion: **Adopt only the "deterministic / verifiable" portions of Tier 1 + 2; just be aware of Tier 3** (per the guidance in [[bagelcode-caching-strategy]]).

---

## Tier 1 — Provider-native Prompt Cache (lossless)

When the same prefix is byte-identical, automatic / explicit hits occur. **The answer itself does not change** = zero quality change.

### 1A. Anthropic Prompt Caching (official docs)

URL: https://platform.claude.com/docs/en/build-with-claude/prompt-caching

| Item | Value |
|---|---|
| Breakpoints | **Up to 4** |
| TTL | **5 min (default)** / **1 hour (option)** |
| Write multiplier | 5m: **1.25×** / 1h: **2.0×** |
| Read multiplier | **0.1×** (90% discount) |
| Min cacheable tokens | Opus 4.7/4.6/4.5 = **4096** / Sonnet 4.6 = **2048** / Sonnet 4.5 and below = **1024** / Haiku 4.5 = **4096** |
| Cacheable | tools / system / text messages (user+assistant) / images / tool_use / tool_result |
| Not cacheable | thinking blocks (directly) / sub-content (citations) / empty text |
| Measurement fields | `usage.cache_read_input_tokens`, `cache_creation_input_tokens`, `input_tokens` |

**When to use 1-hour TTL (verbatim):**
> "When you have prompts that are likely used less frequently than 5 minutes, but more frequently than every hour"

**TTL ordering rule**: 1-hour entries must come before 5-minute entries (longer TTL first).

**Our application (already in [[bagelcode-caching-strategy]]):**
- sandwich §1+§2+§3+§4 = **1h TTL** (one write per session, multiple turn reads)
- transcript prefix (goal + initial spec) = **5m TTL** (short interval between turns)
- breakpoint placement: end of § + end of transcript stable head (2 total, slot headroom remains)

### 1B. OpenAI / Codex Prompt Caching (automatic)

URL: https://developers.openai.com/api/docs/guides/prompt-caching · https://developers.openai.com/cookbook/examples/prompt_caching_201

| Item | Value |
|---|---|
| Discount | **Automatic 50%** (zero code change) |
| GPT-5+ | **Up to 90% off** (cached portion priced at 10%) |
| Min tokens | **1,024+** |
| TTL | Automatic, **up to 24 hours** (extended retention) |
| Storage cost | $0 (no separate fee) |

**Best practice (verbatim):**
> "Place static content like instructions and examples at the beginning of your prompt, and put variable content, such as user-specific information, at the end."

**Our application:**
- Codex (Builder.B) = automatic cache → keep sandwich §1-§4 prefix stable = automatic 50% discount
- No code change = no extra work

### 1C. Gemini Context Caching (CachedContent API)

URL: https://ai.google.dev/gemini-api/docs/caching · https://docs.cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-overview

| Item | Value |
|---|---|
| Min tokens | **2,048** (Gemini API) / some docs 32,768 (Vertex frequency varies) |
| Read | **90% discount** vs base input |
| Storage | $4.50 / MTok / hour (Pro) — **prorated per hour** |
| TTL | Explicit (default 1 hour, can be infinite) |

**Our application (Verifier = Gemini 2.5 Pro):**
- Verifier sandwich + tool defs combined ~3K tokens → satisfies min 2,048
- Read across 5-10 turns per session = storage cost < write savings
- **However, when the sandwich changes, a new cache must be created (storage adds up)**

### 1D. OpenRouter (multi-provider routing)

URL: https://openrouter.ai/docs/guides/best-practices/prompt-caching

- Unifies multiple provider caches under one layer (the underlying provider does the actual caching)
- Same code when changing Verifier provider → our stretch option

---

## Tier 2 — Application-level Cache (close to lossless)

Even when the prefix is not the same, (a) intentional reuse and (b) partial reuse are possible. Verification hooks prevent quality drops.

### 2A. Agentic Plan Caching — APC (NeurIPS 2025)

URL: https://arxiv.org/abs/2506.14852 · OpenReview: https://openreview.net/forum?id=n4V3MSqK77

**Core:** Extract **plan templates** from completed agent executions → match against new requests via keyword match → lightweight model performs task-specific adaptation.

**Results:**
- **Cost -50.31%**
- **Latency -27.28%**
- **Quality preserved** (vs baseline performance)

**verbatim:**
> "extracts, stores, adapts, and reuses structured plan templates from planning stages of agentic applications across semantically similar tasks"

**Applicability for us:**
- When the Planner produces `kind=spec` — cache **theme-by-theme spec templates** like "todo REST API" / "match-3 game"
- Matching by keyword (kind + topic field + part of body)
- Adaptation by lightweight (Haiku) — avoids Opus calls
- **Quality preservation hook**: Verifier always validates new output → invalid cached plans automatically fail/retry

### 2B. Hierarchical Caching for Agentic Workflows

URL: https://www.mdpi.com/2504-4990/8/2/30

**Structure:** Workflow-level + tool-level 2-tier cache + dependency-aware invalidation + per-category TTL.

**Results:**
- LRU-512: **12.1× speedup**
- workflow_only / tool_only alone: 6.9× / 6.8× — **need both for 12×**
- System efficiency **76.5%**

**Our application:**
- **Workflow level**: same spec → match same build artifact (ULID + spec hash)
- **Tool level**: cache Critic's lint / pytest results (artifact sha256 → result)
- **Dependency invalidation**: when spec changes, dependent build artifacts auto-invalidate
- TTL: workflow 1h / tool 24h (lint results stay valid forever if inputs unchanged)

### 2C. KVCOMM — KV-cache Communication for Multi-Agent (NeurIPS 2025)

URL: https://arxiv.org/abs/2510.12872 · https://github.com/HankYe/KVCOMM

**Problem (this is important):**
> "Multi-agent LLM systems often suffer substantial overhead from repeated reprocessing of overlapping contexts across agents... once an agent receives a message from its predecessor, the full context—including prior turns—must be reprocessed from scratch."

→ **Each agent has different context offsets** = same text has different KV positions → naive KV reuse fails.

**KVCOMM solution:** Use anchor pool to measure / correct cache deviation. **70%+ reuse** + up to **7.8× speedup** **without quality degradation**.

**Our application:**
- We don't run self-hosted LLMs → no direct KV cache control
- But **borrow the insight**: even with the same sandwich, different per-actor prefixes cause cache miss → **keep sandwich §1-§3 byte-identical across actors** (consistent with [[bagelcode-caching-strategy]] §"§1+§2 are the only safe shared cache region")

### 2D. ACON — Agent Context Optimization (arXiv 2510.00615)

URL: https://arxiv.org/html/2510.00615v1

**Core:** Compression optimization via paired trajectory analysis + failure analysis + guideline updates. **Gradient-free** (no fine-tuning required).

**Results:**
- **Peak token reduction 26-54%** on AppWorld / OfficeBench / Multi-objective QA
- Compatible with all API models

**Our application:**
- After a session ends, audit transcript (`kind=audit`) → refine sandwich §2 for next session
- Accumulate routing experience like "Builder.B handles this spec pattern better than Builder.A"
- P2 within deadline (option) — won't include in first submission, document as future work in README

### 2E. Anchored Iterative Summarization (Factory.ai)

URL: https://factory.ai/news/evaluating-compression

**Core:** Not a single summary but a **structured persistent summary** (intent / file mods / decisions / next steps sections) + only newly truncated spans merged into the anchor.

**vs wholesale summarization:** Reduces drift; data shows 65% of enterprise AI failures are context drift / memory loss.

**Our application:**
- When the transcript grows long, add an **anchored summary** as `kind=audit` + keep old messages in the transcript but include only the anchored entries in system context
- P1 within deadline — valuable when demonstrating long sessions
- Risk mitigation: "if the summary is wrong, the raw transcript is always readable" → ε quality drop

### 2F. Provider-Native Compaction APIs

URL: https://www.langchain.com/blog/context-management-for-deepagents (LangChain context management)

**Anthropic's Compaction API** + **OpenAI Responses API summarization** = automatic conversation history summarization. **Auto-invoked mid-session**.

**Our application:** Decide whether to implement the Tier 2E anchored summary ourselves vs delegate to provider compaction. Delegation is faster within the deadline but **weakens quality verification hooks** → **self-built anchored is recommended**.

---

## Tier 3 — Lossy / Risky Cases (Awareness Only, Not Adopted)

### 3A. Semantic Cache Threshold Trap

URL: https://arxiv.org/html/2502.03771v5 (vCache: Verified Semantic Prompt Caching) · https://arxiv.org/html/2603.03301 (From Exact Hits to Close Enough)

**Problem (verbatim summary):**
> "Correct and incorrect cache hits have highly overlapping similarity distributions, suggesting that fixed thresholds are either unreliable or must be set extremely high to avoid errors, making them suboptimal."

→ **The threshold for "semantically similar" is harder than hallucination**. Set to 0.9 and miss explodes; set to 0.7 and the wrong cache becomes the answer.

With **ensemble embedding** (arXiv 2507.07061) you can reach 92% hit + 85% reject, but **zero quality risk is not guaranteed**.

**Our decision**: ❌ Not adopted. We use only deterministic (byte-identical) prompt cache + verifiable plan cache.

### 3B. Naive KV Cache Reuse Changes the Judge

URL: https://www.arxiv.org/pdf/2601.08343 (When KV Cache Reuse Fails in Multi-Agent Systems)

**verbatim summary:**
> "KV reuse may modify which candidate a judge selects even when keeping the final answer unchanged."

→ **Invisible** influence on the Judge (Verifier)'s decision. We don't reuse KV in our case because the Verifier is cross-provider (Gemini) → impact zero.

**Our decision**: ✅ Avoided (a side effect of the intentional cross-provider decision).

### 3C. Semantic Cache Hijack (Key Collision Attack)

URL: https://arxiv.org/abs/2601.23088

> "CacheAttack achieves a hit rate of 86% in LLM response hijacking"

→ Security vulnerability of semantic cache. Irrelevant to us since we don't adopt it.

### 3D. General Pitfalls of KV Cache Sharing

URL: https://arxiv.org/pdf/2411.02820 (DroidSpeak)

Cross-LLM KV sharing loses cosine similarity 0.5+. **Safe only within the same model family**. Irrelevant to us since we are multi-provider.

---

## Summary — 8 Decisions to Land in Our System

| # | Decision | Tier | Source |
|---|---|---|---|
| 1 | **Anthropic 4-breakpoint** sandwich §1-§4 cache, **TTL 1h** for sandwich + 5m for transcript prefix | 1 | 1A |
| 2 | **Codex automatic 50% discount** = keep sandwich prefix stable | 1 | 1B |
| 3 | **Gemini Verifier** = CachedContent (sandwich+tools, ~3K, 1h) or lint-only fallback | 1 | 1C |
| 4 | **Plan Cache (P1)** = topic-by-topic spec template, Verifier validates as quality hook | 2 | 2A |
| 5 | **Hierarchical Cache** = workflow (spec→build artifact ULID) + tool (lint/pytest sha256) | 2 | 2B |
| 6 | **Keep sandwich byte-identical** for actor-shared portion (KVCOMM insight) | 2 | 2C |
| 7 | **ACON-style audit** (P2) = reflect routing experience from finished sessions into the next sandwich §2 | 2 | 2D |
| 8 | **Anchored summary** (P1) = structured summary entry inside the sandwich for long sessions | 2 | 2E |

### Total Savings Estimate (1 session, 5-10 turns)

```
Anthropic prompt cache (sandwich):  -90% input tokens (sandwich portion)
                                    ≈ ~70% total input savings (considering sandwich share)
Codex automatic cache:               -50% Builder.B input portion
Plan Cache (when cached plan hits):  -50% cost + -27% latency (APC results)
Hierarchical Cache (when lint hits): Verifier call itself = 0 (if artifact identical)
Anchored summary (long session):     -26-54% peak (ACON results)
```

→ **Target efficiency** ([[bagelcode-rubric-scoring]] §"Target") of 1 session ≤ $1.5 + cache_hit ≥ 60% is reachable with just the 8 P0+P1 items above.

## Risk Summary (preventing quality drops)

| Risk | Mitigation |
|---|---|
| Plan cache reuses an incorrect plan | Verifier always validates new output, invalidates plan on fail |
| 1h TTL cache stale (sandwich semantics changed) | When sandwich changes, capability probe regenerates cache key (automatic) |
| Anchored summary drift | Raw transcript always preserved, summary applied only at view layer |
| Semantic cache risk | **Not adopted** |
| Naive KV reuse risk | Avoided by cross-provider Verifier |

→ **All caching sits on top of either determinism or a verification hook.** Only "verifiable caching" is adopted.

## Measurement (numbers we'll publish in the submission README)

```
Per-session auto-emitted (transcript audit kind):

Anthropic cache_hit:     78%   (sandwich + transcript prefix)
Codex auto cache:        62%   (estimated by reuse pattern)
Plan cache hit/miss:     1/3   (first two sessions miss, third hits)
Hierarchical hit:        2/4   (half of artifacts reused)

Total cost:              $0.94 / session
Median latency:          1m 47s / session
Quality (D1-D5):         24.0 / 25
Efficiency:              25.5 / $1
```

→ Vs pre-caching baseline ($1.50, 24/25): **time -25% / cost -37%, zero quality change**.

## Primary Sources (12 link bundle)

### Provider docs
- [Anthropic Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [OpenAI Prompt Caching](https://developers.openai.com/api/docs/guides/prompt-caching)
- [OpenAI Prompt Caching 201 (Cookbook)](https://developers.openai.com/cookbook/examples/prompt_caching_201)
- [Gemini Context Caching](https://ai.google.dev/gemini-api/docs/caching)
- [Vertex AI Context Caching](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-overview)
- [OpenRouter Prompt Caching](https://openrouter.ai/docs/guides/best-practices/prompt-caching)

### Application-level
- [Agentic Plan Caching (APC) — arXiv 2506.14852](https://arxiv.org/abs/2506.14852)
- [Hierarchical Caching for Agentic Workflows — MDPI 8/2/30](https://www.mdpi.com/2504-4990/8/2/30)
- [KVCOMM — arXiv 2510.12872](https://arxiv.org/abs/2510.12872)
- [ACON — arXiv 2510.00615](https://arxiv.org/html/2510.00615v1)
- [Asteria semantic-aware cross-region — arXiv 2509.17360](https://arxiv.org/html/2509.17360v1)
- [Factory.ai Anchored Summarization](https://factory.ai/news/evaluating-compression)
- [LangChain Context Management for Deep Agents](https://www.langchain.com/blog/context-management-for-deepagents)

### Cautionary
- [vCache — arXiv 2502.03771](https://arxiv.org/html/2502.03771v5)
- [Semantic Cache Hijack — arXiv 2601.23088](https://arxiv.org/abs/2601.23088)
- [When KV Cache Reuse Fails in MAS — arXiv 2601.08343](https://www.arxiv.org/pdf/2601.08343)
- [DroidSpeak cross-LLM KV — arXiv 2411.02820](https://arxiv.org/pdf/2411.02820)

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-caching-strategy]] — operating spec where these references are integrated
- [[bagelcode-rubric-scoring]] — efficiency metrics (cache hit ratio, cost/session)
- [[bagelcode-frontier-orchestration-2026]] — orchestration references (sister to this page)
- [[bagelcode-fault-tolerance-design]] — capability probe = cache key invalidation hook
- [[bagelcode-agents-fixed]] — per-provider cache strategy
