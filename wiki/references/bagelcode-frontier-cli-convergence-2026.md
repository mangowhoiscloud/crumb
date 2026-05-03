---
title: 4 CLI Convergence (2026-04) — Claude Code / Codex / Gemini / OpenCode common 7 primitives
category: references
tags: [bagelcode, cli-convergence, frontier, claude-code, codex, gemini-cli, opencode, mcp, primitives, 2026]
sources:
  - "Rick Hightower — Claude Code vs Codex CLI vs Gemini CLI vs OpenCode (2026-04 Medium)"
  - "VS Code 1.109 Multi-Agent Development blog (2026-02-05)"
  - "thoughts.jock.pl — AI Coding Harness Agents 2026"
  - "DeployHQ comparison (2026)"
  - "Mervin Praison — CC Switch Desktop Manager (2026-04)"
  - "bradAGI/awesome-cli-coding-agents (curated)"
  - "ai-boost/awesome-harness-engineering"
summary: >-
  As of 2026-04, the 4 major CLI agent harnesses (Claude Code, Codex CLI, Gemini CLI, OpenCode)
  have converged on 7 common primitives (subagents, plan mode, ask-user, parallel, sandbox, memory, MCP).
  Crumb's Multi-host unified entry is the exact path of this frontier consensus.
provenance:
  extracted: 0.55
  inferred: 0.40
  ambiguous: 0.05
created: 2026-05-02
updated: 2026-05-02
---

# 4 CLI Convergence (2026-04) — Claude Code / Codex / Gemini / OpenCode

> As of 2026-04, the 4 major AI coding CLIs have converged on **7 common primitives**. Source material for the frontier consensus behind Crumb's Multi-host unified entry decision ([[bagelcode-system-architecture-v0.1]] §2).

---

## 1. One-liner

> "Four major AI coding command-line interfaces, **Claude Code, OpenCode, Codex CLI, and Gemini CLI, have converged on a common set of primitives** such as subagents, plan mode, ask-user tools, parallel execution, sandboxing, memory, and MCP integration."
>
> — Rick Hightower, Medium 2026-04

→ After independent evolution, the 4 vendors adopted the same 7 primitives. **The point at which an interoperable single architecture became possible.**

---

## 2. The 7 common primitives

| Primitive | Claude Code | Codex CLI | Gemini CLI | OpenCode |
|---|---|---|---|---|
| **subagents** | Task tool, depth=1 | `~/.codex/agents/<name>.toml`, max_threads=6, max_depth=1 | extension MCP servers (indirect) | native |
| **plan mode** | `Plan` agent type | TOML `plan` mode | extension command | native |
| **ask-user tools** | `kind=hook` modal | `/approvals` flow | extension prompt | native |
| **parallel execution** | Task spawn parallel | `agents.max_threads=6` | MCP servers | native |
| **sandboxing** | `--add-dir` + cwd | `sandbox_mode=workspace-write` | excludeTools | native |
| **memory** | `CLAUDE.md` auto-load | `developer_instructions` field | `GEMINI.md` (`contextFileName`) | native |
| **MCP integration** | native | `mcp_servers` field | `mcpServers` map | native |

→ **7/7 maps 1:1.** ^[extracted]

---

## 3. Comparison of each CLI's entry spec (brief)

### 3.1 Claude Code skills
```yaml
# ~/.claude/skills/<name>/SKILL.md
---
name: <name>
description: <natural-language trigger matching>
allowed-tools: Bash Task ...
context: fork                 # subagent isolation
agent: Explore | Plan | ...   # which agent type to fork as
model: claude-sonnet-4-6 | inherit
---
[markdown body]
```

### 3.2 Codex agents
```toml
# ~/.codex/agents/<name>.toml
name = "<name>"
description = "<when to use>"
developer_instructions = "<system prompt>"
model = "gpt-5.5-codex"       # overridable
sandbox_mode = "workspace-write"
[mcp_servers.<key>]
command = "..."
```

### 3.3 Gemini CLI extensions
```json
// ~/.gemini/extensions/<name>/gemini-extension.json
{ "name": "<name>", "version": "...", "contextFileName": "GEMINI.md",
  "mcpServers": { "<key>": { "command": "...", "args": [] } } }
```
```toml
# ~/.gemini/extensions/<name>/commands/<cmd>.toml
description = "/<cmd> ..."
prompt = "<system prompt>"
```

### 3.4 OpenCode (P1 candidate)

OpenCode is undecided in [[bagelcode]]. Recognized only as a P1 candidate.

---

## 4. 5 similar projects (cross-CLI orchestration tools)

| Tool | Identity | Number of hosts | Communication method | Crumb's differentiation |
|---|---|---|---|---|
| **Every Code** | Codex CLI fork + multi-provider | 1 (Codex) | OpenAI-compat API | Single host, multi-provider only |
| **Parallel Code** | Desktop, 3 CLIs in parallel (worktrees) | 3 native | git worktrees isolation | No communication, isolated only |
| **AgentPipe** | CLI/TUI, shared rooms communication | N | room-based | Free-form messages |
| **CC Switch** | Desktop control plane (single switch) | 3+ | Simple switch | No collaboration |
| **VS Code 1.109 Agent Sessions** | IDE-integrated view (2026-02-05) | Claude/Codex/Copilot | view-only | IDE-native |

→ All 5 tools nail "multi-host orchestration" functionality, but **none has all three of: transcript single-source-of-truth + sandwich personas + (harness × provider × model) tuple binding**. [[bagelcode-system-architecture-v0.1]] §3 (transcript JSONL enforcement on top of 4 CLI consensus) fills that gap.

---

## 5. Crumb's mapping — extra layer on top of 4 CLI convergence

| 4 CLI common primitive | Crumb addition |
|---|---|
| subagents | **5 actor sandwiches** (persona + sandwich.md) |
| plan mode | **planner-lead Lead actor** (5 step inline) |
| ask-user | **`kind=question.socratic` + user.answer event** (transcript first-class) |
| parallel | **`bagelcode-tri-judge` preset (P1)** verifier × 3 |
| sandbox | **`sessions/<ulid>/` cwd isolation + `agent-workspace/<actor>/`** |
| memory | **task_ledger + transcript JSONL 39 kinds** |
| MCP | **`mcp-server.ts` (P0)** — callable from all 3 hosts |

→ Crumb is the **common abstraction layer** over the 7 primitives of 4 CLI convergence + transcript schema enforcement + sandwich personas + (harness × provider × model) tuple binding.

---

## 6. Primary sources (8 links)

- [Rick Hightower — Claude Code vs Codex vs Gemini vs OpenCode convergence (2026-04)](https://medium.com/@richardhightower/claude-code-vs-codex-cli-vs-gemini-cli-vs-opencode-the-real-differences-after-convergence-fe71401f3f8e)
- [VS Code 1.109 Multi-Agent Development (2026-02-05)](https://code.visualstudio.com/blogs/2026/02/05/multi-agent-development)
- [DeployHQ — Claude Code vs Codex CLI vs Gemini CLI 2026](https://www.deployhq.com/blog/comparing-claude-code-openai-codex-and-google-gemini-cli-which-ai-coding-assistant-is-right-for-your-deployment-workflow)
- [thoughts.jock.pl — AI Coding Harness Agents 2026](https://thoughts.jock.pl/p/ai-coding-harness-agents-2026)
- [Mervin Praison — CC Switch Desktop Manager (2026-04)](https://mer.vin/2026/04/cc-switch-desktop-manager-unified-control-for-claude-code-codex-and-gemini-cli/)
- [bradAGI/awesome-cli-coding-agents (curated)](https://github.com/bradAGI/awesome-cli-coding-agents)
- [ai-boost/awesome-harness-engineering](https://github.com/ai-boost/awesome-harness-engineering)
- [Colombani.ai — CLI Agents 2026 comparison](https://colombani.ai/en/blog/cli-agents-comparison-2026/)

---

## See also

- [[bagelcode]] / [[bagelcode-recruitment-task]] — email verbatim "Claude Code, Codex, Gemini CLI 등 동시 사용" (*"using Claude Code, Codex, Gemini CLI etc. simultaneously"*)
- [[bagelcode-system-architecture-v0.1]] — Crumb's unified entry design on top of convergence
- [[bagelcode-host-harness-decision]] — Hybrid lock (the starting point of the Multi-host decision)
- [[bagelcode-frontier-orchestration-2026]] — academic / research frontier (sister)
- [[bagelcode-production-cases-2026]] — industrial production cases (sister)
- [[bagelcode-claude-codex-unity-2026]] — 3 CLIs within the Unity domain
- [[bagelcode-paperclip-vs-alternatives]] — Paperclip BYO pattern (more natural after 4 CLI convergence)
- [[bagelcode-gamestudio-subagents-2026]] — 12 personas (Claude Code single host, evolving to cross-3way at P4)
