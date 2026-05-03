---
title: Bagelcode Task — Multi-Host Harness OSS Cases + Crumb CRUMB.md / host entries Final Plan
category: references
tags: [bagelcode, multi-host, harness, identity, claude-code, codex, gemini-cli, bkit, claude-flow, hermes, openclaw, linux-foundation, crumb-md, 2026]
sources:
  - "https://github.com/popup-studio-ai/bkit-claude-code"
  - "https://github.com/ruvnet/claude-flow"
  - "https://github.com/contains-studio/agents"
  - "[[bagelcode-frontier-cli-convergence-2026]]"
  - "[[bagelcode-host-harness-decision]]"
  - "[[bagelcode-system-architecture-v0.1]]"
  - "~/workspace/openclaw/skills/coding-agent/SKILL.md"
  - "~/workspace/openclaw/AGENTS.md"
  - "~/workspace/hermes-agent/AGENTS.md"
  - "https://agents.md (Linux Foundation Agentic AI Foundation)"
summary: >-
  7 multi-host harness cases (bkit / claude-flow / contains-studio / openclaw / hermes / Linux
  Foundation AGENTS.md / gamestudio-subagents) × 6 dimension matrix. Derive Crumb's CRUMB.md universal
  identity + host entries (Claude Code skill / Codex TOML / Gemini extension) final plan.
provenance:
  extracted: 0.65
  inferred: 0.30
  ambiguous: 0.05
created: 2026-05-02
updated: 2026-05-02
---

# Multi-Host Harness OSS Cases + Crumb Final Plan

> **Purpose**: After Crumb evolved into a control harness running on top of Claude Code / Codex / Gemini CLI (v0.1 [[bagelcode-host-harness-decision]] + [[bagelcode-system-architecture-v0.1]]), build a frontier 7-case matrix + adoption / avoidance decisions to determine the **CRUMB.md universal identity + multi-host inject** pattern.
>
> User specification (2026-05-02): "We need to revise the existing .crumb context hierarchy. The previous runtime-native design has too many issues. Build an Identity MD (CRUMB.md) and structure it so that different platform harnesses can inject it."

---

## Part 1 — 7 Cases verbatim Compilation

### A. bkit-claude-code (POPUP STUDIO PTE. LTD., Apache 2.0)

URL: https://github.com/popup-studio-ai/bkit-claude-code

**One-liner**: "The only Claude Code plugin that verifies AI-generated code against its own design specs" via PDCA workflow + gap-detector.

| Item | Value |
|---|---|
| Host harness | **Claude Code v2.1.118+** (exclusive) |
| Multi-host | ❌ |
| Identity files | `bkit.config.json` + `.mcp.json` + `.claude-plugin/` + `memory/` (proprietary) |
| Inject mechanism | **PreToolUse hooks 21 events / 24 blocks** + intent-router |
| Format | JS 97.4% + JSON/YAML config + Markdown docs |
| Directories | `agents/` (36) + `skills/` (43) + `bkit-system/` + `commands/` + `lib/` (142 modules) + `hooks/` + `memory/` + `templates/` + `output-styles/` + `tests/qa/` (4,000+) |

**verbatim core**:
> "CC sandbox → bkit PreToolUse hooks → audit-logger sanitizer (OWASP A03/A08) → Token Ledger NDJSON" — 4-layer defense
> "PDCA state machine — 20 transitions, L0-L4 automation levels, M1-M10 quality gates"
> "Gap-detector enforcement: Design → Implementation, auto-iterator (max 5 cycles until Match Rate ≥ 90%)"
> "226 assertions guarding skill/agent/hook surface across releases"

**Adopt / avoid**:
- ✅ Adopt: PDCA gap-detector idea → aligns with Crumb's verifier CourtEval 4 sub-step (already exists)
- ✅ Adopt: Token Ledger NDJSON → Crumb's transcript.jsonl plays the equivalent role (already exists)
- ✅ Adopt: 226 assertions / quality gates pattern → extension of Crumb's anti-deception 5 rules
- ❌ Avoid: 21 hooks deep integration → breaks multi-host, weakens user control
- ❌ Avoid: proprietary `bkit.config.json` → prefer Linux Foundation AGENTS.md standard
- ❌ Avoid: JS 97.4% core runtime → Crumb is control plane only (TS, light)

### B. claude-flow / Ruflo (ruvnet)

URL: https://github.com/ruvnet/claude-flow

**One-liner**: "The leading agent orchestration platform for Claude" — 100+ specialized AI agents across machines/teams/trust boundaries.

| Item | Value |
|---|---|
| Host harness | Claude Code (single host) |
| Multi-host | ❌ host / ⚠ provider only (5 providers via OpenRouter failover: Claude / GPT / Gemini / Cohere / Ollama) |
| Identity files | AgentDB (vector DB, HNSW indexed) + behavioral trust score |
| Inject mechanism | **27 hooks + 12 auto-triggered workers** ("auto-routing after init") |
| Format | JS + agents/*.md |
| Directories | `.agents/`, `.claude/`, `.claude-plugin/`, `agents/`, `bin/`, `docs/`, `plugin/`, `plugins/`, `ruflo/`, `scripts/`, `tests/`, `v2/`, `v0.1/` |

**verbatim core**:
> "Router → Swarm → Agents pipeline"
> "5 providers with failover" via OpenRouter
> "Behavioral trust scoring: 0.4×success + 0.2×uptime + 0.2×threat + 0.2×integrity"
> "After `init`, just use Claude Code normally — the hooks system automatically routes tasks, learns from successful patterns"
> "32 native plugins" + "swarm topologies: hierarchical, mesh, adaptive"
> "Federated collaboration — zero-trust federation enabling agents across machines/orgs to discover, authenticate, exchange work securely (mTLS + ed25519 + 14-type PII filter)"

**Adopt / avoid**:
- ⚠ Partial adopt: behavioral trust score → similar to Crumb's circuit_breaker (already exists)
- ❌ Avoid: OpenRouter provider failover → Crumb's preset binding is equivalent (user-control-first)
- ❌ Avoid: "auto-routing after init" → Anthropic "wrong tradeoff" lesson + violates user control
- ❌ Avoid: AgentDB vector — no separate transport, transcript is SoT
- ❌ Avoid: federation security (mTLS / ed25519) — out of task scope

### C. contains-studio/agents

URL: https://github.com/contains-studio/agents

**One-liner**: "Claude Code sub-agents collection" — department-specific specialized agents.

| Item | Value |
|---|---|
| Host harness | Claude Code (single host) |
| Multi-host | ❌ |
| Identity files | (none) — each agent file self-identifies via frontmatter |
| Inject mechanism | `cp -r agents/* ~/.claude/agents/` → auto-loaded by Claude Code |
| Format | **pure Markdown + YAML frontmatter** ★ |
| Directories | `engineering/` (7) + `design/` (5) + `marketing/` (7) + `product/` (3) + `project-management/` + `studio-operations/` + `testing/` + `bonus/` |

**verbatim core**:
> "Copy to your Claude Code agents directory: `cp -r agents/* ~/.claude/agents/`"
> Frontmatter: `name` (kebab-case), `description` (3-4 example scenarios), `color`, `tools` (Write, Read, Bash, etc.) + system prompt (500+ words of expertise)
> "studio-coach acts as a proactive coordinator for complex multi-agent tasks"
> "Agents trigger automatically in specific contexts and activate when mentioned explicitly"

**Adopt / avoid**:
- ✅ ✅ Adopt: pure Markdown + YAML frontmatter format (inspiration for Crumb's P0+P1 sandwich conversion)
- ✅ Adopt: 500+ word system prompt + 3-4 example scenarios (rich descriptions)
- ✅ Adopt: name / description / color / tools fields — standard frontmatter
- ❌ Avoid: Claude Code exclusive — Crumb is multi-host

### D. openclaw skills/coding-agent (unrelated to POPUP STUDIO; mariozechner / openclaw itself)

URL: https://github.com/openclaw/openclaw — `skills/coding-agent/SKILL.md` (already cloned at ~/workspace/openclaw)

**One-liner**: "Delegate coding tasks to Codex, Claude Code, or Pi agents via background process. Bash-first."

| Item | Value |
|---|---|
| Host harness | universal (bash subprocess) |
| Multi-host | ✅ ✅ Codex / Claude Code / OpenCode / Pi |
| Identity files | (none — control harness, no state) |
| Inject mechanism | `bash pty:true` subprocess + flag (varies by host) |
| Format | Markdown SKILL.md + frontmatter (name/description/metadata/install) |
| Directories | `skills/coding-agent/` (single SKILL.md) |

**verbatim core**:
> "For Codex/Pi/OpenCode: `pty:true` required (interactive terminal apps)"
> "For Claude Code: `--print --permission-mode bypassPermissions` (no PTY)"
> "**Why workdir matters:** Agent wakes up in a focused directory, doesn't wander off reading unrelated files"
> "Use the right execution mode per agent" — different invocation per host
> 4 host invocation patterns:
> ```
> codex:    bash pty:true command:"codex exec --full-auto 'task'"
> claude:   bash command:"claude --permission-mode bypassPermissions --print 'task'"
> pi:       bash pty:true command:"pi 'task'"
> opencode: bash pty:true command:"opencode run 'task'"
> ```

**Adopt / avoid**:
- ✅ ✅ Adopt: per-host invocation pattern table — state multi-host invocation in Crumb's CRUMB.md
- ✅ Adopt: workdir + background + pty pattern — aligns with `crumb run`'s cwd / detach
- ✅ Adopt: "Use the right execution mode per agent" — user control
- ❌ Avoid: stateless (control only) — Crumb retains transcript SoT

### E. hermes-agent (klingebeil)

URL: ~/workspace/hermes-agent — `AGENTS.md`

**One-liner**: Self-built Python platform — multi-provider AI agent (ACP, MCP, gateway integration).

| Item | Value |
|---|---|
| Host harness | Self-built platform (Python) |
| Multi-host | ✅ provider (Anthropic / OpenAI / Google / OpenRouter / Pi) |
| Identity files | `~/.hermes/config.yaml` + skills/ |
| Inject mechanism | Python prompt builder + cache lock |
| Format | Python + YAML config + Markdown skill |
| Directories | `run_agent.py`, `model_tools.py`, `tools/` (file/web/browser/MCP), `gateway/` (telegram/slack/discord), `hermes_cli/`, `acp_adapter/`, `cron/`, `environments/` |

**verbatim core**:
> "AIAgent Class: model='anthropic/claude-opus-4.6', max_iterations=90, enabled_toolsets=..."
> "Prompt Caching Must Not Break — DO NOT alter past context mid-conversation, change toolsets mid-conversation, reload memories or rebuild system prompts mid-conversation"
> "Skill slash commands: agent/skill_commands.py scans `~/.hermes/skills/`, **injects as user message (not system prompt) to preserve prompt caching**"

**Adopt / avoid**:
- ✅ ✅ Adopt: prompt cache invariant — isomorphic to Crumb's sandwich + transcript prefix cache (already exists)
- ✅ Adopt: skill = user message inject (don't touch system prompt) → Crumb's user.intervene pattern
- ❌ Avoid: self-built Python platform — Crumb is a layer on top of host CLIs

### F. Linux Foundation AGENTS.md Standard

URL: https://agents.md (Linux Foundation Agentic AI Foundation)

**One-liner**: Universal agent instruction file — auto-recognized by Codex / Cursor / Claude Code / OpenCode, etc.

| Item | Value |
|---|---|
| Host harness | universal (spec) |
| Multi-host | ✅ ✅ standard itself |
| Identity files | **`AGENTS.md` (repo root)** ★ |
| Inject mechanism | **Each host auto-loads** (no code, just standard) |
| Format | **pure Markdown** ★ |

**verbatim core** (standard):
> Universal agent instruction file. Codex/Cursor/Claude Code etc. auto-recognize the instructions inside AGENTS.md.
> Recommended headings: Architecture / Style / Forbidden / Required / How to run / Commit & PR Guidelines

**Adopt / avoid**:
- ✅ ✅ ✅ Adopt: **the standard itself** — Crumb's AGENTS.md already follows this pattern (aligned in v0.1, prior turn). CRUMB.md is a sibling on the same pattern
- ✅ Adopt: pure Markdown body + heading hierarchy + imperative tone

### G. gamestudio-subagents (pamirtuna, 193⭐)

Already ingested in [[bagelcode-gamestudio-subagents-2026]]. Summary only:

| Item | Value |
|---|---|
| Host harness | Claude Code (single host) |
| Multi-host | ❌ |
| Identity | 12-agent team — Master Orchestrator + Producer + Market Analyst + Data Scientist + Sr/Mid Game Designer + Mechanics/Game Feel Developer + Sr/Tech Game Artist + UI/UX + QA |
| Inject mechanism | `~/.claude/agents/` auto-load |
| Format | Markdown + YAML frontmatter |
| Directories | 12 sandwiches + workflow JSON |

**Adopt / avoid**:
- ✅ Adopt: market-validated game-domain agent pattern (Crumb specialists are 5/12 compressed)
- ✅ Adopt: Master Orchestrator + Producer pattern = aligns with Crumb's Coordinator + Planner Lead

---

## Part 2 — Matrix Comparison Table (7 cases × 6 dimensions)

| Case | Host | Multi-host | Identity files | Inject mechanism | Format | Crumb adoption |
|---|---|---|---|---|---|---|
| **A. bkit-claude-code** | CC v2.1.118+ | ❌ | proprietary (.claude-plugin/, bkit.config.json, memory/) | 21 hooks + intent-router | JS 97.4% + JSON config | ⚠ partial (PDCA gap, audit pattern) |
| **B. claude-flow / Ruflo** | CC | ❌ host / ⚠ 5 provider failover | AgentDB vector + trust score | 27 hooks + auto workers | JS + agents/*.md | ❌ (auto-routing weakens user control) |
| **C. contains-studio/agents** | CC | ❌ | (frontmatter self-identify) | `~/.claude/agents/` auto | **pure Markdown + YAML** | ✅ ✅ (sandwich format alignment) |
| **D. openclaw skills/coding-agent** | universal bash | ✅ Codex/CC/Pi/OpenCode | (none, control only) | per-host subprocess flag | Markdown SKILL.md | ✅ ✅ (per-host invocation table) |
| **E. hermes-agent** | self-built Python | ✅ provider only | `~/.hermes/config.yaml` | Python builder + cache lock | Python + YAML | ⚠ (prompt cache invariant) |
| **F. Linux Foundation AGENTS.md** | universal | ✅ ✅ standard | **`AGENTS.md` (root)** | each host auto-loads | **pure Markdown** | ✅ ✅ ✅ (already adopted) |
| **G. gamestudio-subagents** | CC | ❌ | (frontmatter self-identify) | `~/.claude/agents/` auto | Markdown + YAML | ✅ (Master Orchestrator pattern) |
| ─────────────────── | ──── | ──── | ──── | ──── | ──── | ──── |
| **Crumb current** | multi-host 4 entries | ✅ Claude/Codex/Gemini/headless | `.claude/skills/crumb/SKILL.md` (CC only) | per-host not unified | Markdown sandwich + TOML preset | — |
| **Crumb recommended** ★ | multi-host | ✅ ✅ | **`CRUMB.md` (root universal)** | **each host references via its own mechanism** | Markdown + frontmatter | F + D + C combined |

---

## Part 3 — 5 Key Findings

### Finding 1 — Only D + F follow the "universal control on top of hosts" pattern

Of the 7 cases, the ones that are truly multi-host (host-level diversity, not provider-level diversity) are:
- **D. openclaw skills/coding-agent** (bash subprocess + per-host flag)
- **F. Linux Foundation AGENTS.md** (standard auto-load)

The remaining 5 cases (A bkit / B claude-flow / C contains-studio / E hermes / G gamestudio) are all **deep integrations on top of a single host** (Claude Code or self-built platform) — supporting only provider diversity.

→ The path Crumb is taking (multi-host control harness) is a **narrow curve at the frontier**. The D + F patterns are the precise fit.

### Finding 2 — The identity file standard = AGENTS.md (Linux Foundation)

- **F**: AGENTS.md (root, universal)
- **A**: proprietary format
- **B / E**: config files (yaml/db)
- **C / G**: agent files self-identify (frontmatter)

→ **AGENTS.md is the de facto standard**. Crumb already has v0.1 AGENTS.md.

→ **CRUMB.md is the sibling file for Crumb-internal identity to AGENTS.md**:
- AGENTS.md = contributor identity (rules when working in this repo)
- CRUMB.md = Crumb runtime identity (host injects this so it recognizes Crumb's identity)

### Finding 3 — pure Markdown + YAML frontmatter accounts for 95% of cases

- C / D / F / G are all pure Markdown
- Only A / B have code (JS) as dominant
- E is Python (separate because it's a self-built platform)

→ Aligns with Crumb's P0+P1 sandwich conversion (XML → Markdown) decision — directly targeting the frontier pattern.

### Finding 4 — Inconsistent inject mechanisms across hosts

Of the 7 cases, **F (AGENTS.md) is the only standard where every host injects identically**. Other hosts use their own mechanisms (Claude Code's `.claude/skills/`, Codex's `~/.codex/agents/*.toml`, Gemini's extension manifest, OpenCode's own config).

→ Crumb's CRUMB.md = pattern of **unified content** + **per-host reference branching**. Each host entry imports / references CRUMB.md.

### Finding 5 — Avoiding bkit's "auto-routing after init" aligns with the Anthropic wrong-tradeoff lesson

claude-flow's "After init, just use Claude Code normally — hooks auto-route" is powerful but violates user control (does not align with Anthropic 2026-03 "wrong tradeoff").

→ Crumb explicitly puts **user control first** (prior decision lock). Avoid hooks deep integration.

---

## Part 4 — Crumb Final Plan

### 4.1 — 3-tier identity structure

```
┌──────────────────────────────────────────────────────────────────┐
│ Tier 1 — Linux Foundation universal standard                       │
│   AGENTS.md (root, already aligned in v0.1)                          │
│     contributor identity — rules when working in this repo           │
│     architecture invariants / build / forbidden / required           │
│     auto-recognized by every host (Codex / Cursor / Claude Code / OpenCode) │
├──────────────────────────────────────────────────────────────────┤
│ Tier 2 — Crumb-specific identity (NEW)                               │
│   CRUMB.md (root)                                                    │
│     Crumb runtime identity — host injects so it recognizes Crumb     │
│     "I am Crumb. Multi-agent harness. Here's my schema, my flow."    │
│     universal — host-agnostic                                         │
├──────────────────────────────────────────────────────────────────┤
│ Tier 3 — Host-specific entries                                       │
│   .claude/skills/crumb/SKILL.md           (Claude Code, exists)       │
│   .codex/agents/crumb.toml                (Codex, NEW)                │
│   .gemini/extensions/crumb/manifest.json  (Gemini, NEW)               │
│   crumb run                                (headless dispatcher itself)│
│   Each entry imports / references CRUMB.md                            │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 — CRUMB.md Blueprint

```markdown
---
name: crumb
description: >-
  Multi-agent execution harness for casual game prototyping. Identity file —
  loaded by host harness entries (.claude/skills/crumb/, .codex/agents/crumb.toml,
  .gemini/extensions/crumb/) so each host injects the same Crumb identity.
type: agent-runtime
universal: true
schema_version: crumb/v0.1
---

# Crumb

(identity, role, 5 actor + 3 specialist + 5 skill flow,
 39 kind transcript schema essentials, user control principle,
 host-by-host entry navigation)
```

Length ~150-200 lines (claude-code style Markdown).

### 4.3 — Host Entries Blueprint

#### Claude Code (already exists)

In the References section of `.claude/skills/crumb/SKILL.md`, add explicit CRUMB.md import:

```markdown
## References (added)
- [CRUMB.md](../../../CRUMB.md) — Crumb identity (universal, common to every host)
- [AGENTS.md](../../../AGENTS.md) — contributor guide (Linux Foundation standard)
- ...
```

#### Codex (NEW)

`.codex/agents/crumb.toml`:

```toml
[meta]
name = "crumb"
description = "Multi-agent execution harness for casual game prototyping"
schema = "crumb/v0.1"

[runtime]
non_interactive = true
max_threads = 6
max_depth = 1

[instructions]
file = "../../CRUMB.md"   # absorbs universal identity
also_load = ["../../AGENTS.md", "../../agents/_event-protocol.md"]

[entry]
trigger = "/crumb"
delegate_to = "crumb run --goal {{prompt}}"
```

#### Gemini CLI (NEW)

`.gemini/extensions/crumb/manifest.json`:

```json
{
  "name": "crumb",
  "version": "0.1.0",
  "description": "Multi-agent execution harness for casual game prototyping",
  "schema": "crumb/v0.1",
  "entry": {
    "type": "command",
    "trigger": "/crumb",
    "command": "crumb run --goal {{args}}"
  },
  "context": {
    "files": ["../../CRUMB.md", "../../AGENTS.md"]
  },
  "commands_dir": "commands/"
}
```

`.gemini/extensions/crumb/commands/crumb.toml`:
```toml
description = "Start a Crumb session for casual game prototyping"
prompt = "Read CRUMB.md, then start: crumb run --goal '{{1}}'"
```

#### Headless dispatcher

Before spawning, `src/loop/coordinator.ts` prepends CRUMB.md to the envelope (or inlines a reference into the sandwich). Since the sandwich already has inline_skills / inline_specialists frontmatter, extend that pattern.

### 4.4 — `.crumb/` context hierarchy realignment (plan only, next step)

User specification: "Add this to the plan too" — not started immediately.

Items to review (when next plan proceeds):
- Redefine the responsibility of `.crumb/config.toml` (Crumb runtime read only, or also host-readable)
- Examine whether the `.crumb/presets/*.toml` schema is host-friendly
- Current runtime-native assumption (preset-loader.ts directly reads .crumb) → potential to restructure as host-layer-aware
- Re-clarify the responsibility boundary among AGENTS.md / CRUMB.md / preset

---

## Part 5 — Adopt / Avoid / New summary

### ✅ Adopt (confirmed)
| Pattern | Source | Crumb application |
|---|---|---|
| AGENTS.md universal identity standard | F (Linux Foundation) | Already aligned in v0.1 (prior turn) |
| pure Markdown + YAML frontmatter sandwich | C (contains-studio) + F | P0+P1 sandwich conversion (prior turn) |
| Per-host invocation table (`pty:true` etc.) | D (openclaw) | Multi-host section in CRUMB.md |
| TOML agent definition (Codex) | D + frontier-cli-convergence | `.codex/agents/crumb.toml` |
| Gemini extension manifest | frontier-cli-convergence | `.gemini/extensions/crumb/manifest.json` |
| 500+ word system prompt + 3-4 example scenarios | C | Rich sandwich description field (reflected in prior-turn conversion) |
| Master Orchestrator + Producer pattern | G (gamestudio-subagents) | Coordinator + Planner Lead (already exists) |
| Prompt cache invariant ("DO NOT alter past context") | E (hermes) | Sandwich + transcript prefix cache (already exists) |

### ❌ Avoid (confirmed)
| Pattern | Source | Reason for avoidance |
|---|---|---|
| 21 hooks deep integration | A (bkit) | Breaks multi-host, weakens user control |
| Proprietary identity file (`bkit.config.json`) | A | Prefer Linux Foundation AGENTS.md standard |
| "Auto-routing after init" hooks | B (claude-flow) | Anthropic "wrong tradeoff" + user control |
| OpenRouter provider failover | B | Preset binding is equivalent, user-control-first |
| AgentDB vector / behavioral trust score | B | Transcript-SoT principle |
| Federation security (mTLS / ed25519) | B | Out of task scope |
| Self-built Python platform | E | Layer on top of host CLIs only |
| JS 97.4% core runtime | A | Control plane only (TS, light) |

### 🆕 New (this plan)
- **CRUMB.md** (root universal identity)
- **.codex/agents/crumb.toml** (Codex entry)
- **.gemini/extensions/crumb/manifest.json + commands/crumb.toml** (Gemini entry)

### ⏸ Deferred (next plan)
- **`.crumb/` context hierarchy realignment** (per user direction — plan only)

---

## Part 6 — Decisions / Items Awaiting Input

Items needing user confirmation:

1. **Lock the 3-tier identity structure?**
   - Tier 1 AGENTS.md (exists) + Tier 2 CRUMB.md (new) + Tier 3 host entries
2. **CRUMB.md location** — repo root vs `.crumb/CRUMB.md`?
   - Recommendation = root (same location as Linux Foundation AGENTS.md, higher discoverability)
3. **Codex / Gemini entry directory** location — repo-root `.codex/` `.gemini/` vs `~/.codex/` `~/.gemini/` (user home)?
   - Recommendation = repo root (committable, automatic in evaluator's environment)
4. **CRUMB.md size** — minimal (~80 lines, identity + reference) vs full (~200 lines, schema/flow/forbidden/required all in)?
   - Recommendation = full (host can run by injection alone, no need to consult separate wiki)
5. **Timing of `.crumb/` context hierarchy realignment** — right after writing CRUMB.md vs in a separate turn?
   - User direction = separate (deferred in this plan)

---

## Part 7 — Additional Context Hierarchy Research (2026-05-02 supplement)

User direction: "Run additional research on this part, then proceed with the implementation as one bundle" — additional reference to bundle `.crumb/` context hierarchy realignment + CRUMB.md authoring together.

### H. Claude Code CLAUDE.md memory system (deepest spec)

URL: https://code.claude.com/docs/en/memory

| Item | Value |
|---|---|
| 4 location scopes | (1) Managed policy `/Library/Application Support/ClaudeCode/CLAUDE.md` — org-wide, MDM/Group Policy distribution, user cannot override / (2) Project `./CLAUDE.md` or `./.claude/CLAUDE.md` — team, source control / (3) User `~/.claude/CLAUDE.md` — personal, every project / (4) Local `./CLAUDE.local.md` — personal-project, gitignored |
| Merge policy | **All discovered files concatenated** (no override). Directory walk-up: starting from `foo/bar/`, both `foo/CLAUDE.md` + `foo/bar/CLAUDE.md` are loaded. Order from filesystem root → working directory. |
| Subdirectory | Nested `CLAUDE.md` = **lazy load** (when read tool is called) |
| `@path` import | `@README` `@docs/git-instructions.md` — 5 hops max recursion. relative paths are based on the importing file. First external import shows approval dialog. |
| AGENTS.md compatibility | "Claude Code reads CLAUDE.md, not AGENTS.md. If your repository already uses AGENTS.md, **create a CLAUDE.md that imports it**: `@AGENTS.md`" |
| `.claude/rules/*.md` | path-scoped (frontmatter `paths: ['src/api/**/*.ts']`) — loaded only when matching files are read. recursive directories OK. symlinks supported. |
| Inject location | "CLAUDE.md content is delivered as **a user message after the system prompt**, not as part of the system prompt itself" |
| Size guidance | target < 200 lines, 25KB limit. larger → recommend path-scoped rules |
| `claudeMdExcludes` | Skip other teams' CLAUDE.md in monorepos. glob pattern. settings.local.json. |
| Auto memory | `~/.claude/projects/<project>/memory/MEMORY.md` — written by Claude itself, first 200 lines / 25KB loaded |

**verbatim core**:
> "All discovered files are concatenated into context rather than overriding each other. Across the directory tree, content is ordered from the filesystem root down to your working directory."
> "CLAUDE.md content is delivered as a user message after the system prompt, not as part of the system prompt itself."
> "If your repository already uses AGENTS.md for other coding agents, create a CLAUDE.md that imports it so both tools read the same instructions without duplicating them."
> "Each file should cover one topic, with a descriptive filename like `testing.md` or `api-design.md`. All `.md` files are discovered recursively."

**Adopt**:
- ✅ ✅ Adopt: `@path` import syntax → CRUMB.md can be referenced via `@CRUMB.md` from per-host entries
- ✅ ✅ Adopt: 4-scope hierarchy (managed / project / user / local) → `.crumb/`'s settings.local.toml pattern
- ✅ Adopt: AGENTS.md → CLAUDE.md import pattern — Crumb does the same (CLAUDE.md imports both AGENTS.md + CRUMB.md)
- ✅ Adopt: nested + lazy load — aligns with the pattern of Crumb sandwich inline-reading specialists
- ⚠ Awareness: "user message after system prompt" — not system prompt. Crumb sandwich is system-prompt inject (follows host's sandwich injection mechanism) — different layer
- ❌ Avoid: auto memory — Crumb's transcript-SoT principle, don't let Claude keep its own memory

### I. Cursor `.cursor/rules/*.mdc`

URL: https://cursor.com/docs

| Item | Value |
|---|---|
| Directory | `.cursor/rules/*.mdc` |
| Format | frontmatter + body + globs (3 parts) |
| 4 types | Always / Auto-attached / Agent-requested / Manual |
| Priority | Root > nested > user (upper overrides lower) |
| Legacy | `.cursorrules` (single file, deprecated) |

**Adopt**:
- ⚠ Partial adopt: 4-type rules (Always / Auto / Agent / Manual) → Crumb sandwich already has Always (host injects) + Auto (specialist inline-read) patterns
- ❌ Avoid: glob pattern path-scoped — Crumb actor-level sandwiches already play that role
- ❌ Avoid: upper-overrides policy — Claude Code's concatenate policy is more frontier

### J. Spec-kit `.specify/` (★ multi-host frontier, 30+ agents)

URL: https://github.com/github/spec-kit

| Item | Value |
|---|---|
| Directory | `.specify/{memory, scripts, specs, templates, extensions, presets}/` |
| Identity file | **`.specify/memory/constitution.md`** — "project's foundational guidelines", referenced by every agent during specification/planning/implementation |
| Multi-host | ✅ ✅ ✅ **30+ AI agents simultaneously** (`specify init <project> --integration {claude|gemini|codex|copilot|cursor}`) |
| Inject mechanism | Agent-specific command files written into each host directory at install (e.g. `.claude/commands/`, `.gemini/commands/`) — slash commands or agent skills mode |
| 4-tier resolution | (1) `.specify/templates/overrides/` (project-local) > (2) `.specify/presets/templates/` > (3) `.specify/extensions/templates/` > (4) `.specify/templates/` (core) — "Templates resolved at runtime — Spec Kit walks the stack top-down, **first match wins**" |
| Slash commands | `/speckit.constitution`, `/speckit.specify`, `/speckit.clarify`, `/speckit.plan`, `/speckit.tasks`, `/speckit.implement` |

**verbatim core**:
> "constitution.md — Located at `.specify/memory/constitution.md`: Created via `/speckit.constitution` command. Contains 'project's foundational guidelines'. Referenced by agents during specification, planning, and implementation."
> "30+ AI agents simultaneously through integration selection at init: `specify init <project> --integration codex|gemini|claude|cursor|copilot`"
> "Agent-specific command files are written to their respective directories (e.g., `.claude/commands/`) at install time, enabling parallel use without conflicts."
> "Templates are resolved at runtime — Spec Kit walks the stack top-down and uses the first match."

**Adopt**:
- ✅ ✅ ✅ Adopt: **multi-host install pattern** (`init --integration <host>` → writes command file into each host directory). Equivalent implementation possible via Crumb's `crumb init --host claude|codex|gemini`
- ✅ ✅ Adopt: **4-tier resolution priority** (overrides > presets > extensions > core, top-down first-match) — isomorphic to Crumb preset-loader's ambient fallback
- ✅ Adopt: `.specify/memory/constitution.md` pattern → CRUMB.md is equivalent (but Crumb recommends placing it at root)
- ✅ Adopt: agent-specific command files (slash commands) → install Crumb's `/crumb` slash command per host
- ⚠ Partial adopt: 6 sub-directories (memory/scripts/specs/templates/extensions/presets) — Crumb is a light control plane; presets/ + memory/ alone suffice

### K. Gemini CLI extensions + GEMINI.md

URL: https://github.com/google-gemini/gemini-cli (some docs ~~~)

| Item | Value |
|---|---|
| Extension directory | `~/.gemini/extensions/<name>/` |
| Identity file | `GEMINI.md` (project root or `~/.gemini/`) |
| Slash command | `/memory` (context file management) |
| MCP integration | mcpServers section in `~/.gemini/settings.json` ("Configure MCP servers in `~/.gemini/settings.json` to extend Gemini CLI with custom tools") |
| Multi-host | not stated in docs (single-host assumed) |

**Adopt**:
- ✅ Adopt: `GEMINI.md` (root) + `~/.gemini/extensions/` pattern → location of Crumb host entry's manifest (Gemini side)
- ✅ Adopt: `/memory` slash command — aligns with Crumb's `crumb resume` / `crumb config`

---

## Part 8 — Comparison of Crumb `.crumb/` Realignment Options

### Current (v0.1, runtime-native assumption)

```
.crumb/
├── config.toml          # default actor binding (Crumb runtime read only)
└── presets/
    ├── bagelcode-cross-3way.toml
    ├── mock.toml
    ├── sdk-enterprise.toml
    └── solo.toml
```

**Problems** (per user):
- preset-loader.ts reads .crumb/ directly — host doesn't see it
- Host doesn't know Crumb's actor binding → no binding info in host system prompt
- In multi-host mode, each host entry defines its own binding / Crumb re-reads it — consistency broken

### Option 1 — Full adoption of Spec-kit `.specify/`

```
.crumb/
├── memory/
│   └── CRUMB.md              ★ identity (constitution equivalent)
├── presets/                   # named presets (4 files as-is)
├── templates/                 # P1: actor sandwich conversion templates
├── extensions/                # P2: 3rd-party extension hooks
├── scripts/                   # some per-host init scripts
└── settings/
    └── local.toml             # user-level overrides (gitignored)
```

**Pros**: aligns with spec-kit 30+ agents, 4-tier resolution
**Cons**: Heavy (templates/extensions/scripts all P1+), distant from Crumb's light-control-plane spirit

### Option 2 — Adoption of Claude Code memory walk-up

```
CRUMB.md                       ★ root identity (universal)
CRUMB.local.md                 # gitignored, personal-project
.crumb/
├── config.toml                # default binding (Crumb runtime read)
├── presets/                   # named presets
├── rules/                     # path-scoped instructions (isomorphic to Claude Code .claude/rules/)
└── settings.local.json        # user/local override
```

**Pros**: Clear 4-scope hierarchy (managed/project/user/local), isomorphic to AGENTS.md/CLAUDE.md pattern
**Cons**: rules/ overlaps with Crumb's actor sandwich (Crumb actor-level already plays the path-scoped role)

### Option 3 — Compromise (★ recommended)

```
CRUMB.md                       ★ root identity (universal, host injects)
.crumb/
├── config.toml                # default binding (readable by both Crumb runtime + host)
├── presets/                   # named presets (current 4 + future additions)
│   ├── bagelcode-cross-3way.toml
│   ├── mock.toml
│   ├── sdk-enterprise.toml
│   └── solo.toml
└── settings.local.toml        # gitignored, per-user environment override
```

**Rationale**:
- Spec-kit's `.specify/memory/constitution.md` → Crumb places `CRUMB.md` at root (sibling to Linux Foundation AGENTS.md, higher discoverability)
- Of Claude Code's 4 scopes, only (project + local) — managed/user are out of v0.1.x scope
- preset-loader's ambient fallback is isomorphic to spec-kit's 4-tier resolution (already exists)
- Items like templates/extensions/rules/ violate Crumb's light-control-plane principle — avoided
- Add only `.crumb/settings.local.toml` (per-user environment override, e.g. force `harness=claude-code`, gitignored)

### Option Comparison Matrix

| Dimension | Option 1 (full spec-kit) | Option 2 (CC memory) | **Option 3 (compromise) ★** |
|---|---|---|---|
| CRUMB.md location | `.crumb/memory/CRUMB.md` | root | **root** |
| Multi-host install | ✅ via scripts/ | ⚠ rules/ conversion | ✅ root CRUMB.md + host entries (already planned) |
| Host visibility | ✅ host can read .crumb/ directly | ⚠ varies by host | ✅ root CRUMB.md + .crumb/config.toml exposed to host |
| Size | ❌ heavy (6 sub-dirs) | ⚠ medium (rules/ added) | ✅ light (only settings.local.toml added) |
| spec-kit alignment | ✅ ✅ ✅ | ⚠ | ⚠ partial (only CRUMB.md and 4-tier resolution) |
| Claude Code alignment | ⚠ | ✅ ✅ ✅ | ✅ (project + local of 4 scopes) |
| User control | ✅ (settings/local.toml) | ✅ ✅ (CLAUDE.local.md) | ✅ (settings.local.toml) |
| `crumb init` size | ❌ heavy (creates 6 sub-dirs) | ⚠ medium (scaffolds rules/) | ✅ light (only CRUMB.md + .crumb/) |

→ **Option 3 recommended**.

---

## Part 9 — Additional Decision Items (5 from Part 6 + 5 new)

5 from Part 6 +

6. **Add `.crumb/settings.local.toml`?** (gitignored, per-user environment override — recommended ✅)
7. **Host visibility of `.crumb/config.toml`** — does the host read it directly (TOML parse is hard), or does Crumb runtime read and inject the binding info into host system prompt?
   - Recommendation = Crumb runtime reads + injects binding into host system prompt (avoids host's TOML parse burden)
8. **CRUMB.md → AGENTS.md import policy?**
   - Option A: CRUMB.md imports parts of AGENTS.md (`@AGENTS.md` syntax)
   - Option B: Two files independent (siblings, host loads both)
   - Recommendation = Option B (Linux Foundation standard separation, two files have different responsibilities)
9. **Multi-host install command** — add `crumb init --host claude|codex|gemini`?
   - Recommendation = ✅ (spec-kit's `specify init --integration` pattern, evaluator can install all host entries with one line)
10. **Add path-scoped rules** (`.crumb/rules/*.md`)?
    - Recommendation = ❌ (Crumb's actor sandwich already plays the path-scoped role, redundant)

---

## See also

- [[bagelcode]] / [[bagelcode-host-harness-decision]] — Hybrid lock + multi-host 4 entries
- [[bagelcode-system-architecture-v0.1]] — §2 multi-host × 3-tuple actor binding
- [[bagelcode-frontier-cli-convergence-2026]] — 4 CLI 7 primitives (input to this page)
- [[bagelcode-gamestudio-subagents-2026]] — Case G details
- [[bagelcode-paperclip-vs-alternatives]] — non-adoption of frameworks decision (consistent with Case A bkit)
- `~/workspace/openclaw/skills/coding-agent/SKILL.md` — Case D details
- `~/workspace/openclaw/AGENTS.md` — Case F standard example
- `~/workspace/hermes-agent/AGENTS.md` — Case E details
- AGENTS.md (this repo) — already applies the Linux Foundation standard
- `.claude/skills/crumb/SKILL.md` — Tier 3 Claude Code entry (already exists)
- https://code.claude.com/docs/en/memory — Case H, CLAUDE.md memory system
- https://github.com/github/spec-kit — Case J, multi-host frontier
- https://cursor.com/docs — Case I, Cursor rules
