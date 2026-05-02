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
 * Lifecycle helpers (env / abort / health / default-prompt) are shared with
 * claude-local + codex-local via `./_shared.ts`.
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

export class GeminiLocalAdapter implements Adapter {
  readonly id = 'gemini-local';

  health(): Promise<{ ok: boolean; reason?: string }> {
    return checkAdapterHealth('gemini');
  }

  async spawn(req: SpawnRequest): Promise<SpawnResult> {
    if (!existsSync(req.sandwichPath)) {
      throw new Error(`sandwich not found: ${req.sandwichPath}`);
    }
    const sandwich = await readFile(req.sandwichPath, 'utf8');

    // Gemini CLI flag set is still stabilizing (CLI convergence 2026-04).
    // Best-guess Anthropic-mirror flags; verify via `crumb doctor` if a real
    // run reports unknown-flag errors.
    const args = [
      '-p',
      resolvePrompt(req),
      '--system-prompt',
      sandwich,
      '--add-dir',
      req.sessionDir,
      '--yolo',
    ];

    const start = Date.now();
    return new Promise<SpawnResult>((resolve, reject) => {
      const child = spawn('gemini', args, {
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
