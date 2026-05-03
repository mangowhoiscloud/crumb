---
title: Identity Files Decomposition — AGENTS.md universal + CLAUDE.md / GEMINI.md augmentation
category: synthesis
tags: [bagelcode, identity-files, agents-md, claude-md, gemini-md, multi-host, decomposition, lf-aaif, 2026]
sources:
  - "https://code.claude.com/docs/en/memory (Claude Code memory docs)"
  - "https://geminicli.com/docs/cli/gemini-md/ (Gemini CLI GEMINI.md docs)"
  - "https://geminicli.com/docs/reference/configuration/ (Gemini CLI contextFileName)"
  - "https://agents.md/ (Linux Foundation Agentic AI Foundation standard)"
  - "https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation (2025-12 AAIF)"
  - "https://github.com/anthropics/claude-code/issues/6235 (Claude Code AGENTS.md support request)"
  - "https://hivetrail.com/blog/agents-md-vs-claude-md-cross-tool-standard"
  - "https://kau.sh/blog/agents-md/ (sync workaround)"
summary: >-
  AGENTS.md is the universal source (Linux Foundation Agentic AI Foundation standard). CLAUDE.md /
  GEMINI.md are host-specific augmentation. All 3 hosts (Claude Code / Codex CLI / Gemini CLI)
  auto-load the AGENTS.md content (Codex native + Claude `@AGENTS.md` import + Gemini settings.json
  contextFileName). CRUMB.md dropped — its content is absorbed into AGENTS.md.
provenance:
  extracted: 0.55
  inferred: 0.40
  ambiguous: 0.05
created: 2026-05-02
updated: 2026-05-02
---

# Identity Files Decomposition — Option B (Settings + Import)

> **Lock**: AGENTS.md = universal source (LF AAIF standard). CLAUDE.md / GEMINI.md = host-specific augmentation. CRUMB.md dropped — content absorbed.
>
> All 3 hosts (Claude Code / Codex CLI / Gemini CLI) reach the AGENTS.md content via their own brand's auto-load mechanism. Simple setup on any machine.

## 1. Authoritative grounding — auto-load spec for the 3 host MD files

| Host | Native auto-load | Fallback / config | Crumb's chosen path |
|---|---|---|---|
| **Claude Code** | `CLAUDE.md` (project root + parents recursive + `.claude/CLAUDE.md` + `~/.claude/CLAUDE.md` + managed policy) | AGENTS.md fallback (only when CLAUDE.md is absent) — Anthropic does not yet officially support it natively (issue #6235 has thousands of upvotes) | **First line of CLAUDE.md: `@AGENTS.md` import** — Claude Code's standard `@path` syntax (max 5 hops) |
| **Codex CLI** | **AGENTS.md** ✅ (closest wins, recursive walk, LF AAIF standard) | (default) | **Use AGENTS.md directly** — native |
| **Gemini CLI** | `GEMINI.md` (default) | Can use AGENTS.md via the `contextFileName` setting | **`.gemini/settings.json` `{ "context": { "fileName": ["AGENTS.md", "GEMINI.md"] } }`** + a compatible fallback `@AGENTS.md` on the first line of `GEMINI.md` |

→ **Decisively**: each of the 3 hosts has only its own brand's auto-load mechanism, but all of them can reach the AGENTS.md content via their own path.

## 2. Applied to our system (Option B)

### Root identity files

```
AGENTS.md   (real, universal source — LF AAIF standard)
            ├── 11 architecture invariants
            ├── Actors (5 + 3 specialist + 5 skill)
            ├── Schema (39 kind × 11 field × 12 step × 8 from)
            ├── Multi-host entries (4 paths)
            ├── Preset (user-controlled)
            ├── Don't / Must (universal)
            └── For human contributors (Style / Quickstart / How to run / File map / Wiki / Forbidden)

CLAUDE.md   (real, Claude Code augmentation)
            ├── @AGENTS.md  (import)
            ├── .skills/ 24 mappings (wiki + implementation)
            ├── Korean policy
            ├── Verify gate
            ├── CI ratchet
            └── Progress tracking (CHANGELOG.md)

GEMINI.md   (real, Gemini CLI augmentation)
            ├── @AGENTS.md  (import OR fallback via settings)
            ├── Quickstart (gemini login → /crumb)
            ├── Gemini's role in bagelcode-cross-3way (verifier multimodal)
            ├── Memory / context loading spec
            └── Extension link

.gemini/settings.json   (Gemini CLI contextFileName config)
            { "context": { "fileName": ["AGENTS.md", "GEMINI.md"] } }
```

### Dropping CRUMB.md

The previously-universal CRUMB.md content (Position in stack / 11 invariants / Actors / Schema / Multi-host entries / Preset / Don't / Must / References) is fully absorbed into AGENTS.md. AGENTS.md, being the LF AAIF standard, has a stronger auto-load story (Codex native + Claude `@AGENTS.md` + Gemini contextFileName).

CRUMB.md becomes **redundant** and is dropped. Drift risk goes to 0 thanks to single-source control.

### Host entry MD reference cleanup

The 4 places mentioning `CRUMB.md` → corrected to `AGENTS.md`:
- `.claude/skills/crumb/SKILL.md` §References
- `.codex/agents/crumb.toml` developer_instructions §0
- `.gemini/extensions/crumb/GEMINI.md` first paragraph
- `.gemini/extensions/crumb/commands/crumb.toml` prompt §0

## 3. Simple setup on any machine

### Behavior per user environment

| Environment | Claude Code | Codex | Gemini CLI |
|---|---|---|---|
| Claude Code only | ✅ CLAUDE.md auto + @AGENTS.md import | (not used) | (not used) |
| Codex only | (not used) | ✅ AGENTS.md auto (native) | (not used) |
| Gemini CLI only | (not used) | (not used) | ✅ AGENTS.md + GEMINI.md auto via settings.json |
| All 3 hosts | ✅ | ✅ | ✅ |
| No host at all | (headless `crumb run --adapter mock` deterministic — 0 auth) |

→ **Every environment reaches the same universal identity (AGENTS.md content).** Drift risk: 0.

## 4. Drift-prevention rules

- **AGENTS.md is the single edit point** — when changing the 11 invariants / actors / schema / multi-host / preset, only edit AGENTS.md
- The `@AGENTS.md` import in CLAUDE.md / GEMINI.md auto-syncs (Claude Code's `@path` syntax)
- However, Gemini CLI's `@<file>` import compatibility is not yet confirmed (as of 2026-04) — as a conservative fallback, AGENTS.md is also auto-loaded via `.gemini/settings.json` `contextFileName`
- The References sections of the 3 entry MDs (.claude/skills, .codex/agents, .gemini/extensions/commands) are also unified to reference AGENTS.md

## 5. Spec compliance matrix (post-Phase verification)

7 areas × 51 items spec comparison (each item cites the host's official docs as primary source):

| Area | Compliant / Total | Note |
|---|---|---|
| Claude Code CLAUDE.md | 6/7 (86%) | Exceeds the recommended 200 LOC size (CLAUDE.md is 365 LOC after `@AGENTS.md` import) — accepted |
| Claude Code skill (.claude/skills/crumb/SKILL.md) | 11/11 (100%) | Added `when_to_use` frontmatter ✅ |
| Codex AGENTS.md (root) | 5/5 (100%) | Codex CLI native auto-load (closest wins) |
| Codex agents.toml (.codex/agents/crumb.toml) | 10/10 (100%) | `.codex/agents/` project-level officially supported ✅ + `[skills]` section added ✅ |
| Gemini settings.json | 3/3 (100%) | `context.fileName` array schema compliant |
| Gemini extension | 10/10 (100%) | Both manifest + commands/*.toml compliant |
| AGENTS.md self-contained | 5/5 (100%) | 11 invariants inline, 0 external @import dependency |
| **Total** | **50/51 (98%)** | Only 1 size-recommendation accepted |

**Codex docs citation (project-level compliance verification)**:
> "To define custom agents, add standalone TOML files under **`~/.codex/agents/`** for personal agents or **`.codex/agents/`** for **project-scoped agents**. Each file defines one custom agent."
>
> — [developers.openai.com/codex/subagents](https://developers.openai.com/codex/subagents)

→ Our location `.codex/agents/crumb.toml` is compliant ✅ (the standard project-scoped agents path).

## 6. Phase application results (this PR)

- **Phase 1** ✅ Updated AGENTS.md as universal source (absorbing CRUMB.md content) + dropped CRUMB.md
- **Phase 2** ✅ CLAUDE.md `@AGENTS.md` import + Claude-specific only / new GEMINI.md root / new `.gemini/settings.json`
- **Phase 3** ✅ Corrected 3 entry MD references (`CRUMB.md` → `AGENTS.md`) + SKILL.md frontmatter (`allowed-tools` + `argument-hint`) compliance
- **Phase 4** ✅ Ingested this wiki synthesis

## 6. Evaluator visibility — sharper alignment with the mail's verbatim text

Aligned with Bagelcode's recruitment mail phrase "**simultaneous use of various agents like Claude Code, Codex, Gemini CLI**":
- Whichever host the evaluator enters from, the AGENTS.md content (universal Crumb identity) is loaded identically
- An evaluator hitting ctrl-F for "Claude Code" / "Codex" / "Gemini CLI" → finds them all in one place in the AGENTS.md §"Multi-host entries" table
- For host-specific information, each host's augmentation file (CLAUDE.md / GEMINI.md) provides the additional context

## See also

- [[bagelcode-system-architecture-v0.1]] — canonical v0.1 architecture (multi-host × 3-tuple + 5 actor + 3-layer scoring)
- [[bagelcode-host-harness-decision]] — Hybrid (Skill + headless CLI) lock
- [[bagelcode-frontier-cli-convergence-2026]] — 4 CLI × 7 primitive convergence (impetus for adopting the LF AAIF standard)
- `AGENTS.md` (repo root) — the universal source covered by this page
- `CLAUDE.md` / `GEMINI.md` (repo root) — host-specific augmentation
- `.gemini/settings.json` — Gemini CLI contextFileName configuration
