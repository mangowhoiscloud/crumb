---
description: Veto a build/judge in active Crumb session
argument-hint: "<session-id> [target-msg-id-or-reason...]"
allowed-tools: "mcp__crumb__crumb_intervene mcp__crumb__crumb_status"
---

Send a `/veto` intervention to the active Crumb session.

Parse `$ARGUMENTS`:
- First token = session id (ULID).
- Remainder = optional target message id (ULID prefix) OR free-text reason for the veto.

Then call `mcp__crumb__crumb_intervene` with `{ session, action: "veto", body: <remainder> }`.

If the user did not pass a session id, call `mcp__crumb__crumb_status` first or ask which session.
