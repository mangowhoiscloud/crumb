---
title: Crumb 시스템 구조 v0.3.5 — AC predicates + judge-input isolation + numerical self-bias discount
category: concepts
tags: [bagelcode, crumb, system-architecture, v0.3.5, ac-predicates, judge-input-isolation, anti-deception-rule-7, numerical-discount, fallback-audit, frontier-2026]
sources:
  - "[[bagelcode-system-architecture-v0.1]] (v0.1 baseline, still authoritative for §1-§12)"
  - "[[bagelcode-verifier-context-isolation-2026-05-03]] ★ judge-input bundle"
  - "[[bagelcode-same-provider-discount-2026-05-03]] ★ numerical D1/D3/D5 discount"
  - "[[bagelcode-scoring-ratchet-frontier-2026-05-02]]"
  - "[[bagelcode-verifier-isolation-matrix]]"
  - "[[bagelcode-llm-judge-frontier-2026]]"
  - "Stureborg EMNLP 2024 — same-provider PASS inflation +14-22%"
  - "Anthropic Hybrid Normalization 2026 — prompt mitigation 50% cover"
  - "ComplexEval Bench EMNLP 2025 Findings §805 — curse-of-knowledge"
  - "Preference Leakage ICLR 2026 (arXiv 2502.01534)"
  - "ArtifactsBench (2024) — AC-driven game evaluation"
summary: >-
  Crumb v0.3.5 incremental layer over v0.1. v0.1 의 9 architecture invariants 는 그대로 유지되고
  여기에 **3 axis** 의 신규 격상이 적용됨: (1) Anti-deception 1-6 → 1-7 + Rule 4 binary→numerical
  discount, (2) AC predicate 결정론 ground truth (qa-runner sandbox 실행 → ac_results) +
  Rule 7 verify_pass_with_ac_failure firewall, (3) verifier judge-input bundle hard isolation
  (CRUMB_JUDGE_INPUT_PATH env, dispatcher 가 transcript projection 을 file-level 로 격리).
  9 invariants 추가 — 8: fallback audit trail, 9: judge isolation. v0.3.5 는 v0.1 의 schema /
  reducer / dispatcher / preset 구조를 깨지 않고 frontier 2025-2026 evidence (Stureborg /
  Anthropic Hybrid / ComplexEval Bench / Preference Leakage / ArtifactsBench) 정렬을 강화.
---

# Crumb 시스템 구조 v0.3.5 — AC predicates + judge-input isolation + numerical discount

> **읽는 순서**: [[bagelcode-system-architecture-v0.1]] 가 baseline. 이 페이지는 v0.1 → v0.3.5 의 차이만 다룸.
> 다이어그램은 [[bagelcode-system-diagrams-v0.3.5]] 에 분리.

---

## 0. 한 줄 정체성

> v0.3.5 는 v0.1 의 multi-host × 3-tuple actor binding 위에 **anti-deception (R1→R7 + numerical Rule 4)**, **AC predicate 결정론 ground truth**, **judge-input hard isolation** 3 축을 얹은 incremental release. v0.1 의 9 invariants 위에 2 invariants 추가 (총 11).

---

## 1. v0.1 → v0.3.5 변경 요약 (한 표)

| 영역 | v0.1 | v0.3.5 | 근거 |
|---|---|---|---|
| Anti-deception rules | 6개 (R1~R6) | **7개** (+ R7 verify_pass_with_ac_failure) | ArtifactsBench 2024 — AC-driven binary gate |
| Rule 4 (same-provider) | binary verdict gate (PASS→PARTIAL) | **numerical 0.15 discount** on D1/D3/D5 | Stureborg EMNLP 2024 §4.2 (+14-22% inflation), Anthropic Hybrid Norm 2026 (50% prompt cover residual) |
| qa.result data | exec_exit_code + cross_browser_smoke | **+ ac_results: [{ac_id, status: PASS\|FAIL\|SKIP}]** | ArtifactsBench AC-binary determinism |
| QaCheckEffect | htmlhint + playwright | **+ ac_predicates[]** sandbox 실행 | spec.update carries planner-compiled `predicate_js` |
| Verifier input | full transcript via `cat $CRUMB_TRANSCRIPT_PATH` | **`$CRUMB_JUDGE_INPUT_PATH`** (file-level isolation) | ComplexEval Bench EMNLP 2025 §805, Preference Leakage ICLR 2026 |
| Spawn budget | 5 min wall-clock SIGTERM | **15 min wall-clock + 90 s idle** (env-tunable) | planner-lead Phase B 300710ms session 01KQMR4Y RCA |
| Sandwich assembler | base + local + appends | **+ `inline_skills` / `inline_specialists` 인라인** | session 01KQMR4Y `find /` race 차단 |
| metadata.cross_provider | mock-only | **dispatcher resolves + crumb event stamps** | AGENTS.md §136 invariant 실현 |
| metadata.harness/model | sometimes-set | **always-stamped via env** | AGENTS.md §135 invariant 실현 |
| `kind=audit fallback_activated` | 약속만 있고 미발화 | **reducer emit BEFORE spawn** | builder-fallback sandwich §in 의 입력 보장 |
| `crumb event tail` | 없음 | **visibility filter CLI** (default strips private) | verifier sandwich enforcement |
| forged event firewall | 없음 (validator만) | **`crumb event` CLI 가 from=system / kind=qa.result 위조 거부** | architecture invariant #4-5 sub-process 게이트 |
| Architecture invariants | 9 | **11** (+ #10 fallback audit trail, +#11 judge isolation) | — |

---

## 2. 신규 architecture invariants (v0.1 9개 위에 2개 추가)

### Invariant #10 — Fallback audit trail

> **builder-fallback spawn 이전에 reducer 가 `kind=audit event=fallback_activated` 를 transcript 에 emit 한다. payload 는 `{reason='builder_circuit_open', consecutive_failures, last_failure_id, substituting_adapter}`.**

builder-fallback sandwich 의 §in column 이 약속한 input 이 실제로 transcript 에 도달하도록 보장. v0.1 까지는 sandwich 텍스트만 기재하고 emit 은 누락된 상태였음.

### Invariant #11 — Judge isolation (file-level)

> **verifier 는 `$CRUMB_JUDGE_INPUT_PATH` 만 읽는다. dispatcher 가 verifier spawn 직전 transcript 의 결정론적 projection 을 `<sessionDir>/agent-workspace/verifier/judge-input.jsonl` 으로 prepare. 직접 `cat $CRUMB_TRANSCRIPT_PATH` 는 금지.**

bundle whitelist: latest `goal / spec / build / qa.result / artifact.created` + all `step.research.video`.
bundle blocklist: planner reasoning (`step.concept / step.design / step.research synthesis`) / prior verifier 출력 (`step.judge / judge.score / verify.result`) / private CoT (`agent.thought_summary`) / dispatcher meta (`note / dispatch.spawn`) / user hints (`user.intervene / user.approve / user.veto`) / validator audits (`audit`).

frontier evidence:
- ComplexEval Bench EMNLP 2025 §805: "auxiliary information / reference knowledge biases LLM evaluation" → less context 권고
- Preference Leakage ICLR 2026 (arXiv 2502.01534): same-family generator reasoning 가 judge 점수 inflate, CoT inspection 으로 검출 불가
- Anthropic Hybrid Normalization 2026: prompt-only mitigation 50% cover, 잔여 50% 가 file-level isolation 의 자리
- Anthropic Bloom 2025: Judgment 4-stage 의 isolated stage

---

## 3. Schema 확장 (v0.1 의 11 field 위에)

### 3.1 `qa.result.data` — 결정론 ground truth 확장

```yaml
qa.result.data:
  exec_exit_code: 0 | non-zero          # v0.1
  cross_browser_smoke: 'ok' | 'fail' | 'skipped'   # v0.1
  url?: string                          # v0.3.5 — Playwright server URL (verifier가 LLM playthrough에서 reuse)
  ac_results?: [                        # v0.3.5 ★
    { ac_id: string, status: 'PASS' | 'FAIL' | 'SKIP', evidence?: string }
  ]
```

`ac_results` 는 `qa-interactive.ts` 가 spec.update 의 `ac_predicates[]` 를 sandbox 실행한 결과. status 는:
- **PASS**: predicate_js 가 true 반환
- **FAIL**: predicate_js 가 false 반환 → Rule 7 트리거
- **SKIP**: playwright 미설치 / wait_ms timeout / DOM 미준비

### 3.2 `spec.update.data.ac_predicates[]` — 결정론 테스트 컴파일

```yaml
ac_predicates: [
  {
    id: string                      # AC 식별자 (예: "AC-3")
    intent: string                  # 자연어 의도 (사람용)
    predicate_js: string            # 브라우저 컨텍스트에서 평가 (=== true)
    action_js?: string              # 평가 전 실행 (예: 클릭, 드래그)
    wait_ms?: number                # action 후 대기
    timeout_ms?: number             # predicate 평가 타임아웃 (default 5000)
  }
]
```

planner-lead 가 spec-seal 시점에 컴파일. state.task_ledger.ac_predicates 에 stash → reducer 의 `qa_check` effect 에 forward → qa-runner 가 Playwright 컨텍스트에서 실행.

### 3.3 metadata 신규 필드 없음 (기존 필드의 *enforcement* 강화)

v0.1 의 metadata 14 필드는 그대로. 다만 다음 필드의 *enforcement* 가 v0.3.5 에서 격상:

| 필드 | v0.1 상태 | v0.3.5 상태 |
|---|---|---|
| `metadata.harness` | `agents/_event-protocol.md` 약속만 | dispatcher → CRUMB_HARNESS env → `crumb event` 가 자동 stamp |
| `metadata.provider` | 같음 | 같음 (CRUMB_PROVIDER) |
| `metadata.model` | 같음 | 같음 (CRUMB_MODEL) |
| `metadata.cross_provider` | mock adapter 만 set, 실제 adapter 누락 | dispatcher 가 latest build 의 provider 와 verifier provider 비교, judge.score 에 자동 stamp |
| `metadata.adapter_session_id` / `cache_carry_over` | forward-compat 필드, 미사용 | 그대로 미사용 (정직하게 표기) |

---

## 4. Reducer routing 확장

### 4.1 신규 emit (reducer)

```ts
// case 'verify.result' / 'judge.score', verdict=FAIL/REJECT, builder circuit OPEN
// → BEFORE spawn(builder-fallback), emit:
{
  type: 'append',
  message: {
    from: 'system',
    kind: 'audit',
    body: 'fallback_activated — builder circuit OPEN (N consecutive failures)',
    data: {
      event: 'fallback_activated',
      reason: 'builder_circuit_open',
      consecutive_failures: N,
      last_failure_id: string,
      substituting_adapter: 'claude-local',
    },
    metadata: { deterministic: true, tool: 'reducer-fallback-route@v1' },
  }
}
// → THEN spawn(builder-fallback)
```

### 4.2 환경변수 budget knobs

```bash
CRUMB_PER_SPAWN_TIMEOUT_MS  # default 900_000 (15 min wall-clock)
CRUMB_PER_SPAWN_IDLE_MS     # default 90_000  (90 s idle no-stdout)
CRUMB_WALL_CLOCK_HOOK_MS    # default 1_440_000 (24 min, 사용자 hook)
CRUMB_WALL_CLOCK_HARD_MS    # default 1_800_000 (30 min, hard done)
CRUMB_TOKEN_BUDGET_HOOK     # default 40_000
CRUMB_TOKEN_BUDGET_HARD     # default 50_000
```

테스트 / CI / fast mock 시나리오에서 override 가능.

---

## 5. Anti-deception 7 rules (v0.1 6 → v0.3.5 7)

| Rule | Trigger | Action | Violation tag | 출처 |
|---|---|---|---|---|
| **R1** | verdict=PASS but `qa.result.exec_exit_code !== 0` | force D2=0, downgrade verdict→FAIL | `verify_pass_without_exec_zero` | v0.1 |
| **R2** | D2.score ≠ expected (qa.result 기준) | force D2 to ground truth | `verifier_overrode_d2_ground_truth` | v0.1 |
| **R3** | D4.score ≠ autoScores.D4 (±0.01) | force D4 to reducer-auto | `verifier_overrode_d4_ground_truth` | v0.1 |
| **R4** | verifier.provider === builder.provider | **0.15 discount** on D1/D3/D5 (numerical, was binary) | `self_bias_risk_same_provider` + `self_bias_score_discounted` | Stureborg EMNLP 2024 §4.2 |
| **R5** | ≥1 step.research.video exists, D5≥4, no evidence citation | force D5=0 | `researcher_video_evidence_missing` | v0.3.0 |
| **R6** | verdict=PASS but D1<3 AND D5<3 | downgrade→PARTIAL | `composite_gaming_d1_d5_below_minimum` | v0.3.1 |
| **R7** | verdict=PASS but ac_results contains FAIL | **cap D1≤2, downgrade→PARTIAL** | `verify_pass_with_ac_failure` | **v0.3.5 신규** (ArtifactsBench 2024) |

R4 의 시간 변천:
- v0.1.0-v0.3.0: violation tag 만 push, action 없음
- v0.3.1: binary `if PASS → PARTIAL`
- **v0.3.5**: numerical D1+D3+D5 ×0.85 (D2/D6 deterministic 면역, D4 reducer-auto 면역). `combineAggregate` 가 LLM 절반만 깎이도록 자동 처리. wiki: [[bagelcode-same-provider-discount-2026-05-03]].

---

## 6. Dispatcher spawn flow 확장

### 6.1 verifier spawn 전용 추가 단계

```
verifier spawn:
  ① assembleSandwich() — base + inline_skills + inline_specialists + length-context appends
  ② readLatestBuildProvider(transcript) → CRUMB_BUILDER_PROVIDER env
  ③ buildVerifierInputBundle(transcript, sessionDir)
       → <sessionDir>/agent-workspace/verifier/judge-input.jsonl
       → CRUMB_JUDGE_INPUT_PATH env
  ④ adapter.spawn() with all CRUMB_* envs + onStdoutActivity callback
  ⑤ wall-clock + idle timer race, AbortController → SIGTERM
  ⑥ stream-json usage parse → metadata stamping
```

### 6.2 모든 spawn 의 신규 env

```
CRUMB_HARNESS              # binding.harness (claude-code | codex | gemini-cli | ...)
CRUMB_PROVIDER             # binding.provider (anthropic | openai | google | none)
CRUMB_MODEL                # binding.model
CRUMB_BUILDER_PROVIDER     # verifier 만, latest build event 의 metadata.provider
CRUMB_JUDGE_INPUT_PATH     # verifier 만, file-level isolated bundle
```

`crumb event` CLI 의 `stampEnvMetadata()` 가 outgoing draft 에 자동 fold (actor-supplied metadata 우선, 누락 시 env 로 채움).

### 6.3 Sandwich assembler — inline-read

`agents/<actor>.md` 의 frontmatter 가 `inline_skills` / `inline_specialists` 선언을 가지면 dispatcher 가 해당 파일 본문을 sandwich 에 인라인 (별도 add-dir 노출 불필요).

```yaml
# agents/builder.md frontmatter
inline_skills:
  - skills/tdd-iron-law.md
inline_specialists:
  - agents/specialists/game-design.md
```

session 01KQMR4Y RCA: planner-lead Phase B 가 `find /` 로 specialist 파일을 4 회 검색하다 5 분 SIGTERM 됐던 회귀를 차단.

---

## 7. CLI 확장 (`crumb event tail`)

```bash
crumb event tail                                  # default — visibility=private 차단
crumb event tail --all                            # admin / replay 용 bypass
crumb event tail --kinds spec,build,qa.result     # 추가 kind 필터 (visibility 위에 AND)
```

내부적으로 `filterTranscriptLine(line, opts)` 사용 (export 됨, testable). 기본 emit 경로는 변화 없음 — `crumb event` (no positional) 는 stdin → writer 그대로.

### 7.1 `crumb event` forged-event firewall

`cmdEvent` 가 stdin draft 를 `applyEventFirewall()` 로 검사:

```
draft.from === 'system'   → reject (forged_system_event_attempt)
draft.kind === 'qa.result'   → reject (forged_qa_result_attempt)
draft from builder-fallback + qa.result   → fallback_self_assessment_attempt
```

거부된 draft 는 transcript 에 **append 안 됨**. 대신 `kind=audit` violation 만 append + `process.exitCode = 2`.

---

## 8. Adapter env propagation (`buildAdapterEnv` 확장)

`src/adapters/_shared.ts:46-65`:

```ts
{
  ...process.env,
  CRUMB_TRANSCRIPT_PATH, CRUMB_SESSION_ID, CRUMB_SESSION_DIR, CRUMB_ACTOR,    // v0.1
  ...(req.harness ? { CRUMB_HARNESS } : {}),                                  // v0.3.5
  ...(req.provider ? { CRUMB_PROVIDER } : {}),
  ...(req.model ? { CRUMB_MODEL } : {}),
  ...(req.builderProvider ? { CRUMB_BUILDER_PROVIDER } : {}),
  ...(req.judgeInputPath ? { CRUMB_JUDGE_INPUT_PATH } : {}),                  // v0.3.5 verifier-only
}
```

3 local adapter (claude-local / codex-local / gemini-local) + gemini-sdk + mock 이 같은 helper 사용 — provider 추가 시 한 곳만 수정.

---

## 9. v0.3.5 의 frontier alignment

| 결정 | Frontier evidence |
|---|---|
| Rule 4 numerical | Stureborg EMNLP 2024 §4.2 (+14-22% PASS inflation), Anthropic Hybrid Norm 2026 (~50% prompt mitigation, residual numerical), AlpacaEval LC / Arena-Hard v2 length-controlled scoring 동형 |
| Rule 7 AC-driven | ArtifactsBench 2024 — game eval AC binary determinism. PASS 표면 + 결정론적 FAIL 모순 시 LLM judge 무시 |
| Judge-input bundle | ComplexEval Bench EMNLP 2025 §805 ("less context" 권고), Preference Leakage ICLR 2026 (CoT inspection 미검출), Anthropic Bloom 2025 (Judgment isolated stage), Anthropic Engineering 2026 ("isolated LLM-as-judge") |
| AC predicate sandbox | DeepSeek-R1 / SWE-bench 2025 top10 — exec gate 없는 LLM-only ratchet 은 round 4+ Goodhart divergence |
| Wall-clock + idle timeout | autoresearch P3 budget guardrail + planner-lead Phase B RCA (session 01KQMR4Y, 300710ms wall-clock SIGTERM) |
| Length context for verifier | Krumdick EMNLP 2025, RewardBench v2, Rubric-Anchored Judging NeurIPS 2025 — bias 가 D1/D5 (qualitative) 에 집중, D2/D6 (deterministic) 면역 |

---

## 10. 호환성 / 마이그레이션

| 항목 | v0.1 → v0.3.5 |
|---|---|
| transcript schema | additive 만 (qa.result 에 ac_results 추가, 신규 kind 없음). v0.1 transcript 그대로 replay 가능 |
| reducer | additive (Rule 7, fallback_activated emit). v0.1 transcript replay 시 R7 / fallback emit 은 발화하지 않음 (입력 신호 없음) |
| validator | R7 추가, R4 binary→numerical. v0.1 transcript 의 score 재계산 시 R4 가 verdict 를 다르게 결정할 수 있음 (의도된 정직성) |
| dispatcher | env wiring 추가만. judgeInputPath 는 optional, verifier 외 actor 영향 없음 |
| sandwich files | builder.md / builder-fallback.md / verifier.md 의 inline-read frontmatter 추가, Reads column 강화. 기존 actor 행동 보존 |
| presets | 변화 없음 — `bagelcode-cross-3way` / `solo` / `sdk-enterprise` / `mock` / `bagelcode-video-research` 5개 그대로 |

---

## 11. 다이어그램

[[bagelcode-system-diagrams-v0.3.5]] 참조 — Mermaid 6 종:
1. Spawn lifecycle (sandwich assemble → adapter → timer race → output capture)
2. Score path (D1-D6 source matrix + 3-layer combine)
3. Anti-deception waterfall (R1 → R7 + verdict adjust + audit emit)
4. Verifier judge-input bundle projection
5. Routing matrix (kind → next_speaker / done / hook)
6. Preset binding resolution

---

## 12. See also

- [[bagelcode-system-architecture-v0.1]] — v0.1 baseline (§1-§14, 그대로 유효)
- [[bagelcode-system-diagrams-v0.3.5]] — Mermaid 6 종
- [[bagelcode-same-provider-discount-2026-05-03]] — Rule 4 numerical 의 frontier rationale
- [[bagelcode-verifier-context-isolation-2026-05-03]] — judge-input bundle 결정 논리
- [[bagelcode-scoring-ratchet-frontier-2026-05-02]] — scoring ratchet 의 효력 (deterministic gate 위에서만)
- [[bagelcode-verifier-isolation-matrix]] — verifier 격리의 16 사료 매트릭스 (C1 격리 frontier consensus + C2 cross-provider backbone)
- [[bagelcode-llm-judge-frontier-2026]] — judge bias 사료 (R3-R5)
- [[bagelcode-fault-tolerance-design]] — F1-F5 fault matrix (R7 이 F2 verdict-without-evidence 를 타이트하게 보강)
