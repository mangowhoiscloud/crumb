/**
 * Migrate legacy `<cwd>/sessions/<id>/` directories into the v3.3 layout
 * `~/.crumb/projects/<id>/sessions/<id>/`.
 *
 * Idempotent: if a session already exists at the new location, skip and report.
 * Atomic per session: uses `fs.rename` (single syscall, transactional on most
 * filesystems). Partial failure leaves the source intact; you can re-run.
 *
 * Use `--dry-run` to preview the plan without moving anything.
 */

import { existsSync } from 'node:fs';
import { readdir, rename, rmdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { ensureProjectDir, getSessionsDir } from '../paths.js';

export type MigrateAction = 'moved' | 'already-migrated' | 'collision' | 'skipped';

export interface MigrateEntry {
  session_id: string;
  source: string;
  destination: string;
  action: MigrateAction;
  reason?: string;
}

export interface MigrateResult {
  cwd: string;
  destinationProject: string;
  legacyDir: string;
  entries: MigrateEntry[];
  removedLegacyDir: boolean;
  dryRun: boolean;
}

export interface MigrateOptions {
  cwd: string;
  dryRun?: boolean;
}

/**
 * Scan `<cwd>/sessions/` and move each session to
 * `~/.crumb/projects/<id>/sessions/`. Returns a per-session report.
 */
export async function migrateLegacySessions(opts: MigrateOptions): Promise<MigrateResult> {
  const { cwd, dryRun = false } = opts;
  const legacyDir = resolve(cwd, 'sessions');
  const destSessionsDir = await getSessionsDir(cwd);
  const projectDir = resolve(destSessionsDir, '..');

  const result: MigrateResult = {
    cwd,
    destinationProject: projectDir,
    legacyDir,
    entries: [],
    removedLegacyDir: false,
    dryRun,
  };

  if (!existsSync(legacyDir)) {
    return result;
  }

  if (!dryRun) {
    await ensureProjectDir(cwd);
  }

  const names = await readdir(legacyDir);
  for (const name of names) {
    const source = join(legacyDir, name);
    const destination = join(destSessionsDir, name);
    const entry: MigrateEntry = {
      session_id: name,
      source,
      destination,
      action: 'skipped',
    };

    if (existsSync(destination)) {
      entry.action = 'already-migrated';
      entry.reason = 'destination exists; legacy dir untouched';
      result.entries.push(entry);
      continue;
    }

    if (dryRun) {
      entry.action = 'moved';
      entry.reason = 'dry-run — would move';
      result.entries.push(entry);
      continue;
    }

    try {
      await rename(source, destination);
      entry.action = 'moved';
    } catch (err) {
      entry.action = 'collision';
      entry.reason = err instanceof Error ? err.message : String(err);
    }
    result.entries.push(entry);
  }

  // Remove `<cwd>/sessions/` if empty after migration.
  if (!dryRun) {
    try {
      const remaining = await readdir(legacyDir);
      if (remaining.length === 0) {
        await rmdir(legacyDir);
        result.removedLegacyDir = true;
      }
    } catch {
      // best-effort cleanup
    }
  }

  return result;
}

export function formatMigrateResult(r: MigrateResult): string {
  const lines: string[] = [];
  if (r.dryRun) {
    lines.push('[crumb migrate] DRY RUN — no files will be moved.');
  }
  lines.push(`[crumb migrate] legacy dir: ${r.legacyDir}`);
  lines.push(`[crumb migrate] dest project: ${r.destinationProject}`);
  if (r.entries.length === 0) {
    lines.push('[crumb migrate] nothing to migrate.');
    return lines.join('\n');
  }
  for (const e of r.entries) {
    const tag = e.action.padEnd(18);
    lines.push(`  ${tag} ${e.session_id}${e.reason ? `  — ${e.reason}` : ''}`);
  }
  if (r.removedLegacyDir) {
    lines.push(`[crumb migrate] removed empty legacy dir.`);
  }
  return lines.join('\n');
}
