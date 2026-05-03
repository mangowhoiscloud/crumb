---
title: Bagelcode Task — Project Naming "Crumb" Decision + rationale
category: synthesis
tags: [bagelcode, naming, crumb, brand, motif, decision]
sources:
  - "[[bagelcode-stack-and-genre-2026]]"
  - "[[bagelcode-team-profile]]"
  - "[[geode-sandbox-breadcrumb]]"
created: 2026-05-01
updated: 2026-05-01
---

# Project Naming — **Crumb** (Locked)

> Previous codename "Pitchcraft" → locked as **Crumb**. This page captures the decision rationale + the bulk update across wiki and code.

## The triple meaning of Crumb

```
Crumb
  ├── 1) Bagel motif (Bagelcode brand ecosystem)
  │      A small piece of a bagel = one prototype crumb
  │
  ├── 2) Breadcrumb pattern (LLM agent standard)
  │      The Hansel & Gretel path-finding metaphor
  │      → path tracing / context routing / error steering
  │      → cf. [[geode-sandbox-breadcrumb]] (3-layer LLM path error steering)
  │
  └── 3) UI/Agent breadcrumb navigation
         The actor·kind flow in the transcript IS the breadcrumb trail
         → evaluators can trace the decision path (D3 observability)
```

→ **A single word that simultaneously answers (a) company identity, (b) the LLM agent standard pattern, and (c) the essence of our transcript.**

## Naming decision rationale

### 1. Bagel motif ecosystem (the Anthropic Claw pattern)

Anthropic's ecosystem naming:
```
Claude → Claude Code → OpenClaw → NanoClaw → Moltbot → ClawCode
   └────── one motif (Claw) ties together friends, opposites, and patches ──────┘
```

Bagelcode = the **Bagel** motif:
```
Bagelcode (the company) → Crumb (our tool)
                                └── a child of the Bagel ecosystem
```

**Evaluator's first impression**: "This person understands our company identity." A brand asset.

### 2. Breadcrumb = standard LLM agent vocabulary

**Breadcrumb pattern in agent design:**
- Leaves a trail so users/evaluators can follow the agent's decision path
- When errors occur, allows tracing back to "where it went wrong"
- Audit log of routing decisions
- **cf. [[geode-sandbox-breadcrumb]] (geode's 3-layer LLM path error steering)** — the same motif already exists inside the mango ecosystem

→ **"If you know breadcrumb, you immediately understand why the transcript looks the way it does."** A cognitive shortcut for evaluators.

### 3. Inheriting the Kiki personality

| Dimension | Kiki | Crumb |
|---|---|---|
| Syllables | 2 (Kiki) | 1 (Crumb) |
| Personality | Friendly, pet-like | Small and soft |
| Korean | "키키" natural | "크럼" natural |
| Semantic clarity | (low) | **triple-clear** |
| Domain fit | (Slack profiling) | **Bagel + agent + transcript all** |

→ Richer in meaning than Kiki. A single syllable but modern in the Bolt / Codex style.

### 4. Advantage over other candidates

| Candidate | Bagel motif | Standard LLM vocabulary | Multi-agent hint | Verdict |
|---|---|---|---|---|
| **Crumb** | ✅ | ✅ breadcrumb | ✅ trail | **Triple meaning, unique** |
| Yeast | ✅ | ⚠ | ⚠ | Double |
| Murmur | ❌ | ⚠ | ✅ | 1.5x |
| Nori | ❌ | ❌ | ❌ | None (game only) |
| Bori | ❌ | ❌ | ❌ | None (only resembles Kiki) |

→ **Crumb wins overwhelmingly on semantic depth.**

## README one-liner (naming exposure)

> "**Crumb** is named after (1) the small piece of a bagel — Bagelcode's signature, (2) the **breadcrumb pattern** widely used in LLM agent systems for path tracing and error steering (Hansel & Gretel metaphor), (3) and the breadcrumb trail of agent decisions left in `transcript.jsonl` for the user to follow."

→ The evaluator **immediately recognizes the triple meaning** from the README's first paragraph.

## Bulk update across wiki and code (2026-05-01)

| Location | Change |
|---|---|
| `projects/bagelcode/*.md` 8 files | Bulk replace `Pitchcraft` → `Crumb` |
| ENV vars | `PITCHCRAFT_*` → `CRUMB_*` (10 instances) |
| Code directory (planned) | `crumb/` (github repo, at the code stage) |
| `.md` asset folder (planned) | `crumb/agents/{coordinator,builder-a,builder-b,verifier}.md` |
| Output directory (planned) | `sessions/<session-id>/{transcript.jsonl, artifacts/}` |

## Codebase naming convention

```
Crumb              ← product name (PascalCase, README/docs)
crumb              ← package/repo/CLI name (lowercase)
CRUMB_*            ← environment variables (UPPER_SNAKE)
.crumb/            ← user home config (e.g. ~/.crumb/sessions/)
crumb-*            ← sub-tools (e.g. crumb-replay)
```

## See also

- [[bagelcode]] — project hub (Crumb annotated)
- [[bagelcode-task-direction]] — direction-setting page
- [[bagelcode-agents-fixed]] — CRUMB_ env variable definitions
- [[bagelcode-stack-and-genre-2026]] — ecosystem context for the Bagel motif
- [[geode-sandbox-breadcrumb]] — existing breadcrumb precedent in the mango ecosystem (sister motif)
- [[kiki]] — cousin system (Slack profiling, same naming tone)
