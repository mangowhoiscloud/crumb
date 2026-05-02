/**
 * inbox.txt watcher — headless user-intervention surface (G2).
 *
 * Tails `sessions/<id>/inbox.txt` and converts each new line into a transcript
 * event via the existing TranscriptWriter. Mirrors the TUI's slash-command bar
 * so a user without a TUI can still pause / resume / approve / veto / target
 * actors mid-session by appending lines to a plain text file.
 *
 * Polling (not fs.watch) for cross-platform reliability — matches transcript
 * reader's pattern. Polls every 500ms by default. Tracks last-read offset so
 * a re-start picks up where it left off.
 *
 * See [[bagelcode-user-intervention-frontier-2026-05-02]] §"7 잔여 risk" — G2.
 * Sister of the TUI slash-command bar (`src/tui/app.ts`).
 */

import { existsSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import type { TranscriptWriter } from '../transcript/writer.js';
import { parseInboxLine } from './parser.js';

export interface InboxWatcherOptions {
  inboxPath: string;
  sessionId: string;
  writer: TranscriptWriter;
  /** Poll interval in ms. Default 500. */
  pollIntervalMs?: number;
  /** Optional logger for diagnostic output. Default: silent. */
  onError?: (err: Error) => void;
}

export interface InboxWatcherHandle {
  stop: () => void;
}

/** Start watching the inbox file. Creates it (empty) if absent. Returns a stop handle. */
export function startInboxWatcher(opts: InboxWatcherOptions): InboxWatcherHandle {
  const interval = opts.pollIntervalMs ?? 500;

  // Ensure the file exists so the user can simply `echo ... >> inbox.txt`.
  if (!existsSync(opts.inboxPath)) {
    writeFileSync(opts.inboxPath, '');
  }

  let lastSize = 0;
  let stopped = false;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      const stat = statSync(opts.inboxPath);
      if (stat.size > lastSize) {
        const buf = readFileSync(opts.inboxPath, 'utf-8');
        const newPart = buf.slice(lastSize);
        lastSize = stat.size;
        const lines = newPart.split('\n');
        // The last element is whatever's after the final newline. If the user
        // hasn't terminated their line yet, defer it — bump lastSize back so
        // we re-read it on the next tick.
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

  const handle = setInterval(() => {
    void tick();
  }, interval);

  // Run an immediate tick so existing pre-session content is processed once.
  void tick();

  return {
    stop: () => {
      stopped = true;
      clearInterval(handle);
    },
  };
}
