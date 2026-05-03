/**
 * M0 scaffold — React 19 root for the v2 Studio client.
 *
 * The only goal of M0 is to prove the bundle loads + the API is reachable.
 * Real layout (dockview + sidebar + scorecard) lands in M2/M3.
 *
 * The shell:
 *   1. Renders a "v2 preview" banner so anyone hitting `?app=v2` knows
 *      they're on the migration's preview build.
 *   2. Fetches `/api/sessions` once and dumps the count + first goal so
 *      we can verify the server route is wired.
 *   3. Subscribes to `/api/stream?session=*` SSE and shows the heartbeat
 *      timestamp so we can verify the live channel works end-to-end.
 *
 * No styling beyond minimal inline CSS — design tokens land in M2.
 */

import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

interface SessionsSnapshot {
  sessions: Array<{
    session_id: string;
    goal: string | null;
  }>;
}

function App() {
  const [snapshot, setSnapshot] = useState<SessionsSnapshot | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/sessions')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<SessionsSnapshot>;
      })
      .then((j) => {
        if (!cancelled) setSnapshot(j);
      })
      .catch((err: unknown) => {
        if (!cancelled) setSnapshotError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const es = new EventSource('/api/stream?session=*');
    es.addEventListener('heartbeat', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { ts?: string };
        if (data.ts) setLastHeartbeat(data.ts);
      } catch {
        /* malformed heartbeat — keep last known value */
      }
    });
    es.onerror = () => {
      setStreamError('SSE stream errored — server unreachable or restarted');
    };
    return () => {
      es.close();
    };
  }, []);

  return (
    <main style={{ padding: 32, fontFamily: 'system-ui, sans-serif', color: '#1a1a2e' }}>
      <h1 style={{ marginTop: 0 }}>Crumb Studio · v2 preview</h1>
      <p style={{ color: '#5a5a72' }}>
        M0 scaffold — Vite + React 19. This is the migration's preview build; the v1 vanilla bundle
        is still the default. Layout, panels, and styling land in M2 / M3.
      </p>

      <section style={{ marginTop: 24 }}>
        <h2>API · /api/sessions</h2>
        {snapshotError ? (
          <pre style={{ color: '#b91c1c' }}>error: {snapshotError}</pre>
        ) : snapshot ? (
          <pre>
            sessions: {snapshot.sessions.length}
            {'\n'}
            first goal: {snapshot.sessions[0]?.goal ?? '(none)'}
          </pre>
        ) : (
          <pre>loading…</pre>
        )}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>SSE · /api/stream</h2>
        {streamError ? (
          <pre style={{ color: '#b91c1c' }}>{streamError}</pre>
        ) : (
          <pre>last heartbeat: {lastHeartbeat ?? '(waiting…)'}</pre>
        )}
      </section>
    </main>
  );
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('M0 scaffold: #root not found in index.html');
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
