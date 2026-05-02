---
title: Bagelcode task — Caching strategy (3-tier, quality-preserving)
category: concepts
tags: [bagelcode, caching, prompt-cache, plan-cache, hierarchical-cache, anthropic, gemini, codex, tokens, cost, quality-preserving]
sources:
  - "[[bagelcode-transcripts-schema]]"
  - "[[bagelcode-tradingagents-paper]]"
  - "[[bagelcode-caching-frontier-2026]]"
  - "[[geode-prompt-system]]"
  - "[[geode-adaptive-thinking]]"
created: 2026-05-01
updated: 2026-05-01
---

# Caching strategy — 3-tier (quality-preserving)

> ⚠️ **2026-05-02 supersession**: the §"Google Gemini 2.5 (Verifier provider)" section + Verifier-sandwich application examples below are v1-v2 era. **From v0.1 onward the external Gemini Verifier was retired and CourtEval (Claude Sonnet 4.6) absorbed verification.** Anthropic ephemeral cache (Tier 1) + sandwich §1-§3 byte-identical (Tier 2) **remain valid** — Codex's caching roadmap and OpenAI's automatic caching are unchanged. The Gemini CachedContent paragraph is historical reference. Final lock = [[bagelcode-final-design-2026]].

> The #1 cause of token explosion in multi-agent systems is **broadcasting all context to every agent**. The fix is (a) prompt cache for the unchanging portion + (b) transcript pull-only access. This page decides **what to cache where**.
>
> **Quality constraint (user)**: caching must not degrade answer quality. → 3-tier classification ([[bagelcode-caching-frontier-2026]]):
> - **Tier 1** Provider-native prompt cache (lossless, byte-identical) ✅
> - **Tier 2** Application-level (Plan / Hierarchical / Anchored) — **verification hook required** ✅
> - **Tier 3** Semantic / KV reuse — not adopted (quality risk)

## Six core principles

1. **The static-vs-dynamic boundary is the cache boundary** — sandwich §1+§2 = static, transcript = dynamic.
2. **Anthropic prompt cache comes first** — sandwich = **TTL 1h** (1 session ≫ 5 min); transcript prefix = **TTL 5m**.
3. **Transcripts are queried, not broadcast** — do NOT pin every message into the system prompt.
4. **Each agent gets its own context envelope** — Planner does not need Builder's full history.
5. **Sandwich §1-§3 byte-identical for the actor-shared portion** — KVCOMM insight.
6. **Every Tier 2 cache hit must still pass Verifier review** — quality drop ε.

## Sandwich vs transcript boundary (recap)

[[kiki-appmaker-orchestration]] sandwich 4 sections:

```
§1 Engineering-team contract  ─┐
§2 Stage template              ├─ STATIC  → ephemeral-cache target (changes 0–1× per session)
§3 Tool/skill footer           ─┘
§4 Routing enforcement         ─┐
                               ├─ STATIC  → cache
[[Tool definitions]]            ─┘

[[Transcript context]]         ─── DYNAMIC → no cache (or only a short prefix)
```

→ **System prompt = STATIC 4-section + short message context.** We re-send it every turn but pay only the 1/10 read price thanks to the cache hit.

## Per-provider cache mechanics

### Anthropic Claude (top priority) — exact 2026-05 numbers

Based on official docs ([[bagelcode-caching-frontier-2026]] §1A):

| Item | Value |
|---|---|
| Mechanism | `cache_control: { type: "ephemeral", ttl?: "5m"\|"1h" }` marker |
| **Min prefix** | Opus 4.7/4.6/4.5 = **4,096** / Haiku 4.5 = **4,096** / Sonnet 4.6 = **2,048** / Sonnet 4.5 and below = **1,024** |
| **TTL** | **5 min (default)** / **1 hour (option)** |
| Price (5m) | write **1.25×** / read **0.1×** |
| Price (1h) | write **2.0×** / read **0.1×** |
| Breakpoints | **max 4** |
| TTL ordering | 1h entries must precede 5m entries (longer TTL first) |

**Our application (revised):**
- End of sandwich §1+§2+§3+§4 = **TTL "1h"** (1 session lasts 5–30 min, the 1h cache yields the larger saving).
- End of transcript stable prefix (goal + initial spec) = **TTL "5m"**.
- Order: sandwich(1h) precedes transcript(5m) (mandatory rule).
- **Min prefix satisfied** (sandwich §1-§4 ≈ 3K → below Opus 4.7's 4,096 → extend up through tool definitions).

**Measurement (`response.usage`):**
```python
total = response.usage.cache_read_input_tokens \
      + response.usage.cache_creation_input_tokens \
      + response.usage.input_tokens
hit_ratio = response.usage.cache_read_input_tokens / total
```

→ Stored directly into our transcript's `cache_read` / `cache_write` fields.

### OpenAI Codex / GPT-5.5

| Item | Value |
|---|---|
| Mechanism | **Automatic prompt caching** (no code change; auto-fires on prefix match) |
| Min prefix | **1,024 tokens** |
| TTL | Automatic / **up to 24h** (extended retention) |
| Price (default) | read **0.5×** input (50% off) |
| Price (GPT-5/5.5) | read **0.1×** input (90% off — only the cached portion) |

**Best practice (verbatim):** "Place static content like instructions and examples at the beginning of your prompt, and put variable content, such as user-specific information, at the end."

**Application:** Place the sandwich at the very beginning of the system prompt for automatic caching; no marker required. When Codex Builder.B re-invokes with the same sandwich it gets 50–90% off automatically.

### Google Gemini 2.5 (Verifier provider)

| Item | Value |
|---|---|
| Mechanism | **Context Caching API** (CachedContent objects) |
| Min tokens | **2,048** (Gemini API) — some Vertex docs say 32,768 |
| TTL | Explicit (default 1h, can be unbounded) |
| Price (read) | **0.1×** base input (90% off) |
| Storage | $4.50 / MTok / hour (Pro), prorated hourly |

**Vertex AI policy (verbatim):** "you pay a one-time fee for initial caching... subsequently each time you use cached content you are billed at a 90% discount compared to standard input tokens for Gemini 2.5 or later models"

**Application:** Verifier sandwich (§1-§4) + tool definitions ≈ 3K → satisfies the 2,048 minimum. Within one session, 5–10 read turns make storage cost < write savings. **However, when the sandwich changes the cache invalidates and re-creation cost applies** ([[bagelcode-fault-tolerance-design]] F2 capability probe handles automatic re-creation).

## Per-agent token budget (BC = best case, WC = worst case)

Assumptions:
- Sandwich 4 sections ≈ 3,000 tokens
- Transcript context window per turn ≈ 5 recent messages ≈ 2,000 tokens
- Spec ≈ 800 tokens
- Build artifact summary ≈ 1,200 tokens

| Agent | tokens_in per turn | After cache hit (effective) | 1 session WC (10 turns) |
|---|---|---|---|
| Coordinator (Haiku) | 3,000 + 500 = 3,500 | 300 + 500 = 800 | ~8K |
| Planner (Opus) | 3,000 + 2,000 = 5,000 | 300 + 2,000 = 2,300 | ~25K |
| Builder (GPT-5.5) | 3,000 + 3,000 = 6,000 | 1,500 + 3,000 = 4,500 (auto 0.5×) | ~45K |
| Critic (Gemini-pro) | 3,000 + 2,500 = 5,500 | (cache assumed not applied) ~5,500 | ~55K |

**Estimated session total (with cache):** ~130K input + ~30K output ≈ **$0.5–1.5 / session** (depends on model mix).

## Per-tier saving techniques (priority order)

### Tier 1 — Provider-native (lossless, P0 mandatory)

#### T1.1 Sandwich prompt cache
- Anthropic: end of §1-§4 + `cache_control: {type: "ephemeral", ttl: "1h"}` → **read 0.1×**
- Codex: keep the prefix stable → automatic **50–90% off**
- Gemini: explicit CachedContent creation → **read 0.1×** + hourly storage
- Measurement: `cache_read` / `cache_write` automatic in the transcript

#### T1.2 Transcript pull (no broadcast)
- Coordinator filters by `kind` when forwarding to the next agent.
- For Builder: only `kind in {goal, spec, spec.update}`. Excludes `debate`, `note`.
- Average **60% context saving** ([[hub-spoke-pattern]] spoke-narrow context).

#### T1.3 Artifact references (lazy load)
- Code bodies are NEVER pinned to the system prompt — only the `artifacts/<file>` path.
- The agent lazy-loads via the read tool when needed.
- Aligned with Anthropic's blog: "Subagent output to a filesystem to minimize the 'game of telephone'."

#### T1.4 Quick/Deep model split (TradingAgents §4.3)
- Coordinator routing = **Haiku 4.5** (10× cheaper).
- Planner / Critic reasoning = **Opus 4.7** / Gemini 2.5 Pro.
- Builder code = **GPT-5.5** (Codex).
- Routing through Opus would cause a 3–5× session cost explosion.

### Tier 2 — Application-level (with verification hook, P1 recommended)

#### T2.1 Plan Cache — APC NeurIPS 2025 ([[bagelcode-caching-frontier-2026]] §2A)
- Extract Planner spec output as a **per-topic plan template** → `plans/<topic-hash>.md`.
- When a new goal's keywords match, a **lightweight Haiku** adapts it.
- Expected: on cache hit, Planner Opus calls -50% / latency -27%.
- **Quality hook**: Verifier always reviews the new output → automatic invalidation when a cached plan is wrong.

```jsonc
// example: plans/rest-api-todo.md
{
  "template_id": "rest-api-todo-v1",
  "keywords": ["rest", "api", "todo", "crud"],
  "plan_skeleton": {
    "ac": ["{verb} /{resource}", ...],
    "questions": ["DB type?", "auth?"]
  }
}
```

#### T2.2 Hierarchical Workflow Cache (MDPI 2025)
- **Workflow level**: spec hash → build artifact ULID mapping (same spec → same result).
- **Tool level**: artifact sha256 → lint/pytest result (Verifier calls = 0).
- Dependency-aware invalidation: when spec is edited, descendant artifacts auto-invalidate.
- TTL: workflow 1h / tool 24h.
- Expected: at 50% hit rate, Verifier calls -40%.

#### T2.3 Anchored Iterative Summarization (Factory.ai)
- For long sessions (turn 15+), automatically append a **structured summary entry**:
  ```
  ## Summary (anchored)
  - intent: "REST API for todos"
  - file modifications: app.py (3 turns ago)
  - decisions: in-memory store, no auth
  - next steps: pending verification
  ```
- Old messages stay in the transcript; the system context only includes the anchored summary.
- Expected: peak token **-26~54%** (ACON result).
- Risk mitigation: the raw transcript stays readable.

### Tier 3 — Not adopted (quality risk)

| Candidate | Decision | Reason |
|---|---|---|
| Semantic cache (embedding similarity) | ❌ | Threshold trap: correct/incorrect-hit distributions overlap (vCache paper). |
| Naive KV cache reuse | ❌ | Risk of mutating judge results (arXiv 2601.08343) — cross-provider already sidesteps it. |
| Whole-context LLM-as-summarizer compression | ❌ | 65% of enterprise-AI failures are context drift (we adopt anchored only). |
| RAG / vector DB | ❌ | Out of scope for the task; depends on infra. |

## Cache breakpoint placement

Reading the system prompt in token order:

```
[1] sandwich §1 contract        ←  just before cache breakpoint 1 (cumulative ~1.5K)
[2] sandwich §2 stage template  ←  ★ cache breakpoint 1 (cumulative ~2.5K)
[3] sandwich §3 tools/skills    ←  ★ cache breakpoint 2 (cumulative ~3K) — tool definitions change rarely
[4] sandwich §4 enforcement     ←  rolls into [3]
[5] short transcript prefix     ←  ★ cache breakpoint 3 (optional) — when goal + initial spec are stable
[6] recent messages (rolling)   ←  no cache
```

→ Within Anthropic's 4-breakpoint limit. Even agents with different tool sets (Builder / Critic) can share §1+§2.

## Live measurement hook (auto-recorded into the transcript)

Using the `Message` fields from [[bagelcode-transcripts-schema]]:

```jsonc
{
  // ...
  "tokens_in": 5230,
  "tokens_out": 412,
  "cache_read": 4800,    // ← Anthropic ≈ 92% of input (sandwich cache hit)
  "cache_write": 0,      // ← only first turn, ~3000
  "latency_ms": 1840,
  "cost_usd": 0.0124
}
```

→ End-of-session aggregation via `jq`:
```bash
jq -s 'map(.cost_usd//0)|add' transcript.jsonl  # total cost
jq -s '[.[]|.cache_read//0]|add / [.[]|.tokens_in//0]|add' transcript.jsonl  # cache hit ratio
```

→ **The rubric's "token efficiency" dimension data is captured automatically** ([[bagelcode-rubric-scoring]] §"token dimension").

## Cache invalidation incident scenarios

| Incident | Outcome |
|---|---|
| 5 min idle followed by another turn | TTL expires → cache miss → write cost again at 1.25×. |
| Single-character edit to sandwich §1 | All ephemeral keys invalidate → cache miss for every agent. |
| Inserting a message inside the transcript stable prefix | Breakpoint 3 invalidates → savings disappear. |
| Different tool sets per agent | Breakpoint 2 location differs → only §1 is shared. |

→ **Only §1+§2 is the safe shared-cache region.** From §3 onward, cache per-agent.

## Alignment with TradingAgents

The "each role queries only what it needs" point in [[bagelcode-tradingagents-paper]] is the same idea as caching in different vocabulary:
- The paper: "extract or query the necessary information"
- Us: "transcript pull-only + kind filter"

→ **The transcripts schema is our version of TradingAgents §4.1 protocol.**

## Non-applied (excluded by decision)

| Candidate | Not adopted | Reason |
|---|---|---|
| RAG / vector search | ✗ | Out of task scope; transcript pull is sufficient. |
| Dedicated cache middleware (Redis etc.) | ✗ | Infra dependency; risks README-time operability. |
| Gemini Context Caching API special-case path | ✗ | Hard to satisfy the 4K minimum + per-provider branching bloats the code. |
| Direct KV cache management | ✗ | Breaks the LLM-provider abstraction. |

## Measurement targets (declared in the README at submission time)

### Baseline (no caching, hypothetical)
- Total input: ~150K
- Cost: $1.50 / session
- Wall-clock: 2:30
- Quality: 24/25 (D1-D5)

### Target (Tier 1+2 applied)
```
Per-session average:
  - Total input tokens: ~130K
  - Anthropic cache_read ratio: ≥70%
  - Codex auto cache hit: ≥50%
  - Plan cache hit ratio (P1): ≥30% (after 3+ consecutive sessions)
  - Hierarchical tool cache hit (P1): ≥40% (when artifacts stabilize)
  - Total cost: $0.50–1.00 / session  (-37% vs baseline)
  - Wall-clock: 1:45–2:00 (-25% vs baseline)
  - Quality: 24/25 → unchanged (when the verification hook passes)
```

→ This is the denominator of "token investment vs effective output." (Combined with the numerator from [[bagelcode-rubric-scoring]] for the efficiency metric.)
→ The path from baseline → target is the data behind the README's "Cache strategy" section.

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-caching-frontier-2026]] — **3-tier source survey, 12 entries** (provider docs + APC + Hierarchical + KVCOMM + ACON + cautionary)
- [[bagelcode-transcripts-schema]] — the schema where the cache boundary surfaces
- [[bagelcode-rubric-scoring]] — token-efficiency dimension measurement
- [[bagelcode-tradingagents-paper]] §4.3 quick/deep split
- [[bagelcode-fault-tolerance-design]] — F2 capability probe = cache-key invalidation
- [[bagelcode-agents-fixed]] — per-provider cache behavior
- [[geode-prompt-system]] / [[geode-adaptive-thinking]] — Anthropic cache + thinking-effort patterns
