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
    const args = [
      '-p',
      resolvePrompt(req),
      '--append-system-prompt',
      sandwich,
      '--add-dir',
      req.sessionDir,
      '--dangerously-skip-permissions',
      '--output-format',
      'text',
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
      child.stdout.on('data', (b) => (stdout += b.toString()));
      child.stderr.on('data', (b) => (stderr += b.toString()));
      child.on('error', reject);
      const detachAbort = attachAbortHandler(child, req.signal);
      child.on('close', (code) => {
        detachAbort();
        resolve({
          exitCode: code ?? -1,
          stdout,
          stderr,
          durationMs: Date.now() - start,
        });
      });
    });
  }
}
