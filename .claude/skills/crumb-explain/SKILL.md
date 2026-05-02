---
name: crumb-explain
description: >-
  Explain a Crumb transcript event kind (39+ kinds: qa.result, judge.score,
  step.judge, user.intervene, handoff.rollback, etc.). Returns category, emitter,
  parent chain, payload shape, source-of-truth (D1-D6), and wiki spec ref.
  Trigger on "judge.score 가 뭐야?", "qa.result 는 뭔가요?", "explain <kind>",
  "이 kind 어디 emit?", "what is the X kind", "어떤 actor 가 emit해?", or any
  schema-vocabulary question. Read-only. Do NOT trigger for general "what is
  Crumb" or status questions.
---

# /crumb-explain — 39 kind schema lookup

When the user asks about a transcript event kind:

**Preferred path** — call the `crumb_explain` MCP tool with `{kind: "<name>"}`.

**Fallback path** — `npx tsx src/index.ts explain "<kind>"`.

For partial matches (e.g., "user" → user.intervene / user.veto / ...), tool returns a did-you-mean list.

Explicit slash form: `/crumb-explain <kind>`.

Reference: `src/helpers/explain.ts` (KIND_REGISTRY), `protocol/schemas/message.schema.json`, v0.1 §3.3.
