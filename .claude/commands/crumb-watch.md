---
description: Show live status of active Crumb session
argument-hint: "[session-id]"
allowed-tools: "mcp__crumb__crumb_status mcp__crumb__crumb_suggest"
---

Show the current state of a running Crumb session and what to do next.

1. If `$ARGUMENTS` is non-empty, use it as session ULID.
2. Otherwise, surface most recent in-flight session.
3. Call `mcp__crumb__crumb_status` with `{ session, limit: 15 }`.
4. Then call `mcp__crumb__crumb_suggest` with `{ session }` and report both back to the user — score progression + recommended next action (approve / veto / wait / redo).
