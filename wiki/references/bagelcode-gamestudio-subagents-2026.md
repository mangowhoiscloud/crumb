---
title: gamestudio-subagents — Claude Code + 12-agent role-play game studio (2026)
category: references
tags: [bagelcode, gamestudio-subagents, claude-code, role-play, prompt-only, single-context, host-harness, byo-agent, 2026]
sources:
  - "https://github.com/pamirtuna/gamestudio-subagents"
  - "[[bagelcode-production-cases-2026]] §E1"
  - "[[bagelcode-mobile-game-tech-2026]] §6 comparison table"
  - "[[bagelcode-verifier-isolation-matrix]] #20"
  - "[[bagelcode-host-harness-decision]] (market validation data for the Crumb decision)"
summary: >-
  pamirtuna/gamestudio-subagents (193 stars, 2026) — a prompt-only game studio that mimics 12 agent
  personas inline solely through Claude Code CLI invocations. Market validation for the Crumb host harness decision +
  the frontier 5 axes that Crumb adds on top (transcript / replay / cross-provider / dynamic mode / single-file).
provenance:
  extracted: 0.65
  inferred: 0.30
  ambiguous: 0.05
created: 2026-05-02
updated: 2026-05-02
---

# gamestudio-subagents — Claude Code + 12-agent role-play game studio

> **URL**: https://github.com/pamirtuna/gamestudio-subagents · **193 stars** · 2026
>
> **Market validation data** for our [[bagelcode-host-harness-decision]] (default = Claude Code skill, host = Claude Code). A case in the same Category C (light layer on top of a host harness) pattern, sharpened to the extreme of being prompt-only. Crumb's frontier 5 axes are the differences layered on top.

---

## 1. One-line definition

**A prompt-only game studio that mimics 12 agent roles purely through one-line Claude Code CLI invocations.** No separate runtime, no Task tool, no transcript. Every "agent" only activates when the user explicitly writes `claude "Read agents/<role>.md ..."` — Claude reads that markdown and acts inline as the persona.

---

## 2. Invocation pattern

```bash
# Step 1: project init
python scripts/init_project.py
# → user prompt: project name, engine (Godot/Unity/Unreal), mode (Design/Prototype/Full)
# → creates projects/<name>/{agents,documentation,source,qa,builds,project-config.json}

# Step 2: agent invocation — each time the user explicitly names which agent to activate via prompt
claude "Read agents/market_analyst.md and project-config.json in projects/<name>...
        do competitive analysis for match-3 puzzle space-themed."

# Step 3: progress management
python scripts/project_manager.py status <name>     # 🟢/🟡/🔵/✅/❌
python scripts/project_manager.py resume <name>
python scripts/project_manager.py freeze <name>
python scripts/project_manager.py startover <name>
```

→ **The user writes the dispatch routing itself as a prompt.** No automatic routing. ^[extracted]

---

## 3. The 12 agent definitions

```
agents/                              ← project-agnostic 12 markdown personas
├── master_orchestrator.md           system coordinator, project init
├── producer.md                       timeline / quality management
├── market_analyst.md                 competitor / market analysis
├── data_scientist.md                 analytics, A/B test
├── sr_game_designer.md               vision / system architect
├── mid_game_designer.md              content implementation
├── mechanics_developer.md            core gameplay engineer
├── game_feel_developer.md            polish, juice
├── sr_game_artist.md                 art director
├── technical_artist.md               shader, VFX
├── ui_ux_agent.md                    interface
└── qa_agent.md                       testing + verification

projects/<name>/agents/              ← project-specific override (12 copies + customize)
```

Each markdown = a system-prompt fragment instructing Claude to act as that persona. **No mandatory structure like the sandwich 4-section pattern.** The essence is role-play instructions. ^[extracted]

---

## 4. Coordination — 100% delegated to Claude inline reasoning

WebFetch verbatim:
> "**No explicit MCP or Tool reference** mentioned; relies on Claude's ability to read markdown agent definitions from filesystem and coordinate via conversation."

→ **No Task tool spawn. No subprocess. No MCP server.** Cooperation among the 12 agents happens inside a single Claude session as Claude reads all 12 markdown files and self-converses while switching personas inline. Isomorphic to the [[bagelcode-frontier-orchestration-2026]] §B Cognition "**single thread context**" stance. ^[extracted]

---

## 5. State / persistence — filesystem only

```
projects/<name>/
├── project-config.json              coding standard, engine, mode, rules
├── documentation/
│   ├── design/                      GDD, mechanics
│   ├── art/                         style guide
│   └── production/                  timeline
├── source/                          engine-specific (Godot scenes/, Unity Assets/, ...)
├── qa/                              test plan, bug report
└── builds/                          export
```

- transcript ❌ / session ❌ / append-only ❌
- `project_manager.py` status = directory marker (🟢/🟡/🔵), no persistence beyond that
- Every `claude` call = **fresh context**
- Resume = "re-read the last artifact, then the user types the next-step prompt by hand" ^[inferred]

---

## 6. The 3 modes — locked at `init` time

| Mode | Active agents | Output | Trigger |
|---|---|---|---|
| **Design** | Market Analyst + Sr Designer + Sr Artist | design doc + market validation + art direction (no implementation) | user choice during `init_project.py` |
| **Prototype** | Design + a subset of Engineering | playable prototype + telemetry + feasibility | same |
| **Development** | All 12 agents | finished game + data-driven iteration + QA + launch | same |

→ **Mode is locked at init.** Cannot be escalated mid-run. Conflicts with [[bagelcode-production-cases-2026]] §B1 Lanham's "**start single → expand incrementally**" recommendation. ^[inferred]

---

## 7. Tech stack

- **Language**: Python 3.8+
- **Orchestration interface**: Claude Code CLI (`npm install -g @anthropic-ai/claude-code` + `claude auth login`)
- **Diagram**: Mermaid (Node.js)
- **Version control**: Git
- **Target engines**: Godot, Unity, Unreal, custom
- **AI backbone**: Claude (Anthropic)
- **Auth**: Claude Code CLI's own OAuth → uses the Max plan subscription as-is ✅
- **Dependencies**: none (no `package.json`, no `requirements.txt`) — only Python `scripts/` ^[extracted]

---

## 8. Routing / orchestration topology

```
User Input (natural language + explicit active agent)
    ↓
Master Orchestrator (selects agents based on mode/project)
    ↓
Producer Agent (coordinates parallel workflows)
    ├→ Market Analyst (Phase 1: Go/No-Go)
    ├→ Design Team (Sr / Mid Designer)
    ├→ Engineering Team (Mechanics / Game Feel)
    ├→ Art Team (Sr Artist / Technical Artist / UI/UX)
    ├→ Data Scientist (analytics, A/B test)
    └→ QA Agent (telemetry-based testing)
    ↓
Continuous Loop: Data Collection → Data Scientist → Market Analyst → Producer Optimization
    ↓
Launch + Post-Launch Monitoring
```

**No inter-agent RPC.** Orchestration happens because Claude:
1. reads every agent role markdown
2. infers workflow dependencies from project-config.json
3. coordinates tasks via natural-language prompts ^[extracted]

---

## 9. From the Crumb perspective — the same nutrients (borrowed ideas)

| Idea | gamestudio | Crumb |
|---|---|---|
| Claude Code = host harness | `claude "..."` invocation | `.claude/skills/crumb/SKILL.md` trigger |
| markdown agent definition | `agents/<role>.md` × 12 | `agents/{coordinator,planner-lead,engineering-lead,...}.md` × 4 + specialists × 5 |
| project-config separation | `project-config.json` | `.crumb/config.toml` + presets |
| Python helper script | `init_project.py`, `project_manager.py` | `npx tsx src/index.ts run\|replay\|event\|ls\|doctor` |
| mode variants | Design / Prototype / Full | `--solo` / `--standard` / `--rigorous` / `--parallel` |
| domain = casual games | match-3 example | 60s match-3 cat example |

→ Vendor-side validation data for Crumb's [[bagelcode-host-harness-decision]]. **1:1 idea match = the Crumb decision is consistent with a market-validated pattern.** ^[inferred]

---

## 10. From the Crumb perspective — six places we deliberately diverge

| Dimension | gamestudio | **Crumb** | Reason for divergence (source) |
|---|---|---|---|
| Number of agents | 12 | **4 external + N internal steps** | [[bagelcode-production-cases-2026]] §B1 Lanham "start single, escalate" |
| Coordination | Claude inline conversation (single context) | **Task tool spawn (depth=1) + JSONL transcript** | [[bagelcode-frontier-orchestration-2026]] §I MAR (degeneration-of-thought) |
| Persistence | filesystem directory only | **transcript.jsonl append-only + ULID + 38 kinds** | replay determinism + audit trail + crash recovery |
| Replay | none | **`crumb replay <session-dir>` = reconstructs identical state** | reducer (state, event) → effects pure function |
| Mode | locked at init | **CLI flag dynamic** | "planner natural-language escalate" — mode change possible mid-turn |
| Provider | Claude only | **`--cross-provider` opt-in (Codex + Claude)** | [[bagelcode-verifier-isolation-matrix]] C2 cross-provider academic backbone |
| Output | engine-specific binary (Godot/Unity/Unreal) | **single-file HTML5 (Phaser CDN)** | zero evaluator setup + blocks the one-shot-attempt risk |

→ **Core abstraction difference**:
```
gamestudio = "12 markdown personas + Claude inline self-conversation"
            (no control plane of its own — the Claude session itself is the control plane)

Crumb     = "4 sandwich actors + Task subagent + JSONL control plane"
            (the control plane is outside the LLM layer = ToS-independent = the freedom is the essence)
```

The [[bagelcode-system-architecture]] §6 "Control plane vs LLM layer responsibility split" table is the matrix that pins down exactly this difference. ^[inferred]

---

## 11. The 5 limitations of gamestudio — the gaps Crumb fills

### L1. No transcript / audit trail
Bagelcode recruitment-mail verbatim "**planners have agents build the game**" → no way to trace AI decision chains. **Crumb**: `transcript.jsonl` 38 kinds + `crumb replay`. ^[inferred]

### L2. Single-context inline = no MAR/CP-WBFT academic backing
12 personas self-conversing inside one Claude session = a direct hit by [[bagelcode-frontier-orchestration-2026]] §I MAR "**degeneration-of-thought**". **Crumb**: Verifier sandwich split + the Lanham 0.32→0.89 pattern when `--cross-provider` is on.

### L3. Weak crash recovery / pause-resume
`project_manager.py freeze/resume` = directory markers only, with no recovery of an in-flight turn. **Crumb**: pure reducer → state machine → identical reducer across the live/replay/test loop variants.

### L4. Mode locked at init = no escalation
Design → Prototype → Full transitions are only possible via a fresh init by the user. **Crumb**: `--solo` → `--standard` → `--rigorous` → `--parallel` CLI flags, escalation possible even via mid-turn user intervention.

### L5. Engine-specific binary = heavy evaluator setup
Godot/Unity/Unreal export → the evaluator must install the engine and import the project. **Crumb**: Phaser CDN single-file HTML → just a double-click.

→ **The 5 limitations map to the 5 axes of [[bagelcode-frontier-rationale-5-claims]]'s 5 frontier claims.** gamestudio = production validation, Crumb = the 5 frontier axes applied on top. ^[inferred]

---

## 12. Auth / runtime — exactly Category C ([[bagelcode-host-harness-decision]] matrix)

| Dimension | Value |
|---|---|
| Prerequisites | Git / Python 3.8+ / Node.js (Mermaid) / `npm install -g @anthropic-ai/claude-code` + `claude auth login` |
| Auth mechanism | Claude Code CLI's own OAuth (1st-party) |
| Subscription compatibility | ✅ Max plan usable as-is |
| 2026-04-04 enforcement | ✅ unaffected (CLI subprocess invocation = indistinguishable from a user's direct invocation) |
| Own web UI | ❌ none (terminal only) |
| Without Claude Code installed | 0% functional (no mock) ← **Crumb's differentiator** |

→ **Continues to work after the 2026-04-04 enforcement.** Not an external tool stealing OAuth tokens, but the user invoking `claude` from their own terminal + Python scripts assisting the call + markdown files providing prompt material. No surface for Anthropic to block. ^[inferred]

---

## 13. Anticipated evaluator questions — preemptive answers (suggested)

> "gamestudio-subagents (193 stars, 2026) is the production validation of prompt-only orchestration on top of Claude Code. Same Category as our [[bagelcode-host-harness-decision]] decision — Claude Code's own OAuth + a light layer (markdown agents + Python scripts). Crumb adds 5 frontier claims on top: (1) **transcript JSONL with 38 kinds** — decision audit trail (gamestudio has none), (2) **pure reducer + deterministic replay** — crash recovery (gamestudio has none), (3) **`--cross-provider` opt-in** — MAR/CP-WBFT academic backing (gamestudio is Claude only), (4) **dynamic mode CLI flag** — Lanham start-single-escalate (gamestudio locks it at init), (5) **single-file HTML output** — zero evaluator setup (gamestudio is engine-specific). gamestudio = production validation, Crumb = the 5 frontier axes on top."

---

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-host-harness-decision]] — the Category C decision (gamestudio = market validation)
- [[bagelcode-production-cases-2026]] §E1 — gamestudio's position in the comprehensive comparison
- [[bagelcode-mobile-game-tech-2026]] §6 — comparison table alongside Claude-Code-Game-Studios (49 agents)
- [[bagelcode-verifier-isolation-matrix]] #20 — QA Agent isolation ✅ / Claude only ❌
- [[bagelcode-paperclip-vs-alternatives]] — BYO adapter pattern (idea agreement at a different layer)
- [[bagelcode-frontier-orchestration-2026]] §B Cognition single-thread / §I MAR degeneration-of-thought
- [[bagelcode-frontier-rationale-5-claims]] — Crumb's 5 axes mapped against gamestudio's 5 limitations
- [[bagelcode-system-architecture]] §6 — control-plane vs LLM-layer responsibility split table
