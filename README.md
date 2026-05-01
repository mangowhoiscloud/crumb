# Crumb

> Multi-agent execution harness for casual game prototyping. Pitch a game in one line; watch Planner Lead and Engineering Lead collaborate through Socratic-Concept-Research-Design and Builder-QA-CourtEval-Verifier; intervene anytime via TUI.

[![CI](https://github.com/mangowhoiscloud/crumb/actions/workflows/ci.yml/badge.svg)](https://github.com/mangowhoiscloud/crumb/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Crumb is named after** (1) the small piece of a bagel — Bagelcode's signature, (2) the **breadcrumb pattern** widely used in LLM agent systems for path tracing and error steering (Hansel & Gretel metaphor), (3) the breadcrumb trail of agent decisions left in `transcript.jsonl` for the user to follow.

## What it is

Crumb treats multi-agent collaboration as an **observable execution protocol**, not just a chat interface. Every message, tool call, artifact, user intervention, judge score, and reasoning summary is recorded as a **replay-deterministic JSONL transcript**.

This is built for the [Bagelcode 신작팀 AI 개발자 과제 전형](https://career.bagelcode.com/ko/o/208045) (2026-05-03 deadline). See [README.ko.md](./README.ko.md) for Korean.

## Quickstart

```bash
git clone https://github.com/mangowhoiscloud/crumb.git
cd crumb
npm install
npm run build

# Smoke test with the mock adapter (no subscription needed)
npx tsx src/index.ts run \
  --goal "60-second match-3 with combo bonus" \
  --adapter mock --idle-timeout 5000

# Inspect what happened
ls sessions/                                    # one ULID-named directory
jq -r '"\(.kind)\t\(.from)"' sessions/*/transcript.jsonl

# Re-derive state deterministically
npx tsx src/index.ts replay sessions/<session-id>
```

For a real run with the user's local CLIs, authenticate first:

```bash
claude login   # Claude Max subscription
codex login    # OpenAI Plus subscription (optional)
npx tsx src/index.ts run --goal "..."   # default adapters: claude-local + codex-local
```

## CLI

| Command | What it does |
|---|---|
| `crumb run --goal "<pitch>"` | Start a new session (default adapters per actor) |
| `crumb run --goal ... --adapter mock` | Force every actor to the mock adapter (deterministic demo) |
| `crumb event` | Read a JSON message from stdin, validate, append to `$CRUMB_TRANSCRIPT_PATH` (subprocess agents call this) |
| `crumb replay <session-dir>` | Re-derive state from `transcript.jsonl` (proves determinism) |
| `crumb doctor` | Adapter health check (`claude --version`, `codex --version`) |
| `crumb ls` | List `sessions/` with event counts |

## Architecture (high level)

```
USER ─[goal]─► COORDINATOR (Hub) ──┬──► PLANNER LEAD
                                     │     └─ Socratic / Concept / Research / Design / Synth
                                     ├──► ENGINEERING LEAD
                                     │     └─ Builder / QA / Verifier(CourtEval) / Synth
                                     └──► BUILDER.FALLBACK (if Codex fails)
```

- **Outer**: 4 actors (subprocess level)
- **Inner**: 7 specialist roles (Lead-internal sequential)
- **Transcript**: 28 kinds × 11 fields × OTel GenAI alias
- **State**: pure reducer + 3 loop variants (live/replay/test)
- **Cost**: $0/session via subscriptions (Claude Max + Codex Plus)

For the full design rationale, see [wiki/bagelcode-final-design-2026.md](./wiki/bagelcode-final-design-2026.md).

## Why these decisions?

Every architecture choice is grounded in 2026 frontier research:

- **Hub-Ledger-Spoke topology** — Lanham 2026-04 (centralized 4.4× error containment vs independent 17.2× amplification)
- **4-actor short chain** — MIT decision theory (5-stage relay → 22.5% accuracy regression)
- **Lead-Specialists with internal sequential** — Paperclip Issue #3438 (35% skill bloat at 8-agent)
- **CourtEval Verifier** — ACL 2025 (Grader/Critic/Defender/Re-grader)
- **Adaptive stopping** — NeurIPS 2025 multi-agent debate judge
- **Subprocess injection** — Karpathy LLM.txt + AGENTS.md (Linux Foundation standard)
- **OTel GenAI alias** — Datadog/Vertex/Anthropic Console standard

See [wiki/synthesis/bagelcode-frontier-rationale-5-claims.md](./wiki/synthesis/bagelcode-frontier-rationale-5-claims.md) for the full citation chain.

## Output

A successful session produces 4 deliverable artifacts:

```
sessions/<session-id>/
├── transcript.jsonl       # Replay-deterministic event log
├── artifacts/
│   ├── game.html          # Phaser 3.80 single-file playable game
│   ├── spec.md            # Acceptance criteria + rule book
│   ├── DESIGN.md          # Color / mechanics / motion spec
│   └── tuning.json        # Balance numbers (importable as Unity ScriptableObject)
└── summary.html           # Auto-generated post-session report
```

These 4 files are the **input asset** for a downstream Unity team — Crumb is the *prototype-validation layer* before the production Unity workflow.

## Status

Walking skeleton complete (`a68651e`):

- [x] Schema-validated JSONL transcript (28 kinds × 11 fields, ajv 2020-12)
- [x] Pure reducer with circuit breaker, adaptive stopping, rollback rules (13 vitest specs)
- [x] Adapter interface — `claude-local`, `codex-local`, and `mock` implementations
- [x] Live dispatcher that spawns subprocess agents with sandwich-injected prompts
- [x] CLI — `run`, `event`, `replay`, `doctor`, `ls`
- [x] CI — lint + typecheck + format + test matrix (Node 18/20/22) + schema validation
- [ ] Real agent end-to-end run with `claude-local` + `codex-local` (sandwich files updated; testing in progress)
- [ ] TUI observer (blessed) — currently `tail -f sessions/*/transcript.jsonl` is the substitute
- [ ] `summary.html` post-session report generator
- [ ] Demo screencast

## Documentation

- [AGENTS.md](./AGENTS.md) — For agents/contributors working on this repo
- [agents/_event-protocol.md](./agents/_event-protocol.md) — How sandwich agents emit transcript events via `crumb event`
- [protocol/schema.md](./protocol/schema.md) — 1-page transcript spec
- [protocol/schemas/message.schema.json](./protocol/schemas/message.schema.json) — JSON Schema (draft 2020-12)
- [wiki/](./wiki/) — Design rationale (subset of mango-wiki)
  - [bagelcode-final-design-2026.md](./wiki/concepts/bagelcode-final-design-2026.md) — Canonical design spec

## License

MIT
