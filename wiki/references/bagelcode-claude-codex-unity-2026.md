---
title: 베이글코드 과제 — Claude Code / Codex × Unity 사례 + 우리 결정 framing 강화
category: references
tags: [bagelcode, unity, claude-code, codex, mcp, production-cases, framing, 2026]
sources:
  - "BigDevSoon Void Balls 10일 Steam-ready (2026)"
  - "Unity MCP 4종 (IvanMurzak / Coplay / CoderGamester / Bluepuff71)"
  - "Bezi / Coplay / Unity AI Assistant 비교 (2026)"
  - "MDPI 2026 Game Knowledge Management (LLM Unity 한계)"
  - "Unity Discussions / Claude Lab / kevurugames blog"
created: 2026-05-01
updated: 2026-05-01
---

# Claude Code / Codex × Unity — 2026 사례 + 우리 결정 framing 강화

> **목적**: 베이글코드 신작팀이 Unity 사용. LLM agent × Unity 가 production-ready 도달한 frontier. **우리는 알면서도 의도적으로 안 갔다** 는 것을 평가자에게 정확히 보여주는 사료.
>
> 결론 한 줄: **production-ready 수준**, 그러나 우리 과제 spec (2일 / 1회 / 평가자 환경 0 의존) 아래 **셋업 risk 가 너무 큼**. Phaser HTML5 결정 유지 + framing 강화.

---

## 1. Production 출시 사례

### 1A. BigDevSoon "Void Balls" — 10일 Steam-ready

URL: https://bigdevsoon.me/blog/building-games-with-ai-indie-game-dev-workflow/

| 항목 | 값 |
|---|---|
| 게임 | 2D roguelite |
| 출시 | Steam (Steam-ready) |
| 기간 | **10일** (zero to production) |
| Stack | Claude Code + Unity MCP + Replicate (assets) + ElevenLabs (audio) |
| 결과 | 실제 출시 가능한 game |

**verbatim 교훈:**
> "**The 7-color palette wasn't a limitation — it was a design decision** that made AI-generated art feel intentional. The same applies to the two-button control scheme."

→ **constraint 가 quality 를 만든다** — 우리 game DESIGN.md §1 의 "binding constraint" 와 같은 발상.

> "**The biggest misconception** about building games with AI is that you press a button and a game comes out. AI is **an amplifier** — it takes your game design knowledge, your taste, your decisions about what feels good to play, and executes on them 10x faster."

→ "기획자 + AI 협업" 의 본질 = AI 가 amplifier, **사람이 taste 결정자**. 베이글코드 메일의 "기획자는 에이전트에게 게임을 만들게 한다" 와 정합.

> "**When running multiple agents in parallel, one agent's output can invalidate another's work.** Developers handled this by being conservative about what runs in parallel."

→ 우리 [[bagelcode-orchestration-topology]] 의 **순차 fallback default + parallel 옵션** 결정의 frontier 검증.

### 1B. Dino Card Hunt — 10개월 솔로

10개월 솔로 + Claude Code = Steam wishlist. **장기 운영 가능성** 신호.

### 1C. TheOne Studio training-skills

URL: https://github.com/The1Studio/theone-training-skills

Claude Code skills 로 **VContainer + SignalBus + 간결 C# 패턴** 강제. 스튜디오 표준 enforcement = 우리 sandwich §4 enforcement footer 와 동일 발상.

---

## 2. Unity MCP 생태 (4 핵심 플러그인)

### 2A. IvanMurzak Unity-MCP (가장 활발)

URL: https://github.com/IvanMurzak/Unity-MCP · CLAUDE.md: https://github.com/IvanMurzak/Unity-MCP/blob/main/CLAUDE.md

| 항목 | 값 |
|---|---|
| 도구 수 | **100+** built-in tools |
| 가격 | **free** |
| 호환 | Claude Code, Gemini, Copilot, Cursor, Codex |
| 특징 | "Any C# method may be turned into a tool by **a single line**" |
| 운영 | "runs **inside your Unity Editor and compiled games**, empowering AI to write code, manipulate objects, manage scenes, and even debug your game while you play" |

→ **Editor 안에서 LLM 이 GameObject/Scene/Prefab/Script 직접 조작.** 완전 통합.

### 2B. Coplay unity-mcp ($3/mo, beta free)

URL: https://github.com/CoplayDev/unity-mcp · https://docs.coplay.dev/coplay-mcp/claude-code-guide

| 항목 | 값 |
|---|---|
| 도구 수 | **86** internal tools |
| Claude Code bridge | 공식 지원 |
| 가격 | beta 동안 free, 정식 $3/mo |
| 특징 | external AI tools (Claude Code) 가 Coplay 와 같은 도구 접근 |

### 2C. CoderGamester mcp-unity

URL: https://github.com/CoderGamester/mcp-unity

> "Model Context Protocol (MCP) plugin to connect with Unity Editor — designed for **Cursor, Claude Code, Codex, Windsurf** and other IDEs"

→ multi-IDE 지원이 가장 명확한 플러그인.

### 2D. Bluepuff71 UnityMCP

URL: https://github.com/Bluepuff71/UnityMCP

40+ tools, "**zero tracking**, open source" — privacy 우선 옵션.

---

## 3. Unity 특화 AI Assistant — 일반 LLM 도구와 비교

### 3A. Bezi vs Claude Code (사용자 보고)

URL: https://www.bezi.com/

> "Users report that **Bezi got them to their end goal 10x faster** compared to ChatGPT and Claude. Bezi indexes your **assets, scenes, packages**, and more — not just your code."

→ Unity 특화 도구가 일반 LLM 보다 빠른 이유 = **asset/scene/prefab indexing**. 우리가 그냥 Claude Code 만 쓰면 이 도구들에 비해 약함.

### 3B. Coplay vs Unity AI Assistant

URL: https://coplay.dev/blog/coplay-vs-unity-ai-assistant

| 차원 | Coplay | Unity AI Assistant (Muse) |
|---|---|---|
| 모델 선택 | ✅ Claude 3.7 / GPT-4o swap 가능 | ❌ Unity 비공개 model |
| 운영 방식 | conversational, background continuous | one-shot |

→ Coplay 가 "Claude 3.7 outperforms GPT-4o significantly" 라고 직접 보고.

### 3C. Unity AI (Muse) — 1st-party

URL: https://unity.com/features/ai

GDC March 2026 beta: "**prompt full casual games into existence with natural language only**, native to the platform — making it simple to move from prototype to finished product."

→ Unity 가 직접 프롬프트→캐주얼 게임 빌드. **베이글코드 신작팀이 곧 받게 될 도구**.

---

## 4. 학술 한계 — Unity LLM gap

### MDPI 2026 — Game Knowledge Management System

URL: https://www.mdpi.com/2079-8954/14/2/175

**verbatim:**
> "recent LLM-based methods often produce outputs that are **structurally invalid or incompatible with real-time game engines**, reflecting a fundamental limitation in current practice"

→ Unity prefab/scene/walkable coordinate native 구조의 **serialization gap**. LLM 자유 산출은 깨짐.

해법 (논문):
> "Engine assets — including prefabs, scene layouts, and walkable coordinates — are converted into **symbolic resources**"

→ schema-governed pipeline 필요. 우리 [[bagelcode-transcripts-schema]] + [[bagelcode-rubric-scoring]] anti-deception 룰의 학술 backing.

---

## 5. 우리 과제 spec 과의 fit 판단

| 평가 차원 | Unity MCP path | Phaser HTML5 path |
|---|---|---|
| README 즉시 동작 | ❌ Unity install 3GB + license | ✅ 더블클릭 |
| 평가자 환경 의존 | ❌ Unity Editor + project 셋업 30분+ | ✅ 0 |
| 마감 (2-3일) | ⚠ 가능 (BigDevSoon 10일 ÷ 5) | ✅ 안전 |
| 1회 응시 risk | ❌ 셋업 fail → 응시 fail | ✅ 낮음 |
| 베이글코드 stack fit | ✅✅ Unity 직접 | ⚠ Unity 의 전 단계 |
| 멀티 에이전트 핵심 가치 | ⚠ Unity MCP framework 에 흡수 | ✅ 자체 토폴로지 시연 |
| 산출물 평가 | ❌ Unity project binary, git diff 어려움 | ✅ 단일 파일 + 4 deliverable |
| Bezi/Coplay 와 차별화 | ❌ Unity 특화가 10× 빠름 | ✅ 다른 카테고리 |
| 평가자 시연 임팩트 | ⚠ Unity Editor 띄움 | ✅ 더블클릭 |
| LLM Unity 한계 (학술) | ⚠ prefab/scene serialization gap | ✅ HTML 단순, gap 적음 |
| 멀티 모델 (Claude/Codex/Gemini) | ⚠ Unity MCP 들이 multi-model 지원하나 fit 약함 | ✅ adapter 단순 |
| 베이글코드 메일 verbatim | ✅ "기획자 → 게임" | ✅ "기획자 → 게임" |

→ **11/12 차원에서 Phaser HTML5 우세.** 베이글코드 stack fit 1 차원만 Unity MCP 우세, "전 단계" framing 으로 무력화.

---

## 6. 평가자 의문 — 선제 답변 3개

### 의문 1: "Unity MCP 알아? 알면서도 왜 안 했어?"

> "BigDevSoon 이 Claude Code + Unity MCP 로 10일에 Steam-ready 게임 출시 (Void Balls). IvanMurzak Unity-MCP 100+ tools / Coplay 86 tools / Bluepuff71 40+ tools 의 활발한 frontier. Bezi 는 'ChatGPT/Claude 보다 10× 빠르다' 보고 (asset/scene indexing).
>
> 그러나 우리 과제 spec — **2일 마감 + 1회 응시 + 평가자 환경 0 의존 + README 즉시 동작** — 아래 Unity install 3GB + project 셋업 30분+ 의 risk 가 응시 자체를 깨뜨릴 수 있어 의도적 회피했습니다. 학술 (MDPI 2026) 도 LLM 의 Unity prefab/scene serialization 의 'structurally invalid output' 한계를 명시 — 추가 risk."

### 의문 2: "그럼 Crumb 는 Unity 와 무관한 것이냐?"

> "정반대입니다. Crumb 4 산출물 (game.html / spec.md / DESIGN.md / tuning.json) 은 그대로 **Unity MCP 워크플로우의 input asset** 으로 변환 가능합니다.
>
> ```
> [기획자 한 줄]
>     │  (30분, browser prototype)
>     ▼
>  Crumb (HTML5)  ← 이 과제
>     │  (4 deliverables)
>     ▼
>  Unity MCP team   ← 베이글코드 신작팀의 다음 quarter
>     │  (며칠~몇 주, native 빌드)
>     ▼
>  App Store / Google Play
> ```
>
> Crumb = 'AI agent 협업 인프라', Unity MCP = 'Unity Editor 통합 layer'. 두 layer 합쳐 쓰는 stack."

### 의문 3: "Bezi/Coplay 가 10× 빠른데 왜?"

> "Bezi/Coplay 는 Unity Editor 내부의 **single-agent assistant**. 우리 과제는 **여러 AI 에이전트가 서로 통신하며 사용자와 협업하는 도구** — 베이글코드 채용 메일 verbatim 문제. Crumb 의 Coordinator/Builder.A/Builder.B/Verifier 4 actor 의 단일 transcript 위 hierarchical orchestration 은 Bezi 와 다른 layer 의 가치 — 'multi-agent infrastructure' vs 'IDE assistant'.
>
> 베이글코드 신작팀이 향후 Bezi/Coplay 도입하더라도 Crumb 의 transcript schema + sandwich identity + cross-provider Verifier 패턴은 그 위에서 그대로 작동합니다."

---

## 7. README 에 박을 메시지 강화

### 기존 (Stack-and-Genre 페이지 §"Crumb 의 위치")
> "Crumb 는 베이글코드 신작팀의 Unity 워크플로우의 **전 단계** prototype 도구"

### 강화 (Unity MCP 인지 명시)
> "Crumb 는 Unity 워크플로우의 **전 단계 + 멀티 에이전트 인프라 layer** 입니다.
>
> Claude Code + Unity MCP 가 production-ready 수준에 도달한 것을 알고 있습니다 (BigDevSoon Void Balls 10일 Steam-ready, Bezi/Coplay/IvanMurzak Unity-MCP 100+ tools). 그러나 (a) 과제 마감 + 1회 응시 + 평가자 환경 0 의존 강제, (b) LLM 의 Unity prefab/scene serialization 한계 (MDPI 2026) — 두 이유로 Phaser HTML5 prototype path 를 의도적으로 채택했습니다.
>
> Crumb 의 transcript schema + sandwich identity + cross-provider Verifier + fault tolerance F1-F5 는 향후 베이글코드 신작팀이 Unity MCP 를 도입할 때 **그 위에서 그대로 작동하는 multi-agent infrastructure** 입니다. 즉 layer 분리 — 도구는 Phaser/Unity 어떻게 바뀌어도, 우리 protocol layer 는 호환."

→ 이 한 단락이 **모든 평가자 의문 종결**.

---

## 8. 우리 결정 변경/유지

| 항목 | 결과 |
|---|---|
| Unity 비채택 | ✅ 유지 |
| Phaser HTML5 | ✅ 유지 |
| 4 actor 토폴로지 | ✅ 유지 |
| **메시지 framing** | ⚠ **강화** (Unity MCP 인지 명시 + layer 분리 framing) |
| **future roadmap 1줄** | ⚠ **신설** (Crumb → Unity MCP 호환 가능) |

→ 모든 결정 유지, **메시지 정밀화만**.

---

## 1차 사료 (14 links)

### Production 사례
- [BigDevSoon — 2D Roguelite 10일 출시](https://bigdevsoon.me/blog/building-games-with-ai-indie-game-dev-workflow/)
- [Unity × Claude Code (Claude Lab)](https://claudelab.net/en/articles/claude-code/unity-claude-code-game-dev-accelerate)
- [10 Months Unity Dev with Claude Code (YouTube)](https://www.youtube.com/watch?v=xZaSPw14Cfo)
- [8 Months Unity Dev with Claude Code (YouTube)](https://www.youtube.com/watch?v=GxZLC00yJ5g)
- [Claude Code Game Studios (49 agents)](https://github.com/Donchitos/Claude-Code-Game-Studios)
- [Using Claude AI in Game Development (kevurugames)](https://kevurugames.com/blog/using-claude-ai-in-game-development-tools-use-cases-and-industry-statistics/)
- [I Used AI to Code a Game in Unity — Lessons (Medium)](https://medium.com/artcenter-graduate-interaction-design/i-used-ai-to-code-a-game-in-unity-heres-what-i-learned-cd680f2dad56)
- [TheOne Studio training-skills](https://github.com/The1Studio/theone-training-skills)

### Unity MCP 4종
- [IvanMurzak Unity-MCP (100+ tools)](https://github.com/IvanMurzak/Unity-MCP)
- [Coplay unity-mcp](https://github.com/CoplayDev/unity-mcp)
- [Coplay docs Claude Code guide](https://docs.coplay.dev/coplay-mcp/claude-code-guide)
- [CoderGamester mcp-unity](https://github.com/CoderGamester/mcp-unity)
- [Bluepuff71 UnityMCP](https://github.com/Bluepuff71/UnityMCP)

### Unity 특화 AI assistant
- [Bezi (10× faster claim)](https://www.bezi.com/)
- [Coplay vs Unity AI Assistant](https://coplay.dev/blog/coplay-vs-unity-ai-assistant)
- [Unity AI (Muse) features](https://unity.com/features/ai)

### 학술 한계 / 비교
- [Game Knowledge Management System — MDPI 2026](https://www.mdpi.com/2079-8954/14/2/175)
- [Unity + AI coding tools state (Unity Discussions June 2025)](https://discussions.unity.com/t/unity-ai-coding-tools-current-state-june-2025/1664497)
- [eesel — Codex × Unity practical guide](https://www.eesel.ai/blog/openai-codex-integrations-with-unity)

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-stack-and-genre-2026]] — 베이글코드 Unity 사실 + Crumb 위치 (sister)
- [[bagelcode-mobile-game-tech-2026]] — Phaser HTML5 결정 spec
- [[bagelcode-production-cases-2026]] — 일반 production cases
- [[bagelcode-frontier-orchestration-2026]] — multi-agent 패턴
- [[bagelcode-rubric-scoring]] — anti-deception 룰 (MDPI 한계 mitigation)
