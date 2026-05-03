---
title: Bagelcode Task — Agent Transcripts Schema spec (first pass)
category: concepts
tags: [bagelcode, schema, transcript, jsonl, protocol, multi-agent, foundation]
sources:
  - "[[bagelcode-tradingagents-paper]]"
  - "[[kiki-appmaker-orchestration]]"
  - "[[kiki-slack-integration]]"
created: 2026-05-01
updated: 2026-05-01
---

# Agent Transcripts Schema spec (first pass)

> **Prerequisite for every other decision.** Cache boundaries, rubric measurement points, user-intervention surfaces, and .md instruction structure all sit on top of this schema. Once locked, change cost is high → nail it down hard in this pass and start from there.
>
> Rationale: [[bagelcode-tradingagents-paper]] §4.1-4.2 (structured-by-default + dialogue-as-entry), [[kiki-appmaker-orchestration]] (sandwich), [[kiki-slack-integration]] (intent + notifier single-line events).

## 5 design principles

1. **Append-only JSONL** — one line = one message. The file is the state machine itself. (a Karpathy P5: Git-as-State-Machine variant)
2. **Structured-by-default, free-text only inside `.body`** — every field needed for routing / observation lives in the schema. Natural language is quarantined to a single field.
3. **Pull, not broadcast** — agents query only the messages they need. We do not stuff the entire transcripts into the system prompt every time (directly tied to caching).
4. **All dialogue is also a structured entry** — debates / Q&A are also a single JSONL line. No "agents handle it among themselves" side channels.
5. **User = first-class actor** — user utterances go into the same JSONL with the same schema. No separate channel.

## Directory layout

```
sessions/<session_id>/
├── manifest.json          # 세션 메타 (시작 시각, 참여 에이전트, 모델, 모드)
├── transcript.jsonl       # 모든 메시지 (append-only)
├── artifacts/             # 에이전트 산출물 (코드/문서)
│   ├── spec.md
│   ├── output/...
│   └── ...
└── checkpoints/           # 캐시 키 / 리플레이용 스냅샷
```

## Message schema (one JSONL line = one message)

```typescript
type Message = {
  // ─── 식별 ───────────────────────────
  id: string              // ULID — 시간순 정렬 가능
  ts: string              // ISO-8601 (UTC)
  session_id: string

  // ─── 라우팅 ─────────────────────────
  from: ActorId           // "user" | "coordinator" | "planner" | "builder" | "critic"
  to: ActorId | "*"       // "*" = broadcast (관찰자만, 라우팅 X)
  in_reply_to?: string    // 다른 메시지 id — 스레드 추적

  // ─── 분류 ───────────────────────────
  kind: MessageKind       // 아래 표 참조
  topic?: string          // 자유 태그 (e.g. "spec/auth", "build/api")

  // ─── 본문 ───────────────────────────
  body: string            // 자연어 (한 곳에만 격리)
  data?: Record<string, unknown>  // structured payload (kind별 schema)

  // ─── 산출물 ─────────────────────────
  artifacts?: ArtifactRef[]  // {path, sha256, role}

  // ─── 관찰성 ─────────────────────────
  model?: string          // "claude-opus-4-7" | "gpt-5.5" | "gemini-2.5-pro"
  tokens_in?: number
  tokens_out?: number
  cache_read?: number     // anthropic ephemeral cache hit tokens
  cache_write?: number
  latency_ms?: number
  cost_usd?: number       // 추정

  // ─── 통제 ───────────────────────────
  ack_required?: boolean  // true 면 to 측이 ack 메시지 응답 의무
  blocking?: boolean      // 다음 stage 진행 차단
}

type ActorId = "user" | "coordinator" | "planner" | "builder" | "critic" | string
```

## MessageKind (control vocabulary — this set is the heart of the protocol)

```
─── 시스템 ──────────
session.start         세션 개시 (manifest 와 짝)
session.end           세션 종료
agent.wake            특정 에이전트 호출
agent.stop            에이전트 정지

─── 작업 흐름 ──────
goal                  사용자가 던지는 최상위 요청
spec                  Planner 의 산출 (AC, 제약, 컨텍스트)
spec.update           Spec 수정 (질문 응답 후)
build                 Builder 의 코드/문서 산출
verify.request        검증 요청
verify.result         검증 결과 (PASS/FAIL + score + reason)
done                  최종 산출 확정

─── 대화 (자연어 격리) ──
question              에이전트→에이전트, 에이전트→사용자 질문
answer                질문에 대한 응답
debate                다자 토론 entry (TradingAgents §4.2 III/IV 패턴)
note                  자유 코멘트 (라우팅 안 함)

─── 사용자 개입 ────
user.intervene        사용자 끼어들기 (예: "스펙 다시 짜")
user.veto             특정 결과 거부
user.approve          명시적 승인
user.pause / .resume  세션 통제

─── 메타 ───────────
ack                   수신 확인 (ack_required 응답)
error                 오류 보고
audit                 감사 항목 (자동 기록, 사람·에이전트 안 읽음)
```

→ **Under 20 in total**. Union of Slack-style 9 intents ([[kiki-slack-integration]]) + TradingAgents 5 stages + 4 user-intervention kinds.

## `data` schema summary per kind

| kind | data schema |
|---|---|
| `goal` | `{ text: string, constraints?: string[], deadline?: string }` |
| `spec` | `{ acceptance_criteria: string[], non_goals?: string[], questions?: string[] }` |
| `build` | `{ files_changed: string[], summary: string, run_cmd?: string }` |
| `verify.request` | `{ targets: string[], rubric_id: string }` |
| `verify.result` | `{ verdict: "PASS"\|"FAIL"\|"PARTIAL", score: number, dimensions: {...} }` |
| `user.veto` | `{ target_msg_id: string, reason: string }` |
| `debate` | `{ stance: "for"\|"against"\|"neutral", round: number }` |

Detailed schemas live in code under `protocol/schemas/*.json` (JSON Schema) — runtime validation.

## Append-only guarantee

- writer flushes via OS-level `O_APPEND`
- reader polls `tail -F` style (1 second / inotify)
- message id = **ULID** — lexical sort = chronological sort, collision risk ε

## "User intervention" surface mapping

| Intervention mode | Input | Resulting transcript entry |
|---|---|---|
| Free utterance mid-flight | `> note ...` | `kind=note, from=user` |
| Reject a result | `> /veto <msg_id> "reason"` | `kind=user.veto` |
| Rewrite the spec | `> /redo spec` | `kind=user.intervene` + the next Planner resets and rewrites |
| Pause | `> /pause` | `kind=user.pause` (every agent checks on wake) |
| Explicit approve | `> /approve <msg_id>` | `kind=user.approve` (release gate passes) |

## "User observation" surface

3-tier:

1. **Raw JSONL tail** — for log-friendly users (developers)
2. **Pretty TUI** — colorizes messages by actor/kind, wraps the body. Timeline on the left + input on the right
3. **Web observer (optional)** — JSONL → Server-Sent Events streamed to the browser

→ **All 3 tiers derive from the same single transcript file.** No separate infrastructure.

## Mapping to the TradingAgents pattern

| TradingAgents §4.2 | Our task |
|---|---|
| Analyst report (structured) | `kind=spec` (structured report produced by Planner) |
| Trader decision (structured) | `kind=build` (output produced by Builder) |
| Researcher debate → facilitator structured entry | multiple `kind=debate` lines + a single `kind=verify.result` |
| Risk Mgmt debate → adjustment | `kind=user.intervene` or `kind=user.veto` |
| Fund Manager final | `kind=done` |

→ **The 5 stages map to Goal → Spec → Build → Verify → Done for us.** Same skeleton.

## Relation between Sandwich and transcript

If [[kiki-appmaker-orchestration]]'s 4-section sandwich is the system prompt, then the transcript is the conversation memory that sandwich fills in:

- **§1 Engineering-team contract** ↔ MessageKind vocabulary (which message goes by whom in what order)
- **§2 Stage template** ↔ per-kind output schema
- **§3 Tool execution footer** ↔ artifacts/checkpoints directory convention
- **§4 Routing enforcement** ↔ transcript validator (rejects wrong kind/from/to combos)

## Real-world example (one full flow)

```jsonl
{"id":"01J9...","ts":"2026-05-02T01:00:00Z","session_id":"s1","from":"user","to":"coordinator","kind":"goal","body":"todo REST API in Python"}
{"id":"01J9...","ts":"2026-05-02T01:00:01Z","session_id":"s1","from":"coordinator","to":"planner","kind":"agent.wake","body":"plan from goal","in_reply_to":"01J9...goal"}
{"id":"01J9...","ts":"2026-05-02T01:00:18Z","session_id":"s1","from":"planner","to":"*","kind":"spec","body":"AC: GET/POST/DELETE on /todos, in-memory","data":{"acceptance_criteria":["GET /todos","POST /todos","DELETE /todos/:id"],"questions":["DB?"]},"model":"claude-opus-4-7","tokens_in":1240,"tokens_out":380,"cache_read":1100,"cost_usd":0.012}
{"id":"01J9...","ts":"2026-05-02T01:00:40Z","session_id":"s1","from":"user","to":"planner","kind":"answer","body":"in-memory ok","in_reply_to":"01J9...spec"}
{"id":"01J9...","ts":"2026-05-02T01:00:42Z","session_id":"s1","from":"planner","to":"*","kind":"spec.update","body":"in-memory dict store","data":{"acceptance_criteria":["...","in-memory store"]}}
{"id":"01J9...","ts":"2026-05-02T01:00:43Z","session_id":"s1","from":"coordinator","to":"builder","kind":"agent.wake","body":"build from spec"}
{"id":"01J9...","ts":"2026-05-02T01:01:55Z","session_id":"s1","from":"builder","to":"*","kind":"build","body":"app.py + test_app.py","data":{"files_changed":["app.py","test_app.py"],"run_cmd":"python -m pytest"},"artifacts":[{"path":"artifacts/app.py","sha256":"...","role":"src"}],"model":"gpt-5.5","tokens_in":2100,"tokens_out":1240,"cost_usd":0.025}
{"id":"01J9...","ts":"2026-05-02T01:01:57Z","session_id":"s1","from":"coordinator","to":"critic","kind":"verify.request","data":{"targets":["app.py"],"rubric_id":"v1"}}
{"id":"01J9...","ts":"2026-05-02T01:02:30Z","session_id":"s1","from":"critic","to":"*","kind":"verify.result","body":"PASS — 3/3 AC, tests green","data":{"verdict":"PASS","score":92,"dimensions":{"correctness":4.7,"clarity":4.5}},"model":"gemini-2.5-pro","tokens_in":3200,"tokens_out":420,"cost_usd":0.008}
{"id":"01J9...","ts":"2026-05-02T01:02:31Z","session_id":"s1","from":"coordinator","to":"user","kind":"done","body":"shipping app.py + tests"}
```

→ The evaluator can trace decision-making just by looking at this single file. Aligned with the JSONL submission requirement.

## Open / follow-up

- [ ] Write the exact JSON Schema for `data` (during code implementation)
- [ ] Pick a ULID library (Python: `python-ulid`, Node: `ulid`) — depends on which language we go with
- [ ] Concurrent-writer (Coordinator + Critic writing simultaneously) lock strategy — append-only + flush + retry sufficient vs file lock

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-tradingagents-paper]] — primary source
- [[bagelcode-caching-strategy]] — cache boundaries on top of this schema
- [[bagelcode-rubric-scoring]] — definition of dimensions in `verify.result.dimensions`
- [[bagelcode-paperclip-vs-alternatives]] — should we adapt this schema to an external framework or run it ourselves
- [[kiki-appmaker-orchestration]] — sandwich identity (4-section)
- [[kiki-slack-integration]] — 9 intents + Pipeline notifier
