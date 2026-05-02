---
title: 베이글코드 과제 — Verifier 격리 + 사용자 configurability 매트릭스 (13 사료 × 2 차원)
category: concepts
tags: [bagelcode, verifier, cross-provider, isolation, configurability, matrix, frontier, 2026]
sources:
  - "[[bagelcode-tradingagents-paper]]"
  - "[[bagelcode-frontier-orchestration-2026]]"
  - "[[bagelcode-production-cases-2026]]"
  - "[[bagelcode-agents-fixed]]"
  - "[[bagelcode-host-harness-decision]]"
summary: >-
  Verifier 격리 + cross-provider + 사용자 swap 가능성에 대한 frontier 사료 20종 × 4 차원 매트릭스.
  격리는 frontier consensus, cross-provider 는 학술 backbone, swap 은 벤더 자인 의무로 결론.
provenance:
  extracted: 0.70
  inferred: 0.25
  ambiguous: 0.05
created: 2026-05-02
updated: 2026-05-02
---

# Verifier 격리 + Configurability 매트릭스

> **목적.** "Verifier/QA 진영을 Builder 와 다른 provider 로 격리해야 하는가? + 사용자가 model/provider 를 swap 할 수 있어야 하는가?" 라는 sub-question 에 대해 frontier 사료 13종이 어떤 선택을 했는지 정리. [[bagelcode-host-harness-decision]] 의 "cross-provider opt-in (default X)" 결정의 backing.

---

## 매트릭스 — 13 사료 × 4 차원

| # | 사료 | Verifier/Judge **별도 actor** | Builder 와 **다른 provider** | **사용자 swap** | 근거 종류 / 한 줄 함의 |
|---|---|---|---|---|---|
| **1** | TradingAgents §4 (arXiv 2412.20138) | ✅ Risk Mgmt + Fund Manager 분리 | ❌ single provider 가정 | ✅ §4.3 "researchers can effortlessly replace the model with any locally hosted or API-accessible alternatives" | 학술 / 격리 ✅, swap 명시 정당화 |
| **2** | Anthropic multi-agent research (2025) | ⚠ orchestrator-worker, judge 별도 X (subagent fresh context 만) | ❌ Anthropic only | ✅ rainbow deployment | 운영 / fresh context 만 강조 |
| **3** | Cognition "Don't Build Multi-Agents" (2025-06) | ❌ "single thread context 우월" | — (반대 입장) | — | 정성 / 격리 회의적, 단 vendor lock-in 회피 일치 |
| **4** | Magentic-One (arXiv 2411.04468) | ⚠ Orchestrator + 4 specialist (Coder/WebSurfer 등), Verifier 명시 X | ❌ single LLM | ❌ AutoGen 위 | 학술 SOTA / Task/Progress ledger ✅, 격리 미적용 |
| **5** | AutoGen 0.4 (2024-10/2025) | ✅ actor model (각 actor 독립) | ✅ "다른 process / 다른 언어" 가능 | ✅ pluggable | 운영 / 격리 + cross-provider 모두 frontier 표준 |
| **6** | LangGraph (LangChain 2025) | ✅ **Reflection 패턴** (cyclic critique 노드 별도) | ✅ multi-provider 1급 지원 | ✅ TypedDict + Annotated state | 운영 / Reflection 노드 = 우리 Verifier 의 직접 매핑 |
| **7** | ICML 2025 §F Resilience (Faulty Agents) | ✅ **Challenger + Inspector** = 별도 검증 에이전트 | ❌ 명시 X (단 hierarchical 5.5%) | ❌ | 학술 실험 / **96.4% 회복** 의 핵심이 별도 격리 |
| **8** | CP-WBFT (arXiv 2511.10400) | ✅ Byzantine consensus = 다수 검증자 | ⚠ confidence probe weight (다양성 권장) | ❌ | 학술 / 85.7% fault rate 안정 = **다양성 자체가 견고성** |
| **9** | MAR (arXiv 2512.20845) | ✅ multi-agent self-critique | ⚠ 단일 reflexion = "**degeneration-of-thought**" → **다양한 critic 필요** | ❌ | 학술 / HumanEval 82.7%, same-model self-critique 부족 입증 |
| **10** | ICLR 2025 MAD Reality Check | ❌ debate 무지성 추가 = 토큰 낭비 | — | — | 학술 negative / Verifier 진짜 도움될 때만, default opt-in 권장 |
| **11** | Claude Code SDK (2025-09 rename) | ❌ depth=1 (재귀 spawn 금지) | ❌ Anthropic only | ⚠ model 수준 swap (`--model`) | 벤더 / depth=1 = sub-spawn 옵션 차단 (Task tool 1단까지만) |
| **12** | Codex Subagents | ✅ TOML per-agent 정의 + non-interactive | ⚠ OpenAI only (Codex 제품군) | ✅ TOML 한 줄로 swap | 벤더 / **TOML preset 패턴** 직접 차용처 |
| **13** | Lanham 2026-04 "Spark to Fire" (production-cases) | ✅ **거버넌스 계층** 별도 | ⚠ 권장 안 됨 + 단 multi-source verification | ✅ "start with single agent, escalate" | 운영 / 방어율 0.32 → 0.89, 격리 없으면 단일 거짓 시스템 오염 |
| **14** | Anthropic 2026-03 "wrong tradeoff" | — | — | ✅ "default 강제 = 잘못된 tradeoff" 자인 | 벤더 자인 / **사용자 노출 = 의무** |
| **15** | MIT 결정 이론 (Lanham 인용) | — | — | — | 학술 / 90.7% → 22.5%, stage 길이 경고 (외부 5 OK if acyclic short) |
| **16** | Paperclip Issue #3438 | ❌ 8-agent 계층 → 35% bloat | ❌ | — | 운영 사고 / **격리 늘릴수록 token 폭증** — 격리 cheap 해야 |
| **17** | obra/superpowers (Karpathy P4) | ✅ Reviewer phase 분리 + TDD Iron Law | ⚠ 명시 안 함 | ✅ 7-phase 사용자 customizable | 운영 (89K stars) / **Reviewer 격리 = 표준** |
| **18** | Cursor Composer 2 (2026-04) | ⚠ "coordination layer cheaply, calls stronger models when needed" | ✅ 모델 mix (cheap + strong) | ✅ user model picker | 벤더 / Haiku coord + Opus builder 우리 결정과 동형 |
| **19** | Cognition+Windsurf 합병 (2026) | ⚠ "multiple Devin instances in parallel" | ⚠ 운영 진화 (반대 입장 → parallel 채택) | ✅ instance 단위 | 운영 (40% commit) / 표면 입장 ≠ 실제 운영 |
| **20** | gamestudio-subagents (E1) | ✅ QA Agent 분리 (12-agent 중) | ❌ Claude only | ✅ agent 추가/제거 | 운영 (193 stars) / QA 별도 = game 도메인 표준 |

---

## 합계 패턴

```
                                  격리✅      cross-prov✅    user-swap✅
학술 (1, 4, 7-10, 15)              5/7         2/7 +권장2     2/7
운영/벤더 (2, 5-6, 11-14, 17-19)   7/9         6/9            9/9
                                  ─────       ─────          ─────
                                  12/16       8/16           11/16
```

---

## 결론 5개 (이 매트릭스가 말하는 것)

### C1. Verifier 격리 = frontier consensus

16개 중 12개 ✅. 반대는 Cognition 1개 (#3) 뿐 — 그조차 production 에서는 parallel instances 운영 (#19) 으로 진화. → **격리 자체는 고민할 필요 없음**.

### C2. Cross-provider = 학술적 backbone, 운영적 표준

직접 실험 데이터:
- **CP-WBFT (#8)**: 85.7% fault 안정
- **MAR (#9)**: degeneration-of-thought = same-model self-critique 부족 입증
- **ICML §F (#7)**: 96.4% 회복
- **Lanham (#13)**: 거버넌스 계층 시 0.32 → 0.89

→ 같은 provider self-critique 는 학술적으로 부족 입증.

### C3. 사용자 swap = 의무 (벤더 자인)

- **Anthropic 자체 (#14)**: "default 박는 게 wrong tradeoff" 인정
- **TradingAgents §4.3 (#1)**: 학술 정당화
- **AutoGen 0.4 (#5) / LangGraph (#6) / Codex TOML (#12) / Cursor (#18) / superpowers (#17)**: 운영 표준 5/5

→ default 모델 박지 말 것, 환경 변수 + config 노출 의무.

### C4. Default 는 신중

- **ICLR MAD Reality Check (#10)**: debate 무지성 추가는 손해
- → `enforce_cross_provider = false` (warn-only, opt-in flag)
- → preset 으로 사용자 선택 권장

### C5. 격리 비용 경고

- **Paperclip #3438 (#16)**: 격리는 cheap 해야
- → 외부 actor 추가 (subprocess 1개 추가) 까지가 한계
- → sub-spawn 깊이 늘리는 것 (depth ≥ 2) 은 token 폭증

---

## Crumb 적용 — 2-tier 결정

본 매트릭스 결론을 [[bagelcode-host-harness-decision]] 에 적용:

### Tier 1 — Default (격리만, cross-provider X)

```
host = Claude Code
  ├── Coordinator (host 자체)
  ├── Task tool: planner-lead     (subagent — 다른 sandwich, 다른 컨텍스트, 같은 provider)
  │     ├── Task tool: concept-designer
  │     ├── Task tool: researcher
  │     └── Task tool: visual-designer
  └── Task tool: engineering-lead (subagent)
        ├── Task tool: qa
        └── Task tool: verifier   (다른 sandwich = same-provider self-judge risk 만 완화)

→ 매트릭스 C1 격리는 충족, C2 cross-provider 는 미충족
→ 학술 견고성 약하지만 메일 "README 동작" absolute 충족
→ 평가자 1 인증 (claude login)
```

### Tier 2 — Opt-in (`--cross-provider` flag)

```
engineering-lead = subprocess spawn codex-local (외부 actor 추가)
verifier         = host Claude Code Task tool (다른 sandwich)

→ 구현 = Codex / 검증 = Claude (cross-assemble)
→ 매트릭스 C1 + C2 모두 충족 (격리 + cross-provider)
→ Lanham 0.32 → 0.89 거버넌스 계층 효과 시연 가능
→ 평가자 2 인증 (claude + codex login)
```

### Configurability (매트릭스 C3 충족)

```toml
# .crumb/config.toml
[verifier]
enforce_cross_provider = false  # default — warn-only
warn_on_same_provider = true    # transcript audit 에 표기
isolation = "subagent"          # host 안 Task tool / depth=1
mode = "courteval"

[presets.cross-provider]        # opt-in preset
engineering-lead = { adapter = "codex-local", model = "gpt-5.5" }
verifier         = { host = "claude-code", subagent = true }
```

ENV swap:
```
CRUMB_VERIFIER_ADAPTER=codex-local
CRUMB_VERIFIER_MODEL=gpt-5.5
CRUMB_CROSS_PROVIDER=1
```

---

## 차용한 reference 패턴

| Crumb 컴포넌트 | 차용 사료 | 차용 방식 |
|---|---|---|
| `[agents.verifier].adapter` 1줄 swap | Codex Subagents TOML (#12) + LangGraph TypedDict (#6) | TOML 한 줄로 adapter 교체 |
| Verifier 별도 subagent | ICML Challenger + Inspector (#7) + LangGraph Reflection (#6) | host 안 Task tool spawn (depth=1) |
| Cross-provider guard (warn) | CP-WBFT (#8) + MAR (#9) + Lanham (#13) | Builder model.provider_family ≠ Verifier model.provider_family |
| `enforce_cross_provider` 플래그 | Anthropic wrong tradeoff (#14) + TradingAgents §4.3 (#1) | default=false (warn) — 사용자 강화 가능 |
| preset (default / cross-provider) | Lanham escalation (#13) + Cursor user picker (#18) | 단일 → cross 점진 |
| ENV override `CRUMB_VERIFIER_ADAPTER` | superpowers customizable (#17) | shell 변수 swap |
| Adaptive stop (변동 < 1.0) | NeurIPS 2025 MAD judge + ICLR MAD Reality Check (#10) | debate 무한루프 차단 |
| degraded fallback (lint-only) | Lanham "Start with single agent" (#13) | 키 없는 평가자 보호 |
| depth=1 강제 | Claude Code SDK (#11) + Codex max_depth (#12) | Anthropic/OpenAI 자체 기본값 |

---

## 미래 확장 (P1+ 후속)

- [ ] `--strict-cross-provider` 모드 — 같은 provider 면 reject + lint-only fallback (학술 견고성 demo)
- [ ] Multi-Verifier ensemble (CP-WBFT 다수 weighted voting)
- [ ] Bayesian reputation per adapter ([[bagelcode-frontier-orchestration-2026]] §D1 RAPS)
- [ ] D6 차원 추가 ([[bagelcode-rubric-scoring]]) — Resilience (의도적 fault injection 회복률)

---

## See also

- ★ **[[bagelcode-system-architecture-v0.3.5]]** invariant #11 — 본 매트릭스의 C1 (격리 frontier consensus) 가 v0.3.5 에서 file-level enforcement (judge-input bundle) 로 격상
- ★ **[[bagelcode-verifier-context-isolation-2026-05-03]]** — bundle 결정 논리 (whitelist/blocklist + frontier evidence)
- [[bagelcode]] / [[bagelcode-host-harness-decision]] — 이 매트릭스가 backing 하는 결정
- [[bagelcode-agents-fixed]] — Verifier 격리 결정 (이 매트릭스로 default cross-provider 강제 → opt-in 으로 정정 필요)
- [[bagelcode-tradingagents-paper]] — 학술 1차
- [[bagelcode-frontier-orchestration-2026]] — 11 frontier 사료 (§F/§G/§I/§K/§L 직접 매핑)
- [[bagelcode-production-cases-2026]] — Lanham + Cursor + Cognition+Windsurf
- [[bagelcode-fault-tolerance-design]] — F5 (anti-deception + cross-provider Verifier)
- [[bagelcode-rubric-scoring]] — D6 Resilience 차원 후속 검토
- [[bagelcode-final-design-2026]] — canonical lock (§1 그림 정정 필요)
