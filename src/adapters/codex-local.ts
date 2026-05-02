/**
 * codex-local adapter — spawns OpenAI's `codex` CLI (Plus subscription) as a
 * subprocess. Sandwich is injected via stdin (Codex prefers Markdown over XML).
 *
 * If `codex` is unavailable on this machine the adapter health-check fails; the
 * Coordinator should then OPEN the builder circuit and route to
 * builder-fallback (claude-local).
 */

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

import type { Adapter, SpawnRequest, SpawnResult } from './types.js';

export class CodexLocalAdapter implements Adapter {
  readonly id = 'codex-local';

  async health(): Promise<{ ok: boolean; reason?: string }> {
    return new Promise((resolve) => {
      const child = spawn('codex', ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      child.stdout.on('data', (b) => (out += b.toString()));
      child.on('error', (err) => resolve({ ok: false, reason: err.message }));
      child.on('close', (code) => {
        if (code === 0) resolve({ ok: true });
        else resolve({ ok: false, reason: `codex --version exited ${code}: ${out}` });
      });
    });
  }

  async spawn(req: SpawnRequest): Promise<SpawnResult> {
    if (!existsSync(req.sandwichPath)) {
      throw new Error(`sandwich not found: ${req.sandwichPath}`);
    }
    const sandwich = await readFile(req.sandwichPath, 'utf8');

    // Codex CLI flags differ from claude — using `exec` mode for non-interactive run.
    // The sandwich is piped via stdin; the prompt is a POSITIONAL argument
    // (`codex exec [OPTIONS] [PROMPT]`). The `--prompt` flag is rejected with
    // "unexpected argument '--prompt' found" — verified against codex-cli 0.123.0.
    //
    // Most reducer spawn effects omit `prompt` because the actor's job is fully
    // described by the sandwich. Fall back to a generic kickoff so codex always
    // receives a positional prompt and doesn't sit waiting on stdin.
    const promptText =
      req.prompt && req.prompt.trim().length > 0
        ? req.prompt
        : 'Continue your role per the system prompt.';
    const args = [
      'exec',
      '--cd',
      req.sessionDir,
      '--full-auto', // skip confirmation prompts
      promptText, // positional, always last
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
      const child = spawn('codex', args, {
        cwd: req.sessionDir,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
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
      // Inject sandwich via stdin
      child.stdin.write(sandwich);
      child.stdin.end();
    });
  }
}
