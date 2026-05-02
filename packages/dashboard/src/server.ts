/**
 * HTTP + SSE server for the Crumb live dashboard.
 *
 * Endpoints:
 *   GET  /                              → dashboard HTML
 *   GET  /api/sessions                  → JSON snapshot, project-grouped
 *   GET  /api/sessions/:id/sandwich/:actor
 *                                       → assembled sandwich text (read-only)
 *   GET  /api/stream?session=<id|*>     → SSE stream of LiveEvents
 *
 * Heartbeat every 15s on the SSE connection prevents proxy timeouts.
 *
 * Cross-platform: pure node:http, no platform-specific syscalls beyond what
 * SessionWatcher already abstracts via chokidar.
 */

import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { URL } from 'node:url';

import { DASHBOARD_HTML } from './dashboard-html.js';
import { EventBus, type LiveEvent } from './event-bus.js';
import { computeMetrics } from './metrics.js';
import { sandwichPath, sessionDirFromTranscript } from './paths.js';
import { SessionWatcher } from './watcher.js';

const HEARTBEAT_MS = 15_000;

export interface DashboardServer {
  port: number;
  bind: string;
  url: string;
  close(): Promise<void>;
}

export interface DashboardServerOptions {
  port?: number;
  bind?: string; // '127.0.0.1' (default) or '0.0.0.0'
  glob?: string; // legacy single-home glob (test fixture)
  /** v3.4: multi-home transcript globs. Takes precedence over `glob`. */
  globs?: string[];
  pollInterval?: number;
}

export async function startDashboardServer(
  opts: DashboardServerOptions = {},
): Promise<DashboardServer> {
  const bind = opts.bind ?? '127.0.0.1';
  const requestedPort = opts.port ?? 7321;

  const bus = new EventBus();
  const watcher = new SessionWatcher(bus, {
    ...(opts.globs !== undefined ? { globs: opts.globs } : {}),
    ...(opts.glob !== undefined ? { glob: opts.glob } : {}),
    ...(opts.pollInterval !== undefined ? { pollInterval: opts.pollInterval } : {}),
  });
  await watcher.start();

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? bind}`);
    if (url.pathname === '/') return serveHtml(res);
    if (url.pathname === '/api/sessions') return serveSessions(res, watcher);
    if (url.pathname === '/api/stream') return serveStream(req, res, url, bus);
    // /api/sessions/:id/sandwich/:actor
    const sandwichMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/sandwich\/([^/]+)$/);
    if (sandwichMatch) return serveSandwich(res, watcher, sandwichMatch[1]!, sandwichMatch[2]!);
    res.statusCode = 404;
    res.end('not found');
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(requestedPort, bind, () => resolve());
  });

  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : requestedPort;
  const url = `http://${bind === '0.0.0.0' ? 'localhost' : bind}:${port}/`;

  return {
    port,
    bind,
    url,
    close: async () => {
      await watcher.stop();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

function serveHtml(res: http.ServerResponse): void {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-cache');
  res.end(DASHBOARD_HTML);
}

function serveSessions(res: http.ServerResponse, watcher: SessionWatcher): void {
  const snapshot = watcher.snapshot();
  const sessions = snapshot.map(
    ({ session_id, project_id, crumb_home, transcript_path, history }) => {
      const metrics = computeMetrics(history);
      let goal: string | null = null;
      let preset: string | null = null;
      const actorsSeen = new Set<string>();
      for (const m of history) {
        if (m.kind === 'goal' && !goal) goal = m.body ?? null;
        if (m.kind === 'session.start' && !preset) {
          const data = (m.data ?? {}) as Record<string, unknown>;
          if (typeof data.preset === 'string') preset = data.preset;
        }
        // Track actors that actually ran so the dashboard can offer sandwich previews.
        if (m.kind === 'agent.wake' && m.from) actorsSeen.add(m.from);
      }
      return {
        session_id,
        project_id,
        crumb_home,
        transcript_path,
        goal,
        preset,
        metrics,
        actors: [...actorsSeen],
        history,
      };
    },
  );
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-cache');
  res.end(JSON.stringify({ sessions }));
}

async function serveSandwich(
  res: http.ServerResponse,
  watcher: SessionWatcher,
  sessionId: string,
  actor: string,
): Promise<void> {
  // Find the transcript path for this session via the watcher's snapshot.
  const match = watcher.snapshot().find((s) => s.session_id === sessionId);
  if (!match) {
    res.statusCode = 404;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end(`session not found: ${sessionId}`);
    return;
  }
  // Constrain actor name to prevent path traversal — alphanumeric + hyphen only.
  if (!/^[a-z0-9-]+$/i.test(actor)) {
    res.statusCode = 400;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end(`invalid actor name: ${actor}`);
    return;
  }
  const sessionDir = sessionDirFromTranscript(match.transcript_path);
  const path = sandwichPath(sessionDir, actor);
  try {
    const content = await readFile(path, 'utf8');
    res.setHeader('content-type', 'text/markdown; charset=utf-8');
    res.setHeader('cache-control', 'no-cache');
    res.end(content);
  } catch {
    res.statusCode = 404;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end(`sandwich not assembled for ${actor} yet (no spawn this session)`);
  }
}

function serveStream(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  bus: EventBus,
): void {
  const sessionFilter = url.searchParams.get('session') ?? '*';
  res.setHeader('content-type', 'text/event-stream');
  res.setHeader('cache-control', 'no-cache, no-transform');
  res.setHeader('connection', 'keep-alive');
  res.setHeader('x-accel-buffering', 'no'); // disable nginx buffering
  // No flushHeaders() — http server flushes on first write.

  let closed = false;
  const write = (evt: LiveEvent): void => {
    if (closed) return;
    try {
      res.write(`event: ${evt.type}\n`);
      res.write(`data: ${JSON.stringify(evt)}\n\n`);
    } catch {
      closed = true;
    }
  };

  const filter = sessionFilter === '*' ? '*' : sessionFilter;
  const unsubscribe = bus.subscribe(filter, write);

  // Initial heartbeat so EventSource confirms connection.
  write({ type: 'heartbeat', ts: new Date().toISOString() });

  const heartbeat = setInterval(() => {
    write({ type: 'heartbeat', ts: new Date().toISOString() });
  }, HEARTBEAT_MS);

  const cleanup = (): void => {
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
  };
  req.on('close', cleanup);
  req.on('error', cleanup);
}
