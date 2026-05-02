/**
 * Session lease — single-writer guarantee for `<sessionDir>/.crumb-lock`.
 *
 * Crumb's transcript is append-only and ULID-sorted, so two concurrent
 * coordinators on the same session are not catastrophic: the writer's
 * O_APPEND keeps lines atomic and the reducer is pure. But two coordinators
 * also mean: 2× spawn (token cost), competing inbox.txt readers, two
 * artifact-watchers double-emitting, and intervene events potentially
 * arriving on the wrong side of a /reset_circuit. The lease prevents that.
 *
 * Approach (no native dep): write a JSON file with our PID + start time.
 * On startup, read any existing lease — if its PID is still alive, refuse
 * to take over; otherwise (stale PID) reclaim it. Cleanup on graceful exit
 * removes the file.
 *
 * This deliberately doesn't use `flock(2)` — that would require a native
 * module + cross-platform handling. PID-liveness is sufficient for the
 * single-user multi-terminal case (e.g. `crumb resume <id>` while the same
 * id is already running in another shell).
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface LeaseInfo {
  pid: number;
  startedAt: string;
  /** Optional human label — e.g. "studio post-spawn" / "tui /resume". */
  label?: string;
}

export interface AcquireResult {
  acquired: boolean;
  /** When `acquired=false`, the existing live lease's info. */
  heldBy?: LeaseInfo;
}

const LEASE_FILE = '.crumb-lock';

export function leasePath(sessionDir: string): string {
  return resolve(sessionDir, LEASE_FILE);
}

/**
 * Try to acquire a lease for this session. Returns `{ acquired: true }` on
 * success. On failure returns `{ acquired: false, heldBy }` with the live
 * holder's info — caller should print a friendly error and exit.
 */
export function acquireLease(sessionDir: string, label?: string): AcquireResult {
  const path = leasePath(sessionDir);
  if (existsSync(path)) {
    const existing = readLease(path);
    if (existing && isAlive(existing.pid)) {
      return { acquired: false, heldBy: existing };
    }
    // Stale lease (process died without cleanup) — overwrite.
  }
  const info: LeaseInfo = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    ...(label ? { label } : {}),
  };
  writeFileSync(path, JSON.stringify(info, null, 2), { encoding: 'utf-8' });
  return { acquired: true };
}

/** Release the lease iff we own it. Idempotent. */
export function releaseLease(sessionDir: string): void {
  const path = leasePath(sessionDir);
  if (!existsSync(path)) return;
  const existing = readLease(path);
  if (existing && existing.pid === process.pid) {
    try {
      unlinkSync(path);
    } catch {
      // ignore
    }
  }
}

function readLease(path: string): LeaseInfo | null {
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as LeaseInfo;
    if (typeof parsed.pid !== 'number' || !parsed.startedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Cheap PID-liveness check. `kill(pid, 0)` returns without sending a signal
 * if the process exists; throws ESRCH if not. EPERM (we don't own it) still
 * means it's alive.
 */
function isAlive(pid: number): boolean {
  if (pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EPERM') return true;
    return false;
  }
}
