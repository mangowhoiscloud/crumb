import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadConfig } from '../config/model-config.js';

import { applyNlInstruction, showConfig } from './model-edit.js';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'crumb-mc-tui-'));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('applyNlInstruction — provider toggle', () => {
  it('"codex 비활성화" disables codex-local', () => {
    const out = applyNlInstruction(tmp, 'codex 비활성화');
    expect(out).toContain('applied');
    expect(loadConfig(tmp).providers['codex-local'].enabled).toBe(false);
  });

  it('"disable gemini" disables gemini-cli-local', () => {
    applyNlInstruction(tmp, 'disable gemini');
    expect(loadConfig(tmp).providers['gemini-cli-local'].enabled).toBe(false);
  });

  it('"enable claude" re-enables claude-local', () => {
    applyNlInstruction(tmp, 'disable claude');
    expect(loadConfig(tmp).providers['claude-local'].enabled).toBe(false);
    applyNlInstruction(tmp, 'enable claude');
    expect(loadConfig(tmp).providers['claude-local'].enabled).toBe(true);
  });
});

describe('applyNlInstruction — effort', () => {
  it('"effort 다 low 로" sets all actors to low', () => {
    applyNlInstruction(tmp, 'effort 다 low 로');
    const c = loadConfig(tmp);
    expect(c.defaults.effort).toBe('low');
    expect(c.actors.builder?.effort).toBe('low');
    expect(c.actors.verifier?.effort).toBe('low');
  });

  it('"effort all to medium" sets med', () => {
    applyNlInstruction(tmp, 'effort all to medium');
    expect(loadConfig(tmp).defaults.effort).toBe('med');
  });

  it('"verifier effort high" only changes verifier', () => {
    applyNlInstruction(tmp, 'effort 다 low 로');
    applyNlInstruction(tmp, 'verifier effort high');
    const c = loadConfig(tmp);
    expect(c.actors.verifier?.effort).toBe('high');
    expect(c.actors.builder?.effort).toBe('low');
  });
});

describe('applyNlInstruction — per-actor model', () => {
  it('"verifier 모델을 gemini-3-1-pro 로" sets verifier model (dash form)', () => {
    applyNlInstruction(tmp, 'verifier 모델을 gemini-3-1-pro 로');
    const c = loadConfig(tmp);
    expect(c.actors.verifier?.model).toBe('gemini-3-1-pro');
    expect(c.actors.verifier?.harness).toBe('gemini-cli');
  });

  it('"verifier 모델을 gemini-3.1-pro 로" sets verifier (dot form aliased to dash)', () => {
    applyNlInstruction(tmp, 'verifier 모델을 gemini-3.1-pro 로');
    const c = loadConfig(tmp);
    expect(c.actors.verifier?.model).toBe('gemini-3-1-pro');
    expect(c.actors.verifier?.harness).toBe('gemini-cli');
  });

  it('"verifier 모델을 gemini-2.5-pro 로" still works (dot form is canonical for 2.5)', () => {
    applyNlInstruction(tmp, 'verifier 모델을 gemini-2.5-pro 로');
    const c = loadConfig(tmp);
    expect(c.actors.verifier?.model).toBe('gemini-2.5-pro');
  });

  it('"verifier 모델을 gemini-2-5-pro 로" also resolves (dash form aliased to dot)', () => {
    applyNlInstruction(tmp, 'verifier 모델을 gemini-2-5-pro 로');
    const c = loadConfig(tmp);
    // Catalog form for 2.5 uses dots, so the saved value preserves dots.
    expect(c.actors.verifier?.model).toBe('gemini-2.5-pro');
  });

  it('"set builder model to gpt-4o-mini" updates builder', () => {
    applyNlInstruction(tmp, 'set builder model to gpt-4o-mini');
    const c = loadConfig(tmp);
    expect(c.actors.builder?.model).toBe('gpt-4o-mini');
    expect(c.actors.builder?.harness).toBe('codex');
  });
});

describe('applyNlInstruction — no match', () => {
  it('unparseable instruction does not save and reports no change', () => {
    const out = applyNlInstruction(tmp, '아무 의미 없는 문장 totally unrelated');
    expect(out).toContain('no change applied');
  });
});

describe('showConfig', () => {
  it('emits readable status table for default', () => {
    const out = showConfig(tmp);
    expect(out).toContain('claude-opus-4-7');
    expect(out).toContain('claude-local');
    expect(out).toContain('## actors');
  });
});
