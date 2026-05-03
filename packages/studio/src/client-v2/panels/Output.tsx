/**
 * Output panel — iframe live render of session artifacts.
 *
 * Per migration plan §6 + DESIGN.md §4. Loads artifact list via
 * /api/sessions/:id/artifacts/list, picks the renderable head
 * (index.html → game.html → first .html), serves via
 * /api/sessions/:id/artifact/* in a sandboxed iframe.
 *
 * §8.1 quality bar: iframe sandboxed (`allow-scripts allow-same-origin`),
 * empty state when no HTML artifact exists, error state when fetch fails.
 */

import type { IDockviewPanelProps } from 'dockview-react';
import { useEffect, useMemo, useState } from 'react';
import { useActiveSession } from '../stores/selection';
import { useTranscriptStream } from '../hooks/useTranscriptStream';

interface ArtifactsListResponse {
  files: Array<{ path: string; size: number }>;
}

export function Output(_props: IDockviewPanelProps) {
  const sessionId = useActiveSession();
  const stream = useTranscriptStream(500);
  const [diskFiles, setDiskFiles] = useState<string[]>([]);
  const [diskError, setDiskError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  // Collect artifact paths from transcript + disk fallback.
  const artifactsFromTranscript = useMemo(() => {
    const paths = new Set<string>();
    for (const e of stream.events) {
      const arr = (e as { artifacts?: Array<{ path?: string }> }).artifacts;
      if (Array.isArray(arr)) for (const a of arr) if (a.path) paths.add(a.path);
    }
    return Array.from(paths);
  }, [stream.events]);

  const allHtmlPaths = useMemo(() => {
    const set = new Set<string>([...artifactsFromTranscript, ...diskFiles]);
    return Array.from(set).filter((p) => /\.html$/.test(p));
  }, [artifactsFromTranscript, diskFiles]);

  // Disk fallback when transcript hasn't surfaced artifacts yet.
  useEffect(() => {
    if (!sessionId) return;
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
  }, [sessionId, stream.events.length]);

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
    return <Empty>{diskError ? `error: ${diskError}` : 'no HTML artifact found yet'}</Empty>;

  const target = selected ?? head;
  const rel = target.replace(/^artifacts\//, '');
  const iframeSrc = `/api/sessions/${encodeURIComponent(sessionId)}/artifact/${rel
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;

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
