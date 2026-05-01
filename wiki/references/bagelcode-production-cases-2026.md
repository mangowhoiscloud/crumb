---
title: 베이글코드 과제 — 2026 Production Multi-Agent Cases
category: references
tags: [bagelcode, production-cases, 2026, multi-agent, orchestration, case-study, frontier]
sources:
  - "Anthropic 2026 Agentic Coding Trends Report (resources.anthropic.com)"
  - "Micheal Lanham 'Multi-Agent in Production in 2026: What Actually Survived' (Medium, 2026-04)"
  - "Cursor 3 + Composer 2 release notes (2026-04)"
  - "Cognition + Windsurf merger reports (2025-12 ~ 2026-04)"
  - "arXiv 2602.08009 (RAPS, 2026-02)"
  - "gamestudio-subagents (GitHub, 2026)"
  - "NeurIPS 2025 'Multi-Agent Collaboration via Evolving Orchestration'"
  - "A2A Protocol (Linux Foundation 2025-06+)"
  - "Datadog State of AI Engineering 2026"
created: 2026-05-01
updated: 2026-05-01
---

# 2026 Production Multi-Agent Cases — 우리 결정 검증 + 보강

> **scope**: 2026 이후 자료만. 실 production 배포 사례 + 학술 frontier (NeurIPS 2025/2026, arXiv 2602+) 우선. 벤더·tech blog·산업 리포트 포함.
>
> 이 페이지는 [[bagelcode-frontier-orchestration-2026]] (research 패턴) 의 **sister**: 그쪽이 학술/연구, 이쪽이 **실 배포 사례 + 2026+ data**.

---

## Tier A — 산업 리포트 (벤더 1차)

### A1. Anthropic — 2026 Agentic Coding Trends Report

URL: https://resources.anthropic.com/2026-agentic-coding-trends-report

**8 trends** (보고서 mention):
- Shifting engineering roles
- Multi-agent coordination
- Human-AI collaboration patterns
- Scaling agentic coding beyond engineering teams

**Enterprise case studies (보고서 명시):**
- Rakuten · CRED · TELUS · Zapier

**Anthropic 의 production guidance (verbatim 인용 가능 부분):**
> "Budget for 15x tokens if you go multi-agent, as research-style orchestration burns roughly 15x the tokens of chat interactions"

**Claude Code production usage (2026):**
> "instances assigned specialised roles like architect, builder, and validator, collaborating via shared planning documents"

→ **우리 결정 검증**: Hub(Coordinator) + Builder.A + Verifier 가 정확히 architect/builder/validator 패턴. shared planning document = 우리 transcript.jsonl.

### A2. Datadog — State of AI Engineering 2026

URL: https://www.datadoghq.com/state-of-ai-engineering/

산업 telemetry 기반 trends. agent pattern adoption / framework usage / token cost 실 데이터. (페이지 fetch 깊이는 모자르지만 frontier indicator 로 사용.)

---

## Tier B — Production 분석 (analyst 1차)

### B1. Micheal Lanham — "Multi-Agent in Production in 2026: What Actually Survived" (2026-04)

URL: https://medium.com/@Micheal-Lanham/multi-agent-in-production-in-2026-what-actually-survived-f86de8bb1cd1

**가장 중요한 1개 article**. 2026 까지 살아남은 패턴 vs 죽은 패턴 정리.

#### 살아남은 패턴
| 패턴 | 조건 | 비고 |
|---|---|---|
| **Agent-flow** (순차) | 명확한 단계 경계 + 중간 산출물 | 우리 transcript = 중간 산출 영속 |
| **Orchestration** (중앙) | "**default public pattern**" | ✅ 우리 Hub-Ledger-Spoke 정확히 매치 |
| Bounded collaboration | phase gates + artifact 계약 + 최종 supervisor | 우리: Verifier = supervisor |

#### 사망한 패턴
| 패턴 | 평가 |
|---|---|
| **Open mesh collaboration** | "가장 낭만적이고 가장 내구성 떨어지는 default pattern. 프로덕션에서 거의 생존하지 못함" |

→ ✅ 우리는 [[bagelcode-orchestration-topology]] 에서 mesh (flat peer = 23.7% degradation) 명시 폐기. **2026 production 검증과 일치**.

#### 실 production 사례 (Lanham 정리)

| 조직 | 패턴 | 성과 |
|---|---|---|
| **Meta Ranking Engineer** | Flow | 6 모델 평균 정확도 **2× 증가** |
| **Meta tribal-knowledge** | Flow | **50+ agents, 도구 호출 -40%** |
| **Anthropic Research** | Orchestration | "single-agent Opus 4 대비 **+90.2%**" |
| **Exa deep research** | Orchestration | 15s-3min latency, 일일 수백 query |
| **Minimal (e-commerce)** | Orchestration | "80%+ 효율성, 90% 자동 처리" |
| **Shopify Sidekick** | **Anti-pattern** | 권고: "Avoid multi-agent architectures early" |

→ **베이글코드 신작팀 vs Shopify Sidekick**: 우리도 `--solo` 모드 default 시작, `--standard` / `--full` 점진 확장 = Shopify 교훈 정합.

#### 최소 권장 아키텍처 (Lanham, verbatim 요약)

> "**Start with a single strong agent.** Tool complexity alone can make one agent hard to reason about."

**단계적 확장 룰:**
1. 강한 단일 에이전트로 시작
2. 신뢰 가능한 단계 + 감사 가능한 중간 산출 → **Flow** 로
3. 너비 우선 분해 가능한 작업 → **Orchestration** 으로
4. 독립 증거 trajectory → **Collaboration** (드물게)

→ 우리 mode 변형 (`--solo` → `--standard` → `--full` → `--parallel`) 가 정확히 이 escalation 순서.

#### "From Spark to Fire" 캐스케이드 (Lanham 인용)

단일 거짓이 시스템 전체 오염. **방어 성공률 0.32 → 0.89** (거버넌스 계층 적용 시).

→ 우리 [[bagelcode-fault-tolerance-design]] §F5 anti-deception 룰 + cross-provider Verifier 가 거버넌스 계층 역할.

#### MIT 결정 이론 (Lanham 인용)

> "without new exogenous signals, any delegated acyclic network is **decision-theoretically dominated** by a centralized Bayes decision maker"

**실 데이터 (relay 단계 추가 시 GPT-4 정확도):**
```
1단계: 90.7%
2단계: 41.2%  ← -49.5%p
5단계: 22.5%  ← -68.2%p
```

→ **PDCA 5단계 폐기 결정의 가장 강력한 학술 근거**. relay 가 길수록 fragility 폭증. 우리 4 actor (Coord + Builder.A + Builder.B + Verifier) 로 최대한 짧게.

#### 토큰 / latency / 품질 데이터 (요약)

| 메트릭 | 수치 | source |
|---|---|---|
| 토큰 비용 | 15× chat | Anthropic |
| latency | 15s-3min | Exa |
| 정확도 저하 (단계당) | -2.8 ~ -8.5점 | MIT 의역 시 |
| 오류 증폭 | 17.2× (independent) vs 4.4× (centralized) | Google 2026 |
| 순차 계획 multi-agent 회귀 | -39 ~ -70% | Google 2026 |
| 거버넌스 계층 효과 | 0.32 → 0.89 | "meaningful safety overhead" 주의 |

---

## Tier C — Vendor / Tool 동향 (2025-12 ~ 2026-04)

### C1. Cursor 3 + Composer 2 (2026-04)

**핵심 발화:**
- Composer 2 = "purpose-built model optimized for **cost-efficient sub-agent work**"
- "**handles the coordination layer cheaply**, calling out to stronger models only when needed"
- 200+ tok/s, Agent Mode 가 20× scaled RL 로 multi-file editing
- Background Agents = 클라우드 repo clone, 자율 PR 오픈

→ ✅ **우리 Haiku Coordinator + Opus Builder 패턴과 정확히 같은 발상.** 2026-04 frontier 가 같은 방향 수렴 = 강한 검증.

### C2. Cognition + Windsurf 합병 (2025-12 → 2026)

- **2025-12**: Cognition AI 가 Windsurf $250M 인수
- 2026: Devin 의 autonomous task execution + Windsurf 의 interactive developer-in-the-loop **합쳐짐**
- Windsurf SWE-1.5 @ 950 tok/s on Cerebras
- "engineers manage **multiple Devin instances in parallel**", **40% of code commits**

→ ✅ **우리 Builder.A vs Builder.B parallel mode** 의 강한 근거. Cognition 자체가 "Don't build multi-agents" 입장에서 **production 에서는 parallel instances 운영**으로 진화. 표면 입장 ≠ 실제 운영. 우리는 처음부터 그 합리적 절충 채택.

### C3. OpenAI Codex 동향

- "subagents - currently surfaced in the Codex app and CLI"
- "Both CLIs support **non-interactive mode**, so you can script the handoff"
- 2026-03 quarter: thread handoff + subagent navigation 개선

→ 우리 Builder.B (Codex CLI) 채택 결정의 운영 근거.

---

## Tier D — 학술 (2026 이후)

### D1. RAPS — Reputation-Aware Publish-Subscribe (arXiv 2602.08009, 2026-02)

URL: https://arxiv.org/abs/2602.08009

**핵심:**
- 분산 publish-subscribe 프로토콜 (고정 토폴로지 → 의도 기반 동적)
- 두 overlay layer:
  1. **Reactive Subscription** — 의도 동적 정제
  2. **Bayesian Reputation** — 로컬 감시로 악의적 peer 탐지/격리
- 5 벤치마크 검증: 적응성 + 확장성 + 견고성

→ **우리 우회**: 우리는 4 actor 고정 + Hub 가 라우팅 권한 → publish-subscribe 까지 안 감. **인사이트만 차용**: Bayesian reputation 발상 = Verifier 의 weighted decision 에 적용 가능 ([[bagelcode-rubric-scoring]] D5 에 향후 확장).

### D2. NeurIPS 2025 — Multi-Agent Collaboration via Evolving Orchestration (arXiv 2505.19591)

URL: https://openreview.net/forum?id=L0xZPXT3le

**핵심:**
- "**Puppeteer-style** paradigm" — 중앙 orchestrator 가 dynamic 하게 agent 지휘
- RL 로 학습된 orchestrator 가 adaptively sequence + prioritize
- flexible collective reasoning

→ 우리 Hub 가 **rule-based** (heuristic schema). RL 학습은 과제 스코프 초과. 향후 P2 work 로만 인지.

### D3. NeurIPS 2025 — Improved MAC with Multi-Turn RL (MAGRPO)

LLM 협력을 cooperative MARL 문제로 모델링. 우리 과제 스코프 외, **인지만**.

### D4. arXiv 2601.13671 — The Orchestration of Multi-Agent Systems

URL: https://arxiv.org/html/2601.13671v1

Architecture · Protocols · Enterprise Adoption 종합 정리. 학술적 backbone.

---

## Tier E — 게임 도메인 정조준

### E1. gamestudio-subagents (GitHub, 193 stars, 2026)

URL: https://github.com/pamirtuna/gamestudio-subagents

베이글코드 도메인 (모바일 캐주얼) 에 **가장 가까운 multi-agent 게임 빌드 시스템**.

**12-agent team 구조:**

```
경영      Master Orchestrator + Producer
분석      Market Analyst + Data Scientist
설계      Sr Game Designer + Mid Game Designer
엔지니어  Mechanics Developer + Game Feel Developer
미술      Sr Game Artist + Technical Artist + UI/UX
QA        QA Agent
```

**3 mode (베이글코드 메일 의 "기획자→게임" 시나리오 직접 응답):**
- **Design Mode** — 시장 검증 + 설계 문서 + 미술 방향
- **Prototype Mode** — 핵심 메커닉 검증 + 플레이어 데이터
- **Full Development Mode** — 모든 agent + telemetry

**workflow (verbatim):**
```
사용자 입력
→ 마켓 분석 (경쟁 + 타겟 검증)
→ Go/No-Go 의사결정
→ 모드별 팀 구성
→ 병렬 개발 (설계→미술→엔지니어링→QA)
→ 데이터 수집 + 최적화 반복
```

**산출 예 (Match-3 puzzle, 베이글코드 fit):**
```bash
claude "Design a match-3 puzzle game with space theme"
```

→ `documentation/`, `source/`, `qa/`, `project-config.json` 자동 생성.

→ **우리 Crumb 의 simplified 변형**. 12 → 4 actor 로 축소. 우리는 Master Orchestrator + Mechanics Developer + UI/UX (Codex) + QA (Gemini Vision) 만 활성. 베이글코드 메일 verbatim 정조준.

→ **차용 X**: 같은 개념을 우리 sandwich 패턴 + cross-provider Verifier 위에 다시 깎음. 12-agent 풀세트는 [[bagelcode-kiki-leverage]] §"가져오지 말 것" 과 일치.

### E2. Unity Muse / Buildbox 4 / Layer / Ludo.ai (2026 cluster)

| Tool | 차별점 |
|---|---|
| Unity Muse | 자연어 → 캐주얼 게임 generation (game code + assets + animation + NPC AI) |
| Buildbox 4 | 노코드 모바일 캐주얼 우선, text-to-game |
| Layer | 게임 스튜디오 향 통합 generative platform |
| Ludo.ai | 게임 research / design 어시스턴트, "10x productivity" |

→ 우리는 **개별 tool 가 아니라 멀티 에이전트 협업 인프라**. 직접 경쟁 X, 차용 X. 베이글코드 신작팀이 이런 tool 들과 연결될 수 있는 **infrastructure 레이어** 가 우리 위치.

---

## Tier F — Agent Protocol 표준 (2026)

### F1. A2A (Agent-to-Agent) Protocol

- 2025-04 Google 발표
- 2025-06 Linux Foundation 기증
- 2026-01-15 LangGraph v0.2 first-class A2A + MCP target
- 2025-07 AgentMaster = 첫 production A2A+MCP 사용

**아키텍처 distinction:**
- **MCP** = vertical (agent-to-tool), client-server
- **A2A** = horizontal (agent-to-agent), peer-to-peer

→ 우리 wire format = JSONL (A2A 와 정합). MCP 는 도구 호출 시 자연 사용. 명시적 A2A 채택은 과제 스코프 초과 — 인지만.

### F2. 운영 보안 우려 (verbatim)

> "the agent protocol stack is being deployed into production faster than the security model can keep up"

→ 우리는 demo / 평가 환경이라 직접 영향 없음. 그러나 README "Limitations" 섹션에 1줄 언급 가치.

---

## 종합 — 우리 결정 검증/강화 8가지

| 우리 결정 | 2026 검증 |
|---|---|
| Hub-Ledger-Spoke (Hierarchical) | ✅ Lanham "Orchestration is winner", Anthropic shared docs |
| PDCA chain 폐기 | ✅✅ MIT 결정 이론 (5단계 → -68%p), Google 2026 (-39~70% 회귀) |
| flat mesh 폐기 | ✅✅ Lanham "open mesh = 죽음" |
| Haiku Coordinator + Opus Builder | ✅ Cursor Composer 2 정확히 같은 발상 |
| Builder.A + Builder.B 병렬 옵션 | ✅ Cognition Devin "multiple instances in parallel" |
| Cross-provider Verifier | ✅ "From Spark to Fire" 거버넌스 계층 |
| `--solo` mode 시작 → 점진 확장 | ✅ Lanham + Shopify Sidekick "avoid early" |
| 4 actor 짧은 chain | ✅ MIT 결정이론 (relay 짧을수록 강건) |

→ **모든 결정이 2026 frontier 와 정합**. PDCA 폐기 결정이 가장 강하게 검증됨.

## 우리가 추가로 고려할 4가지 (이 페이지 영향)

1. **D6 Resilience 차원 [[bagelcode-rubric-scoring]] 에 추가 결정** — Lanham "방어 성공률 0.32→0.89" 같은 cascade 시연 데이터 가능
2. **README "Limitations" 섹션** — A2A protocol 보안 1줄 + multi-agent 15× 토큰 정직한 인정
3. **`--parallel-builders` mode 의 demo 명시** — Cognition 의 "40% commits in parallel" 이 production 검증
4. **MIT 결정이론 인용** — 우리 README 의 "왜 4 actor 인가" 정당화에 사용 가능 (verbatim 1줄)

## 1차 사료 (12 links)

### 산업 리포트
- [Anthropic 2026 Agentic Coding Trends Report](https://resources.anthropic.com/2026-agentic-coding-trends-report)
- [Datadog State of AI Engineering 2026](https://www.datadoghq.com/state-of-ai-engineering/)

### 분석 / 종합
- [Lanham — Multi-Agent in Production in 2026 (2026-04)](https://medium.com/@Micheal-Lanham/multi-agent-in-production-in-2026-what-actually-survived-f86de8bb1cd1)
- [AI Agents in Production 2026 (47billion)](https://47billion.com/blog/ai-agents-in-production-frameworks-protocols-and-what-actually-works-in-2026/)

### Vendor 동향
- [Cursor vs Windsurf vs Claude Code 2026 (DEV)](https://dev.to/pockit_tools/cursor-vs-windsurf-vs-claude-code-in-2026-the-honest-comparison-after-using-all-three-3gof)
- [Windsurf vs Cursor vs Claude Code (How Do I Use AI, 2026-04)](https://www.howdoiuseai.com/blog/2026-04-16-windsurf-vs-cursor-vs-claude-code)
- [Codex Subagents](https://developers.openai.com/codex/subagents)

### 학술 (2026 이후)
- [RAPS — arXiv 2602.08009 (2026-02)](https://arxiv.org/abs/2602.08009)
- [Multi-Agent Collaboration via Evolving Orchestration — NeurIPS 2025](https://openreview.net/forum?id=L0xZPXT3le)
- [Orchestration of MAS — arXiv 2601.13671](https://arxiv.org/html/2601.13671v1)
- [Awesome AI Agent Papers 2026 (curated)](https://github.com/VoltAgent/awesome-ai-agent-papers)

### 게임 도메인
- [gamestudio-subagents (GitHub, 12-agent)](https://github.com/pamirtuna/gamestudio-subagents)
- [AI Agents for Game Development 2026 (index.dev)](https://www.index.dev/blog/ai-agents-for-game-development)
- [The Role of AI in Game Development 2026 (Q99)](https://www.q99studio.com/ai-game-development-2026/)

### Protocol 표준
- [A2A Protocol spec](https://a2a-protocol.org/latest/)
- [MCP vs A2A 2026 Guide (DEV)](https://dev.to/pockit_tools/mcp-vs-a2a-the-complete-guide-to-ai-agent-protocols-in-2026-30li)

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-frontier-orchestration-2026]] — sister page (research patterns)
- [[bagelcode-orchestration-topology]] — Hub-Ledger-Spoke 결정
- [[bagelcode-fault-tolerance-design]] — F1-F5 mitigation
- [[bagelcode-rubric-scoring]] — D6 Resilience 추가 검토 근거
- [[bagelcode-agents-fixed]] — Coordinator·Builder·Verifier 선정 검증
- [[bagelcode-tradingagents-paper]] — 학술 1차 근거 (sister)
- [[bagelcode-paperclip-vs-alternatives]] — framework 비채택 (Lanham "simplest solution" 일관)
