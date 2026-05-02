/**
 * Coordinator reducer — pure (state, event) → { state, effects }.
 * No I/O, no time, no randomness. Determinism is an iron constraint:
 * replay(transcript) MUST yield the same effect sequence as live execution.
 *
 * Routing rules mirror agents/coordinator.md §routing-rules.
 */

import type { Message, Verdict } from '../protocol/types.js';
import type { CrumbState } from '../state/types.js';
import type { Effect } from '../effects/types.js';

const STUCK_THRESHOLD = 5;
const ADAPTIVE_STOP_VARIANCE = 1.0;
const CIRCUIT_OPEN_AT = 3;

export interface ReduceResult {
  state: CrumbState;
  effects: Effect[];
}

export function reduce(state: CrumbState, event: Message): ReduceResult {
  // Mutate a shallow clone — every nested update copies what it touches.
  const next: CrumbState = {
    ...state,
    last_message: event,
    task_ledger: { ...state.task_ledger },
    progress_ledger: {
      ...state.progress_ledger,
      step: state.progress_ledger.step + 1,
      circuit_breaker: { ...state.progress_ledger.circuit_breaker },
      adapter_override: { ...state.progress_ledger.adapter_override },
      score_history: [...state.progress_ledger.score_history],
    },
  };

  // Track the last active actor so user.veto can rebound to them.
  if (event.from !== 'user' && event.from !== 'coordinator' && event.from !== 'system') {
    next.progress_ledger.last_active_actor = event.from;
  }

  const effects: Effect[] = [];

  switch (event.kind) {
    case 'goal': {
      next.task_ledger.goal = event.body ?? '';
      next.task_ledger.facts.push({
        source_id: event.id,
        text: `user goal: ${event.body ?? ''}`,
        category: 'goal',
      });
      next.progress_ledger.next_speaker = 'planner-lead';
      effects.push({ type: 'spawn', actor: 'planner-lead', adapter: 'claude-local' });
      break;
    }

    case 'spec':
    case 'spec.update': {
      const ac = (event.data?.acceptance_criteria as string[] | undefined) ?? [];
      next.task_ledger.acceptance_criteria = ac;
      for (const item of ac) {
        next.task_ledger.facts.push({
          source_id: event.id,
          text: `AC: ${item}`,
          category: 'spec',
        });
      }
      next.progress_ledger.next_speaker = 'builder';
      const adapter = pickAdapter(next, 'builder');
      effects.push({ type: 'spawn', actor: 'builder', adapter });
      break;
    }

    case 'build': {
      // v3: build → deterministic qa-check effect (no LLM). qa.result event flows back.
      // See [[bagelcode-system-architecture-v3]] §4.2 (per-turn flow), §7 (3-layer scoring).
      const artifacts = event.artifacts ?? next.task_ledger.artifacts;
      const lastArtifact = artifacts[artifacts.length - 1];
      const artifactPath = lastArtifact?.path ?? 'artifacts/game.html';
      const artifactSha = lastArtifact?.sha256;
      effects.push({
        type: 'qa_check',
        artifact: artifactPath,
        build_event_id: event.id,
        artifact_sha256: artifactSha,
      });
      break;
    }

    case 'qa.result': {
      // v3: qa.result → spawn verifier (CourtEval inline 4 sub-step).
      // Verifier reads qa.result as D2 + D6 ground truth lookup.
      next.progress_ledger.next_speaker = 'verifier';
      const adapter = pickAdapter(next, 'verifier');
      effects.push({ type: 'spawn', actor: 'verifier', adapter });
      break;
    }

    case 'verify.result':
    case 'judge.score': {
      const verdict = (event.scores?.verdict ?? null) as Verdict | null;
      const aggregate = event.scores?.aggregate ?? 0;
      if (verdict) {
        next.progress_ledger.score_history.push({
          msg_id: event.id,
          aggregate,
          verdict,
        });
      }
      // Adaptive stop: if last 2 verdicts have variance < 1.0, force done.
      if (shouldAdaptiveStop(next.progress_ledger.score_history)) {
        next.done = true;
        effects.push({ type: 'done', reason: 'adaptive_stop' });
        break;
      }
      if (verdict === 'PASS') {
        next.done = true;
        effects.push({ type: 'done', reason: 'verdict_pass' });
      } else if (verdict === 'PARTIAL') {
        effects.push({
          type: 'hook',
          kind: 'partial',
          body: 'Verifier returned PARTIAL — please confirm or veto',
          data: { aggregate, scores: event.scores },
        });
      } else if (verdict === 'FAIL' || verdict === 'REJECT') {
        // Rollback to planner for respec — unless engineering circuit is OPEN, then fallback.
        const eng = next.progress_ledger.circuit_breaker['builder'];
        if (eng?.state === 'OPEN') {
          next.progress_ledger.next_speaker = 'builder-fallback';
          effects.push({
            type: 'spawn',
            actor: 'builder-fallback',
            adapter: 'claude-local',
          });
        } else {
          next.progress_ledger.next_speaker = 'planner-lead';
          effects.push({
            type: 'rollback',
            to: 'planner-lead',
            feedback: event.scores?.feedback ?? 'verify failed',
          });
        }
      }
      break;
    }

    case 'user.veto': {
      const target = next.progress_ledger.last_active_actor;
      if (target && (target === 'planner-lead' || target === 'builder')) {
        next.progress_ledger.next_speaker = target;
        effects.push({
          type: 'spawn',
          actor: target,
          adapter: pickAdapter(next, target),
          prompt: event.body,
        });
      }
      break;
    }

    case 'user.intervene': {
      next.task_ledger.facts.push({
        source_id: event.id,
        text: `user intervene: ${event.body ?? ''}`,
        category: 'constraint',
      });
      break;
    }

    case 'error': {
      // Increment circuit breaker on the failing actor.
      const actor = event.from;
      if (actor !== 'user' && actor !== 'system' && actor !== 'coordinator') {
        const cur = next.progress_ledger.circuit_breaker[actor] ?? {
          state: 'CLOSED' as const,
          consecutive_failures: 0,
        };
        const failures = cur.consecutive_failures + 1;
        next.progress_ledger.circuit_breaker[actor] = {
          state: failures >= CIRCUIT_OPEN_AT ? 'OPEN' : 'CLOSED',
          consecutive_failures: failures,
          last_failure_id: event.id,
        };
      }
      next.progress_ledger.stuck_count += 1;
      if (next.progress_ledger.stuck_count >= STUCK_THRESHOLD) {
        effects.push({
          type: 'hook',
          kind: 'stuck',
          body: 'session stuck — manual intervention requested',
        });
      }
      break;
    }

    case 'artifact.created': {
      for (const a of event.artifacts ?? []) {
        next.task_ledger.artifacts.push({ path: a.path, sha256: a.sha256 });
      }
      break;
    }

    case 'handoff.requested': {
      // Coordinator acknowledges; the actual spawn happens via the routing on the
      // *content* event (spec / verify.result), not the handoff itself.
      break;
    }

    default:
      // No state transition for note/debate/audit/tool.*/etc.
      break;
  }

  return { state: next, effects };
}

function pickAdapter(state: CrumbState, actor: 'builder' | 'verifier' | 'planner-lead'): string {
  const override = state.progress_ledger.adapter_override[actor];
  if (override) return override;
  if (actor === 'builder') {
    const eng = state.progress_ledger.circuit_breaker['builder'];
    if (eng?.state === 'OPEN') return 'claude-local'; // fallback to builder-fallback uses claude
    return 'codex-local';
  }
  if (actor === 'verifier') {
    // bagelcode-cross-3way preset: verifier = gemini-cli (multimodal). Default codex if Gemini unavailable.
    // Adapter override is the proper P0 path — preset-loader should populate this.
    return 'claude-local';
  }
  return 'claude-local';
}

function shouldAdaptiveStop(history: { aggregate: number }[]): boolean {
  if (history.length < 2) return false;
  const last2 = history.slice(-2).map((h) => h.aggregate);
  const variance = Math.abs(last2[0] - last2[1]);
  return variance < ADAPTIVE_STOP_VARIANCE;
}
