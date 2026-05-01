---
title: 베이글코드 과제 — Frontier Observability / Managed Agent / OTel 표준 사료
category: references
tags: [bagelcode, observability, dashboard, otel, managed-agent, frontier, 2026, vertex, anthropic-console, agentops]
sources:
  - "Anthropic Claude Managed Agents (2026-04-08 launch)"
  - "Google Vertex AI Agent Builder / Gemini Enterprise (Cloud Next 2026)"
  - "AgentOps OSS (MIT, AgentOps-AI)"
  - "Microsoft Agent Framework 1.0 (AutoGen 후속)"
  - "OpenTelemetry GenAI Semantic Conventions (de facto 표준)"
  - "OpenLLMetry (Traceloop)"
  - "raw/bagelcode-research/observability-frontier-2026-05.md"
created: 2026-05-02
updated: 2026-05-02
---

# Frontier Observability / Managed Agent / 표준 — 자체 구축 정당화

> **핵심 발견**: **OpenTelemetry GenAI Semantic Conventions = 2026 de facto 표준** (Datadog / Google Vertex / Anthropic / Phoenix / Langfuse / AgentOps 모두 호환).
>
> Crumb 자체 구축이라도 transcript.jsonl 의 schema 를 OTel GenAI 와 alias → **표준 호환 + 0 SaaS 비용 + 향후 어느 platform 으로든 export**.

---

## 1. 빅테크 Managed Agent Platform (2026)

### 1A. Anthropic Claude Managed Agents (2026-04-08 launch, 신선)

> "the first serious attempt by a **frontier model provider** to own the infrastructure layer for agent execution"

| 항목 | 값 |
|---|---|
| Console | https://console.anthropic.com/dashboard |
| Workbench | https://platform.claude.com/workbench |
| Observability | timeline UI, **각 tool call 클릭 → arguments / responses** |
| **Replay** | run modifications + replay → regression debug |
| Sandbox | gVisor isolated container, `/workspace` write + `/source` RO |
| Network | default-deny egress |
| Billing | model token + runtime rate |
| Deploy | Console / Claude Code / 신규 CLI |

**핵심 발화 (verbatim):**
> "The observability UI renders these traces as a **timeline** where you can click into any tool call to see exact arguments and responses, and you can **replay a run with modifications to debug regressions**."

→ **Crumb 의 summary.html 의 inspiration**. 같은 timeline + click expand + replay 패턴.

### 1B. Google Vertex AI Agent Builder → Gemini Enterprise Agent Platform (Cloud Next 2026)

| 항목 | 값 |
|---|---|
| 신명 | Gemini Enterprise Agent Platform (← Vertex AI Agent Builder rebrand) |
| Dashboard | **token consumption / latency / error rates / tool calls** 4-차원 |
| **Unified Trace Viewer** | agent reasoning paths debugging |
| Auto-raters | multi-turn quality 측정 |
| Online evaluation | live traffic |
| 표준 | **OTel-compliant telemetry** (자체 platform 도 표준 채택) |

**핵심 발화 (verbatim):**
> "Using standardized, **OTel-compliant telemetry**, you can verify every agent, tool, and API handoff to ensure accountability, visualize full execution paths, and quickly diagnose reasoning loops or monitor performance metrics."

→ **빅테크 자체도 표준 따른다**. 우리도 따르면 platform-agnostic.

### 1C. Microsoft Agent Framework 1.0 (AutoGen 후속)

- **AutoGen 0.4 → maintenance mode**, MAF 1.0 으로 이전
- streaming + **checkpointing** + HITL approvals + **pause/resume**
- enterprise-ready 후속

→ pause/resume 패턴 우리 `--pause` slash command 와 정합.

### 1D. AutoGen Studio (legacy)

- drag-and-drop UI, playground view
- 우리 TUI 가 더 가벼운 변형

---

## 2. Frontier OSS (Bagelcode 정합)

### 2A. AgentOps (MIT) ★ 가장 정합

URL: https://www.agentops.ai/ · https://github.com/AgentOps-AI/agentops

| 항목 | 값 |
|---|---|
| License | MIT (자체 호스팅 OK) |
| 설치 | Python SDK + 단일 decorator |
| 운영 | "**entirely within your own infrastructure**, keeping credential exposure risk inside your own security perimeter" |
| 추적 | **전체 lifecycle** (initialization → completion) |
| Integrations | CrewAI · Agno · OpenAI Agents SDK · Langchain · AutoGen · AG2 · CamelAI · **Google ADK 공식** |

→ **베이글코드 OSS 자체 호스팅 정조준**. 우리 transcript 와 1:1 mapping 가능.

### 2B. OpenLLMetry (Traceloop)

URL: https://github.com/traceloop/openllmetry

- OpenTelemetry 기반 LLM 관측
- **OTel GenAI semantic conventions working group 리드** ★
- 자체 호스팅 OK

→ **표준 자체를 만드는 그룹**. 우리 schema 의 가장 정통적 reference.

### 2C. Langfuse (Clickhouse-acquired 2026-01)

- 완전 OSS + self-host
- "**lacks native HITL** (annotation queues, review dashboards), so ops teams build those layers themselves"

→ 표준 OSS 도 HITL 은 자체 구축. 우리 자체 TUI 정당화.

### 2D. Phoenix (Arize, MIT)

- Postgres backed, local 우선
- 가벼움, 시각 UI

### 2E. Helicone

- proxy-based, OSS, $25/mo flat or free tier
- API-level

### 2F. Datadog LLM Observability (SaaS but 표준 정합)

- enterprise SaaS
- **OTel GenAI native 지원** ★
- 베이글코드가 이미 Datadog 사용 시 호환

---

## 3. ★ OpenTelemetry GenAI Semantic Conventions = 2026 표준

URL: https://opentelemetry.io/docs/specs/semconv/gen-ai/

### 핵심 발화 (verbatim)

> "Semantic Conventions for Generative AI focus on capturing insights into AI model behavior through three primary signals: **Traces, Metrics, and Events**."

> "establishes a standard schema for tracking **prompts, model responses, token usage, tool/agent calls, and provider metadata**."

> "actively developing semantic conventions for **multi-agent systems, covering tasks, actions, agent teams, memory, and artifact tracking**."

### 표준 attribute 핵심 (Crumb alias 매핑)

```jsonc
// 우리 transcript.jsonl              OTel GenAI alias
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
    "artifacts": [{"path", "sha256"}]    // → gen_ai.artifact.* (실험)
  }
}
```

→ **field 이름만 alias 매핑 (10줄)**. transcript schema 그대로 유지하면서 표준 호환.

### 채택 platform 매트릭스

| Platform | OTel GenAI 호환 | 우리 적용 |
|---|---|---|
| Datadog LLM Observability | ✅ native | export 가능 |
| Google Vertex AI Agent Builder | ✅ official | export 가능 |
| Anthropic Claude Console | ✅ JSON 호환 (추정) | export 가능 |
| OpenLLMetry / Traceloop | ✅ working group 리드 | export 가능 |
| Phoenix / Langfuse / AgentOps | ✅ export/import | export 가능 |

→ **우리 자체 구축이라도 어느 platform 으로든 마이그레이션 가능**.

### 상태 (2026-03 기준)

> "As of March 2026, most GenAI semantic conventions are in **experimental status**, meaning the API isn't fully stabilized yet."

→ field 이름 변경 가능성 인지. 우리는 alias layer 로 격리하면 변경 영향 ε.

---

## 4. 학술 / 산업 표준 (NeurIPS 2026)

### NeurIPS 2026 Evaluations & Datasets Track

> "renamed the Evaluations & Datasets (ED) Track, with an expanded scope that explicitly positions evaluation as a scientific object of study. The track now includes... auditing, red-teaming methods, **interaction protocols**, metrics, and experimental or qualitative study designs."

→ **interaction protocols** 명시. Crumb transcript schema 가 그 카테고리.

### awesome-ai-agent-papers (VoltAgent)
URL: https://github.com/VoltAgent/awesome-ai-agent-papers

> "core topics: multi-agent coordination, memory & RAG, tooling, **evaluation & observability**, security"

→ 2026 active 영역.

---

## 5. 5 Frontier Dashboard 의 공통 차원

```
모든 frontier (Vertex / Anthropic / AgentOps / Phoenix / Langfuse) 
공통 5 차원:

  1. Token consumption (in / out / cache)
  2. Latency (per turn / per tool call)
  3. Error rate (failure / retry)
  4. Tool calls timeline (with arguments / responses)
  5. Cost (model billing)

특이 차원:
  6. Replay with modifications     (Anthropic 만)
  7. Multi-turn auto-rater          (Google)
  8. Reasoning path visualization   (Google Unified Trace Viewer)
  9. Sandbox / permission audit     (Anthropic gVisor)
```

→ **우리 TUI 4 pane + summary.html + 옵션 web observer 가 1-9 모두 cover.** 자체 구축이지만 frontier 와 같은 정보 layer.

---

## 6. Crumb 의 정합 매핑

### Anthropic Claude Managed 의 4 패턴 → Crumb

| Anthropic | Crumb |
|---|---|
| timeline UI | TUI top pane + summary.html |
| tool call click → args/responses | Enter 키 → expand |
| **replay with modifications** | `crumb replay <id>` + slash command modify |
| gVisor sandbox + `/workspace` RW + `/source` RO | `--dangerously-skip-permissions` + cwd sandbox + `--add-dir` |
| network default-deny | adapter subprocess env sanitization |

### Google Vertex 의 5 차원 → Crumb dashboard

| Vertex | Crumb |
|---|---|
| Token consumption | TUI metrics + summary.html cost breakdown |
| Latency | TUI sparkline + summary.html per-turn chart |
| Error rates | TUI status + audit log |
| Tool calls timeline | TUI timeline + summary.html replay |
| OTel-compliant | transcript.jsonl alias |

### AgentOps 의 SDK 패턴 → Crumb 의 자체 변형

| AgentOps | Crumb |
|---|---|
| Python SDK + decorator | TS SDK 안에 직접 (자체 구현) |
| 자체 인프라 운영 | file-based local |
| 전체 lifecycle 추적 | transcript.jsonl 단일 source |
| Google ADK 통합 | (해당 없음, 우리 도구는 Claude/Codex) |

---

## 7. 결정 — Crumb 의 OTel alias 패턴

### 자체 구축 + 표준 호환 = 가장 강한 위치

```
┌─────────────────────────────────────────────────────────┐
│  Crumb transcript.jsonl                                   │
│   ├── 우리 자체 schema (id, ts, from, to, kind, data)     │
│   └── OTel alias layer (10 LOC)                           │
│                                                           │
│  $ crumb export --format otel-jsonl                       │
│       → Langfuse / Phoenix / Datadog / Vertex 어디로든    │
│                                                           │
│  $ crumb export --format anthropic-trace                  │
│       → Claude Console import (호환 형식)                  │
└─────────────────────────────────────────────────────────┘
```

### 평가자 메시지 (README 한 단락)

> "Crumb 의 observability 는 자체 구축 (transcript.jsonl + blessed TUI + summary.html), Bagelcode 의 OSS 자체 호스팅 패턴 (Metabase / Superset / DataHub) 정합. 동시에 schema 는 **OpenTelemetry GenAI Semantic Conventions** (Datadog / Google Vertex / OpenLLMetry / Phoenix 모두 호환) 와 alias — 자체 구축이지만 표준 호환. `crumb export --format otel-jsonl` 로 어느 platform 이든 마이그레이션 가능. 5 frontier dashboard 의 5 공통 차원 (token / latency / error / tool / cost) 모두 cover."

→ **자체 구축의 정당화 + 표준 호환 + 향후 path = 한 단락에 압축**.

---

## 1차 사료 (15 links)

### 빅테크 platform
- [Anthropic Claude Console Dashboard](https://console.anthropic.com/dashboard)
- [Anthropic Workbench](https://platform.claude.com/workbench)
- [Anthropic Managed Agents launch (SiliconANGLE 2026-04-08)](https://siliconangle.com/2026/04/08/anthropic-launches-claude-managed-agents-speed-ai-agent-development/)
- [Anthropic Managed Agents Dashboard guide (MindStudio)](https://www.mindstudio.ai/blog/claude-managed-agents-dashboard-guide)
- [Google Vertex AI Agent Builder docs](https://docs.cloud.google.com/agent-builder/overview)
- [Google Vertex observability (VentureBeat)](https://venturebeat.com/ai/the-agent-builder-arms-race-continues-as-google-cloud-pushes-deeper-into)
- [Gemini Enterprise Agent Platform (Cloud Next 2026, SiliconANGLE)](https://siliconangle.com/2026/04/22/google-brings-agentic-development-optimization-governance-one-roof-gemini-enterprise-agent-platform/)
- [Microsoft Agent Framework 1.0](https://devblogs.microsoft.com/agent-framework/microsoft-agent-framework-version-1-0/)

### 표준
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

### 학술
- [NeurIPS 2026 Evaluations & Datasets Track](https://blog.neurips.cc/2026/03/23/introducing-the-evaluations-datasets-track-at-neurips-2026/)
- [awesome-ai-agent-papers (VoltAgent)](https://github.com/VoltAgent/awesome-ai-agent-papers)

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-stack-and-genre-2026]] — Bagelcode OSS 자체 호스팅 정합
- [[bagelcode-frontier-orchestration-2026]] — sister: orchestration 패턴
- [[bagelcode-production-cases-2026]] — sister: 실 production 사례
- [[bagelcode-fault-tolerance-design]] — gVisor / circuit breaker 패턴
- [[bagelcode-transcripts-schema]] — OTel alias 적용 대상
- [[bagelcode-rubric-scoring]] — 5 차원 dashboard 차원과 정합
