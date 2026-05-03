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
import { useTranscriptStream } from '../hooks/useTranscriptStream';
import { useActiveSession, setSelectedNodeActor } from '../stores/selection';
import { deriveSpans, type Span, type Verdict } from '../lib/spans';
import { ALL_ACTORS } from './pipeline/layout';

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
}: {
  actor: string;
  spans: Span[];
  t0: number;
  total: number;
  maxCost: number;
  showSubSpans: boolean;
}) {
  const laneHeight = showSubSpans ? 32 : 22;
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
          background: 'var(--surface-1)',
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
