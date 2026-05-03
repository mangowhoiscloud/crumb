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
  narrative:  { query: '', cursor: 0 },
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
      // R5 — Cancel button on live sessions. Posts `/cancel` to the session's
      // inbox.txt; coordinator's parser+reducer turn it into a `cancel_spawn`
      // effect that SIGTERMs the active subprocess (R2). Hidden when not
      // live — no point cancelling a session with no active spawn.
      const cancelBtn = s.live
        ? '<button class="row-cancel" data-cancel="' + s.id + '" title="cancel active spawn(s) — SIGTERM the running actor (lossy mid-edit)">⏹</button>'
        : '';
      return '<div class="' + cls.join(' ') + '" data-id="' + s.id + '" title="' + escapeHTML(stateTitle) + '">' +
        '<button class="row-close" data-close="' + s.id + '" title="dismiss from sidebar (transcript preserved on disk)">×</button>' +
        resumeBtn +
        cancelBtn +
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
      // close + resume + cancel buttons have their own handlers — don't double-fire
      if (e.target?.closest?.('.row-close')) return;
      if (e.target?.closest?.('.row-resume')) return;
      if (e.target?.closest?.('.row-cancel')) return;
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
  // R5 — Cancel button click handler. Posts `/cancel` to the session's
  // inbox.txt via the existing /api/sessions/:id/inbox endpoint; the
  // coordinator's parser turns the line into kind=user.intervene with
  // data.cancel='all', and the reducer emits a cancel_spawn effect that
  // SIGTERMs the live subprocess (R2 wiring in src/dispatcher/live.ts).
  list.querySelectorAll('.row-cancel').forEach(btn => {
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
          setTimeout(() => { btn.disabled = false; btn.textContent = '⏹'; }, 3000);
          return;
        }
        // Optimistic UI: row will re-render once the cancel_spawn effect's
        // kind=note hits the transcript and the watcher fans it out.
        btn.textContent = '✓';
        setTimeout(() => { btn.disabled = false; btn.textContent = '⏹'; }, 2000);
      } catch (err) {
        console.error('[studio] cancel error:', err);
        btn.textContent = '!';
        setTimeout(() => { btn.disabled = false; btn.textContent = '⏹'; }, 3000);
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
    const cells = groups
      .map((g, i) => renderEvtCell(g, i === lastIdx, cursor))
      .join('');
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
 * ULID is monotonic-string-sortable, so `>` comparison is correct
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
 * Collapse runs of consecutive events that share `from + kind` into a
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
        audit:
          e.kind === 'audit' ||
          (e.metadata?.audit_violations?.length ?? 0) > 0,
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
  // v0.5 PR-8: badge shows UNREAD count, not total. ULID `>` is
  // chronological, so any id strictly greater than the cursor is unread.
  // Single-event chips (count === 1) also get a "1" badge when unread,
  // matching iMessage/Slack behaviour where a single new message also
  // gets a dot/number — the user opened the lane after that message
  // arrived and we want to acknowledge they haven't seen it yet.
  const unreadCount = cursor
    ? group.ids.filter((id) => id > cursor).length
    : group.ids.length;
  const owner = group.evts[0]?.from ?? '';
  const titleAttr =
    count > 1
      ? `${group.kind} × ${count}` +
        (unreadCount > 0 ? ` (${unreadCount} unread, click to page through)` : ' (all read)')
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
      ? '<span class="evt-count" aria-label="' +
        unreadCount +
        ' unread">' +
        unreadCount +
        '</span>'
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
 * (best-effort visualization; if reducer ever stamps `pre_sanitize` per-dim
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
    '<div class="sc-composite">' + renderComposite(aggregate, verdict, delta) + '</div>' +
    '<div class="sc-radar">' + renderRadar(dimRecords) + '</div>' +
    '<div class="sc-rows">' + dimRecords.map(renderDimRow).join('') + '</div>';
}

function renderEmpty(dims) {
  return (
    '<div class="sc-composite sc-empty"><div class="sc-headline">— / 30</div>' +
    '<div class="sc-verdict-pill sc-verdict-pending">awaiting verifier</div></div>' +
    '<div class="sc-radar">' + renderRadar(dims.map((d) => ({ key: d, score: null }))) + '</div>' +
    '<div class="sc-rows">' +
    dims
      .map(
        (d) =>
          '<div class="sc-row sc-row-empty">' +
          '<span class="sc-row-key">' + d + '</span>' +
          '<span class="sc-row-name">' + DIM_NAMES[d] + '</span>' +
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
    if (violations.includes('verifier_overrode_d2_ground_truth')) return { note: 'forced to qa (Rule 2)' };
  }
  if (dim === 'D4' && violations.includes('verifier_overrode_d4_ground_truth')) {
    return { note: 'forced to auto (Rule 3)' };
  }
  if ((dim === 'D1' || dim === 'D3' || dim === 'D5') && violations.includes('self_bias_score_discounted')) {
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
      '<div class="sc-delta ' + cls + '">' +
      sign + ' ' + (delta > 0 ? '+' : '') + delta.toFixed(1) +
      '<span class="sc-delta-label"> vs prev</span></div>';
  }
  return (
    '<div class="sc-headline">' + escapeHTML(aggStr) + '</div>' +
    '<div class="sc-verdict-pill ' + verdictCls + '">' + escapeHTML(verdictTxt) + '</div>' +
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
        '<line class="sc-radar-axis" x1="' + cx + '" y1="' + cy + '" x2="' + x0 + '" y2="' + y0 + '" />' +
        '<text class="sc-radar-axis-label" x="' + x + '" y="' + (y + 3) + '">' + r.key + '</text>'
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
    '<svg class="sc-radar-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">' +
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
    ? '<span class="sc-row-source ' + srcInfo.cls + '" title="' + escapeHTML(r.source) + '">' + srcInfo.label + '</span>'
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
    '<span class="sc-row-key">' + r.key + '</span>' +
    '<span class="sc-row-name">' + r.name + '</span>' +
    '<span class="sc-row-bar"><span class="sc-row-bar-fill" style="width:' + fillPct.toFixed(1) + '%"></span></span>' +
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
  if (evt.metadata?.deterministic) tags.push({ k: 'tag', v: 'deterministic', cls: 'tag-deterministic' });
  if (evt.metadata?.cross_provider) tags.push({ k: 'tag', v: 'cross_provider', cls: 'tag-cross-provider' });
  $('detail-tags').innerHTML = tags
    .map(
      (t) =>
        '<span class="detail-tag ' + (t.cls || '') + '" title="' + escapeHTML(t.k) + '=' + escapeHTML(t.v) + '">' +
        '<span class="detail-tag-key">' + escapeHTML(t.k) + '</span>' +
        '<span class="detail-tag-val">' + escapeHTML(t.v) + '</span>' +
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
      '<strong>★ anti-deception</strong>' +
      ' — ' + violations.map(escapeHTML).join(', ');
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
    .join('\n');
  $('detail-meta').textContent = fields;
  $('detail-body').textContent = evt.body ?? '(empty)';
  $('detail-data').textContent = evt.data ? JSON.stringify(evt.data, null, 2) : '(none)';

  // Wire copy buttons (rebound on every render so closure stays current)
  const copyBody = $('detail-copy-body');
  if (copyBody) copyBody.onclick = () => copyToClipboard(evt.body ?? '');
  const copyData = $('detail-copy-data');
  if (copyData)
    copyData.onclick = () =>
      copyToClipboard(evt.data ? JSON.stringify(evt.data, null, 2) : '');
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
      '<div class="rbar-seg ' + cls + '" style="width:' + pct.toFixed(2) + '%" ' +
      'title="' + label + ': ' + formatTokens(n) + '">' +
      '<span class="rbar-seg-label">' + label + ' ' + formatTokens(n) + '</span>' +
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
    '<span class="rbar-meta-cell"><span class="rbar-meta-k">cost</span>' + escapeHTML(cost) + '</span>' +
    '<span class="rbar-meta-cell"><span class="rbar-meta-k">latency</span>' + escapeHTML(lat) + '</span>' +
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
    'kind: ' + escapeHTML(groupEvts[0]?.kind ?? 'group') +
    ' · ' + groupEvts.length + ' events' +
    (actorSummary ? ' · ' + actorSummary : '') +
    '</span>' +
    '<span class="spread-toolbar-hint">Drag the panel edge to widen ↔</span>';
  $('detail-spread-cards').innerHTML = groupEvts.map(renderSpreadCard).join('');
  // Wire per-card copy buttons
  $('detail-spread-cards').querySelectorAll('.spread-card-copy').forEach((btn) => {
    btn.addEventListener('click', () => copyToClipboard(btn.dataset.text ?? ''));
  });
}

function renderSpreadCard(evt) {
  const md = evt.metadata ?? {};
  const tagsHtml = [
    md.provider ? '<span class="detail-tag"><span class="detail-tag-key">provider</span><span class="detail-tag-val">' + escapeHTML(md.provider) + '</span></span>' : '',
    md.model ? '<span class="detail-tag"><span class="detail-tag-key">model</span><span class="detail-tag-val">' + escapeHTML(md.model) + '</span></span>' : '',
    md.deterministic ? '<span class="detail-tag tag-deterministic"><span class="detail-tag-key">tag</span><span class="detail-tag-val">deterministic</span></span>' : '',
  ].filter(Boolean).join('');
  const violations = md.audit_violations ?? evt.scores?.audit_violations ?? [];
  const banner = Array.isArray(violations) && violations.length > 0
    ? '<div class="spread-card-audit">★ ' + violations.map(escapeHTML).join(', ') + '</div>'
    : '';
  const lat = md.latency_ms != null ? Number(md.latency_ms) + 'ms' : '—';
  const tok = md.tokens_in != null
    ? formatTokens(md.tokens_in) + '→' + formatTokens(md.tokens_out ?? 0)
    : '—';
  const cost = md.cost_usd != null ? '$' + Number(md.cost_usd).toFixed(4) : '—';
  const dataPreview = evt.data ? JSON.stringify(evt.data, null, 2) : '';
  return (
    '<article class="spread-card" data-id="' + escapeHTML(evt.id) + '">' +
    '<header class="spread-card-header">' +
    '<span class="spread-card-actor"><span class="glyph" style="background:var(' + (ACTOR_VAR[evt.from] || '--ink-tertiary') + ');"></span>' + escapeHTML(evt.from || '?') + '</span>' +
    '<span class="spread-card-ts">' + escapeHTML((evt.ts || '').split('T')[1]?.slice(0, 12) ?? '') + '</span>' +
    '<button class="spread-card-copy" data-text="' + escapeHTML(evt.id) + '" title="Copy event id">⧉ id</button>' +
    '</header>' +
    banner +
    '<div class="spread-card-tags">' + tagsHtml + '</div>' +
    '<div class="spread-card-resource">' +
    '<span title="latency"><strong>↻</strong>&nbsp;' + escapeHTML(lat) + '</span>' +
    '<span title="tokens in→out"><strong>⇄</strong>&nbsp;' + escapeHTML(tok) + '</span>' +
    '<span title="cost"><strong>$</strong>&nbsp;' + escapeHTML(cost) + '</span>' +
    '</div>' +
    '<div class="spread-card-body-label">body</div>' +
    '<pre class="spread-card-body">' + escapeHTML(evt.body ?? '(empty)') + '</pre>' +
    (dataPreview
      ? '<div class="spread-card-body-label">data ' +
        '<button class="spread-card-copy" data-text="' + escapeHTML(dataPreview) + '" title="Copy JSON">⧉</button>' +
        '</div>' +
        '<pre class="spread-card-data">' + escapeHTML(dataPreview) + '</pre>'
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
 * now spreads ALL events as horizontal cards in `#detail-body-spread`
 * (see `renderDetailGroupSpread`), so group nav is no longer needed.
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
  document
    .getElementById('detail-event-prev')
    ?.addEventListener('click', () => navDetailEvent(-1));
  document
    .getElementById('detail-event-next')
    ?.addEventListener('click', () => navDetailEvent(1));
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
 * sleep / wifi flap / Studio restart via `crumb studio --restart`) the user
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
    // and our handlers are wired to the original `es` const, so a reload
    // re-runs the setup with a clean slate. Studio's HTTP-pull endpoints
    // (/api/sessions, /api/sessions/:id/snapshot) re-hydrate state.
    location.reload();
  });
}

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
// v0.4.2 — accurate post-PR-G layout. Six lifecycle columns, 1100×320 viewport.
// Node shapes (semantic):
//   actor    → circle      (LLM-driven, spawns subprocess)
//   effect   → hexagon     (deterministic, no LLM — qa_check, validator)
//   user     → diamond     (external input)
//   terminal → rounded box (done)
const DAG_NODES = {
  user:               { x: 50,   y: 160, label: 'user',       shape: 'diamond' },
  coordinator:        { x: 165,  y: 160, label: 'coord',      shape: 'circle'  },
  'planner-lead':     { x: 305,  y: 90,  label: 'planner',    shape: 'circle'  },
  researcher:         { x: 305,  y: 230, label: 'researcher', shape: 'circle'  },
  builder:            { x: 480,  y: 90,  label: 'builder',    shape: 'circle'  },
  'builder-fallback': { x: 480,  y: 230, label: 'fallback',   shape: 'circle'  },
  qa_check:           { x: 645,  y: 160, label: 'qa_check',   shape: 'hexagon' },
  verifier:           { x: 825,  y: 90,  label: 'verifier',   shape: 'circle'  },
  validator:          { x: 825,  y: 230, label: 'validator',  shape: 'hexagon' },
  done:               { x: 1010, y: 160, label: 'done',       shape: 'terminal' },
};

// Five-phase backgrounds aligned with the reducer's case-routing layers:
// A=Spec authoring, B=Build, C=QA ground truth (deterministic), D=Judge
// (verifier LLM + validator code), E=Done.
const DAG_PHASES = [
  { id: 'A', label: 'A · Spec',   x: 240, y: 32, w: 165, h: 256 },
  { id: 'B', label: 'B · Build',  x: 420, y: 32, w: 145, h: 256 },
  { id: 'C', label: 'C · QA',     x: 580, y: 32, w: 130, h: 256 },
  { id: 'D', label: 'D · Verify', x: 765, y: 32, w: 130, h: 256 },
  { id: 'E', label: 'E · Done',   x: 950, y: 32, w: 120, h: 256 },
];

// Edges: [from, to, type, label?]. Edge types:
//   flow      indigo solid  — standard handoff / spawn
//   respawn   blue dashed   — Important/Minor deviation → rebuild same actor   [PR-G2]
//   rollback  amber dashed  — Critical deviation → planner-lead respec
//   fallback  red dashed    — circuit OPEN → builder-fallback (different LLM)
//   terminal  green solid   — verifier PASS → done
//   audit     pink dotted   — anti-deception side-effect (conditional)
//   intervene gray dotted   — user.intervene goto / @actor shorthand           [PR-G7-A]
//   resume    cyan solid    — done → re-enter loop                             [PR-G7-B]
const DAG_EDGES = [
  // === Flow (standard handoff / spawn, indigo solid) ===
  ['user',             'coordinator',      'flow',     'goal'],
  ['coordinator',      'planner-lead',     'flow',     'spawn'],
  ['planner-lead',     'researcher',       'flow',     'handoff'],
  ['researcher',       'planner-lead',     'flow',     'step.research'],
  ['planner-lead',     'builder',          'flow',     'spec'],
  ['builder',          'qa_check',         'flow',     'build'],
  ['qa_check',         'verifier',         'flow',     'qa.result'],
  ['builder-fallback', 'qa_check',         'flow',     ''],
  ['verifier',         'validator',        'audit',    'judge.score'],
  // === Verdict-based routing from verifier ===
  ['verifier',         'done',             'terminal', 'PASS'],
  ['verifier',         'builder',          'respawn',  'Important'],   // PR-G2 NEW
  ['verifier',         'planner-lead',     'rollback', 'Critical'],
  ['verifier',         'builder-fallback', 'fallback', 'circuit OPEN'],
  // === Re-entry (PR-G7-B resume) ===
  ['done',             'coordinator',      'resume',   '↻'],
  // === User intervention ===
  ['user',             'planner-lead',     'intervene', '@'],
  ['user',             'builder',          'intervene', '@'],
  ['user',             'verifier',         'intervene', '@'],
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
      return `M${n.x},${n.y - s} L${n.x + s},${n.y} L${n.x},${n.y + s} L${n.x - s},${n.y} Z`;
    }
    case 'terminal': {
      const w = r * 1.4;
      const h = r * 0.85;
      const rr = h * 0.7;
      return `M${n.x - w + rr},${n.y - h} L${n.x + w - rr},${n.y - h} A${rr},${rr} 0 0 1 ${n.x + w},${n.y - h + rr} L${n.x + w},${n.y + h - rr} A${rr},${rr} 0 0 1 ${n.x + w - rr},${n.y + h} L${n.x - w + rr},${n.y + h} A${rr},${rr} 0 0 1 ${n.x - w},${n.y + h - rr} L${n.x - w},${n.y - h + rr} A${rr},${rr} 0 0 1 ${n.x - w + rr},${n.y - h} Z`;
    }
    case 'circle':
    default: {
      const c = r;
      return `M${n.x - c},${n.y} A${c},${c} 0 1 0 ${n.x + c},${n.y} A${c},${c} 0 1 0 ${n.x - c},${n.y} Z`;
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
 * heatmap idiom). Heuristic: an edge `(from → to)` is "traversed" when an
 * event from `to` follows an event from `from` within the cached events,
 * AND that pair matches a static DAG_EDGES entry.
 */
function aggregateEdgeRuntime(events) {
  const counts = new Map(); // "from→to" → traversal count
  const latencies = new Map(); // "from→to" → [latency_ms samples on `to` events]
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
 *   `12.3k tok · $0.18 · 8.1s p95`
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
  const zonesSvg = DAG_PHASES.map(p =>
    '<g class="dag-phase phase-' + p.id + '">' +
      '<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" rx="10" />' +
      '<text x="' + (p.x + 10) + '" y="' + (p.y + 16) + '" class="phase-label">' + escapeHTML(p.label) + '</text>' +
    '</g>'
  ).join('');
  const events = activeSession ? (eventCache.get(activeSession) ?? []) : [];
  // PR-J' (Candidate 4) — per-edge runtime aggregation drives stroke width
  // (count) and color shift (avg latency). Untraversed edges keep their
  // baseline static styling so the structural DAG remains legible.
  const edgeStats = aggregateEdgeRuntime(events);
  // Edges (typed) — typed dasharray + label rendered above the midpoint.
  const edgesSvg = DAG_EDGES.map(([from, to, type, label]) => {
    const a = DAG_NODES[from], b = DAG_NODES[to];
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
      ? '<text class="edge-label edge-label-' + type + '" x="' + edgeLabelPos(a, b, from, to).x + '" y="' + edgeLabelPos(a, b, from, to).y + '">' + escapeHTML(label) + '</text>'
      : '';
    const countBadge = stats && stats.count > 1
      ? '<text class="edge-count" x="' + edgeLabelPos(a, b, from, to).x + '" y="' + (edgeLabelPos(a, b, from, to).y - 11) + '">×' + stats.count + '</text>'
      : '';
    return '<g class="dag-edge-group ' + extraCls.join(' ') + '">' +
      '<path class="dag-edge edge-' + type + '" d="' + d + '" stroke-width="' + strokeWidth.toFixed(2) + '" marker-end="url(#dag-arrow-' + type + ')" />' +
      labelSvg + countBadge +
    '</g>';
  }).join('');
  const lastEvt = events[events.length - 1];
  const lastActor = lastEvt?.from;
  const recentActors = new Set(events.slice(-8).map(e => e.from));
  const isDone = events.some(e => e.kind === 'done');
  // PR-J' (Candidate 4) — per-actor runtime aggregation drives the badge
  // line under each node (LangSmith / Langfuse / Phoenix idiom).
  const actorStats = aggregateActorRuntime(events);
  const nodesSvg = Object.entries(DAG_NODES).map(([actor, n]) => {
    const cls = ['dag-node', 'node-' + actor.replace(/[^a-z_]/gi, '-'), 'shape-' + (n.shape || 'circle')];
    if (lastActor === actor) cls.push('active');
    else if (recentActors.has(actor)) cls.push('recent');
    if (actor === 'done' && isDone) cls.push('active');
    // qa_check is a synthetic node — system events with the qa-check-effect tool
    // get aggregated under the qa_check key via aggregateActorRuntime's remap.
    const badge = formatActorBadge(actorStats.get(actor));
    const badgeSvg = badge
      ? '<text class="dag-node-badge" x="' + n.x + '" y="' + (n.y + 32) + '">' + escapeHTML(badge) + '</text>'
      : '';
    return '<g class="' + cls.join(' ') + '" data-actor="' + actor + '">' +
      '<path d="' + nodeShapePath(n) + '" />' +
      '<text x="' + n.x + '" y="' + (n.y + 4) + '">' + escapeHTML(n.label) + '</text>' +
      badgeSvg +
    '</g>';
  }).join('');
  // Arrowhead defs — one per edge type so the head color matches the stroke.
  const arrowDefs = ['flow','respawn','rollback','fallback','terminal','audit','intervene','resume']
    .map(type =>
      '<marker id="dag-arrow-' + type + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
        '<path class="arrow-head arrow-' + type + '" d="M0,0 L10,5 L0,10 Z" />' +
      '</marker>'
    ).join('');
  svg.innerHTML = '<defs>' + arrowDefs + '</defs>' +
                  '<g id="dag-zones">' + zonesSvg + '</g>' +
                  '<g id="dag-edges">' + edgesSvg + '</g>' +
                  '<g id="dag-ripples"></g>' +
                  '<g id="dag-nodes">' + nodesSvg + '</g>';
}

// Edge path geometry. Most edges are straight; verifier's three feedback
// edges (rollback / respawn / fallback) all originate from the same node and
// would overlap, so we route them above/through/below the layout. The resume
// edge (done → coordinator) loops over the entire top.
function edgePath(a, b, from, to) {
  // verifier → planner-lead (Critical rollback): up-and-over arc above row 1
  if (from === 'verifier' && to === 'planner-lead') {
    const cy = 30; // hugs the phase-band top
    return `M${a.x},${a.y - 22} C${a.x},${cy} ${b.x},${cy} ${b.x},${b.y - 22}`;
  }
  // verifier → builder (Important respawn): up-and-over but lower than the
  // planner arc, so the two feedback paths don't collide.
  if (from === 'verifier' && to === 'builder') {
    const cy = 50;
    return `M${a.x},${a.y - 22} C${a.x - 60},${cy} ${b.x + 60},${cy} ${b.x},${b.y - 22}`;
  }
  // verifier → builder-fallback (circuit OPEN): down-and-under arc.
  if (from === 'verifier' && to === 'builder-fallback') {
    const cy = 290;
    return `M${a.x},${a.y + 22} C${a.x - 60},${cy} ${b.x + 60},${cy} ${b.x},${b.y + 22}`;
  }
  // done → coordinator (resume cycle): big arc over the top of everything.
  if (from === 'done' && to === 'coordinator') {
    const cy = 12;
    return `M${a.x},${a.y - 22} C${a.x},${cy} ${b.x},${cy} ${b.x},${b.y - 22}`;
  }
  // user → planner-lead / builder / verifier (intervene): straight diagonal,
  // slight curve outward so all three don't overlap.
  if (from === 'user' && (to === 'planner-lead' || to === 'builder' || to === 'verifier')) {
    const t = to === 'planner-lead' ? -10 : to === 'builder' ? -30 : -50;
    return `M${a.x + 18},${a.y} Q${(a.x + b.x) / 2},${a.y + t} ${b.x - 24},${b.y - 4}`;
  }
  // Default: straight line, trimmed to node radius.
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const r = 26;
  return `M${a.x + ux * r},${a.y + uy * r} L${b.x - ux * r},${b.y - uy * r}`;
}

// Position for the edge label (above midpoint). For curved edges we approximate
// via the control point so the label sits where the arc bulges.
function edgeLabelPos(a, b, from, to) {
  if (from === 'verifier' && to === 'planner-lead') return { x: (a.x + b.x) / 2, y: 26 };
  if (from === 'verifier' && to === 'builder')      return { x: (a.x + b.x) / 2, y: 56 };
  if (from === 'verifier' && to === 'builder-fallback') return { x: (a.x + b.x) / 2, y: 296 };
  if (from === 'done' && to === 'coordinator')      return { x: (a.x + b.x) / 2, y: 22 };
  if (from === 'user' && (to === 'planner-lead' || to === 'builder' || to === 'verifier')) {
    const t = to === 'planner-lead' ? -10 : to === 'builder' ? -30 : -50;
    return { x: (a.x + b.x) / 2, y: a.y + t - 4 };
  }
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 6 };
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
  'build':               'qa_check',       // qa_check effect (renamed from `system` v0.4.2)
  'qa.result':           'verifier',
  'step.research':       'planner-lead',   // researcher → resume planner phase B
  'step.research.video': null,             // intermediate, no routing
  'handoff.requested':   null,             // payload.to drives it
  'handoff.rollback':    null,             // PR-G2 — verdict-deviation routing decides
  'audit':               null,             // validator side-effect, no onward routing
};

// Translate a `from='system'` event with metadata.tool=qa-check-effect@v1
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
    // PR-G2 routing — first check circuit breaker (heuristic via builder
    // error count), then deviation.type. Default deviation = Important →
    // builder respawn (NOT planner anymore).
    const events = activeSession ? (eventCache.get(activeSession) ?? []) : [];
    const builderErrors = events.filter((e) => e.from === 'builder' && e.kind === 'error').length;
    if (builderErrors >= 3) return 'builder-fallback';
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

/**
 * v0.5 PR-6 — Logs panel state machine + race-guard.
 *
 * Frontier convention (ArgoCD pod-logs / Supabase Logs Explorer / Datadog
 * live tail): a single object holds the in-flight state, every async path
 * checks `token` before mutating buffer/DOM, and connection state is one
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
 * AbortController: the in-flight `fetch()` is aborted when token bumps so
 * the stale request never resolves into the new actor's panel.
 *
 * Heartbeat watchdog: SSE server emits :heartbeat every 15s. We track
 * lastHeartbeatTs; if no traffic (heartbeat OR chunk OR rotate) arrives
 * for HEARTBEAT_TIMEOUT_MS we transition to `stalled` + start an
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
  } else {
    // Tab switched away from logs — keep the EventSource alive so background
    // chunks accumulate, but if we're in a transient state (connecting / stalled)
    // we don't gain anything by holding it. Frontier convention (Datadog,
    // ArgoCD) is to keep streaming connections warm across tab switches; we
    // follow that here.
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

/**
 * State transition — single source of truth. Mutates `logsCtl.state`,
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
      setLogsState('connecting', `loading ${actor}…`);
    }
  }, 150);

  logsCtl.abortCtl = new AbortController();
  fetch(
    '/api/sessions/' + encodeURIComponent(activeSession) +
      '/logs/' + encodeURIComponent(actor),
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
      setLogsState('errored', `snapshot failed: ${err.message}`);
    });
}

function openLogStream(actor, parentToken) {
  // Caller passes its token so SSE handlers can stale-guard symmetrically
  // with the snapshot path. Without this, a long-lived EventSource attached
  // to actor A keeps pushing chunks after the user clicked actor B.
  closeLogStream();
  const url =
    '/api/sessions/' + encodeURIComponent(activeSession) +
    '/logs/' + encodeURIComponent(actor) + '/stream';
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
 * Heartbeat watchdog — fires every 5s, escalates to `stalled` when the
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
        `last heartbeat ${Math.floor(ago / 1000)}s ago — auto-reconnect queued`,
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
  renderLogsConnStatus('stalled', `reconnecting in ${left}s…`);
  logsCtl.reconnectCountdownTimer = setInterval(() => {
    left--;
    if (left <= 0) {
      clearInterval(logsCtl.reconnectCountdownTimer);
      logsCtl.reconnectCountdownTimer = null;
      forceLogsReconnect();
    } else {
      renderLogsConnStatus('stalled', `reconnecting in ${left}s…`);
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
    const events = (eventCache.get(activeSession) ?? []).filter(
      (e) => e.from === activeLogActor,
    );
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
    '<span class="logs-conn-label">' + escapeHTML(label) + '</span>' +
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
    root.innerHTML =
      '<div class="logs-empty">Pick an actor on the left to tail its logs.</div>';
    refreshGrepNav('logs', root, $('logs-grep-count'), $('logs-grep-prev'), $('logs-grep-next'));
    return;
  }
  if (logsCtl.state === 'connecting') {
    root.innerHTML =
      '<div class="logs-empty logs-empty--loading">Loading ' +
      escapeHTML(activeLogActor) + '…</div>';
    refreshGrepNav('logs', root, $('logs-grep-count'), $('logs-grep-prev'), $('logs-grep-next'));
    return;
  }
  if (logsCtl.state === 'errored') {
    root.innerHTML =
      '<div class="logs-empty logs-empty--errored">Disconnected from ' +
      escapeHTML(activeLogActor) +
      "’s log stream. Use the <strong>Reconnect now</strong> button above.</div>";
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
    for (const raw of entry.text.split('\n')) {
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
  // `(no spawn log yet for <actor> in this session)` 47-byte body when the
  // agent-workspace dir has 0 spawn-*.log files. We split that case out so
  // the user sees the right intent.
  const totalText = logBuffer.map((b) => b.text || '').join('').trim();
  const neverSpawned = /no spawn log yet for /.test(totalText);
  if (lines.length === 0 || (logBuffer.length === 1 && neverSpawned)) {
    if (neverSpawned) {
      root.innerHTML =
        '<div class="logs-empty logs-empty--never-spawned">' +
        escapeHTML(activeLogActor) +
        " hasn’t spawned yet. Logs will appear here the moment it does.</div>";
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
//
// v0.4.2 — split into TWO stacked panels with a draggable horizontal handle:
//   1) Agent narrative (top)    — rendered stream-json bubbles only
//                                  (⏺ assistant text / ⏺ tool_use /
//                                  ⎿ tool_result / ✓ turn complete).
//   2) Live execution feed (bot) — every other transcript event:
//                                  agent.wake / error / handoff / plain
//                                  log / system. Same body/grep/pause/clear
//                                  controls as before.
// The horizontal handle (`#feedstack-resize`) writes `--narrative-h` to
// `<body>` and persists in localStorage `crumb.narrative-h`.

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
    refreshGrepNav('feed', root, $('console-feed-grep-count'), $('console-feed-grep-prev'), $('console-feed-grep-next'));
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
    refreshGrepNav('narrative', root, $('console-narrative-grep-count'), $('console-narrative-grep-prev'), $('console-narrative-grep-next'));
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
  refreshGrepNav('narrative', root, $('console-narrative-grep-count'), $('console-narrative-grep-prev'), $('console-narrative-grep-next'), { scroll: !!q });
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

// v0.4.2 — narrative panel controls (mirrors the feed wiring).
$('console-narrative-pause')?.addEventListener('click', () => {
  narrativePaused = !narrativePaused;
  const btn = $('console-narrative-pause');
  btn.classList.toggle('paused', narrativePaused);
  btn.textContent = narrativePaused ? 'paused' : 'pause';
});
$('console-narrative-clear')?.addEventListener('click', () => {
  $('console-narrative-body').innerHTML = '';
  refreshGrepNav('narrative', $('console-narrative-body'), $('console-narrative-grep-count'), $('console-narrative-grep-prev'), $('console-narrative-grep-next'));
});
bindGrepInput($('console-narrative-grep'), $('console-narrative-grep-prev'), $('console-narrative-grep-next'), 'narrative', rehighlightNarrative);
$('console-narrative-grep-prev')?.addEventListener('click', () => gotoGrepMatch('narrative', -1, $('console-narrative-grep-count')));
$('console-narrative-grep-next')?.addEventListener('click', () => gotoGrepMatch('narrative',  1, $('console-narrative-grep-count')));

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
    refreshGrepNav('narrative', narBody, $('console-narrative-grep-count'), $('console-narrative-grep-prev'), $('console-narrative-grep-next'));
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
setActiveView = function(view) {
  _origSetActiveView(view);
  if (view === 'output') refreshOutputTab();
};

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
  if (persisted && persisted > 0) onDelta(persisted, /*absolute*/true);
  const onMove = (e) => {
    if (!dragging) return;
    const pos = e.touches
      ? (axis === 'y' ? e.touches[0].clientY : e.touches[0].clientX)
      : (axis === 'y' ? e.clientY : e.clientX);
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
      ? (axis === 'y' ? e.touches[0].clientY : e.touches[0].clientX)
      : (axis === 'y' ? e.clientY : e.clientX);
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
// v0.4.2 — narrative / feed split (horizontal handle, drag-down grows narrative).
// Clamp [80, viewport-300] so the user can't shrink past the controls or
// blow out the live-feed below the input bar's safe space.
makeResizable(
  'feedstack-resize',
  (start, abs, dy) => {
    const cap = Math.max(120, window.innerHeight - 300);
    const h = abs ? start : Math.max(80, Math.min(cap, start + (dy ?? 0)));
    document.body.style.setProperty('--narrative-h', h + 'px');
    if (!abs) localStorage.setItem('crumb.narrative-h', String(h));
  },
  'crumb.narrative-h',
  () => parseInt(getComputedStyle(document.body).getPropertyValue('--narrative-h'), 10) || 220,
  'y',
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
  //
  // Return contract (intentional null vs empty-array distinction):
  //   - return null   → NOT stream-json (caller falls through to raw render
  //                     so plain-log lines stay visible in the feed)
  //   - return []     → IS stream-json, parsed cleanly, but no narrative
  //                     bubbles to render (caller skips → suppressed from
  //                     feed). Prevents the raw `{"type":"assistant",...}`
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
        out.push({ glyph: '⏺', body: name + (summary ? '(' + summary + ')' : '()'), kindClass: 'tool-call' });
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
    return []; // other system subtypes — silent (parsed, suppressed)
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

// v0.5 — first-visit welcome banner with the read-only invariant message.
// Dismiss persists in localStorage; clear `crumb.studio.welcome.dismissed` to
// re-show. No-op when localStorage is unavailable (private browsing,
// sandboxed iframe, etc.) — banner just stays hidden, which is the safe
// default for repeat visitors.
(function setupWelcomeBanner() {
  const KEY = 'crumb.studio.welcome.dismissed';
  const banner = document.getElementById('welcome-banner');
  const close = document.getElementById('welcome-banner-close');
  if (!banner || !close) return;
  let dismissed = false;
  try { dismissed = localStorage.getItem(KEY) === '1'; } catch (_) {}
  if (!dismissed) banner.style.display = 'flex';
  close.addEventListener('click', () => {
    banner.style.display = 'none';
    try { localStorage.setItem(KEY, '1'); } catch (_) {}
  });
})();

