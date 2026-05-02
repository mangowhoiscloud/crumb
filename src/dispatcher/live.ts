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
 * v3.2 budget guardrail (autoresearch P3): an individual spawn cannot run
 * longer than this. The dispatcher AbortController fires SIGTERM via the
 * adapter's signal handler and the spawn is recorded as kind=error so the
 * reducer's circuit_breaker trips. Wiki: bagelcode-budget-guardrails.md
 * §"per_spawn_timeout".
 */
const PER_SPAWN_TIMEOUT_MS = 5 * 60 * 1000; // 5 min

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
   * Per-spawn timeout override (ms). Defaults to PER_SPAWN_TIMEOUT_MS (5 min).
   * Tests pass small values (e.g. 50ms) to exercise the abort path without
   * waiting for the production budget.
   */
  perSpawnTimeoutMs?: number;
}

const ACTOR_TO_SANDWICH: Partial<Record<Actor, string>> = {
  'planner-lead': 'agents/planner-lead.md',
  builder: 'agents/builder.md',
  verifier: 'agents/verifier.md',
  'builder-fallback': 'agents/builder-fallback.md',
  coordinator: 'agents/coordinator.md',
};

/** Harness → adapter id mapping for preset bindings. v3.3 added gemini-sdk for the researcher actor (Gemini 3.1 Pro native YouTube URL + 10fps frame sampling — gemini-cli has p1-unresolved video bugs). */
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
      // v3.2 G4 — sandwich override pipeline:
      //   base agents/<actor>.md
      //   + agents/<actor>.local.md (per-machine, gitignored)
      //   + effect.sandwich_appends (runtime user.intervene with data.sandwich_append)
      // → sessions/<id>/agent-workspace/<actor>/sandwich.assembled.md
      // The assembled file becomes the adapter's --append-system-prompt source so
      // observers can inspect exactly what each spawn saw.
      const sandwichPath = await assembleSandwich({
        baseSandwichPath,
        appends: effect.sandwich_appends ?? [],
        sessionDir: deps.sessionDir,
        actor: effect.actor,
      });
      const adapter = deps.registry.get(adapterId);

      // v3.3+ observability — record dispatcher's intent BEFORE invoking adapter.
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

      // v3.2 per_spawn_timeout: AbortController fires SIGTERM via the adapter's
      // signal handler. The Promise.race pattern is unnecessary here — the
      // adapter's own close handler resolves once SIGTERM lands, and we read
      // controller.signal.aborted to distinguish a timed-out spawn from a
      // genuine adapter error.
      const controller = new AbortController();
      const timeoutMs = deps.perSpawnTimeoutMs ?? PER_SPAWN_TIMEOUT_MS;
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      // Don't keep the event loop alive on the timer alone.
      timer.unref?.();

      let result;
      try {
        result = await adapter.spawn({
          actor: effect.actor,
          sessionId: deps.sessionId,
          sessionDir: deps.sessionDir,
          sandwichPath,
          transcriptPath: deps.transcriptPath,
          prompt: effect.prompt,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      const timedOut = controller.signal.aborted;

      // v3.3+ observability — always capture truncated stdout/stderr as
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
        await deps.writer.append({
          session_id: deps.sessionId,
          from: effect.actor,
          kind: 'error',
          body: timedOut
            ? `per_spawn_timeout: adapter ${adapterId} exceeded ${timeoutMs}ms (SIGTERM sent)`
            : `adapter ${adapterId} exited ${result.exitCode}`,
          data: timedOut
            ? {
                reason: 'per_spawn_timeout',
                timeout_ms: timeoutMs,
                exit_code: result.exitCode,
                stderr: result.stderr.slice(0, 2000),
              }
            : { stderr: result.stderr.slice(0, 2000) },
        });
      }
      // Always append agent.stop so observers know the turn ended.
      await deps.writer.append({
        session_id: deps.sessionId,
        from: effect.actor,
        kind: 'agent.stop',
        body: `${effect.actor} stopped (exit=${result.exitCode}, ${result.durationMs}ms${
          timedOut ? ', timed out' : ''
        })`,
        metadata: { latency_ms: result.durationMs },
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
      // v3: deterministic ground-truth check (no LLM). Emits kind=qa.result.
      // See [[bagelcode-system-architecture-v3]] §3.5, §7 (3-layer scoring).
      await runQaCheckEffect(effect, {
        writer: deps.writer,
        sessionId: deps.sessionId,
        sessionDir: deps.sessionDir,
      });
      break;
    }
  }
}

interface AssembleArgs {
  baseSandwichPath: string;
  appends: NonNullable<SpawnEffect['sandwich_appends']>;
  sessionDir: string;
  actor: Actor;
}

/**
 * v3.2 G4 — assemble per-spawn sandwich from base + per-machine local override
 * + runtime sandwich_appends. Writes the result under the session's
 * agent-workspace so observers / replay can audit exactly what each spawn saw.
 *
 * When there is no local override file and no runtime appends, the base path is
 * returned unchanged (no filesystem write) — this preserves the v3.1 behavior
 * for sessions that don't exercise the override surface.
 */
async function assembleSandwich(args: AssembleArgs): Promise<string> {
  const { baseSandwichPath, appends, sessionDir, actor } = args;
  const localPath = baseSandwichPath.replace(/\.md$/, '.local.md');
  const hasBase = baseSandwichPath !== '' && existsSync(baseSandwichPath);
  const hasLocal = baseSandwichPath !== '' && existsSync(localPath);
  if (!hasLocal && appends.length === 0) {
    return baseSandwichPath;
  }
  const parts: string[] = [];
  if (hasBase) {
    parts.push(await readFile(baseSandwichPath, 'utf-8'));
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
