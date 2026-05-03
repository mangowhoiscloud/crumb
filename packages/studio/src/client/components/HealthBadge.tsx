/**
 * HealthBadge — Status-bar dot showing the reducer's pause/resume
 * lifecycle smoke-check verdict.
 *
 * Per migration plan §6.8 — green when `pause_resume_lifecycle === 'ok'`,
 * amber on degraded, red on broken. Hover = tooltip with the failing
 * transition + ms duration. Click → opens a Sheet (M6 polish; for now
 * just shows tooltip-only).
 *
 * Reads from `useHealth()` which refetches every 60s. Server caches 30s.
 */

import { useHealth } from '../hooks/useHealth';

export function HealthBadge() {
  const health = useHealth();
  const lifecycle = health.data?.pause_resume_lifecycle;

  const tone =
    lifecycle?.verdict === 'ok'
      ? 'var(--lime)'
      : lifecycle?.verdict === 'degraded'
        ? 'var(--warn)'
        : lifecycle?.verdict === 'broken'
          ? 'var(--audit-fg)'
          : 'var(--ink-tertiary)';

  const label = lifecycle?.verdict ?? (health.isLoading ? 'probing…' : 'unknown');

  const title = lifecycle
    ? `pause/resume lifecycle: ${lifecycle.verdict} · ${lifecycle.duration_ms}ms · ${lifecycle.steps_failed === 0 ? 'all transitions pass' : `${lifecycle.steps_failed} transitions failed`}`
    : health.error
      ? `error: ${(health.error as Error).message}`
      : 'self-check probing…';

  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        color: 'var(--ink-subtle)',
        padding: '2px 8px',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--r-pill)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: tone,
        }}
      />
      <span>health · {label}</span>
    </span>
  );
}
