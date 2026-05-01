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

# Authenticate via your existing CLI tools (no API keys needed)
claude login   # uses your Claude Max subscription
codex login    # uses your OpenAI Plus subscription (optional for --solo)

# Run a session
npm run dev -- run --preset standard "고양이 매치-3, 60초, 콤보 1.5x"
```

The TUI shows agents collaborating; type `/note <text>` or `/veto <id>` anytime.

## Modes

| Mode | Active actors | Example use |
|---|---|---|
| `--solo` | Coord + 1 Lead (all Claude) | Anthropic key only, minimum setup |
| `--standard` (default) | Coord + Planner Lead + Engineering Lead + Verifier | Normal, Claude + Codex |
| `--rigorous` | + true specialist actors (Concept/Research/Design/QA split) | Quality demo, ~3× tokens |
| `--parallel` | standard + Codex/Claude parallel builders | Speed demo, ~2× tokens |

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

Early development. This README and the wiki/ directory are ahead of the code; the runtime is being built incrementally over a 36-hour sprint.

## Documentation

- [AGENTS.md](./AGENTS.md) — For agents/contributors working on this repo
- [docs/architecture.md](./docs/architecture.md) — Architecture deep-dive
- [docs/observability.md](./docs/observability.md) — Self-built observability rationale
- [protocol/schema.md](./protocol/schema.md) — 1-page transcript spec
- [wiki/](./wiki/) — Design rationale (subset of mango-wiki)

## License

MIT
