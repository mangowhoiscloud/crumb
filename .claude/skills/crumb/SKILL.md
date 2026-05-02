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
allowed-tools: mcp__crumb__crumb_run mcp__crumb__crumb_intervene mcp__crumb__crumb_status mcp__crumb__crumb_suggest mcp__crumb__crumb_doctor mcp__crumb__crumb_config mcp__crumb__crumb_explain mcp__crumb__crumb_debug mcp__crumb__crumb_export mcp__crumb__crumb_model Bash Task Read Write Edit Glob Grep
argument-hint: <자연어 게임 goal — 예: "60초 매치-3 콤보 보너스">
when_to_use: >-
  Trigger when the user (a) pitches a casual game in natural Korean or English ("60초 매치-3 게임
  만들어줘", "make a swipe-to-merge clicker", "build a 30s tap defender", "캐주얼 퍼즐 하나 만들어봐")
  OR explicitly types `/crumb <pitch>`. ALSO trigger on follow-up phrases that reference an
  in-flight session: "지금 어디까지 갔어?", "진행 상황 알려줘", "이거 끝난 거야?", "다음에 뭐 하면
  돼?", "what's the status?", "is it done?", "what next?" — when the SessionStart hook surfaces an
  in-flight session, route these to `mcp__crumb__crumb_status` / `mcp__crumb__crumb_suggest`
  BEFORE spawning a new run. Also trigger on preset-intent phrases: "Codex 와 Gemini 도 같이" →
  recommend `bagelcode-cross-3way`; "키 없이 돌려봐" / "demo only" → recommend `mock`; "API key
  로 돌려" / "production" → recommend `sdk-enterprise`. Do NOT trigger on general code-review /
  debugging / library-Q&A / non-game tasks (3D, FPS, MMO, strategy with > 100 entities — Phaser
  single-file fit ❌). When in doubt, ask the user before activating.
---

# Crumb — Multi-Agent Game Prototyping Skill (v0.1)

Multi-agent collaboration tool for the Bagelcode new-IP team (mobile casual). One natural-language pitch and Planner Lead → Builder → qa_check effect → Verifier (CourtEval) collaborate to ship a Phaser 3.80 multi-file PWA under `artifacts/game/` plus `spec.md` + `DESIGN.md` + `tuning.json`.

> **3-layer separation** (`wiki/synthesis/bagelcode-host-harness-decision.md`):
> 1. NL interface = Claude Code (this skill's host) — top of the multi-host 4-entry list
> 2. NL → backend routing = this SKILL.md + `agents/*.md` sandwiches + 5 procedural skills (`skills/*.md`)
> 3. Orchestration control plane = `src/{transcript,reducer,validator,adapter,dispatcher,loop}/`
>
> **v0.1 highlights** (`wiki/concepts/bagelcode-system-architecture-v0.1.md`):
> - Engineering Lead → **builder + verifier actor split** (true cross-provider boundary)
> - `--cross-provider` flag → **`--preset <name>`** (named preset, BYO)
> - 38 kind → **39 kind** (+`qa.result` deterministic effect)
> - scores → **D1-D6 source-of-truth matrix** (reducer-auto / qa-check-effect / verifier-llm — single origin per dim; D3/D5 split into LLM + auto components combined deterministically in code)
> - Multi-host 4-entry (Claude Code / Codex CLI / Gemini CLI / headless) + ambient fallback
> - MCP Provider (cross-host fan-in) + auth-manager (`crumb doctor`) + persistence boost (`crumb resume`)

## When to trigger

NL trigger recognition:
- "**60초 매치-3 게임 만들어줘**", "**make a swipe-to-merge game**", "**build a 30s clicker**" — casual game pitches
- Explicit command: "**/crumb \<pitch\>**", "**crumb start \<pitch\>**"
- Preset intent: "Codex + Gemini 도 같이" → `bagelcode-cross-3way`, "키 없이 돌려봐" → `mock`, "API key 로 돌려" → `sdk-enterprise`
- **Mid-flight follow-up** (right after the SessionStart hook surfaces an in-flight session): "지금 어디까지 갔어?", "진행 상황", "이거 끝났어?", "what's the status?" → route to `mcp__crumb__crumb_status` + `mcp__crumb__crumb_suggest` instead of spawning a new session

Do NOT activate on:
- Code review / debugging / library questions
- Non-casual games (3D / FPS / MMO etc. — Phaser single-file fit ❌)
- Generic multi-agent system design discussion (refer to `wiki/` only)

## In-flight session branching

The Claude Code SessionStart hook (`.claude/hooks/session-start.cjs`) scans `~/.crumb/projects/<id>/sessions/*/meta.json` at startup and injects ULIDs + goals + last kinds for any session with `status ∈ {running, paused}` into the system context. When the user's utterance is ambiguous between a new game pitch and a follow-up:

1. Context has an in-flight ULID AND the user uses "진행" / "상황" / "어디까지" / "끝났어" / "next" vocabulary → respond with `mcp__crumb__crumb_status` + `mcp__crumb__crumb_suggest` (or guide the user to the `/crumb-watch <ulid>` slash command).
2. The user explicitly states a new game pitch → spawn a fresh `mcp__crumb__crumb_run` regardless of existing sessions (concurrent sessions are fine).
3. Otherwise, ask the user once.

Additionally, the Stop hook (`.claude/hooks/stop.cjs`) emits one line per turn: `[crumb] <ulid> · <last_kind> · agg=N verdict=X` into the system context — keeps progress visibility inline without requiring the user to ask.

## How to run

### 1. Extract pitch + preset

From the user's utterance:
- **goal** string — strip `/crumb` prefix, Korean particles, sentence-ending markers like "만들어줘".
- **preset** — only use what the user explicitly named. Otherwise ambient (follow the entry host; Crumb does NOT force a default).
  - Only when the user asks "어떤 preset 있어?" / "추천해줘" → run `crumb doctor` and show the preset list, then defer the choice.
  - When the user names a preset ("bagelcode-cross-3way", "mock", "sdk-enterprise" etc.) → pass it through verbatim.
  - When user intent ("키 없이 돌려봐") and an explicit name conflict, the explicit name wins.

→ Core principle: **provider × harness × model is the user's call.** Crumb is a helper, never a default-setter (Anthropic 2026-03 "wrong tradeoff" lesson).

### 2. Start a Crumb session — `mcp__crumb__crumb_run` (preferred)

```ts
mcp__crumb__crumb_run({
  goal: "<extracted goal>",
  preset: "<name>" /* optional — pass only when user named one */,
  // adapter / idle_timeout_ms / label are also optional
})
```

→ The MCP tool spawns `crumb run` as a detached subprocess and immediately returns `{ session_id, session_dir, log_path }`. The host CLI is never blocked. Report the session ULID to the user and announce the next step.

> **Bash fallback** — for environments where the MCP server is not active (use the installed `crumb` bin or `npx tsx`):
> ```bash
> crumb run --goal "$GOAL" ${PRESET:+--preset "$PRESET"}
> # Or, without npm link:
> npx tsx "$CLAUDE_PROJECT_DIR/src/index.ts" run --goal "$GOAL"
> ```
> Prefer `mcp__crumb__crumb_run` whenever possible — no permission prompt, one shot.

> **Environment doctor** — when the user asks "어떤 preset 가능?" or you suspect the environment is incomplete:
> ```bash
> npx tsx src/index.ts doctor
> ```
> Outputs 4 host entries × adapter health × installed/authenticated preset matrix. **The user picks** — Crumb only surfaces the runnable options.

### 3. Streaming the transcript

While the session runs, surface only meaningful events to the user:

```bash
tail -f sessions/<ulid>/transcript.jsonl | jq -r '
  select(.kind | IN("goal","question.socratic","spec","build","qa.result","judge.score","done","error","handoff.requested")) |
  "[\(.ts | split("T")[1] | split(".")[0])] \(.from)\t\(.kind)\t\(.body // (.data | tostring) | .[0:120])"
'
```

Skip these kinds: `ack`, `audit`, `tool.call`, `tool.result`, `agent.thought_summary`. Surface these: the 4 sub-steps of `step.judge` (grader/critic/defender/regrader) + `qa.result` (the v0.1 deterministic ground truth).

### 4. User natural-language intervention (mid-flight)

While the session runs, user intervention lands on the same transcript line regardless of which of the 5 surfaces is used — routing is source-agnostic (`agents/coordinator.md` Routing Rules).

**Preference order** (on top of Claude Code):
1. **`mcp__crumb__crumb_intervene` MCP tool** — direct call from NL. One permission prompt and done.
2. **Slash commands** — `/crumb-approve <ulid>`, `/crumb-veto <ulid> <reason>`, `/crumb-redo <ulid>`, `/crumb-pause <ulid> [@actor]`, `/crumb-resume <ulid> [@actor]`, `/crumb-watch <ulid>`, `/crumb-cancel <ulid>`. Each is a thin wrapper around the MCP tool above.
3. Append directly to `inbox.txt` (headless / other host).
4. `crumb event` CLI — direct JSON event input (low-level).
5. `crumb tui` slash bar (only when the user has a separate terminal open).

#### Surface 1 — `mcp__crumb__crumb_intervene` (Claude Code preferred)

```ts
mcp__crumb__crumb_intervene({
  session: "<ulid>",
  action: "approve" | "veto" | "pause" | "resume" | "redo" | "goto" | "append" | "note" | "reset_circuit" | "swap" | "free",
  body?: "<reason or free text>",
  target_actor?: "builder" | "verifier" | ...,
  swap_to?: "<adapter>" /* required only when action=swap */,
})
```

→ Internally appends one line to `sessions/<ulid>/inbox.txt`. The watcher (500 ms tick) parses it into a transcript event. Grammar matches `src/inbox/parser.ts`.

#### Surface 2 — `inbox.txt` (other hosts / fallback)

```bash
SESSION_ID="<active ulid>"
echo "@builder use red/green palette only" >> sessions/$SESSION_ID/inbox.txt
```

The 500 ms watcher parses each line and appends it to the transcript. This skill should map natural-language user input like "빌더한테 빨강/초록만 쓰라고 해" into the slash-bar grammar above and append to the inbox.

#### Surface 3 — TUI slash bar (only when the user has `crumb tui` open)

```
/approve            /veto <id>          /pause [@<a>] [reason]
/resume [@<a>]      /goto <a> [body]    /swap <from>=<adapter>
/reset-circuit <a|all>                  /append [@<a>] <text>
/note <text>        /redo [body]        /q  /quit
@<a> <body>         (free text mention)
```

The TUI and `inbox.txt` share one grammar (`src/inbox/parser.ts`). Bidirectional muscle-memory compatible.

#### Surface 4 — JSON event directly (low-level)

```bash
SESSION_ID="<active ulid>"
echo '{"from":"user","kind":"user.intervene","body":"<original text>","data":{"target_actor":"builder","sandwich_append":"phaser 3.80 only"}}' \
  | CRUMB_TRANSCRIPT_PATH="sessions/$SESSION_ID/transcript.jsonl" \
    CRUMB_SESSION_ID="$SESSION_ID" \
    CRUMB_SESSION_DIR="sessions/$SESSION_ID" \
    crumb event
```

#### `data` field semantics (shared by all 5 user.* events)

| `data.<key>` | Effect (reducer handling) |
|---|---|
| `target_actor: <actor>` | Fact tagged `@<actor>` — surfaced in the next `<actor>` spawn's sandwich (no routing change). |
| `goto: <actor>` | `next_speaker = <actor>` forced + immediate spawn (LangGraph `Command(goto)`). |
| `swap: { from: <a>, to: <adapter> }` | `progress_ledger.adapter_override[a] = <adapter>` (Paperclip BYO swap). |
| `reset_circuit: <a> \| true` | Clears `circuit_breaker[<a>]` (or all when `true`). |
| `sandwich_append: <text>` | Adds a fact with `category='sandwich_append'` — the dispatcher concatenates it onto every subsequent matching spawn's system prompt (v0.2.0 G4). |
| `actor: <actor>` (only on `user.pause` / `user.resume`) | Pause/resume that single actor instead of the whole session. |

> **Frontier mapping**: LangGraph `Command(goto/update={...})` 53/60 + Paperclip BYO swap 38/60 + Codex `APPEND_SYSTEM.md` 38/60. Background: `wiki/synthesis/bagelcode-user-intervention-frontier-2026-05-02.md`.

The reducer applies it and updates `progress.next_speaker` (typically falls back to planner-lead and emits `spec.update`; if `data.goto` is set, jumps directly to the named actor).

### 5. Surface the result

When `kind=done` arrives:

```
✅ session complete — sessions/<ulid>/
   ▸ artifacts/game/         (multi-file PWA — open game/index.html)
   ▸ artifacts/spec.md       (acceptance criteria + rule book)
   ▸ artifacts/DESIGN.md     (color / mechanics / motion)
   ▸ artifacts/tuning.json   (balance numbers)
   ▸ transcript.jsonl        (replay-deterministic, 40 kind × 11 field × 8 from)
   ▸ judge.score (D1-D6)     (source-of-truth matrix: reducer-auto / qa-check-effect / verifier-llm)
```

If the user says "열어줘" / "play":
```bash
open sessions/<ulid>/artifacts/game/index.html
```

### 6. Resume after an interrupt (v0.1 persistence boost)

If the session is Ctrl-C'd or crashes mid-run:
```bash
npx tsx src/index.ts resume <session-id>
```
Reads the adapter-native session id (Claude Code `--resume` / Codex `--thread`) from `metadata` and restores host-harness state, preserving `cache_carry_over`.

## Preset options (user choice, Crumb only recommends)

`provider × harness × model` is the user's call. Crumb only surfaces what `crumb doctor` says is runnable; it does not force a default.

| Preset | Composition | Install / auth required | Use case |
|---|---|---|---|
| **(no preset)** ambient | Follows the entry host (e.g. claude-code + claude-opus-4-7) — Crumb does NOT decide bindings | One auth on the entry host | Simple entry, use the env as-is |
| **`bagelcode-cross-3way`** | builder=codex+gpt-5.5-codex / verifier=gemini-cli+gemini-3-1-pro / rest=ambient | claude + codex + gemini, 3 auths | **Use case — cross-provider demo**: targets the Bagelcode mail's "Claude Code, Codex, Gemini CLI 등 동시 사용". matrix C2 cross-assemble (CP-WBFT / MAR / Lanham 0.32→0.89). |
| **`mock`** | All actors = mock adapter, deterministic | 0 | **Use case — CI / evaluator env**: works without keys, replay-deterministic |
| **`sdk-enterprise`** | API key direct (bypass subscription) | 3 API keys (ANTHROPIC / OPENAI / GEMINI) | **Use case — production**: ToS-safe (avoids Anthropic 3rd-party OAuth restriction), for evaluators with enterprise keys |
| **`solo`** | Single entry host, single model (lightest) | One entry-host auth | **Use case — minimal-setup demo**: subscription-only, fast demo |

→ Detailed preset format: `.crumb/presets/*.toml`. **The user picks**. Crumb does not guess or force.

**Cross-provider is not a separate mode — it is a use-case label on some of the presets above.** The v2 `--cross-provider` binary flag is retired. When the user wants cross-provider, name the preset explicitly.

## Actor split (v0.1)

The v2 "4 inline sub-steps inside Engineering Lead" → v0.1's **builder + verifier as separate actors** (true cross-provider split).

| Actor | Sandwich | Step (sequential within actor) |
|---|---|---|
| coordinator | `agents/coordinator.md` | (host-inline routing) |
| planner-lead | `agents/planner-lead.md` | phase A: socratic + concept (handoff researcher); phase B (resumed): design + synth (2 specialist inline + game-design contract) |
| **researcher** ★ (v0.3.0) | `agents/researcher.md` | step.research.video × N + step.research synthesis (gemini-sdk: Gemini 3.1 Pro native YouTube URL @ 10fps) |
| **builder** ★ | `agents/builder.md` | step.builder + step.qa (Builder + QA inline) |
| (effect) qa_check | (no sandwich) | dispatcher emits `kind=qa.result` (deterministic, no LLM) |
| **verifier** ★ | `agents/verifier.md` | step.judge × 4 (grader/critic/defender/regrader, CourtEval) + reviewer persona |
| builder-fallback | `agents/builder-fallback.md` | Substitute when builder fails (same contract as builder) |

→ 6 outer actors + 2 specialists (planner-internal, inline) + 1 contract (game-design.md, inline-read by 4+ actors) + 5 procedural skills:

```
[skills]
tdd_iron_law                   # superpowers: NO PRODUCTION CODE WITHOUT FAILING TEST FIRST
verification_before_completion # force verifier PASS before done
code_review_protocol           # builder ↔ verifier handoff format
parallel_dispatch              # specialist parallel-call pattern (planner inline)
subagent_spawn                 # host-native primitive abstraction
```

## Multi-host (v0.1)

| Host | Entry path | Active trigger |
|---|---|---|
| **Claude Code** | `.claude/skills/crumb/SKILL.md` (this file) | `claude` + NL game pitch |
| **Codex CLI** | `~/.codex/agents/crumb.toml` | `codex` + `/crumb <pitch>` |
| **Gemini CLI** | `~/.gemini/extensions/crumb/` | `gemini` + NL game pitch |
| **Headless** | `npx tsx src/index.ts run --goal "..."` | CI / no auth (evaluator) |

→ Whichever host the user enters from, the control plane (transcript / reducer / state) is identical. For cross-host scenarios, the MCP Provider (`localhost:8765`) fans in.

## Swap cookbook — model / provider / actor swapping

All four dimensions (preset / actor binding / model / provider toggle) are the user's call. There are two kinds of swap surface — **static (config.toml seed) vs dynamic (mid-session transcript)** — and both flow through the same reducer.

### A. Static swap — permanent change to `.crumb/config.toml`

Applies before the session starts / from the next session onward. Pick whichever of the 3 surfaces matches your muscle memory:

| Surface | Invocation | Use case |
|---|---|---|
| **MCP `crumb_model`** ★ | "verifier 모델을 gemini-3-1-pro 로", "set builder model to gpt-4o-mini", "effort 다 high 로", "codex 비활성화", "어떤 모델 쓰고 있어?" (read-only) | One NL line from any host (Claude Code / Codex / Gemini) |
| CLI `crumb model` | `npx tsx src/index.ts model` (interactive blessed TUI) / `--show` (read-only) / `--apply "<NL>"` | Direct from terminal, scripts |
| Direct edit | `.crumb/config.toml` (TOML, gitignored) | When git-history tracking is needed in production env |

**Value format** (resolve order: config.toml → preset.actors → preset.[defaults] → ambient → fallback):
- `harness ∈ {claude-code, codex, gemini-cli, gemini-sdk, anthropic-sdk, openai-sdk, google-sdk, mock}`
- `model` — canonical form from `MODEL_CATALOG` (per-provider, top-down high→low). Gemini IDs accept both dot and dash forms (`gemini-3.1-pro` ↔ `gemini-3-1-pro`).
- `effort ∈ {low, med, high}` — maps to Anthropic `budget_tokens` (8K/24K/64K) / OpenAI `reasoning.effort` / Gemini `thinking_budget`.
- `providers.<id>.enabled` (boolean) — when a provider is disabled, the dispatcher falls back to `claude-local` and emits `kind=note` to surface the substitution.

### B. Dynamic swap — mid-session transcript event

Applies immediately during the running session (`reducer → progress_ledger.adapter_override` or `task_ledger.facts[sandwich_append]`). All 3 surfaces produce the same transcript line:

| Surface | Example | Effect |
|---|---|---|
| TUI slash bar | `/swap builder=mock` / `/goto verifier` / `/append @verifier check D5 carefully` | Updates the actor's adapter / next_speaker / sandwich starting from the next spawn |
| `inbox.txt` | `echo "/swap builder=mock" >> sessions/<id>/inbox.txt` | The 500 ms watcher converts the line into a `user.intervene` event |
| JSON event | `echo '{"from":"user","kind":"user.intervene","data":{"swap":{"from":"builder","to":"mock"}}}' \| crumb event` | Lowest-level — both TUI and inbox eventually arrive here |

**`data.<key>` semantics** (see `agents/coordinator.md` Routing Rules for the full table):
- `swap: { from, to }` — `progress_ledger.adapter_override[from] = to` (Paperclip BYO swap)
- `goto: <actor>` — force `next_speaker = <actor>` + immediate spawn (LangGraph `Command(goto)`)
- `target_actor: <actor>` — fact tagged `@<actor>` (surfaced in the next spawn's sandwich)
- `sandwich_append: <text>` (+ optional `target_actor`) — dispatcher concatenates onto every subsequent matching spawn's system prompt (G4)
- `reset_circuit: <actor> | true` — clears circuit_breaker
- `actor: <actor>` (only on pause/resume) — pause/resume that single actor instead of the whole session

> **Frontier mapping**: LangGraph `Command(goto/update={...})` (53/60), Paperclip BYO swap (38/60), Codex `APPEND_SYSTEM.md` (38/60). Detailed backing: `wiki/synthesis/bagelcode-user-intervention-frontier-2026-05-02.md`. Scoring + ratchet alignment: `wiki/synthesis/bagelcode-scoring-ratchet-frontier-2026-05-02.md`.

### C. Startup swap — `--preset <name>`

`crumb run --goal "..." --preset bagelcode-cross-3way` (and equivalents) decides the session's bindings in one shot. Preset files live at `.crumb/presets/*.toml`; `crumb config "<NL>"` recommends which preset fits a use case (no force — the user picks).

### One-glance — "Swap X to Y"

| Situation | Nearest command |
|---|---|
| Pre-session, change verifier model only (permanent) | `crumb_model "verifier 모델을 gemini-3-1-pro 로"` |
| Pre-session, set every actor effort at once | `crumb_model "effort 다 high 로"` |
| Pre-session, disable codex temporarily | `crumb_model "codex 비활성화"` |
| Pre-session, swap entire preset | `crumb run --preset <name>` |
| Mid-session, change builder adapter only | TUI: `/swap builder=mock` or inbox: `echo "/swap builder=mock" >> sessions/<id>/inbox.txt` |
| Mid-session, force the next step | TUI: `/goto verifier` |
| Mid-session, augment a sandwich | TUI: `/append @verifier <text>` |
| Mid-session, reset a circuit | TUI: `/reset-circuit builder` |

## Skill enforcement (do NOT)

- ❌ Spawn Crumb actors directly via the Task tool — only the `crumb run` dispatcher has spawn authority.
- ❌ Write artifacts from the host — that's the spawned sub-agent's authority, not yours.
- ❌ Append to `transcript.jsonl` directly — go through the `crumb event` CLI.
- ❌ Produce `kind=qa.result` from an LLM — only the dispatcher's effect emits it (deterministic).
- ❌ Activate this skill on non-game tasks — only on the triggers named in `description`.
- ❌ **Auto-pick / force / guess a preset** — when the user hasn't named one, run ambient (follow the entry host). Before asking, show the runnable options from `crumb doctor`; do NOT pick (Anthropic 2026-03 "wrong tradeoff" lesson).
- ❌ **Force `provider × harness × model`** — these three dimensions are the user's call. Crumb is a helper, not a decider.

## References

- `AGENTS.md` (repo root) — ★ universal Crumb identity (Linux Foundation Agentic AI Foundation standard). Architecture invariants, actors, schema, multi-host entries, preset philosophy, universal Don't / Must. Auto-imported by `CLAUDE.md` (this skill's parent context) via `@AGENTS.md`. Read this before any actor sandwich.
- `CLAUDE.md` (repo root) — Claude Code-specific augmentation (`.skills/` 24-skill router + Korean policy + progress + verify gate). Auto-loaded by Claude Code; imports `AGENTS.md` inline.
- `wiki/concepts/bagelcode-system-architecture-v0.1.md` — ★ canonical v0.1 system architecture (multi-host + 3-tuple + 5 actor + 3-layer scoring + MCP Provider + persistence)
- `wiki/synthesis/bagelcode-host-harness-decision.md` — Hybrid (Skill + headless CLI) lock decision
- `wiki/concepts/bagelcode-verifier-isolation-matrix.md` — backing for the actor-level split
- `wiki/concepts/bagelcode-system-architecture.md` (v2) — §3-§9 (envelope / cache / per-turn flow / control plane / OTel) still valid in v0.1
- `wiki/references/bagelcode-frontier-cli-convergence-2026.md` — 4 CLI × 7 primitive (multi-host backing)
- `wiki/references/bagelcode-llm-judge-frontier-2026.md` — academic backbone for the 3-layer scoring
- `agents/coordinator.md` / `agents/planner-lead.md` / `agents/researcher.md` / `agents/builder.md` / `agents/verifier.md` / `agents/builder-fallback.md` — 6 actor sandwiches
- `agents/specialists/` — concept-designer / visual-designer (planner inline) + game-design.md (binding contract: §1 envelope + §3 video evidence schema + §5 DESIGN.md synth format, inline-read by researcher / planner / builder / verifier)
- `agents/_event-protocol.md` — `crumb event` usage spec
- `protocol/schemas/message.schema.json` — 39-kind transcript schema (v0.1)
- `.crumb/config.toml` + `.crumb/presets/{bagelcode-cross-3way,mock,sdk-enterprise,solo}.toml` — preset system
- `skills/{tdd-iron-law,verification-before-completion,code-review-protocol,parallel-dispatch,subagent-spawn}.md` — 5 procedural skills
