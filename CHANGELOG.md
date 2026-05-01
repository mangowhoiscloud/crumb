# Changelog

All notable changes to Crumb are documented here. Format: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), versioning: [SemVer 2.0.0](https://semver.org/). Pre-1.0: any breaking change is a minor bump, every other change is a patch.

## [Unreleased]

## [0.1.0] — 2026-05-02

First public release. Walking skeleton end-to-end with the `mock` adapter; real subprocess adapters wired but unverified at runtime.

### Added

- Pure reducer (`src/reducer/`) with circuit breaker, adaptive stopping, rollback, and `user.veto` rebound rules. 10 vitest specs.
- Append-only JSONL transcript writer with ULID + ISO-8601 ts auto-injection (`src/transcript/writer.ts`); 3 vitest specs covering schema rejection and concurrent serialization.
- ajv 2020-12 runtime validation against `protocol/schemas/message.schema.json` (28 kinds × 11 fields).
- Adapter interface + `claude-local` (subprocess via Claude Max), `codex-local` (subprocess via OpenAI Plus), and `mock` (deterministic synthetic agent for demos and tests).
- Live dispatcher (`src/dispatcher/live.ts`) executing reducer effects (spawn / append / hook / rollback / done / stop).
- Coordinator main loop (`src/loop/coordinator.ts`) with replay-on-start, fs.watch tail, idle watchdog, and terminal-state guard.
- CLI subcommands: `crumb run --goal ... [--adapter mock]`, `crumb event` (subprocess append helper, reads JSON from stdin), `crumb replay <session-dir>`, `crumb doctor` (adapter health), `crumb ls`.
- Sandwich files for the four outer actors: `agents/coordinator.md` (Haiku 4.5), `agents/planner-lead.md` (Sonnet 4.6), `agents/engineering-lead.md` (Codex GPT-5.5, Markdown), `agents/builder-fallback.md` (Sonnet 4.6 fallback when Codex circuit OPENs).
- `agents/_event-protocol.md` — canonical reference for how subprocess agents emit transcript events via `crumb event`.
- CI workflow: lint + typecheck + format + test matrix (Node 18 / 20 / 22) + JSON Schema compile + sandwich presence check.
- Bagelcode design rationale subset bundled at `wiki/` (28 docs mirrored from `~/workspace/mango-wiki/vault/projects/bagelcode/`).
- Raw research material at `raw/bagelcode-research/` (TradingAgents arXiv 2412.20138 + observability frontier 2026-05).
- Production skill bundle at `skills/`: llm-evaluation, mermaid-diagrams, skill-creator.
- Operational skill bundle at `.skills/` (gitignored): 12 wiki maintenance + 12 implementation workflow (gitflow, changelog, anti-deception-checklist, karpathy-patterns, agent-ops-debugging, kent-beck-review, verification-team, frontier-harness-research, codebase-audit, pr-reviewer, deep-researcher, arxiv-digest).
- `CLAUDE.md` (project-rooted) — quick orientation, project layout, skill routing tables, CI ratchet rule (Karpathy P4: never merge red), progress-tracking directive.
- `AGENTS.md` (Linux Foundation Agentic AI Foundation standard) — architecture invariants and per-actor sandbox rules.
- README.md / README.ko.md aligned with shipped CLI; status table marks shipped vs in-progress.

### Notes

The walking skeleton is verified end-to-end with `--adapter mock`: a 22-line transcript covering `session.start → goal → planner spawn (4 step.* + spec) → engineering spawn (5 step.* + judge.score PASS) → done` is produced and replays deterministically. The real `claude-local` and `codex-local` adapters are wired but a real subprocess round-trip with sandwich-driven event emission is **not yet verified at runtime** — that is the next milestone before submission.

[Unreleased]: https://github.com/mangowhoiscloud/crumb/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/mangowhoiscloud/crumb/releases/tag/v0.1.0
