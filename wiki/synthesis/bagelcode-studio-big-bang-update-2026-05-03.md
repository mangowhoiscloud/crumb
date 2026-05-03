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

## 0.0 Vanilla → Big-bang cutoff (executed 2026-05-03)

User directive 2026-05-03: *"빅뱅 왜 진행안했어. 지금 바닐라 어디까지 구현하고 빅뱅할래. 체계적으로 잡아."* — concern that the main agent was over-accumulating vanilla improvements while the React migration sat in plan limbo. Trigger criteria (Prune-1/2/3 merged + user explicit approval) all satisfied as of this commit. **M0 starts immediately**; no further vanilla feature work is queued except what is already shipping.

### Vanilla last-call (cutoff frozen)

These PRs land on vanilla because they are already in flight, address concrete user-requested defects, and feed the M2 baseline snapshot:

| PR | Status | Why it stays on vanilla |
|---|---|---|
| #161 `feat(studio): adapter auth detail — plan tier + login expiry + .env support` | rebased, CI re-running | User-requested, implemented + once-CI-passing. The .env loader pre-reqs §13.1 portability work, so landing now means M0 starts with the correct auth-resolution chain. |
| #164 `feat(studio): relocate sidebar toggle next to CRUMB STUDIO wordmark` | merged | Hamburger now matches Image #16 spec — captured in M2 visual baseline. |

### Defers to big-bang — no longer on vanilla

| Item | Lands as | Was tempted to vanilla? |
|---|---|---|
| Cascading new-session form (preset-chip + harness-row + model-row + multi-line goal + capability badges + selected model card panel + ⌘K palette + density toggle) | **M3** `feat/studio-v2-sidebar` | Yes — branch `feat/new-session-cascade` was started and **abandoned** at this cutoff. Full §6 spec lives in M3. |
| F5 adapter modal advanced | M3 `<AdapterDoctorDialog>` | Yes — defer |
| F6 block tear-off | M5 (free via dockview popout) | Yes — defer |
| PR-O4 aggregate strip + sparkline | M6 (Tremor SparkAreaChart) | Yes — defer |
| PR-O5 trace tree + cross-provider chip + lifecycle gauge | M6 | Yes — defer |
| Service Map view | M4 `<ServiceMap>` | Never on vanilla — defer |
| Critical-path overlay | M4 (toggle shared across viz tabs) | Never on vanilla — defer |
| BubbleUp drag-select outlier mode | M4 (Waterfall) | Never on vanilla — defer |
| W3 design_check Studio surface | M6 `<DesignCheckPanel>` | Reducer-side W3 still ships independently; UI surface defers |

**Rule**: any new feature work that would land in `packages/studio/src/client/studio.{html,css,js}` must instead target `packages/studio/src/client-v2/` (the M0 scaffold output). The legacy bundle accepts only bug fixes that block the M2 baseline snapshot.

### 0.0.1 Vanilla last-call exception — parallel-stream PR-O4 sparklines

While the cutoff was being committed, another stream pushed `feat/aggregate-strip-sparkline` (`feat(studio): score-trajectory sparklines + per-actor metric tooltips (PR-O4)`) — a +55 LoC CSS / +122 LoC JS additive change to the v1 vanilla bundle. The plan accommodates it without rolling back:

| Concern | Resolution |
|---|---|
| Does it land on vanilla? | Yes — additive only, no schema or layout shift, fits the M2 visual baseline. |
| Does it duplicate M6 work? | Logic-wise yes (sparklines render score history); structurally no (vanilla DOM vs Tremor SparkAreaChart). M6 ports the **derivation formulas** (D1-D6 history extraction, per-actor token/cost/latency rollup) **verbatim**, then re-renders via Tremor — same numbers, different chrome. |
| What carries forward to M2/M3/M6? | (a) Visual baseline snapshot in M2 captures the sparkline + tooltip pixel-for-pixel as the target chrome v2 must match. (b) Derivation helpers (`scoreHistoryFor()` / `aggregateActorRuntime()` from this PR) move into `packages/studio/src/server/metrics.ts` as part of the §17 audit's "client recompute → server-derived" fix in M1. M6's `<Scorecard>` panel reads the same `metrics.per_actor` + `metrics.score_history` fields the v1 implementation needed. |
| Is the cutoff broken? | No. The cutoff says "vanilla last-call (cutoff frozen)" — PR-O4 was already in-flight before the cutoff committed. It joins #161 + #164 as a third vanilla last-call. Future PR-O5 / F5 / etc. still defer per the original list. |

**Action when PR-O4 lands**: M2 baseline snapshot includes the sparklines; M6 mapping table gets a row pointing at the exact formula source so re-implementation has one place to reference; CHANGELOG `[Unreleased]` records "PR-O4 sparklines (vanilla last-call) — formulas migrate to server in M1, render to Tremor in M6".

**Generalized policy**: any future parallel-stream vanilla PR that lands during the M0–M2 window is accepted only if (a) additive, (b) visually consistent with the M2 baseline target, and (c) its derivation logic is portable to server/Tremor in M1/M6. Anything that re-shapes the layout, introduces a new on-disk path, or duplicates schema is rejected — defer to a v2 panel instead. M-series PRs cite the parallel PR's commit SHA when they re-implement so the lineage is traceable.

### Big-bang execution order — locked

- **M0 (NEXT)** `chore/studio-vite-scaffold` — Vite + React 19 + TypeScript scaffold at `packages/studio/src/client-v2/`. `?app=v2` route serves the new bundle; default `?app=v1` keeps vanilla live until M7.1.
- **M1** `chore/studio-server-extract` — server.ts + siblings under `src/server/`.
- **M2** `feat/studio-v2-shell-dockview` — dockview + shadcn + Tailwind v4 + Open Props + DESIGN.md (Stitch 9-section) publish + density toggle + visual baseline snapshot pinned.
- **M3 → M11** per §7 roadmap.

CI gates land alongside their M-PR per §13.3.1: M0 adds absolute-path / symlink scan + Vite-build budget; M2 adds visual snapshot diff + a11y AA; M3 onwards add per-panel snapshot baselines.

The `[Unreleased]` CHANGELOG section gains a "v1 → v2 transition" subsection at this cutoff so the inheritor can read git history and know exactly when the vanilla → React fork happened.

## 0. Prime directive — preserve the visual, elevate everything underneath

The current Studio's **visual layout is the production target**. Per user directive (2026-05-03 amendment): "전반적으로 현재 시각적인 레이아웃을 기반으로 프로덕션레벨로 기능성과 퀄리티를 올린다고 인지해." The migration is a **chassis swap, not a redesign** — the chassis (vanilla DOM mutation, hand-rolled splitters, monolithic studio.js) is replaced; the body (panel arrangement, colors, typography, scorecard composition, DAG layout geometry, swimlane row order, narrative + feed structure, slash bar quick-action chips, conn-state reconnect banner, splitter tooltips, view-tab list) is preserved pixel-equivalent.

This subordinates every decision in §3 (stack), §5 (topology), §6 (mapping), and §6.1–6.7 (enhancements):

- **Stack picks (dockview / React Flow / shadcn / Tremor)** are means to functional ends (reactive resize, independent docking, interactive Pipeline, dashboard charts) — they must be *styled* to match the current visual rather than ship their default chrome.
- **Panel topology (§5)** matches the current arrangement 1:1: left sidebar with brand mark + Adapters list + Sessions list, top scorecard strip (composite headline + radar + drilldown), view tabs (Pipeline / Waterfall / Map / Logs / Output / Transcript) above an active view-pane absorber, a per-actor swimlane row below the active view, then the two bottom panels (Agent Narrative + Live Execution Feed) split horizontally, then the slash command bar.
- **Interactive Pipeline (§6.1)** seeds the React Flow canvas with **the same node positions and edge curves as the current `DAG_NODES` / `edgePath()` output** — drag is additive (the user *can* move things), but a fresh session opens identical to today.
- **Visible additions** (Service Map tab / Critical-path overlay toggle / BubbleUp drag-select / DesignCheckPanel rail mode / per-actor lifecycle gauge / cross-provider chip / sparkline / trace tree) are **purely additive** — they are reachable via existing surfaces (a new view tab, a toggle in the Pipeline toolbar, a third Detail Rail mode, a chip inside the existing scorecard) and never displace what is visible today.
- **Functional + quality elevations** (a11y AA, theme parity, density toggle, reactive splitters, independent panel docking, command palette, design-check audit, self-check) all land **under** the current visual without changing what the user sees on first paint.

The **visual baseline reference** is the screenshot the user provided alongside this amendment (Image #12 in the conversation, dated 2026-05-03). M2's first commit captures this baseline as a Playwright visual snapshot in `__visual__/baseline-light.png` + `__visual__/baseline-dark.png`. Every subsequent M-series PR diff-checks against the baseline; visual regression beyond the documented additive surfaces is a hard CI fail.

## 1. Why big-bang, why now

**TL;DR — the visual is fine; the chassis underneath is what we elevate.**

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
    │   │   ├── Waterfall.tsx          [PR #142 + BubbleUp drag-select outlier mode]
    │   │   ├── ServiceMap.tsx         [edge aggregation: req/s, p50/p95, error rate per actor pair]
    │   │   ├── Logs.tsx
    │   │   ├── Output.tsx
    │   │   ├── Transcript.tsx
    │   │   ├── AgentNarrative.tsx     [independent dockable]
    │   │   ├── LiveFeed.tsx           [independent dockable]
    │   │   ├── DetailRail.tsx         [right-rail event detail OR node inspector OR design-check audit]
    │   │   ├── ErrorBudgetStrip.tsx   [PR-O2]
    │   │   ├── DesignCheckPanel.tsx   [W3 — palette / WCAG 44px / motion violations surface]
    │   │   ├── CommandPalette.tsx     [⌘K Linear/Raycast — preset+session+action fuzzy]
    │   │   ├── DensityToggle.tsx      [Comfortable / Compact — Datadog Notebook]
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

## 5. Panel topology (dockview, styled to match the current visual)

> Reminder per §0: dockview is the **engine**, not the look. Default dockview chrome (Material-style tab bar, drop-zone overlays, splitter handles) is overridden via `dockview.css` to match the existing Crumb visual — same tab bar typography, same 4 px splitter colored to `--hairline`, same panel header padding, same border-radius tokens from `design.md`.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ┌──────────────┐ ┌─────────────────────────────────────────────────────┐   │
│ │ SIDE BAR     │ │ MAIN GROUP                                          │   │
│ │ (dock left)  │ │ ┌─ tabs ─────────────────────────────────────────┐  │   │
│ │              │ │ │ Pipeline │ Waterfall │ Map │ Logs │ Output │ Transcript │     │   │
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

Per §0 prime directive, the **default node positions match the current `DAG_NODES` geometry exactly** (left→right A-SPEC / B / C / D / E-DONE phase columns; user → coord → planner / researcher → step.research / qa_check → builder / fallback → verifier → judge.score → validator → done). Dagre is computed but its output is **calibrated against the current geometry** via a position-rebase step (M4 first commit) so a fresh session opens identical to today. User drags then deviate from this seed; "Reset layout" restores it.

The 8 actors (post-Prune-2: `coordinator`, `planner-lead`, `researcher`, `builder`, `verifier`, `validator`, `system`, `user`) feed React Flow's `nodes` prop on initial mount; subsequent user drags update `nodes` directly (controlled component pattern — `useNodesState`).

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

### 6.2 Service Map view

A separate tab next to Pipeline + Waterfall. Where Pipeline answers "what is the actor graph and where is each event in it?" and Waterfall answers "how long did each spawn take?", Service Map answers **"which actor → actor handoffs are slow / failing / hot in aggregate?"** — Datadog APM Service Map convention.

| Element | Encoding |
|---|---|
| Node | Actor; size encodes total spawn count, fill encodes error rate (0% green → 100% red), border encodes circuit-breaker state (solid healthy / dashed half-open / red half-tinted open) |
| Edge | Actor → actor handoff direction; thickness encodes req/s, color encodes avg latency (green ≤p50 / amber ≤p95 / red >p95), hover reveals exact stats panel |
| Aggregation | Group `agent.wake → agent.stop` pairs by `(from_actor, to_actor)` from `kind=handoff.requested`; bucket per current session OR last-N sessions toggle |
| Cross-provider tint | Edges where verifier's provider ≠ build's provider get a purple-violet underline (Datadog inferred-dependency convention adapted) |
| Anti-deception | Error-rate fill source is `kind=qa.result` deterministic ground truth (D2/D6) — never LLM verdict text. Tooltip cites the source ("error from qa-check-effect"). |
| Layout | Same dagre engine that seeds Pipeline; no second graph library. |

Lands inside M4 alongside Pipeline + Waterfall (the three viz tabs share the actor color palette + the right-rail Detail Rail).

### 6.3 Critical-path overlay (Lightstep convention)

Toggle at top-right of Pipeline + Waterfall + Service Map. When on:
- Walks the longest chain of dependent spans by wall-clock (or `metadata.parent_id` when present), draws a 2 px black overlay on top of the regular bars/edges.
- Skips spans whose `qa.result` is missing — unverified spans cannot define the critical path (AGENTS.md anti-deception invariant 5).
- Shows total critical-path duration + percentage of session wall-clock in a small chip at the toggle.
- Toggle state persists per-session in `localStorage.crumb.studio.critical-path.<sessionId>`.

### 6.4 BubbleUp drag-select on Waterfall

Drag-select a latency band on the Waterfall (mouse drag → shaded selection rectangle). On release:
- Right Detail Rail switches to "Outlier mode": for every `metadata.*` attribute (provider, model, effort, harness, sandwich_hash, cache_hit, etc.), render side-by-side mini-histograms — orange = selected spans, blue = baseline (rest of the session).
- Sort by deviation (max KL-divergence) so the most-different attribute is at top — Honeycomb BubbleUp UX convention.
- Click any attribute to broadcast a filter to Pipeline (highlight matching nodes) and Service Map (tint matching edges).
- Esc clears the selection.

### 6.5 Command palette (⌘K)

Linear / Raycast / cmdk pattern, vanilla-via-shadcn `<Command>` primitive (Radix + cmdk). Fuzzy-search across:
- Live sessions (jump to session)
- Adapters (open setup modal)
- Presets (start a new session with this preset)
- Actions (`Toggle theme`, `Toggle sidebar`, `Reset pipeline layout`, `Pop out narrative`, `Pop out feed`, `Run doctor`, `Re-probe adapters`, `Density: comfortable/compact`, `Critical-path overlay on/off`)
- View tabs (jump to Pipeline / Waterfall / Map / Logs / Output / Transcript)
- Recent events in current session (deep-link to detail)

Keyboard-first, no mouse required. Sub-palette pattern (selecting "Start new session" pushes a sub-palette with preset + bindings cascade — same shape as the `<NewSessionForm>` flow). Lives in `<CommandPalette>` panel + `useCommandPalette()` hook.

### 6.6 Density toggle (Comfortable / Compact)

Mirrors Datadog Notebook density toggle. Two modes via `data-density="comfortable|compact"` on the dockview root:
- **Comfortable** (default for new users) — row heights 32 / 44 / 56 px (preset-chip / harness-row / model-row), padding generous, `body-md` typography
- **Compact** (power-user) — row heights drop ~25% (24 / 36 / 44), `body-sm`, tighter dock-tab heights, denser scorecard layout

Toggle in Status Bar bottom-right + via ⌘K palette. Persists in `localStorage.crumb.studio.density`.

### 6.7 Studio-side W3 surface — `<DesignCheckPanel>`

W3 (`design_check` deterministic effect — palette ⊂ retro / touch zone WCAG 2.5.5 AAA = 44×44 px / motion timing within evidence_ref deviation) is reducer-side, but its results need a Studio surface. The big-bang plan adds:

| Surface | Behavior |
|---|---|
| **`<DesignCheckPanel>`** in Detail Rail | When a `kind=qa.result` event with a `design_check` block is selected, the rail switches to a third mode (after event-detail and node-inspector) showing per-rule pass/fail with the offending hex / px / ms value + the rule's threshold + a "view evidence_ref" link |
| **`<Scorecard>` D5** | The visual-design dimension fills its bar from `qa-check-effect` source for the deterministic part; LLM source for the subjective part — both surfaced with source attribution (per AGENTS.md invariant 4 D3/D5 split) |
| **`<LiveFeed>` formatter** | New `design_check` formatter renders `palette ✓ · touch ✗(2/8 zones <44px) · motion ✓` style one-liner, color-coded |

### 6.8 Pause/Resume portability self-check

The user asked early in the session: *"다른 머신에서 crumb를 처음 세팅할 때도 QA 에이전트가 이런 것까지 점검할 수 있으려면 어떤 조치가 필요한지"* — pause/resume must work on a fresh machine, and the QA agent must be able to verify it as part of the auto-verification suite. Three deliverables (independent of the migration):

1. **`crumb doctor --self-check`** — runs an end-to-end smoke test: spawn → pause → resume → veto → approve → done, asserts every transition produces the expected reducer state. Exit non-zero if any transition fails. Lands as a small CLI helper, no migration dependency.
2. **`packages/studio/src/server/health.ts`** — `/api/health` extended to include `pause_resume_lifecycle: 'ok' | 'degraded' | 'broken'` derived from the doctor self-check result cached for 30 s.
3. **`<HealthBadge>`** in Status Bar — green dot when `pause_resume_lifecycle === 'ok'`, amber when degraded, red when broken; hover shows the failing transition; click opens the doctor output in a Sheet.

These deliverables can be built before, during, or after the migration; they touch server + reducer, not the React client.

## 7. Migration roadmap — strangler fig (sequence, not schedule)

The migration is paced so the live `npx crumb-studio` keeps working at every step (no flag day). The legacy bundle and the React bundle co-exist behind `?app=v2` until parity is reached, then the legacy is deleted.

| # | Branch | Scope | Demo gate |
|---|---|---|---|
| **M0** | `chore/studio-vite-scaffold` | Add Vite + React deps. Create `packages/studio/src/client-v2/{index.html,main.tsx}` "Hello world". Wire `vite build` → `dist/client-v2/`. Add `serveHtmlV2()` route gated on `?app=v2`. Legacy bundle untouched. | `?app=v2` shows blank React shell + sessions JSON dump |
| **M1** | `chore/studio-server-extract` | Move `server.ts` + siblings under `src/server/` for clarity. No behavior change. Update import paths. | All existing tests pass; `npm run build` clean |
| **M2** | `feat/studio-v2-shell-dockview` | dockview + shadcn primitives + Tailwind v4 + Open Props vars. App shell with empty panels. Sidebar (Brand + Adapters + Sessions placeholders) + Main + Bottom group + Status bar. **First commit publishes `packages/studio/src/client/DESIGN.md` (Stitch 9-section format from VoltAgent/awesome-design-md) — the design contract every subsequent panel commit references.** Density toggle attribute on dockview root from day one. | `?app=v2` shows full dockview frame, drag splitters work, layout persists, density toggle flips comfortable↔compact, DESIGN.md is the contract for any future panel work |
| **M3** | `feat/studio-v2-sidebar` | `<AdapterList>` + `<SessionList>` + `<NewSessionForm>` (cascading per PR #143 — preset-chip + harness-row + model-row variants per redesign DESIGN.md §6) + `<BrandMark>` (#148 SVG) + **`<CommandPalette>` (⌘K) with sub-palette nav** + `<AdapterDoctorDialog>` (F5 advanced — auth/API/install hint per OS, copy buttons). TanStack Query for `/api/sessions` + `/api/doctor`. | `?app=v2` left sidebar fully functional, ⌘K opens palette, can spawn a session via cascading form, F4 sidebar collapse works (free via dockview), F5 adapter modal works |
| **M4** | `feat/studio-v2-pipeline-waterfall-map` | `<Pipeline>` (swimlane + interactive React Flow DAG with dagre seed layout, drag/pan/zoom/click → `<NodeInspector>`, layout persistence) + `<Waterfall>` (with **BubbleUp drag-select outlier mode**) + `<ServiceMap>` (edge aggregation + cross-provider tint) + **Critical-path overlay** toggle shared across all three viz tabs + `<DetailRail>` tri-mode (event detail / node inspector / outlier baseline-vs-selection histograms). SSE stream → query cache. | `?app=v2` user can: drag pipeline nodes; click → inspect/edit binding; switch to Waterfall, drag-select outliers; switch to Map, hover an edge to see req/s + p50/p95 + error rate; toggle critical-path overlay across all three views |
| **M5** | `feat/studio-v2-bottom-panels` | `<AgentNarrative>` + `<LiveFeed>` as independently dockable panels. `<SlashBar>` → inbox POST. Both panels tear-off into popout windows. | User can drag Narrative tab out into a separate window; Feed alone in main, popout-Narrative continues to receive SSE |
| **M6** | `feat/studio-v2-scorecard-budget-trace` | `<Scorecard>` (composite + radar + drilldown + Tremor SparkAreaChart for D1-D6 sparklines per PR-O4 + **per-actor lifecycle gauge** per observability plan P3 + **cross-provider chip** per PR-O5 P7) + `<ErrorBudgetStrip>` (PR-O2 reborn) + **`<DesignCheckPanel>` Detail Rail mode** (W3 surface — palette/touch/motion violations) + `<Logs>` + `<Output>` + `<Transcript>` + **tool-call trace tree** (PR-O5 — recursive collapsible tree of tool.call → tool.result with token + duration per node). | `?app=v2` reaches parity with v1 + adds D1-D6 sparkline + lifecycle gauge + cross-provider chip + design-check audit + trace tree |
| **M7** | `feat/studio-v2-versions-panel` | Per §14.4: `<VersionsList>` panel + `/api/projects/:pid/versions` + `/api/projects/:pid/versions/:v/artifact/*` endpoints + `<Output>` Source toggle (Session \| Version) + `<Scorecard>` reads version manifest scorecard when version mode active. | Versions browseable; archived release artifacts viewable; manifest sha256 cited in Output header |
| **M7.1** | `feat/studio-v2-default-on` | Flip default to v2. `?app=v1` continues to work as escape hatch. CHANGELOG entry; docs update. | `npx crumb-studio` opens v2 by default |
| **M8** | `chore/studio-v1-removal` | Delete `studio.{html,css,js}` + `inline-client.mjs` + `studio-html.generated.ts`. Keep server unchanged. | Bundle drops legacy ~260KB blob |
| **M9** | `feat/studio-v2-pipeline-annotations` | n8n parity polish: user-added Sticky-Note nodes on the Pipeline canvas (text labels, draggable, persisted), "Save as project default layout" affordance, "Export layout JSON" / "Import layout JSON" actions in the Pipeline toolbar, Pipeline minimap toggle in palette. | Power users can annotate the canvas, share layouts across machines |
| **M10** | `feat/studio-v2-self-check` | `crumb doctor --self-check` (pause/resume lifecycle smoke), `/api/health` extended with `pause_resume_lifecycle`, `<HealthBadge>` in Status Bar. Decoupled from migration — can ship before, during, or after. | Fresh-machine user can verify Studio + reducer pause/resume works; QA agent can include this in its auto-verification suite |
| **M11** | `chore/studio-version-bump-1.0` | User directive 2026-05-03: "이번 빅뱅 마치면 studio 버전업해." Bump `packages/studio/package.json#version` from `0.4.x` → `1.0.0`, root `package.json#version` to match, regenerate the inlined CHANGELOG section. Move `[Unreleased]` content under a new `[1.0.0] — 2026-…` heading with full feature inventory + migration retrospective. Tag the commit `v1.0.0`. **Hard gate** — ships only after M0–M10 + every §8.1 quality bar is met across every panel + the post-migration cleanup PR (§13.3) is merged. By M11 the v1 vanilla bundle is already deleted (M8). | Studio is publishable on npm at v1.0.0; the "extreme production level" claim is honest. |

Sequencing is dictated by **dependency order**, not timeline. Each PR is independently mergeable, CI-green at the verify gate, and leaves `npx crumb-studio` working. The migration's quality bar is "extreme production level" — every panel ships with full keyboard navigation, full a11y AA, full theme support, full error states (loading / empty / failed / reconnecting), and full unit + interaction test coverage before the next PR begins. There is no schedule pressure; PRs ship when they meet the quality bar, not before.

## 8. Inherited backlog — where each item lands

| Backlog | Lands as | Notes |
|---|---|---|
| **F4** sidebar collapse | M3 (free via dockview) | Hand-rolled hamburger ticket disappears |
| **F5** adapter modal advanced | M3 (`<AdapterDoctorDialog>` via Radix Dialog) | Auth + install hint card, copy buttons |
| **F6** block tear-off | M5 (free via dockview popout) | The risky custom-window ticket becomes built-in |
| **PR-O3** wall-clock waterfall | M4 (already shipped #142, port logic to React + add BubbleUp drag-select) | New behavior added: outlier mode |
| **PR-O4** aggregate strip + sparkline | M6 (Tremor SparkAreaChart) | D1–D6 lines + token/cost live |
| **PR-O5** trace tree | M6 (custom recursive tree) | Reuses dockview right-rail |
| **PR-O5** cross-provider chip | M6 in `<Scorecard>` | Verifier provider ≠ build provider visual cue |
| **PR-O5** per-spawn lifecycle gauge | M6 in `<Scorecard>` | 9-state machine gauge (P3 from observability plan) |
| **Service Map view** (from PR #143 PR-V2) | M4 `<ServiceMap>` | Datadog Service Map convention, dagre-laid-out, edge aggregation |
| **Critical-path overlay** (Lightstep convention) | M4 (shared toggle across Pipeline/Waterfall/Map) | Black 2 px overlay; skips unverified spans |
| **BubbleUp drag-select outlier mode** | M4 (Waterfall) | Honeycomb pattern; baseline-vs-selection histograms in Detail Rail |
| **⌘K command palette** | M3 (`<CommandPalette>` via shadcn `<Command>`) | Linear/Raycast/cmdk; sub-palette nav |
| **Density toggle** (Comfortable/Compact) | M2 (root attribute) | Datadog Notebook convention |
| **`<DesignCheckPanel>`** (W3 Studio surface) | M6 (Detail Rail mode + Scorecard D5 + Live Feed formatter) | The reducer-side W3 effect needs this UI to be useful |
| **Self-check / pause-resume portability** | M10 (`crumb doctor --self-check` + `<HealthBadge>`) | Decoupled — can land any time |
| **W2** sandwich byte-identical CI test | independent — server-side, no migration impact | Land any time |
| **W3** design_check deterministic gate | independent — reducer-side; Studio surface in M6 | Reducer + UI co-evolve |
| **W4** retry policy with cache-hit monitoring | independent — reducer-side | Land any time |
| **n8n parity Sticky-Note nodes + Save layout / Import-export** | M9 | Power-user annotation polish |
| **PR-Prune-1/2/3** (other stream) | **PRE-REQUISITE** for M0 | Schema delta + actor list must settle before we draw component shapes |
| **PR #143 redesign plan** (merged) | Implementation lives in M2 (DESIGN.md) + M3 (form) + M4 (pipeline + map) | This page supersedes the standalone implementation tickets |

## 8.1 Production-level quality bar — what every PR must satisfy before merge

Every M-series PR must clear all of these before review approval (CI is necessary but not sufficient):

| Bar | Definition |
|---|---|
| **A11y AA** | All interactive controls have accessible names + roles + focus states; full keyboard navigation (Tab/Shift-Tab/Esc/Arrow keys/Enter/Space all work); WAI-ARIA APG patterns followed (combobox, listbox, dialog, tabpanel); axe-core CI check passes; screen-reader trace via VoiceOver / NVDA spot-check noted in PR description. |
| **Theme parity** | Every panel renders correctly in both light + dark themes. Token usage only — no hard-coded `#xxxxxx` outside `theme.css` and the brand mark. Visual snapshot per theme committed to `__visual__/` (Playwright `expect(page).toHaveScreenshot`). |
| **Density parity** | Every panel renders correctly in both Comfortable + Compact density. Visual snapshots per density. |
| **States — loading / empty / error / reconnecting** | Every panel renders all four states explicitly. No "blank while fetching" — skeleton rows (Datadog DRUIDS convention). Error state shows actionable retry. Reconnecting state for SSE-bound panels shows live "reconnecting (attempt N)" hint. |
| **Reduced motion** | `@media (prefers-reduced-motion: reduce)` collapses all transitions to 0 ms; tested in CI via Playwright emulation. |
| **i18n-ready** | All user-visible strings extracted to a single `strings.ts` map (no inline JSX literals). Even if Korean translations don't ship in this migration, the structure is in place. |
| **Performance budget** | `<Pipeline>` drag at 60 fps for ≤20 nodes (React Flow profile); `<Waterfall>` render <16 ms for ≤500 spans; SSE event → DOM update <50 ms p95 measured via Performance API marks; bundle entry chunk ≤80 kB gz, total initial load ≤240 kB gz. CI fails the PR if bundle regresses by >5%. |
| **Test coverage** | Unit tests for every hook and pure function; component tests via Vitest + Testing Library for every panel covering happy path + error path + keyboard interactions; one Playwright e2e per migration milestone (M3 spawn flow, M4 pipeline drag + inspect, M5 narrative tear-off, M6 scorecard sparkline). |
| **No console output in production** | `console.log` allowed only in dev; production build strips them via `terser` or fails CI. |
| **Documentation per panel** | Every `panels/*.tsx` ships with a JSDoc block citing: which API endpoint(s) it consumes, which Zustand slice it reads/writes, which AGENTS.md invariant(s) it must respect, link to the relevant DESIGN.md row spec. |
| **Anti-deception alignment** | Any panel surfacing a score or verdict must cite its source per AGENTS.md invariant 4 (`reducer-auto` / `qa-check-effect` / `verifier-llm`). Tooltip on every score badge. |
| **Telemetry-free** | No analytics, no telemetry, no third-party scripts. Local-only. |

A PR that passes CI but fails any of these bars is sent back. The bar is enforced via PR template checkbox + reviewer checklist.

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

## 11. Legacy `dashboard` cruft + naming hygiene cleanup

The package was renamed `packages/dashboard` → `packages/studio` in PR #96 (`e586cb8`). The rename moved the source tree and updated `package.json#name` / `bin` / `keywords`, but it did **not** scrub three classes of leftover:

### 11.1 Filesystem cruft (one worktree only)

`/Users/mango/workspace/crumb/packages/dashboard/` exists as untracked filesystem artifacts in the `crumb-dash` worktree. Contents:
- `dist/` — compiled `bootstrap.js` / `cli.js` / `dashboard-html.generated.js` / `dashboard-html.js` / `doctor.js` / `event-bus.js` / `index.js` / `jsonl-tail.js` / `metrics.js` / `open-browser.js` etc. — the pre-rename tsc output
- `src/dashboard-html.generated.ts` — pre-rename inliner output
- `node_modules/` — the package's own dep cache

There is **no `package.json`** under `packages/dashboard/` — the directory is purely orphaned build output. It is not in git (`git ls-files | grep dashboard` → empty) and absent from every other worktree (`crumb-redesign-plan`, `crumb-waterfall`, etc. — verified). It only persists in `crumb-dash` because that worktree was created before PR #96 and never had the orphaned dist/ + node_modules/ removed.

**Action**: `rm -rf /Users/mango/workspace/crumb/packages/dashboard/` from inside the `crumb-dash` worktree. Filesystem-only delete, no git operation. Documented as user-driven (removal is destructive; user runs the command, not the agent). After removal `git status` returns clean.

### 11.2 In-code naming residue (`Dashboard*` types in active studio source)

The active `packages/studio/src/` source still uses `Dashboard`-prefixed type names — never reverted post-rename:

| File | Symbol | Occurrences |
|---|---|---|
| `packages/studio/src/types.ts` | `interface DashboardMessage` | 1 (definition) |
| `packages/studio/src/server.ts` | `interface DashboardServer`, `interface DashboardServerOptions`, `startDashboardServer()` | 4 (def + signature) |
| `packages/studio/src/event-bus.ts` | `import type { DashboardMessage }` | 2 |
| `packages/studio/src/bootstrap.ts` | `import type { DashboardMessage }`, parameter typing | 3 |
| `packages/studio/src/jsonl-tail.ts` | `import type { DashboardMessage }`, return types | 4 |
| `packages/studio/src/metrics.ts` | `import type { DashboardMessage }`, function param | 2 |
| `packages/studio/src/watcher.ts` | `import type { DashboardMessage }`, history typing | 6 |
| `packages/studio/src/index.ts` | re-export `DashboardServer`, `DashboardServerOptions`, `DashboardMessage` | 2 |
| `packages/studio/src/bootstrap.test.ts` + `metrics.test.ts` | type-imports | 2 |
| `packages/studio/src/client/studio.js` | inline comment `// session_id → DashboardMessage[]` | 1 |
| `packages/studio/src/client/studio.html` | inline copy "this dashboard" / "read-only dashboard" | 2 |
| `packages/studio/package.json#keywords` | `"dashboard"` keyword | 1 |

**Total: ~30 stale references across 12 files.** Each is a place where a future LLM (Claude / Codex / Gemini) may re-hallucinate a `Dashboard*` API or a `packages/dashboard/` path because the in-code naming contradicts the brand.

**Action — PR `chore/studio-naming-purge`** (small, low-risk, decoupled from migration):
- Rename `DashboardMessage` → `StudioMessage`, `DashboardServer` → `StudioServer`, `DashboardServerOptions` → `StudioServerOptions`, `startDashboardServer()` → `startStudioServer()` (the latter is already aliased in `index.ts` since PR #96 — drop the dashboard-named export)
- Update all imports + re-exports in the 10 source files + 2 test files
- Update inline copy in `studio.html` ("dashboard" → "studio") in the welcome banner + comments
- Drop `"dashboard"` from `packages/studio/package.json#keywords`
- Verify gate: `lint:all` + `typecheck` + `test` + `build` all green
- Diff is purely renames; no runtime behavior change

This PR can land any time before or during the migration and is independent of the Prune queue.

### 11.3 Wiki + raw research mentions

Three categories of `dashboard` mentions in `wiki/`:

| Category | Examples | Action |
|---|---|---|
| **Historical / conceptual context** (intentional) | `wiki/concepts/bagelcode-final-design-2026.md`, `wiki/concepts/bagelcode-naming-crumb.md`, `wiki/synthesis/bagelcode-team-profile.md`, `raw/bagelcode-research/observability-frontier-2026-05.md` | **Keep** — describes the rename history and prior state intentionally |
| **Active observability context (post-rename)** | `wiki/synthesis/bagelcode-studio-observability-plan-2026-05-03.md` (PR #137 era; cites Datadog dashboards as a reference, which is the noun "dashboard" not the package) | **Keep** — non-Crumb dashboards are valid references |
| **Stale package-name leakage** | `.skills/wiki-status/SKILL.md`, `.skills/skill-creator/SKILL.md` (if any reference `packages/dashboard/`) | Audit during the naming-purge PR; rewrite to `packages/studio/` if found |

The `chore/studio-naming-purge` PR description must explicitly enumerate which wiki / skill mentions were rewritten and which were left as historical context, so a future LLM can read the diff and learn the convention: "Dashboard the noun is fine; `Dashboard*` as a Crumb identifier is forbidden."

### 11.4 LLM hygiene rule (codified in AGENTS.md)

Add a one-liner under AGENTS.md §Don't (universal):

> ❌ Use `dashboard` as a Crumb identifier (type name, file name, package name, branch name). The package was renamed to `studio` in PR #96; the noun is reserved for non-Crumb references (e.g., "Datadog dashboards"). Use `Studio*` for any new symbol.

This becomes part of the sandwich the dispatcher injects into every actor spawn, so cross-host (Claude Code / Codex / Gemini) the invariant is enforced upstream of code generation.

## 12. n8n grounding

`https://github.com/n8n-io/n8n` is cloned at `/Users/mango/workspace/n8n` (depth 1, ~207 MB). n8n is the closest extant frontier reference for the user's interactive-pipeline ask (drag nodes, click-to-inspect, default + custom layout, n8n-style canvas chrome). It is grounding material — patterns, primitives, store organization — not a stack target (n8n is Vue 3; we are React).

### 12.1 Anchor files an implementer should read

| File | What to study |
|---|---|
| `packages/frontend/editor-ui/src/features/workflows/canvas/components/Canvas.vue` | Canvas root — how vue-flow is wired into the rest of the editor (selection, zoom, pan, viewport persistence) |
| `packages/frontend/editor-ui/src/app/views/NodeView.vue` | The "view a single node" route — equivalent of our `<NodeInspector>` |
| `packages/frontend/editor-ui/src/app/components/NodeViewUnfinishedWorkflowMessage.vue` | Empty-state pattern on canvas — useful for our "no session yet" canvas |
| `packages/frontend/editor-ui/src/app/views/CanvasAddButton.vue` | Floating add-node button — pattern for our future Sticky-Note add affordance (M9) |
| `packages/frontend/@n8n/design-system/src/components/CanvasPill/` | Canvas chrome pills — pattern for our critical-path / cross-provider chips |
| `packages/frontend/@n8n/design-system/src/components/CanvasThinkingPill/` | Live "thinking" indicator on canvas — pattern for our active-actor pulse |
| `packages/frontend/editor-ui/src/app/stores/` | Pinia store organization — translate to Zustand slice pattern |

### 12.2 Pattern translation table (Vue → React)

| n8n (Vue 3) | Crumb (React 19) | Notes |
|---|---|---|
| `vue-flow` | `@xyflow/react` | Same author / same architecture; React Flow is the canonical port |
| Pinia stores | Zustand slices | One slice per concern (selection, layout, ui) |
| `<script setup>` Composition API | function components + custom hooks | Hooks correspond to composables 1:1 |
| Element Plus components | shadcn/ui | Both Radix-flavored / accessible-first |
| `provide / inject` | React Context (sparingly) or Zustand | Prefer Zustand to avoid context-tax |
| `vee-validate` | React Hook Form + Zod | Cascading-form pattern equivalent |
| `vue-i18n` | `i18next` (M2 prep) | Same key/locale shape |

### 12.3 What we DON'T copy from n8n

- The full n8n editor scope (workflow execution, credential management, expression editor, parameter inputs per node) — Crumb doesn't run user-defined workflows; the actor graph is fixed by AGENTS.md
- n8n's auth + multi-user model — Crumb is local single-machine, no auth
- n8n's enterprise license boundary (`packages/@n8n/*.ee/`) — Crumb is fully MIT
- n8n's deep "Sticky Note" feature set — only the basic annotation pattern is portable to M9

### 12.4 Grounding rule for implementers

When writing `<DagCanvas>`, `<NodeInspector>`, `<HandoffEdge>`, or any Pipeline-canvas component, the PR description should cite the n8n file consulted and what was adopted vs adapted vs rejected. This keeps the lineage auditable and prevents accidentally re-inventing patterns n8n already validated.

## 13. Portability + data-stewardship invariants (every M-PR must honor)

User directives 2026-05-03 amendment: any path or filesystem coupling that prevents a fresh-machine setup from working with `clone → npm install → npx crumb-studio` is a **hard fail**. Symlinks fall under the same prohibition — they are platform-coupled (Windows / archive-extract failure modes), CI-fragile, and surprise the evaluator.

### 13.1 Hardcoded path prohibition

Forbidden in any M-PR:

- ❌ Absolute paths anywhere except as a fallback inside an env-var lookup chain (e.g., `process.env.CRUMB_HOME ?? join(homedir(), '.crumb')` is OK; `'/Users/mango/.crumb'` is not)
- ❌ Hardcoded `/Users/`, `/home/`, `C:\\` — not in TS, MD, JSON, TOML, comments, JSDoc, test fixtures, or sample output
- ❌ Symlinks anywhere in the runtime resolution chain (no `ln -s`, no `fs.symlink`, no `package.json#bin` aliasing through symlinks). Use real files + the existing `import.meta.url` walk-up pattern in `src/cli.ts:inferRepoRoot()` for repo-root discovery.
- ❌ `npm link` for development workflow (the convention persists symlinks under `node_modules/`); use `npx crumb-studio` (already supported) or `node packages/studio/dist/cli.js` directly.
- ❌ Build outputs that reference absolute paths (Vite `base: '/'` only; never `base: '/Users/...'`)
- ❌ Source maps that leak absolute paths in production bundles (configure Vite `build.sourcemap: 'hidden'` or post-process to strip absolute prefixes)

Required:

- Every path read via env-var fallback to `os.homedir()` / `os.tmpdir()` / `process.cwd()` / `import.meta.url`-relative walk
- Every test fixture uses `path.join(__dirname, …)` or the equivalent; never absolute
- Every `package.json#bin` resolves through `node_modules/.bin` (no relative `..` escapes)
- CI matrix includes a "fresh clone" smoke: `cd $(mktemp -d) && git clone $REPO . && npm install && npx crumb-studio --port 7321 --no-open && curl http://127.0.0.1:7321/` — green on Linux + macOS + Windows-WSL on every PR.
- `crumb doctor` (and `crumb doctor --self-check` from M10a) succeeds on a machine that has only Node 18 + git + the cloned repo. No `claude` / `codex` / `gemini` binary required for the doctor itself to run.

### 13.2 Context hierarchy + transcript accumulation

The transcript-as-truth invariant (AGENTS.md §invariant 1) is load-bearing for every observability surface; the migration must preserve it through every layer change. New rules:

- **Single-writer discipline**: only the dispatcher's transcript writer (`src/transcript/writer.ts`) appends to `transcript.jsonl`. The migration must NOT introduce a second writer (e.g., a React-side optimistic insert) — even for "instant feedback" UX, route through inbox + chokidar + dispatcher → reducer → SSE. The user's perceived latency should be hidden by skeleton states (§8.1), not by speculative writes.
- **Hierarchy preserved**: `~/.crumb/projects/<project_id>/sessions/<session_id>/{transcript.jsonl, meta.json, artifacts/, agent-workspace/, inbox.txt, .crumb/preset.toml?}` shape is invariant. The migration must NOT reshape the on-disk layout. Studio reads, never writes (except `inbox.txt` + `meta.json` status patches, which already exist).
- **Append-only respected at every layer**: React state mutations are local (Zustand); they NEVER round-trip a transcript line back to disk. SSE streams are read-only — `setQueryData` updates the query cache, not the disk.
- **No client-side transcript truncation** for performance. If a transcript grows to 50k events, the React virtualization (TanStack Virtual) must page on render, never on data — full event history stays in memory + cache so deep-link replay is identical to the v1 monolith. Eviction (if ever needed) lives in the server's `JsonlTail` / `EventBus`, not in the client.
- **Anti-deception linkage** (AGENTS.md §invariant 5): every UI score badge resolves its source via `scores.D*.source` (`reducer-auto` / `qa-check-effect` / `verifier-llm`); rendering must NOT compute a score client-side from raw events — that would create a second source of truth. Tooltip on every badge cites the source.
- **Replay determinism preserved**: `crumb replay <session-id>` must continue to produce byte-identical state derivation post-migration. M-series PRs that touch the reducer or the protocol schema MUST update the parity test (`src/protocol/parity.test.ts`) and pass `crumb replay` on the staged session corpus before merge.
- **Transcript schema drift gate**: any change to `protocol/schemas/message.schema.json` (kind enum, field shape) is a `chore(protocol):` PR scoped to the protocol layer alone, never bundled with a UI PR. The migration's M-series PRs touch only Studio code; protocol changes ride the Prune stream.

### 13.3.1 CI updates required by the big-bang (user directive 2026-05-03)

> "CI 도 이번 빅뱅에 맞게 수정해야하면 수정해."

The current CI matrix (lint / lint:knip / lint:deps / typecheck / format:check / test (Node 18/20/22) / build / Validate JSON Schemas / Check agents/*.md present) is correct as-is for the v1 vanilla bundle but does not exercise the v2 React stack or the §13.1 portability invariants. Concrete updates the migration must land in CI workflow files before M2 ships:

| New CI job | What it asserts | Lands in |
|---|---|---|
| **`Vite build (v2 client)`** | `cd packages/studio && npx vite build` produces `dist/client/index.html` + asset bundle ≤ 240 kB gz; bundle ≤ 80 kB gz for the entry chunk; no absolute paths in source maps. Fails the PR if either budget regresses by >5%. | M2 (added alongside the Vite scaffold) |
| **`Visual snapshot diff`** | Playwright `expect(page).toHaveScreenshot('panel-name-{light\|dark}-{comfortable\|compact}.png')` for every panel. Diff threshold 0.1%. New baselines require explicit reviewer approval. | M2 (baseline) + every subsequent M-PR (regress check) |
| **`Fresh-clone smoke (Linux + macOS + Windows-WSL)`** | `cd $(mktemp -d) && git clone $REPO . && npm install --production=false && timeout 30 npx crumb-studio --port 7321 --no-open --bind 127.0.0.1 & sleep 5 && curl -fsS http://127.0.0.1:7321/api/health | jq -e '.ok'` — green on every PR across the matrix. Catches any hardcoded path that breaks on a fresh checkout. | M2 (gates the entire migration) |
| **`Symlink-and-abs-path scan`** | `grep -rE "/Users/\|/home/\|C:\\\\\\\\\|fs\\.symlink\|ln -s" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" src/ packages/` returns zero hits in active source. | M0 (gates from day one) |
| **`Replay determinism`** | For each fixture session in `test/fixtures/sessions/`, run `crumb replay <id>` and assert deterministic state derivation (no timestamp / random / order drift). Fails the PR if any fixture changes its derived state. | Already exists for parity tests; expanded to cover sessions, not just kinds |
| **`Self-check`** | `crumb doctor --self-check` runs as part of the standard test job and must exit 0. Catches reducer regressions before they reach UI tests. | M10a (PR #152) — already added at the helper level; just needs CI invocation |
| **`Bundle inventory diff`** | List of files emitted by `vite build` is committed to `packages/studio/.bundle-manifest.json`; CI fails if a new file appears or a hash changes without explicit `--update-manifest`. Catches accidental large dependencies. | M6 (parity gate — locks the v2 bundle shape) |
| **`a11y AA`** | `axe-core` Playwright integration runs on every panel in both themes + both densities; PR fails on any new violation. | M2 + every panel-bearing PR |

These jobs land **inside** the M-series migration PRs (not separately) so each PR ships its own contributing CI guard. M2's PR adds Vite-build + Symlink-and-abs-path scan; M3's PR adds the first panel's a11y job; etc. The migration cannot break CI by introducing untested infrastructure.

The existing CI must NOT be relaxed during the migration — the v1 vanilla bundle continues to pass `lint:knip` (no dead code from un-imported v2 modules) and `typecheck` until M8 deletes it. Co-existence is enforced by the `?app=v1\|v2` gate in `serveHtml()` (see M0 / M7.1).

### 13.3 Cleanup discipline at end of migration

At M8 (legacy bundle removal), AND every PR thereafter:

- Every reference to the v1 vanilla bundle (file path, function name, JSDoc, comment, test fixture, wiki page) is purged. A single `chore/post-migration-cleanup` PR sweeps the codebase, `AGENTS.md` §Don't list, `CLAUDE.md`, `GEMINI.md`, and any `.skills/` files. CI gate: `grep -r "studio\.js\|studio\.html\|inline-client\.mjs\|studio-html\.generated"` returns zero hits in active source (wiki history mentions are tagged with a `<!-- historical -->` HTML comment so the LLM hygiene rule from §11.4 still passes).
- Stale legacy comments (e.g., `// PR-K' fix for vanilla swimlane`, `// W-Studio-A retired by #145`) are removed when their referent code goes away. The migration does NOT leave breadcrumb trails through deleted code paths.
- Exit conditions documented in `CHANGELOG.md` `[Unreleased]` with explicit "v1 retired" note + final v1 commit SHA so a future archaeologist can `git checkout` if needed.

User directive verbatim, 2026-05-03 amendment:

> 빅뱅 업데이트가 마무리되면 이전에 있던 잔재들로 로직이나 코드 구조가 혼선되지 않게 깨끗이 정리해.

This is a hard gate at M8 — no soft-deprecation, no co-existence period after parity is reached, no "we'll clean it up later" debt accumulation.

## 14. On-disk hierarchy + write/read parity (project → session → version)

User directive 2026-05-03: *"아웃풋 저장 위치와 읽는 위치 일치도 고려해. 계층도도 세션, 프로젝트, 버전 고려하고."* The migration must codify a single hierarchy diagram, every artifact path must have a single writer + every reader resolves through the same canonical helper, and the **version layer** (project-scoped, not session-scoped) must be a first-class browseable surface in Studio (currently missing).

### 14.1 Canonical hierarchy

```
$CRUMB_HOME                           ← env override CRUMB_HOME, default os.homedir()/.crumb
└── projects/
    └── <project_id>                  ← sha256(cwd) ambient OR pinned via .crumb/project.toml
        │
        ├── sessions/
        │   └── <session_ulid>/
        │       ├── transcript.jsonl  ← single writer: src/transcript/writer.ts
        │       ├── meta.json         ← single writer: src/session/meta.ts
        │       ├── inbox.txt         ← writers: src/inbox/* (user.intervene); reader: src/inbox/watcher.ts
        │       ├── artifacts/        ← writer: builder spawns; reader: Studio Output
        │       │   ├── DESIGN.md
        │       │   ├── spec.md
        │       │   ├── tuning.json
        │       │   └── game/
        │       │       ├── index.html
        │       │       ├── manifest.webmanifest
        │       │       ├── sw.js
        │       │       └── src/…    ← multi-file PWA; recursive
        │       └── agent-workspace/
        │           └── <actor>/      ← per-actor spawn cwd, sandboxed
        │
        └── versions/                 ← PROJECT-scoped, not session-scoped
            └── <semver-or-label>/    ← e.g. "1.0.0", "2026-05-03-evening"
                ├── manifest.json     ← writer: src/session/version.ts:writeManifest()
                │                        contents: { name, label, source_session, source_event_id,
                │                                    scorecard, sha256_per_file, created_at }
                └── artifacts/        ← writer: snapshotArtifacts(); pure copy, no symlink
                    └── (mirror of session artifacts/, durable even if source session deleted)
```

Every path is discovered through `src/paths.ts` helpers — never built ad hoc:

| Helper | Returns | Used by |
|---|---|---|
| `getCrumbHome()` | `$CRUMB_HOME ?? os.homedir()/.crumb` | every other helper |
| `resolveProjectId(cwd)` | sha256(cwd) ambient OR pinned `.crumb/project.toml#project_id` | `getProjectDir`, status surfaces |
| `getProjectDir(cwd)` | `<home>/projects/<project_id>` | versions + sessions roots |
| `getSessionsDir(cwd)` | `<projectDir>/sessions` | session list |
| `getSessionRoot(cwd, sid)` | `<sessionsDir>/<sid>` | per-session helpers |
| `getArtifactsDir(cwd, sid)` | `<sessionRoot>/artifacts` | builder write target / Studio read |
| `getActorWorkspace(cwd, sid, actor)` | `<sessionRoot>/agent-workspace/<actor>` | spawn cwd |
| `getVersionsDir(cwd)` | `<projectDir>/versions` | release + browse |
| `sessionDirFromTranscript(path)` | reverses transcript path back to `<sessionRoot>` | Studio server's artifact serve |

The migration must NOT introduce any second resolver. A new React panel that needs an artifact path posts to `GET /api/sessions/:id/artifact/*` (existing) or `GET /api/projects/:pid/versions/:v/artifact/*` (NEW — see §14.4); the server resolves through `src/paths.ts`.

### 14.2 Write/read parity matrix — every artifact path

| Path | Writer (only one) | Reader(s) | Studio API endpoint | Studio panel |
|---|---|---|---|---|
| `transcript.jsonl` | `src/transcript/writer.ts` (dispatcher only) | reducer (`reduce()`), Studio SSE `/api/stream`, `crumb replay`, `crumb debug` | `/api/stream` SSE, `/api/sessions` list metrics | Pipeline / Waterfall / Logs / Transcript / Live Feed |
| `meta.json` | `src/session/meta.ts` (CLI lifecycle only — `run`, `resume`, `done`) | bootstrap classifier (`packages/studio/src/server/bootstrap.ts`), `crumb ls` | implicit via `/api/sessions` enrichment | Session list pill (live / paused / done / errored) |
| `inbox.txt` | `src/inbox/parser.ts` (CLI), Studio's `POST /api/sessions/:id/inbox` (slash bar) | `src/inbox/watcher.ts` (chokidar) → reducer | `/api/sessions/:id/inbox` POST | Slash bar |
| `<sessionRoot>/artifacts/**` | builder spawn (cwd = `agent-workspace/builder`, writes via relative `../artifacts/`) | Studio Output panel | `/api/sessions/:id/artifacts/list`, `/api/sessions/:id/artifact/*` | Output |
| `<versionsDir>/<v>/manifest.json` | `src/session/version.ts:writeManifest()` (CLI `crumb release`) | Studio Versions panel (M6+, NEW) | `/api/projects/:pid/versions` (NEW), `/api/projects/:pid/versions/:v/manifest` (NEW) | Versions panel (NEW) |
| `<versionsDir>/<v>/artifacts/**` | `snapshotArtifacts()` (CLI `crumb release`) | Studio Output panel "Version" mode (M6+, NEW) | `/api/projects/:pid/versions/:v/artifact/*` (NEW) | Output, Versions panel |

### 14.3 Bug surfaced by this audit — `snapshotArtifacts` is not recursive

`src/session/version.ts:149-167` — `snapshotArtifacts()` only walks **top-level** files via `readdir(srcDir)` (no `withFileTypes`, no recursion). A multi-file Phaser PWA (`artifacts/game/index.html` + `artifacts/game/src/main.js` + `artifacts/game/manifest.webmanifest` + …) gets only the top-level entries snapshotted; nested files are silently dropped from the version. This is a **real release-data-loss bug**, independent of the migration. Lands as a small fix:

- **PR `fix/session-version-recursive-snapshot`**: switch `readdir(srcDir, { withFileTypes: true, recursive: true })` (Node ≥18.17) or hand-rolled recursion for older targets; preserve `sha256_per_file` keyed by relative path. Test with a fixture that has nested subdirs.
- Lands independently of the migration.

### 14.4 Versions surface in Studio (NEW — M7 deliverable)

Studio currently has no Versions browser. The user can release a session via `crumb release` (writes `<versionsDir>/<v>/manifest.json` + snapshot), but Studio's Output panel only resolves session-scoped artifacts. The migration adds:

- **`<VersionsList>`** panel in the sidebar (toggleable, dockview group beneath Sessions)
- **`/api/projects/:pid/versions`** — list, with manifest preview (name, label, scorecard, source_session)
- **`/api/projects/:pid/versions/:v/artifact/*`** — serve files from `<versionsDir>/<v>/artifacts/**` with the same content-type table as `serveArtifactFile()`
- **`<Output>` panel "Source" toggle** — Session (default) | Version (when a Version is selected). Same iframe + dropdown UI; URL switches between `/api/sessions/:id/artifact/*` and `/api/projects/:pid/versions/:v/artifact/*`.
- **`<Scorecard>`** shows version label when a Version is the active source (matches the scorecard recorded in `manifest.json`).

This lands as M7 on the roadmap (after M6 parity, before M8 legacy removal). Documented in §7's M-table addendum:

| M7 (revised) | `feat/studio-v2-versions-panel` | Versions list + version-mode Output + scorecard reuse | Versions browseable; archived release artifacts viewable; manifest sha256 cited in Output header |

The previous M7 "default flip" rolls forward to **M7.1** (`feat/studio-v2-default-on`) — same content, renumbered to make room for the versions deliverable.

### 14.5 Data-stewardship invariants codified

Cross-cutting rules that any new code (migration or otherwise) must obey:

- ❌ Never construct a path under `$CRUMB_HOME` outside `src/paths.ts`. Adding a fourth tier (e.g., `runs/`) requires a `chore(paths):` PR that updates `paths.ts` + every consumer in lockstep.
- ❌ Never copy via symlink for the version snapshot — `snapshotArtifacts` uses `copyFile` exactly because the version must survive source session deletion (§14.1 footnote).
- ❌ Never write the same logical artifact via two writers (e.g., dispatcher writes `artifacts/game.html` AND a post-process script also writes there). Single writer per path.
- ❌ Never break the "transcript path is the canonical session-id resolver" rule (`sessionDirFromTranscript` is the only reverse mapping; if you need the session-id from any other surface, derive it from the transcript path the watcher already has).
- ✅ Studio reads via `<sessionId>` token in URL → server resolves through `watcher.snapshot()` → `sessionDirFromTranscript()` → real path. Adding a new artifact endpoint follows the same chain.

User directive verbatim, 2026-05-03 amendment:

> 아웃풋 저장 위치와 읽는 위치 일치도 고려해. 계층도도 세션, 프로젝트, 버전 고려하고.

Both halves resolved: the matrix in §14.2 makes write/read parity explicit per path, and the hierarchy in §14.1 codifies project → session → version as the canonical 3-tier shape.

## Trigger criteria — when to start M0

Start M0 (`chore/studio-vite-scaffold`) when **all four** of these are true:

1. PR-Prune-1 merged (dead schema kinds removed)
2. PR-Prune-2 merged (builder-fallback removed → 8-actor list)
3. PR-Prune-3 merged (reducer judge.score case extracted)
4. User explicitly approves this plan (no implicit consent)

Until then, the existing piecewise PRs (F4/F5 etc.) **are not started** — the work would be wasted re-implementation post-migration. Better to wait.

M10 (self-check + health badge) is decoupled — it touches server + reducer only and can land in parallel with the migration trigger queue.

## Quality, not pace

This plan deliberately omits effort estimates and target dates. The migration ships when each PR meets §8.1's production-level quality bar. There is no schedule to slip; PRs queue up sequentially, and the next one starts only after the current one has been merged at full quality. Tradeoffs in scope (e.g., "do we add Sticky-Notes in M9?") are decided on quality + user value, never on time pressure.
