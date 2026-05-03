/**
 * summary.html generator — single-file HTML emitted at session end.
 *
 * Pure function: (transcript, state, opts) → HTML string. No I/O.
 * Inline CSS (CDS v1 tokens) + inline JS + chart.js@4 CDN. ≤ 60KB own code,
 * mirrors design/DESIGN.md "single-file artifact" constraint.
 *
 * 6 sections (anchors):
 *   §1 Artifacts     — game.html iframe + spec.md / DESIGN.md / tuning.json refs
 *   §2 Scorecard     — D1-D6 radar + ScoreCell with SourceBadge + audit_violations
 *   §3 Cost          — per-actor stacked bar + cache hit + token totals
 *   §4 CourtEval     — grader/critic/defender/regrader 4 sub-step traces
 *   §5 Timeline      — 39-kind colored event list, click expand
 *   §6 Faults        — F1-F7 routing diagnosis (W5 boost — diagnose() reused from /crumb debug)
 *
 * Header carries: verdict pill, goal, preset, wall, cost, cross_provider, score-history MiniSpark (W6).
 *
 * See [[bagelcode-system-architecture-v0.1]] §10 (4 surface, Kiki studio mapping).
 */

import {
  DIMENSIONS,
  type Actor,
  type Dimension,
  type Message,
  type Verdict,
} from '../protocol/types.js';
import type { CrumbState } from '../state/types.js';
import { computeAutoScores } from '../state/scorer.js';
import { diagnose } from '../helpers/debug.js';

import { ACTOR_COLOR, ACTOR_GLYPH, CDS_CSS } from './cds.js';

export interface RenderOptions {
  generatedAt?: string;
  presetName?: string;
  /** Map artifact role → relative path. e.g. `{ game: 'artifacts/game.html', spec: 'artifacts/spec.md' }`. */
  artifacts?: Record<string, string>;
}

export function renderSummary(
  transcript: Message[],
  state: CrumbState,
  opts: RenderOptions = {},
): string {
  const generatedAt = opts.generatedAt ?? new Date().toISOString();
  const sessionId = state.session_id;
  const goal = state.task_ledger.goal ?? '(no goal recorded)';

  const judge = findLast(transcript, (m) => m.kind === 'judge.score');
  const verdict = (judge?.scores?.verdict ?? null) as Verdict | null;
  const aggregate = judge?.scores?.aggregate ?? null;
  const crossProvider = judge?.metadata?.cross_provider ?? null;

  const wallMs = computeWallMs(transcript);
  const totals = computeTotals(transcript);
  const perActor = computePerActor(transcript);
  const auto = computeAutoScores(transcript);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Crumb · ${escape(sessionId)}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js" defer></script>
<style>${CDS_CSS}</style>
</head>
<body>
${renderHeader({ sessionId, goal, verdict, aggregate, crossProvider, wallMs, totals, presetName: opts.presetName, generatedAt, scoreHistory: state.progress_ledger.score_history.map((e) => e.aggregate), stuckCount: state.progress_ledger.stuck_count })}
${renderToc()}
<main>
${renderArtifacts(state, opts.artifacts)}
${renderScorecard(judge, auto)}
${renderCostBreakdown(totals, perActor)}
${renderCourtEvalTraces(transcript, judge)}
${renderTimeline(transcript)}
${renderFaultDiagnosis(transcript, state)}
</main>
<footer class="page">
generated ${escape(generatedAt)} · single-file (no DB, no server) · ${transcript.length} events
</footer>
${renderInlineScript(judge, perActor)}
</body>
</html>
`;
}

// ─── Header ────────────────────────────────────────────────────────────────

interface HeaderArgs {
  sessionId: string;
  goal: string;
  verdict: Verdict | null;
  aggregate: number | null;
  crossProvider: boolean | null;
  wallMs: number;
  totals: ReturnType<typeof computeTotals>;
  presetName?: string;
  generatedAt: string;
  /** W6 boost — score-history aggregates → MiniSpark inline trend. */
  scoreHistory: number[];
  stuckCount: number;
}

function renderHeader(a: HeaderArgs): string {
  const verdictPill = a.verdict
    ? `<span class="pill ${verdictClass(a.verdict)}">${escape(a.verdict)}${a.aggregate !== null ? ` ${a.aggregate.toFixed(1)}/30` : ''}</span>`
    : `<span class="pill muted">IN PROGRESS</span>`;
  const cp =
    a.crossProvider === null
      ? ''
      : `<span class="cross-provider ${a.crossProvider ? 'ok' : 'warn'}">cross-provider</span>`;
  const spark = a.scoreHistory.length >= 2 ? renderMiniSpark(a.scoreHistory, 30) : '';
  const stuckLabel =
    a.stuckCount === 0
      ? '<span class="pill ok">0/5</span>'
      : a.stuckCount >= 5
        ? `<span class="pill err">${a.stuckCount}/5</span>`
        : `<span class="pill warn">${a.stuckCount}/5</span>`;
  return `<header class="page">
<h1>🍞 Crumb session ${verdictPill} ${cp}</h1>
<div class="meta">${escape(a.sessionId)}</div>
<div style="margin-top:12px;font-size:14px;">${escape(a.goal)}</div>
<dl class="kv" style="margin-top:12px;">
  ${a.presetName ? `<dt>preset</dt><dd>${escape(a.presetName)}</dd>` : ''}
  <dt>wall</dt><dd>${formatDuration(a.wallMs)}</dd>
  <dt>events</dt><dd>${a.totals.events}</dd>
  <dt>tokens</dt><dd>${formatTokens(a.totals.tokens_in)} → ${formatTokens(a.totals.tokens_out)} (cache ${formatPct(a.totals.cache_ratio)})</dd>
  <dt>cost</dt><dd>$${a.totals.cost_usd.toFixed(3)}</dd>
  <dt>stuck</dt><dd>${stuckLabel}</dd>
  ${spark ? `<dt>scores</dt><dd>${spark} <span class="meta">${a.scoreHistory.map((s) => s.toFixed(1)).join(' → ')}</span></dd>` : ''}
</dl>
</header>`;
}

function renderToc(): string {
  return `<nav class="toc">
<a href="#artifacts">§1 Artifacts</a>
<a href="#scorecard">§2 Scorecard</a>
<a href="#cost">§3 Cost</a>
<a href="#courteval">§4 CourtEval</a>
<a href="#timeline">§5 Timeline</a>
<a href="#faults">§6 Faults</a>
</nav>`;
}

// ─── §1 Artifacts ──────────────────────────────────────────────────────────

function renderArtifacts(state: CrumbState, override?: Record<string, string>): string {
  const fromLedger = state.task_ledger.artifacts;
  const map = new Map<string, string>();
  for (const a of fromLedger) map.set(basename(a.path), a.path);
  if (override) for (const [k, v] of Object.entries(override)) map.set(k, v);

  const game = [...map.entries()].find(([k]) => k.endsWith('.html'));
  const others = [...map.entries()].filter(([k]) => !k.endsWith('.html'));

  return `<section id="artifacts" class="card">
<h2><span class="anchor">§1</span> Artifacts (${map.size})</h2>
<div class="grid-2">
  <div>
    ${
      game
        ? `<div class="iframe-wrap"><iframe src="${escape(game[1])}" sandbox="allow-scripts allow-same-origin" title="game preview"></iframe></div>`
        : '<div style="color:var(--ink-faint);font-size:12px;">no game.html artifact emitted</div>'
    }
  </div>
  <div>
    <table>
      <thead><tr><th>file</th><th>sha256</th></tr></thead>
      <tbody>
        ${[...map.entries()]
          .map(
            ([name, path]) =>
              `<tr><td><a href="${escape(path)}" target="_blank">${escape(name)}</a></td><td style="color:var(--ink-faint);font-family:var(--font-mono);font-size:11px;">${escape(shaForArtifact(state, path))}</td></tr>`,
          )
          .join('')}
        ${others.length === 0 && !game ? '<tr><td colspan="2" style="color:var(--ink-faint)">none</td></tr>' : ''}
      </tbody>
    </table>
  </div>
</div>
</section>`;
}

function shaForArtifact(state: CrumbState, path: string): string {
  const a = state.task_ledger.artifacts.find((x) => x.path === path);
  return a?.sha256 ? a.sha256.slice(0, 12) + '…' : '—';
}

// ─── §2 Scorecard ──────────────────────────────────────────────────────────

const DIM_LABEL: Record<string, string> = {
  D1: 'D1 spec_fit',
  D2: 'D2 exec',
  D3: 'D3 observability',
  D4: 'D4 convergence',
  D5: 'D5 intervention',
  D6: 'D6 portability',
};

function renderScorecard(
  judge: Message | undefined,
  auto: ReturnType<typeof computeAutoScores>,
): string {
  const scores = judge?.scores;
  const audit = scores?.audit_violations ?? judge?.metadata?.audit_violations ?? [];

  return `<section id="scorecard" class="card">
<h2><span class="anchor">§2</span> Scorecard ${scores?.aggregate !== undefined ? `<span class="pill ${verdictClass(scores.verdict ?? 'PARTIAL')}">${scores.verdict ?? '—'} ${scores.aggregate.toFixed(1)}</span>` : '<span class="pill muted">no judge.score yet</span>'}</h2>
<div class="grid-2">
  <div><canvas id="radar" height="240" aria-label="D1-D6 radar chart"></canvas></div>
  <div>
    <table class="score">
      <thead><tr><th>dim</th><th>score</th><th>source</th></tr></thead>
      <tbody>
        ${DIMENSIONS.map((k) => {
          const dim = scores?.[k];
          const fallback = autoFallback(k, auto);
          const score = dim?.score ?? fallback;
          const source = dim?.source ?? (fallback !== null ? 'reducer-auto' : '—');
          return `<tr>
            <td>${escape(DIM_LABEL[k] ?? k)}</td>
            <td class="num">${score === null ? '—' : score.toFixed(1)}</td>
            <td>${renderSourceBadge(source)}${dim?.lookup ? ` <span class="badge kind" title="lookup">${escape(dim.lookup)}</span>` : ''}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    ${
      audit.length > 0
        ? `<ul class="audit-list">${audit.map((v) => `<li>★ ${escape(v)}</li>`).join('')}</ul>`
        : ''
    }
  </div>
</div>
</section>`;
}

function autoFallback(k: Dimension, auto: ReturnType<typeof computeAutoScores>): number | null {
  if (k === 'D3') return auto.D3_auto;
  if (k === 'D4') return auto.D4;
  if (k === 'D5') return auto.D5_auto;
  return null;
}

function renderSourceBadge(source: string): string {
  const cls = sourceClass(source);
  return `<span class="badge source ${cls}">${escape(source)}</span>`;
}

function sourceClass(source: string): string {
  if (source.includes('qa-check')) return 'source-qa-check';
  if (source.includes('reducer')) return 'source-reducer';
  if (source.includes('verifier')) return 'source-llm';
  return 'source-llm';
}

// ─── §3 Cost breakdown ─────────────────────────────────────────────────────

function renderCostBreakdown(
  totals: ReturnType<typeof computeTotals>,
  perActor: Map<Actor, ActorTotals>,
): string {
  const rows = [...perActor.entries()].map(([actor, t]) => {
    const cacheHit = t.tokens_in > 0 ? t.cache_read / t.tokens_in : 0;
    return `<tr>
      <td><span class="badge actor" style="background:${ACTOR_COLOR[actor]}">${ACTOR_GLYPH[actor]} ${escape(actor)}</span></td>
      <td class="num">${t.turns}</td>
      <td class="num">${formatTokens(t.tokens_in)}</td>
      <td class="num">${formatTokens(t.tokens_out)}</td>
      <td class="num">${formatPct(cacheHit)}</td>
      <td class="num">$${t.cost_usd.toFixed(3)}</td>
    </tr>`;
  });
  return `<section id="cost" class="card">
<h2><span class="anchor">§3</span> Cost breakdown</h2>
<div class="grid-2">
  <div><canvas id="cost-bar" height="240" aria-label="per-actor token/cost stacked bar"></canvas></div>
  <div>
    <table class="cost">
      <thead><tr><th>actor</th><th>turns</th><th>tok_in</th><th>tok_out</th><th>cache</th><th>$cost</th></tr></thead>
      <tbody>
        ${rows.join('')}
        <tr style="border-top:2px solid var(--ink-muted);"><td><strong>TOTAL</strong></td><td class="num">${totals.turns}</td><td class="num">${formatTokens(totals.tokens_in)}</td><td class="num">${formatTokens(totals.tokens_out)}</td><td class="num">${formatPct(totals.cache_ratio)}</td><td class="num">$${totals.cost_usd.toFixed(3)}</td></tr>
      </tbody>
    </table>
  </div>
</div>
</section>`;
}

// ─── §4 CourtEval traces ───────────────────────────────────────────────────

type CourtEvalRole = 'grader' | 'critic' | 'defender' | 'regrader';
const COURTEVAL_ROLES: CourtEvalRole[] = ['grader', 'critic', 'defender', 'regrader'];

function renderCourtEvalTraces(transcript: Message[], judge: Message | undefined): string {
  const refs = judge?.scores?.courteval ?? {};
  // Resolve each sub-step from explicit courteval refs first; fall back to the
  // most recent step.judge event whose `step` matches the role. The pane is
  // useful even when the verifier skipped populating courteval refs.
  const stepEvents = COURTEVAL_ROLES.map((role) => {
    const refId = (refs as Record<string, string | undefined>)[`${role}_msg_id`];
    if (refId) {
      const evt = transcript.find((m) => m.id === refId);
      if (evt) return { role, evt, source: 'ref' as const };
    }
    const evt = findLast(
      transcript,
      (m) => m.kind === 'step.judge' && (m.step as string | undefined) === role,
    );
    return { role, evt, source: evt ? ('fallback' as const) : ('missing' as const) };
  });

  if (stepEvents.every((s) => !s.evt)) {
    return `<section id="courteval" class="card">
<h2><span class="anchor">§4</span> CourtEval (4 sub-step traces)</h2>
<div style="color:var(--ink-faint);font-size:12px;">no step.judge events in transcript</div>
</section>`;
  }

  const t0 = transcript[0]?.ts ? Date.parse(transcript[0].ts) : 0;
  const rows = stepEvents
    .map(({ role, evt, source }) => {
      if (!evt) {
        return `<tr class="missing">
        <td>${escape(role)}</td>
        <td colspan="3" style="color:var(--ink-faint)">missing</td>
      </tr>`;
      }
      const elapsed = formatElapsed(Date.parse(evt.ts) - t0);
      const provider = evt.metadata?.provider;
      const model = evt.metadata?.model;
      const provLabel = provider ? `${escape(provider)}${model ? ` / ${escape(model)}` : ''}` : '—';
      const sourceBadge =
        source === 'ref'
          ? '<span class="badge source source-llm" title="explicit courteval ref">ref</span>'
          : '<span class="badge source source-reducer" title="step.judge fallback">fallback</span>';
      const summary = evt.body ? truncate(evt.body, 240) : '(no body)';
      return `<tr>
      <td><strong>${escape(role)}</strong> ${sourceBadge}</td>
      <td class="num" style="color:var(--ink-muted);font-family:var(--font-mono);font-size:11px;">${escape(elapsed)}</td>
      <td>${provLabel}</td>
      <td>${escape(summary)}</td>
    </tr>`;
    })
    .join('');

  return `<section id="courteval" class="card">
<h2><span class="anchor">§4</span> CourtEval (4 sub-step traces)</h2>
<table class="courteval">
<thead><tr><th>step</th><th>t</th><th>provider/model</th><th>summary</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</section>`;
}

// ─── §5 Timeline ───────────────────────────────────────────────────────────

function renderTimeline(transcript: Message[]): string {
  const t0 = transcript[0]?.ts ? Date.parse(transcript[0].ts) : 0;
  const kinds = [...new Set(transcript.map((m) => m.kind))].sort();
  const actors = [...new Set(transcript.map((m) => m.from))].sort() as Actor[];

  const rows = transcript
    .map((m, i) => {
      const elapsed = formatElapsed(Date.parse(m.ts) - t0);
      const auditClass = (m.metadata?.audit_violations?.length ?? 0) > 0 ? ' audit' : '';
      const det = m.metadata?.deterministic ? '<span class="deterministic-star">★</span>' : '';
      const body = m.body ?? summarizeData(m);
      return `<div class="row${auditClass}" data-idx="${i}" data-from="${escape(m.from)}" data-kind="${escape(m.kind)}">
  <span class="ts">${escape(elapsed)}</span>
  <span class="glyph" style="color:${ACTOR_COLOR[m.from]}">${ACTOR_GLYPH[m.from]}</span>
  <span class="actor" style="color:${ACTOR_COLOR[m.from]}">${escape(m.from)}</span>
  <span class="kind">${escape(m.kind)}${det}</span>
  <span class="body">${escape(truncate(body, 200))}</span>
</div>
<div class="detail" data-idx="${i}">
  ${renderEventDetail(m)}
</div>`;
    })
    .join('');

  return `<section id="timeline" class="card">
<h2><span class="anchor">§5</span> Timeline (${transcript.length} events)</h2>
<div class="filters">
  <label>actor <select id="f-actor"><option value="">all</option>${actors.map((a) => `<option>${escape(a)}</option>`).join('')}</select></label>
  <label>kind <select id="f-kind"><option value="">all</option>${kinds.map((k) => `<option>${escape(k)}</option>`).join('')}</select></label>
  <label>search <input id="f-search" type="text" placeholder="body / id"></label>
  <label><input id="f-audit" type="checkbox"> audit only</label>
</div>
<div class="timeline" id="timeline-body">
${rows}
</div>
</section>`;
}

function renderEventDetail(m: Message): string {
  const md = m.metadata;
  const fields: Array<[string, string]> = [
    ['id', m.id],
    ['parent', m.parent_event_id ?? m.in_reply_to ?? '—'],
    ['ts', m.ts],
  ];
  if (md?.harness) fields.push(['harness', md.harness]);
  if (md?.provider) fields.push(['provider', md.provider]);
  if (md?.model) fields.push(['model', md.model]);
  if (md?.tokens_in !== undefined)
    fields.push(['tokens', `${md.tokens_in}→${md.tokens_out ?? 0} (cache ${md.cache_read ?? 0})`]);
  if (md?.cost_usd !== undefined) fields.push(['cost', `$${md.cost_usd.toFixed(4)}`]);
  if (md?.latency_ms !== undefined) fields.push(['latency', `${md.latency_ms}ms`]);
  if (md?.tool) fields.push(['tool', md.tool]);
  if (md?.deterministic) fields.push(['deterministic', '★ true']);
  if (md?.cross_provider !== undefined)
    fields.push(['cross_provider', md.cross_provider ? '✓ true' : '⚠ false']);
  // W4 boost — sandbox audit: surface tool.call args / cwd / add_dir if present.
  if (m.kind === 'tool.call' && m.data) {
    const d = m.data as Record<string, unknown>;
    if (d.cwd) fields.push(['cwd', String(d.cwd)]);
    if (d.add_dir) fields.push(['add_dir', String(d.add_dir)]);
    if (d.permission_mode) fields.push(['permission', String(d.permission_mode)]);
  }
  if (m.metadata?.adapter_session_id)
    fields.push(['adapter_session', String(m.metadata.adapter_session_id)]);
  const body = m.body ? `<pre>${escape(m.body)}</pre>` : '';
  const data = m.data ? `<pre>${escape(JSON.stringify(m.data, null, 2))}</pre>` : '';
  const meta = fields.map(([k, v]) => `<div>${escape(k)}: ${escape(v)}</div>`).join('');
  return `${body}${data}<div class="meta-grid">${meta}</div>`;
}

// ─── §6 Fault diagnosis (W5 boost) ─────────────────────────────────────────

function renderFaultDiagnosis(transcript: Message[], state: CrumbState): string {
  const detections = diagnose(transcript, state);
  const detected = detections.filter((d) => d.detected);
  const allClear = detected.length === 0;

  const rows = detections
    .map((d) => {
      const cls = d.detected ? 'pill err' : 'pill ok';
      const label = d.detected ? 'detected' : 'clear';
      return `<tr>
        <td><span class="badge kind">${escape(d.fault_id)}</span> ${escape(d.name)}</td>
        <td><span class="${cls}">${label}</span></td>
        <td style="color:var(--ink-muted);font-family:var(--font-mono);font-size:11px;">${escape(d.evidence_detail ?? d.evidence_msg_id ?? '—')}</td>
      </tr>`;
    })
    .join('');

  return `<section id="faults" class="card">
<h2><span class="anchor">§6</span> Fault diagnosis (F1-F7) ${allClear ? '<span class="pill ok">CLEAR</span>' : `<span class="pill err">${detected.length} detected</span>`}</h2>
<table>
  <thead><tr><th>fault</th><th>status</th><th>evidence</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
${detected.length > 0 ? `<ul class="audit-list" style="margin-top:12px;">${detected.map((d) => `<li>${escape(d.fault_id)}: ${escape(d.suggested_action)}</li>`).join('')}</ul>` : ''}
</section>`;
}

/** W6 boost — inline SVG sparkline of score-history aggregates (range 0-30). */
function renderMiniSpark(values: number[], maxValue: number): string {
  if (values.length < 2) return '';
  const w = 80;
  const h = 16;
  const max = Math.max(maxValue, ...values);
  const step = w / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`)
    .join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="none" aria-label="score history" style="vertical-align:middle;">
<polyline fill="none" stroke="#C8923A" stroke-width="1.5" points="${points}"/>
</svg>`;
}

// ─── inline JS ─────────────────────────────────────────────────────────────

function renderInlineScript(judge: Message | undefined, perActor: Map<Actor, ActorTotals>): string {
  const radarScores = DIMENSIONS.map((k) => judge?.scores?.[k]?.score ?? 0);
  const actors = [...perActor.keys()];
  const tokIn = actors.map((a) => perActor.get(a)!.tokens_in);
  const tokOut = actors.map((a) => perActor.get(a)!.tokens_out);
  const cache = actors.map((a) => perActor.get(a)!.cache_read);
  const colors = actors.map((a) => ACTOR_COLOR[a]);

  return `<script>
(function() {
  function init() {
    if (typeof Chart === 'undefined') { setTimeout(init, 50); return; }
    const radar = document.getElementById('radar');
    if (radar) new Chart(radar, {
      type: 'radar',
      data: {
        labels: ['D1 spec','D2 exec','D3 obs','D4 conv','D5 interv','D6 port'],
        datasets: [{
          label: 'judge.score',
          data: ${JSON.stringify(radarScores)},
          backgroundColor: 'rgba(200,146,58,0.20)',
          borderColor: '#C8923A',
          pointBackgroundColor: '#8C5A2B'
        }]
      },
      options: {
        scales: { r: { suggestedMin: 0, suggestedMax: 5, ticks: { stepSize: 1 } } },
        plugins: { legend: { display: false } }
      }
    });
    const cost = document.getElementById('cost-bar');
    if (cost) new Chart(cost, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(actors)},
        datasets: [
          { label: 'tokens_in',  data: ${JSON.stringify(tokIn)},  backgroundColor: ${JSON.stringify(colors)} },
          { label: 'tokens_out', data: ${JSON.stringify(tokOut)}, backgroundColor: '#A89E90' },
          { label: 'cache_read', data: ${JSON.stringify(cache)},  backgroundColor: '#E8C77A' }
        ]
      },
      options: { responsive: true, scales: { x: { stacked: true }, y: { stacked: true } } }
    });
  }
  init();

  // Timeline interactions: click expand, filter, search.
  const body = document.getElementById('timeline-body');
  if (body) {
    body.addEventListener('click', function(e) {
      const row = e.target.closest('.row');
      if (!row) return;
      row.classList.toggle('expanded');
    });
  }
  function applyFilter() {
    const a = document.getElementById('f-actor').value;
    const k = document.getElementById('f-kind').value;
    const q = document.getElementById('f-search').value.toLowerCase();
    const auditOnly = document.getElementById('f-audit').checked;
    const rows = document.querySelectorAll('.timeline .row');
    rows.forEach(function(r) {
      const matchA = !a || r.dataset.from === a;
      const matchK = !k || r.dataset.kind === k;
      const matchQ = !q || r.textContent.toLowerCase().indexOf(q) >= 0;
      const matchAudit = !auditOnly || r.classList.contains('audit');
      const show = matchA && matchK && matchQ && matchAudit;
      r.style.display = show ? '' : 'none';
      const detail = r.nextElementSibling;
      if (detail && detail.classList.contains('detail')) {
        detail.style.display = show && r.classList.contains('expanded') ? 'block' : '';
      }
    });
  }
  ['f-actor','f-kind','f-audit'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', applyFilter);
  });
  const search = document.getElementById('f-search');
  if (search) search.addEventListener('input', applyFilter);
})();
</script>`;
}

// ─── helpers ───────────────────────────────────────────────────────────────

interface ActorTotals {
  turns: number;
  tokens_in: number;
  tokens_out: number;
  cache_read: number;
  cost_usd: number;
}

function computeWallMs(transcript: Message[]): number {
  if (transcript.length < 2) return 0;
  const first = Date.parse(transcript[0]!.ts);
  const last = Date.parse(transcript[transcript.length - 1]!.ts);
  return Math.max(0, last - first);
}

function computeTotals(transcript: Message[]): {
  events: number;
  turns: number;
  tokens_in: number;
  tokens_out: number;
  cache_read: number;
  cost_usd: number;
  cache_ratio: number;
} {
  let tokens_in = 0;
  let tokens_out = 0;
  let cache_read = 0;
  let cost_usd = 0;
  let turns = 0;
  for (const m of transcript) {
    const md = m.metadata;
    if (!md) continue;
    if (md.tokens_in) tokens_in += md.tokens_in;
    if (md.tokens_out) tokens_out += md.tokens_out;
    if (md.cache_read) cache_read += md.cache_read;
    if (md.cost_usd) cost_usd += md.cost_usd;
    if (m.kind === 'agent.wake') turns += 1;
  }
  const cache_ratio = tokens_in > 0 ? cache_read / tokens_in : 0;
  return {
    events: transcript.length,
    turns,
    tokens_in,
    tokens_out,
    cache_read,
    cost_usd,
    cache_ratio,
  };
}

function computePerActor(transcript: Message[]): Map<Actor, ActorTotals> {
  const out = new Map<Actor, ActorTotals>();
  for (const m of transcript) {
    const md = m.metadata;
    if (!md) continue;
    let t = out.get(m.from);
    if (!t) {
      t = { turns: 0, tokens_in: 0, tokens_out: 0, cache_read: 0, cost_usd: 0 };
      out.set(m.from, t);
    }
    if (md.tokens_in) t.tokens_in += md.tokens_in;
    if (md.tokens_out) t.tokens_out += md.tokens_out;
    if (md.cache_read) t.cache_read += md.cache_read;
    if (md.cost_usd) t.cost_usd += md.cost_usd;
    if (
      m.kind === 'agent.wake' ||
      m.kind === 'spec' ||
      m.kind === 'build' ||
      m.kind === 'judge.score'
    ) {
      t.turns += 1;
    }
  }
  return out;
}

function findLast<T>(arr: T[], pred: (x: T) => boolean): T | undefined {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i]!)) return arr[i];
  }
  return undefined;
}

function verdictClass(v: Verdict): 'ok' | 'warn' | 'err' | 'muted' {
  if (v === 'PASS') return 'ok';
  if (v === 'PARTIAL') return 'warn';
  if (v === 'FAIL' || v === 'REJECT') return 'err';
  return 'muted';
}

function summarizeData(m: Message): string {
  if (m.kind === 'qa.result' && m.data) {
    const d = m.data as Record<string, unknown>;
    return `lint=${d.lint_passed ?? '?'} exit=${d.exec_exit_code ?? '?'} phaser=${d.phaser_loaded ?? '?'}`;
  }
  if (m.kind === 'judge.score' && m.scores?.aggregate !== undefined) {
    return `${m.scores.verdict ?? '—'} ${m.scores.aggregate.toFixed(1)}/30`;
  }
  return '';
}

function escape(s: string | number | undefined | null): string {
  if (s === undefined || s === null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n) + '…';
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatPct(r: number): string {
  return `${Math.round(r * 100)}%`;
}

function basename(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? path : path.slice(i + 1);
}
