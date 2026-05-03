# Crumb

> 캐주얼 게임 prototype 을 위한 멀티 에이전트 실행 하네스. 한 줄 피치 → multi-host AI 코딩 에이전트가 Planner → Builder → deterministic QA check → Verifier (CourtEval) 로 협업, 사용자는 자연어로 언제든 개입.

[![CI](https://github.com/mangowhoiscloud/crumb/actions/workflows/ci.yml/badge.svg)](https://github.com/mangowhoiscloud/crumb/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 이름의 의미

**Crumb = 베이글 부스러기** — 베이글코드 brand motif + **breadcrumb pattern** (LLM agent 표준 path tracing / error steering, Hansel & Gretel metaphor) + transcript.jsonl 에 남는 에이전트 의사결정의 trail. 3중 의미.

## 핵심 메시지

이 도구는 멀티 에이전트 협업을 단순 채팅이 아니라 **관찰·개입·평가·재현 가능한 실행 프로토콜**로 다룹니다. 모든 메시지·도구 호출·산출물·사용자 개입·deterministic QA 결과·judge 점수가 **39 kind × 11 field × 12 specialist step × 8 actor** transcript 한 줄로 영속.

베이글코드 [신작팀 AI 개발자 과제](https://career.bagelcode.com/ko/o/208045) (2026-05-03 마감) 응시작.

### 메일 verbatim 정조준 (평가자 ctrl-F)

| 메일 키워드 | Crumb 충족 위치 |
|---|---|
| "Claude Code, Codex, Gemini CLI **등 다양한 에이전트를 동시에 사용**" | `bagelcode-cross-3way` preset (default) — builder=Codex, verifier=Gemini, 나머지 ambient. 3 host first-class. |
| "여러 AI 에이전트가 **서로 통신**" | 8 actor × 39 transcript kind, actor 간 `kind=handoff.{requested,accepted,rollback}`. |
| "사용자가 협업 과정에 **개입하거나 관찰**" | 5 user.* event × 4 host = 20-cell matrix. 자연어 → `kind=user.intervene`. |
| "통신 방식 / 프로토콜 / UI **자유**" | JSONL transcript + 4 entry path (Claude Code / Codex / Gemini / headless). |
| "AI 코딩 에이전트를 사용하여 개발" | Claude Code + Codex 로 직접 개발 — commits, sandwich, helpers, OTel exporter 가 흔적. |
| "**README대로 실행**시 동작" | `npx tsx src/index.ts run --adapter mock` 인증 0, 결정론. |
| "**.md 파일 포함**" | agents/*.md (5) + skills/*.md (5) + specialists/*.md (3) + .{claude,codex,gemini}/ entries (5). |
| "JSONL **또는** 녹화" | `transcript.jsonl` 39 kind; 데모 스크린캐스트 follow-up. |

## 빠른 시작

**최초 1회 셋업** (Streamlit 스타일 — clone / build / link / run):

```bash
git clone https://github.com/mangowhoiscloud/crumb.git && cd crumb && npm install && npm run build
npm link                                          # 1회: `crumb` + `crumb-studio` 가 PATH 에 등록
crumb doctor                                      # auth + chromium + Studio 점검
crumb run --goal "60초 매치-3 콤보 보너스"        # → http://localhost:7321 으로 Studio 자동 오픈
```

`crumb run` 이 Crumb Studio (로컬 read-only 관측 surface) 를 자동 spawn — Vite-style banner 가 URL + 방금 시작한 세션 deep link 까지 출력. CI / SSH / headless 환경에서는 `--no-studio` 또는 `CRUMB_NO_STUDIO=1` 로 비활성화. Studio 는 `detached + unref` 로 run 종료 후에도 살아있어 다음 `crumb run` 호출 시 재spawn 없이 그대로 재사용 (chokidar 가 새 transcript 를 자동 watch).

세션 시작 없이 Studio 만 띄우고 싶다면 `crumb studio` (= `crumb-studio` alias). `~/.crumb/projects/` 의 모든 기존 세션이 보이므로 언제든 안전하게 호출 가능.

> 글로벌 symlink 가 싫다면 `npm link` 를 건너뛰고 모든 명령에 `npx` 를 붙이면 된다 (`npx crumb run …`, `npx crumb studio`). `npx` 가 workspace `bin` 을 직접 resolve.

> **Chromium 다운로드 건너뛰기** (CI / air-gapped 환경): `CRUMB_SKIP_PLAYWRIGHT_INSTALL=1 npm install`. qa-check D6 portability gate 는 signal-only 로 남고, D2 lint + size gate 는 그대로 동작.

### A. 자연어 (Claude Code 사용자 — 권장)

```bash
$ claude
> /crumb 60초 매치-3 콤보 보너스 게임 만들어줘
```

`.claude/skills/crumb/SKILL.md` skill 이 피치를 받아 headless `crumb run` 호출 + transcript 이벤트 스트리밍. 자연어 추가 발화 ("이 부분 다르게", "콤보 보너스 좀 더 짧게") 도 `kind=user.intervene` 으로 자동 라우팅.

### B. Mock adapter (인증 없음, 결정론)

```bash
crumb run --goal "60-second match-3 with combo bonus" --adapter mock --idle-timeout 5000
```

인증 0 으로 동작 보장. **26-event v0.1 flow** 생성: `session.start → goal → planner-lead (5 step + spec + handoff) → builder (artifact + build + handoff) → qa.result (system, deterministic ground truth) → verifier (4 step.judge inline + judge.score aggregate=28/30 PASS + handoff) → done → session.end`. replay 결과 동일.

### C. 실 에이전트 (preset 선택)

```bash
# 인증 (있는 것만):
claude login           # Anthropic Claude Max
codex login            # OpenAI Codex Plus
gemini login           # Google Gemini Advanced

# 프로젝트 핀 + 임의 디렉터리에서 실행:
mkdir -p ~/projects/match3 && cd ~/projects/match3
crumb init --pin --label "match3"
crumb run --goal "60-second match-3 with combo bonus" --preset solo

# 결과 promote + checkable 폴더로 export:
crumb release <session-ulid> --as v1 --label "demo"
crumb copy-artifacts v1 --to ./demo
```

`provider × harness × model` 결정은 **사용자 통제권** — Crumb 은 강제 default 박지 않음. `crumb doctor` 로 환경에서 어떤 preset 이 실 동작 가능한지 확인.

## 세션 검사

```bash
crumb ls                                          # ~/.crumb/projects/*/sessions/ 모든 세션
jq -r '"\(.kind)\t\(.from)"' \
  ~/.crumb/projects/<project-id>/sessions/<ulid>/transcript.jsonl
crumb replay <ulid>                               # 결정론 재실행
```

## 라이브 대시보드 (브라우저 콘솔)

대시보드는 단일 바이너리 Node HTTP + SSE 서버. **기본 포트 `7321`, `127.0.0.1` 만 바인드** — 새 체크아웃 + 새 브라우저 탭이 macOS / Windows 방화벽 prompt 없이 즉시 동작. Cross-platform (chokidar + WSL/NFS polling fallback, 플랫폼-특화 syscall 0).

```bash
# `npm install && npm run build` (빠른 시작 단계) 후:
npx crumb-studio                  # http://127.0.0.1:7321/  (브라우저 자동 오픈)
npx crumb-studio --no-open        # 헤드리스 / SSH / CI    (URL 만 출력)
npx crumb-studio --port 8080      # 다른 포트
npx crumb-studio --bind 0.0.0.0   # LAN / SSH 터널 노출 (방화벽 prompt)
```

브라우저에서 보이는 것:

| 영역 | 내용 |
|---|---|
| **사이드바 (좌측)** | 프로젝트별 세션 그룹 + ＋ 버튼 (새 `crumb run` form: goal + preset). 행 hover 시 × 로 studio 에서 dismiss (디스크 transcript 는 보존). |
| **헤더 strip** | D1–D6 source-of-truth scorecard, 항상 보임, `kind=judge.score` 마다 갱신. |
| **Pipeline 탭** | 9-actor DAG topology (활성 actor 라임 펄스, 모든 transcript event 마다 sender → next-likely target 으로 lavender 리플 "weaving") + actor 별 swimlane chip 타임라인. |
| **Logs 탭** (ArgoCD-inspired) | actor 별 `<session>/agent-workspace/<actor>/spawn-*.log` 라이브 tail (모든 adapter spawn 의 stdout / stderr). filter / follow / clear / copy. DAG 노드 click 시 자동 점프. |
| **Output 탭** | sandboxed iframe 으로 `artifacts/game/index.html` (multi-file profile) 또는 `artifacts/game.html` (single-file fallback) 라이브 렌더. reload + open-in-new-tab. 즉석에서 플레이. |
| **Live execution feed** (입력창 위) | 활성 세션의 모든 transcript event **+** 모든 actor spawn log chunk 가 한 줄씩, kind 별 color-code 된 터미널-스타일 stream. |
| **Console input** (하단) | 슬래시 명령 (`/approve` `/veto <reason>` `/pause [@actor]` `/goto <actor>` `/note <text>`), `@actor` 멘션, plain-text user.intervene. **`/crumb <goal>`** 은 새 세션 spawn. |
| **Detail panel** (우측, 이벤트 클릭) | 파이프라인 위치 narrative ("PHASE B → C — Spec sealed"), parent → this → children thread, actor 별 sandwich preview, actor 별 mini-console. |

Cross-platform 환경 변수:

| 변수 | 효과 |
|---|---|
| `CRUMB_HOME` | `~/.crumb` 오버라이드 (sandbox / CI / 멀티유저 셋업) |
| `CRUMB_POLL=1` | chokidar polling 강제 (WSL2 / Docker / NFS / SMB) |
| `CRUMB_NO_OPEN=1` | 브라우저 자동 오픈 안 함 (`--no-open` 와 동일) |

## CLI

| 명령 | 동작 |
|---|---|
| `crumb run --goal "<피치>" [--preset <name>] [--adapter <id>]` | 세션 시작 |
| `crumb event` | 서브프로세스 에이전트가 stdin JSON 으로 transcript append |
| `crumb replay <session-dir>` | transcript 에서 상태 재구성 (결정론 검증) |
| `crumb resume <session-id\|dir>` | 상태 재구성 + mid-flight 재개 명령 출력 |
| `crumb doctor` | 환경 종합 점검 (3 host OAuth + adapter health + preset gating) |
| `crumb config <자연어>` | 자연어 설명에서 preset 추천 |
| `crumb debug <session-id\|dir>` | F1-F7 routing 장애 진단 |
| `crumb ls` | `~/.crumb/projects/*/sessions/` 모든 세션 + 이벤트 수 |
| `npx crumb-studio [--port 7321] [--bind 127.0.0.1] [--no-open]` | 라이브 관측 대시보드 (HTTP + SSE) — 위 "라이브 대시보드" 섹션 참조 |

## 아키텍처 (v0.1, 한 화면)

```
USER (자연어) ─ goal/intervene ───▶ COORDINATOR (host harness 자체)
                                        │ Task tool spawn (depth=1)
              ┌──────────────────┬──────┴───────────┬─────────────────┐
              ▼                  ▼                  ▼                 ▼
        PLANNER LEAD        BUILDER ★          VERIFIER ★         BUILDER FALLBACK
        (Socratic +         (sandwich +        (CourtEval inline   (Codex 죽었을 때)
         3 specialist        5 skill —          4 sub-step:
         inline:             tdd-iron-law,      grader/critic/
         concept /           verification-      defender/
         research /          before-completion, regrader)
         visual)             code-review,
                             parallel-dispatch,
                             subagent-spawn)
              │                  │                  │
              └──────────────────┴────────────┬─────┘
                                              │
                            qa_check effect (★ deterministic, no LLM)
                            emits kind=qa.result (D2/D6 ground truth)
                                              │
                                              ▼
                              transcript.jsonl (39 kind, append-only)
                                              │
                                              ▼
                              control plane (pure reducer + state)
```

- **외부 5 actor** + **3 specialist** (Planner inline) + **5 skill** (procedural workflow)
- **Multi-host 4 entry**: Claude Code skill / Codex CLI / Gemini CLI / headless `crumb run`
- **스키마**: 39 kind × 11 field × 12 specialist step × 8 actor × OTel GenAI alias
- **3-layer scoring**: reducer-auto (D3/D4) + qa-check-effect (D2/D6, deterministic) + verifier-llm (D1, semantic)
- **비용**: $0/session (Claude Max + Codex Plus + Gemini Advanced 구독) 또는 `--adapter mock` (무료)
- **설정 자유도**: actor 별 `(harness × provider × model)` 3-tuple, 사용자가 preset 으로 선택, 명시 없으면 ambient (entry host 따라감)

전체 canonical spec: [wiki/concepts/bagelcode-system-architecture-v0.1.md](./wiki/concepts/bagelcode-system-architecture-v0.1.md).

## Preset 옵션

actor 별 `(harness × provider × model)` 결정은 **사용자가** 선택. Crumb 은 강제 X. `crumb doctor` 로 환경에서 어떤 preset 이 가능한지 확인.

| Preset | Binding | 사용 사례 |
|---|---|---|
| **(no preset)** ambient | 모든 actor 가 entry host 따라감 (e.g. claude-code + claude-opus-4-7) | 가장 단순 — 인증된 환경 그대로 |
| **`bagelcode-cross-3way`** | builder=codex+gpt-5.5-codex / verifier=gemini-cli+gemini-3-1-pro / 나머지 ambient | 베이글코드 메일 verbatim "Claude Code, Codex, Gemini CLI 등 동시 사용" 정조준. 3-provider cross-assemble |
| **`mock`** | 모든 actor = mock adapter | CI / 인증 없음 / 결정론 데모 |
| **`sdk-enterprise`** | API key 직접 (subscription 우회) | Production / ToS 안전 (Anthropic 3rd-party OAuth 차단 회피) |
| **`solo`** | 단일 entry host + 단일 model | 최소 셋업 데모 |

Preset 파일: `.crumb/presets/*.toml`. **Cross-provider 는 별도 flag 가 아닌 preset 의 한 사용 사례**.

## 결정의 근거

모든 architecture 결정이 2026 frontier 1차 사료에 backed:

- **Multi-host × 3-tuple actor binding** — Claude Code / Codex / Gemini / OpenCode CLI 의 2026-04 convergence (7 공통 primitive). → [wiki/references/bagelcode-frontier-cli-convergence-2026.md](./wiki/references/bagelcode-frontier-cli-convergence-2026.md)
- **5-actor split (builder ⫶ verifier)** — actor-level provider boundary 가 진짜 cross-assemble 의 전제 (sandwich-internal step boundary 부족). → [wiki/concepts/bagelcode-verifier-isolation-matrix.md](./wiki/concepts/bagelcode-verifier-isolation-matrix.md) (20 사료 × 4 차원)
- **3-layer scoring** — CourtEval ACL 2025 + G-Eval + position-bias IJCNLP 2025 + self-bias NeurIPS 2024 + multi-judge consensus 97-98% F1. → [wiki/references/bagelcode-llm-judge-frontier-2026.md](./wiki/references/bagelcode-llm-judge-frontier-2026.md)
- **Verifier 직전 deterministic qa_check** — Karpathy P4 anti-deception ratchet + obra/superpowers TDD Iron Law (89K stars). dispatcher 가 ground truth 를 만들면 LLM judge 가 D2 (exec) 거짓말 못 함.
- **Hub-Ledger-Spoke 토폴로지** — Lanham 2026-04 (centralized 4.4× error containment vs independent 17.2× amp).
- **Short relay** — MIT 결정 이론 (5-stage relay → 22.5% accuracy 회귀).
- **Subprocess injection** — Karpathy LLM.txt + AGENTS.md (Linux Foundation 표준), 에이전트 identity 통제 가능.
- **OTel GenAI alias** — Datadog/Vertex/Anthropic Console/Phoenix/Langfuse export-ready.
- **사용자 통제 preset** — Anthropic 2026-03 "wrong tradeoff" 자인. `provider × harness × model` 결정은 사용자.

자세한 인용 chain: [wiki/synthesis/bagelcode-frontier-rationale-5-claims.md](./wiki/synthesis/bagelcode-frontier-rationale-5-claims.md), [wiki/synthesis/bagelcode-host-harness-decision.md](./wiki/synthesis/bagelcode-host-harness-decision.md).

## 산출물

성공한 세션:

```
sessions/<session-id>/
├── transcript.jsonl                    # Replay-deterministic 이벤트 로그 (39 kind × 11 field)
├── ledgers/
│   ├── task.json                       # 누적 사실 (transcript 에서 derive 가능)
│   └── progress.json                   # turn 별 상태 (transcript 에서 derive 가능)
├── artifacts/
│   ├── game.html                       # Phaser 3.80 single-file 플레이 가능 게임
│   ├── spec.md                         # Acceptance criteria + 룰북
│   ├── DESIGN.md                       # 색감 / 메커닉 / 모션 spec
│   └── tuning.json                     # 밸런스 수치 (Unity ScriptableObject 변환 가능)
├── exports/                            # ★ v0.1 — observability 내보내기
│   ├── otel.jsonl                      # OpenTelemetry GenAI Semantic Conventions
│   ├── anthropic-trace.json            # Anthropic Console import 형식
│   └── chrome-trace.json               # chrome://tracing 시각화
└── index.html                          # ★ v0.1 — 자동 생성 HTML 후처리 리포트
```

이 산출물은 **Unity 신작팀의 input asset** — Crumb 는 production Unity workflow **앞 단계**의 prototype 검증 도구.

## 상태

```
✅ 스키마 v0.1 — 39 kind × 11 field × 12 step × 8 from + D1-D6 source-of-truth scoring
✅ Pure reducer — circuit breaker / adaptive stop / rollback / user.veto rebound (vitest)
✅ Adapter — claude-local / codex-local / gemini-local / mock
✅ Live dispatcher — spawn / append / hook / rollback / stop / done / qa_check
✅ qa_check effect — deterministic ground truth (LLM 없음, htmlhint + playwright headless smoke)
✅ Preset loader — (harness × provider × model) 3-tuple binding + ambient fallback
✅ CLI — run / event / replay / resume / doctor / config / debug / ls
✅ Skill — .claude/skills/crumb/SKILL.md (Claude Code 자연어 진입점)
✅ Summary — 자동 생성 index.html + OTel/Anthropic/Chrome trace exports
✅ CI — lint + typecheck + format + test (Node 18/20/22) + 스키마 검증

🟡 claude-local + codex-local + gemini-local 실제 end-to-end (env propagation spike 진행 중)
🟡 Persistence boost — flock + adapter_session_id 메타 ('crumb resume' live re-entry, P1)
🟡 MCP Provider — localhost:8765 cross-host fan-in (P1)
🟡 --strict-cross-provider — Builder=OpenAI / Verifier=Anthropic 진짜 cross-assemble (P1)
🟡 데모 스크린캐스트
```

## 문서

- [AGENTS.md](./AGENTS.md) — 이 repo 에서 작업하는 에이전트/기여자용 (Linux Foundation Agentic AI Foundation 표준)
- [agents/_event-protocol.md](./agents/_event-protocol.md) — 서브프로세스 에이전트가 `crumb event` 로 이벤트 emit 하는 방법
- [protocol/schema.md](./protocol/schema.md) — 1-page transcript spec
- [protocol/schemas/message.schema.json](./protocol/schemas/message.schema.json) — JSON Schema (draft 2020-12)
- [.claude/skills/crumb/SKILL.md](./.claude/skills/crumb/SKILL.md) — Claude Code host harness 진입점
- [.crumb/presets/](./.crumb/presets/) — `bagelcode-cross-3way` / `mock` / `sdk-enterprise` / `solo`
- [wiki/](./wiki/) — 설계 rationale (mango-wiki subset, 35 page)
  - [bagelcode-system-architecture-v0.1.md](./wiki/concepts/bagelcode-system-architecture-v0.1.md) — ★ canonical v0.1 시스템 구조
  - [bagelcode-host-harness-decision.md](./wiki/synthesis/bagelcode-host-harness-decision.md) — Hybrid (Skill + headless CLI) lock
  - [bagelcode-verifier-isolation-matrix.md](./wiki/concepts/bagelcode-verifier-isolation-matrix.md) — 20-사료 매트릭스
  - [bagelcode-final-design-2026.md](./wiki/concepts/bagelcode-final-design-2026.md) — §3-§9 (envelope / cache / OTel) v0.1 에서도 유효

## License

MIT
