---
title: Pre-verifier scoring? No — qa_check IS the ratchet
date: 2026-05-03
session: 01KQNEYQT53P5JFGD0944NBZ9D
status: synthesis
related:
  - bagelcode-scoring-ratchet-frontier-2026-05-02.md
  - bagelcode-frontier-orchestration-2026.md
  - bagelcode-llm-judge-frontier-2026.md
tags: [scoring, ratchet, verifier, qa-check, frontier-2026]
---

# Pre-verifier scoring? No — `qa_check` IS the ratchet

> Bagelcode hiring panel will likely ask: *"Crumb 의 verifier (CourtEval) 가 산출물의 마지막 단계에서 한 번만 호출된다. planner spec 이나 builder intermediate output 에는 왜 LLM scoring 이 없냐?"* — 이 페이지는 그 답이다. **현 패턴은 누락이 아니라 frontier 정합.** 이유는 `qa_check` effect 가 이미 builder 직후 deterministic ratchet 역할을 하고 있고, LLM judge 를 그 위에 추가하면 2025-26 frontier 가 일관되게 후퇴 중인 anti-pattern (PRM saturation, Self-Refine drift, multi-agent debate over-orchestration) 으로 회귀하기 때문.

## 결론 (TL;DR)

| 단계 | 평가 메커니즘 | 종류 | Frontier 정합 |
|---|---|---|---|
| **planner-lead → spec.md** | (없음 — schema 검증만, 추후 reducer-auto) | deterministic | ✓ |
| **researcher → step.research** | evidence_refs 자동 검증 (anti-deception Rule 5) | deterministic | ✓ |
| **builder → artifacts/game/** | **`qa_check` effect — htmlhint + Playwright + AC predicates** | deterministic | ✓ |
| **verifier → judge.score** | **CourtEval (Grader→Critic→Defender→Re-grader)** | LLM, **1회만** | ✓ |
| **validator** | `validator/anti-deception.ts` 내부 Rules 1-7 | deterministic | ✓ |

`qa_check` 가 사실상 "build 직후 pre-verifier ratchet" 역할을 하고 있다. **즉 Crumb 는 step-level scoring 이 없는 것이 아니라, LLM scoring 이 없을 뿐**. 그 자리에 deterministic exec gate (Anthropic 의 Claude Code, OpenHands, Aider, Cursor 가 모두 수렴한 패턴) 가 들어가 있다.

## Frontier 근거 5선

### 1. DeepSeek-R1 (Jan 2025) — PRM 폐기 → rule-based reward 회귀

DeepSeek 팀은 R1 학습 중 *Process Reward Model* (PRM, 즉 step-level LLM scoring) 을 시도했다가 reward saturation + game-the-judge 문제로 **rule-based reward (exec exit code, format check)** 로 회귀. 우리 적용: builder 중간에 LLM micro-judge 두면 같은 함정. `wiki/synthesis/bagelcode-scoring-ratchet-frontier-2026-05-02.md` §4 / §5 #1.

### 2. Cognition AI "Don't Build Multi-Agents" (June 2025) + Eisenstein DeepMind 2024

Cognition 의 Devin 팀은 multi-agent orchestration 을 줄이고 single-agent 로 회귀. Eisenstein 2024 는 Goodhart-on-LLM-judge 를 입증 — **judge round 4+ 에서 judge score 만 오르고 실제 quality 는 plateau**. 우리 적용: planner spec 에 별도 LLM judge 두면 over-orchestration. `wiki/references/bagelcode-frontier-orchestration-2026.md` §B.

### 3. CourtEval (Roy et al., ACL 2025) — "산출물 1건당 1회 적용" 가정

CourtEval paper 자체가 4-role (Grader/Critic/Defender/Re-grader) 을 **최종 NLG 산출물 meta-eval 용도**로 정의함. step-level 권고 없음. Crumb 가 verifier 1회만 호출하는 게 paper intent 와 일치. `wiki/references/bagelcode-llm-judge-frontier-2026.md` R1.

### 4. Huang et al. ICLR 2024 / Stechly NeurIPS 2024 — LLM 은 외부 verifier 없이 self-correct 불가

LLM 의 self-critique 는 외부 신호 없으면 noise. builder 중간에 LLM micro-judge 두는 건 정확히 "외부 신호 없는 self-critique" 패턴. Crumb 의 `qa_check` 는 외부 deterministic 신호 (htmlhint exit code, Playwright canvas 렌더 검출) — 의미 있음. `wiki/synthesis/bagelcode-scoring-ratchet-frontier-2026-05-02.md` §8.

### 5. SWE-Bench Verified 2025 top-10 / OpenHands / Aider / Cursor / Claude Code

산업 SWE-style top-10 시스템은 모두 **outcome-level gate 1회 (test pass / exit code)**. step-level LLM scoring 없음. Crumb 와 동형. `wiki/synthesis/bagelcode-scoring-ratchet-frontier-2026-05-02.md` §4 + ArtifactsBench (arXiv 2507.04952) per `wiki/findings/bagelcode-frontier-evidence-vs-llm-reasoning-2026-05-03.md`.

## 우리가 *하지 않은* 것 (그리고 왜 안 했나)

### (a) planner spec 에 LLM scoring — REJECT

spec 은 deterministic 항목 (AC predicates, envelope 필드, video evidence schema) 만 가짐. **schema 검증으로 충분**. LLM judge 추가 = 근거 #1, #2 함정.

### (b) build 직후 마이크로 LLM judge — REJECT

`qa_check` 가 이미 그 자리. 추가 LLM judge 는 #4 (외부 신호 없음 = noise) + 1h budget 에서 latency·cost 두 배. CourtEval 1회 = +500-800ms (`wiki/references/bagelcode-llm-judge-frontier-2026.md` R7) × N round 발생.

## 우리가 *한* 것 — qa_check 가 곧 pre-verifier ratchet

`src/effects/qa-check.ts` 가 build 직후 자동으로:

1. **htmlhint** (DOCTYPE / viewport / Phaser CDN script tag)
2. **bundle 크기 + 파일 수** (multi-file envelope check, telemetry only since v0.4.0)
3. **Playwright headless smoke** (canvas 렌더 + first interaction)
4. **AC predicates** (per-AC deterministic predicate runner, `qa-interactive.ts`)
5. **PWA offline boot** (sw.js + setOffline + reload)

→ `kind=qa.result` (deterministic=true, source-of-truth for D2/D6).

**verifier 는 이 결과를 D2/D6 lookup 으로만 쓰고 LLM 으로 "재평가" 하지 않음** — anti-deception Rule 1 이 verdict=PASS but `qa.result.exec_exit_code != 0` 인 경우를 강제로 D2=0 으로 sanitize. 즉 LLM 이 deterministic ratchet 을 우회할 수 없게 코드로 firewall.

## 못 찾은 것 (한계)

- **Lightman 2024 PRM800K / Cobbe 2023 ORM** 원논문 verbatim 인용 없음 — DeepSeek-R1 의 transitive 인용으로만 확보.
- **TradingAgents 의 step-level scoring** 명시적 부재 / 존재 여부는 `wiki/references/bagelcode-tradingagents-paper.md` §4.2 에서 portfolio return 만 scoring framework 라는 점에서 추론.
- **AutoGen v0.4 / LangGraph supervisor / CrewAI hierarchical** 의 step-level scoring 패턴 — AutoGen v0.4 와 LangGraph 0.3 은 deterministic gate 권장 확보, CrewAI 는 본 조사에서 fetch 안 함.

## 평가자 질문 대응 cheat sheet

> Q: "왜 spec 에 LLM scoring 이 없냐?"
> A: schema 검증으로 충분 + DeepSeek-R1 Jan 2025 의 PRM 폐기 사례.

> Q: "왜 builder intermediate 에 평가가 없냐?"
> A: 있음 — `qa_check` effect (deterministic). LLM judge 가 아닌 게 의도적. Huang ICLR 2024 / Stechly NeurIPS 2024 (외부 신호 없는 self-critique = noise).

> Q: "verifier 한 번만 도는데 충분한가?"
> A: CourtEval (ACL 2025) 자체가 산출물 1건당 1회 적용 가정. round 4+ 에서 judge saturation (Eisenstein DeepMind 2024).

> Q: "그럼 build 가 망가졌을 때 어떻게 알아채나?"
> A: `qa_check` 가 즉시 잡음 — exec_exit_code=1 이면 verifier 의 judge.score 가 verdict=FAIL 로 강제 (anti-deception Rule 1). 추가로 builder circuit_breaker 가 3회 연속 실패 시 builder-fallback 으로 swap.
