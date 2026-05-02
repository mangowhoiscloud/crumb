/**
 * Live dispatcher — executes effects emitted by the reducer.
 * Spawn effects start a subprocess via the adapter registry.
 * Append effects flow back through the TranscriptWriter.
 */

import { resolve } from 'node:path';

import type { Effect } from '../effects/types.js';
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
      const sandwichPath = effect.sandwich_path
        ? resolve(deps.repoRoot, effect.sandwich_path)
        : binding?.sandwich
          ? resolve(deps.repoRoot, binding.sandwich)
          : resolve(deps.repoRoot, ACTOR_TO_SANDWICH[effect.actor] ?? '');
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
