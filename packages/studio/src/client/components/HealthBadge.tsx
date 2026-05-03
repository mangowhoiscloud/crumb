/**
 * HealthBadge — Status-bar dot showing the reducer's pause/resume
 * lifecycle smoke-check verdict + click-to-open Sheet with full report.
 *
 * Per migration plan §6.8 + M10b/c follow-up — green when
 * `pause_resume_lifecycle === 'ok'`, amber on degraded, red on broken.
 * Hover = compact tooltip; click = modal Sheet with per-step pass/fail
 * + duration_ms + cached_at + sessions-by-state breakdown.
 *
 * Reads from `useHealth()` (refetch every 60 s; server caches 30 s).
 */

import { useEffect, useState } from 'react';
import { useHealth, type HealthSnapshot } from '../hooks/useHealth';

export function HealthBadge() {
  const health = useHealth();
  const [open, setOpen] = useState(false);

  const lifecycle = health.data?.pause_resume_lifecycle;
  const tone =
    lifecycle?.verdict === 'ok'
      ? 'var(--tone-pass)'
      : lifecycle?.verdict === 'degraded'
        ? 'var(--tone-partial)'
        : lifecycle?.verdict === 'broken'
          ? 'var(--tone-fail)'
          : 'var(--tone-pending)';
  const label = lifecycle?.verdict ?? (health.isLoading ? 'probing…' : 'unknown');
  const title = lifecycle
    ? `pause/resume lifecycle: ${lifecycle.verdict} · ${lifecycle.duration_ms}ms · ${
        lifecycle.steps_failed === 0
          ? 'all transitions pass'
          : `${lifecycle.steps_failed} transitions failed`
      } · click for details`
    : health.error
      ? `error: ${(health.error as Error).message}`
      : 'self-check probing… · click for details';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={title}
        aria-label={`open health detail · ${label}`}
        style={{
          all: 'unset',
          cursor: 'pointer',
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
          style={{ width: 6, height: 6, borderRadius: '50%', background: tone }}
        />
        <span>health · {label}</span>
      </button>
      {open && health.data && (
        <HealthSheet snapshot={health.data} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function HealthSheet({ snapshot, onClose }: { snapshot: HealthSnapshot; onClose: () => void }) {
  // Esc closes the sheet so keyboard users have a non-mouse exit.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const lifecycle = snapshot.pause_resume_lifecycle;
  const tone =
    lifecycle?.verdict === 'ok'
      ? 'pass'
      : lifecycle?.verdict === 'degraded'
        ? 'partial'
        : lifecycle?.verdict === 'broken'
          ? 'fail'
          : 'pending';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Studio health snapshot"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'color-mix(in oklab, var(--ink) 35%, transparent)',
        backdropFilter: 'blur(2px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
    >
      <div
        style={{
          background: 'var(--surface-card)',
          color: 'var(--ink)',
          border: '1px solid var(--hairline)',
          borderRadius: 'var(--r-md)',
          width: 'min(640px, 100%)',
          maxHeight: '80vh',
          overflow: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          boxShadow: '0 12px 40px color-mix(in oklab, var(--ink) 20%, transparent)',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-4)',
            borderBottom: '1px solid var(--hairline-soft)',
          }}
        >
          <strong style={{ fontSize: 13, color: 'var(--ink-strong)' }}>health snapshot</strong>
          {lifecycle && (
            <span
              style={{
                fontSize: 10,
                padding: '2px 7px',
                borderRadius: 'var(--r-pill)',
                color: `var(--tone-${tone})`,
                border: `1px solid var(--tone-${tone})`,
                background: `color-mix(in oklab, var(--tone-${tone}) 12%, transparent)`,
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
              }}
            >
              {lifecycle.verdict}
            </span>
          )}
          <span style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onClose}
            aria-label="close health snapshot"
            style={{
              all: 'unset',
              cursor: 'pointer',
              fontSize: 14,
              color: 'var(--ink-muted)',
              padding: '0 4px',
            }}
          >
            ✕
          </button>
        </header>

        <section style={{ padding: 'var(--space-3) var(--space-4)' }}>
          <SectionTitle>watcher</SectionTitle>
          <KV k="paths tracked" v={String(snapshot.watcher_paths_tracked)} />
          <KV k="sessions total" v={String(snapshot.sessions.total)} />
          {Object.entries(snapshot.sessions.by_state).map(([state, count]) => (
            <KV key={state} k={`  · ${state}`} v={String(count)} />
          ))}
        </section>

        {lifecycle && (
          <section
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderTop: '1px solid var(--hairline-soft)',
            }}
          >
            <SectionTitle>pause/resume lifecycle</SectionTitle>
            <KV k="duration" v={`${lifecycle.duration_ms}ms`} />
            <KV
              k="failures"
              v={
                lifecycle.steps_failed === -1
                  ? 'self-check unavailable'
                  : String(lifecycle.steps_failed)
              }
            />
            <KV k="cached at" v={lifecycle.cached_at.replace('T', ' ').slice(0, 19)} />
            {lifecycle.steps && lifecycle.steps.length > 0 && (
              <div style={{ marginTop: 'var(--space-2)' }}>
                {lifecycle.steps.map((s, i) => (
                  <div
                    key={`${s.name}-${i}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '14px 1fr 60px',
                      gap: 'var(--space-2)',
                      alignItems: 'center',
                      padding: '4px 0',
                      borderBottom: '1px solid var(--hairline-soft)',
                      fontSize: 11,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        color: `var(--tone-${s.status === 'pass' ? 'pass' : 'fail'})`,
                      }}
                    >
                      {s.status === 'pass' ? '✓' : '✗'}
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: 'var(--ink)' }}>{s.name}</span>
                      {s.message && (
                        <span style={{ color: 'var(--ink-muted)', fontSize: 10 }}>{s.message}</span>
                      )}
                    </span>
                    <span style={{ color: 'var(--ink-tertiary)', textAlign: 'right' }}>
                      {s.duration_ms != null ? `${s.duration_ms}ms` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <footer
          style={{
            padding: 'var(--space-2) var(--space-4)',
            borderTop: '1px solid var(--hairline-soft)',
            color: 'var(--ink-tertiary)',
            fontSize: 10,
          }}
        >
          source · GET /api/health (server cache 30s · client refetch 60s)
        </footer>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 9,
        textTransform: 'uppercase',
        letterSpacing: '0.4px',
        color: 'var(--ink-muted)',
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '160px 1fr',
        gap: 'var(--space-2)',
        padding: '2px 0',
        fontSize: 11,
      }}
    >
      <span style={{ color: 'var(--ink-muted)' }}>{k}</span>
      <span style={{ color: 'var(--ink)' }}>{v}</span>
    </div>
  );
}
