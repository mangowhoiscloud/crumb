# Kirby Sidescroll v1 — spec.md

## Title
Kirby-style 2D sidescroll platformer with inhale + 5-jump float + copy-ability and Whispy Wood boss.

## Goal (one paragraph)

A 60–90 second playable Phaser 3.80 web game faithfully reproducing Kirby canon (Dream Land 1992, Adventure 1993, Super Star 1996) inside Crumb's profile C (`sidescroll-2d`) envelope. The player controls a peach-pink protagonist who walks/runs across one stage (3 horizontal screens, ~1920 px logical), jumps once on the ground plus floats for up to 5 additional air-jumps before forced descent, inhales enemies in a 72 px / 45° forward cone, swallows them to copy ability (sword / fire / spark), and ultimately defeats the stationary **Whispy Wood** boss (HP 6 base / HP 4 with sword equipped; drops apples every 2.5 s with 200 ms predictive lead; summons one Flier every 3 s). Touch-first mobile via on-screen DPad overlay, full keyboard fallback (Arrow + WASD + Space + Z + X + Esc). Local-only persistence via IndexedDB / Dexie. Warm-pastel Nintendo-feel palette.

## Acceptance Criteria (testable from outside)

- **AC1**: BootScene preloads procedural sprites; 5 scenes (Boot / Menu / Game / GameOver / Victory) registered in Phaser game registry; stage canvas renders at 640×360 logical (or scaled FIT) with `window.__GAME__` debug hook exposed once GameScene is active.
- **AC2**: Movement — `ArrowLeft` / `ArrowRight` AND `a` / `d` keys both move Kirby horizontally ≥ 10 px within 200 ms (envelope-required dual binding for movement games per `agents/specialists/game-design.md` §1.1).
- **AC3**: Jump + float — `Space` (or `w` / `ArrowUp`) starts jump; up to 5 additional in-air taps extend hover (each at -180 px/s burst); the 6th tap triggers a 200 ms exhale animation then forces a slow 80 px/s descent (canonical 5-jump cap).
- **AC4**: Inhale — holding `z` ≥ 120 ms in front of a Waddler within 72 px / 45° cone pulls the Waddler into mouthful state within 500 ms (Waddler removed from scene; `window.__GAME__.player.state === 'mouthful'`).
- **AC5**: Copy ability — with mouthful sourced from a Slasher (sword-bearing) enemy, pressing `x` once enables HUD ability slot showing `sword` icon within 1000 ms (`window.__GAME__.abilityHeld === 'sword'`).
- **AC6**: Boss arena — when `player.x ≥ 1700`, Whispy Wood entity instantiates with visible HP marker; trunk does NOT damage on contact (`boss_whispy_wood.trunk_contact_damage = 0`); apples drop every ~2500 ms with 200 ms predictive lead over the player's current X.
- **AC7**: Victory — Whispy Wood HP reaching 0 triggers VictoryScene transition within 500 ms.
- **AC8**: Persistence — completing a run writes a `runs` IndexedDB row via Dexie 4 (`window.__GAME__.persistence.saveRun({ score, duration_ms, seed })` resolves to a numeric id); `topScores(10)` returns ordered descending-by-score array.
- **AC9**: PWA offline — after first load, refreshing the page with the network disabled still boots the game (service worker cache shell).
- **AC10**: Reduced motion — when `prefers-reduced-motion: reduce` is set, screen shake is 0 px and hit-stop ≤ 8 ms.

## Rule Book

1. **HP / lives** — Player has 6 HP and 3 lives. HP reaching 0 = lose 1 life and respawn at stage start (no checkpoints in v1). 0 lives → GameOverScene.
2. **iframes** — Player takes at most 1 damage per 1000 ms (1 from any enemy contact, 1 from boss apple, 0 from boss trunk).
3. **Inhale** — `z` hold ≥ 120 ms pulls the nearest enemy within 72 px / 45° forward cone at 180 px/s. One enemy at a time.
4. **Mouthful window** — After pull-in, mouthful is held for ≤ 2000 ms. While mouthful active: `x` tap = spit star (1 dmg projectile, 240 px/s, 1500 ms lifetime); `x` hold ≥ 250 ms = swallow → grant ability if enemy carried one (Burner→fire, Slasher→sword; Spikee/Waddler/Flier→none). After 2000 ms, mouthful auto-discards as a spit star.
5. **Discard ability** — `x` long-hold ≥ 500 ms when an ability is equipped removes it.
6. **Float** — Max 5 air-jumps, each at -180 px/s burst. The 6th tap forces 200 ms exhale animation then slow 80 px/s descent (canonical Kirby cap). Holding/tapping further does NOT extend hover.
7. **Boss** — Stationary tree, HP 6 base / 4 with sword equipped. Drops apples (vertical projectile 140 px/s, 200 ms predictive lead over player X, every 2500 ms). Summons one Flier from off-screen-top every 3000 ms. Trunk inflicts 0 damage on contact.
8. **Damage values** — Spit star = 1 dmg; sword swing = 1.5 dmg / 250 ms cooldown / 28 px range / 90° arc; fire = 1.0 dmg every 200 ms over 1000 ms / 64 px range; spark = 1.0 dmg in 32 px radius over 600 ms / 500 ms cooldown.
9. **Reduced motion** — When `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, set `shake_*_px = 0` and clamp `hit_stop_*_ms ≤ 8`.

## Constraints (binding)

- **Stack**: Phaser 3.80+ via CDN — `https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js`
- **File tree**: `artifacts/game/` multi-file PWA per `agents/specialists/game-design.md` §1.1, ≤ 30 files, ≤ 8 MB total (profile C exception)
- **No build step** — ES modules + import map in `index.html`. Forbidden: webpack / vite / parcel / esbuild
- **Audio**: procedural Web Audio (1 BGM lead + 4 SFX via Oscillator + jsfxr seeds embedded in `systems/AudioManager.js`); zero audio asset files
- **Sprites**: procedural Canvas rendering in BootScene; zero `.png` asset files (procedural-first envelope rule)
- **Persistence**: IndexedDB via Dexie 4 in `src/systems/PersistenceManager.js`; tables `runs` (`++id, score, duration_ms, seed, created_at`) and `best` (`&game_slug, best_score`)
- **Input**: keyboard (`ArrowLeft|Right|Up`, `WASD`, `Space`, `z`, `x`, `Escape`) AND touch DPad overlay (mobile primary, shown on `pointer: coarse`)
- **Genre profile**: `sidescroll-2d` (locked from `step.socratic` defaults + researcher confirmation)
- **Persistence profile**: `local-only` (no leaderboard markers in goal)
- **Camera**: `cameras.main.startFollow(player, true, 0.1, 0.1)` smooth lerp
- **Parallax**: exactly 4 TileSprite layers, scrollFactors `[0.0, 0.2, 0.5, 1.5]`
- **Network**: zero runtime requests after CDN load + SW first-fetch (offline guarantee — AC9)
- **Debug surface**: `window.__GAME__` exposed once GameScene is active (per `DESIGN.md` §9)
- **Forbidden**: Three.js, glTF / FBX, real-time shadows, PBR materials, subpixel motion (`Math.round` all positions), Phaser 2 syntax, runtime network requests, IAP / ads / live ops references

## Non-Goals (explicit cuts for v1)

- Multiple stages / level select
- Mid-run save state / checkpoints
- Global leaderboard (persistence profile = `local-only`)
- More than 3 copy abilities (sword / fire / spark only — no ice / cutter / needle / etc.)
- Mid-air dash / dash-cancels
- Multiplayer / co-op
- Cutscenes or story dialog
- IAP / ads / live ops

## Genre profile: `sidescroll-2d`
## Persistence profile: `local-only`
