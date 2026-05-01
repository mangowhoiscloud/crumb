# Raw — Frontier Observability / Managed Agent / OSS / OTel (2026-05-02 수집)

> 6 각도 web search 결과 + 1차 URL. injection 페이지: `projects/bagelcode/references/bagelcode-observability-frontier-2026.md`.

## Search 1 — Google AI Studio / Vertex Agent Builder

### Vertex AI Agent Builder → Gemini Enterprise Agent Platform (Cloud Next 2026 rebrand)

핵심 발화 (verbatim):
> "Google is making it easy to track key agent performance metrics with a dashboard that measures **token consumption, latency, error rates, and tool calls** over time. Within this observability dashboard, enterprises can visualize the actions agents take and reproduce any issues."

> "agent performance dashboards, multi-turn auto-raters for measuring quality, online evaluation for live traffic, and the **Unified Trace Viewer** for debugging agent reasoning paths."

> "Agent Observability delivers turnkey dashboards with automated logging and agent auditing for total oversight. Using **standardized, OTel-compliant telemetry**, you can now verify every agent, tool, and API handoff to ensure accountability, visualize full execution paths, and quickly diagnose reasoning loops or monitor performance metrics."

URLs:
- https://uibakery.io/blog/vertex-ai-agent-builder
- https://docs.cloud.google.com/agent-builder/overview
- https://cloud.google.com/blog/products/ai-machine-learning/more-ways-to-build-and-scale-ai-agents-with-vertex-ai-agent-builder
- https://www.infoworld.com/article/4085736/google-boosts-vertex-ai-agent-builder-with-new-observability-and-deployment-tools.html
- https://siliconangle.com/2026/04/22/google-brings-agentic-development-optimization-governance-one-roof-gemini-enterprise-agent-platform/
- https://venturebeat.com/ai/the-agent-builder-arms-race-continues-as-google-cloud-pushes-deeper-into

## Search 2 — Anthropic Claude Console / Workbench / Managed Agents

### Anthropic Claude Managed Agents (2026-04-08 launch)

핵심 발화 (verbatim):
> "the first serious attempt by a frontier model provider to own the infrastructure layer for agent execution"

> "The Managed Agents dashboard sits inside the Anthropic Console... gives you full visibility into agent sessions, token usage, environment permissions, and credential vaults."

> "The observability UI renders these traces as a **timeline** where you can **click into any tool call to see exact arguments and responses**, and you can **replay a run with modifications to debug regressions**."

> "Each agent runs in a **gVisor-isolated container** on Anthropic infrastructure with **network egress default-deny** and filesystem access scoped to a writable `/workspace` and read-only `/source`."

> "Anthropic's tools include the Claude Console for intuitive building, Claude Code for scripting, and a CLI for command-line deployment, all integrated with Claude models for efficient agent creation."

URLs:
- https://console.anthropic.com/dashboard
- https://console.anthropic.com/workbench
- https://platform.claude.com/workbench
- https://www.mindstudio.ai/blog/claude-managed-agents-dashboard-guide
- https://www.aimagicx.com/blog/claude-managed-agents-cloud-deployment-guide-2026
- https://www.mindstudio.ai/blog/anthropic-managed-agents-dashboard-guide
- https://www.mindstudio.ai/blog/what-is-anthropic-managed-agents
- https://siliconangle.com/2026/04/08/anthropic-launches-claude-managed-agents-speed-ai-agent-development/
- https://blockchain.news/ainews/anthropic-launches-claude-managed-agents-build-and-deploy-via-console-claude-code-and-new-cli-2026-analysis
- https://medium.com/@unicodeveloper/claude-managed-agents-what-it-actually-offers-the-honest-pros-and-cons-and-how-to-run-agents-52369e5cff14

## Search 3 — AgentOps / Helicone / Weave OSS

### AgentOps (MIT, AgentOps-AI)

핵심 발화 (verbatim):
> "AgentOps is a governance and observability platform built for autonomous agents and multi-step reasoning chains that **tracks the entire lifecycle** of an agent from initialization to task completion rather than just logging individual requests."

> "AgentOps is an SDK-based observability architecture with a **single decorator integration** that runs **entirely within your own infrastructure**, keeping credential exposure risk inside your own security perimeter."

Integrations: CrewAI, Agno, OpenAI Agents SDK, Langchain, Autogen, AG2, CamelAI, Google ADK official.

### Helicone

> "Helicone is an open-source tool that provides API-level observability for LLM applications, allowing developers to track and analyze API requests made to models like those of OpenAI."

> "Helicone has built-in caching and **flat $25/mo pricing**."

URLs:
- https://www.agentops.ai/
- https://github.com/AgentOps-AI/agentops
- https://google.github.io/adk-docs/integrations/agentops/
- https://google.github.io/adk-docs/observability/agentops/
- https://arize.com/blog/best-ai-observability-tools-for-autonomous-agents-in-2026/
- https://softcery.com/lab/top-8-observability-platforms-for-ai-agents-in-2025
- https://aimultiple.com/agentops
- https://www.ibm.com/think/topics/agentops

## Search 4 — AutoGen Studio / MS Agent Framework

### AutoGen Studio (legacy, 2023-2026)

> "drag-and-drop UI for agent workflow specification, interactive evaluation and debugging of workflows, and a gallery of reusable agent components"

> "playground view where users can run tasks in a session based on a workflow"

### Microsoft Agent Framework 1.0 (AutoGen 후속)

> "AutoGen is now in maintenance mode and will not receive new features or enhancements, with new users directed to start with Microsoft Agent Framework."

> "MAF is the enterprise-ready successor to AutoGen, providing enterprise-grade multi-agent orchestration, multi-provider model support, and cross-runtime interoperability."

> "the latest AutoGen implementations, multi-agent orchestration patterns support **streaming, checkpointing, human-in-the-loop approvals, and pause/resume** for long-running workflows."

URLs:
- https://github.com/microsoft/autogen
- https://www.microsoft.com/en-us/research/project/autogen/
- https://microsoft.github.io/autogen/0.2/blog/2023/12/01/AutoGenStudio/
- https://microsoft.github.io/autogen/stable/
- https://www.microsoft.com/en-us/research/blog/introducing-autogen-studio-a-low-code-interface-for-building-multi-agent-workflows/
- https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/human-in-the-loop.html
- https://github.com/microsoft/autogen/discussions/5324
- https://devblogs.microsoft.com/agent-framework/microsoft-agent-framework-version-1-0/
- https://www.microsoft.com/en-us/research/publication/autogen-studio-a-no-code-developer-tool-for-building-and-debugging-multi-agent-systems/

## Search 5 — Multi-agent Observability Papers (NeurIPS / ICLR 2026)

### NeurIPS 2026 Evaluations & Datasets Track 신설

> "the Datasets & Benchmarks Track at NeurIPS 2026 has been officially renamed the Evaluations & Datasets (ED) Track, with an expanded scope that explicitly positions evaluation as a scientific object of study. The track now includes processes, practices, tools, and resources for making evaluative claims about AI/ML systems, including datasets, benchmarks, user studies, simulators, auditing, red-teaming methods, **interaction protocols**, metrics, and experimental or qualitative study designs."

URLs:
- https://iclr.cc/virtual/2026/papers.html
- https://github.com/VoltAgent/awesome-ai-agent-papers
- https://neurips.cc/Conferences/2026/CallForEvaluationsDatasets
- https://blog.neurips.cc/2026/03/23/introducing-the-evaluations-datasets-track-at-neurips-2026/
- https://github.com/xinzhel/LLM-Agent-Survey
- https://cua.ai/blog/neurips-2025-cua-papers

## Search 6 — OpenTelemetry GenAI Semantic Conventions ★

### OTel GenAI SIG (April 2024-) — de facto 2026 표준

핵심 발화 (verbatim):
> "Semantic Conventions for Generative AI focus on capturing insights into AI model behavior through three primary signals: **Traces, Metrics, and Events**."

> "OTel GenAI Semantic Conventions establishes a standard schema for tracking **prompts, model responses, token usage, tool/agent calls, and provider metadata**."

> "Developed by the GenAI SIG (Special Interest Group) of OpenTelemetry since April 2024, this standard unifies attribute names, types, and enumeration values for LLM calls, agent steps, vector database queries, token usage, cost tracking, and quality metrics."

> "The OTel GenAI SIG is actively developing semantic conventions for **multi-agent systems, covering tasks, actions, agent teams, memory, and artifact tracking**."

> "As of March 2026, most GenAI semantic conventions are in **experimental status**, meaning the API isn't fully stabilized yet."

### 채택 platform
- Datadog LLM Observability (native 지원)
- Google Vertex AI Agent Builder ("OTel-compliant telemetry")
- OpenLLMetry (Traceloop) — semantic conventions working group 리드
- Phoenix / Langfuse / AgentOps (export/import)

### 표준 attribute 핵심
- `gen_ai.agent.name`
- `gen_ai.operation.name`
- `gen_ai.conversation.id`
- `gen_ai.request.model`
- `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens` / `gen_ai.usage.cache_read_tokens`
- `gen_ai.tool.call`
- nested spans (multi-agent task / actions / teams / memory / artifact)

URLs:
- https://opentelemetry.io/docs/specs/semconv/gen-ai/
- https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/
- https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/
- https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-events/
- https://www.datadoghq.com/blog/llm-otel-semantic-convention/
- https://opentelemetry.io/blog/2024/otel-generative-ai/
- https://github.com/traceloop/openllmetry
- https://www.traceloop.com/docs/openllmetry/contributing/semantic-conventions
- https://openobserve.ai/blog/opentelemetry-for-llms/
- https://dev.to/x4nent/opentelemetry-genai-semantic-conventions-the-standard-for-llm-observability-1o2a

## 5 frontier dashboard 의 공통 5 차원

| 차원 | Vertex | Anthropic Console | AgentOps | Phoenix | Langfuse |
|---|---|---|---|---|---|
| Token consumption | ✅ | ✅ | ✅ | ✅ | ✅ |
| Latency | ✅ | ✅ | ✅ | ✅ | ✅ |
| Error rate | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tool calls timeline | ✅ Unified Trace Viewer | ✅ click→args | ✅ | ✅ | ✅ |
| Cost | ✅ | ✅ | ✅ | (제한) | ✅ |

추가 차원 (frontier 특이):
- Replay with modifications (Anthropic 만)
- Multi-turn auto-rater (Google)
- Reasoning path visualization (Google Unified Trace Viewer)
- Sandbox / permission audit (Anthropic gVisor)

## Crumb 의 정합 (요약)

- self-built (Bagelcode OSS 정합)
- transcript.jsonl + OTel GenAI alias
- 5 차원 dashboard (Vertex / Anthropic 패턴 그대로)
- TUI (P0) + summary.html (P1) + web observer (P2)
- `crumb export --format otel-jsonl` 표준 export
