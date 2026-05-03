---
title: Bagelcode New-Title Team Persona — Recruitment-Tone Synthesis
category: synthesis
tags: [bagelcode, team-profile, recruitment, ai-first, persona]
sources:
  - "[[bagelcode-recruitment-task]]"
  - "[[bagelcode-davis-system]]"
  - "[[bagelcode-ai-first-culture]]"
created: 2026-05-01
updated: 2026-05-01
---

# Bagelcode New-Title Team — Persona Synthesis

> **Synthesis of the team's culture, technology, and evaluation tone** extracted from the recruitment mail + 2 blog posts. A hypothesis to align on before settling the task direction.

## Company — one line

A global operator of social-casino / casual games. A **data- and AI-centric organization** running 10,000+ tables and 1,000+ dashboards. AI-First culture is currently propagating company-wide.

## New-title team = the new line within the Mobile Casual team

Direct quote from the recruitment mail:

- *"베이글코드 모바일 캐주얼팀은 AI 에이전트를 제품 제작의 핵심 도구로 사용"* (The Bagelcode Mobile Casual team uses AI agents as the core tool for product creation)
- *"기획자는 에이전트에게 게임을 만들게 한다"* (Planners have agents build games)
- *"엔지니어는 에이전트의 능력을 확장한다"* (Engineers extend agents' capabilities)

→ **Both job families stand on the same agent toolset.** AI engineer = the person who builds the tools planners will use.

## Tools used — verbatim

> *"Claude Code, Codex, Gemini CLI 등 다양한 에이전트를 동시에 사용"* (Concurrent use of multiple agents including Claude Code, Codex, Gemini CLI)

→ **Deliberately avoiding vendor lock-in.** Multi-model / multi-coding-agent concurrent operation.
→ Implication: a task solution tied to one model/one agent is a minus. **Adapter abstraction** is a natural plus.

## Pain point — verbatim

> *"이들 간의 협업이 점점 중요해지고 있습니다"* (Collaboration between them is becoming increasingly important)

→ **An ongoing problem.** The Bagelcode new-title team itself is in the middle of solving multi-agent collaboration. The task is **the research problem itself** — there's no right answer, so ideas tuned to Bagelcode's tone gain an evaluation edge.

## Technical signals (synthesized from the blog)

| Signal | Evidence |
|---|---|
| Slack as the #1 user interface | DAVIS = Slack bot, AI Help for Beginner channel, AI news Slack bot |
| No hesitation about managed delegation | DAVIS migrated from in-house RAG → Genie API |
| Codifying metadata | dbt YAML, MCP instructions, "documentation for AI reuse" |
| Short cycles + voluntary adoption | BagelJam:Dev 2-day hackathon, TODOS 3-day build, "permeating change, not coercion" |
| Design baseline shifting from human → agent | "Don't spend time on prettying up", CLI/MCP first |
| Preference for the Router pattern | DAVIS Agent Router 2-stage routing |

## Cultural signals

- **Autonomy ≫ coercion** — TODOS quote: "each team doing it themselves is best"
- **Practical ≫ flashy** — AI-First blog: "if it's AI-friendly, no need to make it pretty"
- **Context sharing ≫ commands** — Principle #1
- **Structure repeated patterns immediately** — Principle #4 "skill/rule creation"

## What Bagelcode considers a good candidate (mail + blog synthesis)

1. **Someone who can carve a prototype in 3 days** (TODOS 3 days, BagelJam:Dev 2 days)
2. **Someone who can design interfaces usable by both agents and humans**
3. **Someone who treats instructions (.md) as code** — the mail explicitly requires ".md included"
4. **Someone who handles multi-model/multi-agent naturally** — Claude/Codex/Gemini all mentioned
5. **Someone with both planner-engineer thinking** — mail: *"기획 역량 기대"* (planning capability expected)
6. **Someone who delivers a working README** — self-evident; failure is an instant cut

## Open hypotheses (need confirmation)

- [ ] New-title team size / reporting structure — augment after obtaining the posting body ([[bagelcode-job-posting-208045]])
- [ ] Tech stack (backend / mobile / game engine) — posting not yet obtained
- [ ] Game genre (beyond "mobile casual") — posting not yet obtained
- [ ] Default model — blog suggests heavy Claude usage but not officially confirmed

## Estimated evaluation priority

High → low:

1. **README runs immediately** (instant cut on failure)
2. **Two agents exchange meaningful messages** (no trivial echo)
3. **Clarity of user intervention/observation** (observable + interruptible)
4. **Quality of `.md` instructions** — sandwich, skill patterns visible = bonus
5. **Readability of session log/recording** — exposes "how this person works with agents"
6. **Originality** — the mail explicitly states "독창적인 아이디어" (original ideas)
7. **Extensibility** — should not look like a one-shot demo

## See also

- [[bagelcode]] — project hub
- [[bagelcode-recruitment-task]] — original mail
- [[bagelcode-davis-system]] / [[bagelcode-ai-first-culture]]
- [[bagelcode-task-direction]] — page that ties the signals above into a task concept
- [[bagelcode-kiki-leverage]] — assets to bring in
