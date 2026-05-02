---
name: code-review-protocol
description: |
  Handoff protocol between builder and verifier. Ported from obra/superpowers (176k⭐) skills/{requesting,receiving}-code-review.
  Defines deviation classification (Critical/Important/Suggestion) and handoff routing.
when_to_use: builder/verifier 양쪽이 inline read. builder는 emit 형식 참조, verifier는 분류 룰 참조.
source: https://github.com/obra/superpowers/blob/main/agents/code-reviewer.md
adapted_for: Crumb v3 (handoff.requested + handoff.rollback + spec.update routing)
---

# Code Review Protocol (Crumb adaptation)

## Builder side — what to emit

When builder finishes (kind=build), include in `data`:

```json
{
  "phaser_version": "3.80.1",
  "loc_own_code": 5234,
  "ac_addressed": ["AC-1", "AC-2", "AC-3"],
  "ac_skipped": [],
  "deviations_from_spec": [
    {
      "type": "Important",
      "spec_ref": "AC-4: 60s countdown",
      "actual": "55s due to Phaser timer precision",
      "justification": "Phaser timer fires every 100ms; 60s exact requires custom counter, scope expansion"
    }
  ],
  "open_questions": ["Is 5s tolerance OK or need exact 60s?"]
}
```

If no deviations, `deviations_from_spec: []`. Empty `ac_skipped` is required for verdict=PASS path.

## Verifier side — deviation classification

For each item in `build.data.deviations_from_spec`, classify and route:

| Class | Definition | Verifier action | Routing |
|---|---|---|---|
| **Critical** | AC fundamentally not met (e.g., "match-3 game" but no grid) | D1 score = 0-1; verdict = FAIL | `handoff.rollback` to planner-lead with feedback (spec needs revision) |
| **Important** | AC partially met or trade-off declared | D1 score capped at 3-4; verdict = PARTIAL | `handoff.requested` to coordinator with `payload={user_modal_required: true}` |
| **Suggestion** | Style / readability / could be better | No D1 impact; mention in feedback | normal verdict path |

## Reviewer persona (superpowers code-reviewer verbatim)

> "Acknowledge strengths before highlighting issues (constructive framing)"
> "Question plan deviations and seek confirmation from the coding agent"
> "If you find significant deviations from the plan, ask the coding agent to review and confirm"

Crumb translation:
- Verifier's `feedback` field starts with what's working, then issues
- Critical/Important deviations → handoff.rollback (not just FAIL verdict) — gives planner-lead chance to update spec
- Verifier doesn't argue with builder directly; rollback is to planner-lead

## Spec.update path (Critical deviation)

```
verifier emits handoff.rollback to planner-lead
   data: { reason: "spec needs revision", deviation: {...}, suggested_change: "..." }
   ↓
coordinator routes to planner-lead respawn (re-enters Socratic if ambiguity)
   ↓
planner-lead emits kind=spec.update (not full spec — diff only)
   ↓
coordinator routes to builder respawn with updated spec context
```

Counter (per [[bagelcode-budget-guardrails]]): max `respec_count <= 3` per session. Beyond → adaptive_stop or user hook.

## Escalation matrix (when verifier can't decide)

| Situation | Action |
|---|---|
| Builder claims `phaser_loaded: true` but qa.result.phaser_loaded=false | Trust qa.result. D2=0. audit_violations += "builder_self_assessment_attempt" |
| Spec AC ambiguous (e.g., "fun gameplay") | D1 score reflects best interpretation; mention in feedback; verdict can still PASS if other dims compensate |
| build event missing entirely (builder crashed mid-spawn) | Cannot grade. Verdict = REJECT. handoff.rollback to builder-fallback or coordinator hook |

## See also

- [[bagelcode-system-architecture-v3]] §4.2 (handoff protocol) + §8.2 (F1-F7 fault matrix)
- `agents/builder.md` — emits per this protocol
- `agents/verifier.md` — classifies per this protocol
- `skills/verification-before-completion.md` — sister gate
