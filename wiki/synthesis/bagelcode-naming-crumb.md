---
title: 베이글코드 과제 — 프로젝트 작명 "Crumb" 결정 + rationale
category: synthesis
tags: [bagelcode, naming, crumb, brand, motif, decision]
sources:
  - "[[bagelcode-stack-and-genre-2026]]"
  - "[[bagelcode-team-profile]]"
  - "[[geode-sandbox-breadcrumb]]"
created: 2026-05-01
updated: 2026-05-01
---

# 프로젝트 작명 — **Crumb** (확정)

> 이전 코드네임 "Pitchcraft" → **Crumb** 으로 lock. 이 페이지는 결정 rationale + 위키·코드 일괄 갱신 기록.

## Crumb 의 3중 의미

```
Crumb
  ├── 1) Bagel motif (베이글코드 brand ecosystem)
  │      베이글의 작은 부스러기 = prototype 한 알
  │
  ├── 2) Breadcrumb pattern (LLM agent 표준)
  │      Hansel & Gretel 의 길찾기 metaphor
  │      → path tracing / context routing / error steering
  │      → cf. [[geode-sandbox-breadcrumb]] (3-layer LLM path error steering)
  │
  └── 3) UI/Agent breadcrumb navigation
         transcript 의 actor·kind 흐름이 breadcrumb trail
         → 평가자가 의사결정 path 추적 가능 (D3 관찰성)
```

→ **하나의 단어가 (a) 회사 정체성 (b) LLM agent 표준 패턴 (c) 우리 transcript 의 본질** 모두 동시 응답.

## 작명 결정 근거

### 1. Bagel motif ecosystem (Anthropic Claw 패턴)

Anthropic 의 ecosystem 작명:
```
Claude → Claude Code → OpenClaw → NanoClaw → Moltbot → ClawCode
   └────── 한 motif (Claw) 가 친구·반대·patch 다 묶음 ──────┘
```

베이글코드 = **Bagel** motif:
```
Bagelcode (회사) → Crumb (우리 도구)
                        └── Bagel ecosystem 의 자식
```

**평가자 첫 인상**: "이 사람은 우리 회사 정체성을 이해한다." brand 자산.

### 2. Breadcrumb = LLM agent 표준 어휘

**Breadcrumb pattern in agent design:**
- 사용자/평가자가 agent 의 결정 path 를 따라갈 수 있게 trail 남김
- error 발생 시 "어디서부터 잘못됐나" 거꾸로 추적
- routing decision 의 audit log
- **cf. [[geode-sandbox-breadcrumb]] (geode 의 3-layer LLM path error steering)** — 같은 motif 가 mango ecosystem 안에 이미 존재

→ **"breadcrumb 알면 transcript 가 왜 그렇게 생겼는지 즉시 이해됨".** 평가자에게 cognitive shortcut.

### 3. Kiki personality 계승

| 차원 | Kiki | Crumb |
|---|---|---|
| 음절 | 2 (Kiki) | 1 (Crumb) |
| 인격 | 친근, pet-like | 작고 부드러움 |
| 한국어 | "키키" 자연 | "크럼" 자연 |
| 의미 명확성 | (낮음) | **3중 명확** |
| 도메인 fit | (Slack profiling) | **Bagel + agent + transcript 모두** |

→ Kiki 보다 의미 풍부. 한 음절이지만 Bolt / Codex 류로 모던.

### 4. 다른 후보 대비 우위

| 후보 | Bagel motif | LLM 표준 어휘 | Multi-agent hint | 평가 |
|---|---|---|---|---|
| **Crumb** | ✅ | ✅ breadcrumb | ✅ trail | **3중 의미 유일** |
| Yeast | ✅ | ⚠ | ⚠ | 2중 |
| Murmur | ❌ | ⚠ | ✅ | 1.5중 |
| Nori | ❌ | ❌ | ❌ | 0중 (game 만) |
| Bori | ❌ | ❌ | ❌ | 0중 (Kiki 닮음만) |

→ **Crumb 가 의미 깊이 압도적 우위.**

## README 1줄 (작명 노출)

> "**Crumb** is named after (1) the small piece of a bagel — Bagelcode's signature, (2) the **breadcrumb pattern** widely used in LLM agent systems for path tracing and error steering (Hansel & Gretel metaphor), (3) and the breadcrumb trail of agent decisions left in `transcript.jsonl` for the user to follow."

→ 평가자가 README 첫 절에서 **즉시 3중 의미 인지**.

## 위키·코드 일괄 갱신 (2026-05-01)

| 위치 | 변경 |
|---|---|
| `projects/bagelcode/*.md` 8 files | `Pitchcraft` → `Crumb` 일괄 치환 |
| ENV 변수 | `PITCHCRAFT_*` → `CRUMB_*` (10 instances) |
| 코드 디렉토리 (예정) | `crumb/` (github repo, 코드 단계에서) |
| `.md` 자산 폴더 (예정) | `crumb/agents/{coordinator,builder-a,builder-b,verifier}.md` |
| 산출물 디렉토리 (예정) | `sessions/<session-id>/{transcript.jsonl, artifacts/}` |

## 코드베이스 명명 규칙

```
Crumb              ← 제품명 (PascalCase, README/docs)
crumb              ← package/repo/CLI name (lowercase)
CRUMB_*            ← 환경 변수 (UPPER_SNAKE)
.crumb/            ← 사용자 home config (예: ~/.crumb/sessions/)
crumb-*            ← sub-tools (예: crumb-replay)
```

## See also

- [[bagelcode]] — 프로젝트 hub (Crumb 명시)
- [[bagelcode-task-direction]] — 방향성 결정 페이지
- [[bagelcode-agents-fixed]] — CRUMB_ env 변수 정의
- [[bagelcode-stack-and-genre-2026]] — Bagel motif 의 ecosystem 컨텍스트
- [[geode-sandbox-breadcrumb]] — mango ecosystem 의 기존 breadcrumb 사례 (sister motif)
- [[kiki]] — 사촌 시스템 (Slack profiling, 같은 작명 톤)
