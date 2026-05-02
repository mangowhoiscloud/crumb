import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  cycleEffort,
  cycleModel,
  defaultConfig,
  formatConfig,
  loadConfig,
  mapEffort,
  saveConfig,
  toggleProvider,
} from './model-config.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'crumb-mc-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('defaultConfig', () => {
  it('all 5 actors present, all on high-end models, effort=high', () => {
    const c = defaultConfig();
    expect(c.defaults.effort).toBe('high');
    expect(c.actors.coordinator?.model).toBe('claude-opus-4-7');
    expect(c.actors.builder?.model).toBe('gpt-5.5-codex');
    expect(c.actors.verifier?.model).toBe('gemini-2.5-pro');
    expect(c.actors['planner-lead']?.effort).toBe('high');
    expect(c.actors['builder-fallback']?.harness).toBe('claude-code');
  });

  it('all 3 local providers enabled by default', () => {
    const c = defaultConfig();
    expect(c.providers['claude-local'].enabled).toBe(true);
    expect(c.providers['codex-local'].enabled).toBe(true);
    expect(c.providers['gemini-cli-local'].enabled).toBe(true);
  });
});

describe('cycleModel', () => {
  it('↑ from sonnet → opus (higher tier)', () => {
    expect(cycleModel('claude-sonnet-4-6', 'anthropic', -1)).toBe('claude-opus-4-7');
  });
  it('↓ from opus → sonnet (lower tier)', () => {
    expect(cycleModel('claude-opus-4-7', 'anthropic', 1)).toBe('claude-sonnet-4-6');
  });
  it('wraps around at end', () => {
    expect(cycleModel('claude-haiku-4-5', 'anthropic', 1)).toBe('claude-opus-4-7');
  });
  it('unknown model snaps to top of catalog', () => {
    expect(cycleModel('mystery-model', 'openai', -1)).toBe('gpt-5.5-codex');
  });
});

describe('cycleEffort', () => {
  it('high → med (left)', () => {
    expect(cycleEffort('high', -1)).toBe('med');
  });
  it('med → high (right)', () => {
    expect(cycleEffort('med', 1)).toBe('high');
  });
  it('clamps at low (no wrap)', () => {
    expect(cycleEffort('low', -1)).toBe('low');
  });
  it('clamps at high (no wrap)', () => {
    expect(cycleEffort('high', 1)).toBe('high');
  });
});

describe('mapEffort', () => {
  it('high → reasoning.effort=high + 64000 thinking budget', () => {
    expect(mapEffort('high')).toEqual({
      openai_reasoning_effort: 'high',
      anthropic_thinking_budget: 64000,
      gemini_thinking_budget: 64000,
    });
  });
  it('low → reasoning.effort=low + 8000 thinking budget', () => {
    const m = mapEffort('low');
    expect(m.openai_reasoning_effort).toBe('low');
    expect(m.anthropic_thinking_budget).toBe(8000);
  });
});

describe('toggleProvider', () => {
  it('flips enabled flag immutably', () => {
    const c = defaultConfig();
    const c2 = toggleProvider(c, 'codex-local');
    expect(c2.providers['codex-local'].enabled).toBe(false);
    expect(c.providers['codex-local'].enabled).toBe(true);
  });
});

describe('saveConfig + loadConfig roundtrip', () => {
  it('writes valid TOML and loads back identical', () => {
    const c = defaultConfig();
    saveConfig(tmp, c);
    const loaded = loadConfig(tmp);
    expect(loaded.defaults.effort).toBe('high');
    expect(loaded.actors.builder?.model).toBe('gpt-5.5-codex');
    expect(loaded.providers['claude-local'].enabled).toBe(true);
  });

  it('loadConfig returns default when file missing', () => {
    const loaded = loadConfig(tmp);
    expect(loaded).toEqual(defaultConfig());
  });

  it('preserves user toggles across save/load', () => {
    let c = defaultConfig();
    c = toggleProvider(c, 'gemini-cli-local');
    c.actors.builder = { ...c.actors.builder, model: 'gpt-4o-mini', effort: 'low' };
    saveConfig(tmp, c);
    const loaded = loadConfig(tmp);
    expect(loaded.providers['gemini-cli-local'].enabled).toBe(false);
    expect(loaded.actors.builder?.model).toBe('gpt-4o-mini');
    expect(loaded.actors.builder?.effort).toBe('low');
  });
});

describe('formatConfig', () => {
  it('emits a readable status table', () => {
    const out = formatConfig(defaultConfig());
    expect(out).toContain('## providers');
    expect(out).toContain('## actors');
    expect(out).toContain('claude-opus-4-7');
    expect(out).toContain('gemini-2.5-pro');
  });
});

// Committed-config integrity guard — the live `.crumb/config.toml` must parse
// into the v3 schema and resolve verifier (the highest-leverage actor for
// extended thinking per Snell ICLR 2025) to effort=high. Backing: wiki/synthesis/
// bagelcode-scoring-ratchet-frontier-2026-05-02.md §7 P0-1.
describe('committed .crumb/config.toml', () => {
  it('parses into v3 schema with verifier effort=high', () => {
    const repoRoot = join(import.meta.dirname, '..', '..');
    const live = loadConfig(repoRoot);
    expect(live.defaults.effort).toBe('high');
    expect(live.actors.verifier?.effort).toBe('high');
    expect(live.actors.verifier?.harness).toBe('gemini-cli');
    expect(live.actors.verifier?.model).toBe('gemini-2.5-pro');
  });

  it('all 5 actors carry effort=high (no silent low/med drift)', () => {
    const repoRoot = join(import.meta.dirname, '..', '..');
    const live = loadConfig(repoRoot);
    for (const name of [
      'coordinator',
      'planner-lead',
      'builder',
      'verifier',
      'builder-fallback',
    ] as const) {
      expect(live.actors[name]?.effort).toBe('high');
    }
  });

  it('all 3 local providers enabled (matches frontier-research recommended baseline)', () => {
    const repoRoot = join(import.meta.dirname, '..', '..');
    const live = loadConfig(repoRoot);
    expect(live.providers['claude-local'].enabled).toBe(true);
    expect(live.providers['codex-local'].enabled).toBe(true);
    expect(live.providers['gemini-cli-local'].enabled).toBe(true);
  });
});
