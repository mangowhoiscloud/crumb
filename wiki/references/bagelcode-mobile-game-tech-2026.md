---
title: 베이글코드 과제 — LLM × 모바일 게임 제작 사례 + 도구·스펙 (2026)
category: references
tags: [bagelcode, mobile-game, phaser, html5, unity-ai, lovable, vibe-coding, 2026]
sources:
  - "Lovable mobile app launch (TechCrunch 2026-04-28)"
  - "Unity AI beta (GDC March 2026, gamedeveloper.com)"
  - "Phaser LLM 친화도 데이터 (seeles.ai 2026)"
  - "Godot 4.6 (Jan 2026)"
  - "LLM Coding Leaderboard (llm-stats.com May 2026)"
  - "Claude-Code-Game-Studios (49 agents) + godogen (Godot+Bevy+CC+Codex)"
  - "GameDeveloper 'Unity AI prompt full casual games' (2026)"
created: 2026-05-01
updated: 2026-05-01
---

# LLM × 모바일 게임 — 2026 사례 + 도구 스펙

> **목적**: Crumb 의 게임 출력 형식 결정에 1차 사료. 모바일 게임을 LLM 으로 만드는 **실제 사례 + 도구별 스펙 + 베스트 fit** 종합.
>
> **결론 한 줄**: **Phaser 3.80+ via CDN, single-file `game.html`** 가 모든 축 우세. Lovable 의 App Store 응답 + Phaser 의 LLM 친화도 + 베이글코드 모바일 캐주얼 톤 = 한 점 수렴.

---

## 1. 핵심 사례 — Lovable Mobile App (2026-04-28)

URL: https://techcrunch.com/2026/04/28/lovable-launches-its-vibe-coding-app-on-ios-and-android/

### 결정적 인사이트

> Lovable "played by the rules, generating **web-based applications** on its platform rather than downloading new executable code, which is why it's now available as a mobile app on both app stores. **Apple won't allow apps that download new code or change their functionality**, as that presents a security risk."

→ **App Store / Google Play 의 정책 자체가 LLM-generated native binary 를 차단.** AI 가 동적으로 만든 게임은 **반드시 web** 이어야 모바일 distribution 가능.

→ Crumb 도 같은 path. native 빌드 폐기의 **정책 차원 근거** (성능·셋업 부담 외).

### Lovable 의 운영 패턴 (참고)
- desktop 보다 **제한 기능** (모바일은 "queue prompts + 알림" 위주)
- **자유로운 프롬프트 → 웹앱 생성**
- App Store 에 web wrapper 로 배포

→ 우리 운영 모드 일관: 코드 에이전트가 만드는 건 web, 평가자는 그걸 브라우저로 본다.

---

## 2. Phaser 의 LLM 친화도 (decisive data)

URL: https://www.seeles.ai/resources/blogs/phaser-js-game-development-2026

### 가장 강한 단 한 줄 (verbatim)

> "Phaser has been part of the training data for every major frontier LLM, with models from Anthropic, OpenAI, Google, and others understanding the Phaser API deeply"

> "AI models able to reliably generate working Phaser code on the first attempt **94% of the time, compared to 71-82% for other frameworks**"

→ **Builder LLM 의 first-attempt 성공률** 이 94% vs 71-82%. 마감 + 1회 응시 환경에서는 **확률 가장 높은 선택지 = Phaser**.

### Phaser vs 경쟁 framework

| 항목 | Phaser 3.80+ | Three.js | Pixi.js | Babylon |
|---|---|---|---|---|
| LLM 첫 시도 성공률 | **94%** | 71-82% | 71-82% | 71-82% |
| 번들 (minified) | **670KB** | ~600KB | ~450KB | 1.1MB |
| 3G 로드 속도 (대비) | **2.3× faster** | baseline | similar | slow |
| 코드 길이 (대비) | **-40% shorter** | longer | rendering only | longer |
| 영역 적합도 (캐주얼 2D) | ✅ best | 3D 우선 | renderer only | 3D 우선 |
| Mobile / touch / scaling | ✅ built-in | manual | manual | engine 의존 |
| Physics (matter / arcade) | ✅ built-in | external | ❌ | engine 의존 |
| Scene management | ✅ built-in | manual | ❌ | engine 의존 |

→ **베이글코드 모바일 캐주얼 도메인** 에 정조준. 2D / 3G / mobile / touch 모두 Phaser 우위.

### CDN 한 줄로 끝남

```html
<script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"></script>
```

→ 평가자 환경에 install 0. 단일 game.html + CDN 1줄 = 모든 모바일 브라우저 동작.

---

## 3. Unity AI 2026 trajectory (참고만)

URL: https://www.gamedeveloper.com/programming/unity-says-its-ai-tech-will-soon-be-able-to-prompt-full-casual-games-into-existence

### 발언 (verbatim)

> "Unity AI is the second major area of focus for 2026, unveiling a beta of upgraded Unity AI that will enable developers to **prompt full casual games into existence with natural language only**, native to the platform."

### 산업 데이터

> "The 2026 Unity Game Development Report: a staggering **95% of game studios worldwide** have now adopted AI into their core workflows."

→ 베이글코드 = 그 95% 안. 우리 컨셉이 "이 흐름의 1년 빠른 prototype" 으로 보이게 할 수 있음.

### 우리가 Unity 안 쓰는 이유

| 문제 | 영향 |
|---|---|
| Unity install 평가자 부담 | README 즉시 동작 깨짐 |
| Unity license / 인증 | 셋업 30분+ |
| Unity AI beta 가 GDC March 2026 = 신생 | production 검증 부족 |
| Builder LLM 이 Unity C# 보다 HTML/JS 잘 만듦 | 안정성 ↓ |
| `.unitypackage` 같은 binary 산출 | git diff·평가 어려움 |

→ **Unity AI 트렌드는 우리 결정의 산업 배경 신호**, 채택 후보 X.

---

## 4. Godot 4.6 (Jan 2026)

URL: https://godotengine.org (간접)

### 신규 (Jan 2026)
- Android device mirroring
- Google Play Billing
- Google Play Games Services
- Apple StoreKit 2 integration

### LLM 통합 사례
- **godogen** ([github.com/htdt/godogen](https://github.com/htdt/godogen)) — Claude Code + Codex 로 Godot/Bevy 자율 게임 개발
- **dev.to "Godot + Ollama"** — local LLM in-game

### 우리가 Godot 안 쓰는 이유
- Godot install 50MB, 평가자 부담
- Godot HTML5 export 가능하지만 `index.html` + `.pck` + `.wasm` 다 묶여 multi-file
- Builder LLM 이 GDScript 보다 JS 학습 풍부
- Phaser CDN 한 줄 vs Godot multi-file → CDN 승

---

## 5. LLM Coding Leaderboard (May 2026)

URL: https://llm-stats.com/leaderboards/best-ai-for-coding

### HTML5 Canvas = 1 of 7 arena

7 arena: React + p5.js + D3.js + Three.js + SVG + Tone.js + **HTML5 Canvas game**

### 모델 score (May 2026)

| 모델 | Arena |
|---|---|
| Boba (stealth) | 1124 |
| **Claude Sonnet 4.6** | **1105** |
| **Claude Opus 4.7** | **1064** |
| GPT-5.5 (Codex) | (이하) |

→ **우리 Builder.A (Claude Code Opus 4.7) + Builder.B (Codex GPT-5.5)** 가 정확히 leaderboard 상위. HTML5 Canvas arena 가 별도 평가 카테고리 = LLM 들이 잘 한다는 산업 합의.

---

## 6. Claude Code Game Studios (49 agents)

URL: https://github.com/Donchitos/Claude-Code-Game-Studios

> "Turn Claude Code into a full game dev studio — 49 AI agents, 72 workflow skills, and a complete coordination system mirroring real studio hierarchy."

### 대비

| 항목 | Claude-Code-Game-Studios | gamestudio-subagents | **우리 Crumb** |
|---|---|---|---|
| Agent 수 | 49 | 12 | **4** |
| Skill 수 | 72 | (workflow) | (sandwich §2 만) |
| Engine 가정 | Unity / Unreal / Godot | Godot/Unity/Unreal 선택 | **HTML5 Phaser** |
| 산출 형식 | engine-specific binary | engine-specific | **single-file HTML** |
| 평가자 셋업 | 무거움 | 무거움 | **0** |
| 마감 안 적합 | ❌ | ❌ | **✅** |

→ "더 큰 시스템도 있다" 인지. 우리는 **2일 마감 + 1회 응시** 라 의도적으로 작게.

---

## 7. WebGPU broad support (2025-2026)

> "WebGPU reached broad browser support in 2025, and Unity, Godot, and Phaser all export to WebGPU-capable targets, which opens distribution channels beyond the App Store and Google Play—including embedded games on publisher sites, Telegram mini-apps, and Chinese mini-game platforms."

→ **베이글코드 도메인 (글로벌 + Telegram mini-app + Chinese mini-game = 캐주얼 게임 distribution)** 의 핵심 trend. web 이 모바일 distribution 의 미래 통로 = 우리 결정 정합.

→ Phaser 가 WebGPU export 지원 = stretch 시 GPU acceleration 도 free.

---

## 8. 산업 통계 (베이글코드 컨텍스트 보강)

| 통계 | 출처 | 베이글코드 fit |
|---|---|---|
| 95% 게임 스튜디오 AI core workflow 채택 | Unity 2026 Report | ✅ 베이글코드도 그 안 |
| Dev cycle -40%, 비용 -20-30% | Unity 2026 Report | ✅ 채용 메일 "에이전트의 능력을 확장" 톤 |
| Indie prototype < 10분 | seeles.ai | ✅ TODOS 3-day vs 더 빠름 |
| LLM gaming 프로토타입 weeks → minutes | seeles.ai | ✅ BagelJam:Dev 2일 가속 |

---

## 9. 결정 — 우리 stack

### Default (Crumb `DESIGN.md` §1 에 박힘)

```
Output Format:    single-file HTML5 game
Framework:        Phaser 3.80+ (CDN)
Renderer:         Canvas (default) / WebGPU (stretch)
Mobile target:    iPhone Safari 16+ / Android Chrome 100+
Performance:      60fps on 3G / mobile baseline
Bundle:           ~700KB (Phaser CDN) + game.js (~10-30KB)
Distribution:     web (URL share) / PWA (stretch)
```

### `--vanilla` mode (alt, no framework)

```
Output:           single-file HTML5
Framework:        none (vanilla Canvas API)
Bundle:           < 60KB (game.html 자체에 inline)
target:           same mobile baseline
Use case:         "no internet" demo / 가장 작은 dependencies
LLM 성공률:       72-82% (Phaser 대비 ↓)
```

→ default 는 Phaser, vanilla 는 옵션. **마감 안에서는 default 만 검증**.

### Stretch — PWA

```
+ game.webmanifest
+ service-worker.js (offline)
+ Add-to-Home-Screen meta tags
+ touch-action / viewport / safe-area-inset
```

→ 모바일 폰 home screen 추가 = native 같은 느낌. 시연 임팩트 ↑.

---

## 10. game `DESIGN.md` 에 박을 spec 1-page

위 결정을 [[bagelcode-task-direction]] 의 game DESIGN.md 1 섹션 (Visual Theme & Atmosphere) 으로 압축:

```markdown
## §1. Visual Theme & Atmosphere

Mood: vibrant, mobile-first, casual, immediate feedback.
Inspiration: Two Dots, Royal Match, Candy Crush.

Target stack (binding constraint for Builder agents):
  - Output:     single-file game.html (HTML + inline CSS + inline JS)
  - Framework:  Phaser 3.80+ via CDN
                  <script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"></script>
  - Renderer:   Canvas 2D (default) — WebGPU only if --webgpu flag
  - Bundle:     ≤ 60KB own code (CDN external)
  - Performance: 60fps on iPhone Safari 16+ / Android Chrome 100+
  - Touch:      pointer events (>= 44×44 zones)
  - Viewport:   responsive 320–428 width portrait, safe-area aware
  - Color:      see §2 Palette

Forbidden:
  - npm bundlers (webpack/vite/parcel)
  - native engine output (Unity/Godot/Unreal binaries)
  - Three.js / Babylon (3D 과함)
  - external assets except images embedded as data URL
```

→ Builder.A / Builder.B sandwich §2 가 이 spec ref → AI slop + native 빌드 시도 자동 차단.

---

## 11. README 에 박을 한 줄

> "**Stack: Phaser 3.80+ on a single `game.html` (no bundler).** 평가자가 더블클릭 한 번에 데스크톱 브라우저에서, 폰으로는 같은 파일의 URL 을 열어 모바일 시연 가능. 이 결정은 (a) Apple App Store policy (Lovable 2026-04 응답), (b) Phaser 의 LLM 첫시도 성공률 94% (vs 71-82% 타 framework), (c) 베이글코드 모바일 캐주얼 도메인 정조준 + 95% 스튜디오 AI 채택 trend 종합 결과입니다."

---

## 1차 사료 (8 links)

### 사례
- [Lovable Mobile App Launch (TechCrunch 2026-04-28)](https://techcrunch.com/2026/04/28/lovable-launches-its-vibe-coding-app-on-ios-and-android/)
- [Lovable Brings Vibe Coding to Smartphones (Dataconomy)](https://dataconomy.com/2026/04/29/lovable-brings-vibe-coding-to-smartphones-with-new-mobile-app/)
- [Replit launches mobile vibe coding (CNBC 2026-01-15)](https://www.cnbc.com/2026/01/15/ai-startup-replit-launches-feature-to-vibe-code-mobile-apps.html)
- [Build a Retro Game with Claude Code in 20 Minutes (Creator Economy)](https://creatoreconomy.so/p/build-a-retro-game-with-claude-code-in-20-min)

### 도구·스펙
- [Phaser.js: How We Build 2D Games with JavaScript 2026 (seeles.ai)](https://www.seeles.ai/resources/blogs/phaser-js-game-development-2026)
- [Phaser GitHub (3.80+)](https://github.com/phaserjs/phaser)
- [JS Game Rendering Benchmark (15 frameworks)](https://github.com/Shirajuki/js-game-rendering-benchmark)
- [Best AI for Coding May 2026 (HTML5 Canvas arena)](https://llm-stats.com/leaderboards/best-ai-for-coding)
- [Unity AI prompt full casual games (gamedeveloper.com)](https://www.gamedeveloper.com/programming/unity-says-its-ai-tech-will-soon-be-able-to-prompt-full-casual-games-into-existence-)
- [Unity AI features (Unity)](https://unity.com/features/ai)
- [Best mobile game engines 2026 (App Radar)](https://appradar.com/blog/mobile-game-engines-development-platforms)

### LLM × Game Engine 멀티 에이전트 사례
- [Claude-Code-Game-Studios (49 agents)](https://github.com/Donchitos/Claude-Code-Game-Studios)
- [godogen (Claude Code + Codex × Godot/Bevy)](https://github.com/htdt/godogen)
- [gamestudio-subagents (12 agents, mobile/casual)](https://github.com/pamirtuna/gamestudio-subagents)

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-production-cases-2026]] — sister: 일반 production cases
- [[bagelcode-frontier-orchestration-2026]] — orchestration 패턴
- [[bagelcode-agents-fixed]] — Claude Opus 4.7 + Codex GPT-5.5 가 leaderboard 상위
- [[bagelcode-rubric-scoring]] — D2 (실행 가능성) 가 Phaser+CDN 기준
- [[bagelcode-davis-system]] / [[bagelcode-ai-first-culture]] — 베이글코드 톤 (light footprint, 단순)
