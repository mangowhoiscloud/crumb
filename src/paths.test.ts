/**
 * Tests for src/paths.ts — project id resolution + session dir lookup.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CRUMB_HOME_ENV,
  PROJECT_PIN_DIR,
  PROJECT_PIN_FILE,
  ensureCrumbHome,
  ensureProjectDir,
  ensureSessionRoot,
  getActorWorkspace,
  getArtifactsDir,
  getCrumbHome,
  getProjectDir,
  getSessionRoot,
  getSessionsDir,
  getVersionsDir,
  projectIdFromCwd,
  resolveProjectId,
  resolveSessionDir,
} from './paths.js';

describe('paths', () => {
  let tmp: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'crumb-paths-'));
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

  it('CRUMB_HOME env override is honored', () => {
    expect(getCrumbHome()).toBe(join(tmp, '.crumb'));
  });

  it('projectIdFromCwd is deterministic and 16 hex chars', () => {
    const a = projectIdFromCwd('/Users/x/proj');
    const b = projectIdFromCwd('/Users/x/proj');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{16}$/);
  });

  it('projectIdFromCwd canonicalizes paths', () => {
    const a = projectIdFromCwd('/Users/x/proj');
    const b = projectIdFromCwd('/Users/x/proj/');
    expect(a).toBe(b);
  });

  it('resolveProjectId returns ambient hash when no pin file', async () => {
    const cwd = await mkdtemp(join(tmp, 'cwd-'));
    expect(await resolveProjectId(cwd)).toBe(projectIdFromCwd(cwd));
  });

  it('resolveProjectId reads pinned id from <cwd>/.crumb/project.toml', async () => {
    const cwd = await mkdtemp(join(tmp, 'cwd-'));
    await mkdir(join(cwd, PROJECT_PIN_DIR), { recursive: true });
    await writeFile(
      join(cwd, PROJECT_PIN_DIR, PROJECT_PIN_FILE),
      'id = "01J0TESTPROJECT123456789AB"\nlabel = "demo"\n',
    );
    expect(await resolveProjectId(cwd)).toBe('01J0TESTPROJECT123456789AB');
  });

  it('resolveProjectId accepts project_id alias key', async () => {
    const cwd = await mkdtemp(join(tmp, 'cwd-'));
    await mkdir(join(cwd, PROJECT_PIN_DIR), { recursive: true });
    await writeFile(join(cwd, PROJECT_PIN_DIR, PROJECT_PIN_FILE), 'project_id = "01J0AB"\n');
    expect(await resolveProjectId(cwd)).toBe('01J0AB');
  });

  it('getProjectDir maps to ~/.crumb/projects/<id>/', async () => {
    const cwd = await mkdtemp(join(tmp, 'cwd-'));
    const dir = await getProjectDir(cwd);
    expect(dir).toBe(join(tmp, '.crumb', 'projects', projectIdFromCwd(cwd)));
  });

  it('getSessionRoot composes project / sessions / id', async () => {
    const cwd = await mkdtemp(join(tmp, 'cwd-'));
    const root = await getSessionRoot(cwd, '01J123');
    expect(root).toBe(join(tmp, '.crumb', 'projects', projectIdFromCwd(cwd), 'sessions', '01J123'));
  });

  it('getActorWorkspace places per-actor sandbox under session', async () => {
    const cwd = await mkdtemp(join(tmp, 'cwd-'));
    const ws = await getActorWorkspace(cwd, '01J123', 'builder');
    expect(ws).toBe(
      join(
        tmp,
        '.crumb',
        'projects',
        projectIdFromCwd(cwd),
        'sessions',
        '01J123',
        'agent-workspace',
        'builder',
      ),
    );
  });

  it('getArtifactsDir places artifacts under session', async () => {
    const cwd = await mkdtemp(join(tmp, 'cwd-'));
    const a = await getArtifactsDir(cwd, '01J');
    expect(a.endsWith(join('sessions', '01J', 'artifacts'))).toBe(true);
  });

  it('getSessionsDir and getVersionsDir are siblings under project', async () => {
    const cwd = await mkdtemp(join(tmp, 'cwd-'));
    const s = await getSessionsDir(cwd);
    const v = await getVersionsDir(cwd);
    expect(s.endsWith('/sessions')).toBe(true);
    expect(v.endsWith('/versions')).toBe(true);
    expect(join(s, '..')).toBe(join(v, '..'));
  });

  it('ensureCrumbHome creates projects/ and presets/ idempotently', async () => {
    await ensureCrumbHome();
    await ensureCrumbHome();
    const home = getCrumbHome();
    const { stat } = await import('node:fs/promises');
    expect((await stat(join(home, 'projects'))).isDirectory()).toBe(true);
    expect((await stat(join(home, 'presets'))).isDirectory()).toBe(true);
  });

  it('ensureProjectDir creates sessions/ and versions/', async () => {
    const cwd = await mkdtemp(join(tmp, 'cwd-'));
    const dir = await ensureProjectDir(cwd);
    const { stat } = await import('node:fs/promises');
    expect((await stat(join(dir, 'sessions'))).isDirectory()).toBe(true);
    expect((await stat(join(dir, 'versions'))).isDirectory()).toBe(true);
  });

  it('ensureSessionRoot creates artifacts/', async () => {
    const cwd = await mkdtemp(join(tmp, 'cwd-'));
    const root = await ensureSessionRoot(cwd, '01J');
    const { stat } = await import('node:fs/promises');
    expect((await stat(join(root, 'artifacts'))).isDirectory()).toBe(true);
  });

  describe('resolveSessionDir', () => {
    it('treats path-like ref as path', async () => {
      const ref = join(tmp, 'some', 'dir');
      const r = await resolveSessionDir(ref, tmp);
      expect(r).toBe(ref);
    });

    it('bare ULID resolves to new global location when present', async () => {
      const cwd = await mkdtemp(join(tmp, 'cwd-'));
      const sessionId = '01J0NEW';
      await ensureSessionRoot(cwd, sessionId);
      const r = await resolveSessionDir(sessionId, cwd);
      expect(r).toBe(await getSessionRoot(cwd, sessionId));
    });

    it('bare ULID falls back to legacy <cwd>/sessions/<id>/ if global absent', async () => {
      const cwd = await mkdtemp(join(tmp, 'cwd-'));
      const sessionId = '01J0LEGACY';
      const legacyDir = join(cwd, 'sessions', sessionId);
      await mkdir(legacyDir, { recursive: true });
      const r = await resolveSessionDir(sessionId, cwd);
      expect(r).toBe(legacyDir);
    });

    it('bare ULID with neither location present defaults to new path', async () => {
      const cwd = await mkdtemp(join(tmp, 'cwd-'));
      const sessionId = '01J0MISSING';
      const r = await resolveSessionDir(sessionId, cwd);
      expect(r).toBe(await getSessionRoot(cwd, sessionId));
    });
  });
});
