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
    if (hints?.project_id && (!s.project_id || s.project_id === '—')) s.project_id = hints.project_id;
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
    const rows = arr.map(s => {
      const cls = ['session-row'];
      if (s.live) cls.push('live');
      if (activeSession === s.id) cls.push('active');
      const cost = s.metrics ? formatCost(s.metrics.cost_usd) : '—';
      const verdict = s.metrics?.last_verdict;
      const status = verdict
        ? (verdict === 'PASS' ? '✓' : verdict === 'PARTIAL' ? '~' : '✗')
        : (s.metrics?.done ? '·' : '▶');
      return '<div class="' + cls.join(' ') + '" data-id="' + s.id + '">' +
        '<button class="row-close" data-close="' + s.id + '" title="dismiss from sidebar (transcript preserved on disk)">×</button>' +
        '<div><span class="row-dot"></span><span class="row-id">' + escapeHTML(s.id.slice(0, 12)) + '…</span> <span style="color:var(--ink-tertiary);">' + status + '</span></div>' +
        '<div class="row-goal">' + escapeHTML(s.goal ?? '(no goal yet)') + '</div>' +
        '<div class="row-meta">' + cost + ' · ' + (s.metrics?.events ?? 0) + ' evt</div>' +
      '</div>';
    }).join('');
    return '<div class="project-group">' +
      '<h3 class="project-label" title="' + escapeHTML(pid) + '">' + escapeHTML(pid.slice(0, 12)) + '</h3>' +
      rows +
    '</div>';
  });
  list.innerHTML = blocks.join('');
  list.querySelectorAll('.session-row').forEach(el => {
    el.addEventListener('click', (e) => {
      // close button has its own handler — don't double-fire
      if (e.target?.closest?.('.row-close')) return;
      selectSession(el.dataset.id);
    });
  });
  list.querySelectorAll('.row-close').forEach(btn => {
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
  renderSandwichBar();
  $('sandwich-content').style.display = 'none';
  $('detail').classList.add('open');
}

function renderSandwichBar() {
  const bar = $('sandwich-actor-bar');
  if (!activeSession) { bar.innerHTML = ''; return; }
  const s = sessions.get(activeSession);
  const actors = s?.actors ?? [];
  if (actors.length === 0) {
    bar.innerHTML = '<span style="color:var(--ink-tertiary);font-size:11px;">no actors spawned yet</span>';
    return;
  }
  bar.innerHTML = actors.map(a =>
    '<button class="sw-btn" data-actor="' + escapeHTML(a) + '" style="' +
    'background:var(--surface-2);border:1px solid var(--hairline);color:var(--ink-muted);' +
    'padding:4px 10px;border-radius:var(--r-sm);font-family:inherit;font-size:11px;cursor:pointer;">' +
    escapeHTML(a) + '</button>'
  ).join('');
  bar.querySelectorAll('.sw-btn').forEach(btn => {
    btn.addEventListener('click', () => loadSandwich(btn.dataset.actor));
  });
}

async function loadSandwich(actor) {
  if (!activeSession) return;
  const pre = $('sandwich-content');
  pre.style.display = 'block';
  pre.textContent = 'loading…';
  try {
    const res = await fetch('/api/sessions/' + encodeURIComponent(activeSession) + '/sandwich/' + encodeURIComponent(actor));
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
es.addEventListener('append', (e) => {
  const d = JSON.parse(e.data);
  let arr = eventCache.get(d.session_id);
  if (!arr) { arr = []; eventCache.set(d.session_id, arr); }
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
    const sess = ensureSession(s.session_id, {
      project_id: s.project_id,
      goal: s.goal,
      preset: s.preset,
      actors: s.actors,
    });
    sess.metrics = s.metrics;
    eventCache.set(s.session_id, s.history ?? []);
  }
  if (!activeSession && payload.sessions?.[0]) selectSession(payload.sessions[0].session_id);
  else renderSessionList();
}).catch(() => {});

// ─── v3.4 Console — DAG topology + weaving ────────────────────────────────

// 9-actor pipeline DAG. Edges encode the canonical reducer routing flow.
// Coordinates are laid out by hand in 720×180 SVG space.
const DAG_NODES = {
  user:               { x: 60,  y: 90,  label: 'user' },
  coordinator:        { x: 160, y: 90,  label: 'coord' },
  'planner-lead':     { x: 260, y: 40,  label: 'planner' },
  researcher:         { x: 360, y: 40,  label: 'research' },
  builder:            { x: 460, y: 40,  label: 'builder' },
  'builder-fallback': { x: 460, y: 130, label: 'fallback' },
  system:             { x: 560, y: 90,  label: 'qa-check' },
  verifier:           { x: 640, y: 90,  label: 'verifier' },
  validator:          { x: 320, y: 140, label: 'validator' },
};
const DAG_EDGES = [
  ['user','coordinator'],
  ['coordinator','planner-lead'],
  ['planner-lead','researcher'],
  ['researcher','planner-lead'],
  ['planner-lead','builder'],
  ['builder','system'],
  ['system','verifier'],
  ['verifier','coordinator'],
  ['coordinator','builder-fallback'],
  ['builder-fallback','system'],
  ['verifier','validator'],
];

function renderDag() {
  const svg = $('dag-svg');
  if (!svg) return;
  // Build edges first (under nodes).
  const edgesSvg = DAG_EDGES.map(([from, to]) => {
    const a = DAG_NODES[from], b = DAG_NODES[to];
    if (!a || !b) return '';
    return '<path class="dag-edge" d="M' + a.x + ',' + a.y + ' L' + b.x + ',' + b.y + '" />';
  }).join('');
  const events = activeSession ? (eventCache.get(activeSession) ?? []) : [];
  const lastEvt = events[events.length - 1];
  const lastActor = lastEvt?.from;
  const recentActors = new Set(events.slice(-8).map(e => e.from));
  const nodesSvg = Object.entries(DAG_NODES).map(([actor, n]) => {
    const cls = ['dag-node'];
    if (lastActor === actor) cls.push('active');
    else if (recentActors.has(actor)) cls.push('recent');
    return '<g class="' + cls.join(' ') + '" data-actor="' + actor + '">' +
      '<circle cx="' + n.x + '" cy="' + n.y + '" r="22" />' +
      '<text x="' + n.x + '" y="' + (n.y + 3) + '">' + escapeHTML(n.label) + '</text>' +
    '</g>';
  }).join('');
  // Container for ripple overlays — appended/removed dynamically.
  svg.innerHTML = '<g id="dag-edges">' + edgesSvg + '</g>' +
                  '<g id="dag-ripples"></g>' +
                  '<g id="dag-nodes">' + nodesSvg + '</g>';
}

// Pipeline position narrative — 'where am I in the DAG' for the detail panel.
function pipelinePositionFor(evt) {
  const order = ['session.start','goal','question.socratic','answer.socratic','step.socratic',
    'step.concept','handoff.requested','step.research.video','step.research','step.design',
    'spec','build','qa.result','step.judge','judge.score','verify.result','done'];
  const i = order.indexOf(evt.kind);
  const phase = i < 0 ? 'meta'
    : i <= 4  ? 'PHASE A — Socratic & Concept'
    : i <= 7  ? 'PHASE A → B — Researcher'
    : i <= 9  ? 'PHASE B — Design & Synth'
    : i === 10 ? 'PHASE B → C — Spec sealed'
    : i === 11 ? 'PHASE C — Build'
    : i === 12 ? 'PHASE C → D — QA ground truth'
    : i <= 14 ? 'PHASE D — Verifier (CourtEval)'
    :           'PHASE D → done';
  return phase + ' · ' + evt.from + '/' + evt.kind;
}

// Trigger a one-shot weaving ripple when an event flows from one actor to
// another. Animates the dashed edge for 1.5s then removes the overlay.
function rippleEdge(fromActor, toActor) {
  const a = DAG_NODES[fromActor], b = DAG_NODES[toActor];
  if (!a || !b) return;
  const ripples = document.getElementById('dag-ripples');
  if (!ripples) return;
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('class', 'dag-ripple flow');
  path.setAttribute('d', 'M' + a.x + ',' + a.y + ' L' + b.x + ',' + b.y);
  ripples.appendChild(path);
  setTimeout(() => path.remove(), 1500);
}

// Weaving orchestrator — observe each new event and ripple from sender to
// the next-likely target. The map encodes "after kind X, the next message
// usually goes to actor Y" — derived from the reducer's switch/case.
const WEAVE_TARGET = {
  'goal':              'coordinator',
  'session.start':     null,
  'question.socratic': 'user',
  'answer.socratic':   'planner-lead',
  'spec':              'builder',
  'build':             'system',         // qa-check effect
  'qa.result':         'verifier',
  'judge.score':       'coordinator',
  'verify.result':     'coordinator',
  'handoff.requested': null,             // payload.to drives it
  'step.research.video': null,
};
function weaveOnAppend(msg) {
  const target = msg.kind === 'handoff.requested'
    ? (msg.to || msg.data?.to || null)
    : WEAVE_TARGET[msg.kind];
  if (target && DAG_NODES[target]) rippleEdge(msg.from, target);
  renderDag();
}

// ─── v3.4 Console input — POST /api/sessions/:id/inbox ────────────────────

function setConsoleEnabled(enabled) {
  $('console-line').disabled = !enabled;
  $('console-send').disabled = !enabled;
}

function renderConsoleHints() {
  const hints = ['/approve','/veto rebuild','/pause','/resume','/goto verifier','@builder use red palette','/note <text>','/redo'];
  const root = $('console-hints');
  root.innerHTML = hints.map(h =>
    '<button data-line="' + escapeHTML(h) + '">' + escapeHTML(h) + '</button>'
  ).join('');
  root.querySelectorAll('button').forEach(btn => {
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
    feedbackEl.textContent = '✓ queued — watcher will surface the resulting event in the swimlane shortly';
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
$('console-line').addEventListener('keydown', e => {
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
$('detail-msg').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    $('detail-msg-send').click();
  }
});

// Detail navigation — parent chain + children list.
let currentDetailEvent = null;
const _origShowDetail = showDetail;
showDetail = function(id) {
  _origShowDetail(id);
  if (!activeSession) return;
  const events = eventCache.get(activeSession) ?? [];
  const evt = events.find(e => e.id === id);
  if (!evt) return;
  currentDetailEvent = evt;
  $('detail-pipeline-pos').textContent = '◇ ' + pipelinePositionFor(evt);
  // Thread: parent → this → children
  const parent = evt.parent_event_id ? events.find(e => e.id === evt.parent_event_id) : null;
  const children = events.filter(e => e.parent_event_id === evt.id);
  const lines = [];
  if (parent) lines.push('↑ parent: ' + parent.from + ' / ' + parent.kind + ' — ' + (parent.body || '').slice(0, 80));
  lines.push('● this  : ' + evt.from + ' / ' + evt.kind + ' — ' + (evt.body || '').slice(0, 80));
  for (const c of children) lines.push('↓ child : ' + c.from + ' / ' + c.kind + ' — ' + (c.body || '').slice(0, 80));
  $('detail-thread').innerHTML = lines.map(l => '<div>' + escapeHTML(l) + '</div>').join('');
  $('detail-prev').disabled = !parent;
  $('detail-next').disabled = children.length === 0;
  $('detail-prev').onclick = () => parent && showDetail(parent.id);
  $('detail-next').onclick = () => children[0] && showDetail(children[0].id);
};

// Hook DAG re-render + weaving into the existing append handler. The original
// es.addEventListener('append', …) above pushes events; we add a parallel
// listener since EventSource supports multiple handlers per event type.
es.addEventListener('append', e => {
  const d = JSON.parse(e.data);
  if (d.session_id === activeSession) {
    weaveOnAppend(d.msg);
  }
});
es.addEventListener('session_start', e => {
  const d = JSON.parse(e.data);
  if (d.session_id === activeSession) renderDag();
});

// On session select, also reflect into DAG + console enable.
const _origSelectSession = selectSession;
selectSession = function(id) {
  _origSelectSession(id);
  setConsoleEnabled(Boolean(id));
  renderDag();
};

// Initial DAG render after first paint.
setTimeout(renderDag, 0);

// ─── v3.4 Logs view (ArgoCD-inspired) ──────────────────────────────────────
// Tab toggle between Pipeline (DAG + swimlane + scorecard + console) and
// Logs (per-actor live tail of <session>/agent-workspace/<actor>/spawn-*.log).

let activeView = 'pipeline';
let activeLogActor = null;
let logEventSource = null;
const logBuffer = []; // [{ kind: 'snapshot' | 'rotate' | 'chunk', file, text }]

function setActiveView(view) {
  activeView = view;
  document.querySelectorAll('nav.view-tabs button').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  document.querySelectorAll('.view-pane').forEach(p => {
    p.classList.toggle('active', p.id === 'view-' + view);
  });
  if (view === 'logs') {
    renderLogActorList();
    if (!activeLogActor && activeSession) {
      const s = sessions.get(activeSession);
      if (s?.actors?.length) selectLogActor(s.actors[0]);
    }
  } else {
    closeLogStream();
  }
}

document.querySelectorAll('nav.view-tabs button').forEach(b => {
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

  root.innerHTML = actors.map(a => {
    const cls = ['logs-actor-row'];
    if (a === activeLogActor) cls.push('active');
    if (a === recentActor) cls.push('live');
    if (erroredActors.has(a)) cls.push('errored');
    return '<div class="' + cls.join(' ') + '" data-actor="' + escapeHTML(a) + '">' +
      '<span class="dot"></span>' + escapeHTML(a) + '</div>';
  }).join('');
  root.querySelectorAll('.logs-actor-row').forEach(row => {
    row.addEventListener('click', () => selectLogActor(row.dataset.actor));
  });
}

function selectLogActor(actor) {
  activeLogActor = actor;
  $('logs-current-actor').textContent = actor;
  renderLogActorList();
  closeLogStream();
  logBuffer.length = 0;
  $('logs-content').innerHTML = '<div class="logs-empty">connecting…</div>';
  fetch('/api/sessions/' + encodeURIComponent(activeSession) + '/logs/' + encodeURIComponent(actor))
    .then(r => r.text())
    .then(text => {
      logBuffer.push({ kind: 'snapshot', file: 'snapshot', text });
      renderLogContent();
      openLogStream(actor);
    })
    .catch(err => {
      $('logs-content').innerHTML = '<div class="logs-empty">snapshot failed: ' + escapeHTML(err.message) + '</div>';
    });
}

function openLogStream(actor) {
  closeLogStream();
  const url = '/api/sessions/' + encodeURIComponent(activeSession) +
              '/logs/' + encodeURIComponent(actor) + '/stream';
  logEventSource = new EventSource(url);
  logEventSource.addEventListener('rotate', e => {
    const d = JSON.parse(e.data);
    logBuffer.push({ kind: 'rotate', file: d.file, text: '' });
    renderLogContent();
  });
  logEventSource.addEventListener('chunk', e => {
    const d = JSON.parse(e.data);
    logBuffer.push({ kind: 'chunk', file: d.file, text: d.text });
    renderLogContent();
  });
  logEventSource.addEventListener('heartbeat', () => {});
  logEventSource.onerror = () => {
    // EventSource auto-reconnects; soft hint only.
  };
}

function closeLogStream() {
  if (logEventSource) {
    logEventSource.close();
    logEventSource = null;
  }
}

function renderLogContent() {
  const filter = ($('logs-filter').value || '').trim().toLowerCase();
  const lines = [];
  let inStderr = false;
  for (const entry of logBuffer) {
    if (entry.kind === 'rotate') {
      lines.push({ kind: 'section', text: '── new spawn: ' + entry.file + ' ──' });
      inStderr = false;
      continue;
    }
    for (const raw of entry.text.split('\n')) {
      if (/^--- stderr ---$/.test(raw)) { inStderr = true; lines.push({ kind: 'section', text: raw }); continue; }
      if (/^--- stdout ---$/.test(raw)) { inStderr = false; lines.push({ kind: 'section', text: raw }); continue; }
      if (/^=== adapter /.test(raw)) { lines.push({ kind: 'section', text: raw }); continue; }
      lines.push({ kind: inStderr ? 'stderr' : 'stdout', text: raw });
    }
  }
  const visible = lines.slice(-4000); // cap DOM cost; full log lives on disk.
  const html = visible.map(l => {
    const cls = ['log-line'];
    if (l.kind === 'stderr') cls.push('stderr');
    if (l.kind === 'section') cls.push('section');
    if (filter && l.text.toLowerCase().includes(filter)) cls.push('match');
    return '<div class="' + cls.join(' ') + '">' + escapeHTML(l.text) + '</div>';
  }).join('');
  const root = $('logs-content');
  root.innerHTML = html || '<div class="logs-empty">no output yet</div>';
  if ($('logs-follow').checked) root.scrollTop = root.scrollHeight;
}

$('logs-filter').addEventListener('input', () => renderLogContent());
$('logs-clear').addEventListener('click', () => {
  logBuffer.length = 0;
  renderLogContent();
});
$('logs-copy').addEventListener('click', () => {
  const text = $('logs-content').textContent || '';
  navigator.clipboard?.writeText(text);
});

// DAG node click → jump to logs tab + select that actor (ArgoCD application
// graph → pod logs single-click navigation).
document.addEventListener('click', e => {
  const node = e.target.closest('.dag-node');
  if (!node) return;
  const actor = node.dataset.actor;
  if (!actor || !activeSession) return;
  setActiveView('logs');
  selectLogActor(actor);
});

// Refresh the logs sidebar when session changes / new agent.wake arrives so
// the freshly-spawned actor shows up immediately.
const _origSelectForLogs = selectSession;
selectSession = function(id) {
  _origSelectForLogs(id);
  if (activeView === 'logs') renderLogActorList();
};

// ─── v3.5 console — Output tab + new-session form + live execution feed ───
//
// "/crumb <text>" in the input bar  → POST /api/crumb/run (spawn a new session
//                                     with that goal as a child process)
// "/approve | /veto | @actor ..."   → existing inbox forward (PR #56)
// plain text                        → existing inbox forward as user.intervene

// ── (1) Live execution feed — terminal-like console above the input bar ──

let feedPaused = false;
const FEED_MAX_LINES = 800;

function appendFeedLine(meta) {
  const root = $('console-feed-body');
  if (!root) return;
  if (feedPaused) return;
  const ts = (meta.ts || new Date().toISOString()).split('T')[1]?.slice(0, 8) || '--:--:--';
  const cls = ['feed-line'];
  if (meta.kindClass) cls.push('kind-' + meta.kindClass);
  if (meta.stderr) cls.push('stderr');
  const div = document.createElement('div');
  div.className = cls.join(' ');
  const tsSpan = document.createElement('span');
  tsSpan.className = 'feed-ts';
  tsSpan.textContent = ts;
  const actorSpan = document.createElement('span');
  actorSpan.className = 'feed-actor';
  actorSpan.textContent = meta.actor || '';
  const bodySpan = document.createElement('span');
  bodySpan.className = 'feed-body';
  bodySpan.textContent = meta.body || '';
  div.appendChild(tsSpan);
  div.appendChild(actorSpan);
  div.appendChild(bodySpan);
  root.appendChild(div);
  while (root.childNodes.length > FEED_MAX_LINES) root.removeChild(root.firstChild);
  root.scrollTop = root.scrollHeight;
}

function classifyKindForFeed(kind) {
  if (kind === 'error') return 'error';
  if (kind === 'audit') return 'audit';
  if (kind === 'spec' || kind === 'spec.update') return 'spec';
  if (kind === 'build' || kind === 'qa.result') return 'build';
  if (kind === 'judge.score' || kind === 'verify.result' || kind.startsWith('step.judge')) return 'judge';
  if (kind.startsWith('handoff.')) return 'handoff';
  if (kind === 'session.start' || kind === 'session.end' || kind === 'note') return 'system';
  return '';
}

function feedLineFromTranscriptEvent(msg) {
  if (!msg) return null;
  let body = msg.body || '';
  if (!body && msg.data) {
    try {
      body = JSON.stringify(msg.data).slice(0, 200);
    } catch {
      body = '(data)';
    }
  }
  return {
    ts: msg.ts,
    actor: msg.from,
    body: '[' + msg.kind + '] ' + body,
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
});

// Wire the existing append SSE handler to also push to the feed.
es.addEventListener('append', e => {
  const d = JSON.parse(e.data);
  if (activeSession && d.session_id !== activeSession) return;
  const line = feedLineFromTranscriptEvent(d.msg);
  if (line) appendFeedLine(line);
});
es.addEventListener('session_start', e => {
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
  const url = '/api/sessions/' + encodeURIComponent(activeSession) + '/logs/' + encodeURIComponent(actor) + '/stream';
  const src = new EventSource(url);
  src.addEventListener('rotate', e => {
    const d = JSON.parse(e.data);
    appendFeedLine({
      ts: new Date().toISOString(),
      actor: actor,
      body: '── new spawn: ' + d.file + ' ──',
      kindClass: 'system',
    });
  });
  src.addEventListener('chunk', e => {
    const d = JSON.parse(e.data);
    let inStderr = false;
    for (const raw of d.text.split('\n')) {
      const line = raw.replace(/\r$/, '');
      if (line.length === 0) continue;
      if (/^--- stderr ---$/.test(line)) { inStderr = true; continue; }
      if (/^--- stdout ---$/.test(line)) { inStderr = false; continue; }
      if (/^=== adapter /.test(line)) {
        appendFeedLine({ ts: new Date().toISOString(), actor: actor, body: line, kindClass: 'system' });
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

// When a new agent.wake arrives for the active session, attach its log stream too.
es.addEventListener('append', e => {
  const d = JSON.parse(e.data);
  if (d.session_id !== activeSession) return;
  if (d.msg.kind === 'agent.wake' && d.msg.from && !feedLogActorSet.has(d.msg.from)) {
    attachFeedLogStream(d.msg.from);
  }
});

// Hook session select to (re)open feed log streams.
const _origSelectForFeed = selectSession;
selectSession = function(id) {
  _origSelectForFeed(id);
  refreshFeedLogStreams();
  refreshOutputTab();
};

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
$('new-session-goal').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); spawnNewCrumbRun(); }
});

async function spawnNewCrumbRun() {
  const goalEl = $('new-session-goal');
  const presetEl = $('new-session-preset');
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
  if (presetEl.value) body.preset = presetEl.value;
  try {
    const res = await fetch('/api/crumb/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      fb.textContent = '✗ ' + res.status + ': ' + (await res.text()).slice(0, 200);
      fb.className = 'console-feedback err';
      return;
    }
    const j = await res.json();
    fb.textContent = '✓ pid=' + j.pid + ' — session will appear shortly';
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
  if (/^\/crumb\s+/.test(line)) {
    // intercept — start a new session with the rest as goal
    const goal = line.replace(/^\/crumb\s+/, '').trim();
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
    for (const a of (e.artifacts ?? [])) {
      if (a.path) seen.set(a.path, a.sha256 ?? null);
    }
  }
  // v3.5 disk fallback — when builder skipped artifact.created emission, the
  // file may exist on disk regardless. Walk <session>/artifacts/ and merge in
  // anything we haven't already seen via the transcript.
  if (seen.size === 0 || ![...seen.keys()].some(p => /\.html$/.test(p))) {
    try {
      const r = await fetch('/api/sessions/' + encodeURIComponent(activeSession) + '/artifacts/list');
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
    const indexHit = [...seen.keys()].find(p => /(^|\/)index\.html$/.test(p));
    if (indexHit) return indexHit;
    const gameHit = [...seen.keys()].find(p => /(^|\/)game\.html$/.test(p));
    if (gameHit) return gameHit;
    const anyHtml = [...seen.keys()].find(p => /\.html$/.test(p));
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
  const htmlPaths = [...seen.keys()].filter(p => /\.html$/.test(p));
  select.innerHTML = htmlPaths.map(p =>
    '<option value="' + escapeHTML(p) + '"' + (p === head ? ' selected' : '') + '>' + escapeHTML(p) + '</option>'
  ).join('');
  loadArtifactIntoFrame(head);
}

function loadArtifactIntoFrame(artifactPath) {
  if (!activeSession || !artifactPath) return;
  const iframe = $('output-frame');
  const empty = $('output-empty');
  // strip "artifacts/" prefix because the server endpoint roots at <session>/artifacts.
  const rel = artifactPath.replace(/^artifacts\//, '');
  const url = '/api/sessions/' + encodeURIComponent(activeSession) +
              '/artifact/' + rel.split('/').map(encodeURIComponent).join('/') +
              '?t=' + Date.now();
  iframe.src = url;
  iframe.style.display = 'block';
  if (empty) empty.style.display = 'none';
}

$('output-path-select').addEventListener('change', e => {
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

// Refresh Output tab when artifact.created events arrive.
es.addEventListener('append', e => {
  const d = JSON.parse(e.data);
  if (d.session_id !== activeSession) return;
  if (d.msg.kind === 'artifact.created' && activeView === 'output') {
    refreshOutputTab();
  }
});

// Hook the existing setActiveView so switching to Output triggers a refresh.
const _origSetActiveView = setActiveView;
setActiveView = function(view) {
  _origSetActiveView(view);
  if (view === 'output') refreshOutputTab();
};
