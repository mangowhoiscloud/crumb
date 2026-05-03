---
title: Bagelcode — 신작팀 (New Title Team) AI Developer Recruitment Task
type: project
category: project-hub
tags: [bagelcode, recruitment, multi-agent, task-2026-05]
sources:
  - "Bagelcode recruiting team mail (2026-05-01)"
  - "https://career.bagelcode.com/ko/o/208045"
  - "https://www.bagelcode.com/article/bagelcode-x-ai-genie-..."
  - "https://www.bagelcode.com/article/ai-first-wiht-bagles-..."
created: 2026-05-01
updated: 2026-05-01
---

# Bagelcode — 신작팀 (New Title Team) AI Developer Recruitment Task (codename: **Crumb**)

> **Deadline 2026-05-03 23:59**. Build a multi-agent collaboration tool with an AI coding agent. One attempt within the deadline.
>
> Project codename **Crumb** = (1) bagel crumb (Bagelcode brand motif), (2) **breadcrumb pattern** (LLM agent standard path tracing), (3) transcript trail. → [[bagelcode-naming-crumb]]

## One line

A recruitment task for the AI developer position at Bagelcode's 신작팀 (New Title Team, mobile casual). Personally design and implement a tool where two or more AI agents communicate and where the user can intervene/observe, then submit code + `.md` + session log/recording.

## Key schedule

| Item | Value |
|---|---|
| Mail received | 2026-05-01 |
| Deadline | **2026-05-03 23:59 KST** |
| Attempts allowed | 1 (no edits) |
| Estimated actual work time | ~25-30 hours |

## References (primary sources)

- [[bagelcode-recruitment-task]] — Recruiting team mail verbatim + evaluation signal inference
- [[bagelcode-job-posting-208045]] — Job posting stub (CSR page body not collected)
- [[bagelcode-davis-system]] — DAVIS internal data assistant (multi-agent case)
- [[bagelcode-ai-first-culture]] — AI-First culture / "agents for agents"
- [[bagelcode-tradingagents-paper]] — TradingAgents (arXiv 2412.20138) — academic basis for communication protocol
- [[bagelcode-frontier-orchestration-2026]] — **11 frontier sources from 2026-05** (Anthropic / Cognition / Magentic-One / AutoGen 0.4 / LangGraph / ALAS / ICML resilience / CP-WBFT / MAR / MAD survey / Claude Code SDK / Codex)
- [[bagelcode-caching-frontier-2026]] — **12 caching/efficiency sources, 3-tier** (Anthropic/OpenAI/Gemini docs + APC + Hierarchical + KVCOMM + ACON + Anchored + cautionary)
- [[bagelcode-xml-frontier-2026]] — **10 XML-in-LLM sources** (Anthropic XML recommendation + Claude Code internal patterns + arXiv 2509 grammar-constrained + arXiv 2510 TAG + format-restriction warnings). System prompt = XML / Wire = JSON / Codex = Markdown policy.
- [[bagelcode-production-cases-2026]] — **12 sources of 2026 production cases** (Anthropic Trends + Lanham "What Survived" + Cursor Composer 2 + Devin/Windsurf merger + RAPS + gamestudio-subagents + Meta/Exa/Minimal cases + MIT decision theory). All 8 of our decisions validated.
- [[bagelcode-mobile-game-tech-2026]] — **13 sources for LLM × mobile game cases + tools/specs** (Lovable mobile 2026-04 / Phaser 94% LLM first-try success / Unity AI 2026 / Godot 4.6 / WebGPU widely available / Coding Leaderboard May 2026). **Decision: Phaser 3.80+ via CDN, single-file game.html.**
- [[bagelcode-stack-and-genre-2026]] — **15 sources of confirmed Bagelcode stack facts + similar genres + Korean competitor cases**. 신작팀 (New Title Team) = **Unity** explicitly. Royal Match (Unity, $1.44B / 2025) + DoubleU Games/Paxie AI workflow ('1-person 3-week launch'). **Crumb's position = a *pre-stage* prototype tool for Unity.**
- [[bagelcode-gamestudio-subagents-2026]] — **gamestudio-subagents standalone reference** (193 stars, 12 agents, prompt-only). Market validation for Crumb's host-harness decision + the 5 frontier axes Crumb stacks on top (transcript / replay / cross-provider / dynamic mode / single-file).
- [[bagelcode-frontier-cli-convergence-2026]] ★ — **8 primary sources for 4 CLI convergence (2026-04)**. Claude Code / Codex / Gemini / OpenCode converge on 7 common primitives (subagents / plan / ask-user / parallel / sandbox / memory / MCP). Frontier-consensus backbone for Crumb v0.1's Multi-host unified entry.
- [[bagelcode-llm-judge-frontier-2026]] ★ — **6 LLM-as-judge frontier sources**. CourtEval ACL 2025 (Grader/Critic/Defender/Re-grader) + G-Eval + Position bias IJCNLP 2025 + Self-bias NeurIPS 2024 + Multi-judge consensus 97-98% F1. Academic backbone for Crumb v0.1's 3-layer scoring.
- [[bagelcode-claude-codex-unity-2026]] — **Claude Code/Codex × Unity cases + reinforcement of our decision framing (14 sources)**. BigDevSoon Void Balls 10-day Steam-ready / 4 Unity MCPs (IvanMurzak 100+, Coplay 86, CoderGamester, Bluepuff71) / Bezi 10× faster / MDPI 2026 LLM Unity limitations. **Conclusion: deliberate avoidance while recognizing production-ready quality + Crumb = a layer above Unity MCP.**
- [[bagelcode-observability-frontier-2026]] — **15 sources for frontier observability + standards**. Anthropic Claude Managed Agents (2026-04-08, timeline + replay) / Google Vertex Unified Trace Viewer / Microsoft Agent Framework 1.0 / AgentOps OSS / **OpenTelemetry GenAI Semantic Conventions = 2026 de facto standard**. Decision: Crumb transcript.jsonl is alias-compatible with the standard + 0 SaaS cost.

## Concepts (spec organization)

- [[bagelcode-transcripts-schema]] — Agent transcripts schema (JSONL append-only, kind vocabulary, user as first-class actor)
- [[bagelcode-caching-strategy]] — Anthropic ephemeral cache + sandwich boundary + token budget
- [[bagelcode-rubric-scoring]] — 5 dimensions × 5 points + token efficiency + Karpathy P4 anti-deception rule
- [[bagelcode-orchestration-topology]] — **Hub-Ledger-Spoke** (PDCA discarded → hierarchical hybrid)
- [[bagelcode-fault-tolerance-design]] — F1-F5 failure taxonomy × recovery primitives (joints/comms/agents)
- [[bagelcode-budget-guardrails]] — Verification → 3-axis runaway-prevention ratchet (count/time/cost) — currently 5 / unimplemented 8 / P0 4 recommended

## Synthesis (decisions)

- [[bagelcode-team-profile]] — 신작팀 (New Title Team) persona + evaluation priorities
- [[bagelcode-kiki-leverage]] — Asset mapping to bring from Kiki/AppMaker
- [[bagelcode-task-direction]] — Concept + tech choices + scope IN-OUT
- [[bagelcode-paperclip-vs-alternatives]] — Paperclip vs Swarm/AutoGen/CrewAI/Agent Squad/own implementation
- [[bagelcode-agents-fixed]] — **Claude Code + Codex fixed** + Cross-provider Verifier (Gemini default)
- [[bagelcode-naming-crumb]] — **Project name Crumb confirmed** (Bagel motif + breadcrumb pattern + transcript trail = triple meaning)
- [[bagelcode-frontier-rationale-5-claims]] — **5 frontier rationales for the 4-actor decision + TradingAgents §4 alignment mapping** (per-claim a/b/c/d decomposition + academic prior + operational layer)
- [[bagelcode-final-design-2026]] — ★ **Final design synthesis** (Lead-Specialists + Socratic + CourtEval + 28 kinds + envelope/handoff/state machine + OTel alias)
- [[bagelcode-identity-files-decomposition-2026-05-02]] ★ — **Identity files lock**: AGENTS.md = universal source (LF AAIF standard), CLAUDE.md / GEMINI.md = host-specific augmentation, `.gemini/settings.json` `contextFileName`. Drop CRUMB.md. All 3 hosts (Claude Code / Codex / Gemini) get a simple setup on any machine.
- [[bagelcode-user-intervention-frontier-2026-05-02]] ★ — **Mail #2 fulfillment + Frontier synthesis**: synthesis of 3 cases — LangGraph interrupt+Command (53/60) + AutoGen UserProxyAgent (41/60) + Paperclip pause/swap (38/60). PR-A (G1 5 user.* event completeness) + PR-B (G3 actor-targeted + G5 per-actor pause + G6 goto/swap/reset_circuit) merged. Mail #2 intervention coverage 60% → ~100%.
- [[bagelcode-system-architecture-v0.1]] ★★ — **canonical v0.1 system architecture lock**. Multi-host 4 entry (Claude Code + Codex + Gemini + headless) + (harness × provider × model) 3-tuple actor binding + ambient fallback + 3-layer scoring + 5 natural-language helpers + Kiki-pattern static dashboard. Replaces v2 [[bagelcode-system-architecture]] §1-§2 figures.

## Core hypotheses

1. **Bagelcode's multi-agent collaboration is an in-progress pain point** — there is no single right answer, so tone is what's evaluated
2. **3-day prototype cycles are the standard** (BagelJam:Dev 2 days, TODOS 3 days)
3. **Two-sided human·agent interface** — CLI/MCP first, fancy UI not a priority
4. **Instructions (.md) are an asset on par with code** — explicitly stated in submission requirements
5. **Claude/Codex/Gemini "all together"** — a signal to avoid vendor lock-in

## Recommended direction (current)

> ⚠️ **2026-05-02 update**: the below is an interim v1-v2 decision. **The final locked decision is [[bagelcode-final-design-2026]]** — the Verifier is not external Gemini but is absorbed as **CourtEval (Grader/Critic/Defender/Re-grader, ACL 2025) inside the Engineering Lead**. For budget caps see [[bagelcode-budget-guardrails]].

**Hub-Ledger-Spoke topology** ([[bagelcode-orchestration-topology]]) + **Claude Code + Codex fixed** ([[bagelcode-agents-fixed]]) + **CourtEval verifier** ([[bagelcode-final-design-2026]]) + **F1-F5 fault tolerance** ([[bagelcode-fault-tolerance-design]]) + **3-axis budget cap** ([[bagelcode-budget-guardrails]]).

The PDCA pipeline was discarded based on ICML 2025 §F (Resilience-Faulty-Agents) results — chain topology = 10.5% degradation + conflict with Cognition's context-fragmentation warning. Reverted to Hierarchical at 5.5%.

## Assets to bring

[[bagelcode-kiki-leverage]] + new frontier borrowings:
- **Sandwich Identity** ([[kiki-appmaker-orchestration]]) → per-agent `.md`
- **Hub-Spoke Routing** ([[hub-spoke-pattern]]) → Orchestrator topology
- **Slack-style Intent + Pipeline Notifier** ([[kiki-slack-integration]]) → user intervention/observation
- **Circuit Breaker** ([[kiki-circuit-breaker]]) → per-adapter health probe
- **Scorecard Guards** ([[kiki-scorecard-guards]]) → borrow C14·C18 guards
- **Magentic-One Task/Progress Ledger** → orchestrator state object
- **ALAS local compensation** → partial retry on environment change
- **ICML Challenger/Inspector** → cross-provider Verifier veto
- **Karpathy 5 principles** — README evaluation signal

## Pending decisions

> Latest state: see [[bagelcode-final-design-2026]] and `~/workspace/crumb/CHANGELOG.md`. The `[x]` markers below were updated as of 2026-05-02.

- [x] Verifier provider final — decided as **CourtEval (inside Engineering Lead, Claude Sonnet 4.6)**. Gemini dropped (cost)
- [ ] Demo recording (1-3 min) — sprint-end task
- [x] Submission GitHub public — `mangowhoiscloud/crumb` repo created (main as of commit `a82ec4c`)
- [ ] [[bagelcode-job-posting-208045]] verbatim body capture (optional; CSR page)
- [x] Game domain — locked to Phaser 3.80 single-file ≤60KB

## Related

- [[kiki]] — Slack behavior observation + multi-agent (original asset)
- [[kiki-appmaker]] — Install/lifecycle + sandwich identity (original asset)
- [[geode]] — Adaptive thinking, agentic loop, prompt system (reference asset)
- [[mango]] — Project lead
- [[index]]
