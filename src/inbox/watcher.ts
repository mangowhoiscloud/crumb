/**
 * inbox.txt watcher — headless user-intervention surface (G2).
 *
 * Tails `sessions/<id>/inbox.txt` and converts each new line into a transcript
 * event via the existing TranscriptWriter. Mirrors the TUI's slash-command bar
 * so a user without a TUI can still pause / resume / approve / veto / target
 * actors mid-session by appending lines to a plain text file.
 *
 * v0.4.3 PR-I-A — switched the detection backbone from `setInterval(150ms)` to
 * `chokidar` (FSEvents on macOS / inotify on Linux / ReadDirectoryChangesW on
 * Windows). Detection latency drops from 0-150ms to typically <10ms. The
 * existing offset-tracked read loop is preserved verbatim — the only change is
 * who *triggers* the read. Polling fallback is auto-engaged via
 * `usePolling` for environments where fs events are unreliable (WSL, NFS).
 *
 * See [[bagelcode-user-intervention-frontier-2026-05-02]] §"7 잔여 risk" — G2.
 * Sister of the TUI slash-command bar (`src/tui/app.ts`).
 */

import { existsSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import chokidar from 'chokidar';
import type { TranscriptWriter } from '../transcript/writer.js';
import { parseInboxLine } from './parser.js';

export interface InboxWatcherOptions {
  inboxPath: string;
  sessionId: string;
  writer: TranscriptWriter;
  /**
   * Poll interval in ms. Default 150 (chokidar polling fallback / test mode).
   * When chokidar's fs-event backend is active this value is unused — events
   * fire as soon as the OS notifies us. Tests pass small values to keep the
   * watcher snappy under fake timers without flaking.
   */
  pollIntervalMs?: number;
  /**
   * Force polling instead of fs events. Auto-detected from environment in
   * production (`shouldPoll()` from packages/studio/src/poll-detect.ts is the
   * canonical source); tests pass `true` to keep behavior deterministic.
   */
  usePolling?: boolean;
  /** Optional logger for diagnostic output. Default: silent. */
  onError?: (err: Error) => void;
}

export interface InboxWatcherHandle {
  stop: () => Promise<void>;
}

/** Start watching the inbox file. Creates it (empty) if absent. */
export function startInboxWatcher(opts: InboxWatcherOptions): InboxWatcherHandle {
  // Ensure the file exists so the user can simply `echo ... >> inbox.txt`.
  if (!existsSync(opts.inboxPath)) {
    writeFileSync(opts.inboxPath, '');
  }

  let lastSize = 0;
  let stopped = false;
  let ticking = false;
  // dirty=true means a fs event arrived while we were already draining.
  // After the current drain finishes we re-tick to catch the missed bytes.
  // Without this, chokidar coalescing two rapid appends (e.g. user pastes
  // multi-line block, or studio direct-write + echo back-to-back) into a
  // single 'change' callback could lose the second batch.
  let dirty = false;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    if (ticking) {
      dirty = true;
      return;
    }
    ticking = true;
    try {
      // Drain in a loop until no more bytes arrive — this collapses any
      // dirty-flag re-entries into one continuous read so events never
      // pile up in the user's mental model ("input goes in then nothing
      // happens for 5s then a flood appears").
      // eslint-disable-next-line no-constant-condition
      while (true) {
        dirty = false;
        try {
          const stat = statSync(opts.inboxPath);
          if (stat.size > lastSize) {
            const buf = readFileSync(opts.inboxPath, 'utf-8');
            const newPart = buf.slice(lastSize);
            lastSize = stat.size;
            const lines = newPart.split('\n');
            // Trailing un-terminated line gets re-read next tick.
            const trailing = lines[lines.length - 1];
            if (trailing && !newPart.endsWith('\n')) {
              lastSize -= Buffer.byteLength(trailing, 'utf-8');
              lines.pop();
            }
            for (const line of lines) {
              const draft = parseInboxLine(line, opts.sessionId);
              if (draft) {
                await opts.writer.append(draft);
              }
            }
          } else if (stat.size < lastSize) {
            // File was truncated/replaced — start over from byte 0.
            lastSize = 0;
          }
        } catch (err) {
          opts.onError?.(err as Error);
        }
        if (!dirty) break;
      }
    } finally {
      ticking = false;
    }
  };

  // chokidar tracks the file directly. `add` fires once at startup (we tick
  // immediately to drain pre-existing content), `change` fires on every
  // append (sub-10ms via inotify/FSEvents). awaitWriteFinish coalesces
  // editor-style multi-write saves into one event without losing latency
  // for the simple `appendFile`/`echo >>` case.
  const watcher = chokidar.watch(opts.inboxPath, {
    persistent: true,
    ignoreInitial: false,
    usePolling: opts.usePolling ?? false,
    interval: opts.pollIntervalMs ?? 150,
    awaitWriteFinish: { stabilityThreshold: 25, pollInterval: 10 },
  });
  watcher.on('add', () => {
    void tick();
  });
  watcher.on('change', () => {
    void tick();
  });
  watcher.on('error', (err) => opts.onError?.(err as Error));

  // Drain any pre-existing content once. chokidar's `add` covers this on
  // most platforms but firing tick() immediately costs nothing and removes
  // a race on first-launch when the file already had content from a prior
  // session (e.g. user typed before `crumb run` finished bootstrapping).
  void tick();

  return {
    stop: async () => {
      stopped = true;
      await watcher.close();
    },
  };
}
