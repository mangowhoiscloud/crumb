/**
 * SessionRow — sidebar row for one session.
 *
 * Per DESIGN.md §4.5 — state dot + ULID prefix · 12 chars + lifecycle pill +
 * goal + cost · evt count meta. Selected: --surface-2 background.
 *
 * State dot reads `derived_state` (server-side classification from PR-O1
 * #137 + PR-O1.5 #139).
 */

import type { SessionRow as Row } from '../lib/api';

interface Props {
  session: Row;
  active?: boolean;
  onClick?: () => void;
}

const STATE_DOT_COLOR: Record<string, string> = {
  live: 'var(--lime)',
  paused: 'var(--warn)',
  done: 'var(--ink-muted)',
  errored: 'var(--audit-fg)',
  terminal: 'var(--ink-tertiary)',
  unknown: 'var(--ink-tertiary)',
};

function formatCost(cost?: number | null): string {
  if (cost == null || !Number.isFinite(cost)) return '—';
  return `$${cost.toFixed(3)}`;
}

export function SessionRow({ session: s, active, onClick }: Props) {
  const state = s.derived_state ?? 'unknown';
  const dot = STATE_DOT_COLOR[state] ?? STATE_DOT_COLOR.unknown;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: 'var(--space-2) var(--space-3)',
        borderRadius: 'var(--r-sm)',
        background: active ? 'var(--surface-2)' : 'transparent',
        cursor: 'pointer',
        borderLeft: active ? '2px solid var(--primary)' : '2px solid transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: dot,
            flex: '0 0 auto',
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--ink-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            minWidth: 0,
          }}
        >
          {s.session_id.slice(0, 12)}…
        </span>
        <span
          title={s.derived_state_reason ?? ''}
          style={{
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: '0.3px',
            color: dot,
            whiteSpace: 'nowrap',
          }}
        >
          {state}
        </span>
      </div>
      <div
        title={s.goal ?? ''}
        style={{
          fontSize: 12,
          color: 'var(--ink)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {s.goal ?? '(no goal yet)'}
      </div>
      <div
        style={{
          fontSize: 10,
          color: 'var(--ink-subtle)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {formatCost(s.metrics?.cost)} · {s.metrics?.events ?? 0} evt
      </div>
    </div>
  );
}
