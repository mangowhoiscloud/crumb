import { mkdir, mkdtemp, readdir, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CRUMB_HOME_ENV, getSessionsDir } from '../paths.js';
import { formatMigrateResult, migrateLegacySessions } from './migrate.js';

describe('migrate legacy <cwd>/sessions/', () => {
  let tmp: string;
  let cwd: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'crumb-migrate-'));
    cwd = await mkdtemp(join(tmp, 'cwd-'));
    originalHome = process.env[CRUMB_HOME_ENV];
    process.env[CRUMB_HOME_ENV] = join(tmp, '.crumb');
  });

  afterEach(async () => {
    if (originalHome === undefined) {
      delete process.env[CRUMB_HOME_ENV];
    } else {
      process.env[CRUMB_HOME_ENV] = originalHome;
    }
    await rm(tmp, { recursive: true, force: true });
  });

  it('reports nothing when legacy dir absent', async () => {
    const r = await migrateLegacySessions({ cwd });
    expect(r.entries).toEqual([]);
    expect(r.removedLegacyDir).toBe(false);
  });

  it('moves every legacy session to ~/.crumb/projects/<id>/sessions/', async () => {
    const legacy = join(cwd, 'sessions');
    await mkdir(join(legacy, '01J0A'), { recursive: true });
    await writeFile(join(legacy, '01J0A', 'transcript.jsonl'), '{}\n', 'utf8');
    await mkdir(join(legacy, '01J0B'), { recursive: true });
    await writeFile(join(legacy, '01J0B', 'transcript.jsonl'), '{}\n', 'utf8');

    const r = await migrateLegacySessions({ cwd });

    expect(r.entries.map((e) => e.action).sort()).toEqual(['moved', 'moved']);
    const destDir = await getSessionsDir(cwd);
    const destEntries = await readdir(destDir);
    expect(destEntries.sort()).toEqual(['01J0A', '01J0B']);
  });

  it('removes legacy dir when empty after migration', async () => {
    const legacy = join(cwd, 'sessions');
    await mkdir(join(legacy, '01J0A'), { recursive: true });
    await writeFile(join(legacy, '01J0A', 'transcript.jsonl'), '{}\n', 'utf8');

    const r = await migrateLegacySessions({ cwd });
    expect(r.removedLegacyDir).toBe(true);
    expect(async () => await stat(legacy)).rejects.toThrow();
  });

  it('skips sessions already at destination (idempotent)', async () => {
    // Pre-create destination
    const destDir = await getSessionsDir(cwd);
    await mkdir(join(destDir, '01J0A'), { recursive: true });
    await writeFile(join(destDir, '01J0A', 'transcript.jsonl'), '{}\n', 'utf8');

    // Legacy still has it
    const legacy = join(cwd, 'sessions');
    await mkdir(join(legacy, '01J0A'), { recursive: true });
    await writeFile(join(legacy, '01J0A', 'transcript.jsonl'), '{}\n', 'utf8');

    const r = await migrateLegacySessions({ cwd });
    expect(r.entries[0].action).toBe('already-migrated');
    // Source should still exist (we don't delete to avoid data loss)
    expect(async () => await stat(join(legacy, '01J0A'))).not.toThrow();
  });

  it('--dry-run does not move anything', async () => {
    const legacy = join(cwd, 'sessions');
    await mkdir(join(legacy, '01J0A'), { recursive: true });
    await writeFile(join(legacy, '01J0A', 'transcript.jsonl'), '{}\n', 'utf8');

    const r = await migrateLegacySessions({ cwd, dryRun: true });
    expect(r.dryRun).toBe(true);
    expect(r.entries[0].action).toBe('moved');
    expect(r.entries[0].reason).toContain('dry-run');
    // Source still there
    await stat(join(legacy, '01J0A'));
    // Dest not created
    const destDir = await getSessionsDir(cwd);
    expect(async () => await readdir(destDir)).rejects.toThrow();
  });

  it('mixed: one moves, one already migrated', async () => {
    // Pre-create destination for one
    const destDir = await getSessionsDir(cwd);
    await mkdir(join(destDir, '01J0A'), { recursive: true });
    await writeFile(join(destDir, '01J0A', 'transcript.jsonl'), '{}\n', 'utf8');

    const legacy = join(cwd, 'sessions');
    await mkdir(join(legacy, '01J0A'), { recursive: true });
    await writeFile(join(legacy, '01J0A', 'transcript.jsonl'), '{}\n', 'utf8');
    await mkdir(join(legacy, '01J0B'), { recursive: true });
    await writeFile(join(legacy, '01J0B', 'transcript.jsonl'), '{}\n', 'utf8');

    const r = await migrateLegacySessions({ cwd });
    const byId: Record<string, string> = {};
    for (const e of r.entries) byId[e.session_id] = e.action;
    expect(byId['01J0A']).toBe('already-migrated');
    expect(byId['01J0B']).toBe('moved');
    // Legacy dir kept (not empty — 01J0A still there)
    expect(r.removedLegacyDir).toBe(false);
  });

  it('formatMigrateResult produces a stable summary', async () => {
    const legacy = join(cwd, 'sessions');
    await mkdir(join(legacy, '01J0A'), { recursive: true });
    await writeFile(join(legacy, '01J0A', 'transcript.jsonl'), '{}\n', 'utf8');

    const r = await migrateLegacySessions({ cwd });
    const out = formatMigrateResult(r);
    expect(out).toContain('legacy dir:');
    expect(out).toContain('dest project:');
    expect(out).toContain('moved');
    expect(out).toContain('01J0A');
    expect(out).toContain('removed empty legacy dir');
  });
});
