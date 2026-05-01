# AGENTS.md — Crumb

> Universal agent instruction file (Linux Foundation Agentic AI Foundation standard).
> Used by Codex, Cursor, Claude Code (when AGENTS.md auto-load enabled), and other compatible CLIs.

## What is this repo

**Crumb** is a multi-agent execution harness for casual game prototyping. A user pitches a game idea in one line; Coordinator routes through Planner Lead → Engineering Lead → Verifier; the user can intervene anytime via TUI or `inbox.txt`. All collaboration is recorded as a replay-deterministic JSONL transcript.

## Quickstart for human contributors

```bash
npm install
npm run build

# Mock-adapter smoke test (no subscription needed, ~1s)
npx tsx src/index.ts run \
  --goal "고양이 매치-3, 60초, 콤보 1.5x" \
  --adapter mock --idle-timeout 5000

# Real run via local CLIs
claude login   # if not already
codex login    # if not already (optional)
npx tsx src/index.ts run --goal "..."   # default adapters: claude-local + codex-local
```

## For agents working on this repo

### Style

- TypeScript, ESM, Node 18+
- Use `npm` (lockfile committed)
- Lint: `npm run lint`
- Type check: `npm run typecheck`
- Test: `npm test`
- Format: `npm run format` (Prettier)

### Architecture invariants (DO NOT BREAK)

1. **transcript.jsonl is the single source of truth.** Never store agent state in DB or in-memory only. All state must be derivable from transcript via `reduce()`.

2. **Pure reducer for state.** `src/reducer/` contains pure functions. Side effects belong in `src/dispatcher/`.

3. **Subprocess injection, not auto-load.** Agent CLIs (Claude Code, Codex) receive sandwich content via `--append-system-prompt` or stdin. Never depend on CLAUDE.md / AGENTS.md auto-loading at the agent CLI level.

4. **Anti-deception schema enforcement.** Any `kind=verify.result` with `verdict=PASS` and missing `exec.exit_code` MUST have `D2=0` enforced by `validator/anti-deception.ts`.

5. **ULID for message IDs.** Never use sequential or random UUIDs. ULIDs preserve sort order = transcript chronology.

6. **Append-only transcript.** Use `flock` / `O_APPEND`. Never modify existing lines.

7. **Sandbox cwd per actor.** Each actor's working dir is `sessions/<id>/agent-workspace/<actor>/`. Use `--add-dir` for read scope.

### File map

- `agents/*.md`         — Crumb's per-actor sandwich files (NOT auto-loaded by agent CLIs; injected via stdin)
- `protocol/schema.md`  — 1-page transcript spec for humans
- `protocol/schemas/`   — JSON Schema files for validator
- `.crumb/config.toml`  — Adapter / model selection (Paperclip-inspired)
- `src/`                — Runtime code (CLI orchestrator)
- `wiki/`               — Design rationale (subset of mango-wiki/projects/bagelcode/)
- `docs/`               — Public-facing docs
- `skills/`             — Optional Claude Code / Codex skills
- `sessions/`           — Runtime artifacts (gitignored)
- `tests/`              — Vitest unit tests

### Wiki — design rationale

Every architecture decision in this repo is grounded in `wiki/`. Before changing core structure, read:

- `wiki/bagelcode-final-design-2026.md` — Final design
- `wiki/synthesis/bagelcode-frontier-rationale-5-claims.md` — 5 frontier claim
- `wiki/concepts/bagelcode-orchestration-topology.md` — Hub-Ledger-Spoke
- `wiki/concepts/bagelcode-transcripts-schema.md` — 28 kind × 11 field
- `wiki/concepts/bagelcode-fault-tolerance-design.md` — F1-F5

### Forbidden

- Adding `Agent` / `Task` tool spawning (depth must stay 1)
- Storing state outside `sessions/<id>/`
- Bypassing `validator/anti-deception.ts`
- Hardcoded paths outside `sessions/`
- Sending raw chain-of-thought to transcript (use `kind=agent.thought_summary` only)

### How to run a session

```bash
# Mock adapter — deterministic demo, no API/subscription cost
npx tsx src/index.ts run --goal "your game pitch" --adapter mock --idle-timeout 5000

# Real run — Coordinator picks claude-local for planner-lead and codex-local
# for engineering-lead by default (overridable via --adapter)
npx tsx src/index.ts run --goal "your game pitch"

# Replay deterministically — proves state is fully derivable from transcript
npx tsx src/index.ts replay sessions/<session-id>/

# List sessions and adapter health
npx tsx src/index.ts ls
npx tsx src/index.ts doctor

# Observation: tail the transcript while a session runs
tail -f sessions/<session-id>/transcript.jsonl | jq -r '"\(.kind)\t\(.from)\t\(.body // "")"'
```
