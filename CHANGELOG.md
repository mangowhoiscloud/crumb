# Changelog

All notable changes to Crumb are documented here. Format: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), versioning: [SemVer 2.0.0](https://semver.org/). Pre-1.0: any breaking change is a minor bump, every other change is a patch.

## [Unreleased]

### Added — v3 Multi-host × (harness × provider × model) tuple (in progress)

- **System architecture v3 lock** (`wiki/concepts/bagelcode-system-architecture-v3.md`) — Multi-host 4 entry (Claude Code + Codex CLI + Gemini CLI + headless), (harness × provider × model) 3-tuple actor binding with ambient fallback, 5 actor (coordinator / planner-lead / **builder** / **verifier** / builder-fallback) + 3 specialist + 5 skill, 3-layer scoring (reducer auto + qa_check effect + verifier CourtEval), MCP server (Provider) for cross-host self-hosted exposure, auth-manager (`/crumb doctor`) for environment readiness, persistence boost (`crumb resume <session-id>` + adapter session-id metadata + flock). Replaces v2 `bagelcode-system-architecture.md` §1-§2 topology; v2 §3-§9 absorbed.
- `wiki/references/bagelcode-frontier-cli-convergence-2026.md` — 2026-04 Claude Code / Codex / Gemini / OpenCode 4 CLI convergence on 7 common primitives (subagents / plan / ask-user / parallel / sandbox / memory / MCP). Source for unified entry design.
- `wiki/references/bagelcode-llm-judge-frontier-2026.md` — CourtEval ACL 2025 / G-Eval / Position bias IJCNLP 2025 / Self-bias NeurIPS 2024 / Multi-judge consensus 97-98% F1. Academic backbone for 3-layer scoring.
- `wiki/references/bagelcode-gamestudio-subagents-2026.md` — pamirtuna/gamestudio-subagents (193⭐) detailed analysis. Market validation of host harness pattern.
- `wiki/concepts/bagelcode-budget-guardrails.md` — analysis of post-verify ratchet runaway across three axes (max iteration / wall-clock / token cost). Documents the 5 guardrails currently enforced in `src/reducer/index.ts` and `src/loop/coordinator.ts`, the 8 gaps still open, sprint-demo thresholds, and a P0 implementation plan (4 guardrails, ~1.5h: `respec_count<=3`, `session_wall_clock<=30min`, `per_spawn_timeout<=5min` SIGTERM, `tokens_total<=50K`). Synced from mango-wiki ingest 2026-05-02T21:00:00Z.

### Changed — v3 (in progress)

- `protocol/schemas/message.schema.json`:
  - `from` enum: `engineering-lead` → split into `builder` + `verifier` (8 actors total, was 7).
  - `kind` enum: +`qa.result` (39 kinds, was 38). First-class deterministic ground truth event emitted by dispatcher (no LLM).
  - `scores`: replaced 6-dim legacy vocabulary (`goal_completion` / `collaboration` / `groundedness` / `actionability` / `cost_efficiency` / `intervention_response`) with D1-D6 source-of-truth matrix (`D1 spec_fit` / `D2 exec` / `D3 observability` / `D4 convergence` / `D5 intervention` / `D6 portability`); each dimension carries `score` + `source` (verifier-llm / qa-check-effect / reducer-auto / hybrid) + optional `lookup` / `evidence` / `auto` / `semantic` / `quality`. CourtEval msg-id refs (`grader_msg_id` / `critic_msg_id` / `defender_msg_id` / `regrader_msg_id`) added under `scores.courteval`.
  - `metadata`: +`harness` / `provider` / `adapter_session_id` / `cache_carry_over` / `deterministic` / `cross_provider` (for self-bias detection and adapter cache continuity per [[bagelcode-system-architecture-v3]] §3.6 + §5.2.2).
- `agents/`: `engineering-lead.md` removed; split into `agents/builder.md` (Builder + QA inline) + `agents/verifier.md` (CourtEval 4 sub-step inline + reviewer persona, superpowers code-reviewer pattern). Reason: cross-provider true split — builder=Codex / verifier=Gemini (or claude-code) requires actor-level provider boundary, not sandwich-internal step boundary.

### Added — implementation plan markers

- S2 spike: `scripts/spike-env-propagation.sh` — 30-min validation of env propagation across 3 host harnesses (Claude Code Task / Codex subagent / Gemini extension MCP) before specialist work begins. Result to be ingested as `wiki/synthesis/bagelcode-env-propagation-spike-2026-05-02.md`.

### Fixed

- `wiki/concepts/bagelcode-budget-guardrails.md` frontmatter — `[[bagelcode-fault-tolerance-design.md]]` → `[[bagelcode-fault-tolerance-design]]` (drop `.md` suffix) and `[[adaptive stop]]` → `[[bagelcode-final-design-2026|adaptive stop]]` (point to canonical doc). Provenance recomputed: stated 0.55/0.40/0.05 had drifted from actual 0.78/0.17/0.05 (4 inferred + 2 ambiguous markers across ~30 content claims).
- `wiki/synthesis/bagelcode-paperclip-vs-alternatives.md:42` — broken wikilink `[[paperclip-mcp]]` (target page never existed) replaced with plain text "Paperclip MCP".
- `wiki/bagelcode.md` (hub) — added a 2026-05-02 update banner pointing to `[[bagelcode-final-design-2026]]` as canonical lock; rewrote the "권장 방향" line so the verifier reads "CourtEval verifier" instead of the v2 "Gemini Verifier (cross-provider)" (which was dropped on cost grounds when Gemini was eliminated). Updated "결정 대기 중" todos to reflect resolved decisions (verifier=CourtEval, repo=public github, game=Phaser ≤60KB).

Note: 7 mid-version pages (`agents-fixed`, `caching-frontier-2026`, `task-direction`, `orchestration-topology`, `caching-strategy`, `fault-tolerance-design`, plus the hub before this fix) still reference Gemini as the verifier provider in body text. These are kept as historical evolution context — `final-design-2026.md` is the canonical answer; the hub banner now signals the supersession. Auto-rewrite of these 7 pages is left to the user's wiki maintenance pass.

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
