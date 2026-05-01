---
title: 베이글코드 과제 — 에이전트 고정 결정 (Claude Code + Codex) + Cross-provider Verifier
category: synthesis
tags: [bagelcode, agents, decision, claude-code, codex, gemini, glm, cross-provider, verifier]
sources:
  - "[[bagelcode-orchestration-topology]]"
  - "[[bagelcode-fault-tolerance-design]]"
  - "[[bagelcode-frontier-orchestration-2026]]"
created: 2026-05-01
updated: 2026-05-01
---

# 에이전트 고정 + Cross-provider Verifier

> **사용자 결정 (확정)**: 사용 에이전트는 **Claude Code + Codex** 2종으로 고정. 검증은 **다른 provider 군** 으로 잡는다. 이 페이지는 그 결정을 둘러싼 구체화 + Verifier provider 비교.

## 선정 방법 (6-step decision tree)

평가자에게 "왜 이 모델 조합?" 에 대한 systematic 답. README 또는 `docs/agent-selection.md` 에 그대로 박을 수치.

### Step 1 — Eligibility filter

| 조건 | 통과 조건 | 컷 후보 |
|---|---|---|
| Headless / non-interactive | CI/CD 동작 가능 | (모두 통과) |
| 공식 / maintained SDK | 1순위 vendor or maintained CLI | AutoGen 0.4 (유지보수 모드) |
| README 즉시 동작 | 평가자 5분 내 실행 | Local 70B Llama (다운로드 부담 → fallback only) |
| License | MIT / Apache / 사용 OK | (모두 통과) |
| 베이글코드 메일 명시 | "Claude Code, Codex, Gemini CLI 등" | "등" 이라 의무 X, **가산점** |

### Step 2 — Role-fit scoring (5축 × 10점)

각 역할에 필요한 capability 가 다름:

| 축 | 가중 |
|---|---|
| Reasoning depth | 높음 (Planner/Verifier) / 낮음 (Coordinator) |
| Code synthesis | 높음 (Builder) |
| Latency | 높음 (Coordinator routing) |
| Cost | 항상 |
| Vision | 옵션 (Verifier game.html 검증) |

**채점 결과:**

| 후보 | Coordinator | Builder | Verifier |
|---|---|---|---|
| Claude Haiku 4.5 | **9** (빠름·쌈) | 5 | 6 |
| Claude Sonnet 4.6 | 7 | 8 | 9 (단, cross-provider X) |
| Claude Opus 4.7 | 4 (오버킬) | **9** (코드 SOTA) | 8 |
| GPT-5.5 (Codex) | 6 | **9** (Codex tooling) | 7 |
| o3 (OpenAI) | 3 (느림·비쌈) | 8 | 8 |
| Gemini 2.5 Pro | 5 | 7 | **9** (vision + cross) |
| Gemini 2.5 Flash | 8 | 6 | 7 |
| GLM-4.6 | 7 | 6 | 7 |

→ 컬럼별 max 가 1차 후보. tiebreak 은 다른 step.

### Step 3 — Cost ceiling

[[bagelcode-caching-strategy]] 의 1세션 ≤ $1.5 역산:

```
Coordinator (10 calls × 4K in / 0.5K out)  ≈ Haiku    $0.04
Builder.A   (2 calls × 8K in / 2K out)     ≈ Opus 4.7  $0.40
Builder.B   (1 call fallback)              ≈ Codex     $0.08
Verifier    (3 calls × 6K / 1K)            ≈ Gemini Pro $0.10
                                          ───────────
                                          Total ≈ $0.55-0.65
```

여유 ~40% — `--parallel-builders` 까지 OK.
**컷:** o3 단독 사용 시 $1.20+ → 비싼 자리 못 줌.

### Step 4 — Provider diversity (강제)

[[bagelcode-fault-tolerance-design]] §F1: **최소 2개 다른 provider 군이 Builder 역할 수행 가능해야 함.**

→ Anthropic + OpenAI 조합이 유일하게 "두 코드 SOTA + 다른 군" 매치.

### Step 5 — Capability redundancy

Builder.A 죽었을 때 Builder.B 가 같은 spec 받아 같은 역할 수행 가능?

| 조합 | 가능 |
|---|---|
| Claude Code (Opus 4.7) + Codex (GPT-5.5) | ✅ |
| Claude Code + Gemini Pro | ⚠ Gemini 코드/tool use 약함 |
| Codex + Cursor CLI | ⚠ 같은 OpenAI 군 (diversity 깨짐) |
| Claude Code + Aider | ⚠ Aider 의 어느 LLM? 명확 X |

### Step 6 — Verifier 격리 (cross-provider 강제)

**규칙: Verifier 는 Anthropic·OpenAI 가 아닌 군에서.** 근거: ICML 2025 §F (Resilience) + CP-WBFT (Byzantine FT) + MAR (degeneration-of-thought).

→ Default = Gemini 2.5 Pro / fallback = lint-only local.

### 최종 결정

| 역할 | 모델 | Provider | 가장 큰 이유 |
|---|---|---|---|
| **Coordinator** | Claude Haiku 4.5 | Anthropic | routing 9/10, 10× 쌈 |
| **Builder.A (primary)** | Claude Code w/ Opus 4.7 | Anthropic | code 9/10, headless, depth=1 |
| **Builder.B (fallback)** | Codex CLI w/ GPT-5.5 | OpenAI | code 9/10, **다른 군** |
| **Verifier** | Gemini 2.5 Pro | Google | reasoning 9/10, vision, **cross-provider** |
| Verifier fallback | lint-only local | (none) | 키 없는 평가자 보호 |

### Mode 변형 (사용자 자유 노출)

| Mode | 활성 actor | 예상 비용 | 용도 |
|---|---|---|---|
| `--solo` | Coord + Builder.A | ~$0.30 | Anthropic 키만 (최소) |
| `--standard` (default) | Coord + Builder.A + Verifier | ~$0.50 | Anthropic + Google |
| `--full` | + Builder.B | ~$0.65 | 모든 키, fault demo 가능 |
| `--parallel` | full + parallel builders | ~$1.10 | stretch demo |

→ README 첫 절은 `--solo` 기준 (최소 셋업). full 은 advanced.

### ENV 강제 변경 가능

```bash
CRUMB_MODEL_COORD=claude-haiku-4-5
CRUMB_MODEL_BUILDER_A=claude-opus-4-7
CRUMB_MODEL_BUILDER_B=gpt-5.5
CRUMB_MODEL_VERIFIER=gemini-2.5-pro
CRUMB_VERIFIER_VISION=true
```

→ 환경 변수만으로 표 전부 교체 가능. README 마지막 "Advanced configuration" 1쪽.



## 고정 사실

| 역할 | 에이전트 | Provider | 모델 (default) | 비고 |
|---|---|---|---|---|
| Builder.A | **Claude Code** | Anthropic | `claude-opus-4-7` (또는 `sonnet-4-6`) | Agent SDK headless mode |
| Builder.B | **Codex** | OpenAI | `gpt-5.5` (또는 `o1`) | Codex CLI subagent + TOML config |
| Verifier | **cross-provider** | (Google / Z.ai / local) | 결정 대기 (§ 후보 비교) | Anthropic·OpenAI 와 다른 군 |
| Orchestrator | (Builder.A 의 Claude Code 가 동시 수행) | Anthropic | `claude-haiku-4-5` | sandwich §1+§4 만으로 라우팅 |

→ **Orchestrator 와 Builder.A 가 같은 Claude Code 인스턴스에서 다른 sandwich 로 동작**. 토큰 절감 + Cognition 의 "단일 컨텍스트" 원칙과 정합.

## 왜 Claude Code + Codex 인가 (사용자 결정 보강)

### Claude Code 강점
- **headless mode 안정** ([[bagelcode-frontier-orchestration-2026]] §K) — README CI/CD 동작 보장
- **Agent SDK depth=1** 제약이 우리 hierarchical 토폴로지와 정확히 일치 (재귀 spawn 금지 = 의도적)
- **베이글코드 메일 1순위 인용** ("Claude Code, Codex, Gemini CLI" 명시 순서)
- prompt cache (sandwich §1+§2 boundary, [[bagelcode-caching-strategy]])

### Codex 강점
- **TOML agent 정의** ([[bagelcode-frontier-orchestration-2026]] §L) — 우리 `agents/builder-b.md` 와 자연 매핑
- **CSV 배치 (`spawn_agents_on_csv`)** — stretch 옵션으로 batch 시나리오
- **non-interactive mode** — README 동작
- max_threads / max_depth 제어 가능
- **다른 provider 의존** = 한쪽 장애 시 fallback 보장

### "굳이 둘 다?" 정당화
- ICML 2025 §F: hierarchical + cross-provider = 95%+ 회복 (single provider 인 경우 회복률 ↓)
- 베이글코드 멀티 벤더 톤 직접 응답
- F1 (adapter 장애) 시나리오 시연 가능 — claude-code 죽이고 codex 로 fallback 되는 demo

## Verifier provider 후보 (cross-provider 군)

Anthropic 도 OpenAI 도 아닌 군에서 1개 선택:

### 후보 V1 — **Google Gemini 2.5 Pro** (기본 권장)

| 항목 | 평가 |
|---|---|
| API 안정성 | ✅ Google AI Studio + Vertex AI |
| Vision | ✅ (game.html 스크린샷 검증 가능) |
| Korean | ✅ 우수 |
| 가격 (input) | $1.25/1M (Pro), $0.075/1M (Flash) |
| Context cache | ⚠ min 4K — sandwich 작으면 미적용 |
| SDK | `@google/genai` (TS), `google-genai` (Python) |
| 베이글코드 메일 명시 | ✅ "Gemini CLI" 언급 |
| 셋업 부담 | ⚠ API 키 필요 |

→ **Verifier 1순위**: Vision 가능 + 메일 명시 정합.

### 후보 V2 — **Z.ai GLM-4.6** (저비용 옵션)

| 항목 | 평가 |
|---|---|
| API | OpenAI 호환 endpoint |
| Vision | ⚠ GLM-4V 별도 |
| Korean | ✅ |
| 가격 | input ~$0.6/1M (Pro 대비 50%) |
| Cache | OpenAI 호환 자동 |
| 셋업 | 키 발급 빠름, GFW 환경 주의 |
| 베이글코드 메일 | ❌ 미언급 |

→ **stretch 옵션** — `--verifier=glm` 플래그로 demo 시 비용 비교.

### 후보 V3 — **Local Llama 3.3 70B (Ollama)**

| 항목 | 평가 |
|---|---|
| API | localhost:11434 |
| Vision | ❌ |
| 가격 | $0 (로컬 GPU 필요) |
| Latency | ✅ 0 네트워크 |
| 셋업 | ❌ 평가자가 70B 모델 다운로드 부담 |
| README 동작 | ❌ 평가자에게 무리 |

→ **권장 X** — 평가자 환경에서 동작 보장 안 됨. degraded fallback 모드로만 (lint-only).

### 후보 V4 — **OpenRouter** (router 자체)

| 항목 | 평가 |
|---|---|
| API | OpenAI 호환 + 100+ 모델 통합 |
| 장점 | Verifier provider 동적 선택 가능 |
| 단점 | "다른 provider 군" 의미 약화 (라우터일 뿐) |

→ **stretch** — `--verifier-via=openrouter` 로 demo 시 자유도 강조.

## 결정 — Verifier 디폴트 = **Gemini 2.5 Pro**, fallback = **lint-only local**

```
Default chain:
  Verifier:  Gemini 2.5 Pro  (cloud, vision)
       ↓ (api fail)
  Verifier:  static lint-only mode  (in-process, no network)
       ↓
  PARTIAL verdict + transcript 표기
```

→ Gemini 키 없는 평가자도 README 동작 (lint-only 로 degraded).

## Adapter 구조 (`src/adapters/*`)

```typescript
// 공통 인터페이스
interface AgentAdapter {
  id: string                       // "claude-code" | "codex" | "gemini"
  capabilities: Capabilities       // {vision, json_mode, max_context, ...}
  
  ping(): Promise<HealthStatus>    // F2 capability probe
  call(req: AdapterRequest): Promise<AdapterResponse>
  
  // F1 circuit breaker hooks
  onSuccess(): void
  onFailure(err: Error): void
}

// 각 구현
class ClaudeCodeAdapter implements AgentAdapter { /* Agent SDK */ }
class CodexAdapter implements AgentAdapter { /* CLI subprocess + TOML */ }
class GeminiAdapter implements AgentAdapter { /* @google/genai */ }
class LintOnlyAdapter implements AgentAdapter { /* fallback, no network */ }
```

→ 각 adapter 가 [[bagelcode-fault-tolerance-design]] §F1-F2 의 health probe + circuit breaker 구현.

## Sandwich 매핑

[[kiki-appmaker-orchestration]] 4-section sandwich 가 actor 별로:

```
§1 contract   = "너는 누구이고 누구한테 PATCH 한다"
§2 stage tmpl = role 본문
§3 tool/skill = 사용 가능 도구 정의
§4 enforcement= routing 금지 + STOP

actor 별 §2 본문:
  - Orchestrator    → "ledger update + next_speaker 선정 + STOP"
  - Builder.A (CC)  → "spec → code, artifacts/ 에 쓰고 STOP"
  - Builder.B (Codex)→ Builder.A 와 동일 contract, 다른 모델
  - Verifier (Gemini)→ "build artifact 검증, exec 실행, dimensions 채점, STOP"
```

→ **Builder.A 와 Builder.B 의 §2 가 같음** = 사용자 입장에서 보면 같은 역할의 두 provider. fallback 의 의미.

## 인증·환경 변수

```bash
# .env (sample)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...

# Optional fallback
GLM_API_KEY=...                  # Z.ai
CRUMB_VERIFIER=gemini       # gemini|glm|lint-only
CRUMB_PARALLEL_BUILDERS=0   # 1 = both run in parallel
CRUMB_MODEL_CLAUDE=claude-opus-4-7
CRUMB_MODEL_CODEX=gpt-5.5
CRUMB_MODEL_VERIFIER=gemini-2.5-pro
```

→ 모든 변수 optional (디폴트 있음). 키 없으면 그 adapter 자동 disabled + alternative 로 routing.

## 마감 안 위험 시나리오

| 시나리오 | 대응 |
|---|---|
| 평가자가 Codex 키 없음 | `--solo` 모드 자동 — Builder.A 만으로 동작, demo 영상은 fallback 전환 시연 |
| Gemini API 미가입 | lint-only mode 로 degraded, transcript 에 표기, README 에 "Gemini 키 옵션" 명시 |
| Claude Code 1.x → 2.x 마이너 업 | capability probe 가 model list 자동 재선택 |
| 전체 네트워크 끊김 | 모든 adapter circuit OPEN → user escalation, 마지막 transcript 보존 |

## 측정 (제출 README 박는 수치)

`--demo-fault-injection` 플래그 시 의도적 fault 시연:

```
$ crumb demo --demo-fault-injection

[T+0] goal received
[T+0:30] Builder.A wake (claude-code)
[T+0:45] ⚠ Builder.A killed (artificial kill -9)
[T+0:46] circuit OPEN claude-code → routing to codex
[T+0:50] Builder.B wake (codex)
[T+1:40] artifact ready
[T+1:42] Verifier wake (gemini)
[T+1:55] PASS 91/100
[T+1:56] DONE in 1m56s (resilient session)
```

→ Demo 영상에 30초 분량으로 박으면 ICML 2025 §F 의 hierarchical + cross-provider safeguard 가 **실제 동작**하는 시연.

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-orchestration-topology]] — Hub-Ledger-Spoke (이 actor 4명이 그 토폴로지 위에 올라감)
- [[bagelcode-fault-tolerance-design]] — 각 adapter 의 health probe / circuit breaker
- [[bagelcode-frontier-orchestration-2026]] — Claude Code SDK / Codex subagents 1차 사료
- [[bagelcode-caching-strategy]] — provider 별 cache mechanism
- [[bagelcode-paperclip-vs-alternatives]] — framework 비채택 결정 (이 actor 들 직접 어댑터 통해 호출)
- [[geode-llm-models]] — multi-provider fallback chain 영감 (4 providers × 14 models)
