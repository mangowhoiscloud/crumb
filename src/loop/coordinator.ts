/**
 * Coordinator main loop.
 *
 * Topology: Hub-Ledger-Spoke.
 *  1. Append the user goal to the transcript.
 *  2. Replay any prior events to build state.
 *  3. Tail the transcript: every new event runs reduce(state, event) → effects.
 *  4. Dispatch effects (spawn subprocesses, append synth messages, surface hooks).
 *  5. Stop when state.done === true (verdict=PASS / adaptive_stop / user.cancel).
 *
 * Spawn effects are the only blocking I/O — once a subprocess starts writing
 * events back to the transcript, the tail picks them up and the loop continues.
 * The spawn promise is awaited so we don't kick off a second subprocess before
 * the first finishes (single-stage owner principle, depth=1).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

import { reduce } from '../reducer/index.js';
import { initialState, type CrumbState } from '../state/types.js';
import { tail, readAll } from '../transcript/reader.js';
import { TranscriptWriter } from '../transcript/writer.js';
import { dispatch, type DispatcherDeps } from '../dispatcher/live.js';
import { AdapterRegistry } from '../adapters/types.js';
import { ClaudeLocalAdapter } from '../adapters/claude-local.js';
import { CodexLocalAdapter } from '../adapters/codex-local.js';
import { MockAdapter } from '../adapters/mock.js';
import type { Effect } from '../effects/types.js';
import type { Message } from '../protocol/types.js';

export interface RunOptions {
  goal: string;
  sessionDir: string;
  sessionId: string;
  repoRoot: string;
  /** Force every actor to use this adapter id (e.g. "mock" for the demo). */
  adapterOverride?: string;
  /** How long to wait after the last event before declaring stuck. ms. */
  idleTimeoutMs?: number;
}

export async function runSession(opts: RunOptions): Promise<{ state: CrumbState }> {
  await mkdir(opts.sessionDir, { recursive: true });
  await mkdir(resolve(opts.sessionDir, 'artifacts'), { recursive: true });
  await mkdir(resolve(opts.sessionDir, 'ledgers'), { recursive: true });
  const transcriptPath = resolve(opts.sessionDir, 'transcript.jsonl');

  // Touch the file so tail() has something to watch.
  if (!existsSync(transcriptPath)) {
    await mkdir(dirname(transcriptPath), { recursive: true });
    await writeFile(transcriptPath, '');
  }

  const writer = new TranscriptWriter({
    path: transcriptPath,
    sessionId: opts.sessionId,
  });

  const registry = new AdapterRegistry();
  registry.register(new ClaudeLocalAdapter());
  registry.register(new CodexLocalAdapter());
  registry.register(new MockAdapter());

  const deps: DispatcherDeps = {
    writer,
    registry,
    sessionId: opts.sessionId,
    sessionDir: opts.sessionDir,
    transcriptPath,
    repoRoot: opts.repoRoot,
    onHook: async (kind, body) => {
      // eslint-disable-next-line no-console
      console.log(`[hook:${kind}] ${body}`);
    },
  };

  let state = initialState(opts.sessionId);

  // Replay any pre-existing transcript — supports resume after crash.
  for (const event of await readAll(transcriptPath)) {
    state = reduce(state, event).state;
  }

  // Append session.start + user goal.
  await writer.append({
    session_id: opts.sessionId,
    from: 'system',
    kind: 'session.start',
    body: `session ${opts.sessionId} started`,
  });
  await writer.append({
    session_id: opts.sessionId,
    from: 'user',
    kind: 'goal',
    body: opts.goal,
  });

  // Apply adapter override (demo mode forces all actors to mock).
  const applyOverride = (effects: Effect[]): Effect[] => {
    if (!opts.adapterOverride) return effects;
    return effects.map((e) => (e.type === 'spawn' ? { ...e, adapter: opts.adapterOverride! } : e));
  };

  let processing: Promise<void> = Promise.resolve();
  let lastEventAt = Date.now();
  const idleMs = opts.idleTimeoutMs ?? 60_000;

  return new Promise<{ state: CrumbState }>((resolveOuter, rejectOuter) => {
    let handle: { close: () => void } | null = null;
    let resolved = false;

    const finish = (result: { state: CrumbState }): void => {
      if (resolved) return;
      resolved = true;
      handle?.close();
      resolveOuter(result);
    };

    const fail = (err: unknown): void => {
      if (resolved) return;
      resolved = true;
      handle?.close();
      rejectOuter(err);
    };

    const onMessage = (msg: Message): void => {
      lastEventAt = Date.now();
      processing = processing
        .then(async () => {
          if (state.done) return; // ignore events after terminal state
          const { state: nextState, effects } = reduce(state, msg);
          state = nextState;
          for (const eff of applyOverride(effects)) {
            await dispatch(eff, deps);
          }
          if (state.done) finish({ state });
        })
        .catch(fail);
    };

    // Idle watchdog — if no events arrive within idleMs and we're not done, stop.
    const watchdog = setInterval(() => {
      if (resolved) {
        clearInterval(watchdog);
        return;
      }
      if (Date.now() - lastEventAt > idleMs) {
        clearInterval(watchdog);
        // Drain pending then finish with whatever state we have.
        processing.finally(() => finish({ state }));
      }
    }, 1000);

    tail(transcriptPath, onMessage, { fromOffset: 0 })
      .then((h) => {
        handle = h;
      })
      .catch(fail);
  });
}
