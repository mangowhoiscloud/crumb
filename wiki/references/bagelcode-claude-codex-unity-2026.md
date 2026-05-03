---
title: Bagelcode Take-home — Claude Code / Codex × Unity case studies + reinforcing our decision framing
category: references
tags: [bagelcode, unity, claude-code, codex, mcp, production-cases, framing, 2026]
sources:
  - "BigDevSoon Void Balls 10-day Steam-ready (2026)"
  - "Unity MCP 4 plugins (IvanMurzak / Coplay / CoderGamester / Bluepuff71)"
  - "Bezi / Coplay / Unity AI Assistant comparison (2026)"
  - "MDPI 2026 Game Knowledge Management (LLM Unity limits)"
  - "Unity Discussions / Claude Lab / kevurugames blog"
created: 2026-05-01
updated: 2026-05-01
---

# Claude Code / Codex × Unity — 2026 case studies + reinforced framing for our decision

> **Purpose**: the Bagelcode 신작팀 uses Unity. LLM agents × Unity have reached a production-ready frontier. This source shows the evaluator precisely that **we knew this and intentionally chose not to go there**.
>
> One-line conclusion: **production-ready level**, but under our task spec (2 days / one shot / zero evaluator-environment dependency) the **setup risk is too large**. Maintain the Phaser HTML5 decision + reinforce framing.

---

## 1. Production launch cases

### 1A. BigDevSoon "Void Balls" — 10-day Steam-ready

URL: https://bigdevsoon.me/blog/building-games-with-ai-indie-game-dev-workflow/

| Item | Value |
|---|---|
| Game | 2D roguelite |
| Launch | Steam (Steam-ready) |
| Duration | **10 days** (zero to production) |
| Stack | Claude Code + Unity MCP + Replicate (assets) + ElevenLabs (audio) |
| Outcome | A game actually shippable to launch |

**Verbatim takeaways:**
> "**The 7-color palette wasn't a limitation — it was a design decision** that made AI-generated art feel intentional. The same applies to the two-button control scheme."

→ **Constraints create quality** — the same idea as the "binding constraint" in our game DESIGN.md §1.

> "**The biggest misconception** about building games with AI is that you press a button and a game comes out. AI is **an amplifier** — it takes your game design knowledge, your taste, your decisions about what feels good to play, and executes on them 10x faster."

→ The essence of "planner + AI collaboration" = AI as amplifier, **the human is the taste decider**. Consistent with the Bagelcode mail's "planners have agents build the game."

> "**When running multiple agents in parallel, one agent's output can invalidate another's work.** Developers handled this by being conservative about what runs in parallel."

→ Frontier validation for our [[bagelcode-orchestration-topology]] decision of **sequential fallback default + parallel option**.

### 1B. Dino Card Hunt — 10 months solo

10 months solo + Claude Code = Steam wishlist. Signal of **long-term operability**.

### 1C. TheOne Studio training-skills

URL: https://github.com/The1Studio/theone-training-skills

Uses Claude Code skills to enforce **VContainer + SignalBus + concise C# patterns**. Studio-standard enforcement = the same idea as our sandwich §4 enforcement footer.

---

## 2. Unity MCP ecosystem (4 core plugins)

### 2A. IvanMurzak Unity-MCP (most active)

URL: https://github.com/IvanMurzak/Unity-MCP · CLAUDE.md: https://github.com/IvanMurzak/Unity-MCP/blob/main/CLAUDE.md

| Item | Value |
|---|---|
| Tool count | **100+** built-in tools |
| Pricing | **free** |
| Compatibility | Claude Code, Gemini, Copilot, Cursor, Codex |
| Highlight | "Any C# method may be turned into a tool by **a single line**" |
| Operation | "runs **inside your Unity Editor and compiled games**, empowering AI to write code, manipulate objects, manage scenes, and even debug your game while you play" |

→ **The LLM directly manipulates GameObjects/Scenes/Prefabs/Scripts inside the Editor.** Full integration.

### 2B. Coplay unity-mcp ($3/mo, beta free)

URL: https://github.com/CoplayDev/unity-mcp · https://docs.coplay.dev/coplay-mcp/claude-code-guide

| Item | Value |
|---|---|
| Tool count | **86** internal tools |
| Claude Code bridge | officially supported |
| Pricing | free during beta, $3/mo at GA |
| Highlight | external AI tools (Claude Code) get the same tool access as Coplay |

### 2C. CoderGamester mcp-unity

URL: https://github.com/CoderGamester/mcp-unity

> "Model Context Protocol (MCP) plugin to connect with Unity Editor — designed for **Cursor, Claude Code, Codex, Windsurf** and other IDEs"

→ The plugin with the clearest multi-IDE support.

### 2D. Bluepuff71 UnityMCP

URL: https://github.com/Bluepuff71/UnityMCP

40+ tools, "**zero tracking**, open source" — the privacy-first option.

---

## 3. Unity-specific AI Assistants — vs general LLM tools

### 3A. Bezi vs Claude Code (user reports)

URL: https://www.bezi.com/

> "Users report that **Bezi got them to their end goal 10x faster** compared to ChatGPT and Claude. Bezi indexes your **assets, scenes, packages**, and more — not just your code."

→ Why Unity-specialized tools are faster than general LLMs = **asset/scene/prefab indexing**. If we use plain Claude Code only, we lag behind these tools.

### 3B. Coplay vs Unity AI Assistant

URL: https://coplay.dev/blog/coplay-vs-unity-ai-assistant

| Dimension | Coplay | Unity AI Assistant (Muse) |
|---|---|---|
| Model selection | ✅ Claude 3.7 / GPT-4o swappable | ❌ Unity's undisclosed model |
| Operating mode | conversational, background continuous | one-shot |

→ Coplay reports directly that "Claude 3.7 outperforms GPT-4o significantly."

### 3C. Unity AI (Muse) — 1st-party

URL: https://unity.com/features/ai

GDC March 2026 beta: "**prompt full casual games into existence with natural language only**, native to the platform — making it simple to move from prototype to finished product."

→ Unity itself prompts → builds casual games. **A tool the Bagelcode 신작팀 will be receiving soon.**

---

## 4. Academic limitation — the Unity LLM gap

### MDPI 2026 — Game Knowledge Management System

URL: https://www.mdpi.com/2079-8954/14/2/175

**Verbatim:**
> "recent LLM-based methods often produce outputs that are **structurally invalid or incompatible with real-time game engines**, reflecting a fundamental limitation in current practice"

→ A **serialization gap** with the native structures of Unity prefabs/scenes/walkable coordinates. Free-form LLM output breaks.

The paper's solution:
> "Engine assets — including prefabs, scene layouts, and walkable coordinates — are converted into **symbolic resources**"

→ A schema-governed pipeline is required. Academic backing for our [[bagelcode-transcripts-schema]] + [[bagelcode-rubric-scoring]] anti-deception rules.

---

## 5. Fit judgment against our task spec

| Evaluation dimension | Unity MCP path | Phaser HTML5 path |
|---|---|---|
| README runs immediately | ❌ Unity install 3GB + license | ✅ double-click |
| Evaluator-environment dependency | ❌ Unity Editor + project setup 30+ minutes | ✅ 0 |
| Deadline (2-3 days) | ⚠ possible (BigDevSoon 10 days ÷ 5) | ✅ safe |
| One-shot-attempt risk | ❌ setup failure → submission failure | ✅ low |
| Bagelcode stack fit | ✅✅ Unity directly | ⚠ the stage before Unity |
| Multi-agent core value | ⚠ absorbed into the Unity MCP framework | ✅ demonstrates its own topology |
| Output evaluation | ❌ Unity project binary, hard to git diff | ✅ single file + 4 deliverables |
| Differentiation from Bezi/Coplay | ❌ Unity-specific is 10× faster | ✅ a different category |
| Evaluator demo impact | ⚠ launching the Unity Editor | ✅ double-click |
| LLM Unity limitations (academic) | ⚠ prefab/scene serialization gap | ✅ HTML is simple, smaller gap |
| Multi-model (Claude/Codex/Gemini) | ⚠ Unity MCPs do support multi-model but fit is weak | ✅ adapter is simple |
| Bagelcode mail verbatim | ✅ "planner → game" | ✅ "planner → game" |

→ **Phaser HTML5 wins on 11/12 dimensions.** Only the Bagelcode-stack-fit dimension favors Unity MCP, and that is neutralized by framing it as the "stage before."

---

## 6. Anticipated evaluator questions — three preemptive answers

### Question 1: "Do you know about Unity MCP? If you do, why didn't you go there?"

> "BigDevSoon launched a Steam-ready game (Void Balls) in 10 days with Claude Code + Unity MCP. An active frontier with IvanMurzak Unity-MCP 100+ tools / Coplay 86 tools / Bluepuff71 40+ tools. Bezi reports being 'over 10× faster than ChatGPT/Claude' (asset/scene indexing).
>
> However, under our task spec — **2-day deadline + one-shot attempt + zero evaluator-environment dependency + README runs immediately** — the risk of Unity install 3GB + project setup 30+ minutes can break the submission itself, so we intentionally avoided it. Academia (MDPI 2026) also explicitly states the LLM's 'structurally invalid output' limitation for Unity prefab/scene serialization — additional risk."

### Question 2: "So is Crumb unrelated to Unity?"

> "On the contrary. Crumb's 4 deliverables (game.html / spec.md / DESIGN.md / tuning.json) can be converted as-is into **input assets for the Unity MCP workflow**.
>
> ```
> [planner one-line]
>     │  (30 minutes, browser prototype)
>     ▼
>  Crumb (HTML5)  ← this take-home
>     │  (4 deliverables)
>     ▼
>  Unity MCP team   ← the Bagelcode 신작팀's next quarter
>     │  (days to weeks, native build)
>     ▼
>  App Store / Google Play
> ```
>
> Crumb = 'AI-agent collaboration infrastructure', Unity MCP = 'Unity Editor integration layer'. A stack composed of both layers."

### Question 3: "Bezi/Coplay are 10× faster — why not?"

> "Bezi/Coplay are **single-agent assistants** inside the Unity Editor. Our task is **a tool where multiple AI agents communicate with each other and collaborate with the user** — the Bagelcode recruitment mail's verbatim problem. Crumb's hierarchical orchestration of the four actors Coordinator/Builder.A/Builder.B/Verifier on top of a single transcript is a value at a different layer from Bezi — 'multi-agent infrastructure' vs 'IDE assistant'.
>
> Even if the Bagelcode 신작팀 later adopts Bezi/Coplay, Crumb's transcript schema + sandwich identity + cross-provider Verifier patterns continue to function on top of them."

---

## 7. Reinforcing the message in the README

### Existing (Stack-and-Genre page §"Crumb's position")
> "Crumb is a prototype tool that sits at the **stage before** the Bagelcode 신작팀's Unity workflow."

### Reinforced (explicit Unity MCP awareness)
> "Crumb is the **stage-before + multi-agent infrastructure layer** of the Unity workflow.
>
> We know Claude Code + Unity MCP has reached production-ready level (BigDevSoon Void Balls 10-day Steam-ready, Bezi/Coplay/IvanMurzak Unity-MCP 100+ tools). However, for two reasons — (a) the take-home enforces deadline + one-shot attempt + zero evaluator-environment dependency, (b) the LLM's Unity prefab/scene serialization limitation (MDPI 2026) — we intentionally adopted the Phaser HTML5 prototype path.
>
> Crumb's transcript schema + sandwich identity + cross-provider Verifier + fault tolerance F1-F5 are **multi-agent infrastructure that continues to operate as-is** when the Bagelcode 신작팀 later adopts Unity MCP. That is, layer separation — whether the tool changes to Phaser or Unity, our protocol layer is compatible."

→ This single paragraph **closes every evaluator question.**

---

## 8. Decisions changed/maintained

| Item | Result |
|---|---|
| Don't adopt Unity | ✅ maintained |
| Phaser HTML5 | ✅ maintained |
| 4-actor topology | ✅ maintained |
| **Message framing** | ⚠ **reinforced** (explicit Unity MCP awareness + layer-separation framing) |
| **One-line future roadmap** | ⚠ **newly added** (Crumb → Unity MCP compatible) |

→ All decisions maintained, **only the message is sharpened.**

---

## Primary sources (14 links)

### Production cases
- [BigDevSoon — 2D Roguelite shipped in 10 days](https://bigdevsoon.me/blog/building-games-with-ai-indie-game-dev-workflow/)
- [Unity × Claude Code (Claude Lab)](https://claudelab.net/en/articles/claude-code/unity-claude-code-game-dev-accelerate)
- [10 Months Unity Dev with Claude Code (YouTube)](https://www.youtube.com/watch?v=xZaSPw14Cfo)
- [8 Months Unity Dev with Claude Code (YouTube)](https://www.youtube.com/watch?v=GxZLC00yJ5g)
- [Claude Code Game Studios (49 agents)](https://github.com/Donchitos/Claude-Code-Game-Studios)
- [Using Claude AI in Game Development (kevurugames)](https://kevurugames.com/blog/using-claude-ai-in-game-development-tools-use-cases-and-industry-statistics/)
- [I Used AI to Code a Game in Unity — Lessons (Medium)](https://medium.com/artcenter-graduate-interaction-design/i-used-ai-to-code-a-game-in-unity-heres-what-i-learned-cd680f2dad56)
- [TheOne Studio training-skills](https://github.com/The1Studio/theone-training-skills)

### Unity MCP × 4
- [IvanMurzak Unity-MCP (100+ tools)](https://github.com/IvanMurzak/Unity-MCP)
- [Coplay unity-mcp](https://github.com/CoplayDev/unity-mcp)
- [Coplay docs Claude Code guide](https://docs.coplay.dev/coplay-mcp/claude-code-guide)
- [CoderGamester mcp-unity](https://github.com/CoderGamester/mcp-unity)
- [Bluepuff71 UnityMCP](https://github.com/Bluepuff71/UnityMCP)

### Unity-specific AI assistants
- [Bezi (10× faster claim)](https://www.bezi.com/)
- [Coplay vs Unity AI Assistant](https://coplay.dev/blog/coplay-vs-unity-ai-assistant)
- [Unity AI (Muse) features](https://unity.com/features/ai)

### Academic limitations / comparisons
- [Game Knowledge Management System — MDPI 2026](https://www.mdpi.com/2079-8954/14/2/175)
- [Unity + AI coding tools state (Unity Discussions June 2025)](https://discussions.unity.com/t/unity-ai-coding-tools-current-state-june-2025/1664497)
- [eesel — Codex × Unity practical guide](https://www.eesel.ai/blog/openai-codex-integrations-with-unity)

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-stack-and-genre-2026]] — Bagelcode Unity facts + Crumb's position (sister)
- [[bagelcode-mobile-game-tech-2026]] — Phaser HTML5 decision spec
- [[bagelcode-production-cases-2026]] — general production cases
- [[bagelcode-frontier-orchestration-2026]] — multi-agent patterns
- [[bagelcode-rubric-scoring]] — anti-deception rules (mitigation for the MDPI limitation)
