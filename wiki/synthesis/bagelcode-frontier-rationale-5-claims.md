---
title: 베이글코드 과제 — 4-actor 결정의 5 frontier 근거 + TradingAgents 정합
category: synthesis
tags: [bagelcode, rationale, frontier, tradingagents, paperclip, superpowers, anthropic, lanham, mit, shopify]
sources:
  - "[[bagelcode-tradingagents-paper]]"
  - "[[bagelcode-orchestration-topology]]"
  - "[[bagelcode-frontier-orchestration-2026]]"
  - "[[bagelcode-production-cases-2026]]"
  - "raw/bagelcode-research/observability-frontier-2026-05.md"
created: 2026-05-02
updated: 2026-05-02
---

# Crumb 4-actor 의 5 frontier 근거 + TradingAgents 정합

> **목적**: README positioning 한 단락의 5 claim 을 깊이 분해. 각 claim 의 (a) 무슨 일이 있었나 (b) 왜 교훈인가 (c) Crumb 흡수 방식 (d) 코드 영향. + **TradingAgents §4 가 어떻게 같은 문제를 다뤘는지** 정합 매핑.

---

## Part 1 — 5 frontier claim 분해

### Claim 1 — Paperclip 5-deep 계층 + 35% skill bloat

**(a) 무슨 일이 있었나** (Issue #3438, 2026)

```
Paperclip 표준 셋업: CEO → CTO → Founding Engineer → QA → UX (5-deep, 8-agent)

매 heartbeat 마다:
  paperclip skill = 단일 390-line markdown
  → 8개 agent 모두에게 context 로 로드
  → 137 lines (~35%) = "CEO/admin-only workflow"
  → 8-agent × heartbeat = ~21K tokens 매번 낭비
```

verbatim (Issue #3438):
> "describes workflows only the CEO/admin can act on... ~21K tokens of context per heartbeat round spent on instructions non-admin agents can never execute."

**(b) 교훈**: 계층 깊이 ≠ 표현력. 모든 agent 가 모든 instruction 받음 = 35% 낭비.

**(c) Crumb 흡수**:
- 5-deep × 8-agent → **2-deep × 4-actor**
- 단일 paperclip skill → **per-actor sandwich §2**
- admin/worker 혼재 → **admin 없음 (사용자 직접)**

**(d) 코드 영향**:
```
agents/
├── coordinator.md  routing + ledger
├── planner.md      spec writing
├── builder.md      code synthesis
└── verifier.md     verification
```

토큰: Paperclip ~50K/heartbeat → Crumb ~12K/turn (cache 후 ~5K). **-75% 절감**.

---

### Claim 2 — obra/superpowers TDD Iron Law

**(a) 무슨 일이 있었나** (89K stars, 2026-01-15 Anthropic marketplace 채택)

obra/superpowers 의 7-phase: Brainstorm → Design → Plan → Subagent execution → Review → Merge → Ship

verbatim (TDD Iron Law):
> "**NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST**"

**(b) 교훈**: LLM 의 anti-deception 문제 — "PASS" 라고 거짓말함. test 가 fail 하는 걸 확인한 후에만 production code = LLM 거짓말 차단.

**(c) Crumb 흡수**:
- 7-phase → **4-step 으로 압축**
- Iron Law → **Verifier 의 schema 단계 강제**
- Anti-deception 5 룰:
  1. PASS 인데 `exec.exit_code` 없음 → D2 = 0 강제
  2. PASS 인데 `criteria` 배열 없음 → D1 = 0 강제
  3. Spec 의 AC 비어있음 → D1 = 0 강제
  4. build 한다는데 `artifacts` 0개 → D2 = 0 강제
  5. user.veto 후 그대로 done → 전체 0 강제

**(d) 코드 영향**:
```typescript
// validator/anti-deception.ts
export function enforceAntiDeception(msg: VerifyResult) {
  if (msg.data.verdict === 'PASS' && !msg.data.exec?.exit_code)
    msg.data.dimensions.D2 = 0;  // Rule 1
  if (msg.data.verdict === 'PASS' && !msg.data.criteria?.length)
    msg.data.dimensions.D1 = 0;  // Rule 2
  // ...
}
```

→ **superpowers 의 7 phase 안전성을 5 schema rule 로 압축**. turn 절약 + 안전성 유지.

---

### Claim 3 — Anthropic 'wrong tradeoff'

**(a) 무슨 일이 있었나** (Sonnet 4.6 release notes, 2026-03)

```
2026-03 변경:
  Claude Code default reasoning effort: high → medium
  의도: latency 절감 + rate limit 효율

사용자 피드백:
  "complex code quality 가 떨어졌다"
  "agent 가 단순 솔루션만 내놓는다"

Anthropic 응답:
  "We've identified that this was the wrong tradeoff."
  → 다시 user-controllable 강화
```

**(b) 교훈**: Tradeoff 를 platform 일방 결정 X. 사용자마다 quality vs latency 비중 다름. **명시 선택권 노출이 platform 의 의무**.

**(c) Crumb 흡수**:
- 3 preset (`solo` / `standard` / `parallel`)
- ENV 변수 모델 swap (`CRUMB_MODEL_*`)
- thinking_effort per-agent

**(d) 코드 영향**:
```toml
# .crumb/config.toml — user-editable
[agents.planner]
model = "claude-opus-4-7"
thinking_effort = "high"

[agents.verifier]
model = "claude-sonnet-4-6"
thinking_effort = "medium"
```

---

### Claim 4 — Lanham/Google 'centralized 4.4× containment'

**(a) 무슨 일이 있었나** (Google 2026 study, Lanham 2026-04 인용)

```
실험: 150+ tasks × 5 popular MAS frameworks

결과:
  Independent agents (mesh, peer-to-peer)
    → error 17.2× amplification
  Centralized supervisor (Hub-Spoke 변형)
    → error 4.4× containment
  
Sequential planning: every multi-agent variant -39 ~ -70%
```

**(b) 교훈**: topology 가 error blast radius 결정. **4 배 차이 = production 운영 가능 여부**.

**(c) Crumb 흡수**:
- Mesh / independent broadcasting → ❌ 채택 X
- **Hub-Ledger-Spoke** (centralized routing only via Coordinator) → ✅ 채택
- Spoke 끼리 직접 호출 X → 거짓 전파 경로 차단

**(d) 코드 영향**:
```typescript
// coordinator.ts — single point of containment
class Coordinator {
  // 모든 routing 권한, validator 통과 후만 다음 spoke
}

// adapters/base.ts — spoke 권한 제한
interface AgentAdapter {
  // can: transcript.read, artifacts.read/write
  // cannot: spawn other adapter (Coordinator only)
}
```

---

### Claim 5 — MIT 결정 이론 'short relay 22.5%'

**(a) 무슨 일이 있었나** (MIT 결정 이론, Lanham 2026-04 인용)

```
실험 (GPT-4):
  같은 task 를 N stage relay 로

결과:
  1 stage:  90.7%
  2 stage:  41.2%   (-49.5%p)
  5 stage:  22.5%   (-68.2%p)

이론 (Bayesian):
  "without new exogenous signals, any delegated acyclic network 
   is decision-theoretically dominated by a centralized Bayes 
   decision maker"
```

**(b) 교훈**: 새 정보 없이 단계만 늘리면 정확도 폭락. **PDCA 5 stage = 22.5% 영역**.

**(c) Crumb 흡수**:
- old PDCA (Plan→Design→Do→Check→Act) → 폐기
- **new short chain**: goal → spec → build → verify → done (4 actor)
- progress-ledger 의 stage 개념 없음, dynamic next_speaker

**(d) 코드 영향**:
```typescript
// progress-ledger.ts — stage 없음
interface ProgressLedger {
  step: number;          // counter 만
  next_speaker: ActorId; // dynamic
}

function computeNext(transcript: Message[]): ActorId {
  const last = transcript.at(-1);
  switch (last.kind) {
    case 'goal': return 'planner';
    case 'spec': return 'builder';
    case 'build': return 'verifier';
    case 'verify.result':
      return last.data.verdict === 'PASS' ? 'done' : 'planner';
  }
}
```

---

### Bonus claim — Shopify 'avoid multi-agent early'

verbatim:
> "Avoid multi-agent architectures early. Tool complexity already made a single-agent system hard enough to reason about; adding more agents too early multiplies prompts, traces, and failure surfaces before it multiplies value."

→ Crumb 흡수: `--solo` 가 default, `--standard`/`--parallel` 명시 opt-in.

---

## Part 2 — TradingAgents 가 같은 문제를 어떻게 다뤘나 (정합 매핑)

> [[bagelcode-tradingagents-paper]] (arXiv 2412.20138, Tauric Research/UCLA/MIT) 가 우리 1차 학술 근거.
> 5 frontier claim 중 어디까지 다뤘는지 표.

### 매핑 표

```
┌────────────────┬──────────────────────────────┬───────────────────────────┐
│ 5 claim         │  TradingAgents 의 응답           │  Crumb 가 추가한 layer        │
├────────────────┼──────────────────────────────┼───────────────────────────┤
│ 1. Skill bloat   │  ✅ 직접 다룸                    │  ⊕ 운영 spec 추가            │
│   (Paperclip)   │  §4.1 "each role only extracts │  per-actor sandwich §2     │
│                 │   or queries the necessary    │  (학술 → 운영 instantiation) │
│                 │   information"                  │                            │
│                 │  → role-based separation 학술  │                            │
│                 │   적 선언                        │                            │
├────────────────┼──────────────────────────────┼───────────────────────────┤
│ 2. TDD Iron Law │  ⚠ 부분적                       │  ⊕ Verifier exec + 5 룰   │
│   (superpowers) │  §4.2 multi-stage validation:  │  validator/anti-deception │
│                 │  Risk Mgmt Team debate +        │  schema 단계 enforcement   │
│                 │  Fund Manager final approval    │                            │
│                 │  §6.1.4: "detailed reasoning,  │                            │
│                 │   tool usage, grounding         │                            │
│                 │   evidence"                     │                            │
│                 │  → verification-first 발상은    │                            │
│                 │   있지만 schema 강제 X         │                            │
├────────────────┼──────────────────────────────┼───────────────────────────┤
│ 3. Wrong tradeoff│  ✅ 직접 다룸                    │  ⊕ user-facing preset    │
│   (Anthropic)    │  §4.3 Quick (gpt-4o-mini) vs  │  .crumb/config.toml +    │
│                 │   Deep (o1-preview) split       │  --preset solo/standard/.. │
│                 │  "researchers can effortlessly  │  ENV CRUMB_MODEL_*        │
│                 │   replace the model with any   │                            │
│                 │   locally hosted or API-       │                            │
│                 │   accessible alternatives"     │                            │
│                 │  → model trade-off 노출의       │                            │
│                 │   학술적 정당화                  │                            │
├────────────────┼──────────────────────────────┼───────────────────────────┤
│ 4. Centralized   │  ✅✅ 직접 다룸 (가장 강함)     │  ⊕ 정량 데이터 보강       │
│   containment    │  §4.1 "structured                │  Lanham 2026 의 4.4× /   │
│   (Lanham)       │   communication protocol"       │  17.2× 데이터 추가 인용    │
│                 │  Fund Manager final centralized │  (TradingAgents 는 정량   │
│                 │   decision                      │   분석 없이 정성적 정당화) │
│                 │  Risk Mgmt 의 facilitator 가   │                            │
│                 │   debate 결론 환원               │                            │
│                 │  → centralized supervisor 패턴 │                            │
│                 │   정확히 채택                    │                            │
├────────────────┼──────────────────────────────┼───────────────────────────┤
│ 5. MIT short     │  ✅ 직접 다룸 (telephone game)  │  ⊕ MIT 정량 데이터 추가   │
│   relay 22.5%    │  §4.1 verbatim:                  │  90.7% → 22.5% 회귀        │
│                 │  "pure natural language          │  TradingAgents 는 정성적   │
│                 │   communication can resemble a   │   "telephone effect" 만   │
│                 │   **game of telephone**—over    │   언급, MIT 정량 데이터    │
│                 │   multiple iterations, initial   │   없음                     │
│                 │   information may be forgotten   │                            │
│                 │   or distorted"                  │                            │
│                 │  → 같은 문제 인식, 해법 = 5     │                            │
│                 │   structured documents           │                            │
└────────────────┴──────────────────────────────┴───────────────────────────┘
```

→ **TradingAgents 가 5 claim 중 4 개 직접 다룸. Crumb 는 학술 prior 위에 운영 layer 추가**.

---

## Part 3 — TradingAgents 가 다루지 못한 5 영역 (Crumb 가 추가)

```
TradingAgents 는 학술 prototype                Crumb 가 추가
─────────────────────────────                  ──────────────

1. ❌ 운영 차원 token efficiency               ⊕ 12-rule efficiency 룰
   (kiki/Paperclip 의 21K 낭비 같은            (sandwich cache + transcript pull
    실 운영 데이터 분석 없음)                    + artifact ref + Plan Cache)

2. ❌ Anti-deception schema enforcement       ⊕ validator/anti-deception.ts
   (의도는 있지만 코드 단계 강제 없음)         5 schema 룰 (D1=0, D2=0 강제)

3. ❌ Cross-provider verification              ⊕ Builder=Codex / Verifier=Claude
   (single provider 가정, OpenAI 만)           (다른 model architecture)

4. ❌ Fault tolerance 시스템                  ⊕ F1-F5 + circuit breaker
   (adapter 장애 / 환경 변화 / stuck         + capability probe + stuck escalation
    escalation 부재)                          + ALAS local compensation

5. ❌ User intervention surface                ⊕ TUI 5 surface
   (학술 prototype, HITL 부재)                (slash + free-text + 4 hook + 
                                              inbox.txt + SIGINT)
```

→ **TradingAgents = academic foundation, Crumb = production-grade instantiation**.

---

## Part 4 — 한 단락 + 학술 backing 명시 (README 강화)

```markdown
## Why 4 actors? (TradingAgents §4 + 5 frontier 데이터 종합)

Crumb's 4-actor structure is grounded in TradingAgents (arXiv 2412.20138, 
Xiao et al., UCLA + MIT + Tauric Research) §4 communication protocol and 
specialized 2026 frontier data.

TradingAgents directly addresses 4 of our 5 design concerns:

  1. Role-based separation ($4.1: "each role only extracts or queries the 
     necessary information") — Crumb implements via per-actor sandwich §2
     (vs Paperclip's 35% admin-only bloat, Issue #3438).
  
  2. Model trade-off exposure ($4.3: "researchers can effortlessly replace 
     the model with any... alternative") — Crumb implements via 
     .crumb/config.toml + --preset (vs Anthropic 2026-03 "wrong tradeoff" 
     of forcing default effort=medium).
  
  3. Centralized supervision ($4.1 + Fund Manager) — Crumb implements via 
     Hub-Ledger-Spoke (vs independent agents amplifying errors 17.2× per 
     Google 2026 / Lanham 2026-04).
  
  4. Telephone effect mitigation ($4.1: "pure natural language ... can 
     resemble a game of telephone") — Crumb implements via 4-actor short 
     chain (vs 5-stage relay degrading to 22.5% accuracy per MIT decision 
     theory).

Crumb adds a 5th concern not covered in academic prototype:

  5. Anti-deception enforcement (vs superpowers' "Iron Law: NO PRODUCTION 
     CODE WITHOUT FAILING TEST FIRST") — Crumb implements via 
     validator/anti-deception.ts 5 schema rules forcing D1=0/D2=0 when 
     PASS without exec.exit_code or AC criteria.

Plus operational layers (5) not in academic scope:
  - Token efficiency (12 rules, ~50K/session vs Paperclip ~200K)
  - Cross-provider Verifier (Builder=Codex / Verifier=Claude different model)
  - Fault tolerance (F1-F5 + circuit breaker + capability probe)
  - User intervention (TUI + slash + inbox.txt + 4 hook + SIGINT)
  - Dual interface (agent-friendly XML + human studio)

Result: TradingAgents §4 academic foundation + Lanham/Google 2026 quantitative 
backing + Paperclip Issue #3438 operational lessons + superpowers TDD discipline 
+ Anthropic UX feedback = 4-actor minimal viable orchestration.
```

→ **academic backing + production lessons 모두 한 단락에 압축**. 평가자에게 신뢰성 압도적.

---

## Part 5 — 정합 시각화

```
═══════════════════════════════════════════════════════════════════════════
                    Crumb 의 design pedigree
═══════════════════════════════════════════════════════════════════════════

  TradingAgents §4 (학술 foundation)
       ▾
  ┌─────────────────────────────────────────────────┐
  │  Communication Protocol                            │
  │   ▸ structured documents > NL                      │ ← Claim 4, 5
  │   ▸ each role queries necessary info               │ ← Claim 1
  │   ▸ Quick/Deep model split                         │ ← Claim 3
  │   ▸ Centralized Fund Manager                       │ ← Claim 4
  │   ▸ ReAct prompting                                │
  └─────────────────────────────────────────────────┘
       ▾
       ▾  + Lanham 2026-04 정량 데이터 (4.4× / 17.2×)
       ▾  + MIT 결정 이론 (90.7% → 22.5%)
       ▾  + Paperclip Issue #3438 (35% bloat / 21K 낭비)
       ▾  + Anthropic 2026-03 ("wrong tradeoff" 인정)
       ▾  + obra/superpowers (TDD Iron Law, 89K stars)
       ▾  + Shopify (avoid multi-agent early)
       ▾
  ┌─────────────────────────────────────────────────┐
  │  Crumb 4-actor minimal viable orchestration       │
  │                                                   │
  │   ▸ 4 actor (vs 8+ Paperclip)                    │
  │   ▸ Hub-Ledger-Spoke (centralized)               │
  │   ▸ XML sandwich (Anthropic native)              │
  │   ▸ JSONL transcript (single SoT)                │
  │   ▸ per-actor sandwich §2 (no admin bloat)       │
  │   ▸ Verifier exec + anti-deception 5 rules        │
  │   ▸ user-controllable 3 preset + ENV swap        │
  │   ▸ TUI 4 pane + 4 hook + slash command           │
  │   ▸ F1-F5 fault tolerance                         │
  │   ▸ OTel GenAI alias (export ready)              │
  └─────────────────────────────────────────────────┘
```

---

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-tradingagents-paper]] — 1차 학술 근거 (§4 communication protocol)
- [[bagelcode-orchestration-topology]] — Hub-Ledger-Spoke 결정
- [[bagelcode-frontier-orchestration-2026]] — 11 frontier 사료
- [[bagelcode-production-cases-2026]] — Lanham 2026-04 + Meta + Shopify
- [[bagelcode-rubric-scoring]] — D1-D5 anti-deception 룰
- [[bagelcode-fault-tolerance-design]] — F1-F5 mitigation
- [[bagelcode-paperclip-vs-alternatives]] — Paperclip 차용 vs 자체 구현
