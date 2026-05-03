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

  // F5 — adapter modal advanced

  it('F5: install_hint matches process.platform when per-OS table provided', async () => {
    const adapters = await probeAdapters();
    const claude = adapters.find((a) => a.id === 'claude-local');
    expect(claude).toBeDefined();
    expect(claude!.install_hint).toBeDefined();
    if (process.platform === 'win32') {
      expect(claude!.install_hint).toContain('powershell');
    } else {
      // darwin + linux both share the curl|bash path
      expect(claude!.install_hint).toContain('claude.ai/install.sh');
    }
  });

  it('F5: surfaces api_key_envvar for binary adapters that also accept env-var auth', async () => {
    const adapters = await probeAdapters();
    expect(adapters.find((a) => a.id === 'claude-local')!.api_key_envvar).toBe('ANTHROPIC_API_KEY');
    expect(adapters.find((a) => a.id === 'codex-local')!.api_key_envvar).toBe('OPENAI_API_KEY');
    expect(adapters.find((a) => a.id === 'gemini-cli-local')!.api_key_envvar).toBe(
      'GEMINI_API_KEY',
    );
    // Mock has no API key path.
    expect(adapters.find((a) => a.id === 'mock')!.api_key_envvar).toBeUndefined();
  });

  it('F5: api_key_set reflects whether the envvar is populated in the server process', async () => {
    const savedAnthropic = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    let adapters = await probeAdapters();
    let claude = adapters.find((a) => a.id === 'claude-local');
    expect(claude!.api_key_set).toBe(false);

    process.env.ANTHROPIC_API_KEY = 'sk-test-123';
    adapters = await probeAdapters();
    claude = adapters.find((a) => a.id === 'claude-local');
    expect(claude!.api_key_set).toBe(true);

    if (savedAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = savedAnthropic;
  });

  it('F5: binary-installed + api_key_set → authenticated=true (headless route)', async () => {
    // Even when /login state can't be probed without a costly spawn, the
    // presence of the API key guarantees headless auth works. Keeps the
    // adapter chip green for users on the env-var route.
    const savedClaude = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-test-123';
    const adapters = await probeAdapters();
    const claude = adapters.find((a) => a.id === 'claude-local');
    if (claude!.installed) {
      // CI runners typically have neither — only assert when claude binary exists.
      expect(claude!.authenticated).toBe(true);
    }
    if (savedClaude === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = savedClaude;
  });
});
