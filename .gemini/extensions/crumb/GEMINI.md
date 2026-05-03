# Crumb — Gemini CLI extension context

> Universal identity (read first): [`../../AGENTS.md`](../../AGENTS.md) — Linux Foundation Agentic AI Foundation standard, universal Crumb identity. Auto-loaded by Gemini CLI via `.gemini/settings.json` `contextFileName: ["AGENTS.md", "GEMINI.md"]`. This file is the **extension-scoped** Gemini glue on top of that universal identity (root [`../../GEMINI.md`](../../GEMINI.md) is the **session-scoped** Gemini augmentation).
>
> Bagelcode New Title Team multi-agent collaboration tool. Used when Gemini CLI is the host harness.
> See: wiki/concepts/bagelcode-system-architecture-v0.1.md

## System identity

Crumb is a multi-agent harness in which 6 actors (coordinator + planner-lead + researcher + builder + verifier + builder-fallback) collaborate over a transcript JSONL (40 kind × 11 field). From v0.3.0 the researcher is a dedicated actor — bound to gemini-sdk for gameplay-video ground truth (Gemini 3.1 Pro native YouTube URL @ 10fps).

Natural-language goal → spec → build → qa_check (deterministic) → verify (CourtEval inline) → done.

## Gemini's slot (default preset bagelcode-cross-3way)

- coordinator: ambient (gemini-cli)
- planner-lead: ambient (gemini-cli)
- builder: codex CLI subprocess (different host)
- **verifier: gemini-cli** ← this slot, leveraging multimodal screenshot verification
- builder-fallback: ambient

Why Gemini sits at verifier: 2.5-pro's multimodal capability is well-suited to screenshot verification of `game.html`. CourtEval's 4 sub-steps (Grader / Critic / Defender / Re-grader) run inline to produce the LLM-judged dimensions D1 spec_fit + D3.semantic + D5.quality.

## Usage

```
/crumb 60초 매치-3 콤보 게임 만들어줘
```

The extension's `commands/crumb.toml` is the trigger. Entry runs in the coordinator role.

## User intervention

All 3 surfaces drop identical transcript lines — routing is source-agnostic.

| Surface | Recommendation under Gemini CLI | How to input |
|---|---|---|
| `inbox.txt` | ★ 1st choice | `echo "@verifier ..." >> $CRUMB_SESSION_DIR/inbox.txt` (shell-friendly) |
| TUI slash bar | Requires a separate terminal | `crumb tui` then `/goto verifier`, `/append @builder ...`, etc. |
| JSON event | For scripts | `echo '{...}' \| npx tsx src/index.ts event` |

Detailed grammar + `data` fields (`target_actor` / `goto` / `swap` / `reset_circuit` / `sandwich_append` / `actor`) — see `commands/crumb.toml` §4 + `agents/coordinator.md` Routing Rules.

→ Frontier: LangGraph `Command(goto/update={...})` (53/60), Paperclip BYO swap (38/60), Codex `APPEND_SYSTEM.md` (38/60). Background: `wiki/synthesis/bagelcode-user-intervention-frontier-2026-05-02.md`.

## Output

`sessions/<session-id>/artifacts/`:
- game.html (Phaser 3.80 single-file, ≤60KB)
- spec.md / DESIGN.md / tuning.json
- summary.html (auto-generated post-session)

## See also

- agents/coordinator.md — sandwich body
- agents/verifier.md — inline-read when Gemini is the verifier
- skills/verification-before-completion.md — evidence-over-claims
- wiki/references/bagelcode-frontier-cli-convergence-2026.md — 4 CLI consensus
