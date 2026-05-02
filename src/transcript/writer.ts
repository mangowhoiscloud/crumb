/**
 * Transcript writer — append-only JSONL with ULID + ISO-8601 ts injection.
 *
 * Concurrency policy (v3 S15 persistence boost — see [[bagelcode-system-architecture-v3]] §"S15"):
 *   - **Single-writer-per-process** is enforced via Promise chain serialization. JS-level
 *     interleaving is impossible because every append() awaits the previous one.
 *   - **Cross-process atomicity** rides on POSIX O_APPEND: writes ≤ PIPE_BUF (4096 bytes on
 *     Linux, 512 on macOS) are atomic at the kernel level. Crumb messages are well within
 *     PIPE_BUF for the typical message body, so concurrent process appends don't interleave
 *     mid-line.
 *   - **Multi-writer race protection (P1)**: if message bodies grow beyond PIPE_BUF (large
 *     CourtEval reasoning bodies, or multi-builder parallel writes), the writer can be
 *     upgraded to use `flock(fd, 'ex')` via the `fs-ext` package. P0 keeps the simpler
 *     Promise-chain-only path because Crumb's actor model is sequential by default
 *     (parallel-dispatch preset is P1).
 *   - Coordinator + subprocess agents both go through this writer (subprocesses via
 *     `crumb event` CLI), so single-writer-per-process is sufficient for the default
 *     bagelcode-cross-3way preset where actors run sequentially.
 *
 * Adapter session-id policy: when a subprocess agent emits via `crumb event`, the parent
 * harness (Claude Code / Codex / Gemini) propagates its native session id through env
 * (CRUMB_ADAPTER_SESSION_ID). The adapter writes this into msg.metadata.adapter_session_id
 * so the next spawn can use --resume <sid> for cache carry-over. See preset.actors[*]
 * binding spec in `.crumb/presets/*.toml`.
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
