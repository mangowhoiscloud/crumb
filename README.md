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

**One-time setup** (any machine, any cwd thereafter):

```bash
git clone https://github.com/mangowhoiscloud/crumb.git
cd crumb
npm install
npm run build
npm link            # registers `crumb` on PATH (or: npm i -g .)
```

After that, `crumb` works from **any directory** — repo-root and preset paths are auto-detected from the install location (`--root` flag remains as escape hatch).

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

Guaranteed to work with zero auth. Session ends with a **26-event v3 flow**: `session.start → goal → planner-lead (5 step + spec + handoff) → builder (artifact + build + handoff) → qa.result (system, deterministic ground truth) → verifier (4 step.judge inline + judge.score aggregate=28/30 PASS + handoff) → done → session.end`. Replay yields identical state.

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
ls sessions/                                          # one ULID-named directory
jq -r '"\(.kind)\t\(.from)"' sessions/<id>/transcript.jsonl
open sessions/<id>/index.html                          # post-session HTML summary
npx tsx src/index.ts replay sessions/<id>              # re-derive state deterministically
```

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

## Architecture (v3, high level)

```
USER (자연어) ─ goal/intervene ───▶ COORDINATOR (host harness 자체)
                                        │ Task tool spawn (depth=1)
              ┌──────────────────┬───────┴────────┬──────────────┬─────────────────┐
              ▼                  ▼                ▼              ▼                 ▼
        PLANNER LEAD       RESEARCHER ★       BUILDER ★      VERIFIER ★       BUILDER FALLBACK
        (Socratic +        (v3.3:             (sandwich +    (CourtEval        (Codex 죽었을 때)
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

- **Outer 6 actors** (incl. researcher v3.3) + **2 specialist** (planner inline) + **1 contract** (game-design.md, 4+ actors inline-read) + **5 skill** (procedural workflow)
- **Multi-host 4 entry**: Claude Code skill / Codex CLI / Gemini CLI / headless `crumb run`
- **Schema**: 40 kinds × 11 fields × 12 specialist steps × 8 actors × OTel GenAI alias
- **3-layer scoring**: reducer-auto (D3/D4) + qa-check-effect (D2/D6, deterministic) + verifier-llm (D1, semantic)
- **Cost**: $0/session via subscriptions (Claude Max + Codex Plus + Gemini Advanced) — or `--adapter mock` for free
- **Configurability**: `(harness × provider × model)` 3-tuple per actor; user picks via preset; ambient fallback follows entry host

For the full canonical spec, see [wiki/concepts/bagelcode-system-architecture-v3.md](./wiki/concepts/bagelcode-system-architecture-v3.md).

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
│   ├── game.html                       # Phaser 3.80 single-file playable game
│   ├── spec.md                         # Acceptance criteria + rule book
│   ├── DESIGN.md                       # Color / mechanics / motion spec
│   └── tuning.json                     # Balance numbers (Unity ScriptableObject importable)
├── exports/                            # ★ v3 — observability handoff
│   ├── otel.jsonl                      # OpenTelemetry GenAI Semantic Conventions
│   ├── anthropic-trace.json            # Anthropic Console import format
│   └── chrome-trace.json               # chrome://tracing visualization
└── index.html                          # ★ v3 — auto-generated post-session HTML summary
```

These are the **input asset** for a downstream Unity team — Crumb is the *prototype-validation layer* before Bagelcode's production Unity workflow.

## Status

```
✅ Schema v3 — 39 kind × 11 field × 12 step × 8 from + D1-D6 source-of-truth scoring
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
  - [bagelcode-system-architecture-v3.md](./wiki/concepts/bagelcode-system-architecture-v3.md) — ★ canonical v3 system architecture
  - [bagelcode-host-harness-decision.md](./wiki/synthesis/bagelcode-host-harness-decision.md) — Hybrid (Skill + headless CLI) lock
  - [bagelcode-verifier-isolation-matrix.md](./wiki/concepts/bagelcode-verifier-isolation-matrix.md) — 20-source matrix (cross-provider opt-in backing)
  - [bagelcode-final-design-2026.md](./wiki/concepts/bagelcode-final-design-2026.md) — §3-§9 (envelope / cache / OTel) still valid in v3

## License

MIT
