# Crumb Transcript Schema (1-page spec)

> 28 kinds × 11 fields × OTel GenAI alias.
> See `wiki/concepts/bagelcode-transcripts-schema.md` and `wiki/bagelcode-final-design-2026.md` for full design.

## Message structure (TypeScript)

See `src/types/message.ts` (forthcoming).

## 28 kinds

System (4): session.start, session.end, agent.wake, agent.stop
Workflow (10): goal, question.socratic, answer.socratic, spec, spec.update, build,
               verify.request, verify.result, judge.score, done
Reasoning (5): agent.thought_summary, question, answer, debate, note
Specialist step (5): step.socratic, step.concept, step.research, step.design, step.judge
User intervention (4): user.intervene, user.veto, user.approve, user.pause/.resume
Handoff (2): handoff.requested, handoff.accepted
Artifacts/meta (4): artifact.created, ack, error, audit

## Anti-deception rules (5)

Enforced in `src/validator/anti-deception.ts`:
1. PASS without exec.exit_code → D2 = 0
2. PASS without criteria array → D1 = 0
3. Spec with empty AC → D1 = 0
4. Build claim without artifacts → D2 = 0
5. user.veto followed by done → all dimensions 0
