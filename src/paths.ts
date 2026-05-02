/**
 * Crumb storage layout (v0.3.0+) — single source for all on-disk paths.
 *
 * ```
 * ~/.crumb/                                    user-global
 * ├── config.toml
 * ├── presets/
 * └── projects/<project-id>/                   project (durable)
 *     ├── project.toml                          { id, cwd, label, created_at, pinned }
 *     ├── sessions/<session-ulid>/             session (WIP attempt)
 *     │   ├── transcript.jsonl                  source of truth
 *     │   ├── meta.json                         { status, started_at, ... }
 *     │   ├── inbox.txt
 *     │   ├── agent-workspace/<actor>/
 *     │   ├── artifacts/
 *     │   └── index.html
 *     └── versions/<vN>[-<label>]/             milestone (immutable manifest.toml + frozen artifacts)
 *
 * <cwd>/.crumb/project.toml                    OPTIONAL pin (only when `crumb init --pin` called)
 * ```
 *
 * Project ID resolution:
 *  1. If `<cwd>/.crumb/project.toml` exists → use its `id` (ULID set by `crumb init --pin`).
 *  2. Else → `sha256(canonical(cwd))[:16]`.
 *
 * Backward-compat (v0.2.0 and older `<cwd>/sessions/<id>/`):
 *  `resolveSessionDir()` checks the new global location first, then falls back to the
 *  legacy cwd-local path so old sessions keep working until `crumb migrate` (Phase 3).
 *
 * Override for tests / sandboxing: `CRUMB_HOME=/tmp/test-crumb`.
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export const CRUMB_HOME_ENV = 'CRUMB_HOME';
export const DEFAULT_CRUMB_HOME_DIR = '.crumb';
export const PROJECT_PIN_DIR = '.crumb';
export const PROJECT_PIN_FILE = 'project.toml';

/** Root of the user-global Crumb directory. Honors `CRUMB_HOME` env override. */
export function getCrumbHome(): string {
  const override = process.env[CRUMB_HOME_ENV];
  if (override && override.length > 0) return override;
  return join(homedir(), DEFAULT_CRUMB_HOME_DIR);
}

/** Ambient project id derived purely from the canonicalized cwd path. */
export function projectIdFromCwd(cwd: string): string {
  const canonical = resolve(cwd);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

/**
 * Resolve project id for `cwd`:
 *  - If `<cwd>/.crumb/project.toml` has `id = "..."`, return it (pinned).
 *  - Else return `projectIdFromCwd(cwd)` (ambient).
 */
export async function resolveProjectId(cwd: string): Promise<string> {
  const pinPath = join(cwd, PROJECT_PIN_DIR, PROJECT_PIN_FILE);
  if (existsSync(pinPath)) {
    try {
      const content = await readFile(pinPath, 'utf8');
      const match = content.match(/^\s*(?:id|project_id)\s*=\s*"([^"]+)"/m);
      if (match) return match[1];
    } catch {
      // fall through to ambient
    }
  }
  return projectIdFromCwd(cwd);
}

export async function getProjectDir(cwd: string): Promise<string> {
  return join(getCrumbHome(), 'projects', await resolveProjectId(cwd));
}

export async function getSessionsDir(cwd: string): Promise<string> {
  return join(await getProjectDir(cwd), 'sessions');
}

export async function getSessionRoot(cwd: string, sessionId: string): Promise<string> {
  return join(await getSessionsDir(cwd), sessionId);
}

export async function getVersionsDir(cwd: string): Promise<string> {
  return join(await getProjectDir(cwd), 'versions');
}

export async function getActorWorkspace(
  cwd: string,
  sessionId: string,
  actor: string,
): Promise<string> {
  return join(await getSessionRoot(cwd, sessionId), 'agent-workspace', actor);
}

export async function getArtifactsDir(cwd: string, sessionId: string): Promise<string> {
  return join(await getSessionRoot(cwd, sessionId), 'artifacts');
}

/**
 * Resolve a session reference (CLI positional arg) to its on-disk dir.
 *  - If `ref` contains `/` or starts with `.`, treat as a path → resolve as-is.
 *  - Bare ULID: try the new global location first.
 *  - Fallback: legacy `<cwd>/sessions/<ref>/` (v0.2.0 and older).
 *  - If neither exists, default to the new path (write target for new sessions).
 */
export async function resolveSessionDir(ref: string, cwd: string): Promise<string> {
  if (ref.includes('/') || ref.startsWith('.')) {
    return resolve(ref);
  }
  const newPath = await getSessionRoot(cwd, ref);
  if (existsSync(newPath)) return newPath;
  const legacyPath = resolve(cwd, 'sessions', ref);
  if (existsSync(legacyPath)) return legacyPath;
  return newPath;
}

/** Bootstrap `~/.crumb/{projects,presets}/`. Idempotent. */
export async function ensureCrumbHome(): Promise<void> {
  const home = getCrumbHome();
  await mkdir(join(home, 'projects'), { recursive: true });
  await mkdir(join(home, 'presets'), { recursive: true });
}

/** Ensure project dir + sessions/ + versions/ exist. Returns project dir. */
export async function ensureProjectDir(cwd: string): Promise<string> {
  const dir = await getProjectDir(cwd);
  await mkdir(join(dir, 'sessions'), { recursive: true });
  await mkdir(join(dir, 'versions'), { recursive: true });
  return dir;
}

/** Ensure session root + artifacts/. Returns session dir. */
export async function ensureSessionRoot(cwd: string, sessionId: string): Promise<string> {
  const dir = await getSessionRoot(cwd, sessionId);
  await mkdir(join(dir, 'artifacts'), { recursive: true });
  return dir;
}
