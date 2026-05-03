/**
 * JsonlTail — cross-platform incremental tail of a JSONL file.
 *
 * Tracks byte offset between calls. Each pull():
 *   - reads from `offset` to current EOF,
 *   - splits on `\n`, keeps the trailing fragment buffered for next pull,
 *   - strips CRLF + UTF-8 BOM,
 *   - JSON.parse each complete line.
 *
 * Safe under append-only writes (the project's writer guarantees `O_APPEND`).
 * Truncate / rotate detection: if file size shrinks below `offset`, we reset to 0.
 *
 * No external dependency — works identically on macOS / Linux / Windows / WSL /
 * Docker bind-mounts / NFS because we only call fs.stat + fs.read, never watch.
 */

import { open, stat } from 'node:fs/promises';

import type { StudioMessage } from './types.js';

export class JsonlTail {
  private offset = 0;
  private fragment = '';

  constructor(private readonly path: string) {}

  async pull(): Promise<StudioMessage[]> {
    let size: number;
    try {
      size = (await stat(this.path)).size;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
    if (size < this.offset) {
      // truncate / rotate — restart from the top
      this.offset = 0;
      this.fragment = '';
    }
    if (size <= this.offset) return [];

    const fh = await open(this.path, 'r');
    try {
      const buf = Buffer.alloc(size - this.offset);
      await fh.read(buf, 0, buf.length, this.offset);
      this.offset = size;

      let text = this.fragment + buf.toString('utf8');
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

      const lastNewline = text.lastIndexOf('\n');
      const complete = lastNewline >= 0 ? text.slice(0, lastNewline) : '';
      this.fragment = lastNewline >= 0 ? text.slice(lastNewline + 1) : text;

      const out: StudioMessage[] = [];
      for (const rawLine of complete.split('\n')) {
        const line = rawLine.replace(/\r$/, '').trim();
        if (line.length === 0) continue;
        try {
          out.push(JSON.parse(line) as StudioMessage);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn(
            `[jsonl-tail] skip malformed line in ${this.path}: ${(err as Error).message}`,
          );
        }
      }
      return out;
    } finally {
      await fh.close();
    }
  }

  reset(): void {
    this.offset = 0;
    this.fragment = '';
  }
}
