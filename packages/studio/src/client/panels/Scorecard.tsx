/**
 * Scorecard — composite headline + radar + drilldown rows + sparklines.
 *
 * Per migration plan §6 + DESIGN.md §4 + visual baseline (Image #12).
 * Hybrid layout from PR-K (frontier eval-UI survey, Candidate S4):
 *   [optional sparklines row when ≥2 rounds]
 *   [composite headline | 80×80 radar | 6 drilldown rows]
 *
 * Reads judge.score / verify.result events from the rolling window.
 * Each row cites its source via SourceBadge — never a silent render.
 *
 * §8.1 quality bar:
 * - empty state: "awaiting verifier" pill, 0% bars (no fake numbers)
 * - anti-deception: every score row carries SourceBadge per AGENTS.md
 *   invariant 4 + plan §17.4 hygiene rule #1
 * - reduced motion: SVG only (no transitions); see globals.css media query
 */

import { useMemo } from 'react';
import { useActiveSession } from '../stores/selection';
import { useTranscriptStream } from '../hooks/useTranscriptStream';
import {
  AGGREGATE_MAX,
  DIMENSIONS,
  DIMENSION_LABELS,
  DIMENSION_MAX,
  type Dimension,
} from '../../server/types';
import {
  buildJudgeSnapshot,
  dimSeries,
  extractJudgeEvents,
  verdictTone,
  type DimRecord,
} from '../lib/scoring';
import { SourceBadge } from '../components/SourceBadge';

export function Scorecard() {
  const sessionId = useActiveSession();
  const stream = useTranscriptStream(500);

  const judges = useMemo(() => extractJudgeEvents(stream.events), [stream.events]);
  const lastSnap = useMemo(
    () => (judges.length > 0 ? buildJudgeSnapshot(judges[judges.length - 1]!) : null),
    [judges],
  );
  const prevSnap = useMemo(
    () => (judges.length > 1 ? buildJudgeSnapshot(judges[judges.length - 2]!) : null),
    [judges],
  );
  const series = useMemo(() => dimSeries(judges), [judges]);

  if (!sessionId) {
    return (
      <Strip>
        <span style={{ color: 'var(--ink-tertiary)', fontSize: 11 }}>
          select a session for scorecard
        </span>
      </Strip>
    );
  }

  const records: DimRecord[] =
    lastSnap?.records ??
    DIMENSIONS.map((d) => ({
      key: d,
      name: DIMENSION_LABELS[d],
      score: null,
      source: null,
      sanitized: null,
    }));
  const aggregate = lastSnap?.aggregate ?? null;
  const verdict = lastSnap?.verdict ?? null;
  const delta =
    aggregate != null && prevSnap?.aggregate != null ? aggregate - prevSnap.aggregate : null;

  return (
    <Strip>
      {judges.length >= 2 && <SparklinesRow series={series} verdict={verdict} />}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '160px 96px 1fr',
          gap: 'var(--space-3)',
          alignItems: 'center',
        }}
      >
        <Composite aggregate={aggregate} verdict={verdict} delta={delta} />
        <Radar records={records} />
        <Rows records={records} />
      </div>
    </Strip>
  );
}

function Strip({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 'var(--space-2) var(--space-3)',
        borderBottom: '1px solid var(--hairline)',
        background: 'var(--surface-1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}
    >
      {children}
    </div>
  );
}

function Composite({
  aggregate,
  verdict,
  delta,
}: {
  aggregate: number | null;
  verdict: import('../../server/types').Verdict | null;
  delta: number | null;
}) {
  const aggStr = aggregate != null ? aggregate.toFixed(1) : '—';
  const tone = verdictTone(verdict);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 22,
          fontWeight: 600,
          color: 'var(--ink)',
          letterSpacing: '-0.5px',
        }}
      >
        {aggStr}
        <span style={{ color: 'var(--ink-tertiary)', fontSize: 13, fontWeight: 400 }}>
          {' / '}
          {AGGREGATE_MAX}
        </span>
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            padding: '2px 7px',
            borderRadius: 'var(--r-pill)',
            color: `var(--tone-${tone})`,
            border: `1px solid var(--tone-${tone})`,
            background: `color-mix(in oklab, var(--tone-${tone}) 15%, transparent)`,
          }}
        >
          {verdict ?? 'pending'}
        </span>
        {delta != null && delta !== 0 && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: delta > 0 ? 'var(--tone-pass)' : 'var(--tone-partial)',
            }}
          >
            {delta > 0 ? '↗ +' : '↘ '}
            {delta.toFixed(1)}
            <span style={{ color: 'var(--ink-tertiary)', marginLeft: 2 }}>vs prev</span>
          </span>
        )}
      </div>
    </div>
  );
}

/** 6-axis radar (CourtEval paper convention). 80×80 SVG, polar coords. */
function Radar({ records }: { records: DimRecord[] }) {
  const W = 80;
  const cx = W / 2;
  const cy = W / 2;
  const r = (W / 2) * 0.85;
  const points = records
    .map((rec, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / records.length;
      const score = rec.score ?? 0;
      const radius = (score / DIMENSION_MAX) * r;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const ringPoints = records
    .map((_, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / records.length;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      role="img"
      aria-label={`radar ${records.map((r) => `${r.key}=${r.score ?? 0}`).join(' ')}`}
      width={W}
      height={W}
      viewBox={`0 0 ${W} ${W}`}
    >
      <polygon points={ringPoints} fill="none" stroke="var(--hairline)" strokeWidth={0.5} />
      {records.map((_, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / records.length;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x.toFixed(1)}
            y2={y.toFixed(1)}
            stroke="var(--hairline-soft)"
            strokeWidth={0.5}
          />
        );
      })}
      <polygon
        points={points}
        fill="color-mix(in oklab, var(--primary) 25%, transparent)"
        stroke="var(--primary)"
        strokeWidth={1}
      />
    </svg>
  );
}

function Rows({ records }: { records: DimRecord[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 2,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
      }}
    >
      {records.map((rec) => (
        <Row key={rec.key} rec={rec} />
      ))}
    </div>
  );
}

function Row({ rec }: { rec: DimRecord }) {
  const pct = rec.score != null ? (rec.score / DIMENSION_MAX) * 100 : 0;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '24px 80px 1fr 38px 38px',
        gap: 6,
        alignItems: 'center',
      }}
    >
      <span style={{ color: 'var(--ink-strong)', fontWeight: 600 }}>{rec.key}</span>
      <span style={{ color: 'var(--ink-muted)' }}>{rec.name}</span>
      <span
        aria-label={`${rec.key} bar ${rec.score ?? 0} of ${DIMENSION_MAX}`}
        style={{
          height: 6,
          borderRadius: 'var(--r-pill)',
          background: 'var(--surface-3)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background: 'var(--primary)',
          }}
        />
      </span>
      <span style={{ color: 'var(--ink)', textAlign: 'right' }}>
        {rec.score != null ? rec.score.toFixed(1) : '—'}
        {rec.sanitized && (
          <span
            title={rec.sanitized.note}
            style={{
              marginLeft: 4,
              fontSize: 9,
              color: 'var(--audit-fg)',
            }}
          >
            ⚠
          </span>
        )}
      </span>
      <SourceBadge source={rec.source} />
    </div>
  );
}

/** Per-dim sparkline row (PR-O4 port). Renders only when ≥2 rounds exist. */
function SparklinesRow({
  series,
  verdict,
}: {
  series: Record<Dimension, number[]>;
  verdict: import('../../server/types').Verdict | null;
}) {
  const tone = verdictTone(verdict);
  const W = 60;
  const H = 16;
  const PAD = 2;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 'var(--space-2)',
      }}
    >
      {DIMENSIONS.map((d) => {
        const data = series[d];
        if (data.length < 2) return <span key={d} />;
        const stepX = (W - 2 * PAD) / Math.max(1, data.length - 1);
        const points = data
          .map((s, i) => {
            const x = PAD + i * stepX;
            const y = H - PAD - (s / DIMENSION_MAX) * (H - 2 * PAD);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ');
        const lastX = PAD + (data.length - 1) * stepX;
        const lastValue = data[data.length - 1] ?? 0;
        const lastY = H - PAD - (lastValue / DIMENSION_MAX) * (H - 2 * PAD);
        return (
          <div
            key={d}
            title={`${d} · ${data.map((s) => s.toFixed(1)).join(' → ')}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--ink-muted)',
            }}
          >
            <span>{d}</span>
            <svg
              role="img"
              aria-label={`${d} trajectory ${data.length} rounds`}
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              style={{ flex: 1, height: H }}
            >
              <polyline
                points={points}
                fill="none"
                stroke="var(--ink-muted)"
                strokeWidth={1}
              />
              <circle
                cx={lastX.toFixed(1)}
                cy={lastY.toFixed(1)}
                r={2}
                fill={`var(--tone-${tone})`}
              />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
