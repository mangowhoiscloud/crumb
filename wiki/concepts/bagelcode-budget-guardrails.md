---
title: Crumb Runaway-Prevention Guardrails — count / time / cost 3 axes
category: concepts
tags: [bagelcode, crumb, guardrails, ratchet, budget, fault-tolerance, anti-deception]
sources:
  - "[[bagelcode-final-design-2026]]"
  - "[[bagelcode-fault-tolerance-design]]"
  - "[[bagelcode-rubric-scoring]]"
  - "[[bagelcode-frontier-rationale-5-claims]]"
summary: Defines guardrails on three axes (max count / wall-clock / token) so that the verify → ratchet pattern does not loop indefinitely or blow through tokens. 5 currently implemented + 8 unimplemented gaps + sprint demo thresholds + priorities.
provenance:
  extracted: 0.78
  inferred: 0.17
  ambiguous: 0.05
created: 2026-05-02
updated: 2026-05-02
---

# Crumb Runaway-Prevention Guardrails

> To keep the verify → ratchet pattern (Karpathy P4: "advance only on verification pass, rollback on failure") from turning into **context gluttony**, we cap each of three axes. Source: 2026-05-02 design review (based on commit `cff232a`).

## Problem definition

The `spec → build → verify → rollback → spec.update → ...` loop can run forever if the verdict never reaches PASS. 3 runaway scenarios:

1. **Score oscillation** — FAIL 8 → PASS 28 → FAIL 12 → PASS 26. Variance is large enough that [[bagelcode-final-design-2026|adaptive stop]] never fires.
2. **Subprocess hang** — claude/codex stops responding without timeout. `idle_timeout` (60s) only checks the *interval between events* — inside the subprocess we wait indefinitely.
3. **Token accumulation** — every spawn injects the entire transcript into the sandwich → late turns consume 5-10× the tokens of the first turn. No cumulative check exists. ^[inferred]

Paperclip Issue #4688 (9 recoveries within 10 minutes, exhausting Anthropic credit) is the same pattern in production. ^[extracted]

## 3-axis split

```
┌─────────────────┬─────────────────────────────────────────────────────┐
│ AXIS 1          │ AXIS 2                  │ AXIS 3                    │
│ Max count       │ Time-budget             │ Cost-budget               │
├─────────────────┼─────────────────────────┼───────────────────────────┤
│ respec_count    │ session_wall_clock      │ session_tokens_total      │
│ verify_count    │ per_spawn_timeout       │ per_spawn_tokens          │
│ total_spawn     │ phase_budget            │ session_cost_usd          │
│ rollback_count  │ idle_gap (present ✓)     │ cache_read_ratio          │
│ user_intervene  │                          │ subscription_quota         │
└─────────────────┴─────────────────────────┴───────────────────────────┘
```

## 5 currently implemented (code-verified)

| Guardrail | Threshold | State field | Triggered effect | Location |
|---|---|---|---|---|
| Adaptive stop | score variance < 1.0 over 2 rounds | `progress.score_history[]` | `done(adaptive_stop)` | `src/reducer/index.ts:80` |
| Circuit breaker | 3 consecutive `kind=error` from same actor | `progress.circuit_breaker[actor]` | fallback adapter on next spawn | `src/reducer/index.ts:147` |
| Stuck count | cumulative errors ≥ 5 | `progress.stuck_count` | `hook(stuck)` | `src/reducer/index.ts:160` |
| Idle timeout | 60s between events | loop watchdog (no state) | `finish(state)` | `src/loop/coordinator.ts:97` |
| Done guard | `state.done` true | `state.done` | ignore subsequent events | `src/loop/coordinator.ts:84` |

## 8 unimplemented gaps

### Axis 1 — Max count

| Gap | Runaway scenario |
|---|---|
| No cap on planner re-spec count | FAIL → rollback → planner → spec.update → FAIL → ... infinite |
| No cap on engineering retries | spec → eng → PARTIAL → user.approve → eng → accumulating |
| No cap on cumulative rollbacks | adaptive stop never fires without a verdict |
| No cap on total turn count | 100 turns are possible |

### Axis 2 — Time-budget

| Gap | Runaway scenario |
|---|---|
| No session wall-clock cap | 10 hours possible (as long as events keep arriving inside `idle_timeout`) |
| No per-spawn timeout | infinite wait when claude/codex subprocess hangs |
| No phase time cap | 30 minutes possible just for the planner Socratic step |

### Axis 3 — Cost-budget

| Gap | Runaway scenario |
|---|---|
| Session-cumulative tokens not summed | metadata.tokens_in/out are recorded but not checked |
| No per-spawn token cap | 50K tokens possible in a single turn |
| No subscription quota awareness | no daily quota tracking for Claude Max / Codex Plus |
| No cache hit monitoring | metadata.cache_read recorded, but no efficiency metric is computed |

## Recommended thresholds (sprint demo target)

```
AXIS 1: Max count
─────────────────
  progress.respec_count       ≤  3   → done(too_many_respec)
  progress.verify_count       ≤  5   → hook(partial)
  progress.total_spawn_count  ≤ 10   → hook(stuck)
  progress.rollback_count     ≤  2   → done(rollback_exhausted)
  progress.user_intervene     ≤ 10   → hook(too_many_intervene)

AXIS 2: Time-budget
───────────────────
  session_wall_clock ≤ 1800s (30min)
    → hook(time_budget) at 24min
    → done(timeout)     at 30min
  per_spawn_timeout  ≤  300s (5min)
    → SIGTERM subprocess
    → kind=error
    → circuit_breaker++
  phase_budget       ≤  600s (10min) per phase
    → kind=audit, body=phase_overrun
  idle_gap           ≤   60s ✓ (already present)

AXIS 3: Cost-budget
───────────────────
  session.tokens_total ≤ 50_000
    → hook(token_budget)    at 40K
    → done(token_exhausted) at 50K
  per_spawn.tokens     ≤ 20_000
    → kind=audit, body=spawn_overrun (no abort — let the single spawn finish)
  session.cost_usd     ≤      0  (subscription only; cap when in API mode)
  cache_read_ratio     ≥    0.30 (target; advisory metric when missed)
```

Basis: ^[inferred] sprint demo length 30 minutes, factoring in the evaluator's attention budget. 50K tokens aligns with the ~50K target in [[bagelcode-caching-strategy]] §Token budget.

## Implementation priority

### P0 — must ship before submission (≈ 1.5h) — **shipped 2026-05-02 (feat/v0.2.0-budget-ratchet)**

Block runaway cases at the schema level:

| # | Guardrail | Status | Implementation location | Justification |
|---|---|---|---|---|
| 1 | `respec_count ≤ 3` → `done(too_many_respec)` | ✅ shipped | `src/reducer/index.ts` §RESPEC_MAX | FAIL→rollback infinite loops are the largest cost risk |
| 2 | `session_wall_clock ≤ 30min` watchdog | ✅ shipped | `src/loop/coordinator.ts` §WALL_CLOCK_HARD_MS_DEFAULT (24min hook + 30min done) | evaluator demo length cap |
| 3 | `per_spawn_timeout ≤ 5min` (SIGTERM) | ✅ shipped | `src/dispatcher/live.ts` §PER_SPAWN_TIMEOUT_MS + `SpawnRequest.signal` (4 adapters wired) | subprocess hang defense |
| 4 | `tokens_total ≤ 50K` → `hook(token_budget)` | ✅ shipped | `src/reducer/index.ts` §TOKEN_BUDGET_HOOK / §TOKEN_BUDGET_HARD (40K hook + 50K done) | accumulate metadata → compare against threshold |
| 5 | `verify_count ≤ 5` → `done(too_many_verify)` | ✅ shipped (promoted P1→P0) | `src/reducer/index.ts` §VERIFY_MAX | user lock: "don't let the loop spin too much" |

### Autoresearch P4 — keep/revert ratchet — **shipped 2026-05-02**

- `RATCHET_REGRESSION_THRESHOLD = 2` aggregate-point regression → `done(ratchet_revert)`. Tracks `max_aggregate_so_far` + `max_aggregate_msg_id`. Prevents unbounded score-oscillation loops.
- Reference: autoresearch (Karpathy P4) "modify → eval → keep/revert" pattern.

### P1 — if possible (within sprint)

- ~~`verify_count ≤ 5` → hook(partial)~~ → promoted to P0 (#5 above).
- `rollback_count ≤ 2` → done(rollback_exhausted)
- `phase_budget` audit
- `cache_read_ratio` advisory metric

### P2 — post-submission

- subscription quota awareness (parse rate-limit responses from claude / codex CLI)
- per-actor token budget (Engineering Lead is heavier → different cap)
- Context window pruning (when the transcript grows long, drop visibility=private + older step.* entries before injecting into the sandwich)

## State extension proposal (when implementing P0)

```typescript
// src/state/types.ts
export interface ProgressLedger {
  step: number;
  next_speaker: Actor | null;
  last_active_actor: Actor | null;
  stuck_count: number;
  score_history: ScoreEntry[];
  adapter_override: Partial<Record<Actor, string>>;
  circuit_breaker: Partial<Record<Actor, CircuitInfo>>;

  // ── new (P0) ──
  respec_count: number;            // count of rollback → planner re-entries
  verify_count: number;            // cumulative judge.score
  total_spawn_count: number;       // sum of all spawns
  rollback_count: number;
  user_intervene_count: number;

  // ── time/cost (P0) ──
  session_started_at: string;      // ISO ts (immutable)
  session_token_total: number;     // sum of metadata.tokens_in + tokens_out
  session_cost_usd: number;        // sum of metadata.cost_usd
  per_spawn_started_at: string | null;  // current spawn start (for timeout check)
}
```

Reducer responsibilities:

- `kind=spec.update` → `respec_count++`. ≥ 3 → `done(too_many_respec)`
- `kind=verify.result|judge.score` → `verify_count++`
- `kind=handoff.rollback` → `rollback_count++`
- `kind=user.intervene|user.veto` → `user_intervene_count++`
- every event → `session_token_total += metadata.tokens_in + tokens_out`. ≥ 50K → done

Dispatcher responsibilities:

- per spawn: `per_spawn_started_at = now()`. SIGTERM after 5 minutes
- `total_spawn_count++`. ≥ 10 → hook(stuck)

Loop responsibilities:

- `now() - session_started_at >= 1800s` → done(timeout)

## Frontier basis mapping

| Guardrail | Source |
|---|---|
| 3-cap (count + time + cost) | [[bagelcode-frontier-orchestration-2026]] Paperclip Issue #4688 (cascade unbounded recovery) |
| Score variance adaptive stop | NeurIPS 2025 multi-agent debate judge ^[extracted] |
| Circuit breaker 3-fail OPEN | [[bagelcode-fault-tolerance-design]] §F2 + Hystrix prior |
| Iron Law (Anti-deception) | [[bagelcode-rubric-scoring]] obra/superpowers TDD |
| 50K token budget | [[bagelcode-caching-strategy]] §Token budget (1/4 of Paperclip's ~200K) |
| Karpathy P4 ratchet | [[bagelcode-frontier-rationale-5-claims]] §Karpathy autoresearch |

## Open Questions

- [ ] After `respec_count = 3`, which is a better signal to the evaluator: `done(too_many_respec)` or `hook(too_many_respec)` (user confirm)? ^[ambiguous]
- [ ] Per-spawn token cap 20K — needs adjustment after measuring actual sandwich + transcript inject volume. ^[inferred]
- [ ] Wall-clock 30min — if too long during demo, the evaluator may interrupt. A 15-minute cap is also worth considering. ^[inferred]
- [ ] subscription quota response parsing — need to verify whether claude / codex CLI emits consistent stderr messages. ^[ambiguous]

## Related

- [[bagelcode-fault-tolerance-design]] — F1-F5 fault scenarios (this page is a sub-spec of F2/F4)
- [[bagelcode-rubric-scoring]] — 5D rubric + anti-deception 5 schema rules (incl. Iron Law)
- [[bagelcode-frontier-rationale-5-claims]] — Karpathy P4 ratchet + Paperclip case
- [[bagelcode-caching-strategy]] — 3-tier cache + token budget
- [[bagelcode-final-design-2026]] — overall design's §Adaptive stopping / Circuit breaker section
