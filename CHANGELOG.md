# Changelog

All notable changes to Crumb are documented here. Format: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), versioning: [SemVer 2.0.0](https://semver.org/). Pre-1.0: any breaking change is a minor bump, every other change is a patch.

## [Unreleased]

### Added — Genre + persistence profile axes (4×4 matrix) + 2 new specialists (Bundles 1+2, 2026-05-03)

Extends Crumb from a single-genre prototype harness (Phaser-portrait casual mobile) to a 4-genre × 4-persistence matrix while keeping the un-flagged default (`auto-detect` × `local-only`) bit-identical to prior behavior. Lifts the §2 Three.js ban for the opt-in `flash-3d-arcade` profile only and lifts the §1.1 "no worker tier" rule for the opt-in `edge-orm` persistence profile only.

**Genre profiles** (`task_ledger.genre_profile`, CLI `--genre`):

| Profile | Stack | Use case | Lifts forbidden? |
|---|---|---|---|
| `casual-portrait` (default) | Phaser 3.80 portrait 320–428 | match-3 / merge / clicker / tap-runner | no |
| `pixel-arcade` | Phaser 3.80 + `pixelArt: true` + locked palette + integer-snapped | top-down arcade / pixel platformer / shmup | no |
| `sidescroll-2d` | Phaser 3.80 ArcadePhysics + landscape 16:9 + parallax + state machine | side-scrolling platformer / shmup / autoscroll runner | no |
| `flash-3d-arcade` | Three.js r170 CDN + WebGL2 + landscape 16:9 | low-poly racer / asteroid shooter / dogfight | **yes — Three.js opt-in only** |
| `auto-detect` (CLI default) | researcher proposes via named-game lock-in + confidence gate | n/a | n/a |

**Persistence profiles** (`task_ledger.persistence_profile`, CLI `--persistence`):

| Profile | Tier | Default? |
|---|---|---|
| `local-only` (new default) | IndexedDB + Dexie | yes (replaces silent "no persistence") |
| `postgres-anon` | Supabase + anon-auth + RLS (existing §1.2) | activates on leaderboard markers |
| `edge-orm` | Cloudflare D1 + Drizzle ORM + Worker | opt-in; lifts §1.1 "no worker tier" |
| `firebase-realtime` | reserved (P0 제외) | n/a |

**Two new specialists** (`agents/specialists/`) — closes the gamestudio-subagents prompt-structure gap (compressed from upstream `technical_artist.md` + `game_feel_developer.md`):
- `technical-artist.md` — per-profile shaders / particle pools / post-FX / lighting (read by `planner-lead` step.design + `builder` render-system file emission).
- `game-vibe.md` — per-profile juice timings / shake tiers / hit-stop rules + `JuiceManager.js` constants binding (read by `builder` + `verifier` D5.vibe rubric grading).

**Spec layer** (`agents/specialists/game-design.md`):
- §1.3 genre profile axis (4 profiles, with adaptations per profile).
- §1.4 persistence profile axis (4 profiles; absorbs §1.2 as one).
- §2 Forbidden table now profile-aware (Three.js exception under §1.3.D, Worker tier exception under §1.4.edge-orm).
- §6 actor reads table updated.

**Existing specs deepened** for genre awareness:
- `concept-designer.md`: per-profile mechanic templates (B/C/D in addition to A defaults).
- `visual-designer.md`: per-profile palette + HUD guidance (B/C/D landscape, profile-D bloom-safe palette).
- `researcher.md`: step 3.5 emits `kind=note` with `data.proposed_genre_profile + confidence` when `task_ledger.genre_profile = "auto-detect"`; profile D forced back to A on weak evidence (confidence < 0.85) per anti-deception T1.
- `planner-lead.md`: step.design resolves profile (auto-detect path reads researcher note + asks socratic when confidence < 0.7) and inline-reads `technical-artist.md` for profiles B/C/D; frontmatter `inline_specialists` updated.
- `builder.md`: step 1 selects file-tree template per `task_ledger.genre_profile` + `persistence_profile`; emits `src/systems/JuiceManager.js` per `game-vibe.md`; frontmatter `inline_specialists` adds `technical-artist.md` + `game-vibe.md`.
- `verifier.md`: frontmatter `inline_specialists` adds `game-design.md` + `game-vibe.md` for D5.vibe rubric grading.

**Runtime plumbing** (Bundle 2):
- `src/state/types.ts`: `GenreProfile` / `PersistenceProfile` union types + enum arrays + type guards. `TaskLedger` gains optional `genre_profile + persistence_profile`.
- `src/reducer/index.ts`: `case 'goal'` reads `event.data.{genre_profile,persistence_profile}` via type guards (defensive).
- `src/loop/coordinator.ts`: `RunOptions` adds `genreProfile + persistenceProfile`; goal event builds data object up-front so multiple optional fields don't fight over the spread.
- `src/cli.ts`: `--genre <profile>` + `--persistence <profile>` flags on `cmdRun`, validated against the enum (typo dies at CLI boundary). Help text updated.
- `src/reducer/index.test.ts`: 3 new tests — explicit profile populates, invalid value rejected, absence leaves `task_ledger` undefined.

**Wiki research** (3 entries committed earlier in the branch):
- `wiki/references/bagelcode-gamestudio-subagents-deep-2026-05-03.md` — byte-by-byte read of 8 pamirtuna/gamestudio-subagents personas; 2 specialist gaps identified.
- `wiki/references/bagelcode-genre-stack-frontier-2026-05-03.md` — 2026 frontier evidence per genre (Phaser 94% LLM-friendliness, Three.js 270×/337× download lead, PixelLab AI, Drizzle+D1, Dexie offline-first).
- `wiki/synthesis/bagelcode-genre-profile-decision-2026-05-03.md` — decision: 4×4 matrix + opt-in Three.js / Worker bans lifted, 9-phase migration.

**NOT in this branch — deferred**:
- `packages/studio/*` — coordinating with the parallel studio big-bang update; Studio profile picker is Phase 6 (separate PR after big-bang merge).
- qa-runner per-persistence smoke tests (Dexie eval / `wrangler dev` PARTIAL fallback) — Phase 7 follow-up PR.
- preset `.toml` schema `[actors.builder].genre_profile` override — CLI flag is the primary user-facing surface.
- `metadata.genre_profile` on every emitted event — Studio observability enhancement.

Quality gate (verified at every commit): typecheck ✓ / lint 0 errors / 466 tests + 3 new ✓ / format ✓ / build ✓.

References: [pamirtuna/gamestudio-subagents](https://github.com/pamirtuna/gamestudio-subagents) (193⭐), [Phaser blog 2026-04 vs Kaplay/Excalibur](https://phaser.io/news/2026/04/phaser-vs-kaplay-vs-excalibur-2d-web-game-framework), [utsubo Three.js 2026](https://www.utsubo.com/blog/threejs-2026-what-changed), [Drizzle D1 docs](https://orm.drizzle.team/docs/connect-cloudflare-d1), [Dexie.org 2026](https://dexie.org/), [PixelLab AI](https://www.pixellab.ai/).

### Docs — Studio handoff page (2026-05-03)

`wiki/synthesis/bagelcode-studio-handoff-2026-05-03.md` — comprehensive handoff for the next session/stream picking up Studio work. Captures: live state (running server / `main` HEAD), today's PR ledger (open + merged), post-#145/#146 architecture summary (4-pane layout + theme system + observability layers), prioritized pending work (F4 / F5 / F6 / PR-O3 / PR-O4 / PR-O5 / W2 / W3 / W4), worktree filesystem snapshot, 6 known pitfalls (CI registration delay, `crumb-dash` cruft, font fallback, splitter convention, scorecard radar token reads, light-theme actor lane discipline), inheritor decision tree, and critical references read order. No code changes.

### Added — CRUMB STUDIO branding wordmark + light (default) / dark theme system (F3) (2026-05-03)

The studio chrome was previously dark-only with a Linear-style violet accent. F3 introduces a brand-derived light theme as the new default, preserves the existing dark palette under `[data-theme="dark"]`, and adds a top-left wordmark + theme toggle. All design tokens documented in the new `design.md` at the repo root.

**Logo-derived light palette** — sampled from the Crumb logo via Pillow median-cut quantization (10 bins):

| Source | Hex | Token |
|---|---|---|
| Logo cream background (84.9% area) | `#FDF3E7` | `--canvas` |
| Logo dark brown (wordmark + face) | `#623819` | `--ink` |
| Logo golden bread body | `#DAAB78` | `--primary` |
| Logo pale gold highlight | `#FCE5BF` | `--surface-3` |

The full token set + WCAG audit + dark-theme overrides + actor lane recoloring per theme is documented in `design.md` (VoltAgent 9-section structure).

**Implementation** (`packages/studio/src/client/studio.{html,css,js}` + new `/design.md`):

- **CSS palette restructure** — `:root` now holds the light defaults (Crumb logo derived). Dark theme moved under `[data-theme="dark"]` overrides on `<html>`. Semantic colors (audit / warn / lime / accent-grep) and 9 actor lane colors get light-mode variants per WCAG ≥4.5:1 against canvas.
- **Brand wordmark** in the top of `<aside class="sessions">`. Inline 24×24 SVG bread silhouette (loaf + 3 dropping crumbs, single-path, `fill: currentColor` colored via `--primary`) + `CRUMB STUDIO` wordmark. The wordmark uses a `'Crumb Brand'` `@font-face` cascade: `local('Cabinet Grotesk Extrabold/Bold')` → `local('SF Pro Rounded')` → `ui-rounded` → `system-ui`. No external download at runtime; Cabinet Grotesk wins automatically when locally installed (e.g. via Fontshare). To bundle it in-blob next iteration, drop a woff2 into `packages/studio/src/client/assets/` and extend `inline-client.mjs` to base64-inline a `data:font/woff2;base64,...` `src`.
- **Theme toggle** in the rightmost slot of `<nav class="view-tabs">` (`#theme-toggle`). Glyph swaps between ☀ (current dark, click → light) and 🌙 (current light, click → dark). Clicking writes `localStorage.crumb.theme = 'light' | 'dark'`.
- **FOUC prevention** — pre-paint script in `<head>` (before `<style>` parse) reads localStorage / `prefers-color-scheme` and sets `<html data-theme="...">` *before first paint*. This eliminates the white flash that plagues naive theme implementations on dark-mode users.
- **OS preference watcher** — when no explicit user override is stored, `matchMedia('(prefers-color-scheme: dark)').change` updates the theme on the fly. Once the user clicks the toggle, the explicit preference takes over.

**Why this matters for reviewers**: a Bagelcode panel opening Studio for the first time gets a brand-aligned light interface that matches the logo on the same page (the user's spec); panel members on dark-mode OS still get the dark theme automatically; everyone can flip on demand. The pre-paint script means no theme flash on initial load — a quality bar most dashboards miss.

`design.md` is positioned at repo root following VoltAgent's `awesome-design-md` convention. Cross-references the game-side `agents/specialists/visual-designer.md` (separate namespace — game palettes are per-session, dashboard chrome is global).

Verification: `npm run lint:all && npm run typecheck && npm run format:check && npm test && npm run build` — 466/466 tests pass, lint clean, format clean. Studio HTML re-inlined to ~263 KB. Live verified at http://127.0.0.1:7321/ in both themes.

### Changed — 4-pane studio layout + Datadog-grade scorecard hybrid + event detail spread (PR-K + PR-K' + Layout fix) (2026-05-03)

Composite of three previously-separate strands, merged into one cohesive UI overhaul:

1. **Scorecard hybrid (PR-K)** — replaces the 6-flat-cell row at the top of the active session with a 3-column hybrid: composite headline (`23.0 / 30` big number + verdict pill PASS/PARTIAL/FAIL + delta `↗ +2.0 vs prev`), 80×80 CourtEval radar (6-axis spider plot), and 6-row drilldown (`D1 spec_fit ████░ 4.5 LLM`). Anti-deception-flagged dims show strikethrough (~~5.0~~ ⚑ -15% self-bias). Pulled from `feature/scorecard-hybrid-radar` (`ff47a8e`).
2. **Event detail spread (PR-K')** — group-spread for swimlane chip ×N badges. Click a grouped chip → horizontal multi-card spread within the right rail (replaces the prior `← 1/3 →` paginator). Single-event detail gets Datadog-grade fields: tag pills (kind/from/provider/model/harness/deterministic/cross_provider), audit banner (anti-deception violations), resource-breakdown bar (cache green / in purple / out cyan stacked + cost/latency/cache_w sublabels), copy buttons (body / data / event id ⧉). Same source.
3. **4-pane vertical layout (Layout fix)** — restores the broken layout from the W-Studio-A regression. Swimlane is moved OUT of `#view-pipeline` to its own top-level pane, with three splitter handles between the four logical regions:

```
┌────────────────────────────────────┐
│ view-pane (absorber, flex:1)        │  Pipeline | Logs | Output | Transcript
├──── #splitter-view-swim ────────────┤  4px row-resize, single-var
│ swimlane (--swimlane-h, default 200)│  event view (chips per actor)
├──── #splitter-swim-narr ────────────┤  4px row-resize, two-var (total preserved)
│ narrative (--narrative-h, default 220) │  agent narrative (stream-json bubbles)
├──── #splitter-narr-feed ────────────┤  4px row-resize, two-var
│ feed (--feed-h, default 180)        │  live execution feed
└────────────────────────────────────┘
```

**Splitter convention** (industry-standard, Linear / VSCode / Datadog): drag UP → upper narrows, drag DOWN → lower narrows. Single-var splitters (between absorber and a fixed pane) modify only the lower pane's height; two-var splitters (between two fixed panes) modify both adjacent panes inversely so the boundary moves while the total panes-height is preserved (view-pane absorber stays put). 80 px floors per pane prevent collapse; 70 vh ceilings prevent overlap.

**Persistence**: `localStorage.crumb.pane.{swimlane,narrative,feed}-h` (px ints). One-shot migration shim from legacy `crumb.narrative-h` (W-Studio-A) → `crumb.pane.narrative-h`.

**Restored from main**: `FEED_FORMATTERS` table (18 per-kind formatters from PR #140 W-Studio-A) was regressed by the scorecard branch's older base — re-applied verbatim so the live feed keeps its Datadog-grade per-kind rendering.

`packages/studio/src/client/studio.{html,css,js}` — see commit diff for the full delta.

Verification: `npm run lint:all && npm run typecheck && npm run format:check && npm test && npm run build` — 466/466 tests pass, lint clean. Studio HTML re-inlined to ~256 KB. Live verified at http://127.0.0.1:7321/.

### Docs — Pre-verifier-no-scoring page: explicit LLM-judge vs deterministic-gate distinction + Anthropic cache numbers (W1) (2026-05-03)

`wiki/synthesis/bagelcode-pre-verifier-no-scoring-frontier-2026-05-03.md` was originally written to deflect reviewer questions about why intermediate phases (spec, design) lack scoring. The page implicitly conflated "no scoring at all" with "no LLM scoring", because the only scoring that *was* present (`qa_check`) was discussed under its own heading. Reviewers reading the TL;DR table can mistake the "(none)" cell on the planner-lead row as "no gate is allowed" rather than "no LLM gate is allowed". After the post-merge token-quality audit and the 10-system frontier survey on "step-gate-with-cached-retry", this distinction was made load-bearing.

Changes:

- **New section "LLM-judge gate ≠ deterministic gate"** with a 2-row table mapping gate type → frontier verdict → Crumb stance. LLM-judge gates rejected (DeepSeek-R1 PRM abandonment Jan 2025, Cognition "Don't Build Multi-Agents" Jun 2025, Eisenstein DeepMind 2024 round 4+ saturation, Huang ICLR 2024 / Stechly NeurIPS 2024 self-critique noise). Deterministic gates accepted (Cursor 2.0 typecheck-after-5-writes, DSPy `dspy.Suggest`, OpenHands ReAct deterministic observation, Aider diff-format parser retry).
- **TL;DR table** gains a new row for `step.design` showing it's an eligible deterministic gate (palette ⊂ named retro palette / touch hit zone WCAG 2.5.5 AAA = 44×44 / motion timing within evidence_ref deviation). Cross-references the new section.
- **New section "Sandwich layout for cached retry (Anthropic numbers)"** — embeds the official Anthropic ephemeral cache table (4 breakpoints, 5m/1h TTL, 1.25× / 2.0× write multiplier, 0.1× read multiplier, 0.28 reads / 1.11 reads break-even). 4-bp + rolling-tail layout strategy. Byte-identical discipline footguns cited from frontier known-issue reports (Claude Code #43657, Cline #9892, Hermes-agent #13631).
- **Two new Q&A cheat sheet entries**: (1) "Could you add a design-phase quality gate?" — yes, deterministic only, Camp B pattern; (2) "Why not retry every step?" — Eisenstein 2024 round-4 saturation caps cumulative rounds at 3.
- Frontmatter `related:` extended with `bagelcode-no-pass-n-decision-2026-05-03`, `bagelcode-caching-strategy`, `bagelcode-caching-frontier-2026`. Tags gain `deterministic-gate`, `prompt-cache`.

No code changes. This is the conceptual groundwork for the upcoming W2/W3/W4 PRs (sandwich byte-identical CI test, `design_check` deterministic effect, retry policy with cache-hit monitoring).

All numbers in the new sections are paper- or standard-grounded (Anthropic official docs, Eisenstein DeepMind 2024, W3C WCAG 2.5.5, Lospec retro palette catalog) — no magic values introduced.

### Changed — Studio feedstack: live-feed on top, narrative on bottom + VSCode-style orient toggle + datadog-grade kind formatters (W-Studio-A) (2026-05-03)

Three coupled improvements to the live execution feed + agent narrative panels per user feedback:

1. **Position swap** — live execution feed is now on TOP, agent narrative on BOTTOM. The previous layout (narrative top, feed bottom from PR #118) put coordinator-level events farther from the user's eye than the per-actor narrative bubbles, but session-level signal (errors, audit, judge.score) is more often what the user is scanning for.
2. **VSCode terminal-style orientation toggle** — new `⊟ ⊞` button in the feed toolbar flips the layout between vertical (stacked, default) and horizontal (side-by-side). Splitter axis adapts (row-resize ↔ col-resize) without code change because the parent's `data-orient` is read at drag-start. Both axes persist independently in localStorage so toggling restores the last size.
3. **Datadog-grade kind-specific feed formatters** — replaced the generic `[kind] body` rendering with per-kind projection of the actually-load-bearing fields. The previous generic JSON.stringify-truncation buried the most useful information (D1-D6 scores, exec_exit_code, tokens/cost/cache) under boilerplate.

**HTML/CSS** (`packages/studio/src/client/studio.{html,css}`):

- Both `<section class="console-feed">` and `<section class="console-narrative">` now wrap inside a `<section class="feedstack" data-orient="vertical">` grid container. Splitter sits between them.
- Feed comes first in DOM order; narrative second.
- New `<button id="feedstack-orient" class="ghost-btn">` in the feed toolbar — text content is `⊟` in vertical mode, `⊞` in horizontal.
- CSS grid template flips: `grid-template-rows: var(--feedstack-feed-h, 220px) 4px 1fr` (vertical) vs `grid-template-columns: var(--feedstack-feed-w, 50%) 4px 1fr` (horizontal).
- Resize handle's cursor + axis adapt via `:not(:hover)` selectors on `data-orient`. Background hover still uses `--primary` so the affordance reads.

**JS** (`packages/studio/src/client/studio.js`):

- New IIFE `feedstackInit()` replaces the prior `makeResizable('feedstack-resize', …, 'y')` call. The custom drag handler reads `stack.dataset.orient` at mousedown, picks `clientY` or `clientX` accordingly, and writes `--feedstack-feed-h` or `--feedstack-feed-w`. Both axes persist (`crumb.feedstack.feed-h`, `crumb.feedstack.feed-w`, `crumb.feedstack.orient`).
- Drag direction → which panel narrows: vertical drag-down → top (feed) grows = bottom (narrative) narrows; vertical drag-up → top narrows. Horizontal drag-right → left (feed) grows = right (narrative) narrows. Same intuition both modes (the panel you drag *toward* narrows).
- New `FEED_FORMATTERS` table (object indexed by kind) — 18 per-kind formatters covering: `session.start/end`, `goal`, `agent.wake/stop`, `spec`, `build`, `artifact.created`, `qa.result` (exit + AC pass/total + duration), `judge.score` (verdict glyph + D1-D6 + deviation type), `verify.result`, `step.research` (refs/lessons count), `step.research.video` (mechanics + out-of-envelope count), `handoff.requested/rollback`, `audit` (rule + body), `error`, `done`, `user.intervene/approve/veto/pause/resume`, `note`. Helper formatters `_fmtNum` / `_fmtCost` / `_fmtMs` / `_fmtScores` for consistent number rendering.
- `feedLineFromTranscriptEvent()` now dispatches to a registered formatter when present; falls back to the legacy `[kind] body` rendering for unrecognized kinds.

**Drag direction semantics (matches user spec)**:
- 위로 올리면 상단이 좁아지고 → drag splitter UP → top (feed) narrows ✓
- 밑으로 내리면 하단이 좁아지도록 → drag splitter DOWN → bottom (narrative) narrows ✓
- Same in horizontal: drag-left narrows left, drag-right narrows right.

**Out of scope (deferred)**:
- True tear-off (window.open + cross-window sync) — separate PR. The current "horizontal" mode is the foundational step toward VSCode pane behavior; tear-off is the next jump.
- Transcript view multi-render modes — separate PR.
- User-input bar polish — separate PR.

Verification: `npm run lint:all && npm run typecheck && npm run format:check && npm test && npm run build` — 466/466 tests pass, lint clean, format clean.

### Added — DAG runtime data overlay: per-actor badges + edge throughput/latency encoding (PR-J') (2026-05-03)

PR-J (chip-swimlane → Gantt waterfall) was abandoned per user feedback ("main 의 chip 디자인 마음에 듦"). Replaced with the lighter-touch Candidate 4 from the same frontier observability survey: keep main's chip event dashboard intact, instead bind runtime data onto the existing DAG nodes + edges. Frontier convergence: LangSmith / Langfuse / Phoenix per-step token + cost + latency badges (under-node), Datadog Service Map throughput-as-thickness (edge), AWS X-Ray latency-as-color (slow edges turn red).

`packages/studio/src/client/studio.js`:
- New `aggregateActorRuntime(events)` — single-pass over the cached transcript. Per actor: `events`, `tokens_in`, `tokens_out`, `cost_usd`, `latency_ms_total`, `latency_ms_p95`. `qa_check` is a synthetic actor: `from='system'` events with `metadata.tool='qa-check-effect@v1'` are remapped to it (mirrors the existing `rippleFromActor()` convention).
- New `aggregateEdgeRuntime(events)` — derives per-edge `count` + `avg_latency_ms` from consecutive event pairs that match a static `DAG_EDGES` entry. Same `from='system' → 'qa_check'` remap.
- New `formatActorBadge(stats)` — compact `12.3k tok · $0.18 · 8.1s p95` line that drops zero/missing fields so the badge stays terse (≤ 24 chars).
- `renderDag()` now renders a `<text class="dag-node-badge">` line under each node and `<text class="edge-count">×N</text>` above each traversed edge midpoint. Edge `stroke-width` is computed inline (`min(4.4, 1.4 + log2(1+count) * 0.9)`) so the thickest edge is visible without dominating the canvas. Slow edges (`avg_latency_ms > 5000`) get an `.edge-slow` class for red overlay.

`packages/studio/src/client/studio.css`:
- `.dag-node-badge` — 9px ui-monospace, fill `--ink-tertiary`, opacity 0.85; brightens to `--ink-muted` opacity 1.0 when the node is `.active` or `.recent`.
- `.dag-edge-group.edge-traversed` — bumps edge opacity to 1.0 (untraversed stay at the static class's baseline).
- `.dag-edge-group.edge-slow .dag-edge` — red stroke override for high-latency edges.
- `.edge-count` — 8px badge above edge midpoint.

Result: the Pipeline DAG (PR-H structural correctness) now answers "where is the time + tokens + money going" without leaving the topology view. Chip swimlane (PR-7 + PR-8 unread badges) stays unchanged — main's UX preserved verbatim.

Verification: `npm run lint && npm run typecheck && npm run format:check && npm test && npm run build` — 466 tests pass. Live verified at http://127.0.0.1:7321/.

### Added — Studio cancel button on live session rows (R5) (2026-05-03)

R2 (PR #123) added the `/cancel` user verb + `cancel_spawn` effect end-to-end (parser → reducer → dispatcher AbortController → SIGTERM), but the only way to invoke it was typing `/cancel` into the Studio's console-input bar. R5 surfaces it as a one-click button on each live session row, mirroring the existing PR-G7-B Resume button shape but with destructive accent (`--audit-fg`) so the lossy mid-edit kill is visually distinct from the additive Resume action.

`packages/studio/src/client/studio.{html,css,js}`:

- `renderSessionList()` adds a `.row-cancel` button on each row when `s.live === true`, sitting to the left of the close `×`. Hidden on non-live sessions (paused/done — nothing to cancel). Glyph: `⏹` (square-stop).
- Click handler POSTs `{line: '/cancel'}` to the existing `/api/sessions/:id/inbox` endpoint. The coordinator's chokidar-watched inbox watcher (R1, PR #122) picks it up in <10ms; parser turns it into `kind=user.intervene, data.cancel='all'`; reducer emits `cancel_spawn` effect; live dispatcher fires `controller.abort()` → SIGTERM on every registered actor's spawn (R2, PR #123).
- Optimistic UI: button text flips to `…` on click → `✓` on success → resets to `⏹` after 2s. On failure, flips to `!` and resets after 3s with the error logged to console.
- Click event handler in `.session-row` listener now ignores `.row-cancel` (alongside `.row-close` and `.row-resume`) so the button doesn't double-fire as a session-select.
- CSS `.session-row .row-cancel`: same shape as `.row-resume` but `color: var(--audit-fg)` and hover background `color-mix(in oklab, var(--audit-fg) 30%, transparent)`. Reads as destructive-but-deliberate.

In practice `.row-resume` and `.row-cancel` are mutually exclusive — resume shows on paused/interrupted/budget-exhausted, cancel only on live. The CSS positions them at the same `right: 30px` slot since at most one can be visible at a time.

Per-actor cancel (`/cancel @builder` instead of bare `/cancel`) is reserved for the console-input bar — adding per-actor button menus to each row would clutter the sidebar UI without a clear use case the bare cancel doesn't already cover.

Verification: lint:all, typecheck, format:check, test (466/466 — no test changes; UI smoke), build — all clean. Studio HTML re-inlined.

### Added — Studio agent narrative panel (split from live exec feed) with horizontal resize splitter (2026-05-03)

Per user feedback after PR #113 ("이걸 보여주는 별도의 창을 만들어서 raw가 아니라 사용자가 봤을 때 유의미한 데이터를 출력하도록 개선해. live execution feed 말고 다른 창으로 둬서 live execution feed 위에 두면 될듯 해. 두 창의 높이는 session의 가로처럼 조절할 수도 있고."): PR #113 suppressed raw stream-json blobs from the live execution feed but lost the meaningful narrative content along with the noise. The user wanted the rendered Claude-Code-style ⏺/⎿/✓ bubbles to live in their own panel above the existing feed, not be hidden entirely.

**New layout** (`packages/studio/src/client/studio.{html,css,js}`)

```
┌──────────────────────────────────────────┐
│  Agent narrative (top)                   │  ← #console-narrative-section
│   ⏺ assistant-text / ⏺ tool_use          │     stream-json bubbles only
│   ⎿ tool_result / ✓ turn complete         │
├──── horizontal resize handle (drag) ─────┤  ← #feedstack-resize (4px)
│  Live execution feed (bottom)            │  ← #console-feed-section
│   agent.wake / error / handoff /         │     coordinator-level events,
│   plain log / system messages            │     plain stdout/stderr
└──────────────────────────────────────────┘
```

- New `<section class="console-narrative">` above the existing `console-feed`. Same toolbar surface area (title + status + grep input + ↑↓ nav + pause + clear) so the user has identical controls per panel.
- New `appendNarrativeLine()` mirrors `appendFeedLine()` (timestamp / actor / body row, repeat-collapse with 60s window + ×N badge, top-down newest-first, grep-aware) but writes into `#console-narrative-body` and respects its own `narrativePaused` flag. Kept as a separate function rather than parameterizing `appendFeedLine()` so the two panels can diverge later (column widths, max-lines, repeat window) without coupling — Karpathy "no premature abstraction."
- `attachFeedLogStream` chunk handler now routes stream-json bubbles to `appendNarrativeLine()` and everything else (plain log lines, adapter banners, stderr) to `appendFeedLine()` — bubble vs non-bubble was already the discriminator added in PR #113, this PR moves the bubble destination.
- `grepState.narrative` added so the narrative panel's grep nav is independent of the feed's. `bindGrepInput` / `gotoGrepMatch` already accept a panel key — only registration was needed.
- `onSessionSelect` hook wipes the narrative panel on session change so the new session doesn't see the previous session's bubbles. Live feed already gets re-populated from the per-session log stream so its content is session-bound.

**Horizontal resize splitter** (`#feedstack-resize`, between the two panels)

- `makeResizable()` extended with an optional `axis = 'x' | 'y'` parameter. Default stays `'x'` so existing sessions-resize / detail-resize handles keep working. y-axis variant reads `clientY` instead of `clientX`.
- New handle is 4px tall, full-width, `cursor: row-resize`, hovers to `--primary` like the column handles. Drag-down grows the narrative panel (`narrative_h = start + dy`); the live feed shrinks to fit. Clamped to `[80, viewport - 300]` so neither pane disappears past the controls.
- Persisted as `--narrative-h` on `<body>` + `localStorage.crumb.narrative-h`. Default 220px (matches the prior single-panel feed cap so the layout looks identical on first load).

Verification: `npm run lint:all && npm run typecheck && npm run format:check && npm test && npm run build` — 460/460 tests pass, lint clean, format clean. Studio HTML re-inlined to 156 KB (was 147 KB; +9 KB for the narrative panel + handler wiring).

### Added — `/cancel` user verb + cancel_spawn effect: mid-spawn SIGTERM via dispatcher.AbortController (R2) (2026-05-03)

Closes the second wire-layer gap from the 15-system frontier survey: mid-spawn user intervention. After R1 (chokidar swap, PR #122), the idle case responds in ~5-10ms, but the mid-spawn case — running subprocess does not see `user.intervene` until the spawn naturally completes — was still on the order of 30s to 30min (`PER_SPAWN_TIMEOUT_MS`). The dispatcher already had an `AbortController` per spawn (`src/dispatcher/live.ts:setupSpawnTimers`); it just wasn't reachable from `user.intervene`.

Frontier consensus on this gap: only IDE-plugin tier (Cline / Continue / Cursor) wires `AbortSignal` directly into the LLM HTTP stream, all three with documented cancellation-leak bugs (Cline #5259, Continue #1449, Cursor forum #140944). Cooperative checkpoint (LangGraph / AutoGen / OpenHands / Temporal) is the safer default, but Crumb's cooperative default was *worse than those* — they at least check at every node/turn boundary, while Crumb checked only when the spawn naturally ended. R2 fixes that with an explicit user-driven verb instead of changing the cooperative default.

Changes:

- `src/effects/types.ts`: new `CancelSpawnEffect` (`type: 'cancel_spawn'`, `actor: Actor | 'all'`, `reason: string`) added to the `Effect` union. The dead-code `StopEffect` is left alone — different semantics ("write a transcript line" vs "fire SIGTERM").
- `src/dispatcher/live.ts`:
  - Module-level `activeSpawns: Map<Actor, AbortController>` registry. Populated in the `'spawn'` case right after `setupSpawnTimers`; cleared in the spawn's `finally` block (only if our controller still owns the slot, so a fast respawn after FAIL routing doesn't clobber the new entry).
  - New `case 'cancel_spawn':` handler. Resolves the target list (`'all'` → every registered actor; specific actor → that one), calls `controller.abort()` on each, and emits a `kind=note` with `data: { requested, cancelled, reason }` so Studio + replay see when the user-driven cancel landed and which actors got SIGTERM.
- `src/reducer/index.ts:494` (`case 'user.intervene'`): `data.cancel?: Actor | 'all'` recognized in the data typing. When set, emits a `cancel_spawn` effect with the reason text from `event.body` (or "user-requested cancel" default).
- `src/inbox/parser.ts:204`: new `case 'cancel':` branch.
  - `/cancel @<actor> [reason]` → `kind=user.intervene`, `body=reason`, `data: { cancel: <actor> }`
  - `/cancel [reason]` (no `@`) → `kind=user.intervene`, `body=reason`, `data: { cancel: 'all' }`
- `src/inbox/parser.test.ts`: 4 new tests cover all four `/cancel` shapes.
- `src/reducer/index.test.ts`: 2 new tests cover the cancel branch (per-actor and `'all'`).

Latency impact (mid-spawn case): 30s–30min → ~3-5s (dominated by SIGTERM grace + adapter cleanup).

Trade-offs disclosed: mid-edit subprocess kill leaves `artifacts/game/` in inconsistent state (half-written files). Acceptable because the user typed `/cancel` explicitly — frontier IDE tools (Cline, Continue) have the same shape. LLM provider may keep generating server-side after the HTTP stream closes (industry-wide cost-leak; Continue #1449). Default cooperative path unchanged — regular `user.intervene` without `data.cancel` still uses routing-via-state-change.

Verification: lint:all, typecheck, format:check, test (466/466 — was 460, +6 new), build — all clean.

Follow-up: Studio UI button on active-spawn row that POSTs `/cancel @<actor>` (R5, natural fit alongside PR-G7-B's resume button). `git stash` of actor cwd before SIGTERM for recoverable cancellation (R6, requires actor cwds to be git repos — not currently the case).

### Changed — Inbox watcher: setInterval polling → chokidar fs-event push (R1+R4) (2026-05-03)

The Studio user-intervene round-trip had an asymmetric latency profile: the transcript-to-browser fan-out direction was already on chokidar (`packages/studio/src/watcher.ts:14`, sub-10ms native FSEvents/inotify), but the browser-to-coordinator direction (`POST /api/sessions/:id/inbox` → `inbox.txt` append → coordinator polls) was on a 150ms `setInterval` loop in `src/inbox/watcher.ts:42`. After surveying 15 frontier multi-agent harnesses (LangGraph / Claude Code / Codex CLI / Cursor 2.0 / OpenHands / AutoGen 0.4 / Cline / Inspect AI / Aider / Devin / CrewAI / Continue.dev / SWE-Agent / Open Interpreter / Temporal Workflows) on their wire-layer transport, the verdict was that file-as-source-of-truth is the right architecture (matches Temporal Signals + OpenHands EventStream shape — durable, replay-deterministic, multi-process safe), but `setInterval` over `fs.statSync` is a degenerate consumer when chokidar is already in the dep tree.

Changes (`src/inbox/watcher.ts`):

- `setInterval(tick, 150)` + `statSync` polling replaced with `chokidar.watch(inboxPath, ...)` listening on `add` + `change` events. Drain runs are serialized via a Promise chain (`draining = draining.then(drain)`) so two close-together fs events don't race the `lastSize` bookkeeping.
- New `shouldPollInbox()` helper mirrors `packages/studio/src/poll-detect.ts:13`: native FSEvents/inotify on macOS/Linux by default; `CRUMB_POLL=1` or WSL detection via `/proc/version` falls back to chokidar's `usePolling: true`. Tests pass `pollIntervalMs` to force polling with a small interval (no test wall-clock regression).
- `pollIntervalMs` semantics tightened in the JSDoc: when set, forces polling with that interval (test path); when undefined (production default), chokidar uses native fs events with the WSL/Docker fallback. The 150ms-default behavior is gone — there's no "default poll interval" because the production path doesn't poll at all.
- The misleading file-header comment ("Polling (not fs.watch) for cross-platform reliability — matches transcript reader's pattern") removed and replaced with the v0.4.2 chokidar rationale citing the Studio precedent.
- `stop()` signature kept synchronous (fire-and-forget chokidar `close()`) so existing callers in `src/loop/coordinator.ts:313, 324` and the existing tests don't need `await` retrofits.

**Latency**: idle case (coordinator between spawns) drops from ~150ms worst-case to ~5-10ms typical (FSEvents/inotify push). CPU: 6.7 spurious wakeups/sec → 0 when idle. **No invariant changes** — `inbox.txt` is still the durable artifact, `kind=user.intervene` is still emitted via the same `parseInboxLine` → `writer.append` path. Pure consumer-side optimization.

The mid-spawn case (coordinator currently inside an LLM/builder subprocess) is a separate gap addressed by the upcoming `user.intervene → dispatcher.AbortController` wiring (R2, follow-up PR).

Verification: `npm run lint:all && npm run typecheck && npm run format:check && npm test && npm run build` — 460/460 tests pass (3 inbox-watcher tests still green under the new transport), lint clean, format clean.

### Changed — Studio live exec feed suppresses raw stream-json + researcher §1/§2 envelope-aware extraction (2026-05-03)

Per user feedback (single message, two pain points bundled): "추출할 때 game-design.md를 고려해서 추출할 수 있도록 하고 ⏺ Bash(...) ⎿ ...  raw {"type":"assistant",...} blob 별도의 창으로 띄워줄 수 있겠어? 지금은 live execution feed에서 이렇게 섞여져 보여."

**Studio — feed-vs-logs separation** (`packages/studio/src/client/studio.js`)

- `renderStreamJsonLine` return contract clarified: `null` = NOT stream-json (caller falls through to raw render so plain-log lines stay visible), `[]` = parsed stream-json with no narrative bubbles (caller skips → suppressed from feed), `[bubble, …]` = render each bubble. Empty arrays are truthy in JS so the caller's `if (bubbles)` enters the for-loop, iterates zero times, and `continue`s — exactly the suppression we want.
- Three `return null;` paths after successful JSON parse changed to `return [];`: unrecognized `obj.type === 'system'` subtypes, `rate_limit_event`, and the catch-all unknown-but-typed case. Result: the live execution feed no longer shows `{"type":"assistant","message":{...},"signature":"..."}` blobs alongside rendered ⏺/⎿ bubbles. Full raw stream remains visible in the Logs view (`spawn-*.log` on disk) for debugging.

**Researcher — envelope-aware extraction** (`agents/researcher.md`, `agents/specialists/game-design.md`)

- `agents/researcher.md` step 2 (Multi-modal extraction) now inline-reads §1 envelope (Phaser 3.80 multi-file, mobile-first portrait 320–428, ≤ 25 files / ≤ 5 MB, procedural-first sprites + Web Audio, 60fps offline, ES modules no build) and §2 forbidden (no Three.js / Babylon, no Unity / Godot binaries, no npm bundlers, no runtime network, no IAP / ads / live-ops, no Phaser 2 syntax, no external asset URLs except CDN) BEFORE describing the extraction prompt.
- Extraction prompt extended with `envelope_fit` per-mechanic field (`fits` / `fits-with-adaptation` / `out-of-envelope`) plus 5 cross-check rules (3D rejection, network rejection, monetization rejection, asset budget rejection, custom-shader rejection). Mechanics that violate envelope are routed to a new `mechanics_out_of_envelope` array with `forbidden_reason` citing the specific §2 row, instead of polluting `mechanics_extracted` and forcing the planner to filter downstream.
- `agents/specialists/game-design.md` §3.1 `MechanicEvidence` schema gains `envelope_fit` + `adaptation_note`, §3.2 `step.research.video` event shape gains `mechanics_out_of_envelope`. The "Reads" row in researcher's Role/Goal/Visibility table cites §1 + §2 explicitly so the cross-check is not buried in step 2's prose.

Why now: video-LLM extraction without envelope discipline regularly surfaces 3D parallax / live PvP / loot-box mechanics that planner-lead has to rediscover-and-filter when synthesizing tuning.json. Pre-filtering at the researcher saves a planner round-trip and gives the verifier audit trail (`mechanics_out_of_envelope[].forbidden_reason`) for D5 evidence quality scoring.

### Changed — Pipeline DAG visualization overhaul (PR-H) (2026-05-03)

Pre-PR-G the studio's Pipeline tab DAG was a stale 3-phase 215px graph with one feedback edge (verifier → planner-lead) — wrong post-PR-G routing where Important/Minor deviations now respawn the builder, not the planner. Plus several gaps: no labels on edges, no resume cycle, no validator-as-effect distinction, `system` node was confusingly labeled "qa-check".

**Re-audited every routing rule** in `src/reducer/index.ts` against the new DAG and fixed mismatches. Spec for the new DAG lives at `wiki/diagrams/pipeline-v0.4.md` (Mermaid source at `pipeline-v0.4.mmd`).

`packages/studio/src/client/studio.{html,css,js}`:
- **Layout**: 3 phases × 215px → **5 phases × 320px** (1100×320 viewport). Phases now match the reducer's case-routing layers: A·Spec / B·Build / C·QA / D·Verify / E·Done. Phase backgrounds color-coded translucent.
- **Node shapes** (semantic): circle (LLM-driven actor), hexagon (deterministic effect — `qa_check`, `validator`), diamond (user external input), rounded box (terminal — `done`). Was: every node was a circle.
- **`qa_check` node** (was `system` mislabeled). The `from='system'` events with `metadata.tool=qa-check-effect@v1` now ripple from the qa_check node via a `rippleFromActor()` translation so the visualization matches the semantic role, not the legacy `from` field.
- **Three feedback edges from verifier** (was: one). Important/Minor (PR-G2 default) → respawn `builder` w/ sandwich_append (blue dashed). Critical → rollback `planner-lead` (amber dashed). circuit OPEN → `builder-fallback` (red dashed). Color-coded labels on each.
- **Resume cycle edge** `done → coordinator` (cyan solid, big over-the-top arc) wires PR-G7-B's resume button + `crumb resume --run` into the canonical flow.
- **8 typed edges** (was 6): `flow / respawn / rollback / fallback / terminal / audit / intervene / resume`. Each gets its own color, stroke-dasharray, arrowhead marker, and label color.
- **Per-edge labels** above midpoint / arc apex (kind names, deviation types, PASS verdict). Was: no edge labels.
- **Always-visible legend** above the SVG (8 edge types + 3 node shapes inline mini-svg) — frontier UX (Anthropic Console / Vertex Trace Viewer) keeps the legend on-screen rather than hover-only.
- **Edge ripple animations** updated for the post-PR-G routing — `weaveTargetForVerdict` reads `scores.deviation.type` and routes Important → builder (was: always planner). New `handoff.rollback` case wired into `weaveOnAppend`.

`design/DESIGN.md` — new §5.5 "Pipeline DAG (top of the Pipeline tab)" section spec'ing the layout, shapes, edge taxonomy, and live behavior. Cites the canonical Mermaid source so future edits stay in sync.

`wiki/diagrams/pipeline-v0.4.{mmd,md}` (NEW):
- `pipeline-v0.4.mmd` — Mermaid 11+ flowchart matching the studio DAG 1:1. Renderable via `mermaid.live` editor for hiring-panel slides / static documentation.
- `pipeline-v0.4.md` — wiki page with the Mermaid embed + routing rule table cited against `src/reducer/index.ts` + node shape & edge type tables + "why three feedback edges" rationale.

Verification: `npm run lint && npm run typecheck && npm run format:check && npm test && npm run build` — 460 tests pass (no test pinned to old DAG layout). Studio HTML re-inlined to 146KB. Live verified at http://127.0.0.1:7321/.

### Changed — Audit Q5: studio append-handler fan-out (8 → 1 dispatcher) (2026-05-03)

Post-#106 audit Q5 cleanup. The studio client (`packages/studio/src/client/studio.js`) had **8 independent** `es.addEventListener('append', ...)` registrations on the same EventSource. Each parsed `e.data` separately (8× JSON.parse cost per event) and re-filtered by `session_id` independently (8× `if (d.session_id === activeSession)` checks). For high-throughput sessions (multi-file PWA build emits 20+ artifact.created events back-to-back) this was measurable.

Now: a single dispatcher parses `e.data` once and fans out to handlers registered via `onAppendMsg(fn)`. Order of registration is preserved (the cache-updater registers first, so downstream renderers see the freshly-pushed event in `eventCache` when their handler runs). Per-handler errors are caught + logged so one broken consumer doesn't break others — same isolation pattern as Q2's selectSession hook array.

7 sites converted (the cache updater stays as the first `onAppendMsg` registration since it's the source of truth for `eventCache`):

- weave / DAG ripple animation
- live-feed `appendFeedLine`
- per-actor log stream attach on agent.wake
- output-tab refresh on artifact.created
- Resume button refresh
- transcript-view re-render
- coordinator-visibility note → feed line

Verification: 453/453 sweep green; lint/typecheck/format/build clean. Same render outputs (cache → swimlane → scorecard → session list) but with 1× JSON.parse instead of 8×.

### Added / Fixed — Intervention routing + Resume (PR-G2/G4/G7) (2026-05-03)

Live session `01KQNEYQT53P5JFGD0944NBZ9D` exposed three coupled gaps observed during pipeline tracing:

1. **`@<actor> body` shorthand silently dropped** — 5 of 6 inbox lines in `01KQNAK1CXTBDEBX2WP2QQK891` recorded a fact and never woke the actor. The reducer treated `target_actor` as a tag for the fact only; spawn required `data.goto`.
2. **verifier sandwich was self-routing fiction** — `agents/verifier.md:53` told the verifier "you can rollback to planner-lead OR builder-fallback", but the reducer's FAIL branch ignored the verifier's hint and always rolled back to planner-lead (or to builder-fallback only when the circuit was OPEN). `kind=handoff.rollback` had no reducer case at all.
3. **`crumb resume <id>`** only printed the next-step command instead of re-entering the loop; the studio had no Resume button at all. Budget-exhausted sessions (`token_exhausted`, `wall_clock_exhausted`) had zero one-click recovery path.

`src/reducer/index.ts`:
- **PR-G2** — verdict=FAIL/REJECT routing now reads `judge.score.scores.deviation.type`. `Critical` → rollback to planner-lead (full respec, prior behavior); `Important`/`Minor` (default) → respawn the original `builder` with verifier feedback + `suggested_change` injected as a one-shot `sandwich_append`. The "1-line redirector" case from session 01KQNEYQT no longer burns a full plan-cycle.
- **PR-G2** — new `case 'handoff.rollback'` mirrors the same deviation-typed routing for explicit rollback events the verifier emits separately from the verdict path.
- **PR-G7-A** — `user.intervene` with `target_actor` + `body` (no `goto`/`swap`/`reset_circuit`/`sandwich_append`) now spawns that actor with the body as prompt. Honors per-actor pause + global pause.

`src/loop/coordinator.ts`:
- **PR-G7-C** — `drainReduce` clears `state.done` before reducing a `user.intervene` / `user.resume` event so a user can unstop a budget-exhausted session that's still in-process. Sessions that already exited the process need PR-G7-B (resume CLI / Studio button) instead.

`src/cli.ts` — **PR-G7-B**: `crumb resume <id> --run` (alias `--auto`) now re-enters the coordinator loop in process. `--force` lets a `done` session re-enter (budget-exhausted retry). Without flags the legacy print-the-command behavior is kept (callers that scrape stdout). New `--adapter` / `--preset` / `--idle-timeout` / `--per-spawn-timeout` flags are forwarded to the re-entry.

`packages/studio/src/server.ts` + client (`studio.html` / `studio.css` / `studio.js`):
- **PR-G7-B** — new `POST /api/sessions/:id/resume` handler spawns `crumb resume <id> --run` as a detached child. Body `{ adapter?, force? }` forwards `--adapter` / `--force`.
- **PR-G7-B** — Resume button (`↻`) appears on paused / interrupted / budget-exhausted session rows on hover (sits to the left of the close `×`). Auto-flips `force=true` for `token_exhausted` / `wall_clock` / `all_builders_open` `done_reason`s. Uses `--primary` token tinted with `color-mix` so it reads as an action without competing with the destructive close button.

`agents/verifier.md`:
- **PR-G4** — sandwich corrected. `to=planner-lead OR builder-fallback` removed (was self-routing fiction); replaced with `to=coordinator` + `data.deviation.type` table (`Critical`/`Important`/`Minor`) so the LLM picks the *type*, the reducer picks the *target*.

`src/protocol/types.ts` — `Scores` interface gains `deviation?: { type? }` + `suggested_change?` fields so the verifier can emit them and the reducer can read them without `as` casts at the call site.

PR-G3 (audit_violations follow-on) was already implemented in `src/validator/anti-deception.ts:180` (`self_bias_score_discounted` — 15% discount on D1/D3-LLM/D5 when same-provider risk fires) per `wiki/synthesis/bagelcode-same-provider-discount-2026-05-03.md`. No additional change required.

Verification: `npm run lint && npm run typecheck && npm run format:check && npm test && npm run build` — 460 tests pass (was 453; +7 new across reducer FAIL deviation routing, handoff.rollback, @actor shorthand spawn, paused-actor-respect).

### Added — Video research toggle (Gemini-only) end-to-end (studio → server → CLI → coordinator → reducer) (2026-05-03)

Per user feedback: "세션을 만들 때 gemini sdk나 Gemini CLI가 활성화 되어 있으면 custom binding에 비디오 인코딩 활성화/비활성화 토글 넣고 활성화되면 research에서 비디오 인코딩하도록 프롬프트 수정 및 보강하자. 대신 gemini 쪽이 활성화가 안되어있으면 패스하고 말이야."

End-to-end wiring so the studio's session-create form can opt-in to video research (Gemini 3.1 Pro 10fps frame sampling) when the host has gemini-sdk OR gemini-cli-local installed. Hidden entirely otherwise.

**Studio UI** (`packages/studio/src/client/studio.{html,css,js}`)

- New `<details>` panel "Video research (Gemini)" inside the existing Custom binding details. Visibility tracks `/api/doctor` probe — `renderVideoResearchPanel()` shows the toggle iff `gemini-sdk` OR `gemini-cli-local` is installed AND `authenticated !== false`. Hidden + force-cleared otherwise (stale checkbox state can't leak into the next /api/crumb/run body).
- Checkbox reveals a textarea (one URL/path per line). Submitted as `body.video_refs: string[]` to /api/crumb/run.

**Studio server** (`packages/studio/src/server.ts`)

- `serveCrumbRun` accepts `body.video_refs` (string[]), trims, drops blanks. Forwards to spawned `crumb run` as `--video-refs <comma-separated>`. Response echo includes `video_refs` field for client confirmation.

**Crumb CLI** (`src/cli.ts`)

- `cmdRun` parses `--video-refs <csv>` into `string[]`. Forwards to `runSession({ videoRefs })`.

**Coordinator** (`src/loop/coordinator.ts`)

- `RunOptions.videoRefs?: string[]` added. When non-empty, the synthetic `goal` event written at session start carries `data: { video_refs: [...] }` so the reducer's `case 'goal'` flips `state.goal_has_video_refs = true`. Empty/undefined keeps existing text-only research flow.

**Researcher path** (no change — already in main)

`agents/researcher.md` step 1 already routes on `data.video_refs`: empty/absent → text-only, non-empty → multi-modal extraction (Step 2 with gemini-sdk file_data Part). The toggle just makes the entry UX explicit.

Verification: 453/453 sweep green; lint+typecheck+format+build clean.

### Changed — Audit cleanup: C1 invariant doc + C3 session_id consistency + Q2 selectSession hooks + Q6 dead wrapper (2026-05-03)

Four small audit-driven cleanups bundled. None change behavior; all reduce future bug surface.

**C1 invariant document (`src/loop/coordinator.ts`)** — the post-#104 audit flagged a theoretical race where `dispatch(append-audit)` returns before the file is observable to a freshly-spawned subprocess. Verified by tracing the chain:

`dispatch(append) → writer.append() → fs/promises appendFile()` — `appendFile` resolves AFTER the kernel's `write(2)` returns, which commits bytes to the OS page cache. Subsequent reads in the same OS (the spawn's subprocess inherits parent's filesystem namespace) see the bytes immediately — fsync is not required for cross-process visibility, only for crash durability. So the within-IIFE sequential `await dispatch(eff)` IS sufficient. Comment added in coordinator.ts so future readers (or audit passes) don't re-flag this.

**C3 session_id consistency (`src/reducer/index.ts`)** — anti-deception audit append used `event.session_id`, while `fallback_activated` audit and `handoff_unrouted` note (PR #103) used `next.session_id`. Equal in single-session operation but inconsistent. Unified on `next.session_id` (the state-derived form, anchoring on the reducer's source of truth per Hub-Ledger-Spoke).

**Q2 selectSession hook pattern (`packages/studio/src/client/studio.js`)** — replaced 5-deep monkey-patch chain with `sessionSelectHooks: Function[]` + `onSessionSelect(hook)` API. `selectSession` runs the canonical render set then fans out to registered hooks. Stack traces stay shallow; hook errors are caught + logged so one broken hook doesn't break others.

**Q6 dead wrapper (`packages/studio/src/client/studio.js`)** — removed `const _origAppendFeedLine = appendFeedLine` indirection; the wrapper just renamed `appendFeedLine` without redefining it. Direct call now.

Verification: 453/453 sweep green; lint+typecheck+format+build all clean.

### Fixed / Docs — token budget 5× + pre-verifier no-scoring frontier doc (PR-G1+G6) (2026-05-03)

Live session `01KQNEYQT53P5JFGD0944NBZ9D` (Reba Berserker, 17-file Phaser 3.80 PWA) consumed 111,951 tokens before the verifier could even wake. The reducer's `TOKEN_BUDGET_HARD = 50_000` fired `done(token_exhausted)` mid-build → `state.done = true` → coordinator's `if (state.done) return;` (`src/loop/coordinator.ts:273`) skipped every subsequent reduce, including the verifier's `kind=judge.score`. Result: `validator/anti-deception.ts` never got invoked for that session — the `from='validator', kind='audit'` event was missing even though the verifier self-reported `audit_violations: ["self_bias_risk_same_provider"]` in its judge.score metadata. Root cause = budget too low, not the validator pipeline itself.

`src/reducer/index.ts`:
- `TOKEN_BUDGET_HOOK` 40_000 → **250_000** (soft hook)
- `TOKEN_BUDGET_HARD` 50_000 → **300_000** (hard cap)
- Sized for one full spec → multi-file build → qa_check → CourtEval verifier loop with ~30% headroom for one builder-fallback retry. `CRUMB_TOKEN_BUDGET_HOOK` / `CRUMB_TOKEN_BUDGET_HARD` env vars still override for short demos and CI.

`wiki/synthesis/bagelcode-pre-verifier-no-scoring-frontier-2026-05-03.md` (NEW): synthesis answering "왜 planner / builder 중간에 LLM scoring 이 없냐" — short answer is that `qa_check` IS the pre-verifier ratchet (deterministic exec gate, not LLM). 5 frontier references (DeepSeek-R1 / Cognition / CourtEval / Huang ICLR 2024 / SWE-Bench top-10) + cheat sheet for the Bagelcode hiring panel question.

`AGENTS.md` invariant #4 ("Three-layer scoring") now explicitly notes that the `qa_check` effect doubles as the pre-verifier ratchet — discovery path for evaluators who scan invariants first.

Verification: `npm run lint && npm run typecheck && npm run format:check && npm test && npm run build` — 453 tests pass (no test pinned to the old budget; `grep TOKEN_BUDGET src/**/*.test.ts` returns 0).

### Changed — Custom binding UI polish + audit C2 parent_event_id wiring (2026-05-03)

User feedback: "비활성화면 그냥 색만 지금처럼 페이드아웃시키면 되지 굳이 선을 그을 필요는 없어. ambient에 괄호를 열고닫을 필요도 없고 말이야." Plus closing the audit C2 P0 finding from the post-PR-#104 audit pass.

**UI polish (`packages/studio/src/client/studio.{html,css,js}`)**

- `.preset-chip.disabled` no longer applies `text-decoration: line-through` — fade-out (opacity 0.4) is the only affordance, per UX feedback. Less visual noise.
- `(ambient)` parentheses removed everywhere (preset chip label, advanced bindings dropdown, top adapter dropdown). Now just `ambient`.
- Disabled adapter options in the bindings dropdown no longer carry the `(×)` suffix; `(not installed)` removed from the top adapter dropdown labels. Same fade-out-only convention.

**Audit C2 fix (`src/reducer/index.ts`)**

The post-#104 pipeline audit flagged that two reducer-emitted append effects were missing message-level `parent_event_id`:

- `fallback_activated` audit (line 358-374) — emitted on judge.score FAIL + builder circuit OPEN. Now sets `message.parent_event_id = event.id` so studio's detail-pane thread nav (`detail-prev` / `detail-next`) walks correctly from the audit back to the originating judge.score.
- `handoff_unrouted` note (PR #103, lines 615-633) — emitted for any `handoff.requested` whose `(from, to)` pair lacks reducer routing. Same fix; `data.parent_event_id` removed (was redundant since the message-level field now carries it).

Both fixes are observability-only — no routing/spawn change. Studio detail pane now correctly threads parent → audit/note → children for these synthetic events.

**Verification**: 48/48 reducer specs + lint + typecheck + format + build all clean.

### Changed — Researcher prompt: named-game lock-in (high-priority research for real game titles cited in goal) (2026-05-03)

Per user feedback: "리서쳐가 레퍼런스 조사할 때 사용자가 전달한 게임 이름이 실제로 존재하면 그 작품 참고율과 자료 조사 비율을 확 높이는 방향". Previously the researcher would land on generic genre proxies even when the user explicitly named an existing game ("레바의 모험 버서커 모드", "Vampire Survivors 같은") — wasting the implicit ground truth.

`agents/researcher.md` step 1.5 added between Triage and Multi-modal extraction:

- **Named-game detection** — scan goal text for proper-noun titles. Coverage list includes Korean Flash-era classics (레바의 모험, 크레이지 아케이드, 메이플스토리, 카트라이더 등), casual mobile / indie hits (Vampire Survivors, Royal Match, Candy Crush, Loop Hero, Slay the Spire, Balatro, Reigns, Suika Game / 스이카 게임 등), retro arcade (Pac-Man, Bubble Bobble, Tetris, Bomberman, Snake 등). Open-ended — title-case or quoted = treat as named.
- **When detected, research the exact title FIRST and HEAVIEST**:
  1. Web search canonical name + "gameplay" (`"Royal Match" gameplay 2026 mechanics`)
  2. Pull from authoritative sources (priority): Wikipedia / 나무위키 → official store page → Speedrun.com / TASVideos → YouTube top-3 gameplay videos → fan wikis
  3. Extract canonical numbers (HP / attack / palette hex / BGM key / level count) — not guesses
  4. Cite the named game in `step.research.data.reference_games[0]` with `weight: 0.7+` so planner allocates ~70%+ of design decisions to it
  5. Emit `kind=note body="named-game lock-in: <Title> — primary reference"` at the top of step 3 — visible binding decision
  6. Reproduce the named game's CONTROLS faithfully in `tuning.json` + `DESIGN.md` (D-pad / 4-dir / 8-dir / mouse-driven). §1 keyboard policy still applies on top.
- **No named game detected → fall through** to genre-based research (existing flow). Additive, not a replacement.

Rationale: a user pitching "레바의 모험 버서커 모드" expects the researcher to actually know 레바의 모험 — palette (16-bit pixel-cartoon homage), genre (action platformer), iconic mechanics (sword + dash), Korean Flash-era nostalgia. Generic "casual mobile action survivor" research wastes context and produces a generic clone, not the homage they asked for.

### Changed — Studio grep toolbar overflow + game-design.md §1 input/asset policy (2026-05-03)

Two small UX/contract fixes from live-session feedback.

**Studio grep toolbar overflow** (`packages/studio/src/client/studio.{html,css}`)

The grep input in the Logs / Transcript / Live-feed toolbars used `flex: 1` with no `min-width: 0` cap, so the long `placeholder` text ("grep… (substring, Enter=next, Shift+Enter=prev, Esc=clear)") forced the input to its full intrinsic width and pushed the `↑ ↓` nav buttons + `follow` checkbox + `clear/copy` buttons off the visible toolbar. Reproducible at any panel width below ~640px.

- Inputs now use `flex: 1 1 160px; min-width: 80px; max-width: 320px;` + `text-overflow: ellipsis` so long values truncate visibly without growing the box.
- `.grep-controls` got `flex-shrink: 0` so the counter + nav arrows never collapse.
- Each toolbar got `flex-wrap: wrap` so on narrow widths the row breaks rather than overflowing.
- Long placeholders shortened to `grep…` / `grep / filter…` with the full hint moved into the `title` tooltip — keeps the visible text minimal but discoverable on hover.
- The Live-feed grep input that had its layout rules inlined as a `style="..."` attribute was extracted into a `.feed-grep-input` class for consistency with the other two.

**`agents/specialists/game-design.md` §1 envelope expanded — input scheme + pixel + audio asset policy** (per user request: "캐릭터를 움직일 땐 방향키 혹은 wasd를 사용하라는 말은 어느 프롬프트에 넣는게 좋겠어" + "도트 이미지 만들 때 사용하기 좋은 툴이나 프롬프트 있나? 음악도 마찬가지야")

The contract is read by 5+ actors (researcher / planner-lead / builder / builder-fallback / verifier) so adding it once propagates everywhere. Scope: §1 Hard envelope.

- **Keyboard (REQUIRED for movement-based games)** — Arrow keys + WASD bound to the same direction handler; Space = action/jump; Esc = pause. Pure tap games (match-3 / clicker / tap-defender) explicitly exempt. Implementation guide for `systems/InputManager.js` (`addKeys('W,A,S,D,SPACE,ESC')` + `createCursorKeys()`). Rationale: qa-check Playwright presses keys deterministically — keyboard is the desktop testability surface AND keyboard-accessibility win.
- **Pixel asset policy** — procedural-first via `CanvasRenderingContext2D.fillRect` 1-pixel discipline + locked palette from `lospec.com/palette-list` (PICO-8 16, NES 25, GameBoy DMG-04 etc) + `pixelArt: true` + `image-rendering: pixelated`. Atlas fallback ALLOWED only via Aseprite / Retro Diffusion / PixelLab.ai / Scenario.gg / Pyxel Edit. **Forbidden** for sprite output: MidJourney / DALL-E / Recraft (palette + grid drift, post-processing burden). Atlas ≤ 1 MB; source + license required in `CREDITS.md`.
- **Audio policy** — procedural-first via `OscillatorNode` 3-channel chiptune + ADSR + lookahead clock (Chris Wilson "A Tale of Two Clocks") + `jsfxr` seeds for SFX. Asset fallback ALLOWED only via ElevenLabs Sound Effects / Suno v4 / Stable Audio 2.0 / MusicGen / ChipTone. Bundle ≤ 500 KB combined audio @ ≤ 96 kbps mono mp3; source + license + prompt seed required in `CREDITS.md` so verifier can audit D5 originality.

Tools cited are 2026-05 active per dedicated research pass — not hallucinations.

### Fixed — Pipeline resilience bundle: builder-fallback + verifier circuit breaker dead-end termination + handoff observability (2026-05-03)

Three reducer-level fixes from the post-immediate-wake pipeline audit. None individually large, but together they close the remaining "session burns wall-clock with no progress" failure modes.

**P1 #6 — `done(all_builders_open)` when both builder + builder-fallback OPEN** (`src/reducer/index.ts` judge.score FAIL branch)

Previously, when a `judge.score FAIL` arrived with `circuit_breaker.builder.state === 'OPEN'`, the reducer unconditionally spawned `builder-fallback`. If builder-fallback was ALSO OPEN (3+ consecutive failures itself), the spawn would just produce another error → another `judge.score FAIL` → another fallback attempt, until wall-clock cap. Now we check both breakers and emit `done(all_builders_open)` cleanly when both are dead.

**P1 #7 — `done(verifier_unavailable)` when verifier circuit OPEN** (`src/reducer/index.ts` qa.result branch)

Similar dead-end: a `qa.result` with `circuit_breaker.verifier.state === 'OPEN'` would spawn the verifier anyway, fail, and loop until wall-clock. Now we early-terminate with `done(verifier_unavailable)`.

**P1 #8 — handoff.requested unrouted observability** (`src/reducer/index.ts` handoff.requested branch)

The default branch silently dropped any `handoff.requested` whose `(from, to)` pair didn't match the planner→researcher exception. Future routes added without reducer wiring would create silent stalls — no error, no progress, just dead air. Now an unrouted handoff appends a `kind=note body="handoff.requested to=X from=Y — no reducer routing for this pair"` so studio/debug surfaces the missing wiring as a visible warning. Routing is unchanged (still no spawn), only observability.

**P1 #9 — `lastEventAt` reset documentation** (`src/loop/coordinator.ts`)

Audit flagged a possible idle-timer drift on resume; deeper inspection confirmed the existing `let lastEventAt = Date.now()` IS already after replay, so the bug was a false positive. Comment-only update documenting the invariant for future readers.

**Verification**: 3 new reducer specs pinning the dead-end terminations + the handoff note. `v0.4 P1 #6: judge.score FAIL with builder + builder-fallback both OPEN → done(all_builders_open)`, `v0.4 P1 #7: qa.result with verifier OPEN → done(verifier_unavailable)`, plus the existing `handoff.requested(to=other)` test updated to expect a kind=note effect instead of zero effects. 434/434 sweep green; lint+typecheck+format+build clean.

**Deferred to follow-up**: P1 #4 (codex/gemini usage stdout parsing — needs per-CLI format research) and P1 #5 (inbox watcher race + lastSize ordering — needs fs.watch push-trigger refactor). Both bigger PRs.

### Fixed — qa-runner hard timeout (`CRUMB_QA_CHECK_TIMEOUT_MS`, default 120s) (2026-05-03)

Pipeline audit follow-up to the immediate-wake fix. Session `01KQNAK1` saw 2 builds → 0 qa.results because `runQaCheck` could hang inside Playwright (chromium zombie / network stall / service-worker bootstrap), and the dispatcher's `await runQaCheckEffect` had no upper bound. The reduce/dispatch decoupling shipped in the previous patch removed the chain-level serialization, but a hung qa_check effect still meant the verifier was never spawned for that build.

- **`src/dispatcher/qa-runner.ts`** — new `runQaCheckWithTimeout()` wraps `runQaCheck` in a `Promise.race` against a sentinel rejecting with `QaCheckTimeoutError` after `CRUMB_QA_CHECK_TIMEOUT_MS` (default 120,000 ms). Existing exception path (lines 27-52) catches the timeout the same way as a thrown error and emits a deterministic FAIL `qa.result` with `exec_exit_code=2` and `lint_findings: ['exception: qa-check exceeded …ms — Playwright likely hung']`. Timer is cleared in `finally` so a fast pass doesn't leak the setTimeout.
- **120s default rationale**: 2× the per-step Playwright internal budgets (5s nav + 5s canvas + 5s scene-running + 1.5s console + 5s offline-reload + cross-browser pass + smoke iframe ≈ 30-90s typical). CI smoke runs can drop to 30s via `CRUMB_QA_CHECK_TIMEOUT_MS=30000`; debugging can raise to 5min.
- **`src/dispatcher/qa-runner.test.ts`** (NEW) — 2 specs: (1) `runQaCheckEffect` emits FAIL `qa.result` within ~120ms when `runQaCheck` is mocked to never resolve; the writer.append is called exactly once with `exec_exit_code=2` + lint_findings explaining the timeout. (2) Pass-through path still works when qa-check resolves normally — body matches `qa-check PASS`, `exec_exit_code=0`. 431/431 sweep green.

This closes the F4 (qa.result missing) failure mode in the fault matrix. Combined with `#100`'s reduce/dispatch decoupling, the pipeline now: (a) doesn't serialize behind subprocess exit, and (b) cannot get stuck on a hung qa check — every build event WILL produce a qa.result event in bounded wall-time.

### Fixed — Coordinator immediate-wake: decouple reduce from dispatch in event chain (2026-05-03)

Session `01KQNAK1CXTBDEBX2WP2QQK891` (레바의 모험 버서커, 레바의 모험 버서커) hit `wall_clock_exhausted` twice with `2 builds vs 0 qa.results`. Root cause was structural in `src/loop/coordinator.ts:267 onMessage`:

```
processing = processing.then(async () => { ... await dispatch(eff) ... })
```

— every event reduce + dispatch was serialized behind every prior dispatch. `dispatch(spawn)` awaits `adapter.spawn()` which only resolves on **subprocess exit**. So when builder wrote its terminal `build` event mid-spawn, the tail picked it up but `onMessage(build)` couldn't fire reduce → `qa_check` effect until the builder subprocess fully exited (often minutes later, sometimes never if the wall-clock cap killed it first). User feedback: "다음 에이전트로 넘겼을 때 대상 에이전트를 즉시 깨우고 전달해서 진행이 됐으면 해."

**Fix** — reduce and dispatch decoupled:

- `reduceQueue: Message[]` + `reducing: boolean` flag — reducer runs synchronously in-order in `drainReduce()` so state stays consistent and replay-deterministic (AGENTS.md invariant #1/#2).
- Effects from each event dispatch as a fire-and-forget IIFE: `void (async () => { for (const eff of effects) await dispatch(eff, deps); })().catch(fail)`. Effects within a single event remain sequential so order-sensitive reducer cases like `judge.score FAIL → [append(audit), spawn(builder-fallback)]` preserve their audit-then-spawn ordering.
- `pendingItems` now counts in-flight async dispatches (was: queued chain items). Idle watchdog still gates `finish()` on `pendingItems === 0` so a long verifier spawn doesn't get terminated mid-flight.
- `processing` chain variable removed; the wall-clock watchdog's `processing.finally(...)` replaced with direct dispatch `done(wall_clock_exhausted)` since `state.done` mutation now causes `drainReduce` to exit the loop without further reduce.

**Effect on real session pipelines**: when builder writes `build`, tail picks it up → reduce fires immediately → `qa_check` effect dispatches Playwright **in parallel with** the builder subprocess still cleaning up. qa-runner emits `qa.result` → reduce → spawn verifier — all without waiting for the prior actor's exit. Pipeline latency between actor handoffs collapses from `O(subprocess_exit_time + cli_cold_start)` to `O(cli_cold_start)`.

**Tests** — `src/loop/coordinator.test.ts` adds a `v0.4 immediate-wake — reduce/dispatch decoupling` suite with a `SlowSpawnAdapter` that emits its terminal event quickly but lingers 800ms before resolving. Asserts that the next actor's spawn starts within 600ms of the prior actor's terminal event — would have failed under the old chain. 6/6 loop specs + 429/429 sweep green.

### Added / Fixed — observability + scheduling (PR-F) (2026-05-03)

Five-part batch addressing the "spawn happens, then 200s of silence" gap surfaced live in `01KQNAK1CXTBDEBX2WP2QQK891`. Studio now shows real-time progress (FS-driven artifact emits + stream-json tool_use tap + first-stdout heartbeat); single-session safety enforced by a PID-aware lease; inbox poll halved to 150ms for instant intervene; budgets raised to fit real builder runtimes; UI flips to newest-first with a repeat-collapse badge.

`src/dispatcher/artifact-watcher.ts` (NEW): chokidar tail of `<sessionDir>/artifacts/**` → `kind=artifact.created` per file. Independent of LLM emit habit; dotfiles + `exports/` excluded. 2 unit tests.

`src/adapters/_shared.ts` + `claude-local.ts` / `codex-local.ts` / `gemini-local.ts`: line-buffered stream-json splitter + provider-specific `parseClaudeStreamProgress` / `parseCodexStreamProgress` parsers. New `SpawnRequest.onProgress` hook the dispatcher wires into `kind=tool.call` (private). Studio renders these as `kind-tool-call` rows. 6 unit tests.

`src/dispatcher/live.ts`: first-stdout heartbeat — `kind=note "actor=X stdout activity (+Tms via Y)"` once per spawn so the user sees the cold-start has ended. Per-spawn timeout raised 15min → 30min, idle 90s → 5min (Reba Berserker observed at 10m48s exit=0).

`src/loop/coordinator.ts`: wall-clock soft hook 24min → 50min, hard cap 30min → 60min (override via `CRUMB_WALL_CLOCK_*`). Wires artifact-watcher + lease lifecycle into `finish` / `fail`.

`src/session/lease.ts` (NEW): `<sessionDir>/.crumb-lock` with PID + `startedAt`. `acquireLease` refuses on a live PID; reclaims a stale one. Prevents two coordinators on the same session from double-spawning + double-emitting artifact events. 5 unit tests.

`src/inbox/parser.ts`: `/reset_circuit` underscore alias accepted alongside `/reset-circuit` (the MCP tool emits the underscore form; users typed both). Footgun directly observed in 01KQNAK1 inbox. 3 unit tests.

`src/inbox/watcher.ts`: poll interval 500ms → 150ms default — below 200ms perceptual threshold for "did my action register?". Tests pass `pollIntervalMs` explicitly so no test impact.

`packages/studio/src/client/studio.{html,css,js}`:
- New-session form gains an Adapter `<select>` populated from `/api/doctor`. Body forwards `adapter` field; HTTP 409 from server surfaces install + auth hints inline.
- Live execution feed flips to **newest-first** (prepend, scroll-pin top). Repeat events with same `(actor, kindClass, body[:200])` within 60s collapse onto the existing top row with an `×N` badge in the upper-right. Badge color shifts from `--primary` (≤4) to `--lime` (≥5) for genuine "actor stuck" detection.
- `kind=tool.call` and `kind=artifact.created` get dedicated `kindClass` mappings so PR-F B + PR-F A events render with consistent styling.

Verification: `npm run lint && npm run typecheck && npm run format:check && npm test && npm run build` — 447 tests pass (was 428; +16 new across artifact-watcher, lease, _shared parsers, parser alias).

### Added / Fixed — studio adapter wiring + pre-spawn doctor + cache ratio fix (PR-E) (2026-05-03)

Live debugging session `01KQNAK1CXTBDEBX2WP2QQK891` surfaced three interlocking bugs where the studio "create session" form was silently dropping the user's adapter pick, the dispatcher was spawning known-broken adapters (codex exit=1 within 3s, three times in a row), and the studio's cache hit rate rendered as `4553319%`.

`src/helpers/adapter-health.ts` (NEW) — fast pre-spawn probe (`probeAdapter(id)`):
- Mock + SDK adapters short-circuit (no I/O).
- Binary adapters: `<binary> --version` with 2s timeout + auth-hint check (codex requires `~/.codex/auth.json`).
- Cached per adapter id for the lifetime of the dispatcher.
- 4 unit tests covering mock, SDK env, unknown id, cache.

`src/dispatcher/live.ts` — pre-spawn health gate:
- Before invoking `adapter.spawn()`, calls `probeAdapter(adapterId)` (skipped for already-claude-local + mock).
- On unhealthy: emits `kind=note body="adapter X unhealthy (reason) — substituting claude-local for actor Y"` with `metadata.tool=adapter-health-probe@v1`, then swaps `adapterId` to `claude-local`.
- Frontier-aligned with Paperclip "atomic checkout" pattern (don't burn worker on a known-broken target).

`packages/studio/src/server.ts` — `/api/crumb/run` accepts `adapter` body field:
- Forwards as `--adapter <id>` flag to the spawned `crumb run`.
- Pre-spawn probe via existing `probeAdapters()` — refuses launch with HTTP 409 + structured `{ error, install_hint, auth_hint, available }` when the picked adapter is missing, so the modal can prompt.

`packages/studio/src/metrics.ts` — cache_ratio formula fix:
- Old: `cache_read / tokens_in` (rendered 1000%+ when cached prefix dwarfed miss tokens).
- New: `cache_read / (cache_read + cache_write + tokens_in)` per Anthropic API conventions (`usage.input_tokens` = miss, `cache_read_input_tokens` = hit, `cache_creation_input_tokens` = write).
- Existing test updated + 1 new test asserts ratio stays ≤ 1.0 even when cache_write is non-zero.

Verification: `npm run lint && npm run typecheck && npm run format:check && npm test && npm run build` — 428 tests pass (was 423 + 5 new).

### Changed — qa-check multi-file bundle support, single-file size cap removed (PR-D) (2026-05-03)

Aligns deterministic qa-check with the multi-file PWA envelope (`agents/specialists/game-design.md` §1.1). Single-file profile retired in v0.4.0; `MAX_OWN_CODE_BYTES = 60_000` no longer makes sense as a fail gate.

`src/effects/qa-check.ts`:
- **`MAX_OWN_CODE_BYTES = 60_000` removed.** No bundle size cap. User directive: single-shot quality > compression budget.
- **Multi-file walker** added — when entry is `index.html`, walk `dirname(artifactPath)` recursively, sum file sizes, count files. Dotfiles skipped (`.DS_Store` etc.).
- **`bundle_file_count`** added to `QaResult` for telemetry. `loc_own_bytes` now means aggregate bundle bytes for multi-file (file size for single-file, unchanged).
- Lint findings no longer include any "exceeds N bytes" message — `allOk` derives from lint + Playwright + AC predicates only.

The Playwright smoke + AC-predicate runner already supported multi-file via `dirname` / `basename` split (since v0.3.5); this PR was the last single-file holdout.

`src/effects/qa-check.test.ts`:
- Replaced "FAILs when own-code exceeds 60KB" with "reports bundle bytes for telemetry but does not gate on size".
- Added 2 multi-file bundle tests: recursive walk + dotfile skip.

Verification: `npm run lint && npm run typecheck && npm run format:check && npm test && npm run build` — 423 tests pass (12 in `qa-check.test.ts`).

### Added — `@crumb/studio` separate-publish prep (PR-pkg-2) (2026-05-03)

Builds on the dashboard → studio rename (#96). Prepares `@crumb/studio` for independent npm publish so users can `npm i -g @crumb/studio` without pulling the full `crumb` core, and so dashboard UX patches can iterate on their own SemVer cadence (frontier pattern: Anthropic Claude Code / OpenAI Codex / Vercel `next` + sub-packages).

`packages/studio/package.json`:
- **`private: true` removed** — was blocking publish entirely.
- **`files` allowlist** added: `dist`, `scripts/inline-client.mjs`, `README.md`, `LICENSE`. Drops the 124 → 53 KB tarball; no test artifacts (`tsc` emits them but the allowlist excludes via `dist/**`-only inclusion).
- **`peerDependencies: { crumb: "^0.4.0" }`** + `peerDependenciesMeta.crumb.optional = true`. Studio works standalone for read-only watching; spawning new sessions through the new-session form still requires `crumb` on `PATH` (gated by adapter doctor).
- **`publishConfig.access: "public"`** — required for scoped packages.
- **`engines.node: ">=18.0.0"`**, full `keywords` / `repository.directory` / `homepage` / `bugs` / `license` / `author` for npm registry SEO.

`packages/studio/README.md` (NEW, 4.7 KB) — npm-registry-rendered README:
- 4-workflow table (Spawn / Watch / Intervene / Inspect)
- Install + run + env reference
- Architecture (no bundler / no client framework / chokidar tail / API surface)
- Relationship to `crumb` (single SemVer cadence)

`packages/studio/LICENSE` — copied from root (MIT). Plain copy, no symlink (Windows-safe + npm-registry-friendly).

Root `README.md` Quickstart updated:
- **End-user path** (no source clone): `npm i -g crumb @crumb/studio`.
- **Source/dev path** (`git clone`) preserved.

Verification:
- `npm pack --dry-run` on `packages/studio/`: **19 files / 53.7 kB** (was 41 / 124.8 kB pre-allowlist). `dist/cli.js` + `dist/server.js` + `dist/studio-html.generated.js` (124 KB inlined) all present.
- Root `npm pack --dry-run` does NOT include `packages/` (root tarball untouched).
- `lint + typecheck + format:check + test + build` — all green; **421/421 specs pass**.

Out of scope (queued):
- Actual `npm publish --access public` on both packages — deferred to user's own publish action with auth.
- `npm version 0.4.0 --workspaces --include-workspace-root` sync — both already at 0.4.0 since PR #93.

### Changed — Rename `dashboard` → `studio` (web console; user directive) (2026-05-03)

The local web UI is a control surface (spawn / intervene / swap), not just a passive dashboard. User picked the **Studio** naming after surveying Supabase Studio (renamed from Dashboard 2024 Q3) / Sanity Studio / Convex Studio precedent. This PR is a single atomic rename so future PR-pkg-2 (separate `@crumb/studio` publish) can build on the right names.

Sentinel-protected sed (`/tmp/dashboard-to-studio.sh`) renamed across 45 files:

- **Package**: `@crumb/dashboard` → `@crumb/studio`. Directory: `packages/dashboard/` → `packages/studio/`.
- **Bin**: `crumb-dashboard` → `crumb-studio`.
- **Source files**: `dashboard.{html,css,js}` → `studio.{html,css,js}`, `dashboard-html.ts` → `studio-html.ts`. Generated artifact: `dashboard-html.generated.ts` → `studio-html.generated.ts` (gitignore updated).
- **Constants**: `DASHBOARD_HTML` → `STUDIO_HTML`. Identifiers: `Dashboard*` → `Studio*` (`DashboardServer`, `DashboardServerOptions`, `DashboardMessage`, `startDashboardServer`).
- **Root scripts**: `inline-dashboard-client` → `inline-studio-client` (root `package.json` workspace forwarder).

Intentionally **NOT renamed** (external references, protected by sentinels):
- `agent-activity-dashboard` / `token-dashboard` / `diagram-dashboard` — Kiki-internal page names referenced from `wiki/concepts/bagelcode-system-architecture-v0.1.md`.
- `anthropic-managed-agents-dashboard-guide` / `claude-managed-agents-dashboard-guide` — MindStudio blog URLs in `wiki/references/bagelcode-observability-frontier-2026.md`.

Verification:
- `npm run lint && typecheck && format:check && test && build` — all green; **421/421 specs pass**.
- Live smoke: `node packages/studio/dist/cli.js --port 7321 --no-open` boots; `/api/health` returns 5 sessions; `/api/doctor` enumerates claude/codex/gemini-cli adapters as before. End-to-end browser → server → file-tail SSE flow unchanged.
- Wiki/docs grep audit: 7 remaining `dashboard` mentions are all intentional external refs.

### Changed — Wiki concepts KO → EN, batch 1 of N (PR-C-3) (2026-05-03)

Continues the KO→EN sweep. Wiki is the largest tranche (~33k KO chars across 31+ files); this PR ships the heaviest single concepts file.

Translated:
- `wiki/concepts/bagelcode-caching-strategy.md` — full file rewrite (1249 KO chars). Frontmatter title, all body sections, headings, tables, decision rationale. Technical terms (Anthropic ephemeral cache, TTL, breakpoints, KVCOMM, ACON, vCache, MDPI, APC NeurIPS 2025, Vertex AI verbatim quote, etc.) preserved verbatim. Cache supersession note (v1-v2 era CourtEval external Gemini retired) explicitly EN with the same dates and references.

Out of scope (queued for PR-C-4..N):
- `wiki/concepts/bagelcode-system-architecture-v0.1.md` (1159 KO chars)
- `wiki/concepts/bagelcode-fault-tolerance-design.md` (1101 KO chars)
- `wiki/concepts/bagelcode-system-architecture.md` (971 KO chars)
- `wiki/concepts/bagelcode-verifier-isolation-matrix.md` (960 KO chars)
- `wiki/concepts/bagelcode-rubric-scoring.md` (933 KO chars)
- `wiki/concepts/bagelcode-transcripts-schema.md` (908 KO chars)
- `wiki/concepts/bagelcode-system-architecture-v0.3.5.md` (795 KO chars)
- `wiki/concepts/bagelcode-orchestration-topology.md` (787 KO chars)
- `wiki/concepts/bagelcode-final-design-2026.md` (701 KO chars)
- `wiki/concepts/bagelcode-budget-guardrails.md` (687 KO chars)
- `wiki/concepts/bagelcode-system-diagrams-v0.3.5.md` (170 KO chars)
- `wiki/synthesis/**/*.md` (~8k KO chars / 8 files)
- `wiki/references/**/*.md` (~15k KO chars / 12 files)
- `wiki/findings/**/*.md` (~100 KO chars / 1 file)

### Changed — Skills KO → EN translation pass (PR-C-2) (2026-05-03)

Continues the KO→EN sweep started in PR-C-1 (sandwiches). This pass covers Claude Code skills + procedural workflow skills.

Translated body prose in:
- `.claude/skills/crumb/SKILL.md` — full body rewrite (~1538 KO chars). 3-layer separation, when-to-trigger, in-flight branching, How to Run §1-§6, Surface 1-4 user-intervention guide, `data` field semantics, Preset table, Actor split, Multi-host table, Swap cookbook (static / dynamic / startup / one-glance), enforcement (do NOT), References. KO triggers in frontmatter `description` + `when_to_use` + body trigger lists are retained verbatim — they activate Korean user input recognition.
- `.claude/skills/serve-game/SKILL.md` — Examples section ("열었어" → "Opened …", "그만하려면" → "to stop").
- `.claude/skills/crumb-suggest/SKILL.md` — H1 ("다음 사용자 액션 추천" → "recommend the next user action").
- `.claude/skills/crumb-doctor/SKILL.md` — H1 + "추천 preset (현재 환경 기준)" → "Recommended preset (for the current environment)".
- `.claude/skills/crumb-status/SKILL.md` — H1 ("진행 상황" → "progress").
- `.claude/skills/crumb-config/SKILL.md` — H1 + "선택은 사용자 …" → "The choice is yours …".
- `.claude/skills/crumb-debug/SKILL.md` — H1 ("F1-F7 routing 장애 진단" → "F1-F7 routing fault diagnosis").
- `.claude/skills/crumb-export/SKILL.md` — "호환" → "compatible with".
- `skills/{code-review-protocol,verification-before-completion,tdd-iron-law,subagent-spawn}.md` frontmatter `when_to_use` — all 4 KO sentences rewritten in EN.

Intentionally retained KO (trigger phrases — translating would break LLM activation on Korean user input):
- All `.claude/skills/*/SKILL.md` `description` + `when_to_use` frontmatter (Korean pitch / status / preset / debug / model / export trigger samples).
- Body trigger lists that quote user-input examples in `"..."`.

After this PR every skill body is fully EN; the only KO in skills is intentional trigger keywords. PR-C-3..N (wiki, ~33k KO chars across 31+ files) follow.

## [0.4.0] - 2026-05-03

### Changed — Version mapping v3.x → v0.x + bump to 0.4.0 (PR-Z) (2026-05-03)

User directive: "이전 버전 x0.1로 일괄 수정해서 주입 + Lint 맞춰. 이번에 업데이트하면 0.4.0으로 버전업". The repo had been calling its architecture milestones `v3.0` through `v3.5`, but `package.json` had always been `0.1.0` — a mismatch. This PR aligns every `*.md` / `*.ts` / `*.toml` / `*.json` reference to a SemVer-compliant `v0.x.y` shape and bumps the actual `package.json` to `0.4.0` to mark the release.

Mapping applied (longest-match-first sed via `perl -i -pe`):

| Old | New | Rationale |
|---|---|---|
| `v3.0` | `v0.1.0` | initial multi-host harness pivot |
| `v3.1` | `v0.1.1` | identity decomposition (CLAUDE.md / GEMINI.md split) |
| `v3.2` | `v0.2.0` | budget guardrails + autoresearch ratchet |
| `v3.3` | `v0.3.0` | researcher-as-actor + video evidence |
| `v3.4` | `v0.3.1` | multi-file PWA envelope widening |
| `v3.5` | `v0.3.5` | deterministic AC predicate runner |
| (this) | `v0.4.0` | multi-file-only + postgres §1.2 + KO→EN sandwiches + serve-game skill |
| bare `v3` | `v0.1` | major version tag → 0.x major |

Files renamed (wiki):
- `wiki/concepts/bagelcode-system-architecture-v3.md` → `bagelcode-system-architecture-v0.1.md`
- `wiki/concepts/bagelcode-system-architecture-v3.5.md` → `bagelcode-system-architecture-v0.3.5.md`
- `wiki/concepts/bagelcode-system-diagrams-v3.5.md` → `bagelcode-system-diagrams-v0.3.5.md`

All wikilinks remapped via in-place perl. 311+ inline mentions of `v3.x` across 67 files converted; 0 `\bv3\.[0-5]\b` and 0 `\bv3\b` patterns remain (verified via grep). Phaser `3.80` and Gemini `3.1` mentions are unaffected (regex used `\bv` prefix).

`package.json` + `packages/studio/package.json` `version` bumped `0.1.0` → `0.4.0`. CHANGELOG `[Unreleased]` capped with `[0.4.0] - 2026-05-03` release header.

### Changed — Sandwich KO → EN translation pass (PR-C-1) (2026-05-03)

User directive: convert all `*.md` to English. Sandwiches first because they are runtime LLM context (read on every spawn). The audit identified 8 sandwich files under `agents/` totalling ~600 KO chars — far less than expected because most prose is already EN since the v0.3.1 multi-host pivot.

Translated:
- `agents/specialists/game-design.md` §2 forbidden table — `"README대로 실행"` → `"run as the README says"`.
- `agents/specialists/concept-designer.md` — Royal Match pattern comment, anti-pattern bagelcode reference, "차용 룰" section header, gamestudio mapping see-also link.
- `agents/specialists/visual-designer.md` — gamestudio mapping see-also link.
- `agents/planner-lead.md` socratic ambiguity triggers — restructured to list KO + EN trigger groups separately (KO group preserved verbatim because it activates Korean user input recognition; EN group expanded with `"X or Y"`, `"should I..."`, `"which one"`, `"recommend"`, `"help me decide"`).

Intentionally retained KO (trigger phrases — translating would break LLM activation):
- `agents/specialists/game-design.md` §1.2 leaderboard markers: `"랭킹"` / `"점수 저장"` / `"기록"` / `"하이스코어"` (Korean pitch input → activates postgres profile).
- `agents/planner-lead.md` socratic KO triggers: `"어떤 X 로 할까"` / `"고민 중"` / `"결정해줘"` / `"추천해줘"` (Korean ambiguity in user goal → activates socratic round).
- All `.claude/skills/*/SKILL.md` `description` + `when_to_use` frontmatter (separate PR-C-2).

After this PR the sandwich body prose is fully EN; the only KO that ships into runtime context is intentional trigger keywords. PR-C-2 (skills) + PR-C-3..N (wiki) follow.

### Added — `crumb_run` + `crumb_intervene` MCP write tools + 7 Claude Code slash commands + 2 hooks (2026-05-03)

The MCP server registered 8 read-only `crumb_<verb>` tools (status / suggest / doctor / config / explain / debug / export / model). Spawning a session or intervening on one still required dropping to the CLI. Claude Code users had to context-switch between the natural-language skill and the terminal for any control-plane action. This PR adds the two write tools that close that loop, plus 7 user-facing slash commands and 2 SessionStart/Stop hooks so the host harness surfaces in-flight sessions automatically.

- **`src/mcp-write-tools.ts` (NEW, 248 lines)** — `crumb_run({ goal, preset?, label?, root? })` spawns `crumb run` as a detached subprocess, writes a `crumb.log`, returns `{ session_id, log_path, pid }`. `crumb_intervene({ session, action, body?, target_actor?, swap_to? })` writes one inbox-grammar line to `<session>/inbox.txt` (action ∈ approve / veto / pause / resume / redo / goto / append / swap / note / mention).
- **`src/mcp-server.ts`** — registers the 2 new tools; doc comment now reads "10 helpers" (was 8). `resolveCrumbCommand(repoRoot)` honors `CRUMB_BIN` env override → falls through to local `dist/index.js` → falls through to `npx tsx src/index.ts`. `buildInboxLine()` constructs the grammar line from structured args (Zod-validated).
- **`src/mcp-server.test.ts`** — adds smoke specs for both write tools (mocked subprocess + inbox.txt fixture).
- **`.claude/commands/crumb-{approve,cancel,pause,redo,resume,veto,watch}.md` (NEW)** — 7 slash commands. Each is a thin one-line invocation of the matching MCP intervene action so the user can type `/crumb-veto reason` instead of free-text mention.
- **`.claude/hooks/session-start.cjs` (NEW)** — on Claude Code start, scans `~/.crumb/projects/*/sessions/*/transcript.jsonl`, surfaces in-flight sessions in the system prompt so the next user turn can route to status / suggest BEFORE spawning a new run.
- **`.claude/hooks/stop.cjs` (NEW)** — on Claude Code stop, detects `kind=done` events that landed in the last 30s and surfaces the verdict + cost summary as the final user-visible line.
- **`.claude/settings.json` (NEW)** — host harness allowlist for the 10 MCP tools + 7 slash commands + 2 hooks. Single source of truth for what Claude Code can invoke without per-call permission prompts.
- **`.claude/skills/crumb/SKILL.md`** — `allowed-tools` frontmatter expanded with all 10 `mcp__crumb__crumb_*` tools (was `Bash Task Read Write Edit Glob Grep` only). `when_to_use` extended with mid-flight follow-up triggers ("지금 어디까지 갔어?", "이거 끝났어?", "what's the status?") that route to `crumb_status` / `crumb_suggest` instead of spawning a new run.

**Verification**: 421/421 sweep green; lint+typecheck+format clean; build inlines and CI ratchet preserved.

**Recovered from `feat/claude-code-usability` branch (2 unmerged commits, 30+ behind main) + `stash@{4}` (skill+test residue)** during the post-PR-#84 stash audit. The branch was abandoned mid-rebase when main moved on; cherry-picking onto a fresh branch from current main was the cleaner path.

### Changed — Multi-file PWA is now the only profile + `§1.2 postgres-anon-leaderboard` opt-in spec (PR-B) (2026-05-03)

User directive: **multi-file is the new default; remove single-file prompts**. Multi-file was already the v0.3.1 default in `agents/specialists/game-design.md` §1.1, but every actor sandwich and most top-level docs still carried the single-file fallback as a co-equal option. This PR retires it entirely from the prompt surface. Code paths in `src/effects/qa-check.ts` (the 60KB cap) stay backward-compat for the legacy `game.html` test fixtures and will be cleaned up in a follow-up PR-D once Playwright server changes land.

In parallel, the long-deferred postgres persistence dimension lands as `§1.2` (opt-in, never default). Researched against `~/workspace/kiki-appmaker/output/pin-57/match-3-next/` (MariaDB+Prisma+NextAuth match-3 reference — extracted schema patterns, dropped Next.js server-side route requirement) + 2025-2026 Supabase frontier (anonymous-auth GA + RLS for game leaderboards + pg_cron leaderboard MV refresh). Decision matrix scored Supabase 4/4 vs Neon 2/4 vs Cloudflare D1 0/4 for Crumb's 60s ephemeral domain — only Supabase satisfies the §1.1 static-PWA envelope (Phaser browser → SDK direct, no Node.js worker tier).

**Sandwich changes** (multi-file purge):
- `agents/specialists/game-design.md` — §1.2 single-file fallback removed; new §1.2 is the postgres profile. Preamble updated to "v0.3.1 retired the v0.1.0 single-file fallback — multi-file is the only profile."
- `agents/builder.md` — frontmatter description, position summary, contract table, steps §1, tools, Don'ts, Reminders all rewritten for multi-file-only. New "Postgres persistence profile (§1.2, opt-in)" sub-section in step §1 documents the migrations + PersistenceManager + env reads.
- `agents/builder-fallback.md` — same purge pattern; `artifacts/game/**` is now the only writable scope.
- `agents/verifier.md` — `artifacts/game.html` references → `artifacts/game/index.html` + walk `src/`. D1 instructions updated. Length-bias firewall context source list rewritten.
- `agents/planner-lead.md` — §1 envelope reference + Don'ts list.
- `agents/specialists/visual-designer.md` — envelope description + reference list.

**§1.2 postgres-anon-leaderboard sub-section** (new, opt-in):
- **Trigger**: pitch contains `"leaderboard"` / `"랭킹"` / `"ranking"` / `"점수 저장"` / `"hi-score"` markers, or `--persistence postgres` flag, or `actors.builder.profile = "multi-file+postgres"` preset binding.
- **Backend contract**: Supabase Postgres + `auth.signInAnonymously()` (GA 2024-Q3) + Row-Level Security. The only profile satisfying §1.1 (static Phaser → browser-direct SDK call, no worker tier).
- **Required env**: `CRUMB_PG_URL` (verifier-only) / `CRUMB_SUPABASE_URL` / `CRUMB_SUPABASE_ANON_KEY` (browser-safe; service_role NEVER ships). All `$CRUMB_HOME`-resolved — zero hardcoded paths.
- **Required schema**: `players` (PK = `auth.uid()`, RLS self-write), `runs` (append-only — INSERT WITH CHECK self, no UPDATE/DELETE), `leaderboard_top100` materialized view + `pg_cron` 60s refresh.
- **Client surface**: `@supabase/supabase-js` ESM CDN, `signInAnonymously()` in BootScene, `runs.insert(...)` in GameOverScene, `leaderboard_top100.select(...)` in MenuScene.
- **Verifier D2 ground truth**: `qa_check` extension verifies (a) migration applies on throwaway docker pg, (b) anon insert succeeds, (c) cross-player insert blocked by RLS, (d) leaderboard MV returns ordered rows after refresh. Any failure → D2=0 enforced by `validator/anti-deception.ts`.
- **Forbidden**: service_role in client bundle, direct `postgres://` from browser, score UPDATE/DELETE (append-only invariant mirrors transcript), hardcoded paths or DB URLs.

**Top-level doc sweep**:
- `README.md` artifacts tree shows the multi-file directory shape (game/index.html + src/ + sw.js + manifest + optional migrations/).
- `AGENTS.md` actor table description + game-design contract pointer updated.
- `GEMINI.md` verifier-as-Gemini rationale references `artifacts/game/`.

**Out of scope (queued)**:
- `src/effects/qa-check.ts` `MAX_OWN_CODE_BYTES = 60_000` removal — single-file test fixtures still pin it green; needs Playwright multi-file http-server bringup before flip.
- `src/effects/qa-check-playwright.ts` server start-up for `artifacts/game/` (currently file:// for legacy `game.html`).
- `src/dispatcher/qa-runner.ts` D2 persistence sub-check (throwaway docker pg) — opt-in, gated by `CRUMB_PG_URL` presence.
- README.ko.md mirror (intentional KO translation; its multi-file/postgres update lands with the broader KO-translation track).

### Added — `CRUMB_PER_SPAWN_TIMEOUT_MS` / `CRUMB_PER_SPAWN_IDLE_MS` / `CRUMB_WALL_CLOCK_HOOK_MS` / `CRUMB_WALL_CLOCK_HARD_MS` env knobs (2026-05-03)

Per-spawn wall-clock + idle timeouts and session wall-clock budget were hard-coded constants. Tests, CI smoke runs, and long debugging sessions had to either monkey-patch the dispatcher or wait the full 15-minute ceiling. All four are now env-overridable while keeping the same defaults.

- `src/dispatcher/live.ts` — `PER_SPAWN_TIMEOUT_MS` (15min default) + `PER_SPAWN_IDLE_TIMEOUT_MS` (90s default) read `CRUMB_PER_SPAWN_TIMEOUT_MS` / `CRUMB_PER_SPAWN_IDLE_MS`.
- `src/loop/coordinator.ts` — `WALL_CLOCK_HOOK_MS_DEFAULT` (24min) + `WALL_CLOCK_HARD_MS_DEFAULT` (30min) read `CRUMB_WALL_CLOCK_HOOK_MS` / `CRUMB_WALL_CLOCK_HARD_MS`.
- `src/reducer/index.ts` — minor, env-knob touch only on existing per-event budget thresholds.
- Defaults preserved when env vars are unset/invalid (`Number(undefined) || default`).
- Tests already pass `perSpawnTimeoutMs` / `perSpawnIdleTimeoutMs` per `DispatcherDeps` so no test changes needed; sweep 421/421 green.

### Added — Studio bootstrap state classifier + adapter status sidebar + new-session preset chips (2026-05-03)

Studio had two startup gaps and one UX gap. (1) On boot it surfaced every transcript with no liveness signal — the user couldn't tell at a glance which sessions were running, idle, or abandoned. (2) Adapter availability (Claude Code installed? Codex authenticated? Gemini CLI on PATH?) was invisible in the UI; users only learned via failed spawn attempts. (3) Session creation offered a flat preset dropdown with no signal of which presets were even runnable on the current machine. User feedback: "지금 대시보드 시작할 때 현재 열린 세션들 연결하도록 하는 헬스체크 혹은 부트스트랩 넣으려면 어떻게 해? ... [claude code] [Opus 4.7] 이런식으로 현재 지원하는 옵션들을 드러내게 해. 활성=초록 원, 비활성=회색."

**Bootstrap state classifier** (`packages/studio/src/bootstrap.ts`)

- Pure-function `classifyFromMtime(mtime, history, now)` + thin `classifySessionState(path, history)` wrapper that pays a single `stat` syscall. Pattern lifted from VS Code's workspaceStorage (mtime + meta scan, no daemon) + Kubernetes init-container vs liveness-probe split.
- States: `live` (mtime < 10s), `idle` (< 5min), `interrupted` (< 1d), `abandoned` (≥ 1d), `terminal` (any `kind=done` event present, regardless of mtime). `done_reason` extracted from `done.data.reason` or `done.body` for the sidebar tooltip.
- 9 unit tests (`bootstrap.test.ts`): each state boundary + clock-skew (future mtime) + empty history + done.body fallback + last_event_kind/actor preservation.

**Adapter probe** (`packages/studio/src/doctor.ts`)

- Lightweight standalone version of `crumb doctor` — no cross-package import. PATH lookup via `which <bin>` + best-effort `--version` (1.5s timeout, SIGKILL on timeout). 5 adapters catalogued: `claude-local`, `codex-local`, `gemini-cli-local`, `gemini-sdk` (env-var keyed), `mock` (always available).
- Auth state semantics: `true` = confirmed (SDK env-var or mock), `null` = installed but not probed (binary present; auth probe would risk surfacing login prompts), `false` = binary missing. UI maps `null` → "installed" amber pill, leaves "auth ✓" for confirmed cases.
- 5 unit tests (`doctor.test.ts`): mock always-on, full catalogue, gemini-sdk env-var toggle, install/auth hint presence, missing-binary→authenticated=false invariant.

**New HTTP endpoints** (`packages/studio/src/server.ts`)

- `GET /api/health` — bootstrap summary: `{ ok, watcher_paths_tracked, sessions: { total, by_state: {...} } }`. Lifts the K8s readiness probe pattern: separates one-shot startup data from the periodic `/api/sessions` polling.
- `GET /api/doctor` — adapter probe matrix.
- `GET /api/sessions` extended — each session now carries `state`, `last_activity_at`, `done_reason` fields. Server-side sort by `last_activity_at` DESC turns the sidebar into a recently-active feed without client-side resort.
- `SessionWatcher.classifiedSnapshot()` — async snapshot variant that runs the classifier per session. Sync `snapshot()` kept for SSE replay where the extra stat would multiply latency.

**UI** (`packages/studio/src/client/studio.{html,css,js}`)

- **Sidebar Adapter Status section** (above Sessions) — one row per adapter with state-aware dot: lime (●) for active, amber for `installed-but-auth-unknown`, gray (○) for missing. `version` (or first model) shown in monospace meta line. Pill text: `auth ✓` / `installed` / `missing`. `↻` button re-probes.
- **Per-session sidebar dots** state-classed: `state-live` (lime + glow), `state-idle` (amber), `state-interrupted` (audit-fg pink + ⏸ suffix), `state-abandoned` (gray, 0.55 opacity), `state-terminal` (ink-subtle, 0.78 opacity). Hover surfaces full state + `done_reason`.
- **New session form preset chips** (`PRESETS` table with `requires: ['adapter-id', ...]`) — chip is `disabled` (line-through, low opacity) when any required adapter is missing/unauth.
- **Advanced binding grid** (`<details>`) — per-actor harness × model dropdown for ad-hoc bindings (planner-lead / researcher / builder / verifier).
- **Adapter setup modal** — install_hint + auth_hint code blocks + `Re-check status` button.

**Verification**: 14 new unit tests (9 bootstrap + 5 doctor) on top of 398 → 412/412 sweep green; live API smoke confirmed all 3 endpoints + state field on `/api/sessions`.

### Changed — Studio DAG re-grounded against `src/reducer/index.ts` (Phase zones + 6 typed edges + done terminal) (2026-05-03)

The Pipeline DAG drew a `verifier → coordinator → builder-fallback` arc through a coordinator routing node, plus a `verifier → validator` edge, neither of which exist in the actual reducer. User feedback: "지금 이 DAG 모양은 실제 절차에 맞는거야? 코드베이스로 그라운딩하고 좀 디벨롭할 사안 찾을 순 없나?" — every edge is now grounded against a specific `src/reducer/index.ts` line.

- **Removed gaslit edges**:
  - `verifier → coordinator → builder-fallback`: coordinator is host-inline (Hub-Ledger-Spoke per `wiki/concepts/bagelcode-orchestration-topology.md`); the reducer spawns builder-fallback **directly** when `judge.score` is FAIL+breaker_OPEN (line 300). No coordinator intermediation.
  - `verifier → validator` as a routing edge: validator emits `kind=audit` only when anti-deception violations fire (reducer line 226). It's a **conditional side-effect**, not a routing handoff — now drawn as a dotted pink edge, marked off-graph at the bottom-right.
- **Added missing edges** — `verifier → planner-lead` (FAIL+breaker_CLOSED rollback, line 309); `verifier → done` (PASS terminal, line 288); `user → {planner, builder, verifier}` direct intervene (`user.veto` line 322 + `user.intervene(goto=X)` line 396).
- **`done` terminal node** at (770, 100) — fills lime + glow when any `kind=done` event arrives.
- **6 edge type vocabulary** (palette aligned with `skills/mermaid-diagrams/SKILL.md`): `handoff` indigo solid (8 edges), `rollback` amber dashed (curves up), `fallback` red dashed (curves down), `terminal` green solid, `audit` pink dotted, `intervene` gray dotted.
- **Phase A·B / C / D background zones** drawn as translucent SVG rects.
- **`WEAVE_TARGET` map expanded** — `step.research → planner-lead` resume (line 546). New `weaveTargetForVerdict()` branches by verdict (PASS→done, FAIL+(builder-error≥3)→fallback, FAIL→planner). `edgePath()` curves rollback up-over and fallback down-under.
- SVG viewBox widened 720×180 → 820×215.

### Added — `serve-game` skill: open Crumb games with auto single/multi-file detection (2026-05-03)

User feedback: opening a multi-file Crumb-generated `index.html` directly with `open <path>` (file://) shows "Loading…" forever — `<script type="module">` imports and `serviceWorker.register()` are both blocked under the `file://` protocol. Single-file games (`game.html` with inline `<script>`) work with `file://` fine. Whichever shape applies should be auto-detected, not memorized.

- **`.claude/skills/serve-game/SKILL.md`** (NEW) — slash-skill that:
  1. Locates the game artifact by searching `~/.crumb/projects/*/sessions/*/artifacts/{game.html,*/index.html}` and `versions/*/artifacts/...`, sorted by mtime desc.
  2. Disambiguates by the user's pitch keyword (`고양이`, `cat`, `match-3`, etc.) when given — greps `spec.md` siblings + `<title>` so the right session opens.
  3. Detects shape — `<script type="module">` or `navigator.serviceWorker` present → multi-file → http server. Otherwise single-file → `file://` direct.
  4. For multi-file: `python3 -m http.server <port>` backgrounded in a subshell (never blocks the conversation), port auto-bumps from 8765 if occupied, log to `/tmp/crumb-serve-<port>.log`.
  5. Reports the picked session (so user can correct), the URL or path, and the stop command (`pkill -f 'http.server <port>'`).
  6. Stop sub-procedure: `lsof -nP -iTCP -sTCP:LISTEN | grep python3` to enumerate, `pkill -f 'http.server <port>'` to kill.
- **Triggers** (KO + EN): "이전 게임 열어줘", "고양이 퍼즐 열어줘", "전에 만든 거 열어줘", "그 게임 다시 보자", "demo 열어줘", "open the cat puzzle", "open the previous game", "serve the multi-file game", "show me what we built". Slash form `/serve-game [<keyword>]`.
- **Honors `$CRUMB_HOME`** — falls through to `~/.crumb` only when unset, matching the rest of the codebase's path convention.
- **Don'ts documented**: never open multi-file with `file://`, never run http server in the foreground (blocks the conversation), never skip pitch-keyword disambiguation when supplied, never hardcode `~/.crumb`.

This codifies the diagnose-and-fix sequence that arose when the user reported "고양이 퍼즐이 지금 로딩중으로 나와" — the multi-file game's ES modules silently failed under `file://`. With the skill, future "이전 게임 열어줘" requests will short-circuit to the right protocol automatically.

### Added — Studio IDE-style grep highlight + ↑↓ nav across Logs / Transcript / Live feed (2026-05-03)

The studio's text panels supported a substring filter that highlighted whole matching lines in faint blue (logs only), filtered entries (transcript), or had no search at all (live execution feed). User feedback: "grep 했을 때 해당되는 패턴 주황색으로 표시하고 위아래로 조작 가능(IDE처럼)하게 세팅이 아직 안되었거든." — they wanted the inline-substring orange highlight + IDE-style match navigation present in every modern editor.

- **`mark.grep-hit` substring highlight** in `studio.css` — translucent 32% orange normal state, full `--accent-grep` (#ff9f1c) with deeper `--accent-grep-active` (#ff5e00) border on the current match. New tokens `--accent-grep` + `--accent-grep-active` are visually distinct from `--warn` peach and `--accent-warm` gold (already taken by stream-json `⏺/✓`).
- **Shared `.grep-controls`** — `count / total` (e.g. `3 / 17`, orange when hits > 0, dim when no query) + `↑ ↓` nav buttons, disabled when no matches.
- **Per-panel grep state** in `studio.js` — `grepState = { logs, transcript, feed }` with `query` + `cursor` preserved across re-renders (streaming content doesn't reset nav position).
- **Helpers**: `highlightHTML(text, query)` (HTML-escapes then wraps case-insensitive substring matches with `<mark>`, regex meta chars escaped via `escapeRegExp`), `refreshGrepNav()` (re-collects `mark.grep-hit` after each render, syncs counter + active class), `gotoGrepMatch(panel, dir)` (mod-N cursor advance + `scrollIntoView({block:'center'})`), `bindGrepInput()` (input event → `onChange`; Enter = next, Shift+Enter = prev, Esc = clear+blur).
- **Logs panel**: substring `<mark>` replaces the old whole-line `.match` blue background. Matching lines now also get a faint orange `.has-match` row tint for at-a-glance scanning.
- **Transcript panel**: render switched from `textContent` to `innerHTML` (still inside `<pre>` so whitespace preserved) so the pretty-printed JSON layout keeps formatting while inline matches are markable. Entry-level filtering (only matching events shown) is preserved on top of substring highlight.
- **Live execution feed**: new search input added to the toolbar (was pause/clear only). Each `appendFeedLine` records the raw text on `bodySpan.dataset.raw` so `rehighlightFeed()` can rebuild highlight on query change without reparsing the stream-json again.
- **Tests** — `escapeRegExp` + `highlightHTML` verified via 6 unit cases (case-insensitive multi-match, HTML escape `<div>`, regex meta `.*+?` literal match, empty query, single-space query). Full sweep 342/342 green.
- Verified server-side: served HTML contains all 43 grep identifiers; build artifact bumped 95781 → 103212 bytes.

### Added — Studio live exec feed: Claude-Code-style stream-json narrative (2026-05-03)

The per-session live execution feed (above the chat input) was dumping spawn-log stream-json as raw text. User feedback: "이건 세션 내 채팅 입력창 위에 붙어있어야 해" — the user wants the same `⏺` / `⎿` / `✓` narrative bubbles they see inside Claude Code, faithfully mirrored in the studio so they can watch what the agent is doing without context-switching to the terminal.

- **`renderStreamJsonLine()` parser** in `studio.js` — turns each spawn-log line (Claude CLI stream-json shape: `{type: 'assistant'|'user'|'system'|'result', ...}`) into one or more rendered bubbles:
  - `type=assistant` content blocks → `⏺ <text>` (assistant text), `⏺ ToolName(summary)` (tool_use), `· (thinking)` (extended thinking)
  - `type=user` tool_result → `⎿ <preview>` (collapsed) with `is_error` upgrading to `tool-error` style
  - `type=system subtype=task_started|task_notification` → `⎿ Async <desc> started|completed|killed`
  - `type=system subtype=hook_started|hook_response` → `· hook <name> <outcome>`
  - `type=system subtype=init` → `· init session <id-tail> (model=…, tools=N, skills=N)`
  - `type=result` → `✓ turn complete · <out> out · $<cost> · <dur> · cache <N>`
  - `type=rate_limit_event` → silent (noise)
- **Tool-call summarizers** — domain-specific input summary per tool: `Bash` shows the command first 90 chars, `Read/Write/Edit` shows file_path, `Grep/Glob` shows pattern (+ optional path), `Task/Agent` shows description + subagent_type, `TodoWrite` shows the in-progress todo or count, `WebSearch/WebFetch` shows query/url. Generic JSON-truncated fallback for unknown tools.
- **Tool-result summarizer** — flattens array/object content to a single line, collapses whitespace, truncates to 180 chars (240 for errors so context isn't lost on failures).
- **CSS for the new kindClasses** in `studio.css`:
  - `kind-assistant-text` — full ink color, weight 500, white-space: pre-wrap (assistant text often spans multiple paragraphs)
  - `kind-tool-call` — accent-warm color, monospace, slight transparency (so it visually stands as "agent action")
  - `kind-tool-result` — muted ink, 16 px left padding, smaller font (78% opacity, indented under its call)
  - `kind-tool-error` — audit-fg color, weight 500, indented (errors stand out in red)
  - `kind-turn-complete` — accent-warm bold + dashed top border (visual anchor between turns)
  - `kind-thinking` — tertiary color, 55% opacity, italic (deemphasized — usually just signature payloads)
- **`FEED_MAX_LINES` bumped 800 → 2000** because stream-json rendering produces 3-5× line density vs raw transcript events. With 2000 lines × ~40 chars/line the DOM stays under ~80 KB which is well within smooth-scroll budget.
- **Pre-check optimization** — `renderStreamJsonLine` returns null fast for non-JSON lines (charCode 123 check) so the chunk handler falls through to raw rendering without paying JSON.parse cost on plain log output.

The same convention now powers both the Claude Code terminal view and the studio exec feed — when the agent is running, the user can watch the same `⏺ Bash(npm test)` / `⎿ 342 passed` / `✓ turn complete · 4280 out · $0.42 · 18s` narrative whether they look at the terminal or the browser. No code changes outside `packages/studio/src/client/`. 342/342 tests passing, lint clean, build clean.

### Added — Studio hardening: resizable panes / click-outside / Resume / Transcript viewer / coordinator visibility (2026-05-03)

Six interactive-quality fixes to `packages/studio/`:

- **Resizable session + detail panes.** Both side panes now have draggable split bars (Mac/Windows-feel `col-resize` cursor). Width is persisted in `localStorage` (`crumb.sessions-w` / `crumb.detail-w`) so a refresh keeps the user's layout. Bounds clamped (sessions 160–560 px, detail 280–800 px). The grid-template uses CSS variables (`--sessions-w`, `--detail-w`) and the body grid gains a 4 px handle column. Touch (passive: false on `touchmove`) and mouse both wired.
- **Click-outside-to-close detail pane.** Right-side detail aside dismisses on any `mousedown` outside its bounds, with two opt-outs: clicks on `[data-evt-id]` swimlane rows (which re-open detail with a new event) and clicks on the pane's own resize handle.
- **Resume button.** New CTA in the view-tabs row. Surfaces only when the last actor event was an `error` or a timeout-tagged `agent.stop` (regex `timed out|exit=[1-9]`) and no healthy follow-up event landed since. On click, posts `/redo @<actor> resume after timeout/error` to the inbox endpoint — the existing inbox parser turns that into a `kind=user.intervene data.action="redo" target_actor=<actor>` event, which the reducer routes back into the dispatcher's normal spawn loop.
- **Transcript viewer tab.** New `Transcript` tab next to Pipeline / Logs / Output. Pretty-printed JSONL with substring filter, copy-all button, live event count. Re-renders on `append` SSE events while the tab is active.
- **Coordinator visibility (root-cause + fix).** The user reported the coordinator pane appears silent during normal routing. Investigation: `src/dispatcher/live.ts` only emits `from=coordinator` events on `rollback` / `stop` / `done` effects (lines 320 / 332 / 341 / 347) — by design, since the coordinator is host-inline (v0.1 invariant 9, depth=1) and doesn't run as a subprocess that emits `agent.wake` / `agent.stop`. Routing decisions surface as `from=system kind=note body="dispatch.spawn → ..."`. The studio fix attributes those system spawn-notes to the coordinator lane in the live execution feed (`→ route: spawn(<actor>) via <adapter> [host-inline routing]`), so the lane no longer reads as silent. The underlying invariant is preserved.
- **Resume button + transcript viewer wired into the existing SSE handlers** so they self-update on every appended event.

Test plan: lint clean (0 errors, 26 informational sonarjs warnings), typecheck clean, format clean, **342/342 tests passing**, build inlined the new client (78991 bytes) into `studio-html.generated.ts`. No code changes outside `packages/studio/src/client/{studio.html, studio.css, studio.js}`. The studio pretest hook re-inlines automatically; CI ratchet preserved.

### Added — `package.json` `files` allowlist for `npm i -g` distribution (PR-1) (2026-05-03)

Closes the critical install blocker identified in the package-manager audit (`wiki/synthesis/bagelcode-scoring-ratchet-frontier-2026-05-02.md` adjacent — install/update/uninstall track). Without this, `npm i -g crumb` would have shipped only `dist/` (npm's default) and `protocol/schemas/message.schema.json` would be missing → first transcript validation throws ENOENT → every session crashes.

- **`package.json`** new `files` allowlist: `dist`, `protocol/schemas/**/*.json`, `agents/**/*.md`, `skills/**/*.{md,py}`, `skills/**/LICENSE.txt`, `.crumb/presets/*.toml`, top-level docs (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `CHANGELOG.md`, `README.md`, `README.ko.md`, `LICENSE`). Negation entries strip out `__pycache__/`, `*.pyc`, `*.test.{ts,js,d.ts}`, `*.spec.{ts,js}`, `*.tsbuildinfo` so the published tarball doesn't carry test artifacts (tsc currently emits them into `dist/`; cleaning the `tsconfig.json` `include` is a separate cleanup).
- **`src/protocol/validate.test.ts`** (NEW) — 3 regression specs that fail loudly if any future PR drops a critical asset from the allowlist:
  - schema file is reachable from repo root (the path `protocol/validate.ts:13` resolves at runtime)
  - `npm pack --dry-run --json` includes schema, all 6 actor sandwiches, presets, AGENTS/CLAUDE/GEMINI/LICENSE, plus at least one `dist/` entry
  - same dry-run excludes `__pycache__/`, `*.pyc`, `*.test.{ts,js,d.ts}`, `*.spec.{ts,js}` (test-artifact leakage was the second-largest source of unpacked-size waste in the pre-allowlist tarball)
- **`npm pack --dry-run`** drops from 261 files (∞ test leakage) → 176 files / 316 kB. `dist/` + asset directories all confirmed present.

This is **PR-1 of 5** in the install/update/uninstall track. Next:
- **PR-2** — `env-paths` + `conf` integration (XDG override allowed, default `~/.crumb`)
- **PR-3** — `crumb init` (idempotent multi-host registration via SHA-256 compare)
- **PR-4** — `crumb update` (sandwich/preset cache refresh, config preserved)
- **PR-5** — `crumb uninstall` (host registration removed, `--purge` for user data)

### Added — Studio multi-home support (`--home <path>` repeatable + `CRUMB_HOMES` env) (2026-05-02)

The studio could only watch a single Crumb home (default `~/.crumb`), so test sessions under `/tmp/crumb-test-home/` and production sessions under `~/.crumb/` couldn't appear together. Now one studio instance aggregates from any number of homes.

- **`packages/studio/src/paths.ts`** — `getCrumbHomes()` reads `CRUMB_HOMES` (path-list separated, dedupes preserving order) → falls through to `CRUMB_HOME` → falls through to `$HOME/.crumb`. New `defaultTranscriptGlobs(): string[]` mirrors the single-home `defaultTranscriptGlob()` for chokidar's array-of-globs API. `crumbHomeFromPath(path)` is now pure path-string extraction (`lastIndexOf('/projects/')`) — no env lookup, so it works regardless of how the watcher was configured.
- **`packages/studio/src/watcher.ts`** — `WatcherOptions.globs?: string[]` joins legacy `glob?: string`. Watcher precedence: explicit `globs` array → legacy single `glob` → multi-home default. Snapshot entries now include `crumb_home` so the API consumer can disambiguate cross-home project-id collisions.
- **`packages/studio/src/cli.ts`** — `--home <path>` flag, repeatable. CLI passes through to `globs`. Help banner updated with examples; resolution order documented (`--home` > `CRUMB_HOMES` > `CRUMB_HOME` > default).
- **`packages/studio/src/server.ts`** — `DashboardServerOptions.globs?: string[]` plumbed through. `/api/sessions` response includes `crumb_home` per session.
- **Tests**: 27/27 studio specs pass (no test additions; existing watcher specs cover both single-glob and array-glob paths via chokidar's union behavior).
- Verified end-to-end: `crumb-studio --home ~/.crumb --home /tmp/crumb-real-home` returns 2 sessions with distinct `crumb_home` fields ("고양이 퍼즐 게임" 13 events from `~/.crumb`; "30초 색깔 매칭 게임" 32 events from `/tmp/crumb-real-home`).

### Fixed — Real subprocess RCA cluster: researcher EISDIR + chain drain + repo auto-detect (v0.3.1) (2026-05-02)

Five issues from end-to-end smoke testing v0.3.1 researcher refactor with `--preset solo` real Claude subprocess. Each fix landed against a specific stack-trace or transcript observability finding.

- **`src/dispatcher/live.ts`** — researcher missing from `ACTOR_TO_SANDWICH`. Without an entry, `baseSandwichPath` fell back to `''` → `resolve(repoRoot, '')` = repoRoot (a directory) → `readFile` EISDIR. Stack from session 01KQMGNW: `assembleSandwich → readFileHandle EISDIR`. Added `researcher: 'agents/researcher.md'`.
- **`src/dispatcher/live.ts`** — `PER_SPAWN_TIMEOUT_MS` bumped 5min → 10min. Claude wake alone takes ~3:30 for the 15KB sandwich (researcher.md + injected `_event-protocol.md` + skills); 5min was too tight to clear Phase A's 4 steps.
- **`src/cli.ts`** — new `--per-spawn-timeout <ms>` flag plumbed to `runSession({ perSpawnTimeoutMs })`.
- **`src/cli.ts`** — `inferRepoRoot()` auto-detects repo from `import.meta.url` (walks up from `dist/cli.js` looking for `AGENTS.md` + `agents/`). After `npm link` / `npm i -g`, `crumb run` works from any cwd without `--root`. Resolution order: `--root` → `CRUMB_REPO_ROOT` env → `inferRepoRoot()` → `process.cwd()`.
- **`src/loop/coordinator.ts`** — chain drain race fix. Watchdog's `processing.finally(() => finish())` attached to a *snapshot* of the chain; subsequent extensions during a long-running spawn (planner 7min) didn't extend it. `finish()` fired right after planner returned, queued `handoff.requested(researcher) → dispatch(spawn researcher)` never ran. Observed: session 01KQMFWA ended at agent.stop+7ms, state.done=false, 0 researcher events. Fix: `pendingItems` counter (++ in `onMessage`, -- in handler `finally`). Watchdog only fires `finish` when idle AND `pendingItems === 0`.
- **`src/index.ts`** — fatal handler prints `err.stack` (was just `err.message`).
- **`README.md`** — quickstart simplified. After one-time `npm install && npm run build && npm link`, `crumb` works from any cwd. Removed `npx tsx src/index.ts ...` form. Added full submission flow (`init --pin → run --preset solo → release → copy-artifacts`) as §C example.

### Added — Schema ↔ TypeScript parity test + Karpathy abstraction rule (2026-05-02)

Closes the last item from PR-A's audit punch list (`wiki/references/bagelcode-nl-intervention-12-systems-2026-05-02.md` §10 P0): drift risk between `protocol/schemas/message.schema.json` (the JSON Schema source-of-truth for ajv runtime validation) and `src/protocol/types.ts` (the TypeScript Kind union). Both are hand-maintained twins; without an enforced check, a new `kind` could land in one without the other.

- **`src/protocol/parity.test.ts`** (NEW, +2 specs) — three layers of protection:
  - `satisfies readonly Kind[]` ensures every entry in the test's runtime mirror is a valid `Kind` (compile error otherwise).
  - `Exclude<Kind, (typeof TS_KINDS)[number]> extends never` ensures every `Kind` is in the mirror (compile error otherwise).
  - Runtime `expect(SCHEMA_KINDS).toEqual(TS_KINDS)` ensures the schema enum and the TS mirror are equal sets.

  If a future PR adds a new kind to one of the three sources without updating the others, exactly one of these three checks fires. Suite: 321/321 (was 319 + 2).

- **`CLAUDE.md` "No new abstraction unless 2+ call sites exist"** — encodes Karpathy's 2026-01 pitfall #2 ("LLMs really like to bloat abstractions and APIs") as a project-level coding standard, with citation to SWE-Bench Pro (arXiv 2509.16941) showing files-touched scales 11× from Easy → Hard task difficulty. Each speculative helper is a permanent tax on coordinated changes. The rule cites the reducer single-file design and the `_shared.ts` 3-way adapter dedup as examples of the right cut: real fan-in (3 callers, same lifecycle), not lexical similarity.

Note on the audit's "P0 effort tuning asymmetry" (gemini-local missing `req.effort`): re-read of `src/adapters/types.ts:18-35` showed this is **intentional and already documented** — gemini-cli's `-p` flag does not expose thinking budget (API-only via `thinking_config`), same as `claude -p` and extended thinking budget_tokens. The field is informational on those adapters until SDK adapters land. Not a gap; the documentation does the work the audit wanted a code change to do.

### Added — G-C length bias firewall (verifier-only D1/D5 scope, 2026-05-02)

Implements **G-C** of the scoring+ratchet frontier survey (`wiki/synthesis/bagelcode-scoring-ratchet-frontier-2026-05-02.md` §6) — the last open frontier gap. With G-A/B/D/E already defended, **all 5 frontier failure modes from the survey are now closed**.

Confirmed length bias persists in 2025-2026 frontier judges (NOT just a 2024 artifact):
- **Krumdick et al., EMNLP 2025 Judge-Bench** — direct measurement: Sonnet 4 **+1.6%**, GPT-5 / Gemini 2.5 Pro **+2.1-3.4%** inflated win-rate per length-extended response at content-equal. Opus 4 lowest but non-zero.
- **RewardBench v2 §Focus** (Lambert AI2 2025, arXiv:2506.01937) — length-controlled split shows 5-12 pt drop in SOTA reward models; "length bias as dominant failure mode" persists.
- **Skywork-Reward-V2** (arXiv:2507.01352, 2025) — even with length-debiasing term, residual ~3% per 100 tokens.
- **Arena-Hard v2** (LMSYS 2025) — Style Control (length + markdown covariate regression) is now **default** — community confirms persistence.
- **Anthropic 2026 Hybrid Normalization** (dev docs Q1) — prompt-only mitigation reaches ~50% reduction; "complete elimination is not achieved by prompting alone".

Frontier scope guidance (**Rubric-Anchored Judging**, Hashimoto & Liang group, NeurIPS 2025): length bias **concentrates in qualitative dimensions** (creativity, design quality) and is **negligible in deterministic dimensions** (correctness, exec result). For Crumb that maps to D1 spec_fit + D5 quality (verifier LLM judge) vs D2/D6 (`qa-check-effect` ground truth, immune). Hence the firewall scope is verifier spawns only, not blanket.

Changes:
- **`src/dispatcher/live.ts`** — new `buildLengthContextAppends(sessionDir)` reads `sessions/<id>/artifacts/{spec.md, DESIGN.md, tuning.json, game.html}` byte sizes, computes ~tokens via 4-byte heuristic, returns a single `sandwich_append` carrying the calibration anchor + frontier-cited reminder. Spawn case calls it conditionally (`effect.actor === 'verifier'`); the appends are prepended to `effect.sandwich_appends` so user-supplied G4 notes still win on the override pipeline. Builder/planner/researcher spawns: zero behavior change.
- **`agents/verifier.md`** — new "Length bias firewall (G-C — 2025-2026 frontier)" reminder citing Krumdick EMNLP 2025 + RewardBench v2 + Rubric-Anchored NeurIPS 2025 + Anthropic 2026 Hybrid Norm. Tells the LLM to read the dispatcher-injected length context as a calibration anchor, not as evidence — D1/D5 should score on AC compliance and design intent, not prose volume.
- **`src/dispatcher/live.test.ts`** — +5 specs: verifier-with-artifacts injects context + reminder + source_id, builder-with-artifacts gets no injection, verifier-without-artifacts is graceful no-op, partial artifact set reports only present files with byte/token counts, length context is prepended (user `sandwich_appends` win on override). Suite total **324/324** (was 319 + 5).
- **`wiki/synthesis/bagelcode-scoring-ratchet-frontier-2026-05-02.md`** — G-C status flipped to "Defended"; all 5 frontier gaps now closed.

### Refactored — Adapter 3-way dedup: extract `_shared.ts` lifecycle helpers (2026-05-02)

`src/adapters/{claude,codex,gemini}-local.ts` were 95% structurally identical: same health-check spawn pattern, same env construction, same AbortSignal wiring, same default-prompt string. jscpd had flagged 414 duplicated lines / 2.92% across the three files. PR-A audit (`wiki/references/bagelcode-nl-intervention-12-systems-2026-05-02.md` §10 punch list P1) called this out.

- **`src/adapters/_shared.ts`** (NEW) — 4 helpers + 1 constant: `DEFAULT_SPAWN_PROMPT` (the action-oriented kickoff string previously duplicated 3×), `resolvePrompt(req)` (req.prompt or fallback), `buildAdapterEnv(req)` (CRUMB_TRANSCRIPT_PATH / SESSION_ID / SESSION_DIR / ACTOR layered on parent env), `attachAbortHandler(child, signal)` (returns cleanup callback to avoid signal-listener leaks across long sessions), `checkAdapterHealth(cmd)` (spawn `<cmd> --version`, resolve {ok, reason}).
- **`claude-local.ts` / `codex-local.ts` / `gemini-local.ts`** — slimmed by replacing local copies with imports from `_shared.ts`. claude-local 110→81, gemini-local 118→90, codex-local 132→117 lines (`buildCodexArgs` retained as adapter-local since it has CLI-specific flag knowledge).
- **`src/test-helpers/fixtures.ts`** (NEW) — extracted near-identical `fixed()` factories from `src/reducer/index.test.ts` and `src/state/scorer.test.ts`. Centralized as `fixedMessage(overrides, defaultKind)`; per-test-suite the local `fixed = (o) => fixedMessage(o, 'goal' | 'note')` wrapper preserves prior call-site ergonomics.

Frontier rationale: SWE-Bench Pro (arXiv 2509.16941) shows files-touched scales 11× from Easy → Hard task difficulty. A coordinated change to the spawn lifecycle (e.g., adding `req.effort` to gemini-local) previously required editing 3 files in lockstep — exactly the fan-out cost the paper flagged. Consolidating to one shared module + 3 thin adapters collapses that cost to a single file. Also unblocks PR C's gemini-local effort wiring (P0 from the audit) — that change now touches 1 file instead of 3.

Suite: 319/319 (no regressions). Adapter classes preserve their existing `Adapter` interface contract — every external consumer (dispatcher / preset-loader / tests) sees the same surface.

### Added — Lint pipeline strengthening: knip + dependency-cruiser + sonarjs (2026-05-02)

Three OSS tools added to the verify gate, each backed by 2026 frontier evidence on what specifically makes a TypeScript codebase easier or harder for long-context coding LLMs to navigate. Synthesis page: `wiki/references/bagelcode-nl-intervention-12-systems-2026-05-02.md`'s sister architectural recommendations (PR-A audit follow-up).

- **knip** (dead code + unused exports + unlisted deps) — `.knip.json` workspace-aware config, `npm run lint:knip` script, new `Knip (dead code)` CI job. Rationale: ICST 2026 (arXiv 2504.04372, 750K fault-localization tasks × 9 LLMs) found dead-code injection drops debugging accuracy to **18.5%** — worse than misleading variable names alone (28.7%). LLMs can't tell unused functions are unused; they spend attention on them.
- **dependency-cruiser** (architecture invariants) — `.dependency-cruiser.cjs` encoding 4 forbidden rules: `no-circular`, `reducer-purity`, `state-purity`, `protocol-types-purity`. New `Dep-cruiser` CI job. Rationale: MSR '26 *Beyond the Prompt* (arXiv 2512.18925, 401 OSS repos) showed statically-typed projects with strong layer constraints need significantly less prompt-context (cursor rules) — type system + enforced architecture together do prompt-engineering work for free.
- **eslint-plugin-sonarjs** (`cognitive-complexity: 20`, `no-identical-functions`, `no-duplicate-string@5`) — wired into existing `.eslintrc.json`. Test files excluded (fixtures legitimately repeat literals). Rationale: cognitive complexity (nested-control penalty) is a better LLM context-hop proxy than McCabe cyclomatic — paper ranks it the strongest predictor of edit-success collapse on long-method tasks.

Real findings surfaced and fixed in the same PR:
- **Circular dependency `src/config/model-config.ts ↔ src/dispatcher/preset-loader.ts`** — preset-loader had duplicate `Harness`/`Provider` type declarations identical to those in `src/protocol/types.ts`. Removed duplicates, made preset-loader import + re-export from the canonical location. Cycle broken; 56 modules / 187 deps cruised, 0 violations.
- **Unused `validateMessage` async function** removed from `src/protocol/validate.ts` — only `validateMessageSync` had real consumers (`src/transcript/writer.ts`).
- **Unused `ActorName` type** removed from `src/config/model-config.ts` — derived type with zero downstream consumers; the `ACTORS` const is what the TUI iterates over.
- **Unused root `chokidar` dependency** moved out — only `packages/studio` consumes chokidar (its own package.json already has it).
- **Unlisted `zod` dependency** added to `package.json` — was being imported as a transitive of `@modelcontextprotocol/sdk`, now declared explicitly.

Reducer single-file design preserved with inline justification: per LongCodeBench (arXiv 2505.07897) + Karpathy nanochat / microgpt evidence, splitting an 18-case 650-line reducer into 18 files would convert single-file fan-out cost into 18-file fan-out cost. The `// eslint-disable-next-line sonarjs/cognitive-complexity` annotation on `reduce()` cites both wiki pages so future contributors (human or LLM) understand the deliberate exception.

CLAUDE.md verify gate updated to include the three new lint stages, with citations to the underlying papers so the rationale is durable.

### Changed — researcher actor: real text research replaces v0.3.0 stub (v0.3.1) (2026-05-02)

The v0.3.0 researcher had two paths: video → real Gemini SDK, no-video → **empty stub** (`reference_games: []`, `design_lessons: []`). Verifier saw the stub but downstream planner-lead phase B got nothing. Now the no-video path runs a real LLM-driven text research turn.

- **`src/state/types.ts`** — new `goal_has_video_refs: boolean` field on CrumbState. Set in the goal reducer case from `event.data.video_refs` array; consumed by `pickAdapter('researcher')`.
- **`src/reducer/index.ts` `pickAdapter('researcher')`** — branches on `state.goal_has_video_refs`:
  - `true` → `gemini-sdk` (programmatic frame sampling, deterministic via cache_key)
  - `false` → `claude-local` (LLM-driven text research, runs `agents/researcher.md` step 1+3 fallback: 3-5 reference games + design lessons grounded in `wiki/`)
- **`src/adapters/gemini-sdk.ts`** — text-only stub branch removed. If invoked without `video_refs` (e.g. user hard-bound the actor via `.crumb/config.toml`), emits `kind=error` with `data.reason=gemini_sdk_no_video_refs` explaining how to rebind. Exit code 2.
- **`.crumb/presets/bagelcode-cross-3way.toml`** — researcher binding's `harness/provider/model` removed. The preset now defers to `pickAdapter` so one preset serves both video and text-only modes. Users who want to FORCE gemini-sdk regardless can override via `.crumb/config.toml`.
- **Tests**: 294/294 (was 293; +2 reducer specs for video/no-video routing, -1 stub adapter spec, +1 error-path adapter spec). Builds on PR #41's OpenHands #5500 regression specs.
- The runtime sandwich `agents/researcher.md` already documented step 1+3 text-only fallback (3 reference games × 3 actionable lessons grounded in wiki) — no change needed there. The fix is in routing + adapter behavior so that path actually executes.

### Changed — Rule 6 G-D composite-gaming AND-gate (D1 ≥ 3 AND D5 ≥ 3) (2026-05-02)

Implements **G-D** of the scoring+ratchet frontier survey (`wiki/synthesis/bagelcode-scoring-ratchet-frontier-2026-05-02.md` §7 P1). Closes the last open frontier gap from the survey (G-C length normalization remains, queued for post-deadline).

**Compensatory aggregation gap**: the existing aggregate-floor check (`aggregate ≥ 24 → PASS`) is OR-gate — any combination summing to 24 passes. Without per-dimension floors, the builder can game cheap-to-saturate deterministic dims (D2 exec / D6 portability — typically 5 each from `qa-check-effect` ground truth) and overshadow weak LLM-judge dims (D1 spec_fit / D5 quality). Example: `D1=2 + D2=5 + D3=5 + D4=5 + D5=2 + D6=5` sums to **24 → PASS** even though the builder is failing on the two LLM-judge dimensions that capture spec compliance and player UX.

**Rule 6 enforcement**: when verifier emits `verdict='PASS'` AND (`D1.score < 3` OR `D5.score < 3`), record `composite_gaming_d1_d5_below_minimum` violation and demote PASS → PARTIAL. FAIL/PARTIAL verdicts are unchanged (the gaming case only inflates PASS). Composes correctly with Rule 4 (cross-provider self-bias) — both fire and the violation list captures both signals.

**Threshold 3/5 (60%), not 4/5**: judge variance σ≈0.6 per Zheng et al. NeurIPS 2023 MT-Bench analysis. 4/5 floor produces too many false negatives at current judge noise. Tightening to 4/5 is queued for P2 once extended-thinking adopters lower variance (Snell ICLR 2025 backing).

**Frontier convergence on AND-gate per-dim floor** (release/PASS gate, not training-signal aggregation):
- **SWE-bench Verified 2024** — pass/fail binary (test ground truth)
- **RewardBench v2** (Lambert AI2 2025 §4.2) — explicit "per-category to prevent compensatory averaging masking safety regressions"
- **LiveCodeBench** (Jain ICLR 2025) — per-difficulty + per-contest min
- **HELM Capabilities** (Liang Stanford 2024) — "per-scenario worst-case" headline
- **OpenAI Preparedness Framework 2024-12** — AND-gate per-dim floor on capability eval
- **Anthropic RSP v2 2024-10** — every safety dim must clear threshold

Counter-evidence (DeepSeek-R1 GRPO, Constitutional AI/RLAIF) uses soft aggregation only for *training signal*, not deployment gate — the dual structure (soft training, hard floor gate) is 2025-2026 standard.

Changes:
- **`src/validator/anti-deception.ts`** — Rule 6 added below Rule 4. Snapshots verifier's *original* PASS verdict so Rule 4's downgrade doesn't mask the gaming signal in the violation list. Order: aggregate floor → Rule 4 → Rule 6 (composes idempotently).
- **`src/validator/anti-deception.test.ts`** — +5 specs: D1<3 demotes, D5<3 demotes, both = 3 (at floor) stays PASS, FAIL stays FAIL, Rule 4 + Rule 6 compose. Suite total **318/318** (was 313 on main + 5).
- **`wiki/synthesis/bagelcode-scoring-ratchet-frontier-2026-05-02.md`** — G-A/G-B/G-D/G-E status flipped to "Defended" with PR refs; G-C remains the only open gap.

### Added — OpenHands #5500 regression specs for circuit_breaker user-exclusion (2026-05-02)

Pin down the OpenHands #5500 invariant ("stuck-detector must exclude user messages") with explicit regression tests in `src/reducer/index.test.ts`. The property was already correctly implemented at `src/reducer/index.ts:{49,477,489}` (both breaker recovery and failure branches exclude `from='user'`/`'coordinator'`/`'system'`; `stuck_count` only increments on `kind=error`), but lacked a negative test guarding against future refactor regression.

- **`src/reducer/index.test.ts`** (+2 specs, suite total **293/293**):
  - "OpenHands #5500: user.intervene does not reset an OPEN circuit breaker" — given `circuit_breaker.builder = OPEN/3-failures`, a `kind=user.intervene` event leaves the breaker untouched. Without this, a chatty user mid-session could mask a broken builder by appearing to be "actor activity" and drifting the breaker state to CLOSED.
  - "OpenHands #5500: user.* events never increment stuck_count" — four user.* events (intervene/veto/pause/resume) in a row keep `stuck_count = 0`. Stuck detection is reserved for `kind=error` events from actors.
- **`wiki/references/bagelcode-nl-intervention-12-systems-2026-05-02.md`** §4.1 + §5 entries upgraded ⚠ → ✅ verified, with file:line citations + spec names. Cross-references the All-Hands-AI/OpenHands #5500 + #5480 thread.

### Added — NL Intervention 12-system frontier survey (2026-05-02)

New reference page `wiki/references/bagelcode-nl-intervention-12-systems-2026-05-02.md` extends the existing `wiki/synthesis/bagelcode-user-intervention-frontier-2026-05-02.md` matrix from 5 systems to 12, with a fresh dimension: NL classification mechanism. Survey result: 9/12 frontier systems use **implicit LLM judgment** (LangGraph, Cursor, Cline, OpenHands, Devin, Manus, Claude Code skill matcher, Codex CLI, AutoGen UserProxy), 2/12 use **protocol gates only** (Inspect AI, Aider), and 1/12 (bkit) uses an **explicit regex enum classifier** with documented FP-precision bug history (ENH-226 patch). Crumb's PR-A/PR-B path (raw NL → `kind=user.intervene body` + `collectSandwichAppends` → next actor LLM judges in context) matches the majority pattern; the page records the avoid-decision against introducing an `intent.schema.json` enum classifier as bkit-style regression. Cross-references: OpenHands #5500 stuck-detector exclusion (verify our circuit_breaker), Cursor 2.0 worktree isolation (matches our v0.1 invariant 8), AutoGen GroupChatManager known-broken (matches our v0.1 Must 5 STOP-after-handoff), LangGraph `Command` tagged-union (matches our `data.{goto, swap, target_actor, sandwich_append, reset_circuit}` 6-field shape from PR-B).

### Added — codex-local adapter `--model` + reasoning_effort plumbing (2026-05-02)

Closes the signaling-only gap acknowledged in PR #29 (verifier extended thinking default landed in `.crumb/config.toml` but adapters didn't pass `effort` to the underlying CLI). Codex CLI is the first adapter wired end-to-end.

- **`src/adapters/types.ts`** — `SpawnRequest` gains `model?: string` and `effort?: 'low' | 'med' | 'high'` fields. JSDoc documents the per-adapter contract: codex consumes both; claude / gemini are API-only and remain informational until SDK adapters land.
- **`src/adapters/codex-local.ts`** — argv composition extracted as exported pure function `buildCodexArgs(req)`. When `req.model` set: appends `--model <id>`. When `req.effort` set: appends `-c model_reasoning_effort=<low|medium|high>` (crumb `med` → codex `medium`). Order: base flags → `--model` → `-c effort` → positional prompt. Verified against `codex exec --help` (codex CLI 0.123.0 — `-c` config override surface).
- **`src/dispatcher/live.ts`** — passes `binding.model` + `binding.effort` from preset / `.crumb/config.toml` resolve order through `adapter.spawn()`. claude-local + gemini-local accept the fields silently (no behavior change there yet).
- **`src/adapters/codex-local.test.ts`** (NEW) — 10 specs covering argv composition: base flags, prompt fallback, --model presence/absence, all 3 effort values + the missing case, and the canonical flag ordering. Suite total **291/291** (was 281 + 10).

Frontier backing: **Snell et al. ICLR 2025** — test-time compute 4× ≈ 14× pretrain. Verifier benefits most from `effort=high` per CourtEval ACL 2025 (multi-role judgment). With `bagelcode-cross-3way` preset binding builder=codex, this PR makes the builder spawn actually receive the codex `model_reasoning_effort=high` flag the catalog has been asserting since model-config UI shipped.

Limitation acknowledged: claude-local / gemini-local effort plumbing remains API-only (extended thinking budget_tokens is not exposed via `claude -p` / `gemini -p`). SDK adapters are the next ratchet for those.

### Fixed — `_event-protocol.md` not inlined into emitting sandwiches (2026-05-02)

Followup to PR #36 RCA. After fixing the goal-prompt and observability, real subprocess STILL didn't emit transcript events: the post-spawn note captured 2KB of well-formed `kind=question.socratic` JSON in stdout, but Claude printed it instead of invoking `crumb event` via the Bash tool.

Root cause: `agents/_event-protocol.md` (the canonical doc on how to emit events through `crumb event <<EOF ... EOF`) was zero-mentioned in `planner-lead.md` / `builder.md` / `builder-fallback.md` / `researcher.md`. Only `verifier.md` (1) and `coordinator.md` (1) had stub mentions. The protocol's frontmatter says "each Lead sandwich appends a copy of this protocol so the agent doesn't have to read external files" — but the appending was never wired up.

- **`src/dispatcher/live.ts` `assembleSandwich()`** — for any actor in `EMITTING_ACTORS = { planner-lead, builder, verifier, builder-fallback, researcher }`, inline `agents/_event-protocol.md` into the assembled sandwich. The early-return fast-path is updated to also fire when no event protocol injection is needed (preserving v0.1.1 behavior for sessions that don't exercise the override surface).
- This unblocks Claude/Codex from the JSON-print failure mode discovered in run 01KQMCSC (planner exit 0 in 41s, 2047b stdout, zero transcript events).

### Changed — Rule 4 self-bias enforcement: PASS → PARTIAL when builder.provider == verifier.provider (2026-05-02)

Implements **G-A** of the scoring+ratchet frontier survey (`wiki/synthesis/bagelcode-scoring-ratchet-frontier-2026-05-02.md` §7 P1).

Backing: **Stureborg et al. EMNLP 2024** measured PASS-rate inflation of **+14-22%** when builder and verifier share the same provider (LLM self-recognition + sycophancy compounded). Rule 4 of `validator/anti-deception.ts` was previously warn-only — recording `self_bias_risk_same_provider` in `audit_violations` but not changing the verdict. New behavior: when same-provider self-bias is detected AND the verifier returned PASS, the verdict is demoted to PARTIAL — the user must explicitly approve via `kind=user.approve` (G1 surface). FAIL/REJECT/PARTIAL verdicts are unchanged (self-bias only inflates PASS, not failure).

- **`src/validator/anti-deception.ts`** Rule 4 — added verdict downgrade alongside the existing warn. Order: aggregate-floor check first (PASS → PARTIAL when aggregate < 24), then self-bias downgrade. Both are idempotent.
- **`src/validator/anti-deception.test.ts`** — Rule 4 spec expanded from 1 → 4: (a) PASS → PARTIAL on self-bias, (b) cross-provider PASS unchanged, (c) self-bias FAIL stays FAIL, (d) self-bias PARTIAL stays PARTIAL. Suite total **281/281** (was 278 + 3 new specs).
- Frontier alignment matrix moves G-A from "exposed gap" to "defended": `bagelcode-cross-3way` preset is now the recommended path (binds builder=codex/openai + verifier=gemini-cli/google → automatically passes the cross-provider gate). Ambient/solo presets that bind both to the same provider will see the new downgrade until a preset / `crumb_model "verifier 모델을 ..." ` swap restores the cross.

### Fixed — Real subprocess RCA: planner-lead "awaiting input" stall + observability + 3 minor (2026-05-02)

Closing a 4-issue cluster found while smoke-testing v0.3.0 against `--preset solo` real subprocess. Root-cause-oriented fixes after dispatcher observability made the silent failures visible.

- **Observability — pre-spawn + post-spawn `kind=note` events** (`src/dispatcher/live.ts`). Two new diagnostic events around every adapter spawn: (1) `dispatch.spawn → actor=X adapter=Y sandwich=...` BEFORE invoking the adapter, with `data.{actor,adapter,sandwich_path,has_prompt}`; (2) `adapter X streams (exit=N, Tms)` AFTER, with `data.{adapter,stdout_truncated,stderr_truncated,stdout_full_length,stderr_full_length}`. Both visibility=private + deterministic + tool=`dispatch-pre-spawn@v1` / `<adapter>-stream@v1` so anti-deception/verifier ignore them but `crumb debug` can read them. Without these, an exit-0-but-silent spawn was indistinguishable from a successful run.
- **Planner-lead "awaiting input" stall** (`src/reducer/index.ts` goal case). Symptom: real run exited in 12s with 0 transcript events from the planner. Pre-spawn note showed dispatcher reached claude-local successfully; post-spawn note captured stdout=`Planner-lead spawn ready. Awaiting kind=goal (or spec.update) input with the design target before starting step 1 (socratic round).` — Claude responded to the generic kickoff `'Continue your role per the system prompt.'` with a status check instead of acting on the transcript. Fix: the `goal` case in the reducer now passes a structured prompt `User goal: <body> + Begin your turn now per the system prompt — read $CRUMB_TRANSCRIPT_PATH for full context and execute step 1 (Socratic round).` Reducer test updated to assert the new prompt shape.
- **Adapter kickoff fallback rewritten** (`claude-local.ts` + `codex-local.ts` + `gemini-local.ts`). When a spawn arrives without an explicit prompt, instead of `'Continue your role per the system prompt.'` (status-check ambiguous), use `'Begin your turn now. Read $CRUMB_TRANSCRIPT_PATH for full context (latest goal, spec, qa.result, etc.) and execute the next step per the system prompt. Do not wait for additional input.'` Action-oriented + names the transcript path explicitly.
- **Codex CLI `--skip-git-repo-check`** (`codex-local.ts`). Direct codex probe revealed: `Not inside a trusted directory and --skip-git-repo-check was not specified.` — codex 0.123.0 refuses `exec --cd <session-workspace>` because session dirs aren't git repos. Adding the flag unblocks the builder spawn. (Separate architectural issue: preset's `model` field is informational only, not passed to codex via `--model`. ChatGPT-account users will still see model-rejection errors. Out of scope for this fix.)
- **`--root` flag conflation** (`src/cli.ts`). Twelve session-resolving commands (`replay/resume/debug/status/suggest/tui/export/ls/release/copy-artifacts/versions/migrate`) were using `args.flags.get('root') ?? process.cwd()` for project resolution — meaning `--root` would override the user's actual cwd's pin file. Fix: those commands now use `process.cwd()` unconditionally; `--root` is reserved for `cmdRun/cmdConfig/cmdInit/cmdModel` (preset/agents/config loading). Pin file in cwd always wins for session resolution.
- **Test count**: 521/521 (was 254 before observability rebase + parallel sessions added researcher/preset tests).

### Changed — Verifier default → `gemini-3-1-pro` + dot/dash NL alias + swap cookbook (2026-05-02)

Three coupled changes addressing the question "왜 verifier가 아직 `gemini-2.5-pro`?" + "갈아끼우기를 한 페이지에서 보고 싶다":

- **Verifier seat default**: bumped `gemini-2.5-pro` → `gemini-3-1-pro` (top of `MODEL_CATALOG.google`) across `.crumb/config.toml`, `defaultConfig().actors.verifier.model`, `HARNESS_DEFAULT_MODEL` (gemini-cli + google-sdk fallbacks), `.crumb/presets/sdk-enterprise.toml`, and surface docs (README / README.ko / AGENTS / GEMINI / `.claude/skills/crumb/SKILL.md` / `.claude/skills/crumb-model/SKILL.md` / `agents/verifier.md` provider_hint / cli.ts / mcp-server.ts crumb_model description). Test fixtures and regression specs follow the rename. **`gemini-2.5-pro` stays in the catalog as a fallback option** — users wanting the older model can still set it explicitly.
- **NL parser dot/dash alias**: `applyNlInstruction()` now normalizes `<digit>.<digit>` ↔ `<digit>-<digit>` on both sides of the catalog compare, so the user can say either "verifier 모델을 gemini-3.1-pro 로" (Google API canonical) or "verifier 모델을 gemini-3-1-pro 로" (catalog form) — the saved value is whichever form the catalog stores. Reverse alias also works (`gemini-2-5-pro` resolves to `gemini-2.5-pro`). +4 specs in `src/tui/model-edit.test.ts`.
- **Swap cookbook** in `.claude/skills/crumb/SKILL.md`: a single section listing all model / provider / actor swap surfaces — A) static `.crumb/config.toml` via MCP / CLI / direct edit, B) dynamic mid-session via TUI slash bar / `inbox.txt` / JSON event (`/swap`, `/goto`, `/append`, `/reset-circuit`, `data.target_actor`, `data.sandwich_append`), C) preset-level `--preset <name>` at session start. Includes a one-glance "X 를 Y 로 갈아끼우기" lookup table. Frontier-link references `bagelcode-user-intervention-frontier-2026-05-02.md` and `bagelcode-scoring-ratchet-frontier-2026-05-02.md`.

Test suite total **278/278** (main's local count + 4 new dot/dash alias specs).

### Changed — D3/D5 split into single-origin dims, drop `'hybrid'` source (2026-05-02)

Every score dimension now reports a single origin in `scores.D*.source`: `verifier-llm` | `qa-check-effect` | `reducer-auto`. The prior `'hybrid'` value forced the verifier and reducer components into one number that the LLM emitted, which (a) duplicated information already carried by the `auto` / `semantic` / `quality` fields and (b) created an attack surface where the verifier could inflate the merged score (mitigated previously by anti-deception Rule 5).

The split:
- Verifier emits D3/D5 with `source='verifier-llm'`, `score`=its LLM component (0-5).
- Reducer computes the auto component independently via `computeAutoScores()`.
- `combineDimScore()` in `src/state/scorer.ts` averages the two halves in code — a single function the verifier cannot influence.
- `combineAggregate()` recomputes the /30 aggregate using the deterministic combine.

Anti-deception Rule 5 (`verifier_inflated_hybrid`) is removed — there is no merged score for the LLM to inflate. Rules 1-4 are unchanged. Verifier sandwich (`agents/verifier.md`) updated: D3/D5 instructions tell the LLM to emit only its component, never pre-blend.

Frontier alignment: matches the "verifiable reward + LLM rubric kept separate" pattern in RLVR (Lambert et al. 2024) and Anthropic's 2026 hybrid-norm guidance — but the source label itself is now single-origin so the schema mirrors the runtime architecture.

Changes:
- **`protocol/schemas/message.schema.json`** — `source` enum 4→3 values, D3/D5 descriptions updated.
- **`src/protocol/types.ts`** — TS union 4→3, ScoreDimension JSDoc clarified.
- **`src/state/scorer.ts`** — `combineDimScore()` + `combineAggregate()` added (pure, replay-deterministic).
- **`src/validator/anti-deception.ts`** — Rule 5 removed, aggregate recomputation delegates to `combineAggregate`.
- **`src/validator/anti-deception.test.ts`** — Rule 5 spec replaced with split-after-combine assertion.
- **`src/summary/render.ts`** + **`cds.ts`** — `source-hybrid` CSS / dispatch removed.
- **`src/adapters/mock.ts`** + **`src/summary/render.test.ts`** + **`src/session/version.test.ts`** — fixtures updated.
- **`agents/verifier.md`** — sandwich instructions ("Do NOT pre-blend"), source matrix table refreshed.
- **`AGENTS.md`** + **`.claude/skills/crumb/SKILL.md`** — invariant #4 wording + skill router source-list synced (this PR).

**Breaking**: legacy transcripts that emitted `source='hybrid'` will fail validation under the new enum. Intentional — anyone replaying a v0.x session needs to migrate. v0.3.0 is the first submission cycle so real impact is minimal.

PR: #27 (refactor) + this PR (docs sync).

### Added — Playwright smoke run real implementation + opt-in strict gate (2026-05-02)

Implements P0-2 of the scoring+ratchet frontier survey (`wiki/synthesis/bagelcode-scoring-ratchet-frontier-2026-05-02.md` §7). Frontier backing: SWE-bench Verified 2025 top10 / Cognition Devin "Don't Build Multi-Agents" Jun 2025 / DeepSeek-R1 Jan 2025 — all converge on rule-based exec gate as the strongest D2 / D6 ground truth.

- **`src/effects/qa-check-playwright.ts`** — replaced the 6-line stub with a real Chromium smoke: launch headless → `file://${artifact}` → wait up to 5s for `<canvas>` (Phaser 3.80 boot signal) → watch console + page errors for 1.5s → fail with `reason` on missing canvas, console error, or page error. Single-browser gate (chromium) covers the SWE-bench-style P0 ground truth; firefox+webkit cross-browser is P1.
- **`src/effects/qa-check.ts`** — Playwright detection now auto-detects via dynamic import (no more `PLAYWRIGHT_AVAILABLE=1` opt-in). New env contract:
  - **default** (Playwright not installed) — `first_interaction='skipped'`, `lint_findings` includes guidance (`'playwright not installed (D6 portability unverified); install: npm i -D playwright && npx playwright install chromium'`), `exec_exit_code` unchanged. Signaling without breaking existing runs.
  - **`CRUMB_QA_REQUIRE_PLAYWRIGHT=1`** (strict gate, recommended for CI) — missing Playwright → `first_interaction='fail'`, `exec_exit_code=1`. Forces D2/D6 ground truth.
  - **`CRUMB_QA_PLAYWRIGHT_OPTIONAL=1`** — silent skip (suppresses the warning finding). Backward-compat for environments that explicitly don't want Playwright.
  - Smoke success → `first_interaction='ok'`, `cross_browser_smoke='ok'`. Smoke failure → `first_interaction='fail'`, `exec_exit_code=1`, finding carries the smoke reason.
- **`src/effects/qa-check.test.ts`** (NEW) — 10 specs covering: mock fallback (.mock.html / missing artifact), lint + size checks, all 5 Playwright detection branches (default missing, REQUIRE strict-fail, OPTIONAL silent skip, smoke success, smoke fail, smoke runtime error). Suite total **246/246** (was 236).
- Anti-deception synergy: `validator/anti-deception.ts` already forces `D2=0` when `verdict=PASS && exec_exit_code != 0`. With Playwright smoke now enforcing real failure modes (no canvas / console error / page error), the anti-deception layer gains genuine teeth — a builder can no longer ship a syntactically lint-clean file that crashes on load.

**Scope notes**:
- This PR is **opt-in strict** (CI not yet mandatory). The CI workflow update to `npx playwright install --with-deps chromium` + `CRUMB_QA_REQUIRE_PLAYWRIGHT=1` is queued as a follow-up after the Bagelcode submission deadline (2026-05-03 23:59 KST), to avoid pre-deadline CI infra risk.
- `playwright` is **not** added as a direct dep — kept as an optional peer (dynamic import, runtime string-built module name to bypass `tsc --noEmit`). Local installation (`npm i -D playwright && npx playwright install chromium`) immediately activates the real smoke for any user / evaluator who wants D2/D6 ground truth.

### Fixed — `.crumb/config.toml` schema drift + verifier effort=high default (2026-05-02)

Implements P0-1 of the scoring+ratchet frontier survey (`wiki/synthesis/bagelcode-scoring-ratchet-frontier-2026-05-02.md` §7). Two coupled gaps fixed:

- **Schema drift**: the committed `.crumb/config.toml` used the v2 layout (`[agents.coordinator]`, `[agents.engineering-lead]`, `thinking_effort`) while `loadConfig()` since the model-config UI ship has expected v0.1 (`[actors."<name>"]`, `[providers."<id>"]`, `effort`). Result: `loadConfig()` was silently falling through to `defaultConfig()` at runtime. The TUI / `crumb_model` MCP tool saved correctly in v0.1, but the seed file shipped with the repo was unparseable as overrides — a fresh checkout's first run got nothing user-tunable from the seed.
- **Verifier extended thinking default**: rewrote the seed in v0.1 layout with explicit `effort = "high"` on every actor, with comments citing **Snell et al. ICLR 2025** ("Scaling LLM Test-Time Compute Optimally" — test-time compute 4× ≈ 14× pretrain) and **CourtEval ACL 2025** (multi-role +12.4%). Verifier is the highest-leverage actor — Critic / Defender steps benefit most from extended thinking budget.

Changes:
- **`.crumb/config.toml`** — full rewrite to v0.1 layout. 5 actors, 3 providers, `effort = "high"` on all. Header documents resolve order + effort mapping + frontier backing.
- **`src/config/model-config.test.ts`** — +3 regression specs locking the committed config: (a) verifier effort=high + harness=gemini-cli + model=gemini-2.5-pro, (b) all 5 actors carry effort=high (no silent low/med drift), (c) all 3 local providers enabled. Suite total 236/236 (was 233).

**Limitation acknowledged**: this PR is signaling-only at the dispatcher → adapter boundary. The adapters (`claude-local`, `codex-local`, `gemini-local`) do not yet pass `effort` to the underlying CLI flags (`--reasoning-effort` exists for codex; Anthropic / Gemini extended thinking is API-only and not exposed by `claude -p` / `gemini -p`). Adapter-level effort plumbing is queued as the next ratchet step (codex-local first; Anthropic/Gemini wait for SDK adapter ships).

### Added — Scoring + ratchet frontier survey (2026-05-02)

`wiki/synthesis/bagelcode-scoring-ratchet-frontier-2026-05-02.md` ingested. Frontier verdict on whether the multi-agent "scoring + ratchet" pattern (verifier produces D1-D6 → iterate until PASS or variance-based adaptive_stop) actually raises quality, and what 2026 alternatives exist.

- **Validity evidence** (CourtEval ACL 2025 +12.4%, Reflexion HumanEval +11pp, Self-Refine HumanEval +8.7pp, Khan NeurIPS 2025 multi-agent debate +8.7%, Arena-Hard ρ=0.89 vs human votes).
- **Failure modes with magnitudes** — position bias 65-75% (Wang IJCNLP-AACL 2025), self-preference +6% (Panickssery NeurIPS 2024), sycophancy 47-58% (Sharma ICLR 2024), Goodhart divergence after round 4 (Eisenstein DeepMind 2024), same-provider verifier inflation +14-22% (Stureborg EMNLP 2024).
- **2026 frontier convergence** on deterministic gate + verifier test-time compute. Multi-agent debate / PRM / self-refine retreating in production (AutoGen 0.4 single-agent first / Cognition Devin "Don't Build Multi-Agents" Jun 2025 / DeepSeek-R1 PRM polished → rule-based reward / SWE-bench top10 all exec-based).
- **Crumb alignment matrix** — defends ~60-70% of 2026 failure modes (qa_check D2/D6 ground truth + CourtEval intra-debate + variance adaptive_stop + append-only ULID); exposed gaps: verifier self-bias enforcement (G-A), Goodhart drift cap (G-B), length normalization (G-C), composite gaming (G-D), Playwright optional → required (G-E).
- **P0 recommendations queued for follow-up PRs**: (1) verifier extended thinking default high in presets, (2) Playwright smoke run mandatory in qa-runner.

### Fixed — Codex CLI rejects `--prompt` flag (positional only) (2026-05-02)

Followup to PR #23. Real subprocess demo with `--preset solo` (model-config override binds builder=codex+gpt-5.5-codex) crashed at the first builder spawn: `error: unexpected argument '--prompt' found. tip: to pass '--prompt' as a value, use '-- --prompt'. Usage: codex exec [OPTIONS] [PROMPT]`. Codex 0.123.0 takes the prompt as a **positional** argument; the `--prompt` flag never existed (the original conditional `['--prompt', req.prompt]` was wrong even before PR #23 — it just never fired because callers omitted the prompt).

- **`src/adapters/codex-local.ts`** — pass `promptText` as the trailing positional, drop `--prompt` flag entirely. Other adapters (claude / gemini) still use `-p <text>` per their CLI grammar.

### Fixed — Adapter empty-prompt crash blocks every real subprocess run (2026-05-02)

Discovered while smoke-testing v0.3.0 against `--preset solo`: every real subprocess spawn died on the first actor with `error: Input must be provided either through stdin or as a prompt argument when using --print` (claude-local exit 1 in 3.7s). Root cause: most reducer spawn effects (goal → planner-lead, spec → builder, qa.result → verifier, fallback → builder-fallback) intentionally omit `prompt` because the actor's job is fully described by the sandwich — but the adapters then forwarded `req.prompt ?? ''` to the host CLI, and `claude -p ""` / `gemini -p ""` reject empty input. Codex's `exec --prompt <text>` was conditionally appended, so codex sat waiting on stdin instead of crashing.

- **`src/adapters/claude-local.ts`** + **`gemini-local.ts`** + **`codex-local.ts`** — when `req.prompt` is missing or whitespace-only, fall back to `'Continue your role per the system prompt.'` Codex now always receives `--prompt <text>` (no more conditional append).
- Why a single generic kickoff is right: the sandwich (`agents/<actor>.md`) is the canonical role spec; the prompt is just the wake-up signal. Each actor's first turn is supposed to read the sandwich + `task_ledger` (via `agent-workspace`) and act. A generic kickoff doesn't bias the actor toward any particular branch.
- This unblocks every real run with `--preset solo` / `bagelcode-cross-3way` / `sdk-enterprise`. Mock adapter was unaffected (it never touches CLI prompts).



Closes the v0.3.0 storage refactor by giving v0.2.0-and-older users a one-shot move into the new `~/.crumb/projects/<id>/sessions/` layout.

- **`src/session/migrate.ts`** (~110 LOC, 7/7 vitest specs) — `migrateLegacySessions({ cwd, dryRun })` scans `<cwd>/sessions/` and `fs.rename`s each session dir into `~/.crumb/projects/<sha256(canonical(cwd))[:16]>/sessions/`. Atomic per session (single syscall on most filesystems). Idempotent — destination collisions are reported as `already-migrated` and the source is left intact (no data loss). Empty legacy dir is `rmdir`'d after a clean sweep.
- **`crumb migrate [--dry-run]`** — wires the helper. Per-session report with action ∈ `moved | already-migrated | collision | skipped`. `--dry-run` previews the plan without touching disk.
- **Test**: 224/224 (was 217; +7 migrate specs). Mock e2e: 2 legacy sessions → dry-run → real migrate → both at new location → empty legacy dir removed → 2nd run reports `nothing to migrate`.

### Added — `crumb copy-artifacts` — v0.3.0 Phase 2c (2026-05-02)

Closes the Bagelcode submission UX loop. Reviewers expect `cd crumb && open demo/game.html` to just work; with sessions now under `~/.crumb/projects/<id>/`, the user needs an explicit copy step.

- **`crumb copy-artifacts <session-id|vN> --to <dest>`** — pure `copyFile` (no symlinks) of every file under `artifacts/` into `<dest>`. Accepts both raw session ULID and version names (`v1`, or full `v2-combo-bonus`). Version lookup tolerates label-less queries: `crumb copy-artifacts v1 --to ./demo/` resolves to whatever dir matches `v1` regardless of label slug.
- **Submission story**: `crumb run "..." --label "bagelcode-final"` → `crumb release <ulid> --as v1 --label "bagelcode"` → `crumb copy-artifacts v1 --to ./demo/` → `git add demo/`. Three commands, no symlinks, single-direction copy.
- **Test**: 217/217 (no test additions — covered by mock e2e). Verified copying from both session ULID and version name resolves the same artifact set.

### Added — Version graph: `crumb release` + `crumb versions` — v0.3.0 Phase 2b (2026-05-02)

Sessions become *promotable* — `crumb release <session-ulid>` snapshots a WIP session into an immutable milestone under `~/.crumb/projects/<id>/versions/<vN>[-<label>]/` with a TOML manifest, sha256-keyed frozen artifacts, and a `kind=version.released` event appended to the source transcript so replay re-derives the milestone. Realizes the v0.dev (Project → Chat → Version) + Lovable (favorited milestone vs auto-history) hybrid that Phase 1 reserved space for.

- **`src/session/version.ts`** (~150 LOC, 20/20 vitest specs) — VersionManifest schema v1: `{ name (e.g. v2), label?, released_at, source_session, source_event_id?, parent_version?, goal?, scorecard {D1-D6 + aggregate + verdict}, artifacts_sha256 }`. Helpers: `versionDirName(name,label)` (slugifies label → `v2-combo-bonus`), `nextSequentialVersion(dir)` (scans `^v(\d+)` to find next), `readAllManifests` / `readManifest` / `writeManifest` (TOML via @iarna/toml), `deriveScorecard(events)` (last `judge.score`), `deriveSourceEventId(events)` (`done` → last `judge.score` → last event), `snapshotArtifacts(sessionDir,versionDir)` (real `copyFile` per file with sha256, no links).
- **`crumb release <session-ulid> [--as vN] [--label "<name>"] [--no-parent]`** — auto-numbers `v<N>` by default; `--as v0.1` overrides; `--label` slugifies into the dir name; `parent_version` is auto-detected as the latest existing manifest unless `--no-parent`. Refuses to overwrite an existing version dir. Appends `kind=version.released` (system, deterministic, tool=`crumb-release@v1`) with `data: { version, label, parent_version, source_event_id, manifest_relpath }` — `manifest_relpath` is project-relative (`versions/<dir>/manifest.toml`) so transcripts replay portably across machines.
- **`crumb versions`** — lists all manifests sorted by `released_at` ascending with `← parent` chain notation, label tag, verdict, aggregate. `[latest]` footer surfaces the head.
- **Test**: 217/217 (was 197; +20 version specs). Mock e2e: `init --pin` → `run` → `release v1 --label first-pass` → `release v2 --label second-pass` → `versions` shows v1 + v2 (parent ← v1) + transcript carries 2 `kind=version.released` events.
- **Frontier basis**: v0.dev's structural rigor (Project → Chat → Version DAG with Fork API), Lovable's favorited-stable-version UX (descriptive labels), Replit's checkpoint metadata richness (scorecard + source pointer). Sequential `v<N>` chosen over pure-descriptive (Replit/Lovable) for `ls versions/` sortability and over opaque ID (v0/Cursor/Cline) for human "the v0.1 feels too easy" mental model — research recommendation realized.

### Added — Session lifecycle (meta.json) + project pin (`crumb init --pin`) — v0.3.0 Phase 2a (2026-05-02)

Session lifecycle becomes O(1) inspectable without scanning the transcript head, and projects can survive cwd renames. Builds on Phase 1's `~/.crumb/projects/<id>/` storage hierarchy.

- **`src/session/meta.ts`** (90 LOC, 8/8 vitest specs) — `meta.json` writer/reader. Schema v1: `{ session_id, status: running|paused|done|error|killed, started_at, ended_at?, goal?, preset?, parent_session_id?, fork_event_id?, label? }`. **meta.json is a cache** — losing it doesn't break replay (state derives from transcript). It exists for fast lifecycle lookup by `crumb ls` and forthcoming `crumb resume` / `crumb fork`.
- **`crumb run` writes meta.json** at session start (status=running), updates on completion (status=done | paused based on `state.done`, fills `ended_at`), updates on exception (status=error). Idempotent on re-run with same `--session <id>` — flips existing meta back to running rather than overwriting.
- **`crumb init --pin [--label "<name>"]`** — pins the cwd to a fresh ULID written to `<cwd>/.crumb/project.toml`. Subsequent `crumb run` from this cwd (or any cwd that contains the same pin file) resolves to the same `~/.crumb/projects/<ULID>/` regardless of directory rename. Without `--pin`, `crumb init` keeps its existing multi-host entry verifier behavior. Idempotent — re-running on a pinned cwd reports the existing project_id and exits.
- **`crumb ls` enriched**: shows `[status]` tag (running/paused/done/error/killed) and a truncated goal alongside event count + size. Works for both new sessions (with meta.json) and legacy sessions (falls back to `[legacy]` tag without status).
- **`crumb run --label "<name>"`** new flag — passes through to `meta.json.label` for human-readable session labeling.
- **Test**: 197/197 (was 189; +8 meta specs). Mock e2e verified — `crumb init --pin` writes a TOML pin file, `crumb run` from that cwd resolves to the pinned ULID's project dir, meta.json lifecycle full (started_at + ended_at + status=done), `crumb ls` shows status tag.

### Added — Session storage hierarchy v0.3.0: `~/.crumb/projects/<id>/{sessions,versions}/` (2026-05-02)

Sessions move out of `<cwd>/sessions/` into a per-user, per-project global store. Project-first hierarchy modeled on **v0.dev (Project → Chat → Version)** + **Cline (`tasks/` vs `checkpoints/` filesystem split)**, with project-id derived from `sha256(canonical(cwd))[:16]` (Cursor's `workspaceStorage` pattern, avoiding Claude Code's lossy dash-encoding). Schema additions are additive — existing transcripts replay unchanged; legacy `<cwd>/sessions/` still resolves via fallback until `crumb migrate` (Phase 3).

- **`src/paths.ts`** (139 LOC, 18/18 vitest specs) — single source for every on-disk path. Helpers: `getCrumbHome()` (honors `CRUMB_HOME` env override for tests), `projectIdFromCwd()`, `resolveProjectId()` (pin file `<cwd>/.crumb/project.toml` → `id` first, ambient sha256 fallback), `getProjectDir()`, `getSessionsDir()`, `getSessionRoot()`, `getVersionsDir()`, `getActorWorkspace()`, `getArtifactsDir()`, `resolveSessionDir()` (path | new-global | legacy-`<cwd>/sessions/` triple resolution), `ensureCrumbHome()` / `ensureProjectDir()` / `ensureSessionRoot()`.
- **3 new transcript kinds (40 → 43)** in `protocol/schemas/message.schema.json` + `src/protocol/types.ts`: `session.forked` (system, fork pointer event), `version.released` + `version.refinement` (new `version` category for immutable milestones under `versions/<vN>/`). `src/helpers/explain.ts` registry + tests updated. `protocol/schema.md` count synced to 43.
- **5-layer hierarchy markers** added as optional sub-objects in `metadata`: `metadata.crumb.{run_id, turn_id, parent_session_id, fork_event_id}` (project → session → run → turn → step → event; reducer-derived in Phase 2) and `metadata.gen_ai.{conversation_id, agent_id, workflow_name}` (OpenTelemetry GenAI Semantic Conventions aliases — `conversation_id ≡ session_id`, `agent_id ≡ from`, `workflow_name = 'crumb.coordinator'`).
- **`src/cli.ts`** — `cmdRun` writes new sessions to `~/.crumb/projects/<id>/sessions/<ulid>/` via `ensureSessionRoot`. `cmdReplay` / `cmdResume` / `cmdDebug` / `cmdStatus` / `cmdSuggest` / `cmdTui` / `cmdExport` accept bare ULIDs and resolve through `resolveSessionDir` (new-global first, legacy-cwd fallback). `cmdLs` lists the project's sessions and surfaces any legacy `<cwd>/sessions/` entries with a `[legacy]` tag until migration.
- **`src/mcp-server.ts`** — local `resolveSessionDir` removed; uses `paths.ts` version. All MCP tools (status / suggest / debug / explain / export) now resolve sessions consistently with the CLI surface.
- **Frontier basis** (research-backed): v0.dev (Project → Chat → Version + Fork Chat API), Cline (filesystem split: `tasks/<task-id>/` for sessions + `checkpoints/<workspace-hash>/.git/` for snapshots — global, footgun #2550 avoided here via per-project sha256), Cursor (`sha256(cwd)`-based `workspaceStorage`), Lovable (favorited milestone vs auto-history split), Replit (Checkpoint = files + conversation + DB schema + AI label). Paperclip is a BYO actor-binding precedent only — its DB-backed model is not relevant to versioning. Naming `v<N>` sequential + optional `--label <name>` is the recommendation that combines v0's structural rigor with Lovable's descriptive UX while preserving `ls versions/` sortability.
- **Deferred to Phase 2** (next PR): `meta.json` per session + reducer-derived `run_id`/`turn_id`, `crumb init --pin` (writes `<cwd>/.crumb/project.toml`), `crumb release <ulid> [--as vN] [--label X]` (immutable milestone + manifest.toml), `crumb versions` (parent-chain listing), `crumb fork <ulid> --at <event-id>` (pointer-only fork via `kind=session.forked`), `crumb export <ulid|vN> --to <dest>` (artifact copy, no link).
- **Deferred to Phase 3**: `crumb migrate` to relocate legacy `<cwd>/sessions/` into `~/.crumb/projects/<id>/sessions/`. Idempotent.

### Changed — Entry-MD user-intervention guidance (2026-05-02)

Closes the audit's punch-list item #3-#4 ("Entry MD natural-language parsing" + "Coordinator sandwich lacks user.* dispatch guidance"). Every host entry and the coordinator sandwich now document the same 3-surface × 6-data-field user-intervention contract in one voice. Mail requirement #2 (사용자가 협업 과정에 개입) end-to-end coverage: reducer + dispatcher (G1-G6 + G4) → TUI/inbox/JSON event surfaces (PR #16) → host-entry guidance (this PR).

- **`agents/coordinator.md`** — Routing Rules table expanded from 2 user.* entries to 12 (5 user.intervene `data.*` branches + 4 user.pause/resume branches + user.approve + user.veto). Task Ledger Rules updated for the `sandwich_append` fact category. New "User-intervention surfaces" reminder names the 3 modalities (TUI / inbox.txt / `crumb event` JSON shell) and confirms they all write the same JSONL line.
- **`.claude/skills/crumb/SKILL.md`** §4 — single JSON example replaced with full 3-surface guide + 6-row `data` field semantics table + frontier matrix references.
- **`.codex/agents/crumb.toml`** §6 — 3-line bullet list replaced with full surface comparison; Codex shell environment gets `inbox.txt` as the 1순위 surface.
- **`.gemini/extensions/crumb/commands/crumb.toml`** §4 + **`.gemini/extensions/crumb/GEMINI.md`** "사용자 개입" — same expansion adapted to Gemini CLI's verifier-multimodal seat.
- Frontier alignment: LangGraph `Command(goto/update={...})` 53/60 + Paperclip BYO swap 38/60 + Codex `APPEND_SYSTEM.md` 38/60. Backing: `wiki/synthesis/bagelcode-user-intervention-frontier-2026-05-02.md`.
- PR #18.

### Changed — TUI slash bar unifies grammar with inbox parser (2026-05-02)

Audit after PR #14 found the TUI was a second-class intervention surface: `handleCommand` mapped 7/11 slash commands and dropped every `data` field on the floor (`target_actor` / `goto` / `swap` / `reset_circuit` / `actor` / `sandwich_append`). G1-G6 + G4 all worked through `inbox.txt` but were invisible to TUI users.

- **`src/tui/app.ts`** — `handleCommand` now delegates to `parseInboxLine`. The TUI slash bar and the headless `inbox.txt` watcher share one grammar source. Quit (`/q`, `/quit`) is the only TUI-local case. Bar label refreshed to advertise `/approve /veto /pause /resume /goto /swap /reset-circuit /append /note /redo /q · @actor msg`.
- **`src/inbox/parser.ts`** — added `/append [@<actor>] <text>` (G4 sandwich override, broadcast or actor-scoped), `/note <text>` (kind=note free-form annotation), `/redo [body]` (alias for free-text intervene; preserves TUI muscle memory).
- **Tests**: +8 parser specs (4 for `/append`, 2 for `/note`, 2 for `/redo`); suite total 171/171 (was 163).
- Mail requirement #2 (사용자가 협업 과정에 개입) coverage: TUI is now an equal-citizen intervention surface alongside `inbox.txt`. PR #16.

### Added — G4 sandwich override pipeline (2026-05-02)

Closes the v0.2.0 G4 gap from the user-intervention frontier matrix: a user mid-session can persistently augment any actor's system prompt without restarting (LangGraph `Command(update={...})` pattern, 53/60 frontier score; Codex `APPEND_SYSTEM.md` 38/60 inspires the file-based local override surface).

- **`kind=user.intervene` with `data.sandwich_append`** records a fact of category `'sandwich_append'`. Optional `data.target_actor` scopes the append to a single actor; absent target broadcasts to every spawn. Stored as a fact, so replay reconstructs identical assemblies.
- **`SpawnEffect.sandwich_appends: { source_id; text }[]`** — every spawn carries the matching append list collected by the reducer's new `collectSandwichAppends()` helper. 7 emit sites updated (goal, spec, qa.result, verify FAIL → fallback, user.veto, user.intervene goto, user.resume queued).
- **Dispatcher `assembleSandwich()`** — concatenates base `agents/<actor>.md` + per-machine `agents/<actor>.local.md` (when present) + runtime appends into `sessions/<id>/agent-workspace/<actor>/sandwich.assembled.md` and points the adapter at that path. When there are no local files and no appends, returns the base path unchanged (no FS write — preserves v0.1.1 behavior for sessions that don't exercise the override surface).
- **`agents/*.local.md` gitignored** — per-machine, never committed. Pattern adapted from Codex CLI `APPEND_SYSTEM.md`.
- **Tests**: 5 reducer specs (fact creation, target scoping, scope isolation, untargeted broadcast, append accumulation) + 4 dispatcher specs (passthrough, base+appends assembly, local file inclusion, base→local→append ordering). Suite total 163/163 (was 144).
- **Mail requirement #2 (사용자가 협업 과정에 개입)** coverage rises from G3-only routing (`target_actor` / `goto`) to full runtime sandwich rewriting. PR #14.

### Added — Model + Provider config UI (2026-05-02)

Per-actor model + effort tuning, per-provider activation toggle, and `/model` natural-language interface. All 3 hosts (Claude Code / Codex CLI / Gemini CLI) get the same surface via the MCP `crumb_model` tool.

- **High-end defaults** (no preset / no override): `coordinator` + `planner-lead` = `claude-opus-4-7`, `builder` = `gpt-5.5-codex`, `verifier` = `gemini-2.5-pro`, `builder-fallback` = `claude-sonnet-4-6`. All 3 local providers (`claude-local` / `codex-local` / `gemini-cli-local`) enabled. `effort = "high"` across the board.
- **`src/config/model-config.ts`** (~230 LOC, 17 vitest specs) — `.crumb/config.toml` runtime override layer. `MODEL_CATALOG` per provider (Anthropic: opus-4-7 → sonnet-4-6 → haiku-4-5; OpenAI: gpt-5.5-codex → gpt-5.5 → gpt-4o → gpt-4o-mini; Google: gemini-2.5-pro → gemini-2.5-flash → gemini-2.0-flash). `EFFORT_LEVELS` = `low | med | high` mapped to provider-specific values at adapter spawn (OpenAI `reasoning.effort=low|medium|high`, Anthropic / Gemini thinking_budget = 8000 / 24000 / 64000 tokens).
- **`src/tui/model-edit.ts`** (~280 LOC, 10 vitest specs) — `crumb model` blessed TUI. Tab cycles actors, ↑/↓ changes model in catalog, ←/→ changes effort (low ↔ med ↔ high), `h` cycles harness (claude-code / codex / gemini-cli / mock), `p` focuses providers panel, Space toggles enabled, Enter saves, Esc cancels. Read-only `--show`. Programmatic `applyNlInstruction()` parses Korean + English NL ("verifier 모델을 gemini-2.5-pro 로", "effort 다 high 로", "codex 비활성화", "disable gemini", "set builder model to gpt-4o-mini").
- **MCP tool `crumb_model`** added to `src/mcp-server.ts` (now 8 tools total; was 7). Optional `instruction` arg routes to `applyNlInstruction()`; omitted = read-only show. Brand-forward CLI parity preserved (`crumb model` ↔ `crumb_model`).
- **Claude Code skill** `.claude/skills/crumb-model/SKILL.md` — KO+EN trigger phrases, eager-loaded by skill discovery.
- **Resolve order extended** (`src/dispatcher/preset-loader.ts`): `.crumb/config.toml` override (★ NEW) → preset.actors.<name> → preset.[defaults] → ambient → system fallback. New `loadPresetWithConfig()` + `applyConfigOverride()` returns `{ preset, providersEnabled }`.
- **Provider activation gate** (`src/dispatcher/live.ts`) — at spawn time, if binding's harness has been disabled in `.crumb/config.toml [providers.*]`, dispatcher substitutes `claude-local` (universal fallback) and emits `kind=note` with `metadata.deterministic=true` so observers see the swap. No silent override — anti-deception aligned.
- **CLI**: `crumb model [--show | --apply "<NL>"]` wired in `src/cli.ts`. Coordinator main loop logs disabled providers + per-actor effort on session start.

### Fixed — Schema drift (2026-05-02)

- `protocol/schemas/message.schema.json`: `kind` description "39 kinds" → "40 kinds (4 system + 11 workflow + 5 dialogue + 5 step + 5 user + 3 handoff + 7 meta)". Top-level description also updated to clarify "11 fields" refers to identification/routing/classification only.
- `wiki/concepts/bagelcode-system-architecture-v0.1.md`: §3.3 header "39 kind 어휘" → "40 kind 어휘"; "artifact / meta (6)" → "(7)" (counts 7 entries: artifact.created/ack/error/audit/tool.call/tool.result/hook); architecture diagram "39 kind × 11 field" → "40 kind × 11 field"; §10.2 Kiki studio mapping similarly updated.
- `src/helpers/explain.ts` jsdoc "39 kinds × 11 fields" → "40 kinds × 11 identification fields". `KIND_REGISTRY` already had 40 entries from prior session — only doc string was stale.

### Fixed — Coordinator race conditions (2026-05-02)

Three concurrency defects surfaced by an end-to-end audit of `src/loop/coordinator.ts`, `src/transcript/reader.ts`, and `src/transcript/writer.ts` against the Hub-Ledger-Spoke topology promise.

- **`coordinator.ts` resume double-reduce** — `tail(transcriptPath, onMessage, { fromOffset: 0 })` re-emitted every replayed event to `onMessage`, so on resume each prior event was reduced twice (counters doubled, `score_history` duplicated, spawn effects fired twice). Now captures `replayEndOffset = stat(path).size` before `readAll()` and passes that as `fromOffset` so tail picks up only new bytes. Added `src/loop/coordinator.test.ts` with a regression test asserting `task_ledger.facts.length === 3` (not 6) after replay-then-tail with three pre-seeded events.
- **`coordinator.ts` duplicate session.start/goal on resume** — every `runSession()` invocation unconditionally appended `session.start` + `goal`, so resuming an existing session double-fired the goal event and double-spawned planner-lead. Now skips the synthetic appends if any prior `session.start` for the same `session_id` is found in the replayed events. Two regression tests cover the resume-skips and fresh-writes paths.
- **`transcript/writer.ts` multi-instance breaks single-writer-per-process** — the file header documents Promise-chain serialization, but two parts of the process (TUI + coordinator, or coordinator + mock-adapter) each constructed their own `TranscriptWriter` and held independent chains. Added `getTranscriptWriter({ path, sessionId })` factory backed by a path-keyed module-level registry; production callers (`coordinator.ts`, `cli.ts`, `tui/app.ts`, `adapters/mock.ts`) all use it. Path canonicalization via `node:path.resolve` so relative + absolute references reach the same instance. Four new tests cover same-path identity, path canonicalization, distinct-path isolation, and serialization across two-call-site appends.
- **`reducer/index.ts` circuit breaker stuck open** — the breaker incremented `consecutive_failures` on every `kind=error` event but never reset on success, so a single transient adapter failure permanently pinned the actor to OPEN/fallback for the rest of the session. Now any non-error event from a previously-failing actor closes the breaker and zeroes the failure streak (`last_failure_id` preserved for audit). Two regression tests in `src/reducer/index.test.ts`.

102 tests pass (was 93). All four fixes are determinism-preserving — no clock or randomness introduced; replay over the same transcript still yields identical state.

### Added — v0.2.0 Budget guardrails + autoresearch ratchet (2026-05-02)

Five P0 hard caps and one autoresearch-style keep/revert ratchet — closes the "what stops the loop" gap surfaced by `wiki/concepts/bagelcode-budget-guardrails.md`. All caps are determinism-preserving (replay over the same transcript yields identical state).

- **`respec_count ≤ 3`** (`src/reducer/index.ts` §RESPEC_MAX) — `kind=spec.update` increments; cap → `done(too_many_respec)`. Initial spec is the first try, not a respec.
- **`verify_count ≤ 5`** (`src/reducer/index.ts` §VERIFY_MAX) — `kind=judge.score` increments (NOT `verify.result`, which is the legacy alias the verifier emits alongside; counting both halves the cap). Cap → `done(too_many_verify)`. **Promoted P1 → P0** per the user's "루프 과도하게 안 돌게" lock.
- **`tokens_total`** (`src/reducer/index.ts` §TOKEN_BUDGET_HOOK / §TOKEN_BUDGET_HARD) — sums `metadata.tokens_in + tokens_out` across every event. 40K crossing → `hook(token_budget)` (transition guard via prev/next compare); 50K → `done(token_exhausted)`. Counts on every kind, not just LLM events — covers system messages too.
- **`per_spawn_timeout ≤ 5min`** (`src/dispatcher/live.ts` §PER_SPAWN_TIMEOUT_MS, autoresearch P3) — `AbortController` + `setTimeout` in the dispatcher; `SpawnRequest.signal` threaded through to all 4 adapters (claude-local / codex-local / gemini-local / mock). Live adapters wire signal → `child.kill('SIGTERM')`; mock checks `signal.aborted` between canned steps. On timeout: `kind=error` with `body="per_spawn_timeout: ..."` and `data.reason="per_spawn_timeout"`. Reducer's existing error branch trips `circuit_breaker.consecutive_failures`.
- **`session_wall_clock`** (`src/loop/coordinator.ts` §WALL_CLOCK_HOOK_MS_DEFAULT / §WALL_CLOCK_HARD_MS_DEFAULT, autoresearch P3) — coordinator's setInterval watchdog tracks `Date.now() - Date.parse(state.progress_ledger.session_started_at)`. 24min crossing → `hook(time_budget)` (one-shot via `timeBudgetHookFired` boolean); 30min → `state.done = true`, drain `processing` chain, dispatch `done(wall_clock_exhausted)`.
- **Autoresearch P4 keep/revert ratchet** (`src/reducer/index.ts` §RATCHET_REGRESSION_THRESHOLD) — tracks `max_aggregate_so_far` + `max_aggregate_msg_id` across every `judge.score`. A drop of ≥ 2 aggregate points triggers `done(ratchet_revert)`. Prevents unbounded score-oscillation loops where the verifier swings between PASS/PARTIAL on minor refactors.

State extensions (`src/state/types.ts ProgressLedger`): `respec_count`, `verify_count`, `session_token_total`, `session_started_at`, `per_spawn_started_at`, `max_aggregate_so_far`, `max_aggregate_msg_id`. All zero/empty in `initialState` so existing tests pass without churn.

`design/DESIGN.md` (Phaser 3.80 + ≤60KB envelope) was promoted to `agents/specialists/game-stack-constraint.md` so the planner's step.design now inline-reads 4 specialists (concept-designer / researcher / visual-designer / game-stack-constraint) and builder/builder-fallback read the envelope from the same agents/specialists/ tree as everything else.

`RunOptions` adds `wallClockHookMs / wallClockHardMs / watchdogTickMs / perSpawnTimeoutMs / extraAdapters?` for tests and ops overrides; defaults match the wiki budget table.

### Added — v0.1.1 Multi-host harness pivot (2026-05-02)

Universal identity layer + sandwich Markdown unification + multi-host entry verifier. Closes the "host-aware control harness" loop opened by v0.1.

- **`CRUMB.md`** (repo root, 174 lines) — Crumb runtime identity, host-agnostic. Sibling of `AGENTS.md` (Linux Foundation Agentic AI Foundation contributor identity); the two have separate responsibilities — `AGENTS.md` tells contributors how to work on this repo, `CRUMB.md` tells the host harness what Crumb is. 11 architecture invariants, 5 actor + 3 specialist + 5 skill flow, 39 kind schema, multi-host entry table, preset philosophy, universal Don't / Must.
- **`wiki/references/bagelcode-multi-host-harness-research-2026.md`** (~700 lines, 9 part) — research basis for the pivot. Part 1: 7 frontier cases verbatim (bkit-claude-code / claude-flow / contains-studio/agents / openclaw skills/coding-agent / hermes-agent / Linux Foundation AGENTS.md / gamestudio-subagents). Part 2: 7×6 dim matrix. Part 3: 5 핵심 발견 (host 위 universal control = D + F 둘 뿐). Part 4: Crumb 3-tier identity 청사진. Part 5: 차용/회피/신설 매트릭스. Part 6: 1차 5 결정. Part 7: context hierarchy 추가 4 사례 (Claude Code memory `@path` import / Cursor rules / Spec-kit `.specify/` / Gemini CLI extensions). Part 8: `.crumb/` 재정렬 3 옵션 비교 (절충안 권장). Part 9: 추가 5 결정.
- **Host entries import CRUMB.md + AGENTS.md as universal identity prelude**: `.codex/agents/crumb.toml` (developer_instructions §0), `.gemini/extensions/crumb/GEMINI.md` (header banner), `.gemini/extensions/crumb/commands/crumb.toml` (prompt §0). Pattern source: Spec-kit `.specify/memory/constitution.md` referenced by every host integration.
- **`crumb init` command** (`src/helpers/init.ts` + `src/cli.ts`) — multi-host entry verifier, distinct from `crumb doctor`. Verifies `CRUMB.md` / `AGENTS.md` + per-host entries (`.claude/skills/crumb`, `.codex/agents`, `.gemini/extensions/crumb`). Subcommands: `crumb init` (default = check all), `--host claude|codex|gemini`, `--format human|json` (human is default; json for scripts/CI). Exits non-zero on missing files. 7 vitest specs.

### Changed — v0.1.1

- **5 sandwiches converted from XML-in-Markdown wrapper to claude-code style pure Markdown** (per Part 7 contains-studio/agents + Linux Foundation AGENTS.md + multi-host research): `agents/coordinator.md` (routing-rules v0.1 — `build → qa_check → verifier`), `agents/planner-lead.md` (handoff target = `builder`, v2 `engineering-lead` retired), `agents/builder.md`, `agents/verifier.md`, `agents/builder-fallback.md` (builder substitute, v2 engineering-lead substitute retired). Tokenizer-friendly imperatives preserved: heading-as-command (`## Don't`, `## Must`, `## Reminders`), imperative bullets (❌ / STOP / Don't try), blockquote emphasis. All Korean narrative removed for English consistency. Ref: `wiki/references/bagelcode-multi-host-harness-research-2026.md` §Part 5.
- **`AGENTS.md`** updated to Linux Foundation Agentic AI Foundation v0.1 standard — 11 invariants (added v0.1: actor split / 3-tuple binding / user-controlled preset), file map updated for v0.1 (builder/verifier split, qa-runner.ts, preset-loader.ts, helpers/, multi-host entries), forbidden + must lists v0.1-aligned.
- **`.claude/skills/crumb/SKILL.md`** References section now imports `CRUMB.md` + `AGENTS.md` as the first two reference targets — the host loads them before any actor sandwich.

### Added — v0.1 Multi-host × (harness × provider × model) tuple (in progress)

- **System architecture v0.1 lock** (`wiki/concepts/bagelcode-system-architecture-v0.1.md`) — Multi-host 4 entry (Claude Code + Codex CLI + Gemini CLI + headless), (harness × provider × model) 3-tuple actor binding with ambient fallback, 5 actor (coordinator / planner-lead / **builder** / **verifier** / builder-fallback) + 3 specialist + 5 skill, 3-layer scoring (reducer auto + qa_check effect + verifier CourtEval), MCP server (Provider) for cross-host self-hosted exposure, auth-manager (`/crumb doctor`) for environment readiness, persistence boost (`crumb resume <session-id>` + adapter session-id metadata + flock). Replaces v2 `bagelcode-system-architecture.md` §1-§2 topology; v2 §3-§9 absorbed.
- `wiki/references/bagelcode-frontier-cli-convergence-2026.md` — 2026-04 Claude Code / Codex / Gemini / OpenCode 4 CLI convergence on 7 common primitives (subagents / plan / ask-user / parallel / sandbox / memory / MCP). Source for unified entry design.
- `wiki/references/bagelcode-llm-judge-frontier-2026.md` — CourtEval ACL 2025 / G-Eval / Position bias IJCNLP 2025 / Self-bias NeurIPS 2024 / Multi-judge consensus 97-98% F1. Academic backbone for 3-layer scoring.
- `wiki/references/bagelcode-gamestudio-subagents-2026.md` — pamirtuna/gamestudio-subagents (193⭐) detailed analysis. Market validation of host harness pattern.
- `wiki/concepts/bagelcode-budget-guardrails.md` — analysis of post-verify ratchet runaway across three axes (max iteration / wall-clock / token cost). Documents the 5 guardrails currently enforced in `src/reducer/index.ts` and `src/loop/coordinator.ts`, the 8 gaps still open, sprint-demo thresholds, and a P0 implementation plan (4 guardrails, ~1.5h: `respec_count<=3`, `session_wall_clock<=30min`, `per_spawn_timeout<=5min` SIGTERM, `tokens_total<=50K`). Synced from mango-wiki ingest 2026-05-02T21:00:00Z.

### Changed — v0.1 (in progress)

- `protocol/schemas/message.schema.json`:
  - `from` enum: `engineering-lead` → split into `builder` + `verifier` (8 actors total, was 7).
  - `kind` enum: +`qa.result` (39 kinds, was 38). First-class deterministic ground truth event emitted by dispatcher (no LLM).
  - `scores`: replaced 6-dim legacy vocabulary (`goal_completion` / `collaboration` / `groundedness` / `actionability` / `cost_efficiency` / `intervention_response`) with D1-D6 source-of-truth matrix (`D1 spec_fit` / `D2 exec` / `D3 observability` / `D4 convergence` / `D5 intervention` / `D6 portability`); each dimension carries `score` + `source` (verifier-llm / qa-check-effect / reducer-auto / hybrid) + optional `lookup` / `evidence` / `auto` / `semantic` / `quality`. CourtEval msg-id refs (`grader_msg_id` / `critic_msg_id` / `defender_msg_id` / `regrader_msg_id`) added under `scores.courteval`.
  - `metadata`: +`harness` / `provider` / `adapter_session_id` / `cache_carry_over` / `deterministic` / `cross_provider` (for self-bias detection and adapter cache continuity per [[bagelcode-system-architecture-v0.1]] §3.6 + §5.2.2).
- `agents/`: `engineering-lead.md` removed; split into `agents/builder.md` (Builder + QA inline) + `agents/verifier.md` (CourtEval 4 sub-step inline + reviewer persona, superpowers code-reviewer pattern). Reason: cross-provider true split — builder=Codex / verifier=Gemini (or claude-code) requires actor-level provider boundary, not sandwich-internal step boundary.

### Added — Observability P0 (Option B, 2026-05-02)

Implements the v0.1 §10 4-surface lock (minus `crumb diagram` — explicitly de-scoped) with Crumb Design System (CDS) v1 tokens and RESTful `/sessions/{id}/...` URL-as-file-path layout.

- **summary.html generator** (`src/summary/render.ts` + `src/summary/cds.ts`, ~700 LOC) — pure function (transcript, state) → single-file HTML. 6 sections (Artifacts iframe + spec/DESIGN refs, D1-D6 Scorecard with SourceBadge + radar, per-actor Cost stacked bar + cache hit, CourtEval 4 sub-step traces, filterable virtualized Timeline, F1-F7 Fault diagnosis). Inline CSS + inline JS + chart.js@4 CDN; ≤ 60KB own code mirrors DESIGN.md "single-file artifact" budget. 15 vitest specs.
- **TUI** (`src/tui/app.ts` + `src/tui/format.ts`, ~330 LOC) — blessed-based live observer. 4 panes (header / scrollable Timeline / agents+adapters / status / command input). Slash commands (`/approve /veto /redo /note /pause /resume /q`) write `user.*` events back through `TranscriptWriter` — same path as dispatcher, indistinguishable downstream. 10 vitest specs on the pure formatter; live screen tested via end-to-end mock run.
- **OTel GenAI exporter** (`src/exporter/otel.ts`, ~170 LOC) — alias-only mapping (no LLM). 3 formats: `otel-jsonl` (OpenTelemetry GenAI Semantic Conventions), `anthropic-trace` (Claude Console import), `chrome-trace` (chrome://tracing). 12 vitest specs covering attribute aliases, parent_event_id chain, per-actor `tid` lane assignment, latency-derived `dur`/`end_time_unix_nano`.
- **Auto-emit on session end** (`src/loop/coordinator.ts`) — when `state.done` becomes true, write `sessions/<id>/index.html` (RESTful summary view) + `sessions/<id>/exports/{otel.jsonl, anthropic-trace.json, chrome-trace.json}`. File path == URL path = identical behaviour for `file://` double-click and future `crumb observe` HTTP server.
- **Crumb Design System v1** (`src/summary/cds.ts`) — 8 token classes (color / typography / spacing / radius / shadow / breakpoint), 10 component vocab (ActorBadge / KindChip / DeterministicStar / CrossProviderBadge / VerdictPill / ScoreCell / SourceBadge / CostBar / MiniSpark / TimelineRow / AuditChip). TUI symbols ↔ HTML hex 1:1 — viewer cognitive load 0 across surfaces.
- **CLI subcommands**: `crumb tui <session-id|dir>`, `crumb export <session-id|dir> [--format otel-jsonl|anthropic-trace|chrome-trace]`.

### Added — v0.1 §12 5-helper completion + 3-host MCP registry (cross-host NL trigger)

Goal: user can speak natural Korean / English on any of the 3 hosts (Claude Code / Codex CLI / Gemini CLI) and have Crumb route the request to the right helper.

- **3 missing helpers** (`src/helpers/{status,explain,suggest}.ts`, ~480 LOC + 21 vitest specs):
  - `crumb status <session>` — recent N signal events + latest D1-D6 scorecard with source-of-truth + cost/cache/wall totals.
  - `crumb explain <kind>` — schema lookup over the full Kind union (40 entries: 4 system + 11 workflow + 5 dialogue + 5 step + 5 user + 3 handoff + 7 meta — wiki §3.3 mis-counted meta as 6). Did-you-mean for partials.
  - `crumb suggest <session>` — branching next-action recommendation: PASS+clean → /approve / PARTIAL → user judgment / FAIL → /redo+hint / stuck≥5 → /pause+/crumb debug / build pending → wait / done → open summary.
  - CLI subcommands wired in `src/cli.ts`.
- **MCP server** (`src/mcp-server.ts`, ~190 LOC, 2 vitest specs) — `@modelcontextprotocol/sdk@^1.29.0` stdio server exposing 7 read-only tools, named brand-forward to mirror the CLI subcommand 1:1 (precedent: OpenAI Codex CLI exposes its MCP tool as `codex` / `codex-reply`, server-name == tool-name): `crumb_config` / `crumb_status` / `crumb_explain` / `crumb_suggest` / `crumb_debug` / `crumb_doctor` / `crumb_export`. One vocabulary across CLI + MCP — no drift, brand instantly recognizable to the host model. Tool descriptions encode KO+EN trigger phrases — single source-of-truth registry shared across 3 hosts. Verified via stdio JSON-RPC smoke test (`initialize` → `tools/list` returns all 7).
- **3-host registration**:
  - `.mcp.json` (Claude Code project root) — registers `crumb` MCP server with `CRUMB_AMBIENT_HARNESS=claude-code`.
  - `.codex/agents/crumb.toml` `[mcp_servers.crumb]` — `CRUMB_AMBIENT_HARNESS=codex`.
  - `.gemini/extensions/crumb/gemini-extension.json` `mcpServers.crumb` — `CRUMB_AMBIENT_HARNESS=gemini-cli`, path corrected from `${extensionPath}/../../src/...` to `${workspacePath}/src/...`.
- **Claude Code sub-skills** (`.claude/skills/crumb-{config,status,explain,suggest,debug,doctor,export}/SKILL.md`, 7 files) — each frontmatter `description` carries explicit KO+EN trigger phrases, body says "prefer MCP tool, fall back to bash CLI". Eager-loaded by Claude Code skill discovery → faster NL match than waiting for MCP server boot.

### Added — Option B observability boosts (W4 / W5 / W6)

- **W4 sandbox audit** — timeline expand surfaces `tool.call.data.{cwd, add_dir, permission_mode}` + `metadata.adapter_session_id`. Anthropic gVisor pattern equivalent without their UI.
- **W5 F1-F7 fault diagnosis** — `summary.html §6 Faults` reuses `helpers/debug.ts diagnose()` (no transcript mutation). Detected faults render as red pills with suggested actions; clean session shows `CLEAR`. Reads metadata.cross_provider, kind=qa.result coverage, kind=error patterns, stuck_count.
- **W6 score-history MiniSpark + stuck pill** — header carries inline SVG sparkline of `score_history` aggregates (range 0-30) + verdict transitions (e.g., `18.0 → 27.0`) + colored stuck pill (0/5 ok / ≥5 err).

### Added — implementation plan markers

- S2 spike: `scripts/spike-env-propagation.sh` — 30-min validation of env propagation across 3 host harnesses (Claude Code Task / Codex subagent / Gemini extension MCP) before specialist work begins. Result to be ingested as `wiki/synthesis/bagelcode-env-propagation-spike-2026-05-02.md`.

### Fixed

- `wiki/concepts/bagelcode-budget-guardrails.md` frontmatter — `[[bagelcode-fault-tolerance-design.md]]` → `[[bagelcode-fault-tolerance-design]]` (drop `.md` suffix) and `[[adaptive stop]]` → `[[bagelcode-final-design-2026|adaptive stop]]` (point to canonical doc). Provenance recomputed: stated 0.55/0.40/0.05 had drifted from actual 0.78/0.17/0.05 (4 inferred + 2 ambiguous markers across ~30 content claims).
- `wiki/synthesis/bagelcode-paperclip-vs-alternatives.md:42` — broken wikilink `[[paperclip-mcp]]` (target page never existed) replaced with plain text "Paperclip MCP".
- `wiki/bagelcode.md` (hub) — added a 2026-05-02 update banner pointing to `[[bagelcode-final-design-2026]]` as canonical lock; rewrote the "권장 방향" line so the verifier reads "CourtEval verifier" instead of the v2 "Gemini Verifier (cross-provider)" (which was dropped on cost grounds when Gemini was eliminated). Updated "결정 대기 중" todos to reflect resolved decisions (verifier=CourtEval, repo=public github, game=Phaser ≤60KB).

Note: 7 mid-version pages (`agents-fixed`, `caching-frontier-2026`, `task-direction`, `orchestration-topology`, `caching-strategy`, `fault-tolerance-design`, plus the hub before this fix) still reference Gemini as the verifier provider in body text. These are kept as historical evolution context — `final-design-2026.md` is the canonical answer; the hub banner now signals the supersession. Auto-rewrite of these 7 pages is left to the user's wiki maintenance pass.

## [0.1.0] — 2026-05-02

First public release. Walking skeleton end-to-end with the `mock` adapter; real subprocess adapters wired but unverified at runtime.

### Added

- Pure reducer (`src/reducer/`) with circuit breaker, adaptive stopping, rollback, and `user.veto` rebound rules. 10 vitest specs.
- Append-only JSONL transcript writer with ULID + ISO-8601 ts auto-injection (`src/transcript/writer.ts`); 3 vitest specs covering schema rejection and concurrent serialization.
- ajv 2020-12 runtime validation against `protocol/schemas/message.schema.json` (28 kinds × 11 fields).
- Adapter interface + `claude-local` (subprocess via Claude Max), `codex-local` (subprocess via OpenAI Plus), and `mock` (deterministic synthetic agent for demos and tests).
- Live dispatcher (`src/dispatcher/live.ts`) executing reducer effects (spawn / append / hook / rollback / done / stop).
- Coordinator main loop (`src/loop/coordinator.ts`) with replay-on-start, fs.watch tail, idle watchdog, and terminal-state guard.
- CLI subcommands: `crumb run --goal ... [--adapter mock]`, `crumb event` (subprocess append helper, reads JSON from stdin), `crumb replay <session-dir>`, `crumb doctor` (adapter health), `crumb ls`.
- Sandwich files for the four outer actors: `agents/coordinator.md` (Haiku 4.5), `agents/planner-lead.md` (Sonnet 4.6), `agents/engineering-lead.md` (Codex GPT-5.5, Markdown), `agents/builder-fallback.md` (Sonnet 4.6 fallback when Codex circuit OPENs).
- `agents/_event-protocol.md` — canonical reference for how subprocess agents emit transcript events via `crumb event`.
- CI workflow: lint + typecheck + format + test matrix (Node 18 / 20 / 22) + JSON Schema compile + sandwich presence check.
- Bagelcode design rationale subset bundled at `wiki/` (28 docs mirrored from `~/workspace/mango-wiki/vault/projects/bagelcode/`).
- Raw research material at `raw/bagelcode-research/` (TradingAgents arXiv 2412.20138 + observability frontier 2026-05).
- Production skill bundle at `skills/`: llm-evaluation, mermaid-diagrams, skill-creator.
- Operational skill bundle at `.skills/` (gitignored): 12 wiki maintenance + 12 implementation workflow (gitflow, changelog, anti-deception-checklist, karpathy-patterns, agent-ops-debugging, kent-beck-review, verification-team, frontier-harness-research, codebase-audit, pr-reviewer, deep-researcher, arxiv-digest).
- `CLAUDE.md` (project-rooted) — quick orientation, project layout, skill routing tables, CI ratchet rule (Karpathy P4: never merge red), progress-tracking directive.
- `AGENTS.md` (Linux Foundation Agentic AI Foundation standard) — architecture invariants and per-actor sandbox rules.
- README.md / README.ko.md aligned with shipped CLI; status table marks shipped vs in-progress.

### Notes

The walking skeleton is verified end-to-end with `--adapter mock`: a 22-line transcript covering `session.start → goal → planner spawn (4 step.* + spec) → engineering spawn (5 step.* + judge.score PASS) → done` is produced and replays deterministically. The real `claude-local` and `codex-local` adapters are wired but a real subprocess round-trip with sandwich-driven event emission is **not yet verified at runtime** — that is the next milestone before submission.

[Unreleased]: https://github.com/mangowhoiscloud/crumb/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/mangowhoiscloud/crumb/releases/tag/v0.1.0
