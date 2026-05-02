---
description: Cancel active Crumb session via stop intervention
argument-hint: "<session-id> [reason...]"
allowed-tools: "mcp__crumb__crumb_intervene Bash"
---

Cancel an active Crumb session.

Parse `$ARGUMENTS`: first token = session ULID; remainder = optional reason.

The session is stopped via two mechanisms in order:
1. Append `/note session cancelled by user: <reason>` so the transcript records intent (`mcp__crumb__crumb_intervene` with `action: "note"`).
2. Send `/pause <reason>` (`action: "pause"`) — the dispatcher will halt next-actor spawning. The user can then kill the detached subprocess via `pkill -f "crumb run --session <ULID>"` if needed (offer this as a follow-up, do not run unprompted — destructive).

Report what was sent and the kill command the user can run if hard-stop is required.
