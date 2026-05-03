/**
 * HTTP + SSE server for the Crumb live studio.
 *
 * Read endpoints:
 *   GET  /                              → studio HTML
 *   GET  /api/sessions                  → JSON snapshot, project-grouped
 *   GET  /api/sessions/:id/sandwich/:actor → assembled sandwich text (read-only)
 *   GET  /api/stream?session=<id|*>     → SSE stream of LiveEvents
 *
 * v0.3.1 console mode — bidirectional write endpoint:
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

import { STUDIO_HTML } from './studio-html.js';
import { probeAdapters } from './doctor.js';
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
  /** v0.3.1: multi-home transcript globs. Takes precedence over `glob`. */
  globs?: string[];
  pollInterval?: number;
  /**
   * Crumb repository root for `crumb run` invocations from POST /api/crumb/run.
   * Defaults to `process.cwd()` when omitted (typical CLI usage). Tests pass a
   * tmpdir to keep filesystem effects isolated.
   */
  repoRoot?: string;
}

export async function startStudioServer(
  opts: DashboardServerOptions = {},
): Promise<DashboardServer> {
  const bind = opts.bind ?? '127.0.0.1';
  const requestedPort = opts.port ?? 7321;
  const repoRoot = opts.repoRoot ?? process.cwd();
  // Sessions the user dismissed via the sidebar × button. The transcript on
  // disk is untouched (read-only invariant); /api/sessions filters them out
  // until the studio restarts. Volatile-by-design — there's no notion of
  // "session deleted" in the on-disk model.
  const hiddenSessions = new Set<string>();

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
      return void serveSessions(res, watcher, hiddenSessions);
    }
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return void serveHealth(res, watcher, hiddenSessions);
    }
    if (req.method === 'GET' && url.pathname === '/api/doctor') {
      return void serveDoctor(res);
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
    // /api/sessions/:id/artifacts/list (GET — disk listing fallback for the
    // Output tab when builder skipped emitting kind=artifact.created)
    const artifactsListMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/artifacts\/list$/);
    if (req.method === 'GET' && artifactsListMatch) {
      return void serveArtifactsList(res, watcher, artifactsListMatch[1]!);
    }
    // /api/sessions/:id/artifact/* (GET — serve any file under <session>/artifacts/ for iframe)
    const artifactMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/artifact\/(.+)$/);
    if (req.method === 'GET' && artifactMatch) {
      return void serveArtifactFile(res, watcher, artifactMatch[1]!, artifactMatch[2]!);
    }
    // /api/crumb/run (POST — spawn `crumb run --goal <text>` as a child process)
    if (req.method === 'POST' && url.pathname === '/api/crumb/run') {
      return void serveCrumbRun(req, res, repoRoot);
    }
    // /api/sessions/:id/close (POST — mark studio-side hidden; transcript is never deleted)
    const closeMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/close$/);
    if (req.method === 'POST' && closeMatch) {
      return void serveSessionClose(res, hiddenSessions, closeMatch[1]!);
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
  res.end(STUDIO_HTML);
}

async function serveSessions(
  res: http.ServerResponse,
  watcher: SessionWatcher,
  hiddenSessions: Set<string>,
): Promise<void> {
  const classified = await watcher.classifiedSnapshot();
  const visible = classified.filter((s) => !hiddenSessions.has(s.session_id));
  const sessions = visible.map(
    ({ session_id, project_id, crumb_home, transcript_path, history, classification }) => {
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
        // Track actors that actually ran so the studio can offer sandwich previews.
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
        // v0.3.5: state + last_activity_at for sidebar dot color + sort.
        state: classification?.state ?? null,
        last_activity_at: classification?.last_activity_at ?? null,
        done_reason: classification?.done_reason ?? null,
        history,
      };
    },
  );
  // Newest activity first — turns the sidebar into a recently-active feed.
  sessions.sort((a, b) => (b.last_activity_at ?? 0) - (a.last_activity_at ?? 0));
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-cache');
  res.end(JSON.stringify({ sessions }));
}

/**
 * GET /api/health — bootstrap summary.
 *
 *   { studio_version, watcher_paths_tracked, sessions: { total, by_state: {...} } }
 *
 * Pattern: Kubernetes readiness probe — separates one-shot bootstrap data from
 * the periodic state polling done by /api/sessions. Cheap (no syscalls beyond
 * what classifiedSnapshot already pays).
 */
async function serveHealth(
  res: http.ServerResponse,
  watcher: SessionWatcher,
  hiddenSessions: Set<string>,
): Promise<void> {
  const classified = await watcher.classifiedSnapshot();
  const visible = classified.filter((s) => !hiddenSessions.has(s.session_id));
  const byState: Record<string, number> = {
    live: 0,
    idle: 0,
    interrupted: 0,
    abandoned: 0,
    terminal: 0,
    unknown: 0,
  };
  for (const s of visible) {
    const k = s.classification?.state ?? 'unknown';
    byState[k] = (byState[k] ?? 0) + 1;
  }
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-cache');
  res.end(
    JSON.stringify({
      ok: true,
      watcher_paths_tracked: watcher.trackedPaths().length,
      sessions: {
        total: visible.length,
        by_state: byState,
      },
    }),
  );
}

/**
 * GET /api/doctor — adapter probe matrix.
 *
 *   { adapters: [{ id, display_name, installed, authenticated, version, models, ... }] }
 *
 * Lightweight: PATH lookup + best-effort `--version`. Auth state intentionally
 * `null` for installed binaries since real auth probe would risk side-effects.
 * Mirrors src/helpers/doctor.ts of the crumb repo but standalone — see
 * `packages/studio/src/doctor.ts`.
 */
async function serveDoctor(res: http.ServerResponse): Promise<void> {
  const adapters = await probeAdapters();
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-cache');
  res.end(JSON.stringify({ adapters }));
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
  // Read body (cap at 8 KB so a runaway client can't OOM the studio).
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
  // The studio never touches transcript.jsonl directly — append-only
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
  // Concatenate all spawn logs newest-last so the studio sees natural order.
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

// ─── v0.3.5 console — artifact iframe + crumb run / close ────────────────────

/**
 * Serve any file under <session>/artifacts/ for the studio's Output tab.
 * Resolves to the session dir + 'artifacts' + relative path with traversal
 * protection (resolved path must remain inside the session's artifacts root).
 */
async function serveArtifactFile(
  res: http.ServerResponse,
  watcher: SessionWatcher,
  sessionId: string,
  relPath: string,
): Promise<void> {
  const match = watcher.snapshot().find((s) => s.session_id === sessionId);
  if (!match) {
    res.statusCode = 404;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end(`session not found: ${sessionId}`);
    return;
  }
  if (relPath.includes('..') || relPath.startsWith('/')) {
    res.statusCode = 400;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('invalid path');
    return;
  }
  const sessionDir = sessionDirFromTranscript(match.transcript_path);
  const artifactsRoot = join(sessionDir, 'artifacts');
  const decoded = decodeURIComponent(relPath);
  const target = join(artifactsRoot, decoded);
  if (!target.startsWith(artifactsRoot)) {
    res.statusCode = 400;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('path escapes artifacts/');
    return;
  }
  try {
    const buf = await readFile(target);
    const ext = decoded.split('.').pop()?.toLowerCase() ?? '';
    const contentType =
      ext === 'html'
        ? 'text/html; charset=utf-8'
        : ext === 'js' || ext === 'mjs'
          ? 'application/javascript; charset=utf-8'
          : ext === 'css'
            ? 'text/css; charset=utf-8'
            : ext === 'json' || ext === 'webmanifest'
              ? 'application/json; charset=utf-8'
              : ext === 'svg'
                ? 'image/svg+xml'
                : ext === 'png'
                  ? 'image/png'
                  : ext === 'jpg' || ext === 'jpeg'
                    ? 'image/jpeg'
                    : ext === 'md'
                      ? 'text/markdown; charset=utf-8'
                      : 'application/octet-stream';
    res.setHeader('content-type', contentType);
    res.setHeader('cache-control', 'no-cache');
    res.end(buf);
  } catch {
    res.statusCode = 404;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end(`artifact not found: ${decoded}`);
  }
}

/**
 * POST /api/crumb/run — spawn `npx tsx src/index.ts run --goal <text>`.
 */
async function serveCrumbRun(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  repoRoot: string,
): Promise<void> {
  const chunks: Buffer[] = [];
  let total = 0;
  const MAX_BYTES = 8192;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    total += buf.length;
    if (total > MAX_BYTES) {
      res.statusCode = 413;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end('payload too large');
      return;
    }
    chunks.push(buf);
  }
  let goal: string;
  let preset: string | undefined;
  let adapter: string | undefined;
  let videoRefs: string[] | undefined;
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
      goal?: unknown;
      preset?: unknown;
      adapter?: unknown;
      video_refs?: unknown;
    };
    if (typeof body.goal !== 'string' || body.goal.trim().length === 0) {
      res.statusCode = 400;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end('body must be {"goal": "<non-empty>"}');
      return;
    }
    goal = body.goal.trim();
    if (typeof body.preset === 'string' && body.preset.length > 0) preset = body.preset;
    if (typeof body.adapter === 'string' && body.adapter.length > 0) adapter = body.adapter;
    // v0.4: video_refs — array of YouTube URLs / sandboxed local paths. The
    // studio toggle "Video research (Gemini)" exposes this; only honored when
    // gemini-sdk OR gemini-cli-local is installed (the toggle hides
    // otherwise). Server passes through as `--video-refs <csv>` to crumb run.
    if (Array.isArray(body.video_refs)) {
      videoRefs = body.video_refs
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map((v) => v.trim());
      if (videoRefs.length === 0) videoRefs = undefined;
    }
  } catch {
    res.statusCode = 400;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('invalid JSON body');
    return;
  }

  // Pre-spawn adapter health gate. The studio form lets the user pick an
  // adapter, but if its binary is missing or auth is gone the runtime burns
  // 5-15s before exit 1 and trips the circuit-breaker for nothing. Refuse the
  // launch up front so the modal can prompt the user to fix install/auth or
  // pick a different adapter.
  if (adapter && adapter !== 'mock') {
    const adapters = await probeAdapters();
    const target = adapters.find((a) => a.id === adapter);
    if (!target?.installed) {
      res.statusCode = 409;
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          ok: false,
          error: 'adapter_unavailable',
          adapter,
          reason: target ? 'binary not installed' : `unknown adapter id: ${adapter}`,
          install_hint: target?.install_hint,
          auth_hint: target?.auth_hint,
          available: adapters.filter((a) => a.installed).map((a) => a.id),
        }),
      );
      return;
    }
  }

  const { spawn } = await import('node:child_process');
  const args = ['tsx', 'src/index.ts', 'run', '--goal', goal];
  if (preset) args.push('--preset', preset);
  if (adapter) args.push('--adapter', adapter);
  if (videoRefs && videoRefs.length > 0) args.push('--video-refs', videoRefs.join(','));
  const child = spawn('npx', args, { cwd: repoRoot, detached: true, stdio: 'ignore' });
  child.unref();

  res.statusCode = 202;
  res.setHeader('content-type', 'application/json');
  res.end(
    JSON.stringify({
      ok: true,
      pid: child.pid,
      goal,
      preset: preset ?? null,
      adapter: adapter ?? null,
      video_refs: videoRefs ?? null,
    }),
  );
}

/**
 * POST /api/sessions/:id/close — studio-side hide (volatile).
 */
function serveSessionClose(
  res: http.ServerResponse,
  hiddenSessions: Set<string>,
  sessionId: string,
): void {
  hiddenSessions.add(sessionId);
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ ok: true, hidden: sessionId }));
}

/**
 * v0.3.5 — disk listing fallback for the Output tab. Walks <session>/artifacts/
 * recursively and returns relative paths + sizes. Used when builder skipped
 * emitting kind=artifact.created (LLMs sometimes do; the artifact still exists
 * on disk because the file was actually written).
 *
 * Limited to artifacts/ root — never escapes. Recursion bounded at depth 6 +
 * 200 entries to keep the response cheap.
 */
async function serveArtifactsList(
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
  const sessionDir = sessionDirFromTranscript(match.transcript_path);
  const artifactsRoot = join(sessionDir, 'artifacts');
  const out: Array<{ path: string; size: number }> = [];
  const MAX_ENTRIES = 200;
  const MAX_DEPTH = 6;
  async function walk(dir: string, relPrefix: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH || out.length >= MAX_ENTRIES) return;
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (out.length >= MAX_ENTRIES) return;
      const full = join(dir, name);
      let st: Awaited<ReturnType<typeof stat>>;
      try {
        st = await stat(full);
      } catch {
        continue;
      }
      const rel = relPrefix ? relPrefix + '/' + name : name;
      if (st.isDirectory()) {
        await walk(full, rel, depth + 1);
      } else if (st.isFile()) {
        out.push({ path: 'artifacts/' + rel, size: st.size });
      }
    }
  }
  await walk(artifactsRoot, '', 0);
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-cache');
  res.end(JSON.stringify({ session_id: sessionId, root: 'artifacts/', files: out }));
}
