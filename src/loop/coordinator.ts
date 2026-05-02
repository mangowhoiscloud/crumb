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
import { AdapterRegistry, type Adapter } from '../adapters/types.js';
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
  /**
   * v0.2.0 wall-clock budget (autoresearch P3). Soft hook fires once when the
   * session crosses `wallClockHookMs` of elapsed wall time; hard cap fires
   * `done(wall_clock_exhausted)` at `wallClockHardMs`. Both are measured from
   * the first session.start event's `ts` (deterministic) and compared against
   * Date.now() inside the watchdog (non-deterministic, watchdog-only — does
   * not affect replay determinism). Defaults: 24min hook, 30min hard.
   */
  wallClockHookMs?: number;
  wallClockHardMs?: number;
  /**
   * Per-spawn timeout override (ms). Forwarded to DispatcherDeps. See
   * src/dispatcher/live.ts §PER_SPAWN_TIMEOUT_MS. Default 5min.
   */
  perSpawnTimeoutMs?: number;
  /**
   * Watchdog tick interval (ms). Production default 1000 — tests pass small
   * values to exercise wall-clock budget exhaustion without waiting whole
   * seconds. Don't reduce in production; the hooks/dispatch chain inside
   * each tick is non-trivial and 1Hz polling is cheap enough.
   */
  watchdogTickMs?: number;
  /**
   * Test-only escape hatch — extra adapters registered after the four built-in
   * ones (claude-local, codex-local, gemini-local, mock). An adapter with a
   * duplicate id overwrites the built-in. Used by wall-clock budget tests to
   * register a hanging stub the mock adapter cannot impersonate.
   */
  extraAdapters?: Adapter[];
}

const WALL_CLOCK_HOOK_MS_DEFAULT = Number(process.env.CRUMB_WALL_CLOCK_HOOK_MS) || 24 * 60 * 1000;
const WALL_CLOCK_HARD_MS_DEFAULT = Number(process.env.CRUMB_WALL_CLOCK_HARD_MS) || 30 * 60 * 1000;

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
  for (const a of opts.extraAdapters ?? []) registry.register(a);

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
    perSpawnTimeoutMs: opts.perSpawnTimeoutMs,
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
  // v0.3.1: pendingItems counts onMessage chain handlers that have been queued
  // but not yet fully resolved (including their awaited dispatch effects).
  // The idle-timeout watchdog must not call finish() while pendingItems > 0,
  // otherwise a long-running dispatch (e.g. planner-spawn for 7min) would
  // settle the OLD `processing` reference but leave queued downstream items
  // (handoff.requested(researcher).reduce → dispatch(spawn-researcher)) unrun
  // before resolveOuter fires and the process exits. Observed: session
  // 01KQMFWA exited at agent.stop+7ms with state.done=false and 0 researcher
  // events despite handoff.requested being recorded.
  let pendingItems = 0;
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
      pendingItems += 1;
      processing = processing
        .then(async () => {
          try {
            if (state.done) return; // ignore events after terminal state
            const { state: nextState, effects } = reduce(state, msg);
            state = nextState;
            for (const eff of applyOverride(effects)) {
              await dispatch(eff, deps);
            }
            if (state.done) finish({ state });
          } finally {
            pendingItems -= 1;
          }
        })
        .catch(fail);
    };

    // Watchdog: idle timeout + v0.2.0 wall-clock budget guardrail.
    // Wall-clock is measured from state.progress_ledger.session_started_at
    // (the deterministic ts of the first session.start event); the watchdog
    // checks against Date.now() so the timing is real wall-clock, not
    // transcript clock.
    const wallClockHookMs = opts.wallClockHookMs ?? WALL_CLOCK_HOOK_MS_DEFAULT;
    const wallClockHardMs = opts.wallClockHardMs ?? WALL_CLOCK_HARD_MS_DEFAULT;
    let timeBudgetHookFired = false;
    const watchdog = setInterval(() => {
      if (resolved) {
        clearInterval(watchdog);
        return;
      }

      // Wall-clock budget — only meaningful once session.start has been reduced.
      const startedAt = state.progress_ledger.session_started_at;
      if (startedAt) {
        const elapsed = Date.now() - Date.parse(startedAt);
        if (elapsed >= wallClockHardMs) {
          clearInterval(watchdog);
          // Append done + session.end via dispatch; force state.done so any
          // in-flight processing chain stops accepting new events.
          state = { ...state, done: true };
          void processing
            .finally(() =>
              dispatch({ type: 'done', reason: 'wall_clock_exhausted' }, deps).then(() =>
                finish({ state }),
              ),
            )
            .catch(fail);
          return;
        }
        if (!timeBudgetHookFired && elapsed >= wallClockHookMs) {
          timeBudgetHookFired = true;
          // Fire-and-forget — hook is a notification, the session continues.
          void dispatch(
            {
              type: 'hook',
              kind: 'time_budget',
              body: `session wall-clock ${Math.floor(elapsed / 1000)}s crossed ${Math.floor(
                wallClockHookMs / 1000,
              )}s (hard cap ${Math.floor(wallClockHardMs / 1000)}s)`,
              data: {
                elapsed_ms: elapsed,
                threshold_ms: wallClockHookMs,
                hard_cap_ms: wallClockHardMs,
              },
            },
            deps,
          ).catch((err) => {
            // eslint-disable-next-line no-console
            console.error('[crumb] time_budget hook dispatch failed:', err);
          });
        }
      }

      if (Date.now() - lastEventAt > idleMs && pendingItems === 0) {
        // v0.3.1: only fire finish when the chain has truly drained AND no new
        // events have arrived for idleMs. The previous `processing.finally()`
        // grabbed a snapshot of the chain tail at that instant; subsequent
        // chain extensions (e.g. handoff.requested(researcher) → dispatch
        // spawn researcher) didn't extend the snapshot, so finish() fired
        // before researcher could even start. Tracking pendingItems lets the
        // watchdog distinguish "idle + chain empty" (true done) from "idle +
        // chain still draining" (keep waiting).
        clearInterval(watchdog);
        finish({ state });
      }
    }, opts.watchdogTickMs ?? 1000);

    // v0.2.0 G2 — headless inbox.txt watcher. User can append slash-commands /
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
