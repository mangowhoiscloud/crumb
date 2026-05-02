/**
 * HTTP + SSE server for the Crumb live dashboard.
 *
 * Read endpoints:
 *   GET  /                              → dashboard HTML
 *   GET  /api/sessions                  → JSON snapshot, project-grouped
 *   GET  /api/sessions/:id/sandwich/:actor → assembled sandwich text (read-only)
 *   GET  /api/stream?session=<id|*>     → SSE stream of LiveEvents
 *
 * v3.4 console mode — bidirectional write endpoint:
 *   POST /api/sessions/:id/inbox        body=`{ line: "<inbox-grammar-line>" }`
 *                                       → appends one line to <session>/inbox.txt
 *                                       → existing inbox watcher converts to transcript event
 *
 * Inbox grammar examples:
 *   "/approve"                          — promote PARTIAL to PASS
 *   "/veto <reason>"                    — reject latest verdict
 *   "/pause [@<actor>] [reason]"        — pause global or per-actor
 *   "/resume [@<actor>]"                — resume
 *   "/goto <actor> [body]"              — force next_speaker
 *   "/append [@<actor>] <text>"         — sandwich_append
 *   "/note <text>"                      — recorded constraint
 *   "/redo [body]"                      — re-emit last spawn
 *   "@<actor> <body>"                   — free-text mention
 *   "<plain text>"                      — generic user.intervene
 *
 * Heartbeat every 15s on the SSE connection prevents proxy timeouts.
 *
 * Cross-platform: pure node:http, no platform-specific syscalls beyond what
 * SessionWatcher already abstracts via chokidar.
 */

import { appendFile, readFile, readdir, stat } from 'node:fs/promises';
import http from 'node:http';
import { join } from 'node:path';
import { URL } from 'node:url';
import { watch as fsWatch, createReadStream } from 'node:fs';

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
    if (req.method === 'GET' && url.pathname === '/') return serveHtml(res);
    if (req.method === 'GET' && url.pathname === '/api/sessions') {
      return serveSessions(res, watcher);
    }
    if (req.method === 'GET' && url.pathname === '/api/stream') {
      return serveStream(req, res, url, bus);
    }
    // /api/sessions/:id/sandwich/:actor (GET — read sandwich)
    const sandwichMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/sandwich\/([^/]+)$/);
    if (req.method === 'GET' && sandwichMatch) {
      return serveSandwich(res, watcher, sandwichMatch[1]!, sandwichMatch[2]!);
    }
    // /api/sessions/:id/inbox (POST — write user line to <session>/inbox.txt)
    const inboxMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/inbox$/);
    if (req.method === 'POST' && inboxMatch) {
      return void serveInboxAppend(req, res, watcher, inboxMatch[1]!);
    }
    // /api/sessions/:id/logs/:actor (GET — full log snapshot, all spawn-*.log files concatenated)
    const logsMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/logs\/([^/]+)$/);
    if (req.method === 'GET' && logsMatch) {
      return void serveActorLogs(res, watcher, logsMatch[1]!, logsMatch[2]!);
    }
    // /api/sessions/:id/logs/:actor/stream (GET — SSE live tail of <actor>'s newest spawn log)
    const logsStreamMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/logs\/([^/]+)\/stream$/);
    if (req.method === 'GET' && logsStreamMatch) {
      return void serveActorLogsStream(req, res, watcher, logsStreamMatch[1]!, logsStreamMatch[2]!);
    }
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

async function serveInboxAppend(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  watcher: SessionWatcher,
  sessionId: string,
): Promise<void> {
  const match = watcher.snapshot().find((s) => s.session_id === sessionId);
  if (!match) {
    res.statusCode = 404;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end(`session not found: ${sessionId}`);
    return;
  }
  // Read body (cap at 8 KB so a runaway client can't OOM the dashboard).
  const chunks: Buffer[] = [];
  let total = 0;
  const MAX_BYTES = 8192;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    total += buf.length;
    if (total > MAX_BYTES) {
      res.statusCode = 413;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end(`payload too large (>${MAX_BYTES}B)`);
      return;
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  let line: string;
  try {
    const body = JSON.parse(raw) as { line?: unknown };
    if (typeof body.line !== 'string' || body.line.trim().length === 0) {
      res.statusCode = 400;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end('body must be {"line": "<non-empty string>"}');
      return;
    }
    line = body.line.replace(/\r?\n/g, ' ').trim();
  } catch {
    res.statusCode = 400;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('invalid JSON body');
    return;
  }
  if (line.length > MAX_BYTES) {
    res.statusCode = 413;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('line too long');
    return;
  }
  // Append to <session>/inbox.txt — the existing inbox watcher (src/inbox/
  // watcher.ts) parses it via the same grammar as the TUI slash bar and
  // emits the corresponding kind=user.* / user.intervene transcript events.
  // The dashboard never touches transcript.jsonl directly — append-only
  // invariant + single-writer-per-process stay intact.
  const sessionDir = sessionDirFromTranscript(match.transcript_path);
  const inboxPath = join(sessionDir, 'inbox.txt');
  try {
    await appendFile(inboxPath, line + '\n', 'utf8');
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end(`inbox append failed: ${(err as Error).message}`);
    return;
  }
  res.statusCode = 202; // accepted; the watcher will surface the resulting events via SSE
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ ok: true, inbox_path: inboxPath, line }));
}

/**
 * Resolve <session>/agent-workspace/<actor>/ and list spawn-*.log files
 * (sorted, newest last). Used by both the snapshot + stream endpoints.
 */
async function findActorLogFiles(
  watcher: SessionWatcher,
  sessionId: string,
  actor: string,
): Promise<{ dir: string; files: string[] } | null> {
  const match = watcher.snapshot().find((s) => s.session_id === sessionId);
  if (!match) return null;
  if (!/^[a-z0-9-]+$/i.test(actor)) return null;
  const sessionDir = sessionDirFromTranscript(match.transcript_path);
  const dir = join(sessionDir, 'agent-workspace', actor);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return { dir, files: [] };
  }
  const files = entries.filter((f) => f.startsWith('spawn-') && f.endsWith('.log')).sort();
  return { dir, files };
}

async function serveActorLogs(
  res: http.ServerResponse,
  watcher: SessionWatcher,
  sessionId: string,
  actor: string,
): Promise<void> {
  const found = await findActorLogFiles(watcher, sessionId, actor);
  if (!found) {
    res.statusCode = 404;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end(`session or actor not found: ${sessionId}/${actor}`);
    return;
  }
  if (found.files.length === 0) {
    res.statusCode = 200;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.setHeader('cache-control', 'no-cache');
    res.end(`(no spawn log yet for ${actor} in this session)`);
    return;
  }
  // Concatenate all spawn logs newest-last so the dashboard sees natural order.
  const parts: string[] = [];
  for (const f of found.files) {
    try {
      const content = await readFile(join(found.dir, f), 'utf8');
      parts.push(`╭── ${f} ──╮\n${content}\n`);
    } catch {
      // skip unreadable file
    }
  }
  res.statusCode = 200;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.setHeader('cache-control', 'no-cache');
  res.end(parts.join('\n'));
}

async function serveActorLogsStream(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  watcher: SessionWatcher,
  sessionId: string,
  actor: string,
): Promise<void> {
  const found = await findActorLogFiles(watcher, sessionId, actor);
  if (!found) {
    res.statusCode = 404;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end(`session or actor not found: ${sessionId}/${actor}`);
    return;
  }
  res.setHeader('content-type', 'text/event-stream');
  res.setHeader('cache-control', 'no-cache, no-transform');
  res.setHeader('connection', 'keep-alive');
  res.setHeader('x-accel-buffering', 'no');

  let closed = false;
  const send = (event: string, data: unknown): void => {
    if (closed) return;
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {
      closed = true;
    }
  };

  // Pick the newest log file as the live target. New spawns will create new
  // files; we re-resolve every time chokidar fires `add` on the parent dir.
  let currentFile: string | null = null;
  let currentSize = 0;

  const sendChunkSince = async (file: string, fromOffset: number): Promise<number> => {
    try {
      const stats = await stat(join(found.dir, file));
      if (stats.size <= fromOffset) return fromOffset;
      const stream = createReadStream(join(found.dir, file), {
        encoding: 'utf8',
        start: fromOffset,
        end: stats.size - 1,
      });
      let buf = '';
      for await (const chunk of stream) buf += chunk;
      if (buf.length > 0) send('chunk', { file, text: buf });
      return stats.size;
    } catch {
      return fromOffset;
    }
  };

  const refresh = async (): Promise<void> => {
    const refound = await findActorLogFiles(watcher, sessionId, actor);
    if (!refound || refound.files.length === 0) return;
    const newest = refound.files[refound.files.length - 1]!;
    if (newest !== currentFile) {
      // Switched to a newer spawn — reset offset and announce.
      currentFile = newest;
      currentSize = 0;
      send('rotate', { file: newest });
    }
    currentSize = await sendChunkSince(newest, currentSize);
  };

  // Initial heartbeat + first refresh.
  send('heartbeat', { ts: new Date().toISOString() });
  await refresh();

  // chokidar is overkill here — a small fs.watch on the actor dir + 500ms
  // poll fallback covers WSL / NFS the same way the main watcher does.
  let watcher_handle: ReturnType<typeof fsWatch> | null = null;
  try {
    watcher_handle = fsWatch(found.dir, { persistent: false }, () => {
      void refresh();
    });
  } catch {
    // dir doesn't exist yet — polling-only path covers it.
  }
  const poll = setInterval(() => {
    void refresh();
  }, 500);
  const heartbeat = setInterval(() => {
    send('heartbeat', { ts: new Date().toISOString() });
  }, 15_000);

  const cleanup = (): void => {
    closed = true;
    clearInterval(poll);
    clearInterval(heartbeat);
    if (watcher_handle) {
      try {
        watcher_handle.close();
      } catch {
        // ignore
      }
    }
  };
  req.on('close', cleanup);
  req.on('error', cleanup);
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
