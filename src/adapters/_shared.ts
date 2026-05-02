/**
 * Shared subprocess-adapter helpers — extracted from claude-local /
 * codex-local / gemini-local where the same 4 patterns were duplicated 3×
 * (jscpd flagged 414 duplicated lines / 2.92% across the three files).
 *
 * Frontier rationale: SWE-Bench Pro (arXiv 2509.16941) shows files-touched
 * scales 11× from Easy → Hard task difficulty. A coordinated change to the
 * spawn lifecycle (e.g., adding a new env var) previously required editing
 * 3 files in lockstep. Consolidating to one shared module + 3 thin adapters
 * collapses the fan-out cost.
 *
 * Each helper has zero CLI-specific knowledge — flag construction stays in
 * the adapter (or in adapter-local builders like buildCodexArgs).
 */

import { spawn, type ChildProcess } from 'node:child_process';

import type { ProgressEvent, SpawnRequest } from './types.js';

/**
 * Default action-oriented kickoff prompt — used when the dispatcher passes
 * no explicit prompt (typical for goal → planner-lead, spec → builder,
 * qa.result → verifier, etc., where the actor's job is fully described by
 * the sandwich).
 *
 * Why this specific text: "Continue your role per the system prompt." (the
 * v0.3.0 first attempt) sometimes produced "awaiting input" stalls — Claude
 * treated it as a status check and emitted "Planner-lead spawn ready.
 * Awaiting kind=goal input..." instead of acting on the transcript. Naming
 * the transcript file + telling the actor to execute the next step removes
 * that ambiguity. Verified across all 3 local adapters.
 */
export const DEFAULT_SPAWN_PROMPT =
  'Begin your turn now. Read $CRUMB_TRANSCRIPT_PATH for full context (latest goal, spec, qa.result, etc.) and execute the next step per the system prompt. Do not wait for additional input.';

/** Pick req.prompt if non-empty, else DEFAULT_SPAWN_PROMPT. */
export function resolvePrompt(req: SpawnRequest): string {
  return req.prompt && req.prompt.trim().length > 0 ? req.prompt : DEFAULT_SPAWN_PROMPT;
}

/**
 * Build the env object passed to spawned subprocesses. Layers CRUMB_*
 * convention vars (transcript path / session id / session dir / actor) on
 * top of the parent process env. Identical across all 3 local adapters.
 */
export function buildAdapterEnv(req: SpawnRequest): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CRUMB_TRANSCRIPT_PATH: req.transcriptPath,
    CRUMB_SESSION_ID: req.sessionId,
    CRUMB_SESSION_DIR: req.sessionDir,
    CRUMB_ACTOR: req.actor,
    // v0.3.1: forward binding's harness/provider/model so `crumb event` can
    // stamp metadata.harness/provider/model on actor-emitted events
    // (AGENTS.md §135 invariant). CRUMB_BUILDER_PROVIDER is set only when
    // spawning the verifier (dispatcher resolves it from the latest build
    // event's metadata.provider) so cross_provider can be computed
    // server-side without trusting the LLM to declare it.
    ...(req.harness ? { CRUMB_HARNESS: req.harness } : {}),
    ...(req.provider ? { CRUMB_PROVIDER: req.provider } : {}),
    ...(req.model ? { CRUMB_MODEL: req.model } : {}),
    ...(req.builderProvider ? { CRUMB_BUILDER_PROVIDER: req.builderProvider } : {}),
    // v0.3.1: verifier-only minimal-context bundle. Set by the dispatcher when
    // spawning the verifier so the sandwich reads the bundle instead of the
    // full transcript. Hard isolation against framing / anchor / preference
    // leakage biases. See [[bagelcode-verifier-context-isolation-2026-05-03]].
    ...(req.judgeInputPath ? { CRUMB_JUDGE_INPUT_PATH: req.judgeInputPath } : {}),
  };
}

/**
 * Wire the dispatcher's per-spawn AbortSignal to a SIGTERM on the child.
 * Idempotent — already-aborted signals fire immediately. Returns a cleanup
 * callback the caller should invoke on close() to avoid signal-listener
 * leaks across long-lived sessions.
 *
 * Pattern source: dispatcher's per-spawn timeout (autoresearch P3) — the
 * AbortSignal fires when the spawn exceeds its budget. SIGTERM gives the
 * CLI a chance to flush stdout before exit.
 */
export function attachAbortHandler(child: ChildProcess, signal?: AbortSignal): () => void {
  if (!signal) return () => undefined;
  const onAbort = (): void => {
    if (!child.killed) child.kill('SIGTERM');
  };
  if (signal.aborted) onAbort();
  else signal.addEventListener('abort', onAbort, { once: true });
  return () => signal.removeEventListener('abort', onAbort);
}

/**
 * Spawn `<cmd> --version`, resolve to {ok, reason} based on exit code.
 * Identical pattern in all 3 local adapters' health() methods.
 */
export function checkAdapterHealth(cmd: string): Promise<{ ok: boolean; reason?: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (b) => (out += b.toString()));
    child.on('error', (err) => resolve({ ok: false, reason: err.message }));
    child.on('close', (code) => {
      if (code === 0) resolve({ ok: true });
      else resolve({ ok: false, reason: `${cmd} --version exited ${code}: ${out}` });
    });
  });
}

/**
 * Line-buffered chunk splitter. Adapters call `feed(buf)` with each stdout
 * chunk; the splitter yields zero or more complete lines (newline-terminated)
 * and buffers any incomplete trailing line for the next call. Necessary
 * because Node child_process emits arbitrary chunk sizes — a JSON event
 * may straddle multiple chunks. Returns a closure with two methods:
 *
 *   const split = makeLineSplitter();
 *   child.stdout.on('data', (b) => split.feed(b, line => parse(line)));
 *   child.on('close', () => split.flush(line => parse(line)));
 */
export function makeLineSplitter(): {
  feed: (buf: Buffer | string, onLine: (line: string) => void) => void;
  flush: (onLine: (line: string) => void) => void;
} {
  let pending = '';
  return {
    feed(buf, onLine) {
      pending += typeof buf === 'string' ? buf : buf.toString('utf-8');
      let nl = pending.indexOf('\n');
      while (nl >= 0) {
        const line = pending.slice(0, nl).replace(/\r$/, '');
        pending = pending.slice(nl + 1);
        if (line.length > 0) onLine(line);
        nl = pending.indexOf('\n');
      }
    },
    flush(onLine) {
      const tail = pending.replace(/\r$/, '');
      pending = '';
      if (tail.length > 0) onLine(tail);
    },
  };
}

/**
 * Parse one stream-json line into a normalized ProgressEvent.
 *
 * Provider conventions covered:
 *  - claude-local: {"type":"assistant","message":{"content":[{"type":"tool_use","name":"Write","input":{"file_path":"..."}}]}}
 *                  {"type":"assistant","message":{"content":[{"type":"thinking","thinking":"..."}]}}
 *                  {"type":"user","message":{"content":[{"type":"tool_result","content":"..."}]}}
 *  - codex-local : {"event":"agent.message","content":"..."} / {"event":"tool_call","name":"...","arguments":...}
 *                  (codex experimental_json shape — coverage best-effort)
 *  - gemini-local: similar to claude (gemini CLI 2026 follows the Anthropic
 *                  stream-json schema in its `--show-progress` mode).
 *
 * Returns null when the line isn't recognizable as a progress event (system
 * banners, hook events, init blobs). The caller drops nulls silently.
 */
export function parseClaudeStreamProgress(line: string): ProgressEvent | null {
  let evt: unknown;
  try {
    evt = JSON.parse(line);
  } catch {
    return null;
  }
  if (!evt || typeof evt !== 'object') return null;
  const e = evt as Record<string, unknown>;
  // Anthropic / Claude Code stream-json:
  //   { type: "assistant", message: { content: [ {type:"tool_use", name, input}, ...] } }
  if (e.type === 'assistant' && e.message && typeof e.message === 'object') {
    const msg = e.message as { content?: unknown };
    const content = Array.isArray(msg.content)
      ? (msg.content as Array<Record<string, unknown>>)
      : [];
    for (const c of content) {
      if (c.type === 'tool_use') {
        const tool = typeof c.name === 'string' ? c.name : 'tool';
        const input = (c.input ?? {}) as Record<string, unknown>;
        const path =
          (typeof input.file_path === 'string' && input.file_path) ||
          (typeof input.path === 'string' && input.path) ||
          undefined;
        const summary = path ? `${tool} ${path}` : tool;
        return {
          kind: 'tool_use',
          tool,
          summary: summary.slice(0, 200),
          ...(path ? { path } : {}),
        };
      }
      if (c.type === 'thinking') {
        return { kind: 'thinking', summary: 'thinking' };
      }
    }
  }
  if (e.type === 'user' && e.message && typeof e.message === 'object') {
    const msg = e.message as { content?: unknown };
    const content = Array.isArray(msg.content)
      ? (msg.content as Array<Record<string, unknown>>)
      : [];
    for (const c of content) {
      if (c.type === 'tool_result') {
        return { kind: 'tool_result', summary: 'tool_result' };
      }
    }
  }
  return null;
}

/**
 * Codex CLI experimental_json shape. Best-effort: codex emits diverse event
 * names ("agent_reasoning", "tool_call", "function_call_output"). We only
 * surface the user-meaningful ones.
 */
export function parseCodexStreamProgress(line: string): ProgressEvent | null {
  let evt: unknown;
  try {
    evt = JSON.parse(line);
  } catch {
    return null;
  }
  if (!evt || typeof evt !== 'object') return null;
  const e = evt as Record<string, unknown>;
  const kind = (typeof e.event === 'string' && e.event) || (typeof e.type === 'string' && e.type);
  if (!kind) return null;
  if (kind === 'tool_call' || kind === 'function_call' || kind === 'shell_call') {
    const tool = typeof e.name === 'string' ? e.name : kind;
    const args = (e.arguments ?? e.args ?? {}) as Record<string, unknown>;
    const path =
      (typeof args.path === 'string' && args.path) ||
      (typeof args.file === 'string' && args.file) ||
      undefined;
    return {
      kind: 'tool_use',
      tool,
      summary: (path ? `${tool} ${path}` : tool).slice(0, 200),
      ...(path ? { path } : {}),
    };
  }
  if (kind === 'tool_result' || kind === 'function_call_output' || kind === 'shell_call_output') {
    return { kind: 'tool_result', summary: kind };
  }
  if (kind === 'agent_reasoning' || kind === 'reasoning') {
    return { kind: 'thinking', summary: 'thinking' };
  }
  return null;
}
