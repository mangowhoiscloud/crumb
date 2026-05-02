# Changelog

All notable changes to Crumb are documented here. Format: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), versioning: [SemVer 2.0.0](https://semver.org/). Pre-1.0: any breaking change is a minor bump, every other change is a patch.

## [Unreleased]

### Added — v3.1 Multi-host harness pivot (2026-05-02)

Universal identity layer + sandwich Markdown unification + multi-host entry verifier. Closes the "host-aware control harness" loop opened by v3.

- **`CRUMB.md`** (repo root, 174 lines) — Crumb runtime identity, host-agnostic. Sibling of `AGENTS.md` (Linux Foundation Agentic AI Foundation contributor identity); the two have separate responsibilities — `AGENTS.md` tells contributors how to work on this repo, `CRUMB.md` tells the host harness what Crumb is. 11 architecture invariants, 5 actor + 3 specialist + 5 skill flow, 39 kind schema, multi-host entry table, preset philosophy, universal Don't / Must.
- **`wiki/references/bagelcode-multi-host-harness-research-2026.md`** (~700 lines, 9 part) — research basis for the pivot. Part 1: 7 frontier cases verbatim (bkit-claude-code / claude-flow / contains-studio/agents / openclaw skills/coding-agent / hermes-agent / Linux Foundation AGENTS.md / gamestudio-subagents). Part 2: 7×6 dim matrix. Part 3: 5 핵심 발견 (host 위 universal control = D + F 둘 뿐). Part 4: Crumb 3-tier identity 청사진. Part 5: 차용/회피/신설 매트릭스. Part 6: 1차 5 결정. Part 7: context hierarchy 추가 4 사례 (Claude Code memory `@path` import / Cursor rules / Spec-kit `.specify/` / Gemini CLI extensions). Part 8: `.crumb/` 재정렬 3 옵션 비교 (절충안 권장). Part 9: 추가 5 결정.
- **Host entries import CRUMB.md + AGENTS.md as universal identity prelude**: `.codex/agents/crumb.toml` (developer_instructions §0), `.gemini/extensions/crumb/GEMINI.md` (header banner), `.gemini/extensions/crumb/commands/crumb.toml` (prompt §0). Pattern source: Spec-kit `.specify/memory/constitution.md` referenced by every host integration.
- **`crumb init` command** (`src/helpers/init.ts` + `src/cli.ts`) — multi-host entry verifier, distinct from `crumb doctor`. Verifies `CRUMB.md` / `AGENTS.md` + per-host entries (`.claude/skills/crumb`, `.codex/agents`, `.gemini/extensions/crumb`). Subcommands: `crumb init` (default = check all), `--host claude|codex|gemini`, `--format human|json` (human is default; json for scripts/CI). Exits non-zero on missing files. 7 vitest specs.

### Changed — v3.1

- **5 sandwiches converted from XML-in-Markdown wrapper to claude-code style pure Markdown** (per Part 7 contains-studio/agents + Linux Foundation AGENTS.md + multi-host research): `agents/coordinator.md` (routing-rules v3 — `build → qa_check → verifier`), `agents/planner-lead.md` (handoff target = `builder`, v2 `engineering-lead` retired), `agents/builder.md`, `agents/verifier.md`, `agents/builder-fallback.md` (builder substitute, v2 engineering-lead substitute retired). Tokenizer-friendly imperatives preserved: heading-as-command (`## Don't`, `## Must`, `## Reminders`), imperative bullets (❌ / STOP / Don't try), blockquote emphasis. All Korean narrative removed for English consistency. Ref: `wiki/references/bagelcode-multi-host-harness-research-2026.md` §Part 5.
- **`AGENTS.md`** updated to Linux Foundation Agentic AI Foundation v3 standard — 11 invariants (added v3: actor split / 3-tuple binding / user-controlled preset), file map updated for v3 (builder/verifier split, qa-runner.ts, preset-loader.ts, helpers/, multi-host entries), forbidden + must lists v3-aligned.
- **`.claude/skills/crumb/SKILL.md`** References section now imports `CRUMB.md` + `AGENTS.md` as the first two reference targets — the host loads them before any actor sandwich.

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

### Added — Observability P0 (Option B, 2026-05-02)

Implements the v3 §10 4-surface lock (minus `crumb diagram` — explicitly de-scoped) with Crumb Design System (CDS) v1 tokens and RESTful `/sessions/{id}/...` URL-as-file-path layout.

- **summary.html generator** (`src/summary/render.ts` + `src/summary/cds.ts`, ~700 LOC) — pure function (transcript, state) → single-file HTML. 6 sections (Artifacts iframe + spec/DESIGN refs, D1-D6 Scorecard with SourceBadge + radar, per-actor Cost stacked bar + cache hit, CourtEval 4 sub-step traces, filterable virtualized Timeline, F1-F7 Fault diagnosis). Inline CSS + inline JS + chart.js@4 CDN; ≤ 60KB own code mirrors DESIGN.md "single-file artifact" budget. 15 vitest specs.
- **TUI** (`src/tui/app.ts` + `src/tui/format.ts`, ~330 LOC) — blessed-based live observer. 4 panes (header / scrollable Timeline / agents+adapters / status / command input). Slash commands (`/approve /veto /redo /note /pause /resume /q`) write `user.*` events back through `TranscriptWriter` — same path as dispatcher, indistinguishable downstream. 10 vitest specs on the pure formatter; live screen tested via end-to-end mock run.
- **OTel GenAI exporter** (`src/exporter/otel.ts`, ~170 LOC) — alias-only mapping (no LLM). 3 formats: `otel-jsonl` (OpenTelemetry GenAI Semantic Conventions), `anthropic-trace` (Claude Console import), `chrome-trace` (chrome://tracing). 12 vitest specs covering attribute aliases, parent_event_id chain, per-actor `tid` lane assignment, latency-derived `dur`/`end_time_unix_nano`.
- **Auto-emit on session end** (`src/loop/coordinator.ts`) — when `state.done` becomes true, write `sessions/<id>/index.html` (RESTful summary view) + `sessions/<id>/exports/{otel.jsonl, anthropic-trace.json, chrome-trace.json}`. File path == URL path = identical behaviour for `file://` double-click and future `crumb observe` HTTP server.
- **Crumb Design System v1** (`src/summary/cds.ts`) — 8 token classes (color / typography / spacing / radius / shadow / breakpoint), 10 component vocab (ActorBadge / KindChip / DeterministicStar / CrossProviderBadge / VerdictPill / ScoreCell / SourceBadge / CostBar / MiniSpark / TimelineRow / AuditChip). TUI symbols ↔ HTML hex 1:1 — viewer cognitive load 0 across surfaces.
- **CLI subcommands**: `crumb tui <session-id|dir>`, `crumb export <session-id|dir> [--format otel-jsonl|anthropic-trace|chrome-trace]`.

### Added — v3 §12 5-helper completion + 3-host MCP registry (cross-host NL trigger)

Goal: user can speak natural Korean / English on any of the 3 hosts (Claude Code / Codex CLI / Gemini CLI) and have Crumb route the request to the right helper.

- **3 missing helpers** (`src/helpers/{status,explain,suggest}.ts`, ~480 LOC + 21 vitest specs):
  - `crumb status <session>` — recent N signal events + latest D1-D6 scorecard with source-of-truth + cost/cache/wall totals.
  - `crumb explain <kind>` — schema lookup over the full Kind union (40 entries: 4 system + 11 workflow + 5 dialogue + 5 step + 5 user + 3 handoff + 7 meta — wiki §3.3 mis-counted meta as 6). Did-you-mean for partials.
  - `crumb suggest <session>` — branching next-action recommendation: PASS+clean → /approve / PARTIAL → user judgment / FAIL → /redo+hint / stuck≥5 → /pause+/crumb debug / build pending → wait / done → open summary.
  - CLI subcommands wired in `src/cli.ts`.
- **MCP server** (`src/mcp-server.ts`, ~190 LOC, 2 vitest specs) — `@modelcontextprotocol/sdk@^1.29.0` stdio server exposing 7 read-only tools, named brand-forward to mirror the CLI subcommand 1:1 (precedent: OpenAI Codex CLI exposes its MCP tool as `codex` / `codex-reply`, server-name == tool-name): `crumb_config` / `crumb_status` / `crumb_explain` / `crumb_suggest` / `crumb_debug` / `crumb_doctor` / `crumb_export`. One vocabulary across CLI + MCP — no drift, brand instantly recognizable to the host model. Tool descriptions encode KO+EN trigger phrases — single source-of-truth registry shared across 3 hosts. Verified via stdio JSON-RPC smoke test (`initialize` → `tools/list` returns all 7).
- **3-host registration**:
  - `.mcp.json` (Claude Code project root) — registers `crumb` MCP server with `CRUMB_AMBIENT_HARNESS=claude-code`.
  - `.codex/agents/crumb.toml` `[mcp_servers.crumb]` — `CRUMB_AMBIENT_HARNESS=codex`.
  - `.gemini/extensions/crumb/gemini-extension.json` `mcpServers.crumb` — `CRUMB_AMBIENT_HARNESS=gemini-cli`, path corrected from `${extensionPath}/../../src/...` to `${workspacePath}/src/...`.
- **Claude Code sub-skills** (`.claude/skills/crumb-{config,status,explain,suggest,debug,doctor,export}/SKILL.md`, 7 files) — each frontmatter `description` carries explicit KO+EN trigger phrases, body says "prefer MCP tool, fall back to bash CLI". Eager-loaded by Claude Code skill discovery → faster NL match than waiting for MCP server boot.

### Added — Option B observability boosts (W4 / W5 / W6)

- **W4 sandbox audit** — timeline expand surfaces `tool.call.data.{cwd, add_dir, permission_mode}` + `metadata.adapter_session_id`. Anthropic gVisor pattern equivalent without their UI.
- **W5 F1-F7 fault diagnosis** — `summary.html §6 Faults` reuses `helpers/debug.ts diagnose()` (no transcript mutation). Detected faults render as red pills with suggested actions; clean session shows `CLEAR`. Reads metadata.cross_provider, kind=qa.result coverage, kind=error patterns, stuck_count.
- **W6 score-history MiniSpark + stuck pill** — header carries inline SVG sparkline of `score_history` aggregates (range 0-30) + verdict transitions (e.g., `18.0 → 27.0`) + colored stuck pill (0/5 ok / ≥5 err).

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
