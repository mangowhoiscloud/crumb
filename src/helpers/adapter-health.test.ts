import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { probeAdapter, resetAdapterHealthCache } from './adapter-health.js';

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  resetAdapterHealthCache();
});

afterEach(() => {
  process.env = savedEnv;
  resetAdapterHealthCache();
});

describe('probeAdapter', () => {
  it('mock adapter is always healthy without I/O', async () => {
    const r = await probeAdapter('mock');
    expect(r.healthy).toBe(true);
    expect(r.reason).toContain('mock');
  });

  it('gemini-sdk healthy iff GEMINI_API_KEY env present', async () => {
    process.env.GEMINI_API_KEY = 'sk-test';
    const ok = await probeAdapter('gemini-sdk');
    expect(ok.healthy).toBe(true);
    resetAdapterHealthCache();
    delete process.env.GEMINI_API_KEY;
    const fail = await probeAdapter('gemini-sdk');
    expect(fail.healthy).toBe(false);
    expect(fail.reason).toContain('GEMINI_API_KEY');
  });

  it('unknown adapter id returns healthy with skip note (no surprise blocking)', async () => {
    const r = await probeAdapter('something-novel');
    expect(r.healthy).toBe(true);
    expect(r.reason).toContain('skipping');
  });

  it('caches results within the process lifetime', async () => {
    const a = await probeAdapter('mock');
    const b = await probeAdapter('mock');
    expect(a).toBe(b);
  });
});
