/**
 * Crumb Design System v1 — color / typography / spacing tokens emitted as raw CSS.
 *
 * Shared by summary.html / timeline.html / scorecard.html / cost.html (RESTful URLs)
 * and TUI color mapping (1:1 hex). See [[bagelcode-system-architecture-v3]] §10 (4 surface).
 */

import type { Actor } from '../protocol/types.js';

export const ACTOR_COLOR: Record<Actor, string> = {
  user: '#2A2520', // 👤 charcoal
  coordinator: '#2E8B57', // 🟢 emerald
  'planner-lead': '#3B6FB6', // 🔵 blue
  researcher: '#0F8A8A', // 🔍 teal (v3.3 — visually distinct from planner blue)
  builder: '#7A4FB8', // 🟣 purple
  verifier: '#D2691E', // 🟠 orange
  'builder-fallback': '#B8456E', // 🌹 rose
  validator: '#6E6357', // ⚙ gray (validator surfaces audit only)
  system: '#6E6357', // ⚙ gray
};

export const ACTOR_GLYPH: Record<Actor, string> = {
  user: '👤',
  coordinator: '🟢',
  'planner-lead': '🔵',
  researcher: '🔍',
  builder: '🟣',
  verifier: '🟠',
  'builder-fallback': '🌹',
  validator: '⚙',
  system: '⚙',
};

/** Inline CSS — embedded into summary/timeline/scorecard/cost pages (warm-paper Kiki). */
export const CDS_CSS = `
:root {
  --bg-paper: #F5EFE3;
  --bg-card: #FBF7EE;
  --bg-elev: #FFFFFF;
  --ink-strong: #2A2520;
  --ink-muted: #6E6357;
  --ink-faint: #A89E90;
  --crumb-amber: #C8923A;
  --crumb-amber-soft: #E8C77A;
  --crumb-warm: #8C5A2B;
  --ok: #2E8B57;
  --warn: #D2691E;
  --err: #B8456E;
  --deterministic: #C8923A;
  --actor-user: #2A2520;
  --actor-coordinator: #2E8B57;
  --actor-planner-lead: #3B6FB6;
  --actor-builder: #7A4FB8;
  --actor-verifier: #D2691E;
  --actor-builder-fallback: #B8456E;
  --actor-system: #6E6357;
  --actor-validator: #6E6357;
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --shadow-1: 0 1px 2px rgba(42,37,32,.06);
  --shadow-2: 0 4px 12px rgba(42,37,32,.08);
  --font-ui: -apple-system, "Segoe UI", "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg-paper);
  color: var(--ink-strong);
  font-family: var(--font-ui);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
header.page {
  padding: 24px 32px 16px;
  border-bottom: 1px solid var(--ink-faint);
}
header.page h1 {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 600;
}
header.page .meta {
  color: var(--ink-muted);
  font-size: 12px;
  font-family: var(--font-mono);
}
nav.toc {
  position: sticky;
  top: 0;
  background: var(--bg-paper);
  padding: 12px 32px;
  border-bottom: 1px solid var(--ink-faint);
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  z-index: 10;
}
nav.toc a {
  color: var(--ink-muted);
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
}
nav.toc a:hover { color: var(--crumb-warm); }
main { padding: 24px 32px 64px; max-width: 1280px; margin: 0 auto; }
section.card {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 20px 24px;
  margin: 0 0 24px;
  box-shadow: var(--shadow-1);
}
section.card h2 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--ink-strong);
}
section.card h2 .anchor {
  color: var(--ink-faint);
  font-weight: 400;
  margin-right: 8px;
}
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
@media (max-width: 768px) {
  .grid-2, .grid-3 { grid-template-columns: 1fr; }
  main { padding: 16px; }
  header.page, nav.toc { padding-left: 16px; padding-right: 16px; }
}
.kv { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; font-family: var(--font-mono); font-size: 12px; }
.kv dt { color: var(--ink-muted); }
.kv dd { margin: 0; color: var(--ink-strong); }
.pill {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .03em;
  text-transform: uppercase;
}
.pill.ok { background: rgba(46,139,87,.15); color: var(--ok); }
.pill.warn { background: rgba(210,105,30,.15); color: var(--warn); }
.pill.err { background: rgba(184,69,110,.15); color: var(--err); }
.pill.muted { background: rgba(110,99,87,.15); color: var(--ink-muted); }
.badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
}
.badge.actor { color: var(--bg-elev); }
.badge.kind { background: var(--bg-elev); color: var(--ink-muted); border: 1px solid var(--ink-faint); }
.badge.source { font-size: 10px; padding: 0 6px; border-radius: 4px; }
.badge.source-llm { background: rgba(123,79,184,.12); color: #5A3A8E; }
.badge.source-qa-check { background: rgba(200,146,58,.18); color: var(--crumb-warm); }
.badge.source-reducer { background: rgba(46,139,87,.12); color: var(--ok); }
.badge.source-hybrid { background: rgba(110,99,87,.15); color: var(--ink-muted); }
.deterministic-star {
  color: var(--deterministic);
  font-weight: 700;
  margin-left: 4px;
}
.cross-provider {
  font-family: var(--font-mono);
  font-size: 11px;
}
.cross-provider.ok::before { content: "✓ "; color: var(--ok); }
.cross-provider.warn::before { content: "⚠ "; color: var(--warn); }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
table th, table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--ink-faint); }
table th { color: var(--ink-muted); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
table tr:last-child td { border-bottom: 0; }
table.score td.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; text-align: right; }
table.cost td.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; text-align: right; }
.timeline { font-family: var(--font-mono); font-size: 12px; }
.timeline .row {
  display: grid;
  grid-template-columns: 60px 28px 110px 110px 1fr;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  align-items: baseline;
}
.timeline .row:hover { background: var(--bg-elev); }
.timeline .row.audit { background: rgba(184,69,110,.06); }
.timeline .row .ts { color: var(--ink-faint); }
.timeline .row .glyph { text-align: center; }
.timeline .row .actor { font-weight: 500; }
.timeline .row .kind { color: var(--ink-muted); }
.timeline .row .body { color: var(--ink-strong); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.timeline .detail {
  display: none;
  margin: 4px 0 12px 60px;
  padding: 12px 16px;
  background: var(--bg-elev);
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--ink-faint);
  font-size: 12px;
}
.timeline .row.expanded + .detail { display: block; }
.timeline .detail pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
.timeline .detail .meta-grid { font-family: var(--font-mono); font-size: 11px; color: var(--ink-muted); margin-top: 8px; }
.filters { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; font-family: var(--font-mono); font-size: 12px; }
.filters select, .filters input {
  padding: 4px 8px;
  border: 1px solid var(--ink-faint);
  border-radius: var(--radius-sm);
  background: var(--bg-elev);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--ink-strong);
}
.spark {
  display: inline-flex;
  gap: 1px;
  align-items: flex-end;
  height: 16px;
  vertical-align: middle;
}
.spark span {
  display: inline-block;
  width: 3px;
  background: var(--crumb-amber);
  border-radius: 1px;
}
.audit-list {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  font-family: var(--font-mono);
  font-size: 12px;
}
.audit-list li {
  padding: 4px 8px;
  background: rgba(184,69,110,.08);
  color: var(--err);
  border-radius: var(--radius-sm);
  margin-bottom: 4px;
}
.courteval-trace {
  font-family: var(--font-mono);
  font-size: 12px;
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 4px 12px;
}
.courteval-trace dt { color: var(--ink-muted); }
.iframe-wrap {
  position: relative;
  width: 100%;
  max-width: 428px;
  aspect-ratio: 9 / 16;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-elev);
  border: 1px solid var(--ink-faint);
}
.iframe-wrap iframe { width: 100%; height: 100%; border: 0; }
footer.page {
  padding: 16px 32px;
  text-align: center;
  color: var(--ink-faint);
  font-size: 11px;
  font-family: var(--font-mono);
}
@media print {
  nav.toc, .filters { display: none; }
  body { background: white; }
  section.card { box-shadow: none; border: 1px solid var(--ink-faint); }
  .timeline .row { cursor: default; }
}
`;
