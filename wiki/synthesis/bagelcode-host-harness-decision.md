---
title: Bagelcode Task — Runtime vs Host Harness Decision (Hybrid Skill + Headless CLI)
category: synthesis
tags: [bagelcode, runtime, host-harness, claude-code-skill, hybrid, cross-provider, decision, 2026]
sources:
  - "[[bagelcode-task-direction]]"
  - "[[bagelcode-paperclip-vs-alternatives]]"
  - "[[bagelcode-team-profile]]"
  - "[[bagelcode-ai-first-culture]]"
  - "[[bagelcode-davis-system]]"
  - "[[bagelcode-kiki-leverage]]"
  - "[[bagelcode-agents-fixed]]"
  - "[[bagelcode-verifier-isolation-matrix]]"
summary: >-
  Hybrid decision that locks Crumb's default entry point to a Claude Code skill (host harness) and
  keeps the headless CLI as a fallback. Cross-provider stays an opt-in flag; the in-house
  transcript/reducer/adapter is preserved 100%.
provenance:
  extracted: 0.55
  inferred: 0.40
  ambiguous: 0.05
created: 2026-05-02
updated: 2026-05-02
---

# Runtime vs Host Harness Decision — Hybrid (Skill + Headless CLI)

> **Locked decision.** Crumb default entry point = Claude Code skill (host = Claude Code itself). Evaluator/CI = headless `crumb run --goal "..."`. Cross-provider is an opt-in flag. The custom transcript JSONL + reducer + adapter is 100% preserved.
>
> This page is a **realignment of the previous decision** (the "separate runtime + Node.js Coordinator" line in [[bagelcode-task-direction]]). We do not discard the custom runtime; instead we put Claude Code as the host harness and reuse the custom runtime on top of it as a hybrid.

---

## One-line decision

```
default       :  $ claude → /crumb 60-second match-3 combo  (natural-language interface, host = Claude Code)
headless / CI :  $ npx tsx src/index.ts run --goal "..."    (custom runtime, deterministic mock)
cross-provider:  --cross-provider flag (opt-in)             (engineering-lead = codex-local subprocess)

The custom runtime (transcript / reducer / validator / adapter / dispatcher) is preserved 100%.
Every step inside the skill → calls `crumb event` → schema enforcement + replay guarantee.
```

---

## Why we realigned — missing natural-language manipulation made us miss the ai-first bullseye

The initial decision in [[bagelcode-task-direction]] was a **"separate Node.js Coordinator + TUI/inbox.txt"**. It works, but **misses the core signals of Bagelcode's tone**:

### 4 verbatim signals (already inside the wiki)

| Source | verbatim | Implication |
|---|---|---|
| [[bagelcode-ai-first-culture]] line 57-59 | *"AI 친화적으로 할 거면 굳이 예쁘게 만드는 데 시간을 많이 들일 필요가 없었던 거예요"* (*If we're going to be AI-friendly, there was no need to spend a lot of time making things pretty*) + **"CLI / MCP 등 고려"** (*considering CLI / MCP, etc.*) | UI flashiness < agent compatibility |
| [[bagelcode-ai-first-culture]] 5 principles #1 | *"**명령이 아닌 '맥락 공유 소통'**"* (*Not commands but "context-sharing communication"*) | Natural language + context first, no commands |
| [[bagelcode-ai-first-culture]] 5 principles #5 | *"**기존 도구 활용 + 개인화 부분만 직접 개발**"* (*Reuse existing tools + build only the personalization portion yourself*) | No full build, **build only the edges** |
| [[bagelcode-davis-system]] | Slack bot + natural language input + 2-stage Agent Router | Natural language is Bagelcode's default UI |
| [[bagelcode-team-profile]] line 25-27 | *"기획자는 에이전트에게 게임을 만들게 한다 / 엔지니어는 에이전트의 능력을 확장한다"* (*Designers have agents make games / engineers extend agents' capabilities*) | **Both roles sit on top of the same agent tool** — host harness premise |

→ The "separate runtime" line **directly conflicts with principle #5: "build only the edges"**. Claude Code itself is an "existing tool", and we were building a parallel separate tool instead of an edge on top of it.

### How kiki solved the same problem

[[bagelcode-kiki-leverage]] §3 [[kiki-slack-integration]]:
- **Natural-language fine-grained controls** like `@coordinator pause` / `@<agent> rephrase` are kiki's core user surface
- kiki itself is hosted on top of Claude Code (or Slack) — not a separate runtime
- That is, kiki = "sandwich + sub-agents on top of a host harness" pattern

→ Crumb takes the same path. **Except we keep the custom transcript schema enforcement + replay-guarantee advantages.**

---

## 4-option matrix (9 dimensions)

| Dimension | A. Standalone separate runtime (previous decision) | B. Claude Code skill alone (kiki style) | **C. Hybrid (skill + headless CLI)** ★ | D. Separate runtime + natural-language wrapper LLM |
|---|---|---|---|---|
| Natural-language manipulation | ❌ slash/inbox | ✅ natural | ✅ natural inside Claude Code | ⚠ wrapper conversion |
| Bagelcode tone bullseye | ⚠ CLI-friendly OK | ✅ "designer natural language" bullseye | ✅ default + headless both | ⚠ |
| Transcript schema enforcement | ✅ 100% | ⚠ Claude history vs our transcript ambiguous | ✅ skill calls `crumb event` | ✅ |
| Replay guarantee | ✅ | ⚠ depends on Claude session externally | ✅ | ✅ |
| README operability robustness | ✅ simple | ⚠ Claude Code required | ✅ **`claude` or `crumb run` either** | ✅ |
| Reuse of existing src/ code | ✅ 100% | ❌ mostly rewritten | ✅ 100% | ✅ 100% |
| Volume (deadline safety) | 0 | ❌ a lot | ⚠ skill + specialists + integration | ⚠ wrapper LLM call risk |
| Cross-provider opt-in | ✅ | ✅ codex subagent | ✅ inside skill + CLI flag | ✅ |
| Evaluator entry point | `npx tsx src/index.ts run --goal "..."` | `claude` → `/crumb` | **both** | `crumb chat` |

→ **C is ≥ every other option on every dimension.** Schema enforcement + natural language + README robust + 100% reuse of existing code, all at once.

---

## Decisions (3 locks)

### Lock 1 — Default entry point = Claude Code skill (host harness)

```
.claude/skills/crumb/SKILL.md
  ▾ natural-language trigger ("make me a game", "/crumb ...")
  ▾ Claude Code self-hosts (Coordinator role)
  ▾ Task tool spawn (Anthropic native, depth=1):
      ├── planner-lead.md sandwich injection
      │     └── Task tool: concept-designer / researcher / visual-designer (specialists/*.md)
      └── engineering-lead.md sandwich injection
            ├── Task tool: qa.md
            └── Task tool: verifier.md (different sandwich, same provider isolation = mitigates self-judge risk)
  ▾ every step → crumb event (env CRUMB_TRANSCRIPT_PATH)
  ▾ produces artifacts/{game.html, spec.md, DESIGN.md, tuning.json}
```

Natural-language user intervention:
```
User: "do this part differently"
   ↓ Claude Code receives → crumb event kind=user.intervene
   ↓ Coordinator routes to spec.update (custom reducer)
```

→ Combines **kiki's "@coordinator pause" natural-language fine-grained control pattern** with the **custom transcript replay guarantee**.

### Lock 2 — Headless = `crumb run --goal "..."` (custom runtime as is)

```
$ npx tsx src/index.ts run --goal "60s match-3" --adapter mock --idle-timeout 5000
   ▾ evaluator / CI / non-interactive environments
   ▾ deterministic mock adapter possible
   ▾ demo runs without Claude Code authentication
   ▾ guarantees the README's "Quickstart (1 line)"
```

→ The custom runtime = the very edge of principle #5's "**build only the personalization portion yourself**". The transcript schema + replay + adapter abstraction is the essence of that edge.

### Lock 3 — Cross-provider = opt-in flag

```
default                    : Claude Code single (1 host + N Task tool subagents, depth=1)
                              one evaluator auth only (claude login)
                              internal isolation = different sandwich + different context (only mitigates same-provider self-judge risk)

--cross-provider flag      : engineering-lead = codex-local subprocess (extra external actor)
                              verifier         = host Claude Code Task tool (different sandwich)
                              cross-assemble (build = Codex / verify = Claude)
                              two evaluator auths required (claude + codex login)
                              for demo or advanced usage
```

Follows the [[bagelcode-verifier-isolation-matrix]] conclusion: cross-provider has strong academic backing (CP-WBFT / MAR / Lanham 0.32→0.89), but because of the trade-off against the mail's absolute condition that "**runs as the README says**", it is not the default.

---

## Bagelcode 5-principles alignment mapping (where this decision fits)

| 5 principles ([[bagelcode-ai-first-culture]]) | How this decision fits |
|---|---|
| #1 Not commands but "context-sharing communication" | ✅ Claude Code natural-language interface = context-sharing default |
| #2 Multi-agent parallel processing | ✅ Task tool spawn (depth=1, parallel where possible); with `--cross-provider`, codex-local runs in parallel |
| #3 Documentation for AI reuse | ✅ agents/*.md sandwiches + specialists/*.md = asset form (directly satisfies the mail's ".md inclusion") |
| #4 Structuring repeated work (skills/rules creation) | ✅ `.claude/skills/crumb/SKILL.md` itself is the result of that structuring |
| #5 Reuse existing tools + build only the personalization portion yourself | ✅ Claude Code = existing tool (host) / Crumb = personalization portion (transcript + reducer + adapter) |

→ **Bullseye on all 5/5 principles.**

---

## DAVIS mapping (internal-case alignment)

| DAVIS pattern | Crumb mapping |
|---|---|
| Slack bot = natural-language default UI | `claude` + `/crumb` = natural-language default |
| 2-stage Agent Router (Document/Tableau/Query → Genie Space) | Coordinator (Claude Code host) → Planner Lead / Engineering Lead → specialists |
| Genie API = managed delegation | Claude Code SDK / Codex subagents = managed delegation (no re-implementation) |
| dbt YAML = metadata-as-code | agents/*.md sandwiches + protocol/schemas/*.json = metadata-as-code |

→ **All 4 DAVIS patterns map.** A skeleton familiar to the Bagelcode 신작팀.

---

## Reference patterns borrowed (already ingested in the wiki)

| Pattern | Source | Crumb application |
|---|---|---|
| Sandwich Identity (4-section) | [[bagelcode-kiki-leverage]] §1 | agents/coordinator + planner-lead + engineering-lead + specialists/*.md |
| Hub-Spoke topology | [[bagelcode-kiki-leverage]] §2 | Coordinator (host Claude Code) + Lead spokes |
| Slack-style intent | [[bagelcode-kiki-leverage]] §3 | Claude Code natural language → coordinator routing rule (custom routing-rules) |
| Karpathy 5 principles (P5: Git as State Machine) | [[bagelcode-kiki-leverage]] §7 | transcript.jsonl append-only = state machine |
| BYO adapter | [[bagelcode-paperclip-vs-alternatives]] | claude-local / codex-local / mock + auto |
| Task tool depth=1 | [[bagelcode-frontier-orchestration-2026]] §K | Anthropic Claude Code SDK's own default; explicit in our enforcement |
| Codex subagents (TOML, max_threads=6) | [[bagelcode-frontier-orchestration-2026]] §L | used inside codex-local when --cross-provider |
| OTel GenAI alias | [[bagelcode-final-design-2026]] §8 | export-ready, independent of host harness change |

---

## Unknowns to verify (spike before commit)

### Q1. Env propagation in Claude Code's Task tool

- Does the parent (Claude Code host) env (`CRUMB_TRANSCRIPT_PATH`, `CRUMB_SESSION_ID`, `CRUMB_ACTOR`, `CRUMB_SESSION_DIR`) get inherited automatically into a child Task agent?
- If not, declare `export CRUMB_TRANSCRIPT_PATH=...` explicitly inside the sandwich and re-read in the child

### Q2. Env propagation in Codex subagents

- Does a child spawned via `~/.codex/agents/<name>.toml` inherit the host env?
- Can env be declared in the TOML's `developer_instructions`?

### Q3. Can `crumb event` CLI be called from a child?

- Is the child's cwd the session_dir; is `crumb` on PATH?
- Confirm the pattern where adapters inject into PATH

→ Confirm via a 30-min spike with a mock before entering specialists/ work.

---

## Downstream impact — other wiki page corrections

- [[bagelcode-task-direction]] §"Tech choices" line 99-100 → "separate Coordinator process" alone → "Hybrid (Claude Code host + custom runtime)"
- [[bagelcode-agents-fixed]] §"Step 6 Verifier isolation" → "force cross-provider" → "internal subagent isolation (default) + cross-provider opt-in"
- [[bagelcode-final-design-2026]] §1 external-4 / internal-7 diagram → add "external 1 host (Claude Code) + N Task tool subagents + opt-in codex-local"
- [[bagelcode-paperclip-vs-alternatives]] §"Trade-off table" → make the "custom build" definition explicit as "custom runtime on top of host harness"

→ This decision triggers corrections across 4 pages. Apply sequentially.

---

## Change impact — code/spec (Plan)

```
src/      no change (transcript / reducer / validator / adapter / dispatcher unchanged)
agents/   update 4 sandwiches + add 5 new agents/specialists/
.claude/skills/crumb/SKILL.md   new (host-harness activation entry)
.crumb/config.toml + presets/   add a --cross-provider preset
src/cli.ts                      add --cross-provider flag
README.md / README.ko.md        two Quickstart variants (skill / headless) + Advanced
CHANGELOG.md                    new (Keep-a-Changelog)
```

---

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-paperclip-vs-alternatives]] — custom build vs framework (directly tied to the host-harness decision)
- [[bagelcode-team-profile]] / [[bagelcode-ai-first-culture]] — primary basis for Bagelcode tone
- [[bagelcode-davis-system]] — internal case for natural-language default UI
- [[bagelcode-kiki-leverage]] — sandwich + slack-style intent + scorecard guards
- [[bagelcode-agents-fixed]] — Verifier isolation (needs correction due to this decision)
- [[bagelcode-verifier-isolation-matrix]] — 13-source × 2-dimension matrix (backing for the cross-provider opt-in decision)
- [[bagelcode-final-design-2026]] — canonical lock (needs §1 correction due to this decision)
- [[bagelcode-frontier-orchestration-2026]] §K Claude Code SDK + §L Codex subagents
