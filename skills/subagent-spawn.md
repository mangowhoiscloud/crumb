---
name: subagent-spawn
description: |
  Task tool / Codex subagent / Gemini extension MCP spawn rules. depth=1 enforced.
  Ported from obra/superpowers (176k⭐) skills/subagent-driven-development.
when_to_use: inline-read by planner-lead, builder, and verifier. Covers specialist invocation rules and envelope assembly.
source: https://github.com/obra/superpowers (subagent-driven-development skill)
adapted_for: Crumb v0.1 multi-host subagent spawning across 3 CLI harnesses
---

# Subagent Spawn (Crumb adaptation)

## Depth limit

**`max_depth = 1`** strictly enforced across all 3 harnesses:
- Claude Code Task tool: depth=1 native (Anthropic SDK constraint, can't recurse)
- Codex subagents: `agents.max_depth = 1` (TOML default, kept)
- Gemini CLI extension: MCP server can't spawn another MCP server (manifest constraint)

Reason: [[bagelcode-frontier-orchestration-2026]] §I MAR + Lanham 2026-04 "From Spark to Fire" — relay length > 1 → exponential fragility (90.7% → 22.5% accuracy at 5 stages).

Crumb structure:
```
host (depth=0) → coordinator (host inline)
                    ↓ spawn
                 lead/builder/verifier (depth=1)
                    ↓ NO MORE SPAWN
                 inline reasoning only
```

## Envelope assemble (host-agnostic)

When spawning a subagent (any actor), coordinator builds 6-section envelope:

```xml
<crumb:envelope session="<ulid>" turn="<n>" task="<task_id>">
  <crumb:contract> <input-kinds/> <output-kinds/> <handoff-target/> </crumb:contract>
  <crumb:task-ledger version="<n>"> <fact/> <constraint/> <decision/> </crumb:task-ledger>
  <crumb:progress next="<actor>" stuck="<count>/5"> instruction: ... </crumb:progress>
  <crumb:relevant-messages> <!-- visibility=public, last 10 turns, kind-filtered --> </crumb:relevant-messages>
  <crumb:tools-allowed> ... </crumb:tools-allowed>
  <crumb:enforcement> <!-- forbidden + required --> </crumb:enforcement>
</crumb:envelope>
```

Format conversion per harness ([[bagelcode-xml-frontier-2026]]):
- claude-code → XML (native preference)
- codex → Markdown (XML→MD via adapter)
- gemini-cli → XML (within MCP prompt field)
- mock → pass-through

## Env propagation rules

Every subagent spawn MUST receive these env vars (if env propagation spike Q1-Q3 PASS):

```bash
CRUMB_TRANSCRIPT_PATH=sessions/<ulid>/transcript.jsonl
CRUMB_SESSION_ID=<ulid>
CRUMB_SESSION_DIR=sessions/<ulid>/
CRUMB_ACTOR=<actor-name>
CRUMB_ADAPTER_SESSION_ID=<host-native-id>  # for cache carry-over (S15 persistence)
```

If spike showed env not auto-propagated for a host:
- Sandwich body MUST include explicit `export CRUMB_*=...` lines (host-specific section)
- Adapter wrapper sets env via `spawn(cmd, args, { env: ... })` Node.js option

## Specialist call (planner-lead internal step inline)

Specialists (concept-designer / researcher / visual-designer) are NOT separate spawns. They are inline reasoning steps within planner-lead's single spawn:

```
planner-lead spawn (1 subprocess, depth=1)
  ├─ Step 1 socratic    (inline reasoning)
  ├─ Step 2 concept     ← reads agents/specialists/concept-designer.md inline
  ├─ Step 3 research    ← reads agents/specialists/researcher.md inline
  ├─ Step 4 design      ← reads agents/specialists/visual-designer.md inline
  └─ Step 5 synth       (final spec.md / DESIGN.md / tuning.json)
```

Each step appends `kind=step.<name>` markers to transcript. NOT separate Task tool calls.

Reason: keeping specialists inline avoids depth=2 violation AND saves token cost (no envelope re-assemble).

## CourtEval sub-step (verifier internal)

Same inline pattern — verifier's grader/critic/defender/regrader are 4 step.judge events within ONE verifier spawn, not 4 spawns.

## Cross-provider builder adapter swap (PR-Prune-2)

If `--preset bagelcode-cross-3way` and Codex CLI unavailable (S15 doctor check FAIL):
- Reducer sets `adapter_override.builder = 'claude-local'` and respawns the SAME builder actor (no separate fallback actor — PR-Prune-2 collapsed that path)
- transcript audit log: `kind=audit, data.event=adapter_swapped`
- judge.score.metadata.cross_provider may be false → audit_violations += "self_bias_risk_same_provider" (warn-only)

## See also

- [[bagelcode-system-architecture-v0.1]] §4 (envelope) + §5 (actor binding) + §8 (routing)
- [[bagelcode-frontier-cli-convergence-2026]] §2 (4 CLI primitive: subagents)
- `skills/parallel-dispatch.md` — sister for parallel mode
- `agents/coordinator.md` — main consumer of these rules
