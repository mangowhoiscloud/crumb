---
title: Crumb v3.5 시스템 다이어그램 — 6 Mermaid (spawn / score / anti-deception / judge-input / routing / preset)
category: concepts
tags: [bagelcode, crumb, diagrams, mermaid, v3.5, system-architecture]
sources:
  - "[[bagelcode-system-architecture-v3.5]] — text spec, 이 페이지의 짝"
  - "[[bagelcode-system-architecture-v3]] §1-§14 baseline"
  - "src/dispatcher/live.ts (spawn lifecycle)"
  - "src/reducer/index.ts (routing)"
  - "src/validator/anti-deception.ts (rules 1-7)"
  - "src/state/scorer.ts (combine D3/D5)"
  - "src/dispatcher/preset-loader.ts (binding resolution)"
summary: >-
  Crumb v3.5 의 6 다이어그램. 모두 Mermaid; 각 그림이 [[bagelcode-system-architecture-v3.5]] 의
  특정 섹션과 1:1 대응. (1) spawn lifecycle, (2) score path, (3) anti-deception waterfall,
  (4) judge-input bundle projection, (5) routing matrix, (6) preset binding resolution.
---

# Crumb v3.5 시스템 다이어그램

> 6 Mermaid 다이어그램. 텍스트 spec 은 [[bagelcode-system-architecture-v3.5]].
> 색상 — Tailwind CSS 기반 (Claude Code `mermaid-diagrams` skill 가이드 참조).

---

## 1. Spawn lifecycle — sandwich → adapter → timer race → emit

dispatcher 가 reducer 의 `effect{type:'spawn'}` 을 받아 actor subprocess 를 띄우는 전체 lifecycle. verifier 의 추가 분기 (judge-input bundle prepare) 가 강조됨.

```mermaid
flowchart TD
    classDef reducer fill:#dbeafe,stroke:#1e40af,color:#1e3a8a
    classDef dispatcher fill:#fef3c7,stroke:#b45309,color:#78350f
    classDef adapter fill:#dcfce7,stroke:#15803d,color:#14532d
    classDef writer fill:#fce7f3,stroke:#be185d,color:#831843
    classDef abort fill:#fee2e2,stroke:#b91c1c,color:#7f1d1d
    classDef verifierExtra fill:#ede9fe,stroke:#6d28d9,color:#4c1d95

    R[reducer push spawn effect]:::reducer
    D1[binding lookup<br/>preset.actors actor]:::dispatcher
    D2[harness adapter map<br/>+ provider activation gate]:::dispatcher
    D3[assembleSandwich<br/>base + inline_skills + inline_specialists<br/>+ local override + appends]:::dispatcher
    D4{actor == verifier?}:::dispatcher
    V1[readLatestBuildProvider<br/>CRUMB_BUILDER_PROVIDER env]:::verifierExtra
    V2[buildVerifierInputBundle<br/>CRUMB_JUDGE_INPUT_PATH env]:::verifierExtra
    D5[setupSpawnTimers<br/>15min wall + 90s idle]:::dispatcher
    A[adapter.spawn<br/>claude-local codex-local gemini-local gemini-sdk]:::adapter
    T1[wall-clock timer]:::abort
    T2[idle timer reset on stdout chunk]:::abort
    A1[child stdout/stderr capture<br/>onStdoutActivity ping idle reset]:::adapter
    W1[writer append note adapter streams]:::writer
    W2{exit_code OR timed_out?}:::dispatcher
    W3[writer append kind=error<br/>per_spawn_timeout reason]:::writer
    W4[writer append kind=agent.stop<br/>usage tokens cost model]:::writer
    R --> D1 --> D2 --> D3 --> D4
    D4 -- yes --> V1 --> V2 --> D5
    D4 -- no --> D5
    D5 --> A
    D5 --> T1
    D5 --> T2
    A --> A1 --> W1 --> W2
    T1 -. abort .-> A
    T2 -. abort .-> A
    A1 -- chunk activity --> T2
    W2 -- yes --> W3 --> W4
    W2 -- no --> W4
```

---

## 2. Score path — D1-D6 source-of-truth + 3-layer combine

verifier emit → reducer/validator → final aggregate 의 dim-by-dim provenance. Rule 4 numerical discount 가 LLM half (D1/D3/D5) 만 깎는 위치가 명확.

```mermaid
flowchart LR
    classDef qa fill:#dcfce7,stroke:#15803d,color:#14532d
    classDef verifier fill:#dbeafe,stroke:#1e40af,color:#1e3a8a
    classDef auto fill:#fef3c7,stroke:#b45309,color:#78350f
    classDef combine fill:#ede9fe,stroke:#6d28d9,color:#4c1d95
    classDef discount fill:#fee2e2,stroke:#b91c1c,color:#7f1d1d
    classDef final fill:#fce7f3,stroke:#be185d,color:#831843

    QA[qa-check effect<br/>htmlhint + playwright + ac_predicates]:::qa
    QR[qa.result.data<br/>exec_exit_code + cross_browser_smoke + ac_results]:::qa
    V[verifier CourtEval<br/>Grader Critic Defender Re-grader]:::verifier
    AUTO[reducer-auto<br/>computeAutoScores]:::auto
    QA --> QR
    QR -- D2 ground truth --> D2[D2 exec qa-check-effect]:::qa
    QR -- D6 ground truth --> D6[D6 portability qa-check-effect]:::qa
    V --> D1[D1 spec_fit verifier-llm]:::verifier
    V --> D3llm[D3 LLM half<br/>scores.D3.score]:::verifier
    V --> D5llm[D5 LLM half<br/>scores.D5.score]:::verifier
    AUTO --> D3auto[D3_auto<br/>kind diversity + body density]:::auto
    AUTO --> D4[D4 convergence reducer-auto]:::auto
    AUTO --> D5auto[D5_auto<br/>intervene response rate]:::auto
    R4{Rule 4: same provider?}:::discount
    D1 --> R4
    D3llm --> R4
    D5llm --> R4
    R4 -- yes 0.85 ×  --> D1d[D1 discounted]:::discount
    R4 -- yes 0.85 ×  --> D3llmd[D3 LLM discounted]:::discount
    R4 -- yes 0.85 ×  --> D5llmd[D5 LLM discounted]:::discount
    R4 -- no --> D1
    R4 -- no --> D3llm
    R4 -- no --> D5llm
    D1d --> COMBINE[combineAggregate<br/>D3 = avg D3llm + D3auto<br/>D5 = avg D5llm + D5auto]:::combine
    D1 --> COMBINE
    D3llm --> COMBINE
    D3llmd --> COMBINE
    D3auto --> COMBINE
    D5llm --> COMBINE
    D5llmd --> COMBINE
    D5auto --> COMBINE
    D2 --> COMBINE
    D4 --> COMBINE
    D6 --> COMBINE
    COMBINE --> AGG[aggregate 0-30<br/>verdict PASS PARTIAL FAIL]:::final
```

---

## 3. Anti-deception waterfall — 7 rules

`checkAntiDeception` 의 순차 실행. 마지막 단계의 verdict downgrade 까지.

```mermaid
flowchart TD
    classDef rule fill:#fef3c7,stroke:#b45309,color:#78350f
    classDef force fill:#fee2e2,stroke:#b91c1c,color:#7f1d1d
    classDef pass fill:#dcfce7,stroke:#15803d,color:#14532d
    classDef verdict fill:#ede9fe,stroke:#6d28d9,color:#4c1d95

    IN[judge.score event<br/>+ qaResult + autoScores + builderProvider]:::pass
    R1{R1: PASS &amp; exec_exit_code != 0?}:::rule
    R1Y[force D2=0<br/>verdict=FAIL<br/>tag verify_pass_without_exec_zero]:::force
    R2{R2: D2 != ground truth?}:::rule
    R2Y[force D2 to expected<br/>tag verifier_overrode_d2_ground_truth]:::force
    R3{R3: D4 != autoScores.D4?}:::rule
    R3Y[force D4 to autoScores<br/>tag verifier_overrode_d4_ground_truth]:::force
    R4{R4: same-provider?}:::rule
    R4Y[D1*0.85 D3*0.85 D5*0.85<br/>tags self_bias_risk_same_provider<br/>+ self_bias_score_discounted]:::force
    R5{R5: video evidence + D5 high + no citation?}:::rule
    R5Y[force D5=0<br/>tag researcher_video_evidence_missing]:::force
    AGG[combineAggregate recompute<br/>aggregate threshold check]:::pass
    F[aggregate < 24 floor downgrade?]:::rule
    FY[verdict→PARTIAL]:::verdict
    R6{R6: PASS but D1<3 AND D5<3?}:::rule
    R6Y[verdict→PARTIAL<br/>tag composite_gaming_d1_d5_below_minimum]:::force
    R7{R7 v3.5: PASS but ac_results FAIL?}:::rule
    R7Y[D1 cap 2<br/>verdict→PARTIAL<br/>tag verify_pass_with_ac_failure]:::force
    OUT[final scores + violations<br/>kind=audit emit if any]:::verdict

    IN --> R1
    R1 -- yes --> R1Y --> R2
    R1 -- no --> R2
    R2 -- yes --> R2Y --> R3
    R2 -- no --> R3
    R3 -- yes --> R3Y --> R4
    R3 -- no --> R4
    R4 -- yes --> R4Y --> R5
    R4 -- no --> R5
    R5 -- yes --> R5Y --> AGG
    R5 -- no --> AGG
    AGG --> F
    F -- yes --> FY --> R6
    F -- no --> R6
    R6 -- yes --> R6Y --> R7
    R6 -- no --> R7
    R7 -- yes --> R7Y --> OUT
    R7 -- no --> OUT
```

---

## 4. Verifier judge-input bundle projection — file-level isolation

dispatcher 가 verifier spawn 직전 `transcript.jsonl` → `judge-input.jsonl` 로 projection 하는 whitelist / blocklist matrix.

```mermaid
flowchart TD
    classDef tx fill:#fce7f3,stroke:#be185d,color:#831843
    classDef pass fill:#dcfce7,stroke:#15803d,color:#14532d
    classDef block fill:#fee2e2,stroke:#b91c1c,color:#7f1d1d
    classDef bundle fill:#ede9fe,stroke:#6d28d9,color:#4c1d95

    T[transcript.jsonl<br/>full event log 39+ kinds]:::tx

    subgraph WHITELIST[Whitelist - bundle includes]
      W1[goal latest 1]:::pass
      W2[spec or spec.update latest]:::pass
      W3[build latest]:::pass
      W4[qa.result latest]:::pass
      W5[artifact.created latest]:::pass
      W6[step.research.video ALL]:::pass
    end

    subgraph BLOCKLIST[Blocklist - excluded]
      B1[step.concept<br/>step.design<br/>step.research synth]:::block
      B2[step.judge x4<br/>judge.score<br/>verify.result]:::block
      B3[agent.thought_summary<br/>private CoT]:::block
      B4[note dispatch.spawn<br/>agent.start agent.stop<br/>handoff.* ack]:::block
      B5[user.intervene<br/>user.approve<br/>user.veto user.pause]:::block
      B6[audit validator-emitted]:::block
    end

    OUT[agent-workspace/verifier/<br/>judge-input.jsonl]:::bundle
    ENV[CRUMB_JUDGE_INPUT_PATH env]:::bundle
    SPAWN[verifier subprocess<br/>reads bundle ONLY]:::bundle

    T --> WHITELIST
    T --> BLOCKLIST
    WHITELIST --> OUT
    BLOCKLIST -. dropped .-> X[discarded]
    OUT --> ENV --> SPAWN
```

근거 frontier:
- ComplexEval Bench EMNLP 2025 §805 — auxiliary information bias scales with task complexity
- Preference Leakage ICLR 2026 — same-family generator reasoning inflates judge scores
- Anthropic Hybrid Norm 2026 — prompt-only mitigation 50%, file-level isolation = 잔여 50%

---

## 5. Routing matrix — kind → next_speaker / done / hook

reducer 의 18-case switch 를 단일 그래프로. event 가 들어왔을 때 어떤 effect 가 발화하는지.

```mermaid
flowchart TD
    classDef plan fill:#dbeafe,stroke:#1e40af,color:#1e3a8a
    classDef build fill:#fef3c7,stroke:#b45309,color:#78350f
    classDef qa fill:#dcfce7,stroke:#15803d,color:#14532d
    classDef verify fill:#ede9fe,stroke:#6d28d9,color:#4c1d95
    classDef terminal fill:#fce7f3,stroke:#be185d,color:#831843
    classDef hook fill:#fee2e2,stroke:#b91c1c,color:#7f1d1d
    classDef user fill:#e0e7ff,stroke:#3730a3,color:#1e1b4b

    USER[user pitch /crumb]:::user
    GOAL[kind=goal]:::plan
    PLN[spawn planner-lead]:::plan
    HND[handoff.requested<br/>to=researcher]:::plan
    RSCH[spawn researcher]:::plan
    SREs[step.research synth]:::plan
    PLN2[re-spawn planner-lead<br/>Phase B Design+Synth]:::plan
    SPEC[kind=spec or spec.update]:::plan
    BLD[spawn builder]:::build
    BUILD[kind=build]:::build
    QAEFF[qa_check effect]:::qa
    QAR[kind=qa.result]:::qa
    VER[spawn verifier]:::verify
    JUDGE[kind=judge.score]:::verify
    R7AC[Rule 7 ac_results FAIL?]:::verify
    VPASS{verdict?}:::verify
    DONE[kind=done verdict_pass]:::terminal
    PART[hook partial<br/>user confirm/veto]:::hook
    FAIL{builder circuit OPEN?}:::verify
    AUDIT[append kind=audit<br/>fallback_activated]:::hook
    BFB[spawn builder-fallback]:::build
    ROLL[rollback to planner-lead<br/>respec_count++]:::plan
    ERR[kind=error]:::hook
    BRK[circuit_breaker++<br/>stuck_count++]:::hook
    STK[hook stuck<br/>at 5 consecutive]:::hook
    USR[user.intervene/veto/<br/>approve/pause/resume]:::user

    USER --> GOAL --> PLN --> HND --> RSCH --> SREs --> PLN2 --> SPEC --> BLD --> BUILD --> QAEFF --> QAR --> VER --> JUDGE --> R7AC --> VPASS
    VPASS -- PASS --> DONE
    VPASS -- PARTIAL --> PART
    VPASS -- FAIL/REJECT --> FAIL
    FAIL -- yes --> AUDIT --> BFB --> BUILD
    FAIL -- no --> ROLL --> SPEC
    ERR --> BRK --> STK
    USR --> PLN
```

---

## 6. Preset binding resolution — (harness × provider × model) tuple

dispatch 가 actor → adapter 를 결정하는 fallback chain.

```mermaid
flowchart TD
    classDef preset fill:#ede9fe,stroke:#6d28d9,color:#4c1d95
    classDef ambient fill:#fef3c7,stroke:#b45309,color:#78350f
    classDef adapter fill:#dcfce7,stroke:#15803d,color:#14532d
    classDef gate fill:#fee2e2,stroke:#b91c1c,color:#7f1d1d
    classDef out fill:#dbeafe,stroke:#1e40af,color:#1e3a8a

    SP[spawn effect<br/>actor=X]:::out
    P1{preset.actors X exists?}:::preset
    P2[binding.harness +<br/>binding.provider +<br/>binding.model + binding.effort]:::preset
    AMB[ambient fallback<br/>entry host harness]:::ambient
    HM[HARNESS_TO_ADAPTER map<br/>claude-code claude-local<br/>codex codex-local<br/>gemini-cli gemini-local<br/>gemini-sdk gemini-sdk<br/>mock mock]:::adapter
    GATE{providersEnabled<br/>binding.harness == false?}:::gate
    SUB[substitute claude-local<br/>emit kind=note]:::gate
    ADAPTER[adapter.spawn<br/>+ CRUMB_HARNESS<br/>+ CRUMB_PROVIDER<br/>+ CRUMB_MODEL<br/>+ binding.effort]:::out

    SP --> P1
    P1 -- yes --> P2 --> HM
    P1 -- no --> AMB --> HM
    HM --> GATE
    GATE -- yes --> SUB --> ADAPTER
    GATE -- no --> ADAPTER
```

5 presets:
- **bagelcode-cross-3way** ★ default — builder=codex, verifier=gemini-cli, rest=ambient
- **solo** — single-host (Claude only); R4 self-bias 의 경고 표시
- **sdk-enterprise** — API key direct (coordinator/planner/builder-fallback=anthropic-sdk, builder=openai-sdk, verifier=google-sdk)
- **mock** — deterministic CI / no auth
- **bagelcode-video-research** — researcher=gemini-sdk 명시 (video evidence path)

---

## See also

- [[bagelcode-system-architecture-v3.5]] — text spec (이 페이지의 짝)
- [[bagelcode-system-architecture-v3]] — v3 baseline 다이어그램 6 종 (orchestration topology / handoff / scoring layers / etc.)
- [[bagelcode-orchestration-topology]] — Hub-Ledger-Spoke 도형
- [[bagelcode-fault-tolerance-design]] — F1-F5 fault matrix (Rule 7 이 F2 verdict-without-evidence 보강)
- `~/.claude/skills/mermaid-diagrams/SKILL.md` — Tailwind 색감 가이드 (Claude Code skill)
