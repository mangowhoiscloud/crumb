# Changelog

All notable changes to Crumb are documented here. Format: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), versioning: [SemVer 2.0.0](https://semver.org/). Pre-1.0: any breaking change is a minor bump, every other change is a patch.

## [Unreleased]

### Fixed — Real subprocess RCA: planner-lead "awaiting input" stall + observability + 3 minor (2026-05-02)

Closing a 4-issue cluster found while smoke-testing v3.3 against `--preset solo` real subprocess. Root-cause-oriented fixes after dispatcher observability made the silent failures visible.

- **Observability — pre-spawn + post-spawn `kind=note` events** (`src/dispatcher/live.ts`). Two new diagnostic events around every adapter spawn: (1) `dispatch.spawn → actor=X adapter=Y sandwich=...` BEFORE invoking the adapter, with `data.{actor,adapter,sandwich_path,has_prompt}`; (2) `adapter X streams (exit=N, Tms)` AFTER, with `data.{adapter,stdout_truncated,stderr_truncated,stdout_full_length,stderr_full_length}`. Both visibility=private + deterministic + tool=`dispatch-pre-spawn@v1` / `<adapter>-stream@v1` so anti-deception/verifier ignore them but `crumb debug` can read them. Without these, an exit-0-but-silent spawn was indistinguishable from a successful run.
- **Planner-lead "awaiting input" stall** (`src/reducer/index.ts` goal case). Symptom: real run exited in 12s with 0 transcript events from the planner. Pre-spawn note showed dispatcher reached claude-local successfully; post-spawn note captured stdout=`Planner-lead spawn ready. Awaiting kind=goal (or spec.update) input with the design target before starting step 1 (socratic round).` — Claude responded to the generic kickoff `'Continue your role per the system prompt.'` with a status check instead of acting on the transcript. Fix: the `goal` case in the reducer now passes a structured prompt `User goal: <body> + Begin your turn now per the system prompt — read $CRUMB_TRANSCRIPT_PATH for full context and execute step 1 (Socratic round).` Reducer test updated to assert the new prompt shape.
- **Adapter kickoff fallback rewritten** (`claude-local.ts` + `codex-local.ts` + `gemini-local.ts`). When a spawn arrives without an explicit prompt, instead of `'Continue your role per the system prompt.'` (status-check ambiguous), use `'Begin your turn now. Read $CRUMB_TRANSCRIPT_PATH for full context (latest goal, spec, qa.result, etc.) and execute the next step per the system prompt. Do not wait for additional input.'` Action-oriented + names the transcript path explicitly.
- **Codex CLI `--skip-git-repo-check`** (`codex-local.ts`). Direct codex probe revealed: `Not inside a trusted directory and --skip-git-repo-check was not specified.` — codex 0.123.0 refuses `exec --cd <session-workspace>` because session dirs aren't git repos. Adding the flag unblocks the builder spawn. (Separate architectural issue: preset's `model` field is informational only, not passed to codex via `--model`. ChatGPT-account users will still see model-rejection errors. Out of scope for this fix.)
- **`--root` flag conflation** (`src/cli.ts`). Twelve session-resolving commands (`replay/resume/debug/status/suggest/tui/export/ls/release/copy-artifacts/versions/migrate`) were using `args.flags.get('root') ?? process.cwd()` for project resolution — meaning `--root` would override the user's actual cwd's pin file. Fix: those commands now use `process.cwd()` unconditionally; `--root` is reserved for `cmdRun/cmdConfig/cmdInit/cmdModel` (preset/agents/config loading). Pin file in cwd always wins for session resolution.
- **Test count**: 521/521 (was 254 before observability rebase + parallel sessions added researcher/preset tests).

### Changed — Verifier default → `gemini-3-1-pro` + dot/dash NL alias + swap cookbook (2026-05-02)

Three coupled changes addressing the question "왜 verifier가 아직 `gemini-2.5-pro`?" + "갈아끼우기를 한 페이지에서 보고 싶다":

- **Verifier seat default**: bumped `gemini-2.5-pro` → `gemini-3-1-pro` (top of `MODEL_CATALOG.google`) across `.crumb/config.toml`, `defaultConfig().actors.verifier.model`, `HARNESS_DEFAULT_MODEL` (gemini-cli + google-sdk fallbacks), `.crumb/presets/sdk-enterprise.toml`, and surface docs (README / README.ko / AGENTS / GEMINI / `.claude/skills/crumb/SKILL.md` / `.claude/skills/crumb-model/SKILL.md` / `agents/verifier.md` provider_hint / cli.ts / mcp-server.ts crumb_model description). Test fixtures and regression specs follow the rename. **`gemini-2.5-pro` stays in the catalog as a fallback option** — users wanting the older model can still set it explicitly.
- **NL parser dot/dash alias**: `applyNlInstruction()` now normalizes `<digit>.<digit>` ↔ `<digit>-<digit>` on both sides of the catalog compare, so the user can say either "verifier 모델을 gemini-3.1-pro 로" (Google API canonical) or "verifier 모델을 gemini-3-1-pro 로" (catalog form) — the saved value is whichever form the catalog stores. Reverse alias also works (`gemini-2-5-pro` resolves to `gemini-2.5-pro`). +4 specs in `src/tui/model-edit.test.ts`.
- **Swap cookbook** in `.claude/skills/crumb/SKILL.md`: a single section listing all model / provider / actor swap surfaces — A) static `.crumb/config.toml` via MCP / CLI / direct edit, B) dynamic mid-session via TUI slash bar / `inbox.txt` / JSON event (`/swap`, `/goto`, `/append`, `/reset-circuit`, `data.target_actor`, `data.sandwich_append`), C) preset-level `--preset <name>` at session start. Includes a one-glance "X 를 Y 로 갈아끼우기" lookup table. Frontier-link references `bagelcode-user-intervention-frontier-2026-05-02.md` and `bagelcode-scoring-ratchet-frontier-2026-05-02.md`.

Test suite total **278/278** (main's local count + 4 new dot/dash alias specs).

### Changed — D3/D5 split into single-origin dims, drop `'hybrid'` source (2026-05-02)

Every score dimension now reports a single origin in `scores.D*.source`: `verifier-llm` | `qa-check-effect` | `reducer-auto`. The prior `'hybrid'` value forced the verifier and reducer components into one number that the LLM emitted, which (a) duplicated information already carried by the `auto` / `semantic` / `quality` fields and (b) created an attack surface where the verifier could inflate the merged score (mitigated previously by anti-deception Rule 5).

The split:
- Verifier emits D3/D5 with `source='verifier-llm'`, `score`=its LLM component (0-5).
- Reducer computes the auto component independently via `computeAutoScores()`.
- `combineDimScore()` in `src/state/scorer.ts` averages the two halves in code — a single function the verifier cannot influence.
- `combineAggregate()` recomputes the /30 aggregate using the deterministic combine.

Anti-deception Rule 5 (`verifier_inflated_hybrid`) is removed — there is no merged score for the LLM to inflate. Rules 1-4 are unchanged. Verifier sandwich (`agents/verifier.md`) updated: D3/D5 instructions tell the LLM to emit only its component, never pre-blend.

Frontier alignment: matches the "verifiable reward + LLM rubric kept separate" pattern in RLVR (Lambert et al. 2024) and Anthropic's 2026 hybrid-norm guidance — but the source label itself is now single-origin so the schema mirrors the runtime architecture.

Changes:
- **`protocol/schemas/message.schema.json`** — `source` enum 4→3 values, D3/D5 descriptions updated.
- **`src/protocol/types.ts`** — TS union 4→3, ScoreDimension JSDoc clarified.
- **`src/state/scorer.ts`** — `combineDimScore()` + `combineAggregate()` added (pure, replay-deterministic).
- **`src/validator/anti-deception.ts`** — Rule 5 removed, aggregate recomputation delegates to `combineAggregate`.
- **`src/validator/anti-deception.test.ts`** — Rule 5 spec replaced with split-after-combine assertion.
- **`src/summary/render.ts`** + **`cds.ts`** — `source-hybrid` CSS / dispatch removed.
- **`src/adapters/mock.ts`** + **`src/summary/render.test.ts`** + **`src/session/version.test.ts`** — fixtures updated.
- **`agents/verifier.md`** — sandwich instructions ("Do NOT pre-blend"), source matrix table refreshed.
- **`AGENTS.md`** + **`.claude/skills/crumb/SKILL.md`** — invariant #4 wording + skill router source-list synced (this PR).

**Breaking**: legacy transcripts that emitted `source='hybrid'` will fail validation under the new enum. Intentional — anyone replaying a v0.x session needs to migrate. v3.3 is the first submission cycle so real impact is minimal.

PR: #27 (refactor) + this PR (docs sync).

### Added — Playwright smoke run real implementation + opt-in strict gate (2026-05-02)

Implements P0-2 of the scoring+ratchet frontier survey (`wiki/synthesis/bagelcode-scoring-ratchet-frontier-2026-05-02.md` §7). Frontier backing: SWE-bench Verified 2025 top10 / Cognition Devin "Don't Build Multi-Agents" Jun 2025 / DeepSeek-R1 Jan 2025 — all converge on rule-based exec gate as the strongest D2 / D6 ground truth.

- **`src/effects/qa-check-playwright.ts`** — replaced the 6-line stub with a real Chromium smoke: launch headless → `file://${artifact}` → wait up to 5s for `<canvas>` (Phaser 3.80 boot signal) → watch console + page errors for 1.5s → fail with `reason` on missing canvas, console error, or page error. Single-browser gate (chromium) covers the SWE-bench-style P0 ground truth; firefox+webkit cross-browser is P1.
- **`src/effects/qa-check.ts`** — Playwright detection now auto-detects via dynamic import (no more `PLAYWRIGHT_AVAILABLE=1` opt-in). New env contract:
  - **default** (Playwright not installed) — `first_interaction='skipped'`, `lint_findings` includes guidance (`'playwright not installed (D6 portability unverified); install: npm i -D playwright && npx playwright install chromium'`), `exec_exit_code` unchanged. Signaling without breaking existing runs.
  - **`CRUMB_QA_REQUIRE_PLAYWRIGHT=1`** (strict gate, recommended for CI) — missing Playwright → `first_interaction='fail'`, `exec_exit_code=1`. Forces D2/D6 ground truth.
  - **`CRUMB_QA_PLAYWRIGHT_OPTIONAL=1`** — silent skip (suppresses the warning finding). Backward-compat for environments that explicitly don't want Playwright.
  - Smoke success → `first_interaction='ok'`, `cross_browser_smoke='ok'`. Smoke failure → `first_interaction='fail'`, `exec_exit_code=1`, finding carries the smoke reason.
- **`src/effects/qa-check.test.ts`** (NEW) — 10 specs covering: mock fallback (.mock.html / missing artifact), lint + size checks, all 5 Playwright detection branches (default missing, REQUIRE strict-fail, OPTIONAL silent skip, smoke success, smoke fail, smoke runtime error). Suite total **246/246** (was 236).
- Anti-deception synergy: `validator/anti-deception.ts` already forces `D2=0` when `verdict=PASS && exec_exit_code != 0`. With Playwright smoke now enforcing real failure modes (no canvas / console error / page error), the anti-deception layer gains genuine teeth — a builder can no longer ship a syntactically lint-clean file that crashes on load.

**Scope notes**:
- This PR is **opt-in strict** (CI not yet mandatory). The CI workflow update to `npx playwright install --with-deps chromium` + `CRUMB_QA_REQUIRE_PLAYWRIGHT=1` is queued as a follow-up after the Bagelcode submission deadline (2026-05-03 23:59 KST), to avoid pre-deadline CI infra risk.
- `playwright` is **not** added as a direct dep — kept as an optional peer (dynamic import, runtime string-built module name to bypass `tsc --noEmit`). Local installation (`npm i -D playwright && npx playwright install chromium`) immediately activates the real smoke for any user / evaluator who wants D2/D6 ground truth.

### Fixed — `.crumb/config.toml` schema drift + verifier effort=high default (2026-05-02)

Implements P0-1 of the scoring+ratchet frontier survey (`wiki/synthesis/bagelcode-scoring-ratchet-frontier-2026-05-02.md` §7). Two coupled gaps fixed:

- **Schema drift**: the committed `.crumb/config.toml` used the v2 layout (`[agents.coordinator]`, `[agents.engineering-lead]`, `thinking_effort`) while `loadConfig()` since the model-config UI ship has expected v3 (`[actors."<name>"]`, `[providers."<id>"]`, `effort`). Result: `loadConfig()` was silently falling through to `defaultConfig()` at runtime. The TUI / `crumb_model` MCP tool saved correctly in v3, but the seed file shipped with the repo was unparseable as overrides — a fresh checkout's first run got nothing user-tunable from the seed.
- **Verifier extended thinking default**: rewrote the seed in v3 layout with explicit `effort = "high"` on every actor, with comments citing **Snell et al. ICLR 2025** ("Scaling LLM Test-Time Compute Optimally" — test-time compute 4× ≈ 14× pretrain) and **CourtEval ACL 2025** (multi-role +12.4%). Verifier is the highest-leverage actor — Critic / Defender steps benefit most from extended thinking budget.

Changes:
- **`.crumb/config.toml`** — full rewrite to v3 layout. 5 actors, 3 providers, `effort = "high"` on all. Header documents resolve order + effort mapping + frontier backing.
- **`src/config/model-config.test.ts`** — +3 regression specs locking the committed config: (a) verifier effort=high + harness=gemini-cli + model=gemini-2.5-pro, (b) all 5 actors carry effort=high (no silent low/med drift), (c) all 3 local providers enabled. Suite total 236/236 (was 233).

**Limitation acknowledged**: this PR is signaling-only at the dispatcher → adapter boundary. The adapters (`claude-local`, `codex-local`, `gemini-local`) do not yet pass `effort` to the underlying CLI flags (`--reasoning-effort` exists for codex; Anthropic / Gemini extended thinking is API-only and not exposed by `claude -p` / `gemini -p`). Adapter-level effort plumbing is queued as the next ratchet step (codex-local first; Anthropic/Gemini wait for SDK adapter ships).

### Added — Scoring + ratchet frontier survey (2026-05-02)

`wiki/synthesis/bagelcode-scoring-ratchet-frontier-2026-05-02.md` ingested. Frontier verdict on whether the multi-agent "scoring + ratchet" pattern (verifier produces D1-D6 → iterate until PASS or variance-based adaptive_stop) actually raises quality, and what 2026 alternatives exist.

- **Validity evidence** (CourtEval ACL 2025 +12.4%, Reflexion HumanEval +11pp, Self-Refine HumanEval +8.7pp, Khan NeurIPS 2025 multi-agent debate +8.7%, Arena-Hard ρ=0.89 vs human votes).
- **Failure modes with magnitudes** — position bias 65-75% (Wang IJCNLP-AACL 2025), self-preference +6% (Panickssery NeurIPS 2024), sycophancy 47-58% (Sharma ICLR 2024), Goodhart divergence after round 4 (Eisenstein DeepMind 2024), same-provider verifier inflation +14-22% (Stureborg EMNLP 2024).
- **2026 frontier convergence** on deterministic gate + verifier test-time compute. Multi-agent debate / PRM / self-refine retreating in production (AutoGen 0.4 single-agent first / Cognition Devin "Don't Build Multi-Agents" Jun 2025 / DeepSeek-R1 PRM polished → rule-based reward / SWE-bench top10 all exec-based).
- **Crumb alignment matrix** — defends ~60-70% of 2026 failure modes (qa_check D2/D6 ground truth + CourtEval intra-debate + variance adaptive_stop + append-only ULID); exposed gaps: verifier self-bias enforcement (G-A), Goodhart drift cap (G-B), length normalization (G-C), composite gaming (G-D), Playwright optional → required (G-E).
- **P0 recommendations queued for follow-up PRs**: (1) verifier extended thinking default high in presets, (2) Playwright smoke run mandatory in qa-runner.

### Fixed — Codex CLI rejects `--prompt` flag (positional only) (2026-05-02)

Followup to PR #23. Real subprocess demo with `--preset solo` (model-config override binds builder=codex+gpt-5.5-codex) crashed at the first builder spawn: `error: unexpected argument '--prompt' found. tip: to pass '--prompt' as a value, use '-- --prompt'. Usage: codex exec [OPTIONS] [PROMPT]`. Codex 0.123.0 takes the prompt as a **positional** argument; the `--prompt` flag never existed (the original conditional `['--prompt', req.prompt]` was wrong even before PR #23 — it just never fired because callers omitted the prompt).

- **`src/adapters/codex-local.ts`** — pass `promptText` as the trailing positional, drop `--prompt` flag entirely. Other adapters (claude / gemini) still use `-p <text>` per their CLI grammar.

### Fixed — Adapter empty-prompt crash blocks every real subprocess run (2026-05-02)

Discovered while smoke-testing v3.3 against `--preset solo`: every real subprocess spawn died on the first actor with `error: Input must be provided either through stdin or as a prompt argument when using --print` (claude-local exit 1 in 3.7s). Root cause: most reducer spawn effects (goal → planner-lead, spec → builder, qa.result → verifier, fallback → builder-fallback) intentionally omit `prompt` because the actor's job is fully described by the sandwich — but the adapters then forwarded `req.prompt ?? ''` to the host CLI, and `claude -p ""` / `gemini -p ""` reject empty input. Codex's `exec --prompt <text>` was conditionally appended, so codex sat waiting on stdin instead of crashing.

- **`src/adapters/claude-local.ts`** + **`gemini-local.ts`** + **`codex-local.ts`** — when `req.prompt` is missing or whitespace-only, fall back to `'Continue your role per the system prompt.'` Codex now always receives `--prompt <text>` (no more conditional append).
- Why a single generic kickoff is right: the sandwich (`agents/<actor>.md`) is the canonical role spec; the prompt is just the wake-up signal. Each actor's first turn is supposed to read the sandwich + `task_ledger` (via `agent-workspace`) and act. A generic kickoff doesn't bias the actor toward any particular branch.
- This unblocks every real run with `--preset solo` / `bagelcode-cross-3way` / `sdk-enterprise`. Mock adapter was unaffected (it never touches CLI prompts).



Closes the v3.3 storage refactor by giving v3.2-and-older users a one-shot move into the new `~/.crumb/projects/<id>/sessions/` layout.

- **`src/session/migrate.ts`** (~110 LOC, 7/7 vitest specs) — `migrateLegacySessions({ cwd, dryRun })` scans `<cwd>/sessions/` and `fs.rename`s each session dir into `~/.crumb/projects/<sha256(canonical(cwd))[:16]>/sessions/`. Atomic per session (single syscall on most filesystems). Idempotent — destination collisions are reported as `already-migrated` and the source is left intact (no data loss). Empty legacy dir is `rmdir`'d after a clean sweep.
- **`crumb migrate [--dry-run]`** — wires the helper. Per-session report with action ∈ `moved | already-migrated | collision | skipped`. `--dry-run` previews the plan without touching disk.
- **Test**: 224/224 (was 217; +7 migrate specs). Mock e2e: 2 legacy sessions → dry-run → real migrate → both at new location → empty legacy dir removed → 2nd run reports `nothing to migrate`.

### Added — `crumb copy-artifacts` — v3.3 Phase 2c (2026-05-02)

Closes the Bagelcode submission UX loop. Reviewers expect `cd crumb && open demo/game.html` to just work; with sessions now under `~/.crumb/projects/<id>/`, the user needs an explicit copy step.

- **`crumb copy-artifacts <session-id|vN> --to <dest>`** — pure `copyFile` (no symlinks) of every file under `artifacts/` into `<dest>`. Accepts both raw session ULID and version names (`v1`, or full `v2-combo-bonus`). Version lookup tolerates label-less queries: `crumb copy-artifacts v1 --to ./demo/` resolves to whatever dir matches `v1` regardless of label slug.
- **Submission story**: `crumb run "..." --label "bagelcode-final"` → `crumb release <ulid> --as v1 --label "bagelcode"` → `crumb copy-artifacts v1 --to ./demo/` → `git add demo/`. Three commands, no symlinks, single-direction copy.
- **Test**: 217/217 (no test additions — covered by mock e2e). Verified copying from both session ULID and version name resolves the same artifact set.

### Added — Version graph: `crumb release` + `crumb versions` — v3.3 Phase 2b (2026-05-02)

Sessions become *promotable* — `crumb release <session-ulid>` snapshots a WIP session into an immutable milestone under `~/.crumb/projects/<id>/versions/<vN>[-<label>]/` with a TOML manifest, sha256-keyed frozen artifacts, and a `kind=version.released` event appended to the source transcript so replay re-derives the milestone. Realizes the v0.dev (Project → Chat → Version) + Lovable (favorited milestone vs auto-history) hybrid that Phase 1 reserved space for.

- **`src/session/version.ts`** (~150 LOC, 20/20 vitest specs) — VersionManifest schema v1: `{ name (e.g. v2), label?, released_at, source_session, source_event_id?, parent_version?, goal?, scorecard {D1-D6 + aggregate + verdict}, artifacts_sha256 }`. Helpers: `versionDirName(name,label)` (slugifies label → `v2-combo-bonus`), `nextSequentialVersion(dir)` (scans `^v(\d+)` to find next), `readAllManifests` / `readManifest` / `writeManifest` (TOML via @iarna/toml), `deriveScorecard(events)` (last `judge.score`), `deriveSourceEventId(events)` (`done` → last `judge.score` → last event), `snapshotArtifacts(sessionDir,versionDir)` (real `copyFile` per file with sha256, no links).
- **`crumb release <session-ulid> [--as vN] [--label "<name>"] [--no-parent]`** — auto-numbers `v<N>` by default; `--as v3` overrides; `--label` slugifies into the dir name; `parent_version` is auto-detected as the latest existing manifest unless `--no-parent`. Refuses to overwrite an existing version dir. Appends `kind=version.released` (system, deterministic, tool=`crumb-release@v1`) with `data: { version, label, parent_version, source_event_id, manifest_relpath }` — `manifest_relpath` is project-relative (`versions/<dir>/manifest.toml`) so transcripts replay portably across machines.
- **`crumb versions`** — lists all manifests sorted by `released_at` ascending with `← parent` chain notation, label tag, verdict, aggregate. `[latest]` footer surfaces the head.
- **Test**: 217/217 (was 197; +20 version specs). Mock e2e: `init --pin` → `run` → `release v1 --label first-pass` → `release v2 --label second-pass` → `versions` shows v1 + v2 (parent ← v1) + transcript carries 2 `kind=version.released` events.
- **Frontier basis**: v0.dev's structural rigor (Project → Chat → Version DAG with Fork API), Lovable's favorited-stable-version UX (descriptive labels), Replit's checkpoint metadata richness (scorecard + source pointer). Sequential `v<N>` chosen over pure-descriptive (Replit/Lovable) for `ls versions/` sortability and over opaque ID (v0/Cursor/Cline) for human "the v3 feels too easy" mental model — research recommendation realized.

### Added — Session lifecycle (meta.json) + project pin (`crumb init --pin`) — v3.3 Phase 2a (2026-05-02)

Session lifecycle becomes O(1) inspectable without scanning the transcript head, and projects can survive cwd renames. Builds on Phase 1's `~/.crumb/projects/<id>/` storage hierarchy.

- **`src/session/meta.ts`** (90 LOC, 8/8 vitest specs) — `meta.json` writer/reader. Schema v1: `{ session_id, status: running|paused|done|error|killed, started_at, ended_at?, goal?, preset?, parent_session_id?, fork_event_id?, label? }`. **meta.json is a cache** — losing it doesn't break replay (state derives from transcript). It exists for fast lifecycle lookup by `crumb ls` and forthcoming `crumb resume` / `crumb fork`.
- **`crumb run` writes meta.json** at session start (status=running), updates on completion (status=done | paused based on `state.done`, fills `ended_at`), updates on exception (status=error). Idempotent on re-run with same `--session <id>` — flips existing meta back to running rather than overwriting.
- **`crumb init --pin [--label "<name>"]`** — pins the cwd to a fresh ULID written to `<cwd>/.crumb/project.toml`. Subsequent `crumb run` from this cwd (or any cwd that contains the same pin file) resolves to the same `~/.crumb/projects/<ULID>/` regardless of directory rename. Without `--pin`, `crumb init` keeps its existing multi-host entry verifier behavior. Idempotent — re-running on a pinned cwd reports the existing project_id and exits.
- **`crumb ls` enriched**: shows `[status]` tag (running/paused/done/error/killed) and a truncated goal alongside event count + size. Works for both new sessions (with meta.json) and legacy sessions (falls back to `[legacy]` tag without status).
- **`crumb run --label "<name>"`** new flag — passes through to `meta.json.label` for human-readable session labeling.
- **Test**: 197/197 (was 189; +8 meta specs). Mock e2e verified — `crumb init --pin` writes a TOML pin file, `crumb run` from that cwd resolves to the pinned ULID's project dir, meta.json lifecycle full (started_at + ended_at + status=done), `crumb ls` shows status tag.

### Added — Session storage hierarchy v3.3: `~/.crumb/projects/<id>/{sessions,versions}/` (2026-05-02)

Sessions move out of `<cwd>/sessions/` into a per-user, per-project global store. Project-first hierarchy modeled on **v0.dev (Project → Chat → Version)** + **Cline (`tasks/` vs `checkpoints/` filesystem split)**, with project-id derived from `sha256(canonical(cwd))[:16]` (Cursor's `workspaceStorage` pattern, avoiding Claude Code's lossy dash-encoding). Schema additions are additive — existing transcripts replay unchanged; legacy `<cwd>/sessions/` still resolves via fallback until `crumb migrate` (Phase 3).

- **`src/paths.ts`** (139 LOC, 18/18 vitest specs) — single source for every on-disk path. Helpers: `getCrumbHome()` (honors `CRUMB_HOME` env override for tests), `projectIdFromCwd()`, `resolveProjectId()` (pin file `<cwd>/.crumb/project.toml` → `id` first, ambient sha256 fallback), `getProjectDir()`, `getSessionsDir()`, `getSessionRoot()`, `getVersionsDir()`, `getActorWorkspace()`, `getArtifactsDir()`, `resolveSessionDir()` (path | new-global | legacy-`<cwd>/sessions/` triple resolution), `ensureCrumbHome()` / `ensureProjectDir()` / `ensureSessionRoot()`.
- **3 new transcript kinds (40 → 43)** in `protocol/schemas/message.schema.json` + `src/protocol/types.ts`: `session.forked` (system, fork pointer event), `version.released` + `version.refinement` (new `version` category for immutable milestones under `versions/<vN>/`). `src/helpers/explain.ts` registry + tests updated. `protocol/schema.md` count synced to 43.
- **5-layer hierarchy markers** added as optional sub-objects in `metadata`: `metadata.crumb.{run_id, turn_id, parent_session_id, fork_event_id}` (project → session → run → turn → step → event; reducer-derived in Phase 2) and `metadata.gen_ai.{conversation_id, agent_id, workflow_name}` (OpenTelemetry GenAI Semantic Conventions aliases — `conversation_id ≡ session_id`, `agent_id ≡ from`, `workflow_name = 'crumb.coordinator'`).
- **`src/cli.ts`** — `cmdRun` writes new sessions to `~/.crumb/projects/<id>/sessions/<ulid>/` via `ensureSessionRoot`. `cmdReplay` / `cmdResume` / `cmdDebug` / `cmdStatus` / `cmdSuggest` / `cmdTui` / `cmdExport` accept bare ULIDs and resolve through `resolveSessionDir` (new-global first, legacy-cwd fallback). `cmdLs` lists the project's sessions and surfaces any legacy `<cwd>/sessions/` entries with a `[legacy]` tag until migration.
- **`src/mcp-server.ts`** — local `resolveSessionDir` removed; uses `paths.ts` version. All MCP tools (status / suggest / debug / explain / export) now resolve sessions consistently with the CLI surface.
- **Frontier basis** (research-backed): v0.dev (Project → Chat → Version + Fork Chat API), Cline (filesystem split: `tasks/<task-id>/` for sessions + `checkpoints/<workspace-hash>/.git/` for snapshots — global, footgun #2550 avoided here via per-project sha256), Cursor (`sha256(cwd)`-based `workspaceStorage`), Lovable (favorited milestone vs auto-history split), Replit (Checkpoint = files + conversation + DB schema + AI label). Paperclip is a BYO actor-binding precedent only — its DB-backed model is not relevant to versioning. Naming `v<N>` sequential + optional `--label <name>` is the recommendation that combines v0's structural rigor with Lovable's descriptive UX while preserving `ls versions/` sortability.
- **Deferred to Phase 2** (next PR): `meta.json` per session + reducer-derived `run_id`/`turn_id`, `crumb init --pin` (writes `<cwd>/.crumb/project.toml`), `crumb release <ulid> [--as vN] [--label X]` (immutable milestone + manifest.toml), `crumb versions` (parent-chain listing), `crumb fork <ulid> --at <event-id>` (pointer-only fork via `kind=session.forked`), `crumb export <ulid|vN> --to <dest>` (artifact copy, no link).
- **Deferred to Phase 3**: `crumb migrate` to relocate legacy `<cwd>/sessions/` into `~/.crumb/projects/<id>/sessions/`. Idempotent.

### Changed — Entry-MD user-intervention guidance (2026-05-02)

Closes the audit's punch-list item #3-#4 ("Entry MD natural-language parsing" + "Coordinator sandwich lacks user.* dispatch guidance"). Every host entry and the coordinator sandwich now document the same 3-surface × 6-data-field user-intervention contract in one voice. Mail requirement #2 (사용자가 협업 과정에 개입) end-to-end coverage: reducer + dispatcher (G1-G6 + G4) → TUI/inbox/JSON event surfaces (PR #16) → host-entry guidance (this PR).

- **`agents/coordinator.md`** — Routing Rules table expanded from 2 user.* entries to 12 (5 user.intervene `data.*` branches + 4 user.pause/resume branches + user.approve + user.veto). Task Ledger Rules updated for the `sandwich_append` fact category. New "User-intervention surfaces" reminder names the 3 modalities (TUI / inbox.txt / `crumb event` JSON shell) and confirms they all write the same JSONL line.
- **`.claude/skills/crumb/SKILL.md`** §4 — single JSON example replaced with full 3-surface guide + 6-row `data` field semantics table + frontier matrix references.
- **`.codex/agents/crumb.toml`** §6 — 3-line bullet list replaced with full surface comparison; Codex shell environment gets `inbox.txt` as the 1순위 surface.
- **`.gemini/extensions/crumb/commands/crumb.toml`** §4 + **`.gemini/extensions/crumb/GEMINI.md`** "사용자 개입" — same expansion adapted to Gemini CLI's verifier-multimodal seat.
- Frontier alignment: LangGraph `Command(goto/update={...})` 53/60 + Paperclip BYO swap 38/60 + Codex `APPEND_SYSTEM.md` 38/60. Backing: `wiki/synthesis/bagelcode-user-intervention-frontier-2026-05-02.md`.
- PR #18.

### Changed — TUI slash bar unifies grammar with inbox parser (2026-05-02)

Audit after PR #14 found the TUI was a second-class intervention surface: `handleCommand` mapped 7/11 slash commands and dropped every `data` field on the floor (`target_actor` / `goto` / `swap` / `reset_circuit` / `actor` / `sandwich_append`). G1-G6 + G4 all worked through `inbox.txt` but were invisible to TUI users.

- **`src/tui/app.ts`** — `handleCommand` now delegates to `parseInboxLine`. The TUI slash bar and the headless `inbox.txt` watcher share one grammar source. Quit (`/q`, `/quit`) is the only TUI-local case. Bar label refreshed to advertise `/approve /veto /pause /resume /goto /swap /reset-circuit /append /note /redo /q · @actor msg`.
- **`src/inbox/parser.ts`** — added `/append [@<actor>] <text>` (G4 sandwich override, broadcast or actor-scoped), `/note <text>` (kind=note free-form annotation), `/redo [body]` (alias for free-text intervene; preserves TUI muscle memory).
- **Tests**: +8 parser specs (4 for `/append`, 2 for `/note`, 2 for `/redo`); suite total 171/171 (was 163).
- Mail requirement #2 (사용자가 협업 과정에 개입) coverage: TUI is now an equal-citizen intervention surface alongside `inbox.txt`. PR #16.

### Added — G4 sandwich override pipeline (2026-05-02)

Closes the v3.2 G4 gap from the user-intervention frontier matrix: a user mid-session can persistently augment any actor's system prompt without restarting (LangGraph `Command(update={...})` pattern, 53/60 frontier score; Codex `APPEND_SYSTEM.md` 38/60 inspires the file-based local override surface).

- **`kind=user.intervene` with `data.sandwich_append`** records a fact of category `'sandwich_append'`. Optional `data.target_actor` scopes the append to a single actor; absent target broadcasts to every spawn. Stored as a fact, so replay reconstructs identical assemblies.
- **`SpawnEffect.sandwich_appends: { source_id; text }[]`** — every spawn carries the matching append list collected by the reducer's new `collectSandwichAppends()` helper. 7 emit sites updated (goal, spec, qa.result, verify FAIL → fallback, user.veto, user.intervene goto, user.resume queued).
- **Dispatcher `assembleSandwich()`** — concatenates base `agents/<actor>.md` + per-machine `agents/<actor>.local.md` (when present) + runtime appends into `sessions/<id>/agent-workspace/<actor>/sandwich.assembled.md` and points the adapter at that path. When there are no local files and no appends, returns the base path unchanged (no FS write — preserves v3.1 behavior for sessions that don't exercise the override surface).
- **`agents/*.local.md` gitignored** — per-machine, never committed. Pattern adapted from Codex CLI `APPEND_SYSTEM.md`.
- **Tests**: 5 reducer specs (fact creation, target scoping, scope isolation, untargeted broadcast, append accumulation) + 4 dispatcher specs (passthrough, base+appends assembly, local file inclusion, base→local→append ordering). Suite total 163/163 (was 144).
- **Mail requirement #2 (사용자가 협업 과정에 개입)** coverage rises from G3-only routing (`target_actor` / `goto`) to full runtime sandwich rewriting. PR #14.

### Added — Model + Provider config UI (2026-05-02)

Per-actor model + effort tuning, per-provider activation toggle, and `/model` natural-language interface. All 3 hosts (Claude Code / Codex CLI / Gemini CLI) get the same surface via the MCP `crumb_model` tool.

- **High-end defaults** (no preset / no override): `coordinator` + `planner-lead` = `claude-opus-4-7`, `builder` = `gpt-5.5-codex`, `verifier` = `gemini-2.5-pro`, `builder-fallback` = `claude-sonnet-4-6`. All 3 local providers (`claude-local` / `codex-local` / `gemini-cli-local`) enabled. `effort = "high"` across the board.
- **`src/config/model-config.ts`** (~230 LOC, 17 vitest specs) — `.crumb/config.toml` runtime override layer. `MODEL_CATALOG` per provider (Anthropic: opus-4-7 → sonnet-4-6 → haiku-4-5; OpenAI: gpt-5.5-codex → gpt-5.5 → gpt-4o → gpt-4o-mini; Google: gemini-2.5-pro → gemini-2.5-flash → gemini-2.0-flash). `EFFORT_LEVELS` = `low | med | high` mapped to provider-specific values at adapter spawn (OpenAI `reasoning.effort=low|medium|high`, Anthropic / Gemini thinking_budget = 8000 / 24000 / 64000 tokens).
- **`src/tui/model-edit.ts`** (~280 LOC, 10 vitest specs) — `crumb model` blessed TUI. Tab cycles actors, ↑/↓ changes model in catalog, ←/→ changes effort (low ↔ med ↔ high), `h` cycles harness (claude-code / codex / gemini-cli / mock), `p` focuses providers panel, Space toggles enabled, Enter saves, Esc cancels. Read-only `--show`. Programmatic `applyNlInstruction()` parses Korean + English NL ("verifier 모델을 gemini-2.5-pro 로", "effort 다 high 로", "codex 비활성화", "disable gemini", "set builder model to gpt-4o-mini").
- **MCP tool `crumb_model`** added to `src/mcp-server.ts` (now 8 tools total; was 7). Optional `instruction` arg routes to `applyNlInstruction()`; omitted = read-only show. Brand-forward CLI parity preserved (`crumb model` ↔ `crumb_model`).
- **Claude Code skill** `.claude/skills/crumb-model/SKILL.md` — KO+EN trigger phrases, eager-loaded by skill discovery.
- **Resolve order extended** (`src/dispatcher/preset-loader.ts`): `.crumb/config.toml` override (★ NEW) → preset.actors.<name> → preset.[defaults] → ambient → system fallback. New `loadPresetWithConfig()` + `applyConfigOverride()` returns `{ preset, providersEnabled }`.
- **Provider activation gate** (`src/dispatcher/live.ts`) — at spawn time, if binding's harness has been disabled in `.crumb/config.toml [providers.*]`, dispatcher substitutes `claude-local` (universal fallback) and emits `kind=note` with `metadata.deterministic=true` so observers see the swap. No silent override — anti-deception aligned.
- **CLI**: `crumb model [--show | --apply "<NL>"]` wired in `src/cli.ts`. Coordinator main loop logs disabled providers + per-actor effort on session start.

### Fixed — Schema drift (2026-05-02)

- `protocol/schemas/message.schema.json`: `kind` description "39 kinds" → "40 kinds (4 system + 11 workflow + 5 dialogue + 5 step + 5 user + 3 handoff + 7 meta)". Top-level description also updated to clarify "11 fields" refers to identification/routing/classification only.
- `wiki/concepts/bagelcode-system-architecture-v3.md`: §3.3 header "39 kind 어휘" → "40 kind 어휘"; "artifact / meta (6)" → "(7)" (counts 7 entries: artifact.created/ack/error/audit/tool.call/tool.result/hook); architecture diagram "39 kind × 11 field" → "40 kind × 11 field"; §10.2 Kiki dashboard mapping similarly updated.
- `src/helpers/explain.ts` jsdoc "39 kinds × 11 fields" → "40 kinds × 11 identification fields". `KIND_REGISTRY` already had 40 entries from prior session — only doc string was stale.

### Fixed — Coordinator race conditions (2026-05-02)

Three concurrency defects surfaced by an end-to-end audit of `src/loop/coordinator.ts`, `src/transcript/reader.ts`, and `src/transcript/writer.ts` against the Hub-Ledger-Spoke topology promise.

- **`coordinator.ts` resume double-reduce** — `tail(transcriptPath, onMessage, { fromOffset: 0 })` re-emitted every replayed event to `onMessage`, so on resume each prior event was reduced twice (counters doubled, `score_history` duplicated, spawn effects fired twice). Now captures `replayEndOffset = stat(path).size` before `readAll()` and passes that as `fromOffset` so tail picks up only new bytes. Added `src/loop/coordinator.test.ts` with a regression test asserting `task_ledger.facts.length === 3` (not 6) after replay-then-tail with three pre-seeded events.
- **`coordinator.ts` duplicate session.start/goal on resume** — every `runSession()` invocation unconditionally appended `session.start` + `goal`, so resuming an existing session double-fired the goal event and double-spawned planner-lead. Now skips the synthetic appends if any prior `session.start` for the same `session_id` is found in the replayed events. Two regression tests cover the resume-skips and fresh-writes paths.
- **`transcript/writer.ts` multi-instance breaks single-writer-per-process** — the file header documents Promise-chain serialization, but two parts of the process (TUI + coordinator, or coordinator + mock-adapter) each constructed their own `TranscriptWriter` and held independent chains. Added `getTranscriptWriter({ path, sessionId })` factory backed by a path-keyed module-level registry; production callers (`coordinator.ts`, `cli.ts`, `tui/app.ts`, `adapters/mock.ts`) all use it. Path canonicalization via `node:path.resolve` so relative + absolute references reach the same instance. Four new tests cover same-path identity, path canonicalization, distinct-path isolation, and serialization across two-call-site appends.
- **`reducer/index.ts` circuit breaker stuck open** — the breaker incremented `consecutive_failures` on every `kind=error` event but never reset on success, so a single transient adapter failure permanently pinned the actor to OPEN/fallback for the rest of the session. Now any non-error event from a previously-failing actor closes the breaker and zeroes the failure streak (`last_failure_id` preserved for audit). Two regression tests in `src/reducer/index.test.ts`.

102 tests pass (was 93). All four fixes are determinism-preserving — no clock or randomness introduced; replay over the same transcript still yields identical state.

### Added — v3.2 Budget guardrails + autoresearch ratchet (2026-05-02)

Five P0 hard caps and one autoresearch-style keep/revert ratchet — closes the "what stops the loop" gap surfaced by `wiki/concepts/bagelcode-budget-guardrails.md`. All caps are determinism-preserving (replay over the same transcript yields identical state).

- **`respec_count ≤ 3`** (`src/reducer/index.ts` §RESPEC_MAX) — `kind=spec.update` increments; cap → `done(too_many_respec)`. Initial spec is the first try, not a respec.
- **`verify_count ≤ 5`** (`src/reducer/index.ts` §VERIFY_MAX) — `kind=judge.score` increments (NOT `verify.result`, which is the legacy alias the verifier emits alongside; counting both halves the cap). Cap → `done(too_many_verify)`. **Promoted P1 → P0** per the user's "루프 과도하게 안 돌게" lock.
- **`tokens_total`** (`src/reducer/index.ts` §TOKEN_BUDGET_HOOK / §TOKEN_BUDGET_HARD) — sums `metadata.tokens_in + tokens_out` across every event. 40K crossing → `hook(token_budget)` (transition guard via prev/next compare); 50K → `done(token_exhausted)`. Counts on every kind, not just LLM events — covers system messages too.
- **`per_spawn_timeout ≤ 5min`** (`src/dispatcher/live.ts` §PER_SPAWN_TIMEOUT_MS, autoresearch P3) — `AbortController` + `setTimeout` in the dispatcher; `SpawnRequest.signal` threaded through to all 4 adapters (claude-local / codex-local / gemini-local / mock). Live adapters wire signal → `child.kill('SIGTERM')`; mock checks `signal.aborted` between canned steps. On timeout: `kind=error` with `body="per_spawn_timeout: ..."` and `data.reason="per_spawn_timeout"`. Reducer's existing error branch trips `circuit_breaker.consecutive_failures`.
- **`session_wall_clock`** (`src/loop/coordinator.ts` §WALL_CLOCK_HOOK_MS_DEFAULT / §WALL_CLOCK_HARD_MS_DEFAULT, autoresearch P3) — coordinator's setInterval watchdog tracks `Date.now() - Date.parse(state.progress_ledger.session_started_at)`. 24min crossing → `hook(time_budget)` (one-shot via `timeBudgetHookFired` boolean); 30min → `state.done = true`, drain `processing` chain, dispatch `done(wall_clock_exhausted)`.
- **Autoresearch P4 keep/revert ratchet** (`src/reducer/index.ts` §RATCHET_REGRESSION_THRESHOLD) — tracks `max_aggregate_so_far` + `max_aggregate_msg_id` across every `judge.score`. A drop of ≥ 2 aggregate points triggers `done(ratchet_revert)`. Prevents unbounded score-oscillation loops where the verifier swings between PASS/PARTIAL on minor refactors.

State extensions (`src/state/types.ts ProgressLedger`): `respec_count`, `verify_count`, `session_token_total`, `session_started_at`, `per_spawn_started_at`, `max_aggregate_so_far`, `max_aggregate_msg_id`. All zero/empty in `initialState` so existing tests pass without churn.

`design/DESIGN.md` (Phaser 3.80 + ≤60KB envelope) was promoted to `agents/specialists/game-stack-constraint.md` so the planner's step.design now inline-reads 4 specialists (concept-designer / researcher / visual-designer / game-stack-constraint) and builder/builder-fallback read the envelope from the same agents/specialists/ tree as everything else.

`RunOptions` adds `wallClockHookMs / wallClockHardMs / watchdogTickMs / perSpawnTimeoutMs / extraAdapters?` for tests and ops overrides; defaults match the wiki budget table.

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
