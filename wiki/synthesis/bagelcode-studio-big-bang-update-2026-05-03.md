---
title: Studio big-bang update — stack migration + feature roll-up
date: 2026-05-03
type: synthesis
status: plan
supersedes:
  - bagelcode-studio-datadog-grade-redesign-2026-05-03.md  # PR #143 (UI redesign — folded in)
related:
  - bagelcode-studio-observability-plan-2026-05-03.md       # O-series
  - bagelcode-studio-handoff-2026-05-03.md                  # F/W backlog
tags: [studio, migration, big-bang, react, dockview, datadog, frontier]
---

# Studio big-bang update — stack migration + feature roll-up

> One coherent rebuild that swaps Studio's vanilla-JS chassis for a React-native stack while preserving every section, every connection, and every datum surfaced today. Folds in the Datadog-grade redesign (PR #143), the inheritor backlog from the handoff (F4–F6, PR-O3–O5, W2–W4), and the cleanup queued in the Prune stream (chore/prune-dead-schema-kinds). Implementation is **gated on Prune-1/2/3 merging first** — the schema delta must settle before we redraw component boundaries on top of it.

## 1. Why big-bang, why now

Today's Studio shipped 12+ PRs in one day on a vanilla-JS monolith (`packages/studio/src/client/studio.{html,css,js}` at 6,694 LoC, no module boundaries). Each PR works, the visible surface is solid (4-pane layout, scorecard hybrid, error-budget burndown, waterfall, branding, theme system), but every additional feature (F4 sidebar toggle / F5 adapter modal / F6 block tear-off / PR-O4 aggregate strip / PR-O5 trace tree) lands as more `innerHTML` strings into the same monolith. Two structural blockers prevent the user-requested next tier:

1. **Reactive panels.** The user pointed out that the current splitter is not reactive — it only "lays on top" with a CSS overlay rather than truly reflowing the row above and below. CSS Grid + manual `requestAnimationFrame` resize handlers can be made reactive, but every panel pair (view-pane / swimlane, swimlane / narrative, narrative / feed) needs its own state machine and the bookkeeping compounds. A panel manager with proper reactive layout solves this once.
2. **Independently dockable narrative + feed.** The user wants Agent Narrative and Live Execution Feed to behave like VS Code's Output and Terminal panels — independently dockable, tear-off into a separate window, drag to re-stack. No vanilla-JS pattern reaches this without rewriting a panel manager from scratch (the F6 ticket).

A big-bang migration is justified when the next 5+ features all depend on the same structural change — they do. Doing them piecewise on vanilla means writing a panel manager + a reactive resize engine + a state-store + a routing layer in plain JS, which is exactly the scope of a small framework. Better to adopt the framework once.

## 2. Scope & invariants — what does NOT change

Per AGENTS.md and the user's directive ("일단 각 섹션이랑 노출하는 정보들은 유지하고 연결 로직도 마찬가지야"), the migration preserves:

- **Every API endpoint** — the Node http server in `packages/studio/src/server.ts` (954 LoC, 14 routes incl. 2 SSE) stays as-is. The migration is client-only.
- **Every section + every datum** rendered today: brand mark, adapters list, sessions list, new-session form, scorecard hybrid (composite + radar + drilldown bars), Pipeline (swimlane + DAG runtime overlay), Waterfall, Logs, Output, Transcript, console-narrative, console-feed, console-input slash bar, theme toggle, error-budget burndown, audit banner, conn-state pill.
- **Connection logic**: SSE on `/api/stream` and `/api/sessions/:id/logs/:actor/stream`, file-watching via chokidar on the server, transcript reading from `~/.crumb/projects/<id>/sessions/<id>/transcript.jsonl`.
- **Single-binary deployment** — `npx crumb-studio` continues to start the Node server, serve the built React bundle, auto-open the browser. No external CDN, no auth, no service worker.
- **AGENTS.md architecture invariants** — read-only observation surface (Studio never writes transcript directly; only `/api/sessions/:id/inbox` POST appends to inbox.txt which the dispatcher consumes via chokidar), append-only contract, transcript as single source of truth.

What does change: the **client-side rendering layer** (vanilla DOM mutation → React component tree), the **state store** (global mutable variables → Zustand + TanStack Query), the **panel manager** (custom CSS-Grid splitters → dockview), and the **build pipeline** (concatenation via `inline-client.mjs` → Vite SPA bundle, served by the same Node server as a static asset).

## 3. Stack decision

Backed by parallel research (n8n / Google AI Studio / Upstage Solar / Datadog DRUIDS / Allotment / dockview / TanStack ecosystem; see refs §10).

| Layer | Pick | Rationale |
|---|---|---|
| Build + dev | **Vite 6** | Static SPA bundle, fastest HMR, no SSR overhead. Plays nicely with our existing Node http server (no framework hijacks the request handler — Next/Remix/TanStack Start would). |
| Framework | **React 19** | Largest ecosystem coverage for the rest of the stack (dockview, shadcn/ui, Tremor, TanStack). React Server Components not used — pure client SPA. |
| Routing | **TanStack Router** | Type-safe routes with search-param state — perfect for `/sessions/<id>?view=waterfall&actor=builder` deep-links. ~12 kB gz. |
| Server state | **TanStack Query** | The 2026 default for data-heavy dashboards. SSE bridge via custom `useSseSync` hook (`queryClient.setQueryData` for transcript stream / `invalidateQueries` for slow-changing). ~13 kB gz. |
| Ephemeral UI state | **Zustand** | Panel layout state, slash-bar input, toasts. ~1 kB gz. No Jotai/Valtio (one-call-site rule per CLAUDE.md). |
| Panel manager | **dockview** ([dockview.dev](https://dockview.dev/)) | Only React panel library that satisfies all three user requirements simultaneously: (a) reactive resize (top shrinks as bottom grows, with CSS Grid under the hood); (b) independent docking — Narrative and Feed as separate panels in the bottom group, each with its own tab and drag-to-rearrange; (c) tear-off via `Floating Groups` + `Popout Windows` (`window.open` + `BroadcastChannel`). Zero deps, ~50 kB gz. v6.0.0 released 2026-05-02 (active). Allotment cannot tear off; react-resizable-panels cannot dock. |
| Component primitives | **shadcn/ui** (Radix + Tailwind) | Owned source — copied into `packages/studio/src/client/components/ui/`, no NPM dep. Datadog-grade polish, used by Vercel / Linear / Resend in 2026. |
| Charts | **Tremor (Raw)** | SparkAreaChart for the score sparkline (PR-O4), DonutChart for adapter health, AreaChart for token burndown. Built on Recharts; matches shadcn aesthetic. |
| Interactive node canvas | **React Flow (`@xyflow/react`)** | The Pipeline panel is no longer a static SVG graph — the user wants n8n-style interactivity (drag nodes, pan/zoom, click → inspector). React Flow is the React-native equivalent of vue-flow (n8n's fork). Pluggable layout engines (dagre/ELK), custom node types, edge labels, minimap, viewport persistence. ~50 kB gz. |
| Styling | **Tailwind v4** + **Open Props** (only for the design tokens already in `design.md`) | Tailwind handles the bulk; Open Props variables expose the existing brand tokens (`--canvas`, `--ink`, `--primary`, actor lane palette) so the React components render in the same colors as today. |
| Forms (S1) | **React Hook Form + Zod** | New-session form has cascading validation (per-actor `harness` → `model` cascade per PR #143's redesign plan). RHF+Zod is the 2026 default. |
| Tests | **Vitest** (already used) + **Playwright** (already installed) | No change. |

Total new client deps: ~240 kB gz production bundle (React 19 ~45, dockview ~50, React Flow ~50, TanStack Router ~12, TanStack Query ~13, Zustand ~1, Tremor lazy-split, Tailwind no runtime). Well within evaluator-friendly budget.

**What we're NOT picking and why** — Next.js / Remix / TanStack Start (all own the server, conflict with our Node http + SSE), SolidJS / SvelteKit (lose dockview + shadcn ecosystem), Mantine (heavier runtime, less Datadog-feel), Allotment (no tear-off), react-resizable-panels (no dock).

## 4. File structure

```
packages/studio/
├── package.json                 [+ vite, react, dockview, shadcn deps]
├── tsconfig.json
├── vite.config.ts               [NEW — SPA build config, outputs to dist/client/]
├── tailwind.config.ts           [NEW]
├── postcss.config.js            [NEW]
└── src/
    ├── server/                  [extracted from src/, behavior preserved]
    │   ├── server.ts            [unchanged route handlers — 14 endpoints]
    │   ├── bootstrap.ts
    │   ├── event-bus.ts
    │   ├── watcher.ts
    │   ├── jsonl-tail.ts
    │   ├── metrics.ts
    │   ├── doctor.ts
    │   ├── paths.ts
    │   ├── poll-detect.ts
    │   ├── open-browser.ts
    │   └── *.test.ts
    ├── client/                  [NEW — React SPA, replaces studio.{html,css,js}]
    │   ├── index.html           [Vite entry, no inline blob]
    │   ├── main.tsx             [React root + Router + QueryClient]
    │   ├── routes/              [TanStack Router file-based]
    │   │   ├── __root.tsx       [shell: dockview frame + side bar]
    │   │   ├── index.tsx        [empty state — pick a session]
    │   │   └── sessions.$id.tsx [main session view]
    │   ├── panels/              [one file per dockview panel content]
    │   │   ├── AdapterList.tsx
    │   │   ├── SessionList.tsx
    │   │   ├── NewSessionForm.tsx     [PR #143 cascading form]
    │   │   ├── Scorecard.tsx          [composite + radar + drilldown]
    │   │   ├── Pipeline.tsx           [swimlane + interactive React Flow DAG]
    │   │   ├── pipeline/
    │   │   │   ├── DagCanvas.tsx      [React Flow + dagre seed + drag/pan/zoom]
    │   │   │   ├── ActorNode.tsx      [custom node type — actor card]
    │   │   │   ├── HandoffEdge.tsx    [custom edge — labels + throughput]
    │   │   │   ├── NodeInspector.tsx  [Detail Rail content when node selected]
    │   │   │   ├── layout.ts          [dagre seeding + persistence helpers]
    │   │   │   └── style-store.ts     [per-actor color override (Zustand slice)]
    │   │   ├── Waterfall.tsx          [PR #142]
    │   │   ├── Logs.tsx
    │   │   ├── Output.tsx
    │   │   ├── Transcript.tsx
    │   │   ├── AgentNarrative.tsx     [independent dockable]
    │   │   ├── LiveFeed.tsx           [independent dockable]
    │   │   ├── DetailRail.tsx         [right-rail event detail]
    │   │   ├── ErrorBudgetStrip.tsx   [PR-O2]
    │   │   └── SlashBar.tsx           [console-input]
    │   ├── components/ui/       [shadcn primitives — owned source]
    │   │   ├── button.tsx
    │   │   ├── dialog.tsx
    │   │   ├── command.tsx      [⌘K palette per redesign plan]
    │   │   ├── combobox.tsx     [WAI-ARIA APG cascading]
    │   │   ├── dropdown-menu.tsx
    │   │   ├── tabs.tsx
    │   │   ├── badge.tsx
    │   │   ├── tooltip.tsx
    │   │   └── ...
    │   ├── hooks/
    │   │   ├── useSessions.ts          [TanStack Query — /api/sessions]
    │   │   ├── useDoctor.ts            [TanStack Query — /api/doctor]
    │   │   ├── useTranscriptStream.ts  [SSE → query cache bridge]
    │   │   ├── useActorLogStream.ts
    │   │   ├── useTheme.ts             [light/dark + OS preference watcher]
    │   │   └── useDockviewLayout.ts    [persist layout to localStorage]
    │   ├── stores/
    │   │   ├── ui.store.ts             [Zustand — slash bar, toasts, modals]
    │   │   └── selection.store.ts      [Zustand — selected session/event]
    │   ├── lib/
    │   │   ├── api.ts                  [fetch wrappers — typed]
    │   │   ├── format.ts               [tokens / cost / pct / time formatters]
    │   │   ├── colors.ts               [actor lane palette — reads CSS vars]
    │   │   └── design-tokens.ts        [TS export of design.md tokens]
    │   ├── styles/
    │   │   ├── globals.css             [Tailwind base + Open Props imports]
    │   │   └── theme.css                [light defaults + [data-theme=dark] overrides — moved from studio.css]
    │   └── DESIGN.md                    [Stitch 9-section, per PR #143 PR-S0]
    ├── shared/                          [types reused server↔client]
    │   ├── protocol.ts                  [re-exports from src/protocol/]
    │   └── live-event.ts
    ├── cli.ts                           [unchanged — bin entry]
    ├── index.ts                         [public API exports]
    ├── studio-html.ts                   [REPLACED — now reads dist/client/index.html]
    └── (deletes) studio-html.generated.ts, scripts/inline-client.mjs

CHANGED: `scripts/inline-client.mjs` is retired. `scripts/build-client.mjs` (or `vite build`)
emits `dist/client/{index.html, assets/index-<hash>.js, assets/index-<hash>.css}`. The Node
server's `serveHtml()` reads `dist/client/index.html` once at startup, and a static-file
handler serves `/assets/*` from `dist/client/assets/`. Single-binary `npx crumb-studio` shape
preserved — Vite output is bundled into the published npm package via `files` glob.
```

## 5. Panel topology (dockview)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ┌──────────────┐ ┌─────────────────────────────────────────────────────┐   │
│ │ SIDE BAR     │ │ MAIN GROUP                                          │   │
│ │ (dock left)  │ │ ┌─ tabs ─────────────────────────────────────────┐  │   │
│ │              │ │ │ Pipeline │ Waterfall │ Logs │ Output │ Transcript │  │   │
│ │ ▸ Brand      │ │ ├──────────────────────────────────────────────────┤  │   │
│ │ ▸ Adapters   │ │ │ Scorecard strip (composite + radar + drilldown)  │  │   │
│ │ ▸ Sessions   │ │ ├──────────────────────────────────────────────────┤  │   │
│ │              │ │ │                                                  │  │   │
│ │ (collapsible │ │ │       view-pane (active tab content)             │  │   │
│ │  via dockview│ │ │                                                  │  │   │
│ │  Hide Panel) │ │ ├══════════════════════════════════════════════════┤  │   │
│ │              │ │ │  BOTTOM GROUP (dockview group, default split)    │  │   │
│ └──────────────┘ │ │  ┌─ Agent Narrative (panel) ─┬─ Live Feed (panel) ─┐│   │
│                  │ │  │ tab + drag handle         │ tab + drag handle  ││   │
│                  │ │  │ • independently sized     │ • independently    ││   │
│                  │ │  │ • drag to re-order        │   sized            ││   │
│                  │ │  │ • tear off → popout window│ • tear off too     ││   │
│                  │ │  └───────────────────────────┴────────────────────┘│   │
│                  │ │                                                    │   │
│                  │ ┌─ DETAIL RAIL ─────────────────────────────────────┐  │   │
│                  │ │ (right-side panel, dockable, default visible)     │  │   │
│                  │ │ event detail + tag pills + audit banner + nav     │  │   │
│                  │ └───────────────────────────────────────────────────┘  │   │
│                  └────────────────────────────────────────────────────────┘   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ STATUS BAR — error-budget strip + theme toggle + ⌘K hint + conn state    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

Key dockview features the user explicitly asked for:
- **Reactive resize** — drag the splitter between view-pane and bottom-group; both panels reflow immediately (no overlay). dockview uses CSS Grid `1fr auto` + ResizeObserver; layout state is a serializable JSON tree persisted to `localStorage.crumb.studio.dockview.layout`.
- **Independent narrative + feed** — both are panels inside the bottom group. Drag a tab out → floating group; drag the floating group's chrome → separate browser window via `window.open` + `BroadcastChannel`. Closing the popout re-docks. State is preserved across reload.
- **Sidebar collapse (F4)** — dockview has built-in `Hide Panel` / `Show Panel` actions. ⌘B toggles the sidebar. Free, no custom CSS.
- **Block tear-off (F6)** — solved by dockview's popout. The 4–6h custom-window-management ticket disappears.

## 6. Per-section migration mapping

Every existing section maps 1:1 to a React panel; no datum is lost. Color encodings, splitter behavior, hover states, animations, and accessibility all preserved.

| Today (vanilla `studio.js` function / DOM id) | Tomorrow (React panel / hook) | Notes |
|---|---|---|
| `renderAdapterList()` + `#adapter-list` | `<AdapterList>` panel + `useDoctor()` | Health dot + install hint modal preserved |
| `renderSessionList()` + `#sess-list` | `<SessionList>` panel + `useSessions()` | Per-row pill (lifecycle) + cancel button |
| `#new-session-form` + `spawnNewCrumbRun()` | `<NewSessionForm>` panel | Implements PR #143 cascading harness→model design + cmdk palette |
| Brand wordmark `<div class="brand">` (PR #148) | `<BrandMark>` in sidebar header | SVG inlined as React component |
| `renderScorecard()` + `.scorecard-bar` | `<Scorecard>` panel | Composite + radar (D3 / pure SVG) + drilldown bars; Tremor Donut alternative for adapter mix |
| `renderSwimlane()` + `.swimlane` | `<Pipeline>` panel `view=swimlane` | Lane-per-actor with grouped chips |
| `renderDag()` + `#dag-svg` | `<Pipeline>` panel `view=dag` (React Flow canvas) | Becomes an **interactive editor** per §6.1 below — dagre seeds default positions, React Flow handles drag + pan + zoom + click-to-inspect. Hardcoded `DAG_NODES` retired. |
| `renderWaterfall()` + `.waterfall` (#142) | `<Waterfall>` panel | Same span derivation logic; canvas via Tremor BarList alternative or custom SVG |
| `renderLogs()` + log stream EventSource | `<Logs>` panel + `useActorLogStream()` | 2026 SSE pattern — query cache + `setQueryData` for chunk events |
| `renderOutput()` artifacts iframe | `<Output>` panel | iframe sandbox preserved (`sandbox="allow-scripts allow-same-origin"`) |
| `renderTranscript()` raw-event view | `<Transcript>` panel | Virtualized list via TanStack Virtual |
| `.console-narrative` | **`<AgentNarrative>` panel — independently dockable** | User's explicit ask |
| `.console-feed` + `FEED_FORMATTERS` | **`<LiveFeed>` panel — independently dockable** | 18 per-kind formatters preserved as a `formatters/` map |
| `.console-input` slash bar | `<SlashBar>` panel | bound to `/api/sessions/:id/inbox` POST |
| Right-rail `#detail-*` | `<DetailRail>` panel | Sticky header + paginator + tag pills + resource bar |
| `#audit-banner` + `#conn-state-pill` | `<StatusBar>` items | Plus error-budget strip (PR-O2) |
| Theme toggle + `initThemeToggle()` | `<ThemeToggle>` + `useTheme()` | Pre-paint script unchanged in `index.html` |
| `initPaneSplitters()` IIFE | dockview built-in | Hand-rolled CSS-Grid splitter retired |

### 6.1 Interactive Pipeline canvas (n8n-style)

Per the user's directive ("유저가 표기되는 맵을 손으로 움직여가면서 확인할 수 있어야 해 — n8n처럼 절차들을 커스텀 가능 — 노드 클릭하면 세부 세팅/수치/스타일도 유저가 고를 수 있게"), the Pipeline DAG graduates from a static SVG to an interactive canvas.

#### Capabilities

| Capability | Implementation |
|---|---|
| **Pan / zoom** | React Flow `<Controls>` + viewport persistence (localStorage). Pinch-to-zoom on trackpad, ⌘+/⌘- keyboard shortcuts. |
| **Drag nodes** | React Flow built-in `nodesDraggable=true`. Per-node positions persist to `localStorage.crumb.studio.pipeline.layout.<sessionId>` (or per-project default). |
| **Default layout** | On first visit (or "Reset layout" button), dagre auto-layouts the 8 actors (post-Prune-2). User edits override the default; localStorage hydrates on return. |
| **Click → inspect** | React Flow `onNodeClick` opens `<NodeInspector>` in the right Detail Rail (replacing event detail when a node is selected). Inspector shows: actor name, current binding (`harness × model × effort`), sandwich preview (read-only), live counters (token total, cost, latency p50/p95, last `step.*` event), and per-actor color override (Open Props CSS var token picker). |
| **Edit binding from inspector** | Same shape as the new-session form's per-actor row (PR #143 cascading harness→model). Saves as a `user.intervene { swap: { from: actor, to: adapter } }` event POSTed to `/api/sessions/:id/inbox` — preserves AGENTS.md read-only invariant (Studio never writes transcript directly; the dispatcher consumes inbox + emits the swap). |
| **Style override per node** | Pick from the actor's lane palette (`--actor-builder` etc.), or a custom hex. Persisted to localStorage (visual-only; doesn't write transcript). |
| **Edge labels** | React Flow custom edge component shows handoff type (flow / respawn / rollback / fallback / terminal / audit / intervene / resume) + live throughput per PR-J' (#134). Slow edges still tint red. |
| **Minimap** | React Flow `<MiniMap>` bottom-right corner, toggleable. |
| **Custom node types (future)** | The architecture supports user-added "annotation" nodes (e.g., text labels on the canvas) — out of scope for M4, deferred to M9 (post-parity polish). |
| **Reset to default layout** | Button in the Pipeline toolbar (top-right of canvas). Clears localStorage entry for current session, re-runs dagre. |

#### Default layout seeding

The 8 actors (post-Prune-2: `coordinator`, `planner-lead`, `researcher`, `builder`, `verifier`, `validator`, `system`, `user`) are positioned via **dagre** (`@dagrejs/dagre` ~50 kB). Direction left→right; rank separator 80 px; node separator 40 px. The dagre output feeds React Flow's `nodes` prop on initial mount; subsequent user drags update `nodes` directly (controlled component pattern — `useNodesState`).

#### Inspector contract

```tsx
// packages/studio/src/client/panels/NodeInspector.tsx
interface NodeInspectorProps {
  actor: Actor;            // 'planner-lead' | 'researcher' | ... (8 post-Prune-2)
  sessionId: string;
}

// renders sections:
// 1. Identity         — actor name + role, brand-mark color
// 2. Binding          — harness × model × effort (editable; emits user.intervene)
// 3. Live metrics     — token / cost / latency (p50/p95) / last step.* / circuit state
// 4. Sandwich preview — read-only; loads from /api/sessions/:id/sandwich/:actor
// 5. Style override   — color picker (per-user, localStorage-only)
// 6. Recent events    — last 5 `step.*` + `judge.score` for this actor (deep-link to detail)
```

The Inspector lives in the Detail Rail (right-side dockview panel) and replaces the event-detail content while a node is selected; clicking elsewhere on the canvas (or pressing Esc) restores event-detail mode.

#### Acceptance criteria for the interactive pipeline

- Drag any node → position updates immediately, persists across reload
- Click node → Inspector opens in Detail Rail with all 6 sections populated
- Edit binding from Inspector → toast confirms `user.intervene` posted; SSE shows the swap event
- "Reset layout" button restores dagre default
- Pan + zoom + minimap all functional via keyboard + mouse + trackpad
- Pipeline view performance: 60 fps when dragging (React Flow profiles at <16 ms per frame for ≤20 nodes)

## 7. Migration roadmap — strangler fig in 9 PRs

The migration is paced so the live `npx crumb-studio` keeps working at every step (no flag day). The legacy bundle and the React bundle co-exist behind `?app=v2` until parity is reached, then the legacy is deleted.

| # | Branch | Scope | Demo gate |
|---|---|---|---|
| **M0** | `chore/studio-vite-scaffold` | Add Vite + React deps. Create `packages/studio/src/client-v2/{index.html,main.tsx}` "Hello world". Wire `vite build` → `dist/client-v2/`. Add `serveHtmlV2()` route gated on `?app=v2`. Legacy bundle untouched. | `?app=v2` shows blank React shell + sessions JSON dump |
| **M1** | `chore/studio-server-extract` | Move `server.ts` + siblings under `src/server/` for clarity. No behavior change. Update import paths. | All existing tests pass; `npm run build` clean |
| **M2** | `feat/studio-v2-shell-dockview` | dockview + shadcn primitives + Tailwind v4 + Open Props vars. App shell with empty panels. Sidebar (Brand + Adapters + Sessions placeholders) + Main + Bottom group + Status bar. | `?app=v2` shows full dockview frame, drag splitters work, layout persists |
| **M3** | `feat/studio-v2-sidebar` | `<AdapterList>` + `<SessionList>` + `<NewSessionForm>` (cascading per PR #143) + `<BrandMark>` (#148 SVG) + ⌘K palette. TanStack Query for `/api/sessions` + `/api/doctor`. | `?app=v2` left sidebar fully functional; can spawn a session |
| **M4** | `feat/studio-v2-pipeline-waterfall` | `<Pipeline>` (swimlane + interactive React Flow DAG with dagre seed layout, drag/pan/zoom/click → `<NodeInspector>`, layout persistence) + `<Waterfall>` + `<DetailRail>` (dual-mode: event detail or node inspector). SSE stream → query cache. | `?app=v2` user can drag pipeline nodes, click to inspect/edit binding, layout persists across reload |
| **M5** | `feat/studio-v2-bottom-panels` | `<AgentNarrative>` + `<LiveFeed>` as independently dockable panels. `<SlashBar>` → inbox POST. Both panels tear-off into popout windows. | User can drag Narrative tab out into a separate window; Feed alone in main, popout-Narrative continues to receive SSE |
| **M6** | `feat/studio-v2-scorecard-budget` | `<Scorecard>` (composite + radar + drilldown) + `<ErrorBudgetStrip>` (PR-O2 reborn) + `<Logs>` + `<Output>` + `<Transcript>`. | `?app=v2` reaches parity with v1 |
| **M7** | `feat/studio-v2-default-on` | Flip default to v2. `?app=v1` continues to work as escape hatch. CHANGELOG entry; docs update. | `npx crumb-studio` opens v2 by default |
| **M8** | `chore/studio-v1-removal` | Delete `studio.{html,css,js}` + `inline-client.mjs` + `studio-html.generated.ts`. Keep server unchanged. | Bundle drops legacy ~260KB blob |

Estimate: 4–7 days of focused work per PR (M2 / M3 / M4 are the heaviest). Total ~3 weeks if linear; PR-Prune-1/2/3 land first (≤1 day) so the schema we render is the cleaner one.

## 8. Inherited backlog — where each item lands

| Backlog | Lands as | Notes |
|---|---|---|
| **F4** sidebar collapse | M3 (free via dockview) | Hand-rolled hamburger ticket disappears |
| **F5** adapter modal advanced | M3 (`<AdapterDoctorDialog>` via Radix Dialog) | Auth + install hint card, copy buttons |
| **F6** block tear-off | M5 (free via dockview popout) | The 4–6h risky ticket becomes built-in |
| **PR-O3** wall-clock waterfall | M4 (already shipped #142, port logic to React) | No new behavior; refactor only |
| **PR-O4** aggregate strip + sparkline | M6 (Tremor SparkAreaChart) | D1–D6 lines + token/cost live |
| **PR-O5** trace tree + cross-provider chip | M6 (custom recursive tree) | Reuses dockview right-rail |
| **W2** sandwich byte-identical CI test | independent — server-side, no migration impact | Land any time |
| **W3** design_check deterministic gate | independent — reducer-side | Land any time |
| **W4** retry policy with cache-hit monitoring | independent — reducer-side | Land any time |
| **PR-Prune-1/2/3** (other stream) | **PRE-REQUISITE** for M0 | Schema delta + actor list must settle before we draw component shapes |
| **PR #143 redesign plan** (merged) | Implementation lives in M3 (form) and M4 (pipeline) | This page supersedes the standalone implementation tickets |

## 9. Risks, mitigations, open questions

### Risks

1. **Bundle size regression.** Vanilla today: ~260KB inlined. React stack: ~190 kB gz post-build (parsed ~700 kB). Mitigation: code-split routes (TanStack Router lazy routes), defer Tremor chart imports, tree-shake Tailwind. Acceptable for an evaluator-facing dev tool.
2. **dockview bus factor.** 3.2k stars, single maintainer. Mitigation: zero-dep architecture (we can vendor it if abandoned); fallback to react-resizable-panels + manual popout via `window.open` is feasible if needed.
3. **SSE reconnect semantics.** TanStack Query doesn't ship native SSE; `useSseSync` must handle `Last-Event-ID` and reconnect. Mitigation: reuse the proven SSE handler from current `studio.js` `subscribeStream()` logic — port the algorithm, not the framework.
4. **dagre layout stability.** Replacing hardcoded `DAG_NODES` with dagre may shift visual positions. Mitigation: snapshot test pinning a fixed transcript → fixed layout; lock seed.
5. **Strangler-fig coexistence period.** v1 and v2 sharing the same Node server but rendering differently could confuse a user mid-PR. Mitigation: prominent banner on `?app=v2` saying "preview build"; flip default only after M6 parity gate.

### Open questions (resolve before M0)

1. **Tailwind v4 vs v3** — v4 is stable (Apr 2026) but newer; v3.4 is battle-tested. Default to v4 unless Tremor incompatibility surfaces.
2. **shadcn/ui CLI vs manual copy** — owned source either way; CLI is faster but needs npm registry access in CI. Default to manual copy (no extra dep).
3. **Where do dockview layouts persist?** localStorage per-session? per-user? Default: per-user (single-machine evaluator scenario), keyed under `crumb.studio.dockview.v1`.
4. **Brand mark size in dockview header** — current 26×26 fits sidebar; in dockview's compact group header may need a 16×16 variant. Add `<BrandMark variant="sm|md">` prop.
5. **Should the Detail Rail be a dockview panel or a Radix Sheet?** Panel = part of layout, persistable. Sheet = overlay, modal-like. Default: panel (matches today's behavior; required for §6.1 Inspector dual-mode).
6. **Pipeline custom annotation nodes** — should users be able to add their own text-label nodes on the canvas (n8n's "Sticky Notes")? Default: deferred to M9 polish; M4 ships read-only canvas with editable bindings + style.
7. **Per-session vs per-project pipeline layout** — n8n persists per-workflow. Crumb default: per-session for now (overrides last across reload), with a "Save as project default" affordance in M9.

## 10. References

### Frontier UI/UX
- [Datadog DRUIDS](https://www.datadoghq.com/blog/engineering/druids-the-design-system-that-powers-datadog/) · [components catalog](https://druids.datadoghq.com/components)
- [Google AI Studio](https://aistudio.google.com) · [model picker docs](https://ai.google.dev/gemini-api/docs/models)
- [Upstage Solar Console](https://console.upstage.ai/playground/chat) — Korean LLM playground UX reference
- [n8n editor-ui frontend](https://github.com/n8n-io/n8n/tree/master/packages/frontend/editor-ui) — Vue+Vite stack reference (architecture patterns transferable)
- [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) — Stitch [DESIGN.md format](https://stitch.withgoogle.com/docs/design-md/format/) — used for `packages/studio/src/client/DESIGN.md`

### Stack research (chosen + considered)
- [dockview.dev](https://dockview.dev/) · [github.com/mathuo/dockview](https://github.com/mathuo/dockview) — chosen panel manager
- [github.com/bvaughn/react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) — considered, no tear-off
- [github.com/johnwalley/allotment](https://github.com/johnwalley/allotment) — VS Code split, no tear-off
- [React Flow / Xyflow](https://reactflow.dev/) · [github.com/xyflow/xyflow](https://github.com/xyflow/xyflow) — chosen for interactive Pipeline canvas
- [@dagrejs/dagre](https://github.com/dagrejs/dagre) — chosen for default layout seeding
- [n8n editor canvas (vue-flow)](https://github.com/n8n-io/n8n/tree/master/packages/frontend/editor-ui/src/components/canvas) — UX precedent for the interactive pattern
- [TanStack Router](https://tanstack.com/router) · [Query](https://tanstack.com/query) · [comparison vs Next/Remix](https://tanstack.com/start/latest/docs/framework/react/comparison)
- [Vite 6](https://vitejs.dev/) · [SSE + TanStack Query guide — ollioddi.dev](https://ollioddi.dev/blog/tanstack-sse-guide)
- [shadcn/ui](https://ui.shadcn.com/) · [Tremor](https://www.tremor.so/) · [Open Props](https://open-props.style/)

### Internal references
- `wiki/synthesis/bagelcode-studio-handoff-2026-05-03.md` — F/W backlog source of truth
- `wiki/synthesis/bagelcode-studio-observability-plan-2026-05-03.md` — O-series 5-PR roadmap (PR-O3 done, O4/O5 pending)
- `wiki/synthesis/bagelcode-studio-datadog-grade-redesign-2026-05-03.md` — Cascading form + row design + DESIGN.md spec; folded into M3+M4 of this plan
- `AGENTS.md` §Architecture-invariants — read-only observation, append-only, transcript-as-truth (preserved by this migration)
- `CLAUDE.md` §"No new abstraction unless 2+ call sites" — applied to state libraries (Zustand only, no Jotai+Valtio mix)
- `design.md` (repo root, F3 #146) — token source of truth, exposed as Open Props vars in M2
- `packages/studio/src/server.ts:90-152` — request router (preserved as-is)
- `packages/studio/src/client/studio.js` (LoC counts cited in §6) — function inventory mapped to React panels

---

## Trigger criteria — when to start M0

Start M0 (`chore/studio-vite-scaffold`) when **all four** of these are true:

1. PR-Prune-1 merged (dead schema kinds removed)
2. PR-Prune-2 merged (builder-fallback removed → 8-actor list)
3. PR-Prune-3 merged (reducer judge.score case extracted)
4. User explicitly approves this plan (no implicit consent)

Until then, the existing piecewise PRs (F4/F5 etc.) **are not started** — the work would be wasted re-implementation post-migration. Better to wait.
