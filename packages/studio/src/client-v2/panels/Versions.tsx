/**
 * Versions panel — released milestone graph for the active session's project.
 *
 * Per migration plan §6 + §14.6 + DESIGN.md §4. Reads
 * `/api/projects/:pid/versions` (M7 endpoint) which walks every active
 * CRUMB_HOME for `<home>/projects/<pid>/versions/<vN>[-<label>]/manifest.toml`
 * and returns parsed manifests oldest-first.
 *
 * Clicking a row pins the Output panel to that version's frozen artifacts
 * via the `outputSource` slice in the selection store. Switching sessions
 * resets the toggle back to live session artifacts.
 *
 * §8.1 quality bar — explicit empty / loading / error states; manifest
 * sha256 + verdict + aggregate cited per row for traceability.
 */

import type { IDockviewPanelProps } from 'dockview-react';
import { useQuery } from '@tanstack/react-query';
import { useSessions } from '../hooks/useSessions';
import {
  setOutputSource,
  useActiveSession,
  useOutputSource,
} from '../stores/selection';
import { api, type VersionRow } from '../lib/api';
import { verdictTone } from '../lib/scoring';

export function Versions(_props: IDockviewPanelProps) {
  const sessionId = useActiveSession();
  const sessions = useSessions();
  const outputSource = useOutputSource();
  const projectId =
    sessions.data?.sessions.find((s) => s.session_id === sessionId)?.project_id ?? null;

  const versions = useQuery({
    queryKey: ['projectVersions', projectId],
    queryFn: () => api.projectVersions(projectId!),
    enabled: !!projectId,
    staleTime: 30_000,
  });

  if (!sessionId) return <Empty>Select a session in the sidebar.</Empty>;
  if (!projectId) return <Empty>Active session has no project id.</Empty>;
  if (versions.isLoading) return <Empty>loading versions…</Empty>;
  if (versions.isError)
    return (
      <Empty>
        <span style={{ color: 'var(--audit-fg)' }}>error · {String(versions.error)}</span>
      </Empty>
    );

  const rows = versions.data?.versions ?? [];
  if (rows.length === 0) {
    return (
      <Empty>
        no released versions yet — run <code>crumb release &lt;session&gt;</code> to snapshot
        the current artifacts/ into <code>versions/v1/</code>.
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
      }}
    >
      <div
        style={{
          padding: '4px var(--space-3)',
          borderBottom: '1px solid var(--hairline-soft)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            color: 'var(--ink-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
          }}
        >
          versions · {rows.length}
        </span>
        <span style={{ flex: 1 }} />
        {outputSource.mode === 'version' && (
          <button
            type="button"
            onClick={() => setOutputSource({ mode: 'session' })}
            style={{
              all: 'unset',
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: 'var(--ink-muted)',
              padding: '2px 8px',
              border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-sm)',
              background: 'var(--surface-1)',
            }}
          >
            ↩ output → session
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {rows.map((v) => (
          <VersionRowItem
            key={v.dir_name}
            row={v}
            projectId={projectId}
            active={
              outputSource.mode === 'version' &&
              outputSource.projectId === projectId &&
              outputSource.versionDir === v.dir_name
            }
            onPin={() =>
              setOutputSource({ mode: 'version', projectId, versionDir: v.dir_name })
            }
          />
        ))}
      </div>
    </div>
  );
}

function VersionRowItem({
  row,
  projectId,
  active,
  onPin,
}: {
  row: VersionRow;
  projectId: string;
  active: boolean;
  onPin: () => void;
}) {
  const tone = verdictTone(row.scorecard?.verdict ?? null);
  const sample = row.artifacts_sha256
    ? Object.entries(row.artifacts_sha256).slice(0, 2)
    : [];
  return (
    <button
      type="button"
      onClick={onPin}
      title={`pin Output to /api/projects/${projectId}/versions/${row.dir_name}/artifact/*`}
      style={{
        all: 'unset',
        display: 'block',
        cursor: 'pointer',
        width: '100%',
        padding: 'var(--space-2) var(--space-3)',
        borderBottom: '1px solid var(--hairline-soft)',
        background: active ? 'var(--surface-2)' : 'var(--canvas)',
        boxSizing: 'border-box',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--ink)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontWeight: 600, color: 'var(--ink-strong)' }}>{row.name}</span>
        {row.label && (
          <span style={{ color: 'var(--ink-muted)' }}>· {row.label}</span>
        )}
        <span style={{ flex: 1 }} />
        {row.scorecard?.aggregate !== undefined && (
          <span style={{ color: 'var(--ink-muted)' }}>
            {row.scorecard.aggregate.toFixed(1)} / 30
          </span>
        )}
        {row.scorecard?.verdict && (
          <span
            style={{
              fontSize: 9,
              padding: '1px 6px',
              borderRadius: 'var(--r-pill)',
              color: `var(--tone-${tone})`,
              border: `1px solid var(--tone-${tone})`,
              background: `color-mix(in oklab, var(--tone-${tone}) 12%, transparent)`,
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
            }}
          >
            {row.scorecard.verdict}
          </span>
        )}
      </div>
      <div style={{ color: 'var(--ink-tertiary)', fontSize: 10, marginBottom: 2 }}>
        released {row.released_at.replace('T', ' ').slice(0, 19)}
        {row.parent_version ? ` · parent ${row.parent_version}` : ''}
      </div>
      {row.goal && (
        <div
          style={{
            color: 'var(--ink-muted)',
            fontSize: 10,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {row.goal}
        </div>
      )}
      {sample.length > 0 && (
        <div
          style={{
            color: 'var(--ink-tertiary)',
            fontSize: 9,
            marginTop: 2,
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {sample.map(([path, sha]) => (
            <span key={path} title={`sha256 ${sha}`}>
              {path} · {sha.slice(0, 8)}…
            </span>
          ))}
          {row.artifacts_sha256 &&
            Object.keys(row.artifacts_sha256).length > sample.length && (
              <span>+{Object.keys(row.artifacts_sha256).length - sample.length} more</span>
            )}
        </div>
      )}
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
