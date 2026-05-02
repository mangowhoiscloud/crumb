---
title: 베이글코드 과제 — Multi-Host Harness 오픈소스 사례 + Crumb CRUMB.md / host entries 최종안
category: references
tags: [bagelcode, multi-host, harness, identity, claude-code, codex, gemini-cli, bkit, claude-flow, hermes, openclaw, linux-foundation, crumb-md, 2026]
sources:
  - "https://github.com/popup-studio-ai/bkit-claude-code"
  - "https://github.com/ruvnet/claude-flow"
  - "https://github.com/contains-studio/agents"
  - "[[bagelcode-frontier-cli-convergence-2026]]"
  - "[[bagelcode-host-harness-decision]]"
  - "[[bagelcode-system-architecture-v3]]"
  - "~/workspace/openclaw/skills/coding-agent/SKILL.md"
  - "~/workspace/openclaw/AGENTS.md"
  - "~/workspace/hermes-agent/AGENTS.md"
  - "https://agents.md (Linux Foundation Agentic AI Foundation)"
summary: >-
  Multi-host harness 7 사례 (bkit / claude-flow / contains-studio / openclaw / hermes / Linux
  Foundation AGENTS.md / gamestudio-subagents) × 6 차원 매트릭스. Crumb 의 CRUMB.md universal
  identity + host entries (Claude Code skill / Codex TOML / Gemini extension) 최종안 도출.
provenance:
  extracted: 0.65
  inferred: 0.30
  ambiguous: 0.05
created: 2026-05-02
updated: 2026-05-02
---

# Multi-Host Harness 오픈소스 사례 + Crumb 최종안

> **목적**: Crumb 가 Claude Code / Codex / Gemini CLI 위에서 동작하는 control harness 로 진화 (v3 [[bagelcode-host-harness-decision]] + [[bagelcode-system-architecture-v3]]) 한 후, **CRUMB.md universal identity + multi-host inject** 패턴 결정 위해 frontier 7 사례 매트릭스 + 차용/회피 결정.
>
> 사용자 명시 (2026-05-02): "기존 .crumb 의 컨텍스트 계층 구조를 수정해야 해. 이전처럼 runtime-native 로 설계하면 문제가 많아. Identity MD (CRUMB.md) 도 구성한다음 서로 다른 플랫폼 하네스에서 주입을 받을 수 있도록 구성하고."

---

## Part 1 — 7 사례 verbatim 정리

### A. bkit-claude-code (POPUP STUDIO PTE. LTD., Apache 2.0)

URL: https://github.com/popup-studio-ai/bkit-claude-code

**한 줄**: "The only Claude Code plugin that verifies AI-generated code against its own design specs" via PDCA workflow + gap-detector.

| 항목 | 값 |
|---|---|
| Host harness | **Claude Code v2.1.118+** (전용) |
| Multi-host | ❌ |
| Identity 파일 | `bkit.config.json` + `.mcp.json` + `.claude-plugin/` + `memory/` (proprietary) |
| Inject 메커니즘 | **PreToolUse hooks 21 event / 24 block** + intent-router |
| Format | JS 97.4% + JSON/YAML config + Markdown docs |
| 디렉토리 | `agents/` (36) + `skills/` (43) + `bkit-system/` + `commands/` + `lib/` (142 modules) + `hooks/` + `memory/` + `templates/` + `output-styles/` + `tests/qa/` (4,000+) |

**verbatim 핵심**:
> "CC sandbox → bkit PreToolUse hooks → audit-logger sanitizer (OWASP A03/A08) → Token Ledger NDJSON" — 4-layer defense
> "PDCA state machine — 20 transitions, L0-L4 automation levels, M1-M10 quality gates"
> "Gap-detector enforcement: Design → Implementation, auto-iterator (max 5 cycles until Match Rate ≥ 90%)"
> "226 assertions guarding skill/agent/hook surface across releases"

**차용/회피**:
- ✅ 차용: PDCA gap-detector 발상 → Crumb 의 verifier CourtEval 4 sub-step 와 정합 (이미 있음)
- ✅ 차용: Token Ledger NDJSON → Crumb 의 transcript.jsonl 이 동등 역할 (이미 있음)
- ✅ 차용: 226 assertions / quality gates 패턴 → Crumb 의 anti-deception 5 rules 확장
- ❌ 회피: 21 hooks deep integration → multi-host 깨짐, 사용자 통제 약화
- ❌ 회피: proprietary `bkit.config.json` → Linux Foundation AGENTS.md 표준 우선
- ❌ 회피: JS 97.4% core runtime → Crumb 는 control plane 만 (TS, light)

### B. claude-flow / Ruflo (ruvnet)

URL: https://github.com/ruvnet/claude-flow

**한 줄**: "The leading agent orchestration platform for Claude" — 100+ specialized AI agents across machines/teams/trust boundaries.

| 항목 | 값 |
|---|---|
| Host harness | Claude Code (single host) |
| Multi-host | ❌ host / ⚠ provider 만 (5 providers via OpenRouter failover: Claude / GPT / Gemini / Cohere / Ollama) |
| Identity 파일 | AgentDB (vector DB, HNSW indexed) + behavioral trust score |
| Inject 메커니즘 | **27 hooks + 12 auto-triggered workers** ("init 후 자동 routing") |
| Format | JS + agents/*.md |
| 디렉토리 | `.agents/`, `.claude/`, `.claude-plugin/`, `agents/`, `bin/`, `docs/`, `plugin/`, `plugins/`, `ruflo/`, `scripts/`, `tests/`, `v2/`, `v3/` |

**verbatim 핵심**:
> "Router → Swarm → Agents pipeline"
> "5 providers with failover" via OpenRouter
> "Behavioral trust scoring: 0.4×success + 0.2×uptime + 0.2×threat + 0.2×integrity"
> "After `init`, just use Claude Code normally — the hooks system automatically routes tasks, learns from successful patterns"
> "32 native plugins" + "swarm topologies: hierarchical, mesh, adaptive"
> "Federated collaboration — zero-trust federation enabling agents across machines/orgs to discover, authenticate, exchange work securely (mTLS + ed25519 + 14-type PII filter)"

**차용/회피**:
- ⚠ 부분 차용: behavioral trust score → Crumb 의 circuit_breaker 와 유사 (이미 있음)
- ❌ 회피: OpenRouter provider failover → Crumb 의 preset binding 이 동등 (사용자 통제 우선)
- ❌ 회피: "init 후 자동 routing" → Anthropic "wrong tradeoff" 교훈 + 사용자 통제권 위반
- ❌ 회피: AgentDB vector — 자체 전송 X, transcript 가 SoT
- ❌ 회피: federation security (mTLS / ed25519) — 과제 스코프 초과

### C. contains-studio/agents

URL: https://github.com/contains-studio/agents

**한 줄**: "Claude Code sub-agents collection" — department 별 specialized agents.

| 항목 | 값 |
|---|---|
| Host harness | Claude Code (single host) |
| Multi-host | ❌ |
| Identity 파일 | (없음) — 각 agent file 이 frontmatter 로 self-identifying |
| Inject 메커니즘 | `cp -r agents/* ~/.claude/agents/` → Claude Code 자동 로드 |
| Format | **pure Markdown + YAML frontmatter** ★ |
| 디렉토리 | `engineering/` (7) + `design/` (5) + `marketing/` (7) + `product/` (3) + `project-management/` + `studio-operations/` + `testing/` + `bonus/` |

**verbatim 핵심**:
> "Copy to your Claude Code agents directory: `cp -r agents/* ~/.claude/agents/`"
> Frontmatter: `name` (kebab-case), `description` (3-4 example scenarios), `color`, `tools` (Write, Read, Bash, etc.) + system prompt (500+ words of expertise)
> "studio-coach acts as a proactive coordinator for complex multi-agent tasks"
> "Agents trigger automatically in specific contexts and activate when mentioned explicitly"

**차용/회피**:
- ✅ ✅ 차용: pure Markdown + YAML frontmatter 형식 (Crumb 의 P0+P1 sandwich 변환 영감)
- ✅ 차용: 500+ word system prompt + 3-4 example scenario (description 풍부함)
- ✅ 차용: name / description / color / tools 필드 — 표준 frontmatter
- ❌ 회피: Claude Code 전용 — Crumb 는 multi-host

### D. openclaw skills/coding-agent (POPUP STUDIO 와 무관, mariozechner / openclaw 자체)

URL: https://github.com/openclaw/openclaw — `skills/coding-agent/SKILL.md` (이미 ~/workspace/openclaw 에 클론됨)

**한 줄**: "Delegate coding tasks to Codex, Claude Code, or Pi agents via background process. Bash-first."

| 항목 | 값 |
|---|---|
| Host harness | universal (bash subprocess) |
| Multi-host | ✅ ✅ Codex / Claude Code / OpenCode / Pi |
| Identity 파일 | (none — control harness, state X) |
| Inject 메커니즘 | `bash pty:true` subprocess + flag (host 별 다름) |
| Format | Markdown SKILL.md + frontmatter (name/description/metadata/install) |
| 디렉토리 | `skills/coding-agent/` (단일 SKILL.md) |

**verbatim 핵심**:
> "For Codex/Pi/OpenCode: `pty:true` required (interactive terminal apps)"
> "For Claude Code: `--print --permission-mode bypassPermissions` (no PTY)"
> "**Why workdir matters:** Agent wakes up in a focused directory, doesn't wander off reading unrelated files"
> "Use the right execution mode per agent" — host 별 다른 invocation
> 4 host invocation 패턴:
> ```
> codex:    bash pty:true command:"codex exec --full-auto 'task'"
> claude:   bash command:"claude --permission-mode bypassPermissions --print 'task'"
> pi:       bash pty:true command:"pi 'task'"
> opencode: bash pty:true command:"opencode run 'task'"
> ```

**차용/회피**:
- ✅ ✅ 차용: host 별 invocation 패턴 표 — Crumb 의 CRUMB.md 에 multi-host invocation 명시
- ✅ 차용: workdir + background + pty pattern — `crumb run` 의 cwd / detach 정합
- ✅ 차용: "Use the right execution mode per agent" — 사용자 통제권
- ❌ 회피: state 부재 (control only) — Crumb 는 transcript SoT 유지

### E. hermes-agent (klingebeil)

URL: ~/workspace/hermes-agent — `AGENTS.md`

**한 줄**: 자체 Python platform — multi-provider AI agent (ACP, MCP, gateway 통합).

| 항목 | 값 |
|---|---|
| Host harness | 자체 platform (Python) |
| Multi-host | ✅ provider (Anthropic / OpenAI / Google / OpenRouter / Pi) |
| Identity 파일 | `~/.hermes/config.yaml` + skills/ |
| Inject 메커니즘 | Python prompt builder + cache lock |
| Format | Python + YAML config + Markdown skill |
| 디렉토리 | `run_agent.py`, `model_tools.py`, `tools/` (file/web/browser/MCP), `gateway/` (telegram/slack/discord), `hermes_cli/`, `acp_adapter/`, `cron/`, `environments/` |

**verbatim 핵심**:
> "AIAgent Class: model='anthropic/claude-opus-4.6', max_iterations=90, enabled_toolsets=..."
> "Prompt Caching Must Not Break — DO NOT alter past context mid-conversation, change toolsets mid-conversation, reload memories or rebuild system prompts mid-conversation"
> "Skill slash commands: agent/skill_commands.py scans `~/.hermes/skills/`, **injects as user message (not system prompt) to preserve prompt caching**"

**차용/회피**:
- ✅ ✅ 차용: prompt cache invariant — Crumb 의 sandwich + transcript prefix cache 와 동형 (이미 있음)
- ✅ 차용: skill = user message inject (system prompt 안 건드림) → Crumb 의 user.intervene 패턴
- ❌ 회피: 자체 Python platform — Crumb 는 host CLI 위 layer

### F. Linux Foundation AGENTS.md 표준

URL: https://agents.md (Linux Foundation Agentic AI Foundation)

**한 줄**: Universal agent instruction file — Codex / Cursor / Claude Code / OpenCode 등 자동 인식.

| 항목 | 값 |
|---|---|
| Host harness | universal (스펙) |
| Multi-host | ✅ ✅ 표준 자체 |
| Identity 파일 | **`AGENTS.md` (repo root)** ★ |
| Inject 메커니즘 | **각 host 가 자체 자동 로드** (코드 X, 표준만) |
| Format | **pure Markdown** ★ |

**verbatim 핵심** (표준):
> Universal agent instruction file. AGENTS.md 안의 instruction 을 Codex/Cursor/Claude Code 등이 자동 인식.
> 권장 헤딩: Architecture / Style / Forbidden / Required / How to run / Commit & PR Guidelines

**차용/회피**:
- ✅ ✅ ✅ 차용: **표준 자체** — Crumb 의 AGENTS.md 가 이미 이 패턴 (v3 align 함, 이전 turn). CRUMB.md 도 sibling 으로 같은 패턴
- ✅ 차용: pure Markdown body + 헤딩 위계 + imperative 명령 어조

### G. gamestudio-subagents (pamirtuna, 193⭐)

이미 [[bagelcode-gamestudio-subagents-2026]] 에 ingest 됨. 요약만:

| 항목 | 값 |
|---|---|
| Host harness | Claude Code (single host) |
| Multi-host | ❌ |
| Identity | 12-agent team — Master Orchestrator + Producer + Market Analyst + Data Scientist + Sr/Mid Game Designer + Mechanics/Game Feel Developer + Sr/Tech Game Artist + UI/UX + QA |
| Inject 메커니즘 | `~/.claude/agents/` 자동 로드 |
| Format | Markdown + YAML frontmatter |
| 디렉토리 | 12 sandwich + workflow JSON |

**차용/회피**:
- ✅ 차용: 시장 검증된 game-domain agent 패턴 (Crumb 의 specialist 가 5/12 압축)
- ✅ 차용: Master Orchestrator + Producer 패턴 = Crumb 의 Coordinator + Planner Lead 와 정합

---

## Part 2 — 매트릭스 대조표 (7 사례 × 6 차원)

| Case | Host | Multi-host | Identity 파일 | Inject 메커니즘 | Format | Crumb 차용 |
|---|---|---|---|---|---|---|
| **A. bkit-claude-code** | CC v2.1.118+ | ❌ | proprietary (.claude-plugin/, bkit.config.json, memory/) | 21 hooks + intent-router | JS 97.4% + JSON config | ⚠ 부분 (PDCA gap, audit pattern) |
| **B. claude-flow / Ruflo** | CC | ❌ host / ⚠ 5 provider failover | AgentDB vector + trust score | 27 hooks + auto workers | JS + agents/*.md | ❌ (auto-routing 사용자 통제 약화) |
| **C. contains-studio/agents** | CC | ❌ | (frontmatter self-identify) | `~/.claude/agents/` 자동 | **pure Markdown + YAML** | ✅ ✅ (sandwich 형식 정합) |
| **D. openclaw skills/coding-agent** | universal bash | ✅ Codex/CC/Pi/OpenCode | (none, control only) | host 별 subprocess flag | Markdown SKILL.md | ✅ ✅ (host 별 invocation 표) |
| **E. hermes-agent** | 자체 Python | ✅ provider only | `~/.hermes/config.yaml` | Python builder + cache lock | Python + YAML | ⚠ (prompt cache invariant) |
| **F. Linux Foundation AGENTS.md** | universal | ✅ ✅ standard | **`AGENTS.md` (root)** | 각 host 자체 자동 로드 | **pure Markdown** | ✅ ✅ ✅ (이미 채택) |
| **G. gamestudio-subagents** | CC | ❌ | (frontmatter self-identify) | `~/.claude/agents/` 자동 | Markdown + YAML | ✅ (Master Orchestrator 패턴) |
| ─────────────────── | ──── | ──── | ──── | ──── | ──── | ──── |
| **Crumb 현재** | multi-host 4 entry | ✅ Claude/Codex/Gemini/headless | `.claude/skills/crumb/SKILL.md` (CC 만) | host 별 미통합 | Markdown sandwich + TOML preset | — |
| **Crumb 권장** ★ | multi-host | ✅ ✅ | **`CRUMB.md` (root universal)** | **각 host 가 자기 메커니즘으로 reference** | Markdown + frontmatter | F + D + C 결합 |

---

## Part 3 — 5 핵심 발견

### 발견 1 — "host 위 universal control" 패턴은 D + F 둘 뿐

7 사례 중 진짜 multi-host (host 자체 다양성 — provider 다양성 X) 는:
- **D. openclaw skills/coding-agent** (bash subprocess + host 별 flag)
- **F. Linux Foundation AGENTS.md** (표준 자동 로드)

나머지 5 사례 (A bkit / B claude-flow / C contains-studio / E hermes / G gamestudio) 는 모두 **단일 host 위 깊은 통합** (Claude Code 또는 자체 platform) — provider 다양성만 지원.

→ Crumb 가 가는 길 (multi-host control harness) 은 **frontier 의 좁은 곡선**. D + F 패턴이 정확한 fit.

### 발견 2 — Identity 파일 표준 = AGENTS.md (Linux Foundation)

- **F**: AGENTS.md (root, universal)
- **A**: 자체 형식 (proprietary)
- **B / E**: config 파일 (yaml/db)
- **C / G**: agent file 자체가 self-identifying (frontmatter)

→ **AGENTS.md 가 사실상 표준**. Crumb 는 이미 v3 AGENTS.md 가짐.

→ **CRUMB.md 는 AGENTS.md 의 "Crumb-internal identity" 자매 파일**:
- AGENTS.md = contributor identity (이 repo 에서 작업할 때 룰)
- CRUMB.md = Crumb runtime identity (host 가 inject 받아 Crumb 의 정체성을 인지)

### 발견 3 — pure Markdown + YAML frontmatter 가 95% 사례

- C / D / F / G 모두 pure Markdown
- A / B 만 코드 (JS) 가 dominant
- E 는 Python (자체 platform 이라 별개)

→ Crumb 의 P0+P1 sandwich 변환 (XML → Markdown) 결정 정합 — frontier 패턴 정조준.

### 발견 4 — host 별 inject 메커니즘 불일치

7 사례 중 **모든 host 가 동일하게 inject 받는 표준은 F (AGENTS.md) 만**. 다른 host 는 자체 메커니즘 (Claude Code 의 `.claude/skills/`, Codex 의 `~/.codex/agents/*.toml`, Gemini 의 extension manifest, OpenCode 의 자체 config).

→ Crumb 의 CRUMB.md = **content 통일** + **host 별 reference 분기** 패턴. 각 host entry 가 CRUMB.md 를 import / reference 하는 형태.

### 발견 5 — bkit 의 "init 후 자동 routing" 회피 = Anthropic wrong tradeoff 정합

claude-flow 의 "After init, just use Claude Code normally — hooks 가 자동 routing" 은 강력 but 사용자 통제권 위반 (Anthropic 2026-03 "wrong tradeoff" 정합 X).

→ Crumb 는 **사용자 통제 우선** 명시 (이전 결정 lock). hooks deep integration 회피.

---

## Part 4 — Crumb 최종안

### 4.1 — 3-tier identity 구조

```
┌──────────────────────────────────────────────────────────────────┐
│ Tier 1 — Linux Foundation universal standard                       │
│   AGENTS.md (root, 이미 v3 align 됨)                                 │
│     contributor identity — 이 repo 에서 작업할 때의 룰              │
│     architecture invariants / build / forbidden / required          │
│     모든 host 자동 인식 (Codex / Cursor / Claude Code / OpenCode)   │
├──────────────────────────────────────────────────────────────────┤
│ Tier 2 — Crumb-specific identity (신설)                              │
│   CRUMB.md (root)                                                   │
│     Crumb runtime identity — host 가 inject 받아 Crumb 정체성 인지   │
│     "I am Crumb. Multi-agent harness. Here's my schema, my flow."   │
│     universal — host 무관                                            │
├──────────────────────────────────────────────────────────────────┤
│ Tier 3 — Host-specific entries                                      │
│   .claude/skills/crumb/SKILL.md           (Claude Code, 있음)        │
│   .codex/agents/crumb.toml                (Codex, 신규)              │
│   .gemini/extensions/crumb/manifest.json  (Gemini, 신규)             │
│   crumb run                                (headless dispatcher 자체) │
│   각 entry 가 CRUMB.md 를 import / reference                          │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 — CRUMB.md 청사진

```markdown
---
name: crumb
description: >-
  Multi-agent execution harness for casual game prototyping. Identity file —
  loaded by host harness entries (.claude/skills/crumb/, .codex/agents/crumb.toml,
  .gemini/extensions/crumb/) so each host injects the same Crumb identity.
type: agent-runtime
universal: true
schema_version: crumb/v3
---

# Crumb

(identity, role, 5 actor + 3 specialist + 5 skill flow,
 39 kind transcript schema 요지, 사용자 통제 원칙,
 host 별 entry navigation)
```

분량 ~150-200 lines (claude-code 스타일 Markdown).

### 4.3 — Host entries 청사진

#### Claude Code (이미 있음)

`.claude/skills/crumb/SKILL.md` 의 References 섹션에 CRUMB.md import 명시 추가:

```markdown
## References (보강)
- [CRUMB.md](../../../CRUMB.md) — Crumb identity (universal, 모든 host 공통)
- [AGENTS.md](../../../AGENTS.md) — contributor guide (Linux Foundation 표준)
- ...
```

#### Codex (신규)

`.codex/agents/crumb.toml`:

```toml
[meta]
name = "crumb"
description = "Multi-agent execution harness for casual game prototyping"
schema = "crumb/v3"

[runtime]
non_interactive = true
max_threads = 6
max_depth = 1

[instructions]
file = "../../CRUMB.md"   # universal identity 흡수
also_load = ["../../AGENTS.md", "../../agents/_event-protocol.md"]

[entry]
trigger = "/crumb"
delegate_to = "crumb run --goal {{prompt}}"
```

#### Gemini CLI (신규)

`.gemini/extensions/crumb/manifest.json`:

```json
{
  "name": "crumb",
  "version": "0.1.0",
  "description": "Multi-agent execution harness for casual game prototyping",
  "schema": "crumb/v3",
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

`src/loop/coordinator.ts` 가 spawn 전 CRUMB.md 를 envelope 에 prepend (또는 sandwich 자체에 inline reference). 이미 sandwich 안 inline_skills / inline_specialists frontmatter 가 있으므로 패턴 확장.

### 4.4 — .crumb/ context 계층 재정렬 (계획만, 다음 단계)

사용자 명시: "이 사안도 계획에 올려둬" — 즉시 진행 X.

검토 항목 (다음 plan 진행 시):
- `.crumb/config.toml` 의 책임 재정의 (Crumb runtime 만 read 인지, host 도 read 가능 인지)
- `.crumb/presets/*.toml` schema 의 host-friendly 형식 검토
- 현재 runtime-native 가정 (preset-loader.ts 가 .crumb 에서 직접 read) → host-layer-aware 재구성 가능성
- AGENTS.md / CRUMB.md / preset 의 책임 경계 재명료화

---

## Part 5 — 차용 / 회피 / 신설 정리

### ✅ 차용 (확정)
| 패턴 | 출처 | Crumb 적용 |
|---|---|---|
| AGENTS.md universal identity 표준 | F (Linux Foundation) | 이미 v3 align (이전 turn) |
| pure Markdown + YAML frontmatter sandwich | C (contains-studio) + F | P0+P1 sandwich 변환 (이전 turn) |
| host 별 invocation 표 (`pty:true` 등) | D (openclaw) | CRUMB.md 의 multi-host section |
| TOML agent definition (Codex) | D + frontier-cli-convergence | `.codex/agents/crumb.toml` |
| Gemini extension manifest | frontier-cli-convergence | `.gemini/extensions/crumb/manifest.json` |
| 500+ word system prompt + 3-4 example scenario | C | sandwich description field 풍부함 (이전 turn 변환에 반영) |
| Master Orchestrator + Producer 패턴 | G (gamestudio-subagents) | Coordinator + Planner Lead (이미 있음) |
| prompt cache invariant ("DO NOT alter past context") | E (hermes) | sandwich + transcript prefix cache (이미 있음) |

### ❌ 회피 (확정)
| 패턴 | 출처 | 회피 이유 |
|---|---|---|
| 21 hooks deep integration | A (bkit) | multi-host 깨짐, 사용자 통제 약화 |
| proprietary identity 파일 (`bkit.config.json`) | A | Linux Foundation AGENTS.md 표준 우선 |
| "init 후 자동 routing" hooks | B (claude-flow) | Anthropic "wrong tradeoff" + 사용자 통제권 |
| OpenRouter provider failover | B | preset binding 이 동등, 사용자 통제 우선 |
| AgentDB vector / behavioral trust score | B | transcript SoT 원칙 |
| federation security (mTLS / ed25519) | B | 과제 스코프 초과 |
| 자체 Python platform | E | host CLI 위 layer 만 |
| JS 97.4% core runtime | A | control plane only (TS, light) |

### 🆕 신설 (이번 plan)
- **CRUMB.md** (root universal identity)
- **.codex/agents/crumb.toml** (Codex entry)
- **.gemini/extensions/crumb/manifest.json + commands/crumb.toml** (Gemini entry)

### ⏸ 보류 (다음 plan)
- **.crumb/ context 계층 재정렬** (사용자 명시 — 계획만)

---

## Part 6 — 결정 / 수정 받을 항목

사용자 확인 받을 사안:

1. **3-tier identity 구조 lock**?
   - Tier 1 AGENTS.md (이미 있음) + Tier 2 CRUMB.md (신설) + Tier 3 host entries
2. **CRUMB.md 위치** — repo root vs `.crumb/CRUMB.md`?
   - 권장 = root (Linux Foundation AGENTS.md 와 동일 위치, 발견 가능성 ↑)
3. **Codex / Gemini entry 디렉토리** 위치 — repo root `.codex/` `.gemini/` vs `~/.codex/` `~/.gemini/` (사용자 home)?
   - 권장 = repo root (committable, 평가자 환경 자동 동작)
4. **CRUMB.md 분량** — minimal (~80 lines, identity + reference) vs full (~200 lines, schema/flow/forbidden/required 모두)?
   - 권장 = full (host 가 inject 받아도 별도 wiki 안 봐도 동작 가능)
5. **.crumb/ context 계층 재정렬** 진행 시점 — CRUMB.md 작성 직후 vs 별도 turn?
   - 사용자 명시 = 별도 (이번 plan 에서 보류)

---

## Part 7 — Context Hierarchy 추가 리서치 (2026-05-02 보강)

사용자 명시: "이 파트 리서치 추가로 진행해서 보강한다음 한 번에 구현 진행할게" — `.crumb/` 컨텍스트 계층 재정렬 + CRUMB.md 작성을 한 묶음으로 진행하기 위한 추가 reference.

### H. Claude Code CLAUDE.md memory system (가장 깊은 spec)

URL: https://code.claude.com/docs/en/memory

| 항목 | 값 |
|---|---|
| 4 location scope | (1) Managed policy `/Library/Application Support/ClaudeCode/CLAUDE.md` — org-wide, MDM/Group Policy 배포, 사용자 override 불가능 / (2) Project `./CLAUDE.md` 또는 `./.claude/CLAUDE.md` — team, source control / (3) User `~/.claude/CLAUDE.md` — personal, 모든 프로젝트 / (4) Local `./CLAUDE.local.md` — personal-project, gitignored |
| Merge 정책 | **All discovered files concatenated** (override 안 함). Directory walk-up: `foo/bar/` 에서 시작 시 `foo/CLAUDE.md` + `foo/bar/CLAUDE.md` 모두 load. Filesystem root → working directory 순서. |
| Subdirectory | nested `CLAUDE.md` = **lazy load** (read tool 호출 시) |
| `@path` import | `@README` `@docs/git-instructions.md` — 5 hops max recursion. relative path 는 import 파일 기준. 첫 외부 import 시 approval dialog. |
| AGENTS.md 호환 | "Claude Code reads CLAUDE.md, not AGENTS.md. If your repository already uses AGENTS.md, **create a CLAUDE.md that imports it**: `@AGENTS.md`" |
| `.claude/rules/*.md` | path-scoped (frontmatter `paths: ['src/api/**/*.ts']`) — 매칭 파일 read 시만 load. recursive 디렉토리 OK. symlink 지원. |
| Inject 위치 | "CLAUDE.md content is delivered as **a user message after the system prompt**, not as part of the system prompt itself" |
| Size guidance | target < 200 lines, 25KB limit. larger 면 path-scoped rules 권장 |
| `claudeMdExcludes` | monorepo 에서 다른 팀 CLAUDE.md skip. glob pattern. settings.local.json. |
| Auto memory | `~/.claude/projects/<project>/memory/MEMORY.md` — Claude 자체 작성, first 200 lines / 25KB load |

**verbatim 핵심**:
> "All discovered files are concatenated into context rather than overriding each other. Across the directory tree, content is ordered from the filesystem root down to your working directory."
> "CLAUDE.md content is delivered as a user message after the system prompt, not as part of the system prompt itself."
> "If your repository already uses AGENTS.md for other coding agents, create a CLAUDE.md that imports it so both tools read the same instructions without duplicating them."
> "Each file should cover one topic, with a descriptive filename like `testing.md` or `api-design.md`. All `.md` files are discovered recursively."

**차용**:
- ✅ ✅ 차용: `@path` import 구문 → CRUMB.md 가 host 별 entry 에서 `@CRUMB.md` 로 reference 가능
- ✅ ✅ 차용: 4-scope 계층 (managed / project / user / local) → `.crumb/` 의 settings.local.toml 패턴
- ✅ 차용: AGENTS.md → CLAUDE.md import 패턴 — Crumb 도 동일 (CLAUDE.md 가 AGENTS.md + CRUMB.md 둘 다 import)
- ✅ 차용: nested + lazy load — Crumb sandwich 가 specialist 를 inline-read 하는 패턴과 정합
- ⚠ 인지: "user message after system prompt" — system prompt 아님. Crumb sandwich 는 system prompt inject (host 의 sandwich injection 메커니즘 따름) — 다른 layer
- ❌ 회피: auto memory — Crumb 는 transcript SoT 원칙, Claude 가 자체 메모리 안 갖게 함

### I. Cursor `.cursor/rules/*.mdc`

URL: https://cursor.com/docs

| 항목 | 값 |
|---|---|
| 디렉토리 | `.cursor/rules/*.mdc` |
| 형식 | frontmatter + body + globs (3 part) |
| 4 type | Always / Auto-attached / Agent-requested / Manual |
| 우선순위 | 루트 > nested > 사용자 (상위가 하위 덮어씀) |
| Legacy | `.cursorrules` (단일 파일, deprecated) |

**차용**:
- ⚠ 부분 차용: 4-type 룰 (Always / Auto / Agent / Manual) → Crumb 의 sandwich 가 이미 Always (host 가 inject) + Auto (specialist inline-read) 패턴
- ❌ 회피: glob pattern path-scoped — Crumb 는 actor 단위 sandwich 가 이미 그 역할
- ❌ 회피: 상위 override 정책 — Claude Code 의 concatenate 정책이 더 frontier

### J. Spec-kit `.specify/` (★ multi-host frontier, 30+ agents)

URL: https://github.com/github/spec-kit

| 항목 | 값 |
|---|---|
| 디렉토리 | `.specify/{memory, scripts, specs, templates, extensions, presets}/` |
| Identity 파일 | **`.specify/memory/constitution.md`** — "project's foundational guidelines", 모든 agent 가 specification/planning/implementation 시 reference |
| Multi-host | ✅ ✅ ✅ **30+ AI agents simultaneously** (`specify init <project> --integration {claude|gemini|codex|copilot|cursor}`) |
| Inject 메커니즘 | agent-specific command files 가 install 시 각 host 디렉토리에 작성 (e.g. `.claude/commands/`, `.gemini/commands/`) — slash commands 또는 agent skills 모드 |
| 4-tier resolution | (1) `.specify/templates/overrides/` (project-local) > (2) `.specify/presets/templates/` > (3) `.specify/extensions/templates/` > (4) `.specify/templates/` (core) — "Templates resolved at runtime — Spec Kit walks the stack top-down, **first match wins**" |
| Slash commands | `/speckit.constitution`, `/speckit.specify`, `/speckit.clarify`, `/speckit.plan`, `/speckit.tasks`, `/speckit.implement` |

**verbatim 핵심**:
> "constitution.md — Located at `.specify/memory/constitution.md`: Created via `/speckit.constitution` command. Contains 'project's foundational guidelines'. Referenced by agents during specification, planning, and implementation."
> "30+ AI agents simultaneously through integration selection at init: `specify init <project> --integration codex|gemini|claude|cursor|copilot`"
> "Agent-specific command files are written to their respective directories (e.g., `.claude/commands/`) at install time, enabling parallel use without conflicts."
> "Templates are resolved at runtime — Spec Kit walks the stack top-down and uses the first match."

**차용**:
- ✅ ✅ ✅ 차용: **multi-host install 패턴** (`init --integration <host>` → 각 host 디렉토리에 command file 작성). Crumb 의 `crumb init --host claude|codex|gemini` 같은 명령으로 동등 구현 가능
- ✅ ✅ 차용: **4-tier resolution priority** (overrides > presets > extensions > core, top-down first-match) — Crumb preset-loader 의 ambient fallback 과 동형
- ✅ 차용: `.specify/memory/constitution.md` 패턴 → CRUMB.md 가 동등 (단 Crumb 는 root 에 둠 권장)
- ✅ 차용: agent-specific command files (slash commands) → Crumb 의 `/crumb` 슬래시 커맨드를 host 별로 install
- ⚠ 부분 차용: 6 sub-directory (memory/scripts/specs/templates/extensions/presets) — Crumb 는 가벼운 control plane, presets/ + memory/ 만으로 충분

### K. Gemini CLI extensions + GEMINI.md

URL: https://github.com/google-gemini/gemini-cli (docs 부분 ~~~)

| 항목 | 값 |
|---|---|
| Extension 디렉토리 | `~/.gemini/extensions/<name>/` |
| Identity 파일 | `GEMINI.md` (project root 또는 `~/.gemini/`) |
| Slash command | `/memory` (context file 관리) |
| MCP integration | `~/.gemini/settings.json` 의 mcpServers 섹션 ("Configure MCP servers in `~/.gemini/settings.json` to extend Gemini CLI with custom tools") |
| Multi-host | docs 미명시 (single-host 추정) |

**차용**:
- ✅ 차용: `GEMINI.md` (root) + `~/.gemini/extensions/` 패턴 → Crumb host entry (Gemini side) 의 manifest 위치
- ✅ 차용: `/memory` slash command — Crumb 의 `crumb resume` / `crumb config` 와 정합

---

## Part 8 — Crumb `.crumb/` 재정렬 옵션 비교

### 현재 (v3 시점, runtime-native 가정)

```
.crumb/
├── config.toml          # default actor binding (Crumb runtime 만 read)
└── presets/
    ├── bagelcode-cross-3way.toml
    ├── mock.toml
    ├── sdk-enterprise.toml
    └── solo.toml
```

**문제** (사용자 명시):
- preset-loader.ts 가 .crumb/ 를 직접 read — host 가 안 봄
- host 가 Crumb 의 actor binding 인지 못 함 → host system prompt 에 binding 정보 없음
- multi-host 시 각 host entry 가 자기만의 binding 정의 / Crumb 가 그걸 다시 read — 일관성 깨짐

### 옵션 1 — Spec-kit `.specify/` 풀 차용

```
.crumb/
├── memory/
│   └── CRUMB.md              ★ identity (constitution 동등)
├── presets/                   # named preset (4 파일 그대로)
├── templates/                 # P1: actor sandwich 변환 templates
├── extensions/                # P2: 3rd-party extension hook
├── scripts/                   # 일부 host 별 init 스크립트
└── settings/
    └── local.toml             # user-level overrides (gitignored)
```

**장점**: spec-kit 30+ agent 정합, 4-tier resolution
**단점**: 분량 큼 (templates/extensions/scripts 모두 P1+), Crumb 의 가벼운 control plane 정신과 거리

### 옵션 2 — Claude Code memory walk-up 차용

```
CRUMB.md                       ★ root identity (universal)
CRUMB.local.md                 # gitignored, personal-project
.crumb/
├── config.toml                # default binding (Crumb runtime read)
├── presets/                   # named preset
├── rules/                     # path-scoped instructions (Claude Code .claude/rules/ 동형)
└── settings.local.json        # user/local override
```

**장점**: 4-scope 계층 (managed/project/user/local) 명확, AGENTS.md/CLAUDE.md 패턴과 동형
**단점**: rules/ 가 Crumb 의 actor sandwich 와 중복 (Crumb 는 actor 단위가 이미 path-scoped 역할)

### 옵션 3 — 절충 (★ 권장)

```
CRUMB.md                       ★ root identity (universal, host inject)
.crumb/
├── config.toml                # default binding (Crumb runtime + host 둘 다 read 가능)
├── presets/                   # named preset (현재 4 + 향후 추가)
│   ├── bagelcode-cross-3way.toml
│   ├── mock.toml
│   ├── sdk-enterprise.toml
│   └── solo.toml
└── settings.local.toml        # gitignored, user 환경별 override
```

**근거**:
- spec-kit 의 `.specify/memory/constitution.md` → Crumb 는 root `CRUMB.md` (Linux Foundation AGENTS.md sibling, 발견 가능성 ↑)
- Claude Code 의 4-scope 중 (project + local) 만 — managed/user 는 v0.1.x 스코프 외
- preset-loader 의 ambient fallback 이 spec-kit 의 4-tier resolution 과 동형 (이미 있음)
- templates/extensions/rules/ 등은 Crumb 의 light control plane 원칙 어긋남 — 회피
- `.crumb/settings.local.toml` 만 추가 (user 환경별 override, e.g. `harness=claude-code` 강제, gitignored)

### 옵션 비교 매트릭스

| 차원 | 옵션 1 (spec-kit 풀) | 옵션 2 (CC memory) | **옵션 3 (절충) ★** |
|---|---|---|---|
| CRUMB.md 위치 | `.crumb/memory/CRUMB.md` | root | **root** |
| Multi-host install | ✅ scripts/ 활용 | ⚠ rules/ 변환 | ✅ root CRUMB.md + host entries (이미 plan) |
| Host visibility | ✅ host 가 .crumb/ 직접 read 가능 | ⚠ host 마다 다름 | ✅ root CRUMB.md + .crumb/config.toml host 에 expose |
| 분량 | ❌ 무거움 (6 sub-dir) | ⚠ 중간 (rules/ 추가) | ✅ 가벼움 (settings.local.toml 만 추가) |
| spec-kit 정합 | ✅ ✅ ✅ | ⚠ | ⚠ 부분 (CRUMB.md 와 4-tier resolution 만) |
| Claude Code 정합 | ⚠ | ✅ ✅ ✅ | ✅ (4-scope 의 project + local) |
| 사용자 통제권 | ✅ (settings/local.toml) | ✅ ✅ (CLAUDE.local.md) | ✅ (settings.local.toml) |
| `crumb init` 분량 | ❌ 무거움 (6 sub-dir 생성) | ⚠ 중간 (rules/ scaffold) | ✅ 가벼움 (CRUMB.md + .crumb/ 만) |

→ **옵션 3 권장**.

---

## Part 9 — 추가 결정 항목 (Part 6 의 5개 + 5개 신규)

기존 5 (Part 6) +

6. **`.crumb/settings.local.toml` 추가**? (gitignored, user 환경별 override — 권장 ✅)
7. **`.crumb/config.toml` 의 host visibility** — host 가 직접 read 인지 (TOML parse 어렵), Crumb runtime 만 read 후 host system prompt 에 binding 정보 inject?
   - 권장 = Crumb runtime read + host system prompt 에 binding inject (host 의 TOML parse 부담 회피)
8. **CRUMB.md → AGENTS.md import 정책**?
   - 옵션 A: CRUMB.md 가 AGENTS.md 의 일부 import (`@AGENTS.md` 구문)
   - 옵션 B: 두 파일 독립 (sibling, host 가 둘 다 load)
   - 권장 = 옵션 B (Linux Foundation 표준 분리, 두 파일이 다른 책임)
9. **Multi-host install 명령** — `crumb init --host claude|codex|gemini` 신설?
   - 권장 = ✅ (spec-kit 의 `specify init --integration` 패턴, 평가자가 1줄로 모든 host entry install)
10. **path-scoped rules** (`.crumb/rules/*.md`) 추가?
    - 권장 = ❌ (Crumb 의 actor sandwich 가 이미 path-scoped 역할, 중복)

---

## See also

- [[bagelcode]] / [[bagelcode-host-harness-decision]] — Hybrid lock + multi-host 4 entry
- [[bagelcode-system-architecture-v3]] — §2 multi-host × 3-tuple actor binding
- [[bagelcode-frontier-cli-convergence-2026]] — 4 CLI 7 primitive (이 페이지의 입력)
- [[bagelcode-gamestudio-subagents-2026]] — Case G 상세
- [[bagelcode-paperclip-vs-alternatives]] — framework 비채택 결정 (Case A bkit 와 정합)
- `~/workspace/openclaw/skills/coding-agent/SKILL.md` — Case D 상세
- `~/workspace/openclaw/AGENTS.md` — Case F 표준 사례
- `~/workspace/hermes-agent/AGENTS.md` — Case E 상세
- AGENTS.md (이 repo) — 이미 Linux Foundation 표준 적용
- `.claude/skills/crumb/SKILL.md` — Tier 3 Claude Code entry (이미 있음)
- https://code.claude.com/docs/en/memory — Case H, CLAUDE.md memory system
- https://github.com/github/spec-kit — Case J, multi-host frontier
- https://cursor.com/docs — Case I, Cursor rules
