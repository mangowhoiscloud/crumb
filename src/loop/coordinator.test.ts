/**
 * runSession tests — three coupled focuses:
 *   1. P0 race fix: fromOffset = byte size before replay (no double-reduce);
 *      session.start/goal idempotency guard (no double-spawn on resume).
 *   2. v3.2 session_wall_clock guardrail (24min hook, 30min hard cap).
 *   3. Fresh-session kickoff (synthetic session.start + goal append).
 */

import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { runSession } from './coordinator.js';
import { TranscriptWriter, _resetWriterRegistryForTests } from '../transcript/writer.js';
import type { Message } from '../protocol/types.js';

async function makeSession(): Promise<{
  sessionDir: string;
  transcriptPath: string;
  repoRoot: string;
}> {
  const dir = await mkdtemp(resolve(tmpdir(), 'crumb-coordinator-test-'));
  const sessionDir = resolve(dir, 'session');
  await mkdir(sessionDir, { recursive: true });
  // Stub agents/<name>.md so dispatcher's sandwich resolution doesn't ENOENT.
  const repoRoot = resolve(dir, 'repo');
  await mkdir(resolve(repoRoot, 'agents'), { recursive: true });
  for (const name of ['planner-lead', 'builder', 'verifier', 'builder-fallback', 'coordinator']) {
    await writeFile(resolve(repoRoot, 'agents', `${name}.md`), `# stub ${name}\n`);
  }
  const transcriptPath = resolve(sessionDir, 'transcript.jsonl');
  return { sessionDir, transcriptPath, repoRoot };
}

async function readEvents(path: string): Promise<Message[]> {
  const raw = await readFile(path, 'utf8');
  return raw
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as Message);
}

describe('runSession resume idempotency', () => {
  it('skips session.start + goal append when transcript already started', async () => {
    _resetWriterRegistryForTests();
    const { sessionDir, transcriptPath, repoRoot } = await makeSession();
    const sessionId = 'sess-resume-1';

    const seedWriter = new TranscriptWriter({ path: transcriptPath, sessionId });
    await seedWriter.append({
      session_id: sessionId,
      from: 'system',
      kind: 'session.start',
      body: `session ${sessionId} started`,
    });
    await seedWriter.append({
      session_id: sessionId,
      from: 'user',
      kind: 'goal',
      body: 'pre-existing goal',
    });
    const sizeBefore = (await stat(transcriptPath)).size;
    const linesBefore = (await readFile(transcriptPath, 'utf8'))
      .split('\n')
      .filter((l) => l.trim().length > 0).length;

    _resetWriterRegistryForTests();

    await runSession({
      goal: 'this goal must NOT be appended',
      sessionDir,
      sessionId,
      repoRoot,
      adapterOverride: 'mock',
      idleTimeoutMs: 200,
    });

    const sizeAfter = (await stat(transcriptPath)).size;
    const linesAfter = (await readFile(transcriptPath, 'utf8'))
      .split('\n')
      .filter((l) => l.trim().length > 0).length;

    expect(sizeAfter).toBe(sizeBefore);
    expect(linesAfter).toBe(linesBefore);
  }, 10_000);

  it('does not re-emit replayed events to the tail (no double-reduce)', async () => {
    _resetWriterRegistryForTests();
    const { sessionDir, transcriptPath, repoRoot } = await makeSession();
    const sessionId = 'sess-resume-2';

    const seedWriter = new TranscriptWriter({ path: transcriptPath, sessionId });
    await seedWriter.append({
      session_id: sessionId,
      from: 'system',
      kind: 'session.start',
      body: `session ${sessionId} started`,
    });
    await seedWriter.append({
      session_id: sessionId,
      from: 'user',
      kind: 'goal',
      body: 'seeded goal',
    });
    await seedWriter.append({
      session_id: sessionId,
      from: 'planner-lead',
      kind: 'spec',
      data: { acceptance_criteria: ['ac1', 'ac2'] },
    });
    const sizeBefore = (await stat(transcriptPath)).size;
    _resetWriterRegistryForTests();

    const { state } = await runSession({
      goal: 'ignored',
      sessionDir,
      sessionId,
      repoRoot,
      adapterOverride: 'mock',
      idleTimeoutMs: 200,
    });

    expect(state.task_ledger.facts).toHaveLength(3);

    const sizeAfter = (await stat(transcriptPath)).size;
    expect(sizeAfter).toBe(sizeBefore);
  }, 10_000);

  it('writes session.start + goal on a fresh session', async () => {
    _resetWriterRegistryForTests();
    const { sessionDir, transcriptPath, repoRoot } = await makeSession();
    const sessionId = 'sess-fresh-1';
    await writeFile(transcriptPath, '');

    await runSession({
      goal: 'fresh goal',
      sessionDir,
      sessionId,
      repoRoot,
      adapterOverride: 'mock',
      idleTimeoutMs: 200,
    });

    const lines = (await readFile(transcriptPath, 'utf8'))
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l) as { kind: string; body?: string });

    expect(lines.some((m) => m.kind === 'session.start')).toBe(true);
    expect(lines.some((m) => m.kind === 'goal' && m.body === 'fresh goal')).toBe(true);
  }, 10_000);
});

describe('runSession wall_clock budget', () => {
  it('emits done(wall_clock_exhausted) when hard cap is crossed', async () => {
    _resetWriterRegistryForTests();
    const { sessionDir, transcriptPath, repoRoot } = await makeSession();

    const result = await runSession({
      goal: 'force wall-clock timeout',
      sessionDir,
      sessionId: 'sess-wallclock-1',
      repoRoot,
      adapterOverride: 'mock',
      idleTimeoutMs: 5_000,
      wallClockHookMs: 20,
      wallClockHardMs: 50,
      watchdogTickMs: 10,
    });

    expect(result.state.done).toBe(true);

    const events = await readEvents(transcriptPath);
    const done = events.find((e) => e.kind === 'done');
    expect(done).toBeDefined();
    expect(done?.body).toBe('wall_clock_exhausted');

    const sessionEnd = events.find((e) => e.kind === 'session.end');
    expect(sessionEnd).toBeDefined();
  }, 10_000);

  it('does not trip wall-clock when caps are wide and session ends naturally', async () => {
    _resetWriterRegistryForTests();
    const { sessionDir, transcriptPath, repoRoot } = await makeSession();

    await runSession({
      goal: 'normal session',
      sessionDir,
      sessionId: 'sess-wallclock-2',
      repoRoot,
      adapterOverride: 'mock',
      idleTimeoutMs: 200,
      wallClockHookMs: 60_000,
      wallClockHardMs: 120_000,
    });

    const events = await readEvents(transcriptPath);
    const done = events.find((e) => e.kind === 'done');
    if (done) expect(done.body).not.toBe('wall_clock_exhausted');
  }, 10_000);
});
