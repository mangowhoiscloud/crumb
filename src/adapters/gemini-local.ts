/**
 * gemini-local adapter — spawns the user's local `gemini` CLI as a subprocess.
 * Uses the user's Google account (Gemini Advanced or `gemini login`). Sandwich
 * is injected via stdin / system-prompt flag so it does not need to live in
 * `~/.gemini/GEMINI.md` (which would persist across sessions).
 *
 * NOT a hard-coded verifier — Gemini is just one of several harnesses a user
 * may bind to any actor (builder / verifier / planner-lead / etc.) via a preset.
 * If the user does not configure anything, every actor follows the host ambient
 * harness; this adapter is only invoked when a preset explicitly names
 * `harness = "gemini-cli"`.
 *
 * Pattern follows `claude-local.ts` (Anthropic-style flags). The actual Gemini
 * CLI flag surface is still stabilizing (post-2026-04 CLI convergence), so the
 * exact flag names below are best-guess and should be verified against the
 * installed `gemini` binary at runtime via `crumb doctor`.
 *
 * Flags (best-guess, claude-local mirror):
 *   --system-prompt @<sandwich>   — overlay role spec on top of host memory file
 *   --add-dir <session_dir>       — sandbox to session working dir
 *   --yolo                         — skip interactive prompts (subprocess can't answer)
 *   -p "<prompt>"                  — non-interactive single-turn run
 *
 * The subprocess writes transcript events by invoking `crumb event` (sister
 * CLI), which appends validated lines to $CRUMB_TRANSCRIPT_PATH. The path is
 * passed via env, identical to claude-local / codex-local.
 */

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

import type { Adapter, SpawnRequest, SpawnResult } from './types.js';

export class GeminiLocalAdapter implements Adapter {
  readonly id = 'gemini-local';

  async health(): Promise<{ ok: boolean; reason?: string }> {
    return new Promise((resolve) => {
      const child = spawn('gemini', ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      child.stdout.on('data', (b) => (out += b.toString()));
      child.on('error', (err) => resolve({ ok: false, reason: err.message }));
      child.on('close', (code) => {
        if (code === 0) resolve({ ok: true });
        else resolve({ ok: false, reason: `gemini --version exited ${code}: ${out}` });
      });
    });
  }

  async spawn(req: SpawnRequest): Promise<SpawnResult> {
    if (!existsSync(req.sandwichPath)) {
      throw new Error(`sandwich not found: ${req.sandwichPath}`);
    }
    const sandwich = await readFile(req.sandwichPath, 'utf8');

    // Gemini CLI flag set is still stabilizing (CLI convergence 2026-04).
    // Best-guess Anthropic-mirror flags; verify via `crumb doctor` if a real
    // run reports unknown-flag errors.
    //
    // Most reducer spawn effects omit `prompt` because the actor's job is fully
    // described by the sandwich. Fall back to a generic kickoff so empty
    // prompts don't crash the spawn (CLIs reject empty `-p ""`).
    const promptText =
      req.prompt && req.prompt.trim().length > 0
        ? req.prompt
        : 'Continue your role per the system prompt.';
    const args = [
      '-p',
      promptText,
      '--system-prompt',
      sandwich,
      '--add-dir',
      req.sessionDir,
      '--yolo',
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
      const child = spawn('gemini', args, {
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
