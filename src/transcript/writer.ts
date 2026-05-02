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
 * Adapter session-id policy (forward-compat — not yet wired): the schema fields
 * `metadata.adapter_session_id` and `metadata.cache_carry_over` exist so the
 * dispatcher can eventually pass `--resume <sid>` to the underlying CLI for
 * Anthropic prompt-cache carry-over across spawns. As of v3.4 no adapter
 * captures or consumes these fields; every spawn starts a fresh CLI session
 * and the system-prompt prefix is re-uploaded. See preset.actors[*] binding
 * spec in `.crumb/presets/*.toml`.
 */

import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
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

/**
 * Process-wide path-keyed registry. The single-writer-per-process invariant
 * (see file header) only holds if there is exactly one TranscriptWriter for a
 * given transcript path inside this process. With two instances each maintains
 * its own Promise chain, so two parallel append() calls race at the OS level
 * (cross-process atomicity via O_APPEND still protects against torn writes
 * but the JS-level ordering guarantee is lost).
 *
 * Production code (coordinator + tui + cli + mock adapter) all share the same
 * file in some configurations (e.g. TUI launched against a live coordinator
 * session). Use `getTranscriptWriter` from those call sites; tests that want
 * isolated instances may still call `new TranscriptWriter` directly.
 */
const writerRegistry = new Map<string, TranscriptWriter>();

export function getTranscriptWriter(opts: WriterOptions): TranscriptWriter {
  const key = resolve(opts.path);
  let w = writerRegistry.get(key);
  if (!w) {
    w = new TranscriptWriter(opts);
    writerRegistry.set(key, w);
  }
  return w;
}

/** Test helper — clears the registry between test cases. */
export function _resetWriterRegistryForTests(): void {
  writerRegistry.clear();
}
