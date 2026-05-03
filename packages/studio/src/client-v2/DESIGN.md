---
name: Crumb Studio v2
slug: crumb-studio-v2
description: |
  Crumb Studio v2 is a React + dockview observability console for the
  Crumb multi-agent execution harness. The visual identity is "warm
  kraft paper + bread mascot" — cream / golden-brown / brick-orange
  surfaces with a kawaii toast slice as the brand mark. Functionally
  it is a Datadog-grade dashboard: dense data + reactive panels +
  SSE-driven live updates + n8n-style interactive Pipeline canvas.
---

# Crumb Studio v2 — DESIGN.md

> Format: [Google Stitch DESIGN.md](https://stitch.withgoogle.com/docs/design-md/format/) (9 sections + extensions).
> Reference set: [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) — patterns mined from Raycast / Linear / Claude / Cohere.
>
> **Contract**: every M-series PR that adds or modifies a panel cites the §s of this file the change touches. PR-S0 (this commit) is the source-of-truth; later amendments modify in place + bump the date frontmatter.

## 1. Visual Theme & Atmosphere

The chrome is a **kraft-paper observatory** — cream canvas (`#fdf3e7`), warm hairline borders, a small bread mascot (toast slice with bite + crumbs scattering) at the top-left of the sidebar. Density is high (Datadog) but the warmth keeps it from feeling cold. The whole product feels like flipping through a baker's notebook of running experiments.

Two themes: **light** (default — kraft paper palette) and **dark** (deep umber, lime + violet accents). Both share the same component skeleton; only token values change. Theme switches happen pre-paint via an inline bootstrap script — no FOUC.

**Mood adjectives**: warm, observable, dense, hand-crafted.

## 2. Color Palette & Roles

### Brand surfaces (light)

| Token               | Hex                   | Role                                         |
| ------------------- | --------------------- | -------------------------------------------- |
| `--canvas`          | `#fdf3e7`             | Page floor — cream, warm                     |
| `--surface-1`       | `#f7e8d2`             | Header / footer band, cards                  |
| `--surface-2`       | `#f0d9b5`             | Hover lift, selected row, dropdown menu lift |
| `--surface-3`       | `#e8c896`             | Popover surface (dropdowns, palettes)        |
| `--surface-card`    | `#fffaf0`             | Highest card surface                         |
| `--hairline`        | `#d8c2a0`             | 1 px borders (default)                       |
| `--hairline-strong` | `#c0a880`             | 1 px borders (emphasis)                      |
| `--hairline-soft`   | `rgba(96,56,18,0.12)` | Hairline over translucent                    |

### Ink (text)

| Token            | Hex       | Role                   |
| ---------------- | --------- | ---------------------- |
| `--ink`          | `#401e08` | Primary text           |
| `--ink-strong`   | `#2d1304` | Headings               |
| `--ink-muted`    | `#6a4828` | Secondary text         |
| `--ink-subtle`   | `#8b6d4e` | Tertiary metadata      |
| `--ink-tertiary` | `#b29275` | Disabled / placeholder |

### Accent + semantic

| Token              | Hex       | Role                                       |
| ------------------ | --------- | ------------------------------------------ |
| `--primary`        | `#b8742d` | CTA, brand accent                          |
| `--primary-strong` | `#a45c1a` | Pressed / active                           |
| `--accent-warm`    | `#cc7a3a` | Crust color (brand mascot stroke)          |
| `--lime`           | `#6b8c2a` | Success / PASS verdict                     |
| `--warn`           | `#c47020` | Warn / amber pill                          |
| `--audit-fg`       | `#b8431c` | Anti-deception strikethrough, FAIL verdict |

### Per-actor lane palette

| Actor        | `--actor-*` | Role         |
| ------------ | ----------- | ------------ |
| user         | `#6a4828`   | brown        |
| coordinator  | `#8b6d4e`   | warm taupe   |
| planner-lead | `#cc7a3a`   | crust orange |
| researcher   | `#845b3a`   | walnut       |
| builder      | `#6b8c2a`   | olive        |
| verifier     | `#c4452a`   | brick        |
| validator    | `#b8742d`   | golden       |
| system       | `#4a3220`   | dark walnut  |

Dark theme has full overrides for every token; same names, calibrated for WCAG ≥3:1 against `--canvas-dark`.

## 3. Typography Rules

| Tier           | Family                                                                  | Use                                  |
| -------------- | ----------------------------------------------------------------------- | ------------------------------------ |
| `--font-body`  | `ui-sans-serif, -apple-system, "SF Pro Display", "Segoe UI", system-ui` | All UI text                          |
| `--font-mono`  | `ui-monospace, "SF Mono", Menlo, Consolas`                              | Code, IDs, metric values, timestamps |
| `--font-brand` | `"Crumb Brand", ui-rounded, "SF Pro Rounded", system-ui`                | CRUMB STUDIO wordmark only           |

| Style      | Size  | Weight | Line | Use                                  |
| ---------- | ----- | ------ | ---- | ------------------------------------ |
| `body-md`  | 14 px | 400    | 1.5  | Default body                         |
| `body-sm`  | 12 px | 400    | 1.5  | Secondary metadata                   |
| `caption`  | 10 px | 500    | 1.3  | Pill / chip / badge text (uppercase) |
| `mono-md`  | 13 px | 400    | 1.5  | Code, IDs                            |
| `title-lg` | 22 px | 500    | 1.2  | Header titles                        |
| `title-sm` | 16 px | 500    | 1.4  | List labels                          |
| `wordmark` | 14 px | 800    | 1    | CRUMB STUDIO wordmark                |

Letter-spacing: body `-0.05px`, wordmark `+0.4px` (open up for legibility).

## 4. Component Stylings

### 4.1 Brand mark + wordmark

`<BrandMark size={26}>` renders the toast SVG. Wordmark sits flush right with 10 px gap. CSS class `.brand-text` carries the wordmark font. In compact density both shrink ~25%.

### 4.2 Sidebar toggle (hamburger)

`<button class="sidebar-toggle">☰</button>`. 1 px hairline border, 4×8 padding, 14 px glyph. Hover swaps to `--surface-2` + `--ink`. Focus-visible: 2 px `--primary` outline at 30% opacity.

### 4.3 Preset chip / harness row / model row (cascading new-session form)

Three row variants per §6 of migration plan — see `panels/NewSessionForm/` for the canonical implementation in M3:

| Variant       | Height                    | Radius | Padding | Layout                                                         |
| ------------- | ------------------------- | ------ | ------- | -------------------------------------------------------------- |
| `preset-chip` | `--row-preset` (32 / 24)  | pill   | 6×12    | optional-icon · label · health-dot                             |
| `harness-row` | `--row-harness` (44 / 36) | 6      | 8×12    | 28-icon · stack(name + provider · model) · meta · trailing-dot |
| `model-row`   | `--row-model` (56 / 44)   | 6      | 10×12   | 28-icon · stack(name + capability badges) · trailing-checkmark |

State matrix: default / hover / selected / unhealthy. Selected uses `--surface-2` + 2 px `--primary` left rule (Datadog DRUIDS convention).

### 4.4 Adapter list row (sidebar)

`<adapter-row>` shows display name + version + plan chip + login-expiry chip + install/auth pill. Three-pill cluster on the right, flex-wrap. See M3 implementation; ports the v1 vanilla design from PR #161 verbatim.

### 4.5 Session list row

Row dot (state-tinted) + ULID prefix · 12 chars + lifecycle pill + close × + resume ↻. Selected: `--surface-2` background. State dot reads `data-state` (`live` / `paused` / `done` / `errored` / `terminal`).

### 4.6 Pipeline DAG node (interactive, M4)

React Flow custom node `<ActorNode>`. Same geometry as the v1 hardcoded `DAG_NODES` so a fresh session opens identical to today (per §0 prime directive). Node fill = lane palette; border 1.5 px hairline; rounded 8 px; click → `<NodeInspector>` opens in Detail Rail.

### 4.7 Waterfall bar (M4)

Per-actor lane, wall-clock axis. Bar color = lane palette; striped diagonal animation when in-flight; red audit fill when `qa.result.exec_exit_code !== 0`. Drag-select on the canvas → BubbleUp outlier mode.

### 4.8 Scorecard composite (M6)

Composite headline (aggregate score + verdict) + 80×80 radar (D1-D6) + drilldown bars + sparkline (D1-D6 over time, Tremor SparkAreaChart). Source attribution per dim (`reducer-auto` / `qa-check-effect` / `verifier-llm`) shown as a tiny mono superscript on hover.

### 4.9 Detail rail (tri-mode, M4 / M6)

(1) Event detail — default. (2) Node inspector — when a Pipeline node is selected. (3) Outlier histograms — when a Waterfall band is drag-selected. M6 adds a fourth mode for design_check audit. Mode swap via dockview tab bar (no separate prop drilling).

### 4.10 Slash bar (M5)

Single-line input + chip row beneath (`/approve` `/veto rebuild` `/pause` `/resume` `/goto verifier` `@builder use red palette` `/note <text>` `/redo`). Enter posts to `/api/sessions/:id/inbox`. Chip click inserts into input.

## 5. Layout Principles

- **Spacing scale** (Comfortable / Compact): 4/3 · 8/6 · 12/9 · 16/12 · 24/18 · 32/24 px.
- **Container** — dockview owns layout. No custom CSS Grid for the panel system.
- **Grid inside panels** — Tailwind utilities (`flex`, `grid-cols-*`) layered over the spacing scale variables.
- **Whitespace philosophy** — dense by default (Datadog), generous around the brand mark and the slash bar (the two human-touchpoints).

## 6. Depth & Elevation

dockview renders three surface levels; we map them to our token ladder:

| Level       | Token            | Used by                                                |
| ----------- | ---------------- | ------------------------------------------------------ |
| 0 (canvas)  | `--canvas`       | Page background                                        |
| 1 (panel)   | `--surface-1`    | Panel content background                               |
| 2 (lift)    | `--surface-2`    | Hover, selected row, dropdown menu lift                |
| 3 (popover) | `--surface-3`    | Combobox popover, command palette, modal backdrop card |
| Card        | `--surface-card` | Scorecard composite headline tile                      |

No drop shadows — depth comes from the surface ladder + 1 px hairline borders, mirroring Raycast's "no shadows" doctrine. Focus rings (2 px `--primary`) are the only "glow" in the system.

## 7. Do's and Don'ts

**Do**:

- Use design tokens for every color / radius / spacing — never hard-coded values outside this file.
- Honor `[data-density="compact"]` in panel-level rules — drop padding by ~25%, type one step.
- Show empty / loading / error / reconnecting states explicitly per §8.1 quality bar.
- Cite the AGENTS.md invariant being respected in every panel JSDoc that surfaces a score, verdict, or transcript event.

**Don't**:

- Re-implement the v1 DOM structure inside React — the migration replaces the chassis, not the visual.
- Ship a panel without theme parity (light + dark) + density parity (comfortable + compact).
- Put scores client-side — read `metrics.per_actor` + `metrics.score_history` from the server-derived metric snapshot.
- Use `npm link` or symlinks (per §13.1 portability invariants).

## 8. Responsive Behavior

| Breakpoint | Width       | Behavior                                                                           |
| ---------- | ----------- | ---------------------------------------------------------------------------------- |
| Desktop    | ≥ 1024 px   | Full dockview frame; sidebar 240 px; detail rail 320 px                            |
| Tablet     | 768–1023 px | Sidebar collapsible (default open); detail rail collapses to overlay sheet         |
| Mobile     | < 768 px    | Sidebar collapses to floating ☰; one main panel visible; tabs scroll horizontally |

Touch targets ≥ 44×44 px (WCAG 2.5.5 AAA) on every interactive surface. Pipeline canvas uses pinch-to-zoom on trackpad; minimum tap-target inside canvas ≥ 32 px.

## 9. Agent Prompt Guide

Quick reference for AI coding agents (Claude / Codex / Gemini / Cursor) that generate panels for this app:

```
Style: Kraft-paper observatory. Cream `--canvas` (#fdf3e7) with golden-brown
hairlines (--hairline #d8c2a0). Bread-mascot warmth.
Theme: light default + [data-theme="dark"] overrides on <html>.
Density: [data-density="compact"] on <html> drops vertical rhythm 25%.
Tokens: never hard-code colors. Read --canvas/--surface-{1..3}/--ink-{strong,muted,subtle}/--primary/etc.
Layout: dockview owns the panel manager; React panels are pure render +
hooks. No CSS Grid for the shell — that's dockview's job.
Components: shadcn/ui primitives (Radix + Tailwind), Tremor charts.
A11y: WAI-ARIA APG patterns. Touch targets ≥ 44×44. Reduced-motion
collapses transitions to 0ms.
Anti-deception: every score badge cites scores.D*.source. No client-side
score derivation — read from server metrics.
```
