# AGENTS.md — Crumb

> **Universal agent + contributor instruction file.** Linux Foundation Agentic AI Foundation standard.
>
> **Auto-loaded by**: Codex CLI (native, recursive, closest wins) / Cursor / GitHub Copilot / VS Code.
> **Imported by**: `CLAUDE.md` (via `@AGENTS.md` syntax) / `GEMINI.md` (via root file or `.gemini/settings.json` `contextFileName`).
> **Single source of truth**: every host harness loads this file as the canonical Crumb identity.

---

## What is this repo

**Crumb** is a multi-agent execution harness for casual game prototyping. A user pitches a game idea in one line; Coordinator (the host harness itself) routes through Planner Lead → Builder → deterministic qa_check → Verifier (CourtEval), recorded as a **replay-deterministic JSONL transcript** (39 kinds × 11 fields × 12 specialist steps × 8 actors).

Built for the [Bagelcode New Title Team AI Developer recruitment task](https://career.bagelcode.com/ko/o/208045) (2026-05-03 deadline). See [README.md](./README.md) / [README.ko.md](./README.ko.md) for human onboarding.

## Position in the stack

```
USER (natural language)
   ▾  Multi-host 4 entry — pick the one your environment authenticates:
[Claude Code]  [Codex CLI]  [Gemini CLI]  [headless `crumb run`]
   ▾  Each host's entry imports / references this AGENTS.md, then routes to the matching sandwich
COORDINATOR (host inline)
   ▾  Task tool spawn (depth=1, host-native primitive)
PLANNER LEAD ─▶ BUILDER ─▶ qa_check effect (no LLM) ─▶ VERIFIER ─▶ done
                                                     (BUILDER FALLBACK on circuit OPEN)
   ▾
transcript.jsonl (39 kind × 11 field, append-only, ULID sorted)
   ▾
control plane (pure reducer + state) — replay-deterministic
   ▾
artifacts/{game/, spec.md, DESIGN.md, tuning.json} + index.html + exports/
```

## Architecture invariants (DO NOT BREAK)

These are non-negotiable across every host harness:

1. **transcript.jsonl is the single source of truth.** Never store agent state in a DB or in-memory only. All state derives from the transcript via `reduce()`.
2. **Pure reducer for state.** `src/reducer/` is pure (no I/O, no time, no randomness). Side effects live in `src/dispatcher/`.
3. **Subprocess injection, not auto-load.** Sandwich content reaches host CLIs via `--append-system-prompt` / stdin / `--system-prompt`. Never depend on AGENTS.md / CLAUDE.md / GEMINI.md auto-loading at the agent CLI level for the sandwich body itself.
4. **Three-layer scoring.** Every dimension reports a single origin in `scores.D*.source`: `verifier-llm` (D1, plus the LLM components of D3/D5), `qa-check-effect` (D2/D6, deterministic ground truth from `src/dispatcher/qa-runner.ts` → `kind=qa.result`, no LLM), or `reducer-auto` (D4, plus the auto components of D3/D5). D3/D5 are split: the verifier emits its LLM-judged value, the reducer computes the auto component independently in `computeAutoScores()`, and `combineDimScore()` averages the two halves in code. **Never let an LLM forge D2/D6** — the dispatcher's ground truth always wins. The `qa_check` effect *also* serves as the **pre-verifier ratchet**: there is no LLM scoring between planner output and verifier — the deterministic exec gate fills that role on purpose, per `wiki/synthesis/bagelcode-pre-verifier-no-scoring-frontier-2026-05-03.md` (DeepSeek-R1 / Cognition / Huang ICLR 2024 / SWE-Bench top-10 convergence).
5. **Anti-deception schema enforcement.** Any `kind=judge.score` / `kind=verify.result` with `verdict=PASS` but missing the corresponding qa.result `exec_exit_code` MUST have `D2=0` enforced by `validator/anti-deception.ts`.
6. **ULID for message IDs.** Never use sequential or random UUIDs. ULIDs preserve sort order = transcript chronology.
7. **Append-only transcript.** Use `O_APPEND` (and `flock` once landed). Never modify existing lines.
8. **Sandbox cwd per actor.** Each actor's working dir is `sessions/<id>/agent-workspace/<actor>/`. Use `--add-dir` for read scope.
9. **Actor split (v0.1 + v0.3.0).** `engineering-lead` was split into `builder` + `verifier` (v0.1) so the cross-provider boundary runs at the actor level. `researcher` was promoted from a planner inline-read specialist into its own actor (v0.3.0) so the multimodal video-LLM 2026 frontier (Gemini 3.1 Pro) can be bound to a dedicated SDK adapter without forcing the rest of planner-lead onto the same provider. The 9 actors are: `user / coordinator / planner-lead / researcher / builder / verifier / builder-fallback / validator / system`.
10. **Multi-host × 3-tuple actor binding.** Each actor binds to `(harness × provider × model)` via the active preset. No actor is hard-coded to a specific harness — even the user's preferred verifier provider must come from preset config or ambient fallback.
11. **`provider × harness × model` is user-controlled.** Crumb suggests via `crumb doctor` but never forces a default. If a preset omits an actor, it follows ambient (the entry host).

## Actors

| Actor | Sandwich | Role |
|---|---|---|
| `coordinator` | `agents/coordinator.md` | Host-inline routing (Hub-Ledger-Spoke). Decides next_speaker per transcript event. |
| `planner-lead` | `agents/planner-lead.md` | Spec authoring. Two-phase spawn (Socratic + Concept → handoff to researcher → resume for Design + Synth). 2 specialists inline-read + game-design.md contract. |
| `researcher` | `agents/researcher.md` | Video-evidence extractor (v0.3.0). Ingests gameplay clips via gemini-sdk (Gemini 3.1 Pro, native YouTube URL, 10fps frame sampling) → emits `step.research.video` × N + `step.research` synthesis. Bound to gemini-sdk adapter when video_refs present; ambient text-only fallback otherwise. |
| `builder` | `agents/builder.md` | Phaser 3.80 multi-file PWA implementer (`artifacts/game/{index.html, src/, sw.js, manifest.webmanifest}`). Emits `kind=build`; QA is OUT of reach. |
| `verifier` | `agents/verifier.md` | CourtEval (Grader → Critic → Defender → Re-grader, ACL 2025) inline 4 sub-step. Reads `qa.result` for D2/D6 + `step.research` evidence_refs for D5 (v0.3.0 anti-deception). |
| `builder-fallback` | `agents/builder-fallback.md` | Builder substitute. Activates when `circuit_breaker.builder.state === 'OPEN'`. |

Plus 2 specialists (planner-internal inline, no separate Task spawn) + 1 contract spec (read by 4+ actors):
- `agents/specialists/concept-designer.md` — planner step.concept inline-read
- `agents/specialists/visual-designer.md` — planner step.design inline-read
- `agents/specialists/game-design.md` — binding game-design contract: §1 envelope (Phaser 3.80 multi-file PWA) + §1.2 optional postgres-anon-leaderboard persistence profile + §3 video evidence schema (researcher) + §5 DESIGN.md synth format (planner). Inline-read by researcher / planner-lead / builder / builder-fallback / verifier.

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
  + scores D1–D6 source-of-truth matrix (verifier-llm / qa-check-effect / reducer-auto — single origin per dim; D3/D5 LLM and auto components are combined deterministically by combineDimScore)
  + metadata 14 fields (incl. v0.1: harness / provider / adapter_session_id / cache_carry_over /
    deterministic / cross_provider)
```

Each transcript line carries: `id` (ULID) / `ts` (ISO-8601) / `session_id` / `from` (one of 8 actors) / `kind` / `body` / optional `data` / `artifacts` / `scores` / `metadata`. Replay-deterministic; `crumb replay <session-dir>` re-derives identical state.

## Multi-host entries

Pick the one your environment authenticates:

| Host | Entry path | Trigger | AGENTS.md auto-load |
|---|---|---|---|
| **Claude Code** | `.claude/skills/crumb/SKILL.md` | natural-language pitch or `/crumb <pitch>` | via `CLAUDE.md` `@AGENTS.md` import |
| **Codex CLI** | `.codex/agents/crumb.toml` (project-scoped) | `codex run crumb "<pitch>"` | ✅ native: AGENTS.md (closest wins, recursive) + `.codex/agents/<name>.toml` (project-scoped agent definition, OpenAI Codex docs) |
| **Gemini CLI** | `.gemini/extensions/crumb/` (manifest + GEMINI.md + commands/) | `/crumb <pitch>` | via `.gemini/settings.json` `contextFileName: ["AGENTS.md", "GEMINI.md"]` |
| **Headless** | `crumb run --goal "<pitch>" [--preset <name>] [--adapter <id>]` | CI / no auth (mock adapter is deterministic) | (no host, runtime reads files explicitly) |

Each entry imports / references this AGENTS.md and the matching `agents/*.md` sandwich for the active actor. The control plane (transcript / reducer / dispatcher / preset-loader) is the same regardless of entry.

## Preset (user-controlled)

`provider × harness × model` per actor is **the user's call**. Crumb never forces a default; if no preset is given, every actor follows the entry host (ambient fallback).

| Preset | Binding | Use case |
|---|---|---|
| **(no preset)** ambient | Every actor follows the entry host | Simplest path — whatever you have authenticated |
| **`bagelcode-cross-3way`** | builder=codex+gpt-5.5-codex / verifier=gemini-cli+gemini-3-1-pro / rest=ambient | 3-provider cross-assemble (Bagelcode mail's "Claude Code, Codex, Gemini CLI 등 동시 사용" — *use Claude Code, Codex, Gemini CLI etc. simultaneously*) |
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

---

## For human contributors

### Quickstart

```bash
npm install
npm run build

# 0. One-time PATH setup (after `npm install && npm run build` above)
npm link            # registers `crumb` and `crumb-studio` on PATH
                    # (or: npm i -g .  — same effect)

# A. Natural language (Claude Code skill — recommended)
$ claude
> /crumb 60초 매치-3 콤보 보너스 게임 만들어줘

# B. Headless / CI / no auth (mock adapter, deterministic, ~1s)
crumb run --goal "60초 매치-3 콤보 보너스" --adapter mock --idle-timeout 5000

# C. Real run via preset (user picks the binding)
claude login    # Anthropic Claude Max
codex login     # OpenAI Codex Plus (optional)
gemini login    # Google Gemini Advanced (optional)
crumb run --goal "..." --preset bagelcode-cross-3way

# D. Live studio (browser console)
npx crumb-studio               # http://127.0.0.1:7321/  (auto-opens browser)
```

> Pre-link / dev-mode equivalents: every `crumb …` line above is interchangeable
> with `npx tsx src/index.ts …` from inside the repo root, and
> `npx crumb-studio …` is interchangeable with
> `node packages/studio/dist/cli.js …` after a build.

`provider × harness × model` decisions stay with the user. Crumb never forces a default; if no preset is given, every actor follows the entry host (ambient fallback).

### Style

- TypeScript, ESM, Node 18+
- `npm` (lockfile committed)
- Lint: `npm run lint`
- Type check: `npm run typecheck`
- Test: `npm test`
- Format: `npm run format` (Prettier)
- Pre-PR Quality Gate: `npm run lint && npm run typecheck && npm run format:check && npm test && npm run build`

### How to run a session

The bin entries (`crumb`, `crumb-studio`) are wired in `package.json` and
become available on PATH after `npm link` (or `npm i -g .`). Both forms are
equivalent — the global form is what users see, the `npx tsx` / `node dist/`
form is what the AGENTS.md and source comments reference for in-repo dev.

```bash
# Mock adapter — deterministic demo, no API/subscription cost
crumb run --goal "your game pitch" --adapter mock --idle-timeout 5000

# Real run — pick a preset, or omit for ambient (entry host follows)
crumb run --goal "your game pitch" --preset bagelcode-cross-3way

# Resume a mid-flight session (re-derive state + surface continuation command)
crumb resume <session-id>

# Replay deterministically — proves state is fully derivable from transcript
crumb replay <session-id>

# Diagnose a stuck session
crumb debug <session-id>

# List sessions and adapter / host OAuth health
crumb ls
crumb doctor

# Recommend a preset from natural-language environment description
crumb config "single-host demo with only Codex authenticated"

# Live studio (browser console — single-binary HTTP + SSE on 127.0.0.1:7321)
npx crumb-studio

# Observation: tail the transcript while a session runs
tail -f ~/.crumb/projects/<project-id>/sessions/<session-id>/transcript.jsonl | jq -r '
  select(.kind | IN("goal","spec","build","qa.result","judge.score","done","error","handoff.requested")) |
  "[\(.ts | split("T")[1] | split(".")[0])] \(.from)\t\(.kind)\t\(.body // "")"
'
```

### File map

- `agents/*.md`                  — 6 actor sandwiches: `coordinator.md`, `planner-lead.md`, `researcher.md`, `builder.md`, `verifier.md`, `builder-fallback.md` (NOT auto-loaded by agent CLIs; injected via stdin / `--system-prompt`)
- `agents/specialists/*.md`      — 3 planner-internal specialist files (concept-designer / researcher / visual-designer); inlined into the planner-lead spawn, no extra Task spawn
- `agents/_event-protocol.md`    — How subprocess agents emit transcript events via `crumb event`
- `skills/*.md`                  — 5 procedural workflow skills referenced by agent sandwiches
- `protocol/schema.md`           — 1-page transcript spec for humans
- `protocol/schemas/`            — JSON Schema files for the validator (39 kinds × 11 fields × scores D1-D6)
- `.crumb/config.toml`           — Default actor binding (Paperclip-inspired BYO)
- `.crumb/presets/*.toml`        — Named presets: `bagelcode-cross-3way`, `mock`, `sdk-enterprise`, `solo`
- `.claude/skills/crumb/SKILL.md` — Claude Code natural-language entry (host harness skill)
- `.codex/agents/crumb.toml`     — Codex CLI subagent definition + MCP server registration
- `.gemini/extensions/crumb/`    — Gemini CLI extension (manifest + GEMINI.md + commands)
- `.gemini/settings.json`        — Gemini CLI `contextFileName` config (loads AGENTS.md auto)
- `src/`                         — Runtime code (TypeScript ESM, pure reducer + adapters + dispatcher + helpers)
- `src/dispatcher/preset-loader.ts` — `(harness × provider × model)` 3-tuple resolver + ambient fallback
- `src/dispatcher/qa-runner.ts`  — Deterministic qa_check effect (no LLM)
- `src/helpers/{doctor, config, debug}.ts` — `crumb doctor / config / debug` helpers
- `wiki/`                        — Design rationale (subset of mango-wiki/projects/bagelcode/, 35 pages)
- `sessions/`                    — Runtime artifacts (gitignored)

### Wiki — design rationale

Every architecture decision in this repo is grounded in `wiki/`. Before changing core structure, read in this order:

- `wiki/concepts/bagelcode-system-architecture-v0.1.md` — ★ canonical v0.1 system architecture (multi-host × 3-tuple, 5 actor split, 3-layer scoring, MCP Provider, persistence)
- `wiki/synthesis/bagelcode-host-harness-decision.md` — Hybrid (Skill + headless CLI) lock
- `wiki/concepts/bagelcode-verifier-isolation-matrix.md` — 20-source × 4-dimension matrix backing actor-level cross-provider opt-in
- `wiki/concepts/bagelcode-final-design-2026.md` — §3-§9 (envelope / cache / OTel) still valid in v0.1
- `wiki/concepts/bagelcode-orchestration-topology.md` — Hub-Ledger-Spoke
- `wiki/concepts/bagelcode-transcripts-schema.md` — schema first-draft spec (38→39 kind evolution)
- `wiki/concepts/bagelcode-fault-tolerance-design.md` — F1-F5
- `wiki/concepts/bagelcode-budget-guardrails.md` — runaway prevention (count / wall-clock / token)

### Forbidden (contributor-specific, on top of universal Don't above)

- Adding raw `Agent` / `Task` tool spawning that bypasses the dispatcher (depth must stay 1; the only spawning path is `reducer → effect{type:'spawn'} → dispatch` which calls the registered adapter)
- Storing state outside `sessions/<id>/`
- Bypassing `validator/anti-deception.ts`
- Hardcoded paths outside `sessions/`
- Sending raw chain-of-thought to transcript (use `kind=agent.thought_summary` with `metadata.visibility="private"` only)
- Hard-coding any actor to a specific harness or provider — bindings come from presets or ambient fallback
- Forcing a default preset; if the user did not pick one, run ambient (entry host)
- Producing D2 / D6 scores from an LLM judge — those come from `qa_check` effect ground truth

---

## References (navigate from here)

### Identity siblings
- [`CLAUDE.md`](./CLAUDE.md) — Claude Code-specific augmentation (`@AGENTS.md` import + `.skills/` 24-skill mapping + Korean policy + progress)
- [`GEMINI.md`](./GEMINI.md) — Gemini CLI-specific augmentation (verifier multimodal slot + extension link)

### Host entries (one per harness)
- [`.claude/skills/crumb/SKILL.md`](./.claude/skills/crumb/SKILL.md) — Claude Code
- [`.codex/agents/crumb.toml`](./.codex/agents/crumb.toml) — Codex CLI
- [`.gemini/extensions/crumb/`](./.gemini/extensions/crumb/) — Gemini CLI (manifest + GEMINI.md + commands)
- `.gemini/settings.json` — Gemini CLI `contextFileName` config (loads AGENTS.md auto)

### Sandwiches (6 actors + 2 specialists + 1 contract + 5 skills)
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
- [`wiki/concepts/bagelcode-system-architecture-v0.1.md`](./wiki/concepts/bagelcode-system-architecture-v0.1.md) — ★ canonical v0.1 architecture
- [`wiki/synthesis/bagelcode-host-harness-decision.md`](./wiki/synthesis/bagelcode-host-harness-decision.md) — Hybrid (Skill + headless CLI) lock
- [`wiki/concepts/bagelcode-verifier-isolation-matrix.md`](./wiki/concepts/bagelcode-verifier-isolation-matrix.md) — actor-level cross-provider matrix
- [`wiki/references/bagelcode-frontier-cli-convergence-2026.md`](./wiki/references/bagelcode-frontier-cli-convergence-2026.md) — 4 CLI × 7 primitive convergence

## License

MIT (see [LICENSE](./LICENSE)).
