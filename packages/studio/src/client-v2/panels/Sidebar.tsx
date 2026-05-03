/**
 * Sidebar panel — Adapters list + Sessions list, both data-bound.
 *
 * Per DESIGN.md §4.4 + §4.5. Data flows from:
 *   /api/doctor → useDoctor() → AdapterRow per adapter
 *   /api/sessions → useSessions() + useSessionsSseBridge() → SessionRow
 *
 * The cascading new-session form lives in NewSessionForm.tsx (separate
 * file because the form is a substantial sub-component with its own
 * state machine — DESIGN.md §4.3 row variants).
 *
 * §8.1 quality bar — empty / loading / error / reconnecting states all
 * rendered explicitly below. SSE reconnect indicator lands in M5 when
 * the slash bar surfaces it (single status-bar source).
 */

import type { IDockviewPanelProps } from 'dockview-react';
import { useMemo, useState } from 'react';
import { useDoctor } from '../hooks/useDoctor';
import { useSessions } from '../hooks/useSessions';
import { AdapterRow } from '../components/AdapterRow';
import { SessionRow } from '../components/SessionRow';
import { setActiveSession, useActiveSession } from '../stores/selection';
import { NewSessionForm } from './NewSessionForm';

export function Sidebar(_props: IDockviewPanelProps) {
  const doctor = useDoctor();
  const sessions = useSessions();
  const active = useActiveSession();
  const [showForm, setShowForm] = useState(false);

  const projectGroups = useMemo(() => {
    if (!sessions.data) return [];
    const groups = new Map<string, typeof sessions.data.sessions>();
    for (const s of sessions.data.sessions) {
      const list = groups.get(s.project_id) ?? [];
      list.push(s);
      groups.set(s.project_id, list);
    }
    return Array.from(groups.entries());
  }, [sessions.data]);

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        background: 'var(--canvas)',
        padding: 'var(--space-2) 0',
      }}
    >
      <SidebarHeading
        label="Adapters"
        right={
          <button
            type="button"
            onClick={() => doctor.refetch()}
            title="Re-probe installed adapters"
            aria-label="Refresh adapters"
            style={iconBtnStyle}
          >
            ↻
          </button>
        }
      />
      <div style={{ padding: '0 var(--space-2)' }}>
        {doctor.isLoading && <Empty text="probing…" />}
        {doctor.error && <Empty text={`error: ${(doctor.error as Error).message}`} tone="error" />}
        {doctor.data?.adapters.map((a) => (
          <AdapterRow key={a.id} adapter={a} />
        ))}
      </div>

      <SidebarHeading
        label="Sessions"
        right={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            title="Start a new crumb session"
            aria-label="New session"
            aria-expanded={showForm}
            style={iconBtnStyle}
          >
            {showForm ? '×' : '＋'}
          </button>
        }
      />
      {showForm && (
        <div style={{ padding: '0 var(--space-3) var(--space-3)' }}>
          <NewSessionForm
            adapters={doctor.data?.adapters ?? []}
            onSpawned={() => {
              setShowForm(false);
              sessions.refetch();
            }}
          />
        </div>
      )}
      <div style={{ padding: '0 var(--space-2)' }}>
        {sessions.isLoading && <Empty text="loading…" />}
        {sessions.error && (
          <Empty text={`error: ${(sessions.error as Error).message}`} tone="error" />
        )}
        {projectGroups.map(([pid, list]) => (
          <div key={pid} style={{ marginBottom: 'var(--space-3)' }}>
            <div
              style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: 'var(--ink-tertiary)',
                padding: '4px var(--space-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
              }}
              title={pid}
            >
              {pid.slice(0, 12)}
            </div>
            {list.map((s) => (
              <SessionRow
                key={s.session_id}
                session={s}
                active={active === s.session_id}
                onClick={() => setActiveSession(s.session_id)}
              />
            ))}
          </div>
        ))}
        {!sessions.isLoading && !sessions.error && projectGroups.length === 0 && (
          <Empty text="no sessions yet — hit ＋ to start one" />
        )}
      </div>
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--r-sm)',
  color: 'var(--ink-muted)',
  fontSize: 14,
  width: 22,
  height: 22,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function SidebarHeading({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-2) var(--space-4)',
        borderBottom: '1px solid var(--hairline-soft)',
      }}
    >
      <h2
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.4px',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
          margin: 0,
        }}
      >
        {label}
      </h2>
      {right}
    </div>
  );
}

function Empty({ text, tone }: { text: string; tone?: 'error' }) {
  return (
    <div
      style={{
        padding: 'var(--space-3) var(--space-3)',
        fontSize: 11,
        color: tone === 'error' ? 'var(--audit-fg)' : 'var(--ink-tertiary)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {text}
    </div>
  );
}
