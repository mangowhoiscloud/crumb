# Crumb

> Multi-agent execution harness for casual game prototyping. Pitch a game in one line; AI coding agents (Claude Code / Codex / Gemini CLI) collaborate through Planner → Builder → deterministic QA → Verifier; you watch, intervene, release. Every step is a replay-deterministic transcript.

[![CI](https://github.com/mangowhoiscloud/crumb/actions/workflows/ci.yml/badge.svg)](https://github.com/mangowhoiscloud/crumb/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Built for the [Bagelcode New Title Team AI Developer recruitment task](https://career.bagelcode.com/ko/o/208045) (deadline 2026-05-03 23:59 KST). 한국어 문서: [README.ko.md](./README.ko.md).

---

## What you'll get in 5 minutes

After running two commands you'll have:

1. **A working browser console** at `http://127.0.0.1:7321/` (Crumb Studio) — sidebar with sessions, interactive Pipeline canvas, live transcript feed, sandboxed iframe Output preview, scorecard with anti-deception source attribution.
2. **A first session** that you can spawn with one CLI line — even with zero auth (mock adapter, deterministic in ~1 second).
3. **A real game** when you're ready: log into Claude Code (Max subscription **strongly recommended** — see below), pitch in natural language, and watch the agents collaborate.

The same transcript powers replay (`crumb replay`), debugging (`crumb debug`), and OTel export (`crumb export`) — there is no hidden state.

---

## Quickstart (zero auth)

> Requires **Node 18+** (works on macOS / Linux / Windows / WSL2).

```bash
git clone https://github.com/mangowhoiscloud/crumb.git
cd crumb
npm run setup
```

`npm run setup` is a single idempotent command that:

1. Installs npm dependencies (the `postinstall` hook pre-caches Playwright Chromium so the deterministic `qa_check` D6 portability gate works on first run).
2. Builds both the root package and `@crumb/studio` workspace (TypeScript compile + Vite client bundle).
3. Runs `crumb doctor` — a read-only environment probe that tells you which presets your machine can run (best-effort; partial auth is fine on first install).

**Skip the Chromium download** (CI / air-gapped):

```bash
CRUMB_SKIP_PLAYWRIGHT_INSTALL=1 npm run setup
```

Then run a deterministic smoke session — **no auth required**, finishes in ~1 second:

```bash
npx crumb run --goal "60-second match-3 with combo bonus" --adapter mock --idle-timeout 5000
```

You'll see a 26-event transcript and a `PASS` verdict. Replay yields identical state:

```bash
npx crumb replay <session-id>      # the session-id is printed at the top of the run output
```

> **Why `npx`, not `npm link` or `npm i -g`?** Global symlinks tangle Node's resolution under monorepo workspaces and leak across user accounts. `npx <bin>` resolves the workspace bin directly with zero global state, so removing the clone is enough to uninstall every Crumb file.

> **`crumb` on npm is a different package.** The npm package named `crumb` (v7.x) is unrelated to this repository. Crumb is **clone-only** until after the Bagelcode evaluation. Do not `npm i -g crumb` — it will not install this codebase.

---

## Live Studio (the browser console)

Crumb ships a single-binary Node HTTP + SSE server. Default port `7321`, bound to `127.0.0.1` only — no firewall prompt on macOS / Windows.

```bash
npx crumb-studio                   # http://127.0.0.1:7321/  (auto-opens browser)
npx crumb-studio --no-open         # headless / SSH / CI    (just print the URL)
npx crumb-studio --port 8080       # alternate port
```

What the browser surface gives you:

| Surface | What it shows |
|---|---|
| **Sidebar** | Project-grouped session list. ＋ button starts a new `crumb run` (cascading goal + preset + per-actor binding form). HealthBadge + theme + density toggles in the header. |
| **Scorecard strip** | D1–D6 composite headline + 6-axis radar + drilldown rows + sparkline trajectory + verdict pill. Every score row carries a `LLM` / `QA` / `AUTO` source-attribution chip per AGENTS.md anti-deception invariant. |
| **Error budget strip** | respec / verify / token bars; tone shifts amber at 60%, red at 85% so you can intervene before the reducer cuts the run off. |
| **Pipeline tab** (interactive) | React Flow + dagre canvas. 8 actor nodes with lane colors, drag-to-rearrange, layout persists per session and per project. Click a node → DetailRail flips to NodeInspector. **Sticky-Note annotations**, **Save default layout**, **Export / Import JSON** (M9 polish). |
| **Waterfall + Service Map tabs** | Wall-clock per-actor lanes; handoff edge aggregation. |
| **Logs / Output / Transcript tabs** | Per-actor spawn-log tail; sandboxed iframe game preview; grep-filtered transcript flat scroll. **Output Source toggle** (Session ↔ Version) so you can swap to any frozen release manifest's artifacts in one click. |
| **Tool Trace tab** | Per-actor grouped `tool.call` events with cumulative ms — useful when an adapter is "thinking" and you want to know what it's actually doing. |
| **Versions tab** | Released milestone browser. Click a row → Output panel pins to that frozen release; ↩ button returns to live. |
| **Bottom panels** | Agent Narrative + Live Execution Feed (independently dockable, drag-out into popout windows). |
| **Slash bar** | `/approve`, `/veto <reason>`, `/pause [@actor]`, `/goto <actor>`, `/swap <from>=<adapter>`, `/append <text>`, `@<actor> <body>`, plain text → `kind=user.intervene`. |
| **Detail rail** | Quad-mode dispatch: Pipeline node inspector → DesignCheckPanel (when qa.result has design_check) → event detail → outlier mode (future). |

Drag any tab out of the dock for a popout window (`window.open` + `BroadcastChannel`). Theme + density + minimap state all persist in `localStorage`.

---

## Run with real agents

Crumb is built around the recruiter mail's "Claude Code, Codex, Gemini CLI 등 동시 사용" requirement. Authenticate the providers you have — **any subset is fine**, and Crumb never forces a default. `crumb doctor` shows you exactly which presets your environment can actually run.

> **Recommended: Claude Code with a Max plan.** The default ambient binding pairs Crumb with whichever host CLI you launched from; if that's Claude Code, every actor goes through Anthropic's Claude. The free `claude` plan rate-limits hard during multi-step planning + verification flows, so Max (or higher) is what we use for evaluator-grade runs. If you only have the free tier, prefer `--adapter mock` for the smoke run and `solo` preset (single-host single-model) for full sessions.

```bash
# Authenticate the providers you have:
claude login            # Anthropic Claude Max — recommended baseline
codex login             # OpenAI Codex Plus    — optional (enables cross-3way)
gemini login            # Google Gemini Advanced — optional (enables cross-3way)

# Then either pitch in natural language from inside Claude Code:
$ claude
> /crumb 60초 매치-3 콤보 보너스 게임 만들어줘

# …or run headless from any directory (pin to a stable project ULID first):
mkdir -p ~/projects/match3 && cd ~/projects/match3
npx --prefix /path/to/crumb crumb init --pin --label "match3"
npx --prefix /path/to/crumb crumb run --goal "60-second match-3 with combo bonus" --preset solo

# Promote the result to a frozen release + export to a checkable folder:
npx --prefix /path/to/crumb crumb release <session-ulid> --as v1 --label "demo"
npx --prefix /path/to/crumb crumb copy-artifacts v1 --to ./demo
```

Use `alias crumb='npx --prefix /path/to/crumb crumb'` in your shell rc to drop the `--prefix` once you've used Crumb a few times.

### Preset options (you choose; Crumb never forces)

`provider × harness × model` per actor — picked by **you**. Run `crumb doctor` to see which are reachable in your environment.

| Preset | Binding | Use case |
|---|---|---|
| **(no preset)** ambient | Every actor follows the entry host (e.g. claude-code + claude-opus) | Simplest path; whatever you have authenticated |
| **`bagelcode-cross-3way`** | builder=Codex / verifier=Gemini / rest=ambient | Recruiter mail verbatim — 3-provider cross-assemble |
| **`mock`** | All actors = mock adapter, deterministic | CI / no auth / 1-second smoke |
| **`sdk-enterprise`** | API key direct (subscription bypass) | Production / ToS-safe / enterprise key holders |
| **`solo`** | Single entry host, single model | Minimal-setup demo |

Cross-provider is **not a separate flag** — it's just one preset's use case. Preset files live at `.crumb/presets/*.toml`.

---

## Inspect a session

```bash
npx crumb ls                                      # every session under ~/.crumb/projects/*/sessions/
npx crumb status <session-id>                     # progress + last 10 events + D1-D6 scorecard
npx crumb suggest <session-id>                    # recommend the next user action (approve / veto / pause / wait)
npx crumb explain <kind>                          # transcript-kind schema lookup
npx crumb replay <session-id>                     # re-derive state deterministically
npx crumb debug <session-id>                      # F1-F7 routing fault diagnosis
npx crumb export <session-id> --format otel       # OTel GenAI / Anthropic / chrome-trace
npx crumb tui <session-id>                        # blessed-based live observer (terminal)

# raw transcript — JSONL with 35 kinds:
jq -r '"\(.kind)\t\(.from)\t\(.body // "")"' \
   ~/.crumb/projects/<project-id>/sessions/<session-id>/transcript.jsonl
```

---

## CLI cheat sheet

Every command is invoked via `npx crumb …` from the cloned repo (or `npx --prefix /path/to/crumb crumb …` from any other directory). `npx crumb --help` prints the same table.

| Command | What it does |
|---|---|
| `crumb run --goal "<pitch>" [--preset <name>] [--adapter <id>]` | Start a session |
| `crumb event` | Subprocess agents pipe a JSON event in via stdin (transcript append) |
| `crumb event tail [--all] [--kinds ...]` | Stream transcript events; private events filtered by default |
| `crumb replay <session>` | Re-derive state from `transcript.jsonl` (proves determinism) |
| `crumb resume <session>` | Re-derive state + surface mid-flight resume command |
| `crumb status <session>` | Progress + last 10 events + D1-D6 scorecard |
| `crumb explain <kind>` | Transcript-kind schema lookup |
| `crumb suggest <session>` | Recommend the next user action |
| `crumb tui <session>` | Blessed-based live observer (terminal) |
| `crumb model [--show \| --apply "NL"]` | Per-actor model + effort + provider activation |
| `crumb doctor` | Full environment check (3 host OAuth + adapter health + preset gating) |
| `crumb config <NL>` | Preset recommendation from natural-language description |
| `crumb debug <session>` | F1-F7 routing fault diagnosis from a transcript |
| `crumb export <session>` | OTel GenAI / Anthropic / chrome-trace export |
| `crumb init [--pin]` | Verify host entries / pin cwd to a stable project ULID |
| `crumb ls` | List the current project's sessions |
| `crumb release <session> [--as vN]` | Snapshot artifacts into versions/ + emit `kind=version.released` |
| `crumb versions` | List released milestones with parent chain |
| `crumb copy-artifacts <session\|vN> --to <dest>` | Copy frozen artifacts (Bagelcode submission) |
| `crumb migrate [--dry-run]` | Move legacy `<cwd>/sessions/` into `~/.crumb/projects/<id>/sessions/` |
| `crumb-studio [--port 7321] [--bind 127.0.0.1] [--no-open]` | Live observability studio (HTTP + SSE) |

### Lifecycle scripts (npm)

| Command | What it does |
|---|---|
| `npm run setup` | install + build + doctor (idempotent — also the update path) |
| `npm run update` | `git pull --ff-only` then re-run setup; refuses a dirty tree |
| `npm run uninstall [-- --purge-data] [-- --purge-browsers]` | Remove build artifacts; opt-in flags remove `~/.crumb` and Playwright cache |
| `npm run reset` | Remove `dist/` + `node_modules/`; preserves `~/.crumb` + chromium cache |

### Cross-platform env knobs

| Variable | Effect |
|---|---|
| `CRUMB_HOME` | Override `~/.crumb` (sandbox / CI / multi-user setups) |
| `CRUMB_HOMES` | Path-list of multiple homes (the studio merges sessions across all) |
| `CRUMB_POLL=1` | Force chokidar polling (WSL2 / Docker / NFS / SMB) |
| `CRUMB_NO_OPEN=1` | Don't auto-launch a browser (equivalent to `--no-open`) |
| `CRUMB_SKIP_PLAYWRIGHT_INSTALL=1` | Skip the Chromium download in `npm run setup` |

---

## Architecture (one screen)

```
USER (natural language) ─ goal/intervene ───▶ COORDINATOR (host harness itself)
                                        │ Task tool spawn (depth=1)
              ┌──────────────────┬───────┴────────┬──────────────┐
              ▼                  ▼                ▼              ▼
        PLANNER LEAD         RESEARCHER         BUILDER       VERIFIER
        (Socratic +          (gemini-sdk        (sandwich +    (CourtEval
         Concept; then        Gemini 3.1 Pro    5 procedural   inline 4
         handoff to           native YouTube    skills)        sub-step)
         researcher;          URL @ 10fps)
         resume for
         Design + Synth)
              │                  │                │              │
              └──────────────────┴────────┬───────┴──────────────┘
                                          │
                            qa_check effect (★ deterministic, no LLM)
                            emits kind=qa.result (D2/D6 ground truth)
                                          │
                                          ▼
                              transcript.jsonl (35 kinds, append-only)
                                          │
                                          ▼
                              control plane (pure reducer + state)
```

- **5 actors** + **2 specialists** (planner inline) + **1 contract** (`agents/specialists/game-design.md`) + **5 procedural skills**
- **Multi-host 4 entry**: Claude Code skill / Codex CLI / Gemini CLI / headless `crumb run`
- **Schema**: 35 kinds × 11 fields × 13 specialist steps × 8 actors × OTel GenAI alias
- **3-layer scoring**: reducer-auto (D4 + auto components of D3/D5) + qa-check-effect (D2/D6, deterministic) + verifier-llm (D1 + LLM components of D3/D5)
- **Cost**: $0/session via subscriptions (Claude Max + Codex Plus + Gemini Advanced) — or `--adapter mock` for free
- **Configurability**: `(harness × provider × model)` 3-tuple per actor; user picks via preset; ambient fallback follows entry host

For the canonical spec, see [`wiki/concepts/bagelcode-system-architecture-v0.1.md`](./wiki/concepts/bagelcode-system-architecture-v0.1.md).

---

## Output (what a session produces)

### On-disk hierarchy

```
~/.crumb/                                 # CRUMB_HOME (override via env; multi-home via CRUMB_HOMES)
└── projects/
    └── <project-id>/                     # Project — owns BOTH live sessions AND frozen releases
        ├── sessions/
        │   └── <session-ulid>/           # WIP attempt (mutable lifecycle)
        │       ├── transcript.jsonl              # Replay-deterministic event log (35 × 11)
        │       ├── meta.json                     # Lifecycle status (running/paused/done/error)
        │       ├── inbox.txt                     # Slash-command + free-text user input (single-writer)
        │       ├── ledgers/
        │       │   ├── task.json                 # Cumulative facts (transcript-derivable)
        │       │   └── progress.json             # Per-turn state (transcript-derivable)
        │       ├── agent-workspace/              # Per-actor sandbox + assembled sandwich
        │       │   └── <actor>/
        │       │       └── sandwich.assembled.md # System prompt that the host CLI received via
        │       │                                 # --append-system-prompt (envelope XML + actor
        │       │                                 # sandwich + procedural skills + sandwich_append).
        │       │                                 # See AGENTS.md §"Subprocess injection over
        │       │                                 # CLAUDE.md auto-load" for why this exists.
        │       ├── artifacts/
        │       │   ├── game/                     # Phaser 3.80 multi-file PWA — open game/index.html
        │       │   │   ├── index.html            #   entry (viewport, manifest, sw.js register)
        │       │   │   ├── manifest.webmanifest
        │       │   │   ├── sw.js                 #   cache-first service worker (offline)
        │       │   │   ├── icon-192.svg / icon-512.svg
        │       │   │   └── src/main.js + src/{config,scenes,entities,systems}/
        │       │   ├── spec.md                   # Acceptance criteria + rule book
        │       │   ├── DESIGN.md                 # Color / mechanics / motion spec
        │       │   └── tuning.json               # Balance numbers
        │       ├── exports/
        │       │   ├── otel.jsonl                # OpenTelemetry GenAI Semantic Conventions
        │       │   ├── anthropic-trace.json
        │       │   └── chrome-trace.json         # chrome://tracing visualization
        │       └── index.html                    # Auto-generated post-session HTML summary
        └── versions/
            └── <vN>[-<label>]/                   # Released milestone (immutable)
                ├── manifest.toml                 # Scorecard + parent_version + artifacts_sha256
                └── artifacts/                    # Frozen copy of the source session's artifacts/
```

### How `<project-id>` is derived (this is a frequent question)

```
1.  If <cwd>/.crumb/project.toml exists  → use its `id` field (a ULID).
2.  Otherwise (ambient)                  → sha256(path.resolve(cwd))[:16]
```

**Two modes — choose deliberately:**

| Mode | When to use | Cross-machine consistency |
|---|---|---|
| **Ambient** (default) | Throwaway / single-machine work | ❌ Different machine or different absolute cwd → different `<project-id>`. The 16-hex prefix is purely a local cache key. |
| **Pinned** (`crumb init --pin`) | Bagelcode submission, shared evaluator demo, anything you want to reproduce | ✅ Writes a stable ULID into `<cwd>/.crumb/project.toml`. **Commit that file to git** → every clone of the repo on every machine resolves to the same `<project-id>`, so sessions land in the same `~/.crumb/projects/<id>/sessions/` bucket regardless of where the clone lives on disk. |

```bash
# In the directory you'll iterate from:
mkdir -p ~/projects/match3 && cd ~/projects/match3
crumb init --pin --label "match3"        # writes .crumb/project.toml
git add .crumb/project.toml && git commit -m "chore: pin project id"
```

After that, every `crumb run` from any clone of the same repo writes to the same project bucket. `<session-ulid>` always remains per-run (ULIDs are time-sorted; new run = new ulid).

### Session → Version flow

`crumb release <session-ulid> --as v1 [--label "demo"]` snapshots the source session's `artifacts/` tree into `~/.crumb/projects/<project-id>/versions/v1[-demo]/`, writes `manifest.toml` (scorecard from the most recent `judge.score` event + per-file sha256), and appends `kind=version.released` to the source session's `transcript.jsonl`. Versions stay frozen even if you delete the source session.

`crumb copy-artifacts <session|vN> --to <dest>` is the Bagelcode-submission line: copies the chosen artifacts/ tree out of `~/.crumb/...` into a plain folder you can zip up.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Studio bundle not built` page on `http://127.0.0.1:7321/` | Run `npm run build --workspace=@crumb/studio` and reload, or just re-run `npm run setup`. |
| `port 7321 already in use` | `lsof -ti:7321 \| xargs -r kill -9` (one-shot), or pass `--port 8080`. |
| `claude doctor` shows broken auth even after `claude login` | Open Claude Code's settings, confirm the active org has Max access; the free plan rate-limits multi-step flows. |
| Playwright Chromium download fails | Re-run with `CRUMB_SKIP_PLAYWRIGHT_INSTALL=1 npm run setup`. The qa-check D6 portability gate then stays signal-only; D2 lint + size still runs. |
| `CRUMB_POLL=1` is needed under WSL2 / Docker / NFS / SMB | chokidar's native watcher misses some virtualized filesystems; polling fixes it. |
| Sessions vanish from the sidebar after restart | Studio dismisses are volatile — the transcript on disk is untouched; restart picks up everything under `~/.crumb/projects/*/sessions/`. |

---

## Why these decisions?

Every architecture choice traces to 2026 frontier research:

- **Multi-host × 3-tuple actor binding** — Claude Code / Codex / Gemini / OpenCode CLI convergence on 7 common primitives. → [wiki/references/bagelcode-frontier-cli-convergence-2026.md](./wiki/references/bagelcode-frontier-cli-convergence-2026.md)
- **Actor split (builder ⫶ verifier)** — actor-level provider boundary required for true cross-assemble. → [wiki/concepts/bagelcode-verifier-isolation-matrix.md](./wiki/concepts/bagelcode-verifier-isolation-matrix.md)
- **3-layer scoring** — CourtEval ACL 2025 + G-Eval + position-bias IJCNLP 2025 + self-bias NeurIPS 2024 + multi-judge consensus 97-98% F1. → [wiki/references/bagelcode-llm-judge-frontier-2026.md](./wiki/references/bagelcode-llm-judge-frontier-2026.md)
- **Deterministic qa_check before verifier** — Karpathy P4 anti-deception ratchet + obra/superpowers TDD Iron Law. LLM judge can't fake D2 (exec) when the dispatcher produces ground truth.
- **Hub-Ledger-Spoke topology** — Lanham 2026-04 (centralized 4.4× error containment vs independent 17.2× amplification).
- **Subprocess injection over CLAUDE.md auto-load** — Karpathy LLM.txt + AGENTS.md (Linux Foundation standard).
- **OTel GenAI alias** — Datadog / Vertex / Anthropic Console / Phoenix / Langfuse export-ready.
- **User-controlled preset** — Anthropic 2026-03 "wrong tradeoff": `provider × harness × model` is yours to pick.

See [wiki/synthesis/bagelcode-frontier-rationale-5-claims.md](./wiki/synthesis/bagelcode-frontier-rationale-5-claims.md) and [wiki/synthesis/bagelcode-host-harness-decision.md](./wiki/synthesis/bagelcode-host-harness-decision.md) for full citation chains.

---

## Documentation

- [AGENTS.md](./AGENTS.md) — universal contributor + AI-agent identity (Linux Foundation Agentic AI Foundation standard)
- [agents/_event-protocol.md](./agents/_event-protocol.md) — sandwich agents emit transcript events via `crumb event`
- [protocol/schema.md](./protocol/schema.md) — 1-page transcript spec
- [protocol/schemas/message.schema.json](./protocol/schemas/message.schema.json) — JSON Schema (draft 2020-12)
- [.claude/skills/crumb/SKILL.md](./.claude/skills/crumb/SKILL.md) — Claude Code host harness entry
- [.crumb/presets/](./.crumb/presets/) — `bagelcode-cross-3way` / `mock` / `sdk-enterprise` / `solo`
- [wiki/](./wiki/) — Bagelcode design rationale (subset of mango-wiki, 35 pages)
- [CHANGELOG.md](./CHANGELOG.md) — release notes (Keep a Changelog 1.1.0)

---

## License

MIT — see [LICENSE](./LICENSE).
