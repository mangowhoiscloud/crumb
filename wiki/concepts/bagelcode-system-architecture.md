---
title: 베이글코드 과제 — Crumb 시스템 구조 + Prompt Assemble 절차 (Hybrid Lock)
category: concepts
tags: [bagelcode, architecture, system-overview, prompt-assemble, transcript, sandwich, envelope, cache-boundary, hybrid, 2026]
sources:
  - "[[bagelcode-host-harness-decision]]"
  - "[[bagelcode-verifier-isolation-matrix]]"
  - "[[bagelcode-transcripts-schema]]"
  - "[[bagelcode-caching-strategy]]"
  - "[[bagelcode-final-design-2026]]"
  - "src/protocol/schemas/message.schema.json"
  - "agents/_event-protocol.md"
summary: >-
  Hybrid lock 직후 v2 시스템 구조 — 외부 1 host (Claude Code) + Task subagent N + Verifier inline.
  §1-§2 토폴로지는 v0.1 (system-architecture-v0.1) 가 canonical 로 대체, §3-§9 는 v0.1 에서도 유효.
provenance:
  extracted: 0.65
  inferred: 0.30
  ambiguous: 0.05
created: 2026-05-02
updated: 2026-05-02
---

# Crumb 시스템 구조 + Prompt Assemble 절차 (v2)

> ★ **2026-05-02 supersession** — 본 페이지 §1-§2 (토폴로지 + 38 kind) 는 [[bagelcode-system-architecture-v0.1]] 로 대체. v0.1 변화 요지: 외부 1 host → Multi-host 4 entry, Engineering Lead inline → builder + verifier actor split, 38 kind → 39 kind (+`qa.result`), single-layer Verifier → 3-layer scoring (reducer auto + qa_check effect + verifier CourtEval), MCP Provider 신규, persistence boost (`crumb resume`) 신규. 본 페이지 §3 (prompt assemble 5단계) / §4 (per-turn flow) / §5 (cache 경계) / §6 (control plane vs LLM layer 책임 분담) / §7 (default vs cross-provider) / §8 (headless) / §9 (sub-system 변경 영향) 은 v0.1 에서도 변경 없이 유효 — 단 actor enum / kind 수 / metadata 필드는 v0.1 기준 갱신 필요.
>
> [[bagelcode-host-harness-decision]] (Hybrid lock) 후의 **v2 시스템 구조**. 전체 개요도 + transcript schema (v2 시점 38 kind 기준) + sandwich/envelope assemble 절차 + per-turn flow.
>
> [[bagelcode-final-design-2026]] §1 의 "외부 4 / 내부 7" 그림은 본 페이지로 대체. final-design §2-§8 (transcript schema / state machine / adapter / OTel) 은 변경 없이 유효.

---

## 0. 한 줄 요약

```
USER (자연어)
   ▾
Claude Code (host 하네스 = Coordinator 역할)              ← LLM layer
   ▾  Task tool spawn (depth=1)
specialist subagents (Planner Lead / Engineering Lead / sub-specialists)
   ▾  envelope 주입 (XML system prompt) + crumb event 호출
transcript.jsonl  (38 kind × 11 field, append-only, ULID 정렬)        ← Control plane
   ▾
reducer (pure) → state → effects → dispatcher                          ← Control plane
   ▾  spawn / append / persist / hook / done

cross-provider opt-in:
   Engineering Lead = subprocess spawn codex-local CLI (외부 actor 추가)
   Verifier         = host Claude Code Task subagent (다른 sandwich, cross-assemble)
```

3 layer 분리:
- **자연어 인터페이스** = Claude Code (host)
- **자연어 → 백엔드 라우팅** = `.claude/skills/crumb/SKILL.md` + `agents/*.md` sandwich
- **오케스트레이션 control plane** = `src/{transcript, reducer, state, validator, adapter, dispatcher, loop}/`

---

## 1. 전체 개요도 — Default mode (single provider)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                              사용자 (자연어)                                      │
│   "60초 매치-3 콤보 게임 만들어줘"   "이 부분 다르게 해줘"   "/crumb pause"        │
└──────────────────────────────────────┬─────────────────────────────────────────┘
                                       │
                                       ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                CLAUDE CODE (host 하네스, 외부 process 1개)                       │
│                                                                                │
│   .claude/skills/crumb/SKILL.md  ◀──── 자연어 trigger                           │
│         │                                                                       │
│         │ 1. crumb event session.start (env: CRUMB_TRANSCRIPT_PATH 등 설정)     │
│         │ 2. assemble envelope from agents/coordinator.md sandwich              │
│         │ 3. Coordinator 역할 = Claude Code 자체 (host inline)                  │
│         │                                                                       │
│         ▼                                                                       │
│   COORDINATOR (host inline, sandwich injection)                                 │
│     · routing rules + ledger update + validator                                │
│     · adapter health (claude/codex CLI version probe)                          │
│         │                                                                       │
│         │ Task tool spawn (Anthropic native, depth=1, env propagation)         │
│         ├──────────────────────────────────────────────┐                       │
│         ▼                                              ▼                       │
│   PLANNER LEAD subagent              ENGINEERING LEAD subagent                  │
│   (sandwich: agents/planner-lead.md)  (sandwich: agents/engineering-lead.md)   │
│         │                                              │                       │
│         │ Task tool spawn ▼                            │ Task tool spawn ▼     │
│   ┌─────┼─────┬─────┐                          ┌──────┴──────┐                 │
│   ▼     ▼     ▼     ▼                          ▼             ▼                 │
│  socratic concept research design              qa.md         verifier.md       │
│  (host    (specialists/  (specialists/        (specialists/  (specialists/     │
│   inline)  concept-      researcher.md +       qa.md)        verifier.md +     │
│            designer.md)  visual-                              CourtEval 4       │
│                          designer.md)                         sub-step inline)  │
│                                                                                │
│   각 subagent 가 Bash tool 으로 `crumb event ...` 호출 (env 상속)                │
└──────────────────────────────────────┬─────────────────────────────────────────┘
                                       │
                                       ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                  CONTROL PLANE (자체 light layer, src/)                         │
│                                                                                │
│   transcript.jsonl  (append-only, ULID 정렬, 38 kind × 11 field)               │
│         │                                                                       │
│         │ chokidar watch (live) / fs.readFile (replay)                         │
│         ▼                                                                       │
│   reducer (pure)  ──▶  state {TaskLedger, ProgressLedger, circuit, pause}      │
│         │                                                                       │
│         ▼                                                                       │
│   effects [spawn, kill, append, persist, hook, done]                            │
│         │                                                                       │
│         ▼                                                                       │
│   dispatcher (live: real subprocess / replay: noop / test: mock)                │
└────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                  artifacts/{game.html, spec.md, DESIGN.md, tuning.json}
                  + summary.html (post-session)
```

---

## 2. 전체 개요도 — Cross-provider mode (`--cross-provider`)

```
USER → CLAUDE CODE (host)
                 │
                 ├── PLANNER LEAD (Task subagent, Claude)
                 │     └── concept/research/design specialists (Task)
                 │
                 ├── ★ ENGINEERING LEAD = subprocess spawn codex-local CLI
                 │   ┌─────────────────────────────────────────────────────────┐
                 │   │ Codex CLI (외부 process 2번째) — sandwich Markdown 주입  │
                 │   │   builder + qa + synth (host inline, Codex 자체)        │
                 │   │   Bash tool → `crumb event ...` (env 상속)              │
                 │   └─────────────────────────────────────────────────────────┘
                 │
                 └── ★ VERIFIER = Claude Code Task subagent (다른 sandwich)
                     · Codex 산출물 fetch (artifacts/game.html sha256)
                     · D1-D6 채점 + CourtEval 4 sub-step
                     · cross-assemble: 구현 = OpenAI / 검증 = Anthropic
                     · matrix #8 CP-WBFT + #9 MAR + #13 Lanham 0.32→0.89 모두 backing

control plane = 동일 (transcript + reducer + state)
```

→ 외부 process **1 → 2 추가**. 내부 subagent depth 동일.

---

## 3. Schema — 실코드 기준 (38 kind × 11 field)

`src/protocol/schemas/message.schema.json` 발췌.

### 11 field

```typescript
type Message = {
  // 식별 (4)
  id:               ULID                  // 26-char Crockford base32
  ts:               ISO-8601              // UTC
  session_id:       string
  task_id?:         string                // multi-task 안 session

  // 라우팅 (4)
  from:             ActorId               // user / coordinator / planner-lead /
                                          // engineering-lead / builder-fallback /
                                          // validator / system   (7개)
  to?:              ActorId | "*"
  parent_event_id?: ULID
  in_reply_to?:     ULID                  // deprecated alias

  // 분류 (3)
  kind:             MessageKind           // 38개 (아래)
  topic?:           string
  step?:            SpecialistStep        // 12개 (아래)
}

// 본문 (옵션 — kind 별 schema 결정)
body?:           string                   // 자유 텍스트
data?:           Record<string, unknown>  // structured payload (kind별 schema)
content?:        { format: 'markdown'|'json'|'text'|'xml', text: string }
artifacts?:      ArtifactRef[]
scores?:         { D1..D6, aggregate, verdict }
ack_required?:   boolean
blocking?:       boolean
metadata?:       { visibility, model, turn, tokens_in/out, cache_read/write,
                   latency_ms, cost_usd, thinking_tokens, audit_violations }
```

### 38 kinds (실 schema enum)

```
─── system (4) ─────────────────────────
session.start          세션 개시 + manifest
session.end            세션 종료
agent.wake             actor spawn 명령
agent.stop             actor 정지

─── workflow (10) ──────────────────────
goal                   사용자 최상위 요청
question.socratic      Planner Lead → user 모호성 질문
answer.socratic        user 응답
spec                   Planner Lead 산출 (AC + 룰북)
spec.update            spec 수정
build                  Engineering Lead 코드 산출
verify.request         검증 요청
verify.result          검증 결과 (legacy alias of judge.score)
judge.score            ★ first-class scorecard (D1-D6 + aggregate + verdict)
done                   최종 산출 확정

─── dialogue (5) ──────────────────────
agent.thought_summary  private CoT (캐시 X, summary만)
question               일반 질문 (Lead → User 또는 cross-Lead)
answer                 응답
debate                 다자 토론 entry (CourtEval 내부)
note                   자유 코멘트 (라우팅 X)

─── lead-internal step (5) ──────────
step.socratic          Planner Lead step 진입 마킹
step.concept
step.research
step.design
step.judge             Verifier 의 grader/critic/defender/regrader

─── user intervention (5) ─────────────
user.intervene         일반 개입
user.veto              특정 메시지 거부
user.approve           명시 승인
user.pause             전역 pause
user.resume            전역 resume

─── handoff (3) ────────────────────────
handoff.requested      Lead → Lead 명시
handoff.accepted       coordinator 의 ack
handoff.rollback       verify FAIL → planner-lead 회귀

─── artifact / meta (6) ──────────────
artifact.created       산출물 ref (path + sha256)
ack                    수신 확인
error                  오류 보고
audit                  감사 (auto)
tool.call              ★ subagent 의 도구 호출 trace
tool.result            ★ 도구 결과 trace
hook                   coordinator → user modal
```

→ **38 kind**. (final-design-2026 §2 의 "28 kind" 는 P0 이전 카운트, 현재 schema 가 정확.)

### 12 step enum (Lead 안 sub-step)

```
socratic / concept / research / design   ← Planner Lead
builder / qa / verifier                   ← Engineering Lead
grader / critic / defender / regrader     ← Verifier 안 CourtEval
synth                                      ← Lead final
```

### 7 from enum (실 actor)

```
user / coordinator / planner-lead / engineering-lead / builder-fallback /
validator / system
```

→ specialist (concept-designer / researcher / qa 등) 은 from 별도 X. step 필드로 구분 (Lead actor 가 emit, step 으로 어느 sub-role 인지 표기).

---

## 4. Prompt Assemble 절차 — 5 단계

### 단계 1 — sandwich load (static, cache 1h)

각 actor 마다 4 section sandwich:

```
agents/coordinator.md          ← Coordinator (host inline)
agents/planner-lead.md          ← Planner Lead subagent
agents/engineering-lead.md     ← Engineering Lead subagent (또는 codex 외부)
agents/builder-fallback.md     ← Builder Fallback (Codex 죽었을 때)
agents/specialists/
  concept-designer.md           ← Planner 의 step.concept
  researcher.md                 ← Planner 의 step.research
  visual-designer.md            ← Planner 의 step.design
  qa.md                         ← Engineering 의 step.qa
  verifier.md                   ← Engineering 의 step.verifier (CourtEval 4 sub-step inline)
agents/_event-protocol.md       ← 모든 sandwich 가 inline append (subagent 의 transcript 호출 spec)
```

각 sandwich 내부:

```xml
§1 <role>           누구이고 누구한테 PATCH 하는가
§2 <contract>       input-kinds / output-kinds / handoff-target
§3 <tools>          허용 tool set (Read/Write/Edit/Bash/Task 등)
§4 <enforcement>    forbidden + required + STOP 조건
   <system-reminder> token budget + anti-deception 룰
```

### 단계 2 — envelope assemble (per-spawn, 부분 dynamic)

Coordinator 가 다음 actor spawn 시 **XML envelope 으로 system prompt 합성**:

```xml
<crumb:envelope session="01J9..." turn="4" task="task_main_game">
  
  <crumb:contract>           ← sandwich §2 의 contract 인용
    <input-kinds>spec, spec.update, user.intervene</input-kinds>
    <output-kinds>build, artifact.created</output-kinds>
    <handoff-target>verifier</handoff-target>
  </crumb:contract>
  
  <crumb:task-ledger version="3">    ← state.task_ledger 직렬화
    <fact>match-3, 60s 제한, 콤보 1.5×</fact>
    <constraint>mobile-first, Phaser CDN, ≤60KB own code</constraint>
    <decision>vanilla Canvas, no bundler</decision>
  </crumb:task-ledger>
  
  <crumb:progress next="build" stuck="0/5">    ← state.progress_ledger
    instruction: build from spec.md, save to artifacts/
  </crumb:progress>
  
  <crumb:relevant-messages>          ← kind-filtered transcript pull (visibility=public)
    <msg id="01J..." from="planner-lead" kind="spec" sha256="...">
      <data>{"acceptance_criteria":[...]}</data>
    </msg>
    <!-- debate, note, agent.thought_summary 제외 (visibility=private) -->
  </crumb:relevant-messages>
  
  <crumb:tools-allowed>Read, Write, Edit, Bash</crumb:tools-allowed>
  
  <crumb:enforcement>
    - STOP after own kind (no continue)
    - artifacts must include sha256
    - claim PASS only with exec.exit_code
  </crumb:enforcement>
  
</crumb:envelope>
```

→ **agent-friendly** (XML, machine-parseable) **+ kind-filtered** (broadcast 금지) **+ artifact ref only** (body 0).

### 단계 3 — 주입 경로 (adapter 별)

| Adapter | 주입 경로 | format |
|---|---|---|
| **claude-local** | `--append-system-prompt @<envelope_file>` + `--add-dir <session_dir>` + `-p "<task instruction>"` | XML (sandwich + envelope) |
| **codex-local** | stdin (`proc.stdin.write(envelope)`) + `codex exec --cd <session_dir> --full-auto` | Markdown (Codex prefers Markdown over XML — see [[bagelcode-xml-frontier-2026]]) |
| **mock** | in-memory pass-through | XML |

env 4종 항상 propagate:

```
CRUMB_TRANSCRIPT_PATH = sessions/<ulid>/transcript.jsonl
CRUMB_SESSION_ID      = <ulid>
CRUMB_SESSION_DIR     = sessions/<ulid>/
CRUMB_ACTOR           = planner-lead | engineering-lead | ...
```

→ subagent (Task tool / Codex subagent) 에 부모 env 자동 상속 (Anthropic / Codex 기본 동작 — env propagation spike 로 검증).

### 단계 4 — Cache 경계 ([[bagelcode-caching-strategy]] §"Cache breakpoint 위치")

```
[1] sandwich §1 contract       ──┐
[2] sandwich §2 stage template  │  STATIC 1h  ← Anthropic ephemeral cache_control: {ttl: "1h"}
[3] sandwich §3 tools/skills   │            (read 0.1×, write 1.25×, longest TTL first)
[4] sandwich §4 enforcement    ──┘            
                                              ★ cache breakpoint 1, 2 (max 4)
[5] envelope task-ledger       ──┐
[6] envelope relevant-messages   │ DYNAMIC 5m  ← cache_control: {ttl: "5m"} on stable prefix
                                 │           (goal + 초기 spec 안정 시)
                                 │            ★ cache breakpoint 3 (선택)
[7] task instruction (-p)      ──┘ NO CACHE   (rolling, per-turn 변경)
```

Codex / Gemini 자동 prefix cache (별도 마커 X) — sandwich 를 system prompt 맨 앞에 두면 자동.

### 단계 5 — Subagent 의 transcript emit

`agents/_event-protocol.md` (모든 sandwich 가 inline append):

```bash
crumb event <<'JSON'
{
  "from": "$CRUMB_ACTOR",
  "kind": "step.concept",
  "parent_event_id": "$WAKE_ID",
  "body": "Defined 6×6 grid match-3 with 60s timer and 4-tile combo bonus",
  "data": {"grid_size": [6,6], "timer_s": 60}
}
JSON
```

`crumb event` (= `src/cli.ts cmdEvent`) 가:
1. stdin JSON 읽기 → `DraftMessage` parse
2. `TranscriptWriter.append(draft)` — auto-fill ULID + ISO ts
3. ajv validation (`message.schema.json`)
4. `O_APPEND` flush to `$CRUMB_TRANSCRIPT_PATH`
5. stdout `{"id": "...", "ts": "..."}` (subagent 가 다음 메시지의 parent_event_id 로 사용)

---

## 5. Per-turn flow — Sequence

```
┌─User─┐  ┌──Claude Code (host)──┐  ┌──Coordinator──┐  ┌──Planner Lead──┐  ┌──transcript──┐  ┌──reducer──┐
│      │  │  (skill activated)    │  │  (host inline)│  │  (Task subagent)│  │  (jsonl)     │  │           │
│      │  └──────────┬────────────┘  └───────┬───────┘  └────────┬────────┘  └──────┬───────┘  └─────┬─────┘
│      │             │                        │                  │                   │                │
│  goal───────────────▶ /crumb 매치-3 콤보       │                  │                   │                │
│      │             │ env init                │                  │                   │                │
│      │             │ session.start ─────────────────────────────────────────────▶ append             │
│      │             │                          │                  │                   │ ───reduce──▶  │
│      │             │ envelope assemble        │                  │                   │  effect:      │
│      │             │ (sandwich + ledger +     │                  │                   │  agent.wake   │
│      │             │  filtered transcript)    │                  │                   │                │
│      │             │ ─────Task tool spawn────▶ wake              │                   │                │
│      │             │                          │ socratic Q ──────▶                   │                │
│      │             │                          │ crumb event question.socratic ─────▶ append          │
│      │             │ ◀─────────────────────────────question 반영                     │                │
│   answer──────────▶ /crumb (자연어)            │                  │                   │                │
│      │             │ crumb event answer.socratic ──────────────────────────────────▶ append          │
│      │             │                          │                  │ continue           │                │
│      │             │                          │                  │ step.concept       │                │
│      │             │                          │                  │ step.research      │                │
│      │             │                          │                  │ step.design        │                │
│      │             │                          │                  │ artifact.created×3 │                │
│      │             │                          │                  │ spec ────────────▶ append          │
│      │             │                          │                  │ handoff.requested ▶ append          │
│      │             │ ◀──────host receives last line                                  │                │
│      │             │                          │                                       │ ───reduce──▶  │
│      │             │                          │                                       │  effect:      │
│      │             │                          │                                       │  next_speaker │
│      │             │                          │                                       │  =eng-lead    │
│      │             │ envelope assemble (engineering-lead)                             │                │
│      │             │ ─────Task tool spawn────▶ engineering-lead 동일 패턴 (build/qa/verifier)         │
│      │             │                          │ ...                                   │                │
│      │             │                          │ judge.score (PASS) ────────────────▶ append          │
│      │             │                          │ done ──────────────────────────────▶ append          │
│      │             │ ◀──────host receives done                                       │                │
│      │ ◀───── "게임 완성! artifacts/game.html"                                                          │
└──────┘             └──────────────────────────────────────────────────────────────────────────────────┘
```

자연어 사용자 개입 (turn 중):
```
사용자: "콤보 보너스 좀 더 짧게"
   ▾ Claude Code 받음
   ▾ crumb event kind=user.intervene, data={target: "tuning.json/combo_multipliers"}
   ▾ append → reduce → effect: spec.update 라우팅 (Planner Lead 재spawn)
```

---

## 6. Control plane vs LLM layer 책임 분담

| 책임 | LLM layer (Claude Code / Codex) | Control plane (자체 light layer) |
|---|---|---|
| 자연어 이해 | ✅ host 가 처리 | ❌ |
| 자연어 → action 변환 | ✅ skill SKILL.md routing | ❌ |
| Reasoning (CoT, thinking) | ✅ provider 모델 | ❌ |
| Code 생성 | ✅ Builder subagent | ❌ |
| Tool calls (Read/Write/Bash) | ✅ Claude Code/Codex 기본 | ❌ |
| **Transcript schema 강제** | ❌ | ✅ `protocol/schemas/*.json` + ajv |
| **Append-only / ULID 정렬** | ❌ | ✅ `src/transcript/writer.ts` (O_APPEND + flock) |
| **Reducer (state derivation)** | ❌ | ✅ `src/reducer/index.ts` (pure) |
| **Replay determinism** | ❌ | ✅ `crumb replay <session-dir>` |
| **Validator (anti-deception)** | ❌ | ✅ `src/validator/anti-deception.ts` |
| **Adapter 추상화** | ❌ | ✅ `src/adapters/{claude,codex,mock}-local.ts` |
| **Routing rules (next_speaker)** | ⚠ sandwich 안 명시만 | ✅ reducer 가 강제 |
| **Stuck escalation** | ❌ | ✅ progress_ledger.stuck_count |
| **Adaptive stop** | ❌ | ✅ score_history variance < 1.0 |
| **OTel GenAI alias export** | ❌ | ✅ `crumb export --format otel-jsonl` |
| **Cross-provider guard** | ❌ | ✅ Builder.metadata.model.provider_family ≠ Verifier.metadata.model.provider_family |

→ **자유도의 본질 = control plane**. LLM 호출 layer 만 host 에 위임 = 팀핏 + ToS 안전 + 자유도 보존.

---

## 7. Default vs Cross-provider 차이 표

| 항목 | Default | `--cross-provider` |
|---|---|---|
| 외부 process 수 | 1 (Claude Code) | 2 (Claude Code + Codex CLI) |
| Coordinator | Claude Code 자체 | Claude Code 자체 |
| Planner Lead | Claude Code Task subagent | Claude Code Task subagent |
| Engineering Lead | Claude Code Task subagent | **Codex CLI subprocess** |
| Verifier | Claude Code Task subagent (다른 sandwich) | **Claude Code Task subagent (cross-assemble)** |
| Builder Fallback | Claude Code | Claude Code |
| 평가자 인증 부담 | `claude login` 1회 | `claude login` + `codex login` |
| 격리 효과 (matrix C1) | 다른 sandwich + 다른 컨텍스트 (same-provider self-judge risk 완화) | + 다른 provider (full cross-assemble) |
| cross-provider matrix backing (C2) | 부분 | 완전 (CP-WBFT + MAR + Lanham 0.32→0.89) |
| ToS | ✅ Claude Code OAuth | ✅ Claude Code OAuth + Codex Plus OAuth |
| transcript schema | 동일 | 동일 |
| reducer | 동일 | 동일 |
| metadata.model.provider_family 차이 | 같음 (warn audit) | 다름 (no warn) |

→ **transcript / reducer / control plane 100% 동일**. LLM layer 만 토폴로지 차이.

---

## 8. Headless mode — `crumb run --goal "..."`

평가자 / CI / non-interactive 환경:

```bash
$ npx tsx src/index.ts run \
    --goal "60-second match-3 with combo bonus" \
    --adapter mock \                    # deterministic demo
    --idle-timeout 5000                  # 5s 무응답 → done
$ jq -r '"\(.kind)\t\(.from)"' sessions/*/transcript.jsonl
$ npx tsx src/index.ts replay sessions/<id>     # 동일 state 재구성
```

skill 없는 환경 (Claude Code 미설치) 에서도 mock adapter 로 demo 가능. `--adapter claude-local` 또는 `codex-local` 명시 시 실제 CLI subprocess (단 인증 필요).

---

## 9. Sub-system 변경 영향 (host-harness 결정 후)

| Sub-system | 변경 | 영향 위치 |
|---|---|---|
| `protocol/schemas/*.json` | 변경 없음 | — |
| `src/transcript/` | 변경 없음 | — |
| `src/reducer/` | 변경 없음 | — |
| `src/state/` | 변경 없음 | — |
| `src/validator/` | + cross-provider guard (warn-only) | `src/validator/cross-provider-guard.ts` 신설 |
| `src/adapters/` | 변경 없음 (claude/codex/mock 그대로) | — |
| `src/dispatcher/` | --cross-provider 분기 (engineering-lead = codex-local 매핑) | 작은 변경 |
| `src/loop/coordinator` | next_speaker 업데이트 (verifier 외부 actor 분기 옵션) | 작은 변경 |
| `src/cli.ts` | + `--cross-provider` flag | 작은 변경 |
| `agents/coordinator.md` | Task tool forbidden 제거 | 정정 |
| `agents/{planner,engineering}-lead.md` | Task tool spawn 명시 + sequential-steps 갱신 | 정정 |
| `agents/specialists/*.md` | 신설 (concept-designer / researcher / visual-designer / qa / verifier) | 5 신설 |
| `.claude/skills/crumb/SKILL.md` | 신설 (host 활성화 entry) | 신설 |
| `.crumb/config.toml` + presets | + `[verifier]` + cross-provider preset | 정정 + 신설 |

---

## See also

- [[bagelcode]] / [[bagelcode-host-harness-decision]] — 이 구조의 결정 근거
- [[bagelcode-verifier-isolation-matrix]] — cross-provider opt-in 결정 backing
- [[bagelcode-transcripts-schema]] — schema 1차 spec (28 → 38 kind 진화)
- [[bagelcode-caching-strategy]] — cache 경계 (단계 4 의 1h/5m TTL)
- [[bagelcode-final-design-2026]] — §1 그림 본 페이지로 대체, §2-§8 유효
- [[bagelcode-fault-tolerance-design]] — F1-F5 (control plane 의 validator + circuit + stuck escalation)
- [[bagelcode-rubric-scoring]] — D1-D6 + anti-deception 5 룰
- [[bagelcode-paperclip-vs-alternatives]] — 자체 light layer = control plane 만 깎음
- `src/protocol/schemas/message.schema.json` — 38 kind enum 실 source
- `agents/_event-protocol.md` — subagent transcript emit spec
