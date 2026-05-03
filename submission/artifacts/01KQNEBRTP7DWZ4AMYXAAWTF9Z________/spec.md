# Reba's Adventure — Berserker Mode (레바의 모험: 버서커)

## Title & Pitch

A 60-second wave-survival score-attack tribute to 김특용's classic Korean Flash game **레바의 모험 (Reba's Adventure)**. The player taps to attack — Reba auto-targets the nearest enemy. Each kill fills a RAGE meter; at 100% RAGE, **Berserker Mode** unleashes a 5-second flurry (×3 attack rate, ×2 damage, red-tint screen). Survive 60 seconds of escalating waves and chase a high score.

Mobile-first PWA, single-tap mechanic, portrait 320–428px, runs offline.

## Acceptance Criteria

All criteria are externally testable from the running game. Items marked **[deterministic]** have a corresponding `ac_predicates` entry; items marked **[subjective]** are judged by the verifier LLM playthrough (Playwright MCP).

- **AC1 [deterministic]**: On load, the game initializes within 3 seconds — a Phaser canvas renders, Reba's sprite is anchored center-bottom (anchor.y ≈ 0.85 of viewport), and `window.__GAME__.scene === "GameScene"` (the game auto-starts the play scene; no blocking menu).
- **AC2 [deterministic]**: Tapping anywhere on the play area during the first 10 seconds kills the nearest slime and increments `window.__GAME__.score` by ≥ 1. (Free-win opener — research lesson L1.)
- **AC3 [subjective]**: When the player accumulates enough kills to fill RAGE to 100, Berserker Mode activates — `window.__GAME__.berserker_active === true` for 5 seconds, then enters a 3-second cooldown (`window.__GAME__.berserker_cooldown` ticks 3 → 0); target uptime ratio ≈ 62% (research lesson L2). Verifier LLM playthrough drives Reba through enough kills to observe the burst + cooldown cycle.
- **AC4 [deterministic]**: At elapsed_time ≥ 60 seconds, the game ends — `window.__GAME__.scene === "GameOverScene"` and the DOM shows a final score, kill count, and a Retry button.
- **AC5 [deterministic]**: Reba's HP starts at 100 (`window.__GAME__.hp === 100`); enemies that reach Reba reduce HP per the `enemy.damage` table in `tuning.json`. When HP reaches 0, the game immediately ends to `GameOverScene`.
- **AC6 [subjective]**: Hit-feedback is visually punchy and lands within the 60–80ms perception window — kill flash, score pop, and (in Berserker mode) screen shake all feel responsive on a real mobile device. (Research lesson L3 — verifier LLM playthrough channel.)
- **AC7 [deterministic]**: After 30 seconds elapsed, ghost enemies appear in the spawn pool (`window.__GAME__.spawn_pool` includes `"ghost"`). Slimes are present throughout; bats appear after 10s.

## Rule Book

### Core Loop
1. Reba is fixed at the center-bottom of the play area.
2. Enemies spawn in a 180° arc above her and walk/fly toward her position.
3. Single-tap anywhere on the play area triggers Reba's attack against the nearest enemy on a per-tap basis (no auto-fire).
4. Each kill grants score and RAGE based on enemy type.
5. At 100 RAGE, **Berserker Mode** auto-activates for 5s: attack rate ×3, damage ×2, red screen tint, screen shake on every kill.
6. Berserker enters a 3s cooldown after burst expires; RAGE meter resets to 0.
7. Run ends at 60s elapsed (success) or HP=0 (failure). Game-over screen shows final score, kill breakdown, time survived, and a Retry button.

### Difficulty Phases
| Phase | Time (s) | Enemy Pool | Spawn Rate (enemies/s) | Cap |
|---|---|---|---|---|
| Free-win opener | 0–10 | slime | 0.5 | 4 concurrent |
| Mid | 10–30 | slime, bat | linear ramp 0.5 → 0.9 | 6 concurrent |
| Late | 30–60 | slime, bat, ghost | linear ramp 0.9 → 1.67 (cap 1/0.6s) | 8 concurrent |

The 8-concurrent cap is reached **only** in the [30, 60s] late phase (research lesson L4 — verifier may spot-check via Playwright MCP).

### Berserker Cadence
- Burst duration: 5s (research-confirmed perception sweet spot).
- Cooldown: 3s (refined from initial 2s — reference uptime envelope; lesson L2).
- Uptime ceiling: 5/(5+3) ≈ 62%.

### Scoring
- Base kill score: slime=1, bat=2, ghost=4.
- Combo multiplier: chain kills within 1.5s of each other for ×1.0 → ×1.5 → ×2.0 → ×3.0 (cap).
- Berserker multiplier: ×2 on top of combo while `berserker_active`.

## Constraints

- **Stack envelope**: §1.1 multi-file profile from `agents/specialists/game-design.md`. Phaser 3.80+ via CDN; no bundlers; ES modules + `<script type="module">` + import map; PWA (manifest + service worker); offline after first load; ≤ 5 MB total, ≤ 25 files.
- **Persistence**: none. Goal contains no leaderboard markers — §1.2 postgres profile is OFF.
- **Mobile-first**: portrait viewport 320–428px; `Scale.FIT`; touch hit zones ≥ 44×44px; `touch-action: none`; safe-area inset top 24px / bottom 34px.
- **Audio**: Web Audio synth — 1 lead BGM (looping ostinato, retro chiptune feel) + 4 SFX (tap_attack, kill, berserker_activate, hp_damage). No `<audio src="...">`.
- **Performance**: 60fps on iPhone Safari 16+ / Android Chrome 100+; `max_concurrent_enemies = 8`.
- **Accessibility**: WCAG AA contrast ≥ 4.5:1 on text vs background; color + shape distinguishability for color-blind users; `prefers-reduced-motion` fallback halves all motion timings and disables screen shake.
- **State surface**: the game MUST expose a stable `window.__GAME__` debug surface with at minimum `{ scene, score, rage, berserker_active, berserker_cooldown, hp, elapsed_s, spawn_pool, kill_count }` for AC predicate evaluation. `scene` is one of `"GameScene"` / `"GameOverScene"`. The game auto-starts `GameScene` on load (no blocking menu).
- **Tap input**: every Phaser pointerdown event on the canvas in `GameScene` triggers Reba's attack on the nearest enemy (single tap, no multi-touch). Browser-dispatched `PointerEvent('pointerdown')` MUST reach the Phaser input system.

## Non-Goals

- ❌ Multiple levels or boss fights — single 60s round only.
- ❌ Persistent leaderboard / accounts (no Postgres profile).
- ❌ In-app purchases, ads, or daily-rewards loops.
- ❌ Multi-touch, drag, or swipe gestures — single-tap only.
- ❌ Three.js / Babylon / native engine output.
- ❌ Network requests at runtime beyond the Phaser CDN load.
- ❌ External asset URLs (procedural Canvas sprites; no PNG atlas required for v1).
- ❌ Story / narrative cutscenes — pure score-attack arcade loop.

## IP Homage Notes

- Source: 레바의 모험 by 김특용 (Korean Flash game, ~2003–2010 era).
- Visual cues: Reba as a girl with goggles in pixel-cartoon style; slime/bat/ghost bestiary drawn from the original mini-games; comedic exaggerated hit reactions.
- This is an homage with non-commercial intent; sprite work is procedurally generated (no copied assets).
