---
title: NL Intervention 12-System Survey — bkit anti-pattern + LLM-judges-implicitly frontier consensus
category: references
tags: [bagelcode, user-intervention, natural-language, classifier, bkit, langgraph, autogen, cursor, cline, aider, openhands, devin, manus, inspect-ai, frontier-survey, mail-requirement-2, 2026]
sources:
  - "https://github.com/popup-studio-ai/bkit-claude-code"
  - "https://docs.langchain.com/oss/python/langchain/human-in-the-loop"
  - "https://www.langchain.com/blog/making-it-easier-to-build-human-in-the-loop-agents-with-interrupt"
  - "https://www.cometapi.com/cursor-2-0-what-changed-and-why-it-matters/"
  - "https://forum.cursor.com/t/queued-messages-interrupt-agent/140944"
  - "https://forum.cursor.com/t/sending-a-new-task-interrupts-the-current-agent-task/130337"
  - "https://docs.cline.bot/features/auto-approve"
  - "https://github.com/cline/cline/pull/5500"
  - "https://aider.chat/docs/usage/commands.html"
  - "https://aider.chat/docs/usage/modes.html"
  - "https://github.com/microsoft/autogen/discussions/5022"
  - "https://microsoft.github.io/autogen/0.4.8/user-guide/agentchat-user-guide/migration-guide.html"
  - "https://github.com/OpenHands/OpenHands/pull/5500"
  - "https://github.com/OpenHands/OpenHands/issues/5480"
  - "https://docs.devin.ai/integrations/slack"
  - "https://cognition.ai/blog/jan-25-product-update"
  - "https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus"
  - "https://inspect.aisi.org.uk/approval.html"
  - "https://inspect.aisi.org.uk/agents.html"
  - "https://code.claude.com/docs/en/hooks"
  - "https://gist.github.com/umputun/570c77f8d5f3ab621498e1449d2b98b6"
  - "[[bagelcode-user-intervention-frontier-2026-05-02]]"
  - "[[bagelcode-recruitment-task]]"
summary: >-
  메일 요구사항 #2 ("사용자가 협업 과정에 개입") 충족 검증을 위해 frontier 12 system × 5 dimension
  (activation / NL classification mechanism / replay / CRUDvia NL / steal-or-avoid) 비교. 11/12 가
  LLM 판단 (implicit) 또는 protocol gate (per-tool approve/reject) 사용. 명시적 enum 분류기는 bkit
  단 1 개 — regex 8 언어 + scalar confidence (FP precision bug 2회 패치) 패턴이 anti-pattern 으로
  관찰됨. Crumb v3.2 의 "raw NL → kind=user.intervene body + collectSandwichAppends → next actor
  context-aware judgment" 경로가 frontier consensus 와 정합. PR-A/PR-B (이미 머지) 가 schema
  side 를 커버하므로 추가 enum 분류기 도입은 후퇴.
provenance:
  extracted: 0.70
  inferred: 0.25
  ambiguous: 0.05
created: 2026-05-02
updated: 2026-05-02
---

# NL Intervention — Frontier 12 System Survey

> **목적**: 메일 §2 "**사용자가 이 협업 과정에 개입하거나 관찰할 수 있어야 합니다**" 충족 설계 시 explicit NL classifier (intent.schema.json + enum action mapping) vs implicit LLM judgment 의 frontier consensus 검증. Sister 합성 [[bagelcode-user-intervention-frontier-2026-05-02]] 의 5-system 매트릭스를 12 system × NL classification dimension 으로 확장.
>
> **계기**: 사용자 명시 (2026-05-02): "LLM 이 자체적으로 판단해서 고르는게 더 프론티어스럽지 않아? 이와 유사한 사례들이 정확히 어떻게 푼 거야?" — 직전 회차에 제안된 `intent.schema.json` + coordinator NL classifier section 이 bkit 패턴 답습 위험 → frontier 사례 재조사로 검증.

---

## 1. 12 system × 5 dimension 비교

각 차원: activation/lock signal · NL classification mechanism · replay strategy · CRUD via NL · steal-or-avoid.

| # | System | Activation | NL classification | Replay | CRUD via NL | Verdict |
|---|---|---|---|---|---|---|
| 1 | **bkit** (popup-studio-ai/bkit-claude-code, 525★) | Claude Code plugin via `hooks/hooks.json`; 19 hook events | **regex 8 언어** (`AGENT_TRIGGER_PATTERNS` etc.) + `triggers.confidenceThreshold + 0.1` (ENH-226 patched FP bug) | 없음 (workflow-state-machine, no transcript) | C/R only via slash; no U/D | ❌ **avoid** — regex enum brittle |
| 2 | **LangGraph** (`interrupt()` + `Command(resume=...)`) | Library — `interrupt()` from any node; `Checkpointer` (Postgres/InMemory) | None built-in — host app classifies; lib transports | "Replay-on-resume": pre-interrupt side effects rerun (footgun) | Read/U via `Command(resume / goto / update)` discriminated union | ✅ **steal envelope** — tagged-union, but Crumb's idempotent reducer fold beats node-rerun |
| 3 | **Cursor 2.0** (Composer / Agent, 2025-10-29) | Always-on chat; per-prompt up to 8 parallel agents on git worktrees | Implicit interrupt-vs-queue heuristic (host LLM) | Per-agent worktree = filesystem audit; `git checkout` revert | Implicit — mid-run msg is steering or interrupt | ⚠ **steal worktree isolation, avoid implicit heuristic** (forum bugs #140944 / #130337) |
| 4 | **Cline** (cline/cline, v3.35+) | Cancel button + chat; auto-approve mode | None — new msg = hard interrupt + reassess | Chat history only; PR #5500 fixed lockout when stuck | None — new msg = new task | ❌ **avoid** — "reassess from scratch" loses state |
| 5 | **Aider** | Always-on REPL; `/code` `/architect` `/ask` `/help` `/undo` `/diff` | Lexical (`startswith("/")`) — bare text = NL to active mode | `/undo` reverts last commit (git-backed); per-turn 1 commit | Slash-explicit: `/undo` (D), `/clear` (D), `/architect` (U mode) | ⚠ **steal per-turn git commit**, avoid slash-only rigidity for v3 multi-actor |
| 6 | **AutoGen 0.4** (Microsoft) | `UserProxyAgent.human_input_mode="ALWAYS"\|"TERMINATE"\|"NEVER"`; `UserInputRequestedEvent` from `run_stream` | None — UserProxy passes raw text to next selector | None native | None; **GroupChatManager known-broken** (Discussion #5022) → workaround: `HandoffTermination` | ❌ **avoid centralized GroupChat** — Microsoft itself recommends handoff-back-to-app, which is exactly Crumb's `kind=handoff.requested` STOP-gate |
| 7 | **OpenHands** (formerly OpenDevin) | Always-on chat | None — message appended to context, agent decides | Event-stream architecture (`software-agent-sdk`); replay possible | Mid-run msg ignored by stuck-detector pre-#5500 → fixed | ✅ **steal stuck-detector exclusion** — circuit_breaker should NOT count user.intervene as actor activity |
| 8 | **Devin** (Cognition) | Slack `@Devin` mid-run; web UI msg | Internal LLM-based (mechanism opaque) | "Session Insights" = meta-analysis, not deterministic replay | C: Knowledge / Playbooks; U: mid-run Slack steering; no public D | ⚠ **steal Playbooks** (named instruction templates ↔ presets at finer grain), but Devin is API-billed (skip direct integration) |
| 9 | **Manus AI** | Always-visible "Manus's Computer" pane | Unclear from docs | None public | "Top-level suggestions" = informal NL | ⚠ skip — marketing-grade docs |
| 10 | **Inspect AI** (UK AISI) | `--approval human` flag or `approval = "human"` arg; `Human Agent` solver | Per-tool gate (no NL classification) — approve/reject/escalate with comment | Eval logs append-only, replayable for grading | Gate-based; comment is unstructured text | ✅ **steal Agent Bridge** (heterogeneous SDK abstraction = our adapter), per-tool comment field ↔ judge.score audit |
| 11 | **Claude Code native** (Anthropic, host) | 12+ lifecycle hooks: `SessionStart` / `UserPromptSubmit` / `PreToolUse` / `Stop` / `PostCompact` / etc. | **Skill description matching** — host LLM picks skill from descriptions | None native | Through skill metadata only | ✅ **confirm** — `additionalContext` from UserPromptSubmit hook is the right intercept surface; bkit + umputun gist both use it |
| 12 | **Codex CLI** (OpenAI, host) | `.codex/agents/<name>.toml` `system_prompt` field; AGENTS.md auto-load (closest wins recursive) | Host LLM via injected sandwich | None native | None | ✅ **confirm** — already used in Crumb's host entries |

---

## 2. Frontier consensus — 11/12 implicit, 1/12 explicit (anti-pattern)

| 분류 메커니즘 | 채택 시스템 수 | 평가 |
|---|---|---|
| **Implicit LLM judgment** (host LLM 또는 agent LLM 이 컨텍스트로 판단) | 9/12: LangGraph, Cursor, Cline, OpenHands, Devin, Manus, Claude Code, Codex, AutoGen | frontier 정답 |
| **Protocol gate** (NL 분류 없이 explicit verb 만, approve/reject) | 2/12: Inspect AI, Aider | safe, rigid |
| **Explicit enum classifier** (regex / schema-forced action enum) | 1/12: bkit | **anti-pattern** — FP precision bug, 8 언어 사전 폭발 |

→ Crumb v3.2 의 현행 경로 (raw NL → `kind=user.intervene body=<text>` + `collectSandwichAppends(next, actor)` → 다음 actor LLM 이 컨텍스트에서 판단) 는 **9/12 majority pattern + protocol gate 2/12 (slash commands) hybrid**. 명시적 enum 분류기 도입은 후퇴.

---

## 3. bkit 정밀 분석 — 왜 anti-pattern 인가

bkit (popup-studio-ai/bkit-claude-code, 525★, last commit 2026-05-02) 은 한국어 커뮤니티 기반 Claude Code plugin 으로 가장 가까운 비교 대상. NL 분류 메커니즘 4 layer:

```
[1] AGENT_TRIGGER_PATTERNS / SKILL_TRIGGER_PATTERNS / NEW_FEATURE_PATTERNS
    ─ keyed by en/ko/ja/zh/es/fr/de/it (8 언어)
    ─ regex match → score
[2] confidenceThreshold scalar (default 0.7)
    ─ ENH-226 Phase A: triggers.confidenceThreshold + 0.1 → FP precision
      bug → patched to Number((threshold + 0.1).toFixed(2))
    ─ score 가 threshold 아래면 ambiguous → formatAskUserQuestion
[3] additionalContext 주입 via UserPromptSubmit hook
    ─ Claude Code 가 자동으로 <system-reminder> 래핑
[4] 21 hook events 의 deep integration (PreToolUse / SubagentStart / TeammateIdle / ...)
```

문제점:

| 문제 | 증거 | Crumb 영향 |
|---|---|---|
| **regex 8 언어 사전** | `AGENT_TRIGGER_PATTERNS` keyed by language | 39 kind × 12 step × 8 actor 매핑 사전 = 폭발. 한국어 + 영어 mixed input ("spec 90초로 amend") 분류 불안정 |
| **scalar confidence FP bug** | ENH-226 패치 | 숫자 게이트는 보일러플레이트, 신뢰성 낮음 |
| **proprietary identity** (`bkit.config.json`) | `.claude-plugin/`, 고유 schema | Linux Foundation AGENTS.md 표준 회피 권고 ([[bagelcode-multi-host-harness-research-2026]] 발견 5) |
| **21 hook deep integration** | hooks/hooks.json | multi-host 깨짐 — Claude Code 잠금. Codex / Gemini 진입 불가 |

→ Crumb 회피 결정 (이미 [[bagelcode-multi-host-harness-research-2026]] §A 에서 부분 회피, 이번 survey 로 NL 분류 차원 추가).

---

## 4. Crumb 의 frontier 매핑

### 4.1 차용 결정

| Pattern | 출처 | Crumb 적용 |
|---|---|---|
| **Implicit LLM judgment** | LangGraph + AutoGen + Claude Code skill matcher 등 9/12 | raw NL → `body` + sandwich_append → 다음 actor LLM 이 게임 컨텍스트로 판단 (이미 작동) |
| **Tagged-union envelope** | LangGraph `Command(resume / goto / update)` | `data.{goto, swap, reset_circuit, target_actor, sandwich_append}` 6 fields (PR-B 머지) |
| **Stuck-detector excludes user.intervene** | OpenHands #5500 | `circuit_breaker` 가 user.* 이벤트를 actor activity 로 카운트 안 하도록 — TODO 검증 |
| **`additionalContext` from UserPromptSubmit** | Claude Code native + bkit + umputun gist | `.claude/skills/crumb/SKILL.md` 가 동일 surface 사용 (이미 작동) |
| **Per-tool approval comment field** | Inspect AI | `kind=judge.score` body 에 자유 텍스트 코멘트 (이미 작동) |
| **Worktree-per-actor isolation** | Cursor 2.0 | `sessions/<id>/agent-workspace/<actor>/` cwd (v3 invariant 8, 이미 작동) |

### 4.2 회피 결정

| Anti-pattern | 출처 | Crumb 회피 |
|---|---|---|
| **Regex enum classifier** | bkit | `intent.schema.json` 도입 안 함 — raw NL 그대로 흘림 |
| **Implicit interrupt-vs-queue heuristic** | Cursor (#140944, #130337) | 명시적 marker 1-bit 게이트 (lock 모드는 향후 옵션, 핵심 경로는 SKILL.md auto-attach) |
| **GroupChatManager 중앙화** | AutoGen #5022 | host-inline coordinator (이미 작동, v3 Must 5번 — STOP after handoff) |
| **"Reassess from scratch" 인터럽트** | Cline | reducer fold + transcript replay (이미 작동) |
| **Slash-only rigidity** | Aider | NL = primary, slash = power-user shortcut |
| **proprietary identity 파일** | bkit `.claude-plugin/` | Linux Foundation AGENTS.md 표준 |

### 4.3 메일 §2 매핑 강화

| 메일 키워드 | Frontier 사례 강화 |
|---|---|
| "사용자가 ... 개입" | 9/12 implicit LLM judgment + 2/12 protocol gate hybrid (Crumb 정확히 이 패턴) |
| "관찰" | append-only transcript 는 Crumb + Inspect AI 만 보유 (12 system 中 2개) |
| "독창적인 아이디어" | "raw NL → context-aware actor judgment + structured user.* protocol verbs" 조합 = 12 system 中 어디에도 정확히 동일 패턴 없음 |
| "기획자 페르소나" | 자유 텍스트 그대로 다음 actor 컨텍스트에 흘림 — 어휘 사전 강요 안 함 |

---

## 5. 잔여 의문 (D-1 마감 기준)

| Question | Answer |
|---|---|
| `intent.schema.json` 작성 필요? | ❌ no — frontier consensus 가 implicit. 9/12 가 이렇게 함. enum 강제는 bkit anti-pattern |
| Coordinator NL classifier section 추가? | ❌ no — 동일 사유 |
| Marker file + UserPromptSubmit hook 추가? | ⚠ optional — 현재 Claude Code skill matcher 가 cold start 처리, in-session NL 은 SKILL.md `@actor` mention 으로 커버됨. lock 모드는 nice-to-have |
| `metadata.intercept_mode` inline 필요? | ❌ no — marker 안 도입하면 fsync barrier 문제 자체 발생 안 함 |
| OpenHands #5500 stuck-detector exclusion 적용? | ✅ verify — `validator/anti-deception.ts` + circuit breaker 로직에 user.* 제외 보장 검증 (별도 PR) |

---

## 6. 한 줄 정리

**12 frontier system 비교 결과 raw NL → `body` + sandwich → context-aware actor judgment 가 majority pattern (9/12)**. bkit 의 regex 8 언어 enum 분류는 anti-pattern (FP bug 2회 패치 + 다국어 사전 폭발). Crumb 의 PR-A/PR-B (G1+G3+G5+G6 머지) 경로가 정확히 majority pattern + protocol gate hybrid. 명시적 enum 분류기 도입은 후퇴.

---

## See also

- [[bagelcode-user-intervention-frontier-2026-05-02]] — 5-system 매트릭스 + PR 매핑 sister 합성 (이 페이지의 dimension 확장 대상)
- [[bagelcode-multi-host-harness-research-2026]] — bkit / claude-flow / openclaw 등 7-system multi-host 조사 (NL classification 차원 추가가 이 survey)
- [[bagelcode-recruitment-task]] — 메일 verbatim 요구사항 #2
- [[bagelcode-system-architecture-v3]] — canonical v3 architecture
- [[bagelcode-paperclip-vs-alternatives]] — framework 비채택 + 패턴 차용 결정
- `src/reducer/index.ts` — 5 user.* event 처리 + 6 data field (PR-A + PR-B 머지)
- `src/inbox/parser.ts` + `src/inbox/watcher.ts` — G2 inbox watcher (이미 wiring 완료, `src/loop/coordinator.ts:339`)
- `agents/coordinator.md` — host-inline coordinator (AutoGen GroupChatManager 회피 패턴)
