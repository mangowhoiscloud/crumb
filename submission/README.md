# Bagelcode Submission Bundle

Crumb is a multi-agent execution harness for casual-game prototyping. Built for the [Bagelcode New Title Team AI Developer recruitment task](https://career.bagelcode.com/ko/o/208045) (deadline 2026-05-03 23:59 KST).

## What's in this folder

### `session-logs/` — replay-deterministic JSONL transcripts (5 sessions)
- Each line = one event (35 schema kinds × 11 fields × 8 actors).
- `crumb replay <session-dir>` re-derives identical state.
- Goals (Korean) live in the `kind=goal` event's `body` field.

| File | Goal (extracted from `kind=goal`) |
|---|---|
| `01KQQ40DCPNGHF54P2BJKP10MH_2D...jsonl` | 2D 횡스크롤 커비 게임 (닌텐도 풍) |
| `01KQNEBRTP7DWZ4AMYXAAWTF9Z_....jsonl` | 고전 명작 레바의 모험 — 버서커 모드 |
| `01KQNAK1CXTBDEBX2WP2QQK891_....jsonl` | 고전 명작 레바의 모험 — 버서커 모드 (이전 시도) |
| `01KQMS9E5M1Z7TEF32E81YXAGT_....jsonl` | 고양이 퍼즐 게임 — 상용 서비스 이상 퀄리티 |
| `01KQMM7BCKE3V98H2374KAE9GJ_30...jsonl` | 30초 컬러-매칭 캐주얼 |

### `artifacts/` — Phaser 3.80 multi-file PWA bundles
Each subfolder is a complete game produced by the Builder actor + verified by deterministic qa_check + CourtEval Verifier:

```
artifacts/<session-id>_<goal>/
├── game/
│   ├── index.html               # entry — viewport / theme-color / safe-area / sw register
│   ├── manifest.webmanifest     # PWA install descriptor
│   ├── sw.js                    # cache-first service worker (offline)
│   ├── icon-192.svg / icon-512.svg
│   └── src/
│       ├── main.js              # Phaser bootstrap
│       ├── config/{gameConfig.js, tuning.json}
│       ├── scenes/{BootScene,GameScene,GameOverScene}.js
│       ├── entities/<Per-game classes>
│       └── systems/...
├── DESIGN.md                    # color / mechanics / motion (Stitch 9-section format)
├── spec.md                      # acceptance criteria + rule book
└── tuning.json                  # balance numbers (Unity ScriptableObject importable)
```

Open `artifacts/<id>/game/index.html` directly in a browser, or serve via the live Studio (`npx crumb-studio` from the repo root).

## Agent context (.md) the runtime injected

Live in the repo:
- `agents/coordinator.md` / `planner-lead.md` / `researcher.md` / `builder.md` / `verifier.md`
- `agents/specialists/{concept-designer,visual-designer,game-design}.md`
- `skills/{tdd-iron-law,verification-before-completion,code-review-protocol,parallel-dispatch,subagent-spawn}.md`
- `.claude/skills/crumb/SKILL.md` (Claude Code natural-language entry)
- `.codex/agents/crumb.toml` (Codex CLI entry)
- `.gemini/extensions/crumb/` (Gemini CLI entry)
- `AGENTS.md` (universal Linux Foundation Agentic AI Foundation standard)

## How to reproduce

```bash
git clone https://github.com/mangowhoiscloud/crumb.git && cd crumb
npm run setup
npx crumb replay submission/session-logs/01KQQ40DCPNGHF54P2BJKP10MH_2D__________.jsonl
```

Or run a fresh deterministic smoke (no auth required, ~1 s):
```bash
npx crumb run --goal "60-second match-3 with combo bonus" --adapter mock --idle-timeout 5000
```

For real cross-provider runs, `claude login` (Max plan recommended) + optional `codex login` / `gemini login`, then `npx crumb run --goal "..." --preset bagelcode-cross-3way`.

## Mail-requirement checklist

| Requirement | Where it lives |
|---|---|
| 작동하는 코드 (GitHub repo) | https://github.com/mangowhoiscloud/crumb |
| 에이전트 .md 파일 | `agents/` + `skills/` + `.claude/` + `.codex/` + `.gemini/` (committed) |
| 세션 JSONL 로그 | this `submission/session-logs/` (5 sessions) |
| 멀티 에이전트 통신 | 35 transcript kinds × `kind=handoff.{requested,rollback}` between actors |
| 사용자 개입 / 관찰 | 5 `user.*` events × 4 host entries (Claude Code / Codex / Gemini / headless) + `crumb-studio` browser console |
| 통신/UI 자유도 | JSONL transcript + 4 entry path + Studio at `127.0.0.1:7321` |

