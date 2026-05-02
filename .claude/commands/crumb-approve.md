---
description: Approve verifier verdict in active Crumb session
argument-hint: "[session-id]"
allowed-tools: "mcp__crumb__crumb_intervene mcp__crumb__crumb_status mcp__crumb__crumb_suggest"
---

Send an `/approve` intervention to the active Crumb session.

1. If `$ARGUMENTS` is non-empty, treat it as the session id (ULID).
2. Otherwise, call `mcp__crumb__crumb_status` with no session arg and let it surface the most recent in-flight session, OR ask the user for the ULID.
3. Call `mcp__crumb__crumb_intervene` with `{ session, action: "approve" }`.
4. After the call, briefly suggest polling `mcp__crumb__crumb_status` to see the next verifier turn.
