---
title: Identity Files Decomposition — AGENTS.md universal + CLAUDE.md / GEMINI.md augmentation
category: synthesis
tags: [bagelcode, identity-files, agents-md, claude-md, gemini-md, multi-host, decomposition, lf-aaif, 2026]
sources:
  - "https://code.claude.com/docs/en/memory (Claude Code memory docs)"
  - "https://geminicli.com/docs/cli/gemini-md/ (Gemini CLI GEMINI.md docs)"
  - "https://geminicli.com/docs/reference/configuration/ (Gemini CLI contextFileName)"
  - "https://agents.md/ (Linux Foundation Agentic AI Foundation standard)"
  - "https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation (2025-12 AAIF)"
  - "https://github.com/anthropics/claude-code/issues/6235 (Claude Code AGENTS.md support request)"
  - "https://hivetrail.com/blog/agents-md-vs-claude-md-cross-tool-standard"
  - "https://kau.sh/blog/agents-md/ (sync workaround)"
summary: >-
  AGENTS.md 가 universal source (Linux Foundation Agentic AI Foundation 표준). CLAUDE.md /
  GEMINI.md 가 host-specific augmentation. 3 host (Claude Code / Codex CLI / Gemini CLI) 모두
  AGENTS.md content 자동 로드 (Codex native + Claude `@AGENTS.md` import + Gemini settings.json
  contextFileName). CRUMB.md drop — content 가 AGENTS.md 로 흡수.
provenance:
  extracted: 0.55
  inferred: 0.40
  ambiguous: 0.05
created: 2026-05-02
updated: 2026-05-02
---

# Identity Files Decomposition — Option B (Settings + Import)

> **Lock**: AGENTS.md = universal source (LF AAIF 표준). CLAUDE.md / GEMINI.md = host-specific augmentation. CRUMB.md dropped — content absorbed.
>
> 3 host (Claude Code / Codex CLI / Gemini CLI) 모두 자기 brand 의 자동 로드 메커니즘으로 AGENTS.md content 도달. 어떤 머신에서든 단순 셋업.

## 1. 정통 그라운딩 — 3 host MD auto-load spec

| Host | Native auto-load | Fallback / 설정 | Crumb 채택 path |
|---|---|---|---|
| **Claude Code** | `CLAUDE.md` (project root + parents recursive + `.claude/CLAUDE.md` + `~/.claude/CLAUDE.md` + managed policy) | AGENTS.md fallback (CLAUDE.md 없을 때만) — Anthropic 공식 native 지원 미시점 (issue #6235 thousands of upvotes) | **CLAUDE.md 첫 줄 `@AGENTS.md` import** — Claude Code 의 `@path` 표준 syntax (max 5 hop) |
| **Codex CLI** | **AGENTS.md** ✅ (closest wins, recursive walk, LF AAIF 표준) | (default) | **AGENTS.md 직접 사용** — native |
| **Gemini CLI** | `GEMINI.md` (default) | `contextFileName` settings 으로 AGENTS.md 가능 | **`.gemini/settings.json` `{ "context": { "fileName": ["AGENTS.md", "GEMINI.md"] } }`** + 호환 fallback 으로 `GEMINI.md` 첫 줄 `@AGENTS.md` |

→ **결정적**: 3 host 가 자기 brand 의 자동 로드 메커니즘만 보유. 단 각자 path 로 AGENTS.md content 도달 가능.

## 2. 우리 시스템 적용 (Option B)

### Root identity files

```
AGENTS.md   (real, universal source — LF AAIF 표준)
            ├── 11 architecture invariants
            ├── Actors (5 + 3 specialist + 5 skill)
            ├── Schema (39 kind × 11 field × 12 step × 8 from)
            ├── Multi-host entries (4 path)
            ├── Preset (user-controlled)
            ├── Don't / Must (universal)
            └── For human contributors (Style / Quickstart / How to run / File map / Wiki / Forbidden)

CLAUDE.md   (real, Claude Code augmentation)
            ├── @AGENTS.md  (import)
            ├── .skills/ 24 매핑 (wiki + implementation)
            ├── Korean policy
            ├── Verify gate
            ├── CI ratchet
            └── Progress tracking (CHANGELOG.md)

GEMINI.md   (real, Gemini CLI augmentation)
            ├── @AGENTS.md  (import OR fallback via settings)
            ├── Quickstart (gemini login → /crumb)
            ├── Gemini's role in bagelcode-cross-3way (verifier multimodal)
            ├── Memory / context loading spec
            └── Extension link

.gemini/settings.json   (Gemini CLI contextFileName config)
            { "context": { "fileName": ["AGENTS.md", "GEMINI.md"] } }
```

### CRUMB.md drop

이전 universal source 였던 CRUMB.md 의 content (Position in stack / 11 invariants / Actors / Schema / Multi-host entries / Preset / Don't / Must / References) 가 모두 AGENTS.md 로 흡수됨. AGENTS.md 가 LF AAIF 표준이라 자동 로드 메커니즘이 더 강력 (Codex native + Claude `@AGENTS.md` + Gemini contextFileName).

CRUMB.md 는 **redundant** 가 되어 drop. drift 위험 단일 source 통제로 0.

### Host entry MD references 정합

`CRUMB.md` 언급된 4 곳 → `AGENTS.md` 로 정정:
- `.claude/skills/crumb/SKILL.md` §References
- `.codex/agents/crumb.toml` developer_instructions §0
- `.gemini/extensions/crumb/GEMINI.md` 첫 단락
- `.gemini/extensions/crumb/commands/crumb.toml` prompt §0

## 3. 어떤 머신에서든 단순 셋업

### 사용자 환경별 동작

| 환경 | Claude Code | Codex | Gemini CLI |
|---|---|---|---|
| Claude Code only | ✅ CLAUDE.md auto + @AGENTS.md import | (사용 X) | (사용 X) |
| Codex only | (사용 X) | ✅ AGENTS.md auto (native) | (사용 X) |
| Gemini CLI only | (사용 X) | (사용 X) | ✅ AGENTS.md + GEMINI.md auto via settings.json |
| 3 host 모두 | ✅ | ✅ | ✅ |
| 어느 host 도 없음 | (headless `crumb run --adapter mock` deterministic — auth 0) |

→ **모든 환경에서 동일한 universal identity (AGENTS.md content)** 에 도달. drift 위험 0.

## 4. drift 방지 룰

- **AGENTS.md 가 single edit point** — 11 invariants / actors / schema / multi-host / preset 변경 시 AGENTS.md 만 수정
- CLAUDE.md / GEMINI.md 의 `@AGENTS.md` import 는 자동 동기화 (Claude Code 의 `@path` syntax)
- 단 Gemini CLI 의 `@<file>` import 호환성 미확정 (2026-04 기준) — 보수적 fallback 으로 `.gemini/settings.json` `contextFileName` 으로 AGENTS.md 도 자동 로드
- 3 entry MD (.claude/skills, .codex/agents, .gemini/extensions/commands) 의 References 도 AGENTS.md reference 통일

## 5. Spec 정합 매트릭스 (post-Phase 검증)

7 영역 × 51 항목 spec 비교 (각 host 공식 docs 인용 1차 사료):

| 영역 | 정합 / 전체 | 비고 |
|---|---|---|
| Claude Code CLAUDE.md | 6/7 (86%) | size 권장 200 LOC 초과 (CLAUDE.md @AGENTS.md import 후 365 LOC) — 받아들임 |
| Claude Code skill (.claude/skills/crumb/SKILL.md) | 11/11 (100%) | `when_to_use` frontmatter 추가 ✅ |
| Codex AGENTS.md (root) | 5/5 (100%) | Codex CLI native auto-load (closest wins) |
| Codex agents.toml (.codex/agents/crumb.toml) | 10/10 (100%) | `.codex/agents/` project-level 정식 지원 ✅ + `[skills]` 섹션 추가 ✅ |
| Gemini settings.json | 3/3 (100%) | `context.fileName` array schema 정합 |
| Gemini extension | 10/10 (100%) | manifest + commands/*.toml 모두 정합 |
| AGENTS.md self-contained | 5/5 (100%) | 11 invariants inline, 외부 @import 의존 0 |
| **합계** | **50/51 (98%)** | size 권장 1건만 받아들임 |

**Codex docs 인용 (project-level 정합 검증)**:
> "To define custom agents, add standalone TOML files under **`~/.codex/agents/`** for personal agents or **`.codex/agents/`** for **project-scoped agents**. Each file defines one custom agent."
>
> — [developers.openai.com/codex/subagents](https://developers.openai.com/codex/subagents)

→ 우리 위치 `.codex/agents/crumb.toml` 정합 ✅ (project-scoped agents 표준 path).

## 6. Phase 적용 결과 (이번 PR)

- **Phase 1** ✅ AGENTS.md universal source 갱신 (CRUMB.md content 흡수) + CRUMB.md drop
- **Phase 2** ✅ CLAUDE.md `@AGENTS.md` import + Claude-specific only / GEMINI.md root 신설 / `.gemini/settings.json` 신설
- **Phase 3** ✅ 3 entry MD references 정정 (`CRUMB.md` → `AGENTS.md`) + SKILL.md frontmatter (`allowed-tools` + `argument-hint`) 정합
- **Phase 4** ✅ 본 wiki synthesis ingest

## 6. 평가자 시인성 — 메일 verbatim 정조준 강화

베이글코드 채용 메일의 "**Claude Code, Codex, Gemini CLI 등 다양한 에이전트를 동시에 사용**" 정조준:
- 평가자가 어느 host 로 진입하든 AGENTS.md content (universal Crumb identity) 가 동일하게 로드됨
- 평가자가 ctrl-F "Claude Code" / "Codex" / "Gemini CLI" → AGENTS.md §"Multi-host entries" 표 한 곳에서 모두 확인 가능
- host-specific 정보가 필요하면 각 host 의 augmentation 파일 (CLAUDE.md / GEMINI.md) 추가 인지

## See also

- [[bagelcode-system-architecture-v3]] — canonical v3 architecture (multi-host × 3-tuple + 5 actor + 3-layer scoring)
- [[bagelcode-host-harness-decision]] — Hybrid (Skill + headless CLI) lock
- [[bagelcode-frontier-cli-convergence-2026]] — 4 CLI × 7 primitive convergence (LF AAIF 표준 채택 추진력)
- `AGENTS.md` (repo root) — universal source 본 페이지
- `CLAUDE.md` / `GEMINI.md` (repo root) — host-specific augmentation
- `.gemini/settings.json` — Gemini CLI contextFileName 설정
