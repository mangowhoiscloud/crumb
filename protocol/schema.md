# Crumb Transcript Schema (1-page spec)

> v3.3: 43 kinds × 11 fields × OTel GenAI alias. 5-layer hierarchy (project → session → run → turn → step → event) — run_id/turn_id in `metadata.crumb`, conversation_id/agent_id/workflow_name in `metadata.gen_ai`.
> See `wiki/concepts/bagelcode-transcripts-schema.md` and `wiki/bagelcode-final-design-2026.md` for full design.

## Message structure (TypeScript)

See `src/protocol/types.ts`.

## 43 kinds

System (5): session.start, session.end, session.forked, agent.wake, agent.stop
Workflow (11): goal, question.socratic, answer.socratic, spec, spec.update, build,
               qa.result, verify.request, verify.result, judge.score, done
Reasoning (5): agent.thought_summary, question, answer, debate, note
Specialist step (5): step.socratic, step.concept, step.research, step.design, step.judge
User intervention (5): user.intervene, user.veto, user.approve, user.pause, user.resume
Handoff (3): handoff.requested, handoff.accepted, handoff.rollback
Artifacts/meta (7): artifact.created, ack, error, audit, tool.call, tool.result, hook
Version (2): version.released, version.refinement

## Anti-deception rules (5)

Enforced in `src/validator/anti-deception.ts`:
1. PASS without exec.exit_code → D2 = 0
2. PASS without criteria array → D1 = 0
3. Spec with empty AC → D1 = 0
4. Build claim without artifacts → D2 = 0
5. user.veto followed by done → all dimensions 0
