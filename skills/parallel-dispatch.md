---
name: parallel-dispatch
description: |
  Builder.A vs Builder.B parallel spawn rules for `--preset bagelcode-tri-judge` (P1) and Multi-Builder mode.
  Ported from obra/superpowers (176k⭐) skills/dispatching-parallel-agents.
when_to_use: coordinator inline read when preset has parallel actor declarations OR --parallel-builders flag
source: https://github.com/obra/superpowers (dispatching-parallel-agents skill)
adapted_for: Crumb v3 multi-actor parallel + multi-judge consensus (NeurIPS 2024 97-98% F1)
---

# Parallel Dispatch (Crumb adaptation)

## When parallel makes sense

| Use case | Justification |
|---|---|
| **Multi-Builder demo** (`Builder.A=Codex` + `Builder.B=Gemini` parallel) | Same spec, different artifact. Verifier picks best (D6 portability dimension). Cognition Devin "40% commits in parallel" pattern. |
| **Multi-Judge consensus** (`bagelcode-tri-judge` preset, P1) | 3 verifier (Claude/GPT/Gemini) parallel. NeurIPS 2024: 97-98% F1, Cohen's Kappa 0.95. |
| **Specialist parallel** (P1) | concept-designer + researcher + visual-designer parallel inside planner-lead spawn (only if env propagation spike Q1 PASS) |

When parallel does NOT make sense (Cognition "Don't Build Multi-Agents" 2025-06):
- Sequential dependency (planner → builder → verifier): never parallel
- Single source of truth needed (spec writes): never parallel
- Cost-sensitive solo demo: stay sequential

## Coordinator's parallel spawn rules

```typescript
// pseudo-code in coordinator routing
if (preset.actors[next_speaker].parallel === true) {
  // spawn N siblings
  for (const sibling of preset.actors[next_speaker].siblings) {
    effects.push({
      kind: 'spawn',
      actor: sibling.id,
      harness: sibling.harness,
      provider: sibling.provider,
      model: sibling.model,
      // each gets isolated cwd
      cwd: `sessions/${sid}/agent-workspace/${sibling.id}/`,
      // same envelope, but parent_event_id differs
    })
  }
  // wait for ALL to emit handoff.requested before routing next
  await waitForAll(siblings.map(s => s.expected_kind))
}
```

Single transcript, multi-write. flock (S15) enforces atomic append. ULID ordering preserves causal chain.

## Conflict resolution (Multi-Builder)

When 2+ builders produce game.html in parallel:
- **Verifier reads BOTH artifacts** (game-A.html + game-B.html)
- D6 portability score per artifact
- Verifier picks winner via `data.winner` field in judge.score
- Loser artifact moved to `sessions/<id>/artifacts/rejected/`
- transcript records both build events + judge.score with `data.winner` reference

## Conflict resolution (Multi-Judge consensus, P1)

When 3 verifiers produce judge.score in parallel:
- Coordinator computes consensus per dimension:
  - D1 spec_fit: median (LLM judgment)
  - D2 exec: identical (qa.result lookup, deterministic)
  - D3-D5: median per component (auto identical, semantic/quality median)
  - D6: identical (qa.result lookup)
  - aggregate: sum of consensus dims
  - verdict: majority vote (PASS/PARTIAL/FAIL)
- Final `judge.score.consensus = true` flag set
- Cohen's Kappa across 3 judges logged in audit

## Token budget

Parallel = N× LLM cost. Builder parallel ~2× total. Multi-judge ~3× verifier (each ~25K tokens) = ~75K tokens for verification alone.

[[bagelcode-budget-guardrails]] enforced thresholds:
- session_total_tokens ≤ 50K (default solo) → parallel modes raise to 150K (3-way) / 200K (multi-judge)
- per_spawn_timeout 5min (default) — parallel siblings each get same budget
- respec_count ≤ 3 (parallel doesn't multiply this)

## See also

- [[bagelcode-system-architecture-v3]] §6 (presets) + §8 (routing)
- [[bagelcode-llm-judge-frontier-2026]] R6 (multi-judge 97-98% F1)
- [[bagelcode-budget-guardrails]] — token cap rules
- `skills/subagent-spawn.md` — sequential single-spawn (default path)
