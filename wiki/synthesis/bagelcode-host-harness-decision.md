---
title: 베이글코드 과제 — 런타임 vs Host 하네스 결정 (Hybrid Skill + Headless CLI)
category: synthesis
tags: [bagelcode, runtime, host-harness, claude-code-skill, hybrid, cross-provider, decision, 2026]
sources:
  - "[[bagelcode-task-direction]]"
  - "[[bagelcode-paperclip-vs-alternatives]]"
  - "[[bagelcode-team-profile]]"
  - "[[bagelcode-ai-first-culture]]"
  - "[[bagelcode-davis-system]]"
  - "[[bagelcode-kiki-leverage]]"
  - "[[bagelcode-agents-fixed]]"
  - "[[bagelcode-verifier-isolation-matrix]]"
summary: >-
  Crumb 의 default 진입점을 Claude Code skill (host 하네스) 으로 lock 하고 headless CLI 를 fallback
  으로 두는 Hybrid 결정. cross-provider 는 opt-in flag, 자체 transcript/reducer/adapter 100% 보존.
provenance:
  extracted: 0.55
  inferred: 0.40
  ambiguous: 0.05
created: 2026-05-02
updated: 2026-05-02
---

# 런타임 vs Host 하네스 결정 — Hybrid (Skill + Headless CLI)

> **lock 된 결정.** Crumb default 진입점 = Claude Code skill (host = Claude Code 자체). 평가자/CI = headless `crumb run --goal "..."`. Cross-provider 는 opt-in flag. 자체 transcript JSONL + reducer + adapter 100% 보존.
>
> 이 페이지는 **이전 결정 ([[bagelcode-task-direction]] 의 "별도 런타임 + Node.js Coordinator" 노선) 의 재정렬** 이다. 자체 런타임을 폐기하지 않고, Claude Code 를 host 하네스로 두고 그 위에서 자체 런타임을 재사용하는 hybrid 로 변경.

---

## 한 줄 결정

```
default       :  $ claude → /crumb 60초 매치-3 콤보       (자연어 인터페이스, host = Claude Code)
headless / CI :  $ npx tsx src/index.ts run --goal "..."   (자체 런타임, deterministic mock)
cross-provider:  --cross-provider flag (opt-in)            (engineering-lead = codex-local subprocess)

자체 런타임 (transcript / reducer / validator / adapter / dispatcher) 은 100% 보존.
skill 안 모든 단계 → crumb event 호출 → schema 강제 + replay 보장.
```

---

## 왜 재정렬했나 — 자연어 조작 부재가 ai-first 정조준 빠뜨림

[[bagelcode-task-direction]] 의 초기 결정은 "**별도 Node.js Coordinator + TUI/inbox.txt**" 였음. 동작은 하지만 **베이글코드 톤의 핵심 신호를 빠뜨림**:

### verbatim 신호 4개 (이미 wiki 안)

| 출처 | verbatim | 함의 |
|---|---|---|
| [[bagelcode-ai-first-culture]] line 57-59 | *"AI 친화적으로 할 거면 굳이 예쁘게 만드는 데 시간을 많이 들일 필요가 없었던 거예요"* + **"CLI / MCP 등 고려"** | UI 화려함 < 에이전트 호환성 |
| [[bagelcode-ai-first-culture]] 5원칙 #1 | *"**명령이 아닌 '맥락 공유 소통'**"* | 자연어 + 컨텍스트 우선, 명령어 X |
| [[bagelcode-ai-first-culture]] 5원칙 #5 | *"**기존 도구 활용 + 개인화 부분만 직접 개발**"* | 풀 빌드 X, **가장자리만 빌드** |
| [[bagelcode-davis-system]] | Slack 봇 + 자연어 입력 + Agent Router 2단 | 자연어가 베이글코드 default UI |
| [[bagelcode-team-profile]] line 25-27 | *"기획자는 에이전트에게 게임을 만들게 한다 / 엔지니어는 에이전트의 능력을 확장한다"* | **두 직군이 같은 에이전트 도구 위** — host 하네스 가정 |

→ "별도 런타임" 노선은 **"가장자리만 빌드" 5원칙 #5 와 정확히 충돌**. Claude Code 자체가 "기존 도구" 인데 그 위 가장자리가 아니라 평행한 별도 도구를 만들고 있었음.

### kiki 가 같은 문제를 어떻게 풀었나

[[bagelcode-kiki-leverage]] §3 [[kiki-slack-integration]]:
- `@coordinator pause` / `@<agent> rephrase` 같은 **자연어 미세 조작** 이 kiki 의 핵심 사용자 surface
- kiki 자체가 Claude Code (또는 Slack) 위에 host 됨 — 별도 런타임이 아님
- 즉 kiki = "host 하네스 위 sandwich + sub-agents" 패턴

→ Crumb 도 같은 길로. **단 자체 transcript schema 는 강제 + replay 보장 우위 유지**.

---

## 4 옵션 매트릭스 (9 차원)

| 차원 | A. 별도 런타임 단독 (이전 결정) | B. Claude Code skill 단독 (kiki 식) | **C. Hybrid (skill + headless CLI)** ★ | D. 별도 런타임 + 자연어 wrapper LLM |
|---|---|---|---|---|
| 자연어 조작 | ❌ slash/inbox | ✅ 자연 | ✅ Claude Code 안 자연 | ⚠ wrapper 변환 |
| 베이글코드 톤 정조준 | ⚠ CLI 친화 OK | ✅ "기획자 자연어" 정조준 | ✅ default + headless 둘 다 | ⚠ |
| transcript schema 강제 | ✅ 100% | ⚠ Claude history vs 우리 transcript 모호 | ✅ skill 안 `crumb event` 호출 | ✅ |
| replay 보장 | ✅ | ⚠ Claude session 외부 의존 | ✅ | ✅ |
| README 동작 robustness | ✅ 단순 | ⚠ Claude Code 필수 | ✅ **`claude` 또는 `crumb run` 둘 다** | ✅ |
| 현재 src/ 코드 활용 | ✅ 100% | ❌ 거의 새로 작성 | ✅ 100% | ✅ 100% |
| 분량 (마감 안전) | 0 | ❌ 많음 | ⚠ skill + specialists + integration | ⚠ wrapper LLM 호출 risk |
| Cross-provider opt-in | ✅ | ✅ codex subagent | ✅ skill 안 + CLI flag | ✅ |
| 평가자 entrypoint | `npx tsx src/index.ts run --goal "..."` | `claude` → `/crumb` | **둘 다** | `crumb chat` |

→ **C 가 모든 차원에서 ≥ 다른 옵션**. transcript 강제 + 자연어 + README robust + 현재 코드 100% 활용 동시 충족.

---

## 결정 사항 (3 lock)

### Lock 1 — Default 진입점 = Claude Code skill (host 하네스)

```
.claude/skills/crumb/SKILL.md
  ▾ 자연어 trigger ("게임 만들어줘", "/crumb ...")
  ▾ Claude Code 가 self-host (Coordinator 역할)
  ▾ Task tool spawn (Anthropic 기본, depth=1):
      ├── planner-lead.md sandwich 주입
      │     └── Task tool: concept-designer / researcher / visual-designer (specialists/*.md)
      └── engineering-lead.md sandwich 주입
            ├── Task tool: qa.md
            └── Task tool: verifier.md (다른 sandwich, 같은 provider 격리 = self-judge risk 완화)
  ▾ 모든 단계 → crumb event (env CRUMB_TRANSCRIPT_PATH)
  ▾ artifacts/{game.html, spec.md, DESIGN.md, tuning.json} 생성
```

자연어 사용자 개입:
```
사용자: "이 부분 다르게 해줘"
   ↓ Claude Code 가 받음 → crumb event kind=user.intervene
   ↓ Coordinator 가 spec.update 라우팅 (자체 reducer)
```

→ **kiki 의 "@coordinator pause" 자연어 미세 조작 패턴** + **자체 transcript replay 보장** 동시.

### Lock 2 — Headless = `crumb run --goal "..."` (자체 런타임 그대로)

```
$ npx tsx src/index.ts run --goal "60s match-3" --adapter mock --idle-timeout 5000
   ▾ 평가자 / CI / non-interactive 환경
   ▾ deterministic mock adapter 가능
   ▾ Claude Code 인증 없어도 demo 동작
   ▾ README "Quickstart (1줄)" 보장
```

→ 자체 런타임 = 5원칙 #5 의 "**개인화 부분만 직접 개발**" 의 가장자리 자체. transcript schema + replay + adapter 추상화 가 그 가장자리 본질.

### Lock 3 — Cross-provider = opt-in flag

```
default                    : Claude Code 단일 (1 host + N Task tool subagents, depth=1)
                              평가자 1 인증만 (claude login)
                              내부 격리 = 다른 sandwich + 다른 컨텍스트 (same-provider self-judge risk 만 완화)

--cross-provider flag      : engineering-lead = codex-local subprocess (외부 actor 추가)
                              verifier         = host Claude Code Task tool (다른 sandwich)
                              cross-assemble (구현 = Codex / 검증 = Claude)
                              평가자 2 인증 필요 (claude + codex login)
                              demo 시연용 또는 advanced
```

[[bagelcode-verifier-isolation-matrix]] 결론 따름: cross-provider 는 학술 backing 강함 (CP-WBFT / MAR / Lanham 0.32→0.89), 단 메일 "**README대로 실행 시 동작**" absolute 조건과의 trade-off 때문에 default X.

---

## 베이글코드 5원칙 정합 매핑 (이 결정이 어디에 부합)

| 5원칙 ([[bagelcode-ai-first-culture]]) | 본 결정의 부합 |
|---|---|
| #1 명령이 아닌 '맥락 공유 소통' | ✅ Claude Code 자연어 인터페이스 = 맥락 공유 default |
| #2 다중 에이전트 병렬 처리 | ✅ Task tool spawn (depth=1, 가능하면 병렬), `--cross-provider` 시 codex-local 병렬 |
| #3 AI 재사용을 위한 문서화 | ✅ agents/*.md sandwich + specialists/*.md = 자산화 (메일 ".md 포함" 직접 충족) |
| #4 반복 작업의 구조화 (스킬/룰 생성) | ✅ `.claude/skills/crumb/SKILL.md` 자체가 그 구조화의 결과 |
| #5 기존 도구 활용 + 개인화 부분만 직접 개발 | ✅ Claude Code = 기존 도구 (host) / Crumb = 개인화 부분 (transcript + reducer + adapter) |

→ **5/5 원칙 정조준**.

---

## DAVIS 매핑 (사내 사례 정합)

| DAVIS 패턴 | Crumb 매핑 |
|---|---|
| Slack 봇 = 자연어 default UI | `claude` + `/crumb` = 자연어 default |
| Agent Router 2단 (Document/Tableau/Query → Genie Space) | Coordinator (Claude Code host) → Planner Lead / Engineering Lead → specialists |
| Genie API = 매니지드 위임 | Claude Code SDK / Codex subagents = 매니지드 위임 (재구현 X) |
| dbt YAML = 메타데이터 코드화 | agents/*.md sandwich + protocol/schemas/*.json = 메타데이터 코드화 |

→ **DAVIS 4 패턴 모두 매핑됨**. 베이글코드 신작팀에게 익숙한 골격.

---

## 차용한 reference 패턴 (이미 wiki 안 ingest)

| 패턴 | 출처 | Crumb 적용 |
|---|---|---|
| Sandwich Identity (4-section) | [[bagelcode-kiki-leverage]] §1 | agents/coordinator + planner-lead + engineering-lead + specialists/*.md |
| Hub-Spoke 토폴로지 | [[bagelcode-kiki-leverage]] §2 | Coordinator (host Claude Code) + Lead spokes |
| Slack-style intent | [[bagelcode-kiki-leverage]] §3 | Claude Code 자연어 → coordinator routing rule (자체 routing-rules) |
| Karpathy 5원칙 (P5: Git as State Machine) | [[bagelcode-kiki-leverage]] §7 | transcript.jsonl append-only = state machine |
| BYO adapter | [[bagelcode-paperclip-vs-alternatives]] | claude-local / codex-local / mock + auto |
| Task tool depth=1 | [[bagelcode-frontier-orchestration-2026]] §K | Anthropic Claude Code SDK 자체 기본값, 우리 enforcement 에 명시 |
| Codex subagents (TOML, max_threads=6) | [[bagelcode-frontier-orchestration-2026]] §L | --cross-provider 시 codex-local 안 활용 |
| OTel GenAI alias | [[bagelcode-final-design-2026]] §8 | export-ready, host 하네스 변경과 무관 |

---

## 검증 필요 미지수 (commit 전 spike)

### Q1. Claude Code Task tool 의 env propagation

- 부모 (Claude Code host) 의 env (`CRUMB_TRANSCRIPT_PATH`, `CRUMB_SESSION_ID`, `CRUMB_ACTOR`, `CRUMB_SESSION_DIR`) 가 child Task agent 에 자동 상속되는가?
- 안 되면 sandwich 안에 `export CRUMB_TRANSCRIPT_PATH=...` 명시 + child 에서 다시 읽기

### Q2. Codex subagents 의 env propagation

- `~/.codex/agents/<name>.toml` 으로 spawn 된 child 가 host env 를 상속하는가?
- TOML 의 `developer_instructions` 에 env 명시 가능?

### Q3. `crumb event` CLI 가 child 에서 호출 가능?

- child 의 cwd 가 session_dir 인지, PATH 에 `crumb` 가 있는지
- adapter 가 PATH 에 inject 하는 패턴 확인

→ 30분 spike 로 mock 으로 흉내내어 확인 후 specialists/ 작업 진입.

---

## 차후 영향 — 다른 wiki 페이지 정정 항목

- [[bagelcode-task-direction]] §"기술 선택" line 99-100 → "별도 Coordinator 프로세스" 단독 → "Hybrid (Claude Code host + 자체 런타임)" 으로
- [[bagelcode-agents-fixed]] §"Step 6 Verifier 격리" → "cross-provider 강제" → "내부 subagent 격리 (default) + cross-provider opt-in"
- [[bagelcode-final-design-2026]] §1 외부 4 / 내부 7 그림 → "외부 1 host (Claude Code) + N Task tool subagent + opt-in codex-local" 추가
- [[bagelcode-paperclip-vs-alternatives]] §"Trade-off 표" → "자체 구현" 정의를 "host 하네스 위 자체 런타임" 으로 명시

→ 본 결정이 4 페이지 정정 트리거. 순차 정정.

---

## 변경 영향 — 코드/스펙 (Plan)

```
src/      변경 없음 (transcript / reducer / validator / adapter / dispatcher 그대로)
agents/   sandwich 4개 갱신 + agents/specialists/ 5개 신설
.claude/skills/crumb/SKILL.md   신설 (host 하네스 활성화 entry)
.crumb/config.toml + presets/   --cross-provider preset 추가
src/cli.ts                      --cross-provider flag 추가
README.md / README.ko.md        Quickstart 두 가지 (skill / headless) + Advanced
CHANGELOG.md                    신설 (Keep-a-Changelog)
```

---

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-paperclip-vs-alternatives]] — 자체 구현 vs framework (host 하네스 결정과 직접 연결)
- [[bagelcode-team-profile]] / [[bagelcode-ai-first-culture]] — 베이글코드 톤 1차 근거
- [[bagelcode-davis-system]] — 자연어 default UI 사내 사례
- [[bagelcode-kiki-leverage]] — sandwich + slack-style intent + scorecard guards
- [[bagelcode-agents-fixed]] — Verifier 격리 (이 결정으로 정정 필요)
- [[bagelcode-verifier-isolation-matrix]] — 13 사료 × 2 차원 매트릭스 (cross-provider opt-in 결정의 backing)
- [[bagelcode-final-design-2026]] — canonical lock (이 결정으로 §1 정정 필요)
- [[bagelcode-frontier-orchestration-2026]] §K Claude Code SDK + §L Codex subagents
