/**
 * Transcript writer — append-only JSONL with ULID + ISO-8601 ts injection.
 *
 * Concurrency: O_APPEND on POSIX gives atomicity for writes <= PIPE_BUF (4096 bytes
 * on Linux, 512 on macOS); we serialize writes per process via a Promise chain so
 * that multiple async appends don't interleave at the JS level. Cross-process
 * locking is out of scope for the walking skeleton — Coordinator and subprocesses
 * write to disjoint files (subprocesses use `crumb event` which goes through here).
 */

import { appendFile } from 'node:fs/promises';
import { ulid } from 'ulid';

import type { DraftMessage, Message } from '../protocol/types.js';
import { prepareValidator, validateMessageSync } from '../protocol/validate.js';

export interface WriterOptions {
  path: string;
  sessionId: string;
}

export class TranscriptWriter {
  private chain: Promise<void> = Promise.resolve();
  private prepared = false;

  constructor(private readonly opts: WriterOptions) {}

  /** Validate + assign id/ts + append a single message. Returns the canonical Message. */
  async append(draft: DraftMessage): Promise<Message> {
    if (!this.prepared) {
      await prepareValidator();
      this.prepared = true;
    }
    const msg: Message = {
      ...draft,
      id: draft.id ?? ulid(),
      ts: draft.ts ?? new Date().toISOString(),
      session_id: draft.session_id ?? this.opts.sessionId,
    };
    validateMessageSync(msg);
    const line = JSON.stringify(msg) + '\n';
    this.chain = this.chain.then(() => appendFile(this.opts.path, line, 'utf8'));
    await this.chain;
    return msg;
  }
}
