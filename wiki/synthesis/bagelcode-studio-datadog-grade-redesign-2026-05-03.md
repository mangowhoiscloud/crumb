---
title: Studio Datadog-grade redesign — new-session form + pipeline visualization
date: 2026-05-03
type: synthesis
status: plan
tags: [studio, ui, observability, pipeline-visualization, datadog, frontier, redesign]
---

# Studio Datadog-grade redesign — new-session form + pipeline visualization

> Plan + frontier research for two upcoming Studio surface rebuilds. Implementation is **deferred** until current layout regressions are resolved. This page is the contract; PRs will reference it.

## Why these two surfaces, why together

The previous observability sprint (W-Studio-A: PR #137 / #139 / #140 / #141 / #142) focused on **observation** — pill, lifecycle, feed/narrative orientation, error-budget strip, waterfall view. Two upstream surfaces remain at v0: the **new-session creation form** (still adapter-centric, no per-actor harness/model cascade) and the **pipeline visualization** (vanilla SVG DAG with hardcoded node positions, swimlane built from raw `innerHTML`). Both are the user's first and longest-dwelling interactions with Studio, and both currently break the "Datadog-grade" bar set by the rest of the sprint.

Treating them as one redesign is intentional: they share stack decisions (vanilla-JS micro-framework choice, design tokens, accessibility primitives, graph library or hand-rolled SVG). Solving the stack question once for both surfaces avoids inconsistent component vocabularies later.

## Surface 1 — New-session creation form

### Current state (v0)

- HTML markup: `packages/studio/src/client/studio.html:24-60`
- Builder + submit handler: `spawnNewCrumbRun()` at `packages/studio/src/client/studio.js:2316-2379`
- Backend: `serveCrumbRun()` at `packages/studio/src/server.ts:706-808` — accepts `{ goal, preset?, adapter?, video_refs? }` and spawns `npx tsx src/index.ts run --goal <g> [--preset] [--adapter] [--video-refs]`
- Per-actor binding grid exists (`renderBindingsGrid()` at `studio.js:3119`, `ACTORS_FOR_BINDING = ['planner-lead', 'researcher', 'builder', 'verifier']` at `studio.js:3077`) but is non-cascading — adapter and model dropdowns are independent, no validation that the chosen model belongs to the chosen harness.
- Catalog source of truth: `src/dispatcher/preset-loader.ts:71-81` (HARNESS_DEFAULT_MODEL) for resolution; `packages/studio/src/doctor.ts:42-79` (ADAPTERS) for probe-time list.

### Problems

1. **Top-level adapter selector is conceptually wrong.** Adapters belong to actors, not sessions. A real-world session usually has different harness per actor (`bagelcode-cross-3way` is the headline preset). Single top-level adapter forces a regression to that model for every actor.
2. **No cascading.** The user can pick a model that doesn't belong to the chosen harness — the form accepts it, the backend silently substitutes via `preset-loader.ts` ambient fallback, and the user sees a different model in transcript metadata than they selected.
3. **No capability surfacing.** Models are bare strings. Context window, multimodal support, pricing tier, recommended use case — none are shown. Frontier model pickers (Google AI Studio, Vertex Model Garden, Anthropic Console) all surface this inline.
4. **Goal input is a single-line `<input>`.** A "60s match-3 with combo bonuses" pitch is single-line; "build a cat puzzle game with commercial-grade polish, see references X Y Z" is multi-line. The current form silently truncates intent.
5. **No keyboard-first path.** Power users (the evaluator scenario) want ⌘K → fuzzy-search a preset → tab through actors → Enter to spawn. Current form is mouse-only.

### Frontier patterns mined

| Source | Pattern adopted |
|---|---|
| **Datadog new monitor** ([docs.datadoghq.com](https://docs.datadoghq.com/dashboards/querying/), [DRUIDS](https://druids.datadoghq.com/components)) | Strict left-to-right cascade — each step disabled until predecessor is satisfied. Tags as removable pills. |
| **Google AI Studio model picker** ([ai.google.dev](https://ai.google.dev/gemini-api/docs/models)) | Per-model capability badge strip (context window, modalities, output cap, price tier). Selecting a non-multimodal model auto-disables incompatible inputs. |
| **Vertex AI Model Garden** ([cloud.google.com](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-garden/explore-models)) | Spec-sheet side panel: overview, use cases, recommended hardware → drives downstream cascade in deploy form. |
| **Anthropic Workbench / OpenAI Playground** | Three-pane: model + params left, prompt center, run right. Honor `temperature XOR top_p` invariant via visual grouping. |
| **Honeycomb Query Builder** ([docs.honeycomb.io](https://docs.honeycomb.io/investigate/query/build)) | Six-clause progressive form as drag-reorderable pills — chip-as-cascade-step. |
| **Linear / Notion / Raycast** ([cmdk.paco.me](https://cmdk.paco.me/)) | ⌘K → push sub-palette per nested step, breadcrumb at top. |

### Information architecture

```
┌─ New session ────────────────────────────────────────────────────┐
│                                                                  │
│  Goal                                                            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ multi-line textarea, autosizing                            │  │
│  │ placeholder: "e.g. 60s match-3 with combo bonuses, …"      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Preset            ╳ Custom                                      │
│  [ambient] [solo] [bagelcode-cross-3way] [mock] [sdk-enterprise] │
│                                                                  │
│  Actors                                          (custom only)   │
│  ┌──────────────┬──────────────┬─────────────────────────────┐   │
│  │ planner-lead │ harness  ▾   │ model         ▾  (disabled  │   │
│  │              │              │                  until      │   │
│  │              │              │                  harness    │   │
│  │              │              │                  picked)    │   │
│  ├──────────────┼──────────────┼─────────────────────────────┤   │
│  │ researcher   │ harness  ▾   │ model         ▾             │   │
│  ├──────────────┼──────────────┼─────────────────────────────┤   │
│  │ builder      │ harness  ▾   │ model         ▾             │   │
│  ├──────────────┼──────────────┼─────────────────────────────┤   │
│  │ verifier     │ harness  ▾   │ model         ▾             │   │
│  └──────────────┴──────────────┴─────────────────────────────┘   │
│                                                                  │
│  Video research (researcher only)         ☐ off                  │
│  └─ youtube/local refs (textarea, hidden until on)               │
│                                                                  │
│  ┌─ Selected model card ────────────────────────────────────┐    │
│  │ verifier · gemini-cli · gemini-3-1-pro                   │    │
│  │ context 1M · text/image/audio/video · output 64K         │    │
│  │ price tier $$$  · thinking ✓                             │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  [Cancel]                                          [⌘↵ Spawn]    │
└──────────────────────────────────────────────────────────────────┘
```

### Cascading rules

1. **Preset chip selected → bindings panel pre-fills + locks** (or read-only, with a "Customize" affordance to switch into custom mode).
2. **Custom mode → harness dropdown active, model dropdown disabled** until harness is picked.
3. **Harness picked → model dropdown populates only with models valid for that harness** (source: `doctor.ts` ADAPTERS list filtered by adapter health probe).
4. **Adapter unhealthy → harness option still visible but with health badge** (red dot + tooltip "claude binary not on PATH"; Datadog Service Map convention). Selecting unhealthy adapter shows install/auth hint inline (already returned by `serveCrumbRun()` 409 response).
5. **Researcher harness ≠ gemini-{cli,sdk}-* → video research toggle disabled** with explanation tooltip ("Multimodal video evidence requires a Gemini harness for the researcher actor").
6. **Goal empty → spawn button disabled.** ⌘↵ shortcut bound when button is enabled.
7. **Selected model card panel lives below bindings**, updates on every binding change. Shows the actor whose model card is being inspected (focus-driven).

### Backend payload shape

Expand the existing endpoint to accept explicit per-actor bindings:

```jsonc
POST /api/crumb/run
{
  "goal": "<required>",
  "preset": "<optional, mutually exclusive with bindings>",
  "bindings": {
    "planner-lead": { "harness": "claude-code", "model": "claude-sonnet-4-6" },
    "researcher":   { "harness": "gemini-cli",  "model": "gemini-3-1-pro" },
    "builder":      { "harness": "codex",       "model": "gpt-5.5-codex" },
    "verifier":     { "harness": "gemini-cli",  "model": "gemini-3-1-pro" }
  },
  "video_refs": ["<optional>"]
}
```

Mapping: when `bindings` is present, the backend writes an ephemeral preset file under `sessions/<id>/.crumb/preset.toml` and passes `--preset <ephemeral>` to `crumb run`. This avoids new CLI surface area and keeps the preset system as the single source of truth (per AGENTS.md invariant 11: `provider × harness × model` is user-controlled via preset). Existing `preset` field unchanged for backwards compatibility.

### Stack decision

| Concern | Pick | Justification |
|---|---|---|
| Form shell | Native `<dialog>` + Popover API | Baseline Widely Available since April 2025 ([web.dev](https://web.dev/articles/baseline-in-action-dialog-popover)). Free focus trap, free stacking. Zero deps. |
| Reactive cascading | **Alpine.js 3.x** (~15kB min, MIT) | Declarative `x-data` / `x-bind:disabled` / `x-show` matches the cascade pattern 1:1. No build step, plays with the existing inline-template pipeline. petite-vue is smaller but Alpine has better directive coverage for this form. |
| Combobox / model picker | WAI-ARIA APG select-only combobox reference impl ([w3.org](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/)) — copy-paste vanilla JS. Capability badge strip rendered as `<span>` per row. | Accessibility AA grade out of the box. Avoids choices.js (~20kB gz) and downshift (React-only). |
| Command palette | Custom `<dialog>` + `fuse.js` (~12kB gz, MIT) for fuzzy search | Mirrors cmdk semantics without React. Optional v2 surface. |
| Design tokens | **Open Props** (single CSS import, ~20kB) | Pairs with native CSS nesting / container queries. Mirrors DRUIDS color/density tokens. |
| Microcopy + a11y | WAI-ARIA labels on every cascading control, `aria-disabled` mirrored to `disabled` | Datadog DRUIDS auto-generated label convention. |

**New runtime deps**: `alpinejs` + `fuse.js`. Total ~27kB gz. No build-tool change required (Alpine is a single `<script defer src=…>` tag; same for fuse). The existing `inline-client.mjs` script can vendor both as inline strings to keep the single-binary deployment story.

## Surface 2 — Pipeline visualization

### Current state (v0)

- Swimlane: `renderSwimlane()` at `studio.js:356-409`. Lane-per-actor (`ACTOR_LANE_ORDER` at `studio.js:1`), event chips grouped by consecutive same-kind via `groupConsecutiveByKind()` (line 477). Vanilla DOM, `innerHTML` template strings, no library.
- DAG: `renderDag()` at `studio.js:1049-1099`. SVG container `#dag-svg` (`studio.html:157`). Hardcoded node positions in `DAG_NODES` (`studio.js:953`). Edges hand-routed cubic Bezier in `edgePath()` (`studio.js:1105`). Phase background zones `DAG_PHASES` (`studio.js:969`). Ripple animation `rippleEdge()` (`studio.js:1175`). DAG runtime overlay (PR #134) added per-actor badges and edge throughput/latency.
- Waterfall (PR #142, in flight): `renderWaterfall()` builds `agent.wake → agent.stop` spans on a wall-clock axis, lanes per actor, ticks for `step.*`. Vanilla DOM + CSS gradient bars.

### Problems

1. **Hardcoded node positions don't scale.** Adding `validator` actor (per AGENTS.md §Actors) or splitting an actor breaks layout. A layout engine (dagre/ELK) would handle this automatically.
2. **No critical-path overlay.** Lightstep traces highlight the slowest parent-child chain; Crumb has the data (latency_ms in metadata) but doesn't surface it.
3. **No service-map view.** Edges between actors carry meaning (handoff types: flow / respawn / rollback / fallback / terminal / audit / intervene / resume) but aren't aggregated. Datadog Service Map shows req/s + avg latency + error rate per edge; Crumb's edges are decorative.
4. **Pipeline tab and Waterfall tab don't share legend or color encoding.** Per Datadog APM trace detail, both should use identical colorways for actor identity.
5. **No outlier surfacing.** Honeycomb BubbleUp lets users drag-select an outlier latency band → get baseline-vs-selection histograms for every attribute. For Crumb, the equivalent is "this verifier judge took 4× longer than other judges in the session — what was different?" — currently not surfaceable.

### Frontier patterns mined

| Source | Pattern adopted |
|---|---|
| **Datadog APM Trace Detail** ([docs.datadoghq.com](https://docs.datadoghq.com/tracing/trace_explorer/trace_view/)) | Flame graph as default, waterfall as toggle. Click a span → side tabs (Tags, Logs, Host). Group by Service / Host. Toggle % Exec Time vs Span count. |
| **Datadog Service Map** ([docs.datadoghq.com](https://docs.datadoghq.com/tracing/services/service_page/)) | Force-directed; node = service (color/size encodes traffic + error rate); edge = dependency (hover reveals req/s, avg latency, error rate). Inferred deps tinted purple. |
| **Honeycomb BubbleUp** ([honeycomb.io](https://www.honeycomb.io/platform/bubbleup)) | Heatmap (latency × time) → drag-select outlier → side-by-side histograms (orange = selected, blue = baseline) per attribute. |
| **Lightstep / Jaeger / Tempo** ([docs.lightstep.com](https://docs.lightstep.com/docs/view-traces)) | Hierarchical span tree, child-count badge on collapsed nodes, automatic critical-path black line. |

### View hierarchy proposal

```
[Pipeline] [Waterfall] [Service Map] [Logs] [Output]
   ▲           ▲            ▲ NEW
   │           │            │
   topology    wall-clock   aggregated edges (req/s + latency p50/p95
   (current    (PR #142)    + error rate per actor pair)
    DAG)
```

All three viz tabs share:
- Right-rail detail panel (already shared between Pipeline + Waterfall via PR #142).
- Actor color palette (Open Props `--accent-{actor}` tokens).
- Critical-path overlay toggle (top-right of viz pane).
- BubbleUp-style outlier mode (drag-select on Waterfall → highlight events; on Service Map → tint slow edges red).

### Stack decision

| Concern | Pick | Justification |
|---|---|---|
| Topology layout engine | **dagre 0.8** (~50kB min, MIT) raw output → render via existing hand-rolled SVG | Cytoscape.js (~330kB) is overkill for ≤9 nodes. Dagre gives layered DAG layout (Sugiyama framework), preserves the current SVG renderer, replaces only the position-computation step. ELK.js is heavier (Java→JS compile) and adds no value for our node count. |
| Service Map (new) | Same dagre layout + edge aggregation in JS (group `agent.wake` → `agent.stop` pairs by `(from_actor, to_actor)`, compute req/s + p50/p95 + error rate) | Reuses dagre, no second graph library. Edge thickness = req/s, edge color = error rate, hover tooltip = full stats. |
| Critical-path overlay | Pure JS: walk the longest chain of dependent spans by `metadata.parent_id` (or fall back to wall-clock chain when missing). Render as bold black SVG path. | Lightstep convention. Algorithmic, no library. |
| BubbleUp-style outlier mode | Drag-select on `waterfall-body` (PR #142 already has the layout) → call `renderHistograms(selectedSpans, baseline)` → side panel renders one inline mini-histogram per metadata attribute. Vanilla SVG. | Reuses Waterfall layout. No new dep. |
| Color tokens | Open Props (shared with Surface 1) | Same source of truth across both surfaces. |

**New runtime deps for Surface 2**: `dagre`. Total ~50kB min. Combined with Surface 1 (alpinejs + fuse.js): ~77kB gz of new vendor JS. Acceptable for an evaluator-facing single-binary tool.

### Anti-deception alignment

The redesign must respect AGENTS.md §Architecture-invariants:
- **Invariant 4 (three-layer scoring source-of-truth):** Service Map error-rate edges must come from `kind=judge.score` deterministic D2/D6 (qa-check-effect), not from LLM verdict text. Source attribution required in tooltip ("error from qa-check-effect" / "error from verifier-llm").
- **Invariant 5 (anti-deception schema enforcement):** Critical-path overlay must skip spans whose `qa.result` is missing — unverified spans cannot define the critical path.
- **Invariant 7 (append-only transcript):** All viz layers re-derive on every transcript append; no client-side state mutation.

## Implementation roadmap (deferred)

Five-PR sequence, in order. Each PR is independently mergeable and CI-green.

| PR | Branch | Scope | Verify gate adds |
|---|---|---|---|
| **PR-S1** | `feat/studio-new-session-cascade` | Replace top-level adapter dropdown with per-actor cascade. Add Alpine.js + WAI-ARIA combobox. Goal becomes textarea. Backend accepts `bindings` payload + writes ephemeral preset.toml. | `lint:knip` ignore for `alpinejs`/`fuse.js`. New unit tests for `serveCrumbRun()` bindings → preset.toml mapping. |
| **PR-S2** | `feat/studio-model-card-panel` | Capability badge strip + selected model card side panel. Pull capability metadata from `MODEL_CATALOG` (existing) + extended capability fields (`context_window`, `modalities`, `price_tier`, `thinking`). | New JSON Schema validation for capability fields. |
| **PR-S3** | `feat/studio-command-palette` | ⌘K command palette (Linear/Raycast pattern), preset fuzzy-search via fuse.js, keyboard-first spawn. | E2E test: ⌘K → "cross" → enter → bindings pre-filled. |
| **PR-V1** | `feat/studio-pipeline-dagre-layout` | Replace hardcoded `DAG_NODES` positions with dagre-computed layout. No visual regression for existing 9-node graph. Add validator actor without code change to `DAG_NODES`. | Snapshot test: dagre layout for known transcript = stable across runs. |
| **PR-V2** | `feat/studio-service-map-view` | New "Service Map" tab. Edge aggregation (req/s, p50/p95, error rate). Critical-path overlay toggle. BubbleUp-style outlier mode on Waterfall. | New tab in nav, tests for edge aggregation arithmetic. |

Total estimated CSS additions: ~600 LoC. JS additions: ~1200 LoC. New deps: `alpinejs`, `fuse.js`, `dagre`.

## Open questions for review

1. **Should preset chips and per-actor bindings be mutually exclusive** (selecting a chip locks bindings) or **mergeable** (chip pre-fills, user can override per-actor)? Datadog precedent: mergeable, but lock with a "modified" badge so the user knows they're off-template.
2. **Where does the ephemeral preset file live?** `sessions/<id>/.crumb/preset.toml` is the cleanest, but `preset-loader.ts` currently only looks under `.crumb/presets/`. Either extend the loader or copy the ephemeral file into the standard location at session start.
3. **Should the Service Map default to Pipeline view or replace it?** Datadog APM treats Service Map as primary and the topology graph as a drill-down. We may want the same — Service Map as default tab once it ships, Pipeline-DAG as a power-user toggle.
4. **Bundle delivery**: vendor Alpine + fuse.js + dagre as inline strings (current `inline-client.mjs` pattern) or ship as separate `<script>` tags from the static dir? Inlining preserves the single-binary deployment but bloats `studio-html.generated.ts` to ~330KB.

These resolve before PR-S1 lands.

## References

### Frontier patterns
- [Datadog Monitor querying](https://docs.datadoghq.com/dashboards/querying/)
- [DRUIDS — Datadog's design system](https://www.datadoghq.com/blog/engineering/druids-the-design-system-that-powers-datadog/) · [components catalog](https://druids.datadoghq.com/components)
- [Google AI Studio model catalog](https://ai.google.dev/gemini-api/docs/models)
- [Vertex AI Model Garden](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-garden/explore-models)
- [Anthropic Workbench](https://support.claude.com/en/articles/8606378-how-do-i-use-the-workbench)
- [OpenAI Playground](https://platform.openai.com/playground)
- [Honeycomb Query Builder](https://docs.honeycomb.io/investigate/query/build) · [BubbleUp](https://www.honeycomb.io/platform/bubbleup)
- [Datadog APM Trace View](https://docs.datadoghq.com/tracing/trace_explorer/trace_view/) · [Service Page](https://docs.datadoghq.com/tracing/services/service_page/) · [Flame graph KC](https://www.datadoghq.com/knowledge-center/distributed-tracing/flame-graph/)
- [Lightstep view traces](https://docs.lightstep.com/docs/view-traces)
- [cmdk — command menu primitive](https://cmdk.paco.me/)

### Stack research
- [WAI-ARIA APG combobox select-only reference](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/)
- [Native `<dialog>` + Popover API Baseline](https://web.dev/articles/baseline-in-action-dialog-popover)
- [Alpine.js docs](https://alpinejs.dev/) · [HTMX vs Alpine comparison](https://blog.openreplay.com/htmx-vs-alpine-when-use/)
- [Choices.js](https://github.com/Choices-js/Choices) (alternative considered, rejected for bundle size)
- [d3-flame-graph](https://github.com/spiermar/d3-flame-graph) (alternative considered, rejected — multi-actor wall-clock fits waterfall not flame)
- [Cytoscape.js](https://js.cytoscape.org/) · [vis-network · Sigma 2026 comparison](https://www.pkgpulse.com/blog/cytoscape-vs-vis-network-vs-sigma-graph-visualization-2026)
- [dagre layout](https://github.com/dagrejs/dagre) (chosen)
- [ELK.js layered layout](https://github.com/kieler/elkjs) (alternative considered, rejected — too heavy for ≤9 nodes)
- [Open Props design tokens](https://open-props.style/)

### Crumb internal references
- `wiki/synthesis/bagelcode-studio-observability-plan-2026-05-03.md` — preceding observability sprint plan (W-Studio-A)
- `AGENTS.md` §Architecture-invariants 4 / 5 / 7 / 11 — anti-deception, single source of truth, append-only, user-controlled bindings
- `src/dispatcher/preset-loader.ts:71-81` — HARNESS_DEFAULT_MODEL catalog
- `packages/studio/src/doctor.ts:42-79` — ADAPTERS probe catalog
- `packages/studio/src/client/studio.js:2316-2379` — current `spawnNewCrumbRun()`
- `packages/studio/src/client/studio.js:953-1099` — current DAG renderer
- `packages/studio/src/client/studio.js:356-409` — current swimlane renderer
- PRs #137 / #139 / #140 / #141 / #142 — preceding W-Studio-A observability sprint
