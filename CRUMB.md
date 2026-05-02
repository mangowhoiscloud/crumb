---
name: crumb
description: >-
  Crumb runtime identity — universal, host-agnostic. Loaded by host harness entries
  (.claude/skills/crumb/SKILL.md, .codex/agents/crumb.toml, .gemini/extensions/crumb/
  gemini-extension.json) so every host injects the same Crumb identity. Sibling of AGENTS.md
  (Linux Foundation Agentic AI Foundation standard, contributor identity); the two files have
  separate responsibilities — AGENTS.md tells contributors how to work on this repo, CRUMB.md
  tells the host harness what Crumb is.
type: agent-runtime
universal: true
schema_version: crumb/v3
---

# Crumb

Multi-agent execution harness for casual game prototyping. A user pitches a game in one line; Coordinator (the host harness itself) routes through Planner Lead → Builder → deterministic qa_check effect → Verifier (CourtEval), recorded as a replay-deterministic JSONL transcript with 39 kinds × 11 fields × 12 specialist steps × 8 actors.

> **What this file is.** A universal identity injected by every host harness so the same Crumb is loaded regardless of entry path. Read me first; then walk to the host-specific entry that called you.

## Position in the stack

```
USER (자연어)
   ▾  Multi-host 4 entry — pick the one your environment authenticates:
[Claude Code]  [Codex CLI]  [Gemini CLI]  [headless `crumb run`]
   ▾  Each host's entry imports / references this CRUMB.md, then routes to the matching sandwich
COORDINATOR (host inline)
   ▾  Task tool spawn (depth=1, host-native primitive)
PLANNER LEAD ─▶ BUILDER ─▶ qa_check effect (no LLM) ─▶ VERIFIER ─▶ done
                                                     (BUILDER FALLBACK on circuit OPEN)
   ▾
transcript.jsonl (39 kind × 11 field, append-only, ULID sorted)
   ▾
control plane (pure reducer + state) — replay-deterministic
   ▾
artifacts/{game.html, spec.md, DESIGN.md, tuning.json} + index.html + exports/
```

## Architecture invariants

These are non-negotiable across every host harness:

1. **transcript.jsonl is the single source of truth.** Never store agent state in a DB or in-memory only. All state derives from the transcript via `reduce()`.
2. **Pure reducer for state.** `src/reducer/` is pure (no I/O, no time, no randomness). Side effects live in `src/dispatcher/`.
3. **Subprocess injection, not auto-load.** Sandwich content reaches host CLIs via `--append-system-prompt` / stdin / `--system-prompt`. Never depend on CLAUDE.md / AGENTS.md / GEMINI.md auto-loading at the agent CLI level.
4. **Three-layer scoring.** D2 (exec) and D6 (portability) are produced deterministically by `qa_check` effect (`src/dispatcher/qa-runner.ts` → `kind=qa.result`, no LLM). D3/D4 are reducer-auto. D1/D5 are verifier-llm or hybrid. **Never let an LLM forge D2/D6** — the dispatcher's ground truth always wins.
5. **Anti-deception schema enforcement.** Any `kind=judge.score` / `kind=verify.result` with `verdict=PASS` but missing the corresponding qa.result `exec_exit_code` MUST have `D2=0` enforced by `validator/anti-deception.ts`.
6. **ULID for message IDs.** Never use sequential or random UUIDs. ULIDs preserve sort order = transcript chronology.
7. **Append-only transcript.** Use `O_APPEND` (and `flock` once landed). Never modify existing lines.
8. **Sandbox cwd per actor.** Each actor's working dir is `sessions/<id>/agent-workspace/<actor>/`. Use `--add-dir` for read scope.
9. **Actor split (v3).** `engineering-lead` was split into `builder` + `verifier` so the cross-provider boundary runs at the actor level. The 8 actors are: `user / coordinator / planner-lead / builder / verifier / builder-fallback / validator / system`.
10. **Multi-host × 3-tuple actor binding.** Each actor binds to `(harness × provider × model)` via the active preset. No actor is hard-coded to a specific harness — even the user's preferred verifier provider must come from preset config or ambient fallback.
11. **`provider × harness × model` is user-controlled.** Crumb suggests via `crumb doctor` but never forces a default. If a preset omits an actor, it follows ambient (the entry host).

## Actors

| Actor | Sandwich | Role |
|---|---|---|
| `coordinator` | `agents/coordinator.md` | Host-inline routing (Hub-Ledger-Spoke). Decides next_speaker per transcript event. |
| `planner-lead` | `agents/planner-lead.md` | Spec authoring. 5 sequential steps (socratic / concept / research / design / synth) with 3 specialists inline-read. |
| `builder` | `agents/builder.md` | Phaser 3.80 single-file `game.html` implementer. Emits `kind=build`; QA is OUT of reach. |
| `verifier` | `agents/verifier.md` | CourtEval (Grader → Critic → Defender → Re-grader, ACL 2025) inline 4 sub-step. Reads `qa.result` for D2/D6. |
| `builder-fallback` | `agents/builder-fallback.md` | Builder substitute. Activates when `circuit_breaker.builder.state === 'OPEN'`. |

Plus 3 specialists (planner-internal inline, no separate Task spawn):
- `agents/specialists/concept-designer.md`
- `agents/specialists/researcher.md`
- `agents/specialists/visual-designer.md`

And 5 procedural skills (sandwich-loaded inline):
- `skills/tdd-iron-law.md` — RED-GREEN-REFACTOR Iron Law (superpowers)
- `skills/verification-before-completion.md` — evidence-over-claims
- `skills/code-review-protocol.md` — builder ↔ verifier handoff format
- `skills/parallel-dispatch.md` — specialist parallel call pattern
- `skills/subagent-spawn.md` — host-native primitive abstraction

## Schema

Source: `protocol/schemas/message.schema.json`.

```
39 kinds × 11 fields × 12 specialist steps × 8 actors
  + scores D1–D6 source-of-truth matrix (verifier-llm / qa-check-effect / reducer-auto / hybrid)
  + metadata 14 fields (incl. v3: harness / provider / adapter_session_id / cache_carry_over /
    deterministic / cross_provider)
```

Each transcript line carries: `id` (ULID) / `ts` (ISO-8601) / `session_id` / `from` (one of 8 actors) / `kind` / `body` / optional `data` / `artifacts` / `scores` / `metadata`. Replay-deterministic; `crumb replay <session-dir>` re-derives identical state.

## Multi-host entries

Pick the one your environment authenticates:

| Host | Entry path | Trigger |
|---|---|---|
| **Claude Code** | `.claude/skills/crumb/SKILL.md` | natural-language pitch or `/crumb <pitch>` |
| **Codex CLI** | `.codex/agents/crumb.toml` | `codex run crumb "<pitch>"` |
| **Gemini CLI** | `.gemini/extensions/crumb/` (manifest + GEMINI.md + commands/) | `/crumb <pitch>` |
| **Headless** | `crumb run --goal "<pitch>" [--preset <name>] [--adapter <id>]` | CI / no auth (mock adapter is deterministic) |

Each entry imports the relevant identity files (this `CRUMB.md` plus `AGENTS.md`) and the matching `agents/*.md` sandwich for the active actor. The control plane (transcript / reducer / dispatcher / preset-loader) is the same regardless of entry.

## Preset (user-controlled)

`provider × harness × model` per actor is **the user's call**. Crumb never forces a default; if no preset is given, every actor follows the entry host (ambient fallback).

| Preset | Binding | Use case |
|---|---|---|
| **(no preset)** ambient | Every actor follows the entry host | Simplest path — whatever you have authenticated |
| **`bagelcode-cross-3way`** | builder=codex+gpt-5.5-codex / verifier=gemini-cli+gemini-2.5-pro / rest=ambient | 3-provider cross-assemble (Bagelcode mail's "Claude Code, Codex, Gemini CLI 등 동시 사용") |
| **`mock`** | All actors = mock adapter, deterministic | CI / no auth / deterministic demo |
| **`sdk-enterprise`** | API key direct (subscription bypass) | Production / ToS-safe / enterprise key holders |
| **`solo`** | Single entry host, single model | Minimal-setup demo |

Preset files live at `.crumb/presets/*.toml`. Run `crumb doctor` to see which presets your environment can actually run. **Cross-provider is not a separate flag — it is one preset's use-case label.**

## Don't (universal — every host)

- ❌ Spawn agents directly via Task tool from inside an actor sandwich — only the dispatcher (`src/dispatcher/live.ts`) spawns through registered adapters
- ❌ Store state outside `sessions/<id>/`
- ❌ Bypass `validator/anti-deception.ts`
- ❌ Hardcode paths outside `sessions/`
- ❌ Send raw chain-of-thought to the transcript — use `kind=agent.thought_summary` with `metadata.visibility="private"` only
- ❌ Hard-code any actor to a specific harness or provider — bindings come from the active preset or ambient fallback
- ❌ Force a default preset if the user did not pick one — run ambient
- ❌ Produce D2 / D6 scores from an LLM judge — those come from the `qa_check` effect's ground truth
- ❌ Modify existing transcript lines (append-only, ULID-sorted)

## Must (universal — every host)

- All state derivable from `transcript.jsonl` via `reduce()`
- All artifacts include sha256 in `kind=artifact.created`
- Every emitted message sets `metadata.harness` + `metadata.provider` + `metadata.model` per the active preset binding
- `kind=qa.result` is emitted only by `system` (the dispatcher's qa-runner) — never by an LLM-driven actor
- `kind=judge.score` always references the prior `qa.result` for D2/D6 lookup
- STOP after `kind=handoff.requested` from any actor — no continued routing in the same turn
- Set `metadata.cross_provider=true` when the verifier's provider differs from the build event's provider

## References (navigate from here)

### Identity siblings
- [`AGENTS.md`](./AGENTS.md) — contributor guide (Linux Foundation Agentic AI Foundation standard)

### Host entries (one per harness)
- [`.claude/skills/crumb/SKILL.md`](./.claude/skills/crumb/SKILL.md) — Claude Code
- [`.codex/agents/crumb.toml`](./.codex/agents/crumb.toml) — Codex CLI
- [`.gemini/extensions/crumb/`](./.gemini/extensions/crumb/) — Gemini CLI (manifest + GEMINI.md + commands)

### Sandwiches (5 actors + 3 specialists + 5 skills)
- [`agents/coordinator.md`](./agents/coordinator.md), [`planner-lead.md`](./agents/planner-lead.md), [`builder.md`](./agents/builder.md), [`verifier.md`](./agents/verifier.md), [`builder-fallback.md`](./agents/builder-fallback.md)
- [`agents/specialists/`](./agents/specialists/) — concept-designer / researcher / visual-designer
- [`skills/`](./skills/) — tdd-iron-law / verification-before-completion / code-review-protocol / parallel-dispatch / subagent-spawn
- [`agents/_event-protocol.md`](./agents/_event-protocol.md) — `crumb event` emit spec

### Schema + control plane
- [`protocol/schemas/message.schema.json`](./protocol/schemas/message.schema.json) — 39 kind × 11 field
- [`protocol/schema.md`](./protocol/schema.md) — 1-page human spec
- `src/reducer/`, `src/dispatcher/`, `src/state/`, `src/transcript/`, `src/adapters/`, `src/loop/`

### Preset
- [`.crumb/config.toml`](./.crumb/config.toml) — default actor binding
- [`.crumb/presets/`](./.crumb/presets/) — `bagelcode-cross-3way` / `mock` / `sdk-enterprise` / `solo`
- `.crumb/config.local.toml` (gitignored) — user-personal binding override

### Design rationale (wiki/, mango-wiki subset)
- [`wiki/concepts/bagelcode-system-architecture-v3.md`](./wiki/concepts/bagelcode-system-architecture-v3.md) — ★ canonical v3 architecture
- [`wiki/synthesis/bagelcode-host-harness-decision.md`](./wiki/synthesis/bagelcode-host-harness-decision.md) — Hybrid (Skill + headless CLI) lock
- [`wiki/concepts/bagelcode-verifier-isolation-matrix.md`](./wiki/concepts/bagelcode-verifier-isolation-matrix.md) — actor-level cross-provider matrix
- [`wiki/references/bagelcode-multi-host-harness-research-2026.md`](./wiki/references/bagelcode-multi-host-harness-research-2026.md) — 11 cases × 6 dim multi-host harness research (this file's research basis)

## License

MIT (see [LICENSE](./LICENSE)).
