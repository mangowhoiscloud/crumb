/**
 * codex-local adapter — spawns OpenAI's `codex` CLI (Plus subscription) as a
 * subprocess. Sandwich is injected via stdin (Codex prefers Markdown over XML).
 *
 * If `codex` is unavailable on this machine the adapter health-check fails; the
 * Coordinator should then OPEN the builder circuit, which the reducer handles
 * by setting adapter_override.builder='claude-local' and respawning the same
 * builder actor (PR-Prune-2 collapsed the prior builder-fallback path).
 *
 * Lifecycle helpers (env / abort / health / default-prompt) are shared with
 * claude-local + gemini-local via `./_shared.ts`.
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
  parseCodexStreamProgress,
  resolvePrompt,
} from './_shared.js';

export class CodexLocalAdapter implements Adapter {
  readonly id = 'codex-local';

  health(): Promise<{ ok: boolean; reason?: string }> {
    return checkAdapterHealth('codex');
  }

  async spawn(req: SpawnRequest): Promise<SpawnResult> {
    if (!existsSync(req.sandwichPath)) {
      throw new Error(`sandwich not found: ${req.sandwichPath}`);
    }
    const sandwich = await readFile(req.sandwichPath, 'utf8');

    const args = buildCodexArgs(req);

    const start = Date.now();
    return new Promise<SpawnResult>((resolve, reject) => {
      const child = spawn('codex', args, {
        cwd: req.sessionDir,
        env: buildAdapterEnv(req),
        stdio: ['pipe', 'pipe', 'pipe'],
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
            const evt = parseCodexStreamProgress(line);
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
            const evt = parseCodexStreamProgress(line);
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
      // Inject sandwich via stdin
      child.stdin.write(sandwich);
      child.stdin.end();
    });
  }
}

/**
 * Pure argv builder — separated from spawn() so tests can verify the
 * `--model` / `-c model_reasoning_effort=...` plumbing without launching codex.
 *
 * Codex CLI flags differ from claude — using `exec` mode for non-interactive run.
 * The sandwich is piped via stdin; the prompt is a POSITIONAL argument
 * (`codex exec [OPTIONS] [PROMPT]`). The `--prompt` flag is rejected with
 * "unexpected argument '--prompt' found" — verified against codex-cli 0.123.0.
 *
 * Effort mapping (Snell ICLR 2025 — test-time compute 4× ≈ 14× pretrain):
 *   crumb effort  → codex model_reasoning_effort
 *   low           → low
 *   med           → medium
 *   high          → high
 * Backing: wiki/synthesis/bagelcode-scoring-ratchet-frontier-2026-05-02.md §7 P0-1.
 */
export function buildCodexArgs(req: SpawnRequest): string[] {
  const promptText = resolvePrompt(req);
  const effortValue =
    req.effort === 'low'
      ? 'low'
      : req.effort === 'med'
        ? 'medium'
        : req.effort === 'high'
          ? 'high'
          : null;

  const args = [
    'exec',
    '--cd',
    req.sessionDir,
    '--skip-git-repo-check', // session dirs aren't git repos; codex refuses without this
    '--full-auto', // skip confirmation prompts
  ];
  if (req.model) {
    args.push('--model', req.model);
  }
  if (effortValue) {
    args.push('-c', `model_reasoning_effort=${effortValue}`);
  }
  args.push(promptText); // positional, always last
  return args;
}
