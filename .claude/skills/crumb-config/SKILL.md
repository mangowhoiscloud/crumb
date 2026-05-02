---
name: crumb-config
description: >-
  Recommend a Crumb preset (bagelcode-cross-3way / mock / sdk-enterprise / solo)
  based on the user's setup intent. Trigger on "preset 추천", "추천해줘", "어떤 셋업",
  "which preset", "suggest a config", "혼자 돌릴까", "Codex 같이 쓸까", or hints
  about installed tools / API keys / cross-provider intent. Output: recommended
  preset + reason + alternatives. Crumb suggests only — user picks. Read-only.
  Do NOT trigger for game pitches (use `crumb` skill) or status checks (use
  `crumb-status` skill).
---

# /crumb-config — preset 추천

When the user asks for a preset suggestion in natural language:

**Preferred path** — call the `crumb_config` MCP tool (registered via project `.mcp.json`) with the user's intent string. Tool description matches Korean + English triggers.

**Fallback path** — if MCP server is unreachable, run:

```bash
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
npx tsx src/index.ts config "<user's natural-language intent>"
```

Show the output verbatim — `recommended` line + `reason` + alternatives table. End with: "선택은 사용자 — `--preset <name>` 으로 적용". Do NOT auto-pick.

Explicit slash form: type `/crumb-config <intent>` to invoke directly.

Reference: `src/helpers/config.ts`, `wiki/concepts/bagelcode-system-architecture-v0.1.md` §6 (4 preset).
