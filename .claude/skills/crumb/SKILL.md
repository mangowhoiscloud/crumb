---
name: crumb
description: >-
  Crumb host harness for casual-game prototyping. Triggers when the user pitches a casual game in
  natural Korean or English (e.g. "60초 매치-3 게임 만들어줘", "make a swipe-to-merge clicker",
  "build a 30s tap defender") OR explicitly invokes `/crumb`. Thin natural-language wrapper over
  the headless `crumb run` CLI — Crumb keeps its own append-only transcript (39-kind JSONL),
  pure reducer, adapter layer, and `(harness × provider × model)` 3-tuple actor binding.
  `--preset` selection (and provider/harness binding) is the user's call — Crumb suggests via
  `crumb doctor` based on what is installed/authenticated, but never forces a default.
  Cross-provider is a use case example, not a separate flag. Do NOT trigger for general code
  requests, library questions, or non-game tasks.
allowed-tools: Bash Task Read Write Edit Glob Grep
argument-hint: <자연어 게임 goal — 예: "60초 매치-3 콤보 보너스">
---

# Crumb — Multi-Agent Game Prototyping Skill (v3)

Bagelcode 신작팀 (mobile casual) 의 멀티 에이전트 협업 도구. 자연어로 게임 한 줄 던지면 Planner Lead → Builder → qa_check effect → Verifier (CourtEval) 가 협업해서 Phaser 3.80 single-file `game.html` + spec.md + DESIGN.md + tuning.json 까지 산출.

> **3-layer 분리** (`wiki/synthesis/bagelcode-host-harness-decision.md`):
> 1. 자연어 인터페이스 = Claude Code (이 skill 의 host) — multi-host 4 entry 중 1순위
> 2. 자연어 → 백엔드 라우팅 = 본 SKILL.md + `agents/*.md` sandwich + 5 skill (`skills/*.md`)
> 3. 오케스트레이션 control plane = `src/{transcript,reducer,validator,adapter,dispatcher,loop}/`
>
> **v3 변경 요지** (`wiki/concepts/bagelcode-system-architecture-v3.md`):
> - Engineering Lead → **builder + verifier actor split** (cross-provider true split)
> - `--cross-provider` flag → **`--preset <name>`** (named preset, BYO)
> - 38 kind → **39 kind** (+`qa.result` deterministic effect)
> - scores → **D1-D6 source-of-truth matrix** (reducer-auto / qa-check-effect / verifier-llm / hybrid)
> - Multi-host 4 entry (Claude Code / Codex CLI / Gemini CLI / headless) + ambient fallback
> - MCP Provider (cross-host fan-in) + auth-manager (`crumb doctor`) + persistence boost (`crumb resume`)

## When to trigger

자연어 trigger 인식:
- "**60초 매치-3 게임 만들어줘**", "**make a swipe-to-merge game**", "**build a 30s clicker**" — 캐주얼 게임 pitch
- 명시 command: "**/crumb \<pitch\>**", "**crumb 시작 \<pitch\>**"
- preset 의도: "Codex + Gemini 도 같이" → `bagelcode-cross-3way`, "키 없이 돌려봐" → `mock`, "API key 로 돌려" → `sdk-enterprise`

발화 X (skill 비활성):
- 코드 리뷰 / 디버깅 / 라이브러리 질문
- 비-캐주얼 게임 (3D / FPS / MMO 등 — Phaser 단일 파일 fit ❌)
- 일반 multi-agent 시스템 설계 질문 (`wiki/` 만 참조)

## How to run

### 1. Pitch + preset 추출

사용자 발화에서:
- **goal** 문자열 추출 — `/crumb` prefix / 한국어 조사 / "만들어줘" 같은 종결어 제거
- **preset** — 사용자가 명시한 경우만 사용. 명시 없으면 ambient (entry host 따라감, Crumb 이 강제 X).
  - 사용자가 "어떤 preset 있어?" / "추천해줘" 묻는 경우에만 `crumb doctor` 출력 + preset list 제시 후 선택 위임
  - 사용자 발화에 명시 명칭 ("bagelcode-cross-3way", "mock", "sdk-enterprise" 등) 검출 시 그대로 전달
  - 사용자 의도 ("키 없이 돌려봐") 와 명시 발화가 충돌하면 명시 우선

→ 핵심 원칙: **provider × harness × model 결정은 사용자 통제권**. Crumb 은 도와주는 도구일 뿐 default 박지 않음 (Anthropic 2026-03 "wrong tradeoff" 교훈).

### 2. Crumb session 시작 (headless)

```bash
cd /Users/mango/workspace/crumb
GOAL="<extracted goal>"
# 사용자가 preset 명시 안 했으면 그냥 생략 (ambient 동작)
if [ -n "$PRESET" ]; then
  npx tsx src/index.ts run --goal "$GOAL" --preset "$PRESET"
else
  npx tsx src/index.ts run --goal "$GOAL"
fi
```

session id (ULID) 가 출력됨. `sessions/<ulid>/` 가 생성되고 dispatcher 가 actor subprocess 를 spawn.

> **환경 진단** — 사용자가 "어떤 preset 가능?" 묻거나 환경 미흡 의심 시:
> ```bash
> npx tsx src/index.ts doctor
> ```
> 4 host entry × adapter health × installed/authenticated preset 출력. **선택은 사용자가** — Crumb 은 이 출력으로 가능한 옵션만 제시.

### 3. Transcript 스트리밍

session 진행 중 의미 있는 event 만 추려 사용자에게 보고:

```bash
tail -f sessions/<ulid>/transcript.jsonl | jq -r '
  select(.kind | IN("goal","question.socratic","spec","build","qa.result","judge.score","done","error","handoff.requested")) |
  "[\(.ts | split("T")[1] | split(".")[0])] \(.from)\t\(.kind)\t\(.body // (.data | tostring) | .[0:120])"
'
```

생략할 kind: `ack`, `audit`, `tool.call`, `tool.result`, `agent.thought_summary`. 살릴 kind: `step.judge` 의 grader/critic/defender/regrader 4 sub-step + `qa.result` (v3 신규 deterministic ground truth).

### 4. 사용자 자연어 개입 (running 중)

session 진행 중 사용자가 자연어로 추가 입력하면:

```bash
SESSION_ID="<active ulid>"
TRANSCRIPT="sessions/$SESSION_ID/transcript.jsonl"

KIND="user.intervene"  # 또는 user.veto / user.approve / user.pause / user.resume
echo "{\"from\":\"user\",\"kind\":\"$KIND\",\"body\":\"<원문 그대로>\",\"data\":{\"target\":\"<infer: spec/tuning/design>\"}}" \
  | CRUMB_TRANSCRIPT_PATH="$TRANSCRIPT" \
    CRUMB_SESSION_ID="$SESSION_ID" \
    CRUMB_SESSION_DIR="sessions/$SESSION_ID" \
    npx tsx src/index.ts event
```

reducer 가 받아서 `progress.next_speaker` 를 갱신 (보통 planner-lead 로 회귀해서 spec.update 발행).

### 5. 결과 surface

`kind=done` event 도착 시:

```
✅ session 완료 — sessions/<ulid>/
   ▸ artifacts/game.html       (브라우저 더블클릭 가능)
   ▸ artifacts/spec.md         (acceptance criteria + 룰북)
   ▸ artifacts/DESIGN.md       (color / mechanics / motion)
   ▸ artifacts/tuning.json     (balance numbers)
   ▸ transcript.jsonl          (replay-deterministic, 39 kind × 11 field × 8 from)
   ▸ judge.score (D1-D6)       (source-of-truth matrix: reducer-auto / qa-check-effect / verifier-llm)
```

사용자가 "열어줘" / "play" 면:
```bash
open sessions/<ulid>/artifacts/game.html
```

### 6. 중단 후 재개 (v3 persistence boost)

세션 mid-run 에서 Ctrl-C / crash 시:
```bash
npx tsx src/index.ts resume <session-id>
```
adapter native session id (Claude Code `--resume` / Codex `--thread`) 를 metadata 에서 읽어 host harness 복원. cache_carry_over 보존.

## Preset 옵션 (사용자 선택, Crumb 은 추천만)

`provider × harness × model` 결정은 사용자 통제권. Crumb 은 `crumb doctor` 결과로 어떤 preset 이 가능한지만 제시하고, 강제 default 박지 않음.

| Preset | 구성 요지 | 설치/인증 요구 | 어울리는 사용 사례 |
|---|---|---|---|
| **(no preset)** ambient | entry host 따라감 (e.g. claude-code + claude-opus-4-7) — Crumb 이 binding 결정 X | entry host 의 인증 1개 | 단순 진입, 환경 그대로 사용 |
| **`bagelcode-cross-3way`** | builder=codex+gpt-5.5-codex / verifier=gemini-cli+gemini-2.5-pro / 나머지 ambient | claude + codex + gemini 3 인증 | **사용 사례 — cross-provider 시연**: 베이글코드 메일 "Claude Code, Codex, Gemini CLI 등 동시 사용" 정조준. matrix C2 cross-assemble 완전 (CP-WBFT / MAR / Lanham 0.32→0.89). |
| **`mock`** | 모든 actor = mock adapter, deterministic | 0 | **사용 사례 — CI / 평가자 환경**: 키 없이 동작 보장, replay-deterministic |
| **`sdk-enterprise`** | API key 직접 호출 (subscription 우회) | 3 API key (ANTHROPIC / OPENAI / GEMINI) | **사용 사례 — production**: ToS 안전 (Anthropic 3rd-party OAuth 차단 회피), 평가자가 enterprise 키 보유 시 |
| **`solo`** | 단일 entry host 의 단일 model (가장 가벼움) | entry host 1개 | **사용 사례 — 최소 셋업 데모**: subscription 만으로 빠른 demo |

→ 자세한 preset 형식: `.crumb/presets/*.toml`. **사용자가 직접 선택**. Crumb 이 추측 / 강제 X.

**Cross-provider 는 별도 모드가 아님 — 단지 위 preset 중 일부의 사용 사례 라벨**. v2 의 `--cross-provider` binary flag 는 폐기됨. 사용자가 cross-provider 의도면 명시 preset 명칭 사용.

## Actor split (v3)

v2 의 "Engineering Lead 안 inline 4 sub-step" → v3 의 **builder + verifier 별도 actor** (cross-provider true split).

| Actor | Sandwich | Step (sequential within actor) |
|---|---|---|
| coordinator | `agents/coordinator.md` | (host-inline routing) |
| planner-lead | `agents/planner-lead.md` | socratic / concept / research / design / synth (3 specialist inline) |
| **builder** ★ | `agents/builder.md` | step.builder + step.qa (Builder + QA inline) |
| (effect) qa_check | (no sandwich) | dispatcher emits `kind=qa.result` (deterministic, LLM 무관) |
| **verifier** ★ | `agents/verifier.md` | step.judge × 4 (grader/critic/defender/regrader, CourtEval) + reviewer persona |
| builder-fallback | `agents/builder-fallback.md` | builder 실패 시 회귀 (builder 와 동일 contract) |

→ 5 outer actor + 3 specialist (planner inline) + 5 skill (procedural workflow):

```
[skills]
tdd_iron_law                   # superpowers: NO PRODUCTION CODE WITHOUT FAILING TEST FIRST
verification_before_completion # done 이전 verifier PASS 강제
code_review_protocol           # builder ↔ verifier handoff format
parallel_dispatch              # specialist 병렬 호출 (planner inline)
subagent_spawn                 # host-native primitive 추상화
```

## Multi-host (v3)

| Host | Entry path | 활성 trigger |
|---|---|---|
| **Claude Code** | `.claude/skills/crumb/SKILL.md` (이 파일) | `claude` + 자연어 게임 발화 |
| **Codex CLI** | `~/.codex/agents/crumb.toml` | `codex` + `/crumb <pitch>` |
| **Gemini CLI** | `~/.gemini/extensions/crumb/` | `gemini` + 자연어 게임 발화 |
| **Headless** | `npx tsx src/index.ts run --goal "..."` | CI / 평가자 키 없음 |

→ 사용자가 어떤 host 에서 진입하든 control plane (transcript / reducer / state) 동일. cross-host 시나리오 시 MCP Provider (`localhost:8765`) 가 fan-in.

## Skill enforcement (do NOT)

- ❌ Task tool 직접 spawn 으로 Crumb actor 흉내 — `crumb run` 의 dispatcher 만 spawn 권한
- ❌ artifacts 직접 작성 — host 가 아니라 spawn 된 sub-agent 만 쓰기 권한
- ❌ transcript.jsonl 직접 append — `crumb event` CLI 만 통과
- ❌ `kind=qa.result` 를 LLM 으로 산출 — dispatcher 의 effect 만 발행 (deterministic)
- ❌ 비-게임 task 에 활성화 — description 에 명시된 trigger 만
- ❌ **preset 자동 선택 / 강제 / 추측** — 사용자가 명시 안 하면 ambient (entry host 따라감). 묻기 전에 `crumb doctor` 결과로 가능 옵션 보여주기만, 선택 X (Anthropic 2026-03 "wrong tradeoff" 교훈)
- ❌ **provider × harness × model 강제** — 이 3 차원 결정은 사용자 통제권. Crumb 은 도와주는 도구일 뿐

## References

- `AGENTS.md` (repo root) — ★ universal Crumb identity (Linux Foundation Agentic AI Foundation standard). Architecture invariants, actors, schema, multi-host entries, preset philosophy, universal Don't / Must. Auto-imported by `CLAUDE.md` (this skill's parent context) via `@AGENTS.md`. Read this before any actor sandwich.
- `CLAUDE.md` (repo root) — Claude Code-specific augmentation (.skills/ 24 매핑 / Korean policy / progress / verify gate). Auto-loaded by Claude Code; imports AGENTS.md inline.
- `wiki/concepts/bagelcode-system-architecture-v3.md` — ★ canonical v3 시스템 구조 (multi-host + 3-tuple + 5 actor + 3-layer scoring + MCP Provider + persistence)
- `wiki/synthesis/bagelcode-host-harness-decision.md` — Hybrid (Skill + headless CLI) lock 결정
- `wiki/concepts/bagelcode-verifier-isolation-matrix.md` — actor-level split 의 backing
- `wiki/concepts/bagelcode-system-architecture.md` (v2) — §3-§9 (envelope / cache / per-turn flow / control plane / OTel) v3 에서도 유효
- `wiki/references/bagelcode-frontier-cli-convergence-2026.md` — 4 CLI × 7 primitive (multi-host backing)
- `wiki/references/bagelcode-llm-judge-frontier-2026.md` — 3-layer scoring 학술 backbone
- `agents/coordinator.md` / `agents/planner-lead.md` / `agents/builder.md` / `agents/verifier.md` / `agents/builder-fallback.md` — 5 actor sandwich
- `agents/specialists/` — concept-designer / researcher / visual-designer (planner inline)
- `agents/_event-protocol.md` — `crumb event` 사용 spec
- `protocol/schemas/message.schema.json` — 39 kind transcript schema (v3)
- `.crumb/config.toml` + `.crumb/presets/{bagelcode-cross-3way,mock,sdk-enterprise,solo}.toml` — preset 시스템
- `skills/{tdd-iron-law,verification-before-completion,code-review-protocol,parallel-dispatch,subagent-spawn}.md` — 5 skill (procedural workflow)
