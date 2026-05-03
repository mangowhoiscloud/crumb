# Crumb

> Multi-agent execution harness for casual game prototyping. Pitch a game in one line; multi-host AI coding agents collaborate through Planner → Builder → deterministic QA check → Verifier (CourtEval); intervene anytime via natural language.

[![CI](https://github.com/mangowhoiscloud/crumb/actions/workflows/ci.yml/badge.svg)](https://github.com/mangowhoiscloud/crumb/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Crumb is named after** (1) the small piece of a bagel — Bagelcode's signature, (2) the **breadcrumb pattern** widely used in LLM agent systems for path tracing and error steering (Hansel & Gretel metaphor), (3) the breadcrumb trail of agent decisions left in `transcript.jsonl` for the user to follow.

## What it is

Crumb treats multi-agent collaboration as an **observable execution protocol**, not just a chat interface. Every message, tool call, artifact, user intervention, deterministic QA result, judge score, and reasoning summary is recorded as a **replay-deterministic JSONL transcript** (35 kinds × 11 fields × 13 specialist steps × 9 actors).

Built for the [Bagelcode New Title Team AI Developer recruitment task](https://career.bagelcode.com/ko/o/208045) (2026-05-03 deadline). See [README.ko.md](./README.ko.md) for Korean.

### Mail verbatim alignment (recruiter ctrl-F)

| Mail keyword | Where it lands in Crumb |
|---|---|
| "Claude Code, Codex, Gemini CLI **등 다양한 에이전트를 동시에 사용**" | `bagelcode-cross-3way` preset (default) — builder=Codex, verifier=Gemini, rest=ambient. 3-host first-class. |
| "여러 AI 에이전트가 **서로 통신**" | 9 actors × 35 transcript kinds, `kind=handoff.{requested,rollback}` between actors. |
| "사용자가 협업 과정에 **개입하거나 관찰**" | 5 user.* events × 4 host = 20-cell matrix. Natural language → `kind=user.intervene`. |
| "통신 방식 / 프로토콜 / UI **자유**" | JSONL transcript + 4 entry path (Claude Code / Codex / Gemini / headless). |
| "AI 코딩 에이전트를 사용하여 개발" | Built with Claude Code + Codex; commits, sandwich files, helpers, OTel exporter all show provenance. |
| "**README대로 실행**시 동작" | `git clone … && npm run setup && npx crumb run --goal "…" --adapter mock` — zero auth, deterministic. |
| "**.md 파일 포함**" | agents/*.md (5) + skills/*.md (5) + specialists/*.md (3) + .{claude,codex,gemini}/ entries (5). |
| "JSONL **또는** 녹화" | `transcript.jsonl` 35 kinds; demo screencast follow-up. |

## Quickstart

**Two commands, no symlinks, no global install:**

```bash
git clone https://github.com/mangowhoiscloud/crumb.git && cd crumb
npm run setup
```

`npm run setup` runs three idempotent steps inside the cloned directory:

1. `npm install` — fetches deps; the `postinstall` hook pre-caches the Playwright Chromium binary so `qa_check` D6 portability works on first run.
2. `npm run build` — TypeScript compile of root + the `@crumb/studio` workspace.
3. `crumb doctor` — environment probe (3 host CLIs, adapter health, recommended preset). Best-effort; partial auth is normal on first install.

Then run Crumb without putting anything on your global `PATH` — both bin entries resolve via `npx` directly:

```bash
npx crumb run --goal "60-second match-3 with combo bonus" --adapter mock --idle-timeout 5000
npx crumb-studio                  # http://127.0.0.1:7321/ — auto-opens browser
```

The `--adapter mock` line is the **deterministic happy-path smoke** — zero auth required, finishes in ~1 s, ends with a 26-event transcript and a PASS verdict. It's what the recruiter / evaluator should run first to confirm the install is healthy. Replay yields identical state (`npx crumb replay <session-id>`).

> **Why no `npm link`, no global install?** Global symlinks tangle Node's resolution under monorepo workspaces, leak across user accounts on shared machines, and must be tracked manually for clean uninstall. `npx <bin>` resolves the workspace `bin` directly with zero global state, so `git clone`-and-delete is enough to remove every Crumb file.

> **`crumb` on npm is unrelated.** The npm package named `crumb` (v7.x) is a separate project with no connection to this repo. Crumb is currently **clone-only** (no npm publish until after the Bagelcode evaluation). Do not `npm i -g crumb` — it will not install this codebase.

> **Skipping the Chromium download** (CI / air-gapped): `CRUMB_SKIP_PLAYWRIGHT_INSTALL=1 npm run setup`. The qa-check D6 portability gate stays signal-only; the D2 lint + size gate still runs.

### Update

```bash
cd crumb && npm run update           # git pull --ff-only + setup again
```

Refuses to run if the working tree is dirty so local edits are never silently overwritten.

### Uninstall

Crumb does not symlink anything onto your `PATH`, so removal is just file deletion:

```bash
npm run uninstall                       # remove build artifacts (dist/, node_modules/)
npm run uninstall -- --purge-data       # also remove ~/.crumb (sessions, projects)
npm run uninstall -- --purge-browsers   # also remove the Playwright chromium cache
rm -rf "$(pwd)"                         # finally, remove the clone itself
```

### Reset

```bash
npm run reset                        # rm -rf dist + node_modules; preserves ~/.crumb + chromium cache
npm run setup                        # rebuild from a clean slate
```

Useful when the build is in a bad state or to reproduce "fresh-clone" issues without re-cloning.

### Run with real agents (after `claude login` / `codex login` / `gemini login`)

```bash
# Authenticate the providers you have (any subset is fine):
claude login           # Anthropic Claude Max
codex login            # OpenAI Codex Plus
gemini login           # Google Gemini Advanced

# Pin the project + run from any working directory:
mkdir -p ~/projects/match3 && cd ~/projects/match3
npx --prefix /path/to/crumb crumb init --pin --label "match3"
npx --prefix /path/to/crumb crumb run --goal "60-second match-3 with combo bonus" --preset solo

# Promote the result + export to a checkable folder:
npx --prefix /path/to/crumb crumb release <session-ulid> --as v1 --label "demo"
npx --prefix /path/to/crumb crumb copy-artifacts v1 --to ./demo
```

`--prefix` points npx at the cloned repo's workspace bin without a global symlink. Set `alias crumb='npx --prefix /path/to/crumb crumb'` in your shell rc if you'd like a shorter form. `provider × harness × model` decisions stay in **the user's hands** — Crumb never forces a default. Run `npx crumb doctor` to see which presets your environment can actually run.

### Run from inside Claude Code (natural language)

```text
$ claude
> /crumb 60초 매치-3 콤보 보너스 게임 만들어줘
```

The `.claude/skills/crumb/SKILL.md` skill hands the pitch to the headless `crumb run` resolved against the cloned repo and streams transcript events back. Natural-language interventions ("이 부분 다르게", "콤보 보너스 좀 더 짧게") flow back as `kind=user.intervene` events.

## Inspect a session

```bash
npx crumb ls                                      # list every session under ~/.crumb/projects/*/sessions/
jq -r '"\(.kind)\t\(.from)"' \
  ~/.crumb/projects/<project-id>/sessions/<ulid>/transcript.jsonl
npx crumb replay <ulid>                           # re-derive state deterministically
npx crumb status <ulid>                           # progress + last 10 events + scores
npx crumb explain <kind>                          # schema lookup for any transcript kind
```

## Live studio (browser console)

The studio is a single-binary Node HTTP + SSE server. **Default port `7321`,
bound to `127.0.0.1` only**, so a fresh checkout → fresh browser tab works
without firewall prompts on macOS / Windows. Cross-platform (chokidar with
WSL/NFS polling fallback, no platform-specific syscalls).

```bash
# After `npm run setup` (Quickstart step), start it from the cloned repo:
npx crumb-studio                  # http://127.0.0.1:7321/  (auto-opens browser)
npx crumb-studio --no-open        # headless / SSH / CI    (just print the URL)
npx crumb-studio --port 8080      # alternate port
npx crumb-studio --bind 0.0.0.0   # expose on LAN / SSH tunnel (firewall prompt)
```

Once it's up, the browser surfaces:

| View | What it shows |
|---|---|
| **Sidebar (left)** | Project-grouped session list. ＋ button starts a new `crumb run` (goal + preset form). Hover any session row → × dismisses it from the studio (transcript on disk untouched). |
| **Header strip** | D1–D6 source-of-truth scorecard, always visible, updates per `kind=judge.score`. |
| **Pipeline tab** | 9-actor DAG topology (lime pulse on the active actor, lavender ripple "weaving" each transcript event sender → next-likely target) + per-actor swimlane chip timeline. |
| **Logs tab** (ArgoCD-inspired) | Per-actor live tail of `<session>/agent-workspace/<actor>/spawn-*.log` (full stdout / stderr from every adapter spawn). Filter / follow / clear / copy. DAG node click jumps here. |
| **Output tab** | Sandboxed iframe live-rendering `artifacts/game/index.html`. Reload + open-in-new-tab. Playable in-place. |
| **Live execution feed** (above input) | Terminal-style stream of every transcript event for the active session **and** every chunk of every actor's spawn log. Color-coded by kind class. |
| **Console input** (bottom) | Slash commands (`/approve` `/veto <reason>` `/pause [@actor]` `/goto <actor>` `/note <text>`), `@actor` mentions, plain-text user.intervene. **`/crumb <goal>`** spawns a brand-new session. |
| **Detail panel** (right, click an event) | Pipeline-position narrative ("PHASE B → C — Spec sealed"), parent → this → children thread, sandwich preview per actor, per-actor mini-console. |

Cross-platform env knobs:

| Variable | Effect |
|---|---|
| `CRUMB_HOME` | Override `~/.crumb` (sandbox / CI / multi-user setups) |
| `CRUMB_POLL=1` | Force chokidar polling (WSL2 / Docker / NFS / SMB) |
| `CRUMB_NO_OPEN=1` | Don't auto-launch a browser (equivalent to `--no-open`) |

## CLI

Every command below should be invoked via `npx crumb …` from the cloned repo (or `npx --prefix /path/to/crumb crumb …` from any other directory). `--version` and `-v` print the package version; the help text (`npx crumb --help`) carries the same table.

| Command | What it does |
|---|---|
| `crumb run --goal "<pitch>" [--preset <name>] [--adapter <id>]` | Start a session |
| `crumb event` | Subprocess agents pipe a JSON event in via stdin (transcript append) |
| `crumb event tail [--all] [--kinds ...]` | Stream transcript events; private events filtered by default |
| `crumb replay <session-dir>` | Re-derive state from `transcript.jsonl` (proves determinism) |
| `crumb resume <session-id\|dir>` | Re-derive state + surface mid-flight resume command |
| `crumb status <session-id\|dir>` | Progress + last 10 events + D1-D6 scorecard |
| `crumb explain <kind>` | Transcript-kind schema lookup |
| `crumb suggest <session-id\|dir>` | Recommend the next user action (approve / veto / pause / wait) |
| `crumb tui <session-id\|dir>` | Blessed-based live observer (terminal) |
| `crumb model [--show \| --apply "NL"]` | Per-actor model + effort + provider activation |
| `crumb doctor` | Full environment check (3 host OAuth + adapter health + preset gating) |
| `crumb config <natural-language>` | Preset recommendation from natural-language description |
| `crumb debug <session-id\|dir>` | F1-F7 routing fault diagnosis from a transcript |
| `crumb export <session-id\|dir> [--format ...]` | OTel GenAI / Anthropic / chrome://tracing export |
| `crumb init [--host <name>] [--pin]` | Verify host entries / pin cwd to a stable project ULID |
| `crumb ls` | List the current project's sessions |
| `crumb release <session-id> [--as vN]` | Snapshot artifacts into versions/ + emit `kind=version.released` |
| `crumb versions` | List released milestones with parent chain |
| `crumb copy-artifacts <session-id\|vN> --to <dest>` | Copy frozen artifacts (Bagelcode submission) |
| `crumb migrate [--dry-run]` | Move legacy `<cwd>/sessions/` into `~/.crumb/projects/<id>/sessions/` |
| `crumb studio [--port ...] [--bind ...]` | Launch the web console (alias for `crumb-studio`) |
| `crumb --version` / `-v` | Print package version |
| `npx crumb-studio [--port 7321] [--bind 127.0.0.1] [--no-open]` | Live observability studio (HTTP + SSE) — see "Live studio" above |

Lifecycle (npm scripts in the cloned repo):

| Command | What it does |
|---|---|
| `npm run setup` | install + build + doctor (idempotent — also the update path) |
| `npm run update` | `git pull --ff-only` then re-run setup; refuses a dirty tree |
| `npm run uninstall [-- --purge-data] [-- --purge-browsers]` | Remove build artifacts; opt-in flags remove `~/.crumb` and Playwright cache |
| `npm run reset` | Remove `dist/` + `node_modules/`; preserves `~/.crumb` and chromium cache |

## Architecture (v0.1, high level)

```
USER (natural language) ─ goal/intervene ───▶ COORDINATOR (host harness itself)
                                        │ Task tool spawn (depth=1)
              ┌──────────────────┬───────┴────────┬──────────────┬─────────────────┐
              ▼                  ▼                ▼              ▼                 ▼
        PLANNER LEAD       RESEARCHER ★       BUILDER ★      VERIFIER ★       BUILDER FALLBACK
        (Socratic +        (v0.3.0:             (sandwich +    (CourtEval        (when Codex dies)
         Concept;          gemini-sdk          5 skill —      inline 4 sub-
         then handoff      Gemini 3.1 Pro      tdd-iron-law,  step: grader/
         to researcher;    @ 10fps native      verification-  critic/
         resume for        YouTube URL;        before-        defender/
         Design + Synth)   step.research.      completion,    regrader)
                           video × N +         code-review,
        2 specialist       step.research       parallel-
        inline +           synthesis)          dispatch,
        game-design.md                         subagent-spawn)
        contract
              │                  │                │              │
              └──────────────────┴────────┬───────┴──────────────┘
                                          │
                            qa_check effect (★ deterministic, no LLM)
                            emits kind=qa.result (D2/D6 ground truth)
                                          │
                                          ▼
                              transcript.jsonl (40 kind, append-only)
                                          │
                                          ▼
                              control plane (pure reducer + state)
```

- **Outer 6 actors** (incl. researcher v0.3.0) + **2 specialist** (planner inline) + **1 contract** (game-design.md, 4+ actors inline-read) + **5 skill** (procedural workflow)
- **Multi-host 4 entry**: Claude Code skill / Codex CLI / Gemini CLI / headless `crumb run`
- **Schema**: 35 kinds × 11 fields × 13 specialist steps × 9 actors × OTel GenAI alias
- **3-layer scoring**: reducer-auto (D3/D4) + qa-check-effect (D2/D6, deterministic) + verifier-llm (D1, semantic)
- **Cost**: $0/session via subscriptions (Claude Max + Codex Plus + Gemini Advanced) — or `--adapter mock` for free
- **Configurability**: `(harness × provider × model)` 3-tuple per actor; user picks via preset; ambient fallback follows entry host

For the full canonical spec, see [wiki/concepts/bagelcode-system-architecture-v0.1.md](./wiki/concepts/bagelcode-system-architecture-v0.1.md).

## Preset options

`provider × harness × model` per actor — picked by you, never forced. Run `crumb doctor` to see which are reachable in your environment.

| Preset | Binding | Use case |
|---|---|---|
| **(no preset)** ambient | Every actor follows entry host (e.g. claude-code + claude-opus-4-7) | Simplest path; whatever you have authenticated |
| **`bagelcode-cross-3way`** | builder=codex+gpt-5.5-codex / verifier=gemini-cli+gemini-3-1-pro / rest=ambient | Bagelcode mail verbatim ("Claude Code, Codex, Gemini CLI 등 동시 사용" — *use Claude Code, Codex, Gemini CLI etc. simultaneously*). 3-provider cross-assemble |
| **`mock`** | All actors = mock adapter | CI / no auth / deterministic demo |
| **`sdk-enterprise`** | API key direct (subscription bypass) | Production; ToS-safe (avoids Anthropic 3rd-party OAuth restriction) |
| **`solo`** | Single entry host, single model | Minimal-setup demo |

Preset files live at `.crumb/presets/*.toml`. Cross-provider is **not a separate flag** — it's just one preset's use case.

## Why these decisions?

Every architecture choice traces to 2026 frontier research:

- **Multi-host × 3-tuple actor binding** — Claude Code / Codex / Gemini / OpenCode CLI convergence (2026-04) on 7 common primitives. → [wiki/references/bagelcode-frontier-cli-convergence-2026.md](./wiki/references/bagelcode-frontier-cli-convergence-2026.md)
- **5-actor split (builder ⫶ verifier)** — actor-level provider boundary required for true cross-assemble (sandwich-internal step boundary insufficient). → [wiki/concepts/bagelcode-verifier-isolation-matrix.md](./wiki/concepts/bagelcode-verifier-isolation-matrix.md) (20 sources × 4 dimensions)
- **3-layer scoring** — CourtEval ACL 2025 + G-Eval + position-bias IJCNLP 2025 + self-bias NeurIPS 2024 + multi-judge consensus 97-98% F1. → [wiki/references/bagelcode-llm-judge-frontier-2026.md](./wiki/references/bagelcode-llm-judge-frontier-2026.md)
- **Deterministic qa_check before verifier** — Karpathy P4 anti-deception ratchet + obra/superpowers TDD Iron Law (89K stars). LLM judge can't fake D2 (exec) when the dispatcher produces ground truth.
- **Hub-Ledger-Spoke topology** — Lanham 2026-04 (centralized 4.4× error containment vs independent 17.2× amplification).
- **4-actor short relay** — MIT decision theory (5-stage relay → 22.5% accuracy regression).
- **Subprocess injection over CLAUDE.md auto-load** — Karpathy LLM.txt + AGENTS.md (Linux Foundation standard) keep agent identity controllable.
- **OTel GenAI alias** — Datadog / Vertex / Anthropic Console / Phoenix / Langfuse export-ready.
- **User-controlled preset** — Anthropic 2026-03 "wrong tradeoff" ("we should never have forced default reasoning effort"). `provider × harness × model` is yours to pick.

See [wiki/synthesis/bagelcode-frontier-rationale-5-claims.md](./wiki/synthesis/bagelcode-frontier-rationale-5-claims.md) and [wiki/synthesis/bagelcode-host-harness-decision.md](./wiki/synthesis/bagelcode-host-harness-decision.md) for the full citation chains.

## Output

A successful session produces:

```
sessions/<session-id>/
├── transcript.jsonl                    # Replay-deterministic event log (35 kind × 11 field)
├── ledgers/
│   ├── task.json                       # Cumulative facts (transcript-derivable)
│   └── progress.json                   # Per-turn state (transcript-derivable)
├── artifacts/
│   ├── game/                           # Phaser 3.80 multi-file PWA — open game/index.html
│   │   ├── index.html                  #   entry (viewport, manifest link, sw.js register)
│   │   ├── manifest.webmanifest        #   PWA install descriptor
│   │   ├── sw.js                       #   cache-first service worker (offline)
│   │   ├── icon-192.png / icon-512.png
│   │   ├── src/main.js + src/{config,scenes,entities,systems}/  # ES modules
│   │   └── migrations/0001_init.sql    #   only when --persistence postgres opted in
│   ├── spec.md                         # Acceptance criteria + rule book
│   ├── DESIGN.md                       # Color / mechanics / motion spec
│   └── tuning.json                     # Balance numbers (Unity ScriptableObject importable)
├── exports/                            # ★ v0.1 — observability handoff
│   ├── otel.jsonl                      # OpenTelemetry GenAI Semantic Conventions
│   ├── anthropic-trace.json            # Anthropic Console import format
│   └── chrome-trace.json               # chrome://tracing visualization
└── index.html                          # ★ v0.1 — auto-generated post-session HTML summary
```

These are the **input asset** for a downstream Unity team — Crumb is the *prototype-validation layer* before Bagelcode's production Unity workflow.

## Status

```
✅ Schema v0.1 — 35 kind × 11 field × 13 step × 9 from + D1-D6 source-of-truth scoring
✅ Pure reducer — circuit breaker, adaptive stop, rollback, user.veto rebound (vitest)
✅ Adapters — claude-local / codex-local / gemini-local / mock
✅ Live dispatcher — spawn / append / hook / rollback / stop / done / qa_check
✅ qa_check effect — deterministic ground truth (no LLM, htmlhint + playwright headless smoke)
✅ Preset loader — (harness × provider × model) 3-tuple binding with ambient fallback
✅ CLI — run / event / replay / resume / doctor / config / debug / ls
✅ Skill — .claude/skills/crumb/SKILL.md (Claude Code natural-language entry)
✅ Summary — auto-generated index.html + OTel/Anthropic/Chrome trace exports
✅ CI — lint + typecheck + format + test (Node 18/20/22) + schema validation

🟡 Real end-to-end run with claude-local + codex-local + gemini-local (env propagation spike pending)
🟡 Persistence boost — flock + adapter_session_id metadata for `crumb resume` live re-entry (P1)
🟡 MCP Provider — localhost:8765 cross-host fan-in (P1)
🟡 --strict-cross-provider — full Builder=OpenAI / Verifier=Anthropic via host Task subagent (P1)
🟡 Demo screencast
```

## Documentation

- [AGENTS.md](./AGENTS.md) — For agents/contributors working on this repo (Linux Foundation Agentic AI Foundation standard)
- [agents/_event-protocol.md](./agents/_event-protocol.md) — How sandwich agents emit transcript events via `crumb event`
- [protocol/schema.md](./protocol/schema.md) — 1-page transcript spec
- [protocol/schemas/message.schema.json](./protocol/schemas/message.schema.json) — JSON Schema (draft 2020-12)
- [.claude/skills/crumb/SKILL.md](./.claude/skills/crumb/SKILL.md) — Claude Code host harness entry
- [.crumb/presets/](./.crumb/presets/) — `bagelcode-cross-3way` / `mock` / `sdk-enterprise` / `solo`
- [wiki/](./wiki/) — Bagelcode design rationale (subset of mango-wiki, 35 pages)
  - [bagelcode-system-architecture-v0.1.md](./wiki/concepts/bagelcode-system-architecture-v0.1.md) — ★ canonical v0.1 system architecture
  - [bagelcode-host-harness-decision.md](./wiki/synthesis/bagelcode-host-harness-decision.md) — Hybrid (Skill + headless CLI) lock
  - [bagelcode-verifier-isolation-matrix.md](./wiki/concepts/bagelcode-verifier-isolation-matrix.md) — 20-source matrix (cross-provider opt-in backing)
  - [bagelcode-final-design-2026.md](./wiki/concepts/bagelcode-final-design-2026.md) — §3-§9 (envelope / cache / OTel) still valid in v0.1

## License

MIT
