@AGENTS.md

# GEMINI.md — Gemini CLI Augmentation

> **Auto-loaded by Gemini CLI** when invoked from this repo's working directory.
> The `@AGENTS.md` line above imports the universal Crumb identity (architecture invariants, actors, schema, multi-host entries, preset, Don't / Must) inline.
>
> If your Gemini CLI version does not yet expand `@<file>` imports inside GEMINI.md, the same content is auto-loaded via `.gemini/settings.json` `contextFileName` (which lists both `AGENTS.md` and `GEMINI.md`).
>
> Single source of truth for all universal content: [`AGENTS.md`](./AGENTS.md).

---

## Gemini CLI specifics

### Quickstart

```bash
gemini login    # Google AI Pro / Ultra subscription, OR set GEMINI_API_KEY env

# Inside a Gemini CLI session, in this repo:
/crumb 60초 매치-3 콤보 보너스 게임 만들어줘
```

The `.gemini/extensions/crumb/` extension provides:
- `commands/crumb.toml` — `/crumb <pitch>` slash command
- `gemini-extension.json` — manifest with MCP server registration
- `GEMINI.md` (extension-scoped) — Gemini's role within the active preset

### Gemini's role in `bagelcode-cross-3way` (default preset)

| Actor | Binding |
|---|---|
| coordinator | ambient (entry host = gemini-cli when entered via `/crumb` here) |
| planner-lead | ambient |
| builder | `codex` + `gpt-5.5-codex` (cross-provider for cross-assemble) |
| **verifier** | **`gemini-cli` + `gemini-3-1-pro`** ← Gemini's natural seat |
| builder-fallback | ambient |

**Why Gemini = verifier in the default preset**: Gemini 3.1 Pro's multimodal capability is well-suited for screenshot-based grading of `artifacts/game.html` (D1 spec_fit + D3 semantic). CourtEval's 4 sub-step (Grader → Critic → Defender → Re-grader, ACL 2025) runs inline within the verifier spawn; D2 / D6 are looked up from the prior `qa.result` (deterministic, dispatcher-emitted, no LLM).

User can override per-actor binding via `.crumb/presets/<name>.toml`. `crumb doctor` reports which presets are reachable in the current environment.

### Memory / context loading (Gemini CLI spec)

Gemini CLI loads context files via hierarchical scan:
1. Global: `~/.gemini/<contextFileName>`
2. Project root: walks upward from cwd to git root or home
3. Subdirectories below cwd: up to 200 dirs (configurable via `context.discoveryMaxDirs`)

This repo's `.gemini/settings.json` declares:

```json
{ "context": { "fileName": ["AGENTS.md", "GEMINI.md"] } }
```

So Gemini auto-loads both `AGENTS.md` (universal) and `GEMINI.md` (this file) at session start. The extension at `.gemini/extensions/crumb/` adds the `/crumb` slash command and an extension-scoped `GEMINI.md` that activates only when the extension is loaded.

Run `/memory show` inside Gemini CLI to inspect the combined context.

### See also

- [`AGENTS.md`](./AGENTS.md) — universal Crumb identity (the file imported above)
- [`.gemini/extensions/crumb/`](./.gemini/extensions/crumb/) — Gemini extension manifest + GEMINI.md + commands/crumb.toml
- [`.gemini/settings.json`](./.gemini/settings.json) — `contextFileName` configuration
- [`agents/verifier.md`](./agents/verifier.md) — verifier sandwich (Gemini's natural seat)
- [`wiki/references/bagelcode-frontier-cli-convergence-2026.md`](./wiki/references/bagelcode-frontier-cli-convergence-2026.md) — 4 CLI × 7 primitive convergence
