---
title: Bagelcode Task — Crumb Final Design (Schema + Inter-Agent Communication focus)
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
  - "[[bagelcode-host-harness-decision]]"
  - "[[bagelcode-system-architecture]]"
  - "[[bagelcode-verifier-isolation-matrix]]"
summary: >-
  Crumb's P0 lock — Lead-Specialists structure + Socratic + CourtEval + transcript schema + OTel.
  §1 topology diagram and §2 "28 kind" count are superseded by system-architecture as canonical.
created: 2026-05-02
updated: 2026-05-02
---

# Crumb Final Design — Schema + Inter-Agent Communication focus

> **Synthesis of locked decisions.** 4 outer actors + 7 inner specialist roles + Lead-Specialists structure + Socratic ambiguity removal + CourtEval verifier + 28 kind transcript schema + OTel GenAI alias.
>
> ★ **2026-05-02 correction**: §1 topology diagram and §2 "28 kind" count are superseded by [[bagelcode-system-architecture]] as canonical, following [[bagelcode-host-harness-decision]]. §3-§8 of this page (envelope / state machine / adapter / OTel alias) remain valid as written.

---

## 1. Topology — Lead-Specialists Hierarchy ★ deprecated, see [[bagelcode-system-architecture]] §1-§2

> The §1 diagram below pre-dates the host-harness-decision (Hybrid: Claude Code skill + headless CLI). The new canonical diagram is system-architecture §1 (default) + §2 (cross-provider mode). Key changes: external processes 4 → 1 (Claude Code single host) + opt-in cross-provider only + Codex CLI 1; internal specialist = native Task subagent (depth=1). The text below is preserved as archive.

### 4 outer actors (subprocess level) — archive

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
              LEAD          LEAD              (when Codex is dead)
              (Sonnet 4.6,  (Codex GPT-5.5    (Sonnet 4.6,
               Claude Code)  primary           Claude Code)
                            or Sonnet)
```

### 7 inner specialist roles (sequential within each Lead, single spawn)

```
Within a single PLANNER LEAD spawn:
  Step 1: Socratic round         ← ambiguity removal (max 3 Q, timeout 30s)
  Step 2: Concept Designer       ← designer mode (mechanics / rules)
  Step 3: Researcher              ← market refs / Royal Match-style review
  Step 4: Visual Designer         ← color / UX / mobile-friendly
  Step 5: Lead synth              ← spec.md + DESIGN.md + tuning.json draft

Within a single ENGINEERING LEAD spawn:
  Step 1: Builder                 ← code authoring (Phaser HTML5)
  Step 2: QA                       ← lint + unit test
  Step 3: Verifier (CourtEval)    ← Grader → Critic → Defender → Re-grade
  Step 4: Lead synth               ← verify.result + artifact roll-up
```

→ **outer 4 / inner 7** = preserve quality while avoiding token explosion.

### Mode variants (user choice)

| Mode | actors | tokens | use case |
|---|---|---|---|
| `--solo` | Coord + 1 Lead (all Claude) | ~25K | Anthropic key only, minimal |
| `--standard` (default) | outer 4 + inner 7 sequential | ~65K | normal |
| `--rigorous` | outer 8 (specialists actually split out) | ~150K | quality demo |
| `--parallel` | standard + Codex/Claude builders concurrent | ~110K | demo showcase |

→ Aligned with the Anthropic "wrong tradeoff" lesson (user-controllable).

---

## 2. Transcript Schema — 38 Kind + 11 Field ★ corrected (matches actual schema)

> The earlier "28 kind" notation was a pre-P0 count. The actual `protocol/schemas/message.schema.json` = **38 kind** (additions include handoff.rollback / tool.call / tool.result / hook + the user.pause/resume split). 38-kind classification: [[bagelcode-system-architecture]] §3.

### (archive) 28 Kind + 11 Field

### Message structure (TypeScript)

```typescript
type Message = {
  // ── identity ──
  id: ULID                        // chronological sort + collision avoidance
  ts: ISO8601                     // human readable
  session_id: string              // session unit
  task_id?: string                // ★ multi-task within a session

  // ── routing ──
  from: ActorId                   // user / coord / planner / engineering / builder.fb
  to: ActorId | "*"               // "*" = broadcast (observe only)
  parent_event_id?: ULID          // ★ DAG tracking
  in_reply_to?: ULID              // (alias for parent_event_id, deprecated)

  // ── classification ──
  kind: MessageKind               // 28 kind (below)
  topic?: string                  // free-form tag
  step?: SpecialistStep            // ★ marks the step inside a Lead

  // ── body ──
  body: string                    // free-form text (isolated to one place)
  data?: Record<string, unknown>  // structured payload (per kind)
  content?: {                     // ★ explicit format
    format: 'markdown' | 'json' | 'text' | 'xml'
    text: string
  }

  // ── artifacts ──
  artifacts?: ArtifactRef[]        // ref only (sha256 + path)

  // ── scores (★ first-class) ──
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

  // ── control ──
  ack_required?: boolean
  blocking?: boolean

  // ── metadata (observability) ──
  metadata?: {
    visibility: 'public' | 'private'  // ★ envelope filtering
    model?: string                    // claude-opus-4-7 / gpt-5.5 / etc.
    turn?: number
    tokens_in?: number
    tokens_out?: number
    cache_read?: number               // Anthropic ephemeral hit
    cache_write?: number
    latency_ms?: number
    cost_usd?: number                 // PAYG estimate
    thinking_tokens?: number          // model_thinking (no cache)
    audit_violations?: string[]       // anti-deception rule violations
  }
}

type SpecialistStep =
  | 'socratic' | 'concept' | 'research' | 'design'  // Planner Lead
  | 'builder' | 'qa' | 'verifier'                    // Engineering Lead
  | 'grader' | 'critic' | 'defender' | 'regrader'    // CourtEval inside Verifier
  | 'synth'                                           // Lead final
```

### 28 Kind vocabulary

```
─── system (4) ──────────
session.start            session start + manifest
session.end              session end
agent.wake               actor spawn command
agent.stop               actor stop

─── workflow (10) ──────
goal                     user top-level request
question.socratic        ★ new (Planner Lead asks user about ambiguity)
answer.socratic          ★ new (user response)
spec                     Planner Lead output (AC + rule sheet)
spec.update              spec revision
build                    Engineering Lead output (code)
verify.request           verification request
verify.result            verification result (verdict + scores nested)
judge.score              ★ new first-class scorecard
done                     final delivery confirmed

─── conversation / reasoning (5) ──────
agent.thought_summary    ★ new (private CoT not stored, summary only)
question                 general question (Lead → User or cross-Lead)
answer                   answer
debate                   multi-party debate entry (inside CourtEval)
note                     free-form comment (not routed)

─── Lead-internal step (5) ──
step.socratic            ★ new (Planner Lead marks step entry)
step.concept             ★ new
step.research            ★ new
step.design              ★ new
step.judge               ★ new (Verifier's Grader/Critic/Defender)

─── user intervention (4) ───
user.intervene           generic intervention
user.veto                reject a specific message
user.approve             explicit approval
user.pause / .resume     global control

─── handoff (2) ──────
handoff.requested        ★ new (Lead → Lead explicit)
handoff.accepted         ★ new

─── artifact / meta (4) ──
artifact.created         ★ new (separate event)
ack                      receipt acknowledgement
error                    error report
audit                    audit (auto-recorded)
```

→ **28 kind**. Vocabulary refined.

---

## 3. Inter-Agent Communication spec

### A. Envelope (what the actor receives at each spawn)

```xml
<crumb:envelope session="cat-match-3" turn="4" task="task_main_game">
  
  <crumb:contract>
    <input-kinds>goal, spec, spec.update, user.intervene</input-kinds>
    <output-kinds>build, artifact.created</output-kinds>
    <handoff-target>verifier</handoff-target>
  </crumb:contract>
  
  <crumb:task-ledger version="3">
    <fact>match-3, 60s limit, combo 1.5×</fact>
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

→ **agent-friendly** (XML, machine-parseable) **+ kind-filtered** (`visibility=public` only, private excluded) **+ artifact ref only** (zero body).

### B. Handoff protocol (Lead → Lead)

```
At Planner Lead termination:
  ─[1]→ kind=spec (artifact ref)
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

→ **explicit handoff** = zero ambiguity + replay deterministic.

### C. Socratic round protocol

```
At Planner Lead spawn start:
  
  Step 1 (socratic):
    inside Planner Lead reasoning:
      "Goal ambiguity analysis:"
      "  - target platform unspecified"
      "  - session length unspecified"
      "  - monetization intent unspecified"
    
    transcript append × 3:
      kind=question.socratic, body="target platform?",
        data={ options: ['iOS Safari', 'Android Chrome', 'both'],
               default: 'both' }
      kind=question.socratic, body="session length?",
        data={ options: ['60s', 'unlimited', 'level-based'],
               default: '60s' }
      kind=question.socratic, body="Monetization?",
        data={ options: ['skip', 'ad slots', 'IAP positions'],
               default: 'skip' }
    
    Wait 30s timeout per question:
      user types → kind=answer.socratic
      timeout → use default, kind=audit{event=socratic_default}
  
  Step 2-4 (concept / research / design):
    inner reasoning (transcript step.* marking)
    no new spawn
  
  Step 5 (synth):
    author final spec.md / DESIGN.md / tuning.json draft
    transcript append:
      kind=artifact.created × 3
      kind=spec (final)
      kind=handoff.requested → engineering-lead
```

### D. CourtEval verifier protocol

```
Engineering Lead spawn → Step 3 (Verifier):
  
  Sub-step 1 (Grader):
    transcript: kind=step.judge, step=grader
    initial scores produced (D1-D6)
  
  Sub-step 2 (Critic):
    transcript: kind=step.judge, step=critic
    body: "score 4 too high because contrast 4.2:1 below threshold"
    
  Sub-step 3 (Defender):
    transcript: kind=step.judge, step=defender
    body: "actually contrast 4.5+ on 90% of palette, only 1 color at 4.2"
    
  Sub-step 4 (Re-grader):
    transcript: kind=step.judge, step=regrader
    final scores (incorporating Critic+Defender)
    
  Final:
    kind=judge.score (first-class)
      data: { D1, D2, ..., aggregate, verdict, feedback }
    kind=verify.result (legacy alias)
```

→ **Borrows CourtEval ACL 2025**. Sequential within 1 spawn, +30% tokens.

### E. Adaptive stopping (NeurIPS 2025 inspired)

```
Inside progress-ledger:
  score_history: [24.0, 23.8, 24.0, 24.1]   # last 4 rounds
  
reducer:
  if score variation across last 2 rounds < 1.0:
    next_speaker = "done"
    stop_reason = "score_stable"
    kind=audit, event=adaptive_stop_triggered

→ blocks the verifier polish infinite loop
→ aligns with NeurIPS 2025 multi-agent debate judge
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
  scoreHistory: number[]            // for adaptive stop
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

3 loop variants (same reducer, different dispatcher):
- `liveLoop()` — chokidar + setInterval + dispatchLive
- `replayLoop()` — read transcript + dispatchReplay (TUI only)
- `testLoop()` — synchronous, mock dispatcher

→ **state 100% derivable from transcript.jsonl alone** = replay/test/crash recovery all come for free.

---

## 5. Adapter Layer (Subprocess + user subscription)

### 3 adapters (Paperclip-inspired BYO pattern)

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
    proc.stdin.write(toMarkdown(req.sandwich))  // XML → Markdown conversion
    return parseStreamJson(proc.stdout)
  }
}
```

→ **OAuth handled by the CLI itself** (Claude Max + Codex Plus subscriptions).
→ **No dependency on CLAUDE.md / AGENTS.md auto-load** (stdin injection).

---

## 6. UI / Observability (3 surfaces)

### TUI (P0, blessed)

```
┌─ Crumb · cat-match-3 · turn 4/15 · standard preset ─────────┐
│                                                                │
│ ▶ TIMELINE (j/k scroll, Enter expand, Tab pane)               │
│ [00:00] 👤 user      goal       "cat match-3..."                │
│ [00:32] 🔵 planner-L step.socratic Q: colorblind-friendly palette? │
│ [00:40] 👤 user      answer.socratic "default OK, only colorblind-friendly"    │
│ [00:43] 🔵 planner-L step.concept mechanics defined                  │
│ [00:55] 🔵 planner-L step.research Royal Match pattern review        │
│ [01:10] 🔵 planner-L step.design color + UX                      │
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

### summary.html (P1, auto-generated, warm-paper)

At session end, `sessions/<id>/summary.html` is auto-generated. Inline transcript + iframe game.html + dimension scorecard + cost breakdown.

### Web observer (P2, opt-in)

`crumb observe sessions/<id>/` → localhost:8080 → SSE + iframe game preview.

---

## 7. Persistence Layout

```
sessions/<ulid>/
├── manifest.json                  session metadata
├── transcript.jsonl                ★ single SoT (28 kind, replay-deterministic)
├── ledgers/
│   ├── task.json                   accumulated facts (snapshot, transcript-derivable)
│   └── progress.json               per-turn (transcript-derivable)
├── audit/
│   └── <date>.jsonl                kind=audit only, separated (faster search)
├── inbox.txt                       headless user-intervention fallback
├── artifacts/                      4 deliverables (kind=artifact.created ref)
│   ├── game.html
│   ├── spec.md
│   ├── DESIGN.md
│   ├── tuning.json
│   └── screenshots/
├── agent-workspace/                per-actor sandbox cwd
│   ├── coordinator/
│   ├── planner-lead/
│   ├── engineering-lead/
│   └── builder-fallback/
└── summary.html                    P1 auto-generated
```

---

## 8. OTel GenAI alias (export ready)

```jsonc
// Crumb transcript: each message → OTel GenAI semantic conventions
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

→ `crumb export --format otel-jsonl` = ship anywhere — Datadog / Vertex / Phoenix / Langfuse.

---

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-frontier-rationale-5-claims]] — 5 frontier claim breakdown
- [[bagelcode-orchestration-topology]] — Hub-Ledger-Spoke decision
- [[bagelcode-transcripts-schema]] — schema 1st-pass spec
- [[bagelcode-rubric-scoring]] — D1-D5 anti-deception
- [[bagelcode-fault-tolerance-design]] — F1-F5 mitigation
- [[bagelcode-observability-frontier-2026]] — OTel GenAI standard
- [[bagelcode-tradingagents-paper]] — academic backing
