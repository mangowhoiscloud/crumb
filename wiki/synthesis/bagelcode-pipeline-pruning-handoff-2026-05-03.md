---
type: synthesis
status: handoff
date: 2026-05-03
session: pipeline-pruning + studio observability
sibling: bagelcode-studio-handoff-2026-05-03.md
---

# Pipeline Pruning + Studio Observability — Handoff (2026-05-03 evening)

> Companion to `bagelcode-studio-handoff-2026-05-03.md` (morning session). This
> page covers the **evening** session that focused on pipeline pruning,
> reducer refactoring, and the next two priority Studio observability panels.
>
> Read this first if you're inheriting the queue. Anchor commits + queue
> below tell you exactly where to pick up.

## 1. What landed (chronological, anchor commits)

All 7 PRs merged to `main` and verified green on CI before move-on. Final main HEAD when this page was written: `40c06f7` (M1 server-extract by another session — not mine).

| PR | Squash commit | Title | Scope |
|---|---|---|---|
| #150 | `36ddd22` | `chore(protocol): prune 9 never-emitted schema kinds (PR-Prune-1)` | Schema enum 44 → 35 kinds. Removed: `session.forked / verify.request / question / answer / debate / version.refinement / ack / handoff.accepted / hook` (kind, not effect type). Kept: `agent.thought_summary` (verifier input filter), `tool.call`/`tool.result` (dispatcher stream-json tap pair). |
| #153 | `bb9c344` | `chore(actor): remove builder-fallback — adapter swap on circuit OPEN (PR-Prune-2)` | Actor count 9 → 8. circuit_breaker.builder.state==='OPEN' now sets `adapter_override.builder = 'claude-local'` and respawns the SAME builder actor (one fewer sandwich/config entry/sankey node/color slot). Audit tag `fallback_activated` → `adapter_swapped`. New terminal guard: `done(builder_circuit_open)`. |
| #155 | `0cd2697` | `fix(studio): post-PR-Prune-2 audit fixes — broken regex + dead UI styles` | Post-merge audit caught (a) `studio.js` done_reason regex matched the dead `all_builders_open` reason, (b) DAG legend still rendered a "fallback" pill + 4 dead CSS rules. |
| #159 | `5743e87` | `refactor(reducer): split judge.score case + fix redundant adapter swap (PR-Prune-3)` | Extracted `sanitizeJudgeScore()` + `routeOnVerdict()` from the judge.score case body (~195 LOC → ~50 LOC). Bonus: `error` case now sets `adapter_override.builder='claude-local'` immediately on the CLOSED→OPEN transition (only when no override pinned), eliminating one redundant respawn cycle. |
| #162 | `6338134` | `feat(studio): collapsible sessions sidebar — hamburger toggle (F4)` | ☰ button toggles `data-sidebar-collapsed` on `<body>`; CSS zeros sessions column + handle column with 220ms transition. Resized width preserved separately (`crumb.sessions-w`). State persists in `crumb.sessions-collapsed`. |
| #163 | `2a5dce7` | `refactor(reducer): split user.intervene case into 3 helpers (PR-Prune-4)` | Same pattern as PR-Prune-3 for the user.intervene case (~130 LOC → ~10). Helpers: `parseInterveneData()` / `applyInterveneMutations()` / `routeIntervene()`. Zero behavior change, all 495 tests pass without modification. |
| #167 | `5226839` | `feat(studio): score-trajectory sparklines + per-actor metric tooltips (PR-O4)` | P5: 6 mini SVG line graphs (one per D1-D6) above the scorecard; verdict-colored dot at the latest round. P2: native `title` attr on header metrics row showing per-actor breakdown sorted by descending contribution. Skipped when session has < 2 rounds. |

## 2. What got closed without merging (and why)

| PR | Reason |
|---|---|
| #165 | `feat(studio): adapter setup modal advanced (F5)` — closed in favor of #161 (`adapter-auth-detail`) which is a deeper, more comprehensive treatment of the same modal (keychain reads, plan tier surface, login expiry, .env loading). My PR's `api_key_envvar` field overlapped with their `auth_source='env'` detection. The two orthogonal pieces (📋 copy buttons next to `<pre>` blocks; per-OS install hint table for the `claude-local` curl-vs-irm case) can be cherry-picked as a follow-up after #161 lands. |

## 3. Active queue (deferred — sequenced for the next inheritor)

The wiki tables in `bagelcode-studio-handoff-2026-05-03.md` §4 and `bagelcode-studio-observability-plan-2026-05-03.md` §5 are still the source of truth for priority. After this session, the remaining items in priority order:

| # | Source | Why deferred this session |
|---|---|---|
| **F6** | studio handoff §F-series | Marked "defer until F3-F5 ship" in the original handoff. F4 + F5-equivalent (#161) now in flight, so F6 unblocks once #161 lands. Scope: block-system tear-off via `window.open` + `BroadcastChannel` + side-by-side dock. Large; cross-window sync risk. |
| **PR-O5** | observability plan §5 | Tool-call trace tree (P4) + cross-provider chip (P7) + per-spawn lifecycle gauge (P3). Three panels in one PR; all read existing reducer state once PR-O2 (cost emission) lands. Frontier ref: LangSmith trace tree, Phoenix Arize agent step view. |
| **W3** | studio handoff §W-series | `design_check` deterministic effect (palette ⊂ named retro palette / touch zone WCAG 2.5.5 AAA = 44×44 / motion timing within evidence_ref deviation). **Touches `src/effects/`** — overlaps risk with PR #160 (`qa-runner-persistence-smoke`); coordinate with that session before starting. |
| **W4** | studio handoff §W-series | Retry policy with cache-hit monitoring (cap 3 rounds per Eisenstein DeepMind 2024). **Touches `src/reducer/`** — overlaps with any in-flight reducer work; same coordination caveat. |
| **F5 follow-up** | this session | If #161 lands without copy buttons + per-OS install hint table, those two orthogonal pieces from the closed #165 are a small (<100 LOC) follow-up. The PR description on #165 has the implementation. |

## 4. Other in-flight work (NOT my session — coordinate, don't conflict)

| PR / branch | Owner | Status when I checked | Touches |
|---|---|---|---|
| #160 `feat/qa-runner-persistence-smoke` | other session | OPEN, CONFLICTING | `src/effects/qa-*.ts`, `src/reducer/index.ts` (case `'build'`), `src/effects/types.ts` |
| #161 `feat/adapter-auth-detail` | other session | OPEN, CONFLICTING | `packages/studio/src/{client/studio.{js,css},doctor.ts}` |
| #166 `chore/studio-vite-scaffold` | other session | OPEN | M0 React 19 v2 preview behind `?app=v2` query — additive, unlikely to conflict |
| #168 `docs/studio-big-bang-plan` | other session | OPEN | wiki only (`docs/`) |
| #169 (`40c06f7` already merged) | other session | landed during my session | M1 server-extract — moved runtime under `src/server/` |

QA strengthening (D2/D6 frontier) is being driven via the qa-runner branches — keep `src/effects/qa-*` + `src/reducer/index.ts` `case 'build'` + `src/dispatcher/qa-runner.ts` off-limits unless coordinating.

## 5. Worktree cleanup recommendations

My session created 6 worktrees under `.claude/worktrees/`. All branches are squash-merged so the worktrees are safe to remove. The 7th worktree (`docs-pruning-handoff`) is what wrote this file.

```bash
# All my branches are merged; each worktree retains the local branch ref
# (gh pr merge --delete-branch only removes the REMOTE branch). Cleanup:
for wt in chore+prune-dead-schema-kinds chore-remove-builder-fallback \
          chore-split-judge-score-case feat-studio-sidebar-collapse \
          refactor-user-intervene-case docs-pruning-handoff; do
  git worktree remove --force ".claude/worktrees/$wt" 2>/dev/null
done
git worktree prune
```

Stale worktrees from previous sessions (per `bagelcode-studio-handoff-2026-05-03.md` §5) remain; same `git worktree remove` pattern applies whenever you have a moment.

## 6. Process notes for the next session

These reflect what worked + what to keep doing:

1. **One PR per concern.** Each of the 7 PRs touched a focused scope; CI green on first push for 6 of 7 (the one CI miss was `.github/workflows/ci.yml` hardcoding `agents/builder-fallback.md` — fixed in a follow-up commit on the same branch). Bundling pruning + refactor + observability would have made review and conflict resolution harder.

2. **Audit after every PR.** The PR-Prune-2 audit (#155) caught two real regressions (broken regex + zombie UI) the original PR missed. Building this into the loop costs ~5 min per PR and prevents a stream of follow-up "oh we missed X" commits. The 5-pass audit (zombie refs / dead code via knip+deps / 기망 claims / duplicate paths / broken logic) is fast and high-yield.

3. **Check open PRs before starting overlapping work.** I started F5 without checking #161 — wasted ~30 min before realizing the overlap. Always `gh pr list --state open` against the area you're about to touch.

4. **Worktree per PR.** Each worktree was its own branch, never reused. Avoided cross-PR contamination entirely.

5. **Extension-not-connected fallback.** When `mcp__claude-in-chrome` isn't available for live browser checks, use `curl http://127.0.0.1:7323/` (or whatever port the studio bound) against the regenerated `studio-html.generated.ts` to verify markers reached the inlined client. This caught me trying to test against a stale port once.

6. **Don't push the studio-html.generated.ts.** It's gitignored (regenerates on `prebuild`/`pretypecheck`); re-running `node packages/studio/scripts/inline-client.mjs` locally is enough to verify served bytes match source.

## 7. Critical references

- `bagelcode-studio-handoff-2026-05-03.md` — morning session handoff (the priority queue this session worked from)
- `bagelcode-studio-observability-plan-2026-05-03.md` §4 / §5 — P1-P7 panels + 5-step PR roadmap
- `bagelcode-system-architecture-v0.1.md` — schema invariants (still authoritative; 35-kind / 8-actor counts updated by PR-Prune-1 + #2)
- `agents/coordinator.md` §"Routing Rules" — updated by PR-Prune-2 (adapter swap path replaces builder-fallback spawn)

## 8. Final note

Session goal was "가지치기 + 관찰성 후속 작업" (pruning + observability follow-up). Achieved 4 pruning PRs (Prune-1/2/3/4) + 2 Studio panels (F4 + PR-O4) + 1 audit fix (#155) — every item from the morning handoff's queue that didn't overlap with another session's in-flight work. Leftovers (F6 / PR-O5 / W3 / W4) are sequenced above with their respective conflict caveats.

**Next inheritor: pick the top of §3 unless the QA-runner / adapter-auth-detail PRs land first and unblock W3/W4 or change the F5 picture. Audit-after-every-PR (§6.2) is the highest-yield habit to keep.**
