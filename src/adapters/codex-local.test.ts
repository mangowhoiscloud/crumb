/**
 * codex-local adapter argv plumbing — verifies binding.model + binding.effort
 * flow through to codex CLI flags. Frontier backing: Snell ICLR 2025
 * (wiki/synthesis/bagelcode-scoring-ratchet-frontier-2026-05-02.md §7 P0-1).
 */

import { describe, expect, it } from 'vitest';

import { buildCodexArgs } from './codex-local.js';
import type { SpawnRequest } from './types.js';

const baseReq = (overrides: Partial<SpawnRequest> = {}): SpawnRequest => ({
  actor: 'builder',
  sessionDir: '/tmp/sess',
  sandwichPath: '/tmp/sandwich.md',
  transcriptPath: '/tmp/transcript.jsonl',
  sessionId: 'sess-test',
  ...overrides,
});

describe('buildCodexArgs', () => {
  it('emits the base flags + positional prompt with default kickoff when prompt empty', () => {
    const args = buildCodexArgs(baseReq());
    expect(args[0]).toBe('exec');
    expect(args).toContain('--cd');
    expect(args).toContain('/tmp/sess');
    expect(args).toContain('--skip-git-repo-check');
    expect(args).toContain('--full-auto');
    // positional prompt is the last arg
    expect(args[args.length - 1]).toContain('Begin your turn now');
  });

  it('uses explicit prompt when provided', () => {
    const args = buildCodexArgs(baseReq({ prompt: 'do the thing' }));
    expect(args[args.length - 1]).toBe('do the thing');
  });

  it('omits --model when binding.model is unset', () => {
    const args = buildCodexArgs(baseReq());
    expect(args).not.toContain('--model');
  });

  it('passes --model when binding.model is set', () => {
    const args = buildCodexArgs(baseReq({ model: 'gpt-5.5-codex' }));
    const modelIdx = args.indexOf('--model');
    expect(modelIdx).toBeGreaterThan(0);
    expect(args[modelIdx + 1]).toBe('gpt-5.5-codex');
  });

  it('omits -c model_reasoning_effort when effort is unset', () => {
    const args = buildCodexArgs(baseReq());
    expect(args.find((a) => a.startsWith('model_reasoning_effort='))).toBeUndefined();
  });

  it('maps effort=low → -c model_reasoning_effort=low', () => {
    const args = buildCodexArgs(baseReq({ effort: 'low' }));
    expect(args).toContain('-c');
    expect(args).toContain('model_reasoning_effort=low');
  });

  it('maps effort=med → -c model_reasoning_effort=medium (codex naming)', () => {
    const args = buildCodexArgs(baseReq({ effort: 'med' }));
    expect(args).toContain('model_reasoning_effort=medium');
  });

  it('maps effort=high → -c model_reasoning_effort=high', () => {
    const args = buildCodexArgs(baseReq({ effort: 'high' }));
    expect(args).toContain('model_reasoning_effort=high');
  });

  it('positional prompt stays last even when --model + -c effort both present', () => {
    const args = buildCodexArgs(
      baseReq({ model: 'gpt-5.5-codex', effort: 'high', prompt: 'do the thing' }),
    );
    expect(args[args.length - 1]).toBe('do the thing');
    // Sanity: model and effort flags should both appear before the prompt.
    expect(args.indexOf('--model')).toBeLessThan(args.length - 1);
    expect(args.indexOf('-c')).toBeLessThan(args.length - 1);
  });

  it('order: base flags → --model → -c effort → prompt', () => {
    const args = buildCodexArgs(baseReq({ model: 'gpt-5.5-codex', effort: 'high', prompt: 'go' }));
    const modelIdx = args.indexOf('--model');
    const effortIdx = args.indexOf('-c');
    const promptIdx = args.length - 1;
    // base flags (exec, --cd, value, --skip-git-repo-check, --full-auto) — 5 entries before model
    expect(modelIdx).toBe(5);
    // model + value pair (2 entries) → effort flag at modelIdx + 2
    expect(effortIdx).toBe(modelIdx + 2);
    // effort + value pair (2 entries) → prompt at effortIdx + 2
    expect(promptIdx).toBe(effortIdx + 2);
  });
});
