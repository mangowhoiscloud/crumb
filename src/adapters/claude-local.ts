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
 *
 * Lifecycle helpers (env / abort / health / default-prompt) are shared with
 * codex-local + gemini-local via `./_shared.ts` — see that file for the
 * 414-duplicated-lines refactor rationale.
 */

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

import type { Adapter, SpawnRequest, SpawnResult } from './types.js';
import {
  attachAbortHandler,
  buildAdapterEnv,
  checkAdapterHealth,
  makeLineSplitter,
  parseClaudeStreamProgress,
  resolvePrompt,
} from './_shared.js';

export class ClaudeLocalAdapter implements Adapter {
  readonly id = 'claude-local';

  health(): Promise<{ ok: boolean; reason?: string }> {
    return checkAdapterHealth('claude');
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
    // resolvePrompt() falls back to DEFAULT_SPAWN_PROMPT in _shared.ts.
    // stream-json output gives us usage telemetry (tokens_in/out, cache, cost)
    // in the final `result` event. We must also pass --verbose; the Claude CLI
    // refuses --output-format=stream-json --print without it.
    const args = [
      '-p',
      resolvePrompt(req),
      '--append-system-prompt',
      sandwich,
      '--add-dir',
      req.sessionDir,
      '--dangerously-skip-permissions',
      '--output-format',
      'stream-json',
      '--verbose',
    ];

    const start = Date.now();
    return new Promise<SpawnResult>((resolve, reject) => {
      const child = spawn('claude', args, {
        cwd: req.sessionDir,
        env: buildAdapterEnv(req),
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      const splitter = makeLineSplitter();
      const onProgress = req.onProgress;
      const t0 = start;
      child.stdout.on('data', (b) => {
        stdout += b.toString();
        req.onStdoutActivity?.();
        if (onProgress) {
          splitter.feed(b, (line) => {
            const evt = parseClaudeStreamProgress(line);
            if (evt) onProgress({ ...evt, elapsed_ms: Date.now() - t0 });
          });
        }
      });
      child.stderr.on('data', (b) => {
        stderr += b.toString();
        req.onStdoutActivity?.();
      });
      child.on('error', reject);
      const detachAbort = attachAbortHandler(child, req.signal);
      child.on('close', (code) => {
        detachAbort();
        if (onProgress) {
          splitter.flush((line) => {
            const evt = parseClaudeStreamProgress(line);
            if (evt) onProgress({ ...evt, elapsed_ms: Date.now() - t0 });
          });
        }
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
