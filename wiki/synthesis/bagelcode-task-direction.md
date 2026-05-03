---
title: Bagelcode Task — Build Direction Decision
category: synthesis
tags: [bagelcode, task-direction, multi-agent, design-decisions, scoping]
sources:
  - "[[bagelcode-team-profile]]"
  - "[[bagelcode-kiki-leverage]]"
  - "[[bagelcode-davis-system]]"
  - "[[bagelcode-ai-first-culture]]"
created: 2026-05-01
updated: 2026-05-01
---

# Bagelcode Task — Build Direction (Decision Page)

> ⚠️ **2026-05-02 supersession (partial)**: This page's §initial proposal (Builder.A → Builder.B → Verifier (Gemini)), §"new direction = Resilient Hierarchical Builder Pair" (line 173), and the §Open Questions item "Can we set up Gemini CLI?" (line 105) are **v1-v2 vintage**. **Gemini was retired starting v0.1**; Verifier = internal CourtEval inside the Engineering Lead. Preserved as a historical record of the decision flow, but for the current decision see the supersession banner of [[bagelcode-final-design-2026]] + [[bagelcode-agents-fixed]].

> Before moving to the next stage, this page consolidates the **product concept / scope / tech choices** to agree on. Open items are marked explicitly with ❓.

## One-line core message (author's intent)

**"The smallest working slice of a multi-agent collaboration tool that the Bagelcode mobile-casual team would actually use."**

→ Not a fake demo multi-agent. A "one pair + one human" structure that can fit into an actual coding workflow.

## 3 concept candidates (pick one)

### Option A — "Pair Programming Bridge" (Coordinator + Coder + Critic)

```
User ── one-line request ──▶ Coordinator
                              │
                              ├─▶ Coder (Claude Code or Codex)
                              │      │  generate/edit
                              │      ▼
                              ├─▶ Critic (Gemini CLI)
                              │      │  measure + score + veto
                              │      ▼
                              └─▶ User (observe + intervene)
```

| Pros | Cons |
|---|---|
| All 3 agents appear (satisfies the mail's explicit Claude/Codex/Gemini) | Setup/auth burden for all 3 agents |
| Critic = a natural anchor for "user intervention" | Risk of Critic faking scores |
| Karpathy P4 (anti-deception) implemented naturally | 3-way message protocol is complex |

### Option B — "Spec ↔ Build Pingpong" (Planner + Builder)

```
User ── request ──▶ Planner (Claude Code) ── SPEC.md ──▶ Builder (Codex)
                       ▲                                    │
                       └──── question/objection (channel) ──┘
                                       │
                                  user chats in
```

| Pros | Cons |
|---|---|
| Smallest and most solid — minimum 2 agents | Weak relative to the mail naming all 3 |
| PDCA's Plan↔Do ping-pong is natural ([[kiki-appmaker-pdca]]) | Risk of looking ordinary on "originality" |
| Sandwich application of instruction assets is clean | Without a Critic, fake-green risk |

### Option C — "Game Designer ↔ Game Coder" (domain-specialized)

> Direct response to the mail's "designers have agents make games."

```
User (designer) ── game idea ──▶ Designer Agent (spec/rulebook)
                                       │
                                       ▼
                                  Coder Agent (HTML/JS canvas mini-game)
                                       │
                                       ▼
                                  user plays + feedback
                                       │
                                       ▼
                                  (Designer takes it back and tunes rules)
```

| Pros | Cons |
|---|---|
| **Bagelcode-domain bullseye** — a game company's tool to make games | Going deep into the domain can eat time |
| Bullseye on the "expects design ability" line | Immediate minus if the actual game doesn't run |
| Demo is the most impactful | Burdens evaluators with a game-runtime setup |

## Recommendation — **Variant of A (start with 2 agents) → add Critic if time remains, or color it with C's domain**

Reasons:
- The "etc." in "Claude Code, Codex, Gemini CLI etc." doesn't mandate all three. **2 agents + user intervention** is the literal mail condition.
- [[bagelcode-team-profile]]: "prototype within 3 days" / "simple UI/UX" / "agents and humans alike" → **B as skeleton, A's Critic as an option**.
- "Expects design ability" → in the README intro, demo one Option C game case — just enough to color the domain tone.

## Tech choices (tentative)

| Area | Choice | Reason |
|---|---|---|
| Communication | **append-only JSONL message log + file watch** | One asset that satisfies "agent session log (JSONL)" submission requirement. README runs without a separate IPC infra. |
| Routing | Coordinator process (Node.js or Python CLI) | Minimal dependencies |
| Agent invocation | **Claude Code SDK / Codex CLI / Gemini CLI** subprocess | Call each vendor's official entry point |
| UI | **One terminal TUI pane + one web observer pane** | Both sides of "user intervention + observation". TUI = intervention, web = observation |
| Instructions | sandwich 4-section ([[kiki-appmaker-orchestration]]) per-agent `.md` | Satisfies submission "include .md files" |
| State machine | issue-like states (`todo/in_progress/review/done`) | Inspired by [[kiki-scorecard-guards]] |

❓ **Need to review:**
- [ ] Which coding agents has the candidate used? (Codex CLI auth-setup burden level)
- [ ] Can Gemini CLI also be set up? (Option A depends on it)
- [ ] Demo presentation: live or recorded?
- [ ] Can the GitHub repo be public? (review-convenience vs zip)

## Scope — IN / OUT

**IN (must):**
- 1 README — setup → run within 5 minutes
- `.md` instruction folder — coordinator/agents/ structure + sandwich 4-section
- Message-protocol spec (1 page)
- JSONL session log
- Short demo recording (1-3 min)

**OUT (absolutely not — [[bagelcode-kiki-leverage]] §"Don't bring"):**
- Paperclip / external SaaS dependency
- Dashboards / pretty UI
- 17-agent full set
- `.bkit/`-style custom runtime
- Game-engine integration
- DB / persistence infra (file + JSONL is enough)

## Risk signals + preemptive defenses

| Risk | Mitigation |
|---|---|
| Slow Codex/Gemini setup breaks the README | Claude Code single mode + Codex/Gemini adapter stubs separated. Show real setup in the demo recording. |
| Two agents do trivial echo only | Planner SPEC ↔ Coder output ↔ Critic scoring — bake meaningful differences into the protocol |
| Weak "design ability" signal | One mini-game case in the README (borrowing part of Option C) to color the domain tone |
| Evaluators don't read .md | Inline-quote the sandwich's core 4 sections in the README body |
| fake-green | Evidence that Critic results are real measurements (test stdout / execution log) |

## Next steps (after agreeing on this doc)

1. ✅ Pre-research consolidation
2. ✅ Transcripts schema spec — [[bagelcode-transcripts-schema]] (decided first, foundation for all other decisions)
3. ✅ Caching strategy — [[bagelcode-caching-strategy]]
4. ✅ Rubric spec — [[bagelcode-rubric-scoring]]
5. ✅ Paperclip vs alternatives decision — [[bagelcode-paperclip-vs-alternatives]] (custom build recommended)
6. ⬜ **Concept fix (among A/B/C)** ← awaiting user decision
7. ⬜ Coordinator + Planner walking skeleton (sandwich §1+§2 + transcript writer)
8. ⬜ Builder agent + Critic (rubric auto-scoring hook)
9. ⬜ TUI + (optional) web observer
10. ⬜ README + demo recording + session JSONL tidy-up
11. ⬜ Submit

⏰ **Time remaining**: 2026-05-01 → 2026-05-03 23:59 ≈ ~70 hours (assuming ~25-30 hours of real work after sleep/meals)

## Reordering progress (reflected this pass)

Originally "concept fix → schema", but **schema first** is correct:

> The transcripts schema is fine with the same skeleton for any of A/B/C (the kind vocabulary differs only slightly). Once the schema is locked in, the cost of changing the concept becomes small.

→ With [[bagelcode-transcripts-schema]] locked first, the concept can be decided as a variation that only re-weights kinds on top of it.

## 2026-05-01 late — PDCA retired, direction realigned

**User feedback**: PDCA is monotonous. Focus on environment change · communication robustness · connection-failure response.

**Actions:**
- Collected 11 frontier sources ([[bagelcode-frontier-orchestration-2026]])
- ICML 2025 §F (Resilience of Faulty Agents) topology result = chain 10.5% degradation → **PDCA pipeline retired**
- Returned to **Hub-Ledger-Spoke** topology ([[bagelcode-orchestration-topology]])
- Agents fixed to **Claude Code + Codex**, verification cross-provider (Gemini default) ([[bagelcode-agents-fixed]])
- Wrote Fault tolerance F1-F5 classification + recovery primitives ([[bagelcode-fault-tolerance-design]])

**The concept itself:**
- Option A (3-agent consensus), Option B (2-agent ping-pong), Option C (game domain) were all **options bound to the PDCA assumption**
- New direction = **"Resilient Hierarchical Builder Pair"** — Builder.A (Claude Code) → Builder.B (Codex fallback) → Verifier (Gemini cross-provider) — ledger updates on a single transcript
- Game domain (Option C) survives review as 1 case in the README intro — to keep Bagelcode tone

**Next decisions:**
- [ ] Concept name (keep Crumb vs new name — reflecting topology change)
- [ ] Final Verifier provider (Gemini vs GLM)
- [ ] Parallel-builders mode default vs flag
- [ ] Whether to add a D6 Resilience dimension to [[bagelcode-rubric-scoring]]

## See also

- [[bagelcode]] — project hub
- [[bagelcode-recruitment-task]] — original mail
- [[bagelcode-team-profile]] — persona synthesis
- [[bagelcode-kiki-leverage]] — asset-leverage mapping
- [[bagelcode-davis-system]] / [[bagelcode-ai-first-culture]] — primary sources
- [[kiki-appmaker-orchestration]] — sandwich identity origin
- [[kiki-appmaker-pdca]] — Plan-Do-Check-Act origin
- [[hub-spoke-pattern]] / [[kiki-slack-integration]] / [[kiki-scorecard-guards]]
