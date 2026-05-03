---
title: Bagelcode Task — Crumb System Architecture + Prompt Assemble Procedure (Hybrid Lock)
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
  v2 system architecture immediately after the Hybrid lock — external 1 host (Claude Code) + Task subagents N + Verifier inline.
  §1-§2 topology is superseded as canonical by v0.1 (system-architecture-v0.1); §3-§9 remain valid in v0.1.
provenance:
  extracted: 0.65
  inferred: 0.30
  ambiguous: 0.05
created: 2026-05-02
updated: 2026-05-02
---

# Crumb System Architecture + Prompt Assemble Procedure (v2)

> ★ **2026-05-02 supersession** — §1-§2 of this page (topology + 38 kinds) is superseded by [[bagelcode-system-architecture-v0.1]]. v0.1 change summary: external 1 host → Multi-host 4 entry, Engineering Lead inline → builder + verifier actor split, 38 kinds → 39 kinds (+`qa.result`), single-layer Verifier → 3-layer scoring (reducer auto + qa_check effect + verifier CourtEval), MCP Provider added, persistence boost (`crumb resume`) added. §3 (5-step prompt assemble) / §4 (per-turn flow) / §5 (cache boundary) / §6 (control plane vs LLM layer responsibility split) / §7 (default vs cross-provider) / §8 (headless) / §9 (sub-system change impact) of this page remain valid unchanged in v0.1 — only the actor enum / kind count / metadata fields need to be updated to v0.1 baseline.
>
> The **v2 system architecture** following [[bagelcode-host-harness-decision]] (Hybrid lock). Overall overview diagram + transcript schema (38 kind baseline at v2) + sandwich/envelope assemble procedure + per-turn flow.
>
> The "external 4 / internal 7" diagram in [[bagelcode-final-design-2026]] §1 is replaced by this page. final-design §2-§8 (transcript schema / state machine / adapter / OTel) remain valid unchanged.

---

## 0. One-line summary

```
USER (natural language)
   ▾
Claude Code (host harness = Coordinator role)              ← LLM layer
   ▾  Task tool spawn (depth=1)
specialist subagents (Planner Lead / Engineering Lead / sub-specialists)
   ▾  envelope injection (XML system prompt) + crumb event call
transcript.jsonl  (38 kind × 11 field, append-only, ULID sorted)        ← Control plane
   ▾
reducer (pure) → state → effects → dispatcher                          ← Control plane
   ▾  spawn / append / persist / hook / done

cross-provider opt-in:
   Engineering Lead = subprocess spawn codex-local CLI (adds external actor)
   Verifier         = host Claude Code Task subagent (different sandwich, cross-assemble)
```

3-layer separation:
- **Natural language interface** = Claude Code (host)
- **Natural language → backend routing** = `.claude/skills/crumb/SKILL.md` + `agents/*.md` sandwich
- **Orchestration control plane** = `src/{transcript, reducer, state, validator, adapter, dispatcher, loop}/`

---

## 1. Overall overview — Default mode (single provider)

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

## 2. Overall overview — Cross-provider mode (`--cross-provider`)

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

→ External processes go from **1 → 2 added**. Internal subagent depth is the same.

---

## 3. Schema — actual code baseline (38 kind × 11 field)

Excerpt from `src/protocol/schemas/message.schema.json`.

### 11 fields

```typescript
type Message = {
  // identification (4)
  id:               ULID                  // 26-char Crockford base32
  ts:               ISO-8601              // UTC
  session_id:       string
  task_id?:         string                // multi-task within a session

  // routing (4)
  from:             ActorId               // user / coordinator / planner-lead /
                                          // engineering-lead / builder-fallback /
                                          // validator / system   (7 total)
  to?:              ActorId | "*"
  parent_event_id?: ULID
  in_reply_to?:     ULID                  // deprecated alias

  // classification (3)
  kind:             MessageKind           // 38 (below)
  topic?:           string
  step?:            SpecialistStep        // 12 (below)
}

// body (optional — schema determined per kind)
body?:           string                   // free text
data?:           Record<string, unknown>  // structured payload (per-kind schema)
content?:        { format: 'markdown'|'json'|'text'|'xml', text: string }
artifacts?:      ArtifactRef[]
scores?:         { D1..D6, aggregate, verdict }
ack_required?:   boolean
blocking?:       boolean
metadata?:       { visibility, model, turn, tokens_in/out, cache_read/write,
                   latency_ms, cost_usd, thinking_tokens, audit_violations }
```

### 38 kinds (actual schema enum)

```
─── system (4) ─────────────────────────
session.start          session start + manifest
session.end            session end
agent.wake             actor spawn command
agent.stop             actor stop

─── workflow (10) ──────────────────────
goal                   user top-level request
question.socratic      Planner Lead → user ambiguity question
answer.socratic        user response
spec                   Planner Lead output (AC + rulebook)
spec.update            spec edit
build                  Engineering Lead code output
verify.request         verification request
verify.result          verification result (legacy alias of judge.score)
judge.score            ★ first-class scorecard (D1-D6 + aggregate + verdict)
done                   final output confirmed

─── dialogue (5) ──────────────────────
agent.thought_summary  private CoT (no cache, summary only)
question               general question (Lead → User or cross-Lead)
answer                 response
debate                 multi-party debate entry (CourtEval internal)
note                   free-form comment (no routing)

─── lead-internal step (5) ──────────
step.socratic          Planner Lead step entry marker
step.concept
step.research
step.design
step.judge             Verifier's grader/critic/defender/regrader

─── user intervention (5) ─────────────
user.intervene         general intervention
user.veto              reject specific message
user.approve           explicit approval
user.pause             global pause
user.resume            global resume

─── handoff (3) ────────────────────────
handoff.requested      Lead → Lead explicit
handoff.accepted       coordinator's ack
handoff.rollback       verify FAIL → revert to planner-lead

─── artifact / meta (6) ──────────────
artifact.created       artifact ref (path + sha256)
ack                    receipt confirmation
error                  error report
audit                  audit (auto)
tool.call              ★ subagent's tool call trace
tool.result            ★ tool result trace
hook                   coordinator → user modal
```

→ **38 kinds**. (The "28 kinds" in final-design-2026 §2 is the pre-P0 count; the current schema is correct.)

### 12-step enum (sub-steps inside Lead)

```
socratic / concept / research / design   ← Planner Lead
builder / qa / verifier                   ← Engineering Lead
grader / critic / defender / regrader     ← inside Verifier (CourtEval)
synth                                      ← Lead final
```

### 7 from enum (actual actors)

```
user / coordinator / planner-lead / engineering-lead / builder-fallback /
validator / system
```

→ Specialists (concept-designer / researcher / qa etc.) don't have separate `from` values. Distinguished by the `step` field (the Lead actor emits, with `step` marking which sub-role).

---

## 4. Prompt Assemble Procedure — 5 steps

### Step 1 — sandwich load (static, cache 1h)

A 4-section sandwich per actor:

```
agents/coordinator.md          ← Coordinator (host inline)
agents/planner-lead.md          ← Planner Lead subagent
agents/engineering-lead.md     ← Engineering Lead subagent (or codex external)
agents/builder-fallback.md     ← Builder Fallback (when Codex dies)
agents/specialists/
  concept-designer.md           ← Planner's step.concept
  researcher.md                 ← Planner's step.research
  visual-designer.md            ← Planner's step.design
  qa.md                         ← Engineering's step.qa
  verifier.md                   ← Engineering's step.verifier (CourtEval 4 sub-step inline)
agents/_event-protocol.md       ← inline-appended by every sandwich (subagent's transcript-emit spec)
```

Inside each sandwich:

```xml
§1 <role>           Who you are and who you PATCH to
§2 <contract>       input-kinds / output-kinds / handoff-target
§3 <tools>          allowed tool set (Read/Write/Edit/Bash/Task etc.)
§4 <enforcement>    forbidden + required + STOP conditions
   <system-reminder> token budget + anti-deception rules
```

### Step 2 — envelope assemble (per-spawn, partially dynamic)

When the Coordinator spawns the next actor, it **synthesizes the system prompt as an XML envelope**:

```xml
<crumb:envelope session="01J9..." turn="4" task="task_main_game">
  
  <crumb:contract>           ← cites sandwich §2 contract
    <input-kinds>spec, spec.update, user.intervene</input-kinds>
    <output-kinds>build, artifact.created</output-kinds>
    <handoff-target>verifier</handoff-target>
  </crumb:contract>
  
  <crumb:task-ledger version="3">    ← state.task_ledger serialized
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

→ **Agent-friendly** (XML, machine-parseable) **+ kind-filtered** (no broadcast) **+ artifact ref only** (body 0).

### Step 3 — Injection path (per adapter)

| Adapter | Injection path | Format |
|---|---|---|
| **claude-local** | `--append-system-prompt @<envelope_file>` + `--add-dir <session_dir>` + `-p "<task instruction>"` | XML (sandwich + envelope) |
| **codex-local** | stdin (`proc.stdin.write(envelope)`) + `codex exec --cd <session_dir> --full-auto` | Markdown (Codex prefers Markdown over XML — see [[bagelcode-xml-frontier-2026]]) |
| **mock** | in-memory pass-through | XML |

4 env vars always propagated:

```
CRUMB_TRANSCRIPT_PATH = sessions/<ulid>/transcript.jsonl
CRUMB_SESSION_ID      = <ulid>
CRUMB_SESSION_DIR     = sessions/<ulid>/
CRUMB_ACTOR           = planner-lead | engineering-lead | ...
```

→ Subagents (Task tool / Codex subagent) auto-inherit parent env (Anthropic / Codex default behavior — verified via env propagation spike).

### Step 4 — Cache boundary ([[bagelcode-caching-strategy]] §"Cache breakpoint location")

```
[1] sandwich §1 contract       ──┐
[2] sandwich §2 stage template  │  STATIC 1h  ← Anthropic ephemeral cache_control: {ttl: "1h"}
[3] sandwich §3 tools/skills   │            (read 0.1×, write 1.25×, longest TTL first)
[4] sandwich §4 enforcement    ──┘            
                                              ★ cache breakpoint 1, 2 (max 4)
[5] envelope task-ledger       ──┐
[6] envelope relevant-messages   │ DYNAMIC 5m  ← cache_control: {ttl: "5m"} on stable prefix
                                 │           (when goal + initial spec are stable)
                                 │            ★ cache breakpoint 3 (optional)
[7] task instruction (-p)      ──┘ NO CACHE   (rolling, changes per turn)
```

Codex / Gemini auto prefix-cache (no separate marker) — putting the sandwich at the very front of the system prompt is automatic.

### Step 5 — Subagent's transcript emit

`agents/_event-protocol.md` (inline-appended by every sandwich):

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

`crumb event` (= `src/cli.ts cmdEvent`):
1. reads stdin JSON → parses `DraftMessage`
2. `TranscriptWriter.append(draft)` — auto-fills ULID + ISO ts
3. ajv validation (`message.schema.json`)
4. `O_APPEND` flush to `$CRUMB_TRANSCRIPT_PATH`
5. stdout `{"id": "...", "ts": "..."}` (subagent uses this as the next message's parent_event_id)

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

Natural-language user intervention (mid-turn):
```
User: "Make the combo bonus shorter."
   ▾ Claude Code receives
   ▾ crumb event kind=user.intervene, data={target: "tuning.json/combo_multipliers"}
   ▾ append → reduce → effect: spec.update routing (re-spawn Planner Lead)
```

---

## 6. Control plane vs LLM layer responsibility split

| Responsibility | LLM layer (Claude Code / Codex) | Control plane (own light layer) |
|---|---|---|
| Natural language understanding | ✅ host handles | ❌ |
| Natural language → action conversion | ✅ skill SKILL.md routing | ❌ |
| Reasoning (CoT, thinking) | ✅ provider model | ❌ |
| Code generation | ✅ Builder subagent | ❌ |
| Tool calls (Read/Write/Bash) | ✅ Claude Code/Codex default | ❌ |
| **Transcript schema enforcement** | ❌ | ✅ `protocol/schemas/*.json` + ajv |
| **Append-only / ULID sort** | ❌ | ✅ `src/transcript/writer.ts` (O_APPEND + flock) |
| **Reducer (state derivation)** | ❌ | ✅ `src/reducer/index.ts` (pure) |
| **Replay determinism** | ❌ | ✅ `crumb replay <session-dir>` |
| **Validator (anti-deception)** | ❌ | ✅ `src/validator/anti-deception.ts` |
| **Adapter abstraction** | ❌ | ✅ `src/adapters/{claude,codex,mock}-local.ts` |
| **Routing rules (next_speaker)** | ⚠ only declared in sandwich | ✅ enforced by reducer |
| **Stuck escalation** | ❌ | ✅ progress_ledger.stuck_count |
| **Adaptive stop** | ❌ | ✅ score_history variance < 1.0 |
| **OTel GenAI alias export** | ❌ | ✅ `crumb export --format otel-jsonl` |
| **Cross-provider guard** | ❌ | ✅ Builder.metadata.model.provider_family ≠ Verifier.metadata.model.provider_family |

→ **The essence of freedom = control plane.** Delegating only the LLM call layer to the host = team-fit + ToS-safe + freedom preserved.

---

## 7. Default vs Cross-provider comparison table

| Item | Default | `--cross-provider` |
|---|---|---|
| External process count | 1 (Claude Code) | 2 (Claude Code + Codex CLI) |
| Coordinator | Claude Code itself | Claude Code itself |
| Planner Lead | Claude Code Task subagent | Claude Code Task subagent |
| Engineering Lead | Claude Code Task subagent | **Codex CLI subprocess** |
| Verifier | Claude Code Task subagent (different sandwich) | **Claude Code Task subagent (cross-assemble)** |
| Builder Fallback | Claude Code | Claude Code |
| Evaluator auth burden | `claude login` once | `claude login` + `codex login` |
| Isolation effect (matrix C1) | different sandwich + different context (mitigates same-provider self-judge risk) | + different provider (full cross-assemble) |
| cross-provider matrix backing (C2) | partial | full (CP-WBFT + MAR + Lanham 0.32→0.89) |
| ToS | ✅ Claude Code OAuth | ✅ Claude Code OAuth + Codex Plus OAuth |
| transcript schema | identical | identical |
| reducer | identical | identical |
| metadata.model.provider_family difference | same (warn audit) | different (no warn) |

→ **Transcript / reducer / control plane 100% identical.** Only the LLM layer differs in topology.

---

## 8. Headless mode — `crumb run --goal "..."`

For evaluators / CI / non-interactive environments:

```bash
$ npx tsx src/index.ts run \
    --goal "60-second match-3 with combo bonus" \
    --adapter mock \                    # deterministic demo
    --idle-timeout 5000                  # 5s no response → done
$ jq -r '"\(.kind)\t\(.from)"' sessions/*/transcript.jsonl
$ npx tsx src/index.ts replay sessions/<id>     # reconstructs identical state
```

Even environments without the skill (no Claude Code installed) can demo via the mock adapter. With explicit `--adapter claude-local` or `codex-local`, real CLI subprocess runs (auth required).

---

## 9. Sub-system change impact (after host-harness decision)

| Sub-system | Change | Affected location |
|---|---|---|
| `protocol/schemas/*.json` | No change | — |
| `src/transcript/` | No change | — |
| `src/reducer/` | No change | — |
| `src/state/` | No change | — |
| `src/validator/` | + cross-provider guard (warn-only) | new `src/validator/cross-provider-guard.ts` |
| `src/adapters/` | No change (claude/codex/mock as-is) | — |
| `src/dispatcher/` | --cross-provider branch (engineering-lead = codex-local mapping) | small change |
| `src/loop/coordinator` | next_speaker update (verifier external-actor branch option) | small change |
| `src/cli.ts` | + `--cross-provider` flag | small change |
| `agents/coordinator.md` | remove Task tool forbidden | correction |
| `agents/{planner,engineering}-lead.md` | spell out Task tool spawn + update sequential-steps | correction |
| `agents/specialists/*.md` | new (concept-designer / researcher / visual-designer / qa / verifier) | 5 new |
| `.claude/skills/crumb/SKILL.md` | new (host activation entry) | new |
| `.crumb/config.toml` + presets | + `[verifier]` + cross-provider preset | correction + new |

---

## See also

- [[bagelcode]] / [[bagelcode-host-harness-decision]] — rationale for this architecture
- [[bagelcode-verifier-isolation-matrix]] — backing for the cross-provider opt-in decision
- [[bagelcode-transcripts-schema]] — schema first-pass spec (28 → 38 kind evolution)
- [[bagelcode-caching-strategy]] — cache boundary (the 1h/5m TTL in step 4)
- [[bagelcode-final-design-2026]] — §1 figure replaced by this page, §2-§8 valid
- [[bagelcode-fault-tolerance-design]] — F1-F5 (control plane's validator + circuit + stuck escalation)
- [[bagelcode-rubric-scoring]] — D1-D6 + 5 anti-deception rules
- [[bagelcode-paperclip-vs-alternatives]] — own light layer = control plane only, trimmed
- `src/protocol/schemas/message.schema.json` — actual source of the 38 kind enum
- `agents/_event-protocol.md` — subagent transcript emit spec
