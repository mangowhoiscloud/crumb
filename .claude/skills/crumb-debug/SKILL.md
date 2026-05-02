---
name: crumb-debug
description: >-
  Diagnose Crumb routing faults against the F1-F7 fault matrix (adapter spawn
  fail / subprocess timeout / schema validation / qa.result missing / self-bias
  risk / infinite loop / env not propagated). Trigger on "왜 멈췄어?", "에러
  났어?", "왜 안 돼?", "어디서 막혔어?", "session stuck", "debug", "fault",
  "이거 왜 이래?", or signs of trouble (no progress, repeated kinds, error
  events). Read-only. Returns table + suggested actions per detected fault.
---

# /crumb-debug — F1-F7 routing 장애 진단

When the user reports the session is stuck / broken:

**Preferred path** — call the `crumb_debug` MCP tool with `{session: "<ulid>"}`.

**Fallback path** — `npx tsx src/index.ts debug <session-id>`.

If all clear, the report says `✅ No faults detected.` Otherwise table of detected F1-F7 with evidence + suggested action.

Explicit slash form: `/crumb-debug <session-id>`.

Reference: `src/helpers/debug.ts`, v0.1 §8.2 (F1-F7 fault matrix), `wiki/concepts/bagelcode-fault-tolerance-design.md`.
