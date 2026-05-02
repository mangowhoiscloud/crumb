import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Message } from '../protocol/types.js';

import {
  deriveScorecard,
  deriveSourceEventId,
  nextSequentialVersion,
  readAllManifests,
  readManifest,
  snapshotArtifacts,
  versionDirName,
  writeManifest,
  type VersionManifest,
} from './version.js';

describe('version', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'crumb-version-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  describe('versionDirName', () => {
    it('returns just the name when no label', () => {
      expect(versionDirName('v1')).toBe('v1');
    });
    it('joins name + slugified label', () => {
      expect(versionDirName('v2', 'Combo Bonus')).toBe('v2-combo-bonus');
      expect(versionDirName('v3', 'BAGELCODE final!')).toBe('v3-bagelcode-final');
    });
    it('falls back to bare name when label slugifies to empty', () => {
      expect(versionDirName('v1', '!!!')).toBe('v1');
    });
  });

  describe('nextSequentialVersion', () => {
    it('returns v1 when versions/ does not exist', async () => {
      expect(await nextSequentialVersion(join(dir, 'missing'))).toBe('v1');
    });
    it('returns v1 when versions/ is empty', async () => {
      const v = join(dir, 'versions');
      await mkdir(v, { recursive: true });
      expect(await nextSequentialVersion(v)).toBe('v1');
    });
    it('returns vN+1 from highest existing v<N>', async () => {
      const v = join(dir, 'versions');
      await mkdir(join(v, 'v1'), { recursive: true });
      await mkdir(join(v, 'v3-combo'), { recursive: true });
      await mkdir(join(v, 'v2-tuning'), { recursive: true });
      expect(await nextSequentialVersion(v)).toBe('v4');
    });
    it('ignores entries that do not start with v<digit>', async () => {
      const v = join(dir, 'versions');
      await mkdir(join(v, 'random'), { recursive: true });
      await mkdir(join(v, 'v2'), { recursive: true });
      expect(await nextSequentialVersion(v)).toBe('v3');
    });
  });

  describe('manifest read/write', () => {
    it('roundtrip preserves all fields', async () => {
      const m: VersionManifest = {
        schema_version: 1,
        name: 'v2',
        label: 'combo-bonus',
        released_at: '2026-05-02T12:00:00Z',
        source_session: '01JABC',
        source_event_id: '01JEND',
        parent_version: 'v1',
        goal: 'match-3 with combo',
        scorecard: { D1: 5, D2: 4, aggregate: 25, verdict: 'PASS' },
        artifacts_sha256: { 'game.html': 'a'.repeat(64) },
      };
      const versionDir = join(dir, 'v2');
      await writeManifest(versionDir, m);
      const back = await readManifest(versionDir);
      expect(back).toEqual(m);
    });

    it('readManifest returns null when missing', async () => {
      expect(await readManifest(join(dir, 'nope'))).toBeNull();
    });

    it('readManifest tolerates malformed TOML', async () => {
      const versionDir = join(dir, 'v1');
      await mkdir(versionDir, { recursive: true });
      await writeFile(join(versionDir, 'manifest.toml'), '!!! not toml', 'utf8');
      expect(await readManifest(versionDir)).toBeNull();
    });

    it('readAllManifests sorts by released_at ascending', async () => {
      const versionsDir = join(dir, 'versions');
      await writeManifest(join(versionsDir, 'v2'), {
        schema_version: 1,
        name: 'v2',
        released_at: '2026-05-02T12:00:00Z',
        source_session: '01J',
      });
      await writeManifest(join(versionsDir, 'v1'), {
        schema_version: 1,
        name: 'v1',
        released_at: '2026-05-01T12:00:00Z',
        source_session: '01J',
      });
      const all = await readAllManifests(versionsDir);
      expect(all.map((m) => m.name)).toEqual(['v1', 'v2']);
    });

    it('readAllManifests returns [] when versions/ missing', async () => {
      expect(await readAllManifests(join(dir, 'missing'))).toEqual([]);
    });
  });

  describe('deriveScorecard', () => {
    it('returns undefined when no judge.score events', () => {
      const events: Message[] = [
        { id: '1', ts: '', session_id: 's', from: 'user', kind: 'goal' } as Message,
      ];
      expect(deriveScorecard(events)).toBeUndefined();
    });

    it('extracts D1-D6 + verdict + aggregate from last judge.score', () => {
      const events: Message[] = [
        {
          id: '1',
          ts: '',
          session_id: 's',
          from: 'verifier',
          kind: 'judge.score',
          scores: {
            D1: { score: 5, source: 'verifier-llm' },
            D2: { score: 4, source: 'qa-check-effect' },
            D3: { score: 3, source: 'hybrid' },
            aggregate: 25,
            verdict: 'PASS',
          },
        } as Message,
      ];
      const card = deriveScorecard(events);
      expect(card).toEqual({ D1: 5, D2: 4, D3: 3, aggregate: 25, verdict: 'PASS' });
    });

    it('uses LAST judge.score when multiple', () => {
      const events: Message[] = [
        {
          id: '1',
          ts: '',
          session_id: 's',
          from: 'verifier',
          kind: 'judge.score',
          scores: { aggregate: 10, verdict: 'FAIL' },
        } as Message,
        {
          id: '2',
          ts: '',
          session_id: 's',
          from: 'verifier',
          kind: 'judge.score',
          scores: { aggregate: 28, verdict: 'PASS' },
        } as Message,
      ];
      expect(deriveScorecard(events)).toEqual({ aggregate: 28, verdict: 'PASS' });
    });
  });

  describe('deriveSourceEventId', () => {
    it('prefers kind=done', () => {
      const events: Message[] = [
        { id: '1', ts: '', session_id: 's', from: 'verifier', kind: 'judge.score' } as Message,
        { id: '2', ts: '', session_id: 's', from: 'coordinator', kind: 'done' } as Message,
        { id: '3', ts: '', session_id: 's', from: 'system', kind: 'session.end' } as Message,
      ];
      expect(deriveSourceEventId(events)).toBe('2');
    });
    it('falls back to last judge.score when no done', () => {
      const events: Message[] = [
        { id: '1', ts: '', session_id: 's', from: 'verifier', kind: 'judge.score' } as Message,
        { id: '2', ts: '', session_id: 's', from: 'system', kind: 'session.end' } as Message,
      ];
      expect(deriveSourceEventId(events)).toBe('1');
    });
    it('falls back to last event when neither', () => {
      const events: Message[] = [
        { id: '1', ts: '', session_id: 's', from: 'user', kind: 'goal' } as Message,
        { id: '2', ts: '', session_id: 's', from: 'planner-lead', kind: 'spec' } as Message,
      ];
      expect(deriveSourceEventId(events)).toBe('2');
    });
  });

  describe('snapshotArtifacts', () => {
    it('copies all files from sessions/<id>/artifacts/ and records sha256', async () => {
      const sessionDir = join(dir, 'sess');
      const artifactsDir = join(sessionDir, 'artifacts');
      await mkdir(artifactsDir, { recursive: true });
      await writeFile(join(artifactsDir, 'game.html'), '<html>game</html>', 'utf8');
      await writeFile(join(artifactsDir, 'spec.md'), '# spec', 'utf8');
      const versionDir = join(dir, 'v1');
      const sha = await snapshotArtifacts(sessionDir, versionDir);
      expect(Object.keys(sha).sort()).toEqual(['game.html', 'spec.md']);
      expect(sha['game.html']).toMatch(/^[a-f0-9]{64}$/);
      const { readFile } = await import('node:fs/promises');
      const copied = await readFile(join(versionDir, 'artifacts', 'game.html'), 'utf8');
      expect(copied).toBe('<html>game</html>');
    });

    it('returns {} when source artifacts/ missing', async () => {
      const sessionDir = join(dir, 'empty-sess');
      await mkdir(sessionDir, { recursive: true });
      const versionDir = join(dir, 'v1');
      expect(await snapshotArtifacts(sessionDir, versionDir)).toEqual({});
    });
  });
});
