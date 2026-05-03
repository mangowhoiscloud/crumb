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
function escapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
// IDE-style grep: escape `text` to HTML, then wrap each case-insensitive substring
// match of `query` with <mark class="grep-hit"> for orange-highlight + nav.
function highlightHTML(text, query) {
  const safe = escapeHTML(text);
  if (!query) return safe;
  const safeQuery = escapeHTML(query);
  if (!safeQuery) return safe;
  const re = new RegExp(escapeRegExp(safeQuery), 'gi');
  return safe.replace(re, m => '<mark class="grep-hit">' + m + '</mark>');
}

// Per-panel grep state. cursor is preserved across re-renders so streaming
// content doesn't reset the user's nav position.
const grepState = {
  logs:       { query: '', cursor: 0 },
  transcript: { query: '', cursor: 0 },
  feed:       { query: '', cursor: 0 },
};

function refreshGrepNav(panelKey, rootEl, countEl, prevBtn, nextBtn, opts = {}) {
  const state = grepState[panelKey];
  const hits = rootEl ? Array.from(rootEl.querySelectorAll('mark.grep-hit')) : [];
  state.matches = hits;
  hits.forEach(h => h.classList.remove('active'));
  const total = hits.length;
  if (countEl) {
    countEl.classList.toggle('has-hits', total > 0);
    countEl.classList.toggle('no-hits', !!state.query && total === 0);
    countEl.textContent = !state.query
      ? '—'
      : (total === 0 ? '0 / 0' : ((state.cursor % total) + 1) + ' / ' + total);
  }
  if (prevBtn) prevBtn.disabled = total === 0;
  if (nextBtn) nextBtn.disabled = total === 0;
  if (total === 0) { state.cursor = 0; return; }
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
  if (countEl) countEl.textContent = (state.cursor + 1) + ' / ' + state.matches.length;
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
      if (e.shiftKey) prevBtn?.click(); else nextBtn?.click();
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
      // v3.5 bootstrap classifier: live / idle / interrupted / abandoned / terminal
      if (s.state) cls.push('state-' + s.state);
      if (activeSession === s.id) cls.push('active');
      const cost = s.metrics ? formatCost(s.metrics.cost_usd) : '—';
      const verdict = s.metrics?.last_verdict;
      const status = verdict
        ? (verdict === 'PASS' ? '✓' : verdict === 'PARTIAL' ? '~' : '✗')
        : (s.metrics?.done ? '·' : '▶');
      const stateTitle = s.state ? `state: ${s.state}${s.done_reason ? ' (' + s.done_reason + ')' : ''}` : '';
      // PR-G7-B — Resume button on paused / interrupted / budget-exhausted
      // sessions. Hidden when the session is live (no need) or terminal-pass.
      // `done_reason` heuristic: budget exhausted → forceable resume.
      const resumable = !s.live && (
        s.state === 'paused' || s.state === 'interrupted' || s.state === 'idle' ||
        (s.done_reason && /token_exhausted|wall_clock|all_builders_open/.test(s.done_reason))
      );
      const forceFlag = s.done_reason && /token_exhausted|wall_clock|all_builders_open/.test(s.done_reason);
      const resumeBtn = resumable
        ? '<button class="row-resume" data-resume="' + s.id + '"' +
          (forceFlag ? ' data-force="1"' : '') +
          ' title="re-enter coordinator loop (force=' + (forceFlag ? 'true' : 'false') + ')">↻</button>'
        : '';
      return '<div class="' + cls.join(' ') + '" data-id="' + s.id + '" title="' + escapeHTML(stateTitle) + '">' +
        '<button class="row-close" data-close="' + s.id + '" title="dismiss from sidebar (transcript preserved on disk)">×</button>' +
        resumeBtn +
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
      // close + resume buttons have their own handlers — don't double-fire
      if (e.target?.closest?.('.row-close')) return;
      if (e.target?.closest?.('.row-resume')) return;
      selectSession(el.dataset.id);
    });
  });
  // PR-G7-B — Resume button click handler.
  list.querySelectorAll('.row-resume').forEach(btn => {
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
          setTimeout(() => { btn.disabled = false; btn.textContent = '↻'; }, 3000);
          return;
        }
        // Optimistic UI: row will re-render on next watcher poll once status flips to running.
        btn.textContent = '✓';
        setTimeout(() => { btn.disabled = false; btn.textContent = '↻'; }, 2000);
      } catch (err) {
        console.error('[studio] resume error:', err);
        btn.textContent = '!';
        setTimeout(() => { btn.disabled = false; btn.textContent = '↻'; }, 3000);
      }
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

// Q2: hooks pattern replaces 5-deep `selectSession` monkey-patch chain.
// External callers register via `onSessionSelect(hook)`; selectSession runs
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
// Q5: single append dispatcher — every previous `es.addEventListener('append', ...)`
// site (8 of them) parsed e.data independently and re-filtered by session_id.
// Now: parse once, fan out to registered handlers via `onAppendMsg(fn)`. Each
// handler receives the parsed envelope `d = { session_id, msg, ... }`. Handler
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
  setTimeout(() => { document.title = 'Crumb · Live Studio'; }, 2000);
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
    // v3.5 bootstrap: preserve classifier output for sidebar dot color + sort.
    sess.state = s.state ?? null;
    sess.last_activity_at = s.last_activity_at ?? null;
    sess.done_reason = s.done_reason ?? null;
    sess.live = s.state === 'live'; // legacy flag for back-compat
    eventCache.set(s.session_id, s.history ?? []);
  }
  if (!activeSession && payload.sessions?.[0]) selectSession(payload.sessions[0].session_id);
  else renderSessionList();
}).catch(() => {});

// ─── v3.5 Console — DAG topology + weaving ────────────────────────────────
//
// 9-actor pipeline DAG, grounded against src/reducer/index.ts:
//   goal → spawn planner-lead                              (line 100)
//   spec → spawn builder                                   (line 137)
//   build → qa_check effect                                (line 158)
//   qa.result → spawn verifier                             (line 182)
//   judge.score PASS → done(verdict_pass)                  (line 288)
//   judge.score FAIL+breaker_OPEN  → spawn builder-fallback (line 300)
//   judge.score FAIL+breaker_CLOSED → rollback planner-lead (line 309)
//   handoff.requested(researcher) → spawn researcher       (line 528)
//   step.research → spawn planner-lead (resume phase B)    (line 546)
//   anti-deception violation → append kind=audit (validator) (line 226)
//
// Edge type vocabulary (visual semantics aligned with mermaid-diagrams skill):
//   handoff   indigo solid — standard reducer-driven spawn
//   rollback  amber dashed — verifier FAIL → planner respec
//   fallback  red dashed   — verifier FAIL + breaker OPEN → builder-fallback
//   terminal  green solid  — verifier PASS → done
//   audit     pink dotted  — anti-deception side-effect (conditional, not routing)
//   intervene gray dotted  — user.veto / user.intervene direct jump
const DAG_NODES = {
  user:               { x: 50,  y: 100, label: 'user',     phase: null },
  coordinator:        { x: 140, y: 100, label: 'coord',    phase: null },
  'planner-lead':     { x: 250, y: 50,  label: 'planner',  phase: 'A' },
  researcher:         { x: 360, y: 50,  label: 'research', phase: 'A' },
  builder:            { x: 470, y: 50,  label: 'builder',  phase: 'C' },
  'builder-fallback': { x: 470, y: 155, label: 'fallback', phase: 'C' },
  system:             { x: 580, y: 100, label: 'qa-check', phase: 'C' },
  verifier:           { x: 680, y: 100, label: 'verifier', phase: 'D' },
  done:               { x: 770, y: 100, label: 'done',     phase: 'D' },
  validator:          { x: 680, y: 175, label: 'validator',phase: null },
};

// Phase background zones — Phase A (planner+researcher = Socratic+Concept,
// Researcher, Design+Synth), Phase C (builder+qa-check = Build+QA), Phase D
// (verifier+done = Verify+Terminal). Phase B is folded into A's planner since
// planner-lead handles A's Socratic AND B's Design+Synth (two-phase spawn).
const DAG_PHASES = [
  { id: 'A', label: 'Phase A·B — Spec',  x: 200, y: 10, w: 220, h: 80 },
  { id: 'C', label: 'Phase C — Build/QA', x: 425, y: 10, w: 195, h: 195 },
  { id: 'D', label: 'Phase D — Verify',   x: 625, y: 10, w: 175, h: 195 },
];

const DAG_EDGES = [
  // handoff (standard reducer spawn flow)
  ['user',             'coordinator',      'handoff'],
  ['coordinator',      'planner-lead',     'handoff'],
  ['planner-lead',     'researcher',       'handoff'],
  ['researcher',       'planner-lead',     'handoff'],
  ['planner-lead',     'builder',          'handoff'],
  ['builder',          'system',           'handoff'],
  ['system',           'verifier',         'handoff'],
  ['builder-fallback', 'system',           'handoff'],
  // rollback (FAIL + breaker_CLOSED → planner respec, line 309)
  ['verifier',         'planner-lead',     'rollback'],
  // fallback (FAIL + breaker_OPEN → builder-fallback direct, line 300)
  ['verifier',         'builder-fallback', 'fallback'],
  // terminal (PASS → done, line 288)
  ['verifier',         'done',             'terminal'],
  // audit (anti-deception side-effect, conditional — line 226)
  ['verifier',         'validator',        'audit'],
  // intervene (user.veto / user.intervene goto=X, lines 322 + 396)
  ['user',             'planner-lead',     'intervene'],
  ['user',             'builder',          'intervene'],
  ['user',             'verifier',         'intervene'],
];

function renderDag() {
  const svg = $('dag-svg');
  if (!svg) return;
  // Phase zone rects (under everything)
  const zonesSvg = DAG_PHASES.map(p =>
    '<g class="dag-phase phase-' + p.id + '">' +
      '<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" rx="8" />' +
      '<text x="' + (p.x + 8) + '" y="' + (p.y + 14) + '" class="phase-label">' + escapeHTML(p.label) + '</text>' +
    '</g>'
  ).join('');
  // Edges (typed) — paths use slight curves where they would overlap straight neighbors.
  const edgesSvg = DAG_EDGES.map(([from, to, type]) => {
    const a = DAG_NODES[from], b = DAG_NODES[to];
    if (!a || !b) return '';
    return '<path class="dag-edge edge-' + type + '" d="' + edgePath(a, b, from, to) + '" />';
  }).join('');
  const events = activeSession ? (eventCache.get(activeSession) ?? []) : [];
  const lastEvt = events[events.length - 1];
  const lastActor = lastEvt?.from;
  const recentActors = new Set(events.slice(-8).map(e => e.from));
  const isDone = events.some(e => e.kind === 'done');
  const nodesSvg = Object.entries(DAG_NODES).map(([actor, n]) => {
    const cls = ['dag-node', 'node-' + actor.replace(/[^a-z]/gi, '-')];
    if (lastActor === actor) cls.push('active');
    else if (recentActors.has(actor)) cls.push('recent');
    if (actor === 'done' && isDone) cls.push('active');
    return '<g class="' + cls.join(' ') + '" data-actor="' + actor + '">' +
      '<circle cx="' + n.x + '" cy="' + n.y + '" r="22" />' +
      '<text x="' + n.x + '" y="' + (n.y + 3) + '">' + escapeHTML(n.label) + '</text>' +
    '</g>';
  }).join('');
  svg.innerHTML = '<g id="dag-zones">' + zonesSvg + '</g>' +
                  '<g id="dag-edges">' + edgesSvg + '</g>' +
                  '<g id="dag-ripples"></g>' +
                  '<g id="dag-nodes">' + nodesSvg + '</g>';
}

// Most edges are straight lines between node centers; the verifier→planner
// rollback would overlap the planner→builder→system→verifier arc, so we curve
// it upward over the top. Same for verifier→fallback (curves down).
function edgePath(a, b, from, to) {
  if (from === 'verifier' && to === 'planner-lead') {
    // Curve up & over the top
    const cx = (a.x + b.x) / 2, cy = Math.min(a.y, b.y) - 40;
    return 'M' + a.x + ',' + a.y + ' Q' + cx + ',' + cy + ' ' + b.x + ',' + b.y;
  }
  if (from === 'verifier' && to === 'builder-fallback') {
    // Curve down under the bottom
    const cx = (a.x + b.x) / 2, cy = Math.max(a.y, b.y) + 30;
    return 'M' + a.x + ',' + a.y + ' Q' + cx + ',' + cy + ' ' + b.x + ',' + b.y;
  }
  return 'M' + a.x + ',' + a.y + ' L' + b.x + ',' + b.y;
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
  path.setAttribute('d', edgePath(a, b, fromActor, toActor));
  ripples.appendChild(path);
  setTimeout(() => path.remove(), 1500);
}

// Weaving orchestrator — observe each new event and ripple from sender to
// the next-likely target. The map encodes "after kind X, the next message
// usually goes to actor Y" — derived from the reducer's switch/case.
const WEAVE_TARGET = {
  'goal':                'coordinator',
  'session.start':       null,
  'question.socratic':   'user',
  'answer.socratic':     'planner-lead',
  'spec':                'builder',
  'spec.update':         'builder',
  'build':               'system',         // qa-check effect (line 158)
  'qa.result':           'verifier',       // line 182
  'step.research':       'planner-lead',   // line 546 — researcher → resume planner
  'step.research.video': null,             // intermediate, no routing
  'handoff.requested':   null,             // payload.to drives it (researcher path: line 528)
  'audit':               null,             // validator side-effect, no onward routing
};
// Verdict-based branching for verify.result / judge.score. PASS → done,
// FAIL/REJECT splits on circuit breaker state at the time of emission. We
// can't read state from the reducer here, but we can fall back to the
// most-likely path (rollback to planner) when breaker info isn't visible.
function weaveTargetForVerdict(msg) {
  const verdict = msg.scores?.verdict ?? msg.data?.verdict;
  if (verdict === 'PASS') return 'done';
  if (verdict === 'PARTIAL') return null; // user-confirm hook, no spawn
  if (verdict === 'FAIL' || verdict === 'REJECT') {
    // Heuristic: if the active session has accumulated ≥3 builder errors, the
    // breaker is OPEN → fallback. Otherwise rollback to planner.
    const events = activeSession ? (eventCache.get(activeSession) ?? []) : [];
    const builderErrors = events.filter(e => e.from === 'builder' && e.kind === 'error').length;
    return builderErrors >= 3 ? 'builder-fallback' : 'planner-lead';
  }
  return null;
}
function weaveOnAppend(msg) {
  let target;
  if (msg.kind === 'handoff.requested') {
    target = msg.to || msg.data?.to || null;
  } else if (msg.kind === 'verify.result' || msg.kind === 'judge.score') {
    target = weaveTargetForVerdict(msg);
  } else {
    target = WEAVE_TARGET[msg.kind];
  }
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
// Q5: append-handler fan-out (was: independent es.addEventListener('append'))
onAppendMsg((d) => {
  if (d.session_id === activeSession) {
    weaveOnAppend(d.msg);
  }
});
es.addEventListener('session_start', e => {
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
  const query = grepState.logs.query;
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
  const qLower = query.toLowerCase();
  const html = visible.map(l => {
    const cls = ['log-line'];
    if (l.kind === 'stderr') cls.push('stderr');
    if (l.kind === 'section') cls.push('section');
    if (query && l.text.toLowerCase().includes(qLower)) cls.push('has-match');
    return '<div class="' + cls.join(' ') + '">' + highlightHTML(l.text, query) + '</div>';
  }).join('');
  const root = $('logs-content');
  root.innerHTML = html || '<div class="logs-empty">no output yet</div>';
  if ($('logs-follow').checked) root.scrollTop = root.scrollHeight;
  refreshGrepNav('logs', root, $('logs-grep-count'), $('logs-grep-prev'), $('logs-grep-next'));
}

bindGrepInput($('logs-filter'), $('logs-grep-prev'), $('logs-grep-next'), 'logs', renderLogContent);
$('logs-grep-prev').addEventListener('click', () => gotoGrepMatch('logs', -1, $('logs-grep-count')));
$('logs-grep-next').addEventListener('click', () => gotoGrepMatch('logs',  1, $('logs-grep-count')));
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

let feedPaused = false;
const FEED_MAX_LINES = 2000; // bumped from 800 — stream-json rendering produces 3-5× line density

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
    refreshGrepNav('feed', root, $('console-feed-grep-count'), $('console-feed-grep-prev'), $('console-feed-grep-next'));
  }
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
  refreshGrepNav('feed', root, $('console-feed-grep-count'), $('console-feed-grep-prev'), $('console-feed-grep-next'), { scroll: !!q });
}

function classifyKindForFeed(kind) {
  if (kind === 'error') return 'error';
  if (kind === 'audit') return 'audit';
  if (kind === 'spec' || kind === 'spec.update') return 'spec';
  if (kind === 'build' || kind === 'qa.result') return 'build';
  if (kind === 'judge.score' || kind === 'verify.result' || kind.startsWith('step.judge')) return 'judge';
  if (kind.startsWith('handoff.')) return 'handoff';
  // PR-F B — stream-json tap surfaces tool_use as kind=tool.call. Render as
  // assistant-text style so it stands out from system notes but blends with
  // the actor's own narration. Repeat-collapse (PR-F D) handles the volume.
  if (kind === 'tool.call') return 'tool-call';
  if (kind === 'artifact.created') return 'build';
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
  refreshGrepNav('feed', $('console-feed-body'), $('console-feed-grep-count'), $('console-feed-grep-prev'), $('console-feed-grep-next'));
});

bindGrepInput($('console-feed-grep'), $('console-feed-grep-prev'), $('console-feed-grep-next'), 'feed', rehighlightFeed);
$('console-feed-grep-prev')?.addEventListener('click', () => gotoGrepMatch('feed', -1, $('console-feed-grep-count')));
$('console-feed-grep-next')?.addEventListener('click', () => gotoGrepMatch('feed',  1, $('console-feed-grep-count')));

// Q5: append-handler fan-out — push every transcript event into the feed.
onAppendMsg((d) => {
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
      // Try stream-json (Claude Code shape) first — render Claude-Code-style
      // ⏺/⎿/✓ narrative bubbles above the per-session chat input.
      const bubbles = renderStreamJsonLine(line);
      if (bubbles) {
        for (const b of bubbles) {
          appendFeedLine({
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
onSessionSelect(() => {
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
$('new-session-goal').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); spawnNewCrumbRun(); }
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
  // PR-F D — adapter picker. When set, server forwards `--adapter <id>` to
  // `crumb run` so every actor goes through that adapter regardless of
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
    const refs = videoTextarea.value.split('\n').map(s => s.trim()).filter(Boolean);
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
      fb.textContent = '✗ adapter ' + j.adapter + ' unavailable (' + j.reason + ')' + hint + auth + avail;
      fb.className = 'console-feedback err';
      return;
    }
    if (!res.ok) {
      fb.textContent = '✗ ' + res.status + ': ' + (await res.text()).slice(0, 200);
      fb.className = 'console-feedback err';
      return;
    }
    const j = await res.json();
    fb.textContent = '✓ pid=' + j.pid + (j.adapter ? ' (' + j.adapter + ')' : '') + ' — session will appear shortly';
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

// Q5: append-handler fan-out — refresh Output tab when artifact.created arrives.
onAppendMsg((d) => {
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

// ─── v3.5 Studio hardening: resize, dismiss, resume, transcript ───────

// (1) Draggable pane resize. Persists widths in localStorage so a refresh
// keeps the user's chosen layout.
function makeResizable(handleId, onDelta, persistKey, getInitial) {
  const handle = $(handleId);
  if (!handle) return;
  let startX = 0;
  let startVal = 0;
  let dragging = false;
  const persisted = persistKey ? Number(localStorage.getItem(persistKey)) : NaN;
  if (persisted && persisted > 0) onDelta(persisted, /*absolute*/true);
  const onMove = (e) => {
    if (!dragging) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const dx = x - startX;
    onDelta(startVal, false, dx);
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
    startX = e.touches ? e.touches[0].clientX : e.clientX;
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
    if (e.kind === 'error' || (e.kind === 'agent.stop' && /timed out|exit=[1-9]/.test(e.body || ''))) {
      return e;
    }
    if (e.kind === 'agent.wake' || e.kind === 'build' || e.kind === 'spec' || e.kind === 'judge.score') {
      return null; // a healthy event after the failure → no resume needed
    }
  }
  return null;
}
function refreshResumeButton() {
  const btn = $('resume-btn');
  if (!btn) return;
  if (!activeSession) { btn.style.display = 'none'; return; }
  const evt = lastActorErrorEvent();
  if (!evt) { btn.style.display = 'none'; return; }
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
  // Inbox parser already handles `/redo` and `/resume` lines.
  const line = actor ? `/redo @${actor} resume after timeout/error` : '/resume';
  await sendInboxLine(activeSession, line, $('console-feedback'));
  setTimeout(refreshResumeButton, 1000);
});
// Q5: append-handler fan-out — refresh resume button on every append.
onAppendMsg(() => refreshResumeButton());

// (4) Transcript viewer — pretty-printed jsonl, filterable, copyable.
function renderTranscriptView() {
  const root = $('transcript-content');
  if (!root) return;
  if (!activeSession) { root.textContent = '(no session selected)'; return; }
  const arr = eventCache.get(activeSession) || [];
  const query = grepState.transcript.query;
  const qLower = query.toLowerCase();
  const pretty = $('transcript-pretty')?.checked ?? true;
  const lines = arr
    .filter(e => {
      if (!query) return true;
      return JSON.stringify(e).toLowerCase().includes(qLower);
    })
    .map(e => pretty ? JSON.stringify(e, null, 2) : JSON.stringify(e));
  const joined = lines.join('\n\n');
  // <pre> preserves whitespace, so innerHTML keeps the pretty layout while letting us inline-mark matches.
  root.innerHTML = highlightHTML(joined, query);
  $('transcript-status').textContent = `${arr.length} events · showing ${lines.length}`;
  refreshGrepNav('transcript', root, $('transcript-grep-count'), $('transcript-grep-prev'), $('transcript-grep-next'));
}
bindGrepInput($('transcript-filter'), $('transcript-grep-prev'), $('transcript-grep-next'), 'transcript', renderTranscriptView);
$('transcript-grep-prev')?.addEventListener('click', () => gotoGrepMatch('transcript', -1, $('transcript-grep-count')));
$('transcript-grep-next')?.addEventListener('click', () => gotoGrepMatch('transcript',  1, $('transcript-grep-count')));
$('transcript-pretty')?.addEventListener('change', renderTranscriptView);
$('transcript-copy')?.addEventListener('click', () => {
  navigator.clipboard?.writeText($('transcript-content').textContent || '');
});
const _origSetActiveView2 = setActiveView;
setActiveView = function(view) {
  _origSetActiveView2(view);
  if (view === 'transcript') renderTranscriptView();
};
// Q5: append-handler fan-out — re-render transcript view on every append.
onAppendMsg((d) => {
  if (activeView === 'transcript' && d.session_id === activeSession) renderTranscriptView();
});

// (5) Coordinator visibility: surface system "dispatch.spawn" notes as
// coordinator routing decisions in the live exec feed. Coordinator is
// host-inline (v3 invariant) so it doesn't emit `agent.wake`/`agent.stop`
// during normal routing — only on rollback/stop/done. Without this attribution
// the coordinator lane appears silent even though routing is happening.
// Q5: append-handler fan-out — coordinator visibility note → feed line.
onAppendMsg((d) => {
  if (activeSession && d.session_id !== activeSession) return;
  const m = d.msg;
  if (m && m.from === 'system' && m.kind === 'note' && /dispatch\.spawn/.test(m.body || '')) {
    const target = m.data?.actor || '?';
    appendFeedLine({
      ts: m.ts,
      actor: 'coordinator',
      body: `→ route: spawn(${target}) via ${m.data?.adapter || '?'} [host-inline routing]`,
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
  if (name === 'Bash') return (input.command || '').replace(/\s+/g, ' ').slice(0, 90);
  if (name === 'Read') return input.file_path || '';
  if (name === 'Write') return input.file_path || '';
  if (name === 'Edit') return input.file_path || '';
  if (name === 'Grep') return (input.pattern || '') + (input.path ? ' in ' + input.path : '');
  if (name === 'Glob') return input.pattern || '';
  if (name === 'Monitor') return JSON.stringify(input).slice(0, 90);
  if (name === 'Task' || name === 'Agent') {
    return (input.description || '') + (input.subagent_type ? ' [' + input.subagent_type + ']' : '');
  }
  if (name === 'TodoWrite') {
    const todos = input.todos || [];
    const inProgress = todos.filter(t => t.status === 'in_progress').map(t => t.content);
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
    body = body.map(b => {
      if (typeof b === 'string') return b;
      if (b.text) return b.text;
      if (b.content) return typeof b.content === 'string' ? b.content : JSON.stringify(b.content);
      return JSON.stringify(b);
    }).join(' ');
  } else if (typeof body === 'object' && body !== null) {
    body = JSON.stringify(body);
  }
  body = String(body ?? '');
  // Compact: collapse newlines and tabs, then truncate.
  body = body.replace(/\s+/g, ' ').trim();
  const max = isError ? 240 : 180;
  return body.length > max ? body.slice(0, max - 1) + '…' : body;
}

function renderStreamJsonLine(raw) {
  // Cheap pre-check: stream-json lines start with '{'. Anything else is plain
  // log output and should fall through to the raw renderer.
  if (!raw || raw.charCodeAt(0) !== 123) return null;
  let obj;
  try { obj = JSON.parse(raw); } catch { return null; }
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
        out.push({ glyph: '⏺', body: name + (summary ? '(' + summary + ')' : '()'), kindClass: 'tool-call' });
      } else if (block.type === 'thinking' && block.thinking && block.thinking.length > 4) {
        // Render extended thinking as dim italic — usually empty signature
        // payloads, so this branch fires only when actual reasoning leaked.
        out.push({ glyph: '·', body: '(thinking)', kindClass: 'thinking' });
      }
    }
    return out.length ? out : null;
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
    return out.length ? out : null;
  }

  if (obj.type === 'system') {
    const sub = obj.subtype;
    if (sub === 'task_started') {
      return [{
        glyph: '⎿',
        body: 'Async ' + (obj.description || obj.task_type || 'task') + ' started',
        kindClass: 'tool-result',
      }];
    }
    if (sub === 'task_notification') {
      const status = obj.status || 'updated';
      const desc = obj.description || obj.summary || obj.task_type || 'task';
      return [{
        glyph: '⎿',
        body: 'Async ' + desc + ' ' + status,
        kindClass: status === 'completed' ? 'tool-result' : (status === 'killed' ? 'tool-error' : 'tool-result'),
      }];
    }
    if (sub === 'hook_started' || sub === 'hook_response') {
      const outcome = obj.outcome || (sub === 'hook_started' ? 'started' : 'ok');
      return [{ glyph: '·', body: 'hook ' + (obj.hook_name || '?') + ' ' + outcome, kindClass: 'system' }];
    }
    if (sub === 'init') {
      const tools = (obj.tools || []).length;
      const skills = (obj.skills || []).length;
      const tail = obj.session_id ? obj.session_id.slice(-8) : '';
      return [{
        glyph: '·',
        body: 'init session ' + tail + ' (model=' + (obj.model || '?') + ', tools=' + tools + ', skills=' + skills + ')',
        kindClass: 'system',
      }];
    }
    return null; // other system subtypes — silent
  }

  if (obj.type === 'result') {
    const cost = typeof obj.total_cost_usd === 'number' ? '$' + obj.total_cost_usd.toFixed(4) : '$?';
    const out = obj.usage?.output_tokens ?? '?';
    const cacheRead = obj.usage?.cache_read_input_tokens;
    const dur = obj.duration_ms ? Math.round(obj.duration_ms / 1000) + 's' : '?';
    let body = 'turn complete · ' + out + ' out · ' + cost + ' · ' + dur;
    if (cacheRead) body += ' · cache ' + (cacheRead >= 1000 ? (cacheRead / 1000).toFixed(1) + 'k' : cacheRead);
    return [{ glyph: '✓', body, kindClass: 'turn-complete' }];
  }

  if (obj.type === 'rate_limit_event') return null; // silent
  return null;
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
      '<option value="' + escapeHTML(a.id) + '"' + (installed ? '' : ' disabled') + '>' +
      escapeHTML(a.display_name) + '</option>'
    );
  }
  sel.innerHTML = opts.join('');
  // Restore selection if still valid + still installed.
  const stillValid = adapterCache.some(a => a.id === current && a.installed && a.authenticated !== false);
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
    root.innerHTML = '<div class="adapter-empty">probe failed: ' + escapeHTML(err.message) + '</div>';
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
    (a) => (a.id === 'gemini-sdk' || a.id === 'gemini-cli-local')
      && a.installed
      && a.authenticated !== false,
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
// `in-use` indicator on top of their active/maybe/inactive state.
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
  root.innerHTML = adapterCache.map(a => {
    const cls = ['adapter-row'];
    if (a.installed && a.authenticated !== false) cls.push(a.authenticated === true ? 'active' : 'maybe');
    else cls.push('inactive');
    if (inUse.has(a.id)) cls.push('in-use');
    const meta = a.version ? a.version.replace(/^.*?\b(\d[\w.-]*).*$/, '$1') : (a.models?.[0] ?? '');
    let pillText = '○';
    if (a.installed && a.authenticated === true) pillText = 'auth ✓';
    else if (a.installed) pillText = 'installed';
    else pillText = 'missing';
    return '<div class="' + cls.join(' ') + '" data-adapter="' + escapeHTML(a.id) + '">' +
      '<span class="adapter-dot"></span>' +
      '<div class="adapter-info">' +
        '<div class="adapter-name">' + escapeHTML(a.display_name) + '</div>' +
        '<div class="adapter-meta">' + escapeHTML(meta) + '</div>' +
      '</div>' +
      '<span class="adapter-pill">' + escapeHTML(pillText) + '</span>' +
    '</div>';
  }).join('');
  root.querySelectorAll('.adapter-row').forEach(el => {
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
    id: '',                 // ambient
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
  return preset.requires.every(req =>
    adapterCache.some(a => a.id === req && a.installed && a.authenticated !== false));
}

function renderPresetChips() {
  const root = $('new-session-preset-chips');
  if (!root) return;
  root.innerHTML = PRESETS.map(p => {
    const cls = ['preset-chip'];
    if (newSessionForm.preset === p.id) cls.push('active');
    if (!presetIsRunnable(p)) cls.push('disabled');
    return '<button type="button" class="' + cls.join(' ') + '" data-preset="' + escapeHTML(p.id) + '" ' +
      'title="' + escapeHTML(p.description + (p.requires.length ? ' · needs ' + p.requires.join(', ') : '')) + '">' +
      escapeHTML(p.label) + '</button>';
  }).join('');
  root.querySelectorAll('.preset-chip').forEach(el => {
    el.addEventListener('click', () => {
      if (el.classList.contains('disabled')) {
        // surface why
        const id = el.dataset.preset;
        const p = PRESETS.find(x => x.id === id);
        const missing = p?.requires.filter(req =>
          !adapterCache.some(a => a.id === req && a.installed && a.authenticated !== false));
        const fb = $('new-session-feedback');
        fb.className = 'console-feedback err';
        fb.textContent = `preset needs: ${(missing ?? []).join(', ')} — click an adapter to set up`;
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
  root.innerHTML = ACTORS_FOR_BINDING.map(actor => {
    const adapterOptions = adapterCache.map(a => {
      const disabled = !a.installed || a.authenticated === false;
      return '<option value="' + escapeHTML(a.id) + '"' + (disabled ? ' disabled' : '') + '>' +
        escapeHTML(a.display_name) + '</option>';
    }).join('');
    const modelOptions = adapterCache.flatMap(a => a.models.map(m => m)).filter((m, i, arr) => arr.indexOf(m) === i)
      .map(m => '<option value="' + escapeHTML(m) + '">' + escapeHTML(m) + '</option>').join('');
    return '<span class="bg-actor">' + escapeHTML(actor) + '</span>' +
      '<select data-actor="' + escapeHTML(actor) + '" data-kind="adapter"><option value="">ambient</option>' + adapterOptions + '</select>' +
      '<select data-actor="' + escapeHTML(actor) + '" data-kind="model"><option value="">default</option>' + modelOptions + '</select>';
  }).join('');
  root.querySelectorAll('select').forEach(el => {
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
  const a = adapterCache.find(x => x.id === adapterId);
  if (!a) return;
  $('adapter-modal-title').textContent = a.display_name + ' — setup';
  const body = $('adapter-modal-body');
  const stateLine = a.installed
    ? (a.authenticated === true ? '✓ installed and authenticated' : a.authenticated === null ? '◐ installed (auth not probed)' : '✗ installed but auth missing')
    : '✗ not installed';
  const blocks = [
    '<div class="adapter-modal-step">' +
      '<div class="adapter-modal-step-label">current status</div>' +
      '<div>' + escapeHTML(stateLine) + (a.version ? ' · ' + escapeHTML(a.version) : '') + '</div>' +
    '</div>',
    a.install_hint ? '<div class="adapter-modal-step">' +
      '<div class="adapter-modal-step-label">' + (a.installed ? 'reinstall' : 'install') + '</div>' +
      '<pre>' + escapeHTML(a.install_hint) + '</pre>' +
    '</div>' : '',
    a.auth_hint ? '<div class="adapter-modal-step">' +
      '<div class="adapter-modal-step-label">login</div>' +
      '<pre>' + escapeHTML(a.auth_hint) + '</pre>' +
    '</div>' : '',
    a.models?.length ? '<div class="adapter-modal-step">' +
      '<div class="adapter-modal-step-label">models</div>' +
      '<div style="font-size:11px;color:var(--ink-subtle);font-family:ui-monospace,monospace;">' +
        a.models.map(escapeHTML).join(' · ') +
      '</div>' +
    '</div>' : '',
  ].filter(Boolean).join('');
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
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('adapter-modal').style.display === 'flex') closeAdapterModal();
});

// Initial probe + render
refreshAdapterList();
renderPresetChips();
renderBindingsGrid();

