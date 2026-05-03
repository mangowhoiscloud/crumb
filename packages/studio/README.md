# @crumb/studio

> **Local web console for Crumb sessions.** Spawn new game-prototyping sessions, watch transcripts in real time, intervene mid-flight (approve / veto / pause / resume / goto / swap / append), inspect per-actor logs, and play the rendered Phaser game inside the browser. Companion to the [`crumb`](https://www.npmjs.com/package/crumb) CLI.

[![npm version](https://img.shields.io/npm/v/@crumb/studio.svg)](https://www.npmjs.com/package/@crumb/studio)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

## What it is

Studio is a single-binary HTTP + Server-Sent Events (SSE) server that watches `~/.crumb/projects/*/sessions/*/transcript.jsonl` and renders a live web console at `http://127.0.0.1:7321/`. No cloud, no API key — everything runs against your local Crumb sessions.

The console covers four operator workflows:

| Workflow | Surface |
|---|---|
| **Spawn** new sessions | New-session form (goal + preset chips that grey out when adapters are missing) |
| **Watch** transcripts in real time | Pipeline DAG + per-actor swimlane chip timeline, ArgoCD-style live log tail, IDE-style grep highlight + ↑↓ nav, stream-json narrative bubbles (`⏺ Bash(...)` / `⎿ tool result` / `✓ turn complete`), live execution feed |
| **Intervene** mid-flight | Slash bar + console input (`/approve` / `/veto <reason>` / `/pause [@actor]` / `/goto <actor>` / `/swap <a>=<adapter>` / `/append @<actor> <text>` / `/note <text>` / `@actor <free text>`) — same grammar as `~/.crumb/<sid>/inbox.txt` and the TUI |
| **Inspect** | D1-D6 source-of-truth scorecard, sandbox iframe rendering of `artifacts/game/index.html`, transcript viewer with substring filter, copy-all, fault diagnosis |

## Install

```bash
# Install both the core CLI and the studio
npm i -g crumb @crumb/studio

# Or studio alone (it auto-detects $CRUMB_HOME without requiring the core)
npm i -g @crumb/studio
```

The core [`crumb`](https://www.npmjs.com/package/crumb) is an **optional peer dependency** — Studio can watch existing sessions and surface adapter-doctor info without it, but spawning new sessions through the new-session form requires `crumb run` on `PATH`.

## Run

```bash
crumb-studio                              # 127.0.0.1:7321, auto-open browser
crumb-studio --port 8080                  # custom port
crumb-studio --bind 0.0.0.0               # expose on LAN / SSH tunnel
crumb-studio --no-open                    # headless (CI / SSH)
crumb-studio --home ~/.crumb \
             --home /tmp/crumb-test-home  # watch multiple Crumb homes
```

### Environment

| Variable | Effect |
|---|---|
| `CRUMB_HOMES=/a:/b` | Multi-home (path-list separator). Takes precedence over `CRUMB_HOME`. |
| `CRUMB_HOME=/path/to/.crumb` | Legacy single-home (defaults to `$HOME/.crumb`). |
| `CRUMB_POLL=1` | Force chokidar polling (network mounts, container bind mounts). |
| `CRUMB_NO_OPEN=1` | Headless without `--no-open` flag. |

Resolution order: `--home` flags (repeatable) > `CRUMB_HOMES` > `CRUMB_HOME` > `$HOME/.crumb`.

## Architecture

- **Vite + React 19 + dockview.** Static SPA bundle output to `dist/client/`, served by the Node http server at `/`. Resolved via `import.meta.url` so npm-link / npm-i-g installs all locate the bundle correctly (no symlinks per §13.1 portability).
- **shadcn-flavored UI primitives** + Open Props design tokens (`--canvas`, `--ink`, `--actor-<actor>`, `--tone-{pass,partial,fail,pending}`, `--src-{llm,qa,auto}`). Light + dark theme, comfortable + compact density.
- **chokidar tail.** `transcript.jsonl` watcher emits one SSE per appended line; the client folds events into the pipeline view incrementally.
- **API surface** (read-only except `POST /api/inbox/<sid>` and `POST /api/run`):
  - `GET /api/health` — bootstrap state classifier (live / idle / interrupted / abandoned / terminal counts)
  - `GET /api/sessions` — per-session state + project_id + last_activity_at
  - `GET /api/doctor` — adapter probe matrix (claude-local / codex-local / gemini-cli-local + auth)
  - `GET /api/sessions/<sid>/events` (SSE) — live transcript tail
  - `GET /api/sessions/<sid>/spawn-log/<actor>` (SSE) — live per-spawn stdout/stderr
  - `POST /api/inbox/<sid>` — append one line to the session's `inbox.txt` (intervene grammar)
  - `POST /api/run` — spawn a new `crumb run` subprocess

## Relationship to `crumb`

`crumb` is the headless CLI (run / replay / event / model / doctor / debug). `@crumb/studio` is the operator-driven web console on top of the same `~/.crumb/` data layout. Both packages ship from the same monorepo (`mangowhoiscloud/crumb`) and share a single SemVer cadence — when `crumb` releases `0.5.0`, `@crumb/studio` releases `0.5.0` too.

## License

MIT — see [LICENSE](./LICENSE).
