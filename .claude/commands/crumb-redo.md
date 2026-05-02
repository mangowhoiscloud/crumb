---
description: Request a redo (re-spec / re-build) in active Crumb session
argument-hint: "<session-id> [free-text feedback...]"
allowed-tools: "mcp__crumb__crumb_intervene mcp__crumb__crumb_status"
---

Send a `/redo` intervention with optional feedback body.

Parse `$ARGUMENTS`: first token = session ULID; remainder = optional feedback text fed into `body`.

Call `mcp__crumb__crumb_intervene` with `{ session, action: "redo", body: <remainder if any> }`.
