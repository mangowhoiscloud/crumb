---
title: Bagelcode — 신작팀 AI 개발자 과제 전형
type: project
category: project-hub
tags: [bagelcode, recruitment, multi-agent, task-2026-05]
sources:
  - "베이글코드 채용팀 메일 (2026-05-01)"
  - "https://career.bagelcode.com/ko/o/208045"
  - "https://www.bagelcode.com/article/bagelcode-x-ai-genie-..."
  - "https://www.bagelcode.com/article/ai-first-wiht-bagles-..."
created: 2026-05-01
updated: 2026-05-01
---

# Bagelcode — 신작팀 AI 개발자 과제 전형 (codename: **Crumb**)

> **2026-05-03 23:59 마감**. AI 코딩 에이전트로 멀티 에이전트 협업 도구를 만든다. 기한 내 1회 응시.
>
> 프로젝트 코드네임 **Crumb** = (1) 베이글 부스러기 (Bagelcode brand motif), (2) **breadcrumb pattern** (LLM agent 표준 path tracing), (3) transcript trail. → [[bagelcode-naming-crumb]]

## 한 줄

베이글코드 신작팀(모바일 캐주얼) AI 개발자 포지션의 과제 전형. 두 개 이상의 AI 에이전트가 통신하고 사용자가 개입/관찰할 수 있는 도구를 직접 설계·구현해서 코드 + `.md` + 세션 로그/녹화로 제출.

## 핵심 일정

| 항목 | 값 |
|---|---|
| 메일 수신 | 2026-05-01 |
| 마감 | **2026-05-03 23:59 KST** |
| 응시 기회 | 1회 (수정 불가) |
| 실 작업시간 | ~25-30시간 추정 |

## References (1차 근거)

- [[bagelcode-recruitment-task]] — 채용팀 메일 원문 + 평가 신호 추론
- [[bagelcode-job-posting-208045]] — 공고 stub (CSR 페이지 본문 미수집)
- [[bagelcode-davis-system]] — DAVIS 사내 데이터 비서 (멀티 에이전트 사례)
- [[bagelcode-ai-first-culture]] — AI-First 문화 / "에이전트를 위한 에이전트"
- [[bagelcode-tradingagents-paper]] — TradingAgents (arXiv 2412.20138) — communication protocol 학술 근거
- [[bagelcode-frontier-orchestration-2026]] — **2026-05 frontier 사료 11종** (Anthropic / Cognition / Magentic-One / AutoGen 0.4 / LangGraph / ALAS / ICML resilience / CP-WBFT / MAR / MAD survey / Claude Code SDK / Codex)
- [[bagelcode-caching-frontier-2026]] — **캐싱·효율 사료 12종 3-tier** (Anthropic/OpenAI/Gemini docs + APC + Hierarchical + KVCOMM + ACON + Anchored + cautionary)
- [[bagelcode-xml-frontier-2026]] — **XML in LLM 사료 10종** (Anthropic XML 권장 + Claude Code 내부 패턴 + arXiv 2509 grammar-constrained + arXiv 2510 TAG + format-restriction 경고). System prompt = XML / Wire = JSON / Codex = Markdown 정책.
- [[bagelcode-production-cases-2026]] — **2026 production cases 사료 12종** (Anthropic Trends + Lanham "What Survived" + Cursor Composer 2 + Devin/Windsurf 합병 + RAPS + gamestudio-subagents + Meta/Exa/Minimal cases + MIT 결정이론). 우리 결정 8가지 모두 검증.
- [[bagelcode-mobile-game-tech-2026]] — **LLM × 모바일 게임 사례 + 도구·스펙 사료 13종** (Lovable mobile 2026-04 / Phaser 94% LLM 첫시도 성공 / Unity AI 2026 / Godot 4.6 / WebGPU 광범위 / Coding Leaderboard May 2026). **결정: Phaser 3.80+ via CDN, single-file game.html.**
- [[bagelcode-stack-and-genre-2026]] — **베이글코드 stack 확정 사실 + 유사 장르 + 한국 경쟁사 사료 15종**. 신작팀 = **Unity** 명시. Royal Match (Unity, $1.44B / 2025) + 더블유게임즈/팍시 AI workflow ('1인 3주 출시'). **Crumb 의 위치 = Unity 의 *전 단계* prototype 도구.**
- [[bagelcode-gamestudio-subagents-2026]] — **gamestudio-subagents 단독 reference** (193 stars, 12 agent, prompt-only). Crumb host-harness 결정의 시장 검증 + Crumb 이 그 위에 올린 frontier 5축 (transcript / replay / cross-provider / mode 동적 / single-file).
- [[bagelcode-frontier-cli-convergence-2026]] ★ — **4 CLI convergence (2026-04) 1차 사료 8종**. Claude Code / Codex / Gemini / OpenCode 가 7 공통 primitive (subagents / plan / ask-user / parallel / sandbox / memory / MCP) 로 수렴. Crumb v3 Multi-host unified entry 의 frontier 합의 backbone.
- [[bagelcode-llm-judge-frontier-2026]] ★ — **LLM-as-judge frontier 6 사료**. CourtEval ACL 2025 (Grader/Critic/Defender/Re-grader) + G-Eval + Position bias IJCNLP 2025 + Self-bias NeurIPS 2024 + Multi-judge consensus 97-98% F1. Crumb v3 scoring 3 layer 의 학술 backbone.
- [[bagelcode-claude-codex-unity-2026]] — **Claude Code/Codex × Unity 사례 + 우리 결정 framing 강화 (14종)**. BigDevSoon Void Balls 10일 Steam-ready / Unity MCP 4종 (IvanMurzak 100+, Coplay 86, CoderGamester, Bluepuff71) / Bezi 10× faster / MDPI 2026 LLM Unity 한계. **결론: production-ready 수준 인지하면서 의도적 회피 + Crumb = Unity MCP 의 layer above.**
- [[bagelcode-observability-frontier-2026]] — **Frontier observability + 표준 사료 15종**. Anthropic Claude Managed Agents (2026-04-08, timeline + replay) / Google Vertex Unified Trace Viewer / Microsoft Agent Framework 1.0 / AgentOps OSS / **OpenTelemetry GenAI Semantic Conventions = 2026 de facto 표준**. 결정: Crumb transcript.jsonl alias 로 표준 호환 + 0 SaaS 비용.

## Concepts (spec 정돈)

- [[bagelcode-transcripts-schema]] — Agent transcripts 스키마 (JSONL append-only, kind 어휘, 사용자 1급 actor)
- [[bagelcode-caching-strategy]] — Anthropic ephemeral cache + sandwich 경계 + 토큰 예산
- [[bagelcode-rubric-scoring]] — 5차원 × 5점 + 토큰 효율 + Karpathy P4 anti-deception 룰
- [[bagelcode-orchestration-topology]] — **Hub-Ledger-Spoke** (PDCA 폐기 → hierarchical hybrid)
- [[bagelcode-fault-tolerance-design]] — F1-F5 실패 분류 × 복구 primitive (연결부/통신/에이전트)
- [[bagelcode-budget-guardrails]] — 검수 → 래칫 폭주 방지 3축 (횟수/time/cost) — 현재 5종 / 미구현 8종 / P0 4종 추천

## Synthesis (의사결정)

- [[bagelcode-team-profile]] — 신작팀 페르소나 + 평가 우선순위
- [[bagelcode-kiki-leverage]] — Kiki/AppMaker 에서 가져올 자산 매핑
- [[bagelcode-task-direction]] — 컨셉 + 기술 선택 + 스코프 IN-OUT
- [[bagelcode-paperclip-vs-alternatives]] — Paperclip vs Swarm/AutoGen/CrewAI/Agent Squad/자체 구현
- [[bagelcode-agents-fixed]] — **Claude Code + Codex 고정** + Cross-provider Verifier (Gemini 디폴트)
- [[bagelcode-naming-crumb]] — **프로젝트명 Crumb 확정** (Bagel motif + breadcrumb pattern + transcript trail = 3중 의미)
- [[bagelcode-frontier-rationale-5-claims]] — **4-actor 결정의 5 frontier 근거 + TradingAgents §4 정합 매핑** (claim 별 a/b/c/d 분해 + 학술 prior + 운영 layer)
- [[bagelcode-final-design-2026]] — ★ **최종 설계 종합** (Lead-Specialists + Socratic + CourtEval + 28 kind + envelope/handoff/state machine + OTel alias)
- [[bagelcode-system-architecture-v3]] ★★ — **canonical v3 시스템 구조 lock**. Multi-host 4 entry (Claude Code + Codex + Gemini + headless) + (harness × provider × model) 3-tuple actor binding + ambient fallback + 3-layer scoring + 자연어 helper 5종 + Kiki 패턴 차용 정적 대시보드. v2 [[bagelcode-system-architecture]] §1-§2 그림 대체.

## 핵심 가설

1. **베이글코드의 multi-agent 협업은 진행형 페인포인트** — 정답이 없으니 톤이 평가
2. **3일 prototype 사이클이 표준** (BagelJam:Dev 2일, TODOS 3일)
3. **사람·에이전트 양면 인터페이스** — CLI/MCP 우선, 화려한 UI 비우선
4. **인스트럭션 (.md) 이 코드만큼 자산** — 제출 요건에 명시
5. **Claude/Codex/Gemini "다 같이"** — 벤더 종속 회피 신호

## 권장 방향 (현재)

> ⚠️ **2026-05-02 갱신**: 아래는 v1-v2 중간 결정. **최종 lock 된 결정은 [[bagelcode-final-design-2026]]** — Verifier 는 외부 Gemini 가 아니라 **Engineering Lead 안의 CourtEval (Grader/Critic/Defender/Re-grader, ACL 2025)** 로 흡수됨. budget cap 은 [[bagelcode-budget-guardrails]] 참조.

**Hub-Ledger-Spoke 토폴로지** ([[bagelcode-orchestration-topology]]) + **Claude Code + Codex 고정** ([[bagelcode-agents-fixed]]) + **CourtEval verifier** ([[bagelcode-final-design-2026]]) + **F1-F5 fault tolerance** ([[bagelcode-fault-tolerance-design]]) + **3축 budget cap** ([[bagelcode-budget-guardrails]]).

PDCA pipeline 은 ICML 2025 §F (Resilience-Faulty-Agents) 결과 기반 폐기 — chain 토폴로지 = 10.5% 저하 + Cognition 의 context-fragmentation 경고와 충돌. Hierarchical 5.5% 로 회귀.

## 가져올 자산

[[bagelcode-kiki-leverage]] + 신규 frontier 차용:
- **Sandwich Identity** ([[kiki-appmaker-orchestration]]) → per-agent `.md`
- **Hub-Spoke Routing** ([[hub-spoke-pattern]]) → Orchestrator 토폴로지
- **Slack-style Intent + Pipeline Notifier** ([[kiki-slack-integration]]) → 사용자 개입/관찰
- **Circuit Breaker** ([[kiki-circuit-breaker]]) → adapter 별 health probe
- **Scorecard Guards** ([[kiki-scorecard-guards]]) → C14·C18 가드 차용
- **Magentic-One Task/Progress Ledger** → orchestrator state 객체
- **ALAS local compensation** → 환경 변화 시 부분 retry
- **ICML Challenger/Inspector** → cross-provider Verifier 의 거부권
- **Karpathy 5원칙** — README 평가 신호

## 결정 대기 중

> 최신 상태는 [[bagelcode-final-design-2026]] 와 `~/workspace/crumb/CHANGELOG.md` 참조. 아래 todos 의 `[x]` 는 2026-05-02 시점 갱신.

- [x] Verifier provider 최종 — **CourtEval (Engineering Lead 내부, Claude Sonnet 4.6)** 로 결정. Gemini 폐기 (cost)
- [ ] 시연 녹화 (1-3 min) — sprint 막바지 작업
- [x] 제출 GitHub public — `mangowhoiscloud/crumb` 레포 생성 완료 (commit `a82ec4c` 기준 main)
- [ ] [[bagelcode-job-posting-208045]] 본문 verbatim 확보 (선택; CSR 페이지)
- [x] 게임 도메인 — Phaser 3.80 single-file ≤60KB 로 lock

## Related

- [[kiki]] — Slack 행동 관측 + 멀티 에이전트 (원본 자산)
- [[kiki-appmaker]] — Install/lifecycle + sandwich identity (원본 자산)
- [[geode]] — Adaptive thinking, agentic loop, prompt system (참고 자산)
- [[mango]] — Project lead
- [[index]]
