---
title: Bagelcode Task — Fixed Agent Decision (Claude Code + Codex) + Verifier evolution
category: synthesis
tags: [bagelcode, agents, decision, claude-code, codex, verifier, courteval, evolution-history]
sources:
  - "[[bagelcode-orchestration-topology]]"
  - "[[bagelcode-fault-tolerance-design]]"
  - "[[bagelcode-frontier-orchestration-2026]]"
  - "[[bagelcode-final-design-2026]]"
created: 2026-05-01
updated: 2026-05-02
---

# Fixed Agents + Verifier evolution

> ⚠️ **2026-05-02 supersession**: this page preserves the v1-v2 evolution context (Verifier = external Gemini cross-provider). From v0.1 onward it has been absorbed into **Verifier = Engineering Lead internal CourtEval** (Grader/Critic/Defender/Re-grader, ACL 2025). External Gemini was scrapped due to a subscription-only budget (*"나 돈이 없어"* — I have no money). **Final lock is [[bagelcode-final-design-2026]]**.

> **User decision (confirmed — current state)**: agents in use are fixed at **Claude Code + Codex** (subprocess via subscription). Verification is **Engineering Lead internal CourtEval** (4 sub-roles, Claude Sonnet 4.6 vision). External cross-provider Verifier is scrapped (cost constraint). The §"Candidate Verifier providers" section of this page is preserved as historical evolution.

## Selection method (6-step decision tree)

A systematic answer to the evaluator's "why this model combination?" Numbers ready to pin into the README or `docs/agent-selection.md`.

### Step 1 — Eligibility filter

| Criterion | Pass condition | Cut candidates |
|---|---|---|
| Headless / non-interactive | CI/CD-runnable | (all pass) |
| Official / maintained SDK | First-party vendor or maintained CLI | AutoGen 0.4 (maintenance mode) |
| README runs immediately | Evaluator runs in under 5 min | Local 70B Llama (download burden → fallback only) |
| License | MIT / Apache / OK to use | (all pass) |
| Mentioned in Bagelcode mail | "Claude Code, Codex, Gemini CLI 등" (etc.) | "등" leaves it non-mandatory, **bonus** |

### Step 2 — Role-fit scoring (5 axes × 10 points)

Each role needs different capabilities:

| Axis | Weight |
|---|---|
| Reasoning depth | High (Planner/Verifier) / Low (Coordinator) |
| Code synthesis | High (Builder) |
| Latency | High (Coordinator routing) |
| Cost | Always |
| Vision | Optional (Verifier game.html validation) |

**Scoring results:**

| Candidate | Coordinator | Builder | Verifier |
|---|---|---|---|
| Claude Haiku 4.5 | **9** (fast, cheap) | 5 | 6 |
| Claude Sonnet 4.6 | 7 | 8 | 9 (but no cross-provider) |
| Claude Opus 4.7 | 4 (overkill) | **9** (code SOTA) | 8 |
| GPT-5.5 (Codex) | 6 | **9** (Codex tooling) | 7 |
| o3 (OpenAI) | 3 (slow, expensive) | 8 | 8 |
| Gemini 2.5 Pro | 5 | 7 | **9** (vision + cross) |
| Gemini 2.5 Flash | 8 | 6 | 7 |
| GLM-4.6 | 7 | 6 | 7 |

→ The column max is the primary candidate; tiebreakers come from other steps.

### Step 3 — Cost ceiling

Working backward from the ≤ $1.5 / session budget in [[bagelcode-caching-strategy]]:

```
Coordinator (10 calls × 4K in / 0.5K out)  ≈ Haiku    $0.04
Builder.A   (2 calls × 8K in / 2K out)     ≈ Opus 4.7  $0.40
Builder.B   (1 call fallback)              ≈ Codex     $0.08
Verifier    (3 calls × 6K / 1K)            ≈ Gemini Pro $0.10
                                          ───────────
                                          Total ≈ $0.55-0.65
```

Headroom ~40% — even `--parallel-builders` is OK.
**Cut:** o3 standalone hits $1.20+ → can't earn an expensive seat.

### Step 4 — Provider diversity (mandatory)

[[bagelcode-fault-tolerance-design]] §F1: **at least 2 different provider families must be capable of the Builder role.**

→ Anthropic + OpenAI is the only pairing matching "two code SOTAs + different families."

### Step 5 — Capability redundancy

When Builder.A dies, can Builder.B receive the same spec and play the same role?

| Combination | Possible |
|---|---|
| Claude Code (Opus 4.7) + Codex (GPT-5.5) | ✅ |
| Claude Code + Gemini Pro | ⚠ Gemini is weak at code/tool use |
| Codex + Cursor CLI | ⚠ Same OpenAI family (diversity broken) |
| Claude Code + Aider | ⚠ Which LLM does Aider use? Unclear |

### Step 6 — Verifier isolation (cross-provider mandatory)

**Rule: Verifier must be from a family that is neither Anthropic nor OpenAI.** Rationale: ICML 2025 §F (Resilience) + CP-WBFT (Byzantine FT) + MAR (degeneration-of-thought).

→ Default = Gemini 2.5 Pro / fallback = lint-only local.

### Final decision

| Role | Model | Provider | Top reason |
|---|---|---|---|
| **Coordinator** | Claude Haiku 4.5 | Anthropic | routing 9/10, 10× cheaper |
| **Builder.A (primary)** | Claude Code w/ Opus 4.7 | Anthropic | code 9/10, headless, depth=1 |
| **Builder.B (fallback)** | Codex CLI w/ GPT-5.5 | OpenAI | code 9/10, **different family** |
| **Verifier** | Gemini 2.5 Pro | Google | reasoning 9/10, vision, **cross-provider** |
| Verifier fallback | lint-only local | (none) | Protects keyless evaluators |

### Mode variants (exposed to user choice)

| Mode | Active actors | Estimated cost | Use case |
|---|---|---|---|
| `--solo` | Coord + Builder.A | ~$0.30 | Anthropic key only (minimum) |
| `--standard` (default) | Coord + Builder.A + Verifier | ~$0.50 | Anthropic + Google |
| `--full` | + Builder.B | ~$0.65 | All keys, fault demo possible |
| `--parallel` | full + parallel builders | ~$1.10 | stretch demo |

→ The README's first section is `--solo` baseline (minimum setup). Full is advanced.

### ENV-driven override

```bash
CRUMB_MODEL_COORD=claude-haiku-4-5
CRUMB_MODEL_BUILDER_A=claude-opus-4-7
CRUMB_MODEL_BUILDER_B=gpt-5.5
CRUMB_MODEL_VERIFIER=gemini-2.5-pro
CRUMB_VERIFIER_VISION=true
```

→ Replace the entire table via env vars alone. README's last page: "Advanced configuration" (1 page).



## Fixed facts

| Role | Agent | Provider | Model (default) | Notes |
|---|---|---|---|---|
| Builder.A | **Claude Code** | Anthropic | `claude-opus-4-7` (or `sonnet-4-6`) | Agent SDK headless mode |
| Builder.B | **Codex** | OpenAI | `gpt-5.5` (or `o1`) | Codex CLI subagent + TOML config |
| Verifier | **cross-provider** | (Google / Z.ai / local) | TBD (§ candidate comparison) | Family different from Anthropic·OpenAI |
| Orchestrator | (Builder.A's Claude Code does this concurrently) | Anthropic | `claude-haiku-4-5` | Routing via sandwich §1+§4 alone |

→ **Orchestrator and Builder.A run on the same Claude Code instance with different sandwiches.** Token savings + consistent with Cognition's "single context" principle.

## Why Claude Code + Codex (reinforcing the user decision)

### Claude Code strengths
- **Stable headless mode** ([[bagelcode-frontier-orchestration-2026]] §K) — guarantees README CI/CD operation
- **Agent SDK depth=1** constraint matches our hierarchical topology exactly (no recursive spawn = intentional)
- **First in the Bagelcode mail's quote order** ("Claude Code, Codex, Gemini CLI" listed in this order)
- prompt cache (sandwich §1+§2 boundary, [[bagelcode-caching-strategy]])

### Codex strengths
- **TOML agent definition** ([[bagelcode-frontier-orchestration-2026]] §L) — natural mapping to our `agents/builder-b.md`
- **CSV batch (`spawn_agents_on_csv`)** — stretch option for batch scenarios
- **non-interactive mode** — README operation
- max_threads / max_depth controllable
- **Different provider dependency** = guaranteed fallback when one side fails

### "Why both, really?" justification
- ICML 2025 §F: hierarchical + cross-provider = 95%+ recovery (single-provider recovery rate is lower)
- Direct response to Bagelcode's multi-vendor tone
- F1 (adapter failure) scenario can be demonstrated — kill claude-code and demo the fallback to codex

## Verifier provider candidates (cross-provider family)

Pick one from a family that is neither Anthropic nor OpenAI:

### Candidate V1 — **Google Gemini 2.5 Pro** (default recommendation)

| Item | Assessment |
|---|---|
| API stability | ✅ Google AI Studio + Vertex AI |
| Vision | ✅ (game.html screenshot validation) |
| Korean | ✅ Excellent |
| Price (input) | $1.25/1M (Pro), $0.075/1M (Flash) |
| Context cache | ⚠ min 4K — won't apply for small sandwiches |
| SDK | `@google/genai` (TS), `google-genai` (Python) |
| Mentioned in Bagelcode mail | ✅ "Gemini CLI" mentioned |
| Setup burden | ⚠ API key required |

→ **Verifier #1**: vision-capable + consistent with mail mention.

### Candidate V2 — **Z.ai GLM-4.6** (low-cost option)

| Item | Assessment |
|---|---|
| API | OpenAI-compatible endpoint |
| Vision | ⚠ GLM-4V separate |
| Korean | ✅ |
| Price | input ~$0.6/1M (50% of Pro) |
| Cache | OpenAI-compatible auto |
| Setup | Quick key issuance, watch out for GFW |
| Bagelcode mail | ❌ Not mentioned |

→ **stretch option** — `--verifier=glm` flag for cost-comparison demo.

### Candidate V3 — **Local Llama 3.3 70B (Ollama)**

| Item | Assessment |
|---|---|
| API | localhost:11434 |
| Vision | ❌ |
| Price | $0 (local GPU required) |
| Latency | ✅ 0 network |
| Setup | ❌ 70B download burden on the evaluator |
| README operation | ❌ Too much for the evaluator |

→ **Not recommended** — operation in evaluator's environment isn't guaranteed. Use only as a degraded fallback (lint-only).

### Candidate V4 — **OpenRouter** (router itself)

| Item | Assessment |
|---|---|
| API | OpenAI-compatible + 100+ models unified |
| Pros | Verifier provider can be chosen dynamically |
| Cons | Weakens the "different provider family" meaning (it's just a router) |

→ **stretch** — use `--verifier-via=openrouter` to highlight flexibility in demos.

## Decision — Verifier default = **Gemini 2.5 Pro**, fallback = **lint-only local**

```
Default chain:
  Verifier:  Gemini 2.5 Pro  (cloud, vision)
       ↓ (api fail)
  Verifier:  static lint-only mode  (in-process, no network)
       ↓
  PARTIAL verdict + transcript 표기
```

→ Evaluators without a Gemini key still get a working README (degraded to lint-only).

## Adapter structure (`src/adapters/*`)

```typescript
// 공통 인터페이스
interface AgentAdapter {
  id: string                       // "claude-code" | "codex" | "gemini"
  capabilities: Capabilities       // {vision, json_mode, max_context, ...}
  
  ping(): Promise<HealthStatus>    // F2 capability probe
  call(req: AdapterRequest): Promise<AdapterResponse>
  
  // F1 circuit breaker hooks
  onSuccess(): void
  onFailure(err: Error): void
}

// 각 구현
class ClaudeCodeAdapter implements AgentAdapter { /* Agent SDK */ }
class CodexAdapter implements AgentAdapter { /* CLI subprocess + TOML */ }
class GeminiAdapter implements AgentAdapter { /* @google/genai */ }
class LintOnlyAdapter implements AgentAdapter { /* fallback, no network */ }
```

→ Each adapter implements the health probe + circuit breaker from [[bagelcode-fault-tolerance-design]] §F1-F2.

## Sandwich mapping

The [[kiki-appmaker-orchestration]] 4-section sandwich, per actor:

```
§1 contract   = "너는 누구이고 누구한테 PATCH 한다"
§2 stage tmpl = role 본문
§3 tool/skill = 사용 가능 도구 정의
§4 enforcement= routing 금지 + STOP

actor 별 §2 본문:
  - Orchestrator    → "ledger update + next_speaker 선정 + STOP"
  - Builder.A (CC)  → "spec → code, artifacts/ 에 쓰고 STOP"
  - Builder.B (Codex)→ Builder.A 와 동일 contract, 다른 모델
  - Verifier (Gemini)→ "build artifact 검증, exec 실행, dimensions 채점, STOP"
```

→ **Builder.A and Builder.B share the same §2** = from the user's view, the same role on two providers. That's the meaning of fallback.

## Authentication / environment variables

```bash
# .env (sample)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...

# Optional fallback
GLM_API_KEY=...                  # Z.ai
CRUMB_VERIFIER=gemini       # gemini|glm|lint-only
CRUMB_PARALLEL_BUILDERS=0   # 1 = both run in parallel
CRUMB_MODEL_CLAUDE=claude-opus-4-7
CRUMB_MODEL_CODEX=gpt-5.5
CRUMB_MODEL_VERIFIER=gemini-2.5-pro
```

→ All variables are optional (defaults exist). Without a key, the adapter is auto-disabled and routing falls back to alternatives.

## Pre-deadline risk scenarios

| Scenario | Response |
|---|---|
| Evaluator has no Codex key | `--solo` mode auto — runs with Builder.A only; demo video shows the fallback transition |
| Not signed up for Gemini API | Degrade to lint-only mode, mark in transcript, README states "Gemini key optional" |
| Claude Code 1.x → 2.x minor bump | Capability probe auto-reselects from the model list |
| Total network outage | All adapter circuits OPEN → user escalation, last transcript preserved |

## Measurement (numbers to pin into the submission README)

With the `--demo-fault-injection` flag, an intentional fault is staged:

```
$ crumb demo --demo-fault-injection

[T+0] goal received
[T+0:30] Builder.A wake (claude-code)
[T+0:45] ⚠ Builder.A killed (artificial kill -9)
[T+0:46] circuit OPEN claude-code → routing to codex
[T+0:50] Builder.B wake (codex)
[T+1:40] artifact ready
[T+1:42] Verifier wake (gemini)
[T+1:55] PASS 91/100
[T+1:56] DONE in 1m56s (resilient session)
```

→ Pinning a 30-second clip of this in the demo video shows the hierarchical + cross-provider safeguard from ICML 2025 §F **actually working**.

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-orchestration-topology]] — Hub-Ledger-Spoke (these 4 actors sit on top of that topology)
- [[bagelcode-fault-tolerance-design]] — health probe / circuit breaker per adapter
- [[bagelcode-frontier-orchestration-2026]] — Claude Code SDK / Codex subagents primary sources
- [[bagelcode-caching-strategy]] — per-provider cache mechanism
- [[bagelcode-paperclip-vs-alternatives]] — framework non-adoption decision (these actors are invoked via direct adapter)
- [[geode-llm-models]] — multi-provider fallback chain inspiration (4 providers × 14 models)
