---
name: crumb-status
description: >-
  Show current Crumb session status — last 10 signal events, latest D1-D6
  scorecard with source-of-truth, total cost / cache hit / wall, stuck count.
  Trigger on "지금 어디까지 갔어?", "상황 어때?", "status", "session progress",
  "어떻게 진행 중?", "점수가 얼마야?", "scorecard 보여줘", or any "what's
  happening with my session" question. Read-only. Requires an active or recent
  session id (ULID). Do NOT trigger for new game pitches (use `crumb` skill) or
  preset questions (use `crumb-config` skill).
---

# /crumb-status — 진행 상황 + last events + scores

Resolve the session id: prefer the most recent `sessions/<ulid>/` if not specified, else ask the user.

**Preferred path** — call the `crumb_status` MCP tool with `{session: "<ulid>"}` (and optional `limit`).

**Fallback path** — `npx tsx src/index.ts status <session-id>`.

Output sections: `## Recent N events`, `## Latest judge.score` (with D1-D6 source badges), `## Totals`. Mark deterministic events with ★, audit_violations red.

Explicit slash form: `/crumb-status <session-id>`.

Reference: `src/helpers/status.ts`, v0.1 §4.2 (per-turn flow).
