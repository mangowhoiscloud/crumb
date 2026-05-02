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

import { mkdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

import { reduce } from '../reducer/index.js';
import { initialState, type CrumbState } from '../state/types.js';
import { tail, readAll } from '../transcript/reader.js';
import { getTranscriptWriter } from '../transcript/writer.js';
import { dispatch, type DispatcherDeps } from '../dispatcher/live.js';
import { loadPresetWithConfig, type PresetSpec } from '../dispatcher/preset-loader.js';
import { AdapterRegistry } from '../adapters/types.js';
import { ClaudeLocalAdapter } from '../adapters/claude-local.js';
import { CodexLocalAdapter } from '../adapters/codex-local.js';
import { GeminiLocalAdapter } from '../adapters/gemini-local.js';
import { GeminiSdkAdapter } from '../adapters/gemini-sdk.js';
import { MockAdapter } from '../adapters/mock.js';
import { renderSummary } from '../summary/render.js';
import { serialize as serializeExport } from '../exporter/otel.js';
import { startInboxWatcher, type InboxWatcherHandle } from '../inbox/watcher.js';
import type { Effect } from '../effects/types.js';
import type { Message } from '../protocol/types.js';

export interface RunOptions {
  goal: string;
  sessionDir: string;
  sessionId: string;
  repoRoot: string;
  /** Force every actor to use this adapter id (e.g. "mock" for the demo). */
  adapterOverride?: string;
  /** Load .crumb/presets/<name>.toml for actor binding. User-controlled, no auto-default. */
  presetName?: string;
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

  const writer = getTranscriptWriter({
    path: transcriptPath,
    sessionId: opts.sessionId,
  });

  const registry = new AdapterRegistry();
  registry.register(new ClaudeLocalAdapter());
  registry.register(new CodexLocalAdapter());
  registry.register(new GeminiLocalAdapter());
  registry.register(new GeminiSdkAdapter());
  registry.register(new MockAdapter());

  // Preset 로딩 — 사용자 명시 시만. ambient/binding 결정은 사용자 통제권.
  // .crumb/config.toml override 도 함께 적용 (provider 활성화 + per-actor effort/model).
  let preset: PresetSpec | undefined;
  let providersEnabled: Record<string, boolean> | undefined;
  if (opts.presetName) {
    try {
      const result = await loadPresetWithConfig(opts.presetName, opts.repoRoot);
      preset = result.preset;
      providersEnabled = result.providersEnabled;
      const actorCount = Object.keys(preset.actors).length;
      // eslint-disable-next-line no-console
      console.log(
        `[crumb] preset loaded: ${preset.meta.name} — ${actorCount} actor(s), schema=${preset.meta.schema ?? '(unset)'}`,
      );
      for (const [name, b] of Object.entries(preset.actors)) {
        const effortLabel = b.effort ? ` effort=${b.effort}` : '';
        // eslint-disable-next-line no-console
        console.log(
          `[crumb]   ${name}: ${b.harness}/${b.provider}/${b.model}${effortLabel}${b.ambient_resolved ? ' (ambient)' : ''}`,
        );
      }
      const disabled = Object.entries(providersEnabled).filter(([, v]) => !v);
      if (disabled.length > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[crumb]   providers disabled: ${disabled.map(([h]) => h).join(', ')} → claude-local fallback`,
        );
      }
    } catch (err) {
      throw new Error(
        `Failed to load preset "${opts.presetName}" from ${opts.repoRoot}/.crumb/presets/: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const deps: DispatcherDeps = {
    writer,
    registry,
    sessionId: opts.sessionId,
    sessionDir: opts.sessionDir,
    transcriptPath,
    repoRoot: opts.repoRoot,
    preset,
    providersEnabled,
    onHook: async (kind, body) => {
      // eslint-disable-next-line no-console
      console.log(`[hook:${kind}] ${body}`);
    },
  };

  let state = initialState(opts.sessionId);

  // Replay any pre-existing transcript — supports resume after crash.
  // Capture the file size BEFORE replay so tail() can resume from the byte
  // offset of the next-appended event, never re-emitting replayed lines.
  // (Without this, fromOffset:0 caused every replayed event to be reduced
  // a second time on resume — counters double, score_history duplicates,
  // spawn effects fire twice.)
  const replayEndOffset = await safeStatSize(transcriptPath);
  const replayed = await readAll(transcriptPath);
  let alreadyStarted = false;
  for (const event of replayed) {
    if (event.kind === 'session.start' && event.session_id === opts.sessionId) {
      alreadyStarted = true;
    }
    state = reduce(state, event).state;
  }

  // Idempotent session.start + goal: on resume the transcript already has
  // a session.start for this id; appending another would double-spawn
  // planner-lead from the duplicated goal event (the session.start itself
  // is harmless — reducer is a no-op for goal=null state, but goal is not).
  if (!alreadyStarted) {
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
  }

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
    let inboxHandle: InboxWatcherHandle | null = null;
    let resolved = false;

    const emitSummary = async (final: CrumbState): Promise<void> => {
      try {
        const events = await readAll(transcriptPath);
        const html = renderSummary(events, final, { presetName: opts.presetName });
        await writeFile(resolve(opts.sessionDir, 'index.html'), html, 'utf8');
        const exportsDir = resolve(opts.sessionDir, 'exports');
        await mkdir(exportsDir, { recursive: true });
        await writeFile(
          resolve(exportsDir, 'otel.jsonl'),
          serializeExport('otel-jsonl', events),
          'utf8',
        );
        await writeFile(
          resolve(exportsDir, 'anthropic-trace.json'),
          serializeExport('anthropic-trace', events),
          'utf8',
        );
        await writeFile(
          resolve(exportsDir, 'chrome-trace.json'),
          serializeExport('chrome-trace', events),
          'utf8',
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[crumb] summary emit failed:', err instanceof Error ? err.message : err);
      }
    };

    const finish = (result: { state: CrumbState }): void => {
      if (resolved) return;
      resolved = true;
      handle?.close();
      inboxHandle?.stop();
      // Emit summary + exports asynchronously; resolve outer promise after.
      void emitSummary(result.state).then(() => resolveOuter(result));
    };

    const fail = (err: unknown): void => {
      if (resolved) return;
      resolved = true;
      handle?.close();
      inboxHandle?.stop();
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

    // v3.2 G2 — headless inbox.txt watcher. User can append slash-commands /
    // free text to sessions/<id>/inbox.txt without needing the TUI; lines are
    // parsed and appended to the transcript like any other user.* event.
    const inboxPath = resolve(opts.sessionDir, 'inbox.txt');
    inboxHandle = startInboxWatcher({
      inboxPath,
      sessionId: opts.sessionId,
      writer,
      onError: (err) => {
        // eslint-disable-next-line no-console
        console.error('[crumb] inbox watcher error:', err.message);
      },
    });

    // PR #7 race fix: tail starts at the byte offset captured before replay —
    // guarantees that every replayed event was reduced exactly once and tail
    // picks up only the synthetic appends + future subprocess writes.
    tail(transcriptPath, onMessage, { fromOffset: replayEndOffset })
      .then((h) => {
        handle = h;
      })
      .catch(fail);
  });
}

async function safeStatSize(path: string): Promise<number> {
  try {
    return (await stat(path)).size;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw e;
  }
}
