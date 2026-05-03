---
title: Bagelcode Task — Assets to Leverage from Kiki/AppMaker
category: synthesis
tags: [bagelcode, kiki, kiki-appmaker, leverage, multi-agent, reuse]
sources:
  - "[[kiki]]"
  - "[[kiki-appmaker]]"
created: 2026-05-01
updated: 2026-05-01
---

# Bagelcode Task — Organizing Kiki/AppMaker Reuse Context

> Inventory of **assets already on hand** that can be cut down for the task requirements (2+ agents communicating, user intervention/observation). Don't write from scratch — stack on top of validated patterns.

## Asset inventory — units that can be cut and reused

### 1) Sandwich Identity (kiki-appmaker)

The **4-section system prompt sandwich** from [[kiki-appmaker-orchestration]]:

```
§ 1. Engineering-team contract  (역할 + routing 규칙)
§ 2. Stage template             (per-agent 본문)
§ 3. bkit L4 footer             (도구 호출 강제 + audit log)
§ 4. Routing enforcement        (Agent 도구 금지, 단계 스킵 금지, STOP)
```

**Application to the task:**
- Inject a **thin sandwich** into each coding agent (Claude Code / Codex / Gemini)
- § 1 = "who you are and whom you PATCH"
- § 4 = "STOP when your stage finishes" — blocks the most common multi-agent failure mode
- The submission `.md` folder includes the sandwich files verbatim (meets the recruitment requirement)

### 2) Hub-Spoke Pattern (kiki)

[[hub-spoke-pattern]] — Hub agent triages, only Spoke agents wake.

| Dimension | Value |
|---|---|
| Token savings | **55-60%** vs flat structure |
| Hub | Wide and shallow context (product map) |
| Spoke | Narrow and deep context (own domain only) |

**Application to the task:**
- Start with a simple "Coordinator + Workers" topology
- Coordinator = classify user input + invoke the appropriate Worker
- Worker = domain-specialized (e.g. code / research / docs)
- Isomorphic to the **Agent Router** pattern in DAVIS ([[bagelcode-davis-system]])

### 3) Slack-Style Intent Classifier (kiki)

[[kiki-slack-integration]] — 9 Intents + regex priority + Pipeline notifier.

```
@bot status     → 직답
@bot pipeline   → 직답
@bot ENG-38     → 이슈 상세
@bot create ... → agent invoke
@bot wake X     → 특정 에이전트 깨우기
```

**Application to the task:**
- Unify user commands into a single-line **`@coordinator`**-style prefix → branch between direct-answer vs agent invocation
- Meets the "user can intervene" requirement: micro-controls like `@coordinator pause` `@<agent> rephrase` even mid-flight
- Observability: a one-line event stream like kiki's Pipeline Notifier — `[NEW] task-7: ...` `[ASSIGN] task-7 → coder`

### 4) PDCA / Stage Workflow (kiki-appmaker)

[[kiki-appmaker-pdca]] — Plan → Design → Do → Check → Act.

```
사용자 prompt
  → Plan (PM Lead)        → SPEC.md
  → Design (CDO Lead)     → DESIGN_SYSTEM.md
  → Do (CTO Lead)         → output/
  → Check (QA Lead)       → QA_REPORT.md
  → Act (자동 판정)       → 합격 / 재작업 max 3회
```

**Application to the task (pick one of two):**
- **Option A (conservative)**: simplify the same PDCA into 2 agents — Planner ↔ Doer ping-pong
- **Option B (extended)**: 3 agents (Planner + Coder + Critic) — Critic decides pass/rework. Higher scoring visibility.

### 5) Scorecard Guards (kiki)

[[kiki-scorecard-guards]] — C1-C21 guardrails. The most useful for the task:

| Guard | Rule | Application to the task |
|---|---|---|
| C2 | PO Spec Gate (no progress without spec) | Coder can't run without a Planner artifact |
| C8 | Self-done block (Lead Scorecard required) | Coder can't PASS itself → Critic mandatory |
| C10 | Release block (no Acceptance, no go) | Final output only after user OK |
| C14 | Auto error recovery (wake after 10s) | Auto-retry on agent failure |
| C18 | Load balancing (least-loaded peer) | Auto-distribute when 2+ workers share a role |

**Application to the task:**
- Turns "two agents exchange messages" from trivial ping-pong into **contract-based dialogue**
- Adding a Critic agent naturally creates a "user intervention/observation" point (user holds veto over the Critic)

### 6) AppMaker Routing Enforcement (kiki-appmaker)

[[kiki-appmaker-orchestration]] § 4 anti-pattern bans:

| Forbidden | Reason | Borrowing for the task |
|---|---|---|
| Using `Agent` / `Task` tool | Sub-agent dispatch violates single stage owner | Block agents from spawning sub-agents at will |
| Skipping stages | Breaks the production path | No Coder direct-jump bypassing Planner |
| Greedy next-stage | "Trying to help" motive crosses lines | Do only your own turn, then STOP |
| Routing bypass | Audit log gaps | All handoffs via explicit messages |

→ **Pin these 4 anti-patterns into the README.** When the evaluator reads it, signal: "this person knows multi-agent failure modes."

### 7) Karpathy 5-principle mapping (kiki-appmaker)

| Principle | Meaning | Application to the task |
|---|---|---|
| **P1: Constraints First** | Define CANNOT first, then CAN freely | sandwich § 4 = bans first |
| **P2: Explore Before Act** | read before edit, grep before reference | Planner reads code before writing SPEC |
| **P3: Minimal Viable Change** | One thing at a time | Stage separation enforces it naturally |
| **P4: Anti-Deception Ratchet** | No fake green | Critic measures (run tests + verify results) |
| **P5: Git as State Machine** | commit = evidence | Message log is the state machine — aligns with the JSONL submission requirement |

## Mapping to DAVIS

Restating the DAVIS pattern ([[bagelcode-davis-system]]) in terms of kiki/AppMaker assets:

| DAVIS | kiki asset | AppMaker asset |
|---|---|---|
| Slack bot UI | [[kiki-slack-integration]] | — |
| Agent Router | [[hub-spoke-pattern]] CTO | [[kiki-appmaker-orchestration]] § 1 routing |
| Per-domain Genie Space | engineering-team 9 spokes | 17-agent role |
| Genie Instructions | system prompt sandwich § 1, § 2 | sandwich §1+§2 |
| dbt YAML metadata | Profile schema (kiki) | agent role md |
| User feedback loop | [[kiki-feedback-loop]] | bkit audit log |

→ **This mapping is the blueprint for "a task solution tuned to Bagelcode's tone."**

## Absolutely do not bring in (rationale)

| Asset | Why exclude |
|---|---|
| Paperclip API dependency | External infra — breaks the "README runs immediately" requirement |
| Full 17-agent / 12-agent roster | Out of scope. Coordinator + 2 workers is enough |
| `.bkit/` runtime | A disk-backed state machine is overkill for a single demo |
| `getdesign` collection install | UI design is not the essence of the task |
| dual squad / Dev1·Dev2 | Noise to the evaluator |

→ **Excluding is also a signal.** Consistent with the Bagelcode blog's "just-enough UI/UX" emphasis.

## One-line conclusion

> **Sandwich Identity + Hub-Spoke + Intent Classifier + Karpathy 5 principles**, recombined in the smallest possible cuts. Everything else is trimmed.

## See also

- [[bagelcode]] — project hub
- [[bagelcode-task-direction]] — how to bundle the assets above (direction)
- [[bagelcode-team-profile]] — team persona
- [[kiki]] / [[kiki-appmaker]] — source assets
- [[hub-spoke-pattern]] / [[kiki-appmaker-orchestration]] / [[kiki-slack-integration]] / [[kiki-scorecard-guards]] / [[kiki-appmaker-pdca]]
