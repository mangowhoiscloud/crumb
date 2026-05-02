import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { acquireLease, leasePath, releaseLease } from './lease.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'crumb-lease-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('session lease', () => {
  it('acquires when no lease exists', () => {
    const r = acquireLease(dir);
    expect(r.acquired).toBe(true);
    const info = JSON.parse(readFileSync(leasePath(dir), 'utf-8'));
    expect(info.pid).toBe(process.pid);
    expect(info.startedAt).toMatch(/Z$/);
  });

  it('refuses when an alive PID owns the lease', () => {
    acquireLease(dir, 'first-coordinator');
    // Re-acquire from the same process — pid is alive (us). Refused.
    const r = acquireLease(dir, 'second-coordinator');
    expect(r.acquired).toBe(false);
    expect(r.heldBy?.pid).toBe(process.pid);
    expect(r.heldBy?.label).toBe('first-coordinator');
  });

  it('reclaims a stale lease pointing to a dead PID', () => {
    // PID 1 always exists on Unix, but PID 2^31-1 generally does not.
    const fakePid = 2_000_000_000;
    writeFileSync(
      leasePath(dir),
      JSON.stringify({ pid: fakePid, startedAt: new Date().toISOString() }),
    );
    const r = acquireLease(dir);
    expect(r.acquired).toBe(true);
    const info = JSON.parse(readFileSync(leasePath(dir), 'utf-8'));
    expect(info.pid).toBe(process.pid);
  });

  it('releaseLease removes the file iff we own it', () => {
    acquireLease(dir);
    releaseLease(dir);
    expect(() => readFileSync(leasePath(dir), 'utf-8')).toThrow();
  });

  it('releaseLease ignores when the lease is held by someone else', () => {
    writeFileSync(
      leasePath(dir),
      JSON.stringify({ pid: 1, startedAt: new Date().toISOString() }),
    );
    releaseLease(dir);
    // Still there — we did not own it.
    const info = JSON.parse(readFileSync(leasePath(dir), 'utf-8'));
    expect(info.pid).toBe(1);
  });
});
