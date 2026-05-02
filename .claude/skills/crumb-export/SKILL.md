---
name: crumb-export
description: >-
  Export a Crumb session transcript to OpenTelemetry GenAI Semantic Conventions
  (otel-jsonl), Anthropic Console import format (anthropic-trace), or chrome://tracing
  (chrome-trace). Trigger on "OTel 로 변환", "datadog 으로", "Vertex 로", "trace
  export", "convert to OTel", "Anthropic Console 에 올려", "chrome tracing", or
  any request to ship the transcript to an external observability platform. Read-only.
---

# /crumb-export — transcript → standard format

When the user wants to ship a session transcript to an external observability platform:

**Preferred path** — call the `crumb_export` MCP tool with `{session: "<ulid>", format: "otel-jsonl"|"anthropic-trace"|"chrome-trace"}`.

**Fallback path** — `npx tsx src/index.ts export <session-id> --format <fmt>`.

Default format = `otel-jsonl` (Datadog / Vertex / Phoenix / Langfuse / AgentOps 호환). `anthropic-trace` for Claude Console import. `chrome-trace` for `chrome://tracing` (per-actor lane via `tid`).

Auto-emitted on session end at `sessions/<id>/exports/{otel.jsonl, anthropic-trace.json, chrome-trace.json}` — this skill is for ad-hoc on-demand exports.

Explicit slash form: `/crumb-export <session-id> [format]`.

Reference: `src/exporter/otel.ts`, v3 §10.3, `wiki/references/bagelcode-observability-frontier-2026.md`.
