# Crumb Event Emission Protocol

> Every Crumb sandwich agent emits transcript events through the `crumb event` CLI helper. This file is the canonical reference; each Lead sandwich (`planner-lead.md`, `engineering-lead.md`, `builder-fallback.md`, `coordinator.md`) appends a copy of this protocol so the agent doesn't have to read external files.

## Environment (set by the adapter)

| Variable | Meaning |
|---|---|
| `CRUMB_TRANSCRIPT_PATH` | Absolute path to the session's `transcript.jsonl` |
| `CRUMB_SESSION_ID` | ULID identifying this session |
| `CRUMB_SESSION_DIR` | Working directory (cwd is also set to this) |
| `CRUMB_ACTOR` | The `from` actor for events you emit |

## How to emit an event

Use the Bash tool to pipe JSON into `crumb event`:

```bash
crumb event <<'JSON'
{
  "session_id": "$CRUMB_SESSION_ID",
  "from": "$CRUMB_ACTOR",
  "kind": "step.concept",
  "body": "Defined 6×6 grid match-3 with 60s timer and 4-tile combo bonus"
}
JSON
```

`crumb event` will:
1. Auto-fill `id` (ULID) and `ts` (ISO-8601 UTC) if you omit them.
2. Validate against `protocol/schemas/message.schema.json` (rejects unknown `kind`, malformed `scores`, etc.).
3. Append the canonical line to `$CRUMB_TRANSCRIPT_PATH`.
4. Print `{"id": "...", "ts": "..."}` so you can reference the event id from later messages.

Always quote the heredoc tag (`<<'JSON'`) so the shell does not expand `$` inside the body. Resolve env vars in your bash invocation before piping if you need them substituted.

## Required events per sandwich step

| Sandwich | Required `kind` sequence |
|---|---|
| **planner-lead** | `step.socratic` (×N), `step.concept`, `step.research`, `step.design`, `artifact.created` (×3), `spec`, `handoff.requested` |
| **engineering-lead** | `step.builder`, `step.qa`, `step.judge` (×4: grader/critic/defender/regrader), `artifact.created`, `judge.score`, `verify.result`, `handoff.requested` |
| **builder-fallback** | Same as engineering-lead, plus `audit` events for `fallback_activated` / `fallback_completed` |
| **coordinator** | `agent.wake`, `agent.stop`, `hook`, `done` (router only — does not write artifacts) |

## Validation rules to remember

- `scores.aggregate` must equal the sum of D1–D6 (validator forces `verdict=FAIL` if mismatched).
- `judge.score` with `verdict=PASS` requires a prior `step.qa` with `data.exec_exit_code=0` (Iron Law).
- Empty `artifacts` array on a `build` claim → automatic `D2=0`.
- Always include `parent_event_id` linking back to your `agent.wake` so the transcript graph stays connected.

## Sample full sequence (planner-lead first turn)

```bash
WAKE=$(crumb event <<'J'
{"from":"$CRUMB_ACTOR","kind":"agent.wake","body":"planner-lead starting"}
J
)
WAKE_ID=$(echo "$WAKE" | jq -r .id)

crumb event <<J
{"from":"$CRUMB_ACTOR","kind":"step.concept","parent_event_id":"$WAKE_ID","body":"6x6 match-3 grid, 60s timer"}
J

crumb event <<J
{"from":"$CRUMB_ACTOR","kind":"spec","parent_event_id":"$WAKE_ID","body":"final spec","data":{"acceptance_criteria":["AC1","AC2","AC3"]}}
J

crumb event <<J
{"from":"$CRUMB_ACTOR","kind":"handoff.requested","to":"engineering-lead","parent_event_id":"$WAKE_ID"}
J
```

## What NOT to emit

- Long `body` text (>2KB) — write it as an artifact and emit `kind=artifact.created` with `path` + `sha256` instead.
- Internal monologue / debug logs — those go to stderr (the adapter discards them) or to a `kind=note` with `metadata.visibility="private"`.
- Events with `from` other than `$CRUMB_ACTOR` — the validator will reject impersonation attempts.
