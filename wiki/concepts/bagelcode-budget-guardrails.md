---
title: Crumb 폭주 방지 가드레일 — 횟수 / time / cost 3축
category: concepts
tags: [bagelcode, crumb, guardrails, ratchet, budget, fault-tolerance, anti-deception]
sources:
  - "[[bagelcode-final-design-2026]]"
  - "[[bagelcode-fault-tolerance-design.md]]"
  - "[[bagelcode-rubric-scoring]]"
  - "[[bagelcode-frontier-rationale-5-claims]]"
summary: 검수 → 래칫 패턴이 무한 반복되거나 토큰을 폭식하지 않도록, 최대 횟수 / wall-clock / token 3축에 가드레일을 정의. 현재 구현 5종 + 미구현 8종 + sprint demo 임계값 + 우선순위.
provenance:
  extracted: 0.55
  inferred: 0.40
  ambiguous: 0.05
created: 2026-05-02
updated: 2026-05-02
---

# Crumb 폭주 방지 가드레일

> 검수 → 래칫 패턴 (Karpathy P4: "advance only on verification pass, rollback on failure") 이 **컨텍스트 폭식** 으로 변하지 않도록, 3축에 cap 을 둔다. 출처: 2026-05-02 design 검토 (commit `cff232a` 기준).

## 문제 정의

`spec → build → verify → rollback → spec.update → ...` 루프는 verdict 가 PASS 안 나오면 무한 가능. 폭주 시나리오 3종:

1. **Score oscillation** — FAIL 8 → PASS 28 → FAIL 12 → PASS 26. variance 가 크니 [[adaptive stop]] 발화 안 함.
2. **Subprocess hang** — claude/codex 가 timeout 없이 응답 멈춤. idle_timeout (60s) 은 *event 간격* 만 검사 — subprocess 안에서는 무한 대기.
3. **Token 누적** — 매 spawn 이 transcript 전체를 sandwich 에 inject → 후반부 turn 은 첫 turn 의 5-10× 토큰 소비. 누적 검사 X. ^[inferred]

Paperclip Issue #4688 (10분 안에 9 recovery, Anthropic credit 고갈) 이 동일 패턴의 production case. ^[extracted]

## 3축 분리

```
┌─────────────────┬─────────────────────────────────────────────────────┐
│ AXIS 1          │ AXIS 2                  │ AXIS 3                    │
│ 최대 횟수        │ Time-budget             │ Cost-budget               │
├─────────────────┼─────────────────────────┼───────────────────────────┤
│ respec_count    │ session_wall_clock      │ session_tokens_total      │
│ verify_count    │ per_spawn_timeout       │ per_spawn_tokens          │
│ total_spawn     │ phase_budget            │ session_cost_usd          │
│ rollback_count  │ idle_gap (있음 ✓)        │ cache_read_ratio          │
│ user_intervene  │                          │ subscription_quota         │
└─────────────────┴─────────────────────────┴───────────────────────────┘
```

## 현재 구현된 5종 (코드 검증됨)

| 가드레일 | 임계값 | State 필드 | 발화 effect | 위치 |
|---|---|---|---|---|
| Adaptive stop | score variance < 1.0 over 2 rounds | `progress.score_history[]` | `done(adaptive_stop)` | `src/reducer/index.ts:80` |
| Circuit breaker | 3 연속 `kind=error` from same actor | `progress.circuit_breaker[actor]` | 다음 spawn 시 fallback adapter | `src/reducer/index.ts:147` |
| Stuck count | 누적 error ≥ 5 | `progress.stuck_count` | `hook(stuck)` | `src/reducer/index.ts:160` |
| Idle timeout | event 간격 60s | loop watchdog (state X) | `finish(state)` | `src/loop/coordinator.ts:97` |
| Done guard | `state.done` true | `state.done` | 후속 event 무시 | `src/loop/coordinator.ts:84` |

## 미구현 갭 8종

### Axis 1 — 최대 횟수

| 갭 | 폭주 시나리오 |
|---|---|
| Planner 재spec 횟수 cap 없음 | FAIL → rollback → planner → spec.update → FAIL → ... 무한 |
| Engineering 재시도 횟수 cap 없음 | spec → eng → PARTIAL → user.approve → eng → 누적 |
| Rollback 누적 cap 없음 | adaptive stop 도 verdict 없으면 발화 X |
| 전체 turn 카운트 cap 없음 | 100 turn 도 가능 |

### Axis 2 — Time-budget

| 갭 | 폭주 시나리오 |
|---|---|
| 세션 wall-clock cap 없음 | 10시간 가능 (idle_timeout 안에서 event 계속 들어오면) |
| Per-spawn timeout 없음 | claude/codex subprocess hang 시 무한 대기 |
| Phase 시간 cap 없음 | Planner Socratic step 만 30분 가능 |

### Axis 3 — Cost-budget

| 갭 | 폭주 시나리오 |
|---|---|
| 세션 누적 token 합산 X | metadata.tokens_in/out 기록만 — 검사 X |
| Per-spawn token cap 없음 | 한 turn 에 50K token 가능 |
| 구독 quota awareness 없음 | Claude Max / Codex Plus 일 quota 추적 없음 |
| Cache hit 모니터 없음 | metadata.cache_read 기록만 — 효율 metric 미산출 |

## 추천 임계값 (sprint demo 기준)

```
AXIS 1: 최대 횟수
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
  idle_gap           ≤   60s ✓ (이미 있음)

AXIS 3: Cost-budget
───────────────────
  session.tokens_total ≤ 50_000
    → hook(token_budget)    at 40K
    → done(token_exhausted) at 50K
  per_spawn.tokens     ≤ 20_000
    → kind=audit, body=spawn_overrun (no abort — 단일 spawn 마무리 허용)
  session.cost_usd     ≤      0  (구독만; API mode 시 cap)
  cache_read_ratio     ≥    0.30 (목표; 미달 시 advisory metric)
```

근거: ^[inferred] sprint demo 길이 30분, 평가자 attention budget 고려. 50K token 은 [[bagelcode-caching-strategy]] §토큰 예산 의 ~50K 목표와 정합.

## 구현 우선순위

### P0 — 제출 전 반드시 (≈ 1.5h)

폭주 case 자체를 schema 수준에서 차단:

| # | 가드레일 | 비용 | 정당성 |
|---|---|---|---|
| 1 | `respec_count ≤ 3` → `done(too_many_respec)` | ~10 LoC + 1 spec | FAIL→rollback 무한 루프가 가장 큰 비용 위험 |
| 2 | `session_wall_clock ≤ 30min` watchdog | ~15 LoC + 1 spec | 평가자 데모 길이 cap |
| 3 | `per_spawn_timeout ≤ 5min` (SIGTERM) | ~20 LoC adapter 수정 | subprocess hang 방어 |
| 4 | `tokens_total ≤ 50K` → `hook(token_budget)` | ~15 LoC + 1 spec | metadata 누적 → 임계값 비교 |

### P1 — 가능하면 (sprint 내)

- `verify_count ≤ 5` → hook(partial)
- `rollback_count ≤ 2` → done(rollback_exhausted)
- `phase_budget` audit
- `cache_read_ratio` advisory metric

### P2 — 제출 후

- subscription quota awareness (claude/codex CLI rate limit 응답 파싱)
- per-actor token budget (Engineering Lead 가 더 무거움 → 다른 cap)
- Context window pruning (transcript 길어질 때 visibility=private + 오래된 step.* 제외 후 sandwich 에 inject)

## State 확장 제안 (P0 구현 시)

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

  // ── 신규 (P0) ──
  respec_count: number;            // rollback → planner 재진입 횟수
  verify_count: number;            // judge.score 누적
  total_spawn_count: number;       // 모든 spawn 합
  rollback_count: number;
  user_intervene_count: number;

  // ── time/cost (P0) ──
  session_started_at: string;      // ISO ts (immutable)
  session_token_total: number;     // metadata.tokens_in + tokens_out 합
  session_cost_usd: number;        // metadata.cost_usd 합
  per_spawn_started_at: string | null;  // 현 spawn 시작 (timeout 검사용)
}
```

reducer 책임:

- `kind=spec.update` → `respec_count++`. ≥ 3 이면 `done(too_many_respec)`
- `kind=verify.result|judge.score` → `verify_count++`
- `kind=handoff.rollback` → `rollback_count++`
- `kind=user.intervene|user.veto` → `user_intervene_count++`
- 모든 event → `session_token_total += metadata.tokens_in + tokens_out`. ≥ 50K → done

dispatcher 책임:

- spawn 마다 `per_spawn_started_at = now()`. 5분 후 SIGTERM
- `total_spawn_count++`. ≥ 10 → hook(stuck)

loop 책임:

- `now() - session_started_at >= 1800s` → done(timeout)

## Frontier 근거 매핑

| 가드레일 | 출처 |
|---|---|
| 3-cap (count + time + cost) | [[bagelcode-frontier-orchestration-2026]] Paperclip Issue #4688 (cascade unbounded recovery) |
| Score variance adaptive stop | NeurIPS 2025 multi-agent debate judge ^[extracted] |
| Circuit breaker 3-fail OPEN | [[bagelcode-fault-tolerance-design]] §F2 + Hystrix prior |
| Iron Law (Anti-deception) | [[bagelcode-rubric-scoring]] obra/superpowers TDD |
| 50K token budget | [[bagelcode-caching-strategy]] §토큰 예산 (Paperclip ~200K 대비 1/4) |
| Karpathy P4 ratchet | [[bagelcode-frontier-rationale-5-claims]] §Karpathy autoresearch |

## Open Questions

- [ ] `respec_count = 3` 후 `done(too_many_respec)` vs `hook(too_many_respec)` (사용자 confirm) 중 어느 게 평가자에게 더 좋은 시그널인가? ^[ambiguous]
- [ ] Per-spawn token cap 20K — 실제 sandwich + transcript inject 분량 측정 후 조정 필요. ^[inferred]
- [ ] Wall-clock 30min — 데모 시 너무 길면 평가자가 중단할 수도. 15분 cap 도 검토 가치. ^[inferred]
- [ ] subscription quota 응답 파싱 — claude / codex CLI 가 일관된 stderr 메시지를 주는지 확인 필요. ^[ambiguous]

## Related

- [[bagelcode-fault-tolerance-design]] — F1-F5 장애 시나리오 (이 페이지가 F2/F4 의 sub-spec)
- [[bagelcode-rubric-scoring]] — 5D rubric + anti-deception 5 schema rules (Iron Law 포함)
- [[bagelcode-frontier-rationale-5-claims]] — Karpathy P4 ratchet + Paperclip 사례
- [[bagelcode-caching-strategy]] — 3-tier cache + token budget
- [[bagelcode-final-design-2026]] — 전체 설계의 §Adaptive stopping / Circuit breaker 단락
