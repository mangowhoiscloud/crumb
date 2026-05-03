---
title: Bagelcode AI-First Culture — Agents for Agents
category: references
tags: [bagelcode, ai-first, culture, agent-design, todos, ai-lab]
sources:
  - "https://www.bagelcode.com/article/ai-first-wiht-bagels-에이전트를-만들다-에이전트를-위해-만들다/"
created: 2026-05-01
updated: 2026-05-01
---

# Bagelcode AI-First Culture — Agents for Agents

> Summary of the Bagelcode official blog post. **The AI Lab team / definition of AI-First / TODOS case study / dual design for humans and agents**. The cultural source that most directly conveys the tone and evaluation criteria of the recruitment task.

## One-line summary

Bagelcode's AI-First treats **AI not as a tool but as a collaboration partner**. So even when building tools, they don't make UIs *for humans only* — they design them in a form **that agents can also use**.

## Definition of AI-First

> "에이전트와 함께 성장의 영역을 넓혀가는 여정." (*A journey of expanding the territory of growth together with agents.*)

→ Not one-off automation but an operational model in which humans and AI evolve together. "Change that seeps in" — no coercion, voluntary adoption.

## The role of the AI Lab team

- AI trend research + applying it to actual work
- Building tools directly + deploying internally
- Contributing to company-wide productivity gains

**Representative outputs**: Codebase, ScreenStealer, AI News Slack bot, **TODOS** (case study).

## Five principles for collaborating with agents (extracted from the blog)

1. **Not commands but "context-sharing communication"** — sharing context rather than issuing simple instructions
2. **Multi-agent parallel processing** — multiple agents at the same time
3. **Documentation for AI reuse** — document so the same task isn't requested twice
4. **Structuring repetitive work** — solidify patterns by creating skills/rules
5. **Use existing tools + build only the personalization edges yourself** — no full-stack build, only the edges

## TODOS case study (a real-world signal)

| Item | Content |
|---|---|
| Problem | Jira is overkill + Slack Canvas is inefficient |
| Solution | **3-day build** — emphasizing simple UI/UX |
| Diffusion | Rather than automating, **support each team's autonomous customization** |
| Quote | "제가 세팅만 해드리면 돼요. 각 팀이 직접 하는 게 최고죠" (*I just need to set it up — it's best when each team does it themselves.*) |

**Implications:**
- Bagelcode **treats the cycle of evolving a 3-day prototype into production as a standard** (consistent with [[bagelcode-davis-system]]'s 2-day BagelJam:Dev hackathon)
- **Lightweight tools + each team's autonomous operation rather than full-stack solutions** — the take-home is also no full SaaS, but a single clear tool

## The shift in design criteria (most decisive)

**Past**: human-centric web interface → designed to look pretty.
**Present**: **design that agents can also leverage**. Considering CLI, MCP, etc.

> "AI 친화적으로 할 거면 굳이 예쁘게 만드는 데 시간을 많이 들일 필요가 없었던 거예요" (*If we're going to be AI-friendly, there was really no need to spend a lot of time making things pretty.*)

**Core implications (directly tied to the take-home):**
- UI flair < agent compatibility (CLI / API / MCP / message protocols)
- The "user intervenes/observes during collaboration" requirement = simultaneously agent-friendly and human-friendly (a dual interface)
- README must "work" = a human can run it instantly, an agent can call it instantly

## Signals of organizational-culture change

- The **AI Help for Beginner** Slack channel is active — the learning channel is alive
- **AI Fair / game jams** — hands-on culture is established
- "**Not coercion but seeping change**" — not pushed by policy but voluntarily adopted

→ **Recruitment signal**: they're not looking for someone proficient at AI, but for **someone who naturally weaves AI into their own workflow**. They look for candidates who show "traces of having actually built something with agents."

## Direct mapping to the recruitment task

| Blog message | Relation to task requirements |
|---|---|
| "AI collaboration = context-sharing communication" | The essence of the "user intervenes/observes during collaboration" requirement |
| "Multi-agent parallel processing" | "Two or more AI agents exchanging messages" |
| "Documentation for AI reuse" | Submission explicitly requires ".md files included" |
| "Structuring repetitive work (skills/rules)" | Signal to leverage Claude Code skills, Cursor rules |
| "Design that agents can also use" | Don't dazzle with UI — prioritize **CLI/MCP/message protocols** |
| "3-day build / simple UI" | Task deadline of 2-3 days + simplicity is a virtue |
| "Each team's autonomous customization" | Bonus points if the deliverable exposes **extension points (config/skills)** |

## What the Bagelcode 신작팀 wants to see (inferred)

Combining the recruitment mail with this blog:

1. **"Someone who can carve something out with an AI coding agent in a short time"** (3-day cycle)
2. **"Someone who can design structures where agents — and humans — naturally exchange context with each other"**
3. **"Someone with the meta-thinking to handle documents (.md) alongside tools"** — the sense that instructions are an asset as important as code
4. **"Someone who builds a working README rather than a flashy UI"** — real usefulness first
5. **"Someone who sees both the planner and engineer sides"** — the mail's "we expect planning capability"

## See also

- [[bagelcode]] — project hub
- [[bagelcode-davis-system]] — DAVIS case study (multi-agent router)
- [[bagelcode-recruitment-task]] — the recruitment-mail original text
- [[bagelcode-team-profile]] — synthesized team persona
- [[bagelcode-task-direction]] — task direction
- [[kiki-appmaker-orchestration]] — sandwich identity (the pattern of treating agent instructions as assets)
