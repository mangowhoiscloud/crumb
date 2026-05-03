/**
 * runSession tests — three coupled focuses:
 *   1. P0 race fix: fromOffset = byte size before replay (no double-reduce);
 *      session.start/goal idempotency guard (no double-spawn on resume).
 *   2. v0.2.0 session_wall_clock guardrail (24min hook, 30min hard cap).
 *   3. Fresh-session kickoff (synthetic session.start + goal append).
 */

import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { runSession } from './coordinator.js';
import { TranscriptWriter, _resetWriterRegistryForTests } from '../transcript/writer.js';
import type { Message } from '../protocol/types.js';
import type { Adapter, SpawnRequest, SpawnResult } from '../adapters/types.js';

// Wall-clock-budget test fixture — hangs until aborted so the watchdog
// reliably trips before any natural verdict path completes.
class HangingAdapter implements Adapter {
  readonly id = 'hanging';
  async health(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
  async spawn(req: SpawnRequest): Promise<SpawnResult> {
    return new Promise<SpawnResult>((resolveResult) => {
      const start = Date.now();
      req.signal?.addEventListener(
        'abort',
        () =>
          resolveResult({
            exitCode: 124,
            stdout: '',
            stderr: 'aborted',
            durationMs: Date.now() - start,
          }),
        { once: true },
      );
    });
  }
}

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
  for (const name of ['planner-lead', 'builder', 'verifier', 'coordinator']) {
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

    // Use a hanging adapter so the planner spawn never returns events. With
    // mock as the default, the canned planner→builder→verifier path can
    // race the watchdog and finish with verdict_pass first. Hanging guarantees
    // the wall-clock hard cap is the only terminal path.
    const result = await runSession({
      goal: 'force wall-clock timeout',
      sessionDir,
      sessionId: 'sess-wallclock-1',
      repoRoot,
      adapterOverride: 'hanging',
      extraAdapters: [new HangingAdapter()],
      idleTimeoutMs: 5_000,
      wallClockHookMs: 20,
      wallClockHardMs: 100,
      watchdogTickMs: 20,
      // Per-spawn timeout above hard cap — wall-clock kicks in first.
      perSpawnTimeoutMs: 200,
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

/**
 * v0.4 immediate-wake regression guard.
 *
 * The chain reduce + dispatch must be DECOUPLED — reducer runs synchronously
 * in-order so state is consistent, but each event's effects fire async so a
 * long-running prior spawn does not block the next event from being reduced
 * + dispatched.
 *
 * This test pins the property by registering a SlowSpawnAdapter that emits
 * its terminal event quickly but takes a long time to "exit". With the old
 * `processing.then(await dispatch)` chain, a follow-up event from the same
 * subprocess would wait for the prior spawn to fully resolve before its
 * reducer runs. With the new design, the follow-up event reduces immediately.
 */
class SlowSpawnAdapter implements Adapter {
  readonly id = 'slow-spawn';
  // ms to delay the spawn promise resolution AFTER terminal event is emitted.
  // Tests pass small values to avoid 30s waits.
  constructor(
    private readonly emitFn: (sessionId: string, transcriptPath: string) => Promise<void>,
    private readonly postEmitDelayMs: number,
  ) {}
  async health(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
  async spawn(req: SpawnRequest): Promise<SpawnResult> {
    const start = Date.now();
    // Emit terminal event quickly (mimics a real agent finishing its turn).
    await this.emitFn(req.sessionId, req.transcriptPath);
    // Linger before resolving — old chain waited for THIS to finish before
    // reducing the just-emitted terminal event. New chain doesn't wait.
    await new Promise<void>((r) => setTimeout(r, this.postEmitDelayMs));
    return { exitCode: 0, stdout: '', stderr: '', durationMs: Date.now() - start };
  }
}

describe('v0.4 immediate-wake — reduce/dispatch decoupling', () => {
  it('reduces terminal events while prior spawn is still in flight', async () => {
    _resetWriterRegistryForTests();
    const { sessionDir, transcriptPath, repoRoot } = await makeSession();
    const sessionId = 'sess-immediate-wake-1';

    // Track when each spawn STARTS — the second spawn should start before the
    // first spawn fully resolves (postEmitDelayMs has not yet elapsed).
    const spawnStartTimes: Record<string, number> = {};

    // planner-lead emits `spec` quickly, then lingers 800ms before exit.
    const plannerAdapter = new SlowSpawnAdapter(async (sid, path) => {
      spawnStartTimes['planner-lead'] = Date.now();
      const w = new TranscriptWriter({ path, sessionId: sid });
      await w.append({
        session_id: sid,
        from: 'planner-lead',
        kind: 'spec',
        data: { acceptance_criteria: ['ac1'] },
      });
    }, 800);

    // builder is dispatched after spec → should start IMMEDIATELY after spec
    // is reduced, NOT after planner-lead spawn fully exits.
    const builderAdapter = new SlowSpawnAdapter(async (sid, path) => {
      spawnStartTimes['builder'] = Date.now();
      const w = new TranscriptWriter({ path, sessionId: sid });
      await w.append({
        session_id: sid,
        from: 'builder',
        kind: 'build',
        body: 'stub build',
      });
    }, 100);

    // Single adapter routes by actor — override 'mock' so every spawn is
    // forced through this stub regardless of reducer pickAdapter defaults.
    class RouterAdapter implements Adapter {
      readonly id = 'mock';
      async health(): Promise<{ ok: boolean }> {
        return { ok: true };
      }
      async spawn(req: SpawnRequest): Promise<SpawnResult> {
        if (req.actor === 'planner-lead') return plannerAdapter.spawn(req);
        if (req.actor === 'builder') return builderAdapter.spawn(req);
        return { exitCode: 0, stdout: '', stderr: '', durationMs: 0 };
      }
    }

    await runSession({
      goal: 'immediate-wake regression test',
      sessionDir,
      sessionId,
      repoRoot,
      adapterOverride: 'mock',
      idleTimeoutMs: 500,
      extraAdapters: [new RouterAdapter()],
    });

    // Both spawns must have happened.
    expect(spawnStartTimes['planner-lead']).toBeDefined();
    expect(spawnStartTimes['builder']).toBeDefined();
    // Builder must start within 600ms of planner-lead — well before
    // planner's 800ms post-emit delay would let the old chain unblock.
    const gap = spawnStartTimes['builder']! - spawnStartTimes['planner-lead']!;
    expect(gap).toBeLessThan(600);
  }, 15_000);
});
