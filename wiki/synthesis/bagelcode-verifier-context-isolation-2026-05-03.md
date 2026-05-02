---
title: Verifier hard input isolation — judge-input bundle pattern
date: 2026-05-03
type: synthesis
tags: [verifier, llm-judge, context-isolation, anti-deception, frontier-2026, complex-eval-bench, preference-leakage, anthropic-bloom]
related:
  - bagelcode-same-provider-discount-2026-05-03
  - bagelcode-scoring-ratchet-frontier-2026-05-02
  - bagelcode-verifier-isolation-matrix
  - bagelcode-llm-judge-frontier-2026
---

# Verifier hard input isolation — judge-input bundle pattern

> **질문**: verifier 가 평가할 때 transcript.jsonl 전체를 읽어야 하는가, 아니면 평가에 필요한 최소 컨텍스트 (spec / build / qa.result / artifacts / step.research.video) 만 보여줘야 하는가?
>
> **결론**: **최소 컨텍스트로 격리 (hard isolation)**. dispatcher 가 verifier spawn 직전 `judge-input.jsonl` bundle 을 prepare 하고, sandwich 가 그 path 만 read 하도록 강제. 이전의 prompt-only enforcement (sandwich 텍스트로 "DOES NOT read agent.thought_summary" 적기) 는 frontier 2025-2026 evidence 와 모순 — Anthropic 2026 Hybrid Normalization 의 prompt mitigation 50% cover 명제와 일치하게, **격리는 file-level enforcement 로 격상**.

---

## 0. TL;DR

- **이전**: verifier 가 `cat transcript.jsonl` 또는 `crumb event tail` (PR #69 이후) 로 거의 모든 이벤트를 읽음. AGENTS.md 의 "DOES NOT read agent.thought_summary" 는 prompt-only.
- **이후**: dispatcher 가 verifier spawn 마다 `agent-workspace/verifier/judge-input.jsonl` 자동 생성. **포함**: latest `goal` / `spec` / `build` / `qa.result` / `artifact.created` / `step.research.video`. **제외**: `step.concept`, `step.design`, `step.research` synthesis (planner-internal reasoning), prior `judge.score` / `verify.result` (anchor bias 회피), `agent.thought_summary` (private CoT), `dispatch.spawn` / `note` (dispatcher meta).
- **env**: `CRUMB_JUDGE_INPUT_PATH` 추가, sandwich 가 이걸 가리킴. `CRUMB_TRANSCRIPT_PATH` 는 emission 전용 유지.
- **scope**: verifier actor 만. 다른 actor 는 그대로 transcript 전체 read (spec_authoring 은 prior research/concept 가 input 이라 해당 안 됨).
- **anti-deception**: full transcript 의 `qa.result.exec_exit_code` lookup 은 reducer/validator 가 수행 — verifier subprocess 격리와 무관.

---

## 1. 문제 — prompt-only enforcement 의 frontier-mismatch

### 1.1 현재 동작

`agents/verifier.md:32` 의 Reads column:

> **Reads** | `kind=spec` (sealed) + `kind=build` + `kind=qa.result` (REQUIRED) + `artifacts/{game/, game.html, spec.md, DESIGN.md}` + `kind=step.research.video` (D5 evidence). **DOES NOT** read `kind=agent.thought_summary` from builder (private chain-of-thought)

PR #69 의 `crumb event tail` 가 visibility=private 만 strip. 하지만 `step.concept` / `step.design` / `step.research` synthesis / 이전 `judge.score` 는 visibility=public 이라 verifier 에 그대로 노출됨.

### 1.2 frontier 2025-2026 evidence — "less context"

| 출처 | 핵심 measurement |
|---|---|
| **ComplexEval Bench (EMNLP 2025 Findings §805)** | "Bias magnitude scales with task complexity. Auxiliary information / reference knowledge **biases LLM evaluation** ('curse of knowledge')." 명시적으로 **less context** 권고. |
| **Preference Leakage (Li et al. ICLR 2026, arXiv 2502.01534)** | 같은 family/inheritance 의 generator 가 만든 reasoning 을 judge 가 보면 **체계적 점수 인플레이션**. CoT inspection 으로 검출 불가. |
| **Anthropic Bloom (alignment 2025)** | 4-stage (Understanding → Ideation → Rollout → **Judgment**) 분리. Judgment 단계는 prior reasoning 격리. |
| **Anthropic Demystifying Evals (engineering 2026)** | "grade each dimension with an **isolated** LLM-as-judge rather than using one to grade all dimensions." |
| **Context Over Content (arXiv 2604.15224)** | judge 가 contextual framing 신호에 verdict 조정. CoT 에서 invisible. |
| **Anthropic Hybrid Normalization 2026** | "Prompt-only mitigation reaches **~50% effect reduction**; the residual is *your* responsibility." → hybrid 2-stage 권고. |

### 1.3 매핑 — Crumb 의 갭

PR #69 의 visibility filter 는 prompt-mitigation 의 frontier-50% 절반 (private CoT 차단). 잔여 50% 는 file-level isolation 으로 닫아야 frontier alignment 완성.

특히 우려:
- Verifier 가 `step.concept` 를 읽으면 → planner 의 "이건 어려운 요구사항이다" 같은 framing 흡수 → leniency bias (Context Over Content arXiv 2604.15224)
- Verifier 가 prior `judge.score` (round 1, 2) 를 읽으면 → anchor bias (Tversky-Kahneman 1974, LLM judge 에서 reproducible per Schoenegger NeurIPS 2024)
- Same-provider builder 의 reasoning 을 verifier 가 보면 → preference leakage 효과 (ICLR 2026)

---

## 2. 변경 사양

### 2.1 Bundle 구성 (whitelist)

dispatcher 가 verifier spawn 직전, transcript.jsonl 을 walk 하면서 다음 kind 만 fresh `judge-input.jsonl` 에 복사:

```
goal                   1×  (always)
spec                   latest sealed
spec.update            latest if newer than spec
build                  latest
qa.result              latest paired with build
artifact.created       latest paired with build
step.research.video    all (D5 evidence 인용 강제 → Rule 5)
```

**제외 (block list)**:

| Kind | 이유 |
|---|---|
| `step.concept` | planner reasoning, framing bias |
| `step.design` | 같음 |
| `step.research` (synthesis) | planner reasoning |
| `step.judge` × 4 (Grader/Critic/Defender/Re-grader) | 이전 round 의 sub-step, anchor bias |
| `judge.score` / `verify.result` | 이전 round verdict, anchor bias |
| `agent.thought_summary` | private CoT |
| `dispatch.spawn` / `note` | dispatcher meta |
| `agent.start` / `agent.stop` | turn boundary, 평가 무관 |
| `handoff.requested` / `handoff.rollback` | routing meta |
| `user.intervene` / `user.approve` / `user.veto` | 사용자 hint 가 verifier 에 leak 되면 framing |
| `audit` (validator-emitted) | recursion 회피 |

### 2.2 구현 위치

`src/dispatcher/live.ts` 에 `buildVerifierInputBundle(transcriptPath, sessionDir): Promise<string>` helper 추가:
1. transcript.jsonl 라인 단위 read
2. allowed-kind 필터 + 최신 N 개만 (spec/build/qa.result/artifact.created 는 latest 1 개, step.research.video 는 all)
3. `<sessionDir>/agent-workspace/verifier/judge-input.jsonl` 에 write
4. 경로 반환

dispatcher spawn 전에 호출:
```ts
if (effect.actor === 'verifier') {
  const judgeInputPath = await buildVerifierInputBundle(deps.transcriptPath, deps.sessionDir);
  // env via SpawnRequest (next section)
}
```

### 2.3 env wiring

`SpawnRequest` 에 `judgeInputPath?: string` 추가, `buildAdapterEnv` 가 `CRUMB_JUDGE_INPUT_PATH` 로 전파.

### 2.4 sandwich update

`agents/verifier.md` 의 Reads column 수정:

```
Reads | $CRUMB_JUDGE_INPUT_PATH (only — dispatcher-prepared minimal bundle).
       Direct cat / Read of transcript.jsonl is forbidden — the bundle is
       the canonical view. Bundle includes: goal, spec (latest), build,
       qa.result, artifact.created, step.research.video. Excludes:
       planner reasoning (step.concept/design/research), prior judge.score
       (anchor bias), agent.thought_summary, dispatch.spawn.
```

Bash tool 의 read scope 를 `$CRUMB_JUDGE_INPUT_PATH` 로 좁힘 (단 `crumb event` emission 은 `$CRUMB_TRANSCRIPT_PATH` 사용 유지).

### 2.5 anti-deception 영향 없음

`validator/anti-deception.ts` 의 Rule 1/2 는 `next.last_qa_result` (reducer 가 stash) 를 사용. reducer 는 full transcript 를 read 하므로 verifier subprocess 의 격리와 무관. **D2/D6 ground truth firewall 그대로 작동**.

Rule 5 (researcher_video_evidence_missing) 는 `step.research.video` 를 bundle 에 포함하므로 verifier 가 정상적으로 cite 가능.

### 2.6 deterministic replay 보존

bundle 은 transcript 의 결정론적 projection (kind whitelist + latest-K filter). 매 spawn 에 새로 생성되며 disk 에 보관. `crumb replay` 시 동일 transcript → 동일 bundle 재생성.

---

## 3. Risk + 처리

| Risk | 처리 |
|---|---|
| **D1 spec_fit 평가에 planner reasoning 필요?** | 아님 — spec.md 의 acceptance_criteria 가 **그 자체로** binding spec. planner reasoning 은 spec 도출 과정이지 평가 기준 아님. 오히려 anchor bias 유발 |
| **CourtEval sub-step (Grader/Critic/Defender/Re-grader) 간 컨텍스트 공유?** | 단일 verifier spawn 내에서 4 sub-step 이 같은 컨텍스트 공유 — 차단되는 건 **이전 round 의** verifier 출력만 |
| **Builder 의 audit_violations cite 가능한가?** | builder 가 명시적으로 emit 한 validation 결과는 sandwich 가 아닌 transcript meta. 평가 대상 artifact 자체 판단이 우선이라 차단 의도적 |
| **Rebuild 후 verifier 가 어떻게 변화 알지?** | 새 build / qa.result / artifact.created 는 매 spawn 마다 fresh 생성됨. round-by-round 비교는 reducer 가 수행 (score_history) |

---

## 4. 결정 영향

| 항목 | 영향 |
|---|---|
| `src/dispatcher/live.ts` | `buildVerifierInputBundle()` 함수 추가, verifier spawn 분기 |
| `src/adapters/types.ts` | SpawnRequest 에 `judgeInputPath?: string` |
| `src/adapters/_shared.ts` | `CRUMB_JUDGE_INPUT_PATH` env 전파 |
| `agents/verifier.md` | Reads column 강화, Bash scope 좁힘 |
| dashboard | bundle 파일을 읽는 UI 가 있다면 (현재 없음) 무영향 |
| anti-deception / reducer | 영향 없음 (full transcript 그대로 사용) |
| replay determinism | 영향 없음 (bundle 은 transcript 의 결정론적 projection) |

---

## 5. References

- **Li et al. ICLR 2026** (arXiv 2502.01534) — *Preference Leakage: A Contamination Problem in LLM-as-a-judge*. Same family/inheritance 인플레이션, CoT 에서 검출 불가.
- **EMNLP 2025 Findings §805** (ComplexEval Bench) — 6 unexplored biases × 12 basic + 3 advanced scenarios. **Less context** 명시 권고.
- **Anthropic 2025** (alignment.anthropic.com/2025/bloom-auto-evals) — Bloom 4-stage isolation. Claude Opus 4.1 vs human Spearman 0.86.
- **Anthropic Engineering 2026** (demystifying-evals-for-ai-agents) — "grade each dimension with an isolated LLM-as-judge" 권고.
- **arXiv 2604.15224** — *Context Over Content: Exposing Evaluation Faking in Automated Judges*. Contextual framing 의 verdict 조정 효과.
- **Anthropic Hybrid Normalization 2026** — prompt-only mitigation 50% cover, 나머지는 hybrid 책임.
- **Schoenegger NeurIPS 2024** — anchor bias in LLM judges (Tversky-Kahneman 1974 reproduction).

## 6. Cross-links

- ★ **[[bagelcode-system-architecture-v3.5]]** §6.1 — 본 페이지의 bundle 결정이 v3.5 dispatcher 에 file-level enforcement 로 격상됨
- ★ **[[bagelcode-system-diagrams-v3.5]]** §4 — judge-input bundle projection Mermaid
- [[bagelcode-same-provider-discount-2026-05-03]] §2.2 — Anthropic Hybrid 2-stage 의 다른 절반 (numerical correction) 과 짝
- [[bagelcode-scoring-ratchet-frontier-2026-05-02]] §3 — failure modes
- [[bagelcode-verifier-isolation-matrix]] row #2 — Anthropic "fresh context only" 매핑
- [[bagelcode-llm-judge-frontier-2026]] R3-R5 — judge bias inventory
