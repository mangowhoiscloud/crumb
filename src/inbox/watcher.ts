/**
 * inbox.txt watcher — headless user-intervention surface (G2).
 *
 * Tails `sessions/<id>/inbox.txt` and converts each new line into a transcript
 * event via the existing TranscriptWriter. Mirrors the TUI's slash-command bar
 * so a user without a TUI can still pause / resume / approve / veto / target
 * actors mid-session by appending lines to a plain text file.
 *
 * v0.4.2 — chokidar fs-event push (was setInterval polling). Studio's
 * `packages/studio/src/watcher.ts` already uses chokidar for the
 * transcript-fanout direction; this watcher now mirrors that on the inbox
 * direction, so latency drops from ~150ms (poll) to <10ms (FSEvents/inotify
 * push) on macOS/Linux. WSL/NFS/Docker fall back to interval polling via the
 * `CRUMB_POLL=1` override (mirrors `packages/studio/src/poll-detect.ts`).
 *
 * The previous polling comment ("matches transcript reader's pattern") was
 * stale — the transcript reader is on chokidar, not setInterval — so the
 * inbox watcher is now consistent with it.
 *
 * See [[bagelcode-user-intervention-frontier-2026-05-02]] §"7 잔여 risk" — G2.
 * Sister of the TUI slash-command bar (`src/tui/app.ts`).
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import chokidar, { type FSWatcher } from 'chokidar';
import type { TranscriptWriter } from '../transcript/writer.js';
import { parseInboxLine } from './parser.js';

export interface InboxWatcherOptions {
  inboxPath: string;
  sessionId: string;
  writer: TranscriptWriter;
  /**
   * Polling interval in ms. When set, forces chokidar's `usePolling: true`
   * with this `interval`. When undefined (production default), chokidar uses
   * native fs events (FSEvents/inotify/ReadDirectoryChangesW) with a polling
   * fallback only when `CRUMB_POLL=1` or WSL is detected.
   *
   * Tests pass small values (e.g. 25) to keep test wall-clock low; production
   * leaves it undefined for sub-10ms native-event latency.
   */
  pollIntervalMs?: number;
  /** Optional logger for diagnostic output. Default: silent. */
  onError?: (err: Error) => void;
}

export interface InboxWatcherHandle {
  /** Stop the watcher. Fire-and-forget — chokidar's close runs in the background. */
  stop: () => void;
}

/** Decide chokidar polling vs native fs events. Mirrors `packages/studio/src/poll-detect.ts`. */
function shouldPollInbox(): boolean {
  const env = process.env.CRUMB_POLL;
  if (env === '1' || env === 'true') return true;
  if (env === '0' || env === 'false') return false;
  if (process.platform === 'linux') {
    try {
      const proc = readFileSync('/proc/version', 'utf8').toLowerCase();
      if (proc.includes('microsoft') || proc.includes('wsl')) return true;
    } catch {
      // /proc/version unreadable — fall through to native
    }
  }
  return false;
}

/** Start watching the inbox file. Creates it (empty) if absent. Returns a stop handle. */
export function startInboxWatcher(opts: InboxWatcherOptions): InboxWatcherHandle {
  // Ensure the file exists so the user (or Studio) can simply `echo ... >> inbox.txt`.
  if (!existsSync(opts.inboxPath)) {
    writeFileSync(opts.inboxPath, '');
  }

  let lastSize = 0;
  let stopped = false;
  let draining: Promise<void> = Promise.resolve();

  const drain = async (): Promise<void> => {
    if (stopped) return;
    try {
      const stat = statSync(opts.inboxPath);
      if (stat.size > lastSize) {
        // `lastSize` and `stat.size` are byte counts. Read as Buffer and
        // slice by bytes — slicing a JS string by `lastSize` would index
        // UTF-16 code units instead, which truncates incorrectly when
        // earlier lines contain multi-byte characters (e.g. Korean: each
        // char is 3 bytes in UTF-8 / 1 code unit in UTF-16, so a Korean
        // line shifts the byte/char correspondence by 2 per character).
        const fullBuf = readFileSync(opts.inboxPath);
        const newBuf = fullBuf.subarray(lastSize);
        lastSize = stat.size;
        const newPart = newBuf.toString('utf-8');
        const lines = newPart.split('\n');
        // The last element is whatever's after the final newline. If the user
        // hasn't terminated their line yet, defer it — bump lastSize back so
        // we re-read it on the next event.
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
        // File was truncated/replaced — start over.
        lastSize = 0;
      }
    } catch (err) {
      opts.onError?.(err as Error);
    }
  };

  // Serialize drain runs so two close-together fs events don't race the
  // lastSize bookkeeping. chokidar fires on every write, which is exactly
  // what we want — a single line shows up within a few ms of the appendFile
  // returning to Studio's POST handler.
  const schedule = (): void => {
    draining = draining.then(drain);
  };

  const usePolling = opts.pollIntervalMs !== undefined || shouldPollInbox();
  const watcher: FSWatcher = chokidar.watch(opts.inboxPath, {
    persistent: true,
    awaitWriteFinish: false,
    ignoreInitial: true, // we run an explicit initial drain below
    usePolling,
    // Tests force usePolling via pollIntervalMs; production leaves it native.
    interval: opts.pollIntervalMs ?? 250,
  });
  watcher.on('add', schedule);
  watcher.on('change', schedule);
  watcher.on('error', (err: unknown) => {
    opts.onError?.(err instanceof Error ? err : new Error(String(err)));
  });

  // Immediate drain so any existing pre-session content is processed once.
  schedule();

  return {
    stop: (): void => {
      stopped = true;
      void watcher.close();
    },
  };
}
