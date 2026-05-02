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

export interface DispatcherDeps {
  writer: TranscriptWriter;
  registry: AdapterRegistry;
  sessionId: string;
  sessionDir: string;
  transcriptPath: string;
  /** Path to repo root — used to resolve agents/<actor>.md sandwiches. */
  repoRoot: string;
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

export async function dispatch(effect: Effect, deps: DispatcherDeps): Promise<void> {
  switch (effect.type) {
    case 'spawn': {
      const sandwichPath = effect.sandwich_path
        ? resolve(deps.repoRoot, effect.sandwich_path)
        : resolve(deps.repoRoot, ACTOR_TO_SANDWICH[effect.actor] ?? '');
      const adapter = deps.registry.get(effect.adapter);
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
          body: `adapter ${effect.adapter} exited ${result.exitCode}`,
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
