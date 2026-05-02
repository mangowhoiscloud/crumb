---
description: Pause active Crumb session (or one actor)
argument-hint: "<session-id> [@actor] [reason...]"
allowed-tools: "mcp__crumb__crumb_intervene"
---

Send a `/pause` intervention.

Parse `$ARGUMENTS`:
- First token = session ULID.
- Optional `@<actor>` token after that scopes the pause to one actor (planner-lead / builder / verifier / builder-fallback / researcher / coordinator).
- Remainder = optional reason.

Call `mcp__crumb__crumb_intervene` with `{ session, action: "pause", target_actor?: <actor>, body?: <reason> }`.
