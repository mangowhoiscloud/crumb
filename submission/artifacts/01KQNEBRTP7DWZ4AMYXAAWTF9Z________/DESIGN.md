# Reba's Adventure: Berserker — DESIGN.md

## §1 Concept (from step.concept)

- **core_mechanic**: 60s wave-survival score-attack — single-tap auto-targets nearest enemy; kills fill RAGE meter; full RAGE unleashes 5s Berserker burst.
- **win_condition**: survive full 60s for end-of-run score screen (no fixed pass score; score chase).
- **lose_condition**: HP=0 → immediate Game Over screen with score breakdown + Retry.
- **combo_rule**: chain kills within 1.5s for ×1.0 → ×1.5 → ×2.0 → ×3.0 multiplier; Berserker stacks an additional ×2.
- **difficulty_curve**: stepped — free-win opener (0–10s, slime-only), mid (10–30s, +bat), late (30–60s, +ghost) with linearly ramping spawn rate inside each phase.

## §2 Palette (from step.design + research evidence)

| Token | Hex / Value | Usage | Contrast vs `background` |
|---|---|---|---|
| background | `#1a0f2e` | scene bg (deep indigo dungeon) | — |
| reba | `#ffd93d` | player sprite (warm yellow goggles-girl) | 11.4:1 ✅ |
| slime | `#7df3e1` | mint-cyan blob enemy | 9.8:1 ✅ |
| bat | `#a855f7` | violet flying enemy | 4.9:1 ✅ |
| ghost | `#f1f5f9` | pale-cyan wisp enemy | 14.2:1 ✅ |
| hp_bar | `#22c55e` → `#ef4444` | green→red ramp | 4.6:1 / 4.9:1 ✅ |
| rage_bar | `#fb923c` → `#ef4444` | orange→red at full | 6.1:1 / 4.9:1 ✅ |
| berserker_overlay | `rgba(239,68,68,0.18)` | red screen tint during burst | overlay |
| text | `#ffffff` | HUD numerals + Game Over labels | 16.5:1 ✅ |
| ui_chrome | `#2d1b4e` | HUD frame backgrounds | — |

- **contrast_min_ratio**: 4.5 (WCAG AA) — all text/icon-on-background pairs verified.
- **colorblind_safe**: true. Enemies are distinguished by **color + shape**: slime = round blob, bat = triangular wings, ghost = wisp/teardrop. HP and RAGE bars use color-ramps **with** numeric labels.
- **evidence_refs**: `01KQNEPMSZC39SX2Q5W85DH04Q` (research synthesis citing Vampire Survivors / Archero / Magic Survival palette analogues).

## §3 Motion Timings (from research evidence)

All timings are **binding** — verifier reads §3 for D5 evidence grounding.

| Event | Duration (ms) | Easing | Source |
|---|---|---|---|
| `hit_flash_ms` | 80 | linear (instant on/off) | research L3 (sub-100ms perception window — Vampire Survivors ~60ms, Archero ~80ms) |
| `kill_animation_ms` | 120 | ease-out | research L3 |
| `berserker_screen_tint_ramp_ms` | 200 | ease-in-out | step.design |
| `berserker_screen_shake_ms` | 80 | shake amplitude 4px | step.design |
| `score_pop_ms` | 250 | ease-out (scale 1 → 1.4 → 1) | step.design |
| `rage_bar_fill_ease_ms` | 150 | ease-out | step.design |
| `game_over_fade_ms` | 600 | ease-in-out | step.design |

`prefers-reduced-motion: reduce` → halves every duration above and disables screen shake entirely.

- **evidence_refs**: `01KQNEPMSZC39SX2Q5W85DH04Q`.

## §4 HUD Layout

```
┌──────────────────────────────────────┐  ← safe_area_top: 24px
│ [HP: ████░░] 70   ⏱ 0:42   SCORE: 184 │
│              [RAGE: ██████ 100/100]   │
│                                      │
│                                      │
│            (play area)               │
│                                      │
│                                      │
│                                      │
│             🟡 ← Reba                │
│                                      │
└──────────────────────────────────────┘  ← safe_area_bottom: 34px
```

- **score_position**: top-right (font 18px white on ui_chrome).
- **timer_position**: top-center (font 16px monospace, format `0:SS`).
- **hp_bar_position**: top-left (bar 80px × 12px + numeric label `current/100`).
- **rage_bar_position**: center-top, full-width-minus-safe-area (16px tall, with `current/100` label).
- **pause_button**: top-left of score (44×44 hit zone).
- **retry_button**: center-bottom on Game Over screen (88×56 button, font 20px).
- **safe_area_top_px**: 24 (iPhone notch clearance).
- **safe_area_bottom_px**: 34 (home indicator clearance).
- **font_min_px**: 14 (body); `font_headline_px`: 24 (Game Over title).

## §5 Accessibility

- **contrast_min**: 4.5:1 (WCAG AA) for all text and HUD glyph-on-background pairs (verified in §2 table).
- **colorblind_safe**: true — enemy color paired with distinct silhouette; bars carry numeric labels.
- **hit_zone_min_px**: 44 (pause + retry buttons + global tap surface).
- **reduced_motion_fallback**: `prefers-reduced-motion: reduce` halves all §3 motion durations and disables screen shake; berserker tint becomes a static overlay (no ramp).
- **audio_cues_for_visual_events**: tap_attack / kill / berserker_activate / hp_damage SFX provide an audio channel for users who can't perceive the visual flash.

## §6 Stack Envelope (binding — from `agents/specialists/game-design.md` §1.1)

- **framework**: Phaser 3.80+ via CDN (`https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js`).
- **profile**: `multi-file` (the only supported profile in v0.3.1).
- **persistence**: none — §1.2 postgres profile is OFF (no leaderboard markers in goal).
- **bundle**: ES modules + `<script type="module">` + import map; **no** webpack / vite / esbuild.
- **viewport**: 320–428 portrait; `Scale.FIT` between min and ideal viewport; `touch-action: none`.
- **audio**: Web Audio synth — 1 BGM lead + 4 SFX (tap_attack, kill, berserker_activate, hp_damage); no `<audio src>`.
- **PWA**: `manifest.webmanifest` + cache-first `sw.js` + 192/512 icon PNGs (Canvas-rendered).
- **performance**: 60fps on iPhone Safari 16+ / Android Chrome 100+; max 8 concurrent enemies (research L4).
- **state surface**: `window.__GAME__` debug object with `{ scene, score, rage, berserker_active, berserker_cooldown, hp, elapsed_s, spawn_pool, kill_count }` — required for AC predicate evaluation.

## §7 Sprite Notes

- **Reba**: 56×56 procedural pixel-cartoon — circular head (skin tone) + goggles (`#0ea5e9` lens, `#1f2937` strap) + warm-yellow body. Idle bob 2px @ 1Hz; attack-tap triggers a 80ms forward-thrust (4px) + arm-swing.
- **Slime** (48×48): round green-cyan blob, 1 wobble cycle / 800ms.
- **Bat** (48×48): triangular violet body + 2 winged silhouettes flapping @ 6Hz.
- **Ghost** (48×48): pale-cyan wisp/teardrop with hollow eyes; teleport flicker = 80ms fade-out → 120ms fade-in at next position every 1.5s.
- All sprites generated procedurally in `BootScene` via Canvas API → `RenderTexture` → Phaser texture (no atlas file needed).

## §8 Cross-References

- `artifacts/spec.md` — acceptance criteria + rule book.
- `artifacts/tuning.json` — balance numbers (mirrored at runtime as `src/config/tuning.json`).
- `agents/specialists/game-design.md` §1.1 / §3 / §5 — binding envelope and synth-format contract.
- Research synthesis: transcript event `01KQNEPMSZC39SX2Q5W85DH04Q`.
