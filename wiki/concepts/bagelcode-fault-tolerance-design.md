---
title: Bagelcode Task — Fault Tolerance Design (connection / communication / agent itself)
category: concepts
tags: [bagelcode, fault-tolerance, resilience, circuit-breaker, retry, fallback, observability]
sources:
  - "[[bagelcode-frontier-orchestration-2026]]"
  - "[[bagelcode-orchestration-topology]]"
  - "[[bagelcode-transcripts-schema]]"
  - "[[kiki-circuit-breaker]]"
  - "[[kiki-scorecard-guards]]"
created: 2026-05-01
updated: 2026-05-01
---

# Fault Tolerance Design — connection / communication / agent itself

> ⚠️ **2026-05-02 supersession**: The scenario in the body where "Verifier (Gemini)" degrades to lint mode when OPEN was a v1-v2 assumption. **Starting from v0.1, Verifier is CourtEval inside Engineering Lead** — the degrade trigger is Codex circuit OPEN → switching to builder-fallback (claude-local) + automatic verdict downgrade when CourtEval's Critic cannot beat the Defender (schema-enforced). The external Gemini key invalid scenario (line 48) is irrelevant. Final lock = [[bagelcode-final-design-2026]] + [[bagelcode-budget-guardrails]].

> Adopted verbatim from the user's emphasis: "When environmental change occurs, fault response and adaptation must be caught at (1) **the connection**, (2) **the communication process**, and (3) **the per-part agent itself**." This page is the spec that maps frontier safeguards to those 3 axes.

## Failure Taxonomy

Organized into 5 modes across 3 axes × per-mode:

```
                       ┌─────────────────────────────────┐
        connection     │  F1. Adapter failure (network/auth)│
                       │  F2. Model/API environment change (rate, migration)
                       └─────────────────────────────────┘

                       ┌─────────────────────────────────┐
        communication  │  F3. Message schema violation / corruption │
                       │  F4. Concurrency / order / duplication      │
                       └─────────────────────────────────┘

                       ┌─────────────────────────────────┐
       agent itself    │  F5. Agent deception / hallucination / infinite loop │
                       └─────────────────────────────────┘
```

For each F#: (a) detection, (b) recovery primitive, (c) transcript representation, (d) user surface.

---

## F1 — Adapter failure (connection 1)

### Scenario
- Anthropic API 5xx, rate limit, OAuth expiry
- Codex CLI binary missing / auth token dead
- Gemini API key invalid

### Detection
- try/catch + structured error code on adapter call
- timeout (per-call 30s default, configurable)
- response schema validation failure

### Recovery primitive
1. **Retry with exponential backoff** — 1s/2s/4s, up to 3 attempts
2. **Circuit breaker** (borrowed from [[kiki-circuit-breaker]])
   - 3 failures within 5 min for the same adapter → **OPEN** (calls blocked for 1 min)
   - HALF_OPEN → 1 success → CLOSED
3. **Provider fallback** ([[bagelcode-orchestration-topology]] Hub-Ledger):
   - Builder.A (Claude Code) OPEN → **route to Builder.B (Codex)**
   - Verifier (Gemini) OPEN → **degrade to local lint mode** (static checks only, vision dropped)

### Transcript representation
```jsonc
{ "kind": "error", "from": "coordinator", "data": {
  "adapter": "claude-code", "code": "rate_limited",
  "retry_count": 2, "circuit": "half_open"
}}
{ "kind": "audit", "from": "coordinator", "data": {
  "fallback": "claude-code → codex", "reason": "circuit_open"
}}
```

### User surface
- TUI top-right health badge: `🟢 claude-code  🟡 codex  🔴 gemini (degraded)`
- Toast on circuit OPEN: "claude-code failed, falling back to codex. Use /switch to override manually."

---

## F2 — Model/API environment change (connection 2)

### Scenario
- Anthropic renames a model (`claude-opus-4` → `claude-opus-4-7`)
- Codex CLI major version bump → flag changes
- Gemini API endpoint migration
- User swaps API key mid-session

### Detection
- adapter performs **capability probe** on startup (`models.list`, `--version`)
- schema_mismatch error when response schema differs from expectations
- ENV change watcher (`.env` mtime polling)

### Recovery primitive
1. **Capability probe at startup** — at boot, each adapter checks its model list → if our requested model is missing, automatically pick an alternative
   ```
   requested: "claude-opus-4-7"  →  not found  →  fallback table ["claude-opus-4-6", "claude-sonnet-4-6"]
   ```
2. **Hot reload of `.env`** — re-init adapters when file modification is detected (inspired by Anthropic's rainbow deployment — no need to run old/new in parallel since the system is small enough for an instant swap)
3. **Schema migration table** — protocol version stamping for future compatibility

### Transcript representation
```jsonc
{ "kind": "audit", "from": "coordinator", "data": {
  "event": "model_substituted",
  "requested": "claude-opus-4-7", "actual": "claude-opus-4-6",
  "reason": "model_not_available"
}}
```

### User surface
- Print capability summary at the start of the first turn
- Inline notice on ENV change detection: "Anthropic key was swapped. Calling with the new key."

---

## F3 — Message schema violation / corruption (communication 1)

### Scenario
- LLM responds in markdown instead of the requested JSON
- `data` field missing / wrong type
- ULID format broken
- artifact ref sha256 mismatch

### Detection
- All transcript writes pass through a **JSON Schema validator** beforehand (already covered in [[bagelcode-transcripts-schema]] §"Append-only guarantees")
- artifact write auto-computes sha256 + cross-checks against ref

### Recovery primitive
1. **Strict + Lenient mode separation**:
   - Strict: validation fail → reject + return schema error to LLM + retry once (self-correction)
   - Lenient (debate / note): free-form text allowed
2. **Coercion layer** — partial matches are auto-corrected (e.g. JSON-in-markdown extract)
3. **Inspector pattern** ([[bagelcode-frontier-orchestration-2026]] §F):
   - A separate Verifier reviews "does the meaning of this message match the spec?"
   - Catches subtle corruption like Korean / English mixing

### Transcript representation
```jsonc
{ "kind": "error", "from": "validator", "data": {
  "violator_msg": "01J9...", "violation": "data.acceptance_criteria not array",
  "action": "retry_with_schema_hint"
}}
```

### User surface
- Validation-failed messages are greyed out in the TUI + "schema retry 1/2"
- After 2 failures, expose the raw text to the user and ask whether to continue

---

## F4 — Concurrency / order / duplication (communication 2)

### Scenario
- Coordinator + Verifier write to the transcript simultaneously → message lost
- The same message gets ack'd twice
- Time inversion (system clock jump)

### Detection
- ULID monotonicity break (when prev < curr does not hold)
- Same `id` appearing twice
- `in_reply_to` referencing a non-existent id

### Recovery primitive
1. **Append-only with O_APPEND + flock** — POSIX file advisory lock
2. **ULID dedup** — if the id already exists, ignore the second write (idempotent)
3. **Order reconciliation** — at read time, sort by `id`; do not trust ts
4. **At-least-once delivery + idempotency** — if an adapter retries but receives a response, it does not write twice with the same id (UUID seed in adapter call)

### Transcript representation
- Not displayed when normal (silent infrastructure)
- On anomaly: `kind=audit, event=duplicate_msg_dropped`

---

## F5 — Agent deception / hallucination / infinite loop (agent itself)

### Scenario
- Builder claims it produced code but no artifacts exist
- Verifier returns PASS but never executed
- Planner and Builder ping-pong infinitely
- Builder repeats the same wrong answer for the same spec (degeneration-of-thought)

### Detection
- **Anti-deception rules** ([[bagelcode-rubric-scoring]] §"Anti-Deception Rules") — enforced at the schema layer
- **stuck_count** (Magentic-One progress-ledger): same message pattern repeats 5+ times
- **Challenger pattern** ([[bagelcode-frontier-orchestration-2026]] §F): Verifier has the right to challenge Builder results
- **MAR (Multi-Agent Reflexion)**: a single reflexion cannot catch degeneration → cross-provider Verifier is essential

### Recovery primitive
1. **Schema-enforced anti-deception**:
   - Builder claims build but `artifacts` is empty → kind=error auto-emitted
   - Verifier returns PASS but no `exec.exit_code` → automatic 0 score + retry instruction
2. **Cross-provider Verifier** = same family (Anthropic/OpenAI) cannot validate its own output → force Gemini/GLM/local
3. **Stuck escalation**:
   - progress-ledger.stuck_count ≥ 5 → auto-escalate to user
   - "5th attempt with the same spec. Continue / abort / edit spec?"
4. **Local compensation (ALAS)**: when breaking an infinite loop, **roll back to the previous turn** and only change the instruction, do not restart from scratch

### Transcript representation
```jsonc
{ "kind": "audit", "from": "coordinator", "data": {
  "event": "stuck_detected", "pattern_repeats": 5,
  "action": "escalate_to_user"
}}
{ "kind": "verify.result", "data": {
  "verdict": "REJECT", "reason": "build claimed but artifacts.length == 0",
  "anti_deception_rule": "build_without_artifacts"
}}
```

### User surface
- Visualize the "stuck counter" at the bottom-left of the TUI
- On reaching 5, inline modal: "Ways out: redo / spec_diff / abort"

---

## Environmental change detection — Heartbeat / Health probe

A **per-30s health probe** for each adapter:

```typescript
async function probe(adapter): HealthStatus {
  const t0 = Date.now()
  try {
    const r = await adapter.ping()       // models.list / --version / no-op
    return { ok: true, latency: Date.now()-t0, version: r.version }
  } catch (e) {
    return { ok: false, error: e.code, since: lastSuccessAt[adapter] }
  }
}
```

→ The TUI health badge refreshes from this data.

→ When an adapter version change is detected (e.g. claude code 0.2.71 → 0.2.85) → record as audit + re-run capability probe.

## Priority + scope cutoff

| Primitive | Required (P0) | Recommended (P1) | Optional (P2) |
|---|---|---|---|
| Schema validator | ✅ | | |
| Anti-deception rules | ✅ | | |
| Retry + exp backoff | ✅ | | |
| Circuit breaker | ✅ | | |
| Provider fallback (A→B) | ✅ | | |
| Cross-provider Verifier | ✅ | | |
| Capability probe at startup | ✅ | | |
| Stuck escalation | ✅ | | |
| Hot ENV reload | | ✅ | |
| Inspector pattern (separate agent) | | ✅ | |
| File lock for append | | ✅ | |
| Idempotency UUID seed | | ✅ | |
| Hot model substitution | | | ✅ |
| ALAS local compensation refinement | | | ✅ |

→ P0 alone secures most of the **96.4% recovery** effect from ICML 2025's hierarchical + safeguard.

## Measurement hook (add a dimension to the rubric)

Consider an additional dimension on top of [[bagelcode-rubric-scoring]]'s 5 dimensions:

| New dimension | Measurement |
|---|---|
| **D6. Resilience** | Recovery rate under intentional fault injection (e.g. successful codex fallback after killing the claude adapter) |

→ Showing `kill -9 $(pgrep claude-code)` once in the demo video gives a strong signal.

## See also

- [[bagelcode]] / [[bagelcode-task-direction]]
- [[bagelcode-orchestration-topology]] — the topology this fault tolerance sits on
- [[bagelcode-frontier-orchestration-2026]] — primary source
- [[bagelcode-transcripts-schema]] — base for the schema validator
- [[bagelcode-rubric-scoring]] — review for adding the D6 Resilience dimension
- [[bagelcode-agents-fixed]] — per-adapter health probe specifics
- [[kiki-circuit-breaker]] — kiki's circuit breaker production case
- [[kiki-scorecard-guards]] — inspiration from C14 (wake after 10s) and C18 (least-loaded peer) guards
