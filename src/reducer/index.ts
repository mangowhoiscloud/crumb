/**
 * Coordinator reducer — pure (state, event) → { state, effects }.
 * No I/O, no time, no randomness. Determinism is an iron constraint:
 * replay(transcript) MUST yield the same effect sequence as live execution.
 *
 * Routing rules mirror agents/coordinator.md §routing-rules.
 */

import type { Actor, Message, Scores, Verdict } from '../protocol/types.js';
import type { CrumbState } from '../state/types.js';
import { isGenreProfile, isPersistenceProfile } from '../state/types.js';
import type { Effect } from '../effects/types.js';
import { checkAntiDeception } from '../validator/anti-deception.js';

const STUCK_THRESHOLD = 5;
const ADAPTIVE_STOP_VARIANCE = 1.0;
const CIRCUIT_OPEN_AT = 3;

// v0.2.0 budget guardrails — hard caps. Wiki: bagelcode-budget-guardrails.md §"P0".
const RESPEC_MAX = 3; // max # of spec.update events before done(too_many_respec)
const VERIFY_MAX = 5; // max # of judge.score events before done(too_many_verify)
// v0.4.2 — token budget defaults raised 5×. Live session 01KQNEYQT53P5JFGD0944NBZ9D
// (Reba Berserker, multi-file PWA) consumed 111,951 tokens before the verifier
// could even wake — builder alone emitted ~53KB of code (17 files) which cost
// ~50K input + output tokens, blowing the 50K hard cap mid-build. The reducer
// then emitted done(token_exhausted) → state.done=true → coordinator's
// `if (state.done) return;` skipped every subsequent reduce, including the
// verifier's judge.score, which means anti-deception (validator) never fired
// for that session.
//
// New defaults: 250K hook, 300K hard. Sized for one full spec → multi-file
// build → qa_check → CourtEval verifier loop with ~30% headroom for a single
// adapter-swap respawn. CRUMB_TOKEN_BUDGET_HOOK / CRUMB_TOKEN_BUDGET_HARD
// env vars still override for short demos and CI.
const TOKEN_BUDGET_HOOK = Number(process.env.CRUMB_TOKEN_BUDGET_HOOK) || 250_000;
const TOKEN_BUDGET_HARD = Number(process.env.CRUMB_TOKEN_BUDGET_HARD) || 300_000;

// v0.2.0 ratchet (autoresearch P4 keep/revert) — score regression beyond this many
// aggregate points triggers done(ratchet_revert) to stop unbounded loops.
const RATCHET_REGRESSION_THRESHOLD = 2;

export interface ReduceResult {
  state: CrumbState;
  effects: Effect[];
}

// Single-file reducer is intentional. 2026 frontier evidence (LongCodeBench
// arXiv 2505.07897 + Karpathy nanochat / microgpt) shows that a coherent long
// single file outperforms equivalent functionality split across many small
// files for LLM editing accuracy — the cost is fan-out, not LoC. Splitting the
// 18-case switch into 18 files would convert single-file fan-out cost into
// 18-file fan-out cost. See wiki/synthesis/bagelcode-user-intervention-frontier-2026-05-02.md
// + wiki/references/bagelcode-nl-intervention-12-systems-2026-05-02.md §5.
// eslint-disable-next-line sonarjs/cognitive-complexity
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
      // v0.3.1: stash whether the goal carried video_refs so pickAdapter('researcher')
      // can route. true → gemini-sdk (programmatic video evidence), false →
      // claude-local / ambient (LLM-driven text research). Replaces the previous
      // gemini-sdk text-only stub which emitted empty reference_games[] regardless.
      const goalData = (event.data ?? {}) as {
        video_refs?: unknown;
        genre_profile?: unknown;
        persistence_profile?: unknown;
      };
      const refs = Array.isArray(goalData.video_refs) ? goalData.video_refs : [];
      next.goal_has_video_refs = refs.some((r) => typeof r === 'string' && r.length > 0);
      // v0.4: explicit profile pre-selection from CLI flags / Studio picker.
      // When absent, leave undefined so planner-lead resolves via researcher
      // proposal (genre) + leaderboard-marker trigger logic (persistence).
      // See agents/specialists/game-design.md §1.3 / §1.4.
      if (isGenreProfile(goalData.genre_profile)) {
        next.task_ledger.genre_profile = goalData.genre_profile;
      }
      if (isPersistenceProfile(goalData.persistence_profile)) {
        next.task_ledger.persistence_profile = goalData.persistence_profile;
      }
      next.progress_ledger.next_speaker = 'planner-lead';
      effects.push({
        type: 'spawn',
        actor: 'planner-lead',
        adapter: 'claude-local',
        // Pass the goal as the kickoff prompt. Without it, the adapter
        // falls back to a generic "continue" message and Claude sometimes
        // responds "awaiting goal input" instead of acting on the transcript.
        // Observed: run 01KQMCCR6M emitted only stdout="Planner-lead spawn
        // ready. Awaiting kind=goal" and exited 0 in 12s with no events.
        prompt: `User goal: ${event.body ?? ''}\n\nBegin your turn now per the system prompt — read $CRUMB_TRANSCRIPT_PATH for full context and execute step 1 (Socratic round).`,
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
      // v0.3.5 — capture deterministic AC predicates if planner-lead compiled any.
      // See agents/specialists/game-design.md §AC-Predicate-Compile.
      const predicates = event.data?.ac_predicates;
      if (Array.isArray(predicates)) {
        next.task_ledger.ac_predicates = predicates
          .filter(
            (
              p,
            ): p is { id: string; intent: string; predicate_js: string } & Record<
              string,
              unknown
            > =>
              typeof p === 'object' &&
              p !== null &&
              typeof (p as Record<string, unknown>).id === 'string' &&
              typeof (p as Record<string, unknown>).intent === 'string' &&
              typeof (p as Record<string, unknown>).predicate_js === 'string',
          )
          .map((p) => ({
            id: p.id,
            intent: p.intent,
            predicate_js: p.predicate_js,
            ...(typeof p.action_js === 'string' || p.action_js === null
              ? { action_js: p.action_js as string | null }
              : {}),
            ...(typeof p.wait_ms === 'number' ? { wait_ms: p.wait_ms } : {}),
            ...(typeof p.timeout_ms === 'number' ? { timeout_ms: p.timeout_ms } : {}),
          }));
      }
      // v0.2.0 budget cap: respec_count > RESPEC_MAX → done(too_many_respec).
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
      // v0.1: build → deterministic qa-check effect (no LLM). qa.result event flows back.
      // See [[bagelcode-system-architecture-v0.1]] §4.2 (per-turn flow), §7 (3-layer scoring).
      const artifacts = event.artifacts ?? next.task_ledger.artifacts;
      const lastArtifact = artifacts[artifacts.length - 1];
      const artifactPath = lastArtifact?.path ?? 'artifacts/game.html';
      const artifactSha = lastArtifact?.sha256;
      // Stash the builder's provider so anti-deception Rule 4 (self-bias risk)
      // can compare it against the verifier's provider on judge.score events.
      next.last_builder_provider = event.metadata?.provider ?? null;
      effects.push({
        type: 'qa_check',
        artifact: artifactPath,
        build_event_id: event.id,
        artifact_sha256: artifactSha,
        ...(next.task_ledger.ac_predicates.length > 0
          ? { ac_predicates: next.task_ledger.ac_predicates }
          : {}),
      });
      break;
    }

    case 'qa.result': {
      // v0.1: qa.result → spawn verifier (CourtEval inline 4 sub-step).
      // Verifier reads qa.result as D2 + D6 ground truth lookup.
      // Stash exec_exit_code so the reducer can run anti-deception Rules 1, 2
      // when the next judge.score arrives (architecture invariant #5).
      const data = (event.data ?? {}) as Record<string, unknown>;
      const exit = typeof data.exec_exit_code === 'number' ? data.exec_exit_code : 1;
      const smoke = data.cross_browser_smoke;
      next.last_qa_result = {
        build_event_id: String(data.build_event_id ?? event.parent_event_id ?? ''),
        exec_exit_code: exit,
        ...(smoke === 'ok' || smoke === 'fail' || smoke === 'skipped'
          ? { cross_browser_smoke: smoke }
          : {}),
      };
      // P1 #7: verifier circuit OPEN → no working judge path. Without a
      // verifier the pipeline can't get a verdict, so spawning again would
      // just stack more errors. Terminate with a distinct done reason.
      const verifierBreaker = next.progress_ledger.circuit_breaker['verifier'];
      if (verifierBreaker?.state === 'OPEN') {
        next.done = true;
        effects.push({ type: 'done', reason: 'verifier_unavailable' });
        break;
      }
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

    case 'step.research.video': {
      // v0.3.0: track every video evidence event id so anti-deception Rule 5
      // (researcher_video_evidence_missing) can verify the verifier cited at
      // least one of these in scores.D5.evidence at judge.score time.
      next.research_video_evidence_ids = [...next.research_video_evidence_ids, event.id];
      break;
    }

    case 'verify.result':
    case 'judge.score': {
      // Anti-deception pass — Rules 1, 2, 4, 5 (qa-check ground truth + self-bias
      // + researcher video evidence). Rule 3 (D4 override) needs autoScores which
      // requires the full transcript, so it's skipped here; summary.ts re-runs
      // with autoScores populated for the canonical verdict math.
      // See [[bagelcode-system-architecture-v0.1]] §7.3.
      const audit = checkAntiDeception({
        judgeScore: event,
        qaResult: next.last_qa_result,
        builderProvider: next.last_builder_provider,
        researchVideoEvidenceIds: next.research_video_evidence_ids,
      });
      // Only swap to sanitized scores when violations actually fired. The
      // validator unconditionally recomputes aggregate from D1–D6 dims, which
      // would zero-out a verifier-supplied aggregate that didn't ship per-dim
      // breakdowns — keep the original output when there's nothing to correct.
      const useSanitized = audit.violations.length > 0;
      const sanitized: Scores = useSanitized ? audit.scores : (event.scores ?? {});
      const verdict = (sanitized.verdict ?? null) as Verdict | null;
      const aggregate = sanitized.aggregate ?? event.scores?.aggregate ?? 0;

      // Append a kind=audit event whenever violations fire — that record (not
      // the original judge.score) is the canonical anti-deception trail. The
      // verifier's raw output stays in transcript as evidence for replay.
      if (audit.violations.length > 0) {
        effects.push({
          type: 'append',
          message: {
            // C3 — use next.session_id as the canonical source for all reducer-
            // synthesized append effects. event.session_id and next.session_id
            // are equal in single-session operation but state-derived form is
            // the invariant we want to anchor on (see coordinator §"Hub-Ledger-
            // Spoke" — state is the single source of truth, events flow through).
            session_id: next.session_id,
            from: 'validator',
            kind: 'audit',
            parent_event_id: event.id,
            body: audit.violations.join(', '),
            data: {
              violations: audit.violations,
              corrected_verdict: sanitized.verdict ?? null,
              corrected_aggregate: sanitized.aggregate ?? null,
            },
            metadata: {
              deterministic: true,
              tool: 'anti-deception@v1',
              audit_violations: audit.violations,
            },
          },
        });
      }

      if (verdict) {
        next.progress_ledger.score_history.push({
          msg_id: event.id,
          aggregate,
          verdict,
        });
      }
      // v0.2.0 budget cap: verify_count > VERIFY_MAX → done(too_many_verify).
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
      // v0.2.0 ratchet (autoresearch P4 keep/revert): track best aggregate so far;
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
          data: { aggregate, scores: sanitized },
        });
      } else if (verdict === 'FAIL' || verdict === 'REJECT') {
        // PR-Prune-2 — three-way routing on FAIL:
        //   1. Builder circuit OPEN, adapter swap exhausted → done(builder_circuit_open)
        //   2. Builder circuit OPEN, swap available         → adapter swap to claude-local + respawn builder
        //   3. Builder CLOSED + Critical                    → rollback(planner-lead) [spec needs change]
        //   4. Builder CLOSED + Important/Minor             → spawn(builder) w/ sandwich_append
        //
        // The verifier MAY hint at a deviation type via judge.score
        // data.deviation.type ∈ {Critical, Important, Minor}, mirroring the
        // code-review-protocol.md taxonomy. When omitted, we default to
        // Important (respawn builder) — the prior behavior of always going
        // to planner-lead overspecified the fix and burned a full plan-cycle
        // for trivial issues like "missing entry redirector".
        //
        // Pre-PR-Prune-2 design used a separate `builder-fallback` actor for
        // path (2). That actor was never spawned in 30+ days of production
        // sessions — the same effect (different LLM) is achieved by
        // overriding `adapter_override.builder = 'claude-local'` and
        // respawning the original builder. One actor, one sandwich.
        const eng = next.progress_ledger.circuit_breaker['builder'];
        if (eng?.state === 'OPEN') {
          const currentOverride = next.progress_ledger.adapter_override['builder'];
          if (currentOverride === 'claude-local') {
            next.done = true;
            effects.push({ type: 'done', reason: 'builder_circuit_open' });
            break;
          }
          next.progress_ledger.adapter_override['builder'] = 'claude-local';
          next.progress_ledger.next_speaker = 'builder';
          effects.push({
            type: 'append',
            message: {
              session_id: next.session_id,
              from: 'system',
              parent_event_id: event.id,
              kind: 'audit',
              body: `adapter_swapped — builder circuit OPEN (${eng.consecutive_failures} consecutive failures), swapping adapter to claude-local`,
              data: {
                event: 'adapter_swapped',
                actor: 'builder',
                reason: 'builder_circuit_open',
                consecutive_failures: eng.consecutive_failures,
                last_failure_id: eng.last_failure_id,
                new_adapter: 'claude-local',
              },
              metadata: { deterministic: true, tool: 'reducer-adapter-swap@v1' },
            },
          });
          effects.push({
            type: 'spawn',
            actor: 'builder',
            adapter: 'claude-local',
            sandwich_appends: collectSandwichAppends(next, 'builder'),
          });
        } else {
          // PR-G2 — deviation-typed routing.
          const deviation = ((event.scores as { deviation?: { type?: string } } | undefined)
            ?.deviation?.type ?? 'Important') as 'Critical' | 'Important' | 'Minor';
          const feedback = sanitized.feedback ?? event.scores?.feedback ?? 'verify failed';
          if (deviation === 'Critical') {
            next.progress_ledger.next_speaker = 'planner-lead';
            effects.push({
              type: 'rollback',
              to: 'planner-lead',
              feedback,
            });
          } else {
            // Important / Minor → respawn original builder with verifier
            // feedback injected as a one-shot sandwich_append. Avoids a full
            // plan cycle for tightly-scoped fixes (e.g. "add entry redirector",
            // observed in session 01KQNEYQT53P5JFGD0944NBZ9D).
            const suggested = (event.scores as { suggested_change?: string } | undefined)
              ?.suggested_change;
            const appendBody =
              `Verifier feedback (${deviation}): ${feedback}` +
              (suggested ? `\n\nSuggested change:\n${suggested}` : '');
            next.task_ledger.facts.push({
              source_id: event.id,
              text: appendBody,
              category: 'sandwich_append',
              target_actor: 'builder',
            });
            next.progress_ledger.next_speaker = 'builder';
            effects.push({
              type: 'spawn',
              actor: 'builder',
              adapter: pickAdapter(next, 'builder'),
              sandwich_appends: collectSandwichAppends(next, 'builder'),
            });
          }
        }
      }
      break;
    }

    case 'handoff.rollback': {
      // PR-G2 — verifier explicitly asked for a rollback (separate from the
      // verdict path above; e.g. when judge.score was already accepted but a
      // new evidence prompts a rebuild). The reducer ignores the verifier's
      // suggested `to` field (sandwich text was self-routing fiction) and
      // dispatches purely on event.data.deviation.type, mirroring the FAIL
      // routing above. data.suggested_change becomes a sandwich_append for the
      // target actor's next spawn so the fix instruction reaches the builder.
      const data =
        (event.data as
          | {
              deviation?: { type?: string };
              suggested_change?: string;
            }
          | undefined) ?? {};
      const deviation = (data.deviation?.type ?? 'Important') as 'Critical' | 'Important' | 'Minor';
      const target: Actor = deviation === 'Critical' ? 'planner-lead' : 'builder';
      if (data.suggested_change) {
        next.task_ledger.facts.push({
          source_id: event.id,
          text: `Verifier rollback (${deviation}):\n${data.suggested_change}`,
          category: 'sandwich_append',
          target_actor: target,
        });
      }
      next.progress_ledger.next_speaker = target;
      effects.push({
        type: 'spawn',
        actor: target,
        adapter: pickAdapter(next, target as 'planner-lead' | 'builder' | 'verifier'),
        sandwich_appends: collectSandwichAppends(next, target),
      });
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
      // v0.2.0 G3+G6 — actor-targeted intervention + LangGraph Command(goto/update) pattern.
      //
      // data.target_actor: route the user message to a specific actor's task_ledger
      //   (AutoGen UserProxyAgent + GroupChatManager dynamic-speaker pattern).
      // data.goto: force progress_ledger.next_speaker = <actor> and spawn (LangGraph
      //   Command(goto)). Skips the normal routing.
      // data.swap: { from, to } — adapter override (Paperclip "swap agent" pattern).
      // data.reset_circuit: clear circuit_breaker for the named actor (or all).
      // data.cancel: SIGTERM the live spawn for the named actor (or 'all'). v0.4.2
      //   — emits cancel_spawn effect; live dispatcher fires the AbortController.
      //   Lossy: kills mid-edit, partial artifacts left as-is.
      const data = (event.data ?? {}) as {
        target_actor?: Actor;
        goto?: Actor;
        swap?: { from: Actor; to: string };
        reset_circuit?: Actor | true;
        sandwich_append?: string;
        cancel?: Actor | 'all';
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

      // v0.4.2 — user-driven mid-spawn cancel. Emits a cancel_spawn effect
      // that the live dispatcher translates into `controller.abort()` →
      // SIGTERM on the running subprocess. Per-actor when data.cancel is an
      // Actor name; whole-session when 'all'. Frontier consensus (12-system
      // survey: bagelcode-nl-intervention-12-systems-2026-05-02): only
      // IDE-plugin tier (Cline / Continue / Cursor) wires AbortSignal into
      // the LLM stream, all three with documented cancellation-leak bugs.
      // Crumb's cooperative-checkpoint default stays — this is opt-in via
      // an explicit /cancel verb so the lossy mid-edit kill is the user's
      // choice, not the harness's.
      if (data.cancel) {
        effects.push({
          type: 'cancel_spawn',
          actor: data.cancel,
          reason: event.body ? `user-requested cancel: ${event.body}` : 'user-requested cancel',
        });
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
      } else if (
        // PR-G7-A — `@<actor> body` shorthand (target_actor only, no goto).
        // Previously this only recorded a fact and did NOT spawn. Users typing
        // `@builder Codex 말고 claude-local 사용해` expected the builder to wake
        // up; instead the line was silently dropped (real footgun in
        // 01KQNAK1CXTBDEBX2WP2QQK891 inbox — 5 of 6 lines wasted). Now an
        // explicit @actor with a body spawns that actor with the body as
        // prompt, unless the actor is paused.
        data.target_actor &&
        !data.swap &&
        !data.reset_circuit &&
        !data.sandwich_append &&
        data.target_actor !== 'user' &&
        data.target_actor !== 'system' &&
        data.target_actor !== 'coordinator' &&
        data.target_actor !== 'validator' &&
        event.body &&
        event.body.trim().length > 0 &&
        !next.progress_ledger.paused &&
        !next.progress_ledger.paused_actors.includes(data.target_actor)
      ) {
        next.progress_ledger.next_speaker = data.target_actor;
        effects.push({
          type: 'spawn',
          actor: data.target_actor,
          adapter: pickAdapter(next, data.target_actor as 'planner-lead' | 'builder' | 'verifier'),
          prompt: event.body,
          sandwich_appends: collectSandwichAppends(next, data.target_actor),
        });
      }

      break;
    }

    case 'user.pause': {
      // v0.2.0 G1+G5 — global OR per-actor pause (Paperclip "pause any agent" pattern).
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
      // v0.2.0 G1+G5 — clears pause (global OR per-actor). LangGraph Command(resume=value).
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
      // v0.2.0 G1 — explicit user approval. Promotes the most recent PARTIAL verdict
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
      // Most handoffs are acknowledged here as no-ops — the actual spawn happens
      // via routing on the *content* event (spec / verify.result). Researcher is
      // the exception (v0.3.0): planner-lead emits handoff.requested(to=researcher)
      // after step.concept, and there is no separate "concept-locked" content
      // event we can route on, so we spawn the researcher directly here.
      if (event.to === 'researcher' && event.from === 'planner-lead') {
        next.progress_ledger.next_speaker = 'researcher';
        const adapter = pickAdapter(next, 'researcher');
        effects.push({
          type: 'spawn',
          actor: 'researcher',
          adapter,
          sandwich_appends: collectSandwichAppends(next, 'researcher'),
        });
        break;
      }
      // P1 #8: any other handoff.requested target falls through silently. To
      // prevent future "no-success / no-error" stall when a new handoff route
      // is added without reducer wiring, emit a kind=note recording the
      // unhandled handoff. This is observability-only — does not change
      // routing — but turns silent stalls into visible warnings in the
      // transcript so debug + studio can surface them.
      if (event.to) {
        effects.push({
          type: 'append',
          message: {
            session_id: next.session_id,
            from: 'system',
            parent_event_id: event.id, // C2 — message-level parent so studio thread nav works
            kind: 'note',
            body: `handoff.requested to=${event.to} from=${event.from} — no reducer routing for this pair (acknowledged as no-op)`,
            data: {
              event: 'handoff_unrouted',
              from: event.from,
              to: event.to,
            },
            metadata: { deterministic: true, tool: 'reducer-handoff-default@v1' },
          },
        });
      }
      break;
    }

    case 'step.research': {
      // v0.3.0: researcher synthesis arrived. Re-spawn planner-lead for phase B
      // (Design + Synth). The new spawn re-derives Phase A state from
      // transcript.jsonl — there is no `--resume` wiring yet, so the underlying
      // CLI session_id is fresh and the Anthropic prompt cache misses across
      // phases. The `adapter_session_id` / `cache_carry_over` schema fields
      // exist as forward-compat declarations (protocol/types.ts) but are not
      // consumed by any adapter. TODO: wire `--resume <prev_session_id>` in
      // claude-local so the system-prompt prefix actually caches across phases.
      if (event.from === 'researcher') {
        next.progress_ledger.next_speaker = 'planner-lead';
        effects.push({
          type: 'spawn',
          actor: 'planner-lead',
          adapter: pickAdapter(next, 'planner-lead'),
          sandwich_appends: collectSandwichAppends(next, 'planner-lead'),
        });
      }
      break;
    }

    default:
      // No state transition for note/debate/audit/tool.*/etc.
      break;
  }

  // v0.2.0 token budget (PR #12) — accumulate across every event regardless of kind.
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

  // v0.2.0 G1+G5 pause filter — demote spawn to hook so dispatcher doesn't burn an LLM
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
 * v0.2.0 G4 — collect sandwich_append facts that apply to a given actor.
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

function pickAdapter(
  state: CrumbState,
  actor: 'builder' | 'verifier' | 'planner-lead' | 'researcher',
): string {
  const override = state.progress_ledger.adapter_override[actor];
  if (override) return override;
  if (actor === 'builder') {
    // PR-Prune-2: when circuit OPENs the FAIL handler sets
    // adapter_override.builder='claude-local', so the override branch above
    // already handles the swap. This defensive check covers the rare case
    // where state is restored mid-flight with circuit OPEN but no override.
    const eng = state.progress_ledger.circuit_breaker['builder'];
    if (eng?.state === 'OPEN') return 'claude-local';
    return 'codex-local';
  }
  if (actor === 'verifier') {
    // bagelcode-cross-3way preset: verifier = gemini-cli (multimodal). Default codex if Gemini unavailable.
    // Adapter override is the proper P0 path — preset-loader should populate this.
    return 'claude-local';
  }
  if (actor === 'researcher') {
    // v0.3.1: branch on goal.data.video_refs presence (set by goal reducer case).
    //  - has video → gemini-sdk (programmatic Gemini 3.1 Pro frame sampling, replay
    //    via cache_key dedup; gemini-cli has p1-unresolved video bugs so SDK is the
    //    deterministic path).
    //  - no video → claude-local (LLM-driven text research per
    //    agents/researcher.md step 1+3 fallback: read wiki references, identify
    //    3-5 reference games, distill design lessons). Replaces v0.3.0's text-only
    //    stub which emitted empty reference_games[] / design_lessons[] regardless.
    // Preset binding (e.g. bagelcode-cross-3way → gemini-sdk) overrides this
    // default via the dispatcher's HARNESS_TO_ADAPTER mapping.
    return state.goal_has_video_refs ? 'gemini-sdk' : 'claude-local';
  }
  return 'claude-local';
}

function shouldAdaptiveStop(history: { aggregate: number }[]): boolean {
  if (history.length < 2) return false;
  const last2 = history.slice(-2).map((h) => h.aggregate);
  const variance = Math.abs(last2[0] - last2[1]);
  return variance < ADAPTIVE_STOP_VARIANCE;
}
