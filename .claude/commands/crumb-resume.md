---
description: Resume paused Crumb session (or one actor)
argument-hint: "<session-id> [@actor]"
allowed-tools: "mcp__crumb__crumb_intervene"
---

Send a `/resume` intervention.

Parse `$ARGUMENTS`: first token = session ULID; optional `@<actor>` scopes resume to that actor.

Call `mcp__crumb__crumb_intervene` with `{ session, action: "resume", target_actor?: <actor> }`.

Note: this is the in-flight TUI-equivalent /resume — it lifts a `user.pause` event. To re-enter a *crashed* or *terminated* session, use the `crumb resume <session-id>` CLI command instead (different mechanism — re-derives state and surfaces a continuation command).
