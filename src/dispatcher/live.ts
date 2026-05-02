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
}

const ACTOR_TO_SANDWICH: Partial<Record<Actor, string>> = {
  'planner-lead': 'agents/planner-lead.md',
  builder: 'agents/builder.md',
  verifier: 'agents/verifier.md',
  'builder-fallback': 'agents/builder-fallback.md',
  coordinator: 'agents/coordinator.md',
};

/** Harness → adapter id mapping for preset bindings. SDK harnesses fall back to local CLI for now. */
const HARNESS_TO_ADAPTER: Record<Harness, string> = {
  'claude-code': 'claude-local',
  codex: 'codex-local',
  'gemini-cli': 'gemini-local',
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
      const result = await adapter.spawn({
        actor: effect.actor,
        sessionId: deps.sessionId,
        sessionDir: deps.sessionDir,
        sandwichPath,
        transcriptPath: deps.transcriptPath,
        prompt: effect.prompt,
      });
      // Surface non-zero exit as kind=error so the reducer can trip the breaker.
      if (result.exitCode !== 0) {
        await deps.writer.append({
          session_id: deps.sessionId,
          from: effect.actor,
          kind: 'error',
          body: `adapter ${adapterId} exited ${result.exitCode}`,
          data: { stderr: result.stderr.slice(0, 2000) },
        });
      }
      // Always append agent.stop so observers know the turn ended.
      await deps.writer.append({
        session_id: deps.sessionId,
        from: effect.actor,
        kind: 'agent.stop',
        body: `${effect.actor} stopped (exit=${result.exitCode}, ${result.durationMs}ms)`,
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
