/**
 * Live dispatcher — executes effects emitted by the reducer.
 * Spawn effects start a subprocess via the adapter registry.
 * Append effects flow back through the TranscriptWriter.
 */

import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

import type { Effect, SpawnEffect } from '../effects/types.js';
import type { Actor } from '../protocol/types.js';
import type { TranscriptWriter } from '../transcript/writer.js';
import type { AdapterRegistry } from '../adapters/types.js';
import { runQaCheckEffect } from './qa-runner.js';
import type { Harness, PresetSpec } from './preset-loader.js';

/**
 * v0.2.0 budget guardrail (autoresearch P3): an individual spawn cannot run
 * longer than this. The dispatcher AbortController fires SIGTERM via the
 * adapter's signal handler and the spawn is recorded as kind=error so the
 * reducer's circuit_breaker trips. Wiki: bagelcode-budget-guardrails.md
 * §"per_spawn_timeout".
 *
 * v0.3.1: split into wall-clock ceiling + idle timeout. The previous single
 * 5-min wall-clock timer killed actors that were actively producing tokens
 * (planner-lead Phase B session 01KQMR4Y, builder for multi-file envelopes).
 * Idle-timeout fires only on genuine stalls (no stdout for N seconds) while
 * the wall-clock remains as a hard ceiling.
 */
const PER_SPAWN_TIMEOUT_MS = Number(process.env.CRUMB_PER_SPAWN_TIMEOUT_MS) || 15 * 60 * 1000; // 15 min — hard wall-clock ceiling
const PER_SPAWN_IDLE_TIMEOUT_MS = Number(process.env.CRUMB_PER_SPAWN_IDLE_MS) || 90 * 1000; // 90 s — kill on no stdout for this long

export interface DispatcherDeps {
  writer: TranscriptWriter;
  registry: AdapterRegistry;
  sessionId: string;
  sessionDir: string;
  transcriptPath: string;
  /** Path to repo root — used to resolve agents/<actor>.md sandwiches. */
  repoRoot: string;
  /**
   * Optional preset binding. When present, preset.actors[<actor>] overrides both
   * `effect.adapter` (via harness→adapter mapping) and the default sandwich path.
   * Actors not declared in the preset fall back to `effect.adapter` + ACTOR_TO_SANDWICH.
   */
  preset?: PresetSpec;
  /**
   * Per-harness enabled flag from .crumb/config.toml [providers.*].
   * When binding.harness maps to a disabled provider, dispatcher falls back to
   * builder-fallback adapter (claude-local) and emits kind=note explaining the substitution.
   */
  providersEnabled?: Record<string, boolean>;
  /** Bridge: hook effects surface as user prompts (TUI/CLI). */
  onHook?: (kind: string, body: string, data?: Record<string, unknown>) => Promise<void>;
  /**
   * Per-spawn wall-clock timeout override (ms). Defaults to PER_SPAWN_TIMEOUT_MS
   * (15 min). Tests pass small values (e.g. 50ms) to exercise the abort path
   * without waiting for the production budget.
   */
  perSpawnTimeoutMs?: number;
  /**
   * Per-spawn idle-timeout override (ms). When the adapter calls
   * `req.onStdoutActivity()` the timer resets; if no activity is reported for
   * this long the dispatcher aborts the spawn. Defaults to
   * PER_SPAWN_IDLE_TIMEOUT_MS (90 s). Adapters that don't surface activity
   * effectively fall back to wall-clock-only behavior.
   */
  perSpawnIdleTimeoutMs?: number;
}

const ACTOR_TO_SANDWICH: Partial<Record<Actor, string>> = {
  'planner-lead': 'agents/planner-lead.md',
  builder: 'agents/builder.md',
  verifier: 'agents/verifier.md',
  'builder-fallback': 'agents/builder-fallback.md',
  coordinator: 'agents/coordinator.md',
  // v0.3.1 fix: missing researcher entry caused baseSandwichPath to fall back
  // to '' → resolve(repoRoot, '') = repoRoot (a directory) → readFile threw
  // EISDIR when the no-video researcher path routed through claude-local.
  // Stack trace from session 01KQMGNW: assembleSandwich → readFileHandle EISDIR.
  researcher: 'agents/researcher.md',
};

/** Harness → adapter id mapping for preset bindings. v0.3.0 added gemini-sdk for the researcher actor (Gemini 3.1 Pro native YouTube URL + 10fps frame sampling — gemini-cli has p1-unresolved video bugs). */
const HARNESS_TO_ADAPTER: Record<Harness, string> = {
  'claude-code': 'claude-local',
  codex: 'codex-local',
  'gemini-cli': 'gemini-local',
  'gemini-sdk': 'gemini-sdk',
  'anthropic-sdk': 'claude-local',
  'openai-sdk': 'codex-local',
  'google-sdk': 'gemini-local',
  mock: 'mock',
  none: 'mock',
};

export async function dispatch(effect: Effect, deps: DispatcherDeps): Promise<void> {
  switch (effect.type) {
    case 'spawn': {
      // Preset binding: when the user has declared this actor in the active preset,
      // use the binding's sandwich + harness→adapter. Otherwise fall back to the
      // reducer-supplied effect.adapter and the default ACTOR_TO_SANDWICH mapping.
      const binding = deps.preset?.actors[effect.actor];
      let adapterId = binding
        ? (HARNESS_TO_ADAPTER[binding.harness] ?? effect.adapter)
        : effect.adapter;
      // Provider-activation gate (.crumb/config.toml [providers.*]):
      // if binding's harness has been disabled by the user, substitute claude-local
      // (the universal fallback) and emit kind=note so observers see the swap.
      if (binding && deps.providersEnabled && deps.providersEnabled[binding.harness] === false) {
        await deps.writer.append({
          session_id: deps.sessionId,
          from: 'system',
          kind: 'note',
          body: `provider ${binding.harness} is disabled in .crumb/config.toml — substituting claude-local for actor ${effect.actor}`,
          metadata: { deterministic: true, tool: 'provider-activation-gate@v1' },
        });
        adapterId = 'claude-local';
      }
      const baseSandwichPath = effect.sandwich_path
        ? resolve(deps.repoRoot, effect.sandwich_path)
        : binding?.sandwich
          ? resolve(deps.repoRoot, binding.sandwich)
          : resolve(deps.repoRoot, ACTOR_TO_SANDWICH[effect.actor] ?? '');
      // v0.2.0 G4 — sandwich override pipeline:
      //   base agents/<actor>.md
      //   + agents/<actor>.local.md (per-machine, gitignored)
      //   + effect.sandwich_appends (runtime user.intervene with data.sandwich_append)
      // → sessions/<id>/agent-workspace/<actor>/sandwich.assembled.md
      // The assembled file becomes the adapter's --append-system-prompt source so
      // observers can inspect exactly what each spawn saw.
      // G-C — length bias firewall (verifier-only). Inject artifact byte/token
      // counts so the LLM judge has explicit length context and is reminded
      // that length is not a quality signal. Frontier backing:
      //   - AlpacaEval LC (Dubois 2024) → +4.7%/100 tokens at content-equal
      //   - RewardBench v2 (Lambert AI2 2025 §Focus) → length-controlled split
      //     5-12 pt drop in SOTA reward models
      //   - Judge-Bench (Krumdick EMNLP 2025) → Sonnet 4 +1.6 ~ Gemini 2.5 Pro
      //     +3.4% inflated win-rate per length-extended response (residual after
      //     2024-era debiasing)
      //   - Anthropic Hybrid Normalization 2026 (dev docs Q1) → token count
      //     disclosure + "ignore length" → ~50% effect reduction
      //   - Rubric-Anchored Judging (NeurIPS 2025) → length bias concentrates
      //     in qualitative dims (D1 spec_fit / D5 quality) while quantitative
      //     dims (D2/D6 from qa-check-effect) are immune. Hence: D1/D5 scope.
      // Wiki: [[bagelcode-scoring-ratchet-frontier-2026-05-02]] §6 G-C.
      const lengthAppends =
        effect.actor === 'verifier' ? await buildLengthContextAppends(deps.sessionDir) : [];
      const sandwichPath = await assembleSandwich({
        baseSandwichPath,
        appends: [...lengthAppends, ...(effect.sandwich_appends ?? [])],
        sessionDir: deps.sessionDir,
        actor: effect.actor,
        repoRoot: deps.repoRoot,
      });
      const adapter = deps.registry.get(adapterId);

      // v0.3.0+ observability — record dispatcher's intent BEFORE invoking adapter.
      // Lets us distinguish "dispatcher never reached spawn" from "adapter ran but
      // produced no output". Marked private + deterministic so anti-deception/
      // verifier ignore it but `crumb debug` can read it.
      await deps.writer.append({
        session_id: deps.sessionId,
        from: 'system',
        kind: 'note',
        body: `dispatch.spawn → actor=${effect.actor} adapter=${adapterId} sandwich=${sandwichPath}`,
        data: {
          actor: effect.actor,
          adapter: adapterId,
          sandwich_path: sandwichPath,
          has_prompt: Boolean(effect.prompt && effect.prompt.length > 0),
        },
        metadata: {
          visibility: 'private',
          deterministic: true,
          tool: 'dispatch-pre-spawn@v1',
        },
      });

      // v0.2.0/v0.3.1 per_spawn_timeout: AbortController fires SIGTERM via the
      // adapter's signal handler. See `setupSpawnTimers` for the two-timer
      // (wall-clock ceiling + idle) policy.
      const timers = setupSpawnTimers({
        wallClockMs: deps.perSpawnTimeoutMs ?? PER_SPAWN_TIMEOUT_MS,
        idleMs: deps.perSpawnIdleTimeoutMs ?? PER_SPAWN_IDLE_TIMEOUT_MS,
      });

      // v0.3.1 cross_provider wiring (AGENTS.md §136). Resolve the latest build
      // event's provider when spawning the verifier so `crumb event` can stamp
      // metadata.cross_provider on the judge.score it emits. Without this, the
      // anti-deception Rule 4 self-bias check still works (it compares
      // metadata.provider on judge.score vs. build event), but
      // tui/format.ts:43 / helpers/status.ts:144 / exporter/otel.ts:66 all
      // read metadata.cross_provider directly and fall back to "⚠" when
      // undefined — every real session showed a bogus same-provider warning.
      const builderProvider =
        effect.actor === 'verifier'
          ? await readLatestBuildProvider(deps.transcriptPath)
          : undefined;
      // v0.3.1 verifier hard input isolation. Project the transcript down to
      // the minimum context the judge needs (goal / spec / build / qa.result
      // / artifact.created / step.research.video), excluding planner
      // reasoning + prior verifier output + private CoT + dispatcher meta.
      // Prompt-only enforcement (sandwich text) reaches ~50% per Anthropic
      // Hybrid Normalization 2026; this layer closes the residual.
      // Wiki: [[bagelcode-verifier-context-isolation-2026-05-03]].
      const judgeInputPath =
        effect.actor === 'verifier'
          ? await buildVerifierInputBundle(deps.transcriptPath, deps.sessionDir)
          : undefined;

      let result;
      try {
        result = await adapter.spawn({
          actor: effect.actor,
          sessionId: deps.sessionId,
          sessionDir: deps.sessionDir,
          sandwichPath,
          transcriptPath: deps.transcriptPath,
          prompt: effect.prompt,
          // Pass binding's model + effort through to adapters that support them.
          // codex-local consumes both (--model + -c model_reasoning_effort=...);
          // claude-local / gemini-local accept the fields but cannot pass them
          // to the underlying CLI (API-only) — informational only.
          model: binding?.model,
          effort: binding?.effort,
          signal: timers.controller.signal,
          onStdoutActivity: timers.onStdoutActivity,
          provider: binding?.provider,
          harness: binding?.harness,
          ...(builderProvider ? { builderProvider } : {}),
          ...(judgeInputPath ? { judgeInputPath } : {}),
        });
      } finally {
        timers.cleanup();
      }

      const timedOut = timers.controller.signal.aborted;
      const timeoutReason = timers.timeoutReason;
      const timeoutMs = timers.wallClockMs;
      const idleTimeoutMs = timers.idleMs;

      // v0.3.1 ArgoCD-style logs — persist full stdout / stderr to disk under
      // <session>/agent-workspace/<actor>/spawn-<ts>.log so the studio's
      // log viewer can tail it. The transcript-side `kind=note` summary
      // remains a 4KB preview; the full stream lives on disk and is offered
      // via the studio's GET /api/sessions/:id/logs/:actor stream + snapshot
      // endpoints. Best-effort: a write failure must NOT break the spawn.
      const logTs = new Date().toISOString().replace(/[:.]/g, '-');
      const logPath = resolve(
        deps.sessionDir,
        'agent-workspace',
        effect.actor,
        `spawn-${logTs}.log`,
      );
      try {
        await mkdir(resolve(deps.sessionDir, 'agent-workspace', effect.actor), {
          recursive: true,
        });
        const logBody =
          `=== adapter ${adapterId} spawn @ ${new Date().toISOString()} ` +
          `(exit=${result.exitCode}, ${result.durationMs}ms${timedOut ? ', timed out' : ''}) ===\n\n` +
          `--- stdout ---\n${result.stdout ?? ''}\n\n--- stderr ---\n${result.stderr ?? ''}\n`;
        await writeFile(logPath, logBody, 'utf8');
      } catch {
        // log persistence is observability-only — keep the dispatcher silent
        // on disk failure so the spawn lifecycle isn't disrupted.
      }

      // v0.3.0+ observability — always capture truncated stdout/stderr as
      // kind=note so an exit-0-but-silent spawn (planner-lead emits no
      // transcript events) is still diagnosable. Without this, exit=0 with
      // empty stdout looks identical to exit=0 with a successful run.
      // Marked visibility=private + deterministic so verifiers/anti-deception
      // ignore it, but observers + `crumb debug` can read it.
      const stdoutPreview = (result.stdout ?? '').slice(0, 4000);
      const stderrPreview = (result.stderr ?? '').slice(0, 4000);
      if (stdoutPreview.length > 0 || stderrPreview.length > 0) {
        await deps.writer.append({
          session_id: deps.sessionId,
          from: effect.actor,
          kind: 'note',
          body: `adapter ${adapterId} streams (exit=${result.exitCode}, ${result.durationMs}ms)`,
          data: {
            adapter: adapterId,
            stdout_truncated: stdoutPreview,
            stderr_truncated: stderrPreview,
            stdout_full_length: result.stdout?.length ?? 0,
            stderr_full_length: result.stderr?.length ?? 0,
          },
          metadata: {
            visibility: 'private',
            deterministic: true,
            tool: `${adapterId}-stream@v1`,
          },
        });
      }

      // Surface non-zero exit as kind=error so the reducer can trip the breaker.
      // Timeout is a special case: clearer body + structured data so observers
      // and the verifier can distinguish stalled spawn from genuine CLI failure.
      if (result.exitCode !== 0 || timedOut) {
        const idleHit = timeoutReason === 'idle';
        const limitMs = idleHit ? idleTimeoutMs : timeoutMs;
        await deps.writer.append({
          session_id: deps.sessionId,
          from: effect.actor,
          kind: 'error',
          body: timedOut
            ? `per_spawn_timeout: adapter ${adapterId} ${
                idleHit ? `silent for ${limitMs}ms` : `exceeded ${limitMs}ms wall-clock`
              } (SIGTERM sent)`
            : `adapter ${adapterId} exited ${result.exitCode}`,
          data: timedOut
            ? {
                reason: 'per_spawn_timeout',
                timeout_kind: timeoutReason ?? 'wall_clock',
                timeout_ms: limitMs,
                exit_code: result.exitCode,
                stderr: result.stderr.slice(0, 2000),
              }
            : { stderr: result.stderr.slice(0, 2000) },
        });
      }
      // Always append agent.stop so observers know the turn ended.
      // v0.3.0 — token usage / cost / model from the adapter's parsed output
      // (Anthropic stream-json `result` event, OpenAI Codex `usage`, etc.)
      // get folded into metadata here so the studio surfaces real numbers
      // instead of zeros. Adapters that can't recover usage (text mode / mock)
      // simply omit the field.
      const usage = result.usage ?? {};
      const stopMetadata: Record<string, unknown> = { latency_ms: result.durationMs };
      if (typeof usage.tokens_in === 'number') stopMetadata.tokens_in = usage.tokens_in;
      if (typeof usage.tokens_out === 'number') stopMetadata.tokens_out = usage.tokens_out;
      if (typeof usage.cache_read === 'number') stopMetadata.cache_read = usage.cache_read;
      if (typeof usage.cache_write === 'number') stopMetadata.cache_write = usage.cache_write;
      if (typeof usage.cost_usd === 'number') stopMetadata.cost_usd = usage.cost_usd;
      if (typeof usage.model === 'string') stopMetadata.model = usage.model;
      await deps.writer.append({
        session_id: deps.sessionId,
        from: effect.actor,
        kind: 'agent.stop',
        body: `${effect.actor} stopped (exit=${result.exitCode}, ${result.durationMs}ms${
          timedOut ? ', timed out' : ''
        })`,
        metadata: stopMetadata,
      });
      break;
    }
    case 'append': {
      await deps.writer.append({
        ...effect.message,
        session_id: effect.message.session_id ?? deps.sessionId,
      });
      break;
    }
    case 'hook': {
      if (deps.onHook) await deps.onHook(effect.kind, effect.body, effect.data);
      else {
        // eslint-disable-next-line no-console
        console.log(`[hook ${effect.kind}] ${effect.body}`);
      }
      break;
    }
    case 'rollback': {
      await deps.writer.append({
        session_id: deps.sessionId,
        from: 'coordinator',
        kind: 'handoff.rollback',
        to: effect.to,
        body: effect.feedback,
      });
      // Rollback also implies respawn on the target — caller will route the next
      // event through the reducer to pick that up.
      break;
    }
    case 'stop': {
      await deps.writer.append({
        session_id: deps.sessionId,
        from: 'coordinator',
        kind: 'agent.stop',
        body: `coordinator-initiated stop: ${effect.reason}`,
      });
      break;
    }
    case 'done': {
      await deps.writer.append({
        session_id: deps.sessionId,
        from: 'coordinator',
        kind: 'done',
        body: effect.reason,
      });
      await deps.writer.append({
        session_id: deps.sessionId,
        from: 'coordinator',
        kind: 'session.end',
        body: `session terminated: ${effect.reason}`,
      });
      break;
    }
    case 'qa_check': {
      // v0.1: deterministic ground-truth check (no LLM). Emits kind=qa.result.
      // See [[bagelcode-system-architecture-v0.1]] §3.5, §7 (3-layer scoring).
      await runQaCheckEffect(effect, {
        writer: deps.writer,
        sessionId: deps.sessionId,
        sessionDir: deps.sessionDir,
      });
      break;
    }
  }
}

/** v0.3.1 G-C — length-bias firewall artifacts the verifier consumes. The byte
 * counts come from the on-disk artifact files; token counts use the standard
 * 4-byte heuristic (good enough for length-context disclosure — the LLM only
 * needs an order-of-magnitude signal that "this doc is N tokens, not 4N").
 *
 * D2/D6 are deterministic (qa-check-effect ground truth) and immune to length
 * bias per Rubric-Anchored Judging (NeurIPS 2025). The firewall therefore
 * scopes to D1/D5 — the LLM-judged dims where length confound concentrates.
 */
/**
 * v0.3.1 — two-timer abort policy for adapter spawns.
 *   1. Wall-clock ceiling — fires after `wallClockMs` regardless of activity.
 *   2. Idle timeout — fires only if no `onStdoutActivity()` ping for `idleMs`.
 *      Adapters that don't surface chunk-level activity effectively run under
 *      wall-clock-only behavior (idle never resets).
 *
 * Returns `{ controller, onStdoutActivity, cleanup, timeoutReason, ... }`.
 * The dispatcher reads `controller.signal.aborted` after the spawn settles
 * and inspects `timeoutReason` to label the error (`wall_clock` vs `idle`).
 */
interface SpawnTimerHandles {
  controller: AbortController;
  onStdoutActivity: () => void;
  cleanup: () => void;
  /** Reason the controller aborted, or null if the spawn ran to completion. */
  timeoutReason: 'wall_clock' | 'idle' | null;
  wallClockMs: number;
  idleMs: number;
}

function setupSpawnTimers(opts: { wallClockMs: number; idleMs: number }): SpawnTimerHandles {
  const handles: SpawnTimerHandles = {
    controller: new AbortController(),
    onStdoutActivity: () => {},
    cleanup: () => {},
    timeoutReason: null,
    wallClockMs: opts.wallClockMs,
    idleMs: opts.idleMs,
  };
  const wallTimer = setTimeout(() => {
    handles.timeoutReason = 'wall_clock';
    handles.controller.abort();
  }, opts.wallClockMs);
  wallTimer.unref?.();
  let idleTimer: NodeJS.Timeout | null = null;
  const armIdle = (): void => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!handles.timeoutReason) handles.timeoutReason = 'idle';
      handles.controller.abort();
    }, opts.idleMs);
    idleTimer.unref?.();
  };
  armIdle();
  handles.onStdoutActivity = armIdle;
  handles.cleanup = (): void => {
    clearTimeout(wallTimer);
    if (idleTimer) clearTimeout(idleTimer);
  };
  return handles;
}

/**
 * v0.3.1 — scan the transcript for the latest `kind=build` event and return its
 * `metadata.provider`. Used by the verifier spawn path so `crumb event` can
 * stamp `metadata.cross_provider` on judge.score (AGENTS.md §136). Returns
 * `undefined` if no build event yet, or if the build event omitted provider
 * (which is itself a separate gap — AGENTS.md §135 invariant — outside this
 * PR's scope).
 */
export async function readLatestBuildProvider(transcriptPath: string): Promise<string | undefined> {
  if (!existsSync(transcriptPath)) return undefined;
  const raw = await readFile(transcriptPath, 'utf-8');
  const lines = raw.split('\n');
  // Walk backwards for the latest build event.
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.length === 0) continue;
    let evt: { kind?: string; metadata?: { provider?: string } } | null = null;
    try {
      evt = JSON.parse(line);
    } catch {
      continue;
    }
    if (evt && evt.kind === 'build') {
      const p = evt.metadata?.provider;
      return typeof p === 'string' && p.length > 0 ? p : undefined;
    }
  }
  return undefined;
}

/**
 * v0.3.1 — verifier hard input isolation. Project the transcript down to the
 * minimum context the verifier needs and write it to
 * `<sessionDir>/agent-workspace/verifier/judge-input.jsonl`. The verifier
 * sandwich reads `$CRUMB_JUDGE_INPUT_PATH` instead of the full transcript;
 * this turns AGENTS.md "DOES NOT read agent.thought_summary" from prompt-only
 * enforcement into file-level isolation.
 *
 * Whitelist (events the verifier may see):
 *   - latest `goal`
 *   - latest `spec` (or `spec.update` if newer)
 *   - latest `build`
 *   - latest `qa.result`
 *   - latest `artifact.created`
 *   - all `step.research.video` (D5 evidence cited via Rule 5)
 *
 * Blocklist (events that bias judges per ComplexEval Bench EMNLP 2025 +
 * Preference Leakage ICLR 2026 + Anthropic Bloom 2025):
 *   - planner reasoning: `step.concept` / `step.design` / `step.research`
 *     synthesis (curse-of-knowledge framing)
 *   - prior round verifier output: `step.judge` × 4 / `judge.score` /
 *     `verify.result` (anchor bias, preference leakage)
 *   - private CoT: `agent.thought_summary`
 *   - dispatcher meta: `dispatch.spawn` / `note` / `agent.start` /
 *     `agent.stop` / `handoff.requested` / `handoff.rollback`
 *   - user hints: `user.intervene` / `user.approve` / `user.veto` (could
 *     leak user framing into the judge)
 *   - validator audits: `audit` (recursion guard)
 *
 * The reducer + anti-deception validator still see the full transcript —
 * this isolation is scoped to the verifier subprocess only. Replay-
 * deterministic: the bundle is a pure projection.
 *
 * Wiki: [[bagelcode-verifier-context-isolation-2026-05-03]].
 */
const VERIFIER_INPUT_LATEST_KINDS = new Set([
  'goal',
  'spec',
  'spec.update',
  'build',
  'qa.result',
  'artifact.created',
]);
const VERIFIER_INPUT_ALL_KINDS = new Set(['step.research.video']);

export async function buildVerifierInputBundle(
  transcriptPath: string,
  sessionDir: string,
): Promise<string> {
  const outDir = resolve(sessionDir, 'agent-workspace', 'verifier');
  await mkdir(outDir, { recursive: true });
  const outPath = resolve(outDir, 'judge-input.jsonl');
  if (!existsSync(transcriptPath)) {
    await writeFile(outPath, '', 'utf-8');
    return outPath;
  }
  const raw = await readFile(transcriptPath, 'utf-8');
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  const latestByKind = new Map<string, string>();
  const allMatching: string[] = [];
  for (const line of lines) {
    let evt: { kind?: string } | null = null;
    try {
      evt = JSON.parse(line);
    } catch {
      continue;
    }
    if (!evt || typeof evt.kind !== 'string') continue;
    if (VERIFIER_INPUT_LATEST_KINDS.has(evt.kind)) {
      // spec.update supersedes spec — store under the same logical slot.
      const slot = evt.kind === 'spec.update' ? 'spec' : evt.kind;
      latestByKind.set(slot, line);
    } else if (VERIFIER_INPUT_ALL_KINDS.has(evt.kind)) {
      allMatching.push(line);
    }
  }
  // Emit in a stable order: latest events in declared order, then all
  // step.research.video in their original order. The verifier doesn't need
  // ULID sort because the bundle is small and topically grouped.
  const ordered: string[] = [];
  for (const slot of ['goal', 'spec', 'build', 'qa.result', 'artifact.created']) {
    const line = latestByKind.get(slot);
    if (line) ordered.push(line);
  }
  ordered.push(...allMatching);
  await writeFile(outPath, ordered.join('\n') + (ordered.length > 0 ? '\n' : ''), 'utf-8');
  return outPath;
}

const LENGTH_CONTEXT_ARTIFACTS = ['spec.md', 'DESIGN.md', 'tuning.json', 'game.html'] as const;

export async function buildLengthContextAppends(
  sessionDir: string,
): Promise<{ source_id: string; text: string }[]> {
  const artifactsDir = resolve(sessionDir, 'artifacts');
  const lines: string[] = [];
  for (const name of LENGTH_CONTEXT_ARTIFACTS) {
    const path = resolve(artifactsDir, name);
    if (!existsSync(path)) continue;
    const stat = await import('node:fs/promises').then((m) => m.stat(path));
    const bytes = stat.size;
    const tokens = Math.ceil(bytes / 4); // 4-byte heuristic, see fn header
    lines.push(`- ${name}: ${bytes}B (~${tokens} tokens)`);
  }
  if (lines.length === 0) return [];
  const text = [
    '## Artifact length context (G-C — do NOT use as a quality signal)',
    '',
    'Sizes of the artifacts you are about to evaluate:',
    ...lines,
    '',
    '**Reminder**: length is not quality. Frontier judges (Sonnet 4, GPT-5,',
    'Gemini 2.5 Pro, Opus 4) still show +1.6 ~ +3.4% win-rate inflation per',
    'length-extended response at content-equal (Krumdick EMNLP 2025).',
    'Score D1 (spec_fit) and D5 (quality) on AC compliance and design intent,',
    'not on prose volume. Length-controlled scoring is the 2025-2026 frontier',
    'standard (Arena-Hard v2 default; AlpacaEval LC 2024).',
  ].join('\n');
  return [{ source_id: 'system:length-context@v1', text }];
}

interface AssembleArgs {
  baseSandwichPath: string;
  appends: NonNullable<SpawnEffect['sandwich_appends']>;
  sessionDir: string;
  actor: Actor;
  /** Repo root for resolving agents/_event-protocol.md (v0.3.0+ injection). */
  repoRoot: string;
}

/** Actors that emit transcript events via the `crumb event` CLI helper. */
const EMITTING_ACTORS: ReadonlySet<Actor> = new Set([
  'planner-lead',
  'builder',
  'verifier',
  'builder-fallback',
  'researcher',
]);

/**
 * Parse YAML-frontmatter list values for `inline_skills` and `inline_specialists`.
 * Frontmatter shape (delimited by `---` lines at top of file):
 *
 *     inline_skills:
 *       - skills/parallel-dispatch.md
 *     inline_specialists:
 *       - agents/specialists/concept-designer.md
 *       - agents/specialists/visual-designer.md
 *
 * We don't pull a YAML dep — the shape is constrained (single-line list items
 * starting with `  - `, terminated by any non-`  - ` line at column 0/2). Any
 * unsupported nested structure simply yields an empty list, which is safe.
 */
export function parseInlineRefs(content: string): { skills: string[]; specialists: string[] } {
  const empty = { skills: [], specialists: [] };
  if (!content.startsWith('---')) return empty;
  const lines = content.split('\n');
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) return empty;

  const collect = (key: string): string[] => {
    const out: string[] = [];
    for (let i = 1; i < end; i++) {
      if (lines[i] !== `${key}:`) continue;
      for (let j = i + 1; j < end; j++) {
        const m = /^\s*-\s+(.+?)\s*$/.exec(lines[j]);
        if (!m) break;
        out.push(m[1]);
      }
      break;
    }
    return out;
  };
  return { skills: collect('inline_skills'), specialists: collect('inline_specialists') };
}

/**
 * v0.2.0 G4 — assemble per-spawn sandwich from base + per-machine local override
 * + runtime sandwich_appends.
 *
 * v0.3.0+ — also injects `agents/_event-protocol.md` for any actor that emits
 * transcript events. The standalone protocol file documents the `crumb event`
 * Bash heredoc pattern; without inlining it into the sandwich, Claude/Codex
 * tend to PRINT JSON to stdout instead of invoking the CLI (observed: run
 * 01KQMCSC, planner-lead exit 0 in 41s with stdout containing valid JSON
 * blocks but zero transcript events). Verifier + coordinator already had
 * 1-line mentions of `crumb event`; planner-lead / builder / builder-fallback
 * / researcher had zero. This fix makes the protocol always available.
 *
 * v0.3.1 — also inlines specialist + skill files declared in the base sandwich's
 * YAML frontmatter (`inline_skills`, `inline_specialists`). The actor sandbox
 * is `cwd: <sessionDir>` + `--add-dir <sessionDir>`, which does NOT expose the
 * repo root. Without this step, an actor told to "Inline-read
 * `agents/specialists/game-design.md`" must `find /` for the file (planner-
 * lead Phase B session 01KQMR4Y burned 4 of 5 minutes hunting two such files
 * before SIGTERM). Embedding the contents at assemble time matches the
 * documented "specialist inline-read" pattern (Paperclip #3438) and removes
 * the filesystem fragility entirely.
 *
 * Writes the result under the session's agent-workspace so observers / replay
 * can audit exactly what each spawn saw.
 */
async function assembleSandwich(args: AssembleArgs): Promise<string> {
  const { baseSandwichPath, appends, sessionDir, actor, repoRoot } = args;
  const localPath = baseSandwichPath.replace(/\.md$/, '.local.md');
  const eventProtocolPath = resolve(repoRoot, 'agents', '_event-protocol.md');
  const hasBase = baseSandwichPath !== '' && existsSync(baseSandwichPath);
  const hasLocal = baseSandwichPath !== '' && existsSync(localPath);
  const needsEventProtocol = EMITTING_ACTORS.has(actor) && existsSync(eventProtocolPath);

  const baseContent = hasBase ? await readFile(baseSandwichPath, 'utf-8') : '';
  const refs = baseContent ? parseInlineRefs(baseContent) : { skills: [], specialists: [] };
  const inlineRefs = [
    ...refs.skills.map((p) => ({ kind: 'skill' as const, path: p })),
    ...refs.specialists.map((p) => ({ kind: 'specialist' as const, path: p })),
  ];

  // Skip assembly only when nothing additive applies (no local override, no
  // runtime appends, no event protocol, and no inline refs to embed).
  if (!hasLocal && appends.length === 0 && !needsEventProtocol && inlineRefs.length === 0) {
    return baseSandwichPath;
  }
  const parts: string[] = [];
  if (hasBase) {
    parts.push(baseContent);
  }
  for (const ref of inlineRefs) {
    const refPath = resolve(repoRoot, ref.path);
    if (!existsSync(refPath)) {
      // Frontmatter declares a file that doesn't exist on disk. Don't crash —
      // emit a marker so observers / replay can see the gap. The agent will
      // then fall back to its own knowledge of the contract.
      parts.push(`<!-- inline ${ref.kind} MISSING: ${ref.path} (not found at ${refPath}) -->`);
      continue;
    }
    const refContent = await readFile(refPath, 'utf-8');
    parts.push(
      `<!-- begin inlined ${ref.kind} (${ref.path}) -->\n${refContent}\n<!-- end inlined ${ref.kind} (${ref.path}) -->`,
    );
  }
  if (needsEventProtocol) {
    const protocol = await readFile(eventProtocolPath, 'utf-8');
    parts.push(
      `<!-- begin event protocol (agents/_event-protocol.md) -->\n${protocol}\n<!-- end event protocol -->`,
    );
  }
  if (hasLocal) {
    const localContent = await readFile(localPath, 'utf-8');
    parts.push(
      `<!-- begin local override (${localPath}) -->\n${localContent}\n<!-- end local override -->`,
    );
  }
  for (const a of appends) {
    parts.push(
      `<!-- begin sandwich_append source=${a.source_id} -->\n${a.text}\n<!-- end sandwich_append -->`,
    );
  }
  const outDir = resolve(sessionDir, 'agent-workspace', actor);
  await mkdir(outDir, { recursive: true });
  const outPath = resolve(outDir, 'sandwich.assembled.md');
  await writeFile(outPath, parts.join('\n\n') + '\n', 'utf-8');
  return outPath;
}
