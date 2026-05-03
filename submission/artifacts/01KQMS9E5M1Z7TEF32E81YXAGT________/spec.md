# Spec — 고양이 퍼즐 (cat-tap-match3-v1, profile=multi-file)

> Commercial-grade tap-match-3 with a cat theme. Single round of 60 seconds on a
> 6×6 grid; tap a connected cluster (≥3, 4-neighbor flood-fill) to clear; cascades
> chain with a multiplier; reach the score threshold to win. Mobile-web first
> (iOS Safari + Android Chrome), **multi-file PWA deliverable** under
> `artifacts/game/` (per `agents/specialists/game-design.md` §1.1), 60fps target.
>
> **Profile change history**: v1.0.0 sealed as single-file (§1.2). v1.1.0 updated
> via `kind=spec.update` to multi-file profile (§1.1) — game mechanics / AC1–AC7
> behavior / palette / tuning numbers preserved verbatim; only the deliverable
> envelope and the new AC8 (PWA installability) changed.

## 1. Acceptance Criteria (externally testable)

| # | AC | How to test |
|---|---|---|
| AC1 | On load, board renders 36 tiles in a 6×6 grid; HUD shows `time = 60.0s` and `score = 0`. All 5 tile colors pass WCAG-AA ≥ 4.5:1 against board background `#FFF8EE`. | Open page → assert `document.querySelectorAll('[data-tile]').length === 36`; assert HUD text; run contrast check on rendered tile fills. |
| AC2 | Tapping a connected cluster of ≥3 same-type tiles (flood-fill 4-neighbor) clears them within 250ms and adds at least 30 points to `score`. | Construct deterministic seed; tap tile in known cluster of size 3; within 250ms cluster DOM nodes are removed and `score` increments by ≥ 30. |
| AC3 | After a clear, gravity drops remaining tiles and new tiles fill from top; any newly-formed ≥3 cluster auto-clears as a cascade with a per-chain delay of 180ms (±30ms). | Force a board state where one user clear triggers a cascade of length ≥ 2; measure timestamps of consecutive clears. |
| AC4 | A match of 4 tiles spawns a `bomb_paw` special; tapping the bomb_paw clears a 3×3 area centered on that tile. | Force a 4-cluster; verify `data-special="bomb_paw"` element appears at the merge target; tap it; assert 9-tile clear in 3×3. |
| AC5 | A match of 5+ tiles triggers a screen-wide clear of one random color, with a visible clear animation completing in < 600ms. | Force a 5-cluster; assert one whole tile color disappears within 600ms. |
| AC6 | When the timer reaches 0, a result modal renders within 800ms — `Win` (Play Again + Home buttons) if `score ≥ 5000`, otherwise `Game Over` (Retry + Home buttons). | Set `time_limit_s` low via URL query (`?t=2`); wait; assert modal appears and matches branch. |
| AC7 | During the final 10 seconds, the board border pulses red at 2Hz (±0.2Hz) and the HUD timer text turns `#E04848`. | Sample the border color over 1 second; FFT or zero-cross; assert ~2Hz pulse. |
| AC8 | Multi-file PWA deliverable: `artifacts/game/index.html`, `artifacts/game/manifest.webmanifest`, `artifacts/game/sw.js`, `artifacts/game/icon-192.png`, `artifacts/game/icon-512.png` and `artifacts/game/src/main.js` all exist. `manifest.webmanifest` parses as JSON with required keys (`name`, `start_url`, `display`, `theme_color`, `icons[]` w/ 192 + 512). `index.html` registers `sw.js` and the SW responds to `fetch` (cache-first shell). The whole project loads from `npx http-server artifacts/game/` with **zero runtime network requests** after first load (Lighthouse PWA installable = pass). | `npx http-server artifacts/game/` → Playwright opens `localhost:8080`, asserts file presence, parses manifest, intercepts `fetch` events post-load (count must be 0 after SW activation), checks installability via `BeforeInstallPromptEvent` or `chrome://flags` PWA criteria. |

## 2. Rule Book

1. **Grid & tiles** — 6×6 grid, 5 cat tile types (white, black, yellow, gray, calico). Each type has a unique face silhouette as a colorblind-safe redundant cue.
2. **Cluster detection** — 4-neighbor flood-fill over same-type tiles; minimum cluster size for a valid clear is 3.
3. **Scoring** — match_3 = 30, match_4 = 60 and spawns a `bomb_paw`, match_5+ = 150 and triggers screen-wide color clear. Cascade multiplier += 0.5 per chain step, capped at 5.0×.
4. **Specials** — `locked_box` (requires 2 taps to clear, 8% spawn rate after 15s) and `bomb_paw` (clears 3×3 on tap, 5% spawn rate after 30s, also spawned by match_4).
5. **Difficulty curve over 60s round**:
   - 0–15s: basic 5 tile types only
   - 15–30s: locked_box spawns enabled (8%)
   - 30–45s: bomb_paw drops enabled (5%)
   - 45–60s: tile fall speed × 1.3, urgency cues active
6. **Win** — `score ≥ 5000` before timer hits 0.
7. **Lose** — timer hits 0 with `score < 5000`.

## 3. Tuning (numbers in `tuning.json`)

See `artifacts/tuning.json` for full numeric tuning (grid, scoring, motion, urgency,
palette tokens). The spec defines ranges; tuning.json defines the locked v1 values.

## 4. Constraints

- Mobile-web first: must run on iOS Safari ≥ 16 and Android Chrome ≥ 110.
- **Multi-file deliverable** (per envelope §1.1, NOT §1.2 fallback). Required tree:

  ```
  artifacts/game/
    index.html                  # entry; viewport meta + manifest link + SW register + safe-area inset
    manifest.webmanifest        # PWA descriptor (name / icons / start_url / display:standalone / theme_color)
    sw.js                       # cache-first service worker; pre-caches the app shell on install
    icon-192.png                # 192×192 PWA icon (Canvas-rendered or rasterized SVG)
    icon-512.png                # 512×512 PWA icon
    src/
      main.js                   # Phaser config + scene registration
      config/
        gameConfig.js           # canvas size, Phaser.Scale.FIT, physics, palette tokens
        tuning.json             # mirrors artifacts/tuning.json
      scenes/
        BootScene.js            # procedural sprite preload (Canvas API → texture atlas)
        MenuScene.js            # title + start button (44×44 hit zone)
        GameScene.js            # 6×6 board, tap → flood-fill → cascade
        GameOverScene.js        # win / lose modal
      entities/
        Tile.js                 # one tile sprite + face_shape silhouette
      systems/
        AudioManager.js         # Web Audio synth — 1 BGM lead + ≤4 SFX, no <audio src>
        ScoreManager.js         # scoring + cascade multiplier
        InputManager.js         # pointer events + touch-action: none + drag/tap router
  ```

- **No build step**: ES modules + `<script type="module">` (or import map) in `index.html`. Phaser 3.80+ via CDN (`https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js`, SRI-pinned). Vite / webpack / esbuild forbidden — the deliverable must run via `npx http-server artifacts/game/` or any static-file-aware browser open.
- **Total project size** ≤ 5 MB, ≤ 25 files. Procedural sprite generation (Canvas API in `BootScene`) preferred over binary asset files. `assets/sprites.png` + `assets/sprites.json` (texture atlas) are OPTIONAL and only emitted if procedural rendering is insufficient.
- **PWA installability**: `manifest.webmanifest` valid + `sw.js` registered + 192 / 512 icons present (Lighthouse PWA installable check passes).
- **Network**: zero runtime requests after CDN first-load + SW first-fetch — game must run offline (airplane mode reload still boots and is playable).
- **Audio**: Web Audio synth in `systems/AudioManager.js` only. No external `.mp3` / `.ogg` / `<audio src>`.
- Touch hit-target ≥ 44 CSS px per tile (we ship 48 px); inter-tile gap 8 px.
- Board minimum width 288 px; ships at 328 px with safe-area insets respected.
- Color palette: 5 tile colors must pass WCAG-AA 4.5:1 against `#FFF8EE` board background AND remain distinguishable under deuteranopia + protanopia simulation.
- Each tile MUST carry a non-color silhouette cue (face-shape per `tuning.json::palette.tiles.*.face_shape`).
- 60fps target during cascade on a mid-range 2022 device (iPhone 13, Pixel 6a).

## 5. Non-Goals (v1)

- No login, no account system, no leaderboard server.
- No IAP, no ad slots, no monetization integration (skip per Socratic default).
- No multiplayer, no async PvP.
- No localization beyond Korean + English HUD labels.
- No save state across sessions other than `localStorage` best-score.
- No level/world map UI; v1 is a single endless-style round with the 60s timer.

## 6. Acceptance Workflow

The QA actor will exec a deterministic Playwright scenario hitting AC1–AC8 by
serving `artifacts/game/` via `npx http-server` and driving headless Chromium
against `http://localhost:8080`. The verifier's D1 score is anchored to the
count of AC items demonstrably passing in the captured screenshot / DOM trace
+ network log (AC8 requires the post-load fetch counter to be 0). An empty AC
array → automatic D1 = 0; this spec ships **8 testable items** so D1 is bounded
by execution evidence only.

D6 (portability) is anchored to multi-file profile §1.1 conformance: missing
any required file in the §4 tree → D6 = 0. `npx http-server artifacts/game/`
must boot the game without console errors on first paint.
