/**
 * Single-file HTML dashboard. Inline CSS + inline JS, zero CDN.
 *
 * Visual identity: Linear (canvas / surface / hairline / lavender accent) as
 * the layout chassis; Sentry (deep purple, lime accent, uppercase technical
 * labels) as the audit / error surface. See design/DESIGN.md for the spec.
 */

export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Crumb · Live Dashboard</title>
<style>
:root {
  /* Linear chassis */
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

  /* Sentry audit / error palette */
  --audit-bg: #1f1633;
  --audit-fg: #fa7faa;
  --lime: #c2ef4e;
  --warn: #ffb287;

  /* Crumb actor lane glyphs */
  --actor-user: #5e6ad2;
  --actor-coordinator: #8a8f98;
  --actor-planner-lead: #ffb287;
  --actor-researcher: #79628c;
  --actor-builder: #c2ef4e;
  --actor-verifier: #fa7faa;
  --actor-builder-fallback: #62666d;
  --actor-validator: #ffb287;
  --actor-system: #34343a;

  --r-xs: 4px;
  --r-sm: 6px;
  --r-md: 8px;
  --r-lg: 12px;
  --r-pill: 9999px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  background: var(--canvas);
  color: var(--ink);
  font-family: ui-sans-serif, -apple-system, "SF Pro Display", "Segoe UI", system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  letter-spacing: -0.05px;
  height: 100%;
}

body { display: grid; grid-template-columns: 240px 1fr; height: 100vh; }

aside.sessions {
  background: var(--canvas);
  border-right: 1px solid var(--hairline);
  overflow-y: auto;
  padding: 12px 0;
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
  transition: background 60ms ease, border-color 60ms ease;
}
.session-row:hover { background: var(--surface-1); }
.session-row.active { border-left-color: var(--primary); background: var(--surface-2); }
.session-row .row-id { font-family: ui-monospace, "SF Mono", Consolas, monospace; font-size: 11px; color: var(--ink-subtle); }
.session-row .row-goal { color: var(--ink); margin-top: 2px; font-size: 13px; }
.session-row .row-meta { color: var(--ink-subtle); font-size: 11px; margin-top: 2px; }
.session-row .row-dot {
  display: inline-block; width: 6px; height: 6px; border-radius: 50%;
  background: var(--ink-tertiary); margin-right: 6px; vertical-align: 1px;
}
.session-row.live .row-dot { background: var(--lime); box-shadow: 0 0 6px var(--lime); }

main { display: flex; flex-direction: column; min-width: 0; overflow: hidden; }

header.summary {
  border-bottom: 1px solid var(--hairline);
  padding: 16px 24px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  align-items: center;
  background: var(--surface-1);
}
header.summary h1 {
  font-size: 22px;
  font-weight: 500;
  letter-spacing: -0.4px;
  display: flex; align-items: center; gap: 12px;
}
header.summary .goal {
  color: var(--ink-muted);
  font-size: 13px;
  margin-top: 4px;
}
.metrics-row {
  display: flex; gap: 20px;
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  font-size: 12px;
  color: var(--ink-muted);
}
.metrics-row dt { color: var(--ink-subtle); text-transform: uppercase; letter-spacing: 0.4px; font-size: 10px; }
.metrics-row dd { color: var(--ink); }

.pill {
  display: inline-block;
  padding: 2px 10px;
  border-radius: var(--r-pill);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}
.pill.ok { background: rgba(39, 166, 68, 0.15); color: #5fcb7e; }
.pill.partial { background: rgba(255, 178, 135, 0.18); color: var(--warn); }
.pill.err { background: rgba(250, 127, 170, 0.18); color: var(--audit-fg); }
.pill.muted { background: var(--surface-2); color: var(--ink-subtle); }

section.swimlane {
  flex: 1; min-height: 0; overflow: auto;
  padding: 16px 0 24px;
  background: var(--canvas);
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
  display: flex; align-items: center; gap: 8px;
}
.lane-label .glyph { width: 8px; height: 8px; border-radius: 50%; }
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
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  font-size: 11px;
  color: var(--ink);
  background: var(--surface-1);
  border: 1px solid var(--hairline);
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: transform 80ms ease, border-color 80ms ease, background 80ms ease;
  flex: 0 0 auto;
}
.evt:hover { border-color: var(--primary); background: var(--surface-2); }
.evt.deterministic { border-color: var(--lime); }
.evt.audit { border-color: var(--audit-fg); background: var(--audit-bg); color: var(--audit-fg); }
.evt.fresh { animation: fresh 1200ms ease; }
@keyframes fresh {
  0% { transform: translateX(-6px); opacity: 0; border-color: var(--primary-hover); }
  60% { transform: translateX(0); opacity: 1; }
  100% { border-color: var(--hairline); }
}

aside.detail {
  position: fixed; right: 0; top: 0; bottom: 0; width: 420px;
  background: var(--surface-1);
  border-left: 1px solid var(--hairline);
  padding: 20px;
  overflow-y: auto;
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  font-size: 12px;
  color: var(--ink-muted);
  transform: translateX(100%);
  transition: transform 140ms ease;
}
aside.detail.open { transform: translateX(0); }
aside.detail h3 {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--ink-subtle);
  margin-bottom: 12px;
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
  position: absolute; top: 12px; right: 12px;
  width: 24px; height: 24px; border-radius: var(--r-sm);
  border: 1px solid var(--hairline); background: var(--canvas); color: var(--ink-muted);
  cursor: pointer; font-size: 14px;
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
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
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
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  border-bottom: 1px solid var(--audit-fg);
  letter-spacing: 0.2px;
}
#audit-banner.show { display: block; }

.empty {
  color: var(--ink-tertiary);
  padding: 40px 24px;
  font-size: 13px;
}
</style>
</head>
<body>

<aside class="sessions">
  <h2>Sessions</h2>
  <div id="sess-list"></div>
</aside>

<main>
  <header class="summary">
    <div>
      <h1 id="header-title"><span class="pill muted">no session</span></h1>
      <div class="goal" id="header-goal">Pick a session on the left to track its progress in real time.</div>
    </div>
    <dl class="metrics-row">
      <div><dt>events</dt><dd id="m-events">—</dd></div>
      <div><dt>tokens</dt><dd id="m-tokens">—</dd></div>
      <div><dt>cache</dt><dd id="m-cache">—</dd></div>
      <div><dt>cost</dt><dd id="m-cost">—</dd></div>
      <div><dt>p95 lat</dt><dd id="m-p95">—</dd></div>
      <div><dt>err / audit</dt><dd id="m-err">—</dd></div>
    </dl>
  </header>

  <div id="audit-banner"></div>

  <section class="swimlane" id="swimlane">
    <div class="empty" id="swim-empty">Waiting for events…</div>
  </section>

  <section class="scorecard" id="scorecard"></section>
</main>

<aside class="detail" id="detail">
  <button class="close" id="detail-close" aria-label="Close detail">×</button>
  <h3 id="detail-title">Event detail</h3>
  <pre id="detail-meta"></pre>
  <h3>Body</h3>
  <pre id="detail-body"></pre>
  <h3>Data</h3>
  <pre id="detail-data"></pre>
</aside>

<script>
const ACTOR_LANE_ORDER = [
  'user','coordinator','planner-lead','researcher','builder','verifier','builder-fallback','validator','system'
];
const ACTOR_VAR = {
  'user':'--actor-user', 'coordinator':'--actor-coordinator',
  'planner-lead':'--actor-planner-lead', 'researcher':'--actor-researcher',
  'builder':'--actor-builder', 'verifier':'--actor-verifier',
  'builder-fallback':'--actor-builder-fallback', 'validator':'--actor-validator',
  'system':'--actor-system'
};

const sessions = new Map();
let activeSession = null;
const eventCache = new Map(); // session_id → DashboardMessage[]

function $(id) { return document.getElementById(id); }
function escapeHTML(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function formatTokens(n) { return n >= 1000 ? (n/1000).toFixed(1) + 'k' : String(n ?? 0); }
function formatPct(r) { return Math.round((r ?? 0) * 100) + '%'; }
function formatCost(n) { return '$' + (n ?? 0).toFixed(3); }

function ensureSession(id, hints) {
  let s = sessions.get(id);
  if (!s) {
    s = { id, goal: hints?.goal ?? null, preset: hints?.preset ?? null, metrics: null, live: true };
    sessions.set(id, s);
    eventCache.set(id, []);
  } else {
    if (hints?.goal && !s.goal) s.goal = hints.goal;
    if (hints?.preset && !s.preset) s.preset = hints.preset;
  }
  return s;
}

function renderSessionList() {
  const list = $('sess-list');
  const rows = [...sessions.values()].map(s => {
    const cls = ['session-row'];
    if (s.live) cls.push('live');
    if (activeSession === s.id) cls.push('active');
    const cost = s.metrics ? formatCost(s.metrics.cost_usd) : '—';
    return '<div class="' + cls.join(' ') + '" data-id="' + s.id + '">' +
      '<div><span class="row-dot"></span><span class="row-id">' + escapeHTML(s.id.slice(0, 12)) + '…</span></div>' +
      '<div class="row-goal">' + escapeHTML(s.goal ?? '(no goal yet)') + '</div>' +
      '<div class="row-meta">' + cost + ' · ' + (s.metrics?.events ?? 0) + ' evt</div>' +
    '</div>';
  });
  list.innerHTML = rows.join('') || '<div class="empty">No sessions yet.</div>';
  list.querySelectorAll('.session-row').forEach(el => {
    el.addEventListener('click', () => selectSession(el.dataset.id));
  });
}

function selectSession(id) {
  activeSession = id;
  renderSessionList();
  renderHeader();
  renderSwimlane();
  renderScorecard();
}

function renderHeader() {
  const s = activeSession ? sessions.get(activeSession) : null;
  if (!s) {
    $('header-title').innerHTML = '<span class="pill muted">no session</span>';
    $('header-goal').textContent = 'Pick a session on the left to track its progress in real time.';
    ['m-events','m-tokens','m-cache','m-cost','m-p95','m-err'].forEach(k => $(k).textContent = '—');
    return;
  }
  const m = s.metrics;
  let pill = '<span class="pill muted">in progress</span>';
  if (m?.last_verdict === 'PASS') pill = '<span class="pill ok">PASS ' + (m.last_aggregate ?? 0).toFixed(1) + '</span>';
  else if (m?.last_verdict === 'PARTIAL') pill = '<span class="pill partial">PARTIAL ' + (m.last_aggregate ?? 0).toFixed(1) + '</span>';
  else if (m?.last_verdict === 'FAIL' || m?.last_verdict === 'REJECT') pill = '<span class="pill err">' + m.last_verdict + ' ' + (m.last_aggregate ?? 0).toFixed(1) + '</span>';
  $('header-title').innerHTML = pill + ' <span style="color:var(--ink-subtle); font-size:13px; font-family:ui-monospace,monospace;">' + escapeHTML(s.id) + '</span>';
  $('header-goal').textContent = s.goal ?? '(no goal recorded)';
  $('m-events').textContent = m ? m.events : '—';
  $('m-tokens').textContent = m ? formatTokens(m.tokens_in) + ' → ' + formatTokens(m.tokens_out) : '—';
  $('m-cache').textContent = m ? formatPct(m.cache_ratio) : '—';
  $('m-cost').textContent = m ? formatCost(m.cost_usd) : '—';
  $('m-p95').textContent = m ? Math.round(m.latency_p95_ms) + 'ms' : '—';
  $('m-err').textContent = m ? (m.error_count + ' / ' + m.audit_count) : '—';
  const banner = $('audit-banner');
  if (m && m.audit_count > 0) {
    banner.textContent = '★ ' + m.audit_count + ' anti-deception audit event' + (m.audit_count === 1 ? '' : 's') + ' fired in this session.';
    banner.classList.add('show');
  } else banner.classList.remove('show');
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
  const lanes = ACTOR_LANE_ORDER.map(actor => {
    const evts = events.filter(e => e.from === actor);
    const cells = evts.map((e, i) => renderEvtCell(e, i === evts.length - 1)).join('');
    return '<div class="lane">' +
      '<div class="lane-label"><span class="glyph" style="background:var(' + ACTOR_VAR[actor] + ');"></span>' + actor + '</div>' +
      '<div class="lane-events">' + (cells || '<span style="color:var(--ink-tertiary); font-size:11px;">—</span>') + '</div>' +
    '</div>';
  });
  root.innerHTML = lanes.join('');
  root.querySelectorAll('.evt').forEach(el => {
    el.addEventListener('click', () => showDetail(el.dataset.id));
  });
}

function renderEvtCell(evt, isLast) {
  const cls = ['evt'];
  if (evt.metadata?.deterministic) cls.push('deterministic');
  if (evt.kind === 'audit' || (evt.metadata?.audit_violations?.length ?? 0) > 0) cls.push('audit');
  if (isLast) cls.push('fresh');
  return '<span class="' + cls.join(' ') + '" data-id="' + escapeHTML(evt.id) + '" title="' + escapeHTML(evt.kind) + '">' +
    escapeHTML(evt.kind) +
  '</span>';
}

function renderScorecard() {
  const root = $('scorecard');
  const events = activeSession ? eventCache.get(activeSession) ?? [] : [];
  const lastJudge = [...events].reverse().find(e => e.kind === 'judge.score' || e.kind === 'verify.result');
  const dims = ['D1','D2','D3','D4','D5','D6'];
  if (!lastJudge?.scores) {
    root.innerHTML = dims.map(d => dimCard(d, null, null)).join('');
    return;
  }
  root.innerHTML = dims.map(d => {
    const dim = lastJudge.scores[d];
    return dimCard(d, dim?.score, dim?.source);
  }).join('');
}

function dimCard(label, score, source) {
  return '<div class="dim">' +
    '<div class="label">' + label + '</div>' +
    '<div class="value">' + (score == null ? '—' : score.toFixed(1)) + '</div>' +
    '<div class="source">' + (source ?? '—') + '</div>' +
  '</div>';
}

function showDetail(id) {
  if (!activeSession) return;
  const events = eventCache.get(activeSession) ?? [];
  const evt = events.find(e => e.id === id);
  if (!evt) return;
  const fields = [
    'id: ' + evt.id,
    'ts: ' + evt.ts,
    'from: ' + evt.from + (evt.to ? ' → ' + evt.to : ''),
    'kind: ' + evt.kind,
    evt.parent_event_id ? 'parent: ' + evt.parent_event_id : '',
    evt.metadata?.harness ? 'harness: ' + evt.metadata.harness : '',
    evt.metadata?.provider ? 'provider: ' + evt.metadata.provider : '',
    evt.metadata?.model ? 'model: ' + evt.metadata.model : '',
    evt.metadata?.tokens_in != null ? 'tokens: ' + evt.metadata.tokens_in + ' → ' + (evt.metadata.tokens_out ?? 0) : '',
    evt.metadata?.cost_usd != null ? 'cost: $' + evt.metadata.cost_usd.toFixed(4) : '',
    evt.metadata?.latency_ms != null ? 'latency: ' + evt.metadata.latency_ms + 'ms' : '',
  ].filter(Boolean).join('\\n');
  $('detail-meta').textContent = fields;
  $('detail-body').textContent = evt.body ?? '(empty)';
  $('detail-data').textContent = evt.data ? JSON.stringify(evt.data, null, 2) : '(none)';
  $('detail').classList.add('open');
}

$('detail-close').addEventListener('click', () => $('detail').classList.remove('open'));

const params = new URLSearchParams(location.search);
const target = params.get('session') ?? '*';

const es = new EventSource('/api/stream?session=' + encodeURIComponent(target));
es.addEventListener('session_start', (e) => {
  const d = JSON.parse(e.data);
  ensureSession(d.session_id, { goal: d.goal, preset: d.preset });
  if (!activeSession) selectSession(d.session_id);
  else renderSessionList();
});
es.addEventListener('append', (e) => {
  const d = JSON.parse(e.data);
  let arr = eventCache.get(d.session_id);
  if (!arr) { arr = []; eventCache.set(d.session_id, arr); }
  arr.push(d.msg);
  ensureSession(d.session_id, null);
  if (d.session_id === activeSession) {
    renderSwimlane();
    renderScorecard();
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
es.addEventListener('heartbeat', () => {});
es.onerror = () => {
  // EventSource auto-reconnects; surface a soft hint via the title.
  document.title = 'Crumb · Live (reconnecting…)';
  setTimeout(() => { document.title = 'Crumb · Live Dashboard'; }, 2000);
};

fetch('/api/sessions').then(r => r.json()).then(payload => {
  for (const s of payload.sessions ?? []) {
    ensureSession(s.session_id, { goal: s.goal, preset: s.preset });
    eventCache.set(s.session_id, s.history ?? []);
  }
  if (!activeSession && payload.sessions?.[0]) selectSession(payload.sessions[0].session_id);
  else renderSessionList();
}).catch(() => {});

</script>
</body>
</html>
`;
