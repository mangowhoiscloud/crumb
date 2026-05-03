/**
 * Output panel — iframe live render of session OR version artifacts.
 *
 * Per migration plan §6 + §14.6 + DESIGN.md §4. Source toggle (Session |
 * Version) follows the `outputSource` selection slice — M7 Versions panel
 * sets `mode: 'version'` on row click; switching session resets to live.
 *
 * Session mode  → /api/sessions/:id/artifact/* (live, via watcher snapshot)
 * Version mode  → /api/projects/:pid/versions/:dir/artifact/* (frozen)
 *
 * §8.1 quality bar: iframe sandboxed, empty / error states explicit, clear
 * source attribution in header so an evaluator never confuses a frozen
 * version preview for live builder output.
 */

import type { IDockviewPanelProps } from 'dockview-react';
import { useEffect, useMemo, useState } from 'react';
import { useActiveSession, useOutputSource } from '../stores/selection';
import { useTranscriptStream } from '../hooks/useTranscriptStream';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useSessions } from '../hooks/useSessions';

interface ArtifactsListResponse {
  files: Array<{ path: string; size: number }>;
}

export function Output(_props: IDockviewPanelProps) {
  const sessionId = useActiveSession();
  const outputSource = useOutputSource();
  const stream = useTranscriptStream(500);
  const sessions = useSessions();
  const [diskFiles, setDiskFiles] = useState<string[]>([]);
  const [diskError, setDiskError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  // Reset selection when source pointer changes — old `selected` may not
  // exist in the new artifact set.
  useEffect(() => {
    setSelected(null);
  }, [outputSource]);

  const isVersion = outputSource.mode === 'version';
  const projectId = isVersion ? outputSource.projectId : null;
  const versionDir = isVersion ? outputSource.versionDir : null;

  // Version mode reads artifacts_sha256 from the manifest — no disk listing
  // needed because frozen manifests are exhaustive.
  const versionsQ = useQuery({
    queryKey: ['projectVersions', projectId],
    queryFn: () => api.projectVersions(projectId!),
    enabled: !!projectId,
    staleTime: 30_000,
  });

  const versionPaths = useMemo<string[]>(() => {
    if (!isVersion) return [];
    const v = versionsQ.data?.versions.find((x) => x.dir_name === versionDir);
    return Object.keys(v?.artifacts_sha256 ?? {});
  }, [isVersion, versionsQ.data, versionDir]);

  // Collect session-mode artifact paths from transcript + disk fallback.
  const artifactsFromTranscript = useMemo(() => {
    const paths = new Set<string>();
    for (const e of stream.events) {
      const arr = (e as { artifacts?: Array<{ path?: string }> }).artifacts;
      if (Array.isArray(arr)) for (const a of arr) if (a.path) paths.add(a.path);
    }
    return Array.from(paths);
  }, [stream.events]);

  const allHtmlPaths = useMemo(() => {
    if (isVersion) return versionPaths.filter((p) => /\.html$/.test(p));
    const set = new Set<string>([...artifactsFromTranscript, ...diskFiles]);
    return Array.from(set).filter((p) => /\.html$/.test(p));
  }, [isVersion, versionPaths, artifactsFromTranscript, diskFiles]);

  // Disk fallback only in session mode — version manifests are exhaustive.
  useEffect(() => {
    if (!sessionId || isVersion) return;
    let cancelled = false;
    setDiskError(null);
    fetch(`/api/sessions/${encodeURIComponent(sessionId)}/artifacts/list`)
      .then((r) => (r.ok ? (r.json() as Promise<ArtifactsListResponse>) : null))
      .then((j) => {
        if (cancelled || !j) return;
        setDiskFiles(j.files.map((f) => f.path));
      })
      .catch((err: unknown) => {
        if (!cancelled) setDiskError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, isVersion, stream.events.length]);

  // Pick the renderable head: prefer index.html → game.html → first .html.
  const head = useMemo(() => {
    const idx = allHtmlPaths.find((p) => /(^|\/)index\.html$/.test(p));
    if (idx) return idx;
    const game = allHtmlPaths.find((p) => /(^|\/)game\.html$/.test(p));
    if (game) return game;
    return allHtmlPaths[0] ?? null;
  }, [allHtmlPaths]);

  useEffect(() => {
    if (head && !selected) setSelected(head);
  }, [head, selected]);

  if (!sessionId) return <Empty>Select a session in the sidebar.</Empty>;
  if (!head)
    return (
      <Empty>
        {isVersion
          ? `no HTML artifact in version ${versionDir}`
          : diskError
            ? `error: ${diskError}`
            : 'no HTML artifact found yet'}
      </Empty>
    );

  const target = selected ?? head;
  const rel = target.replace(/^artifacts\//, '');
  const encodedRel = rel.split('/').map(encodeURIComponent).join('/');
  // Resolve project id from sessions cache for session-mode legacy fallback.
  const sessionProjectId =
    sessions.data?.sessions.find((s) => s.session_id === sessionId)?.project_id ?? null;
  const iframeSrc = isVersion
    ? `/api/projects/${encodeURIComponent(projectId!)}/versions/${encodeURIComponent(
        versionDir!,
      )}/artifact/${encodedRel}`
    : `/api/sessions/${encodeURIComponent(sessionId)}/artifact/${encodedRel}`;
  const sourceLabel = isVersion
    ? `version · ${versionDir}`
    : `session · ${sessionProjectId ?? sessionId.slice(0, 10)}`;

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
          gap: 'var(--space-2)',
          alignItems: 'center',
        }}
      >
        <span
          title={isVersion ? 'frozen release artifact' : 'live session artifact'}
          style={{
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            padding: '2px 6px',
            borderRadius: 'var(--r-pill)',
            color: isVersion ? 'var(--accent-warm)' : 'var(--ink-muted)',
            border: `1px solid ${isVersion ? 'var(--accent-warm)' : 'var(--hairline)'}`,
            background: isVersion
              ? 'color-mix(in oklab, var(--accent-warm) 12%, transparent)'
              : 'var(--surface-1)',
          }}
        >
          {sourceLabel}
        </span>
        <select
          value={target}
          onChange={(e) => setSelected(e.target.value)}
          style={{
            flex: 1,
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            padding: '4px 8px',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--r-sm)',
            background: 'var(--canvas)',
            color: 'var(--ink)',
          }}
        >
          {allHtmlPaths.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <a
          href={iframeSrc}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 10,
            color: 'var(--ink-muted)',
            fontFamily: 'var(--font-mono)',
            textDecoration: 'none',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--r-sm)',
            padding: '3px 8px',
          }}
        >
          ↗ open
        </a>
      </div>
      <iframe
        title="artifact"
        src={iframeSrc}
        sandbox="allow-scripts allow-pointer-lock allow-same-origin"
        style={{
          flex: 1,
          width: '100%',
          border: 'none',
          background: 'var(--surface-card)',
        }}
      />
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
