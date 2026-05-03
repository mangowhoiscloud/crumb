# Crumb Studio — Design System

> Single-source design tokens for the Crumb Studio dashboard. Light theme is default + brand-derived; dark theme is preserved from v0.4 (Linear-style accent purple). Theme toggle wired via `[data-theme]` on `<html>` with `prefers-color-scheme` auto-detect + localStorage override.
>
> Structure follows VoltAgent `awesome-design-md` conventions adapted to a single-window observability tool.

## §1 Visual theme

Crumb Studio is a local browser dashboard for the Crumb multi-agent harness. Two themes:

- **Light (default)** — derived from the Crumb logo. Warm, handcrafted, casual prototyping aesthetic. Cream background, dark brown ink, golden bread accent.
- **Dark** — preserved from v0.4. Linear-style near-black canvas, lime/violet accents. Suits long staring sessions.

Both share the same component vocabulary, spacing scale, and motion. Only color tokens swap.

## §2 Color palette + roles

### §2.1 Light (default)

Sampled from the Crumb logo via Pillow median-cut quantization (8-bin):

| Source | Hex | Role |
|---|---|---|
| logo background | `#FDF3E7` | `--canvas` (84.9% area) |
| logo dark brown (wordmark + face) | `#623819` | `--ink` |
| logo golden bread body | `#DAAB78` | `--primary` |
| logo pale gold highlight | `#FCE5BF` | `--surface-3` (bright accent surface) |

Derived gradient (light mode `:root`):

```
--canvas:           #FDF3E7    /* logo cream — main bg */
--surface-1:        #F5E9D5    /* card / banner / sidebar header */
--surface-2:        #EDDFC4    /* hover, active row, sidebar bg */
--surface-3:        #E5D5B3    /* deeper surface, modal */
--hairline:         #D8C39C    /* dividers */
--hairline-strong:  #C0A77B    /* emphasized dividers */
--ink:              #623819    /* primary text */
--ink-muted:        #825A36    /* secondary text */
--ink-subtle:       #A07F58    /* tertiary, labels */
--ink-tertiary:     #B89B78    /* placeholder, disabled */
--primary:          #DAAB78    /* CTA, focus ring, brand */
--primary-hover:    #C89460    /* CTA hover */
```

### §2.2 Dark (preserved from v0.4 Linear chassis)

Activated via `<html data-theme="dark">`:

```
--canvas:           #010102
--surface-1:        #0f1011
--surface-2:        #141516
--surface-3:        #18191a
--hairline:         #23252a
--hairline-strong:  #34343a
--ink:              #f7f8f8
--ink-muted:        #d0d6e0
--ink-subtle:       #8a8f98
--ink-tertiary:     #62666d
--primary:          #5e6ad2    /* Linear violet */
--primary-hover:    #828fff
```

### §2.3 Semantic colors (status / audit / warn)

Both themes share semantic semantics; values shift for WCAG ≥4.5:1 on body text against canvas.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--audit-bg` | `#FBE6EB` | `#1f1633` | banner bg for anti-deception violations |
| `--audit-fg` | `#B23A60` | `#fa7faa` | violation text + actor-verifier lane |
| `--lime` | `#5C7A0E` | `#c2ef4e` | live-state dot + actor-builder lane |
| `--warn` | `#A85A1F` | `#ffb287` | partial verdict + idle-state dot |
| `--accent-grep` | `#D67635` | `#ff9f1c` | grep highlight (orange) |
| `--accent-grep-active` | `#B05420` | `#ff5e00` | grep current match |

### §2.4 Actor lane colors

Functional/semantic — recolor per theme to maintain WCAG ≥3:1 against canvas. Hue stays roughly constant per actor (recognition); lightness shifts.

| Actor | Light | Dark |
|---|---|---|
| `--actor-user` | `#5C5DAB` | `#5e6ad2` |
| `--actor-coordinator` | `#7A7F88` | `#8a8f98` |
| `--actor-planner-lead` | `#A85A1F` | `#ffb287` |
| `--actor-researcher` | `#5E4674` | `#79628c` |
| `--actor-builder` | `#5C7A0E` | `#c2ef4e` |
| `--actor-verifier` | `#B23A60` | `#fa7faa` |
| `--actor-builder-fallback` | `#A89178` | `#62666d` |
| `--actor-validator` | `#A85A1F` | `#ffb287` |
| `--actor-system` | `#A0876B` | `#34343a` |

## §3 Typography

### §3.1 Brand wordmark

`CRUMB STUDIO` top-left of the sidebar. Glyph + wordmark, 20×20 inline SVG bread mark.

```css
@font-face {
  /* Aliased family. Locally-installed Cabinet Grotesk (best logo match)
     wins; otherwise Apple SF Pro Rounded; otherwise system-ui. Drop a
     Cabinet Grotesk woff2 into assets/ + base64-inline in inline-client.mjs
     to bundle it without breaking the offline-capable invariant. */
  font-family: 'Crumb Brand';
  font-weight: 800;
  font-display: swap;
  src:
    local('Cabinet Grotesk Extrabold'),
    local('CabinetGrotesk-Extrabold'),
    local('Cabinet Grotesk Bold'),
    local('CabinetGrotesk-Bold'),
    local('SF Pro Rounded Black'),
    local('SF Pro Rounded Bold'),
    local('-apple-system-ui-rounded');
}

.brand-text {
  font-family: 'Crumb Brand', ui-rounded, "SF Pro Rounded", system-ui, sans-serif;
  font-weight: 800;
  font-size: 14px;
  letter-spacing: 0.4px;
}
```

Rationale: the logo's wordmark is bold rounded sans (rounded B/R terminals). The font cascade tries (a) a locally-installed **Cabinet Grotesk Extrabold** (the closest character match — recommend bundling the SIL OFL woff2 next iteration), then (b) Apple platforms map `ui-rounded` to **SF Pro Rounded** (same family as macOS Big Sur+ system rounded UI), then (c) `system-ui` for non-Apple platforms. The `local(...)` chain in `@font-face` lets a user who has Cabinet Grotesk installed get the exact match without any download — a deliberate progressive-enhancement that preserves the offline-capable invariant of the inlined HTML.

### §3.2 Body text

Unchanged from v0.4:

```css
font-family: ui-sans-serif, -apple-system, "SF Pro Display", "Segoe UI", system-ui, sans-serif;
font-size: 14px;
line-height: 1.5;
letter-spacing: -0.05px;
```

### §3.3 Monospace

For transcript / logs / event detail / grep input — preserved:

```css
font-family: ui-monospace, "SF Mono", Consolas, monospace;
font-size: 11–12px;
```

## §4 Component stylings

Components inherit tokens from §2; theme swap is automatic. Specific component-level rules live in `packages/studio/src/client/studio.css`. Notable cross-theme behaviors:

- **DAG SVG** (`<svg.dag-svg>`) reads actor lane colors via `getComputedStyle` — recolors on theme switch with no JS rerender needed.
- **Swimlane chips** use `var(--actor-*)` directly — automatic.
- **Scorecard radar** (PR-K) — uses `--primary` for the polygon fill, `--ink-muted` for axis labels — automatic.
- **Resource breakdown bar** (PR-K') — fixed semantic colors per resource type (cache=lime, in=primary, out=accent-grep) — recolors per theme.

## §5 Layout

Studio uses a 3-column outer grid (sessions sidebar | main content | optional detail rail) plus a 4-pane vertical stack inside main content (view-pane | swimlane | narrative | feed). Layout tokens:

```
--sessions-w:      240px (default, resizable, range 0—560 with sidebar collapse)
--detail-w:        420px (default, resizable, range 280—800)
--swimlane-h:      200px (default, resizable, min 80, max 70vh)
--narrative-h:     220px (default, resizable, min 80, max 70vh)
--feed-h:          180px (default, resizable, min 80, max 70vh)
```

Splitter convention: drag UP narrows upper, drag DOWN narrows lower. Industry-standard (Linear / VSCode / Datadog APM).

## §6 Depth / elevation

Surfaces stack `canvas → surface-1 → surface-2 → surface-3` with hairlines marking boundaries. No box-shadow except on modals (single-direction soft shadow `0 4px 16px rgba(0,0,0,0.08)` light / `rgba(0,0,0,0.4)` dark). No depth via blur or backdrop-filter (cost on Crumb's mostly-static surface).

## §7 Theme switching mechanism

### §7.1 Storage + auto-detect

```js
// On boot, before first paint:
//   1. Read localStorage 'crumb.theme' → 'light' | 'dark' | null
//   2. If null, follow `prefers-color-scheme`
//   3. If user clicks toggle, store explicit preference
const stored = localStorage.getItem('crumb.theme');
const auto = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
const initial = stored ?? auto;
document.documentElement.dataset.theme = initial;
```

This script is inlined in `<head>` via `inline-client.mjs` so it runs before stylesheet parse, preventing FOUC (white flash on dark-mode users).

### §7.2 Toggle UI

A single button in `<nav.view-tabs>` rightmost slot, `id="theme-toggle"`. Glyph: `☀` (when dark) / `🌙` (when light). Click → flip data-theme attribute + write localStorage + emoji swap.

### §7.3 OS preference change

When user has no stored preference, listen to `prefers-color-scheme` media-query change and update on the fly:

```js
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!localStorage.getItem('crumb.theme')) {
    document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
  }
});
```

## §8 Do's and Don'ts

| Do | Don't |
|---|---|
| Use `var(--*)` tokens for all color | Hardcode hex (one offender today: fallback `#4a90e2` in resume-btn / resize-handle hover — should drop the fallback once theme system is in place) |
| Use `ui-rounded` for brand wordmark only | Apply rounded font to body text (sets up reading fatigue) |
| Test new components in BOTH themes during PR review | Add component without specifying its dark-mode behavior |
| Extend palette via §2.4 actor lane table | Invent new actor-color hex directly in CSS rule |
| Use SVG with `currentColor` for icons | Embed multi-color icons as `<img>` (breaks theme swap) |

## §9 Responsive

Crumb Studio is **desktop-only** by design. Min viewport width 1280px, optimized for 1440-1920px. No mobile breakpoint; no touch-event simulation; no print styles. The Crumb game artifacts (Phaser PWA generated by builder) are mobile-first separately — see `agents/specialists/game-design.md` §1 envelope.

## §10 Agent prompt guide (separation from game palettes)

Studio's design.md (this file) governs the **dashboard chrome**. Game palettes (per-session, generated by planner-lead's visual-designer specialist) are governed by `agents/specialists/visual-designer.md` and `agents/specialists/game-design.md` §1.4 pixel-asset policy. The two namespaces never collide:

- Studio CSS reads `--*` tokens from this file.
- Game CSS / Phaser config reads palette from `tuning.json` per session.

Reviewers / future agents should treat the studio chrome and game content as orthogonal design surfaces.

---

## Reference

- Logo source: user-supplied (Image #8 in conversation 2026-05-03), sampled via Python Pillow `quantize(method=MEDIANCUT, colors=10)`.
- WCAG 2.1 contrast checker: <https://webaim.org/resources/contrastchecker/>
- VoltAgent design.md template: <https://github.com/VoltAgent/awesome-design-md>
- Linear color guidelines: <https://linear.app/changelog>
- `ui-rounded` CSS spec: <https://developer.mozilla.org/en-US/docs/Web/CSS/font-family#values>
