# Crumb — Agent Working Context

> Multi-agent execution harness for casual game prototyping. Submission for the Bagelcode 신작팀 AI 개발자 과제 전형 (deadline 2026-05-03 23:59 KST).

## Quick orientation

1. **Architecture invariants** — read [AGENTS.md](./AGENTS.md) before changing core structure (transcript invariants, sandwich injection, ULID, append-only, etc.).
2. **Final design spec** — [wiki/concepts/bagelcode-final-design-2026.md](./wiki/concepts/bagelcode-final-design-2026.md). All decisions trace back here.
3. **Event protocol** — [agents/_event-protocol.md](./agents/_event-protocol.md). How sandwich agents emit transcript events via `crumb event`.
4. **Schema** — [protocol/schemas/message.schema.json](./protocol/schemas/message.schema.json) + [protocol/schema.md](./protocol/schema.md). 28 kinds × 11 fields.
5. **Run a session** — `npx tsx src/index.ts run --goal "..." --adapter mock --idle-timeout 5000` for the deterministic demo path.

## Project layout

```
crumb/
├── src/                # Runtime (TypeScript ESM, Node 18+)
│   ├── protocol/       # Message types + ajv 2020-12 validator
│   ├── transcript/     # JSONL writer (ULID + ISO ts) + reader (fs.watch tail)
│   ├── state/          # CrumbState, TaskLedger, ProgressLedger
│   ├── reducer/        # Pure (state, event) → {state, effects}
│   ├── effects/        # Effect type union
│   ├── dispatcher/     # Live dispatcher (spawn subprocess + write transcript)
│   ├── adapters/       # claude-local / codex-local / mock
│   ├── loop/           # Coordinator main loop (replay + tail + dispatch)
│   └── cli.ts          # `crumb run|event|replay|doctor|ls`
├── agents/             # Sandwich files (subprocess system prompts) — coordinator/planner-lead/engineering-lead/builder-fallback + _event-protocol
├── protocol/           # Transcript schema (JSON Schema + 1-page human spec)
├── design/             # DESIGN.md — Phaser 3.80 binding constraint for Builder
├── wiki/               # 28 bagelcode design rationale docs (mango-wiki subset)
├── raw/                # Raw research material (PDFs, frontier source dumps)
├── skills/             # Production skills bundled for evaluators (llm-evaluation, mermaid-diagrams, skill-creator)
├── .skills/            # Operational skills used by the maintainer agent (NOT committed — see Skills section)
├── .crumb/             # Adapter / model selection (Paperclip-style presets)
└── sessions/           # Runtime artifacts (gitignored — generated per run)
```

## Skills available in this workspace

The 12 skills in `.skills/` are **not committed** (gitignored). They mirror `~/workspace/mango-wiki/.skills/` and let any user of this repo maintain a personal knowledge base alongside the codebase — Crumb sessions inevitably accumulate context (specs, design rationale, post-mortems, frontier references) that benefits from the same Karpathy-style compiled wiki the `wiki/` subset already demonstrates.

| User says... | Read this skill |
|---|---|
| "wiki 셋업" / "initialize my wiki" | `.skills/wiki-setup/SKILL.md` |
| "wiki에 추가" / "ingest this" / "이 자료 정리해서 넣어" | `.skills/wiki-ingest/SKILL.md` |
| "wiki 갱신" / "이 페이지 업데이트" / "save this to wiki" | `.skills/wiki-update/SKILL.md` |
| "wiki에서 X 찾아" / "what do we know about Y" | `.skills/wiki-query/SKILL.md` |
| "wiki 상태" / "manifest" / "what's been ingested" | `.skills/wiki-status/SKILL.md` |
| "wiki lint" / "broken link" / "audit wiki" | `.skills/wiki-lint/SKILL.md` |
| "wiki 재구축" / "archive and start over" | `.skills/wiki-rebuild/SKILL.md` |
| "wiki 내보내기" / "graphml" / "neo4j export" / "visualize graph" | `.skills/wiki-export/SKILL.md` |
| "cross-link" / "wikilinks 연결" / "이 두 페이지 묶어줘" | `.skills/cross-linker/SKILL.md` |
| "태그 정리" / "tag normalize" | `.skills/tag-taxonomy/SKILL.md` |
| "스킬 만들어줘" / "new skill for X" | `.skills/skill-creator/SKILL.md` |
| (architecture 질문) | `.skills/llm-wiki/SKILL.md` — Karpathy 패턴 explainer; `wiki/` 가 이 패턴을 따름 |

The 3 skills in `skills/` (committed, evaluator-visible) are **production deliverables**, not maintenance tooling — `llm-evaluation`, `mermaid-diagrams`, `skill-creator`.

## Key rules for this codebase

- **Transcript is the single source of truth.** Never store agent state in DB or in-memory only. All state must be derivable from `transcript.jsonl` via `reduce()`.
- **Pure reducer.** `src/reducer/` contains pure functions. Side effects belong in `src/dispatcher/`.
- **Subprocess injection, never auto-load.** Agent CLIs (claude / codex) receive sandwich content via `--append-system-prompt` or stdin. Do not depend on `CLAUDE.md` / `AGENTS.md` auto-loading inside the spawned subprocess.
- **ULID for message IDs.** Sortable + unique = transcript chronology.
- **Append-only.** Use the `TranscriptWriter` (already serializes via Promise chain). Never modify existing lines.
- **Sandbox cwd per session.** Subprocesses run with `cwd = sessions/<id>/` and `--add-dir` for read scope.

## Korean for design discussion, English for the codebase

Reply in **Korean** for design discussion, research summaries, and brainstorming. **English** for code, comments, schema fields, commit messages, and PR descriptions (the repo is public-facing for the Bagelcode hiring panel and future contributors).

## Verifying changes

```bash
npm run lint && npm run typecheck && npm run format:check && npm test && npm run build
```

CI runs the same matrix (Node 18 / 20 / 22) on every push to `main`. Don't push if local fails.
