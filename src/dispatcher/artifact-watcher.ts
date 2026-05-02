/**
 * artifact-watcher — filesystem-driven artifact.created emitter.
 *
 * Watches `<sessionDir>/artifacts/**` and emits `kind=artifact.created` on
 * every new file. The schema already has `artifact.created` (builder is
 * supposed to call `crumb event` for each file it writes), but in practice
 * the LLM batches them at the end of a turn or skips them entirely. The FS
 * watcher is the **ground truth**: a file appearing in the bundle dir is
 * proof of progress regardless of what the LLM remembered to emit.
 *
 * Studio polls the transcript and renders the resulting events as a
 * progress strip — the user sees `index.html`, `manifest.webmanifest`,
 * `sw.js`, `src/...` arrive one by one in real time.
 *
 * Dedup: if the builder also emits `artifact.created` for the same path with
 * the same sha256 within a short window, the dispatcher relies on the
 * studio's repeat-badge collapse (PR-F D) instead of suppressing here.
 * That keeps the watcher pure (no transcript reads) and lets observers see
 * which actor "owned" each emit.
 *
 * Excluded: control files (`transcript.jsonl`, `meta.json`, `inbox.txt`),
 * dotfiles, the `agent-workspace/` subtree (sandwich.assembled.md noise),
 * `ledgers/`, and the watcher's own `artifacts/exports/` directory (those
 * are post-export deliverables, not in-flight progress).
 */

import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { relative } from 'node:path';

import chokidar from 'chokidar';

import type { TranscriptWriter } from '../transcript/writer.js';

export interface ArtifactWatcherOptions {
  sessionDir: string;
  sessionId: string;
  writer: TranscriptWriter;
  /** Emitted as `from` field. Defaults to `system` so the validator treats it as deterministic. */
  from?: 'system' | 'builder';
  /** Optional logger for diagnostic errors. */
  onError?: (err: Error) => void;
}

export interface ArtifactWatcherHandle {
  close: () => Promise<void>;
}

/**
 * Start watching the session's artifacts directory. Returns a handle whose
 * `close()` stops the watcher. Safe to call before the artifacts dir exists
 * (chokidar tolerates missing paths and will pick up the dir on creation).
 */
export function startArtifactWatcher(opts: ArtifactWatcherOptions): ArtifactWatcherHandle {
  const watchRoot = `${opts.sessionDir.replace(/\/$/, '')}/artifacts`;
  const watcher = chokidar.watch(watchRoot, {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    // Skip control files, dotfiles, and the export subtree. The agent-workspace
    // tree lives at sessionDir/agent-workspace/ — already outside artifacts/.
    ignored: [/(^|\/)\..+/, /\/exports\//],
  });

  const seen = new Set<string>();

  const handle = (path: string): void => {
    if (seen.has(path)) return;
    seen.add(path);
    let size = 0;
    let sha256 = '';
    try {
      const buf = readFileSync(path);
      size = buf.byteLength;
      sha256 = createHash('sha256').update(buf).digest('hex');
    } catch (err) {
      // File vanished before we could hash it — race with builder writing
      // and immediately deleting (rare). Drop silently.
      opts.onError?.(err as Error);
      return;
    }
    const rel = relative(opts.sessionDir, path);
    void opts.writer
      .append({
        session_id: opts.sessionId,
        from: opts.from ?? 'system',
        kind: 'artifact.created',
        body: rel,
        data: { path: rel, size, sha256 },
        metadata: {
          visibility: 'public',
          deterministic: true,
          tool: 'artifact-watcher@v1',
        },
      })
      .catch((err: Error) => opts.onError?.(err));
  };

  watcher.on('add', handle);
  watcher.on('change', (path) => {
    // Treat changes the same as adds for visibility — but only if the file
    // actually changed (sha256 different from cached). The simpler path:
    // remove from `seen` and let the next add re-fire. That deliberately
    // makes "edit-in-place" appear as a fresh artifact event.
    seen.delete(path);
    try {
      statSync(path); // re-trigger via add handler
      handle(path);
    } catch (err) {
      opts.onError?.(err as Error);
    }
  });
  watcher.on('error', (err) => opts.onError?.(err as Error));

  return {
    close: async () => {
      await watcher.close();
    },
  };
}
