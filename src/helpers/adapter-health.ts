/**
 * adapter-health — fast pre-spawn probe for the dispatcher.
 *
 * Checks "is this adapter realistically going to start?" before we hand it a
 * 60KB sandwich and wait 10+ seconds for it to exit 1. The dispatcher calls
 * `probeAdapter(id)` once per adapter per session (results cached in-process)
 * and substitutes `claude-local` when the configured adapter is unhealthy.
 *
 * Why a separate file from `helpers/doctor.ts`: doctor is the user-facing
 * `crumb doctor` command — heavier checks, OAuth dirs, version banners, table
 * output. This module is the runtime guard: cheap (≤2s), boolean, no I/O on
 * the happy path. Mock + SDK adapters short-circuit to healthy.
 *
 * Sister: `packages/studio/src/doctor.ts` (UI probe). Same intent, different
 * cadence — studio probes for the modal, dispatcher probes per spawn.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

export interface AdapterHealth {
  healthy: boolean;
  /** Short string suitable for `kind=note` body when unhealthy. */
  reason: string;
}

const PROBE_TIMEOUT_MS = 2000;
const cache = new Map<string, AdapterHealth>();

/** Reset the in-process cache. Test-only. */
export function resetAdapterHealthCache(): void {
  cache.clear();
}

/**
 * Probe an adapter. Cached per adapter id for the lifetime of the process.
 * Always resolves — never throws. Mock/SDK adapters return healthy without
 * touching the filesystem.
 */
export async function probeAdapter(adapterId: string): Promise<AdapterHealth> {
  const cached = cache.get(adapterId);
  if (cached) return cached;
  const result = await probeUncached(adapterId);
  cache.set(adapterId, result);
  return result;
}

async function probeUncached(adapterId: string): Promise<AdapterHealth> {
  switch (adapterId) {
    case 'mock':
      return { healthy: true, reason: 'mock adapter' };
    case 'gemini-sdk': {
      const present = !!process.env.GEMINI_API_KEY;
      return present
        ? { healthy: true, reason: 'GEMINI_API_KEY set' }
        : { healthy: false, reason: 'GEMINI_API_KEY env not set' };
    }
    case 'claude-local':
      return runBinaryProbe('claude');
    case 'codex-local':
      return runBinaryProbe('codex', [
        '~/.codex/auth.json',
        `${process.env.HOME}/.codex/auth.json`,
      ]);
    case 'gemini-local':
      return runBinaryProbe('gemini');
    default:
      return { healthy: true, reason: `unknown adapter ${adapterId} — skipping probe` };
  }
}

function runBinaryProbe(binary: string, authHints?: string[]): Promise<AdapterHealth> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (h: AdapterHealth): void => {
      if (settled) return;
      settled = true;
      resolve(h);
    };
    const proc = spawn(binary, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => {
      try {
        proc.kill('SIGKILL');
      } catch {
        // ignore
      }
      settle({ healthy: false, reason: `${binary} --version timed out (${PROBE_TIMEOUT_MS}ms)` });
    }, PROBE_TIMEOUT_MS);
    proc.on('error', () => {
      clearTimeout(timer);
      settle({ healthy: false, reason: `${binary} not on PATH` });
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        settle({ healthy: false, reason: `${binary} --version exit ${code}` });
        return;
      }
      // Auth hint check (codex needs ~/.codex/auth.json; binary alone isn't enough).
      if (authHints && authHints.length > 0) {
        const found = authHints.find((p) => p && existsSync(p));
        if (!found) {
          settle({
            healthy: false,
            reason: `${binary} installed but ${authHints[0]} missing (run: ${binary} login)`,
          });
          return;
        }
      }
      settle({ healthy: true, reason: `${binary} --version ok` });
    });
  });
}
