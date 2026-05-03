/**
 * DesignCheckPanel — Detail Rail mode 3 (W3 surface).
 *
 * Per migration plan §6.7 + §0.0.2 W3 absorption: surfaces the deterministic
 * design_check effect (palette ⊂ retro / touch zones WCAG 2.5.5 AAA = 44×44 px /
 * motion timing within evidence_ref deviation) when a `qa.result` event in
 * the active session carries a `design_check` block.
 *
 * Scope today:
 * - Reads the most recent `qa.result` event from the rolling stream window.
 * - Renders per-rule pass / fail with offending value + threshold + evidence
 *   ref pointer when present.
 * - Empty-state when no `qa.result` exists yet, or when the qa.result has no
 *   `design_check` payload (W3 reducer-side not yet emitting).
 *
 * §8.1 quality bar — explicit empty / waiting states; no fake numbers; the
 * source of every rendered value is the `qa.result` event id (cited in
 * footer for traceability).
 */

import { useMemo } from 'react';
import { useActiveSession } from '../stores/selection';
import { useTranscriptStream, type TranscriptEvent } from '../hooks/useTranscriptStream';

interface DesignCheckRule {
  rule: string;
  status: 'pass' | 'fail' | 'skipped';
  value?: string | number;
  threshold?: string | number;
  evidence_ref?: string;
  message?: string;
}

interface DesignCheckBlock {
  rules: DesignCheckRule[];
  overall_status?: 'pass' | 'fail' | 'partial';
}

export function DesignCheckPanel() {
  const sessionId = useActiveSession();
  const stream = useTranscriptStream(500);

  const latestQa = useMemo<TranscriptEvent | null>(() => {
    for (let i = stream.events.length - 1; i >= 0; i--) {
      if (stream.events[i]!.kind === 'qa.result') return stream.events[i]!;
    }
    return null;
  }, [stream.events]);

  const designCheck = useMemo<DesignCheckBlock | null>(() => {
    if (!latestQa?.data) return null;
    const block = (latestQa.data as Record<string, unknown>).design_check;
    if (!block || typeof block !== 'object') return null;
    return block as DesignCheckBlock;
  }, [latestQa]);

  if (!sessionId) {
    return <Empty>select a session for design-check audit</Empty>;
  }
  if (!latestQa) {
    return <Empty>no qa.result event yet — design-check waits on builder + qa</Empty>;
  }
  if (!designCheck) {
    return (
      <Empty>
        qa.result present, but no <code>design_check</code> block. Reducer-side W3
        deterministic effect not yet emitting palette / touch / motion rules — see plan §0.0.2.
      </Empty>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--canvas)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--ink)',
      }}
    >
      <div
        style={{
          padding: 'var(--space-2) var(--space-3)',
          borderBottom: '1px solid var(--hairline-soft)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: 'var(--ink-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
          }}
        >
          design-check
        </span>
        {designCheck.overall_status && (
          <span style={{ marginLeft: 'auto' }}>
            <StatusPill status={designCheck.overall_status} />
          </span>
        )}
      </div>
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 'var(--space-2) var(--space-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {designCheck.rules.length === 0 && (
          <span style={{ color: 'var(--ink-tertiary)' }}>(empty rule set)</span>
        )}
        {designCheck.rules.map((r, i) => (
          <RuleRow key={`${r.rule}-${i}`} rule={r} />
        ))}
      </div>
      <div
        style={{
          padding: '4px var(--space-3)',
          borderTop: '1px solid var(--hairline-soft)',
          color: 'var(--ink-tertiary)',
          fontSize: 9,
          letterSpacing: '0.3px',
        }}
      >
        source · qa.result {latestQa.id.slice(0, 10)}…
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: 'pass' | 'fail' | 'partial' | 'skipped' }) {
  const tone =
    status === 'pass' ? 'pass' : status === 'fail' ? 'fail' : status === 'partial' ? 'partial' : 'pending';
  return (
    <span
      style={{
        fontSize: 9,
        textTransform: 'uppercase',
        letterSpacing: '0.4px',
        padding: '1px 6px',
        borderRadius: 'var(--r-pill)',
        color: `var(--tone-${tone})`,
        border: `1px solid var(--tone-${tone})`,
        background: `color-mix(in oklab, var(--tone-${tone}) 12%, transparent)`,
      }}
    >
      {status}
    </span>
  );
}

function RuleRow({ rule }: { rule: DesignCheckRule }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '14px 1fr 60px',
        gap: 'var(--space-2)',
        alignItems: 'center',
        padding: '4px 0',
        borderBottom: '1px solid var(--hairline-soft)',
      }}
    >
      <span aria-hidden style={{ color: `var(--tone-${rule.status === 'pass' ? 'pass' : rule.status === 'fail' ? 'fail' : 'pending'})` }}>
        {rule.status === 'pass' ? '✓' : rule.status === 'fail' ? '✗' : '·'}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ color: 'var(--ink)' }}>{rule.rule}</span>
        {(rule.value !== undefined || rule.threshold !== undefined || rule.message) && (
          <span style={{ color: 'var(--ink-muted)', fontSize: 10 }}>
            {rule.value !== undefined && <>value: {String(rule.value)}</>}
            {rule.threshold !== undefined && (
              <>
                {rule.value !== undefined ? ' · ' : ''}threshold: {String(rule.threshold)}
              </>
            )}
            {rule.message && (
              <>
                {(rule.value !== undefined || rule.threshold !== undefined) && ' · '}
                {rule.message}
              </>
            )}
          </span>
        )}
        {rule.evidence_ref && (
          <span style={{ color: 'var(--ink-tertiary)', fontSize: 9 }}>
            evidence · {rule.evidence_ref}
          </span>
        )}
      </span>
      <StatusPill status={rule.status} />
    </div>
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
