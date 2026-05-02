---
name: crumb-model
description: >-
  Show or change Crumb per-actor model + effort + per-provider activation
  (claude-local / codex-local / gemini-cli-local). Defaults to all high-end
  models (claude-opus-4-7 / gpt-5.5-codex / gemini-3-1-pro) + effort=high.
  Gemini model IDs accept both dot ("gemini-3.1-pro") and dash
  ("gemini-3-1-pro") forms — internally normalized.
  Trigger on "verifier 모델을 X 로", "set builder model to Y", "effort 다 high
  로", "effort all to low", "codex 비활성화", "disable gemini", "어떤 모델
  쓰고 있어?", "모델 설정 보여줘", "show model config", "어떤 effort?", or any
  per-actor / per-provider tuning request. Read-only when no instruction given.
  Do NOT trigger for preset recommendation (use `crumb-config` skill) or
  environment readiness (use `crumb-doctor` skill).
---

# /crumb-model — model + provider config

When the user wants to inspect or change Crumb's per-actor model assignment,
effort level, or per-provider activation:

**Preferred path** — call the `crumb_model` MCP tool. Pass `instruction` for changes,
omit for read-only show:

- "verifier 모델을 gemini-3-1-pro 로" → instruction sets verifier model
  (also accepts dot form "gemini-3.1-pro" — normalized to dash)
- "effort 다 high 로" → instruction sets all-actor effort=high
- "codex 비활성화" → instruction disables codex-local provider
- (no instruction) → returns the current config table

**Fallback path** — `npx tsx src/index.ts model --apply "<instruction>"` (or
`--show` for read-only, or no flag for interactive blessed TUI with Tab/↑↓/←→/p/Enter/Esc).

**Interactive TUI** is the operator's choice; the MCP tool is the NL surface
(skill / model selection / explicit Korean or English instruction).

Output is a status table:
- `## providers` — `✓` enabled / `✗` disabled, per local CLI
- `## actors` — actor / harness / model / effort, one row per outer actor

Defaults (when `.crumb/config.toml` is missing):
- coordinator + planner-lead → claude-opus-4-7 / claude-code / high
- builder → gpt-5.5-codex / codex / high
- verifier → gemini-3-1-pro / gemini-cli / high
- builder-fallback → claude-sonnet-4-6 / claude-code / high
- All 3 local providers enabled.

Explicit slash form: `/crumb-model <instruction>` or `/crumb-model` (show).

Reference: `src/config/model-config.ts`, `src/tui/model-edit.ts`, v3 §5.1 (resolve order).
