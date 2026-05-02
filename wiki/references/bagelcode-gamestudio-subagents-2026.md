---
title: gamestudio-subagents — Claude Code + 12-agent role-play 게임 스튜디오 (2026)
category: references
tags: [bagelcode, gamestudio-subagents, claude-code, role-play, prompt-only, single-context, host-harness, byo-agent, 2026]
sources:
  - "https://github.com/pamirtuna/gamestudio-subagents"
  - "[[bagelcode-production-cases-2026]] §E1"
  - "[[bagelcode-mobile-game-tech-2026]] §6 비교표"
  - "[[bagelcode-verifier-isolation-matrix]] #20"
  - "[[bagelcode-host-harness-decision]] (Crumb 결정의 시장 검증 데이터)"
summary: >-
  pamirtuna/gamestudio-subagents (193 stars, 2026) — Claude Code CLI 호출만으로 12 agent
  페르소나를 inline 흉내내는 prompt-only 게임 스튜디오. Crumb host harness 결정의 시장 검증 + Crumb이
  그 위에 올린 frontier 5축 (transcript / replay / cross-provider / mode 동적 / single-file).
provenance:
  extracted: 0.65
  inferred: 0.30
  ambiguous: 0.05
created: 2026-05-02
updated: 2026-05-02
---

# gamestudio-subagents — Claude Code + 12-agent role-play 게임 스튜디오

> **URL**: https://github.com/pamirtuna/gamestudio-subagents · **193 stars** · 2026
>
> 우리 [[bagelcode-host-harness-decision]] 결정 (default = Claude Code skill, host = Claude Code) 의 **시장 검증 데이터**. 같은 Category C (host harness 위 light layer) 패턴을 prompt-only 까지 극단적으로 얇게 깎은 사례. Crumb 의 frontier 5축은 이 위에 올린 차이.

---

## 1. 한 줄 정의

**Claude Code CLI 한 줄 호출만으로 12-agent role 을 흉내내는 prompt-only 게임 스튜디오.** 별도 런타임도 없고 Task tool 도 안 쓰고 transcript 도 없다. 모든 "agent" 는 사용자가 `claude "Read agents/<role>.md ..."` 라고 명시하면 Claude 가 그 markdown 을 읽고 inline 으로 그 페르소나로 행동한다.

---

## 2. Invocation 패턴

```bash
# 1단계: 프로젝트 init
python scripts/init_project.py
# → user prompt: project name, engine (Godot/Unity/Unreal), mode (Design/Prototype/Full)
# → projects/<name>/{agents,documentation,source,qa,builds,project-config.json} 생성

# 2단계: agent 호출 — 매번 사용자가 어느 agent 를 활성화할지 prompt 로 직접 명시
claude "Read agents/market_analyst.md and project-config.json in projects/<name>...
        do competitive analysis for match-3 puzzle space-themed."

# 3단계: 진행 관리
python scripts/project_manager.py status <name>     # 🟢/🟡/🔵/✅/❌
python scripts/project_manager.py resume <name>
python scripts/project_manager.py freeze <name>
python scripts/project_manager.py startover <name>
```

→ **dispatch routing 자체를 사용자가 prompt 로 작성한다.** 자동 routing 없음. ^[extracted]

---

## 3. 12 agent 정의

```
agents/                              ← project-agnostic 12 markdown 페르소나
├── master_orchestrator.md           시스템 조정자, 프로젝트 init
├── producer.md                       타임라인/품질 관리
├── market_analyst.md                 경쟁사/시장 분석
├── data_scientist.md                 analytics, A/B test
├── sr_game_designer.md               비전/시스템 architect
├── mid_game_designer.md              콘텐츠 구현
├── mechanics_developer.md            코어 게임플레이 엔지니어
├── game_feel_developer.md            polish, juice
├── sr_game_artist.md                 art director
├── technical_artist.md               shader, VFX
├── ui_ux_agent.md                    interface
└── qa_agent.md                       테스트 + 검증

projects/<name>/agents/              ← project-specific override (12 카피 + customize)
```

각 markdown = Claude 가 그 페르소나로 행동하라는 system prompt 단편. **sandwich 4-section 같은 강제 구조 없음.** 본질은 role-play instruction. ^[extracted]

---

## 4. Coordination — Claude inline reasoning 에 100% 위임

WebFetch verbatim:
> "**No explicit MCP or Tool reference** mentioned; relies on Claude's ability to read markdown agent definitions from filesystem and coordinate via conversation."

→ **Task tool spawn 없음. subprocess 없음. MCP 서버 없음.** 12 agent 의 협업은 단일 Claude 세션 안에서 Claude 가 12 markdown 을 다 읽고 inline 으로 페르소나를 전환하며 self-conversation 하는 것. [[bagelcode-frontier-orchestration-2026]] §B Cognition "**single thread context**" 입장과 동형. ^[extracted]

---

## 5. State / Persistence — filesystem 만

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
- `project_manager.py` status = 디렉토리 marker (🟢/🟡/🔵) 그 이상 영속화 X
- 매 `claude` 호출 = **fresh context**
- Resume = "마지막 산출물 다시 읽고 다음 단계 prompt 를 사용자가 직접 입력" ^[inferred]

---

## 6. 3 mode — `init` 시점에 박힘

| Mode | 활성 agent | 산출 | trigger |
|---|---|---|---|
| **Design** | Market Analyst + Sr Designer + Sr Artist | design doc + market validation + art direction (구현 X) | `init_project.py` 시 user 선택 |
| **Prototype** | Design + 일부 Engineering | playable prototype + telemetry + feasibility | 동일 |
| **Development** | 12 agent 전체 | 완성된 게임 + data-driven iteration + QA + launch | 동일 |

→ **mode 를 init 에 박는다.** run 중 escalate 불가. [[bagelcode-production-cases-2026]] §B1 Lanham "**single 으로 시작 → 점진 확장**" 권고와 충돌. ^[inferred]

---

## 7. Tech stack

- **Language**: Python 3.8+
- **Orchestration interface**: Claude Code CLI (`npm install -g @anthropic-ai/claude-code` + `claude auth login`)
- **Diagram**: Mermaid (Node.js)
- **Version control**: Git
- **Target engines**: Godot, Unity, Unreal, custom
- **AI backbone**: Claude (Anthropic)
- **Auth**: Claude Code CLI 자체 OAuth → Max plan 구독 그대로 사용 ✅
- **Dependencies**: 없음 (no `package.json`, no `requirements.txt`) — Python `scripts/` 만 ^[extracted]

---

## 8. Routing / Orchestration topology

```
User Input (자연어 + 활성 agent 명시)
    ↓
Master Orchestrator (mode/project 기반 agent 선택)
    ↓
Producer Agent (병렬 워크플로 조정)
    ├→ Market Analyst (Phase 1: Go/No-Go)
    ├→ Design Team (Sr / Mid Designer)
    ├→ Engineering Team (Mechanics / Game Feel)
    ├→ Art Team (Sr Artist / Technical Artist / UI/UX)
    ├→ Data Scientist (analytics, A/B test)
    └→ QA Agent (telemetry 기반 테스트)
    ↓
Continuous Loop: Data Collection → Data Scientist → Market Analyst → Producer Optimization
    ↓
Launch + Post-Launch Monitoring
```

**inter-agent RPC 없음.** orchestration 은 Claude 가:
1. agent role markdown 모두 읽음
2. project-config.json 으로 워크플로 의존성 추론
3. 자연어 prompt 로 task 조정 ^[extracted]

---

## 9. Crumb 관점 — 같은 영양 (차용한 발상)

| 발상 | gamestudio | Crumb |
|---|---|---|
| Claude Code = host harness | `claude "..."` invocation | `.claude/skills/crumb/SKILL.md` trigger |
| markdown agent definition | `agents/<role>.md` 12 | `agents/{coordinator,planner-lead,engineering-lead,...}.md` 4 + specialists 5 |
| project-config 분리 | `project-config.json` | `.crumb/config.toml` + presets |
| Python helper script | `init_project.py`, `project_manager.py` | `npx tsx src/index.ts run\|replay\|event\|ls\|doctor` |
| mode 변형 | Design / Prototype / Full | `--solo` / `--standard` / `--rigorous` / `--parallel` |
| 도메인 = 캐주얼 게임 | match-3 예시 | 60s match-3 cat 예시 |

→ Crumb [[bagelcode-host-harness-decision]] 의 vendor-side 검증 데이터. **1:1 발상 일치 = Crumb 결정이 시장 기 검증된 패턴과 정합.** ^[inferred]

---

## 10. Crumb 관점 — 의도적으로 다른 6 곳

| 차원 | gamestudio | **Crumb** | 다른 이유 (출처) |
|---|---|---|---|
| Agent 수 | 12 | **4 외부 + N 내부 step** | [[bagelcode-production-cases-2026]] §B1 Lanham "start single, escalate" |
| Coordination | Claude inline conversation (single context) | **Task tool spawn (depth=1) + JSONL transcript** | [[bagelcode-frontier-orchestration-2026]] §I MAR (degeneration-of-thought) |
| Persistence | filesystem 디렉토리만 | **transcript.jsonl append-only + ULID + 38 kind** | replay determinism + audit trail + crash recovery |
| Replay | 없음 | **`crumb replay <session-dir>` = 동일 state 재구성** | reducer (state, event) → effects 순수 함수 |
| Mode | init 시 박음 | **CLI flag 동적** | "기획자 자연어 escalate" — turn 중 mode 변경 가능 |
| Provider | Claude only | **`--cross-provider` opt-in (Codex + Claude)** | [[bagelcode-verifier-isolation-matrix]] C2 cross-provider 학술 backbone |
| 산출 | engine-specific binary (Godot/Unity/Unreal) | **single-file HTML5 (Phaser CDN)** | 평가자 셋업 0 + 1회 응시 risk 차단 |

→ **핵심 추상 차이**:
```
gamestudio = "12 markdown 페르소나 + Claude inline self-conversation"
            (control-plane 자체가 없음, Claude 세션이 곧 control-plane)

Crumb     = "4 sandwich actor + Task subagent + JSONL control-plane"
            (control-plane이 LLM layer 외부 = ToS와 무관 = 자유도 본질)
```

[[bagelcode-system-architecture]] §6 "Control plane vs LLM layer 책임 분담" 표가 정확히 이 차이를 박아둔 매트릭스. ^[inferred]

---

## 11. gamestudio 의 5 한계 — Crumb 이 메우는 자리

### L1. transcript / audit trail 없음
베이글코드 채용 메일 verbatim "**기획자가 에이전트에게 게임을 만들게 한다**" → AI 의사결정 chain 추적 불가. **Crumb**: `transcript.jsonl` 38 kind + `crumb replay`. ^[inferred]

### L2. single context inline = MAR/CP-WBFT 학술 backing 없음
12 페르소나가 한 Claude 세션 안 self-conversation = [[bagelcode-frontier-orchestration-2026]] §I MAR "**degeneration-of-thought**" 직격. **Crumb**: Verifier sandwich 분리 + `--cross-provider` 시 Lanham 0.32→0.89 패턴.

### L3. crash recovery / pause-resume 약함
`project_manager.py freeze/resume` = 디렉토리 marker 만, 진행 중 turn 복구 X. **Crumb**: reducer pure → state machine → live/replay/test 3 loop variant 동일 reducer.

### L4. mode 가 init 에 박힘 = escalate 불가
Design → Prototype → Full 전환을 사용자가 새 init 으로만 가능. **Crumb**: `--solo` → `--standard` → `--rigorous` → `--parallel` CLI flag, turn 중 사용자 개입으로도 escalate 가능.

### L5. engine-specific binary = 평가자 셋업 무거움
Godot/Unity/Unreal export → 평가자가 엔진 + 프로젝트 import 필요. **Crumb**: Phaser CDN single-file HTML → 더블클릭만.

→ **5 한계 = [[bagelcode-frontier-rationale-5-claims]] 의 5 frontier claim 5축과 매핑.** gamestudio = production validation, Crumb = 그 위 frontier 5축 적용. ^[inferred]

---

## 12. Auth / runtime — 정확히 Category C ([[bagelcode-host-harness-decision]] 매트릭스)

| 차원 | 값 |
|---|---|
| Prerequisites | Git / Python 3.8+ / Node.js (Mermaid) / `npm install -g @anthropic-ai/claude-code` + `claude auth login` |
| Auth 메커니즘 | Claude Code CLI 자체 OAuth (1st-party) |
| 구독 호환 | ✅ Max plan 그대로 사용 |
| 2026-04-04 enforcement | ✅ 영향 없음 (CLI subprocess invoke = 사용자 직접 호출과 구별 불가) |
| 자체 web UI | ❌ 없음 (terminal 만) |
| Claude Code 미설치 시 | 동작 0% (mock 없음) ← **Crumb 의 차별점** |

→ **2026-04-04 enforcement 후에도 그대로 동작.** 외부 도구가 OAuth 토큰을 도용하는 게 아니라 사용자가 자기 터미널에서 `claude` 호출 + Python 스크립트가 그 호출 보조 + markdown 파일이 prompt 자료. Anthropic 이 막을 표면 없음. ^[inferred]

---

## 13. README 평가자 의문 — 선제 답변 (제안)

> "gamestudio-subagents (193 stars, 2026) 는 Claude Code 위 prompt-only orchestration 의 production validation 입니다. 우리 [[bagelcode-host-harness-decision]] 결정과 같은 Category — Claude Code 자체 OAuth + light layer (markdown agent + Python scripts). Crumb 은 그 위에 5 frontier claim 을 더한 것: (1) **transcript JSONL 38 kind** — 의사결정 audit trail (gamestudio 없음), (2) **reducer pure + replay deterministic** — crash recovery (gamestudio 없음), (3) **`--cross-provider` opt-in** — MAR/CP-WBFT 학술 backing (gamestudio Claude only), (4) **mode CLI flag 동적** — Lanham start-single-escalate (gamestudio init 박힘), (5) **single-file HTML 산출** — 평가자 셋업 0 (gamestudio engine-specific). gamestudio = production validation, Crumb = 그 위 frontier 5축."

---

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-host-harness-decision]] — Category C 결정 (gamestudio = 시장 검증)
- [[bagelcode-production-cases-2026]] §E1 — 종합 비교 안 gamestudio 위치
- [[bagelcode-mobile-game-tech-2026]] §6 — Claude-Code-Game-Studios (49 agent) 와 함께 비교표
- [[bagelcode-verifier-isolation-matrix]] #20 — QA Agent 격리 ✅ / Claude only ❌
- [[bagelcode-paperclip-vs-alternatives]] — BYO adapter 패턴 (다른 layer 의 발상 일치)
- [[bagelcode-frontier-orchestration-2026]] §B Cognition single-thread / §I MAR degeneration-of-thought
- [[bagelcode-frontier-rationale-5-claims]] — Crumb 의 5축이 gamestudio 의 5 한계와 매핑
- [[bagelcode-system-architecture]] §6 — control plane vs LLM layer 책임 분담 표
