/**
 * Waterfall panel — wall-clock spans of `agent.wake → agent.stop` pairs
 * + tool.call sub-spans + per-span verdict strip + cost-intensity tint
 * + hover tooltip with tokens / cost / latency / cache.
 *
 * Per migration plan §6.3 + DESIGN.md §4.7. Honeycomb-pattern: each
 * actor lane shows its agent.* bar, with the actor's tool.call window
 * rendered as nested mini-stripes inside the bar (compact mode hides
 * them). Datadog APM-pattern: bar color intensity scales with
 * cost_usd so expensive spawns stand out at a glance.
 *
 * Click bar → DetailRail flips to NodeInspector (selected_node_actor →
 * that actor's metrics + recent events + sandwich preview).
 *
 * §8.1 quality bar — empty / loading / streaming states explicit.
 * Hard-coded colors prohibited (token reads only).
 */

import type { IDockviewPanelProps } from 'dockview-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranscriptStream, type TranscriptEvent } from '../hooks/useTranscriptStream';
import { useActiveSession, setSelectedNodeActor } from '../stores/selection';
import { deriveSpans, type Span, type Verdict } from '../lib/spans';
import { ALL_ACTORS } from './pipeline/layout';

// v0.5 PR-Waterfall E — event kinds counted into the per-lane density
// heatmap (non-span events that signal "actor was busy" without showing
// up as a wall-clock bar). Skip dispatcher meta (tool.call, agent.wake/
// stop, dispatch.spawn note) to avoid double-counting the bar area.
const HEATMAP_KINDS = new Set([
  'step.socratic',
  'step.concept',
  'step.research',
  'step.research.video',
  'step.design',
  'step.judge',
  'step.builder',
  'spec',
  'spec.update',
  'build',
  'qa.result',
  'judge.score',
  'verify.result',
  'artifact.created',
  'handoff.requested',
  'handoff.rollback',
  'error',
  'note',
  'user.intervene',
]);

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} m`;
}

function formatNum(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function formatCost(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  return `$${n.toFixed(3)}`;
}

function verdictTone(v: Verdict | null): 'pass' | 'partial' | 'fail' | 'pending' {
  if (v === 'PASS') return 'pass';
  if (v === 'PARTIAL') return 'partial';
  if (v === 'FAIL' || v === 'REJECT') return 'fail';
  return 'pending';
}

/**
 * 0.55–1.0 opacity envelope mapped from cost. The most expensive spawn
 * in the active window anchors 1.0; cheaper ones fade. Visualizes which
 * spawn burned the most $ at a glance (Datadog APM convention).
 */
function costOpacity(span: Span, maxCost: number): number {
  if (maxCost <= 0) return 1;
  const ratio = span.costUsd / maxCost;
  return 0.55 + ratio * 0.45;
}

export function Waterfall(_props: IDockviewPanelProps) {
  const sessionId = useActiveSession();
  const stream = useTranscriptStream(500);
  const [now, setNow] = useState(() => Date.now());
  const [showSubSpans, setShowSubSpans] = useState(true);

  // Tick `now` every second so in-flight bars grow live.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const spans = useMemo(() => deriveSpans(stream.events, now), [stream.events, now]);

  if (!sessionId) return <Empty>Select a session in the sidebar to see its waterfall.</Empty>;
  if (spans.length === 0)
    return <Empty>no spans yet — bars appear as agent.wake / agent.stop events arrive</Empty>;

  const t0 = Math.min(...spans.map((s) => s.startTs));
  const t1 = Math.max(...spans.map((s) => s.endTs), now);
  const total = Math.max(1, t1 - t0);
  const maxCost = Math.max(0, ...spans.map((s) => s.costUsd));
  const totalCost = spans.reduce((acc, s) => acc + s.costUsd, 0);
  const totalTokensIn = spans.reduce((acc, s) => acc + s.tokensIn, 0);
  const totalTokensOut = spans.reduce((acc, s) => acc + s.tokensOut, 0);
  const totalToolCalls = spans.reduce((acc, s) => acc + s.toolCalls.length, 0);

  const lanes = ALL_ACTORS.filter((actor) => spans.some((s) => s.actor === actor));

  // v0.5 PR-Waterfall E — Layered Cost Strip (Phoenix Arize / OTel GenAI
  // pattern). Sample cumulative tokens + cost at every agent.stop with
  // metadata.{tokens_in,tokens_out,cost_usd}; render as a sticky SVG
  // strip above the lanes. Pure derivation from stream.events; bumps on
  // every backfill flush.
  const costSamples = useMemo(() => buildCostSamples(stream.events), [stream.events]);

  // v0.5 PR-Waterfall E — Per-lane event-density heatmap. Bin every
  // HEATMAP_KINDS event into 1-s buckets keyed by actor; rendered as a
  // CSS linear-gradient backdrop on the lane track so the eye sees
  // "this actor was busy in seconds 12-15" even when no bar covered it.
  const heatmapByActor = useMemo(
    () => buildHeatmap(stream.events, t0, total),
    [stream.events, t0, total],
  );

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--canvas)',
      }}
    >
      <div
        style={{
          padding: '4px var(--space-3)',
          fontSize: 10,
          color: 'var(--ink-muted)',
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.4px',
          borderBottom: '1px solid var(--hairline-soft)',
          display: 'flex',
          gap: 'var(--space-3)',
          alignItems: 'center',
        }}
      >
        <span>Waterfall</span>
        <span style={{ color: 'var(--ink-tertiary)' }}>
          {spans.length} spans · {formatMs(total)}
        </span>
        <span style={{ color: 'var(--ink-tertiary)' }}>
          {formatCost(totalCost)} · {formatNum(totalTokensIn)} in / {formatNum(totalTokensOut)} out
          · {totalToolCalls} tool.calls
        </span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setShowSubSpans((v) => !v)}
          title="toggle nested tool.call stripes inside each actor bar"
          style={{
            all: 'unset',
            cursor: 'pointer',
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            color: showSubSpans ? 'var(--primary)' : 'var(--ink-muted)',
            border: `1px solid ${showSubSpans ? 'var(--primary)' : 'var(--hairline)'}`,
            padding: '2px 8px',
            borderRadius: 'var(--r-pill)',
            background: showSubSpans
              ? 'color-mix(in oklab, var(--primary) 12%, transparent)'
              : 'transparent',
          }}
        >
          {showSubSpans ? '◧ detailed' : '◨ compact'}
        </button>
      </div>
      <CostStrip samples={costSamples} t0={t0} total={total} />
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        {lanes.map((actor) => (
          <Lane
            key={actor}
            actor={actor}
            spans={spans.filter((s) => s.actor === actor)}
            t0={t0}
            total={total}
            maxCost={maxCost}
            showSubSpans={showSubSpans}
            heatmap={heatmapByActor.get(actor) ?? null}
          />
        ))}
      </div>
    </div>
  );
}

function Lane({
  actor,
  spans,
  t0,
  total,
  maxCost,
  showSubSpans,
  heatmap,
}: {
  actor: string;
  spans: Span[];
  t0: number;
  total: number;
  maxCost: number;
  showSubSpans: boolean;
  heatmap: number[] | null;
}) {
  const laneHeight = showSubSpans ? 32 : 22;
  // v0.5 PR-Waterfall E — render the per-lane density heatmap as a
  // backdrop CSS gradient. The gradient is stepped (no interpolation
  // between buckets) so bins read as discrete frames — Tufte's
  // "intense, simple, word-sized graphics" + horizon-graph compression
  // (Heer et al., CHI 2009) without an extra row of vertical real estate.
  const heatmapBg = heatmap ? heatmapToGradient(heatmap) : 'var(--surface-1)';
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '110px 1fr',
        gap: 'var(--space-3)',
        alignItems: 'center',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: `var(--actor-${actor}, var(--ink-muted))`,
          textTransform: 'uppercase',
          letterSpacing: '0.3px',
          textAlign: 'right',
          fontWeight: 600,
        }}
      >
        {actor}
      </span>
      <div
        style={{
          position: 'relative',
          height: laneHeight,
          background: heatmapBg,
          borderRadius: 'var(--r-xs)',
        }}
      >
        {spans.map((s) => (
          <SpanBar
            key={s.id}
            span={s}
            actor={actor}
            t0={t0}
            total={total}
            maxCost={maxCost}
            showSubSpans={showSubSpans}
          />
        ))}
      </div>
    </div>
  );
}

function SpanBar({
  span,
  actor,
  t0,
  total,
  maxCost,
  showSubSpans,
}: {
  span: Span;
  actor: string;
  t0: number;
  total: number;
  maxCost: number;
  showSubSpans: boolean;
}) {
  const left = ((span.startTs - t0) / total) * 100;
  const width = Math.max(0.5, ((span.endTs - span.startTs) / total) * 100);
  const isQaError = span.qaExitCode !== null && span.qaExitCode !== 0;
  const failed = span.errored || isQaError;
  const tone = verdictTone(span.verdict);
  const opacity = costOpacity(span, maxCost);

  const tooltip = [
    `${actor} · ${formatMs(span.endTs - span.startTs)}${span.inFlight ? ' (in flight)' : ''}`,
    `tokens ${formatNum(span.tokensIn)} in / ${formatNum(span.tokensOut)} out`,
    `cache ${formatNum(span.cacheRead)} · cost ${formatCost(span.costUsd)}`,
    span.verdict ? `verdict ${span.verdict}` : null,
    isQaError ? `qa exit ${span.qaExitCode}` : null,
    `${span.toolCalls.length} tool.call${span.toolCalls.length === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join('\n');

  const spanColor = `var(--actor-${actor})`;

  return (
    <button
      type="button"
      onClick={() => setSelectedNodeActor(actor)}
      title={tooltip}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: `${left}%`,
        width: `${width}%`,
        background: failed
          ? 'var(--audit-fg)'
          : `color-mix(in oklab, ${spanColor} ${(opacity * 100).toFixed(0)}%, transparent)`,
        border: `1px solid ${failed ? 'var(--tone-fail)' : 'var(--hairline-strong)'}`,
        borderRadius: 'var(--r-xs)',
        cursor: 'pointer',
        opacity: span.inFlight ? 0.7 : 1,
        padding: 0,
        color: 'var(--surface-card)',
        fontSize: 9,
        fontFamily: 'var(--font-mono)',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 4,
          paddingRight: 4,
          minWidth: 0,
        }}
      >
        {/* Nested tool.call stripes — show "what was happening DURING
            this spawn" without losing the lane-level overview. */}
        {showSubSpans &&
          span.toolCalls.map((c) => {
            const denom = Math.max(1, span.endTs - span.startTs);
            const sLeft = ((c.startTs - span.startTs) / denom) * 100;
            const sWidth = Math.max(0.4, ((c.endTs - c.startTs) / denom) * 100);
            return (
              <span
                key={c.id}
                title={`${c.tool ?? c.toolKind}${c.path ? ' · ' + c.path : ''} · ${formatMs(c.endTs - c.startTs)}`}
                style={{
                  position: 'absolute',
                  top: 2,
                  bottom: 8,
                  left: `${sLeft}%`,
                  width: `${sWidth}%`,
                  background: 'color-mix(in oklab, var(--ink-strong) 35%, transparent)',
                  borderRadius: 1,
                }}
              />
            );
          })}
        <span style={{ position: 'relative', zIndex: 1 }}>
          {width > 4 ? formatMs(span.endTs - span.startTs) : ''}
        </span>
        {failed && width > 1.5 && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 1,
              right: 2,
              width: 6,
              height: 6,
              transform: 'rotate(45deg)',
              background: 'var(--tone-fail)',
              border: '1px solid var(--surface-card)',
              zIndex: 2,
            }}
          />
        )}
      </div>
      {/* Verdict strip — visual gut-check on whether the spawn closed
          clean. PASS=lime / PARTIAL=warn / FAIL=red / pending=neutral. */}
      <div
        style={{
          height: 3,
          background: span.verdict ? `var(--tone-${tone})` : 'transparent',
        }}
      />
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 'var(--space-4)',
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
        color: 'var(--ink-tertiary)',
        background: 'var(--canvas)',
        height: '100%',
      }}
    >
      {children}
    </div>
  );
}

// ─── v0.5 PR-Waterfall E — Layered Cost Strip + density heatmap ────────────

interface CostSample {
  ts: number;
  tokens: number;
  cost: number;
}

/**
 * Cumulative tokens + cost samples derived from agent.stop events. The
 * dispatcher folds usage into agent.stop.metadata at exit (live.ts:507);
 * codex/gemini-local now report usage too (PR #214 cross-provider info
 * parity), so this strip is no longer claude-only.
 */
function buildCostSamples(events: TranscriptEvent[]): CostSample[] {
  let tokens = 0;
  let cost = 0;
  const out: CostSample[] = [];
  for (const e of events) {
    if (e.kind !== 'agent.stop') continue;
    const md = (e.metadata ?? {}) as { tokens_in?: number; tokens_out?: number; cost_usd?: number };
    tokens += (md.tokens_in ?? 0) + (md.tokens_out ?? 0);
    cost += md.cost_usd ?? 0;
    const ts = Date.parse(e.ts);
    if (!Number.isFinite(ts)) continue;
    out.push({ ts, tokens, cost });
  }
  return out;
}

/**
 * Bin every HEATMAP_KINDS event into 1-second buckets per actor. Returns a
 * Map<actor, number[]> where each array has `bucketCount` entries (count
 * of events in that 1s window). Used by Lane() as a CSS linear-gradient
 * backdrop — Tufte horizon-graph compression at zero extra row cost.
 */
function buildHeatmap(events: TranscriptEvent[], t0: number, total: number): Map<string, number[]> {
  const BUCKET_MS = 1000;
  const bucketCount = Math.max(1, Math.ceil(total / BUCKET_MS));
  const byActor = new Map<string, number[]>();
  for (const e of events) {
    if (!e.from || !HEATMAP_KINDS.has(e.kind)) continue;
    const ts = Date.parse(e.ts);
    if (!Number.isFinite(ts)) continue;
    const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor((ts - t0) / BUCKET_MS)));
    let arr = byActor.get(e.from);
    if (!arr) {
      arr = new Array(bucketCount).fill(0);
      byActor.set(e.from, arr);
    }
    arr[idx] = (arr[idx] ?? 0) + 1;
  }
  return byActor;
}

/** Stepped CSS linear-gradient — discrete bins, alpha proportional to count. */
function heatmapToGradient(row: number[]): string {
  const max = row.reduce((m, v) => (v > m ? v : m), 0);
  if (max === 0) return 'var(--surface-1)';
  const stops: string[] = [];
  for (let i = 0; i < row.length; i++) {
    const a = row[i] === 0 ? 0 : 0.04 + 0.18 * (row[i]! / max);
    const left = (i / row.length) * 100;
    const right = ((i + 1) / row.length) * 100;
    const rgba = `rgba(94,106,210,${a.toFixed(3)})`;
    stops.push(`${rgba} ${left.toFixed(2)}%`);
    stops.push(`${rgba} ${right.toFixed(2)}%`);
  }
  return `linear-gradient(to right, ${stops.join(', ')}), var(--surface-1)`;
}

/**
 * Cost strip — sticky SVG above the lane scroll area. Tokens area
 * (filled blue-ish) underlay + cost line (orange) overlay over the same
 * t0..tMax window the bars use. Heights are normalized independently so
 * the cost line stays visible even when cost is small relative to
 * tokens. Empty when no agent.stop emitted usage yet.
 */
function CostStrip({
  samples,
  t0,
  total,
}: {
  samples: CostSample[];
  t0: number;
  total: number;
}) {
  if (samples.length === 0) return null;
  const lastSample = samples[samples.length - 1]!;
  const maxTokens = lastSample.tokens || 1;
  const maxCost = lastSample.cost || 0;
  const W = 1000;
  const H = 36;
  const xs = (ts: number): number => ((ts - t0) / Math.max(1, total)) * W;
  const ysTokens = (n: number): number => H - (n / maxTokens) * (H - 4) - 2;
  const ysCost = (n: number): number => H - (n / Math.max(maxCost, 1e-9)) * (H - 4) - 2;
  const tokenPathSteps = samples
    .map((s) => `L${xs(s.ts).toFixed(2)},${ysTokens(s.tokens).toFixed(2)}`)
    .join(' ');
  const tokenArea = `M0,${H} L${xs(samples[0]!.ts).toFixed(2)},${H} ${tokenPathSteps} L${W},${ysTokens(lastSample.tokens).toFixed(2)} L${W},${H} Z`;
  const costLine =
    maxCost > 0
      ? 'M' + samples.map((s) => `${xs(s.ts).toFixed(2)},${ysCost(s.cost).toFixed(2)}`).join(' L')
      : '';
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 5,
        margin: '0 var(--space-3)',
        height: 44,
        display: 'grid',
        gridTemplateColumns: '110px 1fr',
        gap: 'var(--space-3)',
        alignItems: 'center',
        borderBottom: '1px solid var(--hairline)',
        paddingBottom: 6,
        background: 'var(--canvas)',
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontFamily: 'var(--font-mono)',
          color: 'var(--ink-tertiary)',
          textAlign: 'right',
          textTransform: 'uppercase',
          letterSpacing: '0.4px',
        }}
      >
        cost ↗ tokens
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 36 }}>
        <path d={tokenArea} fill="rgba(94,106,210,0.18)" stroke="rgba(94,106,210,0.55)" strokeWidth="1" />
        {costLine && (
          <path d={costLine} fill="none" stroke="var(--accent-warm, #FFB627)" strokeWidth="1.4" />
        )}
      </svg>
    </div>
  );
}
