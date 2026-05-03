---
title: Bagelcode Task — Paperclip Adoption + Lightweight Alternatives Comparison
category: synthesis
tags: [bagelcode, paperclip, framework, multi-agent, autogen, swarm, crewai, agent-squad, decision]
sources:
  - "https://github.com/paperclipai/paperclip"
  - "https://github.com/openai/swarm"
  - "https://github.com/microsoft/autogen"
  - "https://github.com/crewaiinc/crewai"
  - "https://github.com/2FastLabs/agent-squad"
  - "[[kiki-appmaker]]"
created: 2026-05-01
updated: 2026-05-01
---

# Paperclip Adoption + Lightweight Alternatives Comparison

> Since [[kiki-appmaker]] (which we already have) runs on top of Paperclip, there's a tempting "just bring Paperclip in and we're fast" angle. But under the **README-runs-immediately + 2-day deadline** constraint, the conclusion leans toward "not much help." This page is a comparison of 5 candidates + recommendation.

## One-line conclusion (decided up front)

**Recommend a custom build (transcript JSONL + thin Coordinator).** Cite Paperclip only as a reference in the submission. Don't adopt the alternative frameworks either. See §"Trade-off table" for the reasoning.

## The 5 candidates

| # | Framework | One-liner | Dependency weight | License |
|---|---|---|---|---|
| 1 | **Paperclip** | Node.js + React + embedded Postgres orchestration | Heavy (DB + web) | MIT |
| 2 | **OpenAI Swarm** | Handoff abstraction only, client-side stateless | **Lightest** | MIT |
| 3 | **Microsoft AutoGen** | Multi-tier (Core/AgentChat/Extensions), maintenance mode | Medium-heavy | MIT (CLA required) |
| 4 | **CrewAI** | Crews + Flows, Pydantic-based definitions | Medium | MIT |
| 5 | **Agent Squad** | SupervisorAgent-centric conversation routing | Light | Apache-2.0 |

## 1. Paperclip ([github.com/paperclipai/paperclip](https://github.com/paperclipai/paperclip))

### Definition
"If OpenClaw is an employee, Paperclip is the company" — Node.js server + React UI + embedded Postgres. Heartbeat / issue / agent / routine 4-primitive.

### Strengths
- ✅ Issue + comments + attachments + audit log → can run a heavy multi-agent company
- ✅ Org chart, budget, governance, approval flow → a real organization-operations tool
- ✅ Separate MCP server (Paperclip MCP) — external agents can control it via natural language
- ✅ Production path of [[kiki-appmaker]] itself (sandwich + 17-agent + bkit)

### Weaknesses (in the task context)
- ❌ **High risk that the README won't run immediately** — needs Node.js 20+ / pnpm 9.15+ / embedded Postgres boot
- ❌ **Out of scope for the task** — bringing in an organization-operations tool to use as a 2-agent demo is a mismatch
- ❌ **Doesn't match Bagelcode's tone** — opposite direction from what the blog emphasized: "simple UI, 3-day build, team autonomy"
- ❌ **Auth/secrets setup** — burdens evaluators with OpenAI/Anthropic keys + container + DB setup
- ❌ Weak signal of "I built this myself with AI coding agents" — putting a thin layer on top of an existing framework can make evaluators skeptical

### Borrowable value (take only the assets, skip the framework)
- Issue lifecycle idea → absorb into our transcript `kind` vocabulary
- Heartbeat scheduler idea → a simple polling loop is enough
- Sandwich identity → already extracted in [[kiki-appmaker-orchestration]]

## 2. OpenAI Swarm ([github.com/openai/swarm](https://github.com/openai/swarm))

### Definition
Educational lightweight framework. Two abstractions: **Agent (instructions + tools)** + **Handoff (returns the next agent)**. Client-side, stateless.

### Strengths
- ✅ **Lightest** — can demo inside a single file
- ✅ Stateless design → naturally combines with our transcript JSONL append-only
- ✅ Almost no dependencies beyond Python 3.10+

### Weaknesses
- ❌ OpenAI Chat Completions only → needs separate abstraction to call Claude/Gemini
- ❌ Explicitly "Educational" — not for production → only half-fits Bagelcode's "use multiple agents simultaneously" tone

### Borrowable value
- **Handoff pattern** — exactly isomorphic to our `kind=agent.wake` + `to=<next>`. Inspires the spec.
- Client-side stateless → confirms our design premise

## 3. Microsoft AutoGen ([github.com/microsoft/autogen](https://github.com/microsoft/autogen))

### Definition
3-tier Core / AgentChat / Extensions. Async messages + GroupChat + human-in-the-loop.

### Strengths
- ✅ Multi-LLM provider abstraction is well done
- ✅ GroupChat → directly maps to multi-agent debate patterns (TradingAgents §4.2 III/IV)

### Weaknesses
- ❌ **Maintenance mode** (Microsoft Agent Framework recommended in 2025) → graders may suspect "why a deprecated library?"
- ❌ Large dependency tree (Pydantic v2 + asyncio + multiple SDKs) → README-runs risk
- ❌ Thick abstraction weakens the "I built this myself" signal

## 4. CrewAI ([github.com/crewaiinc/crewai](https://github.com/crewaiinc/crewai))

### Definition
Role-playing based (Role / Goal / Backstory) + Crews (teams) + Flows (DAG). Pydantic definitions.

### Strengths
- ✅ Role-playing abstraction → expressive power similar to kiki's engineering-team 12-agent
- ✅ Enterprise use cases (Oracle, Deloitte, etc.) → stability

### Weaknesses
- ❌ **Heavy** — largest dependency tree
- ❌ Backstory / Role-playing abstraction → opposite tone from the "simplicity" Bagelcode emphasized
- ❌ Flow DAG → overkill for the task's simple ping-pong

## 5. Agent Squad ([github.com/2FastLabs/agent-squad](https://github.com/2FastLabs/agent-squad))

### Definition
SupervisorAgent-centric conversation routing. agent-as-tools.

### Strengths
- ✅ Explicitly lightweight
- ✅ Supervisor → 1:1 mapping with our Coordinator

### Weaknesses
- ❌ Conversational chatbot oriented → weak for "coding agents produce work outputs" scenarios
- ❌ Low awareness — gives evaluators an "untested" impression

## Trade-off table (5 evaluation dimensions for the task)

| | Paperclip | Swarm | AutoGen | CrewAI | Agent Squad | **Custom build** |
|---|---|---|---|---|---|---|
| README runs immediately | ❌ | ✅ | ⚠ | ⚠ | ✅ | **✅** |
| Dependency weight | Heavy | Light | Heavy | Med | Light | **Lightest** |
| Multi-LLM (Claude/Codex/Gemini) | tooling | weak | ✅ | ✅ | ✅ | **✅ (we write it)** |
| Transcripts schema freedom | constrained | free | constrained | constrained | constrained | **✅ maximal** |
| Bagelcode tone fit | ❌ | ⚠ | ❌ | ❌ | ⚠ | **✅** |
| "Built with AI coding agents" signal | ❌ | ⚠ | ❌ | ❌ | ⚠ | **✅** |
| Caching control | weak | ✅ | ⚠ | weak | ⚠ | **✅** |
| Rubric auto-scoring hookability | weak | ✅ | ⚠ | weak | ⚠ | **✅** |
| Deadline (2-3 day) safety | ❌ | ✅ | ⚠ | ⚠ | ✅ | **✅** |

→ Across every axis, **custom build ≥ Swarm > Agent Squad > the rest**.

## What "custom build" is (how small is it)

A thin Coordinator on top of [[bagelcode-transcripts-schema]] + [[bagelcode-caching-strategy]] + [[bagelcode-rubric-scoring]]:

```
~800-1500 LOC estimate
- protocol/schemas/*.json     (~100 LOC, JSON Schema)
- protocol/validator.ts/py    (~100 LOC)
- coordinator.ts/py           (~250 LOC, router + JSONL writer)
- adapters/{claude,codex,gemini}.ts/py  (~150 LOC each)
- agents/*.md                 (~100 LOC each, sandwich 4 sections)
- ui/tui.ts/py                (~150 LOC, blessed/textual)
- score/rubric.ts/py          (~150 LOC, dimension scoring)
```

→ **Could be smaller than Swarm** (Swarm too is comparable in size once you remove the OpenAI Chat abstraction).

## Why we keep Paperclip as a reference only (README citation on submission)

> "This tool is inspired by [Paperclip](https://github.com/paperclipai/paperclip)'s issue/heartbeat/sandwich pattern, but **to guarantee task deadline and README operability**, we did not adopt the framework itself; instead we carved out the same skeleton with a **transcript JSONL + thin Coordinator**. Bringing Paperclip's full weight as-is would make it hard for evaluators to run it within a minute."

→ This single paragraph is the precise answer to **"why a custom build?"** It also makes the decision rationale clear to evaluators.

## Alignment with TradingAgents

[[bagelcode-tradingagents-paper]] also designs its **own protocol** rather than adopting a framework. Same path for us:

| TradingAgents | Us |
|---|---|
| Inspired by MetaGPT + own protocol | Inspired by Paperclip + own transcript |
| ReAct prompting | sandwich + ReAct variant |
| Quick/Deep model split | Coordinator(Haiku) + Planner(Opus) + Builder(Codex) + Critic(Gemini) |

→ Even academic papers carve their own without using a framework. Same line for us.

## Follow-ups (after this decision)

- [x] Add the Paperclip GitHub to references ← this page serves that role
- [ ] Skim Swarm's `Agent + Handoff` API once and absorb only what differs from our `kind=agent.wake`
- [ ] CrewAI's Role/Goal Pydantic model form → inspires our sandwich §1 contract YAML expression
- [ ] Don't look at AutoGen (waste of time)

## See also

- [[bagelcode]] / [[bagelcode-task-direction]] — affected by this decision
- [[bagelcode-transcripts-schema]] — heart of the custom build
- [[bagelcode-caching-strategy]] / [[bagelcode-rubric-scoring]] — built on top of the custom build
- [[bagelcode-tradingagents-paper]] — academic basis for designing one's own protocol
- [[kiki-appmaker]] / [[kiki-appmaker-orchestration]] — production case on top of Paperclip (we borrow only the assets)
