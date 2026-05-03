---
title: Bagelcode Task — Frontier multi-agent orchestration source index (2025-2026 baseline)
category: references
tags: [bagelcode, frontier, multi-agent, orchestration, fault-tolerance, research-index, 2026]
sources:
  - "Anthropic Engineering blog (2025)"
  - "Cognition blog (2025-06)"
  - "Microsoft Research / AutoGen 0.4 / Magentic-One"
  - "LangChain LangGraph"
  - "arXiv 2025-2026 multi-agent fault tolerance papers"
created: 2026-05-01
updated: 2026-05-01
---

# Frontier Multi-Agent Orchestration — Source Index, 2026-05 Baseline

> A set of 11 frontier sources addressing the Bagelcode task's focal points (**fault response / environmental change / communication robustness**). Per the ICML 2025 resilience paper, a single-line PDCA suffers **23.7% performance degradation (flat peer)** or **10.5% (linear chain)** → discarded. Reverting to **Hierarchical (5.5%)** + adopting validated safeguards.

## Primary sources (vendor / researcher first-hand statements)

### A. Anthropic Engineering — How we built our multi-agent research system (2025)
- URL: https://www.anthropic.com/engineering/multi-agent-research-system
- **Conclusion**: orchestrator-worker beats a single agent by **+90.2%**, with **-90%** time on complex queries
- **Token cost**: agents are 4× chat, multi-agent is **15×** chat → only for high-value tasks
- **Fault handling**: "letting the agent know when a tool is failing and letting it adapt works surprisingly well"
- **State persistence**: durable execution + resume from error point. "restarts are expensive and frustrating"
- **Deployment**: rainbow deployments — old·new versions running simultaneously + gradual traffic shift
- **Memory**: "spawn fresh subagents with clean contexts while maintaining continuity through careful handoffs"
- **Filesystem output**: "Subagent output to a filesystem to minimize the 'game of telephone'" — **only lightweight references passed to the coordinator**
- **Acknowledged limits**: synchronous spawn → bottleneck. Domains with strong dependencies, like coding, are a poor fit for multi-agent.
- **Prompts as the primary tool**: "prompt engineering was our primary lever"

### B. Cognition AI — Don't Build Multi-Agents (2025-06)
- URL: https://cognition.ai/blog/dont-build-multi-agents
- **Counter-position**: "running multiple agents in collaboration only results in fragile systems"
- **Two principles**:
  1. **"Share context, and share full agent traces, not just individual messages"**
  2. **"Actions carry implicit decisions, and conflicting decisions carry bad results"**
- **Claude Code's choice**: "Claude Code as of June 2025 is an example of an agent that spawns subtasks but never does work in parallel" — subagents are **only for answering questions**, not writing code
- **#1 job**: "Context Engineering... is effectively the #1 job of engineers building AI agents"
- **Single-thread superiority**: "context is continuous"

→ **Reconciling Anthropic vs Cognition**: Anthropic addresses **research/exploration** (parallel possible); Cognition addresses **coding** (single-context dominant). **Our task = both**. Reconciliation: "single transcript + hierarchical spawn" ([[bagelcode-orchestration-topology]]).

### C. Microsoft Research — Magentic-One (arXiv 2411.04468)
- URL: https://arxiv.org/abs/2411.04468
- **Structure**: Orchestrator + 4 specialists (WebSurfer, FileSurfer, Coder, ComputerTerminal)
- **2 ledgers**: **Task Ledger** (collects facts/conjectures) + **Progress Ledger** (per-step self-reflect)
- **Re-planning loop**: "plans, tracks progress, and re-plans to recover from errors"
- **Generalist evaluation**: statistically competitive on GAIA, AssistantBench, WebArena
- **Base**: implemented on top of AutoGen (open source)

### D. Microsoft — AutoGen v0.4 (2024-10 preview, 2025 GA)
- URL: https://devblogs.microsoft.com/autogen/autogen-reimagined-launching-autogen-0-4/
- **Key change**: actor model + async event-driven runtime
- **Benefits**: agents can be distributed across processes / languages, dynamic workflows, observability
- **3-layer**: Core (actor) + AgentChat (prototyping) + Extensions
- **Message decoupling**: "decouples how messages are delivered between agents from how agents handle them"

### E. LangChain — LangGraph (2025 enterprise)
- URL: https://www.langchain.com/langgraph
- **Core**: explicit state machine, reducer-driven schema (TypedDict + Annotated)
- **Patterns**: Branching · Conditional Routing · Supervisor · **Reflection** (cyclic critique)
- **Checkpointing**: persistent memory + safe parallel + deterministic replay/audit
- **MCP integration**: full serialization of graph structure / node state / edge transitions / message log

## Secondary sources (academic — fault tolerance / resilience)

### F. ICML 2025 — On the Resilience of LLM-Based Multi-Agent Collaboration with Faulty Agents
- URL: https://openreview.net/forum?id=bkiM54QftZ
- **Fault simulation**: AutoTransform (covertly changes a role) + AutoInject (directly injects errors into messages)
- **2 safeguards**:
  - **Challenger** — an agent challenges another agent's result
  - **Inspector** — an independent agent reviews and corrects messages
- **Recovery**: up to **96.4% recovery** of lost performance
- ★ **Per-topology degradation** (this data is the core of our decision):

| Structure | Degradation rate |
|---|---|
| **Hierarchical A→(B↔C)** | **5.5%** (best) |
| Linear chain | 10.5% |
| Flat peer | **23.7%** (worst) |

→ **PDCA is in fact a chain topology** = 10.5% degradation. We must move to Hierarchical.

### G. arXiv 2511.10400 — Byzantine Fault Tolerance for MAS (CP-WBFT)
- URL: https://arxiv.org/abs/2511.10400
- **CP-WBFT**: confidence probe-based weighted Byzantine FT consensus
- **Result**: stable operation even at **85.7% fault rate**
- **Insight**: "LLM-based agents have a stronger skeptical attitude when handling erroneous message flows" — a natural immune system
- **Application**: weighted voting + abstain option for our Critic

### H. arXiv 2505.12501 — ALAS: Stateful Multi-LLM Disruption Handling
- URL: https://arxiv.org/abs/2505.12501
- **Core**: "**history-aware local compensation**" — on disruption, **avoid global re-planning**, suppress cascading effects
- **Solves 4 LLM defects**: lack of self-verification / context loss / myopia / no state management
- **Automatic state tracking**: each agent maintains its own state, modular orchestration
- **Result**: SOTA on both static and dynamic scenarios

### I. arXiv 2512.20845 — MAR: Multi-Agent Reflexion
- URL: https://arxiv.org/abs/2512.20845
- **Problem with single Reflexion**: "degeneration-of-thought" — repeating the same flawed reasoning
- **MAR**: solved via multi-agent self-critique
- **Result**: HotPotQA 47% EM, HumanEval 82.7%

### J. ICLR 2025 blog — Multi-Agent Debate Reality Check
- URL: https://d2jud02ci9yv69.cloudfront.net/2025-04-28-mad-159/blog/mad/
- **Surprising result**: across 5 MAD frameworks × 9 benchmarks, **MAD consistently fails to beat CoT/SC**
- **No scaling even with increased inference budget**
- → **Warning**: mindlessly adding debate is a token waste. Use debate **only where debate genuinely helps** (fact-checking, value judgments).

## Vendor tool sources (what we'll actually use)

### K. Anthropic — Claude Code Agent SDK (renamed 2025-09)
- URL: https://code.claude.com/docs/en/agent-sdk/overview
- **Headless mode**: CI/CD capable (guarantees our README works)
- **Subagent**: spawn via the `Task` tool, with **depth=1** restriction (no recursive spawn)
- **Versions**: Python 0.1.48 / TS 0.2.71 (as of 2026-03)
- **Swarm Mode (early 2026)**: TeammateTool with 13 ops, launching alongside Sonnet 5

### L. OpenAI — Codex Subagents
- URL: https://developers.openai.com/codex/subagents
- **TOML definition**: `~/.codex/agents/<name>.toml`, required fields `name/description/developer_instructions`
- **Parallelism limits**: `max_threads` default 6, `max_depth` default 1
- **CSV batch**: `spawn_agents_on_csv` — one row = one work item, results auto-aggregated
- **Timeout**: `agents.job_max_runtime_seconds` default 1800
- **Approval flow**: "non-interactive flows, ... action that needs new approval fails and Codex surfaces the error back to the parent workflow"

## Prior sources (already ingested)

- [[bagelcode-tradingagents-paper]] — TradingAgents §4.1-4.2 structured comms protocol
- [[kiki-circuit-breaker]] — per-agent + company-wide circuit breaker (already in production at kiki)
- [[kiki-scorecard-guards]] — C14 (auto-wake after 10 seconds), C18 (reassign to least-loaded peer)
- [[kiki-appmaker-orchestration]] — sandwich §4 routing enforcement footer

## Synthesis (5-point summary)

1. **Single transcript + hierarchical spawn** = the reconciliation point of Anthropic ⊕ Cognition
2. **Chain topology = average 10.5% degradation** → discard PDCA pipeline
3. **Hierarchical = 5.5% degradation** + Challenger·Inspector = 96.4% recovery
4. **ALAS local compensation** = on disruption, **only partial re-execution**, no global retry
5. **Magentic-One Task/Progress Ledger** = an explicit, re-planable state object

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-orchestration-topology]] — topology decision based on this source set
- [[bagelcode-fault-tolerance-design]] — failure classification × recovery primitives
- [[bagelcode-agents-fixed]] — Claude Code + Codex fixed + cross-provider verification
- [[bagelcode-tradingagents-paper]] — academic primary basis for the protocol
- [[bagelcode-paperclip-vs-alternatives]] — framework non-adoption decision (the sources on this page reinforce that decision)
