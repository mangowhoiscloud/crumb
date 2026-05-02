# AGENTS.md — Crumb

> Universal agent instruction file (Linux Foundation Agentic AI Foundation standard).
> Used by Codex, Cursor, Claude Code (when AGENTS.md auto-load enabled), Gemini CLI, and other compatible CLIs.

## What is this repo

**Crumb** is a multi-agent execution harness for casual game prototyping. A user pitches a game idea in one line; Coordinator (host harness 자체) routes through Planner Lead → Builder → deterministic qa_check → Verifier; the user intervenes via natural language or `crumb event` CLI. All collaboration is recorded as a replay-deterministic JSONL transcript (39 kinds × 11 fields × 12 specialist steps × 8 actors).

## Quickstart for human contributors

```bash
npm install
npm run build

# A. Natural language (Claude Code skill — recommended)
$ claude
> /crumb 60초 매치-3 콤보 보너스 게임 만들어줘

# B. Headless / CI / no auth (mock adapter, deterministic, ~1s)
npx tsx src/index.ts run \
  --goal "60초 매치-3 콤보 보너스" \
  --adapter mock --idle-timeout 5000

# C. Real run via preset (user picks the binding)
claude login    # Anthropic Claude Max
codex login     # OpenAI Codex Plus (optional)
gemini login    # Google Gemini Advanced (optional)
npx tsx src/index.ts run --goal "..." --preset bagelcode-cross-3way
```

`provider × harness × model` decisions stay with the user. Crumb never forces a default; if no preset is given, every actor follows the entry host (ambient fallback).

## For agents working on this repo

### Style

- TypeScript, ESM, Node 18+
- `npm` (lockfile committed)
- Lint: `npm run lint`
- Type check: `npm run typecheck`
- Test: `npm test`
- Format: `npm run format` (Prettier)

### Architecture invariants (DO NOT BREAK)

1. **transcript.jsonl is the single source of truth.** Never store agent state in DB or in-memory only. All state must be derivable from the transcript via `reduce()`.

2. **Pure reducer for state.** `src/reducer/` contains pure functions only — no I/O, no time, no randomness. Side effects (spawn / append / hook / rollback / stop / done / qa_check) belong in `src/dispatcher/`.

3. **Subprocess injection, not auto-load.** Agent CLIs (Claude Code / Codex / Gemini CLI) receive sandwich content via `--append-system-prompt` / stdin / `--system-prompt`. Never depend on CLAUDE.md / AGENTS.md / GEMINI.md auto-loading at the agent CLI level.

4. **Three-layer scoring (D1-D6 source-of-truth).** D2 (exec) and D6 (portability) are produced deterministically by `qa_check` effect (`src/dispatcher/qa-runner.ts` → `kind=qa.result`, no LLM). D3/D4 are reducer-auto. D1/D5 are verifier-llm or hybrid. **Never let an LLM forge D2/D6** — the dispatcher's ground truth always wins.

5. **Anti-deception schema enforcement.** Any `kind=judge.score` / `kind=verify.result` with `verdict=PASS` but missing the corresponding qa.result `exec_exit_code` MUST have `D2=0` enforced by `validator/anti-deception.ts`.

6. **ULID for message IDs.** Never use sequential or random UUIDs. ULIDs preserve sort order = transcript chronology.

7. **Append-only transcript.** Use `O_APPEND` (and `flock` once landed). Never modify existing lines.

8. **Sandbox cwd per actor.** Each actor's working dir is `sessions/<id>/agent-workspace/<actor>/`. Use `--add-dir` for read scope.

9. **Actor split (v3).** `engineering-lead` was split into `builder` + `verifier` so cross-provider boundary can run at the actor level (sandwich-internal step boundary is insufficient). The 8 actors are: `user / coordinator / planner-lead / builder / verifier / builder-fallback / validator / system`.

10. **Multi-host × 3-tuple actor binding.** Each actor binds to `(harness × provider × model)` via the active preset. No actor is hard-coded to a specific harness — even the user's preferred verifier provider must come from preset config or ambient fallback.

11. **`provider × harness × model` is user-controlled.** Crumb suggests via `crumb doctor` but never forces a default. If a preset omits an actor, it follows ambient (entry host).

### File map

- `agents/*.md`                  — 5 actor sandwiches: `coordinator.md`, `planner-lead.md`, `builder.md`, `verifier.md`, `builder-fallback.md` (NOT auto-loaded by agent CLIs; injected via stdin / `--system-prompt`)
- `agents/specialists/*.md`      — 3 planner-internal specialist files (concept-designer / researcher / visual-designer); inlined into the planner-lead spawn, no extra Task spawn
- `agents/_event-protocol.md`    — How subprocess agents emit transcript events via `crumb event`
- `skills/*.md`                  — 5 procedural workflow skills referenced by agent sandwiches: `tdd-iron-law`, `verification-before-completion`, `code-review-protocol`, `parallel-dispatch`, `subagent-spawn`
- `protocol/schema.md`           — 1-page transcript spec for humans
- `protocol/schemas/`            — JSON Schema files for the validator (39 kinds × 11 fields × scores D1-D6 source-of-truth matrix)
- `.crumb/config.toml`           — Default actor binding (Paperclip-inspired BYO)
- `.crumb/presets/*.toml`        — Named presets: `bagelcode-cross-3way`, `mock`, `sdk-enterprise`, `solo`
- `.claude/skills/crumb/SKILL.md` — Claude Code natural-language entry (host harness skill)
- `src/`                         — Runtime code (TypeScript ESM, pure reducer + adapters + dispatcher + helpers)
- `src/dispatcher/preset-loader.ts` — `(harness × provider × model)` 3-tuple resolver + ambient fallback
- `src/dispatcher/qa-runner.ts`  — Deterministic qa_check effect (no LLM)
- `src/helpers/{doctor, config, debug}.ts` — `crumb doctor / config / debug` helpers
- `wiki/`                        — Design rationale (subset of mango-wiki/projects/bagelcode/, 35 pages)
- `sessions/`                    — Runtime artifacts (gitignored)

### Wiki — design rationale

Every architecture decision in this repo is grounded in `wiki/`. Before changing core structure, read in this order:

- `wiki/concepts/bagelcode-system-architecture-v3.md` — ★ canonical v3 system architecture (multi-host × 3-tuple, 5 actor split, 3-layer scoring, MCP Provider, persistence)
- `wiki/synthesis/bagelcode-host-harness-decision.md` — Hybrid (Skill + headless CLI) lock
- `wiki/concepts/bagelcode-verifier-isolation-matrix.md` — 20-source × 4-dimension matrix backing actor-level cross-provider opt-in
- `wiki/concepts/bagelcode-final-design-2026.md` — §3-§9 (envelope / cache / OTel) still valid in v3
- `wiki/concepts/bagelcode-orchestration-topology.md` — Hub-Ledger-Spoke
- `wiki/concepts/bagelcode-transcripts-schema.md` — schema 1차 spec (38→39 kind evolution)
- `wiki/concepts/bagelcode-fault-tolerance-design.md` — F1-F5
- `wiki/concepts/bagelcode-budget-guardrails.md` — runaway prevention (count / wall-clock / token)

### Forbidden

- Adding raw `Agent` / `Task` tool spawning that bypasses the dispatcher (depth must stay 1; the only spawning path is `reducer → effect{type:'spawn'} → dispatch` which calls the registered adapter)
- Storing state outside `sessions/<id>/`
- Bypassing `validator/anti-deception.ts`
- Hardcoded paths outside `sessions/`
- Sending raw chain-of-thought to transcript (use `kind=agent.thought_summary` with `metadata.visibility="private"` only)
- Hard-coding any actor to a specific harness or provider — bindings come from presets or ambient fallback
- Forcing a default preset; if the user did not pick one, run ambient (entry host)
- Producing D2 / D6 scores from an LLM judge — those come from `qa_check` effect ground truth

### How to run a session

```bash
# Mock adapter — deterministic demo, no API/subscription cost
npx tsx src/index.ts run --goal "your game pitch" --adapter mock --idle-timeout 5000

# Real run — pick a preset, or omit for ambient (entry host follows)
npx tsx src/index.ts run --goal "your game pitch" --preset bagelcode-cross-3way

# Resume a mid-flight session (re-derive state + surface continuation command)
npx tsx src/index.ts resume <session-id>

# Replay deterministically — proves state is fully derivable from transcript
npx tsx src/index.ts replay sessions/<session-id>/

# Diagnose a stuck session
npx tsx src/index.ts debug <session-id>

# List sessions and adapter / host OAuth health
npx tsx src/index.ts ls
npx tsx src/index.ts doctor

# Recommend a preset from natural-language environment description
npx tsx src/index.ts config "Codex 만 인증된 환경에서 단일 host 데모"

# Observation: tail the transcript while a session runs
tail -f sessions/<session-id>/transcript.jsonl | jq -r '
  select(.kind | IN("goal","spec","build","qa.result","judge.score","done","error","handoff.requested")) |
  "[\(.ts | split("T")[1] | split(".")[0])] \(.from)\t\(.kind)\t\(.body // "")"
'
```
