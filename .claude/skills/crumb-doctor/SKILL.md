---
name: crumb-doctor
description: >-
  Check whether the host environment can run Crumb — 3 host CLI authentication
  (Claude Code / Codex / Gemini), playwright availability, htmlhint fallback.
  Returns viable-preset table. Trigger on "환경 점검해줘", "doctor", "어떤 preset
  가능?", "preset 가능한 거 알려줘", "is my setup ready?", "what can I run?",
  "환경 어때?", or before starting a fresh session in an unfamiliar environment.
  Read-only.
---

# /crumb-doctor — 환경 점검

When the user asks about environment readiness or what presets are viable:

**Preferred path** — call the `crumb_doctor` MCP tool (no args).

**Fallback path** — `npx tsx src/index.ts doctor`.

Output table: `| Host | Status | Detail |` for Claude Code / Codex CLI / Gemini CLI / playwright / htmlhint. Then `## 추천 preset (현재 환경 기준)` with viable / not-viable per preset.

Explicit slash form: `/crumb-doctor`.

Reference: `src/helpers/doctor.ts`, v0.1 §3 (auth-manager spec).
