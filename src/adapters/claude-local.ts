/**
 * claude-local adapter — spawns the user's local `claude` CLI as a subprocess.
 * Uses the user's Claude Max subscription (no API key). Sandwich is injected
 * via stdin so it does not need to live in CLAUDE.md.
 *
 * Flags:
 *   --append-system-prompt @<sandwich>  — overlays our role spec on top of CLAUDE.md
 *   --add-dir <session_dir>             — sandbox to session working dir
 *   --dangerously-skip-permissions      — no interactive prompts (subprocess can't answer)
 *   -p "<prompt>"                       — non-interactive single-turn run
 *
 * The subprocess writes transcript events by invoking `crumb event` (sister CLI),
 * which appends validated lines to $CRUMB_TRANSCRIPT_PATH. The path is passed via env.
 */

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

import type { Adapter, SpawnRequest, SpawnResult } from './types.js';

export class ClaudeLocalAdapter implements Adapter {
  readonly id = 'claude-local';

  async health(): Promise<{ ok: boolean; reason?: string }> {
    return new Promise((resolve) => {
      const child = spawn('claude', ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      child.stdout.on('data', (b) => (out += b.toString()));
      child.on('error', (err) => resolve({ ok: false, reason: err.message }));
      child.on('close', (code) => {
        if (code === 0) resolve({ ok: true });
        else resolve({ ok: false, reason: `claude --version exited ${code}: ${out}` });
      });
    });
  }

  async spawn(req: SpawnRequest): Promise<SpawnResult> {
    if (!existsSync(req.sandwichPath)) {
      throw new Error(`sandwich not found: ${req.sandwichPath}`);
    }
    const sandwich = await readFile(req.sandwichPath, 'utf8');

    // Claude CLI rejects `-p ""` ("Input must be provided either through stdin
    // or as a prompt argument when using --print"). Most reducer spawn effects
    // (goal → planner-lead, spec → builder, qa.result → verifier, fallback)
    // omit `prompt` because the actor's job is fully described by the sandwich.
    // Fall back to a generic kickoff so empty prompts don't crash the spawn.
    // The phrase is action-oriented: "Continue your role" (the v3.3 first
    // attempt) sometimes produced "awaiting input" stalls — Claude treated it
    // as a status check. Naming the transcript file + telling the actor to
    // execute the next step removes that ambiguity.
    const promptText =
      req.prompt && req.prompt.trim().length > 0
        ? req.prompt
        : 'Begin your turn now. Read $CRUMB_TRANSCRIPT_PATH for full context (latest goal, spec, qa.result, etc.) and execute the next step per the system prompt. Do not wait for additional input.';
    // stream-json output gives us usage telemetry (tokens_in/out, cache, cost)
    // in the final `result` event. We must also pass --verbose; the Claude CLI
    // refuses --output-format=stream-json --print without it.
    const args = [
      '-p',
      promptText,
      '--append-system-prompt',
      sandwich,
      '--add-dir',
      req.sessionDir,
      '--dangerously-skip-permissions',
      '--output-format',
      'stream-json',
      '--verbose',
    ];

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      CRUMB_TRANSCRIPT_PATH: req.transcriptPath,
      CRUMB_SESSION_ID: req.sessionId,
      CRUMB_SESSION_DIR: req.sessionDir,
      CRUMB_ACTOR: req.actor,
    };

    const start = Date.now();
    return new Promise<SpawnResult>((resolve, reject) => {
      const child = spawn('claude', args, {
        cwd: req.sessionDir,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (b) => (stdout += b.toString()));
      child.stderr.on('data', (b) => (stderr += b.toString()));
      child.on('error', reject);
      // Per-spawn timeout (autoresearch P3): the dispatcher passes an
      // AbortSignal that fires when the spawn exceeds its budget. SIGTERM
      // gives the CLI a chance to flush stdout before exit.
      const onAbort = (): void => {
        if (!child.killed) child.kill('SIGTERM');
      };
      if (req.signal) {
        if (req.signal.aborted) onAbort();
        else req.signal.addEventListener('abort', onAbort, { once: true });
      }
      child.on('close', (code) => {
        if (req.signal) req.signal.removeEventListener('abort', onAbort);
        const usage = parseClaudeStreamJsonUsage(stdout);
        resolve({
          exitCode: code ?? -1,
          stdout,
          stderr,
          durationMs: Date.now() - start,
          ...(usage ? { usage } : {}),
        });
      });
    });
  }
}

/**
 * Parse the final `result` event of `claude -p --output-format stream-json`.
 * Each line of stdout is one JSON object; the last `type: "result"` line
 * carries `usage.input_tokens`, `usage.output_tokens`,
 * `usage.cache_read_input_tokens`, `usage.cache_creation_input_tokens`, and
 * `total_cost_usd`. Earlier `system`/`assistant` events are ignored.
 *
 * Defensive: returns null on any malformed line, so a partial / truncated
 * stream still resolves with `usage` undefined (never throws).
 */
export function parseClaudeStreamJsonUsage(stdout: string): SpawnResult['usage'] | null {
  if (!stdout) return null;
  let result: SpawnResult['usage'] | null = null;
  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.replace(/\r$/, '').trim();
    if (line.length === 0) continue;
    let evt: unknown;
    try {
      evt = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof evt !== 'object' || evt === null) continue;
    const o = evt as Record<string, unknown>;
    if (o.type !== 'result') continue;
    const usage = o.usage as Record<string, unknown> | undefined;
    const collected: SpawnResult['usage'] = {};
    if (usage) {
      if (typeof usage.input_tokens === 'number') collected.tokens_in = usage.input_tokens;
      if (typeof usage.output_tokens === 'number') collected.tokens_out = usage.output_tokens;
      if (typeof usage.cache_read_input_tokens === 'number') {
        collected.cache_read = usage.cache_read_input_tokens;
      }
      if (typeof usage.cache_creation_input_tokens === 'number') {
        collected.cache_write = usage.cache_creation_input_tokens;
      }
    }
    if (typeof o.total_cost_usd === 'number') collected.cost_usd = o.total_cost_usd;
    if (typeof o.model === 'string') collected.model = o.model;
    if (Object.keys(collected).length > 0) result = collected;
  }
  return result;
}
