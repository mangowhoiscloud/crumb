---
title: Crumb Studio — Handoff (2026-05-03)
date: 2026-05-03
status: handoff
related:
  - bagelcode-studio-observability-plan-2026-05-03.md
  - bagelcode-pre-verifier-no-scoring-frontier-2026-05-03.md
  - bagelcode-no-pass-n-decision-2026-05-03.md
tags: [studio, handoff, observability, branding, layout, datadog]
---

# Crumb Studio — Handoff (2026-05-03)

> Snapshot of in-flight Studio work, merged baseline, and prioritized pending work for the next session/stream picking this up. Cross-references the Observability plan + wiki gate decisions so the inheritor can drop in without a context tax.

## 1. Live state (right now)

- **Studio server**: running at `http://127.0.0.1:7321/`, PID owns port 7321. Source: built from `/Users/mango/workspace/crumb-wt-f3` (branch `feat/studio-branding-light-dark`). `pkill -f "packages/studio/dist/cli.js"` to stop; `node packages/studio/dist/cli.js --port 7321` to start in any worktree with a fresh build.
- **`main` HEAD**: `56f6f1b feat(studio): 4-pane layout + scorecard hybrid + event detail spread (PR-K + PR-K' + Layout fix) (#145)` (today's most recent merge).
- **Browser**: open at `http://127.0.0.1:7321/`. F3 branding + light theme is already serving from the running build.

## 2. PR ledger (today, ordered most recent first)

### Open / in-flight

| PR | Title | Status | Notes |
|---|---|---|---|
| **#146** | `feat(studio): CRUMB STUDIO branding + light/dark theme system (F3)` | CI in_progress | Light theme default + `[data-theme="dark"]` override + brand wordmark + `design.md`. Once green, merge per gitflow ratchet |
| **#143** | `docs(wiki): Studio Datadog-grade redesign plan (new-session form + pipeline viz)` | Open by another stream | Adjacent docs PR; not a blocker |
| **#142** | `feat(studio): wall-clock waterfall view as second tab (PR-O3)` | Open by another stream | 5th view tab; merge order: #142 first then any layout PR rebases trivially |

### Merged today (anchor commits for context)

| PR | Title | Anchor |
|---|---|---|
| #145 | 4-pane layout + scorecard hybrid + event detail spread | `56f6f1b` |
| #141 | error-budget burndown strip (PR-O2) | `d690625` |
| #140 | feed swap + orient toggle + datadog formatters (W-Studio-A) | `16d22b2` (note: orient toggle subsequently retired by #145) |
| #139 | SSE state event lifecycle classification (PR-O1.5) | `e3a52fb` |
| #138 | commit maintainer `.skills/` | (unrelated to UI) |
| #137 | authoritative session pill (PR-O1) | `61f2eba` |
| #136 | wiki: LLM-judge vs deterministic-gate distinction (W1) | `291c11b` |
| #134 | DAG runtime overlay (PR-J') | `05543db` |
| #131 | studio cancel button (R5) | `c2df6ec` |
| #123 | `/cancel` user verb + cancel_spawn effect (R2) | `bb932f1` |
| #122 | inbox chokidar swap (R1) | `bc00fe1` |
| #118 | narrative panel + horizontal splitter (W-Studio-A pred) | `2d0e7b7` |

## 3. Architecture summary (post-#145 + #146)

### 3.1 Studio layout (after #145)

```
<body display:grid columns: var(--sessions-w, 240px) 4px 1fr>
  <aside.sessions>          ← Adapters list + Sessions list (+ #146 brand wordmark on top)
  <#sessions-resize>         ← drag to resize sidebar
  <main display:flex column overflow:hidden>
    <header.summary>         ← session metrics row
    <#audit-banner>
    <#conn-state-pill>
    <section.scorecard-bar>  ← 3-column hybrid: composite + radar + drilldown (PR-K)
    <nav.view-tabs>          ← Pipeline | Logs | Output | Transcript | (PR-O3 Waterfall) | … | #theme-toggle (#146)
    <div.view-pane.active>   ← absorber, flex:1
    <#splitter-view-swim>    ← 4px row-resize, single-var
    <section.swimlane>       ← flex: 0 0 var(--swimlane-h, 200px)
    <#splitter-swim-narr>    ← 4px row-resize, two-var (total preserved)
    <section.console-narrative> ← flex: 0 0 var(--narrative-h, 220px)
    <#splitter-narr-feed>    ← 4px row-resize, two-var
    <section.console-feed>   ← flex: 0 0 var(--feed-h, 180px)
    <section.console-input>  ← slash command bar
  </main>
</body>
```

**Splitter convention** (industry-standard, Linear / VSCode / Datadog): drag UP → upper narrows, drag DOWN → lower narrows.

- `#splitter-view-swim` is **single-var** (above is the absorber; only swimlane height changes; absorber takes the rest).
- `#splitter-swim-narr` and `#splitter-narr-feed` are **two-var** (both adjacent panes have explicit heights; modify both inversely so total panes-height is preserved → view-pane absorber stays put).
- `localStorage.crumb.pane.{swimlane,narrative,feed}-h` (px ints). One-shot migration shim from legacy `crumb.narrative-h`.
- 80px floors per pane prevent collapse; 70vh ceilings prevent overlap.

Splitter handler implementation: `packages/studio/src/client/studio.js` `initPaneSplitters()` IIFE (search for the comment `PR-Layout — 4-pane vertical splitters`).

### 3.2 Theme system (after #146)

- `:root` holds **light defaults** (Crumb logo derived). Dark theme moved under `[data-theme="dark"]` overrides on `<html>`.
- **Pre-paint script** in `<head>` reads `localStorage.crumb.theme` (or `prefers-color-scheme` if absent) and sets `<html data-theme=...>` *before stylesheet parse*. No FOUC.
- **Theme toggle button** `#theme-toggle` in view-tabs rightmost slot. Glyph swaps ☀ ↔ 🌙. JS `initThemeToggle()` IIFE in `studio.js`.
- **OS preference watcher** — `matchMedia('(prefers-color-scheme: dark)').change` updates theme when no explicit user override stored.
- **Wordmark** in top of `<aside.sessions>`. Inline 24×24 SVG bread + 3 crumbs (single-path, `currentColor` colored via `--primary`) + `CRUMB STUDIO` wordmark with `'Crumb Brand'` `@font-face` cascade: `local('Cabinet Grotesk Extrabold/Bold')` → `local('SF Pro Rounded Black/Bold')` → `ui-rounded` → `system-ui`.

Light palette sampled from logo via Pillow median-cut (`#FDF3E7` cream / `#623819` brown / `#DAAB78` golden / `#FCE5BF` highlight). Full token table + WCAG audit + actor lane variants in `design.md` at repo root.

### 3.3 Observability layers (after PR-O1 / O1.5 / O2)

- **`derived_state`** (PR-O1) — server-side 9-state lifecycle from `(meta.json, transcript)`. `/api/sessions` rows carry `derived_state` + `derived_state_reason`; SSE pushes `session_state_change` on transition.
- **SSE state event** (PR-O1.5) — lifecycle classification on every transition.
- **Error-budget burndown** (PR-O2) — token / wall-clock / per-spawn-timeout meters in bottom dock.
- **Scorecard hybrid** (PR-K, in #145) — composite headline + 80×80 radar + drilldown bars + anti-deception strikethrough.
- **Event detail spread** (PR-K', in #145) — group spread (paginator retired) + Datadog-grade single-event detail (tag pills, audit banner, resource breakdown bar, copy buttons).
- **DAG runtime overlay** (PR-J', #134) — per-actor token + cost + latency badges + edge throughput thickness + slow-edge red.
- **Live feed `FEED_FORMATTERS`** (W-Studio-A, restored in #145) — 18 per-kind formatters: `judge.score` → verdict + D1-D6 + deviation; `qa.result` → exit + AC pass/total; `agent.stop` → tokens + cache + cost; etc.

## 4. Pending work — prioritized

### F-series (user's frontend spec — Image #7 + #8 + verbal directives)

| # | Task | Size | Risk | Prereq | Notes |
|---|---|---|---|---|---|
| **F4** | Collapsible left sidebar + hamburger toggle (slide left↔right) | small | low | none | toggle to `--sessions-w: 0` ↔ persisted width; CSS transition; persist in localStorage |
| **F5** | Adapter setup modal advanced — auth/API detection + install commands | medium | medium | none | `/api/doctor` already returns `installed/authenticated`; extend to detect API-key envvars, install hint per OS, login command, copy buttons |
| **F6** | Block system — tear-off (`window.open` + `BroadcastChannel`) + side-by-side dock (VSCode terminal pane convention) | large | high | none | lots of cross-window sync; defer until F3-F5 ship |

### O-series (Studio observability roadmap)

| # | Task | Plan §ref |
|---|---|---|
| **PR-O3** | Wall-clock waterfall view (5th view tab) | open as #142 by another stream — coordinate, don't duplicate |
| **PR-O4** | Aggregate strip (P2) + score sparkline (P5) — top-of-header live cost/tokens + D1-D6 sparkline 6 lines | `bagelcode-studio-observability-plan-2026-05-03.md` §4 |
| **PR-O5** | Tool-call trace tree (P4) + cross-provider chip (P7) + per-spawn lifecycle gauge (P3) | same §4 |

### W-series (token-quality + retry)

| # | Task |
|---|---|
| **W2** | Sandwich byte-identical CI test (SHA-256 regression guard for cache-hit discipline) |
| **W3** | `design_check` deterministic effect (palette ⊂ named retro palette / touch zone WCAG 2.5.5 AAA = 44×44 / motion timing within evidence_ref deviation) |
| **W4** | Retry policy with cache-hit monitoring (cap 3 rounds per Eisenstein DeepMind 2024) |

### Misc cleanup (low priority)

- `crumb-dash` worktree's untracked `packages/dashboard/` directory is filesystem cruft from the pre-rename PR #96 era. Not in git. Decision: user-driven (no code action needed).

## 5. Worktrees in flight (filesystem snapshot)

```
/Users/mango/workspace/crumb                         docs/translate-phase2-wiki-concepts (untracked translation work)
/Users/mango/workspace/crumb-dash                    main + 1 commit behind, untracked packages/dashboard/ (cruft)
/Users/mango/workspace/crumb-wt-f1                   fix/studio-feedstack-overflow → MERGED as #145
/Users/mango/workspace/crumb-wt-f3                   feat/studio-branding-light-dark → CI in_progress as #146
/Users/mango/workspace/crumb-wt-cancel               feat/inbox-cancel-abort → MERGED as #123 (stale)
/Users/mango/workspace/crumb-wt-inbox-watch          perf/inbox-chokidar-swap → MERGED as #122 (stale)
/Users/mango/workspace/crumb-wt-narrative            feat/studio-narrative-panel → MERGED as #118 (stale)
/Users/mango/workspace/crumb-wt-r5                   feat/studio-cancel-button → MERGED as #131 (stale)
/Users/mango/workspace/crumb-wt-cache                perf/cache-carry-over → never pushed (G1 was deferred)
/Users/mango/workspace/crumb-wt-rerun                detached HEAD on old commit (idle)
/Users/mango/workspace/crumb-wt-studio-a             feat/studio-feed-swap-and-layout → MERGED as #140 (stale)
/Users/mango/workspace/crumb/.claude/worktrees/feature+instant-intervene-fast-lane  → PR #121 closed (superseded)
/Users/mango/workspace/crumb/.claude/worktrees/feature+scorecard-hybrid-radar       → cherry-picked into #145
```

Stale worktrees can be `git worktree remove <path>` cleaned up by the inheritor at their discretion.

## 6. Pitfalls / known issues for the inheritor

1. **CI registration delay**: GitHub Actions occasionally fails to register CI runs on first push of a new branch. Symptoms: PR shows no checks for >5 min after push. Resolution: empty commit + force push, or close+reopen the PR. Witnessed today on #113, #136. Don't panic — it's a GitHub flake, not a workflow file issue.

2. **`crumb-dash` filesystem cruft**: not in git, but `git pull --ff-only` blocks because of the untracked `packages/dashboard/` directory. Use a different worktree to sync main, or `rm -rf packages/dashboard/` if the user agrees it's cruft.

3. **Cabinet Grotesk wordmark fallback**: F3 (#146) uses a `local()` cascade — if no Cabinet Grotesk is installed locally on the user's machine, the wordmark falls back to SF Pro Rounded (Mac) or `ui-rounded`/`system-ui` (other platforms). To bundle Cabinet Grotesk in-blob: drop `CabinetGrotesk-Extrabold.woff2` into `packages/studio/src/client/assets/` (~25KB) and extend `inline-client.mjs` to base64-inline it as a `data:font/woff2;base64,...` `src`. Inline budget today: ~263KB; +25KB woff2 + 33% base64 overhead = ~300KB total — within range.

4. **Splitter direction convention**: drag UP narrows upper, drag DOWN narrows lower. This is industry-standard (Linear/VSCode/Datadog) — do not invert. Two-var splitters preserve total panes-height; single-var splitter (between absorber and a fixed pane) lets absorber grow/shrink.

5. **Scorecard radar (PR-K)**: the radar SVG reads `--primary` for fill. When users on dark theme open a session with verifier output, the lime fill will swap to violet without redraw — `getComputedStyle()` reads tokens at paint time. No JS rerender needed.

6. **Light theme actor lane colors** (in #146): the 9 actor lanes (`--actor-*`) get light-mode variants for WCAG ≥3:1 against cream canvas. If a future PR adds a NEW actor, both light and dark variants must be defined or the new actor will collide with the canvas color.

## 7. Inheritor's decision tree

```
What's blocking the user / panel?

├─ Layout broken or visually wrong?
│    → start at §3.1 above; identify which CSS var is misaligned
├─ Theme toggle not flipping correctly?
│    → §3.2 above; verify pre-paint script in <head> + initThemeToggle() in studio.js
├─ Scorecard / radar / event detail issue?
│    → PR-K + PR-K' wiring in studio.{html,css,js}; rendered in renderScorecard() + renderEventDetail() (search studio.js)
├─ Adapter / sessions sidebar issue?
│    → renderAdapterList() + renderSessionList() in studio.js
├─ Live feed missing rich formatting?
│    → FEED_FORMATTERS table + feedLineFromTranscriptEvent() (was regressed by the PR-K branch base; restored in #145)
├─ Bagelcode-grade reviewer impact ranking?
│    1. F4 (sidebar toggle) — visible on first paint
│    2. PR-O4 (aggregate strip + sparkline) — top-of-header live $$
│    3. F5 (adapter modal advanced) — review the first thing user clicks
│    4. W3 (design_check deterministic gate) — game palette / WCAG enforcement
│    5. F6 / PR-O5 — stretch
└─ Submission packaging?
     → README check, demo recording, `wiki/synthesis/bagelcode-team-profile.md` review
```

## 8. Critical references (read before starting)

- [`wiki/synthesis/bagelcode-studio-observability-plan-2026-05-03.md`](./bagelcode-studio-observability-plan-2026-05-03.md) — 5-PR roadmap, 12-dim observability matrix, 9-state lifecycle
- [`wiki/synthesis/bagelcode-pre-verifier-no-scoring-frontier-2026-05-03.md`](./bagelcode-pre-verifier-no-scoring-frontier-2026-05-03.md) — LLM-judge vs deterministic gate distinction (W1 #136)
- [`wiki/synthesis/bagelcode-no-pass-n-decision-2026-05-03.md`](./bagelcode-no-pass-n-decision-2026-05-03.md) — pass@N rejection rationale
- [`design.md`](../../design.md) — repo-root design tokens (F3 #146)
- [`AGENTS.md`](../../AGENTS.md) — project invariants (do not violate)
- [`CHANGELOG.md`](../../CHANGELOG.md) — `[Unreleased]` section has every today's PR with rationale

## 9. Final note

Today's stretch shipped 6 PRs end-to-end (R1, R2, R5, W1, W-Studio-A, F1+K+K' composite, F3) plus pulled in scorecard work from a parallel stream. The `[Unreleased]` CHANGELOG section is dense with rationale per PR — the inheritor should skim it before opening a new PR to ensure they're not duplicating or contradicting recent decisions.

The chosen direction is **studio extension** (NOT dashboard rebrand redo, NOT a separate observability tool). Anyone seeing residual `dashboard` references (in `wiki/concepts/bagelcode-system-architecture-v0.1.md`, `wiki/synthesis/bagelcode-team-profile.md`) — those are historical/conceptual mentions, not stale code. The actual code rebrand (`packages/dashboard` → `packages/studio`) completed in PR #96 (`e586cb8`).

— handoff prepared 2026-05-03
