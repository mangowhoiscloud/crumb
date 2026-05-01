/**
 * Transcript reader — full read + tail (poll).
 * Uses fs.watch + position tracking instead of chokidar for the walking skeleton
 * to keep the dep tree small; chokidar is reserved for cross-platform inbox watch.
 */

import { open, readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';

import type { Message } from '../protocol/types.js';

export async function readAll(path: string): Promise<Message[]> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
  return raw
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as Message);
}

export interface TailHandle {
  close: () => void;
}

/**
 * Tail a transcript. Calls `onMessage` for every new line appended after `fromOffset`.
 * `fromOffset` defaults to current file size — pass 0 to replay from start.
 */
export async function tail(
  path: string,
  onMessage: (msg: Message) => void | Promise<void>,
  opts: { fromOffset?: number } = {},
): Promise<TailHandle> {
  let pos = opts.fromOffset ?? (await safeSize(path));
  let pending: Promise<void> = Promise.resolve();
  let closed = false;

  const drain = async (): Promise<void> => {
    if (closed) return;
    const size = await safeSize(path);
    if (size <= pos) return;
    const fh = await open(path, 'r');
    try {
      const buf = Buffer.alloc(size - pos);
      await fh.read(buf, 0, buf.length, pos);
      pos = size;
      const lines = buf.toString('utf8').split('\n');
      for (const line of lines) {
        if (line.trim().length === 0) continue;
        const msg = JSON.parse(line) as Message;
        await onMessage(msg);
      }
    } finally {
      await fh.close();
    }
  };

  const schedule = (): void => {
    pending = pending.then(drain).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[tail] drain error:', err);
    });
  };

  // Initial drain in case file already grew between offset capture and watch start.
  schedule();

  const watcher = watch(path, { persistent: false }, () => schedule());

  return {
    close: () => {
      closed = true;
      watcher.close();
    },
  };
}

async function safeSize(path: string): Promise<number> {
  try {
    return (await stat(path)).size;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw e;
  }
}
