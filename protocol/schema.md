# Crumb Transcript Schema (1-page spec)

> v0.3.0: 35 kinds × 11 fields × OTel GenAI alias. 5-layer hierarchy (project → session → run → turn → step → event) — run_id/turn_id in `metadata.crumb`, conversation_id/agent_id/workflow_name in `metadata.gen_ai`.
> See `wiki/concepts/bagelcode-transcripts-schema.md` and `wiki/bagelcode-final-design-2026.md` for full design.
>
> PR-Prune-1 removed 9 never-emitted kinds (session.forked, verify.request, question, answer, debate, version.refinement, ack, handoff.accepted, hook). `agent.thought_summary` is kept for verifier input filtering; `tool.call` / `tool.result` are kept as the dispatcher's stream-json tap pair.

## Message structure (TypeScript)

See `src/protocol/types.ts`.

## 35 kinds

System (4): session.start, session.end, agent.wake, agent.stop
Workflow (10): goal, question.socratic, answer.socratic, spec, spec.update, build,
               qa.result, verify.result, judge.score, done
Reasoning (2): agent.thought_summary, note
Specialist step (6): step.socratic, step.concept, step.research, step.research.video, step.design, step.judge
User intervention (5): user.intervene, user.veto, user.approve, user.pause, user.resume
Handoff (2): handoff.requested, handoff.rollback
Artifacts/meta (5): artifact.created, error, audit, tool.call, tool.result
Version (1): version.released

## Anti-deception rules (5)

Enforced in `src/validator/anti-deception.ts`:
1. PASS without exec.exit_code → D2 = 0
2. PASS without criteria array → D1 = 0
3. Spec with empty AC → D1 = 0
4. Build claim without artifacts → D2 = 0
5. user.veto followed by done → all dimensions 0
