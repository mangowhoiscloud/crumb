---
title: NL Intervention 12-System Survey — bkit anti-pattern + LLM-judges-implicitly frontier consensus
category: references
tags: [bagelcode, user-intervention, natural-language, classifier, bkit, langgraph, autogen, cursor, cline, aider, openhands, devin, manus, inspect-ai, frontier-survey, mail-requirement-2, 2026]
sources:
  - "https://github.com/popup-studio-ai/bkit-claude-code"
  - "https://docs.langchain.com/oss/python/langchain/human-in-the-loop"
  - "https://www.langchain.com/blog/making-it-easier-to-build-human-in-the-loop-agents-with-interrupt"
  - "https://www.cometapi.com/cursor-2-0-what-changed-and-why-it-matters/"
  - "https://forum.cursor.com/t/queued-messages-interrupt-agent/140944"
  - "https://forum.cursor.com/t/sending-a-new-task-interrupts-the-current-agent-task/130337"
  - "https://docs.cline.bot/features/auto-approve"
  - "https://github.com/cline/cline/pull/5500"
  - "https://aider.chat/docs/usage/commands.html"
  - "https://aider.chat/docs/usage/modes.html"
  - "https://github.com/microsoft/autogen/discussions/5022"
  - "https://microsoft.github.io/autogen/0.4.8/user-guide/agentchat-user-guide/migration-guide.html"
  - "https://github.com/OpenHands/OpenHands/pull/5500"
  - "https://github.com/OpenHands/OpenHands/issues/5480"
  - "https://docs.devin.ai/integrations/slack"
  - "https://cognition.ai/blog/jan-25-product-update"
  - "https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus"
  - "https://inspect.aisi.org.uk/approval.html"
  - "https://inspect.aisi.org.uk/agents.html"
  - "https://code.claude.com/docs/en/hooks"
  - "https://gist.github.com/umputun/570c77f8d5f3ab621498e1449d2b98b6"
  - "[[bagelcode-user-intervention-frontier-2026-05-02]]"
  - "[[bagelcode-recruitment-task]]"
summary: >-
  To validate the email's requirement #2 ("the user can intervene in the collaboration process"),
  this survey compares 12 frontier systems across 5 dimensions (activation / NL classification mechanism /
  replay / CRUD via NL / steal-or-avoid). 11/12 use LLM judgment (implicit) or a protocol gate
  (per-tool approve/reject). The only explicit enum classifier is bkit — its regex 8-language +
  scalar confidence pattern (patched twice for FP precision bugs) is observed as an anti-pattern.
  Crumb v0.2.0's path of "raw NL → kind=user.intervene body + collectSandwichAppends → next actor
  context-aware judgment" aligns with the frontier consensus. Since PR-A/PR-B (already merged) cover
  the schema side, introducing an additional enum classifier would be a regression.
provenance:
  extracted: 0.70
  inferred: 0.25
  ambiguous: 0.05
created: 2026-05-02
updated: 2026-05-02
---

# NL Intervention — Frontier 12 System Survey

> **Purpose**: When designing for the email §2 requirement — "**the user must be able to intervene in or observe this collaboration process**" — validate the frontier consensus on explicit NL classifier (intent.schema.json + enum action mapping) vs implicit LLM judgment. Extends the 5-system matrix in the sister synthesis [[bagelcode-user-intervention-frontier-2026-05-02]] to 12 systems × NL classification dimension.
>
> **Trigger**: User said explicitly (2026-05-02): "Isn't it more frontier-like for the LLM to decide on its own? How exactly did similar cases solve this?" — the previously proposed `intent.schema.json` + coordinator NL classifier section risked recapitulating the bkit pattern, prompting a re-investigation of frontier cases.

---

## 1. 12-system × 5-dimension comparison

Each dimension: activation/lock signal · NL classification mechanism · replay strategy · CRUD via NL · steal-or-avoid.

| # | System | Activation | NL classification | Replay | CRUD via NL | Verdict |
|---|---|---|---|---|---|---|
| 1 | **bkit** (popup-studio-ai/bkit-claude-code, 525★) | Claude Code plugin via `hooks/hooks.json`; 19 hook events | **regex across 8 languages** (`AGENT_TRIGGER_PATTERNS` etc.) + `triggers.confidenceThreshold + 0.1` (ENH-226 patched FP bug) | None (workflow-state-machine, no transcript) | C/R only via slash; no U/D | ❌ **avoid** — regex enum brittle |
| 2 | **LangGraph** (`interrupt()` + `Command(resume=...)`) | Library — `interrupt()` from any node; `Checkpointer` (Postgres/InMemory) | None built-in — host app classifies; lib transports | "Replay-on-resume": pre-interrupt side effects rerun (footgun) | Read/U via `Command(resume / goto / update)` discriminated union | ✅ **steal envelope** — tagged-union, but Crumb's idempotent reducer fold beats node-rerun |
| 3 | **Cursor 2.0** (Composer / Agent, 2025-10-29) | Always-on chat; per-prompt up to 8 parallel agents on git worktrees | Implicit interrupt-vs-queue heuristic (host LLM) | Per-agent worktree = filesystem audit; `git checkout` revert | Implicit — mid-run msg is steering or interrupt | ⚠ **steal worktree isolation, avoid implicit heuristic** (forum bugs #140944 / #130337) |
| 4 | **Cline** (cline/cline, v0.1.35+) | Cancel button + chat; auto-approve mode | None — new msg = hard interrupt + reassess | Chat history only; PR #5500 fixed lockout when stuck | None — new msg = new task | ❌ **avoid** — "reassess from scratch" loses state |
| 5 | **Aider** | Always-on REPL; `/code` `/architect` `/ask` `/help` `/undo` `/diff` | Lexical (`startswith("/")`) — bare text = NL to active mode | `/undo` reverts last commit (git-backed); per-turn 1 commit | Slash-explicit: `/undo` (D), `/clear` (D), `/architect` (U mode) | ⚠ **steal per-turn git commit**, avoid slash-only rigidity for v0.1 multi-actor |
| 6 | **AutoGen 0.4** (Microsoft) | `UserProxyAgent.human_input_mode="ALWAYS"\|"TERMINATE"\|"NEVER"`; `UserInputRequestedEvent` from `run_stream` | None — UserProxy passes raw text to next selector | None native | None; **GroupChatManager known-broken** (Discussion #5022) → workaround: `HandoffTermination` | ❌ **avoid centralized GroupChat** — Microsoft itself recommends handoff-back-to-app, which is exactly Crumb's `kind=handoff.requested` STOP-gate |
| 7 | **OpenHands** (formerly OpenDevin) | Always-on chat | None — message appended to context, agent decides | Event-stream architecture (`software-agent-sdk`); replay possible | Mid-run msg ignored by stuck-detector pre-#5500 → fixed | ✅ **steal stuck-detector exclusion** — circuit_breaker should NOT count user.intervene as actor activity |
| 8 | **Devin** (Cognition) | Slack `@Devin` mid-run; web UI msg | Internal LLM-based (mechanism opaque) | "Session Insights" = meta-analysis, not deterministic replay | C: Knowledge / Playbooks; U: mid-run Slack steering; no public D | ⚠ **steal Playbooks** (named instruction templates ↔ presets at finer grain), but Devin is API-billed (skip direct integration) |
| 9 | **Manus AI** | Always-visible "Manus's Computer" pane | Unclear from docs | None public | "Top-level suggestions" = informal NL | ⚠ skip — marketing-grade docs |
| 10 | **Inspect AI** (UK AISI) | `--approval human` flag or `approval = "human"` arg; `Human Agent` solver | Per-tool gate (no NL classification) — approve/reject/escalate with comment | Eval logs append-only, replayable for grading | Gate-based; comment is unstructured text | ✅ **steal Agent Bridge** (heterogeneous SDK abstraction = our adapter), per-tool comment field ↔ judge.score audit |
| 11 | **Claude Code native** (Anthropic, host) | 12+ lifecycle hooks: `SessionStart` / `UserPromptSubmit` / `PreToolUse` / `Stop` / `PostCompact` / etc. | **Skill description matching** — host LLM picks skill from descriptions | None native | Through skill metadata only | ✅ **confirm** — `additionalContext` from UserPromptSubmit hook is the right intercept surface; bkit + umputun gist both use it |
| 12 | **Codex CLI** (OpenAI, host) | `.codex/agents/<name>.toml` `system_prompt` field; AGENTS.md auto-load (closest wins recursive) | Host LLM via injected sandwich | None native | None | ✅ **confirm** — already used in Crumb's host entries |

---

## 2. Frontier consensus — 11/12 implicit, 1/12 explicit (anti-pattern)

| Classification mechanism | Adopting systems | Assessment |
|---|---|---|
| **Implicit LLM judgment** (the host LLM or the agent LLM judges from context) | 9/12: LangGraph, Cursor, Cline, OpenHands, Devin, Manus, Claude Code, Codex, AutoGen | frontier answer |
| **Protocol gate** (no NL classification, only explicit verbs — approve/reject) | 2/12: Inspect AI, Aider | safe, rigid |
| **Explicit enum classifier** (regex / schema-forced action enum) | 1/12: bkit | **anti-pattern** — FP precision bugs, 8-language dictionary explosion |

→ Crumb v0.2.0's current path (raw NL → `kind=user.intervene body=<text>` + `collectSandwichAppends(next, actor)` → the next actor's LLM judges from context) is a **9/12 majority pattern + 2/12 protocol gate (slash commands) hybrid**. Introducing an explicit enum classifier would be a regression.

---

## 3. bkit deep-dive — why it's an anti-pattern

bkit (popup-studio-ai/bkit-claude-code, 525★, last commit 2026-05-02) is a Korean-community-driven Claude Code plugin and the closest comparison target. Its 4-layer NL classification mechanism:

```
[1] AGENT_TRIGGER_PATTERNS / SKILL_TRIGGER_PATTERNS / NEW_FEATURE_PATTERNS
    ─ keyed by en/ko/ja/zh/es/fr/de/it (8 languages)
    ─ regex match → score
[2] confidenceThreshold scalar (default 0.7)
    ─ ENH-226 Phase A: triggers.confidenceThreshold + 0.1 → FP precision
      bug → patched to Number((threshold + 0.1).toFixed(2))
    ─ if score < threshold → ambiguous → formatAskUserQuestion
[3] additionalContext injection via UserPromptSubmit hook
    ─ Claude Code automatically wraps with <system-reminder>
[4] deep integration with 21 hook events (PreToolUse / SubagentStart / TeammateIdle / ...)
```

Problems:

| Problem | Evidence | Impact on Crumb |
|---|---|---|
| **regex 8-language dictionary** | `AGENT_TRIGGER_PATTERNS` keyed by language | A 39 kind × 12 step × 8 actor mapping dictionary would explode. Mixed Korean + English input ("spec 90초로 amend") classifies unstably |
| **scalar confidence FP bug** | ENH-226 patch | Numeric gates are boilerplate, low reliability |
| **proprietary identity** (`bkit.config.json`) | `.claude-plugin/`, custom schema | Recommended to avoid the Linux Foundation AGENTS.md standard ([[bagelcode-multi-host-harness-research-2026]] finding 5) |
| **21 hook deep integration** | hooks/hooks.json | Breaks multi-host — locks to Claude Code. Codex / Gemini entries become impossible |

→ Crumb's avoidance decision (already partially avoided in [[bagelcode-multi-host-harness-research-2026]] §A; this survey adds the NL classification dimension).

---

## 4. Crumb's frontier mapping

### 4.1 Adoption decisions

| Pattern | Source | Crumb application |
|---|---|---|
| **Implicit LLM judgment** | LangGraph + AutoGen + Claude Code skill matcher, etc., 9/12 | raw NL → `body` + sandwich_append → next actor's LLM judges with game context (already working) |
| **Tagged-union envelope** | LangGraph `Command(resume / goto / update)` | `data.{goto, swap, reset_circuit, target_actor, sandwich_append}` 6 fields (PR-B merged) |
| **Stuck-detector excludes user.intervene** | OpenHands #5500 | ✅ **verified** — `src/reducer/index.ts:49` (recovery branch excludes `user/coordinator/system`), `:477` (failure branch same exclusion), `:489` (`stuck_count` only on `kind=error`). The user can also force-clear via `user.intervene data.reset_circuit` (line 369). Regression specs in `src/reducer/index.test.ts`: "OpenHands #5500: user.intervene does not reset an OPEN circuit breaker" + "OpenHands #5500: user.* events never increment stuck_count". |
| **`additionalContext` from UserPromptSubmit** | Claude Code native + bkit + umputun gist | `.claude/skills/crumb/SKILL.md` uses the same surface (already working) |
| **Per-tool approval comment field** | Inspect AI | Free-text comment in `kind=judge.score` body (already working) |
| **Worktree-per-actor isolation** | Cursor 2.0 | `sessions/<id>/agent-workspace/<actor>/` cwd (v0.1 invariant 8, already working) |

### 4.2 Avoidance decisions

| Anti-pattern | Source | Crumb avoidance |
|---|---|---|
| **Regex enum classifier** | bkit | Don't introduce `intent.schema.json` — pass raw NL through |
| **Implicit interrupt-vs-queue heuristic** | Cursor (#140944, #130337) | Explicit marker 1-bit gate (lock mode is a future option; the core path is SKILL.md auto-attach) |
| **Centralized GroupChatManager** | AutoGen #5022 | Host-inline coordinator (already working, v0.1 Must #5 — STOP after handoff) |
| **"Reassess from scratch" interrupt** | Cline | Reducer fold + transcript replay (already working) |
| **Slash-only rigidity** | Aider | NL = primary, slash = power-user shortcut |
| **Proprietary identity files** | bkit `.claude-plugin/` | Linux Foundation AGENTS.md standard |

### 4.3 Email §2 mapping reinforcement

| Email keyword | Frontier-case reinforcement |
|---|---|
| "user ... intervenes" | 9/12 implicit LLM judgment + 2/12 protocol gate hybrid (Crumb is exactly this pattern) |
| "observes" | Append-only transcript is held only by Crumb + Inspect AI (2 of 12 systems) |
| "original idea" | The combination "raw NL → context-aware actor judgment + structured user.* protocol verbs" is not exactly matched by any of the 12 systems |
| "planner persona" | Free text passed as-is into the next actor's context — no vocabulary dictionary forced |

---

## 5. Open questions (D-1 deadline basis)

| Question | Answer |
|---|---|
| Need to write `intent.schema.json`? | ❌ no — frontier consensus is implicit. 9/12 do this. Forcing an enum is the bkit anti-pattern |
| Add a Coordinator NL classifier section? | ❌ no — same reason |
| Add a marker file + UserPromptSubmit hook? | ⚠ optional — currently the Claude Code skill matcher handles cold start, and in-session NL is covered by SKILL.md `@actor` mentions. Lock mode is nice-to-have |
| Need `metadata.intercept_mode` inline? | ❌ no — without the marker, the fsync barrier issue itself doesn't arise |
| Apply OpenHands #5500 stuck-detector exclusion? | ✅ **verified** — `src/reducer/index.ts:{49,477,489}` excludes `from='user'`/`'coordinator'`/`'system'` from both breaker recovery and failure paths; `stuck_count` only increments on `kind=error`. Regression specs in `src/reducer/index.test.ts` |

---

## 6. One-line summary

**Across 12 frontier systems, raw NL → `body` + sandwich → context-aware actor judgment is the majority pattern (9/12)**. bkit's regex 8-language enum classification is an anti-pattern (FP bug patched twice + multilingual dictionary explosion). Crumb's PR-A/PR-B path (G1+G3+G5+G6 merged) is exactly the majority pattern + protocol gate hybrid. Introducing an explicit enum classifier would be a regression.

---

## See also

- [[bagelcode-user-intervention-frontier-2026-05-02]] — 5-system matrix + PR mapping sister synthesis (the dimension extension target of this page)
- [[bagelcode-multi-host-harness-research-2026]] — 7-system multi-host survey of bkit / claude-flow / openclaw, etc. (this survey adds the NL classification dimension)
- [[bagelcode-recruitment-task]] — verbatim email requirement #2
- [[bagelcode-system-architecture-v0.1]] — canonical v0.1 architecture
- [[bagelcode-paperclip-vs-alternatives]] — framework non-adoption + pattern borrowing decision
- `src/reducer/index.ts` — handles 5 user.* events + 6 data fields (PR-A + PR-B merged)
- `src/inbox/parser.ts` + `src/inbox/watcher.ts` — G2 inbox watcher (wiring already complete, `src/loop/coordinator.ts:339`)
- `agents/coordinator.md` — host-inline coordinator (AutoGen GroupChatManager avoidance pattern)
