/**
 * Adapter interface — wraps a single CLI provider (claude-local, codex-local, ...).
 * The adapter knows how to spawn the agent with the right sandwich + sandbox flags.
 */

import type { Actor } from '../protocol/types.js';

export interface SpawnRequest {
  actor: Actor;
  sessionDir: string;
  /** Path to the sandwich file (system prompt). */
  sandwichPath: string;
  /** First-turn prompt (e.g. the user goal). May be empty for follow-ups. */
  prompt?: string;
  /** Where the agent should append transcript events (passed via env). */
  transcriptPath: string;
  sessionId: string;
  /**
   * Optional cancellation signal. The dispatcher sets a per-spawn timeout
   * (autoresearch P3 budget guardrail; default 5min, see
   * wiki/concepts/bagelcode-budget-guardrails.md §"per_spawn_timeout"). On
   * abort, the adapter MUST send SIGTERM to the underlying CLI subprocess so
   * the per-spawn budget is enforced even when the agent stalls. Adapters
   * should treat an aborted spawn as a hard exit (non-zero exit code) so the
   * reducer's error branch trips the circuit breaker.
   */
  signal?: AbortSignal;
}

export interface SpawnResult {
  exitCode: number;
  /** Stdout captured from the subprocess (may be empty if streamed). */
  stdout: string;
  /** Stderr — surfaced into kind=error if non-zero exit. */
  stderr: string;
  durationMs: number;
}

export interface Adapter {
  /** Identifier used in routing decisions (matches presets/*.toml). */
  readonly id: string;
  /** Verify the underlying CLI is installed + authenticated. */
  health(): Promise<{ ok: boolean; reason?: string }>;
  /** Spawn the agent. Caller is responsible for tailing the transcript for new events. */
  spawn(req: SpawnRequest): Promise<SpawnResult>;
}

export class AdapterRegistry {
  private adapters = new Map<string, Adapter>();

  register(a: Adapter): void {
    this.adapters.set(a.id, a);
  }

  get(id: string): Adapter {
    const a = this.adapters.get(id);
    if (!a) throw new Error(`unknown adapter: ${id}`);
    return a;
  }

  has(id: string): boolean {
    return this.adapters.has(id);
  }
}
