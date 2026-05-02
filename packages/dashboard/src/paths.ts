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

/**
 * Extract the project id from a transcript path.
 *   <crumbHome>/projects/<projectId>/sessions/<ulid>/transcript.jsonl
 *                        ^^^^^^^^^^^
 * Returns an empty string when the path doesn't match the expected layout.
 */
export function projectIdFromPath(path: string): string {
  const norm = path.split(sep).join('/');
  const parts = norm.split('/');
  // ... / projects / <projectId> / sessions / <ulid> / transcript.jsonl
  // index from the right: -1 file, -2 ulid, -3 'sessions', -4 projectId
  if (parts.length < 4) return '';
  return parts[parts.length - 4] ?? '';
}

/**
 * Resolve the assembled sandwich path for a given session + actor.
 * Lives at <session>/agent-workspace/<actor>/sandwich.assembled.md.
 */
export function sandwichPath(sessionDir: string, actor: string): string {
  return join(sessionDir, 'agent-workspace', actor, 'sandwich.assembled.md');
}

/**
 * Compute the absolute session dir from a transcript path (drop the trailing
 * `transcript.jsonl` filename).
 */
export function sessionDirFromTranscript(path: string): string {
  const norm = path.split(sep).join('/');
  const idx = norm.lastIndexOf('/');
  return idx < 0 ? path : norm.slice(0, idx);
}
