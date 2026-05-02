/**
 * Path resolution for the dashboard package.
 *
 * Decoupled from `crumb` core: we re-derive the same defaults instead of
 * importing src/paths.ts so the dashboard remains a standalone package.
 *
 * Single-home (legacy):
 *   - CRUMB_HOME env var → override
 *   - Otherwise: $HOME/.crumb (POSIX) or %USERPROFILE%/.crumb (Windows)
 *
 * Multi-home (v3.4):
 *   - CRUMB_HOMES (path-list-separated) takes precedence over CRUMB_HOME.
 *   - The CLI also accepts repeatable `--home <path>` flags.
 *   - All discovered homes are watched in parallel; sessions from any home
 *     show up in the same dashboard. Project-id collisions across homes are
 *     disambiguated by `transcript_path` in the API response.
 */

import { homedir } from 'node:os';
import { delimiter, join, posix, sep } from 'node:path';

export function getCrumbHome(): string {
  const override = process.env.CRUMB_HOME;
  if (override && override.length > 0) return override;
  return join(homedir(), '.crumb');
}

/**
 * Resolve the active list of `~/.crumb`-shaped roots. Order of precedence:
 *   1. `CRUMB_HOMES` (path-list-separated) — dedups while preserving order.
 *   2. `CRUMB_HOME` (single) → `[CRUMB_HOME]`.
 *   3. Fallback `[$HOME/.crumb]`.
 *
 * Empty entries (e.g. trailing `:`) are dropped.
 */
export function getCrumbHomes(): string[] {
  const raw = process.env.CRUMB_HOMES;
  if (raw && raw.length > 0) {
    const parts = raw
      .split(delimiter)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return dedupe(parts);
  }
  return [getCrumbHome()];
}

function dedupe(xs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
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
 * One transcript glob per active home. Used by the multi-home watcher.
 * chokidar accepts an array of globs and de-dups internally.
 */
export function defaultTranscriptGlobs(): string[] {
  return getCrumbHomes().map((home) => {
    const norm = home.split(sep).join('/');
    return posix.join(norm, 'projects', '*', 'sessions', '*', 'transcript.jsonl');
  });
}

/**
 * Identify which home a transcript path belongs to. Used by the API response
 * to disambiguate cases where two different homes happen to produce the same
 * project-id (e.g. `sha256(/tmp/foo)[:16]` colliding across machines).
 *
 * Pure path-string extraction — does NOT consult `getCrumbHomes()` so it
 * works regardless of how the watcher was configured (`--home` CLI flag
 * passes homes via globs without writing CRUMB_HOMES env).
 *
 * Layout: `<home>/projects/<projectId>/sessions/<ulid>/transcript.jsonl`.
 * Returns the substring before `/projects/`.
 */
export function crumbHomeFromPath(path: string): string {
  const norm = path.split(sep).join('/');
  const idx = norm.lastIndexOf('/projects/');
  return idx >= 0 ? norm.slice(0, idx) : '';
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
