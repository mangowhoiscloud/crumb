/**
 * Adapter interface — wraps a single CLI provider (claude-local, codex-local, ...).
 * The adapter knows how to spawn the agent with the right sandwich + sandbox flags.
 */

import type { Actor } from '../protocol/types.js';

/**
 * Normalized progress event surfaced by adapters when the underlying CLI
 * emits stream-json. Keeps the dispatcher provider-agnostic — each adapter
 * maps its CLI's vocabulary onto this shape.
 */
export interface ProgressEvent {
  /** What kind of step the agent is taking. */
  kind: 'tool_use' | 'tool_result' | 'message_delta' | 'thinking' | 'system';
  /** Tool name (Read / Write / Bash / Edit / TodoWrite / ...). Optional for non-tool events. */
  tool?: string;
  /** Short summary suitable for the studio strip — e.g. "Write artifacts/game/index.html". ≤ 200 chars. */
  summary: string;
  /** Optional path the tool touched. */
  path?: string;
  /** Wall-clock at emit (ms since spawn start). Adapters compute when forwarding. */
  elapsed_ms?: number;
}

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
   * Optional model identifier from preset / config.toml binding. When set,
   * adapters that support `--model` / `-m` style flags pass it through.
   * codex-local: `--model <id>`. claude-local / gemini-local: not exposed by
   * the `-p` / non-interactive surface (API-only) — the field is informational
   * for those adapters until SDK adapters land.
   */
  model?: string;
  /**
   * Optional reasoning effort from preset / config.toml binding.
   * Mapped to provider-specific spawn params at the adapter boundary:
   *   codex-local : -c model_reasoning_effort=<low|medium|high>
   *   claude-local: API-only (extended thinking budget_tokens 8K/24K/64K) —
   *                 not exposed by `claude -p`, kept informational
   *   gemini-local: API-only (thinking_config) — same constraint
   * See `mapEffort()` in `src/config/model-config.ts` for the canonical mapping.
   */
  effort?: 'low' | 'med' | 'high';
  /**
   * Optional cancellation signal. The dispatcher sets a per-spawn timeout
   * (autoresearch P3 budget guardrail; default 15 min wall-clock + 90 s idle,
   * see wiki/concepts/bagelcode-budget-guardrails.md §"per_spawn_timeout"). On
   * abort, the adapter MUST send SIGTERM to the underlying CLI subprocess so
   * the per-spawn budget is enforced even when the agent stalls. Adapters
   * should treat an aborted spawn as a hard exit (non-zero exit code) so the
   * reducer's error branch trips the circuit breaker.
   */
  signal?: AbortSignal;
  /**
   * Optional activity ping. Adapters call this on every stdout chunk so the
   * dispatcher can distinguish a busy spawn from a stalled one. The dispatcher
   * uses it to reset its idle timer (see `perSpawnIdleTimeoutMs` in
   * DispatcherDeps). Adapters that don't surface chunk-level activity simply
   * omit the call — the spawn then falls back to wall-clock-only timeout.
   */
  onStdoutActivity?: () => void;
  /**
   * Optional raw stdout chunk sink. Adapters call this with every Buffer
   * received from the child's stdout — the dispatcher uses it to live-tail
   * the spawn log into `<session>/agent-workspace/<actor>/spawn-*.log`
   * while the spawn is still running, so the studio's Logs tab can stream
   * progress instead of seeing an empty file until the spawn exits.
   */
  onStdoutChunk?: (buf: Buffer) => void;
  /** Optional raw stderr chunk sink. Same lifecycle as `onStdoutChunk`. */
  onStderrChunk?: (buf: Buffer) => void;
  /**
   * Optional progress callback. Adapters parse their CLI's stream-json
   * output (claude-local: `--output-format stream-json`, codex-local:
   * `experimental_json`, gemini-local: `--show-progress` events) into a
   * normalized shape and forward each tool_use / write / progress notice.
   * The dispatcher emits these as `kind=tool.call` so the studio can render
   * a real-time per-step strip — without this, the user only sees one
   * `agent.wake` and then 200s of silence until the actor stops.
   */
  onProgress?: (evt: ProgressEvent) => void;
  /**
   * Optional provider id for the actor's preset binding ('anthropic',
   * 'openai', 'google', 'none'). Forwarded into the subprocess env as
   * CRUMB_PROVIDER so `crumb event` can stamp `metadata.provider` and
   * compute `metadata.cross_provider` on `kind=judge.score`. AGENTS.md §136
   * invariant ("Set metadata.cross_provider=true when verifier provider
   * differs from build event provider").
   */
  provider?: string;
  /**
   * Optional provider id of the latest `kind=build` event's emitter. Set by
   * the dispatcher when spawning the verifier so the subprocess can stamp
   * `metadata.cross_provider = (provider !== builderProvider)` on its
   * judge.score. Anti-deception Rule 4 input.
   */
  builderProvider?: string;
  /**
   * Optional harness id for the actor's preset binding ('claude-code',
   * 'codex', 'gemini-cli', 'gemini-sdk', 'mock', etc). Forwarded as
   * CRUMB_HARNESS so `crumb event` can stamp `metadata.harness`.
   * AGENTS.md §135 invariant ("Every emitted message sets metadata.harness +
   * provider + model per the active preset binding").
   */
  harness?: string;
  /**
   * Optional path to a pre-built minimal-context judge-input bundle.
   * Set by the dispatcher only when spawning the verifier; forwarded as
   * `CRUMB_JUDGE_INPUT_PATH` so the verifier sandwich reads the bundle
   * instead of the full transcript. Hard isolation against planner
   * reasoning / prior judge.score / agent.thought_summary leakage. See
   * [[bagelcode-verifier-context-isolation-2026-05-03]] + ComplexEval
   * Bench EMNLP 2025 Findings §805 + Preference Leakage ICLR 2026.
   */
  judgeInputPath?: string;
}

export interface SpawnResult {
  exitCode: number;
  /** Stdout captured from the subprocess (may be empty if streamed). */
  stdout: string;
  /** Stderr — surfaced into kind=error if non-zero exit. */
  stderr: string;
  durationMs: number;
  /**
   * Token usage parsed from the subprocess output (when --output-format
   * stream-json or json is used, the CLIs emit a final usage block). Adapters
   * that can't recover usage (text mode, mock) leave this undefined; the
   * dispatcher then writes only `latency_ms` into the agent.stop metadata.
   */
  usage?: {
    tokens_in?: number;
    tokens_out?: number;
    cache_read?: number;
    cache_write?: number;
    cost_usd?: number;
    model?: string;
  };
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
