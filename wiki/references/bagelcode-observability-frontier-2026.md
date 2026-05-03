---
title: Bagelcode task — Frontier Observability / Managed Agent / OTel standard sources
category: references
tags: [bagelcode, observability, studio, otel, managed-agent, frontier, 2026, vertex, anthropic-console, agentops]
sources:
  - "Anthropic Claude Managed Agents (2026-04-08 launch)"
  - "Google Vertex AI Agent Builder / Gemini Enterprise (Cloud Next 2026)"
  - "AgentOps OSS (MIT, AgentOps-AI)"
  - "Microsoft Agent Framework 1.0 (AutoGen successor)"
  - "OpenTelemetry GenAI Semantic Conventions (de facto standard)"
  - "OpenLLMetry (Traceloop)"
  - "raw/bagelcode-research/observability-frontier-2026-05.md"
created: 2026-05-02
updated: 2026-05-02
---

# Frontier Observability / Managed Agent / Standards — justification for building our own

> **Key finding**: **OpenTelemetry GenAI Semantic Conventions = the 2026 de facto standard** (compatible with Datadog / Google Vertex / Anthropic / Phoenix / Langfuse / AgentOps).
>
> Even with Crumb building its own, aliasing the transcript.jsonl schema to OTel GenAI gives us **standards compatibility + zero SaaS cost + future export to any platform**.

---

## 1. Big-tech Managed Agent Platforms (2026)

### 1A. Anthropic Claude Managed Agents (2026-04-08 launch, fresh)

> "the first serious attempt by a **frontier model provider** to own the infrastructure layer for agent execution"

| Item | Value |
|---|---|
| Console | https://console.anthropic.com/studio |
| Workbench | https://platform.claude.com/workbench |
| Observability | timeline UI, **click each tool call → arguments / responses** |
| **Replay** | run modifications + replay → regression debug |
| Sandbox | gVisor isolated container, `/workspace` write + `/source` RO |
| Network | default-deny egress |
| Billing | model token + runtime rate |
| Deploy | Console / Claude Code / new CLI |

**Key quote (verbatim):**
> "The observability UI renders these traces as a **timeline** where you can click into any tool call to see exact arguments and responses, and you can **replay a run with modifications to debug regressions**."

→ **Inspiration for Crumb's summary.html**. Same timeline + click-expand + replay pattern.

### 1B. Google Vertex AI Agent Builder → Gemini Enterprise Agent Platform (Cloud Next 2026)

| Item | Value |
|---|---|
| New name | Gemini Enterprise Agent Platform (← Vertex AI Agent Builder rebrand) |
| Studio | **token consumption / latency / error rates / tool calls**, 4 dimensions |
| **Unified Trace Viewer** | agent reasoning paths debugging |
| Auto-raters | multi-turn quality measurement |
| Online evaluation | live traffic |
| Standard | **OTel-compliant telemetry** (their own platform also adopts the standard) |

**Key quote (verbatim):**
> "Using standardized, **OTel-compliant telemetry**, you can verify every agent, tool, and API handoff to ensure accountability, visualize full execution paths, and quickly diagnose reasoning loops or monitor performance metrics."

→ **Even big tech follows the standard**. If we follow it too, we are platform-agnostic.

### 1C. Microsoft Agent Framework 1.0 (AutoGen successor)

- **AutoGen 0.4 → maintenance mode**, migration to MAF 1.0
- streaming + **checkpointing** + HITL approvals + **pause/resume**
- enterprise-ready successor

→ The pause/resume pattern aligns with our `--pause` slash command.

### 1D. AutoGen Studio (legacy)

- drag-and-drop UI, playground view
- Our TUI is a lighter variant

---

## 2. Frontier OSS (alignment with Bagelcode)

### 2A. AgentOps (MIT) ★ best aligned

URL: https://www.agentops.ai/ · https://github.com/AgentOps-AI/agentops

| Item | Value |
|---|---|
| License | MIT (self-hostable) |
| Install | Python SDK + single decorator |
| Operation | "**entirely within your own infrastructure**, keeping credential exposure risk inside your own security perimeter" |
| Tracking | **full lifecycle** (initialization → completion) |
| Integrations | CrewAI · Agno · OpenAI Agents SDK · Langchain · AutoGen · AG2 · CamelAI · **Google ADK official** |

→ **Directly aligned with Bagelcode's OSS self-hosting**. Maps 1:1 to our transcript.

### 2B. OpenLLMetry (Traceloop)

URL: https://github.com/traceloop/openllmetry

- LLM observability based on OpenTelemetry
- **Leads the OTel GenAI semantic conventions working group** ★
- Self-hostable

→ **The group that creates the standard itself**. The most authoritative reference for our schema.

### 2C. Langfuse (Clickhouse-acquired 2026-01)

- Fully OSS + self-host
- "**lacks native HITL** (annotation queues, review studios), so ops teams build those layers themselves"

→ Even the standard OSS builds HITL itself. Justifies our own TUI.

### 2D. Phoenix (Arize, MIT)

- Postgres backed, local-first
- Lightweight, visual UI

### 2E. Helicone

- proxy-based, OSS, $25/mo flat or free tier
- API-level

### 2F. Datadog LLM Observability (SaaS but standards-aligned)

- enterprise SaaS
- **Native OTel GenAI support** ★
- Compatible if Bagelcode already uses Datadog

---

## 3. ★ OpenTelemetry GenAI Semantic Conventions = 2026 standard

URL: https://opentelemetry.io/docs/specs/semconv/gen-ai/

### Key quotes (verbatim)

> "Semantic Conventions for Generative AI focus on capturing insights into AI model behavior through three primary signals: **Traces, Metrics, and Events**."

> "establishes a standard schema for tracking **prompts, model responses, token usage, tool/agent calls, and provider metadata**."

> "actively developing semantic conventions for **multi-agent systems, covering tasks, actions, agent teams, memory, and artifact tracking**."

### Core standard attributes (Crumb alias mapping)

```jsonc
// Our transcript.jsonl              OTel GenAI alias
{
  "id": "01J9X4...",            // → span_id
  "ts": "2026-05-02T...",       // → start_time_unix_nano
  "session_id": "abc",          // → gen_ai.conversation.id
  "from": "planner",            // → gen_ai.agent.name
  "to": "builder",              // → gen_ai.agent.target
  "kind": "spec",               // → gen_ai.operation.name
  "data": {
    "model": "claude-opus-4-7",          // → gen_ai.request.model
    "tokens_in": 5000,                   // → gen_ai.usage.input_tokens
    "tokens_out": 1500,                  // → gen_ai.usage.output_tokens
    "cache_read": 4500,                  // → gen_ai.usage.cache_read_tokens
    "tool_calls": [...],                 // → nested gen_ai.tool.call spans
    "artifacts": [{"path", "sha256"}]    // → gen_ai.artifact.* (experimental)
  }
}
```

→ **Field-name alias mapping only (10 lines)**. Standards compatibility while keeping the transcript schema as is.

### Adopting platform matrix

| Platform | OTel GenAI compatibility | Our application |
|---|---|---|
| Datadog LLM Observability | ✅ native | export possible |
| Google Vertex AI Agent Builder | ✅ official | export possible |
| Anthropic Claude Console | ✅ JSON-compatible (estimated) | export possible |
| OpenLLMetry / Traceloop | ✅ leads the working group | export possible |
| Phoenix / Langfuse / AgentOps | ✅ export/import | export possible |

→ **Even though we build our own, we can migrate to any platform.**

### Status (as of 2026-03)

> "As of March 2026, most GenAI semantic conventions are in **experimental status**, meaning the API isn't fully stabilized yet."

→ Aware that field names may change. With our alias layer isolating it, the change impact is ε.

---

## 4. Academic / industry standards (NeurIPS 2026)

### NeurIPS 2026 Evaluations & Datasets Track

> "renamed the Evaluations & Datasets (ED) Track, with an expanded scope that explicitly positions evaluation as a scientific object of study. The track now includes... auditing, red-teaming methods, **interaction protocols**, metrics, and experimental or qualitative study designs."

→ **interaction protocols** is explicitly named. The Crumb transcript schema falls into that category.

### awesome-ai-agent-papers (VoltAgent)
URL: https://github.com/VoltAgent/awesome-ai-agent-papers

> "core topics: multi-agent coordination, memory & RAG, tooling, **evaluation & observability**, security"

→ An active 2026 area.

---

## 5. Common dimensions across the 5 frontier studios

```
Common 5 dimensions across all frontier (Vertex / Anthropic / AgentOps / Phoenix / Langfuse):

  1. Token consumption (in / out / cache)
  2. Latency (per turn / per tool call)
  3. Error rate (failure / retry)
  4. Tool calls timeline (with arguments / responses)
  5. Cost (model billing)

Distinctive dimensions:
  6. Replay with modifications     (Anthropic only)
  7. Multi-turn auto-rater          (Google)
  8. Reasoning path visualization   (Google Unified Trace Viewer)
  9. Sandbox / permission audit     (Anthropic gVisor)
```

→ **Our TUI 4 panes + summary.html + optional web observer cover all of 1-9.** Built ourselves but with the same information layer as the frontier.

---

## 6. Crumb alignment mapping

### The 4 Anthropic Claude Managed patterns → Crumb

| Anthropic | Crumb |
|---|---|
| timeline UI | TUI top pane + summary.html |
| tool call click → args/responses | Enter key → expand |
| **replay with modifications** | `crumb replay <id>` + slash command modify |
| gVisor sandbox + `/workspace` RW + `/source` RO | `--dangerously-skip-permissions` + cwd sandbox + `--add-dir` |
| network default-deny | adapter subprocess env sanitization |

### The 5 Google Vertex dimensions → Crumb studio

| Vertex | Crumb |
|---|---|
| Token consumption | TUI metrics + summary.html cost breakdown |
| Latency | TUI sparkline + summary.html per-turn chart |
| Error rates | TUI status + audit log |
| Tool calls timeline | TUI timeline + summary.html replay |
| OTel-compliant | transcript.jsonl alias |

### AgentOps SDK pattern → Crumb's own variant

| AgentOps | Crumb |
|---|---|
| Python SDK + decorator | Direct in TS SDK (own implementation) |
| Self-infrastructure operation | file-based local |
| Full lifecycle tracking | transcript.jsonl as the single source |
| Google ADK integration | (N/A, our tools are Claude/Codex) |

---

## 7. Decision — Crumb's OTel alias pattern

### Build our own + standards compatible = strongest position

```
┌─────────────────────────────────────────────────────────┐
│  Crumb transcript.jsonl                                   │
│   ├── our own schema (id, ts, from, to, kind, data)       │
│   └── OTel alias layer (10 LOC)                           │
│                                                           │
│  $ crumb export --format otel-jsonl                       │
│       → Langfuse / Phoenix / Datadog / Vertex anywhere    │
│                                                           │
│  $ crumb export --format anthropic-trace                  │
│       → Claude Console import (compatible format)         │
└─────────────────────────────────────────────────────────┘
```

### Evaluator-facing message (one README paragraph)

> "Crumb's observability is built in-house (transcript.jsonl + blessed TUI + summary.html), aligned with Bagelcode's OSS self-hosting pattern (Metabase / Superset / DataHub). At the same time, the schema is aliased with **OpenTelemetry GenAI Semantic Conventions** (compatible with Datadog / Google Vertex / OpenLLMetry / Phoenix) — built in-house yet standards-compatible. `crumb export --format otel-jsonl` enables migration to any platform. The 5 common dimensions across 5 frontier studios (token / latency / error / tool / cost) are all covered."

→ **Justification for building our own + standards compatibility + future path = compressed into one paragraph.**

---

## Primary sources (15 links)

### Big-tech platforms
- [Anthropic Claude Console Studio](https://console.anthropic.com/studio)
- [Anthropic Workbench](https://platform.claude.com/workbench)
- [Anthropic Managed Agents launch (SiliconANGLE 2026-04-08)](https://siliconangle.com/2026/04/08/anthropic-launches-claude-managed-agents-speed-ai-agent-development/)
- [Anthropic Managed Agents Studio guide (MindStudio)](https://www.mindstudio.ai/blog/claude-managed-agents-dashboard-guide)
- [Google Vertex AI Agent Builder docs](https://docs.cloud.google.com/agent-builder/overview)
- [Google Vertex observability (VentureBeat)](https://venturebeat.com/ai/the-agent-builder-arms-race-continues-as-google-cloud-pushes-deeper-into)
- [Gemini Enterprise Agent Platform (Cloud Next 2026, SiliconANGLE)](https://siliconangle.com/2026/04/22/google-brings-agentic-development-optimization-governance-one-roof-gemini-enterprise-agent-platform/)
- [Microsoft Agent Framework 1.0](https://devblogs.microsoft.com/agent-framework/microsoft-agent-framework-version-1-0/)

### Standards
- [OpenTelemetry GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [GenAI agent spans (OTel)](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/)
- [GenAI events](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-events/)
- [Datadog LLM Observability + OTel GenAI](https://www.datadoghq.com/blog/llm-otel-semantic-convention/)
- [OpenLLMetry (Traceloop, OTel-based)](https://github.com/traceloop/openllmetry)

### OSS
- [AgentOps GitHub (MIT)](https://github.com/AgentOps-AI/agentops)
- [AgentOps + Google ADK official integration](https://google.github.io/adk-docs/observability/agentops/)
- [Best AI Observability Tools 2026 (Arize)](https://arize.com/blog/best-ai-observability-tools-for-autonomous-agents-in-2026/)
- [8 AI Observability Platforms compared (Softcery)](https://softcery.com/lab/top-8-observability-platforms-for-ai-agents-in-2025)

### Academic
- [NeurIPS 2026 Evaluations & Datasets Track](https://blog.neurips.cc/2026/03/23/introducing-the-evaluations-datasets-track-at-neurips-2026/)
- [awesome-ai-agent-papers (VoltAgent)](https://github.com/VoltAgent/awesome-ai-agent-papers)

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-stack-and-genre-2026]] — alignment with Bagelcode OSS self-hosting
- [[bagelcode-frontier-orchestration-2026]] — sister: orchestration patterns
- [[bagelcode-production-cases-2026]] — sister: real production cases
- [[bagelcode-fault-tolerance-design]] — gVisor / circuit breaker patterns
- [[bagelcode-transcripts-schema]] — target of OTel alias application
- [[bagelcode-rubric-scoring]] — alignment with the 5 studio dimensions
