---
title: Bagelcode Task — Orchestration Topology Decision (PDCA Rejected → Hierarchical Hybrid)
category: concepts
tags: [bagelcode, topology, orchestration, hierarchical, pdca-rejected, fault-tolerance]
sources:
  - "[[bagelcode-frontier-orchestration-2026]]"
  - "[[bagelcode-tradingagents-paper]]"
  - "[[hub-spoke-pattern]]"
created: 2026-05-01
updated: 2026-05-01
---

# Orchestration Topology — PDCA Rejected → Hierarchical Hybrid

> ⚠️ **2026-05-02 supersession**: In this page's topology diagram, the *Verifier = Gemini / GLM / local* notation is from v1-v2. **Starting with v0.1, the Verifier is absorbed as the 4 sub-roles of CourtEval inside the Engineering Lead** — it is no longer a separate actor. The Hub-Ledger-Spoke topology itself remains valid (3 outer actors: Coord + Planner Lead + Engineering Lead). Final lock = [[bagelcode-final-design-2026]].

> **Decision in one line**: Reject the linear PDCA chain. Combine Anthropic's orchestrator-worker + Magentic-One's ledger + Cognition's single transcript + ICML 2025's hierarchical resilience into a **Hub-Ledger-Spoke** topology.

## Why we are rejecting PDCA (3 facts)

### 1. Per-topology fault degradation (ICML 2025)
[[bagelcode-frontier-orchestration-2026]] §F (Resilience of Faulty MAS):

| Structure | Performance drop with 1 faulty agent | Mapping to our concept |
|---|---|---|
| **Hierarchical** A→(B↔C) | **5.5%** | ✅ Adopted |
| Linear chain | 10.5% | ❌ This is what PDCA is |
| Flat peer | 23.7% | ❌ |

→ PDCA's Plan→Design→Do→Check→Act is exactly a **linear chain** = sitting in the second-most-fragile slot.

### 2. Cognition's "context fragmentation" warning
- "Share **full agent traces**, not just individual messages"
- PDCA only passes deliverables between stages (SPEC.md → DESIGN_SYSTEM.md → output/) = exactly fragmentation
- Mass-produces conflicting implicit decisions (mismatch between the context Planner assumed and the reality Builder faces)

### 3. PDCA's monotony = weakened evaluation signal
- The Bagelcode mail explicitly calls for "**original ideas**"
- PDCA is a 1980s quality-management frame — zero novelty
- Ignorant of frontier patterns (Magentic-One ledger, ALAS local compensation, Challenger/Inspector)

## The new topology — "Hub-Ledger-Spoke"

```
                           ┌──────────────────────────┐
                           │        User (TUI)        │  ← 1급 actor
                           └────────────┬─────────────┘
                                        │  goal / intervene / approve
                ┌───────────────────────┴────────────────────┐
                │             ORCHESTRATOR (Hub)             │
                │     • Task Ledger  (ALAS state)            │
                │     • Progress Ledger (Magentic-One)        │
                │     • Adapter health / Circuit breaker     │
                │     • single transcript writer             │
                └────────┬────────┬───────────┬──────────────┘
                         │        │           │
              Builder.A ◀┘   Builder.B  ───▶ Verifier
              Claude Code    Codex         (cross-provider:
              (Anthropic)    (OpenAI)        Gemini / GLM / local)
                  ▲              ▲              ▲
                  │              │              │
                  └──── single shared transcript.jsonl ────┘
                         (모든 agent pull-only access)
```

### 4 actors (all hierarchical = ICML 5.5% degradation tier)

1. **Orchestrator (Haiku 4.5)** = router + ledger manager + circuit breaker
2. **Builder.A (Claude Code)** = first attempt (Anthropic provider)
3. **Builder.B (Codex)** = second attempt or in parallel — **automatic fallback when Builder.A fails** (provider diversification)
4. **Verifier (cross-provider)** = Gemini 2.5 Pro / GLM-4.6 / or local — a different family than Anthropic / OpenAI

### Two ledgers (borrowed from Magentic-One)

```jsonc
// task-ledger.json — what we know
{
  "facts_known": ["...", "..."],
  "facts_to_lookup": ["...", "..."],
  "guesses": ["...", "..."],
  "constraints": ["...", "..."]
}

// progress-ledger.json — how far we've come
{
  "step": 3,
  "complete": false,
  "stuck": false,
  "next_speaker": "builder.b",
  "instruction": "GET endpoint test 재실행",
  "stuck_count": 0    // 5+ 면 escalation
}
```

→ The Orchestrator updates the progress-ledger and self-reflects at the start of every turn. **The task-ledger accumulates facts, while the progress-ledger is rewritten from scratch every step** (Magentic-One pattern verbatim).

## Anthropic ⊕ Cognition reconciliation

| Cognition's stance | Anthropic's stance | Our reconciliation |
|---|---|---|
| Single context wins | Parallel spawn possible | **Single transcript** + each agent only sees its own envelope on query |
| Context engineering first | Prompt engineering first | sandwich §1+§2 = engineered context (cache boundary) |
| Coding does not parallelize | Research does | **The 2 Builders run sequentially** (no parallel), Verifier is independent |
| Avoid the telephone game via filesystem output | Avoid the telephone game via filesystem output | artifacts/ directory + only refs in the transcript |

## "If not PDCA, then what?" — Step model change

### old (PDCA, rejected)
```
Plan → Do → Check → Act → (repeat)
```

### new (Hub-Ledger based)
```
                    ┌──────────────────────────┐
                    │ goal received → ledger.init │
                    └─────────────┬────────────┘
                                  │
                                  ▼
        ┌─────── progress-ledger update (per turn) ───────┐
        │                                                  │
        ▼                                                  │
   classify intent ──┬─→ Builder.A (try)                  │
                     │     │                              │
                     │     ▼                              │
                     │   Verifier ◀──── (cross-provider)  │
                     │     │                              │
                     │     ├─ PASS → done                 │
                     │     │                              │
                     │     ├─ PARTIAL → user.veto/approve │
                     │     │                              │
                     │     └─ FAIL → Builder.B (fallback) │
                     │                  │                 │
                     │                  ▼                 │
                     │              Verifier              │
                     │                                    │
                     └─→ stuck (5 turns) → escalate ─────┘
```

Key points:
- **Provider fallback rather than sequential retry** — if Builder.A fails, try Builder.B with the same spec. ([[bagelcode-fault-tolerance-design]])
- **Verifier is always cross-provider** — verifying Anthropic / OpenAI output with the same provider is meaningless. A different family must look at it. (CP-WBFT insight)
- **Stuck detection** = progress-ledger.stuck_count 5+ → escalate to the user (prevents automatic infinite loops)

## Applying ALAS local compensation

[[bagelcode-frontier-orchestration-2026]] §H ALAS pattern:

| Incident | old (PDCA-style) | new (ALAS-style) |
|---|---|---|
| Builder output hallucination | Restart the entire PDCA | **Invalidate only that build message, retry instruction on the next turn** |
| User changes the spec | Start over from Plan | **Just append the diff to the transcript**, partial ledger update |
| Verifier failure (network) | Halt everything | **Verifier local fallback** (static lint only), mark in transcript |
| One adapter outage | Whole system goes down | **Open the circuit breaker**, route to the other Builder |

→ "History-based local compensation" = partial retry based on information already present in the transcript. No global reset allowed.

## Alignment with TradingAgents

[[bagelcode-tradingagents-paper]] §4.2 5 stages (Analyst / Trader / Researcher / Risk / Fund) mapped to ours:

| TA | Ours |
|---|---|
| Analyst Team (structured) | (none, absorbed by the Orchestrator) |
| Trader (decision) | Builder.A or .B |
| Researcher debate (NL) | Builder.A vs Builder.B output judged by the Verifier |
| Risk Mgmt (structured adjust) | progress-ledger self-reflect |
| Fund Manager (final) | Orchestrator's done verdict |

→ TA's 5 stages map cleanly on top of our 4 actors layer-by-layer. Not monotonous.

## User-intervention positions (4 hooks)

```
1) goal 직후         → constraint 추가 가능
2) Verifier PARTIAL  → /approve 또는 /veto
3) stuck 감지        → /redo 또는 /switch (Builder 강제 변경)
4) done 직전         → /reject (재실행 강제)
```

→ Each hook is a **natural quiet point between Builder/Verifier wakes**. Interrupt-driven (TUI keystrokes are recorded into the transcript).

## Expected efficiency impact

| Metric | PDCA plan (rejected) | Hub-Ledger (adopted) |
|---|---|---|
| Turns per session | ~6 (P/Des/Do/Check/Act/Final) | ~5 (goal/builder.A/verify/[fallback].B/done) |
| Tokens per session (with cache) | ~150K | ~140K (ledger overhead ~+10K, offset by shorter turns) |
| Faulty-agent recovery | medium-weak (chain) | **strong (hierarchical + cross-provider fallback)** |
| Single context | weak (per-stage fragments) | **strong (single transcript)** |
| Originality | low (1980s pattern) | **high (borrows 2026 frontier)** |

## Stretch — 2-Builder **parallel** mode (optional)

When the `--parallel-builders` flag is set:
- Builder.A and .B receive the same spec and produce output **simultaneously**
- The Verifier **evaluates both** and picks (or the user picks)
- 2× token cost vs higher accuracy + directly hits Cognition's "avoid vendor lock-in" point

→ Default is sequential fallback. Parallel is a demo-only option for showcasing.

## Open / follow-up

- [ ] Verifier provider choice — Gemini 2.5 Pro vs GLM-4.6 vs local Llama 3.3 (decided in [[bagelcode-agents-fixed]])
- [ ] Exact JSON Schema for task-ledger / progress-ledger
- [ ] stuck_count threshold (is 5 right? 3?)
- [ ] Cost guard for parallel mode (force user pre-confirm?)

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-frontier-orchestration-2026]] — primary source
- [[bagelcode-fault-tolerance-design]] — failure taxonomy + recovery primitives (sits on top of this topology)
- [[bagelcode-agents-fixed]] — Claude Code + Codex fixed + cross-provider verification
- [[bagelcode-transcripts-schema]] — single transcript schema (already locked in)
- [[bagelcode-tradingagents-paper]] / [[hub-spoke-pattern]]
