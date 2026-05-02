/**
 * Path resolution for the dashboard package.
 *
 * Decoupled from `crumb` core: we re-derive the same defaults instead of
 * importing src/paths.ts so the dashboard remains a standalone package.
 *
 *   - CRUMB_HOME env var → override
 *   - Otherwise: $HOME/.crumb (POSIX) or %USERPROFILE%/.crumb (Windows)
 */

import { homedir } from 'node:os';
import { join, posix, sep } from 'node:path';

export function getCrumbHome(): string {
  const override = process.env.CRUMB_HOME;
  if (override && override.length > 0) return override;
  return join(homedir(), '.crumb');
}

/**
 * Default chokidar glob covering all sessions on the current machine.
 * chokidar normalizes path separators internally; we hand it a posix-style
 * glob so Windows backslashes don't reach the matcher.
 */
export function defaultTranscriptGlob(): string {
  const home = getCrumbHome().split(sep).join('/');
  return posix.join(home, 'projects', '*', 'sessions', '*', 'transcript.jsonl');
}

/**
 * Extract the session ULID from a transcript path.
 *   <crumbHome>/projects/<projectId>/sessions/<ulid>/transcript.jsonl
 *                                                  ^ here
 */
export function sessionIdFromPath(path: string): string {
  const norm = path.split(sep).join('/');
  const parts = norm.split('/');
  // last component is "transcript.jsonl"; the parent directory is the ULID.
  return parts[parts.length - 2] ?? '';
}
