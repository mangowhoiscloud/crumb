import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { metaPath, newMeta, readMeta, updateMeta, writeMeta } from './meta.js';

describe('session meta.json', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'crumb-meta-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('newMeta sets status=running and timestamps', () => {
    const m = newMeta({ sessionId: '01J0', goal: 'test', preset: 'mock' });
    expect(m.schema_version).toBe(1);
    expect(m.session_id).toBe('01J0');
    expect(m.status).toBe('running');
    expect(m.goal).toBe('test');
    expect(m.preset).toBe('mock');
    expect(m.started_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('newMeta accepts optional fork lineage + label', () => {
    const m = newMeta({
      sessionId: '01J1',
      parentSessionId: '01J0',
      forkEventId: '01JABC',
      label: 'fork-test',
    });
    expect(m.parent_session_id).toBe('01J0');
    expect(m.fork_event_id).toBe('01JABC');
    expect(m.label).toBe('fork-test');
  });

  it('readMeta returns null when meta.json missing', async () => {
    expect(await readMeta(dir)).toBeNull();
  });

  it('writeMeta + readMeta roundtrip', async () => {
    const m = newMeta({ sessionId: '01J0', goal: 'roundtrip' });
    await writeMeta(dir, m);
    const back = await readMeta(dir);
    expect(back).toEqual(m);
  });

  it('writeMeta produces pretty-printed JSON ending with newline', async () => {
    const m = newMeta({ sessionId: '01J0' });
    await writeMeta(dir, m);
    const { readFile } = await import('node:fs/promises');
    const raw = await readFile(metaPath(dir), 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(raw).toContain('  "session_id"');
  });

  it('updateMeta merges patch and writes back', async () => {
    await writeMeta(dir, newMeta({ sessionId: '01J0', goal: 'g' }));
    const next = await updateMeta(dir, { status: 'done', ended_at: '2026-05-02T00:00:00Z' });
    expect(next?.status).toBe('done');
    expect(next?.ended_at).toBe('2026-05-02T00:00:00Z');
    expect(next?.goal).toBe('g'); // preserved
    const onDisk = await readMeta(dir);
    expect(onDisk?.status).toBe('done');
  });

  it('updateMeta returns null when meta.json absent (cannot patch what does not exist)', async () => {
    expect(await updateMeta(dir, { status: 'done' })).toBeNull();
  });

  it('readMeta tolerates corrupt JSON without throwing', async () => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(metaPath(dir), '{not json', 'utf8');
    expect(await readMeta(dir)).toBeNull();
  });
});
