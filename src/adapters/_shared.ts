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

import type { SpawnRequest } from './types.js';

/**
 * Default action-oriented kickoff prompt — used when the dispatcher passes
 * no explicit prompt (typical for goal → planner-lead, spec → builder,
 * qa.result → verifier, etc., where the actor's job is fully described by
 * the sandwich).
 *
 * Why this specific text: "Continue your role per the system prompt." (the
 * v3.3 first attempt) sometimes produced "awaiting input" stalls — Claude
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
    // v3.4: forward binding's harness/provider/model so `crumb event` can
    // stamp metadata.harness/provider/model on actor-emitted events
    // (AGENTS.md §135 invariant). CRUMB_BUILDER_PROVIDER is set only when
    // spawning the verifier (dispatcher resolves it from the latest build
    // event's metadata.provider) so cross_provider can be computed
    // server-side without trusting the LLM to declare it.
    ...(req.harness ? { CRUMB_HARNESS: req.harness } : {}),
    ...(req.provider ? { CRUMB_PROVIDER: req.provider } : {}),
    ...(req.model ? { CRUMB_MODEL: req.model } : {}),
    ...(req.builderProvider ? { CRUMB_BUILDER_PROVIDER: req.builderProvider } : {}),
    // v3.4: verifier-only minimal-context bundle. Set by the dispatcher when
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
