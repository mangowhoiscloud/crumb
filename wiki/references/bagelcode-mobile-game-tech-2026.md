---
title: Bagelcode Task — LLM × mobile game cases + tools/spec (2026)
category: references
tags: [bagelcode, mobile-game, phaser, html5, unity-ai, lovable, vibe-coding, 2026]
sources:
  - "Lovable mobile app launch (TechCrunch 2026-04-28)"
  - "Unity AI beta (GDC March 2026, gamedeveloper.com)"
  - "Phaser LLM friendliness data (seeles.ai 2026)"
  - "Godot 4.6 (Jan 2026)"
  - "LLM Coding Leaderboard (llm-stats.com May 2026)"
  - "Claude-Code-Game-Studios (49 agents) + godogen (Godot+Bevy+CC+Codex)"
  - "GameDeveloper 'Unity AI prompt full casual games' (2026)"
created: 2026-05-01
updated: 2026-05-01
---

# LLM × Mobile Games — 2026 Cases + Tool Specs

> **Purpose**: primary sources for Crumb's game output format decision. Synthesizes **real-world cases of building mobile games with LLMs + per-tool specs + best fit**.
>
> **One-line conclusion**: **Phaser 3.80+ via CDN, single-file `game.html`** dominates on every axis. Lovable's App Store response + Phaser's LLM friendliness + Bagelcode's mobile casual tone all converge on the same point.

---

## 1. Pivotal case — Lovable Mobile App (2026-04-28)

URL: https://techcrunch.com/2026/04/28/lovable-launches-its-vibe-coding-app-on-ios-and-android/

### Decisive insight

> Lovable "played by the rules, generating **web-based applications** on its platform rather than downloading new executable code, which is why it's now available as a mobile app on both app stores. **Apple won't allow apps that download new code or change their functionality**, as that presents a security risk."

→ **App Store / Google Play policy itself blocks LLM-generated native binaries.** Games that AI dynamically generates **must be web** to be distributable on mobile.

→ Crumb takes the same path. The **policy-level rationale** for discarding native builds (beyond performance/setup overhead).

### Lovable's operating pattern (for reference)
- Mobile has **fewer features** than desktop (mostly "queue prompts + notifications")
- **Free-form prompt → web app generation**
- Distributed to App Store as a web wrapper

→ Consistent with our operating model: code agents produce web; evaluators view it in a browser.

---

## 2. Phaser's LLM friendliness (decisive data)

URL: https://www.seeles.ai/resources/blogs/phaser-js-game-development-2026

### The single strongest line (verbatim)

> "Phaser has been part of the training data for every major frontier LLM, with models from Anthropic, OpenAI, Google, and others understanding the Phaser API deeply"

> "AI models able to reliably generate working Phaser code on the first attempt **94% of the time, compared to 71-82% for other frameworks**"

→ Builder LLM **first-attempt success rate** is 94% vs 71-82%. In a deadline-driven, one-shot environment, the **highest-probability choice = Phaser**.

### Phaser vs competitors

| Item | Phaser 3.80+ | Three.js | Pixi.js | Babylon |
|---|---|---|---|---|
| LLM first-attempt success | **94%** | 71-82% | 71-82% | 71-82% |
| Bundle (minified) | **670KB** | ~600KB | ~450KB | 1.1MB |
| 3G load time (relative) | **2.3× faster** | baseline | similar | slow |
| Code length (relative) | **-40% shorter** | longer | rendering only | longer |
| Domain fit (casual 2D) | ✅ best | 3D-first | renderer only | 3D-first |
| Mobile / touch / scaling | ✅ built-in | manual | manual | engine-dependent |
| Physics (matter / arcade) | ✅ built-in | external | ❌ | engine-dependent |
| Scene management | ✅ built-in | manual | ❌ | engine-dependent |

→ Direct hit for the **Bagelcode mobile casual domain**. Phaser leads on 2D / 3G / mobile / touch.

### One CDN line and you're done

```html
<script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"></script>
```

→ Zero install for the evaluator. A single game.html + 1 CDN line = runs in any mobile browser.

---

## 3. Unity AI 2026 trajectory (reference only)

URL: https://www.gamedeveloper.com/programming/unity-says-its-ai-tech-will-soon-be-able-to-prompt-full-casual-games-into-existence

### Statement (verbatim)

> "Unity AI is the second major area of focus for 2026, unveiling a beta of upgraded Unity AI that will enable developers to **prompt full casual games into existence with natural language only**, native to the platform."

### Industry data

> "The 2026 Unity Game Development Report: a staggering **95% of game studios worldwide** have now adopted AI into their core workflows."

→ Bagelcode is among that 95%. Our concept can be framed as a "prototype one year ahead of this wave."

### Why we don't use Unity

| Problem | Impact |
|---|---|
| Unity install burden on the evaluator | breaks "README runs immediately" |
| Unity license / authentication | 30+ minute setup |
| Unity AI beta is GDC March 2026 = nascent | insufficient production validation |
| Builder LLM writes HTML/JS better than Unity C# | ↓ stability |
| Binary outputs like `.unitypackage` | hard to git diff / evaluate |

→ **Unity AI trends are an industry-context signal for our decision**, not an adoption candidate.

---

## 4. Godot 4.6 (Jan 2026)

URL: https://godotengine.org (indirect)

### New (Jan 2026)
- Android device mirroring
- Google Play Billing
- Google Play Games Services
- Apple StoreKit 2 integration

### LLM integration cases
- **godogen** ([github.com/htdt/godogen](https://github.com/htdt/godogen)) — autonomous Godot/Bevy game development via Claude Code + Codex
- **dev.to "Godot + Ollama"** — local LLM in-game

### Why we don't use Godot
- Godot install 50MB, evaluator burden
- Godot's HTML5 export works but bundles `index.html` + `.pck` + `.wasm` together (multi-file)
- Builder LLMs have richer training in JS than GDScript
- Phaser one-line CDN vs Godot multi-file → CDN wins

---

## 5. LLM Coding Leaderboard (May 2026)

URL: https://llm-stats.com/leaderboards/best-ai-for-coding

### HTML5 Canvas = 1 of 7 arenas

7 arenas: React + p5.js + D3.js + Three.js + SVG + Tone.js + **HTML5 Canvas game**

### Model scores (May 2026)

| Model | Arena |
|---|---|
| Boba (stealth) | 1124 |
| **Claude Sonnet 4.6** | **1105** |
| **Claude Opus 4.7** | **1064** |
| GPT-5.5 (Codex) | (below) |

→ **Our Builder.A (Claude Code Opus 4.7) + Builder.B (Codex GPT-5.5)** sit exactly at the top of the leaderboard. HTML5 Canvas as a separate evaluation arena = industry consensus that LLMs do this well.

---

## 6. Claude Code Game Studios (49 agents)

URL: https://github.com/Donchitos/Claude-Code-Game-Studios

> "Turn Claude Code into a full game dev studio — 49 AI agents, 72 workflow skills, and a complete coordination system mirroring real studio hierarchy."

### Comparison

| Item | Claude-Code-Game-Studios | gamestudio-subagents | **Our Crumb** |
|---|---|---|---|
| Agents | 49 | 12 | **4** |
| Skills | 72 | (workflow) | (sandwich §2 only) |
| Engine assumption | Unity / Unreal / Godot | Godot/Unity/Unreal choice | **HTML5 Phaser** |
| Output format | engine-specific binary | engine-specific | **single-file HTML** |
| Evaluator setup | heavy | heavy | **0** |
| Deadline-fit | ❌ | ❌ | **✅** |

→ Acknowledge that "bigger systems exist." We are intentionally small for **2-day deadline + 1-shot evaluation**.

---

## 7. WebGPU broad support (2025-2026)

> "WebGPU reached broad browser support in 2025, and Unity, Godot, and Phaser all export to WebGPU-capable targets, which opens distribution channels beyond the App Store and Google Play—including embedded games on publisher sites, Telegram mini-apps, and Chinese mini-game platforms."

→ A core trend for the **Bagelcode domain (global + Telegram mini-apps + Chinese mini-game = casual game distribution)**. Web is the future channel for mobile distribution = aligns with our decision.

→ Phaser supports WebGPU export = GPU acceleration for free as a stretch.

---

## 8. Industry statistics (Bagelcode context reinforcement)

| Statistic | Source | Bagelcode fit |
|---|---|---|
| 95% of game studios adopt AI in core workflows | Unity 2026 Report | ✅ Bagelcode is in that 95% |
| Dev cycle -40%, cost -20-30% | Unity 2026 Report | ✅ Aligns with the recruitment email tone "expand the agent's capabilities" |
| Indie prototype < 10 minutes | seeles.ai | ✅ Faster than the 3-day TODOs |
| LLM gaming prototypes weeks → minutes | seeles.ai | ✅ BagelJam:Dev 2-day acceleration |

---

## 9. Decision — our stack

### Default (pinned in Crumb's `DESIGN.md` §1)

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
Bundle:           < 60KB (game.html with everything inline)
target:           same mobile baseline
Use case:         "no internet" demo / smallest dependencies
LLM success rate: 72-82% (↓ vs Phaser)
```

→ Default is Phaser; vanilla is the option. **Within the deadline, only the default is validated.**

### Stretch — PWA

```
+ game.webmanifest
+ service-worker.js (offline)
+ Add-to-Home-Screen meta tags
+ touch-action / viewport / safe-area-inset
```

→ Add-to-home-screen on a mobile phone = native-like feel. ↑ demo impact.

---

## 10. 1-page spec to pin into the game `DESIGN.md`

Compress the above decisions into the game DESIGN.md §1 (Visual Theme & Atmosphere) of [[bagelcode-task-direction]]:

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

→ Builder.A / Builder.B sandwich §2 references this spec → automatically blocks AI slop + native build attempts.

---

## 11. One line to pin into the README

> "**Stack: Phaser 3.80+ on a single `game.html` (no bundler).** With one double-click the evaluator runs it in a desktop browser; on a phone, opening the same file's URL gives a mobile demo. This decision combines (a) Apple App Store policy (Lovable 2026-04 response), (b) Phaser's 94% LLM first-attempt success rate (vs 71-82% for other frameworks), and (c) a direct hit on Bagelcode's mobile casual domain + the 95%-studio AI adoption trend."

---

## Primary sources (8 links)

### Cases
- [Lovable Mobile App Launch (TechCrunch 2026-04-28)](https://techcrunch.com/2026/04/28/lovable-launches-its-vibe-coding-app-on-ios-and-android/)
- [Lovable Brings Vibe Coding to Smartphones (Dataconomy)](https://dataconomy.com/2026/04/29/lovable-brings-vibe-coding-to-smartphones-with-new-mobile-app/)
- [Replit launches mobile vibe coding (CNBC 2026-01-15)](https://www.cnbc.com/2026/01/15/ai-startup-replit-launches-feature-to-vibe-code-mobile-apps.html)
- [Build a Retro Game with Claude Code in 20 Minutes (Creator Economy)](https://creatoreconomy.so/p/build-a-retro-game-with-claude-code-in-20-min)

### Tools / specs
- [Phaser.js: How We Build 2D Games with JavaScript 2026 (seeles.ai)](https://www.seeles.ai/resources/blogs/phaser-js-game-development-2026)
- [Phaser GitHub (3.80+)](https://github.com/phaserjs/phaser)
- [JS Game Rendering Benchmark (15 frameworks)](https://github.com/Shirajuki/js-game-rendering-benchmark)
- [Best AI for Coding May 2026 (HTML5 Canvas arena)](https://llm-stats.com/leaderboards/best-ai-for-coding)
- [Unity AI prompt full casual games (gamedeveloper.com)](https://www.gamedeveloper.com/programming/unity-says-its-ai-tech-will-soon-be-able-to-prompt-full-casual-games-into-existence-)
- [Unity AI features (Unity)](https://unity.com/features/ai)
- [Best mobile game engines 2026 (App Radar)](https://appradar.com/blog/mobile-game-engines-development-platforms)

### LLM × Game Engine multi-agent cases
- [Claude-Code-Game-Studios (49 agents)](https://github.com/Donchitos/Claude-Code-Game-Studios)
- [godogen (Claude Code + Codex × Godot/Bevy)](https://github.com/htdt/godogen)
- [gamestudio-subagents (12 agents, mobile/casual)](https://github.com/pamirtuna/gamestudio-subagents)

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-production-cases-2026]] — sister: general production cases
- [[bagelcode-frontier-orchestration-2026]] — orchestration patterns
- [[bagelcode-agents-fixed]] — Claude Opus 4.7 + Codex GPT-5.5 at the top of the leaderboard
- [[bagelcode-rubric-scoring]] — D2 (executability) baselined on Phaser+CDN
- [[bagelcode-davis-system]] / [[bagelcode-ai-first-culture]] — Bagelcode tone (light footprint, simple)
