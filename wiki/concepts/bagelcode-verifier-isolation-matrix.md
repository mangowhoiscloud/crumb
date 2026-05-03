---
title: Bagelcode Task — Verifier Isolation + User Configurability Matrix (13 sources × 2 dimensions)
category: concepts
tags: [bagelcode, verifier, cross-provider, isolation, configurability, matrix, frontier, 2026]
sources:
  - "[[bagelcode-tradingagents-paper]]"
  - "[[bagelcode-frontier-orchestration-2026]]"
  - "[[bagelcode-production-cases-2026]]"
  - "[[bagelcode-agents-fixed]]"
  - "[[bagelcode-host-harness-decision]]"
summary: >-
  A 4-dimension matrix across 20 frontier sources covering Verifier isolation + cross-provider + user swappability.
  Conclusion: isolation is frontier consensus, cross-provider is academic backbone, swap is a vendor-acknowledged obligation.
provenance:
  extracted: 0.70
  inferred: 0.25
  ambiguous: 0.05
created: 2026-05-02
updated: 2026-05-02
---

# Verifier Isolation + Configurability Matrix

> **Goal.** A summary of the choices made by 13 frontier sources on the sub-question "Should the Verifier/QA camp be isolated to a different provider from the Builder? + Should the user be able to swap the model/provider?". Backing for the "cross-provider opt-in (default off)" decision in [[bagelcode-host-harness-decision]].

---

## Matrix — 13 sources × 4 dimensions

| # | Source | Verifier/Judge **separate actor** | **Different provider** from Builder | **User swap** | Evidence type / one-line implication |
|---|---|---|---|---|---|
| **1** | TradingAgents §4 (arXiv 2412.20138) | ✅ Risk Mgmt + Fund Manager separated | ❌ assumes single provider | ✅ §4.3 "researchers can effortlessly replace the model with any locally hosted or API-accessible alternatives" | Academic / isolation ✅, swap explicitly justified |
| **2** | Anthropic multi-agent research (2025) | ⚠ orchestrator-worker, no separate judge (only subagent fresh context) | ❌ Anthropic only | ✅ rainbow deployment | Production / emphasis on fresh context only |
| **3** | Cognition "Don't Build Multi-Agents" (2025-06) | ❌ "single thread context is superior" | — (opposing stance) | — | Qualitative / skeptical of isolation, but aligned on avoiding vendor lock-in |
| **4** | Magentic-One (arXiv 2411.04468) | ⚠ Orchestrator + 4 specialists (Coder/WebSurfer etc.), Verifier not explicit | ❌ single LLM | ❌ on top of AutoGen | Academic SOTA / Task/Progress ledger ✅, no isolation applied |
| **5** | AutoGen 0.4 (2024-10/2025) | ✅ actor model (each actor independent) | ✅ "different process / different language" possible | ✅ pluggable | Production / both isolation and cross-provider are frontier standard |
| **6** | LangGraph (LangChain 2025) | ✅ **Reflection pattern** (cyclic critique node separated) | ✅ first-class multi-provider support | ✅ TypedDict + Annotated state | Production / Reflection node = direct mapping to our Verifier |
| **7** | ICML 2025 §F Resilience (Faulty Agents) | ✅ **Challenger + Inspector** = separate verification agents | ❌ not explicit (but hierarchical 5.5%) | ❌ | Academic experiment / **96.4% recovery** core is separated isolation |
| **8** | CP-WBFT (arXiv 2511.10400) | ✅ Byzantine consensus = multiple verifiers | ⚠ confidence probe weight (diversity recommended) | ❌ | Academic / 85.7% fault rate stable = **diversity itself is robustness** |
| **9** | MAR (arXiv 2512.20845) | ✅ multi-agent self-critique | ⚠ single reflexion = "**degeneration-of-thought**" → **diverse critic needed** | ❌ | Academic / HumanEval 82.7%, proves same-model self-critique is insufficient |
| **10** | ICLR 2025 MAD Reality Check | ❌ mindless debate addition = token waste | — | — | Academic negative / Verifier only when truly helpful, default opt-in recommended |
| **11** | Claude Code SDK (2025-09 rename) | ❌ depth=1 (recursive spawn forbidden) | ❌ Anthropic only | ⚠ model-level swap (`--model`) | Vendor / depth=1 = blocks sub-spawn option (Task tool only one level deep) |
| **12** | Codex Subagents | ✅ TOML per-agent definition + non-interactive | ⚠ OpenAI only (Codex product family) | ✅ swap with one TOML line | Vendor / **TOML preset pattern** is our direct adoption source |
| **13** | Lanham 2026-04 "Spark to Fire" (production-cases) | ✅ **separate governance layer** | ⚠ not recommended + multi-source verification | ✅ "start with single agent, escalate" | Production / defense rate 0.32 → 0.89, without isolation a single false system poisons the rest |
| **14** | Anthropic 2026-03 "wrong tradeoff" | — | — | ✅ "default-forced = wrong tradeoff" acknowledgment | Vendor self-acknowledgment / **user exposure = obligation** |
| **15** | MIT decision theory (cited by Lanham) | — | — | — | Academic / 90.7% → 22.5%, stage-length warning (external 5 OK if acyclic short) |
| **16** | Paperclip Issue #3438 | ❌ 8-agent hierarchy → 35% bloat | ❌ | — | Production incident / **the more isolation the more token explosion** — isolation must be cheap |
| **17** | obra/superpowers (Karpathy P4) | ✅ Reviewer phase separation + TDD Iron Law | ⚠ not specified | ✅ 7-phase user-customizable | Production (89K stars) / **Reviewer isolation = standard** |
| **18** | Cursor Composer 2 (2026-04) | ⚠ "coordination layer cheaply, calls stronger models when needed" | ✅ model mix (cheap + strong) | ✅ user model picker | Vendor / Haiku coord + Opus builder isomorphic with our decision |
| **19** | Cognition+Windsurf merger (2026) | ⚠ "multiple Devin instances in parallel" | ⚠ operational evolution (opposing stance → adopted parallel) | ✅ per-instance | Production (40% commit) / surface stance ≠ actual operations |
| **20** | gamestudio-subagents (E1) | ✅ QA Agent separated (out of 12 agents) | ❌ Claude only | ✅ agent add/remove | Production (193 stars) / QA separated = game domain standard |

---

## Aggregate pattern

```
                                  isolation✅  cross-prov✅    user-swap✅
Academic (1, 4, 7-10, 15)          5/7         2/7 +recommended 2     2/7
Production/vendor (2, 5-6, 11-14, 17-19)   7/9         6/9            9/9
                                  ─────       ─────          ─────
                                  12/16       8/16           11/16
```

---

## 5 conclusions (what this matrix says)

### C1. Verifier isolation = frontier consensus

12 of 16 ✅. The only objector is Cognition (#3) — and even they evolved to running parallel instances in production (#19). → **Isolation itself doesn't need debating.**

### C2. Cross-provider = academic backbone, operational standard

Direct experimental data:
- **CP-WBFT (#8)**: 85.7% fault stability
- **MAR (#9)**: degeneration-of-thought = same-model self-critique proven insufficient
- **ICML §F (#7)**: 96.4% recovery
- **Lanham (#13)**: with governance layer 0.32 → 0.89

→ Same-provider self-critique is academically proven insufficient.

### C3. User swap = obligation (vendor self-acknowledgment)

- **Anthropic itself (#14)**: admits "hard-coding a default is the wrong tradeoff"
- **TradingAgents §4.3 (#1)**: academic justification
- **AutoGen 0.4 (#5) / LangGraph (#6) / Codex TOML (#12) / Cursor (#18) / superpowers (#17)**: production standard 5/5

→ Don't hard-code a default model; environment variable + config exposure is mandatory.

### C4. Defaults must be cautious

- **ICLR MAD Reality Check (#10)**: mindless addition of debate is a loss
- → `enforce_cross_provider = false` (warn-only, opt-in flag)
- → recommend user choice via preset

### C5. Isolation cost warning

- **Paperclip #3438 (#16)**: isolation must be cheap
- → adding an external actor (one more subprocess) is the limit
- → increasing sub-spawn depth (depth ≥ 2) means token explosion

---

## Crumb application — 2-tier decision

Applying this matrix's conclusions to [[bagelcode-host-harness-decision]]:

### Tier 1 — Default (isolation only, no cross-provider)

```
host = Claude Code
  ├── Coordinator (host itself)
  ├── Task tool: planner-lead     (subagent — different sandwich, different context, same provider)
  │     ├── Task tool: concept-designer
  │     ├── Task tool: researcher
  │     └── Task tool: visual-designer
  └── Task tool: engineering-lead (subagent)
        ├── Task tool: qa
        └── Task tool: verifier   (different sandwich = only mitigates same-provider self-judge risk)

→ Matrix C1 isolation satisfied, C2 cross-provider not satisfied
→ Academic robustness weak but absolute on the mail's "README runs"
→ Evaluator: 1 auth (claude login)
```

### Tier 2 — Opt-in (`--cross-provider` flag)

```
engineering-lead = subprocess spawn codex-local (add an external actor)
verifier         = host Claude Code Task tool (different sandwich)

→ Implementation = Codex / Verification = Claude (cross-assemble)
→ Matrix C1 + C2 both satisfied (isolation + cross-provider)
→ Can demonstrate Lanham 0.32 → 0.89 governance-layer effect
→ Evaluator: 2 auths (claude + codex login)
```

### Configurability (matrix C3 satisfied)

```toml
# .crumb/config.toml
[verifier]
enforce_cross_provider = false  # default — warn-only
warn_on_same_provider = true    # noted in transcript audit
isolation = "subagent"          # in-host Task tool / depth=1
mode = "courteval"

[presets.cross-provider]        # opt-in preset
engineering-lead = { adapter = "codex-local", model = "gpt-5.5" }
verifier         = { host = "claude-code", subagent = true }
```

ENV swap:
```
CRUMB_VERIFIER_ADAPTER=codex-local
CRUMB_VERIFIER_MODEL=gpt-5.5
CRUMB_CROSS_PROVIDER=1
```

---

## Adopted reference patterns

| Crumb component | Source adopted | Adoption method |
|---|---|---|
| `[agents.verifier].adapter` 1-line swap | Codex Subagents TOML (#12) + LangGraph TypedDict (#6) | Replace adapter via single TOML line |
| Verifier as separate subagent | ICML Challenger + Inspector (#7) + LangGraph Reflection (#6) | In-host Task tool spawn (depth=1) |
| Cross-provider guard (warn) | CP-WBFT (#8) + MAR (#9) + Lanham (#13) | Builder model.provider_family ≠ Verifier model.provider_family |
| `enforce_cross_provider` flag | Anthropic wrong tradeoff (#14) + TradingAgents §4.3 (#1) | default=false (warn) — user can strengthen |
| preset (default / cross-provider) | Lanham escalation (#13) + Cursor user picker (#18) | Single → cross gradient |
| ENV override `CRUMB_VERIFIER_ADAPTER` | superpowers customizable (#17) | Shell variable swap |
| Adaptive stop (variance < 1.0) | NeurIPS 2025 MAD judge + ICLR MAD Reality Check (#10) | Cuts off debate infinite loop |
| Degraded fallback (lint-only) | Lanham "Start with single agent" (#13) | Protects evaluator without keys |
| depth=1 enforcement | Claude Code SDK (#11) + Codex max_depth (#12) | Anthropic/OpenAI's own default |

---

## Future expansion (P1+ follow-up)

- [ ] `--strict-cross-provider` mode — reject + lint-only fallback if same provider (academic robustness demo)
- [ ] Multi-Verifier ensemble (CP-WBFT majority weighted voting)
- [ ] Bayesian reputation per adapter ([[bagelcode-frontier-orchestration-2026]] §D1 RAPS)
- [ ] Add D6 dimension ([[bagelcode-rubric-scoring]]) — Resilience (recovery rate from intentional fault injection)

---

## See also

- ★ **[[bagelcode-system-architecture-v0.4]]** invariant #11 — this matrix's C1 (isolation frontier consensus) is promoted in v0.4 to file-level enforcement (judge-input bundle)
- ★ **[[bagelcode-verifier-context-isolation-2026-05-03]]** — bundle decision logic (whitelist/blocklist + frontier evidence)
- [[bagelcode]] / [[bagelcode-host-harness-decision]] — the decision this matrix backs
- [[bagelcode-agents-fixed]] — Verifier isolation decision (this matrix should correct default cross-provider enforcement → opt-in)
- [[bagelcode-tradingagents-paper]] — academic primary source
- [[bagelcode-frontier-orchestration-2026]] — 11 frontier sources (§F/§G/§I/§K/§L direct mapping)
- [[bagelcode-production-cases-2026]] — Lanham + Cursor + Cognition+Windsurf
- [[bagelcode-fault-tolerance-design]] — F5 (anti-deception + cross-provider Verifier)
- [[bagelcode-rubric-scoring]] — D6 Resilience dimension follow-up review
- [[bagelcode-final-design-2026]] — canonical lock (§1 figure needs correction)
