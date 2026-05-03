/**
 * SessionWatcher — chokidar over `<crumbHome>/projects/*\/sessions/*\/transcript.jsonl`.
 *
 * Cross-platform via chokidar's polling fallback (toggled by shouldPoll()).
 * Each file gets a JsonlTail; chokidar 'change' events trigger a pull.
 *
 * Discovery: chokidar 'add' events fire both for files present at start
 * (because ignoreInitial=false) AND for new sessions appearing later — we
 * treat both identically.
 */

import { readFile } from 'node:fs/promises';

import chokidar, { type FSWatcher } from 'chokidar';

import {
  classifyFromMtime,
  classifySessionState,
  type SessionClassification,
} from './bootstrap.js';
import type { EventBus } from './event-bus.js';
import { JsonlTail } from './jsonl-tail.js';
import {
  crumbHomeFromPath,
  defaultTranscriptGlob,
  defaultTranscriptGlobs,
  projectIdFromPath,
  sessionIdFromPath,
} from './paths.js';
import { shouldPoll } from './poll-detect.js';
import type { StudioMessage } from './types.js';
import { computeMetrics } from './metrics.js';

interface PerSession {
  tail: JsonlTail;
  startEmitted: boolean;
  history: StudioMessage[];
}

export interface WatcherOptions {
  /** Single transcript glob — legacy single-home form. Use `globs` for v0.3.1 multi-home. */
  glob?: string;
  /**
   * v0.3.1: chokidar accepts an array of globs. Set when watching multiple
   * Crumb homes simultaneously (e.g. `~/.crumb` + `/tmp/test-home`). When
   * neither `glob` nor `globs` is set, falls back to `defaultTranscriptGlobs()`
   * which walks every entry from `CRUMB_HOMES` / `CRUMB_HOME`.
   */
  globs?: string[];
  pollInterval?: number;
}

export class SessionWatcher {
  private watcher: FSWatcher | null = null;
  private readonly sessions = new Map<string, PerSession>();

  constructor(
    private readonly bus: EventBus,
    private readonly opts: WatcherOptions = {},
  ) {}

  async start(): Promise<void> {
    // Precedence: explicit `globs` array → legacy single `glob` → multi-home
    // default (one glob per active CRUMB_HOMES entry, falling back to
    // CRUMB_HOME or $HOME/.crumb when CRUMB_HOMES is unset).
    const watchTarget: string | string[] = this.opts.globs
      ? this.opts.globs
      : (this.opts.glob ??
        (defaultTranscriptGlobs().length > 1 ? defaultTranscriptGlobs() : defaultTranscriptGlob()));
    const polling = shouldPoll();
    this.watcher = chokidar.watch(watchTarget, {
      usePolling: polling,
      interval: this.opts.pollInterval ?? 250,
      binaryInterval: 1000,
      awaitWriteFinish: false,
      alwaysStat: false,
      ignoreInitial: false,
    });

    this.watcher.on('add', (path) => {
      void this.handleChange(path);
    });
    this.watcher.on('change', (path) => {
      void this.handleChange(path);
    });
    this.watcher.on('unlink', (path) => {
      this.sessions.delete(path);
    });

    await new Promise<void>((resolve, reject) => {
      this.watcher!.once('ready', () => resolve());
      this.watcher!.once('error', (err) => reject(err));
    });
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.sessions.clear();
  }

  trackedPaths(): string[] {
    return [...this.sessions.keys()];
  }

  /** Snapshot of all sessions' history — used by the HTTP /api/sessions endpoint. */
  snapshot(): Array<{
    session_id: string;
    project_id: string;
    crumb_home: string;
    transcript_path: string;
    history: StudioMessage[];
  }> {
    return [...this.sessions.entries()].map(([path, s]) => ({
      session_id: sessionIdFromPath(path),
      project_id: projectIdFromPath(path),
      crumb_home: crumbHomeFromPath(path),
      transcript_path: path,
      history: s.history,
    }));
  }

  /**
   * Async snapshot with state classification. One stat() per session — kept on
   * the /api/sessions slow path so the synchronous `snapshot()` for SSE replay
   * stays cheap.
   */
  async classifiedSnapshot(): Promise<
    Array<{
      session_id: string;
      project_id: string;
      crumb_home: string;
      transcript_path: string;
      history: StudioMessage[];
      classification: SessionClassification | null;
    }>
  > {
    const entries = [...this.sessions.entries()];
    return Promise.all(
      entries.map(async ([path, s]) => {
        const classification = await classifySessionState(path, s.history).catch(() => null);
        return {
          session_id: sessionIdFromPath(path),
          project_id: projectIdFromPath(path),
          crumb_home: crumbHomeFromPath(path),
          transcript_path: path,
          history: s.history,
          classification,
        };
      }),
    );
  }

  private getOrCreate(path: string): PerSession {
    let s = this.sessions.get(path);
    if (!s) {
      s = { tail: new JsonlTail(path), startEmitted: false, history: [] };
      this.sessions.set(path, s);
    }
    return s;
  }

  private async handleChange(path: string): Promise<void> {
    const s = this.getOrCreate(path);
    let messages: StudioMessage[];
    try {
      messages = await s.tail.pull();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[watcher] tail error on ${path}:`, (err as Error).message);
      return;
    }
    if (!s.startEmitted) {
      const sessionId = sessionIdFromPath(path);
      const meta = await peekSessionStart(path).catch(() => null);
      this.bus.publish({
        type: 'session_start',
        session_id: sessionId,
        project_id: projectIdFromPath(path),
        goal: meta?.goal ?? null,
        preset: meta?.preset ?? null,
      });
      s.startEmitted = true;
    }
    if (messages.length === 0) return;
    s.history.push(...messages);
    let publishedSessionId: string | null = null;
    for (const msg of messages) {
      this.bus.publish({ type: 'append', session_id: msg.session_id, msg });
      publishedSessionId = msg.session_id;
    }
    // Republish derived metrics + lifecycle classification once per change
    // batch. classifyFromMtime is pure (no fs syscall) — chokidar already
    // ensured the file changed, so Date.now() is a fine proxy for the new
    // mtime. The fresh lifecycle lets the client transition the header pill
    // and sidebar dot in real time without waiting for the next /api/sessions
    // poll. Datadog live tail / OTel GenAI span lifecycle convention.
    if (publishedSessionId) {
      const lifecycle = classifyFromMtime(Date.now(), s.history);
      this.bus.publish({
        type: 'state',
        session_id: publishedSessionId,
        metrics: computeMetrics(s.history),
        lifecycle: {
          state: lifecycle.state,
          last_activity_at: lifecycle.last_activity_at,
          ...(lifecycle.done_reason ? { done_reason: lifecycle.done_reason } : {}),
        },
      });
    }
  }
}

interface SessionStartHints {
  goal: string | null;
  preset: string | null;
}

async function peekSessionStart(path: string): Promise<SessionStartHints> {
  let goal: string | null = null;
  let preset: string | null = null;
  try {
    const raw = await readFile(path, 'utf8');
    const lines = raw.split('\n').slice(0, 30);
    for (const rawLine of lines) {
      const line = rawLine.replace(/\r$/, '').trim();
      if (line.length === 0) continue;
      let evt: StudioMessage;
      try {
        evt = JSON.parse(line) as StudioMessage;
      } catch {
        continue;
      }
      if (evt.kind === 'goal' && !goal) goal = evt.body ?? null;
      if (evt.kind === 'session.start') {
        const data = (evt.data ?? {}) as Record<string, unknown>;
        if (typeof data.preset === 'string') preset = data.preset;
      }
      if (goal && preset) break;
    }
  } catch {
    // ignore
  }
  return { goal, preset };
}
