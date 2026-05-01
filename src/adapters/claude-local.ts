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

    const args = [
      '-p',
      req.prompt ?? '',
      '--append-system-prompt',
      sandwich,
      '--add-dir',
      req.sessionDir,
      '--dangerously-skip-permissions',
      '--output-format',
      'text',
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
      child.on('close', (code) => {
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
