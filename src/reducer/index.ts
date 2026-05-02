/**
 * Coordinator reducer — pure (state, event) → { state, effects }.
 * No I/O, no time, no randomness. Determinism is an iron constraint:
 * replay(transcript) MUST yield the same effect sequence as live execution.
 *
 * Routing rules mirror agents/coordinator.md §routing-rules.
 */

import type { Actor, Message, Verdict } from '../protocol/types.js';
import type { CrumbState } from '../state/types.js';
import type { Effect } from '../effects/types.js';

const STUCK_THRESHOLD = 5;
const ADAPTIVE_STOP_VARIANCE = 1.0;
const CIRCUIT_OPEN_AT = 3;

// v3.2 budget guardrails — hard caps. Wiki: bagelcode-budget-guardrails.md §"P0".
const RESPEC_MAX = 3; // max # of spec.update events before done(too_many_respec)
const VERIFY_MAX = 5; // max # of judge.score events before done(too_many_verify)
const TOKEN_BUDGET_HOOK = 40_000; // hook(token_budget) at this threshold
const TOKEN_BUDGET_HARD = 50_000; // done(token_exhausted) at this threshold

// v3.2 ratchet (autoresearch P4 keep/revert) — score regression beyond this many
// aggregate points triggers done(ratchet_revert) to stop unbounded loops.
const RATCHET_REGRESSION_THRESHOLD = 2;

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
    // Circuit breaker recovery: a non-error event from this actor proves the
    // current spawn produced output, so reset the failure streak. Without
    // this the breaker is one-way — a single transient failure permanently
    // pins the actor to OPEN/fallback for the rest of the session.
    if (event.kind !== 'error') {
      const cur = next.progress_ledger.circuit_breaker[event.from];
      if (cur && cur.consecutive_failures > 0) {
        next.progress_ledger.circuit_breaker[event.from] = {
          state: 'CLOSED',
          consecutive_failures: 0,
          last_failure_id: cur.last_failure_id,
        };
      }
    }
  }

  const effects: Effect[] = [];

  switch (event.kind) {
    case 'session.start': {
      // Capture wall-clock start once (loop watchdog SIGTERMs after 30min).
      if (!next.progress_ledger.session_started_at) {
        next.progress_ledger.session_started_at = event.ts;
      }
      break;
    }

    case 'goal': {
      next.task_ledger.goal = event.body ?? '';
      next.task_ledger.facts.push({
        source_id: event.id,
        text: `user goal: ${event.body ?? ''}`,
        category: 'goal',
      });
      next.progress_ledger.next_speaker = 'planner-lead';
      effects.push({
        type: 'spawn',
        actor: 'planner-lead',
        adapter: 'claude-local',
        sandwich_appends: collectSandwichAppends(next, 'planner-lead'),
      });
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
      // v3.2 budget cap: respec_count > RESPEC_MAX → done(too_many_respec).
      // Only spec.update counts as a respec (initial spec is the first try).
      if (event.kind === 'spec.update') {
        next.progress_ledger.respec_count += 1;
        if (next.progress_ledger.respec_count > RESPEC_MAX) {
          next.done = true;
          effects.push({ type: 'done', reason: 'too_many_respec' });
          break;
        }
      }
      next.progress_ledger.next_speaker = 'builder';
      const adapter = pickAdapter(next, 'builder');
      effects.push({
        type: 'spawn',
        actor: 'builder',
        adapter,
        sandwich_appends: collectSandwichAppends(next, 'builder'),
      });
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
      effects.push({
        type: 'spawn',
        actor: 'verifier',
        adapter,
        sandwich_appends: collectSandwichAppends(next, 'verifier'),
      });
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
      // v3.2 budget cap: verify_count > VERIFY_MAX → done(too_many_verify).
      // Count judge.score only — verify.result is its legacy alias and the
      // verifier emits BOTH for backwards compat (see agents/verifier.md
      // §4 Re-grader). Counting both would halve the effective cap.
      if (event.kind === 'judge.score') {
        next.progress_ledger.verify_count += 1;
        if (next.progress_ledger.verify_count > VERIFY_MAX) {
          next.done = true;
          effects.push({ type: 'done', reason: 'too_many_verify' });
          break;
        }
      }
      // v3.2 ratchet (autoresearch P4 keep/revert): track best aggregate so far;
      // RATCHET_REGRESSION_THRESHOLD-point drop triggers auto-terminate to prevent
      // unbounded score-oscillation loops.
      if (verdict && aggregate > 0) {
        const prev = next.progress_ledger.max_aggregate_so_far;
        if (aggregate >= prev) {
          next.progress_ledger.max_aggregate_so_far = aggregate;
          next.progress_ledger.max_aggregate_msg_id = event.id;
        } else if (prev - aggregate >= RATCHET_REGRESSION_THRESHOLD) {
          next.done = true;
          effects.push({ type: 'done', reason: 'ratchet_revert' });
          break;
        }
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
            sandwich_appends: collectSandwichAppends(next, 'builder-fallback'),
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
          sandwich_appends: collectSandwichAppends(next, target),
        });
      }
      break;
    }

    case 'user.intervene': {
      // v3.2 G3+G6 — actor-targeted intervention + LangGraph Command(goto/update) pattern.
      //
      // data.target_actor: route the user message to a specific actor's task_ledger
      //   (AutoGen UserProxyAgent + GroupChatManager dynamic-speaker pattern).
      // data.goto: force progress_ledger.next_speaker = <actor> and spawn (LangGraph
      //   Command(goto)). Skips the normal routing.
      // data.swap: { from, to } — adapter override (Paperclip "swap agent" pattern).
      // data.reset_circuit: clear circuit_breaker for the named actor (or all).
      const data = (event.data ?? {}) as {
        target_actor?: Actor;
        goto?: Actor;
        swap?: { from: Actor; to: string };
        reset_circuit?: Actor | true;
        sandwich_append?: string;
      };

      // Always record the intervention as a fact, but tag with the target actor when given.
      next.task_ledger.facts.push({
        source_id: event.id,
        text: data.target_actor
          ? `user intervene @${data.target_actor}: ${event.body ?? ''}`
          : `user intervene: ${event.body ?? ''}`,
        category: 'constraint',
      });

      // G4 — sandwich_append: persistent append (across all subsequent spawns
      // of the matching actor). Stored as a fact with category='sandwich_append'
      // so the dispatcher can pull it on the next spawn. Optional target_actor
      // scopes the append; absent target = applies to all actors.
      if (data.sandwich_append) {
        next.task_ledger.facts.push({
          source_id: event.id,
          text: data.sandwich_append,
          category: 'sandwich_append',
          target_actor: data.target_actor,
        });
      }

      // G6 — adapter swap (Paperclip-style). Persists in adapter_override for next spawn.
      if (data.swap) {
        next.progress_ledger.adapter_override = {
          ...next.progress_ledger.adapter_override,
          [data.swap.from]: data.swap.to,
        };
      }

      // G6 — circuit breaker reset for the named actor (or all if `true`).
      if (data.reset_circuit) {
        const cb = { ...next.progress_ledger.circuit_breaker };
        if (data.reset_circuit === true) {
          // Clear all entries.
          for (const key of Object.keys(cb) as Actor[]) delete cb[key];
        } else {
          delete cb[data.reset_circuit];
        }
        next.progress_ledger.circuit_breaker = cb;
      }

      // G6 — goto: force the routing decision. Bypasses last_active_actor heuristics.
      if (
        data.goto &&
        data.goto !== 'user' &&
        data.goto !== 'system' &&
        data.goto !== 'coordinator' &&
        data.goto !== 'validator'
      ) {
        next.progress_ledger.next_speaker = data.goto;
        effects.push({
          type: 'spawn',
          actor: data.goto,
          adapter: pickAdapter(next, data.goto as 'planner-lead' | 'builder' | 'verifier'),
          prompt: event.body,
          sandwich_appends: collectSandwichAppends(next, data.goto),
        });
      }

      break;
    }

    case 'user.pause': {
      // v3.2 G1+G5 — global OR per-actor pause (Paperclip "pause any agent" pattern).
      // data.actor=<name> → only that actor is paused; others continue.
      // No data.actor → global pause (G1 default).
      const pauseActor = (event.data as { actor?: Actor } | undefined)?.actor;
      if (pauseActor) {
        if (!next.progress_ledger.paused_actors.includes(pauseActor)) {
          next.progress_ledger.paused_actors = [...next.progress_ledger.paused_actors, pauseActor];
        }
        effects.push({
          type: 'hook',
          kind: 'confirm',
          body: `actor paused by user: ${pauseActor}${event.body ? ` — ${event.body}` : ''}`,
          data: { paused: true, actor: pauseActor },
        });
      } else {
        next.progress_ledger.paused = true;
        effects.push({
          type: 'hook',
          kind: 'confirm',
          body: `session paused by user${event.body ? `: ${event.body}` : ''}`,
          data: { paused: true },
        });
      }
      break;
    }

    case 'user.resume': {
      // v3.2 G1+G5 — clears pause (global OR per-actor). LangGraph Command(resume=value).
      // data.actor=<name> → only that actor is resumed.
      // No data.actor → clear global pause AND all per-actor pauses; re-spawn queued.
      const resumeActor = (event.data as { actor?: Actor } | undefined)?.actor;
      if (resumeActor) {
        next.progress_ledger.paused_actors = next.progress_ledger.paused_actors.filter(
          (a) => a !== resumeActor,
        );
      } else {
        next.progress_ledger.paused = false;
        next.progress_ledger.paused_actors = [];
        const queued = next.progress_ledger.next_speaker;
        if (
          queued &&
          queued !== 'user' &&
          queued !== 'system' &&
          queued !== 'coordinator' &&
          queued !== 'validator'
        ) {
          effects.push({
            type: 'spawn',
            actor: queued,
            adapter: pickAdapter(next, queued as 'planner-lead' | 'builder' | 'verifier'),
            sandwich_appends: collectSandwichAppends(next, queued),
          });
        }
      }
      break;
    }

    case 'user.approve': {
      // v3.2 G1 — explicit user approval. Promotes the most recent PARTIAL verdict
      // to done; harmless if the last verdict was PASS (already done) or absent.
      const lastEntry =
        next.progress_ledger.score_history[next.progress_ledger.score_history.length - 1];
      if (lastEntry?.verdict === 'PARTIAL') {
        next.done = true;
        effects.push({
          type: 'done',
          reason: `user_approve_partial (msg=${lastEntry.msg_id})`,
        });
      }
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

  // v3.2 token budget (PR #12) — accumulate across every event regardless of kind.
  // Hook fires once at the 40K crossing (transition guard via prev/next compare),
  // hard cap at 50K terminates the session. Determinism: event.metadata only.
  const tokensThisEvent = (event.metadata?.tokens_in ?? 0) + (event.metadata?.tokens_out ?? 0);
  if (tokensThisEvent > 0) {
    const prevTotal = state.progress_ledger.session_token_total;
    const nextTotal = prevTotal + tokensThisEvent;
    next.progress_ledger.session_token_total = nextTotal;
    if (!next.done && nextTotal >= TOKEN_BUDGET_HARD) {
      next.done = true;
      effects.push({ type: 'done', reason: 'token_exhausted' });
    } else if (!next.done && prevTotal < TOKEN_BUDGET_HOOK && nextTotal >= TOKEN_BUDGET_HOOK) {
      effects.push({
        type: 'hook',
        kind: 'token_budget',
        body: `session token total ${nextTotal} crossed ${TOKEN_BUDGET_HOOK} (hard cap ${TOKEN_BUDGET_HARD})`,
        data: { tokens: nextTotal, threshold: TOKEN_BUDGET_HOOK, hard_cap: TOKEN_BUDGET_HARD },
      });
    }
  }

  // v3.2 G1+G5 pause filter — demote spawn to hook so dispatcher doesn't burn an LLM
  // call. Routing survives in next_speaker for `user.resume` to re-fire later. Runs
  // AFTER token budget so budget hooks / done effects are not filtered.
  if (event.kind !== 'user.resume') {
    const globalPause = next.progress_ledger.paused;
    const pausedActors = next.progress_ledger.paused_actors;
    if (globalPause || pausedActors.length > 0) {
      const filtered: Effect[] = effects.map((e) => {
        if (e.type !== 'spawn') return e;
        if (globalPause || pausedActors.includes(e.actor)) {
          return {
            type: 'hook' as const,
            kind: 'confirm' as const,
            body: globalPause
              ? `paused — would spawn ${e.actor} (queued; emit kind=user.resume to continue)`
              : `actor paused — would spawn ${e.actor} (queued; emit kind=user.resume with data.actor='${e.actor}' to continue)`,
            data: {
              actor: e.actor,
              queued: true,
              paused: true,
              scope: globalPause ? 'global' : 'actor',
            },
          };
        }
        return e;
      });
      return { state: next, effects: filtered };
    }
  }

  return { state: next, effects };
}

/**
 * v3.2 G4 — collect sandwich_append facts that apply to a given actor.
 * Returns the list of {source_id, text} pairs the dispatcher should concat
 * onto the actor's sandwich (after the file-based local override, if any).
 */
function collectSandwichAppends(
  state: CrumbState,
  actor: Actor,
): { source_id: string; text: string }[] {
  return state.task_ledger.facts
    .filter(
      (f) => f.category === 'sandwich_append' && (!f.target_actor || f.target_actor === actor),
    )
    .map((f) => ({ source_id: f.source_id, text: f.text }));
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
