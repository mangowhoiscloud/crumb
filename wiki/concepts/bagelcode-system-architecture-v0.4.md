---
title: Crumb System Architecture v0.4 — AC predicates + judge-input isolation + numerical self-bias discount
category: concepts
tags: [bagelcode, crumb, system-architecture, v0.4, ac-predicates, judge-input-isolation, anti-deception-rule-7, numerical-discount, fallback-audit, frontier-2026]
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
  Crumb v0.4 incremental layer over v0.1. v0.1's 9 architecture invariants are kept intact,
  with **3 axes** of new upgrades on top: (1) Anti-deception 1-6 → 1-7 + Rule 4 binary→numerical
  discount, (2) AC predicate deterministic ground truth (qa-runner sandbox execution → ac_results) +
  Rule 7 verify_pass_with_ac_failure firewall, (3) verifier judge-input bundle hard isolation
  (CRUMB_JUDGE_INPUT_PATH env, dispatcher isolates the transcript projection at file level).
  2 invariants added — 8: fallback audit trail, 9: judge isolation. v0.4 strengthens
  alignment with frontier 2025-2026 evidence (Stureborg / Anthropic Hybrid / ComplexEval Bench /
  Preference Leakage / ArtifactsBench) without breaking v0.1's schema / reducer / dispatcher / preset
  structure.
---

# Crumb System Architecture v0.4 — AC predicates + judge-input isolation + numerical discount

> **Reading order**: [[bagelcode-system-architecture-v0.1]] is the baseline. This page only covers the v0.1 → v0.4 delta.
> Diagrams are split out into [[bagelcode-system-diagrams-v0.4]].

---

## 0. One-line identity

> v0.4 is an incremental release that adds **anti-deception (R1→R7 + numerical Rule 4)**, **AC predicate deterministic ground truth**, and **judge-input hard isolation** as three axes on top of v0.1's multi-host × 3-tuple actor binding. 2 invariants are added on top of v0.1's 9 (11 total).

---

## 1. v0.1 → v0.4 change summary (single table)

| Area | v0.1 | v0.4 | Rationale |
|---|---|---|---|
| Anti-deception rules | 6 (R1~R6) | **7** (+ R7 verify_pass_with_ac_failure) | ArtifactsBench 2024 — AC-driven binary gate |
| Rule 4 (same-provider) | binary verdict gate (PASS→PARTIAL) | **numerical 0.15 discount** on D1/D3/D5 | Stureborg EMNLP 2024 §4.2 (+14-22% inflation), Anthropic Hybrid Norm 2026 (50% prompt cover residual) |
| qa.result data | exec_exit_code + cross_browser_smoke | **+ ac_results: [{ac_id, status: PASS\|FAIL\|SKIP}]** | ArtifactsBench AC-binary determinism |
| QaCheckEffect | htmlhint + playwright | **+ ac_predicates[]** sandbox execution | spec.update carries planner-compiled `predicate_js` |
| Verifier input | full transcript via `cat $CRUMB_TRANSCRIPT_PATH` | **`$CRUMB_JUDGE_INPUT_PATH`** (file-level isolation) | ComplexEval Bench EMNLP 2025 §805, Preference Leakage ICLR 2026 |
| Spawn budget | 5 min wall-clock SIGTERM | **15 min wall-clock + 90 s idle** (env-tunable) | planner-lead Phase B 300710ms session 01KQMR4Y RCA |
| Sandwich assembler | base + local + appends | **+ inline `inline_skills` / `inline_specialists`** | session 01KQMR4Y `find /` race blocked |
| metadata.cross_provider | mock-only | **dispatcher resolves + crumb event stamps** | AGENTS.md §136 invariant realized |
| metadata.harness/model | sometimes-set | **always-stamped via env** | AGENTS.md §135 invariant realized |
| `kind=audit fallback_activated` | promised but never emitted | **reducer emit BEFORE spawn** | guarantees the input promised by builder-fallback sandwich §in |
| `crumb event tail` | absent | **visibility filter CLI** (default strips private) | verifier sandwich enforcement |
| forged event firewall | none (validator only) | **`crumb event` CLI rejects forged from=system / kind=qa.result** | architecture invariant #4-5 sub-process gate |
| Architecture invariants | 9 | **11** (+ #10 fallback audit trail, +#11 judge isolation) | — |

---

## 2. New architecture invariants (2 added on top of v0.1's 9)

### Invariant #10 — Fallback audit trail

> **Before spawning builder-fallback, the reducer emits `kind=audit event=fallback_activated` to the transcript. The payload is `{reason='builder_circuit_open', consecutive_failures, last_failure_id, substituting_adapter}`.**

Guarantees that the input promised by the builder-fallback sandwich's §in column actually reaches the transcript. Up to v0.1 the sandwich text mentioned it but emission was missing.

### Invariant #11 — Judge isolation (file-level)

> **The verifier reads only `$CRUMB_JUDGE_INPUT_PATH`. The dispatcher prepares a deterministic projection of the transcript at `<sessionDir>/agent-workspace/verifier/judge-input.jsonl` immediately before spawning the verifier. Direct `cat $CRUMB_TRANSCRIPT_PATH` is forbidden.**

bundle whitelist: latest `goal / spec / build / qa.result / artifact.created` + all `step.research.video`.
bundle blocklist: planner reasoning (`step.concept / step.design / step.research synthesis`) / prior verifier output (`step.judge / judge.score / verify.result`) / private CoT (`agent.thought_summary`) / dispatcher meta (`note / dispatch.spawn`) / user hints (`user.intervene / user.approve / user.veto`) / validator audits (`audit`).

frontier evidence:
- ComplexEval Bench EMNLP 2025 §805: "auxiliary information / reference knowledge biases LLM evaluation" → recommends less context
- Preference Leakage ICLR 2026 (arXiv 2502.01534): same-family generator reasoning inflates judge scores, undetectable by CoT inspection
- Anthropic Hybrid Normalization 2026: prompt-only mitigation covers 50%, the remaining 50% is the slot for file-level isolation
- Anthropic Bloom 2025: the isolated stage of the 4-stage Judgment

---

## 3. Schema extensions (on top of v0.1's 11 fields)

### 3.1 `qa.result.data` — deterministic ground-truth extension

```yaml
qa.result.data:
  exec_exit_code: 0 | non-zero          # v0.1
  cross_browser_smoke: 'ok' | 'fail' | 'skipped'   # v0.1
  url?: string                          # v0.4 — Playwright server URL (verifier가 LLM playthrough에서 reuse)
  ac_results?: [                        # v0.4 ★
    { ac_id: string, status: 'PASS' | 'FAIL' | 'SKIP', evidence?: string }
  ]
```

`ac_results` is the result of `qa-interactive.ts` running spec.update's `ac_predicates[]` in a sandbox. Statuses are:
- **PASS**: predicate_js returned true
- **FAIL**: predicate_js returned false → triggers Rule 7
- **SKIP**: playwright not installed / wait_ms timeout / DOM not ready

### 3.2 `spec.update.data.ac_predicates[]` — deterministic test compilation

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

planner-lead compiles them at spec-seal time. Stashed in state.task_ledger.ac_predicates → forwarded to the reducer's `qa_check` effect → executed by qa-runner inside the Playwright context.

### 3.3 No new metadata fields (existing fields' *enforcement* tightened)

v0.1's 14 metadata fields stay intact. However, the *enforcement* of the following fields is upgraded in v0.4:

| Field | v0.1 status | v0.4 status |
|---|---|---|
| `metadata.harness` | only promised in `agents/_event-protocol.md` | dispatcher → CRUMB_HARNESS env → `crumb event` auto-stamps |
| `metadata.provider` | same | same (CRUMB_PROVIDER) |
| `metadata.model` | same | same (CRUMB_MODEL) |
| `metadata.cross_provider` | only mock adapter sets it, real adapters miss | dispatcher compares latest build's provider with verifier provider, auto-stamps onto judge.score |
| `metadata.adapter_session_id` / `cache_carry_over` | forward-compat fields, unused | still unused (honestly marked as such) |

---

## 4. Reducer routing extensions

### 4.1 New emit (reducer)

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

### 4.2 Environment-variable budget knobs

```bash
CRUMB_PER_SPAWN_TIMEOUT_MS  # default 900_000 (15 min wall-clock)
CRUMB_PER_SPAWN_IDLE_MS     # default 90_000  (90 s idle no-stdout)
CRUMB_WALL_CLOCK_HOOK_MS    # default 1_440_000 (24 min, 사용자 hook)
CRUMB_WALL_CLOCK_HARD_MS    # default 1_800_000 (30 min, hard done)
CRUMB_TOKEN_BUDGET_HOOK     # default 40_000
CRUMB_TOKEN_BUDGET_HARD     # default 50_000
```

Overridable for test / CI / fast-mock scenarios.

---

## 5. Anti-deception 7 rules (v0.1 6 → v0.4 7)

| Rule | Trigger | Action | Violation tag | Source |
|---|---|---|---|---|
| **R1** | verdict=PASS but `qa.result.exec_exit_code !== 0` | force D2=0, downgrade verdict→FAIL | `verify_pass_without_exec_zero` | v0.1 |
| **R2** | D2.score ≠ expected (per qa.result) | force D2 to ground truth | `verifier_overrode_d2_ground_truth` | v0.1 |
| **R3** | D4.score ≠ autoScores.D4 (±0.01) | force D4 to reducer-auto | `verifier_overrode_d4_ground_truth` | v0.1 |
| **R4** | verifier.provider === builder.provider | **0.15 discount** on D1/D3/D5 (numerical, was binary) | `self_bias_risk_same_provider` + `self_bias_score_discounted` | Stureborg EMNLP 2024 §4.2 |
| **R5** | ≥1 step.research.video exists, D5≥4, no evidence citation | force D5=0 | `researcher_video_evidence_missing` | v0.3.0 |
| **R6** | verdict=PASS but D1<3 AND D5<3 | downgrade→PARTIAL | `composite_gaming_d1_d5_below_minimum` | v0.3.1 |
| **R7** | verdict=PASS but ac_results contains FAIL | **cap D1≤2, downgrade→PARTIAL** | `verify_pass_with_ac_failure` | **new in v0.4** (ArtifactsBench 2024) |

R4's evolution over time:
- v0.1.0-v0.3.0: only push the violation tag, no action
- v0.3.1: binary `if PASS → PARTIAL`
- **v0.4**: numerical D1+D3+D5 ×0.85 (D2/D6 deterministic immune, D4 reducer-auto immune). `combineAggregate` automatically clips only the LLM half. wiki: [[bagelcode-same-provider-discount-2026-05-03]].

---

## 6. Dispatcher spawn flow extensions

### 6.1 Extra steps for verifier spawn only

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

### 6.2 New env on every spawn

```
CRUMB_HARNESS              # binding.harness (claude-code | codex | gemini-cli | ...)
CRUMB_PROVIDER             # binding.provider (anthropic | openai | google | none)
CRUMB_MODEL                # binding.model
CRUMB_BUILDER_PROVIDER     # verifier 만, latest build event 의 metadata.provider
CRUMB_JUDGE_INPUT_PATH     # verifier 만, file-level isolated bundle
```

`crumb event` CLI's `stampEnvMetadata()` auto-folds these into the outgoing draft (actor-supplied metadata wins, env fills in only what is missing).

### 6.3 Sandwich assembler — inline-read

When `agents/<actor>.md`'s frontmatter declares `inline_skills` / `inline_specialists`, the dispatcher inlines those file bodies into the sandwich (no separate add-dir exposure required).

```yaml
# agents/builder.md frontmatter
inline_skills:
  - skills/tdd-iron-law.md
inline_specialists:
  - agents/specialists/game-design.md
```

session 01KQMR4Y RCA: blocks the regression where planner-lead Phase B searched for specialist files via `find /` four times and got SIGTERM'd at 5 minutes.

---

## 7. CLI extensions (`crumb event tail`)

```bash
crumb event tail                                  # default — visibility=private 차단
crumb event tail --all                            # admin / replay 용 bypass
crumb event tail --kinds spec,build,qa.result     # 추가 kind 필터 (visibility 위에 AND)
```

Internally uses `filterTranscriptLine(line, opts)` (exported, testable). The default emit path is unchanged — `crumb event` (no positional) still pipes stdin → writer.

### 7.1 `crumb event` forged-event firewall

`cmdEvent` checks the stdin draft via `applyEventFirewall()`:

```
draft.from === 'system'   → reject (forged_system_event_attempt)
draft.kind === 'qa.result'   → reject (forged_qa_result_attempt)
draft from builder-fallback + qa.result   → fallback_self_assessment_attempt
```

Rejected drafts **are not appended** to the transcript. Instead, only a `kind=audit` violation is appended + `process.exitCode = 2`.

---

## 8. Adapter env propagation (`buildAdapterEnv` extended)

`src/adapters/_shared.ts:46-65`:

```ts
{
  ...process.env,
  CRUMB_TRANSCRIPT_PATH, CRUMB_SESSION_ID, CRUMB_SESSION_DIR, CRUMB_ACTOR,    // v0.1
  ...(req.harness ? { CRUMB_HARNESS } : {}),                                  // v0.4
  ...(req.provider ? { CRUMB_PROVIDER } : {}),
  ...(req.model ? { CRUMB_MODEL } : {}),
  ...(req.builderProvider ? { CRUMB_BUILDER_PROVIDER } : {}),
  ...(req.judgeInputPath ? { CRUMB_JUDGE_INPUT_PATH } : {}),                  // v0.4 verifier-only
}
```

The 3 local adapters (claude-local / codex-local / gemini-local) + gemini-sdk + mock all use the same helper — adding a provider only requires changes in one place.

---

## 9. v0.4 frontier alignment

| Decision | Frontier evidence |
|---|---|
| Rule 4 numerical | Stureborg EMNLP 2024 §4.2 (+14-22% PASS inflation), Anthropic Hybrid Norm 2026 (~50% prompt mitigation, residual numerical), AlpacaEval LC / Arena-Hard v2 length-controlled scoring isomorphic |
| Rule 7 AC-driven | ArtifactsBench 2024 — game eval AC binary determinism. Ignore the LLM judge when surface PASS contradicts deterministic FAIL |
| Judge-input bundle | ComplexEval Bench EMNLP 2025 §805 (recommends "less context"), Preference Leakage ICLR 2026 (undetected by CoT inspection), Anthropic Bloom 2025 (Judgment isolated stage), Anthropic Engineering 2026 ("isolated LLM-as-judge") |
| AC predicate sandbox | DeepSeek-R1 / SWE-bench 2025 top10 — LLM-only ratchet without an exec gate hits Goodhart divergence by round 4+ |
| Wall-clock + idle timeout | autoresearch P3 budget guardrail + planner-lead Phase B RCA (session 01KQMR4Y, 300710ms wall-clock SIGTERM) |
| Length context for verifier | Krumdick EMNLP 2025, RewardBench v2, Rubric-Anchored Judging NeurIPS 2025 — bias concentrates on D1/D5 (qualitative), D2/D6 (deterministic) immune |

---

## 10. Compatibility / migration

| Item | v0.1 → v0.4 |
|---|---|
| transcript schema | additive only (ac_results added to qa.result, no new kinds). v0.1 transcripts replay as-is |
| reducer | additive (Rule 7, fallback_activated emit). When replaying a v0.1 transcript R7 / fallback emit do not fire (no input signal) |
| validator | R7 added, R4 binary→numerical. Recomputing scores on a v0.1 transcript may produce a different verdict under R4 (intentional honesty) |
| dispatcher | env wiring additions only. judgeInputPath is optional, no impact on actors other than verifier |
| sandwich files | inline-read frontmatter added to builder.md / builder-fallback.md / verifier.md, Reads column strengthened. Existing actor behavior preserved |
| presets | no change — `bagelcode-cross-3way` / `solo` / `sdk-enterprise` / `mock` / `bagelcode-video-research` 5 presets stay |

---

## 11. Diagrams

See [[bagelcode-system-diagrams-v0.4]] — 6 Mermaid diagrams:
1. Spawn lifecycle (sandwich assemble → adapter → timer race → output capture)
2. Score path (D1-D6 source matrix + 3-layer combine)
3. Anti-deception waterfall (R1 → R7 + verdict adjust + audit emit)
4. Verifier judge-input bundle projection
5. Routing matrix (kind → next_speaker / done / hook)
6. Preset binding resolution

---

## 12. See also

- [[bagelcode-system-architecture-v0.1]] — v0.1 baseline (§1-§14, still valid)
- [[bagelcode-system-diagrams-v0.4]] — 6 Mermaid diagrams
- [[bagelcode-same-provider-discount-2026-05-03]] — frontier rationale for numerical Rule 4
- [[bagelcode-verifier-context-isolation-2026-05-03]] — judge-input bundle decision logic
- [[bagelcode-scoring-ratchet-frontier-2026-05-02]] — scoring ratchet's effect (only on top of the deterministic gate)
- [[bagelcode-verifier-isolation-matrix]] — 16-source matrix backing verifier isolation (C1 isolation frontier consensus + C2 cross-provider backbone)
- [[bagelcode-llm-judge-frontier-2026]] — judge-bias sources (R3-R5)
- [[bagelcode-fault-tolerance-design]] — F1-F5 fault matrix (R7 tightens F2 verdict-without-evidence)
