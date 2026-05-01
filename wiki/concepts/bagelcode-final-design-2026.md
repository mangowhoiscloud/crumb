---
title: 베이글코드 과제 — Crumb 최종 설계 (Schema + Inter-Agent Communication 초점)
category: concepts
tags: [bagelcode, crumb, final-design, schema, communication, lead-specialists, socratic, courteval, 2026]
sources:
  - "[[bagelcode-frontier-rationale-5-claims]]"
  - "[[bagelcode-orchestration-topology]]"
  - "[[bagelcode-transcripts-schema]]"
  - "[[bagelcode-rubric-scoring]]"
  - "[[bagelcode-fault-tolerance-design]]"
  - "[[bagelcode-tradingagents-paper]]"
  - "[[bagelcode-observability-frontier-2026]]"
  - "[[bagelcode-paperclip-vs-alternatives]]"
created: 2026-05-02
updated: 2026-05-02
---

# Crumb 최종 설계 — Schema + Inter-Agent Communication 초점

> **lock 된 결정 종합.** 4 outer actor + 7 inner specialist roles + Lead-Specialists 구조 + Socratic 모호성 제거 + CourtEval verifier + 28 kind transcript schema + OTel GenAI alias.

---

## 1. 토폴로지 — Lead-Specialists Hierarchy

### 외부 4 actor (subprocess level)

```
                       USER (TUI / inbox.txt)
                              │
                              │ goal / intervene / approve
                              ▼
                       COORDINATOR (Hub, Haiku 4.5)
                       ★ routing + ledgers + validator + adapter health
                              │
                  ┌───────────┼─────────────────────┐
                  ▼           ▼                     ▼
              PLANNER       ENGINEERING       BUILDER.FALLBACK
              LEAD          LEAD              (Codex 죽었을 때)
              (Sonnet 4.6,  (Codex GPT-5.5    (Sonnet 4.6,
               Claude Code)  primary           Claude Code)
                            또는 Sonnet)
```

### 내부 7 specialist roles (Lead 안 sequential, single spawn)

```
PLANNER LEAD spawn 1회 안에서:
  Step 1: Socratic round         ← 모호성 제거 (max 3 Q, timeout 30s)
  Step 2: Concept Designer       ← 기획자 모드 (메커닉 / 룰)
  Step 3: Researcher              ← 시장 ref / Royal Match류 검토
  Step 4: Visual Designer         ← 색감 / UX / 모바일 친화
  Step 5: Lead synth              ← spec.md + DESIGN.md + tuning.json draft

ENGINEERING LEAD spawn 1회 안에서:
  Step 1: Builder                 ← 코드 작성 (Phaser HTML5)
  Step 2: QA                       ← lint + unit test
  Step 3: Verifier (CourtEval)    ← Grader → Critic → Defender → Re-grade
  Step 4: Lead synth               ← verify.result + 산출물 정리
```

→ **외부 4 / 내부 7** = quality 유지하면서 토큰 폭증 회피.

### 모드 변형 (사용자 선택권)

| Mode | actor | 토큰 | 용도 |
|---|---|---|---|
| `--solo` | Coord + Lead 1개 (모두 Claude) | ~25K | Anthropic 키만, 최소 |
| `--standard` (default) | 외부 4 + 내부 7 sequential | ~65K | 정상 |
| `--rigorous` | 외부 8 (specialist 진짜 분리) | ~150K | quality demo |
| `--parallel` | standard + Codex/Claude 동시 builder | ~110K | demo 시연 |

→ Anthropic "wrong tradeoff" 교훈 정합 (user-controllable).

---

## 2. Transcript Schema — 28 Kind + 11 Field

### Message 구조 (TypeScript)

```typescript
type Message = {
  // ── 식별 ──
  id: ULID                        // 시간순 정렬 + 충돌 방지
  ts: ISO8601                     // human readable
  session_id: string              // 세션 단위
  task_id?: string                // ★ session 안 multi-task

  // ── 라우팅 ──
  from: ActorId                   // user / coord / planner / engineering / builder.fb
  to: ActorId | "*"               // "*" = broadcast (관찰만)
  parent_event_id?: ULID          // ★ DAG 추적
  in_reply_to?: ULID              // (alias for parent_event_id, deprecated)

  // ── 분류 ──
  kind: MessageKind               // 28 kind (아래)
  topic?: string                  // 자유 태그
  step?: SpecialistStep            // ★ Lead 내부 step 마킹

  // ── 본문 ──
  body: string                    // 자유 텍스트 (한 곳에 격리)
  data?: Record<string, unknown>  // structured payload (kind별)
  content?: {                     // ★ format 명시
    format: 'markdown' | 'json' | 'text' | 'xml'
    text: string
  }

  // ── 산출물 ──
  artifacts?: ArtifactRef[]        // ref만 (sha256 + path)

  // ── 점수 (★ first-class) ──
  scores?: {
    goal_completion: number        // 0-5
    collaboration: number          // 0-5
    groundedness: number           // 0-5
    actionability: number          // 0-5
    cost_efficiency: number        // 0-5
    intervention_response: number  // 0-5
    aggregate: number              // sum 0-30
    verdict: 'PASS' | 'PARTIAL' | 'FAIL' | 'REJECT'
  }

  // ── 통제 ──
  ack_required?: boolean
  blocking?: boolean

  // ── 메타데이터 (관찰성) ──
  metadata?: {
    visibility: 'public' | 'private'  // ★ envelope 필터링
    model?: string                    // claude-opus-4-7 / gpt-5.5 / etc.
    turn?: number
    tokens_in?: number
    tokens_out?: number
    cache_read?: number               // Anthropic ephemeral hit
    cache_write?: number
    latency_ms?: number
    cost_usd?: number                 // PAYG estimate
    thinking_tokens?: number          // model_thinking (캐시 X)
    audit_violations?: string[]       // anti-deception 룰 위반
  }
}

type SpecialistStep =
  | 'socratic' | 'concept' | 'research' | 'design'  // Planner Lead
  | 'builder' | 'qa' | 'verifier'                    // Engineering Lead
  | 'grader' | 'critic' | 'defender' | 'regrader'    // CourtEval inside Verifier
  | 'synth'                                           // Lead final
```

### 28 Kind 어휘

```
─── 시스템 (4) ──────────
session.start            세션 개시 + manifest
session.end              세션 종료
agent.wake               actor spawn 명령
agent.stop               actor 정지

─── 작업 흐름 (10) ──────
goal                     사용자 최상위 요청
question.socratic        ★ 신규 (Planner Lead 가 user 에게 모호성 질문)
answer.socratic          ★ 신규 (user 응답)
spec                     Planner Lead 산출 (AC + 룰북)
spec.update              spec 수정
build                    Engineering Lead 산출 (코드)
verify.request           검증 요청
verify.result            검증 결과 (verdict + scores nested)
judge.score              ★ 신규 first-class scorecard
done                     최종 산출 확정

─── 대화 / 추론 (5) ──────
agent.thought_summary    ★ 신규 (private CoT 비저장, summary만)
question                 일반 질문 (Lead → User 또는 cross-Lead)
answer                   응답
debate                   다자 토론 entry (CourtEval 내부)
note                     자유 코멘트 (routing 안 됨)

─── Lead 내부 step (5) ──
step.socratic            ★ 신규 (Planner Lead 가 step 진입 마킹)
step.concept             ★ 신규
step.research            ★ 신규
step.design              ★ 신규
step.judge               ★ 신규 (Verifier 의 Grader/Critic/Defender)

─── 사용자 개입 (4) ───
user.intervene           일반 개입
user.veto                특정 메시지 거부
user.approve             명시 승인
user.pause / .resume     글로벌 통제

─── 핸드오프 (2) ──────
handoff.requested        ★ 신규 (Lead → Lead 명시)
handoff.accepted         ★ 신규

─── 산출물 / 메타 (4) ──
artifact.created         ★ 신규 (separate event)
ack                      수신 확인
error                    오류 보고
audit                    감사 (자동 기록)
```

→ **28 kind**. 어휘 정밀화.

---

## 3. Inter-Agent Communication 규격

### A. Envelope (각 spawn 시 actor 가 받는 것)

```xml
<crumb:envelope session="cat-match-3" turn="4" task="task_main_game">
  
  <crumb:contract>
    <input-kinds>goal, spec, spec.update, user.intervene</input-kinds>
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
    <!-- kind-filtered, visibility=public only -->
    <msg id="01J..." from="planner-lead" kind="spec" sha256="...">
      <data>{"acceptance_criteria":[...]}</data>
    </msg>
  </crumb:relevant-messages>
  
  <crumb:tools-allowed>Read, Write, Edit, Bash</crumb:tools-allowed>
  
  <crumb:enforcement>
    - STOP after own kind (no continue)
    - artifacts must include sha256
    - claim PASS only with exec.exit_code
  </crumb:enforcement>
  
</crumb:envelope>
```

→ **agent-friendly** (XML, machine-parseable) **+ kind-filtered** (`visibility=public` 만, private 제외) **+ artifact ref only** (body 0).

### B. Handoff protocol (Lead → Lead)

```
Planner Lead 종료 시:
  ─[1]→ kind=spec (산출물 ref)
  ─[2]→ kind=artifact.created (game-spec.md)
  ─[3]→ kind=handoff.requested, to=engineering-lead, payload={spec_id}
  ─[4]→ kind=audit (tokens / cost / latency)

Coordinator wake:
  ▸ validator.check([1][2][3])
  ▸ task-ledger.update
  ▸ progress-ledger.next = engineering-lead
  ▸ kind=handoff.accepted (ack)
  ▸ spawn engineering-lead with envelope
```

→ **명시 handoff** = ambiguity 0 + replay deterministic.

### C. Socratic round 프로토콜

```
Planner Lead spawn 시작:
  
  Step 1 (socratic):
    inside Planner Lead reasoning:
      "Goal 의 모호성 분석:"
      "  - target platform 미명시"
      "  - session 길이 미명시"
      "  - monetization 의도 미명시"
    
    transcript append × 3:
      kind=question.socratic, body="타겟 platform?",
        data={ options: ['iOS Safari', 'Android Chrome', 'both'],
               default: 'both' }
      kind=question.socratic, body="Session 길이?",
        data={ options: ['60s', 'unlimited', 'level-based'],
               default: '60s' }
      kind=question.socratic, body="Monetization?",
        data={ options: ['skip', 'ad slots', 'IAP positions'],
               default: 'skip' }
    
    Wait 30s timeout per question:
      user types → kind=answer.socratic
      timeout → use default, kind=audit{event=socratic_default}
  
  Step 2-4 (concept / research / design):
    inner reasoning (transcript step.* 마킹)
    no new spawn
  
  Step 5 (synth):
    final spec.md / DESIGN.md / tuning.json draft 작성
    transcript append:
      kind=artifact.created × 3
      kind=spec (final)
      kind=handoff.requested → engineering-lead
```

### D. CourtEval verifier 프로토콜

```
Engineering Lead spawn → Step 3 (Verifier):
  
  Sub-step 1 (Grader):
    transcript: kind=step.judge, step=grader
    initial scores 산출 (D1-D6)
  
  Sub-step 2 (Critic):
    transcript: kind=step.judge, step=critic
    body: "score 4 too high because contrast 4.2:1 미달"
    
  Sub-step 3 (Defender):
    transcript: kind=step.judge, step=defender
    body: "actually contrast 4.5+ on 90% of palette, 1 색만 4.2"
    
  Sub-step 4 (Re-grader):
    transcript: kind=step.judge, step=regrader
    final scores (Critic+Defender 반영)
    
  Final:
    kind=judge.score (first-class)
      data: { D1, D2, ..., aggregate, verdict, feedback }
    kind=verify.result (legacy alias)
```

→ **CourtEval ACL 2025 차용**. 1 spawn 안 sequential, 토큰 +30%.

### E. Adaptive stopping (NeurIPS 2025 inspired)

```
progress-ledger 안:
  score_history: [24.0, 23.8, 24.0, 24.1]   # 최근 4 round
  
reducer:
  if last 2 rounds 의 score 변동 < 1.0:
    next_speaker = "done"
    stop_reason = "score_stable"
    kind=audit, event=adaptive_stop_triggered

→ verifier polish 무한 루프 차단
→ NeurIPS 2025 multi-agent debate judge 정합
```

---

## 4. State Machine (Stateless Reducer)

```typescript
// Pure (replay deterministic)
type State = {
  taskLedger: Readonly<TaskLedger>
  progressLedger: Readonly<ProgressLedger>
  circuitBreaker: ReadonlyMap<AdapterId, CircuitState>
  invalidatedMsgs: ReadonlySet<MessageId>
  pausedState: boolean
  stuckCount: number
  scoreHistory: number[]            // adaptive stop 용
  lastSeen: ULID | null
  hookActive: HookKind | null
}

type Event =
  | { kind: 'transcript', msg: Message }
  | { kind: 'tick' }
  | { kind: 'probe.result', adapter: AdapterId, status: HealthStatus }
  | { kind: 'subprocess.exit', actor: ActorId, code: number }

type Effect =
  | { kind: 'spawn', actor: ActorId, adapter: AdapterId, sandwich: string }
  | { kind: 'kill', actor: ActorId, signal: 'SIGINT' }
  | { kind: 'write_artifact', path: string, content: string }
  | { kind: 'append_transcript', msg: Message }
  | { kind: 'tui_render', state: State }
  | { kind: 'open_modal', hook: HookKind, options: string[], timeout: number }
  | { kind: 'persist_ledgers', state: State }
  | { kind: 'generate_summary_html' }

function reduce(state: State, event: Event): { state: State, effects: Effect[] }
```

3 loop variant (같은 reducer, 다른 dispatcher):
- `liveLoop()` — chokidar + setInterval + dispatchLive
- `replayLoop()` — read transcript + dispatchReplay (TUI only)
- `testLoop()` — synchronous, mock dispatcher

→ **transcript.jsonl 만으로 state 100% derive** = replay/test/crash recovery 모두 무료.

---

## 5. Adapter Layer (Subprocess + 사용자 구독)

### 3 adapter (Paperclip-inspired BYO pattern)

```typescript
interface AgentAdapter {
  id: 'claude-local' | 'codex-local' | 'gemini-local'
  ping(): Promise<HealthStatus>
  call(req: AdapterRequest): Promise<AdapterResponse>
  onSuccess(): void
  onFailure(err: Error): void
}

// adapters/claude-local.ts
class ClaudeLocalAdapter implements AgentAdapter {
  async call(req) {
    return spawn('claude', [
      '--print',
      '--output-format', 'stream-json',
      '--dangerously-skip-permissions',  // sandbox subprocess
      '--add-dir', `sessions/${sid}/artifacts/`,
      '--resume', sessionId,              // cache hit + continuity
      '--append-system-prompt', req.sandwich,  // ★ stdin injection
    ], { cwd: `sessions/${sid}/agent-workspace/${actor}/` })
  }
}

// adapters/codex-local.ts
class CodexLocalAdapter implements AgentAdapter {
  async call(req) {
    const proc = spawn('codex', [
      'exec', '--json',
      '--skip-git-repo-check',
      '--approval-policy', 'never',
      '--sandbox-mode', 'workspace-write',
    ], { cwd: ..., env: ... })
    proc.stdin.write(toMarkdown(req.sandwich))  // XML → Markdown 변환
    return parseStreamJson(proc.stdout)
  }
}
```

→ **OAuth = CLI 자체 처리** (Claude Max + Codex Plus 구독).
→ **CLAUDE.md / AGENTS.md auto-load 의존 X** (stdin injection).

---

## 6. UI / Observability (3 surface)

### TUI (P0, blessed)

```
┌─ Crumb · cat-match-3 · turn 4/15 · standard preset ─────────┐
│                                                                │
│ ▶ TIMELINE (j/k scroll, Enter expand, Tab pane)               │
│ [00:00] 👤 user      goal       "고양이 매치-3..."              │
│ [00:32] 🔵 planner-L step.socratic Q: 색약 친화 팔레트?         │
│ [00:40] 👤 user      answer.socratic "기본 OK, 색약 친화만"    │
│ [00:43] 🔵 planner-L step.concept 메커닉 정의                  │
│ [00:55] 🔵 planner-L step.research Royal Match 패턴 검토        │
│ [01:10] 🔵 planner-L step.design 색감 + UX                      │
│ [01:25] 🔵 planner-L spec        artifact.created spec.md      │
│ [01:30] 🟣 eng-L     step.builder game.html (320 LOC)           │
│ [02:30] 🟣 eng-L     step.qa     lint pass / 5 tests pass       │
│ [02:45] 🟣 eng-L     step.judge.grader  initial 24/25            │
│ [02:55] 🟣 eng-L     step.judge.critic   contrast 4.2 challenge   │
│ [03:05] 🟣 eng-L     step.judge.defender 90% palette OK         │
│ [03:15] 🟣 eng-L     judge.score  PASS 24.5/25                  │
│ [03:16] 🟢 coord     done                                        │
│                                                                │
├─ AGENTS ──────────┬─ ADAPTERS ─────────────────────────────┤
│ coord   haiku-4-5 │ claude-local  ●healthy  ping 86ms       │
│ planner-L sonnet  │ codex-local   ●healthy  ping 124ms      │
│ eng-L   gpt-5.5   │ gemini-local  ○disabled                  │
├──────────────────┴─────────────────────────────────────────┤
│ Cost $0.45 PAYG / Cache 67% / Stuck 0/5 / Wall 3:16            │
├──────────────────────────────────────────────────────────────┤
│ /approve /veto /redo /note /pause /switch /q                  │
│ > _                                                            │
└──────────────────────────────────────────────────────────────┘
```

### summary.html (P1, 자동 생성, warm-paper)

세션 끝 시 `sessions/<id>/summary.html` 자동 생성. transcript inline + iframe game.html + dimension scorecard + cost breakdown.

### Web observer (P2, opt-in)

`crumb observe sessions/<id>/` → localhost:8080 → SSE + iframe game preview.

---

## 7. Persistence Layout

```
sessions/<ulid>/
├── manifest.json                  세션 메타
├── transcript.jsonl                ★ single SoT (28 kind, replay-deterministic)
├── ledgers/
│   ├── task.json                   누적 사실 (snapshot, transcript-derivable)
│   └── progress.json               turn 별 (transcript-derivable)
├── audit/
│   └── <date>.jsonl                kind=audit 만 분리 (검색 빠름)
├── inbox.txt                       headless 사용자 개입 fallback
├── artifacts/                      4 deliverable (kind=artifact.created ref)
│   ├── game.html
│   ├── spec.md
│   ├── DESIGN.md
│   ├── tuning.json
│   └── screenshots/
├── agent-workspace/                actor 별 sandbox cwd
│   ├── coordinator/
│   ├── planner-lead/
│   ├── engineering-lead/
│   └── builder-fallback/
└── summary.html                    P1 자동 생성
```

---

## 8. OTel GenAI alias (export ready)

```jsonc
// Crumb transcript 매 메시지 → OTel GenAI semantic conventions
{
  "id": "01J...",                         // span_id
  "ts": "...",                            // start_time_unix_nano
  "session_id": "abc",                    // gen_ai.conversation.id
  "task_id": "task_main",                 // gen_ai.task.id
  "from": "planner-lead",                 // gen_ai.agent.name
  "to": "engineering-lead",
  "parent_event_id": "01J...",            // span.parent_id
  "kind": "spec",                         // gen_ai.operation.name
  "metadata": {
    "model": "claude-opus-4-7",           // gen_ai.request.model
    "tokens_in": 5000,                    // gen_ai.usage.input_tokens
    "tokens_out": 1500,                   // gen_ai.usage.output_tokens
    "cache_read": 4500                    // gen_ai.usage.cache_read_tokens
  },
  "scores": {...}                          // gen_ai.evaluation.*
}
```

→ `crumb export --format otel-jsonl` = Datadog / Vertex / Phoenix / Langfuse 어디로든.

---

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-frontier-rationale-5-claims]] — 5 frontier claim 분해
- [[bagelcode-orchestration-topology]] — Hub-Ledger-Spoke 결정
- [[bagelcode-transcripts-schema]] — schema 1차 spec
- [[bagelcode-rubric-scoring]] — D1-D5 anti-deception
- [[bagelcode-fault-tolerance-design]] — F1-F5 mitigation
- [[bagelcode-observability-frontier-2026]] — OTel GenAI 표준
- [[bagelcode-tradingagents-paper]] — 학술 backing
