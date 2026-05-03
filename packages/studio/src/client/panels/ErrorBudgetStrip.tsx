/**
 * ErrorBudgetStrip — session budget burndown (PR-O2 reborn in v2).
 *
 * Three thin bars: respec / verify / token. Reads `metrics.budget` from
 * `/api/sessions` (server-derived, no client recomputation per §17.3 #1).
 * Today the operator can't tell whether a run is about to hit RESPEC_MAX
 * or VERIFY_MAX until the reducer emits `done` with `reason=too_many_*`;
 * surfacing `*_used / *_max` ahead of cutoff lets them intervene.
 *
 * §8.1 quality bar: empty state when no active session, tone-aware bar
 * fills (lime → warn → fail at 60% / 85% thresholds).
 */

import { useActiveSession } from '../stores/selection';
import { useSessions } from '../hooks/useSessions';

const THRESH_WARN = 0.6;
const THRESH_FAIL = 0.85;

export function ErrorBudgetStrip() {
  const sessionId = useActiveSession();
  const sessions = useSessions();
  const session = sessions.data?.sessions.find((s) => s.session_id === sessionId);
  const budget = session?.metrics?.budget;

  if (!sessionId || !budget) {
    return (
      <div
        style={{
          padding: '4px var(--space-3)',
          borderBottom: '1px solid var(--hairline-soft)',
          background: 'var(--surface-1)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--ink-tertiary)',
          display: 'flex',
          gap: 'var(--space-3)',
        }}
      >
        <span>budget · awaiting session</span>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '4px var(--space-3)',
        borderBottom: '1px solid var(--hairline-soft)',
        background: 'var(--surface-1)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 'var(--space-3)',
        alignItems: 'center',
      }}
    >
      <BudgetBar label="respec" used={budget.respec_count} max={budget.respec_max} />
      <BudgetBar label="verify" used={budget.verify_count} max={budget.verify_max} />
      <BudgetBar
        label="token"
        used={budget.token_total}
        max={budget.token_hard_cap}
        formatter={formatThousands}
      />
    </div>
  );
}

function BudgetBar({
  label,
  used,
  max,
  formatter,
}: {
  label: string;
  used: number;
  max: number;
  formatter?: (n: number) => string;
}) {
  const pct = max > 0 ? Math.min(1, used / max) : 0;
  const tone = pct >= THRESH_FAIL ? 'fail' : pct >= THRESH_WARN ? 'partial' : 'pass';
  const fmt = formatter ?? ((n: number) => n.toString());
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '54px 1fr 90px',
        gap: 6,
        alignItems: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
      }}
    >
      <span
        style={{
          color: 'var(--ink-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.4px',
        }}
      >
        {label}
      </span>
      <span
        aria-label={`${label} budget ${used} of ${max}`}
        style={{
          height: 4,
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
            width: `${(pct * 100).toFixed(1)}%`,
            background: `var(--tone-${tone})`,
          }}
        />
      </span>
      <span style={{ color: 'var(--ink)', textAlign: 'right' }}>
        {fmt(used)}
        <span style={{ color: 'var(--ink-tertiary)' }}> / {fmt(max)}</span>
      </span>
    </div>
  );
}

function formatThousands(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}
