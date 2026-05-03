---
title: Bagelcode DAVIS — Internal Data Assistant (Multi-Agent Case Study)
category: references
tags: [bagelcode, davis, multi-agent, slack-bot, genie, databricks, router-agent]
sources:
  - "https://www.bagelcode.com/article/bagelcode-x-ai-genie-기반-사내-데이터-비서-davis-개발기/"
created: 2026-05-01
updated: 2026-05-01
---

# Bagelcode DAVIS — Building the Internal Data Assistant

> Summary of the Bagelcode official blog post. **The development story of DAVIS, an internal data assistant powered by AI Genie**. The most direct primary source illustrating Bagelcode's multi-agent design philosophy and data governance approach.

## One-line summary

A single Slack bot lets anyone in the company ask natural-language questions → SQL is auto-generated → results are retrieved from Databricks. Behind the scenes, **three agents (Document/Tableau/Query) plus a Router** are running.

## Organizational context

- A data-driven organization managing approximately **10,000 tables and 1,000+ dashboards**
- "Centered on years of accumulated data and AI technology in the global market plus marketing capabilities, we make decisions strictly based on data."
- Regular internal hackathon **BagelJam:Dev** — 2-day prototyping → incremental refinement

## System architecture

```
Slack
  ↓ (mention)
API Gateway → AWS Lambda
  ↓
Agent Router  ← routes the user request to one of three agents
  ├─ Document Retrieval Agent  (internal document search)
  ├─ Tableau Agent             (existing dashboard connection)
  └─ Query Agent (Genie-based) (Text-to-SQL)
                  └─ Genie Space Router
                        ├─ Studio A Genie Space
                        ├─ Studio B Genie Space
                        └─ ...
```

→ **Two-stage routing**: (1) what kind of task is this (Document / Tableau / Query) → (2) if it's a Query, which game-studio context.

### Query Agent evolution

- **Early stage**: AWS Kendra (RAG) → LLM generates SQL → Databricks executes. The self-built overhead was significant.
- **Current**: Adopted Databricks AI/BI **Genie API**. Text-to-SQL is delegated to a managed service, removing the burden of self-implementation.

Genie call flow:
1. `start conversation` — receive the user request
2. `get conversation` — check SQL generation status
3. `get message attachment` — retrieve the SQL result

## Three Genie operating principles

### Principle 1: Stay Focused (only the necessary tables)
- Don't register all 10,000 tables → **curated selection centered on the Mart layer (3-layer: Base/Intermediate/Mart)**
- Too many tables in one Genie Space = degraded accuracy/performance → operate them separately

### Principle 2: Plan to Iterate
- **Instructions**: explicitly capture internal terminology and business definitions
- **Register SQL samples**: learn frequent question patterns
- Iterative improvement via user feedback loop — "not done in one shot, but progressively evolved"

### Principle 3: Build on Well-annotated Tables
- **Codify metadata in dbt YAML** — version-control table/column descriptions in git
- Auto-apply descriptions when new tables are created
- Possibility of auto-generating description YAML with an LLM ← AI builds the AI infrastructure

## Space-separation strategy (the heart of the Router Agent)

> "Limit the number of tables in any single Genie Space, and use multiple Genie Spaces."

A separate Genie Space per game studio. The Router Agent identifies the studio from the user utterance → automatically forwards to the matching Space. The user does not need to specify the context (which studio) themselves.

→ **Implication: multi-agent = domain isolation + router.** Instead of a single giant LLM with one context, accuracy is secured by routing across many small contexts.

## Value highlights

| Perspective | Value |
|---|---|
| User (business team) | Even people who don't know SQL can get instant answers from natural-language questions. Decision-making speed. |
| Analytics team | Fewer simple ad-hoc SQL requests, freeing focus for core analysis work. |
| Engineers | Genie reduces self-built RAG/SQL code. Lower operational burden. |

## Team-trait signals

- **No hesitation moving from in-house build to managed services** (the decision to swap their own Kendra-based RAG for Genie)
- **2-day hackathon → operational system** — fast prototype + staged refinement = Bagelcode's standard cycle
- **dbt + YAML for metadata-as-code** — "tidy the data first for AI" — AI-First permeates all the way into data governance
- **Slack prioritized as the user interface** — they don't build a separate UI but start with chat (= consistent with the second blog post's [[bagelcode-ai-first-culture]] "design that agents can also use")

## Implications for the take-home task

| DAVIS pattern | Form usable in the task |
|---|---|
| Router → N domain agents | Branch Claude/Codex/Gemini by **"role"** instead of "domain" |
| Slack bot as user I/O channel | Unify user intervention/observation through a single **chat UI** surface |
| Genie API = managed delegation | Treat the coding agents themselves as managed capabilities (no re-implementation) |
| dbt YAML = metadata-as-code | Treat agent instructions (.md) as **version-controlled assets** — matches the task's submission requirements |

## See also

- [[bagelcode]] — project hub
- [[bagelcode-ai-first-culture]] — AI-First culture blog
- [[bagelcode-team-profile]] — synthesized team persona
- [[bagelcode-task-direction]] — task direction
- [[hub-spoke-pattern]] — DAVIS Router-Agents = Hub-Spoke isomorphism
