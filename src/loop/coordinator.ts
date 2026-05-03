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
import {
  loadBindingsOnly,
  loadPresetWithConfig,
  type PresetSpec,
} from '../dispatcher/preset-loader.js';
import { AdapterRegistry, type Adapter } from '../adapters/types.js';
import { ClaudeLocalAdapter } from '../adapters/claude-local.js';
import { CodexLocalAdapter } from '../adapters/codex-local.js';
import { GeminiLocalAdapter } from '../adapters/gemini-local.js';
import { GeminiSdkAdapter } from '../adapters/gemini-sdk.js';
import { MockAdapter } from '../adapters/mock.js';
import { renderSummary } from '../summary/render.js';
import { serialize as serializeExport } from '../exporter/otel.js';
import { startInboxWatcher, type InboxWatcherHandle } from '../inbox/watcher.js';
import {
  startArtifactWatcher,
  type ArtifactWatcherHandle,
} from '../dispatcher/artifact-watcher.js';
import { acquireLease, releaseLease } from '../session/lease.js';
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
  /**
   * v0.5 PR-Bindings — per-actor `--bind <actor>=<harness>[:<model>]` overlay
   * (highest priority above .crumb/config.toml + preset). Forwarded into
   * loadPresetWithConfig (when presetName set) or loadBindingsOnly (ambient
   * mode). Skipped when empty / undefined. See preset-loader.ts §applyCliBindings.
   */
  cliBindings?: Array<{ actor: string; harness?: string; model?: string }>;
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
  /**
   * v0.4 video research — list of YouTube URLs or local paths under
   * `<sessionDir>/inbox/`. When non-empty, the goal event carries
   * `data.video_refs = [...]` so the reducer's goal handler can flip
   * `state.goal_has_video_refs = true`, routing the researcher to the
   * gemini-sdk video path (10fps frame sampling). Empty / undefined keeps
   * the existing text-only research flow. Studio's "Video research" toggle
   * exposes this; CLI exposes via `--video-refs <url>,<url>,...`.
   */
  videoRefs?: string[];
  /**
   * v0.4 — explicit genre profile (CLI `--genre` / Studio picker). When set,
   * the goal event carries `data.genre_profile = <profile>` so the reducer
   * populates `task_ledger.genre_profile`. When undefined, planner-lead
   * resolves via researcher proposal (auto-detect path). See
   * `agents/specialists/game-design.md` §1.3.
   */
  genreProfile?: string;
  /**
   * v0.4 — explicit persistence profile (CLI `--persistence` / Studio
   * picker). When set, populates `task_ledger.persistence_profile`. When
   * undefined, planner-lead runs §1.4 trigger logic (leaderboard markers
   * → postgres-anon, else local-only). See `agents/specialists/game-design.md`
   * §1.4.
   */
  persistenceProfile?: string;
}

// Wall-clock defaults raised v0.4.1: builder spawns observed at 10+ min for
// non-trivial multi-file PWAs (Reba Berserker = 10m48s exit=0 with 18 files);
// the prior 30-min hard cap killed sessions mid-verifier. New defaults give
// a complete spec→build→qa→verifier loop a full hour, with the soft hook at
// 50min so the user gets a budget warning before the cap fires. Override
// via CRUMB_WALL_CLOCK_HOOK_MS / CRUMB_WALL_CLOCK_HARD_MS for short demos.
const WALL_CLOCK_HOOK_MS_DEFAULT = Number(process.env.CRUMB_WALL_CLOCK_HOOK_MS) || 50 * 60 * 1000;
const WALL_CLOCK_HARD_MS_DEFAULT = Number(process.env.CRUMB_WALL_CLOCK_HARD_MS) || 60 * 60 * 1000;

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
      const result = await loadPresetWithConfig(opts.presetName, opts.repoRoot, opts.cliBindings);
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
  } else if (opts.cliBindings && opts.cliBindings.length > 0) {
    // v0.5 PR-Bindings — ambient mode + per-actor --bind overrides. We
    // synthesize a preset whose only entries are the cliBindings; every
    // other actor still falls through to the dispatcher's reducer-supplied
    // adapter (= ambient). Without this branch, the studio's "Custom
    // binding" grid was UI residue when no preset was selected (G9 fix).
    const result = await loadBindingsOnly(opts.cliBindings, opts.repoRoot);
    preset = result.preset;
    providersEnabled = result.providersEnabled;
    // eslint-disable-next-line no-console
    console.log(
      `[crumb] custom bindings (ambient mode): ${opts.cliBindings.length} actor(s) overridden`,
    );
    for (const [name, b] of Object.entries(preset.actors)) {
      // eslint-disable-next-line no-console
      console.log(`[crumb]   ${name}: ${b.harness}/${b.provider}/${b.model}`);
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
  //
  // v0.4.1 PR-F E — single-writer lease. Two coordinators on the same
  // session would both poll inbox.txt, both run artifact-watcher (double
  // emit), and both spawn from the same handoff event. Refuse on a live
  // lease; reclaim a stale one. Cleanup in finish/fail.
  const leaseResult = acquireLease(opts.sessionDir, 'coordinator');
  if (!leaseResult.acquired) {
    const held = leaseResult.heldBy;
    throw new Error(
      `session ${opts.sessionId} is already running (PID ${held?.pid ?? '?'} since ${held?.startedAt ?? '?'}). ` +
        `If this is stale, remove ${opts.sessionDir}/.crumb-lock and retry.`,
    );
  }
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
    // v0.4: pass video_refs / genre_profile / persistence_profile through
    // goal.data so reducer.case 'goal' picks them up. Build once so multiple
    // optional fields don't fight over the spread.
    const goalData: Record<string, unknown> = {};
    if (opts.videoRefs && opts.videoRefs.length > 0) {
      goalData.video_refs = opts.videoRefs;
    }
    if (opts.genreProfile) goalData.genre_profile = opts.genreProfile;
    if (opts.persistenceProfile) goalData.persistence_profile = opts.persistenceProfile;
    await writer.append({
      session_id: opts.sessionId,
      from: 'user',
      kind: 'goal',
      body: opts.goal,
      ...(Object.keys(goalData).length > 0 ? { data: goalData } : {}),
    });
  }

  // Apply adapter override (demo mode forces all actors to mock).
  const applyOverride = (effects: Effect[]): Effect[] => {
    if (!opts.adapterOverride) return effects;
    return effects.map((e) => (e.type === 'spawn' ? { ...e, adapter: opts.adapterOverride! } : e));
  };

  // v0.4 immediate-wake: reduce + dispatch decoupled.
  //   • reduceQueue is processed in-order, synchronously, so reducer state stays
  //     consistent and replay-deterministic (AGENTS.md invariant #1/#2).
  //   • Effects from each event are dispatched asynchronously (fire-and-forget),
  //     letting the next event get reduced + dispatched WITHOUT waiting for the
  //     prior spawn's subprocess to exit.
  //   • Effects within a single event remain sequential — reducer cases like
  //     judge.score FAIL emit `[append(audit:adapter_swapped), spawn(builder)]`
  //     where the audit append must land before the respawned builder reads transcript.
  //
  // Why this matters: previously `processing = processing.then(...)` serialized
  // the entire pipeline behind every spawn dispatch, which awaited subprocess
  // exit. Builder writing `build` mid-spawn → tail reads it → onMessage queues
  // the chain item → chain item BLOCKS until builder spawn fully resolves
  // (subprocess exit, possibly minutes later). qa_check effect from reduce(build)
  // never dispatched in time. Observed in session 01KQNAK1 (build at 38:45,
  // wall_clock_exhausted at 39:11 — qa_check never ran, 0 qa.results vs 2 builds).
  let reducing = false;
  const reduceQueue: Message[] = [];
  // pendingItems counts in-flight async dispatches (post-reduce). The idle
  // watchdog must not finish() while pendingItems > 0; otherwise a long
  // background spawn (e.g. verifier 7min) would let the watchdog terminate
  // the session before its terminal event lands.
  let pendingItems = 0;
  // P1 #9: reset on every loop entry. Resume replay does NOT call onMessage
  // (which is what normally bumps lastEventAt), so on a fresh resume the
  // counter could be far enough in the past that the watchdog fires
  // immediately. Force `lastEventAt = Date.now()` after replay completes so
  // the idle window starts fresh from the moment we begin tailing.
  let lastEventAt = Date.now();
  const idleMs = opts.idleTimeoutMs ?? 60_000;

  return new Promise<{ state: CrumbState }>((resolveOuter, rejectOuter) => {
    let handle: { close: () => void } | null = null;
    let inboxHandle: InboxWatcherHandle | null = null;
    let artifactHandle: ArtifactWatcherHandle | null = null;
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
      void artifactHandle?.close();
      releaseLease(opts.sessionDir);
      // Emit summary + exports asynchronously; resolve outer promise after.
      void emitSummary(result.state).then(() => resolveOuter(result));
    };

    const fail = (err: unknown): void => {
      if (resolved) return;
      resolved = true;
      handle?.close();
      inboxHandle?.stop();
      void artifactHandle?.close();
      releaseLease(opts.sessionDir);
      rejectOuter(err);
    };

    const drainReduce = (): void => {
      if (reducing) return;
      reducing = true;
      try {
        while (reduceQueue.length > 0 && !state.done) {
          const msg = reduceQueue.shift()!;
          // PR-G7-C — user.intervene / user.resume can unstop a session that
          // hit a budget cap. Clear the done flag BEFORE reducing so the
          // intervention's reducer case sees a live state and can spawn an
          // actor. Without this the loop sits at done=true and ignores every
          // user message (real footgun in 01KQNEYQT53P5JFGD0944NBZ9D where
          // the verifier emitted handoff.rollback after token_exhausted but
          // the rollback was queued and never reduced).
          if ((msg.kind === 'user.intervene' || msg.kind === 'user.resume') && state.done) {
            state = { ...state, done: false };
          }
          const { state: nextState, effects } = reduce(state, msg);
          state = nextState;
          const effList = applyOverride(effects);
          if (effList.length === 0) {
            if (state.done) finish({ state });
            continue;
          }
          // Dispatch this event's effects sequentially (audit-append must
          // precede fallback-spawn; build emit must precede qa_check etc.)
          // but fire async so the next event's reduce + dispatch can start
          // immediately — that's the immediate-wake guarantee.
          //
          // INVARIANT (C1 from post-#104 audit, reaffirmed): the within-IIFE
          // sequential `await dispatch(eff)` is sufficient to guarantee that
          // ordered effects (e.g. `[append(audit:adapter_swapped), spawn(builder)]`)
          // observe the right transcript prefix when the spawn reads it. The
          // chain is:
          //   dispatch(append) → writer.append() → fs/promises appendFile()
          // `appendFile` resolves AFTER the kernel's write(2) returns, which
          // commits the bytes to the OS page cache. Subsequent reads in the
          // same OS (the spawn's subprocess inherits the parent's filesystem
          // namespace + page cache) see the bytes immediately — fsync is not
          // required for cross-process visibility, only for crash durability.
          // So `await dispatch(append-audit)` returning ⇒ audit line is
          // visible to the about-to-spawn fallback subprocess. No extra fsync
          // or barrier needed here; the audit Q1 race scenario was theoretical.
          pendingItems += 1;
          void (async () => {
            try {
              for (const eff of effList) {
                await dispatch(eff, deps);
              }
            } finally {
              pendingItems -= 1;
              if (state.done) finish({ state });
            }
          })().catch(fail);
        }
      } finally {
        reducing = false;
      }
    };

    const onMessage = (msg: Message): void => {
      lastEventAt = Date.now();
      reduceQueue.push(msg);
      drainReduce();
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
          // Force state.done so drainReduce stops accepting new events; any
          // in-flight async dispatches will continue to completion (their
          // finally blocks decrement pendingItems and may attempt finish(),
          // which is idempotent via `resolved` guard).
          state = { ...state, done: true };
          void dispatch({ type: 'done', reason: 'wall_clock_exhausted' }, deps)
            .then(() => finish({ state }))
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

    // v0.4.1 PR-F A — FS-driven artifact.created emitter. The schema lets the
    // builder emit kind=artifact.created per file, but in practice the LLM
    // batches them or skips. The watcher is the ground truth: file appearing
    // = visible progress. Studio renders these as a real-time bundle strip.
    artifactHandle = startArtifactWatcher({
      sessionDir: opts.sessionDir,
      sessionId: opts.sessionId,
      writer,
      onError: (err) => {
        // eslint-disable-next-line no-console
        console.error('[crumb] artifact watcher error:', err.message);
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
