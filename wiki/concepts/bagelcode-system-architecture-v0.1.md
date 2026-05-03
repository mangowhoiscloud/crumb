---
title: Crumb System Architecture v0.1 — Multi-host × (harness × provider × model) tuple + 3-layer scoring
category: concepts
tags: [bagelcode, crumb, system-architecture, v0.1, multi-host, harness-tuple, ambient-fallback, scoring, studio, observability, frontier-convergence, 2026]
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
  - "Kiki studio pattern (~/workspace/Kiki/app/studio)"
summary: >-
  Crumb's v0.1 canonical system architecture. Multi-host 4-entry (Claude Code + Codex CLI + Gemini CLI + headless),
  (harness × provider × model) 3-tuple actor binding, ambient harness fallback, 3-layer scoring (reducer +
  qa_check effect + verifier CourtEval), static dashboard, natural-language helpers. Replaces v2 ([[bagelcode-system-architecture]]).
provenance:
  extracted: 0.40
  inferred: 0.50
  ambiguous: 0.10
created: 2026-05-02
updated: 2026-05-02
---

# Crumb System Architecture v0.1 — Multi-host × (harness × provider × model)

> **Canonical synthesis lock.** This page replaces v2 ([[bagelcode-system-architecture]] §1-§2 diagrams). v2's §3-§9 (38-kind schema core, prompt assembly procedure) are absorbed into §3-§4 of this page and corrected to 40 kinds (v0.1 adds qa.result, meta count corrected from 6 → 7). On top of [[bagelcode-host-harness-decision]]'s Hybrid lock, this page adds (a) Multi-host 3 entries, (b) 3-tuple actor binding, (c) ambient fallback, and (d) 3-layer scoring.

---

## 0. One-line identity

```
agent (persona) ⊕ skill (procedural) ⊕ effect (deterministic) ⊕ adapter (provider) ⊕ preset (BYO)
   ↑              ↑                      ↑                       ↑                    ↑
gamestudio 12  superpowers 14         AutoGen Executor         Paperclip BYO    Paperclip routine
  (193 ⭐)        (176k ⭐)              (57.6k ⭐)               (61.4k ⭐)            (61.4k ⭐)
```

**Crumb v0.1** = a synthesis of 4 frontiers (gamestudio + superpowers + AutoGen + Paperclip) × 4 CLI convergence (2026-04 Claude Code/Codex/Gemini/OpenCode) × 1:1 verbatim mapping to the recruiter mail. Self-invented portion < 10%.

---

## 1. 5-layer overview

```
┌─────────────────────────────────────────────────────────────────────┐
│ L1 USER natural-language I/O                                          │
│   "build me a 60-second match-3 combo"  "this part differently"  "/crumb pause"        │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────┐
│ L2 HOST HARNESS (entry 4 path) — works regardless of evaluator env    │
│   .claude/skills/crumb/SKILL.md     (Claude Code)                   │
│   .codex/agents/crumb.toml           (Codex CLI)                    │
│   .gemini/extensions/crumb/          (Gemini CLI)                   │
│   src/cli.ts run|replay|event|...    (headless / CI)                │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────┐
│ L3 ACTORS (persona sandwich.md)                                       │
│   coordinator / planner-lead / builder / verifier / builder-fallback│
│   + 3 specialists (inline planner-lead internal steps)              │
│   + 5 skills (procedural workflow inline-read, borrowed from superpowers)│
└─────────────────────────────┬───────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────┐
│ L4 ADAPTERS — (harness × provider × model) 3-tuple resolve           │
│   harness ∈ {claude-code, codex, gemini-cli, mock, *-sdk}            │
│   provider ∈ {anthropic, openai, google, none}                       │
│   model ∈ {claude-sonnet-4-6, gpt-5.5-codex, gemini-2.5-pro, ...}    │
│   ambient fallback: when unspecified, follow the entry host          │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────┐
│ L5 CONTROL PLANE (own light layer, src/)                              │
│   transcript.jsonl (40 kind × 11 field, append-only, ULID)          │
│      → reducer (pure)                                                │
│      → effects [spawn, qa_check, append, hook, done]                │
│      → dispatcher (live / replay / test 3 variants)                 │
│   replay-deterministic, independent of ToS/OAuth                    │
└─────────────────────────────────────────────────────────────────────┘
```

→ **L5 is the essence of the freedom.** L1-L4 are the swappable host/provider layers; L5 is independent of those.

---

## 2. Entry 4 paths (Multi-host)

### 2.1 Claude Code entry (`.claude/skills/crumb/SKILL.md`)

```yaml
---
name: crumb
description: |
  Multi-agent collaboration tool for the Bagelcode new-game team (an environment that uses Claude Code + Codex + Gemini CLI together).
  Produces mobile casual game prototypes from natural language. /crumb <natural-language goal>.
when_to_use: Game-creation requests, multi-agent collaboration demos, or /crumb invocation
allowed-tools: Bash Task Read Write Edit Glob Grep
argument-hint: <natural-language game goal>
---

# Crumb Coordinator

User invoked `/crumb $ARGUMENTS`.

## Setup
1. Bash: `crumb event session.start --goal "$ARGUMENTS" --preset bagelcode-cross-3way`
2. ambient = "claude-code" (entry auto-determined)
3. Read sandwich body: `agents/coordinator.md`
4. Tail transcript at `$CRUMB_TRANSCRIPT_PATH`

[full coordinator sandwich body inline reference]
```

### 2.2 Codex CLI entry (`.codex/agents/crumb.toml`)

```toml
name = "crumb"
description = "Bagelcode new-game team multi-agent collaboration tool (Claude Code + Codex + Gemini CLI 3 actor)"

developer_instructions = """
You are the Crumb Coordinator invoked from Codex CLI.

[full coordinator sandwich body, Markdown variant]

Setup:
1. shell: `crumb event session.start --goal "<user_goal>" --preset bagelcode-cross-3way`
2. ambient = "codex"
3. spawn next actor via crumb event handoff
4. tail transcript at $CRUMB_TRANSCRIPT_PATH
"""

# model unspecified → follow ambient (codex CLI session model)
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
description = "/crumb <goal> — multi-agent game prototype"

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
$ npx tsx src/index.ts replay sessions/<id>                    # deterministic re-derivation
$ npx tsx src/index.ts event session.start --goal "..."        # called by subagent
$ npx tsx src/index.ts ls                                       # session list
$ npx tsx src/index.ts doctor                                   # environment diagnostics
```

→ **4 entries, 1 control plane, 1 transcript schema.** The coordinator sandwich body lives in one place — `agents/coordinator.md` (DRY) — and each entry wrapper references it. ^[extracted]

---

## 3. Schema — 40 kind × 11 field × 8 from × 12 step

### 3.1 11 fields (no change)

```typescript
type Message = {
  // identification (4)
  id:               ULID
  ts:               ISO-8601
  session_id:       string
  task_id?:         string

  // routing (4)
  from:             ActorId       // 8 enum
  to?:              ActorId | "*"
  parent_event_id?: ULID
  in_reply_to?:     ULID          // deprecated alias

  // classification (3)
  kind:             MessageKind   // 39 enum
  topic?:           string
  step?:            SpecialistStep // 12 enum
}

// body options (per-kind schema)
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

### 3.2 from enum (8 values, v2 → v0.1 change)

```
─── v2 (7) ──────────────────────────
  user / coordinator / planner-lead / engineering-lead / builder-fallback /
  validator / system

─── v0.1 (8) ★ ─────────────────────────
  user / coordinator / planner-lead / builder / verifier / builder-fallback /
  validator / system
                           ★ engineering-lead removed, builder + verifier added
```

### 3.3 40-kind vocabulary (v2 38 → v0.1 40, +qa.result, meta count corrected)

```
─── system (4) ──────────────────────
  session.start / session.end / agent.wake / agent.stop

─── workflow (11) ★ +1 ─────────────
  goal
  question.socratic / answer.socratic
  spec / spec.update
  build
  qa.result          ★ new — emitted by dispatcher, deterministic ground truth (the kind=qa.result schema is in §3.5)
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

### 3.4 12 step enum (no change)

```
socratic / concept / research / design   ← Planner Lead
builder / qa / verifier                   ← (qa step name preserved, but emit source = effect)
grader / critic / defender / regrader     ← CourtEval inside Verifier
synth                                      ← Lead final
```

### 3.5 `kind=qa.result` schema (new)

```typescript
{
  kind: "qa.result",
  from: "system",                          // emitted by dispatcher
  parent_event_id: <build msg id>,         // causal chain with build
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

### 3.6 `kind=judge.score` schema (extended, source-of-truth matrix)

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
    audit_violations: []                   // anti-deception pass/fail
  },
  metadata: {
    verifier_harness:  "gemini-cli",
    verifier_model:    "gemini-2.5-pro",
    builder_harness:   "codex",
    builder_model:     "gpt-5.5-codex",
    cross_provider:    true                // ★ self-bias avoidance signal
  }
}
```

→ From a single judge.score event the evaluator can confirm **the source-of-truth per dimension + cross-provider verification + audit results** all at once. ^[inferred]

---

## 4. Communication Protocol — Envelope + Handoff

### 4.1 Envelope (system prompt the actor receives at each spawn)

```xml
<crumb:envelope session="01J..." turn="4" task="task_main_game">

  <crumb:contract>
    <input-kinds>spec, spec.update, user.intervene, user.veto</input-kinds>
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

→ Per-adapter conversion: claude-code = XML, codex = Markdown ([[bagelcode-xml-frontier-2026]] §"Codex prefers Markdown"), gemini-cli = XML, mock = pass-through.

### 4.2 Handoff protocol (per-turn flow)

```
USER goal
   ▾
Coordinator (host inline)
   ▾ Task tool spawn (depth=1) OR codex subagent OR gemini extension MCP
PLANNER LEAD                                       (1 spawn, 5 inline steps)
   ▾ artifact: spec.md / DESIGN.md / tuning.json
   ▾ kind=spec + kind=handoff.requested
   ▾
Coordinator → reducer next_speaker = builder
   ▾ spawn (per-actor harness decided)
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

→ **Every hop is recorded as a transcript event.** An external observer can trace the full routing just by tailing fs.watch. ^[inferred]

---

## 5. Actor Binding — (harness × provider × model) 3-tuple

### 5.1 Resolve priority

```
1. Use preset.actors.<actor>.{harness, model} when explicit
2. Use preset.[defaults] block (when the preset itself defines defaults)
3. ambient (follow the entry host)
4. System fallback (claude-code + sonnet-4-6)
```

### 5.2 9-cell matrix (3 harness × 3 provider)

| harness↓ \ provider→ | anthropic | openai | google |
|---|---|---|---|
| **claude-code** | ✅ native (Claude Sonnet/Opus/Haiku) | ⚠ BYOK proxy (P1) | ⚠ BYOK proxy (P1) |
| **codex** | ⚠ BYOK proxy (P1) | ✅ native (GPT-5.5, GPT-5.5-codex) | ⚠ BYOK proxy (P1) |
| **gemini-cli** | ⚠ MCP relay (P1) | ⚠ MCP relay (P1) | ✅ native (Gemini 2.5 Pro/Flash) |

→ P0 = the 3 diagonal cells (native). P1+ = the 6 off-diagonal cells (BYOK proxy / MCP relay).

### 5.3 Per-entry ambient resolve table

| Entry | ambient harness | ambient model (default) |
|---|---|---|
| `/crumb` (Claude Code) | `claude-code` | `claude-sonnet-4-6` (or entry session model) |
| `codex run crumb` | `codex` | `gpt-5.5-codex` (or entry session model) |
| `/crumb` (Gemini CLI) | `gemini-cli` | `gemini-2.5-pro` (or entry session model) |
| `crumb run` headless | preset [defaults] OR `claude-code` + `sonnet-4-6` | same |

---

## 6. 4 presets — user picks, Crumb recommends

### 6.1 Recommended default (mail + company-targeted)

`bagelcode-cross-3way.toml`:

```toml
[meta]
name = "bagelcode-cross-3way"
description = "Targeted at the Bagelcode new-game team (Claude Code + Codex + Gemini CLI used together)"
recommended = true

# All actors: unspecified → follow ambient (entry host)
[actors.coordinator]      sandwich = "agents/coordinator.md"
[actors.planner-lead]     sandwich = "agents/planner-lead.md"
[actors.builder-fallback] sandwich = "agents/builder-fallback.md"

# Explicit — verbatim from the mail
[actors.builder]
sandwich = "agents/builder.md"
harness  = "codex"                  # ★ implementation = OpenAI
model    = "gpt-5.5-codex"

[actors.verifier]
sandwich = "agents/verifier.md"
harness  = "gemini-cli"             # ★ verification = Google (multimodal screenshot)
model    = "gemini-2.5-pro"

[effects]
qa_check = { tool = "qa-check-effect@v1", harness = "none" }   # LLM-independent
```

→ **Whichever entry the user comes in from, builder = Codex / verifier = Gemini cross-vendor is enforced.** The rest follows ambient = robust to whatever environment the evaluator has.

### 6.2 Other recommended options

```
solo.toml             — All actors follow ambient (Claude Max only evaluator)
sdk-enterprise.toml   — Anthropic + OpenAI + Google SDK directly (production-grade, API key)
mock.toml             — deterministic CI / fallback (no tools installed)
single-claude.toml    — All actors = claude-code (P1 candidate)
single-codex.toml     — All actors = codex (P1 candidate)
single-gemini.toml    — All actors = gemini-cli (P1 candidate)
bagelcode-tri-judge.toml — verifier 3 (Claude/GPT/Gemini) parallel, multi-judge consensus (P1)
```

→ **The user picks; Crumb only suggests.** README shape is "default = cross-3way, other options via `--preset`". ^[inferred]

---

## 7. Scoring — 3-layer separation

### 7.1 Layer separation

| Layer | Location | LLM call | Dimensions produced |
|---|---|---|---|
| **L1 Reducer auto** | `src/state/scorer.ts` | 0 | D3 auto, D4 convergence, D5 auto |
| **L2 qa_check effect** | `src/effects/qa-check.ts` (dispatcher emit) | 0 | D2 exec, D6 portability |
| **L3 Verifier CourtEval** | verifier sandwich inline 4 sub-step | 1 spawn | D1 spec_fit, D3 semantic, D5 quality, aggregate, verdict |

### 7.2 D1-D6 source-of-truth matrix

| Dimension | Source | LLM | Verifier override |
|---|---|---|---|
| D1 spec_fit | verifier (LLM) | ✅ | yes (primary output) |
| D2 exec | qa_check effect | ❌ | ❌ change forbidden |
| D3 observability | reducer auto + verifier semantic (hybrid) | ✅ (semantic only) | semantic portion only |
| D4 convergence | reducer auto | ❌ | ❌ |
| D5 intervention | reducer auto + verifier quality (hybrid) | ✅ (quality only) | quality portion only |
| D6 portability | qa_check effect | ❌ | ❌ |
| aggregate | verifier (LLM) | ✅ | (final) |

### 7.3 5 anti-deception rules

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

→ **Deterministic ground truth (D2/D4/D6) cannot be overridden by the verifier.** Self-bias risk is surfaced (cuts off the NeurIPS 2024 self-recognition → self-preference linear correlation). See [[bagelcode-llm-judge-frontier-2026]] §R3-R5.

---

## 8. Routing — fault-point matrix

### 8.1 Routing rules (`agents/coordinator.md` + `src/reducer/`)

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

### 8.2 7 routing fault points (F1-F7)

| # | Fault | Cause | Detection | Recovery |
|---|---|---|---|---|
| F1 | adapter spawn fail | CLI not found / OAuth missing | adapter.ping() / spawn ENOENT | builder-fallback OR mock |
| F2 | subprocess timeout | LLM unresponsive / sandbox lock | dispatcher idle-timeout (5s default) | SIGINT + handoff.rollback |
| F3 | schema validation fail | sandwich emits wrong kind | ajv reject in `src/protocol/validator` | error event + retry once |
| F4 | qa.result missing | dispatcher fails after builder build | reducer guarantees build → qa_check effect, fallback timeout | re-spawn qa_check OR audit |
| F5 | self-bias / inflation | verifier provider == builder provider | metadata.cross_provider=false detected | warn + audit_violations |
| F6 | infinite loop | spec.update / build repeats | scoreHistory variance + spec_count threshold | adaptive_stop OR user hook |
| F7 | env not inherited | subagent cannot read CRUMB_TRANSCRIPT_PATH | crumb event call fails | dispatcher enforces explicit declaration in sandwich |

→ All 7 fault points are recorded as transcript events + the reducer enforces recovery rules. [[bagelcode-fault-tolerance-design]] §F1-F5 → extended to §8.2 of this page.

---

## 9. Event Bus — single transcript.jsonl

### 9.1 Single bus principle

```
All events in one place: sessions/<ulid>/transcript.jsonl
  ↓
producers: actor (subagent), dispatcher (effect), validator, system
consumers: reducer, observer, studio, replay, OTel exporter
```

→ **No separate message broker (no Kafka/Redis/NATS).** fs append-only + ULID ordering + ajv validation are sufficient. The crux of [[bagelcode-paperclip-vs-alternatives]] §"in-house implementation".

### 9.2 Per-producer emit pattern

| Producer | how | examples |
|---|---|---|
| **subagent (actor)** | Bash: `crumb event <<JSON ... JSON` | kind=spec, build, judge.score, step.* |
| **dispatcher (effect)** | direct TranscriptWriter.append() | kind=qa.result, kind=tool.{call,result} |
| **reducer** | effect → append_transcript | kind=audit, kind=ack |
| **validator** | reject → error event | kind=error |
| **user (CLI/host)** | crumb event OR `inbox.txt` write | kind=user.{intervene,pause,...} |

### 9.3 Per-consumer subscribe pattern

| Consumer | how | latency |
|---|---|---|
| **reducer (live)** | chokidar fs.watch + tail | ~10ms |
| **reducer (replay)** | fs.readFile + parse | one-shot |
| **observer (web)** | SSE wrapping fs.watch | ~50ms |
| **studio (static)** | summary.html post-session OR live polling | snapshot OR ~1s |
| **OTel exporter** | `crumb export --format otel-jsonl` | post-session |

→ **single-writer / multi-reader model.** TranscriptWriter serializes via a Promise chain = no races. ^[inferred]

---

## 10. Observability — borrowed from the Kiki pattern

### 10.1 4 surfaces

| Surface | Location | Static/Dynamic | Evaluator cost |
|---|---|---|---|
| **TUI (P0)** | `src/tui/` blessed | live | 0 (inside the host) |
| **summary.html (P0)** | `sessions/<id>/summary.html` (auto post-session) | static | 0 (double-click) |
| **live web observer (P1)** | `crumb observe sessions/<id>` → localhost:8080 | live SSE | 0 (local) |
| **diagram-dashboard (P1)** | Excalidraw-style visualization (borrowed from Kiki `app/diagram-dashboard/` — external asset) | static (vite build) | 0 |

### 10.2 Kiki borrowing map (see `~/workspace/Kiki/app/studio`)

| Kiki studio | Crumb mapping |
|---|---|
| `agent-activity-dashboard.html` (single HTML, fs/SSE-based transcript live tail) | `sessions/<id>/live-activity.html` (transcript fs.watch + colored timeline) |
| `token-dashboard.html` (cost/cache real-time) | `sessions/<id>/token-dashboard.html` (per-actor cost + cache hit ratio + budget guardrails visualization) |
| `index.html` (hub) | `sessions/<id>/summary.html` (4 deliverables + 40-kind summary + judge.score chart) |
| `cors-proxy.mjs` (single mjs proxy) | `crumb observe` (single SSE proxy) |
| `diagram-dashboard/` (Vite + React + Hono + Excalidraw) | `crumb diagram` (P1 — actor handoff DAG via Excalidraw) |

→ Same principle as Kiki: **static HTML + no DB + no server (only one cors-proxy mjs)**. Views over transcript.jsonl only, no DB.

### 10.3 OTel GenAI alias (export-ready)

Aligned with [[bagelcode-observability-frontier-2026]]'s OpenTelemetry GenAI Semantic Conventions:

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

→ `crumb export --format otel-jsonl` = into Datadog / Vertex / Phoenix / Langfuse, anywhere.

---

## 11. User Intervention Surface — 4 host × 5 event

### 11.1 5 user events

```
kind=user.intervene   → general intervention (affects spec/build of the next turn)
kind=user.veto         → reject a specific message (instructionOverride applied)
kind=user.approve      → explicit approval (PARTIAL → done permitted)
kind=user.pause        → global pause (next spawn blocked)
kind=user.resume       → release pause
```

### 11.2 4 host × 5 event matrix

| Host | intervene | veto | approve | pause | resume |
|---|---|---|---|---|---|
| Claude Code | message itself | `/crumb veto <id>` | `/crumb approve` | `/crumb pause` | `/crumb resume` |
| Codex CLI | message itself | `codex hook veto <id>` | `codex hook approve` | `codex pause` (native) | `codex resume` |
| Gemini CLI | message itself | extension command | extension command | extension command | extension command |
| headless | `inbox.txt write` | `crumb event user.veto` | `crumb event user.approve` | `crumb event user.pause` | `crumb event user.resume` |

→ All unified under the transcript `kind=user.{intervene,veto,approve,pause,resume}`. Same surface regardless of host.

---

## 12. Natural-language helpers — 5 `/crumb` subcommands

### 12.1 5 helper commands

```
/crumb config <natural language>     → preset selection recommendation ("Codex fast and lightweight" → solo or single-codex)
/crumb status               → current progress (last 10 events, current actor, scoreHistory)
/crumb explain <kind>       → schema vocabulary explanation (e.g. "explain judge.score" → prints D1-D6 matrix)
/crumb suggest              → next-step recommendation (suggests user veto/approve/redo on stuck_count)
/crumb debug                → routing fault diagnosis (maps to F1-F7 matrix, suspected items + evidence)
```

Each helper is itself a **natural-language response → JSONL record**. Emitted to the transcript as `kind=note` (no routing, observation only).

### 12.2 Implementation location

In `agents/coordinator.md`'s routing-rules, add helper branches:

```
After /crumb config <text> → coordinator inline reasoning
                              → kind=note (preset suggestion + rationale)
                              → user picks the preset themselves (Crumb only suggests, never forces)
After /crumb status         → coordinator → reducer.summarize() → kind=note
After /crumb explain <k>    → coordinator → schema lookup → kind=note
After /crumb suggest        → coordinator → reducer.suggest() → kind=note
After /crumb debug          → coordinator → fault-detector → kind=note
```

→ The user manipulates the system via natural language. **Crumb suggests + the user retains the choice.** No forced branching.

---

## 13. Change impact (v2 → v0.1)

| Item | v2 | v0.1 |
|---|---|---|
| Entry count | 1 (Claude Code) + headless | **3 first-class + headless = 4** |
| Actor count | 4 external + 7 internal | **5 external + 3 specialists + 5 skills** |
| Actor binding | provider 1-string | **(harness × provider × model) 3-tuple + ambient fallback** |
| Schema kinds | 38 | **39 (+qa.result)** |
| from enum | 7 | **8 (engineering-lead → builder + verifier)** |
| Scoring location | verifier inline 4 sub-step | **3-layer separation (reducer + qa_check + verifier CourtEval)** |
| Anti-deception rules | 1 (D2 demotion) | **5 (+self-bias, inflation, ground-truth override blocking)** |
| Preset count | 0 (mode flag) | **4 P0 + 3 P1 candidates** |
| Natural-language helpers | none | **5 helpers (`/crumb config|status|explain|suggest|debug`)** |
| Dashboard | summary.html plan | **4 surfaces (TUI + summary + live observer + diagram, borrowed from Kiki)** |
| User intervention surface | 1 host | **4 host × 5 event matrix** |
| MCP server exposure | P2 candidate | **P0 (Gemini extension dependency)** |
| Self-invented portion | < 15% | **< 10%** (4 CLI convergence + 3-layer scoring as additional synthesis) |

---

## 14. See also

- ★ **[[bagelcode-system-architecture-v0.4]]** — v0.4 incremental layer (Rule 7 / numerical R4 / judge-input bundle / fallback audit)
- ★ **[[bagelcode-system-diagrams-v0.4]]** — 6 Mermaid (spawn / score / anti-deception / judge-input / routing / preset)
- [[bagelcode]] / [[bagelcode-task-direction]] / [[bagelcode-recruitment-task]] — verbatim from mail
- [[bagelcode-host-harness-decision]] — Hybrid lock (pre-v0.1)
- [[bagelcode-system-architecture]] — v2 (this page replaces its §1-§2 diagrams)
- [[bagelcode-frontier-cli-convergence-2026]] — 4 CLI convergence primary source ★ new
- [[bagelcode-llm-judge-frontier-2026]] — CourtEval / G-Eval / bias 6-source ★ new
- [[bagelcode-gamestudio-subagents-2026]] — 12 personas → 5+3 mapping
- [[bagelcode-paperclip-vs-alternatives]] — BYO + heartbeat = effect pattern
- [[bagelcode-frontier-orchestration-2026]] — Anthropic + Cognition + Magentic-One + AutoGen + LangGraph
- [[bagelcode-verifier-isolation-matrix]] — cross-provider C2 backbone (CP-WBFT / MAR / Lanham 0.32→0.89)
- [[bagelcode-rubric-scoring]] — D1-D6 primary spec (extended to 3 layers in §7 of this page)
- [[bagelcode-fault-tolerance-design]] — F1-F5 (F6-F7 added in §8.2 of this page)
- [[bagelcode-observability-frontier-2026]] — OTel GenAI alias
- [[bagelcode-xml-frontier-2026]] — per-adapter envelope format (XML / Markdown)
- [[bagelcode-budget-guardrails]] — token budget + cost studio
- `~/workspace/Kiki/app/studio/` — static HTML hub pattern (reference asset)
- `agents/coordinator.md` / `agents/{builder,verifier,planner-lead,builder-fallback}.md` — sandwich body primary source
