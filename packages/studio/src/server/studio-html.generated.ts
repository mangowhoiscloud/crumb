/**
 * AUTO-GENERATED — do not edit by hand.
 *
 * Source: packages/studio/src/client/{studio.html, studio.css, studio.js}
 * Generator: packages/studio/scripts/inline-client.mjs
 *
 * Run `npm run prebuild` (or any of `build` / `typecheck`) inside the
 * studio package to regenerate. The 3 source files are the editable surface
 * with full HTML / CSS / JS LSP support; this file is the build artifact that
 * server.ts imports to serve at GET /.
 */

export const STUDIO_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Crumb · Live Studio</title>
    <!--
  PR-Branding (F3) — pre-paint theme bootstrap (FOUC prevention).
  Runs before any CSS computes against tokens. Reads the persisted
  preference (or OS preference if absent) and sets data-theme on
  <html> so the :root vs [data-theme="dark"] palette resolves
  correctly on first paint. No-op for users who have an explicit
  preference.
-->
    <script>
      (function () {
        try {
          var stored = localStorage.getItem('crumb.theme');
          var auto =
            window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light';
          document.documentElement.dataset.theme = stored || auto;
        } catch (e) {
          // localStorage may be blocked; default to light (matches :root).
          document.documentElement.dataset.theme = 'light';
        }
      })();
    </script>
    <style>
      /* PR-Branding (F3) — Light theme is default. Dark theme overrides via
 * [data-theme="dark"] on <html>. Pre-paint script in <head> sets the
 * attribute from localStorage or prefers-color-scheme to prevent FOUC.
 *
 * Light palette derived from the Crumb logo via Pillow median-cut quantization
 * (5/2/2026): #FDF3E7 cream / #623819 dark brown / #DAAB78 golden bread /
 * #FCE5BF pale gold. See design.md for full token table + WCAG audit.
 */
:root {
  /* Light theme (default) — Crumb logo derived */
  --canvas: #fdf3e7;
  --surface-1: #f5e9d5;
  --surface-2: #eddfc4;
  --surface-3: #e5d5b3;
  --hairline: #d8c39c;
  --hairline-strong: #c0a77b;
  --ink: #623819;
  --ink-muted: #825a36;
  --ink-subtle: #a07f58;
  --ink-tertiary: #b89b78;
  --primary: #daab78;
  --primary-hover: #c89460;

  /* Semantic — light variants (WCAG ≥4.5:1 against canvas) */
  --audit-bg: #fbe6eb;
  --audit-fg: #b23a60;
  --lime: #5c7a0e;
  --warn: #a85a1f;
  --accent-grep: #d67635;
  --accent-grep-active: #b05420;

  /* Actor lane colors — light variants */
  --actor-user: #5c5dab;
  --actor-coordinator: #7a7f88;
  --actor-planner-lead: #a85a1f;
  --actor-researcher: #5e4674;
  --actor-builder: #5c7a0e;
  --actor-verifier: #b23a60;
  --actor-validator: #a85a1f;
  --actor-system: #a0876b;

  --r-xs: 4px;
  --r-sm: 6px;
  --r-md: 8px;
  --r-lg: 12px;
  --r-pill: 9999px;
}

/* Dark theme — preserved from v0.4 Linear chassis */
[data-theme='dark'] {
  --canvas: #010102;
  --surface-1: #0f1011;
  --surface-2: #141516;
  --surface-3: #18191a;
  --hairline: #23252a;
  --hairline-strong: #34343a;
  --ink: #f7f8f8;
  --ink-muted: #d0d6e0;
  --ink-subtle: #8a8f98;
  --ink-tertiary: #62666d;
  --primary: #5e6ad2;
  --primary-hover: #828fff;

  --audit-bg: #1f1633;
  --audit-fg: #fa7faa;
  --lime: #c2ef4e;
  --warn: #ffb287;
  --accent-grep: #ff9f1c;
  --accent-grep-active: #ff5e00;

  --actor-user: #5e6ad2;
  --actor-coordinator: #8a8f98;
  --actor-planner-lead: #ffb287;
  --actor-researcher: #79628c;
  --actor-builder: #c2ef4e;
  --actor-verifier: #fa7faa;
  --actor-validator: #ffb287;
  --actor-system: #34343a;
}

/* PR-Branding (F3) — Crumb wordmark font cascade. local() chain tries
 * (1) Cabinet Grotesk if user has it installed (best logo match — closest
 *     to the bread silhouette's rounded-bold-sans character),
 * (2) Apple SF Pro Rounded via local SDK,
 * (3) ui-rounded W3C generic.
 * No external download needed at runtime; no inline-budget impact. To
 * bundle Cabinet Grotesk in-blob, drop a woff2 into
 * \`packages/studio/src/client/assets/\` and extend inline-client.mjs to
 * base64-inline it as a \`data:font/woff2;base64,...\` src here. */
@font-face {
  font-family: 'Crumb Brand';
  font-weight: 800;
  font-display: swap;
  src:
    local('Cabinet Grotesk Extrabold'), local('CabinetGrotesk-Extrabold'),
    local('Cabinet Grotesk Bold'), local('CabinetGrotesk-Bold'), local('SF Pro Rounded Black'),
    local('SF Pro Rounded Bold');
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  background: var(--canvas);
  color: var(--ink);
  font-family:
    ui-sans-serif,
    -apple-system,
    'SF Pro Display',
    'Segoe UI',
    system-ui,
    sans-serif;
  font-size: 14px;
  line-height: 1.5;
  letter-spacing: -0.05px;
  height: 100%;
}

body {
  display: grid;
  grid-template-columns: var(--sessions-w, 240px) 4px 1fr;
  height: 100vh;
  transition: grid-template-columns 220ms ease;
}
/* F4 — collapsed sidebar: zero out both the sessions column and the resize
 * handle column; CSS transition above carries the slide. JS toggles the
 * data attribute on click + persists in localStorage (crumb.sessions-collapsed). */
body[data-sidebar-collapsed='1'] {
  grid-template-columns: 0 0 1fr;
}
body[data-sidebar-collapsed='1'] aside.sessions {
  overflow: hidden;
  visibility: hidden;
}
body[data-sidebar-collapsed='1'] .resize-handle-sessions {
  display: none;
}

/* Draggable resize handles — Mac/Windows native-feel split bars. */
.resize-handle {
  cursor: col-resize;
  user-select: none;
  background: transparent;
  transition: background 120ms ease;
  z-index: 10;
}
.resize-handle:hover,
.resize-handle.dragging {
  background: var(--primary, #4a90e2);
}
.resize-handle-sessions {
  width: 4px;
  height: 100vh;
}
.resize-handle-detail {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 5px;
  cursor: col-resize;
}

/* Resume CTA */
.resume-btn {
  background: var(--primary, #4a90e2);
  color: white;
  border: none;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 600;
  margin-right: 8px;
}
.resume-btn:hover {
  filter: brightness(1.1);
}
.resume-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

/* Transcript viewer */
.transcript-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.transcript-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--hairline);
  font-size: 12px;
  flex-wrap: wrap;
}
.transcript-toolbar input {
  flex: 1 1 160px;
  min-width: 80px;
  max-width: 320px;
  background: var(--canvas);
  color: var(--ink);
  border: 1px solid var(--hairline);
  border-radius: var(--r-sm);
  padding: 4px 8px;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  text-overflow: ellipsis;
}
.transcript-content {
  flex: 1;
  overflow: auto;
  padding: 8px 12px;
  margin: 0;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  background: var(--canvas);
}

aside.sessions {
  background: var(--canvas);
  border-right: 1px solid var(--hairline);
  overflow-y: auto;
  padding: 0 0 12px;
}

/* PR-Branding (F3) — top-of-sidebar wordmark. Sits above the Adapters
 * heading (which itself is the first .sessions-header). Inline SVG mark +
 * Cabinet Grotesk-style wordmark. currentColor on the SVG so it recolors
 * with theme. */
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--hairline);
  color: var(--ink);
}
.brand-mark {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  /* Multi-color brand mascot — colors are baked into the SVG (cream toast +
   * crust + crumbs) so it reads on both light and dark themes. Do NOT set
   * \`color\` here — that would override stroke fills via currentColor. */
}
.brand-text {
  font-family: 'Crumb Brand', ui-rounded, 'SF Pro Rounded', system-ui, sans-serif;
  font-weight: 800;
  font-size: 14px;
  letter-spacing: 0.4px;
  color: var(--ink);
  white-space: nowrap;
}
.brand-text .brand-suffix {
  color: var(--ink-subtle);
  font-weight: 700;
  margin-left: 4px;
}

/* PR-Branding (F3) — theme toggle button in view-tabs rightmost slot.
 * Glyph swap (☀ ↔ 🌙) handled by JS. */
.theme-toggle {
  background: transparent;
  border: 1px solid var(--hairline);
  color: var(--ink-muted);
  border-radius: var(--r-sm);
  padding: 4px 10px;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition:
    background 120ms ease,
    border-color 120ms ease;
}
.theme-toggle:hover {
  background: var(--surface-2);
  border-color: var(--primary);
  color: var(--ink);
}
aside.sessions h2 {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.4px;
  color: var(--ink-subtle);
  text-transform: uppercase;
  padding: 8px 16px;
}
.session-row {
  padding: 10px 16px;
  border-left: 2px solid transparent;
  cursor: pointer;
  transition:
    background 60ms ease,
    border-color 60ms ease;
}
.session-row:hover {
  background: var(--surface-1);
}
.session-row.active {
  border-left-color: var(--primary);
  background: var(--surface-2);
}
.session-row .row-id {
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 11px;
  color: var(--ink-subtle);
}
.session-row .row-goal {
  color: var(--ink);
  margin-top: 2px;
  font-size: 13px;
}
.session-row .row-meta {
  color: var(--ink-subtle);
  font-size: 11px;
  margin-top: 2px;
}
.session-row .row-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ink-tertiary);
  margin-right: 6px;
  vertical-align: 1px;
  transition:
    background 200ms ease,
    box-shadow 200ms ease;
}
/* v3.5 state-aware sidebar dots — bootstrap classifier output */
.session-row.state-live .row-dot {
  background: var(--lime);
  box-shadow: 0 0 6px var(--lime);
}
.session-row.state-idle .row-dot {
  background: var(--warn);
}
.session-row.state-interrupted .row-dot {
  background: var(--audit-fg);
  box-shadow: 0 0 4px rgba(250, 127, 170, 0.4);
}
.session-row.state-abandoned .row-dot {
  background: var(--ink-tertiary);
  opacity: 0.4;
}
.session-row.state-terminal .row-dot {
  background: var(--ink-subtle);
  opacity: 0.6;
}
.session-row.state-terminal {
  opacity: 0.78;
}
.session-row.state-abandoned {
  opacity: 0.55;
}
.session-row.state-interrupted .row-id::after {
  content: ' · ⏸';
  color: var(--audit-fg);
}
/* Legacy \`.live\` class kept for backward compat with any external SSE subscribers. */
.session-row.live .row-dot {
  background: var(--lime);
  box-shadow: 0 0 6px var(--lime);
}
.project-group {
  margin-bottom: 8px;
}
.project-label {
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 10px;
  font-weight: 500;
  color: var(--ink-tertiary);
  letter-spacing: 0.4px;
  text-transform: uppercase;
  padding: 6px 16px 4px;
  border-bottom: 1px solid var(--hairline);
  background: var(--surface-1);
}

main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

header.summary {
  border-bottom: 1px solid var(--hairline);
  padding: 16px 24px;
  display: grid;
  /* F4-relocate (2026-05-03 amendment): floating hamburger keeps a column slot
   * here so when the sidebar collapses the user can reopen it. The slot
   * collapses to 0 width when the sidebar is open. */
  grid-template-columns: auto 1fr auto;
  gap: 16px;
  align-items: center;
  background: var(--surface-1);
}
/* F4-relocate — sidebar collapse hamburger. Per user spec the primary
 * toggle sits inside <aside.sessions> next to the CRUMB STUDIO wordmark
 * (Image #16 reference: [hamburger] CRUMB STUDIO). When the sidebar
 * collapses, the primary toggle disappears with its container; a floating
 * twin (\`#sidebar-toggle-floating\`) inside header.summary takes over so
 * the sidebar can be reopened. JS mirrors aria-expanded between the two. */
.sidebar-toggle {
  background: transparent;
  border: 1px solid var(--hairline);
  color: var(--ink-muted);
  font-size: 16px;
  line-height: 1;
  padding: 6px 10px;
  cursor: pointer;
  border-radius: var(--r-sm);
  transition:
    background 120ms ease,
    color 120ms ease,
    border-color 120ms ease;
}
.sidebar-toggle:hover {
  background: var(--surface-2);
  color: var(--ink);
  border-color: var(--hairline-strong);
}
.sidebar-toggle:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
/* Floating fallback only shows when sidebar is collapsed; otherwise
 * \`[hidden]\` keeps it out of the layout AND the a11y tree. */
.sidebar-toggle-floating[hidden] {
  display: none;
}
/* Inside .brand the toggle sits flush left, no border-glyph competing
 * with the wordmark. Slightly tighter padding to fit the 14px row. */
.brand .sidebar-toggle {
  padding: 4px 8px;
  font-size: 14px;
}
header.summary h1 {
  font-size: 22px;
  font-weight: 500;
  letter-spacing: -0.4px;
  display: flex;
  align-items: center;
  gap: 12px;
}
header.summary .goal {
  color: var(--ink-muted);
  font-size: 13px;
  margin-top: 4px;
}
.metrics-row {
  display: flex;
  gap: 20px;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 12px;
  color: var(--ink-muted);
}
.metrics-row dt {
  color: var(--ink-subtle);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  font-size: 10px;
}
.metrics-row dd {
  color: var(--ink);
}

.pill {
  display: inline-block;
  padding: 2px 10px;
  border-radius: var(--r-pill);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}
.pill.ok {
  background: rgba(39, 166, 68, 0.15);
  color: #5fcb7e;
}
.pill.partial {
  background: rgba(255, 178, 135, 0.18);
  color: var(--warn);
}
.pill.err {
  background: rgba(250, 127, 170, 0.18);
  color: var(--audit-fg);
}
.pill.muted {
  background: var(--surface-2);
  color: var(--ink-subtle);
}

/* v3.4 Console mode — DAG topology + weaving + console input */
section.dag {
  border-bottom: 1px solid var(--hairline);
  background: var(--surface-1);
  padding: 10px 16px 8px;
}
.dag-header {
  display: flex;
  align-items: baseline;
  gap: 16px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
section.dag h2 {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.4px;
  color: var(--ink-subtle);
  text-transform: uppercase;
  margin: 0;
}
.dag-legend {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 9px;
  font-family: ui-monospace, monospace;
  letter-spacing: 0.2px;
  color: var(--ink-tertiary);
}
.dag-legend .lg {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.dag-legend .lg::before {
  content: '';
  display: inline-block;
  width: 18px;
  height: 0;
  border-top-width: 1.4px;
  border-top-style: solid;
}
.dag-legend .lg-flow::before {
  border-color: var(--primary);
}
.dag-legend .lg-respawn::before {
  border-color: #3b82f6;
  border-top-style: dashed;
}
.dag-legend .lg-rollback::before {
  border-color: #d97706;
  border-top-style: dashed;
}
.dag-legend .lg-terminal::before {
  border-color: var(--lime);
  border-top-width: 1.8px;
}
.dag-legend .lg-audit::before {
  border-color: var(--audit-fg);
  border-top-style: dotted;
}
.dag-legend .lg-intervene::before {
  border-color: var(--ink-tertiary);
  border-top-style: dotted;
}
.dag-legend .lg-resume::before {
  border-color: #06b6d4;
}
.lg-shapes {
  margin-left: auto;
}
.lg-shape-svg {
  width: 200px;
  height: 14px;
  display: inline-block;
  vertical-align: middle;
}
.lg-shape-svg circle,
.lg-shape-svg polygon,
.lg-shape-svg rect {
  fill: var(--surface-2);
  stroke: var(--ink-tertiary);
  stroke-width: 1;
}
.lg-shape-svg text {
  fill: var(--ink-tertiary);
  font-family: ui-monospace, monospace;
  font-size: 9px;
}
.dag-svg {
  width: 100%;
  height: 320px;
  display: block;
}
/* Phase background zones — translucent so node/edge contrast stays high */
.dag-phase rect {
  fill: rgba(94, 106, 210, 0.03);
  stroke: rgba(94, 106, 210, 0.16);
  stroke-width: 0.5;
  stroke-dasharray: 4 3;
}
.dag-phase.phase-A rect {
  fill: rgba(124, 58, 237, 0.04);
  stroke: rgba(124, 58, 237, 0.18);
} /* violet — Spec */
.dag-phase.phase-B rect {
  fill: rgba(59, 130, 246, 0.03);
  stroke: rgba(59, 130, 246, 0.18);
} /* blue — Build */
.dag-phase.phase-C rect {
  fill: rgba(34, 197, 94, 0.03);
  stroke: rgba(34, 197, 94, 0.2);
} /* green — QA */
.dag-phase.phase-D rect {
  fill: rgba(202, 138, 4, 0.03);
  stroke: rgba(202, 138, 4, 0.2);
} /* amber — Verify */
.dag-phase.phase-E rect {
  fill: rgba(22, 163, 74, 0.04);
  stroke: rgba(22, 163, 74, 0.22);
} /* lime-green — Done */
.dag-phase .phase-label {
  font-size: 9px;
  font-family: ui-monospace, monospace;
  fill: var(--ink-tertiary);
  letter-spacing: 0.4px;
  text-transform: uppercase;
}
/* Node bodies — shape-agnostic via path data. Per-shape selectors below. */
.dag-node path {
  fill: var(--surface-2);
  stroke: var(--hairline-strong);
  stroke-width: 1.5;
  transition:
    fill 200ms ease,
    stroke 200ms ease;
}
.dag-node.shape-hexagon path {
  fill: var(--canvas);
  stroke: var(--lime);
  stroke-width: 1.4;
}
.dag-node.shape-diamond path {
  fill: var(--canvas);
  stroke: var(--ink-tertiary);
  stroke-width: 1.4;
}
.dag-node.shape-terminal path {
  fill: var(--surface-2);
  stroke: var(--lime);
  stroke-width: 1.4;
  stroke-dasharray: 3 2;
  opacity: 0.7;
}
.dag-node.active path {
  fill: var(--lime);
  stroke: var(--lime);
  filter: drop-shadow(0 0 6px var(--lime));
  stroke-dasharray: none;
  opacity: 1;
}
.dag-node.recent path {
  stroke: var(--primary);
  stroke-width: 2;
}
.dag-node text {
  font-size: 11px;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  fill: var(--ink-muted);
  text-anchor: middle;
  font-weight: 500;
}
.dag-node.active text {
  fill: var(--canvas);
  font-weight: 600;
}
.dag-node.shape-hexagon text {
  fill: var(--lime);
}
/* PR-J' (Candidate 4) — runtime badge under each node.
 * LangSmith / Langfuse / Phoenix per-step token+cost+latency convention,
 * compact monospace, dimmed so it reads as supplementary data not as
 * primary node identity. Recently-active actor's badge brightens. */
.dag-node-badge {
  font-size: 9px;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  fill: var(--ink-tertiary);
  text-anchor: middle;
  letter-spacing: 0.2px;
  pointer-events: none;
  opacity: 0.85;
}
.dag-node.active .dag-node-badge,
.dag-node.recent .dag-node-badge {
  fill: var(--ink-muted);
  opacity: 1;
}
/* Validator stays muted (it's a side-effect emitter, not in the main flow) */
.dag-node.node-validator path {
  stroke: var(--audit-fg);
  stroke-dasharray: 2 2;
  opacity: 0.7;
}
.dag-node.node-validator text {
  fill: var(--audit-fg);
}
.dag-edge {
  fill: none;
  stroke-width: 1.4;
}
/* Typed edges — semantics match src/reducer/index.ts (post PR-G) */
.dag-edge.edge-flow {
  stroke: var(--primary);
  opacity: 0.8;
}
.dag-edge.edge-respawn {
  stroke: #3b82f6;
  stroke-dasharray: 6 3;
  opacity: 0.9;
}
.dag-edge.edge-rollback {
  stroke: #d97706;
  stroke-dasharray: 5 3;
  opacity: 0.9;
}
.dag-edge.edge-terminal {
  stroke: var(--lime);
  stroke-width: 1.8;
  opacity: 0.95;
}
.dag-edge.edge-audit {
  stroke: var(--audit-fg);
  stroke-dasharray: 1 3;
  opacity: 0.65;
}
.dag-edge.edge-intervene {
  stroke: var(--ink-tertiary);
  stroke-dasharray: 1 3;
  opacity: 0.45;
}
.dag-edge.edge-resume {
  stroke: #06b6d4;
  opacity: 0.85;
}
/* PR-J' — Datadog Service Map "throughput=thickness" + X-Ray "latency=color"
 * idiom. Untraversed edges keep their static styling above; once an event
 * actually flows through them this session the .edge-traversed class
 * brightens them and the per-edge stroke-width inline attribute (set by
 * renderDag) widens them. .edge-slow adds a red wash for avg > 5s. */
.dag-edge-group.edge-traversed .dag-edge {
  opacity: 1;
}
.dag-edge-group.edge-slow .dag-edge {
  stroke: #dc2626 !important;
}
.edge-count {
  font-size: 8px;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  fill: var(--ink-subtle);
  text-anchor: middle;
  letter-spacing: 0.3px;
  pointer-events: none;
}
/* Arrowheads inherit per-type stroke via the marker definitions in JS. */
.arrow-head {
  fill: currentColor;
  stroke: none;
}
.arrow-flow {
  color: var(--primary);
}
.arrow-respawn {
  color: #3b82f6;
}
.arrow-rollback {
  color: #d97706;
}
.arrow-terminal {
  color: var(--lime);
}
.arrow-audit {
  color: var(--audit-fg);
}
.arrow-intervene {
  color: var(--ink-tertiary);
}
.arrow-resume {
  color: #06b6d4;
}
/* Edge labels — inline next to arc apex */
.edge-label {
  font-size: 9px;
  font-family: ui-monospace, monospace;
  fill: var(--ink-subtle);
  text-anchor: middle;
  pointer-events: none;
}
.edge-label-respawn {
  fill: #3b82f6;
}
.edge-label-rollback {
  fill: #d97706;
}
.edge-label-terminal {
  fill: var(--lime);
  font-weight: 600;
}
.edge-label-resume {
  fill: #06b6d4;
}
.edge-label-audit {
  fill: var(--audit-fg);
  opacity: 0.85;
}
.dag-ripple {
  fill: none;
  stroke: var(--primary);
  stroke-width: 2;
  opacity: 0;
  pointer-events: none;
}
@keyframes ripple-flow {
  0% {
    opacity: 0;
    stroke-dasharray: 0 200;
  }
  20% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    stroke-dasharray: 200 0;
  }
}
.dag-ripple.flow {
  animation: ripple-flow 1500ms ease-out;
}

section.console-input {
  border-top: 1px solid var(--hairline);
  background: var(--surface-1);
  padding: 10px 16px 14px;
}
.console-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.console-row input[type='text'] {
  flex: 1;
  background: var(--canvas);
  color: var(--ink);
  border: 1px solid var(--hairline);
  border-radius: var(--r-md);
  padding: 8px 12px;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 13px;
  outline: none;
}
.console-row input[type='text']:focus {
  border-color: var(--primary);
}
.console-row button {
  background: var(--primary);
  color: var(--ink);
  border: none;
  border-radius: var(--r-md);
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}
.console-row button:hover {
  background: var(--primary-hover);
}
.console-row button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.console-hints {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 6px;
}
.console-hints button {
  background: var(--surface-2);
  color: var(--ink-muted);
  border: 1px solid var(--hairline);
  border-radius: var(--r-sm);
  padding: 3px 8px;
  font-size: 10px;
  font-family: ui-monospace, monospace;
  cursor: pointer;
}
.console-hints button:hover {
  border-color: var(--primary);
  color: var(--ink);
}
.console-feedback {
  font-size: 11px;
  color: var(--ink-subtle);
  margin-top: 6px;
  font-family: ui-monospace, monospace;
  min-height: 14px;
}
.console-feedback.ok {
  color: #5fcb7e;
}
.console-feedback.err {
  color: var(--audit-fg);
}

/* v3.4 Logs view (ArgoCD-inspired) */
nav.view-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--hairline);
  background: var(--canvas);
  padding: 0 16px;
}
nav.view-tabs button {
  background: transparent;
  border: none;
  color: var(--ink-subtle);
  padding: 10px 16px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition:
    color 100ms ease,
    border-color 100ms ease;
}
nav.view-tabs button:hover {
  color: var(--ink-muted);
}
nav.view-tabs button.active {
  color: var(--ink);
  border-bottom-color: var(--primary);
}

.view-pane {
  display: none;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}
.view-pane.active {
  display: flex;
}

section.logs {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--canvas);
  display: grid;
  grid-template-columns: 200px 1fr;
}
.logs-actor-list {
  border-right: 1px solid var(--hairline);
  overflow-y: auto;
  padding: 8px 0;
}
.logs-actor-row {
  padding: 8px 14px;
  border-left: 2px solid transparent;
  cursor: pointer;
  font-size: 12px;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  color: var(--ink-muted);
  display: flex;
  align-items: center;
  gap: 8px;
  transition:
    background 60ms ease,
    border-color 60ms ease;
}
.logs-actor-row:hover {
  background: var(--surface-1);
}
.logs-actor-row.active {
  border-left-color: var(--primary);
  background: var(--surface-2);
  color: var(--ink);
}
.logs-actor-row .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ink-tertiary);
}
.logs-actor-row.live .dot {
  background: var(--lime);
  box-shadow: 0 0 6px var(--lime);
}
.logs-actor-row.errored .dot {
  background: var(--audit-fg);
}
.logs-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.logs-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 14px;
  border-bottom: 1px solid var(--hairline);
  background: var(--surface-1);
  font-size: 11px;
  color: var(--ink-subtle);
  flex-wrap: wrap;
}
.logs-toolbar input[type='text'] {
  flex: 1 1 160px;
  min-width: 80px;
  max-width: 320px;
  background: var(--canvas);
  color: var(--ink);
  border: 1px solid var(--hairline);
  border-radius: var(--r-sm);
  padding: 4px 8px;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  outline: none;
  text-overflow: ellipsis;
}
.logs-toolbar input[type='text']:focus {
  border-color: var(--primary);
}
.logs-toolbar label {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  cursor: pointer;
}
.logs-toolbar button {
  background: var(--surface-2);
  color: var(--ink-muted);
  border: 1px solid var(--hairline);
  border-radius: var(--r-sm);
  padding: 4px 10px;
  font-size: 10px;
  font-family: ui-monospace, monospace;
  cursor: pointer;
}
.logs-toolbar button:hover {
  color: var(--ink);
  border-color: var(--primary);
}

/*
 * v0.5 PR-6 — connection-status pill (5 states). Datadog/Honeycomb live-tail
 * convention: every state has its own color + the dot animates so the user
 * can scan it without reading. stalled/errored expose the Reconnect button.
 */
.logs-conn-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 10.5px;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  letter-spacing: 0.2px;
  text-transform: uppercase;
  border: 1px solid transparent;
  flex: 0 0 auto;
}
.logs-conn-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: 0 0 auto;
}
.logs-conn-label {
  font-weight: 600;
}
.logs-conn-msg {
  font-weight: 400;
  opacity: 0.85;
  text-transform: none;
  letter-spacing: 0;
}
.logs-conn-status.state-idle,
.logs-conn-status.state-awaiting-actor {
  color: var(--ink-tertiary);
  background: rgba(120, 120, 120, 0.1);
  border-color: rgba(120, 120, 120, 0.25);
}
.logs-conn-status.state-idle .logs-conn-dot,
.logs-conn-status.state-awaiting-actor .logs-conn-dot {
  background: var(--ink-tertiary);
}
.logs-conn-status.state-connecting {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
}
.logs-conn-status.state-connecting .logs-conn-dot {
  background: #f59e0b;
  animation: logs-conn-spin 1.2s linear infinite;
  box-shadow: 0 0 6px rgba(245, 158, 11, 0.55);
}
@keyframes logs-conn-spin {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(0.6);
    opacity: 0.4;
  }
}
.logs-conn-status.state-streaming {
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.3);
}
.logs-conn-status.state-streaming .logs-conn-dot {
  background: #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.55);
  animation: logs-conn-pulse 2s ease-in-out infinite;
}
@keyframes logs-conn-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
.logs-conn-status.state-stalled {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.13);
  border-color: rgba(245, 158, 11, 0.4);
}
.logs-conn-status.state-stalled .logs-conn-dot {
  background: #f59e0b;
}
.logs-conn-status.state-errored {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.13);
  border-color: rgba(239, 68, 68, 0.45);
}
.logs-conn-status.state-errored .logs-conn-dot {
  background: #ef4444;
  box-shadow: 0 0 6px rgba(239, 68, 68, 0.5);
}
.logs-conn-retry {
  margin-left: 6px;
  background: transparent;
  color: inherit;
  border: 1px solid currentColor;
  border-radius: 4px;
  padding: 2px 8px;
  font: inherit;
  font-size: 9.5px;
  cursor: pointer;
  text-transform: none;
  letter-spacing: 0;
}
.logs-conn-retry:hover {
  background: rgba(255, 255, 255, 0.06);
}

/*
 * v0.5 PR-6 — "Jump to live" floating button. GitHub Actions / ArgoCD pattern:
 * shown only when followAuto is off (user scrolled up). Single click resumes
 * follow + scrolls to tail.
 */
.logs-jump-live {
  position: absolute;
  right: 28px;
  bottom: 18px;
  background: var(--primary);
  color: var(--ink);
  border: 1px solid var(--primary-hover, var(--primary));
  border-radius: 999px;
  padding: 6px 14px;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 11px;
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
  z-index: 5;
}
.logs-jump-live:hover {
  filter: brightness(1.08);
}
.logs-jump-live-arrow {
  display: inline-block;
  margin-right: 4px;
  font-weight: 700;
}
.logs-pane {
  position: relative;
}

/*
 * v0.5 PR-6 — empty-state copy variants (Supabase Logs Explorer pattern,
 * intent-keyed, not generic). Each state gets its own subtle accent so users
 * can tell at a glance whether they're loading, waiting on a spawn, or
 * disconnected.
 */
.logs-empty.logs-empty--loading {
  color: #f59e0b;
}
.logs-empty.logs-empty--never-spawned {
  color: var(--ink-muted);
}
.logs-empty.logs-empty--never-spawned::before {
  content: '🌱 ';
}
.logs-empty.logs-empty--waiting {
  color: #10b981;
}
.logs-empty.logs-empty--waiting::before {
  content: '✓ ';
}
.logs-empty.logs-empty--errored {
  color: #ef4444;
}
.logs-empty.logs-empty--errored::before {
  content: '⚠ ';
}

.logs-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px 16px;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 11.5px;
  line-height: 1.45;
  color: var(--ink-muted);
  white-space: pre;
  background: var(--canvas);
}
.logs-content .log-line {
  padding: 0 4px;
  border-radius: 2px;
}
.logs-content .log-line.stderr {
  color: var(--audit-fg);
}
.logs-content .log-line.section {
  color: var(--lime);
  font-weight: 600;
}
.logs-content .log-line.has-match {
  background: rgba(255, 159, 28, 0.06);
}

/* IDE-style grep substring highlight (Logs / Transcript / Live feed) */
mark.grep-hit {
  background: rgba(255, 159, 28, 0.32);
  color: var(--ink);
  border-radius: 2px;
  padding: 0 1px;
  border: 1px solid transparent;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
mark.grep-hit.active {
  background: var(--accent-grep);
  color: var(--canvas);
  border-color: var(--accent-grep-active);
  box-shadow: 0 0 0 1px var(--accent-grep-active);
  font-weight: 600;
}

/* Shared grep nav controls (count + ↑↓) */
.grep-controls {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: ui-monospace, monospace;
  font-size: 10px;
  color: var(--ink-tertiary);
  flex-shrink: 0; /* never collapse — keep ↑↓ + counter visible even when toolbar is narrow */
}
.grep-controls .grep-count {
  min-width: 50px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.grep-controls .grep-count.has-hits {
  color: var(--accent-grep);
}
.grep-controls .grep-count.no-hits {
  color: var(--ink-tertiary);
  opacity: 0.5;
}
.grep-controls button.grep-nav {
  background: var(--surface-2);
  color: var(--ink-muted);
  border: 1px solid var(--hairline);
  border-radius: var(--r-sm);
  padding: 2px 6px;
  font-size: 11px;
  font-family: ui-monospace, monospace;
  cursor: pointer;
  line-height: 1;
}
.grep-controls button.grep-nav:hover:not(:disabled) {
  color: var(--accent-grep);
  border-color: var(--accent-grep);
}
.grep-controls button.grep-nav:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.logs-empty {
  color: var(--ink-tertiary);
  padding: 40px 24px;
  font-size: 13px;
  font-family: ui-sans-serif, system-ui, sans-serif;
}

section.swimlane {
  /* PR-Layout: was flex:1; now its own resizable pane between view-pane (absorber)
     and the narrative panel. Min/max prevent the user from collapsing it
     completely or starving the absorber. */
  flex: 0 0 var(--swimlane-h, 200px);
  min-height: 80px;
  max-height: 70vh;
  overflow: auto;
  padding: 16px 0 24px;
  background: var(--canvas);
  border-top: 1px solid var(--hairline);
}

/*
 * v0.5 PR-O3 — Wall-clock waterfall view. Datadog APM trace + Chrome
 * DevTools Performance + Jaeger / Honeycomb span convention. Each lane
 * holds bars whose width is wall-clock-proportional; ticks are
 * zero-width markers for sub-step events. Hover → tooltip; click →
 * shared right-rail detail panel.
 */
section.waterfall {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--canvas);
  position: relative;
}
.waterfall-toolbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--hairline);
  font-size: 11px;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  color: var(--ink-muted);
  background: var(--surface-1);
}
.waterfall-toolbar-label {
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--ink-tertiary);
}
.waterfall-toolbar-hint {
  color: var(--ink-tertiary);
}
.waterfall-toolbar-axis {
  color: var(--ink-muted);
  white-space: nowrap;
}
.waterfall-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 12px 0 24px;
}
.waterfall-lane {
  display: grid;
  grid-template-columns: 130px 1fr;
  align-items: center;
  gap: 12px;
  padding: 4px 16px;
  min-height: 26px;
}
.waterfall-lane-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--ink-muted);
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
}
.waterfall-lane-label .glyph {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.waterfall-lane-track {
  position: relative;
  height: 20px;
  background: var(--surface-1);
  border-radius: 4px;
}
.waterfall-bar {
  position: absolute;
  top: 2px;
  bottom: 2px;
  background: linear-gradient(180deg, var(--primary) 0%, var(--primary-hover, var(--primary)) 100%);
  border-radius: 3px;
  cursor: pointer;
  overflow: hidden;
  transition:
    filter 80ms ease,
    outline-color 80ms ease;
  outline: 1px solid transparent;
  min-width: 2px;
}
.waterfall-bar:hover {
  filter: brightness(1.15);
  outline-color: rgba(255, 255, 255, 0.6);
}
.waterfall-bar-label {
  position: absolute;
  top: 50%;
  left: 6px;
  transform: translateY(-50%);
  font-size: 10px;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  color: var(--ink);
  white-space: nowrap;
  pointer-events: none;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}
.waterfall-bar.errored {
  background: linear-gradient(180deg, var(--audit-fg) 0%, #c93b66 100%);
}
.waterfall-bar.audit {
  background: linear-gradient(180deg, var(--warn) 0%, #c97f3b 100%);
}
.waterfall-bar.in-flight {
  background: repeating-linear-gradient(
    45deg,
    var(--primary),
    var(--primary) 6px,
    var(--primary-hover, var(--primary)) 6px,
    var(--primary-hover, var(--primary)) 12px
  );
  animation: waterfall-in-flight 1.6s linear infinite;
}
@keyframes waterfall-in-flight {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 24px 0;
  }
}
.waterfall-tick {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  pointer-events: auto;
}
.waterfall-tick:hover {
  background: var(--ink);
  box-shadow: 0 0 4px var(--primary);
}
.waterfall-tooltip {
  position: absolute;
  z-index: 10;
  background: var(--surface-2);
  color: var(--ink);
  border: 1px solid var(--hairline);
  border-radius: var(--r-sm);
  padding: 6px 10px;
  font-size: 11px;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}
.lane {
  display: grid;
  grid-template-columns: 140px 1fr;
  align-items: center;
  border-bottom: 1px solid var(--hairline);
  min-height: 36px;
}
.lane-label {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--ink-subtle);
  padding: 0 16px;
  border-right: 1px solid var(--hairline);
  height: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
}
.lane-label .glyph {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.lane-events {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  padding: 0 16px;
  white-space: nowrap;
}
.evt {
  display: inline-block;
  padding: 4px 8px;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 11px;
  color: var(--ink);
  background: var(--surface-1);
  border: 1px solid var(--hairline);
  border-radius: var(--r-sm);
  cursor: pointer;
  transition:
    transform 80ms ease,
    border-color 80ms ease,
    background 80ms ease;
  flex: 0 0 auto;
}
.evt:hover {
  border-color: var(--primary);
  background: var(--surface-2);
}
.evt.deterministic {
  border-color: var(--lime);
}
.evt.audit {
  border-color: var(--audit-fg);
  background: var(--audit-bg);
  color: var(--audit-fg);
}
/*
 * v0.5 PR-7 — fresh animation now slides in from the LEFT (events
 * accumulate left-to-right chronologically; the newest chip should
 * emerge from the trailing edge of the lane, not pop in from the right).
 * User feedback: opacity-fade flicker on session switch should target
 * the same left edge for consistency with chronological reading.
 */
.evt.fresh {
  animation: fresh 1200ms ease;
}
@keyframes fresh {
  0% {
    transform: translateX(-6px);
    opacity: 0;
    border-color: var(--primary-hover);
  }
  60% {
    transform: translateX(0);
    opacity: 1;
  }
  100% {
    border-color: var(--hairline);
  }
}

/*
 * v0.5 PR-7 — grouped chip + count badge.
 *
 * Pattern: Slack unread count / WhatsApp message bubble / VS Code Problems
 * panel collapsed-duplicate. The badge sits at the top-right corner of
 * the chip, slightly offset, with a subtle accent so it doesn't compete
 * with the chip's primary kind label. Numbers up to 99; cap rendered as
 * "99+" via aria-label.
 */
.evt {
  position: relative; /* anchor for the count badge */
}
.evt.grouped {
  /* v0.5 PR-8: dropped the left-edge purple accent — user feedback was
     that it competed visually with audit/deterministic state colors and
     wasn't carrying meaning beyond the count badge itself. The badge
     alone is the canonical "this is multiple events" signal now.
     Kept the right padding so the badge has room. */
  padding-right: 18px;
}
/*
 * v0.5 PR-8: unread badge.
 *
 * Color discipline (user feedback — 형광색 위 흰 숫자가 안 보임):
 *   - default badge: dark surface (\`--surface-2\`) with \`--ink\` text. Reads
 *     as a subtle indicator, never demands attention. iMessage gray-pill
 *     unread convention rather than the noisy "red dot everywhere" anti-
 *     pattern.
 *   - audit badge: keep red on red-tinted bg (audit context already loud)
 *   - deterministic badge: drop the lime fill (white-on-lime had poor
 *     contrast — WCAG AA fails at ~1.4:1) and use the same dark surface
 *     with a lime border instead, so the dim-2 status reads through the
 *     border without hurting legibility.
 */
.evt-count {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--surface-2);
  color: var(--ink);
  border: 1px solid var(--hairline);
  font-size: 10px;
  font-weight: 700;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
  pointer-events: none; /* let chip click through to its own handler */
  letter-spacing: 0;
}
.evt.audit .evt-count {
  background: var(--audit-bg);
  color: var(--audit-fg);
  border-color: var(--audit-fg);
}
.evt.deterministic .evt-count {
  background: var(--surface-2);
  color: var(--ink);
  border-color: var(--lime);
}

/* PR-K' — Datadog-grade event detail panel. Replaces PR-7 group paginator
 * with a horizontal card spread + adds tag pills, audit banner, resource
 * breakdown bar, and copy buttons. Frontier convergence: Datadog APM
 * trace breakdown, Honeycomb attribute pills, Sentry trace inspector. */

/* Title row + group badge */
.detail-title-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
}
.detail-group-badge {
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.4px;
  color: var(--primary);
  background: color-mix(in oklab, var(--primary) 18%, transparent);
  border: 1px solid color-mix(in oklab, var(--primary) 50%, var(--hairline));
  border-radius: 999px;
  padding: 1px 8px;
  font-weight: 600;
}
.detail-pipeline-pos {
  font-size: 10px;
  color: var(--ink-tertiary);
  font-family: ui-monospace, monospace;
  margin-bottom: 6px;
  letter-spacing: 0.2px;
}
.detail-thread-nav {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}
.detail-nav-btn {
  background: var(--surface-2);
  border: 1px solid var(--hairline);
  color: var(--ink-muted);
  padding: 2px 9px;
  border-radius: var(--r-sm);
  font-size: 10px;
  font-family: ui-monospace, monospace;
  cursor: pointer;
  transition:
    border-color 80ms ease,
    color 80ms ease;
}
.detail-nav-btn:hover {
  color: var(--ink);
  border-color: var(--primary);
}

/* Tag pills (Honeycomb attribute facet pattern) */
.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 10px;
}
.detail-tag {
  display: inline-flex;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 9.5px;
  border: 1px solid var(--hairline);
  border-radius: 3px;
  overflow: hidden;
  background: var(--surface-2);
  user-select: none;
}
.detail-tag-key {
  background: color-mix(in oklab, var(--ink-tertiary) 25%, transparent);
  color: var(--ink-subtle);
  padding: 2px 6px;
  letter-spacing: 0.3px;
}
.detail-tag-val {
  color: var(--ink);
  padding: 2px 6px;
  letter-spacing: 0.2px;
}
.detail-tag.tag-deterministic .detail-tag-val {
  color: var(--lime);
}
.detail-tag.tag-cross-provider .detail-tag-val {
  color: #f59e0b;
}

/* Audit banner — Datadog "anomaly" surface */
.detail-audit-banner {
  background: color-mix(in oklab, var(--audit-fg) 14%, transparent);
  color: var(--audit-fg);
  border: 1px solid color-mix(in oklab, var(--audit-fg) 50%, var(--hairline));
  border-radius: var(--r-sm);
  padding: 6px 10px;
  font-family: ui-monospace, monospace;
  font-size: 10.5px;
  margin-bottom: 10px;
  letter-spacing: 0.2px;
}

/* Resource bar (token / cost / latency breakdown) */
.detail-resource-bar {
  margin-bottom: 10px;
}
.rbar {
  display: flex;
  height: 14px;
  border-radius: 3px;
  overflow: hidden;
  background: var(--surface-2);
  border: 1px solid var(--hairline);
}
.rbar-empty {
  justify-content: center;
  align-items: center;
  font-size: 9px;
  color: var(--ink-tertiary);
}
.rbar-seg {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8.5px;
  font-family: ui-monospace, monospace;
  color: var(--canvas);
  letter-spacing: 0.2px;
  white-space: nowrap;
  overflow: hidden;
  min-width: 0;
}
.rbar-seg-label {
  padding: 0 4px;
}
.rbar-cache {
  background: color-mix(in oklab, var(--lime) 70%, transparent);
  color: var(--bg, #0b0c0d);
}
.rbar-in {
  background: color-mix(in oklab, var(--primary) 80%, transparent);
}
.rbar-out {
  background: color-mix(in oklab, #06b6d4 75%, transparent);
  color: var(--bg, #0b0c0d);
}
.rbar-meta {
  display: flex;
  gap: 14px;
  margin-top: 6px;
  font-family: ui-monospace, monospace;
  font-size: 10px;
  color: var(--ink-muted);
}
.rbar-meta-cell {
  display: inline-flex;
  gap: 5px;
  align-items: baseline;
}
.rbar-meta-k {
  font-size: 8.5px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--ink-tertiary);
}
.detail-resource-empty {
  font-size: 10px;
  font-family: ui-monospace, monospace;
  color: var(--ink-tertiary);
  font-style: italic;
}

/* Copy buttons inline with H3 */
aside.detail h3 {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.detail-copy-btn {
  background: transparent;
  border: 1px solid var(--hairline);
  color: var(--ink-tertiary);
  border-radius: 3px;
  padding: 1px 6px;
  font-size: 11px;
  cursor: pointer;
  margin-left: 8px;
  font-family: inherit;
  text-transform: none;
  letter-spacing: 0;
}
.detail-copy-btn:hover {
  color: var(--ink);
  border-color: var(--primary);
}

.detail-thread {
  font-size: 11px;
  font-family: ui-monospace, monospace;
  max-height: 200px;
  overflow: auto;
  border: 1px solid var(--hairline);
  border-radius: var(--r-md);
  padding: 8px;
  background: var(--canvas);
}

/* PR-K' — group spread (horizontal cards) */
.detail-body-spread {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
  height: calc(100% - 80px);
}
.detail-spread-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-family: ui-monospace, monospace;
  font-size: 10px;
  color: var(--ink-muted);
  border-bottom: 1px solid var(--hairline);
  padding-bottom: 6px;
}
.spread-toolbar-label {
  font-weight: 600;
  color: var(--ink);
}
.spread-toolbar-hint {
  color: var(--ink-tertiary);
  font-size: 9.5px;
}
.detail-spread-cards {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 8px;
  flex: 1 1 auto;
  min-height: 0;
  scroll-snap-type: x proximity;
}
.spread-card {
  flex: 0 0 320px;
  scroll-snap-align: start;
  background: var(--canvas);
  border: 1px solid var(--hairline);
  border-radius: var(--r-md);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: auto;
  max-height: 100%;
  font-family: ui-monospace, monospace;
  font-size: 10.5px;
}
.spread-card-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.spread-card-actor {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  color: var(--ink);
  font-weight: 500;
  letter-spacing: 0.2px;
}
.spread-card-actor .glyph {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}
.spread-card-ts {
  font-size: 10px;
  color: var(--ink-tertiary);
  letter-spacing: 0.3px;
  margin-left: auto;
  margin-right: 6px;
}
.spread-card-copy {
  background: transparent;
  border: 1px solid var(--hairline);
  color: var(--ink-tertiary);
  border-radius: 3px;
  padding: 1px 6px;
  font-size: 9.5px;
  font-family: ui-monospace, monospace;
  cursor: pointer;
}
.spread-card-copy:hover {
  color: var(--ink);
  border-color: var(--primary);
}
.spread-card-audit {
  background: color-mix(in oklab, var(--audit-fg) 14%, transparent);
  color: var(--audit-fg);
  border: 1px solid color-mix(in oklab, var(--audit-fg) 50%, var(--hairline));
  border-radius: 3px;
  padding: 4px 8px;
  font-size: 9.5px;
}
.spread-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}
.spread-card-resource {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 10px;
  color: var(--ink-muted);
  padding: 4px 0;
  border-top: 1px dashed var(--hairline);
  border-bottom: 1px dashed var(--hairline);
}
.spread-card-resource strong {
  color: var(--ink-tertiary);
  font-size: 9px;
  margin-right: 2px;
}
.spread-card-body-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--ink-tertiary);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.spread-card-body,
.spread-card-data {
  background: var(--surface-1);
  border: 1px solid var(--hairline);
  border-radius: 3px;
  padding: 6px 8px;
  font-size: 10px;
  color: var(--ink);
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 220px;
  overflow: auto;
}

/*
 * v0.5 PR-7 — session-switch cascade fade-in, LEFT-FIRST.
 *
 * User feedback: when switching between sessions the chips re-render and
 * fade in. The fade ripple should propagate from the LEFT (chronologically
 * first events) so the user reads the timeline in natural left-to-right
 * order. Previous behavior re-rendered all chips simultaneously which
 * read as "everything blinked".
 *
 * Implementation: lane-events container gets an animation that staggers
 * its children via :nth-child delays. Cap at 12 chips (~120 ms total) so
 * dense lanes don't drag.
 */
.lane-events.session-switch-cascade .evt {
  animation: evt-cascade 240ms ease both;
}
.lane-events.session-switch-cascade .evt:nth-child(1) {
  animation-delay: 0ms;
}
.lane-events.session-switch-cascade .evt:nth-child(2) {
  animation-delay: 12ms;
}
.lane-events.session-switch-cascade .evt:nth-child(3) {
  animation-delay: 24ms;
}
.lane-events.session-switch-cascade .evt:nth-child(4) {
  animation-delay: 36ms;
}
.lane-events.session-switch-cascade .evt:nth-child(5) {
  animation-delay: 48ms;
}
.lane-events.session-switch-cascade .evt:nth-child(6) {
  animation-delay: 60ms;
}
.lane-events.session-switch-cascade .evt:nth-child(7) {
  animation-delay: 72ms;
}
.lane-events.session-switch-cascade .evt:nth-child(8) {
  animation-delay: 84ms;
}
.lane-events.session-switch-cascade .evt:nth-child(9) {
  animation-delay: 96ms;
}
.lane-events.session-switch-cascade .evt:nth-child(10) {
  animation-delay: 108ms;
}
.lane-events.session-switch-cascade .evt:nth-child(11) {
  animation-delay: 120ms;
}
.lane-events.session-switch-cascade .evt:nth-child(12) {
  animation-delay: 130ms;
}
@keyframes evt-cascade {
  0% {
    opacity: 0;
    transform: translateX(-4px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

/*
 * v0.5 PR-9: detail panel layout split into a fixed header (sticky close
 * + paginator + title) and a scroll body (meta / body / data / thread).
 * User feedback: close button must NOT scroll out of reach. The fixed
 * header sits at top:0 inside the panel; the scrollable body fills the
 * remainder. Datadog/Linear right-rail convention.
 */
aside.detail {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: var(--detail-w, 420px);
  background: var(--surface-1);
  border-left: 1px solid var(--hairline);
  display: flex;
  flex-direction: column;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 12px;
  color: var(--ink-muted);
  transform: translateX(100%);
  transition: transform 140ms ease;
}
aside.detail.open {
  transform: translateX(0);
}
aside.detail .detail-header {
  flex: 0 0 auto;
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--surface-1);
  border-bottom: 1px solid var(--hairline);
  padding: 12px 20px 10px 20px;
}
aside.detail .detail-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 12px 20px 20px 20px;
}
aside.detail h3 {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--ink-subtle);
  margin-bottom: 12px;
}
aside.detail .detail-header h3 {
  margin-bottom: 8px;
}
aside.detail pre {
  background: var(--canvas);
  border: 1px solid var(--hairline);
  border-radius: var(--r-md);
  padding: 12px;
  margin-bottom: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--ink);
}
aside.detail .close {
  position: absolute;
  top: 8px;
  right: 12px;
  width: 26px;
  height: 26px;
  border-radius: var(--r-sm);
  border: 1px solid var(--hairline);
  background: var(--canvas);
  color: var(--ink-muted);
  cursor: pointer;
  font-size: 14px;
  z-index: 6;
}
aside.detail .close:hover {
  color: var(--ink);
  border-color: var(--primary);
}

/*
 * v0.5 PR-9: cross-actor event paginator. Lets the user step through
 * EVERY transcript event (sorted chronologically) with ←/→, regardless
 * of which actor lane the chip lives in. Complements the existing group
 * paginator (consecutive same-kind on one lane) — both are visible
 * simultaneously when applicable, and they don't interfere because
 * group nav scopes to ids ⊆ allEventIds.
 */
.detail-event-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding: 6px 10px;
  background: var(--canvas);
  border: 1px solid var(--hairline);
  border-radius: var(--r-sm);
  font-size: 11px;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  color: var(--ink-muted);
}
.detail-event-btn {
  background: transparent;
  border: 1px solid var(--hairline);
  color: var(--ink-muted);
  border-radius: var(--r-sm);
  padding: 2px 9px;
  font: inherit;
  cursor: pointer;
}
.detail-event-btn:hover:not([disabled]) {
  border-color: var(--primary);
  color: var(--ink);
}
.detail-event-btn[disabled] {
  opacity: 0.35;
  cursor: not-allowed;
}
.detail-event-pos {
  flex: 1 1 auto;
  text-align: center;
  color: var(--ink);
}
.detail-event-pos strong {
  color: var(--primary);
  font-weight: 700;
}

section.scorecard {
  border-top: 1px solid var(--hairline);
  background: var(--surface-1);
  padding: 12px 24px;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
}
.dim {
  background: var(--canvas);
  border: 1px solid var(--hairline);
  border-radius: var(--r-md);
  padding: 10px 12px;
}
.dim .label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--ink-subtle);
}
.dim .value {
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 18px;
  color: var(--ink);
  margin-top: 4px;
}
.dim .source {
  font-size: 10px;
  color: var(--ink-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-top: 2px;
}

#audit-banner {
  display: none;
  background: var(--audit-bg);
  color: var(--audit-fg);
  padding: 10px 24px;
  font-size: 12px;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  border-bottom: 1px solid var(--audit-fg);
  letter-spacing: 0.2px;
}
#audit-banner.show {
  display: block;
}

/*
 * v0.5 welcome banner — first-visit only, dismissible. Read-only observation
 * invariant is the message the user must internalize on day one.
 */
.welcome-banner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: linear-gradient(180deg, rgba(95, 203, 126, 0.08), rgba(95, 203, 126, 0.04));
  border-bottom: 1px solid rgba(95, 203, 126, 0.25);
  padding: 12px 24px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ink);
}
.welcome-banner-body {
  flex: 1 1 auto;
  min-width: 0;
}
.welcome-banner-title {
  display: inline-block;
  font-weight: 600;
  color: #5fcb7e;
  margin-right: 8px;
  letter-spacing: 0.2px;
}
.welcome-banner-text {
  color: var(--ink-muted);
}
.welcome-banner-text code {
  background: rgba(0, 0, 0, 0.25);
  padding: 1px 6px;
  border-radius: 3px;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 11px;
  color: var(--ink);
}
.welcome-banner-close {
  flex: 0 0 auto;
  background: transparent;
  border: none;
  color: var(--ink-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
  transition: color 120ms ease;
}
.welcome-banner-close:hover {
  color: var(--ink);
}

/*
 * v0.5 PR-5 — connection-state pill. Sticky-top with red pulse so the user
 * notices the disconnect immediately (laptop wake, Studio restart, wifi flap).
 * Manual reconnect button avoids waiting on EventSource's slow auto-retry
 * heuristic when reality has already moved on.
 */
.conn-state-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(224, 72, 72, 0.12);
  border-bottom: 1px solid rgba(224, 72, 72, 0.45);
  color: #e04848;
  padding: 8px 24px;
  font-size: 12px;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  letter-spacing: 0.2px;
}
.conn-state-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e04848;
  box-shadow: 0 0 8px rgba(224, 72, 72, 0.7);
  animation: conn-state-pulse 1.2s ease-in-out infinite;
  flex: 0 0 auto;
}
@keyframes conn-state-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
.conn-state-text {
  flex: 1 1 auto;
}
.conn-state-retry {
  background: rgba(224, 72, 72, 0.15);
  color: #e04848;
  border: 1px solid rgba(224, 72, 72, 0.4);
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  transition:
    background 120ms ease,
    color 120ms ease;
}
.conn-state-retry:hover {
  background: rgba(224, 72, 72, 0.3);
  color: #ffffff;
}

.empty {
  color: var(--ink-tertiary);
  padding: 40px 24px;
  font-size: 13px;
}
/* v3.5 console redo — sidebar header / new-session form / × close button */
.sessions-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px 0;
}
.sessions-header h2 {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.4px;
  color: var(--ink-subtle);
  text-transform: uppercase;
  padding: 0;
}
.icon-btn {
  background: var(--surface-2);
  color: var(--ink-muted);
  border: 1px solid var(--hairline);
  border-radius: var(--r-sm);
  width: 22px;
  height: 22px;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}
.icon-btn:hover {
  color: var(--ink);
  border-color: var(--primary);
}
#new-session-form {
  padding: 8px 16px 12px;
  border-bottom: 1px solid var(--hairline);
}
#new-session-goal {
  width: 100%;
  background: var(--canvas);
  color: var(--ink);
  border: 1px solid var(--hairline);
  border-radius: var(--r-sm);
  padding: 6px 8px;
  font-size: 12px;
  font-family: ui-monospace, monospace;
  outline: none;
  margin-bottom: 6px;
}
#new-session-goal:focus {
  border-color: var(--primary);
}
.new-session-row {
  display: flex;
  gap: 4px;
  align-items: center;
}
.adapter-pick-label {
  font-size: 10px;
  color: var(--ink-tertiary);
  letter-spacing: 0.4px;
  text-transform: uppercase;
  white-space: nowrap;
}
.new-session-row select {
  flex: 1;
  background: var(--canvas);
  color: var(--ink-muted);
  border: 1px solid var(--hairline);
  border-radius: var(--r-sm);
  padding: 4px 6px;
  font-size: 10px;
  font-family: ui-monospace, monospace;
}
.new-session-row button {
  background: var(--primary);
  color: var(--ink);
  border: none;
  border-radius: var(--r-sm);
  padding: 4px 10px;
  font-size: 10px;
  cursor: pointer;
}
.new-session-row button.muted {
  background: var(--surface-2);
  color: var(--ink-muted);
}

.session-row {
  position: relative;
}
.session-row .row-close {
  position: absolute;
  top: 6px;
  right: 8px;
  background: transparent;
  border: none;
  color: var(--ink-tertiary);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
  opacity: 0;
  transition: opacity 60ms ease;
}
.session-row:hover .row-close {
  opacity: 1;
}
.session-row .row-close:hover {
  color: var(--audit-fg);
  background: var(--surface-2);
}
/* PR-G7-B — resume button. Sits to the left of the close ×, only on resumable
 * sessions. Uses --primary so it reads as an action, not a destructive op. */
.session-row .row-resume {
  position: absolute;
  top: 6px;
  right: 30px;
  background: transparent;
  border: none;
  color: var(--primary);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
  opacity: 0;
  transition: opacity 60ms ease;
  font-weight: 600;
}
.session-row:hover .row-resume {
  opacity: 1;
}
.session-row .row-resume:hover {
  color: var(--ink);
  background: color-mix(in oklab, var(--primary) 30%, transparent);
}
.session-row .row-resume:disabled {
  cursor: wait;
  opacity: 0.5;
}
/* R5 — cancel button. Sits to the left of close × (and resume ↻ when both
 * apply, though they're mutually exclusive in practice — resume shows on
 * paused/done sessions, cancel only on live ones). Destructive op so uses
 * --audit-fg, distinguishing it from the --primary resume CTA. */
.session-row .row-cancel {
  position: absolute;
  top: 6px;
  right: 30px;
  background: transparent;
  border: none;
  color: var(--audit-fg);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
  opacity: 0;
  transition: opacity 60ms ease;
  font-weight: 600;
}
.session-row:hover .row-cancel {
  opacity: 1;
}
.session-row .row-cancel:hover {
  color: var(--ink);
  background: color-mix(in oklab, var(--audit-fg) 30%, transparent);
}
.session-row .row-cancel:disabled {
  cursor: wait;
  opacity: 0.5;
}

/* v3.5 — scorecard moved up; horizontal strip across the top of main */
.scorecard-bar {
  border-bottom: 1px solid var(--hairline);
  background: var(--surface-1);
  padding: 10px 16px;
}
/*
 * PR-K — Hybrid scorecard (Candidate S4 from frontier eval-UI survey):
 *   composite headline | 80×80 radar | 6 drill-down rows
 * Layout: CSS grid 3-column. Radar fixed width, composite ~140px,
 * rows take the remainder. Wraps to two rows on narrow viewports.
 */
.scorecard-strip {
  display: grid;
  grid-template-columns: 140px 92px 1fr;
  gap: 16px;
  align-items: stretch;
}
@media (max-width: 900px) {
  .scorecard-strip {
    grid-template-columns: 1fr 92px;
  }
  .scorecard-strip .sc-rows {
    grid-column: 1 / -1;
  }
}

/* ── PR-O4 P5 — score-trajectory sparklines (above composite + radar + rows)
 *
 * Six tiny line graphs (one per D1-D6) on a single row across the full
 * scorecard width. Renders only when ≥ 2 judge.score events exist for
 * the session — single-round sessions have no trajectory.
 *
 * grid-column: 1 / -1 spans all 3 columns of the scorecard-strip grid;
 * the existing composite/radar/rows children naturally land on row 2.
 *
 * Frontier ref (per wiki §4.P5): mirrors Honeycomb dataset overview +
 * Vercel observability strip (minimalist baseline). */
.sc-sparklines {
  grid-column: 1 / -1;
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 0 0 8px;
  border-bottom: 1px dashed var(--hairline);
  margin: 0 0 4px;
  flex-wrap: wrap;
}
.sc-sparkline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: help;
}
.sc-sparkline-key {
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 10px;
  color: var(--ink-subtle);
  letter-spacing: 0.3px;
  min-width: 16px;
}
.sc-spark {
  width: 60px;
  height: 16px;
  display: block;
}
.sc-spark-line {
  fill: none;
  stroke: var(--ink-tertiary);
  stroke-width: 1.2;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.sc-spark-dot {
  stroke: var(--canvas);
  stroke-width: 0.8;
}
.sc-spark-dot.spark-dot-pass    { fill: var(--lime); }
.sc-spark-dot.spark-dot-partial { fill: var(--warn); }
.sc-spark-dot.spark-dot-fail    { fill: var(--audit-fg); }
.sc-spark-dot.spark-dot-pending { fill: var(--ink-subtle); }

/* ── Composite headline ─────────────────────────────────────────────── */
.sc-composite {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  padding: 6px 12px 6px 0;
  border-right: 1px solid var(--hairline);
}
.sc-composite.sc-empty {
  color: var(--ink-tertiary);
}
.sc-headline {
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 22px;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: 0.4px;
  line-height: 1;
}
.sc-composite.sc-empty .sc-headline {
  color: var(--ink-tertiary);
}
.sc-verdict-pill {
  display: inline-block;
  align-self: flex-start;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 9.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid currentColor;
}
.sc-verdict-pass {
  color: var(--lime);
  background: color-mix(in oklab, var(--lime) 15%, transparent);
}
.sc-verdict-partial {
  color: #f59e0b;
  background: color-mix(in oklab, #f59e0b 15%, transparent);
}
.sc-verdict-fail,
.sc-verdict-reject {
  color: #dc2626;
  background: color-mix(in oklab, #dc2626 15%, transparent);
}
.sc-verdict-pending {
  color: var(--ink-tertiary);
  background: var(--surface-2);
  border-color: var(--hairline);
}
.sc-delta {
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.3px;
}
.sc-delta-up {
  color: var(--lime);
}
.sc-delta-down {
  color: #f59e0b;
}
.sc-delta-label {
  color: var(--ink-tertiary);
  margin-left: 2px;
}

/* ── Radar (CourtEval spider plot) ──────────────────────────────────── */
.sc-radar {
  display: flex;
  align-items: center;
  justify-content: center;
}
.sc-radar-svg {
  width: 80px;
  height: 80px;
}
.sc-radar-grid {
  fill: none;
  stroke: var(--hairline);
  stroke-width: 0.5;
  opacity: 0.6;
}
.sc-radar-axis {
  stroke: var(--hairline);
  stroke-width: 0.4;
  opacity: 0.5;
}
.sc-radar-axis-label {
  font-size: 7.5px;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  fill: var(--ink-tertiary);
  text-anchor: middle;
  letter-spacing: 0.2px;
}
.sc-radar-data {
  fill: color-mix(in oklab, var(--primary) 28%, transparent);
  stroke: var(--primary);
  stroke-width: 1.2;
  stroke-linejoin: round;
}

/* ── 6-row drilldown ────────────────────────────────────────────────── */
.sc-rows {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-self: center;
}
.sc-row {
  display: grid;
  grid-template-columns: 26px 88px 1fr 36px 38px auto;
  align-items: center;
  gap: 8px;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 10px;
  color: var(--ink);
  min-height: 18px;
}
.sc-row-empty .sc-row-bar-fill {
  background: var(--hairline);
}
.sc-row-key {
  font-weight: 600;
  color: var(--ink-muted);
  letter-spacing: 0.4px;
}
.sc-row-name {
  color: var(--ink-tertiary);
  font-size: 9.5px;
  letter-spacing: 0.2px;
}
.sc-row-bar {
  position: relative;
  height: 5px;
  background: var(--surface-2);
  border-radius: 3px;
  overflow: hidden;
}
.sc-row-bar-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: linear-gradient(
    90deg,
    var(--primary) 0%,
    color-mix(in oklab, var(--lime) 60%, var(--primary)) 100%
  );
  transition: width 220ms ease;
}
.sc-row-value {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
.sc-row-value-sanitized {
  text-decoration: line-through;
  text-decoration-color: var(--audit-fg);
  color: var(--ink-tertiary);
}
.sc-row-source {
  font-size: 8.5px;
  text-align: center;
  padding: 1px 5px;
  border-radius: 3px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: var(--ink-tertiary);
  background: var(--surface-2);
  border: 1px solid var(--hairline);
}
.sc-row-source.src-llm {
  color: var(--primary);
  border-color: color-mix(in oklab, var(--primary) 50%, var(--hairline));
}
.sc-row-source.src-qa {
  color: var(--lime);
  border-color: color-mix(in oklab, var(--lime) 50%, var(--hairline));
}
.sc-row-source.src-auto {
  color: #f59e0b;
  border-color: color-mix(in oklab, #f59e0b 50%, var(--hairline));
}
.sc-row-trail {
  font-size: 9px;
  color: var(--audit-fg);
  background: var(--audit-bg);
  border: 1px solid color-mix(in oklab, var(--audit-fg) 40%, var(--hairline));
  border-radius: 3px;
  padding: 1px 5px;
  letter-spacing: 0.2px;
  white-space: nowrap;
}

/* v3.5 — Output (artifact iframe) tab */
section.output {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.output-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 14px;
  border-bottom: 1px solid var(--hairline);
  background: var(--surface-1);
  font-size: 11px;
  color: var(--ink-subtle);
}
.output-toolbar select {
  flex: 1;
  background: var(--canvas);
  color: var(--ink);
  border: 1px solid var(--hairline);
  border-radius: var(--r-sm);
  padding: 4px 8px;
  font-family: ui-monospace, monospace;
  font-size: 11px;
}
.output-toolbar button {
  background: var(--surface-2);
  color: var(--ink-muted);
  border: 1px solid var(--hairline);
  border-radius: var(--r-sm);
  padding: 4px 10px;
  font-size: 10px;
  font-family: ui-monospace, monospace;
  cursor: pointer;
}
.output-toolbar button:hover {
  color: var(--ink);
  border-color: var(--primary);
}
.output-frame-wrap {
  flex: 1;
  min-height: 0;
  background: #000;
  position: relative;
}
.output-frame-wrap iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
}

/* v0.5 PR-Layout — 4-pane vertical: tabs+content / swimlane / narrative / feed.
 *
 *   ┌─────────────────────────────┐
 *   │ view-pane (absorber, flex:1) │  Pipeline | Logs | Output | Transcript
 *   ├─── splitter-view-swim ───────┤  4px row-resize
 *   │ swimlane (--swimlane-h)      │  event view
 *   ├─── splitter-swim-narr ───────┤
 *   │ narrative (--narrative-h)    │  agent narrative bubbles
 *   ├─── splitter-narr-feed ───────┤
 *   │ feed (--feed-h)              │  live execution feed
 *   └─────────────────────────────┘
 *
 * Drag splitter UP   → upper narrows  (industry standard, Linear/VSCode/Datadog)
 * Drag splitter DOWN → lower narrows
 *
 * Persistence: localStorage \`crumb.pane.{swimlane,narrative,feed}-h\` (px ints).
 */
.console-narrative {
  background: var(--canvas);
  display: flex;
  flex-direction: column;
  flex: 0 0 var(--narrative-h, 220px);
  min-height: 80px;
  max-height: 70vh;
  border-top: 1px solid var(--hairline);
}
.console-narrative-body {
  flex: 1;
  overflow-y: auto;
  padding: 6px 14px;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 11px;
  line-height: 1.55;
}
.resize-handle-pane {
  height: 4px;
  width: 100%;
  cursor: row-resize;
  background: transparent;
  flex: 0 0 auto;
  transition: background 120ms ease;
}
.resize-handle-pane:hover,
.resize-handle-pane.dragging {
  background: var(--primary, #4a90e2);
}
.console-feed {
  background: var(--canvas);
  display: flex;
  flex-direction: column;
  flex: 0 0 var(--feed-h, 180px);
  min-height: 80px;
  max-height: 70vh;
  border-top: 1px solid var(--hairline);
}
.console-feed-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 14px;
  border-bottom: 1px solid var(--hairline);
  background: var(--surface-1);
  font-size: 10px;
  color: var(--ink-subtle);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  flex-wrap: wrap;
}
.console-feed-title {
  color: var(--ink-muted);
  flex: 0 0 auto;
}
.console-feed-status {
  color: var(--ink-tertiary);
  flex: 1 1 80px;
  min-width: 0;
  font-family: ui-monospace, monospace;
  text-transform: none;
  letter-spacing: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.feed-grep-input {
  flex: 0 1 140px;
  min-width: 80px;
  background: var(--canvas);
  color: var(--ink);
  border: 1px solid var(--hairline);
  border-radius: var(--r-sm);
  padding: 2px 8px;
  font-family: ui-monospace, monospace;
  font-size: 10px;
  text-transform: none;
  letter-spacing: 0;
  outline: none;
  text-overflow: ellipsis;
}
.feed-grep-input:focus {
  border-color: var(--primary);
}
.ghost-btn {
  background: var(--surface-2);
  color: var(--ink-muted);
  border: 1px solid var(--hairline);
  border-radius: var(--r-sm);
  padding: 2px 8px;
  font-size: 9px;
  font-family: ui-monospace, monospace;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.ghost-btn:hover {
  color: var(--ink);
  border-color: var(--primary);
}
.ghost-btn.paused {
  color: var(--warn);
  border-color: var(--warn);
}
.console-feed-body {
  flex: 1;
  overflow-y: auto;
  padding: 6px 14px;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 11px;
  line-height: 1.5;
}
.feed-line {
  display: grid;
  grid-template-columns: 64px 110px 1fr;
  gap: 8px;
  padding: 1px 0;
  white-space: pre-wrap;
  word-break: break-word;
  position: relative;
}
/* PR-F D — repeat-collapse badge anchored to the top-right of the row.
 * Uses the existing accent token (--primary) with subdued opacity so it
 * reads as a passive counter, not an alert. Bumps to lime once the count
 * crosses 5 — emergent behavior that catches the user's eye when an
 * actor is genuinely stuck repeating itself. */
.feed-repeat-badge {
  position: absolute;
  top: 1px;
  right: 6px;
  font-size: 10px;
  line-height: 14px;
  padding: 0 6px;
  border-radius: 7px;
  background: color-mix(in oklab, var(--primary) 70%, transparent);
  color: var(--ink);
  font-variant-numeric: tabular-nums;
  pointer-events: none;
  user-select: none;
}
.feed-line[data-repeat-count='2'] .feed-repeat-badge,
.feed-line[data-repeat-count='3'] .feed-repeat-badge,
.feed-line[data-repeat-count='4'] .feed-repeat-badge {
  background: color-mix(in oklab, var(--primary) 70%, transparent);
}
.feed-line[data-repeat-count]:not([data-repeat-count='1']):not([data-repeat-count='2']):not(
    [data-repeat-count='3']
  ):not([data-repeat-count='4'])
  .feed-repeat-badge {
  background: color-mix(in oklab, var(--lime) 60%, transparent);
  color: var(--bg);
}
.feed-line .feed-ts {
  color: var(--ink-tertiary);
}
.feed-line .feed-actor {
  color: var(--ink-subtle);
}
.feed-line .feed-body {
  color: var(--ink-muted);
}
.feed-line.kind-error .feed-body,
.feed-line.kind-audit .feed-body {
  color: var(--audit-fg);
}
.feed-line.kind-spec .feed-body,
.feed-line.kind-build .feed-body,
.feed-line.kind-judge .feed-body {
  color: var(--lime);
}
.feed-line.kind-handoff .feed-body {
  color: var(--primary-hover);
}
.feed-line.kind-log .feed-body {
  color: var(--ink-muted);
  opacity: 0.85;
}
.feed-line.kind-log.stderr .feed-body {
  color: var(--audit-fg);
  opacity: 0.95;
}
.feed-line.kind-system .feed-body {
  color: var(--ink-tertiary);
  font-style: italic;
}

/* Claude-Code-style stream-json rendering above per-session chat input.
   Mirrors the ⏺ assistant text + ⎿ tool-result convention from \`claude\` CLI
   so the same narrative the user sees inside Claude Code is visible in the
   studio live execution feed. */
.feed-line.kind-assistant-text .feed-body {
  color: var(--ink, #e8e8e8);
  font-weight: 500;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}
.feed-line.kind-tool-call .feed-body {
  color: var(--accent-warm, #ffb627);
  opacity: 0.92;
  font-family: ui-monospace, monospace;
}
.feed-line.kind-tool-result .feed-body {
  color: var(--ink-muted, #a0a0a0);
  opacity: 0.78;
  padding-left: 16px;
  font-size: 10.5px;
}
.feed-line.kind-tool-error .feed-body {
  color: var(--audit-fg, #e04848);
  padding-left: 16px;
  font-size: 10.5px;
  font-weight: 500;
}
.feed-line.kind-turn-complete .feed-body {
  color: var(--accent-warm, #ffb627);
  font-weight: 600;
  letter-spacing: 0.2px;
}
.feed-line.kind-turn-complete {
  border-top: 1px dashed var(--hairline);
  margin-top: 4px;
  padding-top: 4px;
}
.feed-line.kind-thinking .feed-body {
  color: var(--ink-tertiary, #707070);
  opacity: 0.55;
  font-style: italic;
  font-size: 10px;
}

/* ───────────────────────────────────────────────────────────────────────── */
/* Adapter status sidebar (v3.5) — left rail, above sessions                */
/* ───────────────────────────────────────────────────────────────────────── */
.adapter-list {
  padding: 4px 0 8px;
}
.adapter-empty {
  padding: 6px 16px;
  font-size: 11px;
  color: var(--ink-tertiary);
  font-style: italic;
}
.adapter-row {
  display: grid;
  grid-template-columns: 12px 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 6px 16px 6px 14px;
  cursor: pointer;
  border-left: 2px solid transparent;
  transition:
    background 80ms ease,
    border-color 80ms ease;
}
.adapter-row:hover {
  background: var(--surface-1);
}
.adapter-row .adapter-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ink-tertiary);
  transition:
    background 200ms ease,
    box-shadow 200ms ease;
}
.adapter-row.active .adapter-dot {
  background: var(--lime);
  box-shadow: 0 0 6px var(--lime);
}
.adapter-row.maybe .adapter-dot {
  background: var(--warn);
}
.adapter-row.in-use {
  border-left-color: var(--lime);
  background: var(--surface-2);
}
.adapter-row .adapter-info {
  min-width: 0;
}
.adapter-row .adapter-name {
  font-size: 12px;
  color: var(--ink);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.adapter-row .adapter-meta {
  font-size: 10px;
  color: var(--ink-subtle);
  font-family: ui-monospace, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.adapter-row.inactive .adapter-name,
.adapter-row.inactive .adapter-meta {
  color: var(--ink-tertiary);
  opacity: 0.55;
}
.adapter-row.inactive {
  cursor: pointer;
}
.adapter-row.inactive:hover .adapter-name {
  color: var(--accent-warm, #ffb627);
  opacity: 0.85;
}
.adapter-row .adapter-pill {
  font-size: 9px;
  font-family: ui-monospace, monospace;
  padding: 1px 6px;
  border-radius: var(--r-pill);
  letter-spacing: 0.3px;
  text-transform: uppercase;
}
.adapter-row.active .adapter-pill {
  background: rgba(194, 239, 78, 0.14);
  color: var(--lime);
}
.adapter-row.maybe .adapter-pill {
  background: rgba(255, 178, 135, 0.16);
  color: var(--warn);
}
.adapter-row.inactive .adapter-pill {
  background: var(--surface-2);
  color: var(--ink-tertiary);
}

/* ───────────────────────────────────────────────────────────────────────── */
/* New session form — preset chips + per-actor binding chips               */
/* ───────────────────────────────────────────────────────────────────────── */
.preset-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 6px 0 4px;
}
.preset-chip {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: var(--r-pill);
  border: 1px solid var(--hairline);
  background: var(--surface-2);
  color: var(--ink-muted);
  cursor: pointer;
  font-family: ui-monospace, monospace;
  transition:
    border-color 80ms ease,
    background 80ms ease,
    color 80ms ease;
}
.preset-chip:hover {
  border-color: var(--primary);
  color: var(--ink);
}
.preset-chip.active {
  background: rgba(94, 106, 210, 0.18);
  border-color: var(--primary);
  color: var(--ink);
}
.preset-chip.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  /* No line-through — fade-out alone is the affordance, per UX feedback. */
}
.adv-binding {
  margin-top: 4px;
  font-size: 10px;
}
.adv-binding summary {
  cursor: pointer;
  color: var(--ink-tertiary);
  padding: 2px 0;
  user-select: none;
  letter-spacing: 0.2px;
}
.adv-binding summary:hover {
  color: var(--ink-subtle);
}
.bindings-grid {
  display: grid;
  grid-template-columns: 80px 1fr 1fr;
  gap: 4px 6px;
  margin: 6px 0 4px;
  align-items: center;
}
.bindings-grid .bg-actor {
  font-family: ui-monospace, monospace;
  font-size: 10px;
  color: var(--ink-subtle);
}
.bindings-grid select {
  font-size: 10px;
  padding: 2px 4px;
  background: var(--canvas);
  color: var(--ink);
  border: 1px solid var(--hairline);
  border-radius: var(--r-sm);
  font-family: ui-monospace, monospace;
}
.bindings-grid select:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* v0.4 Video research toggle (Gemini-only — hidden when neither gemini-sdk
   nor gemini-cli-local is available). Lives inside <details id="new-session-advanced">
   so collapses with the rest of the custom binding panel. */
.video-research {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed var(--hairline);
}
.video-research-toggle {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  cursor: pointer;
  font-size: 11px;
  color: var(--ink-muted);
  user-select: none;
}
.video-research-toggle input[type='checkbox'] {
  accent-color: var(--primary);
}
.video-research-refs {
  width: 100%;
  margin-top: 6px;
  background: var(--canvas);
  color: var(--ink);
  border: 1px solid var(--hairline);
  border-radius: var(--r-sm);
  padding: 4px 8px;
  font-family: ui-monospace, monospace;
  font-size: 10px;
  outline: none;
  resize: vertical;
}
.video-research-refs:focus {
  border-color: var(--primary);
}

/* ───────────────────────────────────────────────────────────────────────── */
/* Adapter setup modal — install / auth guide                              */
/* ───────────────────────────────────────────────────────────────────────── */
.adapter-modal {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}
.adapter-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(1, 1, 2, 0.7);
  backdrop-filter: blur(2px);
}
.adapter-modal-card {
  position: relative;
  background: var(--surface-1);
  border: 1px solid var(--hairline-strong);
  border-radius: var(--r-lg);
  padding: 24px 24px 18px;
  max-width: 480px;
  width: 90vw;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  font-size: 13px;
}
.adapter-modal-card h3 {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 12px;
  color: var(--ink);
}
.adapter-modal-card .adapter-modal-step {
  margin: 10px 0;
}
.adapter-modal-card .adapter-modal-step-label {
  font-size: 10px;
  color: var(--ink-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  margin-bottom: 4px;
}
.adapter-modal-card pre {
  background: var(--canvas);
  border: 1px solid var(--hairline);
  border-radius: var(--r-sm);
  padding: 8px 10px;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: var(--lime);
  white-space: pre-wrap;
  word-break: break-all;
}
.adapter-modal-row {
  display: flex;
  gap: 6px;
  margin-top: 14px;
  justify-content: flex-end;
}
.adapter-modal-row button {
  font-size: 11px;
  padding: 5px 12px;
  border-radius: var(--r-sm);
  border: 1px solid var(--hairline);
  background: var(--surface-2);
  color: var(--ink-muted);
  cursor: pointer;
  font-family: ui-monospace, monospace;
}
.adapter-modal-row button.primary {
  background: var(--primary);
  color: var(--canvas);
  border-color: var(--primary);
}
.adapter-modal-row button:hover {
  color: var(--ink);
  border-color: var(--primary);
}
.adapter-modal-close {
  position: absolute;
  top: 8px;
  right: 10px;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--ink-subtle);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}
.adapter-modal-close:hover {
  color: var(--ink);
}

    </style>
  </head>
  <body>
    <aside class="sessions" id="sessions-pane">
      <!--
    PR-Branding (F3 + bread character) — Crumb wordmark. Inline multi-color
    SVG: kawaii toast slice with a bite missing top-right, simple face, and
    orange crumbs scattering below-left (matches the brand mark mascot).
    Hard-coded warm cream / crust / crumb colors so the character reads on
    both light and dark themes; theme-driven recolor (var(--primary)) is not
    applied to the mark. Wordmark uses font-family "Crumb Brand" cascade.
  -->
      <div class="brand">
        <button
          id="sidebar-toggle"
          class="sidebar-toggle"
          aria-expanded="true"
          aria-label="Toggle sessions sidebar"
          title="Collapse sessions sidebar"
        >
          ☰
        </button>
        <svg class="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
          <!-- Toast slice silhouette with a rounded bite carved out of the
           upper-right crust. Single path so the brown crust outline detours
           naturally around the bite indent without overlapping artwork. -->
          <path
            d="M5.5 7.5
               Q5.5 3 12 3
               Q14.6 3 15.6 3.7
               Q15 5 16.4 5.5
               Q18.3 6 18.5 7.5
               L18.5 16
               Q18.5 18 16.5 18
               L7.5 18
               Q5.5 18 5.5 16
               Z"
            fill="#fde6c0"
            stroke="#cc7a3a"
            stroke-width="1.4"
            stroke-linejoin="round"
          />
          <!-- Inner crumb-texture face: a softer warm wash inside the crust line -->
          <path
            d="M7.5 7.5
               Q7.5 5 10 5
               L14 5
               Q16 5 16 7.5
               L16 14
               Q16 16 14 16
               L10 16
               Q7.5 16 7.5 14
               Z"
            fill="#fff1d4"
            opacity="0.7"
          />
          <!-- Eyes -->
          <ellipse cx="10" cy="10.6" rx="0.75" ry="1.1" fill="#2a1a08" />
          <ellipse cx="13" cy="10.6" rx="0.75" ry="1.1" fill="#2a1a08" />
          <!-- Smile -->
          <path
            d="M10.6 12.7 Q11.5 13.5 12.4 12.7"
            stroke="#2a1a08"
            stroke-width="0.6"
            stroke-linecap="round"
            fill="none"
          />
          <!-- Crumbs scattering below-left of the toast -->
          <circle cx="8" cy="20.4" r="0.95" fill="#e8a155" />
          <circle cx="6.4" cy="21.9" r="0.6" fill="#e8a155" />
          <circle cx="9.5" cy="22.2" r="0.5" fill="#e8a155" />
          <circle cx="7.7" cy="23.1" r="0.4" fill="#e8a155" />
        </svg>
        <span class="brand-text">CRUMB<span class="brand-suffix">STUDIO</span></span>
      </div>

      <div class="sessions-header">
        <h2>Adapters</h2>
        <button id="adapter-refresh" class="icon-btn" title="Re-probe installed adapters">↻</button>
      </div>
      <div id="adapter-list" class="adapter-list">
        <div class="adapter-empty">probing…</div>
      </div>

      <div class="sessions-header">
        <h2>Sessions</h2>
        <button id="new-session" class="icon-btn" title="Start a new crumb session">＋</button>
      </div>
      <div id="new-session-form" style="display: none">
        <input
          type="text"
          id="new-session-goal"
          placeholder="game goal (e.g. 60s 고양이 퍼즐)"
          autocomplete="off"
        />
        <div class="new-session-row">
          <label for="new-session-adapter" class="adapter-pick-label">Adapter</label>
          <select id="new-session-adapter" class="adapter-pick">
            <option value="">default — preset or ambient</option>
          </select>
        </div>
        <div id="new-session-preset-chips" class="preset-chips"></div>
        <details id="new-session-advanced" class="adv-binding">
          <summary>Custom binding (per-actor harness × model)</summary>
          <div id="new-session-bindings" class="bindings-grid"></div>
          <!--
        v0.4 Video research toggle — shown only when gemini-sdk OR gemini-cli-local
        is installed + auth not-false (probed via /api/doctor). When toggled on,
        the textarea below accepts YouTube URLs / sandboxed local paths, one per
        line. The /api/crumb/run body carries video_refs[] and the reducer's
        goal handler flips state.goal_has_video_refs so researcher routes to
        the gemini-sdk video path (10fps frame sampling, native YouTube URL).
        Hidden entirely when gemini is not available.
      -->
          <div id="new-session-video" class="video-research" style="display: none">
            <label class="video-research-toggle">
              <input type="checkbox" id="new-session-video-on" />
              <span>Video research (Gemini)</span>
            </label>
            <textarea
              id="new-session-video-refs"
              class="video-research-refs"
              rows="2"
              placeholder="YouTube URL or sandboxed local path · one per line"
              style="display: none"
            ></textarea>
          </div>
        </details>
        <div class="new-session-row">
          <button id="new-session-go">Run</button>
          <button id="new-session-cancel" class="muted">Cancel</button>
        </div>
        <div id="new-session-feedback" class="console-feedback"></div>
      </div>
      <div id="sess-list"></div>
    </aside>

    <!-- Install / auth guide modal — shown when user clicks an inactive adapter row -->
    <div
      id="adapter-modal"
      class="adapter-modal"
      style="display: none"
      role="dialog"
      aria-modal="true"
    >
      <div class="adapter-modal-backdrop"></div>
      <div class="adapter-modal-card">
        <button class="adapter-modal-close" id="adapter-modal-close" aria-label="Close">×</button>
        <h3 id="adapter-modal-title">Adapter setup</h3>
        <div id="adapter-modal-body"></div>
        <div class="adapter-modal-row">
          <button id="adapter-modal-refresh" class="primary">Re-check status</button>
          <button id="adapter-modal-dismiss" class="muted">Close</button>
        </div>
        <div id="adapter-modal-feedback" class="console-feedback"></div>
      </div>
    </div>
    <div
      class="resize-handle resize-handle-sessions"
      id="sessions-resize"
      title="Drag to resize sessions pane"
    ></div>

    <main>
      <!--
    v0.5 first-visit welcome banner — read-only observation invariant
    documented inline so the user understands the contract on day one.
    Dismissed via the × button; localStorage key \`crumb.studio.welcome.dismissed\`
    keeps it gone across reloads. Re-show by clearing the key in DevTools.
    Backed by ArtifactsBench / Karpathy autoresearch read-only studio
    convention (see PR #115 frontier survey).
  -->
      <div id="welcome-banner" class="welcome-banner" style="display: none">
        <div class="welcome-banner-body">
          <span class="welcome-banner-title">👋 Crumb Studio</span>
          <span class="welcome-banner-text"
            >Read-only observation surface. Sessions auto-detected at
            <code>~/.crumb/projects/</code>. Mutations route through transcript intervention only —
            <code>crumb pause</code> / <code>veto</code> / <code>approve</code> / <code>redo</code>,
            never via this studio.</span
          >
        </div>
        <button
          id="welcome-banner-close"
          class="welcome-banner-close"
          title="Dismiss (won't show again)"
          aria-label="Dismiss welcome banner"
        >
          ×
        </button>
      </div>

      <header class="summary">
        <!-- F4 (relocated): the sidebar toggle now lives next to the CRUMB STUDIO
         wordmark inside <aside.sessions> per the user spec — see studio.html
         line ~40. When the sidebar is collapsed, an alternate floating
         hamburger appears at the viewport's top-left so the user can re-open
         it. CSS handles the show/hide via \`body[data-sidebar-collapsed=1]\`. -->
        <button
          id="sidebar-toggle-floating"
          class="sidebar-toggle sidebar-toggle-floating"
          aria-expanded="false"
          aria-label="Open sessions sidebar"
          title="Open sessions sidebar"
          hidden
        >
          ☰
        </button>
        <div>
          <h1 id="header-title"><span class="pill muted">no session</span></h1>
          <div class="goal" id="header-goal">
            Pick a session on the left or hit ＋ to start a new crumb run.
          </div>
        </div>
        <dl class="metrics-row">
          <div>
            <dt>events</dt>
            <dd id="m-events">—</dd>
          </div>
          <div>
            <dt>tokens</dt>
            <dd id="m-tokens">—</dd>
          </div>
          <div>
            <dt>cache</dt>
            <dd id="m-cache">—</dd>
          </div>
          <div>
            <dt>cost</dt>
            <dd id="m-cost">—</dd>
          </div>
          <div>
            <dt>p95 lat</dt>
            <dd id="m-p95">—</dd>
          </div>
          <div>
            <dt>err / audit</dt>
            <dd id="m-err">—</dd>
          </div>
        </dl>
      </header>

      <div id="audit-banner"></div>

      <!--
    v0.5 PR-5 — connection-state pill. Shows when EventSource fires onerror
    (server restart / laptop sleep / wifi flap). Manual "Reconnect now" hard-
    reloads to re-establish the SSE stream + re-hydrate via /api/sessions.
    Hidden by default; revealed by setConnState('reconnecting') in studio.js.
  -->
      <div id="conn-state-pill" class="conn-state-pill" style="display: none">
        <span class="conn-state-dot"></span>
        <span class="conn-state-text">Reconnecting…</span>
        <button id="conn-state-retry" type="button" class="conn-state-retry">Reconnect now</button>
      </div>

      <section class="scorecard-bar" id="scorecard-bar">
        <div class="scorecard-strip" id="scorecard"></div>
      </section>

      <nav class="view-tabs" id="view-tabs">
        <button data-view="pipeline" class="active">Pipeline</button>
        <button data-view="waterfall">Waterfall</button>
        <button data-view="logs">Logs</button>
        <button data-view="output">Output</button>
        <button data-view="transcript">Transcript</button>
        <span style="flex: 1"></span>
        <button
          id="resume-btn"
          class="resume-btn"
          style="display: none"
          title="Re-spawn the last interrupted actor"
        >
          ▶ Resume
        </button>
        <!-- PR-Branding (F3) — theme toggle. Glyph swapped by JS to match
         current state (☀ when on dark = "switch to light", 🌙 when on
         light). Persists choice in localStorage 'crumb.theme'. -->
        <button
          id="theme-toggle"
          class="theme-toggle"
          type="button"
          title="Toggle light / dark theme"
        >
          🌙
        </button>
      </nav>

      <div class="view-pane active" id="view-pipeline">
        <section class="dag" id="dag-section">
          <div class="dag-header">
            <h2>Pipeline · v0.4.2</h2>
            <div class="dag-legend" id="dag-legend">
              <span class="lg lg-flow">flow</span>
              <span class="lg lg-respawn">respawn</span>
              <span class="lg lg-rollback">rollback</span>
              <span class="lg lg-terminal">PASS</span>
              <span class="lg lg-audit">audit</span>
              <span class="lg lg-intervene">intervene</span>
              <span class="lg lg-resume">resume</span>
              <span class="lg-shapes">
                <svg class="lg-shape-svg" viewBox="0 0 110 14">
                  <circle cx="7" cy="7" r="6" />
                  <text x="18" y="11">actor</text>
                  <polygon points="44,1 56,4 56,10 44,13 32,10 32,4" />
                  <text x="62" y="11">effect</text>
                  <rect x="84" y="2" width="22" height="10" rx="5" />
                  <text x="90" y="11">done</text>
                </svg>
              </span>
            </div>
          </div>
          <svg
            class="dag-svg"
            id="dag-svg"
            viewBox="0 0 1100 320"
            preserveAspectRatio="xMidYMid meet"
          ></svg>
        </section>
      </div>

      <!--
    v0.5 PR-O3 — Waterfall view. Wall-clock-proportional spans per actor,
    Datadog APM / Chrome DevTools Performance / Jaeger trace convention.
    Bars are click-through to the same right-rail detail panel as Pipeline.
    Hover → tooltip with kind / latency / tokens / cost. Empty in absence
    of agent.wake → agent.stop pairs (no spans yet to draw).
  -->
      <div class="view-pane" id="view-waterfall">
        <section class="waterfall" id="waterfall-section">
          <div class="waterfall-toolbar">
            <span class="waterfall-toolbar-label">Wall-clock waterfall</span>
            <span class="waterfall-toolbar-hint" id="waterfall-hint"
              >click any bar for detail · hover for tooltip</span
            >
            <span style="flex: 1"></span>
            <span class="waterfall-toolbar-axis" id="waterfall-axis">—</span>
          </div>
          <div class="waterfall-body" id="waterfall-body">
            <div class="empty" id="waterfall-empty">Waiting for spawn spans…</div>
          </div>
          <!--
        Tooltip is positioned absolutely; populated by JS on bar hover.
        pointer-events: none so it doesn't steal hover from the bar
        beneath it (Chrome DevTools Performance convention).
      -->
          <div id="waterfall-tooltip" class="waterfall-tooltip" style="display: none"></div>
        </section>
      </div>

      <div class="view-pane" id="view-logs">
        <section class="logs">
          <div class="logs-actor-list" id="logs-actor-list"></div>
          <div class="logs-pane">
            <div class="logs-toolbar">
              <span
                id="logs-current-actor"
                style="color: var(--ink); font-family: ui-monospace, monospace"
                >—</span
              >
              <!--
            v0.5 PR-6 — connection-status pill (idle / awaiting-actor /
            connecting / streaming / stalled / errored). Datadog/Honeycomb
            live-tail standard: every state has its own color + label, and
            stalled/errored expose a "Reconnect now" affordance directly.
            Populated by renderLogsConnStatus() in studio.js.
          -->
              <span id="logs-conn-status" class="logs-conn-status state-idle">
                <span class="logs-conn-dot"></span>
                <span class="logs-conn-label">pick session</span>
              </span>
              <input
                type="text"
                id="logs-filter"
                placeholder="grep…"
                title="substring · Enter=next · Shift+Enter=prev · Esc=clear"
              />
              <span class="grep-controls">
                <span id="logs-grep-count" class="grep-count">—</span>
                <button
                  id="logs-grep-prev"
                  class="grep-nav"
                  title="Previous match (Shift+Enter)"
                  disabled
                >
                  ↑
                </button>
                <button id="logs-grep-next" class="grep-nav" title="Next match (Enter)" disabled>
                  ↓
                </button>
              </span>
              <label><input type="checkbox" id="logs-follow" checked /> follow</label>
              <button id="logs-clear">clear</button>
              <button id="logs-copy">copy</button>
            </div>
            <div class="logs-content" id="logs-content">
              <div class="logs-empty">
                Pick an actor on the left to tail its spawn logs in real time.
              </div>
            </div>
            <!--
          v0.5 PR-6 — "Jump to live" button. Shown only when followAuto is
          off (user scrolled up in a streaming view). GitHub Actions / ArgoCD
          pattern — the floating affordance pulls them back to the tail
          without a full reload. Hidden by default; toggled by the scroll
          handler in studio.js.
        -->
            <button
              id="logs-jump-live"
              class="logs-jump-live"
              style="display: none"
              title="Resume following the live tail"
            >
              <span class="logs-jump-live-arrow">↓</span> Jump to live
            </button>
          </div>
        </section>
      </div>

      <div class="view-pane" id="view-output">
        <section class="output">
          <div class="output-toolbar">
            <span id="output-path-label">artifact:</span>
            <select id="output-path-select"></select>
            <button id="output-reload">reload</button>
            <button id="output-open">open in new tab ↗</button>
          </div>
          <div class="output-frame-wrap" id="output-frame-wrap">
            <div class="logs-empty" id="output-empty">
              No artifacts emitted yet for this session.
            </div>
            <iframe
              id="output-frame"
              sandbox="allow-scripts allow-pointer-lock allow-same-origin"
              style="display: none"
            ></iframe>
          </div>
        </section>
      </div>

      <div class="view-pane" id="view-transcript">
        <section class="transcript-view">
          <div class="transcript-toolbar">
            <span id="transcript-status">—</span>
            <input
              type="text"
              id="transcript-filter"
              placeholder="grep / filter…"
              title="match kind / from / body · Enter=next · Shift+Enter=prev · Esc=clear"
            />
            <span class="grep-controls">
              <span id="transcript-grep-count" class="grep-count">—</span>
              <button
                id="transcript-grep-prev"
                class="grep-nav"
                title="Previous match (Shift+Enter)"
                disabled
              >
                ↑
              </button>
              <button
                id="transcript-grep-next"
                class="grep-nav"
                title="Next match (Enter)"
                disabled
              >
                ↓
              </button>
            </span>
            <label><input type="checkbox" id="transcript-pretty" checked /> pretty</label>
            <button id="transcript-copy">copy all</button>
          </div>
          <pre id="transcript-content" class="transcript-content"></pre>
        </section>
      </div>

      <!--
    v0.5 PR-Layout — 4-pane vertical: tabs+content (absorber) | swimlane | narrative | feed
    splitter-view-swim writes --swimlane-h (drag down → swim shrinks, view-pane absorbs)
    splitter-swim-narr writes --swimlane-h + --narrative-h (2-var, total preserved)
    splitter-narr-feed writes --narrative-h + --feed-h (2-var, total preserved)
    Industry-standard splitter behavior: drag UP narrows upper, drag DOWN narrows lower.
  -->
      <div
        class="resize-handle resize-handle-pane"
        id="splitter-view-swim"
        title="Drag to resize event view (swimlane)"
      ></div>

      <section class="swimlane" id="swimlane">
        <div class="empty" id="swim-empty">Waiting for events…</div>
      </section>

      <div
        class="resize-handle resize-handle-pane"
        id="splitter-swim-narr"
        title="Drag to resize swimlane / narrative split"
      ></div>

      <section class="console-narrative" id="console-narrative-section">
        <div class="console-feed-toolbar">
          <span class="console-feed-title">Agent narrative</span>
          <span id="console-narrative-status" class="console-feed-status"
            >stream-json bubbles · ⏺ tool / ⎿ result / ✓ turn</span
          >
          <input
            type="text"
            id="console-narrative-grep"
            class="feed-grep-input"
            placeholder="grep…"
            autocomplete="off"
          />
          <span class="grep-controls">
            <span id="console-narrative-grep-count" class="grep-count">—</span>
            <button
              id="console-narrative-grep-prev"
              class="grep-nav"
              title="Previous match (Shift+Enter)"
              disabled
            >
              ↑
            </button>
            <button
              id="console-narrative-grep-next"
              class="grep-nav"
              title="Next match (Enter)"
              disabled
            >
              ↓
            </button>
          </span>
          <button id="console-narrative-pause" class="ghost-btn">pause</button>
          <button id="console-narrative-clear" class="ghost-btn">clear</button>
        </div>
        <div class="console-narrative-body" id="console-narrative-body"></div>
      </section>
      <div
        class="resize-handle resize-handle-pane"
        id="splitter-narr-feed"
        title="Drag to resize narrative / live-feed split"
      ></div>

      <section class="console-feed" id="console-feed-section">
        <div class="console-feed-toolbar">
          <span class="console-feed-title">Live execution feed</span>
          <span id="console-feed-status" class="console-feed-status">—</span>
          <input
            type="text"
            id="console-feed-grep"
            class="feed-grep-input"
            placeholder="grep…"
            autocomplete="off"
          />
          <span class="grep-controls">
            <span id="console-feed-grep-count" class="grep-count">—</span>
            <button
              id="console-feed-grep-prev"
              class="grep-nav"
              title="Previous match (Shift+Enter)"
              disabled
            >
              ↑
            </button>
            <button
              id="console-feed-grep-next"
              class="grep-nav"
              title="Next match (Enter)"
              disabled
            >
              ↓
            </button>
          </span>
          <button id="console-feed-pause" class="ghost-btn">pause</button>
          <button id="console-feed-clear" class="ghost-btn">clear</button>
        </div>
        <div class="console-feed-body" id="console-feed-body"></div>
      </section>

      <section class="console-input" id="console-section">
        <div class="console-row">
          <input
            type="text"
            id="console-line"
            placeholder='Type a slash command, @actor mention, plain text, or "/crumb <goal>" to start a new session'
            autocomplete="off"
            disabled
          />
          <button id="console-send" disabled>Send</button>
        </div>
        <div class="console-hints" id="console-hints"></div>
        <div class="console-feedback" id="console-feedback"></div>
      </section>
    </main>

    <aside class="detail" id="detail">
      <div
        class="resize-handle resize-handle-detail"
        id="detail-resize"
        title="Drag to resize detail pane"
      ></div>
      <!--
    v0.5 PR-9 — sticky header (close + paginators + title). User feedback:
    close button must NOT scroll out of reach. Header pinned at top:0
    inside the panel; .detail-body below scrolls independently.
  -->
      <div class="detail-header">
        <button class="close" id="detail-close" aria-label="Close detail">×</button>
        <div class="detail-title-row">
          <h3 id="detail-title">Event detail</h3>
          <span id="detail-group-badge" class="detail-group-badge" style="display: none"></span>
        </div>
        <div id="detail-pipeline-pos" class="detail-pipeline-pos"></div>
        <!-- PR-K' — cross-actor event paginator stays for single-event nav -->
        <div id="detail-event-nav" class="detail-event-nav" style="display: none"></div>
        <div id="detail-nav" class="detail-thread-nav">
          <button id="detail-prev" class="detail-nav-btn">↑ parent</button>
          <button id="detail-next" class="detail-nav-btn">↓ children</button>
        </div>
      </div>

      <!-- PR-K' single-event view — Datadog-style structured panel -->
      <div class="detail-body" id="detail-body-single">
        <div id="detail-tags" class="detail-tags"></div>
        <div id="detail-audit-banner" class="detail-audit-banner" style="display: none"></div>
        <h3>Timing &amp; cost</h3>
        <div id="detail-resource-bar" class="detail-resource-bar"></div>
        <pre id="detail-meta"></pre>
        <h3>
          Body
          <button class="detail-copy-btn" id="detail-copy-body" title="Copy">⧉</button>
        </h3>
        <pre id="detail-body"></pre>
        <h3>
          Data
          <button class="detail-copy-btn" id="detail-copy-data" title="Copy JSON">⧉</button>
        </h3>
        <pre id="detail-data"></pre>
        <h3>Conversation thread (parent → this → children)</h3>
        <div id="detail-thread" class="detail-thread"></div>
        <h3>Sandwich preview</h3>
        <div
          id="sandwich-actor-bar"
          style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px"
        ></div>
        <pre id="sandwich-content" style="display: none; max-height: 360px; overflow: auto"></pre>
        <h3>Send message to this actor</h3>
        <div style="display: flex; gap: 6px">
          <input
            type="text"
            id="detail-msg"
            placeholder="@actor or /command or text"
            style="
              flex: 1;
              background: var(--canvas);
              color: var(--ink);
              border: 1px solid var(--hairline);
              border-radius: var(--r-md);
              padding: 6px 10px;
              font-family: ui-monospace, monospace;
              font-size: 12px;
              outline: none;
            "
          />
          <button
            id="detail-msg-send"
            style="
              background: var(--primary);
              color: var(--ink);
              border: none;
              border-radius: var(--r-md);
              padding: 6px 12px;
              font-size: 11px;
              cursor: pointer;
            "
          >
            Send
          </button>
        </div>
        <div
          id="detail-msg-feedback"
          style="
            font-size: 10px;
            color: var(--ink-subtle);
            margin-top: 4px;
            font-family: ui-monospace, monospace;
            min-height: 12px;
          "
        ></div>
      </div>

      <!-- PR-K' multi-event spread view — horizontal cards, one per event in
       the grouped chip. Hidden until showDetail() opens a group. -->
      <div class="detail-body detail-body-spread" id="detail-body-spread" style="display: none">
        <div id="detail-spread-toolbar" class="detail-spread-toolbar"></div>
        <div id="detail-spread-cards" class="detail-spread-cards"></div>
      </div>
    </aside>

    <script>
      const ACTOR_LANE_ORDER = [
  'user',
  'coordinator',
  'planner-lead',
  'researcher',
  'builder',
  'verifier',
  'validator',
  'system',
];
const ACTOR_VAR = {
  user: '--actor-user',
  coordinator: '--actor-coordinator',
  'planner-lead': '--actor-planner-lead',
  researcher: '--actor-researcher',
  builder: '--actor-builder',
  verifier: '--actor-verifier',
  validator: '--actor-validator',
  system: '--actor-system',
};

const sessions = new Map();
let activeSession = null;
const eventCache = new Map(); // session_id → StudioMessage[]

function $(id) {
  return document.getElementById(id);
}
function escapeHTML(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
}
// IDE-style grep: escape \`text\` to HTML, then wrap each case-insensitive substring
// match of \`query\` with <mark class="grep-hit"> for orange-highlight + nav.
function highlightHTML(text, query) {
  const safe = escapeHTML(text);
  if (!query) return safe;
  const safeQuery = escapeHTML(query);
  if (!safeQuery) return safe;
  const re = new RegExp(escapeRegExp(safeQuery), 'gi');
  return safe.replace(re, (m) => '<mark class="grep-hit">' + m + '</mark>');
}

// Per-panel grep state. cursor is preserved across re-renders so streaming
// content doesn't reset the user's nav position.
const grepState = {
  logs: { query: '', cursor: 0 },
  transcript: { query: '', cursor: 0 },
  feed: { query: '', cursor: 0 },
  narrative: { query: '', cursor: 0 },
};

function refreshGrepNav(panelKey, rootEl, countEl, prevBtn, nextBtn, opts = {}) {
  const state = grepState[panelKey];
  const hits = rootEl ? Array.from(rootEl.querySelectorAll('mark.grep-hit')) : [];
  state.matches = hits;
  hits.forEach((h) => h.classList.remove('active'));
  const total = hits.length;
  if (countEl) {
    countEl.classList.toggle('has-hits', total > 0);
    countEl.classList.toggle('no-hits', !!state.query && total === 0);
    countEl.textContent = !state.query
      ? '—'
      : total === 0
        ? '0 / 0'
        : (state.cursor % total) + 1 + ' / ' + total;
  }
  if (prevBtn) prevBtn.disabled = total === 0;
  if (nextBtn) nextBtn.disabled = total === 0;
  if (total === 0) {
    state.cursor = 0;
    return;
  }
  if (state.cursor < 0 || state.cursor >= total) state.cursor = 0;
  hits[state.cursor].classList.add('active');
  if (opts.scroll) hits[state.cursor].scrollIntoView({ block: 'center', behavior: 'smooth' });
}
function gotoGrepMatch(panelKey, dir, countEl) {
  const state = grepState[panelKey];
  if (!state.matches || state.matches.length === 0) return;
  state.matches[state.cursor]?.classList.remove('active');
  state.cursor = (state.cursor + dir + state.matches.length) % state.matches.length;
  const el = state.matches[state.cursor];
  el.classList.add('active');
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (countEl) countEl.textContent = state.cursor + 1 + ' / ' + state.matches.length;
}
function bindGrepInput(inputEl, prevBtn, nextBtn, panelKey, onChange) {
  if (!inputEl) return;
  inputEl.addEventListener('input', () => {
    grepState[panelKey].query = inputEl.value.trim();
    grepState[panelKey].cursor = 0;
    onChange();
  });
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) prevBtn?.click();
      else nextBtn?.click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      inputEl.value = '';
      grepState[panelKey].query = '';
      grepState[panelKey].cursor = 0;
      onChange();
      inputEl.blur();
    }
  });
}
function formatTokens(n) {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n ?? 0);
}
function formatPct(r) {
  return Math.round((r ?? 0) * 100) + '%';
}
function formatCost(n) {
  return '$' + (n ?? 0).toFixed(3);
}

// PR-O4 P2 — set the \`title\` (native browser tooltip) on a metrics-row dd
// to a per-actor breakdown. \`pickWeight\` orders actors by descending
// contribution so the most-loaded one is on top. \`formatBucket\` controls
// the per-line text (defaults to \`pickWeight\` rounded). Skips silently
// when metrics or per_actor is missing — the dd already shows '—'.
function setPerActorTitle(id, m, pickWeight, formatBucket) {
  const el = $(id);
  if (!el) return;
  if (!m || !m.per_actor) {
    el.removeAttribute('title');
    return;
  }
  const fmt = formatBucket || ((b) => String(Math.round(pickWeight(b))));
  const lines = Object.entries(m.per_actor)
    .map(([actor, bucket]) => ({ actor, weight: pickWeight(bucket), bucket }))
    .filter((x) => x.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map((x) => x.actor + ': ' + fmt(x.bucket));
  if (lines.length === 0) el.removeAttribute('title');
  else el.setAttribute('title', lines.join('\\n'));
}

function ensureSession(id, hints) {
  let s = sessions.get(id);
  if (!s) {
    s = {
      id,
      project_id: hints?.project_id ?? '—',
      goal: hints?.goal ?? null,
      preset: hints?.preset ?? null,
      metrics: null,
      actors: hints?.actors ?? [],
      live: true,
    };
    sessions.set(id, s);
    eventCache.set(id, []);
  } else {
    if (hints?.project_id && (!s.project_id || s.project_id === '—'))
      s.project_id = hints.project_id;
    if (hints?.goal && !s.goal) s.goal = hints.goal;
    if (hints?.preset && !s.preset) s.preset = hints.preset;
    if (hints?.actors) s.actors = hints.actors;
  }
  return s;
}

function renderSessionList() {
  const list = $('sess-list');
  // Group sessions by project_id; within a group, newest first (reverse insertion order).
  const groups = new Map();
  for (const s of sessions.values()) {
    const pid = s.project_id || '—';
    if (!groups.has(pid)) groups.set(pid, []);
    groups.get(pid).push(s);
  }
  if (groups.size === 0) {
    list.innerHTML = '<div class="empty">No sessions yet.</div>';
    return;
  }
  const blocks = [...groups.entries()].map(([pid, arr]) => {
    const rows = arr
      .map((s) => {
        const cls = ['session-row'];
        if (s.live) cls.push('live');
        // v3.5 bootstrap classifier: live / idle / interrupted / abandoned / terminal
        if (s.state) cls.push('state-' + s.state);
        if (activeSession === s.id) cls.push('active');
        const cost = s.metrics ? formatCost(s.metrics.cost_usd) : '—';
        const verdict = s.metrics?.last_verdict;
        const status = verdict
          ? verdict === 'PASS'
            ? '✓'
            : verdict === 'PARTIAL'
              ? '~'
              : '✗'
          : s.metrics?.done
            ? '·'
            : '▶';
        const stateTitle = s.state
          ? \`state: \${s.state}\${s.done_reason ? ' (' + s.done_reason + ')' : ''}\`
          : '';
        // PR-G7-B — Resume button on paused / interrupted / budget-exhausted
        // sessions. Hidden when the session is live (no need) or terminal-pass.
        // \`done_reason\` heuristic: budget exhausted → forceable resume.
        const resumable =
          !s.live &&
          (s.state === 'paused' ||
            s.state === 'interrupted' ||
            s.state === 'idle' ||
            (s.done_reason &&
              /token_exhausted|wall_clock|builder_circuit_open/.test(s.done_reason)));
        const forceFlag =
          s.done_reason && /token_exhausted|wall_clock|builder_circuit_open/.test(s.done_reason);
        const resumeBtn = resumable
          ? '<button class="row-resume" data-resume="' +
            s.id +
            '"' +
            (forceFlag ? ' data-force="1"' : '') +
            ' title="re-enter coordinator loop (force=' +
            (forceFlag ? 'true' : 'false') +
            ')">↻</button>'
          : '';
        // R5 — Cancel button on live sessions. Posts \`/cancel\` to the session's
        // inbox.txt; coordinator's parser+reducer turn it into a \`cancel_spawn\`
        // effect that SIGTERMs the active subprocess (R2). Hidden when not
        // live — no point cancelling a session with no active spawn.
        const cancelBtn = s.live
          ? '<button class="row-cancel" data-cancel="' +
            s.id +
            '" title="cancel active spawn(s) — SIGTERM the running actor (lossy mid-edit)">⏹</button>'
          : '';
        return (
          '<div class="' +
          cls.join(' ') +
          '" data-id="' +
          s.id +
          '" title="' +
          escapeHTML(stateTitle) +
          '">' +
          '<button class="row-close" data-close="' +
          s.id +
          '" title="dismiss from sidebar (transcript preserved on disk)">×</button>' +
          resumeBtn +
          cancelBtn +
          '<div><span class="row-dot"></span><span class="row-id">' +
          escapeHTML(s.id.slice(0, 12)) +
          '…</span> <span style="color:var(--ink-tertiary);">' +
          status +
          '</span></div>' +
          '<div class="row-goal">' +
          escapeHTML(s.goal ?? '(no goal yet)') +
          '</div>' +
          '<div class="row-meta">' +
          cost +
          ' · ' +
          (s.metrics?.events ?? 0) +
          ' evt</div>' +
          '</div>'
        );
      })
      .join('');
    return (
      '<div class="project-group">' +
      '<h3 class="project-label" title="' +
      escapeHTML(pid) +
      '">' +
      escapeHTML(pid.slice(0, 12)) +
      '</h3>' +
      rows +
      '</div>'
    );
  });
  list.innerHTML = blocks.join('');
  list.querySelectorAll('.session-row').forEach((el) => {
    el.addEventListener('click', (e) => {
      // close + resume + cancel buttons have their own handlers — don't double-fire
      if (e.target?.closest?.('.row-close')) return;
      if (e.target?.closest?.('.row-resume')) return;
      if (e.target?.closest?.('.row-cancel')) return;
      selectSession(el.dataset.id);
    });
  });
  // PR-G7-B — Resume button click handler.
  list.querySelectorAll('.row-resume').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.resume;
      const force = btn.dataset.force === '1';
      btn.disabled = true;
      btn.textContent = '…';
      try {
        const res = await fetch('/api/sessions/' + encodeURIComponent(id) + '/resume', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ force }),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          // eslint-disable-next-line no-alert
          console.error('[studio] resume failed:', res.status, txt);
          btn.textContent = '!';
          setTimeout(() => {
            btn.disabled = false;
            btn.textContent = '↻';
          }, 3000);
          return;
        }
        // Optimistic UI: row will re-render on next watcher poll once status flips to running.
        btn.textContent = '✓';
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = '↻';
        }, 2000);
      } catch (err) {
        console.error('[studio] resume error:', err);
        btn.textContent = '!';
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = '↻';
        }, 3000);
      }
    });
  });
  // R5 — Cancel button click handler. Posts \`/cancel\` to the session's
  // inbox.txt via the existing /api/sessions/:id/inbox endpoint; the
  // coordinator's parser turns the line into kind=user.intervene with
  // data.cancel='all', and the reducer emits a cancel_spawn effect that
  // SIGTERMs the live subprocess (R2 wiring in src/dispatcher/live.ts).
  list.querySelectorAll('.row-cancel').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.cancel;
      btn.disabled = true;
      btn.textContent = '…';
      try {
        const res = await fetch('/api/sessions/' + encodeURIComponent(id) + '/inbox', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ line: '/cancel' }),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          console.error('[studio] cancel failed:', res.status, txt);
          btn.textContent = '!';
          setTimeout(() => {
            btn.disabled = false;
            btn.textContent = '⏹';
          }, 3000);
          return;
        }
        // Optimistic UI: row will re-render once the cancel_spawn effect's
        // kind=note hits the transcript and the watcher fans it out.
        btn.textContent = '✓';
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = '⏹';
        }, 2000);
      } catch (err) {
        console.error('[studio] cancel error:', err);
        btn.textContent = '!';
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = '⏹';
        }, 3000);
      }
    });
  });
  list.querySelectorAll('.row-close').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.close;
      try {
        await fetch('/api/sessions/' + encodeURIComponent(id) + '/close', { method: 'POST' });
      } catch {}
      sessions.delete(id);
      eventCache.delete(id);
      if (activeSession === id) {
        activeSession = null;
        renderHeader();
        renderSwimlane();
        renderScorecard();
      }
      renderSessionList();
    });
  });
}

// Q2: hooks pattern replaces 5-deep \`selectSession\` monkey-patch chain.
// External callers register via \`onSessionSelect(hook)\`; selectSession runs
// the canonical render set, then fans out to registered hooks. Stack traces
// stay shallow (was: _origSelectSession → _origSelectForLogs → _origSelectForFeed
// → _origSelectSessionFinal → _origSelectSessionForAdapter → selectSession,
// 6 levels deep). Order of registration determines order of invocation.
const sessionSelectHooks = [];
function onSessionSelect(hook) {
  sessionSelectHooks.push(hook);
}
function selectSession(id) {
  activeSession = id;
  renderSessionList();
  renderHeader();
  renderSwimlane();
  // v0.5 PR-7: cascade fade-in from LEFT (chronologically first events).
  // Add the marker class, then strip it after the animation lifetime so a
  // subsequent chip-append (chunk arrival) doesn't re-trigger the cascade.
  document.querySelectorAll('.lane-events').forEach((el) => {
    el.classList.add('session-switch-cascade');
  });
  setTimeout(() => {
    document.querySelectorAll('.lane-events').forEach((el) => {
      el.classList.remove('session-switch-cascade');
    });
  }, 400);
  renderScorecard();
  for (const hook of sessionSelectHooks) {
    try {
      hook(id);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[studio] sessionSelect hook failed:', err);
    }
  }
}

function renderHeader() {
  const s = activeSession ? sessions.get(activeSession) : null;
  if (!s) {
    $('header-title').innerHTML = '<span class="pill muted">no session</span>';
    $('header-goal').textContent = 'Pick a session on the left to track its progress in real time.';
    ['m-events', 'm-tokens', 'm-cache', 'm-cost', 'm-p95', 'm-err'].forEach(
      (k) => ($(k).textContent = '—'),
    );
    return;
  }
  const m = s.metrics;
  let pill = '<span class="pill muted">in progress</span>';
  if (m?.last_verdict === 'PASS')
    pill = '<span class="pill ok">PASS ' + (m.last_aggregate ?? 0).toFixed(1) + '</span>';
  else if (m?.last_verdict === 'PARTIAL')
    pill = '<span class="pill partial">PARTIAL ' + (m.last_aggregate ?? 0).toFixed(1) + '</span>';
  else if (m?.last_verdict === 'FAIL' || m?.last_verdict === 'REJECT')
    pill =
      '<span class="pill err">' +
      m.last_verdict +
      ' ' +
      (m.last_aggregate ?? 0).toFixed(1) +
      '</span>';
  $('header-title').innerHTML =
    pill +
    ' <span style="color:var(--ink-subtle); font-size:13px; font-family:ui-monospace,monospace;">' +
    escapeHTML(s.id) +
    '</span>';
  $('header-goal').textContent = s.goal ?? '(no goal recorded)';
  $('m-events').textContent = m ? m.events : '—';
  $('m-tokens').textContent = m
    ? formatTokens(m.tokens_in) + ' → ' + formatTokens(m.tokens_out)
    : '—';
  $('m-cache').textContent = m ? formatPct(m.cache_ratio) : '—';
  $('m-cost').textContent = m ? formatCost(m.cost_usd) : '—';
  $('m-p95').textContent = m ? Math.round(m.latency_p95_ms) + 'ms' : '—';
  $('m-err').textContent = m ? m.error_count + ' / ' + m.audit_count : '—';
  // PR-O4 P2 — per-actor breakdown on hover (native title attribute, no
  // tooltip dependency). Walks metrics.per_actor sorted by descending
  // contribution so the noisiest actor is at the top.
  setPerActorTitle('m-events', m, (b) => b.events);
  setPerActorTitle(
    'm-tokens',
    m,
    (b) => b.tokens_in + b.tokens_out,
    (b) => formatTokens(b.tokens_in) + '→' + formatTokens(b.tokens_out),
  );
  setPerActorTitle(
    'm-cache',
    m,
    (b) => b.cache_read,
    (b) => formatTokens(b.cache_read) + ' cache_read',
  );
  setPerActorTitle('m-cost', m, (b) => b.cost_usd, (b) => formatCost(b.cost_usd));
  setPerActorTitle(
    'm-p95',
    m,
    (b) => b.latency_ms_total / Math.max(1, b.events),
    (b) => Math.round(b.latency_ms_total / Math.max(1, b.events)) + 'ms avg',
  );
  const banner = $('audit-banner');
  if (m && m.audit_count > 0) {
    banner.textContent =
      '★ ' +
      m.audit_count +
      ' anti-deception audit event' +
      (m.audit_count === 1 ? '' : 's') +
      ' fired in this session.';
    banner.classList.add('show');
  } else banner.classList.remove('show');
}

/**
 * Swimlane render — left-to-right chronological per actor lane.
 *
 * v0.5 PR-7: consecutive same-kind events are collapsed into ONE chip with
 * a count badge (top-right superscript, message-app convention). Clicking
 * any chip opens the detail panel; if the chip is a group, the detail
 * panel exposes a paginator (← N/M →, plus ←/→ keyboard) so the user can
 * page through every grouped event without losing context.
 *
 * Frontier convergence (Slack unread badge / WhatsApp message bubble /
 * VS Code Problems panel collapsed-duplicate / Datadog log facet count):
 * count badge is offset to top-right corner with a subtle accent so it
 * doesn't compete with the chip's primary kind label.
 */
/**
 * v0.5 PR-O3 — Wall-clock waterfall renderer.
 *
 * Frontier convention (Datadog APM trace / Chrome DevTools Performance /
 * Jaeger / Honeycomb): each spawn becomes a horizontal bar whose width is
 * proportional to wall-clock duration. Same actor lane order as the
 * swimlane so the user can mentally map between Pipeline ↔ Waterfall.
 *
 * Span derivation (from existing transcript only — no new schema):
 *   parent: agent.wake (start) → agent.stop (end), latency_ms in metadata
 *   children: step.* events between the parent's wake/stop, treated as
 *             instantaneous markers (zero-width tick) since transcript
 *             carries no per-step duration field today
 *
 * Click → opens the existing right-rail detail panel via showDetail()
 *   (same paginator, same sandwich preview, same send-message form).
 * Hover → tooltip with kind, duration, tokens, cost.
 *
 * Empty when no agent.wake/agent.stop pair exists yet.
 */
function renderWaterfall() {
  const root = $('waterfall-body');
  const empty = $('waterfall-empty');
  const tooltip = $('waterfall-tooltip');
  if (!root) return;
  if (tooltip) tooltip.style.display = 'none';
  if (!activeSession) {
    root.innerHTML = '<div class="empty">Pick a session.</div>';
    return;
  }
  const events = eventCache.get(activeSession) ?? [];
  const spans = buildWaterfallSpans(events);
  if (spans.length === 0) {
    root.innerHTML =
      '<div class="empty" id="waterfall-empty">Waiting for agent.wake → agent.stop pairs…</div>';
    $('waterfall-axis').textContent = '—';
    return;
  }
  // Wall-clock window — first wake to max(now, last stop). Pinning end
  // to "now" means in-flight spans visibly grow as transcript appends,
  // which is the live-tail experience users expect from Datadog APM.
  const t0 = spans[0].startTs;
  const tMaxFromSpans = spans.reduce((m, s) => Math.max(m, s.endTs ?? s.startTs), t0);
  const tMax = Math.max(tMaxFromSpans, Date.now());
  const totalMs = Math.max(1, tMax - t0);

  // Group spans by actor lane so each row reads naturally.
  const byActor = new Map();
  for (const sp of spans) {
    if (!byActor.has(sp.actor)) byActor.set(sp.actor, []);
    byActor.get(sp.actor).push(sp);
  }

  const lanes = [...byActor.entries()].map(([actor, list]) => {
    const bars = list
      .map((sp) => {
        const left = ((sp.startTs - t0) / totalMs) * 100;
        const width = Math.max(0.4, ((sp.endTs - sp.startTs) / totalMs) * 100);
        const cls = ['waterfall-bar'];
        if (sp.errored) cls.push('errored');
        if (sp.audit) cls.push('audit');
        if (!sp.endTsKnown) cls.push('in-flight');
        return (
          '<div class="' +
          cls.join(' ') +
          '" data-id="' +
          escapeHTML(sp.wakeId) +
          '" data-stop-id="' +
          escapeHTML(sp.stopId ?? '') +
          '" data-tooltip="' +
          escapeHTML(sp.tooltipText) +
          '" style="left:' +
          left.toFixed(2) +
          '%;width:' +
          width.toFixed(2) +
          '%;">' +
          '<span class="waterfall-bar-label">' +
          escapeHTML(sp.label) +
          '</span>' +
          '</div>'
        );
      })
      .join('');
    // Step markers (instant ticks, zero-width). Sit on top of the bar row
    // so the user can correlate sub-step boundaries against the parent.
    const ticks = list
      .flatMap((sp) =>
        (sp.stepMarkers ?? []).map((tick) => {
          const left = ((tick.ts - t0) / totalMs) * 100;
          return (
            '<div class="waterfall-tick" data-id="' +
            escapeHTML(tick.id) +
            '" data-tooltip="' +
            escapeHTML(tick.kind + ' · ' + tick.actor) +
            '" style="left:' +
            left.toFixed(2) +
            '%;"></div>'
          );
        }),
      )
      .join('');
    return (
      '<div class="waterfall-lane">' +
      '<div class="waterfall-lane-label"><span class="glyph" style="background:var(' +
      ACTOR_VAR[actor] +
      ');"></span>' +
      escapeHTML(actor) +
      '</div>' +
      '<div class="waterfall-lane-track">' +
      bars +
      ticks +
      '</div>' +
      '</div>'
    );
  });

  root.innerHTML = lanes.join('');
  $('waterfall-axis').textContent =
    formatWallClock(0) +
    ' → ' +
    formatWallClock(totalMs) +
    '  (total ' +
    formatWallClock(totalMs) +
    ')';

  // Bar click → existing detail panel. Tick click → same.
  root.querySelectorAll('.waterfall-bar, .waterfall-tick').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      if (id) showDetail(id, null);
    });
    // Tooltip on hover — Chrome DevTools Performance pattern, positioned
    // relative to the waterfall section so it never overlaps the bar.
    el.addEventListener('mouseenter', (e) => {
      if (!tooltip) return;
      tooltip.textContent = el.dataset.tooltip ?? '';
      tooltip.style.display = 'block';
      const rect = el.getBoundingClientRect();
      const sectRect = $('waterfall-section').getBoundingClientRect();
      tooltip.style.left = rect.left - sectRect.left + 'px';
      tooltip.style.top = rect.bottom - sectRect.top + 4 + 'px';
    });
    el.addEventListener('mouseleave', () => {
      if (tooltip) tooltip.style.display = 'none';
    });
  });
}

function buildWaterfallSpans(events) {
  // Pair agent.wake with the next agent.stop on the same actor.
  const openByActor = new Map();
  const spans = [];
  for (const e of events) {
    if (e.kind === 'agent.wake' && e.from) {
      // Close any prior open span on this actor (orphan); becomes in-flight.
      openByActor.set(e.from, {
        actor: e.from,
        wakeId: e.id,
        startTs: Date.parse(e.ts),
        stepMarkers: [],
      });
    } else if (e.kind === 'agent.stop' && e.from) {
      const open = openByActor.get(e.from);
      if (open) {
        const md = e.metadata ?? {};
        const dur = typeof md.latency_ms === 'number' ? md.latency_ms : null;
        const endTs = dur != null ? open.startTs + dur : Date.parse(e.ts);
        const tokens =
          typeof md.tokens_in === 'number' || typeof md.tokens_out === 'number'
            ? \`\${formatTokens(md.tokens_in ?? 0)} → \${formatTokens(md.tokens_out ?? 0)}\`
            : null;
        const cost = typeof md.cost_usd === 'number' ? formatCost(md.cost_usd) : null;
        const tooltipParts = [
          open.actor,
          formatWallClock(endTs - open.startTs),
          tokens,
          cost,
        ].filter(Boolean);
        spans.push({
          actor: open.actor,
          wakeId: open.wakeId,
          stopId: e.id,
          startTs: open.startTs,
          endTs,
          endTsKnown: true,
          label: open.actor,
          tooltipText: tooltipParts.join(' · '),
          errored:
            typeof e.body === 'string' && /error|exit=\\d+/i.test(e.body) && !/exit=0/.test(e.body),
          audit: false,
          stepMarkers: open.stepMarkers,
        });
        openByActor.delete(open.actor);
      }
    } else if (typeof e.kind === 'string' && e.kind.startsWith('step.') && e.from) {
      // Attach as a tick to the open parent on this actor (if any).
      const open = openByActor.get(e.from);
      if (open) {
        open.stepMarkers.push({ id: e.id, ts: Date.parse(e.ts), kind: e.kind, actor: e.from });
      }
    } else if (e.kind === 'audit' && e.from) {
      // Mark the open parent as audited so the bar gets the audit color.
      const open = openByActor.get(e.from);
      if (open) open.audited = true;
    }
  }
  // Still-open spans → in-flight (right edge clamps to "now" at render time).
  for (const open of openByActor.values()) {
    spans.push({
      actor: open.actor,
      wakeId: open.wakeId,
      stopId: null,
      startTs: open.startTs,
      endTs: Date.now(),
      endTsKnown: false,
      label: open.actor + ' · running',
      tooltipText: open.actor + ' · running · ' + formatWallClock(Date.now() - open.startTs),
      errored: false,
      audit: !!open.audited,
      stepMarkers: open.stepMarkers,
    });
  }
  spans.sort((a, b) => a.startTs - b.startTs);
  return spans;
}

function formatWallClock(ms) {
  if (ms < 1000) return Math.max(0, Math.round(ms)) + 'ms';
  const s = ms / 1000;
  if (s < 60) return s.toFixed(1) + 's';
  const m = s / 60;
  if (m < 60) return Math.floor(m) + 'm ' + Math.round(s - Math.floor(m) * 60) + 's';
  const h = m / 60;
  return Math.floor(h) + 'h ' + Math.round(m - Math.floor(h) * 60) + 'm';
}

function renderSwimlane() {
  const root = $('swimlane');
  if (!activeSession) {
    root.innerHTML = '<div class="empty" id="swim-empty">Pick a session.</div>';
    return;
  }
  const events = eventCache.get(activeSession) ?? [];
  if (events.length === 0) {
    root.innerHTML = '<div class="empty">Waiting for events…</div>';
    return;
  }
  const lanes = ACTOR_LANE_ORDER.map((actor) => {
    const evts = events.filter((e) => e.from === actor);
    const groups = groupConsecutiveByKind(evts);
    const lastIdx = groups.length - 1;
    const cursor = getReadCursor(activeSession, actor);
    const cells = groups.map((g, i) => renderEvtCell(g, i === lastIdx, cursor)).join('');
    return (
      '<div class="lane">' +
      '<div class="lane-label"><span class="glyph" style="background:var(' +
      ACTOR_VAR[actor] +
      ');"></span>' +
      actor +
      '</div>' +
      '<div class="lane-events">' +
      (cells || '<span style="color:var(--ink-tertiary); font-size:11px;">—</span>') +
      '</div>' +
      '</div>'
    );
  });
  root.innerHTML = lanes.join('');
  root.querySelectorAll('.evt').forEach((el) => {
    el.addEventListener('click', () => {
      // PR-K' (option α): click semantics widened — any chip click now
      // shows ALL events of that kind across the session, not just the
      // consecutive group the chip represents. Frontier rationale: users
      // expect "click on agent.wake" → "see all agent.wake", same as
      // Datadog log-row "filter by service" or Sentry trace-span "filter
      // by op". The chip's count badge still shows the consecutive run
      // for visual rhythm (PR-7 intent), but click expands to kind-wide.
      const consecutiveIds = (el.dataset.groupIds ?? '').split(',').filter(Boolean);
      const startId = consecutiveIds[0] ?? el.dataset.id;
      const actor = el.dataset.actor;
      const sessionEvts = eventCache.get(activeSession) ?? [];
      const startEvt = sessionEvts.find((e) => e.id === startId);
      const kind = startEvt?.kind;
      // Kind-wide group: all events with same kind in this session,
      // chronologically ordered (transcript is already ULID-sorted).
      const kindIds = kind
        ? sessionEvts.filter((e) => e.kind === kind).map((e) => e.id)
        : [startId];
      // Slack-style mark-as-read: cursor advances to LATEST id in the
      // *consecutive* run (per-actor lane semantics), not the kind-wide
      // spread — otherwise clicking an actor's agent.wake chip would
      // also clear another actor's agent.wake unread badge, which would
      // confuse the per-lane reading mental model.
      const latestId = consecutiveIds[consecutiveIds.length - 1] ?? el.dataset.id;
      markRead(activeSession, actor, latestId);
      renderSwimlane();
      showDetail(startId, kindIds.length > 1 ? kindIds : null);
    });
  });
}

/**
 * v0.5 PR-8 — unread state, persisted in localStorage.
 *
 * Why localStorage and not a server DB:
 *   - Crumb Studio is a single-user, single-device read-only observation
 *     surface. Cross-device sync is not in scope (no auth, no backend
 *     identity). Slack / GitHub put unread cursors server-side because
 *     they're multi-device + team-shared; we have neither requirement.
 *   - localStorage gives us atomic per-(session, lane) cursors with zero
 *     network hops, zero schema migration, zero server-side write
 *     amplification. If multi-device later matters, the server can
 *     mirror these into ~/.crumb/projects/<id>/.studio-read.json behind
 *     a thin endpoint — same key shape, no client refactor.
 *
 * Cursor: per (sessionId, actor) we store the ULID of the latest event
 * the user has acknowledged (clicked-through). Unread count for a chip
 * group = events.filter(e => e.id > cursor && belongs to group).length.
 *
 * ULID is monotonic-string-sortable, so \`>\` comparison is correct
 * chronology — no timestamp parsing.
 */
const READ_CURSOR_KEY = 'crumb.studio.readCursor.v1';

function loadReadCursors() {
  try {
    const raw = localStorage.getItem(READ_CURSOR_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveReadCursors(cursors) {
  try {
    localStorage.setItem(READ_CURSOR_KEY, JSON.stringify(cursors));
  } catch {
    // localStorage full or disabled — graceful no-op
  }
}

let readCursors = loadReadCursors();

function getReadCursor(sessionId, actor) {
  return readCursors[sessionId]?.[actor] ?? '';
}

function markRead(sessionId, actor, lastEventId) {
  if (!sessionId || !actor || !lastEventId) return;
  if (!readCursors[sessionId]) readCursors[sessionId] = {};
  // Only advance the cursor — never rewind. Prevents an out-of-order
  // click on an older chip from re-marking newer events as unread.
  const prev = readCursors[sessionId][actor] ?? '';
  if (lastEventId > prev) {
    readCursors[sessionId][actor] = lastEventId;
    saveReadCursors(readCursors);
  }
}

/**
 * Collapse runs of consecutive events that share \`from + kind\` into a
 * single group descriptor. Non-consecutive same-kind events stay separate
 * — preserves chronology + the visual rhythm of "actor X did A, then B,
 * then more A".
 */
function groupConsecutiveByKind(evts) {
  const groups = [];
  for (const e of evts) {
    const prev = groups[groups.length - 1];
    if (prev && prev.kind === e.kind) {
      prev.ids.push(e.id);
      prev.evts.push(e);
      if (e.metadata?.deterministic) prev.deterministic = true;
      if (e.kind === 'audit' || (e.metadata?.audit_violations?.length ?? 0) > 0) {
        prev.audit = true;
      }
    } else {
      groups.push({
        kind: e.kind,
        ids: [e.id],
        evts: [e],
        deterministic: !!e.metadata?.deterministic,
        audit: e.kind === 'audit' || (e.metadata?.audit_violations?.length ?? 0) > 0,
      });
    }
  }
  return groups;
}

function renderEvtCell(group, isLast, cursor) {
  const cls = ['evt'];
  if (group.deterministic) cls.push('deterministic');
  if (group.audit) cls.push('audit');
  if (isLast) cls.push('fresh');
  const count = group.ids.length;
  if (count > 1) cls.push('grouped');
  const idsAttr = group.ids.join(',');
  const firstId = group.ids[0];
  // v0.5 PR-8: badge shows UNREAD count, not total. ULID \`>\` is
  // chronological, so any id strictly greater than the cursor is unread.
  // Single-event chips (count === 1) also get a "1" badge when unread,
  // matching iMessage/Slack behaviour where a single new message also
  // gets a dot/number — the user opened the lane after that message
  // arrived and we want to acknowledge they haven't seen it yet.
  const unreadCount = cursor ? group.ids.filter((id) => id > cursor).length : group.ids.length;
  const owner = group.evts[0]?.from ?? '';
  const titleAttr =
    count > 1
      ? \`\${group.kind} × \${count}\` +
        (unreadCount > 0 ? \` (\${unreadCount} unread, click to page through)\` : ' (all read)')
      : group.kind + (unreadCount > 0 ? ' (unread)' : '');
  return (
    '<span class="' +
    cls.join(' ') +
    '" data-id="' +
    escapeHTML(firstId) +
    '" data-group-ids="' +
    escapeHTML(idsAttr) +
    '" data-actor="' +
    escapeHTML(owner) +
    '" title="' +
    escapeHTML(titleAttr) +
    '">' +
    escapeHTML(group.kind) +
    (unreadCount > 0
      ? '<span class="evt-count" aria-label="' + unreadCount + ' unread">' + unreadCount + '</span>'
      : '') +
    '</span>'
  );
}

/**
 * PR-K — Scorecard hybrid (Candidate S4 from frontier eval-UI survey).
 * Three coordinated views in one bar:
 *   1. composite headline  — single number / 30 + verdict pill + delta vs prev
 *   2. radar (60×60 SVG)   — 6-axis spider plot, CourtEval paper convention
 *   3. drilldown rows      — per-dim bar + source badge + sanitize trail
 *                            (~~5.0~~→4.25 self_bias_discounted)
 *
 * Sources of truth (from src/protocol/types.ts Scores + src/validator/anti-deception.ts):
 *   - lastJudge.scores.D1..D6.score  → numeric value
 *   - lastJudge.scores.D1..D6.source → 'verifier-llm' / 'qa-check-effect' / 'reducer-auto'
 *   - lastJudge.scores.audit_violations[] → sanitize trail context
 *   - lastJudge.data.audit_violations    → reducer's separate from='validator' record
 *
 * Sanitize trail derivation: when audit_violations contains
 *   - 'verify_pass_without_exec_zero'  → D2 was forced to 0
 *   - 'verifier_overrode_d2_ground_truth' → D2 was forced to qa.result
 *   - 'self_bias_score_discounted'        → D1, D3, D5 were × 0.85
 *   - 'researcher_video_evidence_missing' → D5 was forced to 0
 *   - 'verify_pass_with_ac_failure'       → D1 capped at 2
 * The original (pre-sanitize) value is not in the transcript today, so we
 * compute the *expected* original from the rule + show it as a strikethrough
 * (best-effort visualization; if reducer ever stamps \`pre_sanitize\` per-dim
 * we'll switch to that).
 */
const DIM_NAMES = {
  D1: 'spec_fit',
  D2: 'exec',
  D3: 'schema',
  D4: 'reflection',
  D5: 'quality',
  D6: 'portability',
};
const SOURCE_BADGE = {
  'verifier-llm': { label: 'LLM', cls: 'src-llm' },
  'qa-check-effect': { label: 'QA', cls: 'src-qa' },
  'reducer-auto': { label: 'AUTO', cls: 'src-auto' },
};

function renderScorecard() {
  const root = $('scorecard');
  const events = activeSession ? (eventCache.get(activeSession) ?? []) : [];
  const judges = events.filter((e) => e.kind === 'judge.score' || e.kind === 'verify.result');
  const lastJudge = judges[judges.length - 1];
  const prevJudge = judges[judges.length - 2];
  const dims = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'];

  if (!lastJudge?.scores) {
    root.innerHTML = renderEmpty(dims);
    return;
  }

  // Build structured per-dim records (score + source + violation flags).
  const violations = lastJudge.scores?.audit_violations ?? lastJudge.data?.audit_violations ?? [];
  const dimRecords = dims.map((d) => {
    const dim = lastJudge.scores[d];
    return {
      key: d,
      name: DIM_NAMES[d],
      score: typeof dim?.score === 'number' ? dim.score : null,
      source: dim?.source ?? null,
      sanitized: deriveSanitizeNote(d, violations),
    };
  });

  // Composite + delta + verdict
  const aggregate = lastJudge.scores?.aggregate ?? sumDims(dimRecords);
  const verdict = lastJudge.scores?.verdict ?? null;
  const prevAgg = prevJudge?.scores?.aggregate ?? null;
  const delta = prevAgg != null ? aggregate - prevAgg : null;

  root.innerHTML =
    renderScoreSparklines(judges, dims) +
    '<div class="sc-composite">' +
    renderComposite(aggregate, verdict, delta) +
    '</div>' +
    '<div class="sc-radar">' +
    renderRadar(dimRecords) +
    '</div>' +
    '<div class="sc-rows">' +
    dimRecords.map(renderDimRow).join('') +
    '</div>';
}

// PR-O4 P5 — score-trajectory sparklines.
// Six tiny line graphs (one per D1-D6) showing the dim's score history
// across all judge.score events in this session, plus a verdict-colored
// dot at the latest round so PASS/PARTIAL/FAIL is at-a-glance.
//
// Skipped when there are < 2 rounds (no trajectory yet — the existing
// scorecard already shows the lone snapshot via the radar + rows).
//
// Frontier ref (per wiki §4.P5): six tiny sparklines mirror Honeycomb
// dataset overview + Vercel observability strip; minimalist baseline
// follows Karpathy autoresearch.
function renderScoreSparklines(judges, dims) {
  if (!judges || judges.length < 2) return '';
  const W = 60;
  const H = 16;
  const PAD = 2;
  const histories = dims.map((d) => {
    const series = judges
      .map((j) => {
        const v = j.scores?.[d];
        return typeof v?.score === 'number' ? v.score : null;
      })
      .filter((s) => s !== null);
    return { dim: d, series };
  });
  // Per-dim normalised polyline. y inverts (SVG origin top-left, score
  // is "higher = better"). Ranges fixed 0..5 so cross-dim comparison
  // is meaningful (D2 at 5 + D5 at 2 reads correctly side-by-side).
  const max = 5;
  const verdictAtLast = judges[judges.length - 1]?.scores?.verdict ?? null;
  const dotClass =
    verdictAtLast === 'PASS' ? 'spark-dot-pass'
    : verdictAtLast === 'PARTIAL' ? 'spark-dot-partial'
    : verdictAtLast === 'FAIL' || verdictAtLast === 'REJECT' ? 'spark-dot-fail'
    : 'spark-dot-pending';
  const sparkSvg = (h) => {
    if (h.series.length < 2) return '';
    const stepX = (W - 2 * PAD) / Math.max(1, h.series.length - 1);
    const points = h.series
      .map((s, i) => {
        const x = PAD + i * stepX;
        const y = H - PAD - (s / max) * (H - 2 * PAD);
        return x.toFixed(1) + ',' + y.toFixed(1);
      })
      .join(' ');
    const lastX = PAD + (h.series.length - 1) * stepX;
    const lastY = H - PAD - (h.series[h.series.length - 1] / max) * (H - 2 * PAD);
    return (
      '<svg class="sc-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
        '<polyline class="sc-spark-line" points="' + points + '" />' +
        '<circle class="sc-spark-dot ' + dotClass + '" cx="' + lastX.toFixed(1) + '" cy="' + lastY.toFixed(1) + '" r="2" />' +
      '</svg>'
    );
  };
  const cells = histories
    .map(
      (h) =>
        '<div class="sc-sparkline" title="' +
        h.dim +
        ' across ' +
        h.series.length +
        ' round' +
        (h.series.length === 1 ? '' : 's') +
        ': ' +
        h.series.map((s) => s.toFixed(1)).join(' → ') +
        '">' +
        '<span class="sc-sparkline-key">' +
        h.dim +
        '</span>' +
        sparkSvg(h) +
        '</div>',
    )
    .join('');
  return '<div class="sc-sparklines">' + cells + '</div>';
}

function renderEmpty(dims) {
  return (
    '<div class="sc-composite sc-empty"><div class="sc-headline">— / 30</div>' +
    '<div class="sc-verdict-pill sc-verdict-pending">awaiting verifier</div></div>' +
    '<div class="sc-radar">' +
    renderRadar(dims.map((d) => ({ key: d, score: null }))) +
    '</div>' +
    '<div class="sc-rows">' +
    dims
      .map(
        (d) =>
          '<div class="sc-row sc-row-empty">' +
          '<span class="sc-row-key">' +
          d +
          '</span>' +
          '<span class="sc-row-name">' +
          DIM_NAMES[d] +
          '</span>' +
          '<span class="sc-row-bar"><span class="sc-row-bar-fill" style="width:0%"></span></span>' +
          '<span class="sc-row-value">—</span>' +
          '<span class="sc-row-source">—</span>' +
          '</div>',
      )
      .join('') +
    '</div>'
  );
}

function sumDims(records) {
  return records.reduce((a, r) => a + (typeof r.score === 'number' ? r.score : 0), 0);
}

/**
 * Per-rule sanitize note. Returns null when no rule altered this dim.
 * Format: { note: '15% self-bias', original?: number }
 */
function deriveSanitizeNote(dim, violations) {
  if (!violations || violations.length === 0) return null;
  if (dim === 'D2') {
    if (violations.includes('verify_pass_without_exec_zero')) return { note: 'forced 0 (Rule 1)' };
    if (violations.includes('verifier_overrode_d2_ground_truth'))
      return { note: 'forced to qa (Rule 2)' };
  }
  if (dim === 'D4' && violations.includes('verifier_overrode_d4_ground_truth')) {
    return { note: 'forced to auto (Rule 3)' };
  }
  if (
    (dim === 'D1' || dim === 'D3' || dim === 'D5') &&
    violations.includes('self_bias_score_discounted')
  ) {
    return { note: '−15% self-bias' };
  }
  if (dim === 'D5' && violations.includes('researcher_video_evidence_missing')) {
    return { note: 'forced 0 (Rule 5)' };
  }
  if (dim === 'D1' && violations.includes('verify_pass_with_ac_failure')) {
    return { note: 'cap 2 (Rule 7)' };
  }
  return null;
}

function renderComposite(aggregate, verdict, delta) {
  const aggStr = aggregate != null ? aggregate.toFixed(1) + ' / 30' : '— / 30';
  const verdictCls = verdict ? 'sc-verdict-' + verdict.toLowerCase() : 'sc-verdict-pending';
  const verdictTxt = verdict ?? 'pending';
  let deltaSpan = '';
  if (delta != null && delta !== 0) {
    const sign = delta > 0 ? '↗' : '↘';
    const cls = delta > 0 ? 'sc-delta-up' : 'sc-delta-down';
    deltaSpan =
      '<div class="sc-delta ' +
      cls +
      '">' +
      sign +
      ' ' +
      (delta > 0 ? '+' : '') +
      delta.toFixed(1) +
      '<span class="sc-delta-label"> vs prev</span></div>';
  }
  return (
    '<div class="sc-headline">' +
    escapeHTML(aggStr) +
    '</div>' +
    '<div class="sc-verdict-pill ' +
    verdictCls +
    '">' +
    escapeHTML(verdictTxt) +
    '</div>' +
    deltaSpan
  );
}

/**
 * 6-axis radar (CourtEval paper convention). 60×60 SVG, points at fixed
 * polar coords; missing scores plot at radius 0 (origin) so the empty
 * polygon collapses cleanly.
 */
function renderRadar(records) {
  const W = 80;
  const H = 80;
  const cx = W / 2;
  const cy = H / 2;
  const R = 30;
  const N = 6;
  // Polar position at axis i (i=0 is top, clockwise)
  const axisPoint = (i, frac) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    return [cx + Math.cos(angle) * R * frac, cy + Math.sin(angle) * R * frac];
  };
  // Concentric grid (3 levels at 1/3, 2/3, 1)
  const gridSvg = [1 / 3, 2 / 3, 1]
    .map((f) => {
      const pts = Array.from({ length: N }, (_, i) => axisPoint(i, f).join(','));
      return '<polygon class="sc-radar-grid" points="' + pts.join(' ') + '" />';
    })
    .join('');
  // Axis lines + labels
  const axesSvg = records
    .map((r, i) => {
      const [x, y] = axisPoint(i, 1.18);
      const [x0, y0] = axisPoint(i, 1);
      return (
        '<line class="sc-radar-axis" x1="' +
        cx +
        '" y1="' +
        cy +
        '" x2="' +
        x0 +
        '" y2="' +
        y0 +
        '" />' +
        '<text class="sc-radar-axis-label" x="' +
        x +
        '" y="' +
        (y + 3) +
        '">' +
        r.key +
        '</text>'
      );
    })
    .join('');
  // Data polygon
  const dataPts = records
    .map((r, i) => {
      const frac = typeof r.score === 'number' ? r.score / 5 : 0;
      return axisPoint(i, frac).join(',');
    })
    .join(' ');
  const hasData = records.some((r) => typeof r.score === 'number');
  return (
    '<svg class="sc-radar-svg" viewBox="0 0 ' +
    W +
    ' ' +
    H +
    '" preserveAspectRatio="xMidYMid meet">' +
    gridSvg +
    axesSvg +
    (hasData ? '<polygon class="sc-radar-data" points="' + dataPts + '" />' : '') +
    '</svg>'
  );
}

function renderDimRow(r) {
  const score = typeof r.score === 'number' ? r.score : null;
  const valueDisplay = score == null ? '—' : score.toFixed(1);
  const fillPct = score != null ? Math.max(0, Math.min(100, (score / 5) * 100)) : 0;
  const srcInfo = r.source ? SOURCE_BADGE[r.source] : null;
  const srcSpan = srcInfo
    ? '<span class="sc-row-source ' +
      srcInfo.cls +
      '" title="' +
      escapeHTML(r.source) +
      '">' +
      srcInfo.label +
      '</span>'
    : '<span class="sc-row-source">—</span>';
  let valueSpan = '<span class="sc-row-value">' + escapeHTML(valueDisplay) + '</span>';
  let trailSpan = '';
  if (r.sanitized) {
    valueSpan =
      '<span class="sc-row-value sc-row-value-sanitized">' + escapeHTML(valueDisplay) + '</span>';
    trailSpan =
      '<span class="sc-row-trail" title="' +
      escapeHTML(r.sanitized.note) +
      '">⚑ ' +
      escapeHTML(r.sanitized.note) +
      '</span>';
  }
  return (
    '<div class="sc-row">' +
    '<span class="sc-row-key">' +
    r.key +
    '</span>' +
    '<span class="sc-row-name">' +
    r.name +
    '</span>' +
    '<span class="sc-row-bar"><span class="sc-row-bar-fill" style="width:' +
    fillPct.toFixed(1) +
    '%"></span></span>' +
    valueSpan +
    srcSpan +
    trailSpan +
    '</div>'
  );
}

/**
 * v0.5 PR-7 — group paginator state. Persists across showDetail() calls so
 * the ←/→ keyboard shortcuts can drive page navigation. Set whenever a
 * grouped chip is opened; cleared when a single-event chip opens.
 */
let detailGroup = null; // { ids: [...], index: number } | null

function showDetail(id, groupIds) {
  if (!activeSession) return;
  const events = eventCache.get(activeSession) ?? [];
  const evt = events.find((e) => e.id === id);
  if (!evt) return;

  // PR-K' — group spread view replaces the paginator. When the user opens
  // a multi-event chip, we render ALL events as horizontal cards inside
  // the (resizable) detail panel; user can drag the panel wider to see
  // more cards side-by-side. Single-event chips show the legacy detail
  // structured panel.
  const isGroup = groupIds && groupIds.length > 1;
  if (isGroup) {
    detailGroup = { ids: groupIds, index: groupIds.indexOf(id) };
    renderDetailGroupSpread(events, groupIds);
    $('detail-body-single').style.display = 'none';
    $('detail-body-spread').style.display = '';
    const badge = $('detail-group-badge');
    badge.style.display = '';
    badge.textContent = '× ' + groupIds.length;
    $('detail-title').textContent = evt.kind + ' (' + groupIds.length + ' events)';
  } else {
    detailGroup = null;
    renderDetailSingle(evt);
    $('detail-body-spread').style.display = 'none';
    $('detail-body-single').style.display = '';
    $('detail-group-badge').style.display = 'none';
    $('detail-title').textContent = 'Event detail';
  }

  currentDetailEvent = evt;
  renderDetailEventNav();
  renderSandwichBar();
  $('sandwich-content').style.display = 'none';
  $('detail').classList.add('open');
}

/**
 * PR-K' — single-event detail view, Datadog-style structured panel.
 * Tag pills + audit banner + token breakdown bar + meta + body + data
 * + thread + sandwich + send-message all in one column.
 */
function renderDetailSingle(evt) {
  // Tag pills (clickable, used as quick-filter chips later — for now
  // they're informational; click-to-filter wires up in a follow-up).
  const tags = [];
  if (evt.kind) tags.push({ k: 'kind', v: evt.kind });
  if (evt.from) tags.push({ k: 'from', v: evt.from });
  if (evt.to) tags.push({ k: 'to', v: evt.to });
  if (evt.metadata?.provider) tags.push({ k: 'provider', v: evt.metadata.provider });
  if (evt.metadata?.model) tags.push({ k: 'model', v: evt.metadata.model });
  if (evt.metadata?.harness) tags.push({ k: 'harness', v: evt.metadata.harness });
  if (evt.metadata?.deterministic)
    tags.push({ k: 'tag', v: 'deterministic', cls: 'tag-deterministic' });
  if (evt.metadata?.cross_provider)
    tags.push({ k: 'tag', v: 'cross_provider', cls: 'tag-cross-provider' });
  $('detail-tags').innerHTML = tags
    .map(
      (t) =>
        '<span class="detail-tag ' +
        (t.cls || '') +
        '" title="' +
        escapeHTML(t.k) +
        '=' +
        escapeHTML(t.v) +
        '">' +
        '<span class="detail-tag-key">' +
        escapeHTML(t.k) +
        '</span>' +
        '<span class="detail-tag-val">' +
        escapeHTML(t.v) +
        '</span>' +
        '</span>',
    )
    .join('');

  // Audit banner — when this event has audit_violations OR is a kind=audit event,
  // surface it in red. Datadog's "anomaly" banner pattern.
  const violations =
    evt.metadata?.audit_violations ?? evt.scores?.audit_violations ?? evt.data?.violations ?? [];
  const auditBanner = $('detail-audit-banner');
  if (Array.isArray(violations) && violations.length > 0) {
    auditBanner.style.display = '';
    auditBanner.innerHTML =
      '<strong>★ anti-deception</strong>' + ' — ' + violations.map(escapeHTML).join(', ');
  } else {
    auditBanner.style.display = 'none';
    auditBanner.innerHTML = '';
  }

  // Token + cost + latency breakdown bar — visual rather than text.
  $('detail-resource-bar').innerHTML = renderResourceBar(evt);

  // Compact meta block
  const fields = [
    'id      ' + evt.id,
    'ts      ' + evt.ts,
    'session ' + (evt.session_id ?? '?'),
    evt.parent_event_id ? 'parent  ' + evt.parent_event_id : '',
    evt.metadata?.tool ? 'tool    ' + evt.metadata.tool : '',
  ]
    .filter(Boolean)
    .join('\\n');
  $('detail-meta').textContent = fields;
  $('detail-body').textContent = evt.body ?? '(empty)';
  $('detail-data').textContent = evt.data ? JSON.stringify(evt.data, null, 2) : '(none)';

  // Wire copy buttons (rebound on every render so closure stays current)
  const copyBody = $('detail-copy-body');
  if (copyBody) copyBody.onclick = () => copyToClipboard(evt.body ?? '');
  const copyData = $('detail-copy-data');
  if (copyData)
    copyData.onclick = () => copyToClipboard(evt.data ? JSON.stringify(evt.data, null, 2) : '');
}

/**
 * Compact horizontal stack: cache_read | tokens_in | tokens_out, sized in
 * proportion. Plus a separate row for cost + latency. Datadog APM
 * "resource breakdown" pattern. Shown only when at least one number exists.
 */
function renderResourceBar(evt) {
  const md = evt.metadata ?? {};
  const tokIn = Number(md.tokens_in ?? 0);
  const tokOut = Number(md.tokens_out ?? 0);
  const cacheR = Number(md.cache_read ?? 0);
  const total = tokIn + tokOut + cacheR;
  const cost = md.cost_usd != null ? '$' + Number(md.cost_usd).toFixed(4) : '—';
  const lat = md.latency_ms != null ? Number(md.latency_ms) + 'ms' : '—';
  if (total === 0 && md.cost_usd == null && md.latency_ms == null) {
    return '<div class="detail-resource-empty">no token / cost / latency on this event</div>';
  }
  const seg = (label, n, cls) => {
    if (!n || total === 0) return '';
    const pct = (n / total) * 100;
    return (
      '<div class="rbar-seg ' +
      cls +
      '" style="width:' +
      pct.toFixed(2) +
      '%" ' +
      'title="' +
      label +
      ': ' +
      formatTokens(n) +
      '">' +
      '<span class="rbar-seg-label">' +
      label +
      ' ' +
      formatTokens(n) +
      '</span>' +
      '</div>'
    );
  };
  const bar =
    total > 0
      ? '<div class="rbar">' +
        seg('cache', cacheR, 'rbar-cache') +
        seg('in', tokIn, 'rbar-in') +
        seg('out', tokOut, 'rbar-out') +
        '</div>'
      : '<div class="rbar rbar-empty"><span>no tokens</span></div>';
  return (
    bar +
    '<div class="rbar-meta">' +
    '<span class="rbar-meta-cell"><span class="rbar-meta-k">cost</span>' +
    escapeHTML(cost) +
    '</span>' +
    '<span class="rbar-meta-cell"><span class="rbar-meta-k">latency</span>' +
    escapeHTML(lat) +
    '</span>' +
    (md.cache_write
      ? '<span class="rbar-meta-cell"><span class="rbar-meta-k">cache_w</span>' +
        formatTokens(md.cache_write) +
        '</span>'
      : '') +
    '</div>'
  );
}

/**
 * PR-K' — group spread view. Renders all events in the group as
 * horizontally-scrolling cards. The aside.detail container is already
 * resizable (PR-2 resize-handle); user drags it wider to see more cards
 * side-by-side. Each card is a compact, self-contained event preview
 * with the same Datadog-grade metadata (tag pills, resource bar, body,
 * data) the single-view shows.
 */
function renderDetailGroupSpread(events, groupIds) {
  const groupEvts = groupIds.map((id) => events.find((e) => e.id === id)).filter(Boolean);
  // Distinct actor count tells the user this is a kind-wide spread (PR-K' α)
  // not just the consecutive lane group.
  const distinctActors = new Set(groupEvts.map((e) => e.from)).size;
  const actorSummary = distinctActors > 1 ? distinctActors + ' actors' : '';
  $('detail-spread-toolbar').innerHTML =
    '<span class="spread-toolbar-label">' +
    'kind: ' +
    escapeHTML(groupEvts[0]?.kind ?? 'group') +
    ' · ' +
    groupEvts.length +
    ' events' +
    (actorSummary ? ' · ' + actorSummary : '') +
    '</span>' +
    '<span class="spread-toolbar-hint">Drag the panel edge to widen ↔</span>';
  $('detail-spread-cards').innerHTML = groupEvts.map(renderSpreadCard).join('');
  // Wire per-card copy buttons
  $('detail-spread-cards')
    .querySelectorAll('.spread-card-copy')
    .forEach((btn) => {
      btn.addEventListener('click', () => copyToClipboard(btn.dataset.text ?? ''));
    });
}

function renderSpreadCard(evt) {
  const md = evt.metadata ?? {};
  const tagsHtml = [
    md.provider
      ? '<span class="detail-tag"><span class="detail-tag-key">provider</span><span class="detail-tag-val">' +
        escapeHTML(md.provider) +
        '</span></span>'
      : '',
    md.model
      ? '<span class="detail-tag"><span class="detail-tag-key">model</span><span class="detail-tag-val">' +
        escapeHTML(md.model) +
        '</span></span>'
      : '',
    md.deterministic
      ? '<span class="detail-tag tag-deterministic"><span class="detail-tag-key">tag</span><span class="detail-tag-val">deterministic</span></span>'
      : '',
  ]
    .filter(Boolean)
    .join('');
  const violations = md.audit_violations ?? evt.scores?.audit_violations ?? [];
  const banner =
    Array.isArray(violations) && violations.length > 0
      ? '<div class="spread-card-audit">★ ' + violations.map(escapeHTML).join(', ') + '</div>'
      : '';
  const lat = md.latency_ms != null ? Number(md.latency_ms) + 'ms' : '—';
  const tok =
    md.tokens_in != null
      ? formatTokens(md.tokens_in) + '→' + formatTokens(md.tokens_out ?? 0)
      : '—';
  const cost = md.cost_usd != null ? '$' + Number(md.cost_usd).toFixed(4) : '—';
  const dataPreview = evt.data ? JSON.stringify(evt.data, null, 2) : '';
  return (
    '<article class="spread-card" data-id="' +
    escapeHTML(evt.id) +
    '">' +
    '<header class="spread-card-header">' +
    '<span class="spread-card-actor"><span class="glyph" style="background:var(' +
    (ACTOR_VAR[evt.from] || '--ink-tertiary') +
    ');"></span>' +
    escapeHTML(evt.from || '?') +
    '</span>' +
    '<span class="spread-card-ts">' +
    escapeHTML((evt.ts || '').split('T')[1]?.slice(0, 12) ?? '') +
    '</span>' +
    '<button class="spread-card-copy" data-text="' +
    escapeHTML(evt.id) +
    '" title="Copy event id">⧉ id</button>' +
    '</header>' +
    banner +
    '<div class="spread-card-tags">' +
    tagsHtml +
    '</div>' +
    '<div class="spread-card-resource">' +
    '<span title="latency"><strong>↻</strong>&nbsp;' +
    escapeHTML(lat) +
    '</span>' +
    '<span title="tokens in→out"><strong>⇄</strong>&nbsp;' +
    escapeHTML(tok) +
    '</span>' +
    '<span title="cost"><strong>$</strong>&nbsp;' +
    escapeHTML(cost) +
    '</span>' +
    '</div>' +
    '<div class="spread-card-body-label">body</div>' +
    '<pre class="spread-card-body">' +
    escapeHTML(evt.body ?? '(empty)') +
    '</pre>' +
    (dataPreview
      ? '<div class="spread-card-body-label">data ' +
        '<button class="spread-card-copy" data-text="' +
        escapeHTML(dataPreview) +
        '" title="Copy JSON">⧉</button>' +
        '</div>' +
        '<pre class="spread-card-data">' +
        escapeHTML(dataPreview) +
        '</pre>'
      : '') +
    '</article>'
  );
}

function copyToClipboard(text) {
  if (!text) return;
  try {
    navigator.clipboard?.writeText(text);
  } catch {
    // older browsers / non-https — silent
  }
}

/**
 * PR-K' — cross-actor event paginator. Steps through every transcript
 * event for the active session, sorted chronologically (ULID order). The
 * group paginator (PR-7) was REMOVED in PR-K' — opening a grouped chip
 * now spreads ALL events as horizontal cards in \`#detail-body-spread\`
 * (see \`renderDetailGroupSpread\`), so group nav is no longer needed.
 */
function renderDetailEventNav() {
  const root = $('detail-event-nav');
  if (!root) return;
  const evt = currentDetailEvent;
  if (!activeSession || !evt) {
    root.style.display = 'none';
    root.innerHTML = '';
    return;
  }
  const events = eventCache.get(activeSession) ?? [];
  const idx = events.findIndex((e) => e.id === evt.id);
  if (idx < 0) {
    root.style.display = 'none';
    root.innerHTML = '';
    return;
  }
  root.style.display = '';
  root.innerHTML =
    '<button id="detail-event-prev" class="detail-event-btn" ' +
    (idx === 0 ? 'disabled' : '') +
    ' title="Previous event in session (←)">←</button>' +
    '<span class="detail-event-pos">event &nbsp;<strong>' +
    (idx + 1) +
    '</strong>/' +
    events.length +
    '</span>' +
    '<button id="detail-event-next" class="detail-event-btn" ' +
    (idx === events.length - 1 ? 'disabled' : '') +
    ' title="Next event in session (→)">→</button>';
  document.getElementById('detail-event-prev')?.addEventListener('click', () => navDetailEvent(-1));
  document.getElementById('detail-event-next')?.addEventListener('click', () => navDetailEvent(1));
}

function navDetailEvent(delta) {
  if (!activeSession) return;
  const events = eventCache.get(activeSession) ?? [];
  const evt = currentDetailEvent;
  if (!evt) return;
  const idx = events.findIndex((e) => e.id === evt.id);
  if (idx < 0) return;
  const nextIdx = idx + delta;
  if (nextIdx < 0 || nextIdx >= events.length) return;
  // Stepping out of a group resets the group paginator state.
  showDetail(events[nextIdx].id, null);
}

// Keyboard ←/→ — cross-event paginator. PR-K' removed the group paginator
// (groups now show as horizontal card spread instead), so ←/→ always
// steps to the previous/next event in the session. Input / textarea
// focus is guarded so typing isn't hijacked.
document.addEventListener('keydown', (e) => {
  if (!$('detail')?.classList.contains('open')) return;
  const tag = (document.activeElement?.tagName ?? '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const delta = e.key === 'ArrowLeft' ? -1 : 1;
  navDetailEvent(delta);
  e.preventDefault();
});

function renderSandwichBar() {
  const bar = $('sandwich-actor-bar');
  if (!activeSession) {
    bar.innerHTML = '';
    return;
  }
  const s = sessions.get(activeSession);
  const actors = s?.actors ?? [];
  if (actors.length === 0) {
    bar.innerHTML =
      '<span style="color:var(--ink-tertiary);font-size:11px;">no actors spawned yet</span>';
    return;
  }
  bar.innerHTML = actors
    .map(
      (a) =>
        '<button class="sw-btn" data-actor="' +
        escapeHTML(a) +
        '" style="' +
        'background:var(--surface-2);border:1px solid var(--hairline);color:var(--ink-muted);' +
        'padding:4px 10px;border-radius:var(--r-sm);font-family:inherit;font-size:11px;cursor:pointer;">' +
        escapeHTML(a) +
        '</button>',
    )
    .join('');
  bar.querySelectorAll('.sw-btn').forEach((btn) => {
    btn.addEventListener('click', () => loadSandwich(btn.dataset.actor));
  });
}

async function loadSandwich(actor) {
  if (!activeSession) return;
  const pre = $('sandwich-content');
  pre.style.display = 'block';
  pre.textContent = 'loading…';
  try {
    const res = await fetch(
      '/api/sessions/' +
        encodeURIComponent(activeSession) +
        '/sandwich/' +
        encodeURIComponent(actor),
    );
    const text = await res.text();
    pre.textContent = res.ok ? text : '(' + res.status + ') ' + text;
  } catch (err) {
    pre.textContent = 'fetch failed: ' + err.message;
  }
}

$('detail-close').addEventListener('click', () => $('detail').classList.remove('open'));

const params = new URLSearchParams(location.search);
const target = params.get('session') ?? '*';

const es = new EventSource('/api/stream?session=' + encodeURIComponent(target));
es.addEventListener('session_start', (e) => {
  const d = JSON.parse(e.data);
  ensureSession(d.session_id, { project_id: d.project_id, goal: d.goal, preset: d.preset });
  if (!activeSession) selectSession(d.session_id);
  else renderSessionList();
});
// Q5: single append dispatcher — every previous \`es.addEventListener('append', ...)\`
// site (8 of them) parsed e.data independently and re-filtered by session_id.
// Now: parse once, fan out to registered handlers via \`onAppendMsg(fn)\`. Each
// handler receives the parsed envelope \`d = { session_id, msg, ... }\`. Handler
// errors are caught + logged so one broken consumer doesn't break others.
//
// Order of registration is preserved — the first one registered (the cache
// updater below) runs before any downstream renderer, so swimlane / scorecard
// see the freshly-pushed event in eventCache.
const appendHandlers = [];
function onAppendMsg(fn) {
  appendHandlers.push(fn);
}
es.addEventListener('append', (e) => {
  const d = JSON.parse(e.data);
  for (const h of appendHandlers) {
    try {
      h(d);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[studio] append handler failed:', err);
    }
  }
});

onAppendMsg((d) => {
  let arr = eventCache.get(d.session_id);
  if (!arr) {
    arr = [];
    eventCache.set(d.session_id, arr);
  }
  arr.push(d.msg);
  // Track actors that have actually spawned so the sandwich preview only
  // surfaces buttons for sandwiches that exist on disk.
  const s = ensureSession(d.session_id, null);
  if (d.msg.kind === 'agent.wake' && d.msg.from && !s.actors.includes(d.msg.from)) {
    s.actors = [...s.actors, d.msg.from];
    if (d.session_id === activeSession) renderSandwichBar();
  }
  if (d.session_id === activeSession) {
    renderSwimlane();
    renderScorecard();
    if (activeView === 'waterfall') renderWaterfall();
  }
  renderSessionList();
});
es.addEventListener('state', (e) => {
  const d = JSON.parse(e.data);
  const s = ensureSession(d.session_id, null);
  s.metrics = d.metrics;
  if (d.session_id === activeSession) renderHeader();
  renderSessionList();
});
es.addEventListener('heartbeat', () => {
  // Heartbeat == healthy connection. If the reconnect pill is showing, hide it.
  setConnState('connected');
});
es.addEventListener('open', () => setConnState('connected'));
es.addEventListener('session_start', () => setConnState('connected'));
es.addEventListener('append', () => setConnState('connected'));
es.onerror = () => {
  // EventSource auto-reconnects (HTML5 spec: ~3s default). Surface a visible
  // pill + manual "Reconnect now" affordance so the user knows the connection
  // dropped and can force a re-fetch instead of waiting on the browser
  // heuristic (which can stretch when the laptop wakes from sleep).
  setConnState('reconnecting');
};

/**
 * v0.5 PR-5: connection-state pill + manual reconnect button. The browser's
 * EventSource already auto-reconnects, but during long disconnects (laptop
 * sleep / wifi flap / Studio restart via \`crumb studio --restart\`) the user
 * needs a visible signal + a one-click recovery instead of a hard page reload.
 *
 * States:
 *   - connected:    pill hidden
 *   - reconnecting: pill shows "Reconnecting…" + "Reconnect now" button
 */
function setConnState(state) {
  const pill = document.getElementById('conn-state-pill');
  if (!pill) return;
  if (state === 'connected') {
    pill.style.display = 'none';
    document.title = 'Crumb · Live Studio';
  } else if (state === 'reconnecting') {
    pill.style.display = 'flex';
    document.title = 'Crumb · Live (reconnecting…)';
  }
}
const connRetryBtn = document.getElementById('conn-state-retry');
if (connRetryBtn) {
  connRetryBtn.addEventListener('click', () => {
    // Hard reload: easiest correct path. EventSource has no public re-open
    // and our handlers are wired to the original \`es\` const, so a reload
    // re-runs the setup with a clean slate. Studio's HTTP-pull endpoints
    // (/api/sessions, /api/sessions/:id/snapshot) re-hydrate state.
    location.reload();
  });
}

fetch('/api/sessions')
  .then((r) => r.json())
  .then((payload) => {
    for (const s of payload.sessions ?? []) {
      const sess = ensureSession(s.session_id, {
        project_id: s.project_id,
        goal: s.goal,
        preset: s.preset,
        actors: s.actors,
      });
      sess.metrics = s.metrics;
      // v3.5 bootstrap: preserve classifier output for sidebar dot color + sort.
      sess.state = s.state ?? null;
      sess.last_activity_at = s.last_activity_at ?? null;
      sess.done_reason = s.done_reason ?? null;
      sess.live = s.state === 'live'; // legacy flag for back-compat
      eventCache.set(s.session_id, s.history ?? []);
    }
    if (!activeSession && payload.sessions?.[0]) selectSession(payload.sessions[0].session_id);
    else renderSessionList();
  })
  .catch(() => {});

// ─── v3.5 Console — DAG topology + weaving ────────────────────────────────
//
// 8-actor pipeline DAG (PR-Prune-2), grounded against src/reducer/index.ts:
//   goal → spawn planner-lead
//   spec → spawn builder
//   build → qa_check effect
//   qa.result → spawn verifier
//   judge.score PASS → done(verdict_pass)
//   judge.score FAIL+breaker_OPEN+swap_avail → adapter swap + respawn builder
//   judge.score FAIL+breaker_OPEN+swap_used → done(builder_circuit_open)
//   judge.score FAIL+breaker_CLOSED → rollback planner-lead OR respawn builder
//   handoff.requested(researcher) → spawn researcher
//   step.research → spawn planner-lead (resume phase B)
//   anti-deception violation → append kind=audit (validator)
//
// Edge type vocabulary (visual semantics aligned with mermaid-diagrams skill):
//   handoff   indigo solid — standard reducer-driven spawn
//   rollback  amber dashed — verifier FAIL → planner respec
//   swap      red dashed   — verifier FAIL + breaker OPEN → adapter swap + respawn builder
//   terminal  green solid  — verifier PASS → done
//   audit     pink dotted  — anti-deception side-effect (conditional, not routing)
//   intervene gray dotted  — user.veto / user.intervene direct jump
// v0.4.2 — accurate post-PR-G layout. Six lifecycle columns, 1100×320 viewport.
// Node shapes (semantic):
//   actor    → circle      (LLM-driven, spawns subprocess)
//   effect   → hexagon     (deterministic, no LLM — qa_check, validator)
//   user     → diamond     (external input)
//   terminal → rounded box (done)
const DAG_NODES = {
  user: { x: 50, y: 160, label: 'user', shape: 'diamond' },
  coordinator: { x: 165, y: 160, label: 'coord', shape: 'circle' },
  'planner-lead': { x: 305, y: 90, label: 'planner', shape: 'circle' },
  researcher: { x: 305, y: 230, label: 'researcher', shape: 'circle' },
  builder: { x: 480, y: 160, label: 'builder', shape: 'circle' },
  qa_check: { x: 645, y: 160, label: 'qa_check', shape: 'hexagon' },
  verifier: { x: 825, y: 90, label: 'verifier', shape: 'circle' },
  validator: { x: 825, y: 230, label: 'validator', shape: 'hexagon' },
  done: { x: 1010, y: 160, label: 'done', shape: 'terminal' },
};

// Five-phase backgrounds aligned with the reducer's case-routing layers:
// A=Spec authoring, B=Build, C=QA ground truth (deterministic), D=Judge
// (verifier LLM + validator code), E=Done.
const DAG_PHASES = [
  { id: 'A', label: 'A · Spec', x: 240, y: 32, w: 165, h: 256 },
  { id: 'B', label: 'B · Build', x: 420, y: 32, w: 145, h: 256 },
  { id: 'C', label: 'C · QA', x: 580, y: 32, w: 130, h: 256 },
  { id: 'D', label: 'D · Verify', x: 765, y: 32, w: 130, h: 256 },
  { id: 'E', label: 'E · Done', x: 950, y: 32, w: 120, h: 256 },
];

// Edges: [from, to, type, label?]. Edge types:
//   flow      indigo solid  — standard handoff / spawn
//   respawn   blue dashed   — Important/Minor deviation → rebuild same actor   [PR-G2]
//   rollback  amber dashed  — Critical deviation → planner-lead respec
//   swap      red dashed    — circuit OPEN → adapter swap + respawn builder    [PR-Prune-2]
//   terminal  green solid   — verifier PASS → done
//   audit     pink dotted   — anti-deception side-effect (conditional)
//   intervene gray dotted   — user.intervene goto / @actor shorthand           [PR-G7-A]
//   resume    cyan solid    — done → re-enter loop                             [PR-G7-B]
const DAG_EDGES = [
  // === Flow (standard handoff / spawn, indigo solid) ===
  ['user', 'coordinator', 'flow', 'goal'],
  ['coordinator', 'planner-lead', 'flow', 'spawn'],
  ['planner-lead', 'researcher', 'flow', 'handoff'],
  ['researcher', 'planner-lead', 'flow', 'step.research'],
  ['planner-lead', 'builder', 'flow', 'spec'],
  ['builder', 'qa_check', 'flow', 'build'],
  ['qa_check', 'verifier', 'flow', 'qa.result'],
  ['verifier', 'validator', 'audit', 'judge.score'],
  // === Verdict-based routing from verifier ===
  ['verifier', 'done', 'terminal', 'PASS'],
  ['verifier', 'builder', 'respawn', 'Important / OPEN'], // PR-G2 + PR-Prune-2 (adapter swap on circuit OPEN)
  ['verifier', 'planner-lead', 'rollback', 'Critical'],
  // === Re-entry (PR-G7-B resume) ===
  ['done', 'coordinator', 'resume', '↻'],
  // === User intervention ===
  ['user', 'planner-lead', 'intervene', '@'],
  ['user', 'builder', 'intervene', '@'],
  ['user', 'verifier', 'intervene', '@'],
];

// SVG path for a node body. Shapes:
//   circle   — actor (LLM)
//   hexagon  — effect (deterministic, no LLM)
//   diamond  — user (external input)
//   terminal — rounded box (done)
function nodeShapePath(n, r = 26) {
  switch (n.shape) {
    case 'hexagon': {
      // pointy-top hexagon, slightly wider than tall
      const w = r * 1.05;
      const h = r * 0.9;
      const pts = [
        [n.x, n.y - h],
        [n.x + w, n.y - h * 0.5],
        [n.x + w, n.y + h * 0.5],
        [n.x, n.y + h],
        [n.x - w, n.y + h * 0.5],
        [n.x - w, n.y - h * 0.5],
      ];
      return 'M' + pts.map((p) => p.join(',')).join(' L') + ' Z';
    }
    case 'diamond': {
      const s = r * 0.95;
      return \`M\${n.x},\${n.y - s} L\${n.x + s},\${n.y} L\${n.x},\${n.y + s} L\${n.x - s},\${n.y} Z\`;
    }
    case 'terminal': {
      const w = r * 1.4;
      const h = r * 0.85;
      const rr = h * 0.7;
      return \`M\${n.x - w + rr},\${n.y - h} L\${n.x + w - rr},\${n.y - h} A\${rr},\${rr} 0 0 1 \${n.x + w},\${n.y - h + rr} L\${n.x + w},\${n.y + h - rr} A\${rr},\${rr} 0 0 1 \${n.x + w - rr},\${n.y + h} L\${n.x - w + rr},\${n.y + h} A\${rr},\${rr} 0 0 1 \${n.x - w},\${n.y + h - rr} L\${n.x - w},\${n.y - h + rr} A\${rr},\${rr} 0 0 1 \${n.x - w + rr},\${n.y - h} Z\`;
    }
    case 'circle':
    default: {
      const c = r;
      return \`M\${n.x - c},\${n.y} A\${c},\${c} 0 1 0 \${n.x + c},\${n.y} A\${c},\${c} 0 1 0 \${n.x - c},\${n.y} Z\`;
    }
  }
}

/**
 * Aggregate per-actor runtime stats from the active session's transcript.
 * Same shape as metrics.ts ActorTotals but computed inline so renderDag
 * doesn't need a round-trip through the SSE state event (which fires only
 * on full state recompute; renderDag fires on every weave). Returns a
 * Map<actor, {events, tokens_in, tokens_out, cost_usd, latency_ms_total,
 * latency_ms_p95}>; missing actors yield undefined so the badge layer can
 * just skip them.
 */
function aggregateActorRuntime(events) {
  const acc = new Map();
  const latByActor = new Map();
  for (const e of events) {
    let bucket = acc.get(e.from);
    if (!bucket) {
      bucket = {
        events: 0,
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
        latency_ms_total: 0,
        latency_samples: 0,
      };
      acc.set(e.from, bucket);
      latByActor.set(e.from, []);
    }
    bucket.events += 1;
    const md = e.metadata;
    if (!md) continue;
    if (typeof md.tokens_in === 'number') bucket.tokens_in += md.tokens_in;
    if (typeof md.tokens_out === 'number') bucket.tokens_out += md.tokens_out;
    if (typeof md.cost_usd === 'number') bucket.cost_usd += md.cost_usd;
    if (typeof md.latency_ms === 'number') {
      bucket.latency_ms_total += md.latency_ms;
      bucket.latency_samples += 1;
      latByActor.get(e.from).push(md.latency_ms);
    }
  }
  // Compute p95 per actor (sorted, take 95th percentile or max if <20 samples).
  for (const [actor, samples] of latByActor.entries()) {
    if (samples.length === 0) continue;
    samples.sort((a, b) => a - b);
    const idx = Math.min(samples.length - 1, Math.floor(samples.length * 0.95));
    acc.get(actor).latency_ms_p95 = samples[idx];
  }
  return acc;
}

/**
 * Aggregate per-edge stats: how many times this edge was traversed in the
 * active session + average latency of the destination actor's events on
 * that traversal. Used to thicken edges that fire often (Datadog Service
 * Map "throughput=line thickness" idiom) and tint slow edges red (X-Ray
 * heatmap idiom). Heuristic: an edge \`(from → to)\` is "traversed" when an
 * event from \`to\` follows an event from \`from\` within the cached events,
 * AND that pair matches a static DAG_EDGES entry.
 */
function aggregateEdgeRuntime(events) {
  const counts = new Map(); // "from→to" → traversal count
  const latencies = new Map(); // "from→to" → [latency_ms samples on \`to\` events]
  // Build a fast lookup: which edges exist in the static DAG.
  const validEdges = new Set(DAG_EDGES.map(([from, to]) => from + '→' + to));
  // System events with metadata.tool=qa-check-effect@v1 represent the qa_check
  // node in the DAG, mirror studio's rippleFromActor logic.
  const remap = (e) =>
    e.from === 'system' && e.metadata?.tool === 'qa-check-effect@v1' ? 'qa_check' : e.from;
  for (let i = 1; i < events.length; i++) {
    const fromActor = remap(events[i - 1]);
    const toActor = remap(events[i]);
    if (fromActor === toActor) continue;
    const key = fromActor + '→' + toActor;
    if (!validEdges.has(key)) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const lat = events[i].metadata?.latency_ms;
    if (typeof lat === 'number') {
      let arr = latencies.get(key);
      if (!arr) {
        arr = [];
        latencies.set(key, arr);
      }
      arr.push(lat);
    }
  }
  const result = new Map();
  for (const [key, count] of counts.entries()) {
    const arr = latencies.get(key) ?? [];
    const avg = arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    result.set(key, { count, avg_latency_ms: avg });
  }
  return result;
}

/**
 * Format a per-node runtime badge string. Compact, monospace, ≤ ~24 chars
 * so it fits below a 26px-radius node without wrapping.
 *   \`12.3k tok · $0.18 · 8.1s p95\`
 * Drops fields that are zero/absent so the badge stays terse.
 */
function formatActorBadge(stats) {
  if (!stats) return '';
  const parts = [];
  const tokTotal = (stats.tokens_in ?? 0) + (stats.tokens_out ?? 0);
  if (tokTotal > 0) parts.push(formatTokens(tokTotal) + ' tok');
  if (stats.cost_usd > 0) parts.push(formatCost(stats.cost_usd));
  if (stats.latency_ms_p95) parts.push((stats.latency_ms_p95 / 1000).toFixed(1) + 's p95');
  return parts.join(' · ');
}

function renderDag() {
  const svg = $('dag-svg');
  if (!svg) return;
  // Phase zone rects (rendered first → bottom layer)
  const zonesSvg = DAG_PHASES.map(
    (p) =>
      '<g class="dag-phase phase-' +
      p.id +
      '">' +
      '<rect x="' +
      p.x +
      '" y="' +
      p.y +
      '" width="' +
      p.w +
      '" height="' +
      p.h +
      '" rx="10" />' +
      '<text x="' +
      (p.x + 10) +
      '" y="' +
      (p.y + 16) +
      '" class="phase-label">' +
      escapeHTML(p.label) +
      '</text>' +
      '</g>',
  ).join('');
  const events = activeSession ? (eventCache.get(activeSession) ?? []) : [];
  // PR-J' (Candidate 4) — per-edge runtime aggregation drives stroke width
  // (count) and color shift (avg latency). Untraversed edges keep their
  // baseline static styling so the structural DAG remains legible.
  const edgeStats = aggregateEdgeRuntime(events);
  // Edges (typed) — typed dasharray + label rendered above the midpoint.
  const edgesSvg = DAG_EDGES.map(([from, to, type, label]) => {
    const a = DAG_NODES[from],
      b = DAG_NODES[to];
    if (!a || !b) return '';
    const d = edgePath(a, b, from, to);
    const stats = edgeStats.get(from + '→' + to);
    // Datadog "edge thickness = throughput" — clamp 1.4–4.4px so the
    // thickest edge is visible without dominating the canvas.
    const strokeWidth = stats ? Math.min(4.4, 1.4 + Math.log2(1 + stats.count) * 0.9) : 1.4;
    // X-Ray-style latency tint: opacity 0.55 baseline → 1.0 when traversed.
    // Slow edges (avg > 5000ms) get an extra red overlay via the
    // .edge-slow class.
    const extraCls = [];
    if (stats) extraCls.push('edge-traversed');
    if (stats?.avg_latency_ms && stats.avg_latency_ms > 5000) extraCls.push('edge-slow');
    const labelSvg = label
      ? '<text class="edge-label edge-label-' +
        type +
        '" x="' +
        edgeLabelPos(a, b, from, to).x +
        '" y="' +
        edgeLabelPos(a, b, from, to).y +
        '">' +
        escapeHTML(label) +
        '</text>'
      : '';
    const countBadge =
      stats && stats.count > 1
        ? '<text class="edge-count" x="' +
          edgeLabelPos(a, b, from, to).x +
          '" y="' +
          (edgeLabelPos(a, b, from, to).y - 11) +
          '">×' +
          stats.count +
          '</text>'
        : '';
    return (
      '<g class="dag-edge-group ' +
      extraCls.join(' ') +
      '">' +
      '<path class="dag-edge edge-' +
      type +
      '" d="' +
      d +
      '" stroke-width="' +
      strokeWidth.toFixed(2) +
      '" marker-end="url(#dag-arrow-' +
      type +
      ')" />' +
      labelSvg +
      countBadge +
      '</g>'
    );
  }).join('');
  const lastEvt = events[events.length - 1];
  const lastActor = lastEvt?.from;
  const recentActors = new Set(events.slice(-8).map((e) => e.from));
  const isDone = events.some((e) => e.kind === 'done');
  // PR-J' (Candidate 4) — per-actor runtime aggregation drives the badge
  // line under each node (LangSmith / Langfuse / Phoenix idiom).
  const actorStats = aggregateActorRuntime(events);
  const nodesSvg = Object.entries(DAG_NODES)
    .map(([actor, n]) => {
      const cls = [
        'dag-node',
        'node-' + actor.replace(/[^a-z_]/gi, '-'),
        'shape-' + (n.shape || 'circle'),
      ];
      if (lastActor === actor) cls.push('active');
      else if (recentActors.has(actor)) cls.push('recent');
      if (actor === 'done' && isDone) cls.push('active');
      // qa_check is a synthetic node — system events with the qa-check-effect tool
      // get aggregated under the qa_check key via aggregateActorRuntime's remap.
      const badge = formatActorBadge(actorStats.get(actor));
      const badgeSvg = badge
        ? '<text class="dag-node-badge" x="' +
          n.x +
          '" y="' +
          (n.y + 32) +
          '">' +
          escapeHTML(badge) +
          '</text>'
        : '';
      return (
        '<g class="' +
        cls.join(' ') +
        '" data-actor="' +
        actor +
        '">' +
        '<path d="' +
        nodeShapePath(n) +
        '" />' +
        '<text x="' +
        n.x +
        '" y="' +
        (n.y + 4) +
        '">' +
        escapeHTML(n.label) +
        '</text>' +
        badgeSvg +
        '</g>'
      );
    })
    .join('');
  // Arrowhead defs — one per edge type so the head color matches the stroke.
  const arrowDefs = ['flow', 'respawn', 'rollback', 'terminal', 'audit', 'intervene', 'resume']
    .map(
      (type) =>
        '<marker id="dag-arrow-' +
        type +
        '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
        '<path class="arrow-head arrow-' +
        type +
        '" d="M0,0 L10,5 L0,10 Z" />' +
        '</marker>',
    )
    .join('');
  svg.innerHTML =
    '<defs>' +
    arrowDefs +
    '</defs>' +
    '<g id="dag-zones">' +
    zonesSvg +
    '</g>' +
    '<g id="dag-edges">' +
    edgesSvg +
    '</g>' +
    '<g id="dag-ripples"></g>' +
    '<g id="dag-nodes">' +
    nodesSvg +
    '</g>';
}

// Edge path geometry. Most edges are straight; verifier's two feedback
// edges (rollback / respawn) originate from the same node and would overlap,
// so we route them above the layout. The resume edge (done → coordinator)
// loops over the entire top.
function edgePath(a, b, from, to) {
  // verifier → planner-lead (Critical rollback): up-and-over arc above row 1
  if (from === 'verifier' && to === 'planner-lead') {
    const cy = 30; // hugs the phase-band top
    return \`M\${a.x},\${a.y - 22} C\${a.x},\${cy} \${b.x},\${cy} \${b.x},\${b.y - 22}\`;
  }
  // verifier → builder (Important respawn / circuit OPEN adapter swap):
  // up-and-over but lower than the planner arc, so the two feedback paths
  // don't collide. PR-Prune-2 collapsed the former fallback edge into this
  // one — both routes terminate at the same builder node.
  if (from === 'verifier' && to === 'builder') {
    const cy = 50;
    return \`M\${a.x},\${a.y - 22} C\${a.x - 60},\${cy} \${b.x + 60},\${cy} \${b.x},\${b.y - 22}\`;
  }
  // done → coordinator (resume cycle): big arc over the top of everything.
  if (from === 'done' && to === 'coordinator') {
    const cy = 12;
    return \`M\${a.x},\${a.y - 22} C\${a.x},\${cy} \${b.x},\${cy} \${b.x},\${b.y - 22}\`;
  }
  // user → planner-lead / builder / verifier (intervene): straight diagonal,
  // slight curve outward so all three don't overlap.
  if (from === 'user' && (to === 'planner-lead' || to === 'builder' || to === 'verifier')) {
    const t = to === 'planner-lead' ? -10 : to === 'builder' ? -30 : -50;
    return \`M\${a.x + 18},\${a.y} Q\${(a.x + b.x) / 2},\${a.y + t} \${b.x - 24},\${b.y - 4}\`;
  }
  // Default: straight line, trimmed to node radius.
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len,
    uy = dy / len;
  const r = 26;
  return \`M\${a.x + ux * r},\${a.y + uy * r} L\${b.x - ux * r},\${b.y - uy * r}\`;
}

// Position for the edge label (above midpoint). For curved edges we approximate
// via the control point so the label sits where the arc bulges.
function edgeLabelPos(a, b, from, to) {
  if (from === 'verifier' && to === 'planner-lead') return { x: (a.x + b.x) / 2, y: 26 };
  if (from === 'verifier' && to === 'builder') return { x: (a.x + b.x) / 2, y: 56 };
  if (from === 'done' && to === 'coordinator') return { x: (a.x + b.x) / 2, y: 22 };
  if (from === 'user' && (to === 'planner-lead' || to === 'builder' || to === 'verifier')) {
    const t = to === 'planner-lead' ? -10 : to === 'builder' ? -30 : -50;
    return { x: (a.x + b.x) / 2, y: a.y + t - 4 };
  }
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 6 };
}

// Pipeline position narrative — 'where am I in the DAG' for the detail panel.
function pipelinePositionFor(evt) {
  const order = [
    'session.start',
    'goal',
    'question.socratic',
    'answer.socratic',
    'step.socratic',
    'step.concept',
    'handoff.requested',
    'step.research.video',
    'step.research',
    'step.design',
    'spec',
    'build',
    'qa.result',
    'step.judge',
    'judge.score',
    'verify.result',
    'done',
  ];
  const i = order.indexOf(evt.kind);
  const phase =
    i < 0
      ? 'meta'
      : i <= 4
        ? 'PHASE A — Socratic & Concept'
        : i <= 7
          ? 'PHASE A → B — Researcher'
          : i <= 9
            ? 'PHASE B — Design & Synth'
            : i === 10
              ? 'PHASE B → C — Spec sealed'
              : i === 11
                ? 'PHASE C — Build'
                : i === 12
                  ? 'PHASE C → D — QA ground truth'
                  : i <= 14
                    ? 'PHASE D — Verifier (CourtEval)'
                    : 'PHASE D → done';
  return phase + ' · ' + evt.from + '/' + evt.kind;
}

// Trigger a one-shot weaving ripple when an event flows from one actor to
// another. Animates the dashed edge for 1.5s then removes the overlay.
function rippleEdge(fromActor, toActor) {
  const a = DAG_NODES[fromActor],
    b = DAG_NODES[toActor];
  if (!a || !b) return;
  const ripples = document.getElementById('dag-ripples');
  if (!ripples) return;
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('class', 'dag-ripple flow');
  path.setAttribute('d', edgePath(a, b, fromActor, toActor));
  ripples.appendChild(path);
  setTimeout(() => path.remove(), 1500);
}

// Weaving orchestrator — observe each new event and ripple from sender to
// the next-likely target. The map encodes "after kind X, the next message
// usually goes to actor Y" — derived from the reducer's switch/case.
const WEAVE_TARGET = {
  goal: 'coordinator',
  'session.start': null,
  'question.socratic': 'user',
  'answer.socratic': 'planner-lead',
  spec: 'builder',
  'spec.update': 'builder',
  build: 'qa_check', // qa_check effect (renamed from \`system\` v0.4.2)
  'qa.result': 'verifier',
  'step.research': 'planner-lead', // researcher → resume planner phase B
  'step.research.video': null, // intermediate, no routing
  'handoff.requested': null, // payload.to drives it
  'handoff.rollback': null, // PR-G2 — verdict-deviation routing decides
  audit: null, // validator side-effect, no onward routing
};

// Translate a \`from='system'\` event with metadata.tool=qa-check-effect@v1
// (kind=qa.result, etc.) onto the qa_check node so the ripple animates from
// the right column. The reducer still emits these as from='system' for
// backwards compatibility — only the visualization remaps.
function rippleFromActor(msg) {
  if (msg.from === 'system' && msg.metadata?.tool === 'qa-check-effect@v1') return 'qa_check';
  return msg.from;
}
// Verdict-based branching for verify.result / judge.score. PASS → done,
// FAIL/REJECT splits on circuit breaker state at the time of emission. We
// can't read state from the reducer here, but we can fall back to the
// most-likely path (rollback to planner) when breaker info isn't visible.
function weaveTargetForVerdict(msg) {
  const scores = msg.scores ?? msg.data ?? {};
  const verdict = scores.verdict;
  if (verdict === 'PASS') return 'done';
  if (verdict === 'PARTIAL') return null; // user-confirm hook, no spawn
  if (verdict === 'FAIL' || verdict === 'REJECT') {
    // PR-G2 + PR-Prune-2 routing — circuit OPEN now triggers an adapter
    // swap on the same builder actor (not a separate fallback). So the next
    // spawn target is \`builder\` regardless of breaker state. Critical
    // deviation still rolls back to planner-lead.
    const deviation = scores.deviation?.type ?? 'Important';
    return deviation === 'Critical' ? 'planner-lead' : 'builder';
  }
  return null;
}

function weaveOnAppend(msg) {
  let target;
  if (msg.kind === 'handoff.requested') {
    target = msg.to || msg.data?.to || null;
  } else if (msg.kind === 'handoff.rollback') {
    // PR-G2 — same deviation-typed routing as the verdict path.
    const dev = msg.data?.deviation?.type ?? 'Important';
    target = dev === 'Critical' ? 'planner-lead' : 'builder';
  } else if (msg.kind === 'verify.result' || msg.kind === 'judge.score') {
    target = weaveTargetForVerdict(msg);
  } else {
    target = WEAVE_TARGET[msg.kind];
  }
  const sourceActor = rippleFromActor(msg);
  if (target && DAG_NODES[target]) rippleEdge(sourceActor, target);
  renderDag();
}

// ─── v3.4 Console input — POST /api/sessions/:id/inbox ────────────────────

function setConsoleEnabled(enabled) {
  $('console-line').disabled = !enabled;
  $('console-send').disabled = !enabled;
}

function renderConsoleHints() {
  const hints = [
    '/approve',
    '/veto rebuild',
    '/pause',
    '/resume',
    '/goto verifier',
    '@builder use red palette',
    '/note <text>',
    '/redo',
  ];
  const root = $('console-hints');
  root.innerHTML = hints
    .map((h) => '<button data-line="' + escapeHTML(h) + '">' + escapeHTML(h) + '</button>')
    .join('');
  root.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      $('console-line').value = btn.dataset.line;
      $('console-line').focus();
    });
  });
}

async function sendInboxLine(sessionId, line, feedbackEl) {
  if (!line || line.trim().length === 0) return;
  feedbackEl.textContent = 'sending…';
  feedbackEl.className = 'console-feedback';
  try {
    const res = await fetch('/api/sessions/' + encodeURIComponent(sessionId) + '/inbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ line }),
    });
    if (!res.ok) {
      const txt = await res.text();
      feedbackEl.textContent = '✗ ' + res.status + ': ' + txt.slice(0, 200);
      feedbackEl.className = 'console-feedback err';
      return;
    }
    feedbackEl.textContent =
      '✓ queued — watcher will surface the resulting event in the swimlane shortly';
    feedbackEl.className = 'console-feedback ok';
  } catch (err) {
    feedbackEl.textContent = '✗ ' + err.message;
    feedbackEl.className = 'console-feedback err';
  }
}

$('console-send').addEventListener('click', () => {
  if (!activeSession) return;
  const line = $('console-line').value;
  sendInboxLine(activeSession, line, $('console-feedback'));
  $('console-line').value = '';
});
$('console-line').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    $('console-send').click();
  }
});
renderConsoleHints();

// Per-actor mini-console inside the detail panel.
$('detail-msg-send').addEventListener('click', () => {
  if (!activeSession) return;
  const evt = currentDetailEvent;
  if (!evt) return;
  let line = $('detail-msg').value.trim();
  if (!line) return;
  // If the user didn't already prefix with @actor or /, mention this actor.
  if (!/^[@/]/.test(line)) line = '@' + evt.from + ' ' + line;
  sendInboxLine(activeSession, line, $('detail-msg-feedback'));
  $('detail-msg').value = '';
});
$('detail-msg').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    $('detail-msg-send').click();
  }
});

// Detail navigation — parent chain + children list.
let currentDetailEvent = null;
const _origShowDetail = showDetail;
showDetail = function (id) {
  _origShowDetail(id);
  if (!activeSession) return;
  const events = eventCache.get(activeSession) ?? [];
  const evt = events.find((e) => e.id === id);
  if (!evt) return;
  currentDetailEvent = evt;
  $('detail-pipeline-pos').textContent = '◇ ' + pipelinePositionFor(evt);
  // Thread: parent → this → children
  const parent = evt.parent_event_id ? events.find((e) => e.id === evt.parent_event_id) : null;
  const children = events.filter((e) => e.parent_event_id === evt.id);
  const lines = [];
  if (parent)
    lines.push(
      '↑ parent: ' + parent.from + ' / ' + parent.kind + ' — ' + (parent.body || '').slice(0, 80),
    );
  lines.push('● this  : ' + evt.from + ' / ' + evt.kind + ' — ' + (evt.body || '').slice(0, 80));
  for (const c of children)
    lines.push('↓ child : ' + c.from + ' / ' + c.kind + ' — ' + (c.body || '').slice(0, 80));
  $('detail-thread').innerHTML = lines.map((l) => '<div>' + escapeHTML(l) + '</div>').join('');
  $('detail-prev').disabled = !parent;
  $('detail-next').disabled = children.length === 0;
  $('detail-prev').onclick = () => parent && showDetail(parent.id);
  $('detail-next').onclick = () => children[0] && showDetail(children[0].id);
};

// Hook DAG re-render + weaving into the existing append handler. The original
// Q5: append-handler fan-out (was: independent es.addEventListener('append'))
onAppendMsg((d) => {
  if (d.session_id === activeSession) {
    weaveOnAppend(d.msg);
  }
});
es.addEventListener('session_start', (e) => {
  const d = JSON.parse(e.data);
  if (d.session_id === activeSession) renderDag();
});

// On session select, also reflect into DAG + console enable.
onSessionSelect((id) => {
  setConsoleEnabled(Boolean(id));
  renderDag();
});

// Initial DAG render after first paint.
setTimeout(renderDag, 0);

// ─── v3.4 Logs view (ArgoCD-inspired) ──────────────────────────────────────
// Tab toggle between Pipeline (DAG + swimlane + scorecard + console) and
// Logs (per-actor live tail of <session>/agent-workspace/<actor>/spawn-*.log).

let activeView = 'pipeline';
let activeLogActor = null;

/**
 * v0.5 PR-6 — Logs panel state machine + race-guard.
 *
 * Frontier convention (ArgoCD pod-logs / Supabase Logs Explorer / Datadog
 * live tail): a single object holds the in-flight state, every async path
 * checks \`token\` before mutating buffer/DOM, and connection state is one
 * of 6 explicit values (no implicit "reconnecting forever" placeholder).
 *
 * State machine:
 *   idle → awaiting-actor → connecting → streaming
 *                                    └─→ stalled (heartbeat dead-air)
 *                                    └─→ errored (snapshot fail / SSE max-retries)
 *
 * Token: monotonically increasing. Every actor/session change increments
 * it; stale fetch / SSE handlers read myToken !== logsCtl.token and bail
 * before pushing into the buffer or touching the DOM.
 *
 * AbortController: the in-flight \`fetch()\` is aborted when token bumps so
 * the stale request never resolves into the new actor's panel.
 *
 * Heartbeat watchdog: SSE server emits :heartbeat every 15s. We track
 * lastHeartbeatTs; if no traffic (heartbeat OR chunk OR rotate) arrives
 * for HEARTBEAT_TIMEOUT_MS we transition to \`stalled\` + start an
 * exponential-backoff reconnect countdown (1s → 2s → 4s → 8s → 16s cap).
 */
const HEARTBEAT_TIMEOUT_MS = 30_000;
const BACKOFF_INITIAL_MS = 1_000;
const BACKOFF_CAP_MS = 16_000;

const logsCtl = {
  state: 'idle', // 'idle' | 'awaiting-actor' | 'connecting' | 'streaming' | 'stalled' | 'errored'
  token: 0,
  abortCtl: null,
  es: null,
  hbTimer: null,
  lastHeartbeatTs: 0,
  backoffMs: BACKOFF_INITIAL_MS,
  reconnectCountdownTimer: null,
  followAuto: true, // user-scrolling-up auto-disables; "Jump to live" re-enables
};

const logBuffer = []; // [{ kind: 'snapshot' | 'rotate' | 'chunk', file, text }]

function setActiveView(view) {
  activeView = view;
  document.querySelectorAll('nav.view-tabs button').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  document.querySelectorAll('.view-pane').forEach((p) => {
    p.classList.toggle('active', p.id === 'view-' + view);
  });
  if (view === 'logs') {
    renderLogActorList();
    if (!activeSession) {
      setLogsState('idle');
    } else if (activeLogActor) {
      // Returning to the Logs tab — re-render with current state, don't
      // tear down the connection if it's still streaming.
      renderLogContent();
    } else {
      const s = sessions.get(activeSession);
      if (s?.actors?.length) selectLogActor(s.actors[0]);
      else setLogsState('awaiting-actor');
    }
  } else if (view === 'waterfall') {
    // v0.5 PR-O3 — Wall-clock-proportional span view. Re-renders on every
    // tab entry so newly-arrived spawns / spans are reflected. Append
    // handler also calls renderWaterfall() when the active view is
    // 'waterfall' so the bars grow live.
    renderWaterfall();
  } else {
    // Tab switched away from logs / waterfall — keep the EventSource alive
    // so background chunks accumulate, but if we're in a transient state
    // (connecting / stalled) we don't gain anything by holding it. Frontier
    // convention (Datadog, ArgoCD) is to keep streaming connections warm
    // across tab switches; we follow that here.
  }
}

document.querySelectorAll('nav.view-tabs button').forEach((b) => {
  b.addEventListener('click', () => setActiveView(b.dataset.view));
});

function renderLogActorList() {
  const root = $('logs-actor-list');
  if (!activeSession) {
    root.innerHTML = '<div class="logs-empty">Pick a session first.</div>';
    return;
  }
  const s = sessions.get(activeSession);
  const actors = (s?.actors ?? []).slice();
  if (actors.length === 0) {
    root.innerHTML = '<div class="logs-empty">No actors have spawned yet.</div>';
    return;
  }
  // ArgoCD pod-status parity — recent / errored signals drive the dot color.
  const events = eventCache.get(activeSession) ?? [];
  const erroredActors = new Set();
  for (const e of events) if (e.kind === 'error') erroredActors.add(e.from);
  const recentActor = events[events.length - 1]?.from;

  root.innerHTML = actors
    .map((a) => {
      const cls = ['logs-actor-row'];
      if (a === activeLogActor) cls.push('active');
      if (a === recentActor) cls.push('live');
      if (erroredActors.has(a)) cls.push('errored');
      return (
        '<div class="' +
        cls.join(' ') +
        '" data-actor="' +
        escapeHTML(a) +
        '">' +
        '<span class="dot"></span>' +
        escapeHTML(a) +
        '</div>'
      );
    })
    .join('');
  root.querySelectorAll('.logs-actor-row').forEach((row) => {
    row.addEventListener('click', () => selectLogActor(row.dataset.actor));
  });
}

/**
 * State transition — single source of truth. Mutates \`logsCtl.state\`,
 * pushes a render. Every renderLogContent() / renderLogsConnStatus() reads
 * this. ArgoCD / Datadog parity.
 */
function setLogsState(next, msg) {
  logsCtl.state = next;
  renderLogsConnStatus(next, msg ?? '');
  renderLogContent();
}

function selectLogActor(actor) {
  // 1. Bump token; abort in-flight fetch + close prior SSE + clear watchdog.
  const myToken = ++logsCtl.token;
  if (logsCtl.abortCtl) logsCtl.abortCtl.abort();
  closeLogStream();
  logBuffer.length = 0;
  logsCtl.backoffMs = BACKOFF_INITIAL_MS;
  logsCtl.followAuto = true;

  activeLogActor = actor;
  $('logs-current-actor').textContent = actor;
  renderLogActorList();

  if (!actor || !activeSession) {
    setLogsState('awaiting-actor');
    return;
  }

  // 2. Snapshot fetch with AbortSignal.
  // v0.5 PR-9: debounce the visible 'connecting' transition. User feedback
  // — actor switches were briefly painting amber even on fast (<150ms)
  // snapshot responses. Frontier convention (Linear / Datadog facet
  // panels): hold the previous state for ~150ms; if the new state lands
  // within that window we never repaint to the intermediate "connecting"
  // chrome. Slow responses (network hiccup) still surface amber as
  // expected.
  const debounceTimer = setTimeout(() => {
    if (myToken === logsCtl.token && logsCtl.state !== 'streaming') {
      setLogsState('connecting', \`loading \${actor}…\`);
    }
  }, 150);

  logsCtl.abortCtl = new AbortController();
  fetch(
    '/api/sessions/' + encodeURIComponent(activeSession) + '/logs/' + encodeURIComponent(actor),
    { signal: logsCtl.abortCtl.signal },
  )
    .then((r) => r.text())
    .then((text) => {
      clearTimeout(debounceTimer);
      // 3. STALE GUARD — user clicked another actor / session in flight.
      if (myToken !== logsCtl.token) return;
      logBuffer.push({ kind: 'snapshot', file: 'snapshot', text });
      openLogStream(actor, myToken);
    })
    .catch((err) => {
      clearTimeout(debounceTimer);
      if (err.name === 'AbortError') return; // expected on token bump
      if (myToken !== logsCtl.token) return;
      setLogsState('errored', \`snapshot failed: \${err.message}\`);
    });
}

function openLogStream(actor, parentToken) {
  // Caller passes its token so SSE handlers can stale-guard symmetrically
  // with the snapshot path. Without this, a long-lived EventSource attached
  // to actor A keeps pushing chunks after the user clicked actor B.
  closeLogStream();
  const url =
    '/api/sessions/' +
    encodeURIComponent(activeSession) +
    '/logs/' +
    encodeURIComponent(actor) +
    '/stream';
  const es = new EventSource(url);
  logsCtl.es = es;
  logsCtl.lastHeartbeatTs = Date.now();
  startHeartbeatWatchdog();

  setLogsState('streaming');

  es.addEventListener('rotate', (e) => {
    if (parentToken !== logsCtl.token) return;
    const d = JSON.parse(e.data);
    logBuffer.push({ kind: 'rotate', file: d.file, text: '' });
    logsCtl.lastHeartbeatTs = Date.now();
    if (logsCtl.state !== 'streaming') setLogsState('streaming');
    else renderLogContent();
  });
  es.addEventListener('chunk', (e) => {
    if (parentToken !== logsCtl.token) return;
    const d = JSON.parse(e.data);
    logBuffer.push({ kind: 'chunk', file: d.file, text: d.text });
    logsCtl.lastHeartbeatTs = Date.now();
    if (logsCtl.state !== 'streaming') setLogsState('streaming');
    else renderLogContent();
  });
  es.addEventListener('heartbeat', () => {
    if (parentToken !== logsCtl.token) return;
    logsCtl.lastHeartbeatTs = Date.now();
    if (logsCtl.state === 'stalled') setLogsState('streaming');
  });
  es.addEventListener('open', () => {
    if (parentToken !== logsCtl.token) return;
    logsCtl.lastHeartbeatTs = Date.now();
    logsCtl.backoffMs = BACKOFF_INITIAL_MS;
    if (logsCtl.state !== 'streaming') setLogsState('streaming');
  });
  es.onerror = () => {
    if (parentToken !== logsCtl.token) return;
    // EventSource auto-reconnects on transient drops; we only escalate if
    // the watchdog confirms dead-air. The browser default is ~3s; we let
    // it try once silently before showing the stalled banner.
    if (logsCtl.state === 'streaming') {
      setLogsState('stalled', 'connection lost — auto-reconnecting…');
    }
  };
}

function closeLogStream() {
  if (logsCtl.es) {
    try {
      logsCtl.es.close();
    } catch {
      // ignore
    }
    logsCtl.es = null;
  }
  if (logsCtl.hbTimer) {
    clearInterval(logsCtl.hbTimer);
    logsCtl.hbTimer = null;
  }
  if (logsCtl.reconnectCountdownTimer) {
    clearInterval(logsCtl.reconnectCountdownTimer);
    logsCtl.reconnectCountdownTimer = null;
  }
}

/**
 * Heartbeat watchdog — fires every 5s, escalates to \`stalled\` when the
 * gap from lastHeartbeatTs exceeds HEARTBEAT_TIMEOUT_MS. Datadog/Honeycomb
 * pattern: never trust EventSource's auto-reconnect alone; user needs a
 * visible signal when traffic dies.
 */
function startHeartbeatWatchdog() {
  if (logsCtl.hbTimer) clearInterval(logsCtl.hbTimer);
  logsCtl.hbTimer = setInterval(() => {
    if (logsCtl.state !== 'streaming') return;
    const ago = Date.now() - logsCtl.lastHeartbeatTs;
    if (ago > HEARTBEAT_TIMEOUT_MS) {
      setLogsState(
        'stalled',
        \`last heartbeat \${Math.floor(ago / 1000)}s ago — auto-reconnect queued\`,
      );
      startReconnectCountdown(Math.ceil(logsCtl.backoffMs / 1000));
      logsCtl.backoffMs = Math.min(logsCtl.backoffMs * 2, BACKOFF_CAP_MS);
    }
  }, 5_000);
}

/**
 * Stripe CLI / Sentry replay pattern — visible countdown to next reconnect
 * attempt, with a manual "Reconnect now" affordance. Force-reconnect
 * resets backoff to baseline.
 */
function startReconnectCountdown(seconds) {
  if (logsCtl.reconnectCountdownTimer) clearInterval(logsCtl.reconnectCountdownTimer);
  let left = seconds;
  renderLogsConnStatus('stalled', \`reconnecting in \${left}s…\`);
  logsCtl.reconnectCountdownTimer = setInterval(() => {
    left--;
    if (left <= 0) {
      clearInterval(logsCtl.reconnectCountdownTimer);
      logsCtl.reconnectCountdownTimer = null;
      forceLogsReconnect();
    } else {
      renderLogsConnStatus('stalled', \`reconnecting in \${left}s…\`);
    }
  }, 1000);
}

function forceLogsReconnect() {
  logsCtl.backoffMs = BACKOFF_INITIAL_MS;
  if (activeLogActor && activeSession) selectLogActor(activeLogActor);
}

/**
 * Connection-status pill in the logs toolbar. 5 visual states:
 *   idle / awaiting-actor — gray
 *   connecting           — amber, spin
 *   streaming            — green, slow-pulse, label "Live"
 *   stalled              — amber, with "Reconnect now" button
 *   errored              — red, with "Reconnect now" button
 */
function renderLogsConnStatus(state, msg) {
  const pill = $('logs-conn-status');
  if (!pill) return;
  pill.className = 'logs-conn-status state-' + state;
  // v0.5 PR-9 — when SSE is up, derive the label from real actor lifecycle
  // state pulled from the transcript, not just "live". User feedback:
  // the pill should reflect what the actor is doing right now, not
  // merely "the SSE pipe is open".
  //   - actor produced events in last 30s          → "live · streaming"
  //   - last event is 'agent.stop' / 'done'         → "live · idle (done)"
  //   - last event is 'error'                       → "live · errored"
  //   - actor has no events yet                     → "live · waiting"
  // Other states (idle / connecting / stalled / errored) keep their
  // default labels — those are network-layer conditions, not actor
  // lifecycle, so mixing semantics would confuse readers.
  const baseLabels = {
    idle: 'pick session',
    'awaiting-actor': 'pick actor',
    connecting: 'connecting',
    streaming: 'live',
    stalled: 'stalled',
    errored: 'disconnected',
  };
  let label = baseLabels[state] ?? state;
  if (state === 'streaming' && activeLogActor && activeSession) {
    const events = (eventCache.get(activeSession) ?? []).filter((e) => e.from === activeLogActor);
    const last = events[events.length - 1];
    if (!last) {
      label = 'live · waiting';
    } else if (last.kind === 'error') {
      label = 'live · errored';
    } else if (last.kind === 'agent.stop' || last.kind === 'done') {
      label = 'live · idle';
    } else {
      const ageMs = Date.now() - new Date(last.ts).getTime();
      label = ageMs < 30_000 ? 'live · streaming' : 'live · idle';
    }
  }
  const showRetry = state === 'stalled' || state === 'errored';
  pill.innerHTML =
    '<span class="logs-conn-dot"></span>' +
    '<span class="logs-conn-label">' +
    escapeHTML(label) +
    '</span>' +
    (msg ? '<span class="logs-conn-msg">' + escapeHTML(msg) + '</span>' : '') +
    (showRetry
      ? '<button class="logs-conn-retry" id="logs-conn-retry-btn">Reconnect now</button>'
      : '');
  const retryBtn = document.getElementById('logs-conn-retry-btn');
  if (retryBtn) retryBtn.addEventListener('click', forceLogsReconnect);
}

function renderLogContent() {
  const root = $('logs-content');
  if (!root) return;

  // 5-state empty-state copy (Supabase Logs Explorer pattern — intent-keyed,
  // never reuse a generic "no data" label). Each transition the user lives
  // through gets its own message + class.
  if (!activeSession) {
    root.innerHTML = '<div class="logs-empty">Pick a session from the sidebar.</div>';
    refreshGrepNav('logs', root, $('logs-grep-count'), $('logs-grep-prev'), $('logs-grep-next'));
    return;
  }
  if (!activeLogActor) {
    root.innerHTML = '<div class="logs-empty">Pick an actor on the left to tail its logs.</div>';
    refreshGrepNav('logs', root, $('logs-grep-count'), $('logs-grep-prev'), $('logs-grep-next'));
    return;
  }
  if (logsCtl.state === 'connecting') {
    root.innerHTML =
      '<div class="logs-empty logs-empty--loading">Loading ' +
      escapeHTML(activeLogActor) +
      '…</div>';
    refreshGrepNav('logs', root, $('logs-grep-count'), $('logs-grep-prev'), $('logs-grep-next'));
    return;
  }
  if (logsCtl.state === 'errored') {
    root.innerHTML =
      '<div class="logs-empty logs-empty--errored">Disconnected from ' +
      escapeHTML(activeLogActor) +
      '’s log stream. Use the <strong>Reconnect now</strong> button above.</div>';
    refreshGrepNav('logs', root, $('logs-grep-count'), $('logs-grep-prev'), $('logs-grep-next'));
    return;
  }

  const query = grepState.logs.query;
  const lines = [];
  let inStderr = false;
  for (const entry of logBuffer) {
    if (entry.kind === 'rotate') {
      lines.push({ kind: 'section', text: '── new spawn: ' + entry.file + ' ──' });
      inStderr = false;
      continue;
    }
    for (const raw of entry.text.split('\\n')) {
      if (/^--- stderr ---$/.test(raw)) {
        inStderr = true;
        lines.push({ kind: 'section', text: raw });
        continue;
      }
      if (/^--- stdout ---$/.test(raw)) {
        inStderr = false;
        lines.push({ kind: 'section', text: raw });
        continue;
      }
      if (/^=== adapter /.test(raw)) {
        lines.push({ kind: 'section', text: raw });
        continue;
      }
      lines.push({ kind: inStderr ? 'stderr' : 'stdout', text: raw });
    }
  }

  // Detect "no real output" vs "actor never spawned". Server returns
  // \`(no spawn log yet for <actor> in this session)\` 47-byte body when the
  // agent-workspace dir has 0 spawn-*.log files. We split that case out so
  // the user sees the right intent.
  const totalText = logBuffer
    .map((b) => b.text || '')
    .join('')
    .trim();
  const neverSpawned = /no spawn log yet for /.test(totalText);
  if (lines.length === 0 || (logBuffer.length === 1 && neverSpawned)) {
    if (neverSpawned) {
      root.innerHTML =
        '<div class="logs-empty logs-empty--never-spawned">' +
        escapeHTML(activeLogActor) +
        ' hasn’t spawned yet. Logs will appear here the moment it does.</div>';
    } else if (logsCtl.state === 'streaming') {
      root.innerHTML =
        '<div class="logs-empty logs-empty--waiting">Connected. Waiting for first output…</div>';
    } else {
      root.innerHTML = '<div class="logs-empty">no output yet</div>';
    }
    refreshGrepNav('logs', root, $('logs-grep-count'), $('logs-grep-prev'), $('logs-grep-next'));
    return;
  }

  const visible = lines.slice(-4000); // cap DOM cost; full log lives on disk.
  const qLower = query.toLowerCase();
  const html = visible
    .map((l) => {
      const cls = ['log-line'];
      if (l.kind === 'stderr') cls.push('stderr');
      if (l.kind === 'section') cls.push('section');
      if (query && l.text.toLowerCase().includes(qLower)) cls.push('has-match');
      return '<div class="' + cls.join(' ') + '">' + highlightHTML(l.text, query) + '</div>';
    })
    .join('');
  root.innerHTML = html;

  // GitHub Actions pattern — auto-unfollow when the user scrolls up. The
  // initial scroll-to-bottom still happens via the explicit followAuto flag,
  // but a scroll-up gesture flips it off. The status pill / "Jump to live"
  // button can flip it back on.
  if ($('logs-follow').checked && logsCtl.followAuto) {
    root.scrollTop = root.scrollHeight;
  }
  refreshGrepNav('logs', root, $('logs-grep-count'), $('logs-grep-prev'), $('logs-grep-next'));
}

bindGrepInput($('logs-filter'), $('logs-grep-prev'), $('logs-grep-next'), 'logs', renderLogContent);
$('logs-grep-prev').addEventListener('click', () =>
  gotoGrepMatch('logs', -1, $('logs-grep-count')),
);
$('logs-grep-next').addEventListener('click', () => gotoGrepMatch('logs', 1, $('logs-grep-count')));
$('logs-clear').addEventListener('click', () => {
  logBuffer.length = 0;
  renderLogContent();
});
$('logs-copy').addEventListener('click', () => {
  const text = $('logs-content').textContent || '';
  navigator.clipboard?.writeText(text);
});

// v0.5 PR-6 — scroll-up auto-unfollow + "Jump to live" affordance.
// GitHub Actions live-log pattern: when the user scrolls up to read older
// output, stop force-scrolling to bottom on every chunk; show a floating
// button that re-engages follow + scrolls to the tail.
const SCROLL_BOTTOM_THRESHOLD_PX = 24;
$('logs-content').addEventListener('scroll', () => {
  const root = $('logs-content');
  const distance = root.scrollHeight - root.scrollTop - root.clientHeight;
  const atBottom = distance < SCROLL_BOTTOM_THRESHOLD_PX;
  const wasAuto = logsCtl.followAuto;
  logsCtl.followAuto = atBottom;
  const jump = $('logs-jump-live');
  if (jump) jump.style.display = atBottom ? 'none' : '';
  // Repaint follow checkbox state for clarity (sticky vs auto-suspended).
  const cb = $('logs-follow');
  if (cb && wasAuto !== logsCtl.followAuto && cb.checked) {
    // Don't actually flip the user's checkbox; the auto state is internal.
    // We just expose it via the jump button. Vercel CLI / ArgoCD pattern.
  }
});

$('logs-jump-live')?.addEventListener('click', () => {
  const root = $('logs-content');
  root.scrollTop = root.scrollHeight;
  logsCtl.followAuto = true;
  $('logs-jump-live').style.display = 'none';
});

// v0.5 PR-6 — session change resets the logs panel hard. Without this the
// previous session's actor stays selected + its EventSource keeps pushing
// stale chunks into the new session's panel.
onSessionSelect(() => {
  ++logsCtl.token;
  if (logsCtl.abortCtl) logsCtl.abortCtl.abort();
  closeLogStream();
  logBuffer.length = 0;
  activeLogActor = null;
  if ($('logs-current-actor')) $('logs-current-actor').textContent = '—';
  setLogsState(activeSession ? 'awaiting-actor' : 'idle');
});

// Initial paint — connection pill reflects the boot state.
setLogsState('idle');

// DAG node click → jump to logs tab + select that actor (ArgoCD application
// graph → pod logs single-click navigation).
document.addEventListener('click', (e) => {
  const node = e.target.closest('.dag-node');
  if (!node) return;
  const actor = node.dataset.actor;
  if (!actor || !activeSession) return;
  setActiveView('logs');
  selectLogActor(actor);
});

// Refresh the logs sidebar when session changes / new agent.wake arrives so
// the freshly-spawned actor shows up immediately.
onSessionSelect(() => {
  if (activeView === 'logs') renderLogActorList();
});

// ─── v3.5 console — Output tab + new-session form + live execution feed ───
//
// "/crumb <text>" in the input bar  → POST /api/crumb/run (spawn a new session
//                                     with that goal as a child process)
// "/approve | /veto | @actor ..."   → existing inbox forward (PR #56)
// plain text                        → existing inbox forward as user.intervene

// ── (1) Live execution feed — terminal-like console above the input bar ──
//
// v0.4.2 — split into TWO stacked panels with a draggable horizontal handle:
//   1) Agent narrative (top)    — rendered stream-json bubbles only
//                                  (⏺ assistant text / ⏺ tool_use /
//                                  ⎿ tool_result / ✓ turn complete).
//   2) Live execution feed (bot) — every other transcript event:
//                                  agent.wake / error / handoff / plain
//                                  log / system. Same body/grep/pause/clear
//                                  controls as before.
// The horizontal handle (\`#feedstack-resize\`) writes \`--narrative-h\` to
// \`<body>\` and persists in localStorage \`crumb.narrative-h\`.

let feedPaused = false;
let narrativePaused = false;
const FEED_MAX_LINES = 2000; // bumped from 800 — stream-json rendering produces 3-5× line density
const NARRATIVE_MAX_LINES = 4000; // narrative is denser than the feed (multi-line tool results)

// v0.4.1 PR-F D — newest-first ordering + repeat-collapse badge.
// Behavior change: feed grows TOP-DOWN (newest at top, oldest scrolling
// off the bottom). Same actor + same kindClass + same body within a 60s
// window collapses into the existing top row with a "×N" badge in the
// upper-right. Reset on any non-matching event so a different kind reopens
// the timeline cleanly.
function feedRepeatKey(meta) {
  return [meta.actor || '', meta.kindClass || '', (meta.body || '').slice(0, 200)].join('|');
}

function appendFeedLine(meta) {
  const root = $('console-feed-body');
  if (!root) return;
  if (feedPaused) return;
  const ts = (meta.ts || new Date().toISOString()).split('T')[1]?.slice(0, 8) || '--:--:--';

  // Repeat-collapse: if the most-recent (top) row matches this event's
  // signature within the dedup window, bump its ×N badge instead of
  // inserting a new row.
  const top = root.firstChild;
  const key = feedRepeatKey(meta);
  if (top && top.dataset && top.dataset.repeatKey === key) {
    const lastTs = Number(top.dataset.lastTs || 0);
    const now = Date.now();
    if (now - lastTs < 60_000) {
      const count = (Number(top.dataset.repeatCount) || 1) + 1;
      top.dataset.repeatCount = String(count);
      top.dataset.lastTs = String(now);
      let badge = top.querySelector('.feed-repeat-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'feed-repeat-badge';
        top.appendChild(badge);
      }
      badge.textContent = '×' + count;
      // Refresh the timestamp on the row so the user sees it's still active.
      const tsEl = top.querySelector('.feed-ts');
      if (tsEl) tsEl.textContent = ts;
      return;
    }
  }

  const cls = ['feed-line'];
  if (meta.kindClass) cls.push('kind-' + meta.kindClass);
  if (meta.stderr) cls.push('stderr');
  const div = document.createElement('div');
  div.className = cls.join(' ');
  div.dataset.repeatKey = key;
  div.dataset.repeatCount = '1';
  div.dataset.lastTs = String(Date.now());
  const tsSpan = document.createElement('span');
  tsSpan.className = 'feed-ts';
  tsSpan.textContent = ts;
  const actorSpan = document.createElement('span');
  actorSpan.className = 'feed-actor';
  actorSpan.textContent = meta.actor || '';
  const bodySpan = document.createElement('span');
  bodySpan.className = 'feed-body';
  bodySpan.dataset.raw = meta.body || '';
  if (grepState.feed.query) {
    bodySpan.innerHTML = highlightHTML(meta.body || '', grepState.feed.query);
  } else {
    bodySpan.textContent = meta.body || '';
  }
  div.appendChild(tsSpan);
  div.appendChild(actorSpan);
  div.appendChild(bodySpan);
  // Newest-first: prepend instead of append, drop oldest from the bottom.
  if (root.firstChild) {
    root.insertBefore(div, root.firstChild);
  } else {
    root.appendChild(div);
  }
  while (root.childNodes.length > FEED_MAX_LINES) root.removeChild(root.lastChild);
  // Pin scroll to the top so the latest row is visible.
  root.scrollTop = 0;
  // Re-collect matches so the counter reflects the newly-streamed line. Keep cursor in place.
  if (grepState.feed.query) {
    refreshGrepNav(
      'feed',
      root,
      $('console-feed-grep-count'),
      $('console-feed-grep-prev'),
      $('console-feed-grep-next'),
    );
  }
}

// v0.4.2 — Agent narrative panel writer. Same shape as appendFeedLine
// (timestamp / actor / body row, repeat-collapse, top-down newest-first,
// grep-aware) but writes into #console-narrative-body and respects its
// own pause flag. Kept as a separate function rather than parameterizing
// appendFeedLine so the two panels can diverge later (column widths,
// max-lines, repeat window) without coupling.
function appendNarrativeLine(meta) {
  const root = $('console-narrative-body');
  if (!root) return;
  if (narrativePaused) return;
  const ts = (meta.ts || new Date().toISOString()).split('T')[1]?.slice(0, 8) || '--:--:--';
  const top = root.firstChild;
  const key = feedRepeatKey(meta);
  if (top && top.dataset && top.dataset.repeatKey === key) {
    const lastTs = Number(top.dataset.lastTs || 0);
    const now = Date.now();
    if (now - lastTs < 60_000) {
      const count = (Number(top.dataset.repeatCount) || 1) + 1;
      top.dataset.repeatCount = String(count);
      top.dataset.lastTs = String(now);
      let badge = top.querySelector('.feed-repeat-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'feed-repeat-badge';
        top.appendChild(badge);
      }
      badge.textContent = '×' + count;
      const tsEl = top.querySelector('.feed-ts');
      if (tsEl) tsEl.textContent = ts;
      return;
    }
  }
  const cls = ['feed-line'];
  if (meta.kindClass) cls.push('kind-' + meta.kindClass);
  if (meta.stderr) cls.push('stderr');
  const div = document.createElement('div');
  div.className = cls.join(' ');
  div.dataset.repeatKey = key;
  div.dataset.repeatCount = '1';
  div.dataset.lastTs = String(Date.now());
  const tsSpan = document.createElement('span');
  tsSpan.className = 'feed-ts';
  tsSpan.textContent = ts;
  const actorSpan = document.createElement('span');
  actorSpan.className = 'feed-actor';
  actorSpan.textContent = meta.actor || '';
  const bodySpan = document.createElement('span');
  bodySpan.className = 'feed-body';
  bodySpan.dataset.raw = meta.body || '';
  if (grepState.narrative?.query) {
    bodySpan.innerHTML = highlightHTML(meta.body || '', grepState.narrative.query);
  } else {
    bodySpan.textContent = meta.body || '';
  }
  div.appendChild(tsSpan);
  div.appendChild(actorSpan);
  div.appendChild(bodySpan);
  if (root.firstChild) {
    root.insertBefore(div, root.firstChild);
  } else {
    root.appendChild(div);
  }
  while (root.childNodes.length > NARRATIVE_MAX_LINES) root.removeChild(root.lastChild);
  root.scrollTop = 0;
  if (grepState.narrative?.query) {
    refreshGrepNav(
      'narrative',
      root,
      $('console-narrative-grep-count'),
      $('console-narrative-grep-prev'),
      $('console-narrative-grep-next'),
    );
  }
}

function rehighlightNarrative() {
  const root = $('console-narrative-body');
  if (!root) return;
  const q = grepState.narrative?.query;
  for (const body of root.querySelectorAll('.feed-body')) {
    const raw = body.dataset.raw ?? body.textContent ?? '';
    if (q) body.innerHTML = highlightHTML(raw, q);
    else body.textContent = raw;
  }
  refreshGrepNav(
    'narrative',
    root,
    $('console-narrative-grep-count'),
    $('console-narrative-grep-prev'),
    $('console-narrative-grep-next'),
    { scroll: !!q },
  );
}

// Re-highlight every existing feed line (called when the grep query changes).
function rehighlightFeed() {
  const root = $('console-feed-body');
  if (!root) return;
  const q = grepState.feed.query;
  for (const body of root.querySelectorAll('.feed-body')) {
    const raw = body.dataset.raw ?? body.textContent ?? '';
    if (q) body.innerHTML = highlightHTML(raw, q);
    else body.textContent = raw;
  }
  refreshGrepNav(
    'feed',
    root,
    $('console-feed-grep-count'),
    $('console-feed-grep-prev'),
    $('console-feed-grep-next'),
    { scroll: !!q },
  );
}

function classifyKindForFeed(kind) {
  if (kind === 'error') return 'error';
  if (kind === 'audit') return 'audit';
  if (kind === 'spec' || kind === 'spec.update') return 'spec';
  if (kind === 'build' || kind === 'qa.result') return 'build';
  if (kind === 'judge.score' || kind === 'verify.result' || kind.startsWith('step.judge'))
    return 'judge';
  if (kind.startsWith('handoff.')) return 'handoff';
  // PR-F B — stream-json tap surfaces tool_use as kind=tool.call. Render as
  // assistant-text style so it stands out from system notes but blends with
  // the actor's own narration. Repeat-collapse (PR-F D) handles the volume.
  if (kind === 'tool.call') return 'tool-call';
  if (kind === 'artifact.created') return 'build';
  if (kind === 'session.start' || kind === 'session.end' || kind === 'note') return 'system';
  return '';
}

// v0.5 PR-W-Studio-A — kind-specific feed formatters. The default
// \`[kind] body\` rendering is fine for unknown kinds, but several event
// kinds carry richer structured data (D1-D6 scores, exec_exit_code,
// tokens/cost/cache, deviation type) that the generic JSON.stringify
// truncation buries. Per-kind formatters surface what's actually
// load-bearing per row, like Datadog's per-event field projection.
//
// Each formatter returns the body string to display; metadata (ts, actor,
// kindClass) is filled in by feedLineFromTranscriptEvent. Returning null
// falls back to the generic renderer.
function _fmtNum(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '?';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(Math.round(n));
}
function _fmtCost(usd) {
  if (typeof usd !== 'number' || !Number.isFinite(usd)) return '?';
  return '$' + usd.toFixed(usd < 0.01 ? 4 : 3);
}
function _fmtMs(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '?';
  if (ms >= 60000) return (ms / 60000).toFixed(1) + 'm';
  if (ms >= 1000) return (ms / 1000).toFixed(1) + 's';
  return ms + 'ms';
}
function _fmtScores(scores) {
  if (!scores || typeof scores !== 'object') return '';
  const dims = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6']
    .map((k) => {
      const e = scores[k];
      const v = typeof e === 'number' ? e : e && typeof e === 'object' ? e.score : null;
      return typeof v === 'number' ? \`\${k}=\${v.toFixed(1)}\` : null;
    })
    .filter(Boolean);
  return dims.join(' ');
}

const FEED_FORMATTERS = {
  'session.start': (m) => {
    const goal = m.body || (m.data && m.data.goal) || '';
    const preset = m.data && m.data.preset ? \`preset=\${m.data.preset}\` : '';
    return \`🌱 session_start \${goal ? '· ' + goal.slice(0, 80) : ''} \${preset}\`.trim();
  },
  'session.end': (m) => \`🛑 session_end · \${m.body || ''}\`.trim(),
  goal: (m) => \`🎯 goal · \${(m.body || '').slice(0, 120)}\`,
  'agent.wake': (m) => \`▶ wake @\${m.from}\` + (m.body ? \` · \${m.body.slice(0, 80)}\` : ''),
  'agent.stop': (m) => {
    const md = m.metadata || {};
    const parts = [];
    if (md.latency_ms) parts.push(_fmtMs(md.latency_ms));
    if (typeof md.tokens_in === 'number') parts.push(\`in=\${_fmtNum(md.tokens_in)}\`);
    if (typeof md.tokens_out === 'number') parts.push(\`out=\${_fmtNum(md.tokens_out)}\`);
    if (typeof md.cache_read === 'number' && md.cache_read > 0) {
      const ratio = md.tokens_in ? Math.round((md.cache_read / md.tokens_in) * 100) : null;
      parts.push(\`cache=\${_fmtNum(md.cache_read)}\` + (ratio !== null ? \`(\${ratio}%)\` : ''));
    }
    if (typeof md.cost_usd === 'number') parts.push(_fmtCost(md.cost_usd));
    return \`■ stop @\${m.from}\` + (parts.length ? \` · \${parts.join(' · ')}\` : '');
  },
  spec: (m) => {
    const acCount =
      m.data && Array.isArray(m.data.acceptance_criteria)
        ? m.data.acceptance_criteria.length
        : null;
    return (
      \`📜 spec @\${m.from}\` +
      (acCount !== null ? \` · ac=\${acCount}\` : '') +
      (m.body ? \` · \${m.body.slice(0, 80)}\` : '')
    );
  },
  build: (m) => {
    const fileCount = m.data && Array.isArray(m.data.artifacts) ? m.data.artifacts.length : null;
    return (
      \`🔨 build @\${m.from}\` +
      (fileCount !== null ? \` · \${fileCount} files\` : '') +
      (m.body ? \` · \${m.body.slice(0, 60)}\` : '')
    );
  },
  'artifact.created': (m) => {
    const path = (m.data && m.data.path) || '';
    const sha = m.data && m.data.sha256 ? m.data.sha256.slice(0, 8) : '';
    return \`📄 artifact \${path}\${sha ? ' · sha=' + sha : ''}\`;
  },
  'qa.result': (m) => {
    const md = m.data || {};
    const exit = md.exec_exit_code;
    const acTotal = Array.isArray(md.ac_results) ? md.ac_results.length : null;
    const acPass = Array.isArray(md.ac_results)
      ? md.ac_results.filter((r) => r && r.pass === true).length
      : null;
    const parts = [];
    if (typeof exit === 'number') parts.push(\`exit=\${exit}\`);
    if (acTotal !== null) parts.push(\`ac=\${acPass}/\${acTotal}\`);
    if (md.duration_ms) parts.push(_fmtMs(md.duration_ms));
    return \`✅ qa.result\` + (parts.length ? \` · \${parts.join(' · ')}\` : '');
  },
  'judge.score': (m) => {
    const md = m.scores || m.data || {};
    const verdict = md.verdict || (m.data && m.data.verdict) || '';
    const dims = _fmtScores(md);
    const dev = md.deviation && md.deviation.type ? \`dev=\${md.deviation.type}\` : '';
    const verdictGlyph =
      verdict === 'PASS'
        ? '✓'
        : verdict === 'PARTIAL'
          ? '~'
          : verdict === 'FAIL' || verdict === 'REJECT'
            ? '✗'
            : '·';
    return (
      \`\${verdictGlyph} judge \${verdict}\` + (dims ? \` · \${dims}\` : '') + (dev ? \` · \${dev}\` : '')
    );
  },
  'verify.result': (m) => \`\${m.body ? m.body.slice(0, 100) : '✓ verify.result'}\`,
  'step.research': (m) => {
    const md = m.data || {};
    const refs = Array.isArray(md.reference_games) ? md.reference_games.length : null;
    const lessons = Array.isArray(md.design_lessons) ? md.design_lessons.length : null;
    return (
      \`🔬 research @\${m.from}\` +
      (refs !== null ? \` · \${refs} refs\` : '') +
      (lessons !== null ? \` · \${lessons} lessons\` : '')
    );
  },
  'step.research.video': (m) => {
    const md = m.data || {};
    const ext = Array.isArray(md.mechanics_extracted) ? md.mechanics_extracted.length : 0;
    const oo = Array.isArray(md.mechanics_out_of_envelope)
      ? md.mechanics_out_of_envelope.length
      : 0;
    return \`📹 research.video @\${m.from} · \${ext}+\${oo} mechanics\${oo ? ' (oo:' + oo + ')' : ''}\`;
  },
  'handoff.requested': (m) => {
    const to = m.to || (m.data && m.data.to) || '?';
    return \`→ handoff @\${m.from} → @\${to}\` + (m.body ? \` · \${m.body.slice(0, 60)}\` : '');
  },
  'handoff.rollback': (m) => {
    const to = m.to || (m.data && m.data.to) || '?';
    return \`↺ rollback → @\${to}\` + (m.body ? \` · \${m.body.slice(0, 60)}\` : '');
  },
  audit: (m) => {
    const rule = (m.data && m.data.rule) || '';
    return \`⚠ audit \${rule ? rule : ''}\` + (m.body ? \` · \${m.body.slice(0, 100)}\` : '');
  },
  error: (m) => \`❌ error @\${m.from} · \${(m.body || '').slice(0, 140)}\`,
  done: (m) => {
    const reason = (m.data && m.data.reason) || m.body || '';
    return \`🏁 done · \${reason}\`;
  },
  'user.intervene': (m) => {
    const md = m.data || {};
    const verb = md.cancel
      ? \`/cancel \${md.cancel}\`
      : md.goto
        ? \`/goto \${md.goto}\`
        : md.swap
          ? \`/swap \${md.swap.from}=\${md.swap.to}\`
          : md.reset_circuit
            ? \`/reset-circuit\`
            : md.sandwich_append
              ? \`/append\`
              : md.target_actor
                ? \`@\${md.target_actor}\`
                : '';
    return \`👤 \${verb || 'intervene'}\` + (m.body ? \` · \${m.body.slice(0, 100)}\` : '');
  },
  'user.approve': () => \`👤 ✓ approve\`,
  'user.veto': (m) =>
    \`👤 ✗ veto\${m.data && m.data.target_msg_id ? ' ' + m.data.target_msg_id : ''}\`,
  'user.pause': (m) => \`👤 ⏸ pause\${m.data && m.data.actor ? ' @' + m.data.actor : ' (global)'}\`,
  'user.resume': (m) => \`👤 ▶ resume\${m.data && m.data.actor ? ' @' + m.data.actor : ''}\`,
  note: (m) => \`· \${(m.body || '').slice(0, 140)}\`,
};

function feedLineFromTranscriptEvent(msg) {
  if (!msg) return null;
  const formatter = FEED_FORMATTERS[msg.kind];
  let body;
  if (formatter) {
    body = formatter(msg);
  } else {
    let raw = msg.body || '';
    if (!raw && msg.data) {
      try {
        raw = JSON.stringify(msg.data).slice(0, 200);
      } catch {
        raw = '(data)';
      }
    }
    body = '[' + msg.kind + '] ' + raw;
  }
  return {
    ts: msg.ts,
    actor: msg.from,
    body,
    kindClass: classifyKindForFeed(msg.kind),
  };
}

$('console-feed-pause').addEventListener('click', () => {
  feedPaused = !feedPaused;
  $('console-feed-pause').classList.toggle('paused', feedPaused);
  $('console-feed-pause').textContent = feedPaused ? 'paused' : 'pause';
  $('console-feed-status').textContent = feedPaused ? 'paused — incoming events queued' : '';
});
$('console-feed-clear').addEventListener('click', () => {
  $('console-feed-body').innerHTML = '';
  refreshGrepNav(
    'feed',
    $('console-feed-body'),
    $('console-feed-grep-count'),
    $('console-feed-grep-prev'),
    $('console-feed-grep-next'),
  );
});

bindGrepInput(
  $('console-feed-grep'),
  $('console-feed-grep-prev'),
  $('console-feed-grep-next'),
  'feed',
  rehighlightFeed,
);
$('console-feed-grep-prev')?.addEventListener('click', () =>
  gotoGrepMatch('feed', -1, $('console-feed-grep-count')),
);
$('console-feed-grep-next')?.addEventListener('click', () =>
  gotoGrepMatch('feed', 1, $('console-feed-grep-count')),
);

// v0.4.2 — narrative panel controls (mirrors the feed wiring).
$('console-narrative-pause')?.addEventListener('click', () => {
  narrativePaused = !narrativePaused;
  const btn = $('console-narrative-pause');
  btn.classList.toggle('paused', narrativePaused);
  btn.textContent = narrativePaused ? 'paused' : 'pause';
});
$('console-narrative-clear')?.addEventListener('click', () => {
  $('console-narrative-body').innerHTML = '';
  refreshGrepNav(
    'narrative',
    $('console-narrative-body'),
    $('console-narrative-grep-count'),
    $('console-narrative-grep-prev'),
    $('console-narrative-grep-next'),
  );
});
bindGrepInput(
  $('console-narrative-grep'),
  $('console-narrative-grep-prev'),
  $('console-narrative-grep-next'),
  'narrative',
  rehighlightNarrative,
);
$('console-narrative-grep-prev')?.addEventListener('click', () =>
  gotoGrepMatch('narrative', -1, $('console-narrative-grep-count')),
);
$('console-narrative-grep-next')?.addEventListener('click', () =>
  gotoGrepMatch('narrative', 1, $('console-narrative-grep-count')),
);

// Q5: append-handler fan-out — push every transcript event into the feed.
onAppendMsg((d) => {
  if (activeSession && d.session_id !== activeSession) return;
  const line = feedLineFromTranscriptEvent(d.msg);
  if (line) appendFeedLine(line);
});
es.addEventListener('session_start', (e) => {
  const d = JSON.parse(e.data);
  if (activeSession && d.session_id !== activeSession) return;
  appendFeedLine({
    ts: new Date().toISOString(),
    actor: 'system',
    body: '🌱 session_start — goal=' + (d.goal || '?') + ' preset=' + (d.preset || 'ambient'),
    kindClass: 'system',
  });
});

// Per-session log streaming (multiplexed: opens for the *active session* only,
// re-opens when activeSession changes). Pulls every actor's spawn log together
// so the feed shows raw stdout + stderr alongside transcript events.
let feedLogSource = null;
let feedLogActorSet = new Set();
function refreshFeedLogStreams() {
  // Close any prior streams.
  if (feedLogSource) {
    for (const es of feedLogSource) es.close();
  }
  feedLogSource = [];
  feedLogActorSet = new Set();
  if (!activeSession) {
    $('console-feed-status').textContent = 'no session selected';
    return;
  }
  const s = sessions.get(activeSession);
  $('console-feed-status').textContent = 'tailing ' + activeSession.slice(0, 12) + '…';
  const actors = (s?.actors ?? []).slice();
  for (const actor of actors) attachFeedLogStream(actor);
}

function attachFeedLogStream(actor) {
  if (feedLogActorSet.has(actor)) return;
  feedLogActorSet.add(actor);
  const url =
    '/api/sessions/' +
    encodeURIComponent(activeSession) +
    '/logs/' +
    encodeURIComponent(actor) +
    '/stream';
  const src = new EventSource(url);
  src.addEventListener('rotate', (e) => {
    const d = JSON.parse(e.data);
    appendFeedLine({
      ts: new Date().toISOString(),
      actor: actor,
      body: '── new spawn: ' + d.file + ' ──',
      kindClass: 'system',
    });
  });
  src.addEventListener('chunk', (e) => {
    const d = JSON.parse(e.data);
    let inStderr = false;
    for (const raw of d.text.split('\\n')) {
      const line = raw.replace(/\\r$/, '');
      if (line.length === 0) continue;
      if (/^--- stderr ---$/.test(line)) {
        inStderr = true;
        continue;
      }
      if (/^--- stdout ---$/.test(line)) {
        inStderr = false;
        continue;
      }
      if (/^=== adapter /.test(line)) {
        appendFeedLine({
          ts: new Date().toISOString(),
          actor: actor,
          body: line,
          kindClass: 'system',
        });
        continue;
      }
      // v0.4.2 — stream-json (Claude Code shape) goes to the agent narrative
      // panel; everything else (plain log lines, adapter banners, stderr) goes
      // to the live execution feed below it. Empty arrays from
      // renderStreamJsonLine still suppress (parsed but no narrative bubbles).
      const bubbles = renderStreamJsonLine(line);
      if (bubbles) {
        for (const b of bubbles) {
          appendNarrativeLine({
            ts: new Date().toISOString(),
            actor: actor,
            body: b.glyph + ' ' + b.body,
            kindClass: b.kindClass,
            stderr: b.stderr || false,
          });
        }
        continue;
      }
      appendFeedLine({
        ts: new Date().toISOString(),
        actor: actor,
        body: line,
        kindClass: 'log',
        stderr: inStderr,
      });
    }
  });
  src.addEventListener('heartbeat', () => {});
  feedLogSource.push(src);
}

// Q5: append-handler fan-out — attach log stream when a new agent wakes.
onAppendMsg((d) => {
  if (d.session_id !== activeSession) return;
  if (d.msg.kind === 'agent.wake' && d.msg.from && !feedLogActorSet.has(d.msg.from)) {
    attachFeedLogStream(d.msg.from);
  }
});

// Hook session select to (re)open feed log streams.
// v0.4.2 — also wipe the narrative panel so the new session doesn't see
// the previous session's stream-json bubbles. The live feed already gets
// re-populated from the per-session log stream so its existing content is
// session-bound transcript events that appendFeedLine will refresh.
onSessionSelect(() => {
  const narBody = $('console-narrative-body');
  if (narBody) {
    narBody.innerHTML = '';
    refreshGrepNav(
      'narrative',
      narBody,
      $('console-narrative-grep-count'),
      $('console-narrative-grep-prev'),
      $('console-narrative-grep-next'),
    );
  }
  refreshFeedLogStreams();
  refreshOutputTab();
});

// ── (2) New-session form (＋ button) — POST /api/crumb/run ──

$('new-session').addEventListener('click', () => {
  const f = $('new-session-form');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
  if (f.style.display === 'block') $('new-session-goal').focus();
});
$('new-session-cancel').addEventListener('click', () => {
  $('new-session-form').style.display = 'none';
});
$('new-session-go').addEventListener('click', spawnNewCrumbRun);
$('new-session-goal').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    spawnNewCrumbRun();
  }
});

async function spawnNewCrumbRun() {
  const goalEl = $('new-session-goal');
  const fb = $('new-session-feedback');
  const goal = (goalEl.value || '').trim();
  if (!goal) {
    fb.textContent = 'goal is required';
    fb.className = 'console-feedback err';
    return;
  }
  fb.textContent = 'spawning crumb run…';
  fb.className = 'console-feedback';
  const body = { goal };
  // v3.5: preset is set from chip selection; per-actor binding from advanced grid.
  if (newSessionForm.preset) body.preset = newSessionForm.preset;
  // PR-F D — adapter picker. When set, server forwards \`--adapter <id>\` to
  // \`crumb run\` so every actor goes through that adapter regardless of
  // preset / config.toml. Combined with the server's pre-spawn probe, the
  // user gets HTTP 409 + install/auth hints when the adapter isn't ready.
  const adapterSel = $('new-session-adapter');
  const adapterPick = adapterSel?.value?.trim();
  if (adapterPick) body.adapter = adapterPick;
  // v0.4: video_refs from the toggle textarea (only honored when gemini-sdk
  // OR gemini-cli-local is installed; the panel hides itself otherwise).
  const videoOn = $('new-session-video-on');
  const videoTextarea = $('new-session-video-refs');
  if (videoOn?.checked && videoTextarea?.value) {
    const refs = videoTextarea.value
      .split('\\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (refs.length > 0) body.video_refs = refs;
  }
  try {
    const res = await fetch('/api/crumb/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 409) {
      // Server refused because the adapter probe failed. Surface the install
      // hint inline so the user can fix it without leaving the form.
      const j = await res.json().catch(() => ({}));
      const hint = j.install_hint ? '  install: ' + j.install_hint : '';
      const auth = j.auth_hint ? '  auth: ' + j.auth_hint : '';
      const avail = j.available?.length ? '  available: ' + j.available.join(', ') : '';
      fb.textContent =
        '✗ adapter ' + j.adapter + ' unavailable (' + j.reason + ')' + hint + auth + avail;
      fb.className = 'console-feedback err';
      return;
    }
    if (!res.ok) {
      fb.textContent = '✗ ' + res.status + ': ' + (await res.text()).slice(0, 200);
      fb.className = 'console-feedback err';
      return;
    }
    const j = await res.json();
    fb.textContent =
      '✓ pid=' +
      j.pid +
      (j.adapter ? ' (' + j.adapter + ')' : '') +
      ' — session will appear shortly';
    fb.className = 'console-feedback ok';
    goalEl.value = '';
    setTimeout(() => {
      $('new-session-form').style.display = 'none';
      fb.textContent = '';
    }, 2000);
  } catch (err) {
    fb.textContent = '✗ ' + err.message;
    fb.className = 'console-feedback err';
  }
}

// ── (3) Console input — interpret "/crumb <goal>" as a new session spawn ──

const _origConsoleSendClick = $('console-send').onclick;
$('console-send').addEventListener('click', async () => {
  const line = $('console-line').value.trim();
  if (!line) return;
  if (/^\\/crumb\\s+/.test(line)) {
    // intercept — start a new session with the rest as goal
    const goal = line.replace(/^\\/crumb\\s+/, '').trim();
    const fb = $('console-feedback');
    fb.textContent = 'spawning new session: ' + goal.slice(0, 60);
    fb.className = 'console-feedback';
    try {
      const res = await fetch('/api/crumb/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ goal }),
      });
      if (!res.ok) {
        fb.textContent = '✗ ' + res.status + ': ' + (await res.text()).slice(0, 200);
        fb.className = 'console-feedback err';
      } else {
        fb.textContent = '✓ new session spawning — will appear in sidebar';
        fb.className = 'console-feedback ok';
        $('console-line').value = '';
      }
    } catch (err) {
      fb.textContent = '✗ ' + err.message;
      fb.className = 'console-feedback err';
    }
  }
  // Non-/crumb lines fall through to the existing inbox handler (already wired in PR #56).
});

// ── (4) Output tab — iframe live render of artifacts/{game/index.html | game.html} ──

async function refreshOutputTab() {
  const select = $('output-path-select');
  const iframe = $('output-frame');
  const empty = $('output-empty');
  if (!activeSession) {
    select.innerHTML = '';
    iframe.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }
  const events = eventCache.get(activeSession) ?? [];
  // Collect every artifact path emitted via kind=artifact.created (or build.artifacts).
  const seen = new Map(); // path → sha256?
  for (const e of events) {
    for (const a of e.artifacts ?? []) {
      if (a.path) seen.set(a.path, a.sha256 ?? null);
    }
  }
  // v3.5 disk fallback — when builder skipped artifact.created emission, the
  // file may exist on disk regardless. Walk <session>/artifacts/ and merge in
  // anything we haven't already seen via the transcript.
  if (seen.size === 0 || ![...seen.keys()].some((p) => /\\.html$/.test(p))) {
    try {
      const r = await fetch(
        '/api/sessions/' + encodeURIComponent(activeSession) + '/artifacts/list',
      );
      if (r.ok) {
        const j = await r.json();
        for (const f of j.files ?? []) {
          if (f.path && !seen.has(f.path)) seen.set(f.path, null);
        }
      }
    } catch {
      // disk fallback failed silently — empty-state UI handles it below
    }
  }
  // Pick the renderable head: prefer multi-file index.html, fall back to game.html.
  const head = (() => {
    const indexHit = [...seen.keys()].find((p) => /(^|\\/)index\\.html$/.test(p));
    if (indexHit) return indexHit;
    const gameHit = [...seen.keys()].find((p) => /(^|\\/)game\\.html$/.test(p));
    if (gameHit) return gameHit;
    const anyHtml = [...seen.keys()].find((p) => /\\.html$/.test(p));
    return anyHtml ?? null;
  })();
  if (!head) {
    select.innerHTML = '';
    iframe.style.display = 'none';
    if (empty) {
      empty.style.display = 'block';
      empty.textContent = 'No HTML artifact found for this session (transcript or disk).';
    }
    return;
  }
  // Populate dropdown with all html artifacts.
  const htmlPaths = [...seen.keys()].filter((p) => /\\.html$/.test(p));
  select.innerHTML = htmlPaths
    .map(
      (p) =>
        '<option value="' +
        escapeHTML(p) +
        '"' +
        (p === head ? ' selected' : '') +
        '>' +
        escapeHTML(p) +
        '</option>',
    )
    .join('');
  loadArtifactIntoFrame(head);
}

function loadArtifactIntoFrame(artifactPath) {
  if (!activeSession || !artifactPath) return;
  const iframe = $('output-frame');
  const empty = $('output-empty');
  // strip "artifacts/" prefix because the server endpoint roots at <session>/artifacts.
  const rel = artifactPath.replace(/^artifacts\\//, '');
  const url =
    '/api/sessions/' +
    encodeURIComponent(activeSession) +
    '/artifact/' +
    rel.split('/').map(encodeURIComponent).join('/') +
    '?t=' +
    Date.now();
  iframe.src = url;
  iframe.style.display = 'block';
  if (empty) empty.style.display = 'none';
}

$('output-path-select').addEventListener('change', (e) => {
  loadArtifactIntoFrame(e.target.value);
});
$('output-reload').addEventListener('click', () => {
  const select = $('output-path-select');
  if (select.value) loadArtifactIntoFrame(select.value);
});
$('output-open').addEventListener('click', () => {
  const iframe = $('output-frame');
  if (iframe.src) window.open(iframe.src, '_blank');
});

// Q5: append-handler fan-out — refresh Output tab when artifact.created arrives.
onAppendMsg((d) => {
  if (d.session_id !== activeSession) return;
  if (d.msg.kind === 'artifact.created' && activeView === 'output') {
    refreshOutputTab();
  }
});

// v0.5 PR-9: refresh logs pill when transcript advances for the active actor.
// Keeps "live · streaming / idle / errored" label honest in real time.
onAppendMsg((d) => {
  if (d.session_id !== activeSession) return;
  if (!activeLogActor) return;
  if (d.msg.from !== activeLogActor) return;
  if (logsCtl.state === 'streaming') renderLogsConnStatus('streaming');
});

// Hook the existing setActiveView so switching to Output triggers a refresh.
const _origSetActiveView = setActiveView;
setActiveView = function (view) {
  _origSetActiveView(view);
  if (view === 'output') refreshOutputTab();
};

// ─── v0.5 PR-Branding (F3) — theme toggle wiring ──────────────────────
//
// Pre-paint bootstrap script in <head> already set
// document.documentElement.dataset.theme on first load (light by default,
// dark via localStorage 'crumb.theme' or prefers-color-scheme: dark).
// This block (a) syncs the toggle button glyph to current state on boot,
// (b) flips on click + writes localStorage, (c) watches OS preference
// changes for users without an explicit override.
(function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  const html = document.documentElement;
  const currentTheme = () => (html.dataset.theme === 'dark' ? 'dark' : 'light');
  const updateGlyph = () => {
    if (btn) btn.textContent = currentTheme() === 'dark' ? '☀' : '🌙';
  };
  updateGlyph();

  if (btn) {
    btn.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      html.dataset.theme = next;
      try {
        localStorage.setItem('crumb.theme', next);
      } catch {}
      updateGlyph();
    });
  }

  // Follow OS preference changes ONLY when no explicit override is stored.
  if (window.matchMedia) {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => {
      let stored = null;
      try {
        stored = localStorage.getItem('crumb.theme');
      } catch {}
      if (!stored) {
        html.dataset.theme = e.matches ? 'dark' : 'light';
        updateGlyph();
      }
    };
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else if (mql.addListener) mql.addListener(onChange);
  }
})();

// ─── v3.5 Studio hardening: resize, dismiss, resume, transcript ───────

// (1) Draggable pane resize. Persists widths in localStorage so a refresh
// keeps the user's chosen layout. axis='x' (default) for column-resize
// handles; axis='y' for row-resize handles. v0.4.2: dragging the
// narrative/feed splitter shrinks the narrative panel as the cursor
// moves DOWN, so the y-delta is inverted versus the x-axis case.
function makeResizable(handleId, onDelta, persistKey, getInitial, axis = 'x') {
  const handle = $(handleId);
  if (!handle) return;
  let start = 0;
  let startVal = 0;
  let dragging = false;
  const persisted = persistKey ? Number(localStorage.getItem(persistKey)) : NaN;
  if (persisted && persisted > 0) onDelta(persisted, /*absolute*/ true);
  const onMove = (e) => {
    if (!dragging) return;
    const pos = e.touches
      ? axis === 'y'
        ? e.touches[0].clientY
        : e.touches[0].clientX
      : axis === 'y'
        ? e.clientY
        : e.clientX;
    const d = pos - start;
    onDelta(startVal, false, d);
    e.preventDefault();
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('touchend', onUp);
  };
  const onDown = (e) => {
    dragging = true;
    handle.classList.add('dragging');
    start = e.touches
      ? axis === 'y'
        ? e.touches[0].clientY
        : e.touches[0].clientX
      : axis === 'y'
        ? e.clientY
        : e.clientX;
    startVal = getInitial();
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);
    e.preventDefault();
  };
  handle.addEventListener('mousedown', onDown);
  handle.addEventListener('touchstart', onDown, { passive: false });
}

makeResizable(
  'sessions-resize',
  (start, abs, dx) => {
    const w = abs ? start : Math.max(160, Math.min(560, start + (dx ?? 0)));
    document.body.style.setProperty('--sessions-w', w + 'px');
    if (!abs) localStorage.setItem('crumb.sessions-w', String(w));
  },
  'crumb.sessions-w',
  () => parseInt(getComputedStyle(document.body).getPropertyValue('--sessions-w'), 10) || 240,
);

// F4-relocate (2026-05-03 amendment) — collapsible sessions sidebar with
// the primary hamburger now living next to the CRUMB STUDIO wordmark inside
// <aside.sessions>. When the sidebar is open, the primary toggle is the
// only visible one. When collapsed, the sidebar (and its toggle) hide; a
// floating twin in header.summary takes over so the user can reopen.
// State persists in localStorage (\`crumb.sessions-collapsed\`); both buttons
// stay in aria sync.
(function initSidebarToggle() {
  const KEY = 'crumb.sessions-collapsed';
  const primary = document.getElementById('sidebar-toggle');
  const floating = document.getElementById('sidebar-toggle-floating');
  if (!primary && !floating) return;
  const apply = (collapsed) => {
    if (collapsed) {
      document.body.dataset.sidebarCollapsed = '1';
      if (primary) {
        primary.setAttribute('aria-expanded', 'false');
        primary.title = 'Expand sessions sidebar';
      }
      if (floating) {
        floating.hidden = false;
        floating.setAttribute('aria-expanded', 'false');
        floating.title = 'Open sessions sidebar';
      }
    } else {
      delete document.body.dataset.sidebarCollapsed;
      if (primary) {
        primary.setAttribute('aria-expanded', 'true');
        primary.title = 'Collapse sessions sidebar';
      }
      if (floating) {
        floating.hidden = true;
        floating.setAttribute('aria-expanded', 'true');
      }
    }
  };
  let initial = false;
  try {
    initial = localStorage.getItem(KEY) === '1';
  } catch (_) {}
  apply(initial);
  const onToggle = () => {
    const next = document.body.dataset.sidebarCollapsed !== '1';
    apply(next);
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch (_) {}
  };
  if (primary) primary.addEventListener('click', onToggle);
  if (floating) floating.addEventListener('click', onToggle);
})();
makeResizable(
  'detail-resize',
  (start, abs, dx) => {
    const w = abs ? start : Math.max(280, Math.min(800, start - (dx ?? 0)));
    document.body.style.setProperty('--detail-w', w + 'px');
    if (!abs) localStorage.setItem('crumb.detail-w', String(w));
  },
  'crumb.detail-w',
  () => parseInt(getComputedStyle(document.body).getPropertyValue('--detail-w'), 10) || 420,
);
// v0.5 PR-Layout — 4-pane vertical splitters.
//
// Three handles between { view-pane (absorber, flex:1) | swimlane | narrative
// | feed }. Industry-standard convention (Linear / VSCode / Datadog APM):
//   drag UP   → upper pane narrows
//   drag DOWN → lower pane narrows
//
// Splitter math:
//  - splitter-view-swim: only swimlane has a height var; view-pane is the
//    absorber. drag-DOWN shrinks swim (lower), drag-UP grows swim. Single-var.
//  - splitter-swim-narr / splitter-narr-feed: BOTH adjacent panes have height
//    vars, so dragging the boundary preserves total panes height — upper
//    grows by dy, lower shrinks by dy. View-pane (the absorber) stays put.
//
// Persistence: localStorage \`crumb.pane.{swimlane,narrative,feed}-h\` (px int).
// One-shot migration: legacy \`crumb.narrative-h\` → \`crumb.pane.narrative-h\`.
(function initPaneSplitters() {
  // ── one-shot localStorage migration (W-Studio-A → PR-Layout) ─────────
  const legacyNarr = localStorage.getItem('crumb.narrative-h');
  if (legacyNarr && !localStorage.getItem('crumb.pane.narrative-h')) {
    localStorage.setItem('crumb.pane.narrative-h', legacyNarr);
    localStorage.removeItem('crumb.narrative-h');
  }

  // ── apply persisted sizes on boot ────────────────────────────────────
  const apply = (varName, lsKey, fallback) => {
    const v = Number(localStorage.getItem(lsKey));
    if (v && v > 0) document.body.style.setProperty(varName, v + 'px');
    else if (fallback) document.body.style.setProperty(varName, fallback + 'px');
  };
  apply('--swimlane-h', 'crumb.pane.swimlane-h', 200);
  apply('--narrative-h', 'crumb.pane.narrative-h', 220);
  apply('--feed-h', 'crumb.pane.feed-h', 180);

  const PANE_MIN = 80;

  // Generic 1-var or 2-var splitter. When upperVar is null, only lowerVar
  // changes (view-pane absorber takes the rest); when both, total preserved.
  const attach = (handleId, upperVar, lowerVar) => {
    const handle = document.getElementById(handleId);
    if (!handle) return;
    let dragging = false;
    let startY = 0;
    let startUpper = 0;
    let startLower = 0;

    const readVar = (name) =>
      parseInt(getComputedStyle(document.body).getPropertyValue(name), 10) || 0;
    const writeVar = (name, px) => {
      document.body.style.setProperty(name, px + 'px');
      const key = 'crumb.pane.' + name.replace(/^--/, '');
      localStorage.setItem(key, String(px));
    };

    const onMove = (e) => {
      if (!dragging) return;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      const dy = y - startY;
      if (upperVar && lowerVar) {
        // 2-var: drag DOWN (dy>0) → upper grows, lower shrinks.
        const newUpper = startUpper + dy;
        const newLower = startLower - dy;
        if (newUpper < PANE_MIN || newLower < PANE_MIN) return;
        writeVar(upperVar, newUpper);
        writeVar(lowerVar, newLower);
      } else if (lowerVar) {
        // 1-var (absorber above): drag DOWN shrinks lower (lower_h -= dy).
        const cap = Math.max(120, window.innerHeight - 280);
        const newLower = Math.max(PANE_MIN, Math.min(cap, startLower - dy));
        writeVar(lowerVar, newLower);
      }
      e.preventDefault();
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchend', onUp);
    };
    const onDown = (e) => {
      dragging = true;
      handle.classList.add('dragging');
      startY = e.touches ? e.touches[0].clientY : e.clientY;
      startUpper = upperVar ? readVar(upperVar) : 0;
      startLower = lowerVar ? readVar(lowerVar) : 0;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchend', onUp);
      e.preventDefault();
    };
    handle.addEventListener('mousedown', onDown);
    handle.addEventListener('touchstart', onDown, { passive: false });
  };

  attach('splitter-view-swim', null, '--swimlane-h');
  attach('splitter-swim-narr', '--swimlane-h', '--narrative-h');
  attach('splitter-narr-feed', '--narrative-h', '--feed-h');
})();

// (2) Click-outside-to-close detail pane. Avoids closing on its own resize handle.
document.addEventListener('mousedown', (e) => {
  const detail = $('detail');
  if (!detail.classList.contains('open')) return;
  if (detail.contains(e.target)) return;
  // Don't close when click originates on a swimlane row that re-opens detail.
  if (e.target.closest && e.target.closest('[data-evt-id]')) return;
  detail.classList.remove('open');
});

// (3) Resume button — re-spawn last interrupted actor via inbox /redo.
function lastActorErrorEvent() {
  const arr = eventCache.get(activeSession) || [];
  for (let i = arr.length - 1; i >= 0; i--) {
    const e = arr[i];
    if (
      e.kind === 'error' ||
      (e.kind === 'agent.stop' && /timed out|exit=[1-9]/.test(e.body || ''))
    ) {
      return e;
    }
    if (
      e.kind === 'agent.wake' ||
      e.kind === 'build' ||
      e.kind === 'spec' ||
      e.kind === 'judge.score'
    ) {
      return null; // a healthy event after the failure → no resume needed
    }
  }
  return null;
}
function refreshResumeButton() {
  const btn = $('resume-btn');
  if (!btn) return;
  if (!activeSession) {
    btn.style.display = 'none';
    return;
  }
  const evt = lastActorErrorEvent();
  if (!evt) {
    btn.style.display = 'none';
    return;
  }
  const actor = evt.from && evt.from !== 'system' ? evt.from : 'last actor';
  btn.style.display = '';
  btn.textContent = '▶ Resume ' + actor;
  btn.disabled = false;
  btn.dataset.actor = evt.from || '';
}
$('resume-btn')?.addEventListener('click', async () => {
  const btn = $('resume-btn');
  const actor = btn.dataset.actor;
  btn.disabled = true;
  btn.textContent = 'spawning…';
  // Inbox parser already handles \`/redo\` and \`/resume\` lines.
  const line = actor ? \`/redo @\${actor} resume after timeout/error\` : '/resume';
  await sendInboxLine(activeSession, line, $('console-feedback'));
  setTimeout(refreshResumeButton, 1000);
});
// Q5: append-handler fan-out — refresh resume button on every append.
onAppendMsg(() => refreshResumeButton());

// (4) Transcript viewer — pretty-printed jsonl, filterable, copyable.
function renderTranscriptView() {
  const root = $('transcript-content');
  if (!root) return;
  if (!activeSession) {
    root.textContent = '(no session selected)';
    return;
  }
  const arr = eventCache.get(activeSession) || [];
  const query = grepState.transcript.query;
  const qLower = query.toLowerCase();
  const pretty = $('transcript-pretty')?.checked ?? true;
  const lines = arr
    .filter((e) => {
      if (!query) return true;
      return JSON.stringify(e).toLowerCase().includes(qLower);
    })
    .map((e) => (pretty ? JSON.stringify(e, null, 2) : JSON.stringify(e)));
  const joined = lines.join('\\n\\n');
  // <pre> preserves whitespace, so innerHTML keeps the pretty layout while letting us inline-mark matches.
  root.innerHTML = highlightHTML(joined, query);
  $('transcript-status').textContent = \`\${arr.length} events · showing \${lines.length}\`;
  refreshGrepNav(
    'transcript',
    root,
    $('transcript-grep-count'),
    $('transcript-grep-prev'),
    $('transcript-grep-next'),
  );
}
bindGrepInput(
  $('transcript-filter'),
  $('transcript-grep-prev'),
  $('transcript-grep-next'),
  'transcript',
  renderTranscriptView,
);
$('transcript-grep-prev')?.addEventListener('click', () =>
  gotoGrepMatch('transcript', -1, $('transcript-grep-count')),
);
$('transcript-grep-next')?.addEventListener('click', () =>
  gotoGrepMatch('transcript', 1, $('transcript-grep-count')),
);
$('transcript-pretty')?.addEventListener('change', renderTranscriptView);
$('transcript-copy')?.addEventListener('click', () => {
  navigator.clipboard?.writeText($('transcript-content').textContent || '');
});
const _origSetActiveView2 = setActiveView;
setActiveView = function (view) {
  _origSetActiveView2(view);
  if (view === 'transcript') renderTranscriptView();
};
// Q5: append-handler fan-out — re-render transcript view on every append.
onAppendMsg((d) => {
  if (activeView === 'transcript' && d.session_id === activeSession) renderTranscriptView();
});

// (5) Coordinator visibility: surface system "dispatch.spawn" notes as
// coordinator routing decisions in the live exec feed. Coordinator is
// host-inline (v3 invariant) so it doesn't emit \`agent.wake\`/\`agent.stop\`
// during normal routing — only on rollback/stop/done. Without this attribution
// the coordinator lane appears silent even though routing is happening.
// Q5: append-handler fan-out — coordinator visibility note → feed line.
onAppendMsg((d) => {
  if (activeSession && d.session_id !== activeSession) return;
  const m = d.msg;
  if (m && m.from === 'system' && m.kind === 'note' && /dispatch\\.spawn/.test(m.body || '')) {
    const target = m.data?.actor || '?';
    appendFeedLine({
      ts: m.ts,
      actor: 'coordinator',
      body: \`→ route: spawn(\${target}) via \${m.data?.adapter || '?'} [host-inline routing]\`,
      kindClass: 'system',
    });
  }
});

// Init: refresh resume button on session select.
onSessionSelect(() => {
  refreshResumeButton();
  if (activeView === 'transcript') renderTranscriptView();
});

// ─── v3.5 Stream-JSON renderer — Claude-Code-style narrative bubbles ────────

// The Claude CLI emits per-line stream-json: each line is a JSON object
// describing one assistant turn step (text / tool_use / tool_result / system /
// result). Codex and Gemini emit similar shapes for their tool-call narratives.
// This parser turns each line into one or more rendered "bubbles" using the
// same ⏺ / ⎿ / ✓ glyphs the user sees inside Claude Code so the studio
// live exec feed reads as a faithful mirror of what the agent is doing.
//
// Convention:
//   ⏺ <text>             — assistant text content block
//   ⏺ ToolName(summary)  — tool call (Bash / Read / Edit / Grep / Monitor / …)
//   ⎿ <preview>          — tool result (collapsed; tool_result content)
//   ⎿ Async X completed  — system task notification
//   ✓ turn complete · …  — result event with cost + tokens

function _summarizeToolInput(name, input) {
  if (!input || typeof input !== 'object') return '';
  if (name === 'Bash') return (input.command || '').replace(/\\s+/g, ' ').slice(0, 90);
  if (name === 'Read') return input.file_path || '';
  if (name === 'Write') return input.file_path || '';
  if (name === 'Edit') return input.file_path || '';
  if (name === 'Grep') return (input.pattern || '') + (input.path ? ' in ' + input.path : '');
  if (name === 'Glob') return input.pattern || '';
  if (name === 'Monitor') return JSON.stringify(input).slice(0, 90);
  if (name === 'Task' || name === 'Agent') {
    return (
      (input.description || '') + (input.subagent_type ? ' [' + input.subagent_type + ']' : '')
    );
  }
  if (name === 'TodoWrite') {
    const todos = input.todos || [];
    const inProgress = todos.filter((t) => t.status === 'in_progress').map((t) => t.content);
    return inProgress.length ? '▶ ' + inProgress[0] : todos.length + ' todos';
  }
  if (name === 'WebSearch') return input.query || '';
  if (name === 'WebFetch') return input.url || '';
  // Generic fallback: short JSON preview
  try {
    const j = JSON.stringify(input);
    return j.length > 90 ? j.slice(0, 87) + '…' : j;
  } catch {
    return '';
  }
}

function _summarizeToolResult(content, isError) {
  let body = content;
  if (Array.isArray(body)) {
    body = body
      .map((b) => {
        if (typeof b === 'string') return b;
        if (b.text) return b.text;
        if (b.content) return typeof b.content === 'string' ? b.content : JSON.stringify(b.content);
        return JSON.stringify(b);
      })
      .join(' ');
  } else if (typeof body === 'object' && body !== null) {
    body = JSON.stringify(body);
  }
  body = String(body ?? '');
  // Compact: collapse newlines and tabs, then truncate.
  body = body.replace(/\\s+/g, ' ').trim();
  const max = isError ? 240 : 180;
  return body.length > max ? body.slice(0, max - 1) + '…' : body;
}

function renderStreamJsonLine(raw) {
  // Cheap pre-check: stream-json lines start with '{'. Anything else is plain
  // log output and should fall through to the raw renderer.
  //
  // Return contract (intentional null vs empty-array distinction):
  //   - return null   → NOT stream-json (caller falls through to raw render
  //                     so plain-log lines stay visible in the feed)
  //   - return []     → IS stream-json, parsed cleanly, but no narrative
  //                     bubbles to render (caller skips → suppressed from
  //                     feed). Prevents the raw \`{"type":"assistant",...}\`
  //                     blob with empty thinking content / signature payload
  //                     from leaking into the live exec feed when it has
  //                     no user-facing content. Full raw stream is still
  //                     visible in the Logs view (spawn-*.log on disk).
  //   - return [bubble, …] → render each bubble.
  if (!raw || raw.charCodeAt(0) !== 123) return null;
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object' || !obj.type) return null;

  if (obj.type === 'assistant') {
    const content = obj.message?.content || [];
    const out = [];
    for (const block of content) {
      if (block.type === 'text' && block.text && block.text.trim()) {
        out.push({ glyph: '⏺', body: block.text.trim(), kindClass: 'assistant-text' });
      } else if (block.type === 'tool_use') {
        const name = block.name || 'tool';
        const summary = _summarizeToolInput(name, block.input);
        out.push({
          glyph: '⏺',
          body: name + (summary ? '(' + summary + ')' : '()'),
          kindClass: 'tool-call',
        });
      } else if (block.type === 'thinking' && block.thinking && block.thinking.length > 4) {
        // Render extended thinking as dim italic — usually empty signature
        // payloads, so this branch fires only when actual reasoning leaked.
        out.push({ glyph: '·', body: '(thinking)', kindClass: 'thinking' });
      }
    }
    return out; // [] = parsed but no narrative; caller skips (suppressed)
  }

  if (obj.type === 'user') {
    const content = obj.message?.content || [];
    const out = [];
    for (const block of content) {
      if (block.type === 'tool_result') {
        const isError = block.is_error === true;
        const summary = _summarizeToolResult(block.content, isError);
        out.push({
          glyph: '⎿',
          body: summary || (isError ? '(error)' : '(no output)'),
          kindClass: isError ? 'tool-error' : 'tool-result',
          stderr: isError,
        });
      }
    }
    return out; // [] = parsed but no narrative; caller skips
  }

  if (obj.type === 'system') {
    const sub = obj.subtype;
    if (sub === 'task_started') {
      return [
        {
          glyph: '⎿',
          body: 'Async ' + (obj.description || obj.task_type || 'task') + ' started',
          kindClass: 'tool-result',
        },
      ];
    }
    if (sub === 'task_notification') {
      const status = obj.status || 'updated';
      const desc = obj.description || obj.summary || obj.task_type || 'task';
      return [
        {
          glyph: '⎿',
          body: 'Async ' + desc + ' ' + status,
          kindClass:
            status === 'completed'
              ? 'tool-result'
              : status === 'killed'
                ? 'tool-error'
                : 'tool-result',
        },
      ];
    }
    if (sub === 'hook_started' || sub === 'hook_response') {
      const outcome = obj.outcome || (sub === 'hook_started' ? 'started' : 'ok');
      return [
        { glyph: '·', body: 'hook ' + (obj.hook_name || '?') + ' ' + outcome, kindClass: 'system' },
      ];
    }
    if (sub === 'init') {
      const tools = (obj.tools || []).length;
      const skills = (obj.skills || []).length;
      const tail = obj.session_id ? obj.session_id.slice(-8) : '';
      return [
        {
          glyph: '·',
          body:
            'init session ' +
            tail +
            ' (model=' +
            (obj.model || '?') +
            ', tools=' +
            tools +
            ', skills=' +
            skills +
            ')',
          kindClass: 'system',
        },
      ];
    }
    return []; // other system subtypes — silent (parsed, suppressed)
  }

  if (obj.type === 'result') {
    const cost =
      typeof obj.total_cost_usd === 'number' ? '$' + obj.total_cost_usd.toFixed(4) : '$?';
    const out = obj.usage?.output_tokens ?? '?';
    const cacheRead = obj.usage?.cache_read_input_tokens;
    const dur = obj.duration_ms ? Math.round(obj.duration_ms / 1000) + 's' : '?';
    let body = 'turn complete · ' + out + ' out · ' + cost + ' · ' + dur;
    if (cacheRead)
      body += ' · cache ' + (cacheRead >= 1000 ? (cacheRead / 1000).toFixed(1) + 'k' : cacheRead);
    return [{ glyph: '✓', body, kindClass: 'turn-complete' }];
  }

  if (obj.type === 'rate_limit_event') return []; // silent (parsed, suppressed)
  return []; // unknown obj.type but valid stream-json shape — suppress raw blob
}

// ─── v3.5 Adapter status sidebar + new-session preset chips + setup modal ──
//
// /api/doctor returns: { adapters: [{ id, display_name, installed,
//   authenticated, version, models, install_hint, auth_hint, ... }] }
// authenticated semantics:
//   true  → confirmed (env-var SDK or mock)
//   null  → installed but auth not probed (CLI; risk side-effects)
//   false → binary missing
// Sidebar dot:
//   active = installed && authenticated !== false  (lime, ●)
//   maybe  = installed && authenticated === null   (amber, ●)
//   inactive = !installed                          (gray, ○)

let adapterCache = [];

// PR-F D — populate the new-session adapter dropdown from the latest probe.
// Disabled options for missing binaries so the user can see the gap (and
// the install hint shows up if they pick an unavailable one and submit).
function renderAdapterPicker() {
  const sel = $('new-session-adapter');
  if (!sel) return;
  const current = sel.value;
  // Disabled options just fade in CSS (no inline " (not installed)" suffix
  // or bracketed labels) per UX feedback — the fade is the affordance.
  const opts = ['<option value="">default — preset or ambient</option>'];
  for (const a of adapterCache) {
    const installed = a.installed && a.authenticated !== false;
    opts.push(
      '<option value="' +
        escapeHTML(a.id) +
        '"' +
        (installed ? '' : ' disabled') +
        '>' +
        escapeHTML(a.display_name) +
        '</option>',
    );
  }
  sel.innerHTML = opts.join('');
  // Restore selection if still valid + still installed.
  const stillValid = adapterCache.some(
    (a) => a.id === current && a.installed && a.authenticated !== false,
  );
  if (stillValid) sel.value = current;
}

async function refreshAdapterList() {
  const root = $('adapter-list');
  if (!root) return;
  try {
    const res = await fetch('/api/doctor');
    const j = await res.json();
    adapterCache = j.adapters ?? [];
    renderAdapterList();
    renderPresetChips(); // re-disable preset chips that reference unavailable adapters
    renderBindingsGrid();
    renderAdapterPicker();
    renderVideoResearchPanel(); // v0.4 toggle visibility tracks gemini availability
  } catch (err) {
    root.innerHTML =
      '<div class="adapter-empty">probe failed: ' + escapeHTML(err.message) + '</div>';
  }
}

// v0.4: show "Video research (Gemini)" toggle only when gemini-sdk OR
// gemini-cli-local is installed AND auth is not explicitly false. Hidden
// otherwise — pure-tap workflows shouldn't see a control they can't act on.
// The textarea inside the toggle reveals only when the checkbox is on.
function renderVideoResearchPanel() {
  const panel = $('new-session-video');
  if (!panel) return;
  const geminiAvailable = adapterCache.some(
    (a) =>
      (a.id === 'gemini-sdk' || a.id === 'gemini-cli-local') &&
      a.installed &&
      a.authenticated !== false,
  );
  panel.style.display = geminiAvailable ? '' : 'none';
  if (!geminiAvailable) {
    // Force-clear so a stale on-state doesn't leak into the next /api/crumb/run.
    const cb = $('new-session-video-on');
    const ta = $('new-session-video-refs');
    if (cb) cb.checked = false;
    if (ta) ta.style.display = 'none';
  }
}

// Wire checkbox once at module load — toggle reveals/hides the textarea.
$('new-session-video-on')?.addEventListener('change', () => {
  const cb = $('new-session-video-on');
  const ta = $('new-session-video-refs');
  if (ta) ta.style.display = cb?.checked ? '' : 'none';
});

// Adapters used by the current session's preset (or live binding) get an
// \`in-use\` indicator on top of their active/maybe/inactive state.
function adaptersInUseForActiveSession() {
  if (!activeSession) return new Set();
  const sess = sessions.get(activeSession);
  const events = eventCache.get(activeSession) ?? [];
  const used = new Set();
  for (const e of events) {
    const adapter = e.metadata?.adapter || e.metadata?.harness;
    if (adapter) used.add(adapter);
  }
  if (used.size === 0 && sess?.preset) {
    // Best-effort fallback by preset name.
    if (sess.preset === 'mock') used.add('mock');
    else if (sess.preset === 'sdk-enterprise') used.add('gemini-sdk');
    else used.add('claude-local');
  }
  return used;
}

function renderAdapterList() {
  const root = $('adapter-list');
  if (!root) return;
  if (adapterCache.length === 0) {
    root.innerHTML = '<div class="adapter-empty">no adapters detected</div>';
    return;
  }
  const inUse = adaptersInUseForActiveSession();
  root.innerHTML = adapterCache
    .map((a) => {
      const cls = ['adapter-row'];
      if (a.installed && a.authenticated !== false)
        cls.push(a.authenticated === true ? 'active' : 'maybe');
      else cls.push('inactive');
      if (inUse.has(a.id)) cls.push('in-use');
      const meta = a.version
        ? a.version.replace(/^.*?\\b(\\d[\\w.-]*).*$/, '$1')
        : (a.models?.[0] ?? '');
      let pillText = '○';
      if (a.installed && a.authenticated === true) pillText = 'auth ✓';
      else if (a.installed) pillText = 'installed';
      else pillText = 'missing';
      return (
        '<div class="' +
        cls.join(' ') +
        '" data-adapter="' +
        escapeHTML(a.id) +
        '">' +
        '<span class="adapter-dot"></span>' +
        '<div class="adapter-info">' +
        '<div class="adapter-name">' +
        escapeHTML(a.display_name) +
        '</div>' +
        '<div class="adapter-meta">' +
        escapeHTML(meta) +
        '</div>' +
        '</div>' +
        '<span class="adapter-pill">' +
        escapeHTML(pillText) +
        '</span>' +
        '</div>'
      );
    })
    .join('');
  root.querySelectorAll('.adapter-row').forEach((el) => {
    el.addEventListener('click', () => openAdapterModal(el.dataset.adapter));
  });
}

$('adapter-refresh')?.addEventListener('click', () => {
  refreshAdapterList();
});

// Re-render adapter list when active session changes (in-use highlight).
onSessionSelect(() => renderAdapterList());

// ── New session form: preset chips + advanced bindings grid ──────────────

const PRESETS = [
  {
    id: '', // ambient
    label: 'ambient',
    description: 'follow the entry host (whatever you have authed)',
    requires: [],
  },
  {
    id: 'mock',
    label: 'mock',
    description: 'deterministic, $0',
    requires: ['mock'],
  },
  {
    id: 'solo',
    label: 'solo',
    description: 'single host, single model',
    requires: ['claude-local'],
  },
  {
    id: 'bagelcode-cross-3way',
    label: 'cross-3way',
    description: 'builder=codex · verifier=gemini-cli · rest=ambient',
    requires: ['codex-local', 'gemini-cli-local'],
  },
  {
    id: 'sdk-enterprise',
    label: 'sdk-enterprise',
    description: 'API key direct (no subscription)',
    requires: ['gemini-sdk'],
  },
];

const ACTORS_FOR_BINDING = ['planner-lead', 'researcher', 'builder', 'verifier'];

const newSessionForm = {
  preset: '',
  bindings: {}, // actor -> adapter id (informational only)
};

function presetIsRunnable(preset) {
  return preset.requires.every((req) =>
    adapterCache.some((a) => a.id === req && a.installed && a.authenticated !== false),
  );
}

function renderPresetChips() {
  const root = $('new-session-preset-chips');
  if (!root) return;
  root.innerHTML = PRESETS.map((p) => {
    const cls = ['preset-chip'];
    if (newSessionForm.preset === p.id) cls.push('active');
    if (!presetIsRunnable(p)) cls.push('disabled');
    return (
      '<button type="button" class="' +
      cls.join(' ') +
      '" data-preset="' +
      escapeHTML(p.id) +
      '" ' +
      'title="' +
      escapeHTML(p.description + (p.requires.length ? ' · needs ' + p.requires.join(', ') : '')) +
      '">' +
      escapeHTML(p.label) +
      '</button>'
    );
  }).join('');
  root.querySelectorAll('.preset-chip').forEach((el) => {
    el.addEventListener('click', () => {
      if (el.classList.contains('disabled')) {
        // surface why
        const id = el.dataset.preset;
        const p = PRESETS.find((x) => x.id === id);
        const missing = p?.requires.filter(
          (req) =>
            !adapterCache.some((a) => a.id === req && a.installed && a.authenticated !== false),
        );
        const fb = $('new-session-feedback');
        fb.className = 'console-feedback err';
        fb.textContent = \`preset needs: \${(missing ?? []).join(', ')} — click an adapter to set up\`;
        return;
      }
      newSessionForm.preset = el.dataset.preset;
      renderPresetChips();
    });
  });
}

function renderBindingsGrid() {
  const root = $('new-session-bindings');
  if (!root) return;
  // Per UX feedback: disabled options just fade out (CSS opacity 0.4) — no
  // bracketed " (×)" suffix and no parentheses on "ambient". The fade is the
  // affordance; extra glyphs add visual noise.
  root.innerHTML = ACTORS_FOR_BINDING.map((actor) => {
    const adapterOptions = adapterCache
      .map((a) => {
        const disabled = !a.installed || a.authenticated === false;
        return (
          '<option value="' +
          escapeHTML(a.id) +
          '"' +
          (disabled ? ' disabled' : '') +
          '>' +
          escapeHTML(a.display_name) +
          '</option>'
        );
      })
      .join('');
    const modelOptions = adapterCache
      .flatMap((a) => a.models.map((m) => m))
      .filter((m, i, arr) => arr.indexOf(m) === i)
      .map((m) => '<option value="' + escapeHTML(m) + '">' + escapeHTML(m) + '</option>')
      .join('');
    return (
      '<span class="bg-actor">' +
      escapeHTML(actor) +
      '</span>' +
      '<select data-actor="' +
      escapeHTML(actor) +
      '" data-kind="adapter"><option value="">ambient</option>' +
      adapterOptions +
      '</select>' +
      '<select data-actor="' +
      escapeHTML(actor) +
      '" data-kind="model"><option value="">default</option>' +
      modelOptions +
      '</select>'
    );
  }).join('');
  root.querySelectorAll('select').forEach((el) => {
    el.addEventListener('change', () => {
      const actor = el.dataset.actor;
      const kind = el.dataset.kind;
      newSessionForm.bindings[actor] ||= {};
      newSessionForm.bindings[actor][kind] = el.value;
    });
  });
}

// ── Adapter setup modal (install / auth guide) ───────────────────────────

function openAdapterModal(adapterId) {
  const a = adapterCache.find((x) => x.id === adapterId);
  if (!a) return;
  $('adapter-modal-title').textContent = a.display_name + ' — setup';
  const body = $('adapter-modal-body');
  const stateLine = a.installed
    ? a.authenticated === true
      ? '✓ installed and authenticated'
      : a.authenticated === null
        ? '◐ installed (auth not probed)'
        : '✗ installed but auth missing'
    : '✗ not installed';
  const blocks = [
    '<div class="adapter-modal-step">' +
      '<div class="adapter-modal-step-label">current status</div>' +
      '<div>' +
      escapeHTML(stateLine) +
      (a.version ? ' · ' + escapeHTML(a.version) : '') +
      '</div>' +
      '</div>',
    a.install_hint
      ? '<div class="adapter-modal-step">' +
        '<div class="adapter-modal-step-label">' +
        (a.installed ? 'reinstall' : 'install') +
        '</div>' +
        '<pre>' +
        escapeHTML(a.install_hint) +
        '</pre>' +
        '</div>'
      : '',
    a.auth_hint
      ? '<div class="adapter-modal-step">' +
        '<div class="adapter-modal-step-label">login</div>' +
        '<pre>' +
        escapeHTML(a.auth_hint) +
        '</pre>' +
        '</div>'
      : '',
    a.models?.length
      ? '<div class="adapter-modal-step">' +
        '<div class="adapter-modal-step-label">models</div>' +
        '<div style="font-size:11px;color:var(--ink-subtle);font-family:ui-monospace,monospace;">' +
        a.models.map(escapeHTML).join(' · ') +
        '</div>' +
        '</div>'
      : '',
  ]
    .filter(Boolean)
    .join('');
  body.innerHTML = blocks;
  $('adapter-modal-feedback').textContent = '';
  $('adapter-modal').style.display = 'flex';
}
function closeAdapterModal() {
  $('adapter-modal').style.display = 'none';
}
$('adapter-modal-close')?.addEventListener('click', closeAdapterModal);
$('adapter-modal-dismiss')?.addEventListener('click', closeAdapterModal);
$('adapter-modal-refresh')?.addEventListener('click', async () => {
  const fb = $('adapter-modal-feedback');
  fb.textContent = 're-probing…';
  fb.className = 'console-feedback';
  await refreshAdapterList();
  fb.textContent = '✓ refreshed — see status above';
  fb.className = 'console-feedback ok';
});
// Backdrop click closes modal.
document.querySelector('.adapter-modal-backdrop')?.addEventListener('click', closeAdapterModal);
// Esc closes modal.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('adapter-modal').style.display === 'flex') closeAdapterModal();
});

// Initial probe + render
refreshAdapterList();
renderPresetChips();
renderBindingsGrid();

// v0.5 — first-visit welcome banner with the read-only invariant message.
// Dismiss persists in localStorage; clear \`crumb.studio.welcome.dismissed\` to
// re-show. No-op when localStorage is unavailable (private browsing,
// sandboxed iframe, etc.) — banner just stays hidden, which is the safe
// default for repeat visitors.
(function setupWelcomeBanner() {
  const KEY = 'crumb.studio.welcome.dismissed';
  const banner = document.getElementById('welcome-banner');
  const close = document.getElementById('welcome-banner-close');
  if (!banner || !close) return;
  let dismissed = false;
  try {
    dismissed = localStorage.getItem(KEY) === '1';
  } catch (_) {}
  if (!dismissed) banner.style.display = 'flex';
  close.addEventListener('click', () => {
    banner.style.display = 'none';
    try {
      localStorage.setItem(KEY, '1');
    } catch (_) {}
  });
})();
;
    </script>
  </body>
</html>
`;
