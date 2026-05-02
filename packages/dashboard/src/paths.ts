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
 * Per-home glob list. Each home contributes TWO globs:
 *   1. project-scoped (current runtime layout, v3.4+):
 *        `<home>/projects/<projectId>/sessions/<ulid>/transcript.jsonl`
 *   2. flat legacy layout (pre-v3.4 + dev `<repo>/sessions/<ulid>/`):
 *        `<home>/sessions/<ulid>/transcript.jsonl`
 *
 * Both layouts are watched simultaneously so a single dashboard instance
 * surfaces every session on the host without forcing the user to migrate
 * old sessions into the projects/ tree.
 */
function globsForHome(home: string): string[] {
  const norm = home.split(sep).join('/');
  return [
    posix.join(norm, 'projects', '*', 'sessions', '*', 'transcript.jsonl'),
    posix.join(norm, 'sessions', '*', 'transcript.jsonl'),
  ];
}

/**
 * Default chokidar glob covering all sessions on the current machine.
 * chokidar normalizes path separators internally; we hand it a posix-style
 * glob so Windows backslashes don't reach the matcher.
 *
 * Returns the project-scoped glob for backward compat. Most callers should
 * prefer `defaultTranscriptGlobs()` which also includes the legacy flat layout.
 */
export function defaultTranscriptGlob(): string {
  return globsForHome(getCrumbHome())[0]!;
}

/**
 * One or more transcript globs per active home. Used by the multi-home watcher.
 * chokidar accepts an array of globs and de-dups internally.
 */
export function defaultTranscriptGlobs(): string[] {
  return getCrumbHomes().flatMap(globsForHome);
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
 * Layouts:
 *   - project-scoped: `<home>/projects/<projectId>/sessions/<ulid>/transcript.jsonl`
 *     → returns substring before `/projects/`.
 *   - flat (legacy):  `<home>/sessions/<ulid>/transcript.jsonl`
 *     → returns substring before the last `/sessions/`.
 */
export function crumbHomeFromPath(path: string): string {
  const norm = path.split(sep).join('/');
  const projIdx = norm.lastIndexOf('/projects/');
  if (projIdx >= 0) return norm.slice(0, projIdx);
  const sessIdx = norm.lastIndexOf('/sessions/');
  return sessIdx >= 0 ? norm.slice(0, sessIdx) : '';
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
 * For the legacy flat layout `<crumbHome>/sessions/<ulid>/transcript.jsonl`
 * there is no project id — returns the synthetic id `'(legacy)'` so the
 * sessions still group together in the API response instead of colliding
 * with empty-string projects from genuinely malformed paths.
 */
export function projectIdFromPath(path: string): string {
  const norm = path.split(sep).join('/');
  const parts = norm.split('/');
  if (parts.length < 4) return '';
  // ... / projects / <projectId> / sessions / <ulid> / transcript.jsonl
  // index from the right: -1 file, -2 ulid, -3 'sessions', -4 projectId or 'projects' parent
  const maybeProjectsParent = parts[parts.length - 5];
  if (maybeProjectsParent === 'projects') return parts[parts.length - 4] ?? '';
  // Flat layout: -1 file, -2 ulid, -3 'sessions' (parent of sessions/ is the home root).
  if (parts[parts.length - 3] === 'sessions') return '(legacy)';
  return '';
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
