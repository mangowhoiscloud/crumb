---
name: crumb-suggest
description: >-
  Recommend the user's next action in an active Crumb session — /approve,
  /veto, /redo, /pause, wait, or open summary. Branches on last event +
  verdict + audit + stuck_count. Trigger on "이제 뭐 하지?", "다음에 뭐 할까?",
  "what next", "next action", "다음 단계", "이거 끝난 거야?", "이거 어떻게
  마무리?", or any "I'm not sure what to do" hesitation. Read-only. Output:
  primary recommendation + 1-3 alternatives. Do NOT trigger for status snapshots
  (use `crumb-status`) or fault diagnosis (use `crumb-debug`).
---

# /crumb-suggest — 다음 사용자 액션 추천

Resolve the session id (most recent if unspecified).

**Preferred path** — call the `crumb_suggest` MCP tool with `{session: "<ulid>"}`.

**Fallback path** — `npx tsx src/index.ts suggest <session-id>`.

Output: `▶ <primary>` (single line) + rationale + command. Up to 3 alternatives.

Explicit slash form: `/crumb-suggest <session-id>`.

Reference: `src/helpers/suggest.ts`, v3 §11 (5 user event), §8.1 (PARTIAL → hook).
