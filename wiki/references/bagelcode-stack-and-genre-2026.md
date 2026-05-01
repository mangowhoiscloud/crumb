---
title: 베이글코드 stack + 유사 장르 (social casino / match-3 / 캐주얼) — 2025-2026 사실
category: references
tags: [bagelcode, stack, unity, social-casino, match-3, royal-match, doubleugames, positioning, 2026]
sources:
  - "베이글코드 Medium 채용 [직무소개] 글"
  - "베이글코드 Bagelcode 공식 about / business / career 페이지"
  - "ZDNet Korea — 더블유게임즈 팍시게임즈 AI 개발 체계 (2026-03-24)"
  - "Sensor Tower — Royal Match 통계 (2025-2026)"
  - "Business of Apps — Royal Match Revenue 2026"
  - "Wikipedia — Royal Match (Unity 명시)"
  - "App Radar — Best mobile game engines 2026"
  - "makemoneywithoutajob — Frameworks Behind Online Slot Games (Phaser, Pixi, Unity)"
created: 2026-05-01
updated: 2026-05-01
---

# 베이글코드 Stack + 유사 장르 — 2025-2026 사실 + 우리 Crumb 의 위치

> **핵심 발견 (사실)**: 베이글코드 **신작팀 = Unity** 사용 확정. Royal Match 등 캐주얼 시장 leader 도 Unity. 우리가 web/Phaser 로 가는 결정은 **Unity 와 경쟁이 아닌, Unity 의 *전 단계*** 라는 framing 이 정확.
>
> 이 페이지는 (1) 베이글코드 자체 stack, (2) 유사 장르 leader stack, (3) 한국 경쟁사 (더블유게임즈) AI workflow 동향, (4) 그 종합 위에서 Crumb 의 **위치 메시지**.

---

## 1. 베이글코드 자체 stack (확인된 사실)

### 1A. 신작팀 = Unity 엔진 사용

URL: https://medium.com/bagelcode/베이글코드-개발직군을-소개합니다-b72f12ade94 · https://www.bagelcode.com/article/직무소개-베이글코드-개발직군을-소개합니다/ · https://career.bagelcode.com/ko/o/152293

**verbatim 신호:**
> "UI/UX 디자인을 하고 디자인한 결과물을 **Unity 엔진**에 적용"

→ 신작팀 [Artist UI/UX] 공고 직무 설명에 명시. **Unity 가 베이글코드 신작팀의 client 표준.**

### 1B. 데이터 / AI 인프라

> "DATA&AI 팀은 **Databricks, Airflow, Kubernetes, Terraform, AWS** 등으로 구성된 아키텍처"

→ [[bagelcode-davis-system]] (DAVIS) 와 일관 — Databricks Genie + AWS Lambda + Slack 봇.

### 1C. 글로벌 운영 사실

| 항목 | 값 |
|---|---|
| 창립 | 2012 |
| 글로벌 player | **40M+** |
| Club Vegas | 21M downloads / 4.83★ / 600K ratings, **last updated 2026-04-22** |
| Seoul team | "led transition to Unity and a new backend" — Unity migration 활발 |
| 신작 SCS 팀 | "쉽고 재미있는 모바일 캐주얼 게임 글로벌 프로젝트" 진행 중 |
| 신작 EXP 팀 | "social casino 외 모바일 strategy 게임" |

### 1D. 베이글코드의 게임 list (캐주얼 / 소셜카지노 hybrid)

- Club Vegas (slots)
- Lucky Cruise / Vegas Live / Cash Mania (slots variants)
- 신작 캐주얼 (SCS 팀, 글로벌 출시 준비)

→ **현재 라인업 = 100% Unity 기반 native iOS/Android.** prototype → production 모두 Unity.

---

## 2. 유사 장르 (캐주얼 / Match-3 / 소셜 카지노) — 2025-2026 stack

### 2A. Royal Match (Dream Games) — 시장 leader

URL: https://en.wikipedia.org/wiki/Royal_Match · https://www.businessofapps.com/data/royal-match-statistics/

**stack 사실 (verbatim):**
> "Royal Match runs on the **Unity** game engine and is available for iOS through the App Store and Android via Google Play, the Amazon Appstore, and the Galaxy Store."

**시장 데이터:**
- 2025 매출 **$1.44B**
- 2026-03 기준 월 **$100M+**
- Candy Crush 추월 (2023, 다시 2026)

→ **캐주얼 match-3 leader = Unity 100%.**

### 2B. Candy Crush (King)

stack 명확치 않으나 King (Activision Blizzard 산하) 자체 엔진 + 부분 Unity. legacy.

### 2C. 슬롯·카지노 캐주얼 산업 일반 (2026)

URL: https://makemoneywithoutajob.com/frameworks-behind-online-slot-games-phaser-pixijs-unity/ · https://www.appradar.com/blog/mobile-game-engines-development-platforms

**Engine market share (2025-2026):**

| Engine | mobile market share | 위치 |
|---|---|---|
| **Unity** | **~70% of top mobile games / 48% engine market** | dominant |
| Unreal | 큰 게임 | console/PC 중심 |
| Cocos Creator 3.x | Asia 모바일 / mini-games | 중국 시장 |
| Godot 4.6 | 인디 / 무료 | 성장 |
| **Phaser** | **HTML5 simple-mid slots / browser** | light & web |
| Buildbox 4 | no-code hyper-casual | indie |

**verbatim (slot 산업):**
> "Phaser ... light file size, fast loading time, and compatibility across desktop and mobile browsers ... many HTML5 casino games using Phaser"
> "Unity ... 3D slots or multi-platform casino games with enhanced physics, transitions, and animations ... top choice"
> "Cocos Creator is used for frontend development in **end-to-end slot game services**"

→ **Unity = production native, Phaser = web prototype/light slot.** 두 stack 의 역할이 역사적으로 분리.

---

## 3. 한국 경쟁사 — 더블유게임즈 / 팍시게임즈 (가장 가까운 비교)

URL: https://zdnet.co.kr/view/?no=20260324155057 (2026-03-24)

### 3A. AI 기반 개발 체계 (verbatim)

> "팍시게임즈가 인공지능(AI) 기반 개발 체계를 바탕으로 **캐주얼 게임 라인업 45종**을 확보"
> "AI 기반 워크플로우 자동화를 도입해 기존 20명 이상의 팀이 수개월간 수행하던 개발 과정을 대폭 단축"
> "**1인 개발자가 3주 내 글로벌 출시가 가능한 시스템**을 구축"
> "더블우게임즈는 AI Lab 기반으로 **2026년 50종 이상의 신작**을 개발할 계획"

→ **베이글코드의 한국 경쟁사가 1인 3주 출시 시스템 구축**. 베이글코드의 신작팀 AI 개발자 채용도 같은 trajectory.

### 3B. 우리 Crumb 와의 정합

| 더블유게임즈 trajectory | Crumb mapping |
|---|---|
| 1인 개발자 + 3주 출시 | 1 기획자 + 30분 prototype |
| AI 워크플로우 자동화 | Coordinator + Builder + Verifier |
| 45종 → 50종 (속도 ↑) | 컨셉 빠른 검증 = volume ↑ |
| 기존 20명 × 수개월 → 1명 × 3주 | 기존 며칠 → 30분 |

→ **우리 Crumb 는 그 trajectory 의 1년 빠른 단면.** "베이글코드도 이 방향 갈 거다, 먼저 와봤다" 메시지.

### 3C. 다른 한국사 동향

- **카카오게임즈**: 2024 모바일 → PC/콘솔 멀티플랫폼 확장
- **컴투스**: 글로벌 게임 개발 공모전 '컴:온' (캐주얼 indie 발굴)
- **넷마블**: 멀티플랫폼 신작 추진

→ **한국 게임사 모두 캐주얼 + AI 워크플로우 + 글로벌** trend. 베이글코드 신작팀 채용 = 이 trend 의 직접 응답.

---

## 4. Crumb 의 위치 — 핵심 framing 메시지

### 사실 종합

```
베이글코드 production stack    = Unity
유사 장르 leader (Royal Match) = Unity
신작팀 채용 명시              = Unity
한국 경쟁사 (팍시) trajectory   = AI workflow + 1인 3주 출시
LLM 친화적 prototype framework = Phaser HTML5 (94% first-attempt)
LLM-generated mobile binary    = App Store 정책 차단 (Lovable 응답)
```

### 우리 결정의 정확한 의미

> ❌ "**Unity 와 경쟁한다**" — Crumb 가 Unity 를 대체할 prototype 빌더.
>
> ✅ "**Unity 의 전 단계 도구다**" — 30분 안에 컨셉 검증 → 검증된 컨셉만 Unity 팀이 production 화.

이 framing 이 강한 이유:
- 베이글코드 기존 stack (Unity) 보존 + 보강
- 신작팀 production 인프라 침범 X
- LLM 의 강점 (HTML5 prototype 빠름) 정조준
- 더블유게임즈 trajectory 와 일관 (AI workflow 가속)
- "기획자가 에이전트에게 게임을 만들게 한다" 의 **단계**가 명확해짐

### Crumb 의 라이프사이클 위치

```
[기획자 한 줄 아이디어]
        │
        ▼
  ┌──────────────────┐
  │  Crumb       │  ← 30분, HTML5 + Phaser, browser 즉시 플레이
  │  (LLM agents)     │     검증 / 거부
  └────────┬─────────┘
           │  (검증된 spec + DESIGN.md + tuning)
           ▼
  ┌──────────────────┐
  │  Unity 신작팀     │  ← 며칠~몇 주, native iOS/Android
  │  (사람 + Unity AI)│     production 빌드
  └────────┬─────────┘
           │
           ▼
   App Store / Google Play
```

→ **두 stack 이 직렬, 경쟁 X.** Crumb 는 Unity 의 input 을 만든다.

### 산출물 = Unity 팀의 input

Crumb 가 마지막 turn 에 산출하는 4개:

| 산출 | Unity 팀이 받아 |
|---|---|
| `game.html` (Phaser 시연) | 컨셉 시연 영상으로 변환 |
| `spec.md` (AC + 룰북) | Unity GDD 의 base |
| `DESIGN.md` (color / 메커닉 / 모션) | Unity Designer 의 base |
| `tuning.json` (밸런스 수치) | Unity 의 ScriptableObject 로 import |

→ Phaser game.html 자체는 throwaway. **컨셉·spec·DESIGN·tuning 4개가 Unity 팀의 input asset**. 이게 Crumb 의 진짜 deliverable.

---

## 5. README 에 박을 한 단락 (positioning 메시지)

> "Crumb 는 베이글코드 신작팀의 Unity 워크플로우와 **경쟁하지 않습니다**. 베이글코드 신작팀 채용 공고 [신작팀 Artist (UI/UX)] 가 명시한 'Unity 엔진에 적용' 한다는 production path 의 **앞 단계**, 즉 30분 prototype 로 컨셉을 검증하고 spec / DESIGN / tuning 을 Unity 팀에게 넘기는 도구입니다.
>
> 산업 trend 도 같은 방향입니다. 더블유게임즈/팍시게임즈는 AI workflow 로 '1인 3주 글로벌 출시' 시스템을 구축했고 (ZDNet 2026-03-24), 시장 leader Royal Match 도 Unity 기반으로 월 $100M+ 성과를 내고 있습니다. Crumb 는 이 trajectory 의 **컨셉 검증 단계**를 LLM 으로 자동화하는 것입니다.
>
> Phaser HTML5 를 선택한 이유: (a) Apple App Store 정책상 LLM-generated native binary 가 차단 (Lovable 2026-04 응답), (b) Phaser 의 LLM 첫시도 성공률 94% (다른 framework 71-82%), (c) 평가자가 더블클릭 즉시 모바일 브라우저에서 시연 가능. 검증된 컨셉이 Unity 로 옮겨지는 건 그다음 단계 사람의 일입니다."

→ 이 한 단락이 **모든 평가자 의문에 선제 답변**:
- "왜 Unity 안 쓰냐?" → Unity 는 production, 우리는 prototype
- "왜 Phaser?" → 3 근거
- "베이글코드 stack 알아?" → 신작팀 Unity 명시 인용
- "산업 trend 알아?" → 팍시게임즈 + Royal Match 데이터

---

## 6. 우리 결정 변경/유지 점검

| 기존 결정 | 변경/유지 |
|---|---|
| Output = single-file HTML5 game.html | ✅ 유지 |
| Framework = Phaser 3.80+ | ✅ 유지 |
| 게임 도메인 (캐주얼 / match-3 / slot) | ✅ 유지 + 강화 (Royal Match 시장 데이터) |
| 4 actor 토폴로지 | ✅ 유지 |
| Unity 안 씀 | ✅ 유지 + **이유 변경**: 기존 ("install 부담") → 추가 ("Unity 는 production, 우리는 prototype, 두 단계 분리") |
| 산출물 game.html 만 | ⚠ **확장**: spec.md / DESIGN.md / tuning.json 도 1급 산출물 |
| 메시지 "독창적인 아이디어" | ✅ 유지 + Crumb positioning 으로 강화 |

→ 모든 결정 유지, **메시지 framing 만 정밀화**.

### 산출물 확장 (Builder.A / Verifier 가 만듦)

```
artifacts/
├── game.html         ← Phaser 시연 (throwaway)
├── spec.md           ← AC + 룰북 (Unity GDD 의 base)
├── DESIGN.md         ← color / 메커닉 / 모션 spec
├── tuning.json       ← 밸런스 수치 (Unity ScriptableObject 로 import 가능 형식)
└── screenshots/      ← Verifier 가 자동 캡처
    ├── start.png
    ├── gameplay.png
    └── gameover.png
```

→ Builder agent sandwich §2 에 4 산출 강제. Verifier 가 4개 모두 검증.

---

## 7. 평가자에게 보낼 메시지 (한 줄)

> **Crumb = 베이글코드 신작팀의 Unity 워크플로우 앞에 끼우는, LLM 으로 30분 안에 게임 컨셉을 검증하고 spec/DESIGN/tuning 을 만들어내는 prototype 도구입니다.**

→ 이 한 줄이 README 첫 줄. 나머지는 그 한 줄을 뒷받침.

---

## 1차 사료 (15 links)

### 베이글코드 자체
- [Bagelcode About](https://www.bagelcode.com/en/about-en/)
- [Bagelcode Business / Games](https://www.bagelcode.com/en/business-en/games/)
- [베이글코드 [직무소개] 개발직군을 소개합니다 (Medium)](https://medium.com/bagelcode/베이글코드-개발직군을-소개합니다-b72f12ade94)
- [Bagelcode Career](https://career.bagelcode.com/)
- [신작팀 Artist UI/UX 공고](https://career.bagelcode.com/ko/o/152293)
- [Club Vegas Google Play](https://play.google.com/store/apps/details?id=com.bagelcode.slots1)
- [Bagelcode developer page (AppBrain)](https://www.appbrain.com/dev/Bagelcode:+Social+Casino+&+Slot+Machine+Games/)

### 한국 경쟁사
- [더블유게임즈 팍시게임즈 AI 캐주얼 45종 (ZDNet 2026-03-24)](https://zdnet.co.kr/view/?no=20260324155057)

### 유사 장르 leader
- [Royal Match Wikipedia (Unity 명시)](https://en.wikipedia.org/wiki/Royal_Match)
- [Royal Match Revenue 2026 (Business of Apps)](https://www.businessofapps.com/data/royal-match-statistics/)
- [Royal Match surpasses Candy Crush (Sensor Tower)](https://sensortower.com/blog/royal-match-surpasses-candy-crush-saga-in-revenue-and-downloads-for-the)

### 산업 stack 동향
- [Best mobile game engines 2026 (App Radar)](https://appradar.com/blog/mobile-game-engines-development-platforms)
- [Frameworks Behind Online Slot Games (Phaser/Pixi/Unity)](https://makemoneywithoutajob.com/frameworks-behind-online-slot-games-phaser-pixijs-unity/)
- [Casino Game Development Frameworks 2026](https://bettoblock.com/casino-game-development-frameworks-for-enterprises/)
- [Slot Machine Game in 2026 Complete Guide (SDLC Corp)](https://sdlccorp.com/post/how-to-create-a-slot-machine-game/)

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-mobile-game-tech-2026]] — Phaser 결정의 자세한 spec
- [[bagelcode-team-profile]] — 베이글코드 페르소나 (이 페이지 사실로 갱신 가능)
- [[bagelcode-davis-system]] — DATA&AI 팀 stack (Databricks/AWS)
- [[bagelcode-ai-first-culture]] — AI Lab + AI workflow trend (팍시게임즈 정합)
- [[bagelcode-production-cases-2026]] — 산업 cases sister
- [[bagelcode-recruitment-task]] — "기획자→게임" 메일 verbatim
