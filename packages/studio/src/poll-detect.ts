/**
 * shouldPoll() — decide whether to use chokidar polling vs native fs events.
 *
 * Native fs events break on:
 *   - WSL2 (no inotify on /mnt/c)
 *   - Docker bind-mounts from host
 *   - NFS / SMB / CIFS network filesystems
 *
 * Heuristic order:
 *   1. CRUMB_POLL=1 → poll (manual override)
 *   2. CRUMB_POLL=0 → native (manual override)
 *   3. WSL detected via /proc/version containing 'microsoft' → poll
 *   4. Otherwise → native (chokidar default)
 */

import { readFileSync } from 'node:fs';

export function shouldPoll(): boolean {
  const env = process.env.CRUMB_POLL;
  if (env === '1' || env === 'true') return true;
  if (env === '0' || env === 'false') return false;

  if (process.platform === 'linux') {
    try {
      const proc = readFileSync('/proc/version', 'utf8').toLowerCase();
      if (proc.includes('microsoft') || proc.includes('wsl')) return true;
    } catch {
      // /proc/version unreadable — fall through to native
    }
  }
  return false;
}
