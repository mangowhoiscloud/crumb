---
title: Crumb 시스템 구조 v0.1 — Multi-host × (harness × provider × model) tuple + 3-layer scoring
category: concepts
tags: [bagelcode, crumb, system-architecture, v0.1, multi-host, harness-tuple, ambient-fallback, scoring, dashboard, observability, frontier-convergence, 2026]
sources:
  - "[[bagelcode-host-harness-decision]]"
  - "[[bagelcode-system-architecture]] (v2, replaced)"
  - "[[bagelcode-paperclip-vs-alternatives]]"
  - "[[bagelcode-rubric-scoring]]"
  - "[[bagelcode-recruitment-task]]"
  - "[[bagelcode-frontier-cli-convergence-2026]] ★ new"
  - "[[bagelcode-llm-judge-frontier-2026]] ★ new"
  - "[[bagelcode-gamestudio-subagents-2026]]"
  - "[[bagelcode-frontier-orchestration-2026]]"
  - "[[bagelcode-verifier-isolation-matrix]]"
  - "https://github.com/obra/superpowers (176k)"
  - "https://github.com/microsoft/autogen (57.6k)"
  - "https://github.com/paperclipai/paperclip (61.4k)"
  - "https://aclanthology.org/2025.findings-acl.1327/ — CourtEval ACL 2025"
  - "Kiki dashboard pattern (~/workspace/Kiki/app/dashboard)"
summary: >-
  Crumb 의 v0.1 canonical 시스템 구조. Multi-host 4 entry (Claude Code + Codex CLI + Gemini CLI + headless),
  (harness × provider × model) 3-tuple actor binding, ambient harness fallback, 3-layer scoring (reducer +
  qa_check effect + verifier CourtEval), 정적 대시보드, 자연어 보조 장치. v2 ([[bagelcode-system-architecture]])
  대체.
provenance:
  extracted: 0.40
  inferred: 0.50
  ambiguous: 0.10
created: 2026-05-02
updated: 2026-05-02
---

# Crumb 시스템 구조 v0.1 — Multi-host × (harness × provider × model)

> **canonical 종합 lock.** v2 ([[bagelcode-system-architecture]] §1-§2 그림) 를 본 페이지가 대체. v2 의 §3-§9 (38 kind schema 코어, prompt assemble 절차) 는 본 페이지의 §3-§4 로 흡수 후 40 kind 로 정정 (v0.1 +qa.result 추가, meta 카운트 6→7 정정). [[bagelcode-host-harness-decision]] Hybrid lock 위에 (a) Multi-host 3 entry 추가, (b) 3-tuple actor binding, (c) ambient fallback, (d) 3-layer scoring 추가.

---

## 0. 한 줄 정체성

```
agent (페르소나) ⊕ skill (procedural) ⊕ effect (deterministic) ⊕ adapter (provider) ⊕ preset (BYO)
   ↑              ↑                      ↑                       ↑                    ↑
gamestudio 12  superpowers 14         AutoGen Executor         Paperclip BYO    Paperclip routine
  (193 ⭐)        (176k ⭐)              (57.6k ⭐)               (61.4k ⭐)            (61.4k ⭐)
```

**Crumb v0.1** = 4 frontier 합성 (gamestudio + superpowers + AutoGen + Paperclip) × 4 CLI convergence (2026-04 Claude Code/Codex/Gemini/OpenCode) × 메일 verbatim 1:1 매핑. 자체 발명 비중 < 10%.

---

## 1. 5 Layer 개요

```
┌─────────────────────────────────────────────────────────────────────┐
│ L1 USER 자연어 입출력                                                  │
│   "60초 매치-3 콤보 만들어줘"  "이 부분 다르게"  "/crumb pause"        │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────┐
│ L2 HOST HARNESS (entry 4 path) — 평가자 환경 무관 동작                 │
│   .claude/skills/crumb/SKILL.md     (Claude Code)                   │
│   .codex/agents/crumb.toml           (Codex CLI)                    │
│   .gemini/extensions/crumb/          (Gemini CLI)                   │
│   src/cli.ts run|replay|event|...    (headless / CI)                │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────┐
│ L3 ACTORS (페르소나 sandwich.md)                                       │
│   coordinator / planner-lead / builder / verifier / builder-fallback│
│   + 3 specialist (planner-lead 내부 step inline)                     │
│   + 5 skill (procedural workflow inline read, superpowers 차용)      │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────┐
│ L4 ADAPTERS — (harness × provider × model) 3-tuple resolve           │
│   harness ∈ {claude-code, codex, gemini-cli, mock, *-sdk}            │
│   provider ∈ {anthropic, openai, google, none}                       │
│   model ∈ {claude-sonnet-4-6, gpt-5.5-codex, gemini-2.5-pro, ...}    │
│   ambient fallback: 명시 안 하면 entry host 따라감                    │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────┐
│ L5 CONTROL PLANE (자체 light layer, src/)                            │
│   transcript.jsonl (40 kind × 11 field, append-only, ULID)          │
│      → reducer (pure)                                                │
│      → effects [spawn, qa_check, append, hook, done]                │
│      → dispatcher (live / replay / test 3 variant)                  │
│   replay deterministic, ToS/OAuth 무관                               │
└─────────────────────────────────────────────────────────────────────┘
```

→ **L5 가 자유도의 본질**. L1-L4 는 host/provider 갈아끼우는 layer, L5 는 그것과 무관.

---

## 2. Entry 4 path (Multi-host)

### 2.1 Claude Code entry (`.claude/skills/crumb/SKILL.md`)

```yaml
---
name: crumb
description: |
  베이글코드 신작팀의 멀티 에이전트 협업 (Claude Code + Codex + Gemini CLI 동시 사용 환경)
  도구. 자연어로 모바일 캐주얼 게임 prototype 산출. /crumb <자연어 goal>.
when_to_use: 게임 만들기 요청, 멀티 에이전트 협업 시연, 또는 /crumb 호출
allowed-tools: Bash Task Read Write Edit Glob Grep
argument-hint: <자연어 게임 goal>
---

# Crumb Coordinator

User invoked `/crumb $ARGUMENTS`.

## Setup
1. Bash: `crumb event session.start --goal "$ARGUMENTS" --preset bagelcode-cross-3way`
2. ambient = "claude-code" (entry 자동 결정)
3. Read sandwich body: `agents/coordinator.md`
4. Tail transcript at `$CRUMB_TRANSCRIPT_PATH`

[full coordinator sandwich body inline reference]
```

### 2.2 Codex CLI entry (`.codex/agents/crumb.toml`)

```toml
name = "crumb"
description = "베이글코드 신작팀 멀티 에이전트 협업 도구 (Claude Code + Codex + Gemini CLI 3 actor)"

developer_instructions = """
You are the Crumb Coordinator invoked from Codex CLI.

[full coordinator sandwich body, Markdown variant]

Setup:
1. shell: `crumb event session.start --goal "<user_goal>" --preset bagelcode-cross-3way`
2. ambient = "codex"
3. spawn next actor via crumb event handoff
4. tail transcript at $CRUMB_TRANSCRIPT_PATH
"""

# model 명시 안 함 → ambient 따라감 (codex CLI session model)
sandbox_mode = "workspace-write"

[mcp_servers.crumb-mcp]
command = "npx"
args = ["tsx", "src/mcp-server.ts"]
```

### 2.3 Gemini CLI entry (`.gemini/extensions/crumb/`)

```json
{
  "name": "crumb",
  "version": "0.1.0",
  "contextFileName": "GEMINI.md",
  "mcpServers": {
    "crumb-mcp": { "command": "npx", "args": ["tsx", "src/mcp-server.ts"] }
  }
}
```

```toml
# .gemini/extensions/crumb/commands/crumb.toml
description = "/crumb <goal> — 멀티 에이전트 게임 prototype"

prompt = """
You are the Crumb Coordinator invoked from Gemini CLI.

[full coordinator sandwich body]

Setup:
1. shell: `crumb event session.start --goal "${1}" --preset bagelcode-cross-3way`
2. ambient = "gemini-cli"
3. spawn next actor via crumb event handoff
4. tail transcript at ${CRUMB_TRANSCRIPT_PATH}
"""
```

### 2.4 Headless entry (`src/cli.ts`)

```bash
$ npx tsx src/index.ts run --goal "..." --preset bagelcode-cross-3way
$ npx tsx src/index.ts run --goal "..." --preset mock         # CI / fallback
$ npx tsx src/index.ts run --goal "..." --preset sdk-enterprise  # API key, prod-grade
$ npx tsx src/index.ts replay sessions/<id>                    # deterministic 재구성
$ npx tsx src/index.ts event session.start --goal "..."        # subagent 가 호출
$ npx tsx src/index.ts ls                                       # session 목록
$ npx tsx src/index.ts doctor                                   # 환경 진단
```

→ **4 entry, 1 control-plane, 1 transcript schema**. coordinator sandwich body 는 `agents/coordinator.md` 한 곳 (DRY), 각 entry wrapper 가 reference. ^[extracted]

---

## 3. Schema — 40 kind × 11 field × 8 from × 12 step

### 3.1 11 field (변경 없음)

```typescript
type Message = {
  // 식별 (4)
  id:               ULID
  ts:               ISO-8601
  session_id:       string
  task_id?:         string

  // 라우팅 (4)
  from:             ActorId       // 8 enum
  to?:              ActorId | "*"
  parent_event_id?: ULID
  in_reply_to?:     ULID          // deprecated alias

  // 분류 (3)
  kind:             MessageKind   // 39 enum
  topic?:           string
  step?:            SpecialistStep // 12 enum
}

// 본문 옵션 (kind 별 schema)
body?:           string
data?:           Record<string, unknown>
content?:        { format: 'markdown'|'json'|'text'|'xml', text: string }
artifacts?:      ArtifactRef[]
scores?:         { D1, D2, D3, D4, D5, D6, aggregate, verdict }
ack_required?:   boolean
blocking?:       boolean
metadata?:       { visibility, harness, provider, model, turn, tokens_in/out,
                   cache_read/write, latency_ms, cost_usd, thinking_tokens,
                   audit_violations, deterministic? }
```

### 3.2 from enum (8개, v2 → v0.1 변경)

```
─── v2 (7) ──────────────────────────
  user / coordinator / planner-lead / engineering-lead / builder-fallback /
  validator / system

─── v0.1 (8) ★ ─────────────────────────
  user / coordinator / planner-lead / builder / verifier / builder-fallback /
  validator / system
                           ★ engineering-lead 제거, builder + verifier 추가
```

### 3.3 40 kind 어휘 (v2 38 → v0.1 40, +qa.result, +meta count 정정)

```
─── system (4) ──────────────────────
  session.start / session.end / agent.wake / agent.stop

─── workflow (11) ★ +1 ─────────────
  goal
  question.socratic / answer.socratic
  spec / spec.update
  build
  qa.result          ★ 신규 — dispatcher 가 emit, deterministic ground truth (kind=qa.result schema 는 §3.5)
  verify.request
  verify.result      (legacy alias of judge.score)
  judge.score        (first-class, scores nested)
  done

─── dialogue (5) ────────────────────
  agent.thought_summary / question / answer / debate / note

─── lead-internal step (5) ─────────
  step.socratic / step.concept / step.research / step.design / step.judge

─── user intervention (5) ───────────
  user.intervene / user.veto / user.approve / user.pause / user.resume

─── handoff (3) ─────────────────────
  handoff.requested / handoff.accepted / handoff.rollback

─── artifact / meta (7) ─────────────
  artifact.created / ack / error / audit / tool.call / tool.result / hook
```

### 3.4 12 step enum (변경 없음)

```
socratic / concept / research / design   ← Planner Lead
builder / qa / verifier                   ← (qa step 어휘 보존, 단 emit source = effect)
grader / critic / defender / regrader     ← Verifier 안 CourtEval
synth                                      ← Lead final
```

### 3.5 `kind=qa.result` schema (신규)

```typescript
{
  kind: "qa.result",
  from: "system",                          // dispatcher 가 emit
  parent_event_id: <build msg id>,         // build 와 인과 chain
  data: {
    lint_passed:        boolean,
    exec_exit_code:     number,            // 0 = success
    phaser_loaded:      boolean,
    first_interaction:  "ok" | "fail",
    artifact_sha256:    string,
    runtime_ms:         number
  },
  metadata: {
    visibility: "public",
    tool: "qa-check-effect@v1",
    deterministic: true                    // ★ anti-deception flag
  }
}
```

### 3.6 `kind=judge.score` schema (확장, source-of-truth 매트릭스)

```typescript
{
  kind: "judge.score",
  from: "verifier",
  data: {
    scores: {
      D1: { score: 4.5, source: "verifier-llm",      evidence: [...] },
      D2: { score: 5.0, source: "qa-check-effect",   lookup: "qa.result.exec_exit_code" },
      D3: { score: 4.0, source: "hybrid",            auto: 3.5,   semantic: 4.0 },
      D4: { score: 5.0, source: "reducer-auto",      lookup: "scoreHistory" },
      D5: { score: 4.0, source: "hybrid",            auto: 4.0,   quality: 4.0 },
      D6: { score: 4.5, source: "qa-check-effect",   lookup: "qa.result.crossBrowserSmoke" }
    },
    aggregate: 27.0,
    verdict: "PASS",                       // PASS ≥24 / PARTIAL 18-23 / FAIL <18
    courteval: {
      grader_msg_id, critic_msg_id, defender_msg_id, regrader_msg_id
    },
    audit_violations: []                   // anti-deception 통과 여부
  },
  metadata: {
    verifier_harness:  "gemini-cli",
    verifier_model:    "gemini-2.5-pro",
    builder_harness:   "codex",
    builder_model:     "gpt-5.5-codex",
    cross_provider:    true                // ★ self-bias 회피 신호
  }
}
```

→ 평가자가 judge.score 한 event 만으로 **각 차원의 source-of-truth + cross-provider 검증 + audit 결과** 모두 확인. ^[inferred]

---

## 4. Communication Protocol — Envelope + Handoff

### 4.1 Envelope (각 spawn 시 actor 가 받는 system prompt)

```xml
<crumb:envelope session="01J..." turn="4" task="task_main_game">

  <crumb:contract>
    <input-kinds>spec, spec.update, user.intervene, user.veto</input-kinds>
    <output-kinds>build, artifact.created</output-kinds>
    <handoff-target>verifier</handoff-target>
  </crumb:contract>

  <crumb:task-ledger version="3">
    <fact>match-3, 60s 제한, 콤보 1.5×</fact>
    <constraint>mobile-first, Phaser CDN, ≤60KB own code</constraint>
    <decision>vanilla Canvas, no bundler</decision>
  </crumb:task-ledger>

  <crumb:progress next="build" stuck="0/5">
    instruction: build from spec.md, save to artifacts/
  </crumb:progress>

  <crumb:relevant-messages>
    <!-- kind-filtered, visibility=public only, last 10 turns -->
    <msg id="01J..." from="planner-lead" kind="spec" sha256="..."/>
  </crumb:relevant-messages>

  <crumb:tools-allowed>Read, Write, Edit, Bash</crumb:tools-allowed>

  <crumb:enforcement>
    - STOP after own kind (no continue)
    - artifacts must include sha256
    - claim PASS only with qa.result.exec_exit_code=0
  </crumb:enforcement>

</crumb:envelope>
```

→ adapter 별 변환: claude-code = XML, codex = Markdown ([[bagelcode-xml-frontier-2026]] §"Codex prefers Markdown"), gemini-cli = XML, mock = pass-through.

### 4.2 Handoff protocol (per-turn flow)

```
USER goal
   ▾
Coordinator (host inline)
   ▾ Task tool spawn (depth=1) OR codex subagent OR gemini extension MCP
PLANNER LEAD                                       (1 spawn, 5 step inline)
   ▾ artifact: spec.md / DESIGN.md / tuning.json
   ▾ kind=spec + kind=handoff.requested
   ▾
Coordinator → reducer next_speaker = builder
   ▾ spawn (per-actor harness 결정)
BUILDER (sandwich + tdd-iron-law skill inline)     (1 spawn)
   ▾ artifact: game.html
   ▾ kind=build + kind=handoff.requested
   ▾
Coordinator → reducer effect: qa_check (★ no LLM)
   ▾ dispatcher.runQaCheck (htmlhint + playwright)
   ▾ kind=qa.result {lint_passed, exec_exit_code, phaser_loaded, first_interaction}
   ▾
Coordinator → reducer next_speaker = verifier
   ▾ spawn
VERIFIER (sandwich + verification-before-completion + CourtEval 4 sub-step)  (1 spawn)
   ▾ reads: spec.md, game.html, kind=qa.result (D2 ground truth)
   ▾ kind=step.judge × 4 (grader/critic/defender/regrader)
   ▾ kind=judge.score (verdict)
   ▾
Coordinator → reducer
   - PASS    → kind=done
   - PARTIAL → kind=hook (user_modal: approve/redo)
   - FAIL    → kind=handoff.rollback to planner-lead OR builder-fallback
```

→ **모든 hop 이 transcript event 로 기록**. fs.watch tail 만 하면 외부 observer 가 routing 전체 trace 가능. ^[inferred]

---

## 5. Actor Binding — (harness × provider × model) 3-tuple

### 5.1 Resolve 우선순위

```
1. preset.actors.<actor>.{harness, model} 명시 사용
2. preset.[defaults] 블록 사용 (preset 자체가 default 정한 경우)
3. ambient (entry host 따라감)
4. 시스템 fallback (claude-code + sonnet-4-6)
```

### 5.2 9-cell 매트릭스 (3 harness × 3 provider)

| harness↓ \ provider→ | anthropic | openai | google |
|---|---|---|---|
| **claude-code** | ✅ native (Claude Sonnet/Opus/Haiku) | ⚠ BYOK proxy (P1) | ⚠ BYOK proxy (P1) |
| **codex** | ⚠ BYOK proxy (P1) | ✅ native (GPT-5.5, GPT-5.5-codex) | ⚠ BYOK proxy (P1) |
| **gemini-cli** | ⚠ MCP relay (P1) | ⚠ MCP relay (P1) | ✅ native (Gemini 2.5 Pro/Flash) |

→ P0 = 대각선 3 셀 (native). P1+ = off-diagonal 6 셀 (BYOK proxy / MCP relay).

### 5.3 Entry 별 ambient resolve 표

| Entry | ambient harness | ambient model (default) |
|---|---|---|
| `/crumb` (Claude Code) | `claude-code` | `claude-sonnet-4-6` (또는 entry session model) |
| `codex run crumb` | `codex` | `gpt-5.5-codex` (또는 entry session model) |
| `/crumb` (Gemini CLI) | `gemini-cli` | `gemini-2.5-pro` (또는 entry session model) |
| `crumb run` headless | preset [defaults] OR `claude-code` + `sonnet-4-6` | 동일 |

---

## 6. Preset 4종 — 사용자 선택, Crumb 추천

### 6.1 추천 default (메일 + 회사 정조준)

`bagelcode-cross-3way.toml`:

```toml
[meta]
name = "bagelcode-cross-3way"
description = "베이글코드 신작팀 (Claude Code + Codex + Gemini CLI 동시 사용) 정조준"
recommended = true

# 모든 actor: 명시 없음 → ambient (entry host) 따라감
[actors.coordinator]      sandwich = "agents/coordinator.md"
[actors.planner-lead]     sandwich = "agents/planner-lead.md"
[actors.builder-fallback] sandwich = "agents/builder-fallback.md"

# 명시 — 메일 verbatim 정조준
[actors.builder]
sandwich = "agents/builder.md"
harness  = "codex"                  # ★ 구현 = OpenAI
model    = "gpt-5.5-codex"

[actors.verifier]
sandwich = "agents/verifier.md"
harness  = "gemini-cli"             # ★ 검증 = Google (multimodal screenshot)
model    = "gemini-2.5-pro"

[effects]
qa_check = { tool = "qa-check-effect@v1", harness = "none" }   # LLM 무관
```

→ **사용자가 어느 entry 든 들어와도 builder = Codex / verifier = Gemini cross-vendor 강제**. 나머지는 ambient 따라감 = 평가자 환경 그대로 robust.

### 6.2 다른 추천 옵션

```
solo.toml             — 모든 actor ambient 따라감 (Claude Max only 평가자)
sdk-enterprise.toml   — Anthropic + OpenAI + Google SDK 직접 (production-grade, API key)
mock.toml             — deterministic CI / fallback (어느 도구도 미설치)
single-claude.toml    — 모든 actor = claude-code (P1 후보)
single-codex.toml     — 모든 actor = codex (P1 후보)
single-gemini.toml    — 모든 actor = gemini-cli (P1 후보)
bagelcode-tri-judge.toml — verifier 3 (Claude/GPT/Gemini) parallel, multi-judge consensus (P1)
```

→ **사용자가 선택, Crumb 은 추천만 제시**. README 가 "default 는 cross-3way, 다른 옵션은 `--preset` 으로" 형태. ^[inferred]

---

## 7. Scoring — 3 Layer 분리

### 7.1 Layer 분리

| Layer | 위치 | LLM call | 산출 차원 |
|---|---|---|---|
| **L1 Reducer auto** | `src/state/scorer.ts` | 0 | D3 auto, D4 convergence, D5 auto |
| **L2 qa_check effect** | `src/effects/qa-check.ts` (dispatcher emit) | 0 | D2 exec, D6 portability |
| **L3 Verifier CourtEval** | verifier sandwich inline 4 sub-step | 1 spawn | D1 spec_fit, D3 semantic, D5 quality, aggregate, verdict |

### 7.2 D1-D6 source-of-truth 매트릭스

| 차원 | source | LLM | verifier override |
|---|---|---|---|
| D1 spec_fit | verifier (LLM) | ✅ | yes (1차 산출) |
| D2 exec | qa_check effect | ❌ | ❌ 변경 금지 |
| D3 observability | reducer auto + verifier 의미 (hybrid) | ✅ (의미만) | semantic 부분만 |
| D4 convergence | reducer auto | ❌ | ❌ |
| D5 intervention | reducer auto + verifier quality (hybrid) | ✅ (quality만) | quality 부분만 |
| D6 portability | qa_check effect | ❌ | ❌ |
| aggregate | verifier (LLM) | ✅ | (final) |

### 7.3 anti-deception 5 룰

```typescript
// src/validator/anti-deception.ts
function audit(judgeScore, qaResult, autoScores) {
  const violations = []

  if (verdict==='PASS' && qaResult.exec_exit_code !== 0) {
    judgeScore.D2 = 0; violations.push('verify_pass_without_exec_zero')
  }
  if (judgeScore.D2 !== (qaResult.exec_exit_code===0 ? 5 : 0)) {
    judgeScore.D2 = qaResult.exec_exit_code===0 ? 5 : 0
    violations.push('verifier_overrode_d2_ground_truth')
  }
  if (judgeScore.D4 !== autoScores.D4_convergence) {
    judgeScore.D4 = autoScores.D4_convergence
    violations.push('verifier_overrode_d4_ground_truth')
  }
  if (verifier_provider === builder_provider) {
    violations.push('self_bias_risk_same_provider')
  }
  if (judgeScore.D3 - autoScores.D3_auto > 1.5 ||
      judgeScore.D5 - autoScores.D5_auto > 1.5) {
    violations.push('verifier_inflated_hybrid')
  }

  return violations
}
```

→ **deterministic ground truth (D2/D4/D6) 는 verifier 가 못 바꿈**. self-bias risk 표면화 (NeurIPS 2024 self-recognition → self-preference linear correlation 차단). [[bagelcode-llm-judge-frontier-2026]] §R3-R5 참고.

---

## 8. Routing — 장애지점 매트릭스

### 8.1 라우팅 룰 (`agents/coordinator.md` + `src/reducer/`)

```
After kind=goal               → next=planner-lead (Socratic)
After kind=spec               → next=builder
After kind=build              → effect=qa_check (★ no spawn, deterministic)
After kind=qa.result          → next=verifier
After kind=judge.score PASS   → next=done
After kind=judge.score PARTIAL → kind=hook (user_modal)
After kind=judge.score FAIL    → handoff.rollback to planner-lead OR builder-fallback
After kind=user.veto           → next=last_active_actor with instructionOverride
After progress.stuck_count ≥5 → kind=hook (stuck modal)
After scoreHistory variance <1.0 over 2 rounds → next=done (adaptive_stop)
```

### 8.2 라우팅 장애지점 7종 (F1-F7)

| # | 장애 | 원인 | 감지 | 복구 |
|---|---|---|---|---|
| F1 | adapter spawn 실패 | CLI not found / OAuth missing | adapter.ping() / spawn ENOENT | builder-fallback OR mock |
| F2 | subprocess timeout | LLM 무응답 / sandbox 락 | dispatcher idle-timeout (5s default) | SIGINT + handoff.rollback |
| F3 | schema validation 실패 | sandwich 가 잘못된 kind emit | ajv reject in `src/protocol/validator` | error event + retry once |
| F4 | qa.result 누락 | builder 가 build 후 dispatcher 실패 | reducer 가 build → qa_check effect 보장, fallback timeout | re-spawn qa_check OR audit |
| F5 | self-bias / inflation | verifier provider == builder provider | metadata.cross_provider=false 감지 | warn + audit_violations |
| F6 | 무한 루프 | spec.update / build 반복 | scoreHistory variance + spec_count threshold | adaptive_stop OR user hook |
| F7 | env 미상속 | subagent 가 CRUMB_TRANSCRIPT_PATH 못 읽음 | crumb event call 실패 | dispatcher 가 sandwich 안 명시 강제 |

→ 7 장애지점 모두 transcript event 로 기록 + reducer 가 복구 룰 강제. [[bagelcode-fault-tolerance-design]] §F1-F5 → 본 페이지 §8.2 로 확장.

---

## 9. Event Bus — transcript.jsonl 단일

### 9.1 단일 bus 원칙

```
모든 event 가 한 곳: sessions/<ulid>/transcript.jsonl
  ↓
producers: actor (subagent), dispatcher (effect), validator, system
consumers: reducer, observer, dashboard, replay, OTel exporter
```

→ **별도 message broker 없음 (Kafka/Redis/NATS X)**. fs append-only + ULID 정렬 + ajv validation 만으로 충분. [[bagelcode-paperclip-vs-alternatives]] §"자체 구현" 의 핵심.

### 9.2 producer 별 emit 패턴

| Producer | how | examples |
|---|---|---|
| **subagent (actor)** | Bash: `crumb event <<JSON ... JSON` | kind=spec, build, judge.score, step.* |
| **dispatcher (effect)** | 직접 TranscriptWriter.append() | kind=qa.result, kind=tool.{call,result} |
| **reducer** | effect → append_transcript | kind=audit, kind=ack |
| **validator** | reject → error event | kind=error |
| **user (CLI/host)** | crumb event OR `inbox.txt` write | kind=user.{intervene,pause,...} |

### 9.3 consumer 별 subscribe 패턴

| Consumer | how | latency |
|---|---|---|
| **reducer (live)** | chokidar fs.watch + tail | ~10ms |
| **reducer (replay)** | fs.readFile + parse | one-shot |
| **observer (web)** | SSE wrapping fs.watch | ~50ms |
| **dashboard (정적)** | summary.html post-session OR live polling | snapshot OR ~1s |
| **OTel exporter** | `crumb export --format otel-jsonl` | post-session |

→ **single-writer / multi-reader 모델**. TranscriptWriter 가 Promise chain 으로 직렬화 = race 없음. ^[inferred]

---

## 10. Observability — Kiki 패턴 차용

### 10.1 4 surface

| Surface | 위치 | 정적/동적 | 평가자 비용 |
|---|---|---|---|
| **TUI (P0)** | `src/tui/` blessed | live | 0 (host 안) |
| **summary.html (P0)** | `sessions/<id>/summary.html` (post-session 자동) | 정적 | 0 (더블클릭) |
| **live web observer (P1)** | `crumb observe sessions/<id>` → localhost:8080 | live SSE | 0 (로컬) |
| **diagram-dashboard (P1)** | Excalidraw-style 시각화 (Kiki `app/diagram-dashboard/` 차용 — 외부 자산) | 정적 (vite build) | 0 |

### 10.2 Kiki 차용 매핑 (`~/workspace/Kiki/app/dashboard` 참고)

| Kiki dashboard | Crumb 매핑 |
|---|---|
| `agent-activity-dashboard.html` (single HTML, fs/SSE 기반 transcript live tail) | `sessions/<id>/live-activity.html` (transcript fs.watch + colored timeline) |
| `token-dashboard.html` (cost/cache 실시간) | `sessions/<id>/token-dashboard.html` (per-actor cost + cache hit ratio + budget guardrails 시각화) |
| `index.html` (hub) | `sessions/<id>/summary.html` (4 산출 + 40 kind summary + judge.score chart) |
| `cors-proxy.mjs` (단일 mjs proxy) | `crumb observe` (단일 SSE proxy) |
| `diagram-dashboard/` (Vite + React + Hono + Excalidraw) | `crumb diagram` (P1 — actor handoff DAG 를 Excalidraw 로) |

→ Kiki 와 동일 원칙: **정적 HTML + no DB + no server (cors-proxy 한 mjs 만)**. transcript.jsonl 위 view 만, DB 없음.

### 10.3 OTel GenAI alias (export-ready)

[[bagelcode-observability-frontier-2026]] 의 OpenTelemetry GenAI Semantic Conventions 정합:

```jsonc
{
  "id": "01J...",                    // span_id
  "ts": "...",                        // start_time_unix_nano
  "session_id": "abc",                // gen_ai.conversation.id
  "task_id": "task_main",             // gen_ai.task.id
  "from": "verifier",                 // gen_ai.agent.name
  "kind": "judge.score",              // gen_ai.operation.name
  "metadata": {
    "model": "gemini-2.5-pro",        // gen_ai.request.model
    "tokens_in": 5000,                // gen_ai.usage.input_tokens
    "tokens_out": 1500,               // gen_ai.usage.output_tokens
    "cache_read": 4500                // gen_ai.usage.cache_read_tokens
  }
}
```

→ `crumb export --format otel-jsonl` = Datadog / Vertex / Phoenix / Langfuse 어디로든.

---

## 11. User Intervention Surface — 4 host × 5 event

### 11.1 5 user event

```
kind=user.intervene   → 일반 개입 (다음 turn 의 spec/build 영향)
kind=user.veto         → 특정 message 거부 (instructionOverride 적용)
kind=user.approve      → 명시 승인 (PARTIAL → done 가능)
kind=user.pause        → 전역 pause (다음 spawn 차단)
kind=user.resume       → pause 해제
```

### 11.2 4 host × 5 event 매트릭스

| Host | intervene | veto | approve | pause | resume |
|---|---|---|---|---|---|
| Claude Code | message 자체 | `/crumb veto <id>` | `/crumb approve` | `/crumb pause` | `/crumb resume` |
| Codex CLI | message 자체 | `codex hook veto <id>` | `codex hook approve` | `codex pause` (native) | `codex resume` |
| Gemini CLI | message 자체 | extension command | extension command | extension command | extension command |
| headless | `inbox.txt write` | `crumb event user.veto` | `crumb event user.approve` | `crumb event user.pause` | `crumb event user.resume` |

→ 모두 transcript `kind=user.{intervene,veto,approve,pause,resume}` 로 통일. host 무관 동일 surface.

---

## 12. 자연어 보조 장치 — `/crumb` 서브커맨드 5종

### 12.1 5 helper command

```
/crumb config <자연어>     → preset 선택 추천 ("Codex 빠르고 가볍게" → solo or single-codex)
/crumb status               → 현재 진행 상태 (last 10 events, current actor, scoreHistory)
/crumb explain <kind>       → schema 어휘 설명 (예: "explain judge.score" → D1-D6 매트릭스 출력)
/crumb suggest              → 다음 step 추천 (stuck_count 시 user veto/approve/redo 제안)
/crumb debug                → 라우팅 장애 진단 (F1-F7 매트릭스 매핑, 의심 항목 +근거)
```

각 helper 자체가 **자연어 응답 → JSONL 기록**. transcript 로 `kind=note` (라우팅 X, 관찰만) emit.

### 12.2 구현 위치

`agents/coordinator.md` 안 routing-rules 에 helper 분기 추가:

```
After /crumb config <text> → coordinator inline reasoning
                              → kind=note (preset 추천 + 근거)
                              → user 가 직접 preset 선택 (Crumb 은 추천만, 강제 X)
After /crumb status         → coordinator → reducer.summarize() → kind=note
After /crumb explain <k>    → coordinator → schema lookup → kind=note
After /crumb suggest        → coordinator → reducer.suggest() → kind=note
After /crumb debug          → coordinator → fault-detector → kind=note
```

→ 사용자가 자연어로 시스템 조작. **Crumb 추천 + 사용자 선택권 보장**. 강제 분기 X.

---

## 13. 변경 영향 (v2 → v0.1)

| 항목 | v2 | v0.1 |
|---|---|---|
| Entry 수 | 1 (Claude Code) + headless | **3 first-class + headless = 4** |
| actor 수 | 4 외부 + 7 내부 | **5 외부 + 3 specialist + 5 skill** |
| actor binding | provider 1-string | **(harness × provider × model) 3-tuple + ambient fallback** |
| schema kind | 38 | **39 (+qa.result)** |
| from enum | 7 | **8 (engineering-lead → builder + verifier)** |
| scoring 위치 | verifier inline 4 sub-step | **3 layer 분리 (reducer + qa_check + verifier CourtEval)** |
| anti-deception 룰 | 1 (D2 강등) | **5 (+self-bias, inflation, ground-truth override 차단)** |
| preset 수 | 0 (mode flag) | **4 P0 + 3 P1 후보** |
| 자연어 helper | 없음 | **5 helper (`/crumb config|status|explain|suggest|debug`)** |
| 대시보드 | summary.html plan | **4 surface (TUI + summary + live observer + diagram, Kiki 차용)** |
| 사용자 개입 surface | 1 host | **4 host × 5 event 매트릭스** |
| MCP server 노출 | P2 후보 | **P0 (Gemini extension 의존)** |
| 자체 발명 비중 | < 15% | **< 10%** (4 CLI convergence + 3-layer scoring 추가 합성) |

---

## 14. See also

- ★ **[[bagelcode-system-architecture-v0.3.5]]** — v0.3.5 incremental layer (Rule 7 / numerical R4 / judge-input bundle / fallback audit)
- ★ **[[bagelcode-system-diagrams-v0.3.5]]** — 6 Mermaid (spawn / score / anti-deception / judge-input / routing / preset)
- [[bagelcode]] / [[bagelcode-task-direction]] / [[bagelcode-recruitment-task]] — 메일 verbatim
- [[bagelcode-host-harness-decision]] — Hybrid lock (v0.1 이전)
- [[bagelcode-system-architecture]] — v2 (본 페이지가 §1-§2 그림 대체)
- [[bagelcode-frontier-cli-convergence-2026]] — 4 CLI convergence 1차 사료 ★ new
- [[bagelcode-llm-judge-frontier-2026]] — CourtEval / G-Eval / bias 6 사료 ★ new
- [[bagelcode-gamestudio-subagents-2026]] — 12 페르소나 → 5+3 매핑
- [[bagelcode-paperclip-vs-alternatives]] — BYO + heartbeat = effect 패턴
- [[bagelcode-frontier-orchestration-2026]] — Anthropic + Cognition + Magentic-One + AutoGen + LangGraph
- [[bagelcode-verifier-isolation-matrix]] — cross-provider C2 backbone (CP-WBFT / MAR / Lanham 0.32→0.89)
- [[bagelcode-rubric-scoring]] — D1-D6 1차 spec (본 페이지 §7 가 3 layer 로 확장)
- [[bagelcode-fault-tolerance-design]] — F1-F5 (본 페이지 §8.2 가 F6-F7 추가)
- [[bagelcode-observability-frontier-2026]] — OTel GenAI alias
- [[bagelcode-xml-frontier-2026]] — adapter 별 envelope format (XML / Markdown)
- [[bagelcode-budget-guardrails]] — token 예산 + cost dashboard
- `~/workspace/Kiki/app/dashboard/` — 정적 HTML hub 패턴 (참고 자산)
- `agents/coordinator.md` / `agents/{builder,verifier,planner-lead,builder-fallback}.md` — sandwich body 1차 source
