import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { probeAdapters } from './doctor.js';

describe('probeAdapters', () => {
  const savedKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
  });
  afterEach(() => {
    if (savedKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = savedKey;
  });

  it('always reports mock adapter as installed + authenticated', async () => {
    const adapters = await probeAdapters();
    const mock = adapters.find((a) => a.id === 'mock');
    expect(mock).toBeDefined();
    expect(mock!.installed).toBe(true);
    expect(mock!.authenticated).toBe(true);
  });

  it('returns the full adapter catalogue (5 entries)', async () => {
    const adapters = await probeAdapters();
    const ids = adapters.map((a) => a.id).sort();
    expect(ids).toEqual(['claude-local', 'codex-local', 'gemini-cli-local', 'gemini-sdk', 'mock']);
  });

  it('reports gemini-sdk as authenticated only when GEMINI_API_KEY is set', async () => {
    let adapters = await probeAdapters();
    let sdk = adapters.find((a) => a.id === 'gemini-sdk');
    expect(sdk!.installed).toBe(false);
    expect(sdk!.authenticated).toBe(false);

    process.env.GEMINI_API_KEY = 'test-key-123';
    adapters = await probeAdapters();
    sdk = adapters.find((a) => a.id === 'gemini-sdk');
    expect(sdk!.installed).toBe(true);
    expect(sdk!.authenticated).toBe(true);
  });

  it('emits install_hint + (where applicable) auth_hint per adapter', async () => {
    const adapters = await probeAdapters();
    for (const a of adapters) {
      if (a.id === 'mock') continue;
      expect(a.install_hint).toBeDefined();
      // CLI-based adapters have an auth_hint; SDK-based one keys off env var.
      if (a.binary) expect(a.auth_hint).toBeDefined();
    }
  });

  it('reports authenticated=false when binary is missing', async () => {
    const adapters = await probeAdapters();
    for (const a of adapters) {
      if (a.binary && !a.installed) {
        expect(a.authenticated).toBe(false);
      }
    }
  });
});
