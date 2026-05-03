---
title: Crumb Studio Observability Audit + Datadog-Grade Plan (2026-05-03)
date: 2026-05-03
status: plan
tags: [observability, studio, datadog, otel, langsmith, plan]
session-evidence: 01KQNEYQT53P5JFGD0944NBZ9D (in-progress mismatch case)
---

# Crumb Studio Observability Audit + Datadog-Grade Plan

Crumb Studio is the local browser dashboard that turns the append-only `transcript.jsonl` into a 9-actor swimlane, DAG, scorecard, and live execution feed. Today it answers "what did the agents just say?" but it cannot reliably answer the questions a Bagelcode operator asks during a run: *Is this session still running? How much have I burned? Which spawn produced this artifact? Is my verifier biased toward its own provider?* This page audits the current observability surface, contrasts it against the 2026 frontier consensus (Datadog APM, Honeycomb, OTel GenAI, LangSmith, Phoenix Arize, Temporal, Argo, AutoGen Studio, Vercel, Karpathy `autoresearch`), and proposes a 5-PR roadmap to Datadog-grade without breaking any of the [[bagelcode-system-architecture-v3]] invariants. The audit is anchored on a real bug: session `01KQNEYQT53P5JFGD0944NBZ9D` shows an `IN PROGRESS` pill while `meta.json.status = "done"` and the verifier already emitted `agent.stop` with `verdict=FAIL` at 23:30:37.

## 1. Current observability surface (measured)

The seven sources Studio ships today, measured directly against the running v3.3 codebase:

1. **`transcript.jsonl`** — append-only JSONL, ULID-sorted, replay-deterministic. 39+ kinds × 11 fields; every actor / system / user action lands here. Single source of truth for `reduce()`. See [[bagelcode-transcripts-schema]].
2. **Studio HTTP+SSE server (port 7321)** — chokidar watches `~/.crumb/projects/*/sessions/*/transcript.jsonl` and fans out to clients via SSE.
3. **Studio UI** — 9-actor swimlane, DAG, 6-dim scorecard, per-actor logs tab, Output (artifact iframe), Live execution feed (narrative + system split).
4. **Studio API** — `/api/sessions`, `/api/sessions/:id/logs/:actor`, `/api/sessions/:id/logs/:actor/stream`, `/api/doctor`, `/api/crumb/run`, `/api/sessions/:id/inbox`, `/api/sessions/:id/resume`, `/api/sessions/:id/close`, `/api/health`, `/api/sessions/:id/sandwich/:actor`, `/api/sessions/:id/artifacts/list`, `/api/sessions/:id/artifact/:path`.
5. **Per-actor spawn logs** — `<session>/agent-workspace/<actor>/spawn-*.log` (full stdout/stderr per spawn). Filesystem-only; no API exposure.
6. **`state.progress_ledger`** (reducer-derived in-memory state) — `next_speaker`, `score_history`, `circuit_breaker`, `paused_actors`, `respec_count`, `verify_count`, `session_token_total`, `session_started_at`, `max_aggregate_so_far`. See [[bagelcode-fault-tolerance-design]] for the F1–F5 fault model these fields back.
7. **`meta.json` per session** — `status` (running / paused / done / error), `goal`, `preset`, `started_at`, `ended_at`. Authoritative session lifecycle field; currently underused by Studio.

### Metadata-emit matrix

The schema reserves rich per-event metadata. The emit-side coverage is uneven, and the surface-side is even thinner:

| Field | Schema-defined | Reducer emits | Dispatcher emits | Studio surfaces |
|---|---|---|---|---|
| `provider` | yes | yes | yes | yes (logs only) |
| `tokens_in` / `tokens_out` | yes | yes | partial | swimlane chip count, no aggregate panel |
| `cost_usd` | yes | no | no | absent |
| `latency_ms` | yes | no | no | absent |
| `cache_carry_over` | yes | partial | no | absent |
| `harness` / `model` | yes | partial | partial | sandwich preview only |
| `cross_provider` | yes | reducer-derived | yes | scorecard tooltip only |
| `deterministic` | yes | dispatcher-stamps | yes | `qa.result` only |

The pattern: **schema generous, dispatcher writes what is convenient, reducer fills in only what scoring needs, UI surfaces only what it renders.** A Datadog-grade plan must close the dispatcher → reducer → UI pipe for cost, latency, cache, and cross-provider, then build panels that consume those fields.

## 2. Frontier 12-dim observability matrix

Built from the 2026 consensus across Datadog APM, Honeycomb, OTel GenAI Semantic Conventions, LangSmith, LangFuse, Phoenix Arize, AutoGen Studio, Temporal Web UI, Argo Workflows UI, Vercel observability, and the minimalist Karpathy `autoresearch` baseline. See also [[bagelcode-observability-frontier-2026]] for the upstream reference catalogue.

| # | Dimension | Why it matters | Crumb status | Gap |
|---|---|---|---|---|
| 1 | **Session state** (queued / running / waiting / done-pass / done-partial / done-fail / stalled / errored / abandoned) | Answers "is this still alive?" without operator guesswork | partial | UI uses last-event heuristic; ignores `meta.json.status` and `state.done` |
| 2 | **Per-actor lifecycle** (spawn started / heartbeat / ended / wall_clock / exit_code / circuit_breaker_state) | Datadog-style "service health"; pinpoints stuck actors | partial | spawn logs exist on disk; not parsed into structured signals |
| 3 | **Token usage** (in / out / cache-read / cache-write per actor + session aggregate) | OTel GenAI `gen_ai.usage.*`; the cheapest leading indicator of cost | partial | swimlane chip only; no aggregate strip |
| 4 | **Cost (USD)** per actor per provider, with running session total | Bagelcode operators run Claude Max + Codex Plus + Gemini Advanced; cost discipline matters | absent | `cost_usd` schema field never emitted |
| 5 | **Latency** (per spawn p50/p95, per actor cumulative) | Detects slow providers and warming caches; standard APM signal | absent | `latency_ms` field never emitted |
| 6 | **Tool-call trace** (tool name + input + output + duration, span tree) | OpenInference LLM spec; how LangSmith / Phoenix render agent traces | absent | tool-call events not threaded by `parent_event_id` in UI |
| 7 | **Score trajectory** (D1–D6 per round + verdict change + audit_violations) | Direct ratchet evidence; matches [[bagelcode-rubric-scoring]] + [[bagelcode-scoring-ratchet-frontier-2026-05-02]] | partial | scorecard shows current round only, no history sparkline |
| 8 | **Artifact provenance** (which spawn produced which file, sha256 chain) | Anti-deception; matches [[bagelcode-frontier-evidence-vs-llm-reasoning-2026-05-03]] | partial | `kind=artifact.created` carries sha256 but UI never traces back to spawn |
| 9 | **Cross-provider boundary** (build provider vs verifier provider, anti-deception flags) | Self-bias detection; backed by [[bagelcode-verifier-isolation-matrix]] | partial | scorecard tooltip hint only |
| 10 | **Cache hit rate** (per actor `cache_carry_over` efficiency) | Core cost lever; see [[bagelcode-caching-strategy]] + [[bagelcode-caching-frontier-2026]] | absent | not emitted, not surfaced |
| 11 | **Error budget** (per_spawn_timeout count, wall-clock burn rate, token burn rate) | Runaway prevention; matches [[bagelcode-budget-guardrails]] | partial | reducer tracks totals; UI shows no burn-down |
| 12 | **User-intervention timeline** (pause / approve / veto / redo / cancel events with effect) | Connects operator actions to outcomes; see [[bagelcode-user-intervention-frontier-2026-05-02]] | partial | events present in transcript; not pulled onto a dedicated timeline |

Crumb already has the *evidence* for most dimensions in the transcript and on disk; what is missing is (a) the dispatcher emitting cost/latency/cache consistently, and (b) Studio rendering dimensions it could already compute.

## 3. State machine — session lifecycle derivation rule

The `01KQNEYQT53P5JFGD0944NBZ9D` bug is a derivation failure, not a UI bug. The pill says `IN PROGRESS` because Studio's `/api/sessions` handler infers status from `events[events.length-1].kind`. That heuristic misreads `agent.stop` (an actor lifecycle event, not a session terminator) and ignores the two authoritative signals on disk: `meta.json.status = "done"` and the reducer-replayed `state.done = true`.

**The 9-state lifecycle** (each session sits in exactly one):

| State | Trigger event | Ground-truth source |
|---|---|---|
| `queued` | session dir created, no `goal` event yet | `meta.json.status === "running"` AND transcript line count ≤ 1 |
| `running` | last event within heartbeat window AND no `done` | `meta.json.status === "running"` AND `state.done === false` AND last-event-age < idle-timeout |
| `waiting` | `kind=user.intervention.requested` or paused actor | `state.paused_actors.length > 0` OR last kind is `inbox.requested` |
| `done-pass` | verifier `verdict=PASS` and reducer set `state.done` | `meta.json.status === "done"` AND last `judge.score.verdict === "PASS"` |
| `done-partial` | verifier `verdict=PASS_WITH_NOTES` | `meta.json.status === "done"` AND last verdict ∈ {`PASS_WITH_NOTES`, `CONDITIONAL_PASS`} |
| `done-fail` | verifier `verdict=FAIL` and reducer set `state.done` | `meta.json.status === "done"` AND last verdict === `FAIL` (this is the `01KQNEYQT53P5JFGD0944NBZ9D` case) |
| `stalled` | last event older than idle-timeout AND no `done` AND no running pid | last-event-age > idle-timeout AND `meta.json.status === "running"` AND no live spawn pid |
| `errored` | `meta.json.status === "error"` or unhandled `kind=error` at root | `meta.json.status === "error"` OR last event is unrecovered `error` |
| `abandoned` | no event for > 24h AND no live process | last-event-age > 24h AND no live spawn pid |

**Why `01KQNEYQT53P5JFGD0944NBZ9D` went stale**: the heuristic `last-kind === "agent.stop"` is treated as "actor still working." But `agent.stop` from the verifier with `verdict=FAIL` is a terminal signal when `meta.json.status` has already flipped to `done`. The fix is not to patch the heuristic — it is to **stop using a heuristic at all**. The pill must be derived server-side via a single, ordered rule:

```
derived_state =
  if meta.json.status === "error"          → errored
  elif meta.json.status === "done"         → bucket by last verdict (pass / partial / fail)
  elif state.paused_actors.length > 0      → waiting
  elif last-event-age > idle_timeout       → stalled (or abandoned if > 24h)
  else                                     → running
```

This is a pure function of `(meta.json, transcript)` — replay-deterministic (matches invariant #1 of [[bagelcode-system-architecture-v3]]), cheap to cache (invalidate on `meta.json` mtime OR transcript size change). Contract:

- `GET /api/sessions` — each row carries `derived_state: <one of 9>` and `derived_state_reason: string`.
- SSE — push `session_state_change` whenever derivation flips, so the pill updates without polling.

This retires the entire class of "Studio says running but it's already done" bugs.

## 4. Studio UI panels to add (Datadog-grade)

Seven panels, each with data source / refresh cadence / user scenario / placement. Every panel reads from existing or PR-O2-emitted fields — none requires a new transcript schema beyond what the JSON Schema already defines.

**P1. Session timeline waterfall.** *Source:* spawn lifecycle events + `parent_event_id`. *Cadence:* SSE-pushed per spawn end. *Scenario:* "Where did the wall clock go between rounds 2 and 3?" *Placement:* full-width panel under the swimlane, modeled on Datadog APM trace view — one row per spawn, x-axis is wall clock, color by actor.

**P2. Cost + token aggregate strip.** *Source:* PR-O2 reducer aggregation of `cost_usd` + `tokens_in/out` + `cache_read/write`. *Cadence:* live (debounced 500ms). *Scenario:* "How much have I spent so far this session?" *Placement:* sticky strip at top of session header, three numbers (USD / tokens / cache hit %) with per-actor breakdown on hover.

**P3. Per-actor lifecycle gauge.** *Source:* dim 2 (per-actor lifecycle) + dim 1 (session state). *Cadence:* SSE per actor state change. *Scenario:* "Which actor is alive right now?" *Placement:* left sidebar, one chip per actor showing `(state, last-activity-ago)` with circuit-breaker color (green / yellow / red).

**P4. Tool-call trace tree.** *Source:* tool-call events threaded by `parent_event_id`, OpenInference-style. *Cadence:* on-demand expand. *Scenario:* "What did the verifier actually grep for inside the build?" *Placement:* right rail, expandable per parent event; mirrors LangSmith / Phoenix layout.

**P5. Score-trajectory sparkline.** *Source:* `state.score_history` (already reducer-derived). *Cadence:* update on each `judge.score`. *Scenario:* "Are we improving across rounds, or oscillating?" *Placement:* above the existing scorecard — six tiny sparklines (D1–D6) with verdict markers.

**P6. Error-budget burn-down.** *Source:* dim 11 (error budget). *Cadence:* SSE per spawn. *Scenario:* "Will this session blow its budget before verdict?" *Placement:* bottom dock, three meters (per-spawn timeout count, wall-clock burn, token burn) following [[bagelcode-budget-guardrails]].

**P7. Cross-provider self-bias chip.** *Source:* `metadata.cross_provider` + verifier provider vs build provider mismatch. *Cadence:* per `judge.score`. *Scenario:* "Is the verifier judging its own provider's build?" *Placement:* a chip on the scorecard that turns yellow on same-provider, green on cross-provider, with tooltip linking [[bagelcode-same-provider-discount-2026-05-03]] and [[bagelcode-verifier-context-isolation-2026-05-03]].

## 5. Implementation roadmap — 5-step PR sequence

Each PR ships independently (no flag), preserves the architecture invariants, and is testable against `01KQNEYQT53P5JFGD0944NBZ9D`-class fixtures.

**PR-O1 (server) — authoritative `derived_state`.** Implement the §3 rule in the Studio server. Add `derived_state` + `derived_state_reason` to `/api/sessions` rows. Cache keyed on `(meta.mtime, transcript.size)`. Push `session_state_change` over SSE on transition. *Frontier ref:* Temporal Web UI workflow status derivation. *Invariant impact:* none — pure read of `meta.json` + `reduce(transcript)`.

**PR-O2 (server) — cost + latency + cache emission.** Dispatcher stamps `cost_usd`, `latency_ms`, `cache_read_tokens`, `cache_write_tokens` on every `agent.stop`. Reducer aggregates into `state.progress_ledger.session_cost_usd`, `session_latency_p50/p95`, `session_cache_hit_rate`. *Frontier ref:* OTel GenAI `gen_ai.usage.*`, LangFuse cost ledger. *Invariant impact:* additive metadata only — D2/D6 ground-truth path untouched.

**PR-O3 (Studio) — timeline waterfall (P1).** Render spawn waterfall from PR-O2 latency + `parent_event_id` chain. *Frontier ref:* Datadog APM span waterfall, Argo Workflows DAG.

**PR-O4 (Studio) — aggregate strip (P2) + score sparkline (P5).** Top-of-header strip + sparklines above scorecard. *Frontier ref:* Vercel observability dashboard 2026, Honeycomb dataset overview, Karpathy `autoresearch` (minimalist baseline).

**PR-O5 (Studio) — trace tree (P4) + cross-provider chip (P7) + budget burn-down (P6).** Three panels in one PR; all read existing reducer state once PR-O2 lands. *Frontier ref:* LangSmith trace tree, Phoenix Arize agent step view, AutoGen Studio dashboard, Stripe Sigma / Linear state-machine UX.

After PR-O5, all 12 dimensions in §2 reach `yes` and Studio meets the 2026 Datadog-grade bar without touching reducer purity, the append-only transcript, or qa-check ground truth.

## 6. Frontier references (primary URLs)

1. Datadog APM — live tail / span waterfall / service map: <https://docs.datadoghq.com/tracing/>
2. Honeycomb — live query, BubbleUp, dataset overview: <https://docs.honeycomb.io/>
3. OpenTelemetry GenAI Semantic Conventions (`gen_ai.*`): <https://opentelemetry.io/docs/specs/semconv/gen-ai/>
4. LangSmith — agent trace dashboards: <https://docs.smith.langchain.com/>
5. LangFuse — open-source LLM observability: <https://langfuse.com/docs>
6. Phoenix Arize — LLM trace + evals: <https://docs.arize.com/phoenix>
7. AutoGen Studio — multi-agent dashboard: <https://microsoft.github.io/autogen/stable/user-guide/autogenstudio-user-guide/>
8. Temporal Web UI — workflow execution timeline + retries: <https://docs.temporal.io/web-ui>
9. Argo Workflows UI — DAG live update + step retry: <https://argo-workflows.readthedocs.io/>
10. Vercel observability dashboard 2026: <https://vercel.com/docs/observability>
11. Karpathy `autoresearch` minimalist dashboard baseline: <https://github.com/karpathy/autoresearch>
12. Stripe Sigma — live state-machine query UX: <https://stripe.com/docs/sigma>
13. Linear timeline — issue state-machine UX: <https://linear.app/docs>
14. OpenInference LLM trace spec: <https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md>

Internal cross-references: [[bagelcode-system-architecture-v3]], [[bagelcode-transcripts-schema]], [[bagelcode-observability-frontier-2026]], [[bagelcode-frontier-evidence-vs-llm-reasoning-2026-05-03]], [[bagelcode-budget-guardrails]], [[bagelcode-fault-tolerance-design]], [[bagelcode-rubric-scoring]], [[bagelcode-scoring-ratchet-frontier-2026-05-02]], [[bagelcode-caching-strategy]], [[bagelcode-caching-frontier-2026]], [[bagelcode-verifier-isolation-matrix]], [[bagelcode-verifier-context-isolation-2026-05-03]], [[bagelcode-same-provider-discount-2026-05-03]], [[bagelcode-user-intervention-frontier-2026-05-02]].
