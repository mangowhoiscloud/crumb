---
title: 4 CLI Convergence (2026-04) — Claude Code / Codex / Gemini / OpenCode 공통 primitive 7종
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
  2026-04 시점 4 major CLI agent harness (Claude Code, Codex CLI, Gemini CLI, OpenCode) 가 공통 primitive
  7종 (subagents, plan mode, ask-user, parallel, sandbox, memory, MCP) 으로 수렴. Crumb 의 Multi-host
  unified entry 가 frontier 합의의 정확한 path.
provenance:
  extracted: 0.55
  inferred: 0.40
  ambiguous: 0.05
created: 2026-05-02
updated: 2026-05-02
---

# 4 CLI Convergence (2026-04) — Claude Code / Codex / Gemini / OpenCode

> 2026-04 시점, 4 major AI coding CLI 가 **공통 primitive 7종**으로 수렴. Crumb 의 Multi-host unified entry ([[bagelcode-system-architecture-v3]] §2) 결정의 frontier 합의 사료.

---

## 1. 한 줄

> "Four major AI coding command-line interfaces, **Claude Code, OpenCode, Codex CLI, and Gemini CLI, have converged on a common set of primitives** such as subagents, plan mode, ask-user tools, parallel execution, sandboxing, memory, and MCP integration."
>
> — Rick Hightower, Medium 2026-04

→ 4 vendor 가 독립 진화 후 같은 7 primitive 채택. **상호 운용 가능한 단일 architecture 가 가능해진 시점**.

---

## 2. 7 공통 primitive

| Primitive | Claude Code | Codex CLI | Gemini CLI | OpenCode |
|---|---|---|---|---|
| **subagents** | Task tool, depth=1 | `~/.codex/agents/<name>.toml`, max_threads=6, max_depth=1 | extension MCP servers (간접) | native |
| **plan mode** | `Plan` agent type | TOML `plan` mode | extension command | native |
| **ask-user tools** | `kind=hook` modal | `/approvals` flow | extension prompt | native |
| **parallel execution** | Task spawn parallel | `agents.max_threads=6` | MCP servers | native |
| **sandboxing** | `--add-dir` + cwd | `sandbox_mode=workspace-write` | excludeTools | native |
| **memory** | `CLAUDE.md` auto-load | `developer_instructions` field | `GEMINI.md` (`contextFileName`) | native |
| **MCP integration** | native | `mcp_servers` field | `mcpServers` map | native |

→ **7/7 매핑 1:1 가능**. ^[extracted]

---

## 3. 각 CLI 의 entry spec 비교 (간단)

### 3.1 Claude Code skills
```yaml
# ~/.claude/skills/<name>/SKILL.md
---
name: <name>
description: <자연어 trigger 매칭>
allowed-tools: Bash Task ...
context: fork                 # subagent 격리
agent: Explore | Plan | ...   # 어느 agent type 으로 fork
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
model = "gpt-5.5-codex"       # override 가능
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

### 3.4 OpenCode (P1 후보)

OpenCode 는 [[bagelcode]] 에서 미정. P1 후보로만 인지.

---

## 4. 유사 사례 5개 (cross-CLI orchestration 도구)

| 도구 | 정체성 | host 수 | 통신 방식 | Crumb 차별점 |
|---|---|---|---|---|
| **Every Code** | Codex CLI fork + multi-provider | 1 (Codex) | OpenAI-compat API | 단일 host, multi-provider 만 |
| **Parallel Code** | 데스크톱, 3 CLI 병렬 (worktrees) | 3 native | git worktrees 격리 | 통신 X, isolated only |
| **AgentPipe** | CLI/TUI, shared rooms 통신 | N | room-based | 자유 형식 message |
| **CC Switch** | 데스크톱 control plane (단일 switch) | 3+ | 단순 switch | 협업 X |
| **VS Code 1.109 Agent Sessions** | IDE 통합 view (2026-02-05) | Claude/Codex/Copilot | view-only | IDE-native |

→ 5 도구 모두 "multi-host orchestration" 기능은 잡았지만 **transcript single-source-of-truth + sandwich 페르소나 + (harness × provider × model) tuple binding** 셋 모두 갖춘 건 없음. [[bagelcode-system-architecture-v3]] §3 (4 CLI 합의 위 transcript JSONL 강제) 가 그 빈자리.

---

## 5. Crumb 의 매핑 — 4 CLI convergence 위 추가 layer

| 4 CLI 공통 primitive | Crumb 추가 |
|---|---|
| subagents | **5 actor sandwich** (페르소나 + sandwich.md) |
| plan mode | **planner-lead Lead actor** (5 step inline) |
| ask-user | **`kind=question.socratic` + user.answer event** (transcript first-class) |
| parallel | **`bagelcode-tri-judge` preset (P1)** verifier × 3 |
| sandbox | **`sessions/<ulid>/` cwd 격리 + `agent-workspace/<actor>/`** |
| memory | **task_ledger + transcript JSONL 39 kind** |
| MCP | **`mcp-server.ts` (P0)** — 3 host 모두 호출 가능 |

→ Crumb 은 4 CLI convergence 7 primitive 의 **공통 추상 layer** + transcript schema 강제 + sandwich 페르소나 + (harness × provider × model) tuple binding.

---

## 6. 1차 사료 (8 links)

- [Rick Hightower — Claude Code vs Codex vs Gemini vs OpenCode convergence (2026-04)](https://medium.com/@richardhightower/claude-code-vs-codex-cli-vs-gemini-cli-vs-opencode-the-real-differences-after-convergence-fe71401f3f8e)
- [VS Code 1.109 Multi-Agent Development (2026-02-05)](https://code.visualstudio.com/blogs/2026/02/05/multi-agent-development)
- [DeployHQ — Claude Code vs Codex CLI vs Gemini CLI 2026](https://www.deployhq.com/blog/comparing-claude-code-openai-codex-and-google-gemini-cli-which-ai-coding-assistant-is-right-for-your-deployment-workflow)
- [thoughts.jock.pl — AI Coding Harness Agents 2026](https://thoughts.jock.pl/p/ai-coding-harness-agents-2026)
- [Mervin Praison — CC Switch Desktop Manager (2026-04)](https://mer.vin/2026/04/cc-switch-desktop-manager-unified-control-for-claude-code-codex-and-gemini-cli/)
- [bradAGI/awesome-cli-coding-agents (curated)](https://github.com/bradAGI/awesome-cli-coding-agents)
- [ai-boost/awesome-harness-engineering](https://github.com/ai-boost/awesome-harness-engineering)
- [Colombani.ai — CLI Agents 2026 비교](https://colombani.ai/en/blog/cli-agents-comparison-2026/)

---

## See also

- [[bagelcode]] / [[bagelcode-recruitment-task]] — 메일 verbatim "Claude Code, Codex, Gemini CLI 등 동시 사용"
- [[bagelcode-system-architecture-v3]] — convergence 위에 Crumb 의 unified entry 디자인
- [[bagelcode-host-harness-decision]] — Hybrid lock (Multi-host 결정의 출발점)
- [[bagelcode-frontier-orchestration-2026]] — 학술/연구 frontier (sister)
- [[bagelcode-production-cases-2026]] — 산업 production cases (sister)
- [[bagelcode-claude-codex-unity-2026]] — Unity domain 안 3 CLI
- [[bagelcode-paperclip-vs-alternatives]] — Paperclip BYO 패턴 (4 CLI convergence 후 더 자연)
- [[bagelcode-gamestudio-subagents-2026]] — 12 페르소나 (Claude Code 단일 host, P4 로 cross-3way 진화)
