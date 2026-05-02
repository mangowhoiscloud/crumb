---
name: tdd-iron-law
description: |
  RED-GREEN-REFACTOR Iron Law for Crumb's builder. Ported from obra/superpowers (176k⭐) skills/test-driven-development.
  Read inline by `agents/builder.md` to enforce evidence-over-claims discipline.
when_to_use: builder spawn 안에서 game.html 작성 전 inline read
source: https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md
adapted_for: Crumb v0.1 builder (Phaser HTML5 single-file, no literal pytest)
---

# TDD Iron Law (Crumb adaptation)

## The Iron Law

> **"Production code only exists to make a failing test pass."** — superpowers TDD skill (verbatim)

Crumb adaptation (Phaser game domain, no literal unit tests in single-file HTML):

> **Every line in `artifacts/game.html` must directly satisfy a specific AC item from `artifacts/spec.md`. No speculative features. No "for-future-use" hooks.**

## RED-GREEN-REFACTOR cycle

### RED — define mental fail-test
Before writing implementation:
1. Read `artifacts/spec.md` AC list.
2. Pick one AC. Define how a verifier would notice if it's NOT met (mental fail-test).
   - "AC: 60s countdown timer" → mental test: "if I open game.html and don't see seconds decreasing within 1s of load, FAIL"
3. The fail-test must be observable from outside (verifier looks at game.html behavior, not source).

### GREEN — minimal implementation
1. Write the smallest Phaser code that would make the mental fail-test pass.
2. Don't add features beyond the AC. Don't add error handling for hypothetical cases.
3. Don't refactor existing code unless it blocks the AC.
4. Move to next AC.

### REFACTOR — only after qa.result PASS
1. **Refactor lives in the next spawn**, not this one.
2. After `kind=qa.result.exec_exit_code=0` arrives, if rebuild is needed (PARTIAL/FAIL), THEN consider:
   - removing duplication
   - extracting helpers
   - improving names
3. Refactor must keep `qa.result` green. Don't add behavior in refactor.

## Anti-rationalization rules

From superpowers verbatim ("Red Flags - STOP"):
- "Just this once" → No. Iron Law has no exceptions.
- "It's such a small feature" → If it's not in spec.md AC, it doesn't ship.
- "I'll add the test later" → No tests in this domain (qa.result is the test). Don't add code without an AC.
- "The user will probably want X" → User says what they want via `kind=user.intervene`. Wait for it.

## What this skill does NOT enforce

- Crumb game domain ≠ pytest domain. There's no literal RED test file to write.
- Iron Law translates to: **AC-driven generation**. Every `Phaser.Scene` method, every `phaser.add.X` call must trace back to a `spec.md` AC.
- The "test" is `qa.result` (htmlhint + playwright deterministic). Builder doesn't run it.

## Builder's checklist before STOP

Before emitting `kind=handoff.requested`:
- [ ] Every AC in spec.md addressed (check `data.ac_addressed` covers spec AC ids)
- [ ] No phaser API calls without an AC trace
- [ ] No magic numbers in code (all in `tuning.json`)
- [ ] No console.log or debug code
- [ ] sha256 computed and emitted in `kind=artifact.created`
- [ ] `kind=build` with `data.loc_own_code` ≤ 60000 chars

## See also

- [[bagelcode-system-architecture-v0.1]] §7 — 3-layer scoring (qa_check effect = ground truth)
- `agents/builder.md` — uses this skill inline
- `skills/verification-before-completion.md` — sister skill for verifier
