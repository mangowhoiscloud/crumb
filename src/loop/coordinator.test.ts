/**
 * runSession resume tests — exercise the P0 race fix:
 *   1. fromOffset = byte size captured before replay (no double-reduce)
 *   2. session.start/goal idempotency guard (no double-spawn on resume)
 */

import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { runSession } from './coordinator.js';
import { TranscriptWriter, _resetWriterRegistryForTests } from '../transcript/writer.js';

async function makeSession(): Promise<{ sessionDir: string; transcriptPath: string }> {
  const dir = await mkdtemp(resolve(tmpdir(), 'crumb-coordinator-test-'));
  const sessionDir = resolve(dir, 'session');
  await mkdir(sessionDir, { recursive: true });
  const transcriptPath = resolve(sessionDir, 'transcript.jsonl');
  return { sessionDir, transcriptPath };
}

describe('runSession resume idempotency', () => {
  it('skips session.start + goal append when transcript already started', async () => {
    _resetWriterRegistryForTests();
    const { sessionDir, transcriptPath } = await makeSession();
    const sessionId = 'sess-resume-1';

    // Seed a transcript that already has session.start + goal — simulates a
    // resume after a coordinator crash, where the prior coordinator already
    // wrote both kickoff events before exiting.
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

    // Reset the registry so runSession's getTranscriptWriter creates a fresh
    // chain — otherwise the singleton would still be tied to seedWriter's
    // already-resolved Promise chain. (In production, runSession is the first
    // writer for a given path within the coordinator process.)
    _resetWriterRegistryForTests();

    await runSession({
      goal: 'this goal must NOT be appended',
      sessionDir,
      sessionId,
      repoRoot: resolve(sessionDir, '..'),
      adapterOverride: 'mock',
      idleTimeoutMs: 200,
    });

    const sizeAfter = (await stat(transcriptPath)).size;
    const linesAfter = (await readFile(transcriptPath, 'utf8'))
      .split('\n')
      .filter((l) => l.trim().length > 0).length;

    // No new session.start / goal appended — idempotency guard worked.
    expect(sizeAfter).toBe(sizeBefore);
    expect(linesAfter).toBe(linesBefore);
  }, 10_000);

  it('does not re-emit replayed events to the tail (no double-reduce)', async () => {
    _resetWriterRegistryForTests();
    const { sessionDir, transcriptPath } = await makeSession();
    const sessionId = 'sess-resume-2';

    // Seed a transcript with prior events. If tail's fromOffset were 0 (the
    // pre-fix bug), every one of these would be reduced a second time and
    // task_ledger.facts would have 6 entries instead of 3 after resume.
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
      repoRoot: resolve(sessionDir, '..'),
      adapterOverride: 'mock',
      idleTimeoutMs: 200,
    });

    // Three facts (1 goal + 2 ACs), not six. If fromOffset were 0 the
    // reducer would have run a second time on every replayed event and
    // facts.length would be doubled.
    expect(state.task_ledger.facts).toHaveLength(3);

    // No bytes added by the resume path itself. (The mock adapter may spawn
    // because state.next_speaker == 'builder' after the spec replay, but the
    // tail doesn't re-emit replayed events, so onMessage is never called for
    // them and dispatch isn't triggered for replayed kicks. We assert below.)
    const sizeAfter = (await stat(transcriptPath)).size;
    expect(sizeAfter).toBe(sizeBefore);
  }, 10_000);

  it('writes session.start + goal on a fresh session', async () => {
    _resetWriterRegistryForTests();
    const { sessionDir, transcriptPath } = await makeSession();
    const sessionId = 'sess-fresh-1';
    // Touch the file so runSession's tail() can watch it.
    await writeFile(transcriptPath, '');

    await runSession({
      goal: 'fresh goal',
      sessionDir,
      sessionId,
      repoRoot: resolve(sessionDir, '..'),
      adapterOverride: 'mock',
      idleTimeoutMs: 200,
    });

    const lines = (await readFile(transcriptPath, 'utf8'))
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l) as { kind: string; body?: string });

    // Must contain at least the synthetic session.start + goal.
    expect(lines.some((m) => m.kind === 'session.start')).toBe(true);
    expect(lines.some((m) => m.kind === 'goal' && m.body === 'fresh goal')).toBe(true);
  }, 10_000);
});
