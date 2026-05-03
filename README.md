# Crumb

> Multi-agent execution harness for casual game prototyping. Pitch a game in one line; multi-host AI coding agents collaborate through Planner → Builder → deterministic QA check → Verifier (CourtEval); intervene anytime via natural language.

[![CI](https://github.com/mangowhoiscloud/crumb/actions/workflows/ci.yml/badge.svg)](https://github.com/mangowhoiscloud/crumb/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Crumb is named after** (1) the small piece of a bagel — Bagelcode's signature, (2) the **breadcrumb pattern** widely used in LLM agent systems for path tracing and error steering (Hansel & Gretel metaphor), (3) the breadcrumb trail of agent decisions left in `transcript.jsonl` for the user to follow.

## What it is

Crumb treats multi-agent collaboration as an **observable execution protocol**, not just a chat interface. Every message, tool call, artifact, user intervention, deterministic QA result, judge score, and reasoning summary is recorded as a **replay-deterministic JSONL transcript** (39 kinds × 11 fields × 12 specialist steps × 8 actors).

Built for the [Bagelcode 신작팀 AI 개발자 과제 전형](https://career.bagelcode.com/ko/o/208045) (2026-05-03 deadline). See [README.ko.md](./README.ko.md) for Korean.

### Mail verbatim 정조준 (recruiter ctrl-F)

| Mail keyword | Where it lands in Crumb |
|---|---|
| "Claude Code, Codex, Gemini CLI **등 다양한 에이전트를 동시에 사용**" | `bagelcode-cross-3way` preset (default) — builder=Codex, verifier=Gemini, rest=ambient. 3-host first-class. |
| "여러 AI 에이전트가 **서로 통신**" | 8 actors × 39 transcript kinds, `kind=handoff.{requested,accepted,rollback}` between actors. |
| "사용자가 협업 과정에 **개입하거나 관찰**" | 5 user.* events × 4 host = 20-cell matrix. Natural language → `kind=user.intervene`. |
| "통신 방식 / 프로토콜 / UI **자유**" | JSONL transcript + 4 entry path (Claude Code / Codex / Gemini / headless). |
| "AI 코딩 에이전트를 사용하여 개발" | Built with Claude Code + Codex; commits, sandwich files, helpers, OTel exporter all show provenance. |
| "**README대로 실행**시 동작" | `npx tsx src/index.ts run --adapter mock` works with zero auth, deterministic. |
| "**.md 파일 포함**" | agents/*.md (5) + skills/*.md (5) + specialists/*.md (3) + .{claude,codex,gemini}/ entries (5). |
| "JSONL **또는** 녹화" | `transcript.jsonl` 39 kinds; demo screencast follow-up. |

## Quickstart

**End users** (no source clone — install from npm):

```bash
npm i -g crumb              # core CLI: crumb run / replay / event / model / doctor
npm i -g @crumb/studio      # optional web console: crumb-studio
crumb doctor                # verify auth + chromium binary cached (D6 portability ready)
crumb-studio                # http://127.0.0.1:7321/ — local web console (auto-opens browser)
```

The two packages ship from the same monorepo (`mangowhoiscloud/crumb`) and share one SemVer cadence. `@crumb/studio` declares `crumb` as an **optional peer dependency** — Studio can watch existing sessions standalone, but spawning new sessions through the new-session form requires `crumb run` on `PATH`.

**Source / dev setup** (Streamlit-style — clone, build, run; no `npm link` required):

```bash
git clone https://github.com/mangowhoiscloud/crumb.git && cd crumb && npm install && npm run build
npx crumb doctor                                  # auth + chromium + Studio readiness
npx crumb run --goal "60s match-3 combo bonus"    # → Studio auto-opens at http://localhost:7321
```

`crumb run` spawns Crumb Studio (the local read-only observation surface) automatically — Vite-style banner prints the URL plus a deep link to the just-started session. Disable with `--no-studio` or `CRUMB_NO_STUDIO=1` for CI / SSH / headless. Studio survives the run via `detached + unref`, so subsequent `crumb run` invocations re-use the existing Studio (chokidar watches new transcripts automatically).

`npx` resolves the workspace `bin` (`crumb` + `crumb-studio`) without `npm link`. To make them callable as bare commands from any directory, run `npm link` from the repo (kept as a contributor convenience, no longer the documented quickstart) — see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

> **Skipping the Chromium download** (CI / air-gapped): `CRUMB_SKIP_PLAYWRIGHT_INSTALL=1 npm install`. The qa-check D6 portability gate stays signal-only; the D2 lint + size gate still runs.

### A. Natural language (Claude Code user — recommended)

```bash
$ claude
> /crumb 60초 매치-3 콤보 보너스 게임 만들어줘
```

The `.claude/skills/crumb/SKILL.md` skill hands the pitch to headless `crumb run` and streams transcript events back. Natural-language interventions ("이 부분 다르게", "콤보 보너스 좀 더 짧게") flow back as `kind=user.intervene` events.

### B. Mock adapter (no auth, deterministic)

```bash
crumb run --goal "60-second match-3 with combo bonus" --adapter mock --idle-timeout 5000
```

Guaranteed to work with zero auth. Session ends with a **26-event v0.1 flow**: `session.start → goal → planner-lead (5 step + spec + handoff) → builder (artifact + build + handoff) → qa.result (system, deterministic ground truth) → verifier (4 step.judge inline + judge.score aggregate=28/30 PASS + handoff) → done → session.end`. Replay yields identical state.

### C. Real agents via preset

```bash
# Authenticate (any subset of these you have):
claude login           # Anthropic Claude Max
codex login            # OpenAI Codex Plus
gemini login           # Google Gemini Advanced

# Pin the project + run from any dir:
mkdir -p ~/projects/match3 && cd ~/projects/match3
crumb init --pin --label "match3"
crumb run --goal "60-second match-3 with combo bonus" --preset solo

# Promote the result + export to a checkable folder:
crumb release <session-ulid> --as v1 --label "demo"
crumb copy-artifacts v1 --to ./demo
```

`provider × harness × model` decisions stay in **the user's hands** — Crumb never forces a default. Run `crumb doctor` to see which presets your environment can actually run.

## Inspect a session

```bash
crumb ls                                          # list every session under ~/.crumb/projects/*/sessions/
jq -r '"\(.kind)\t\(.from)"' \
  ~/.crumb/projects/<project-id>/sessions/<ulid>/transcript.jsonl
crumb replay <ulid>                               # re-derive state deterministically
```

## Live studio (browser console)

The studio is a single-binary Node HTTP + SSE server. **Default port `7321`,
bound to `127.0.0.1` only**, so a fresh checkout → fresh browser tab works
without firewall prompts on macOS / Windows. Cross-platform (chokidar with
WSL/NFS polling fallback, no platform-specific syscalls).

```bash
# After `npm install && npm run build` (Quickstart step), start it:
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

| Command | What it does |
|---|---|
| `crumb run --goal "<pitch>" [--preset <name>] [--adapter <id>]` | Start a session |
| `crumb event` | Subprocess agents pipe a JSON event in via stdin (transcript append) |
| `crumb replay <session-dir>` | Re-derive state from `transcript.jsonl` (proves determinism) |
| `crumb resume <session-id\|dir>` | Re-derive state + surface mid-flight resume command |
| `crumb doctor` | Full environment check (3 host OAuth + adapter health + preset gating) |
| `crumb config <자연어>` | Preset recommendation from natural-language description |
| `crumb debug <session-id\|dir>` | F1-F7 routing fault diagnosis from a transcript |
| `crumb ls` | List `sessions/` with event counts |
| `npx crumb-studio [--port 7321] [--bind 127.0.0.1] [--no-open]` | Live observability studio (HTTP + SSE) — see "Live studio" section above |

## Architecture (v0.1, high level)

```
USER (자연어) ─ goal/intervene ───▶ COORDINATOR (host harness 자체)
                                        │ Task tool spawn (depth=1)
              ┌──────────────────┬───────┴────────┬──────────────┬─────────────────┐
              ▼                  ▼                ▼              ▼                 ▼
        PLANNER LEAD       RESEARCHER ★       BUILDER ★      VERIFIER ★       BUILDER FALLBACK
        (Socratic +        (v0.3.0:             (sandwich +    (CourtEval        (Codex 죽었을 때)
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
- **Schema**: 40 kinds × 11 fields × 12 specialist steps × 8 actors × OTel GenAI alias
- **3-layer scoring**: reducer-auto (D3/D4) + qa-check-effect (D2/D6, deterministic) + verifier-llm (D1, semantic)
- **Cost**: $0/session via subscriptions (Claude Max + Codex Plus + Gemini Advanced) — or `--adapter mock` for free
- **Configurability**: `(harness × provider × model)` 3-tuple per actor; user picks via preset; ambient fallback follows entry host

For the full canonical spec, see [wiki/concepts/bagelcode-system-architecture-v0.1.md](./wiki/concepts/bagelcode-system-architecture-v0.1.md).

## Preset options

`provider × harness × model` per actor — picked by you, never forced. Run `crumb doctor` to see which are reachable in your environment.

| Preset | Binding | Use case |
|---|---|---|
| **(no preset)** ambient | Every actor follows entry host (e.g. claude-code + claude-opus-4-7) | Simplest path; whatever you have authenticated |
| **`bagelcode-cross-3way`** | builder=codex+gpt-5.5-codex / verifier=gemini-cli+gemini-3-1-pro / rest=ambient | Bagelcode mail verbatim ("Claude Code, Codex, Gemini CLI 등 동시 사용"). 3-provider cross-assemble |
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
├── transcript.jsonl                    # Replay-deterministic event log (39 kind × 11 field)
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
✅ Schema v0.1 — 39 kind × 11 field × 12 step × 8 from + D1-D6 source-of-truth scoring
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
