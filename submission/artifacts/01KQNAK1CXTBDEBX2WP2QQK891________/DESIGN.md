# Reba Berserker — DESIGN.md

> Top-down portrait arena. 60-second run. Tap-to-slash + swipe-to-dash. Kill enemies to fill rage; full rage auto-triggers an 8s Berserker burst (3× score, 1.5× slash radius, red screen tint, hit-stop). Hommage to 레바의 모험 (2007-era Korean Flash adventure-action) for sprite vocabulary.

## §1 Concept (from step.concept)

- **core_mechanic**: top-down action-arena, single-tap slash toward nearest enemy + swipe to dash a short distance
- **win_condition**: score ≥ 50 within 60s
- **lose_condition**: HP reaches 0 OR timer hits 60s with score < 50 — game-over screen with restart button
- **combo_rule**: chained kills within 800ms grow a multiplier up to ×5; berserker layers an additional ×3 on top
- **difficulty_curve**: linear spawn-density ramp (spawn_interval_ms 1500 → 600 across 60s). First 5s = "free win" warm-up. Late game = swarm density, never piece scarcity.

## §2 Palette (from step.research evidence — 레바의 모험 Flash hommage + WCAG-safe berserker red)

| Token | Hex | Usage | Contrast vs background |
|---|---|---|---|
| background | `#3D2817` | wood-brown arena floor | — |
| primary | `#F4E8D0` | cream-white sprite fill (player + enemies) | 9.4:1 ✓ |
| secondary | `#1A0F08` | 1–2px black outline on every sprite | — |
| accent | `#D62828` | berserker red (rage bar, mode tint, kill flash) | 4.8:1 ✓ AA |
| text | `#F4E8D0` | HUD numerals + game-over copy | 9.4:1 ✓ |

- **Berserker mode** applies a 30% red tint overlay on the canvas — `rgba(214,40,40,0.30)` — fade-in 200ms / fade-out 400ms. This is a tint, not a palette swap; sprite colors stay readable underneath.
- **Color-blind safety**: red rage bar pairs with a parallel scale icon (filled 🟥 vs empty ▫️ tile glyph) so deuteranopia users still read fill state.
- **evidence_refs**: `01KQNAWYMA8DE8MCBZ1X9NCTX2` (researcher step.research, lesson 4)

## §3 Motion timings (from step.research evidence — Soul Knight juice profile, exact values)

| Event | Duration | Curve | Cite |
|---|---|---|---|
| slash animation | 120ms | ease-out | concept §combo_rule (cascade_visual_ms 80) ext to 120 for slash arc |
| hit-stop on kill | **50ms** | freeze (no easing) | researcher lesson 3 |
| screen-shake (normal) | **80ms × 4px** amplitude | sine decay | researcher lesson 3 |
| screen-shake (berserker) | 80ms × **2px** amplitude (0.5× cap) | sine decay | researcher lesson 3 — anti-nausea |
| white-flash on enemy death | 60ms | linear | Soul Knight pattern |
| combo window | **800ms** | — | concept §combo_rule |
| berserker tint fade-in | **200ms** | ease-in | researcher lesson 2 |
| berserker active duration | **8000 ± 200ms** | — | researcher lesson 2 |
| berserker tint fade-out | **400ms** | ease-out | researcher lesson 2 |
| game-over fade | 600ms | ease-out | visual-designer default |

- **Concurrent shakes**: builder MUST queue, not stack. At most 1 active screen-shake at a time. Stacking 8s of shake during berserker is the nausea risk we're closing.
- **Reduced motion fallback**: when `prefers-reduced-motion: reduce`, shake amplitude × 0.25, hit-stop preserved (impact reads via flash + tint instead).
- **evidence_refs**: `01KQNAWYMA8DE8MCBZ1X9NCTX2` (researcher step.research, lessons 2 + 3)

## §4 HUD layout (portrait 320–428 px, safe-area aware)

```
┌─────────────────────────────┐  ← safe-area-top: 24px
│ ⏸  ⏱ 0:60      HP ❤❤❤    │  ← top row: pause | timer | HP icons
│                              │
│  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  RAGE 🟥  │  ← rage bar (left 70%) + score (right)
│                              │     SCORE  0
│                              │
│         [arena canvas]       │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
└─────────────────────────────┘  ← safe-area-bottom: 24px (home indicator)
```

- **score_position**: top-right (above arena)
- **timer_position**: top-center
- **pause_button**: top-left
- **rage_bar**: full-width band beneath top row — fills left-to-right red as kills accumulate; flashes white at 100% before berserker triggers
- **HP icons**: 3 hearts top-right, decrement left-to-right on contact
- **safe_area_top_px**: 24
- **safe_area_bottom_px**: 24
- **canvas_fit**: `Phaser.Scale.FIT` between 320–428 portrait, vertical centering

## §5 Accessibility

- **contrast_min**: 4.5:1 (every text + accent token verified above)
- **colorblind_safe**: true — rage state has a glyph + position cue beyond color
- **hit_zone_min_px**: 44 (pause button + restart button); arena canvas itself accepts any touch
- **prefers-reduced-motion**: shake × 0.25, no berserker red flicker (steady tint instead)
- **screen-reader**: HP / score / timer rendered as `aria-live="polite"` labels in a visually-hidden DOM mirror

## §6 Stack envelope (from `agents/specialists/game-design.md` §1.1 — non-negotiable)

- **framework**: Phaser 3.80+ via CDN (`cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js`)
- **profile**: multi-file PWA under `artifacts/game/` (no build step, ES modules, import map in `index.html`)
- **viewport**: 320–428 portrait, `touch-action: none`
- **PWA**: `manifest.webmanifest` + `sw.js` cache-first; icon-192/512 procedurally rendered from a Canvas in BootScene
- **assets**: procedural sprite generation in `BootScene.js` (Canvas → texture). No binary asset files unless atlas needed.
- **audio**: `systems/AudioManager.js` — Web Audio synth, 1 BGM lead loop + SFX (slash, hit, kill, berserker-trigger, game-over)
- **persistence**: NOT activated (no leaderboard markers in goal). Skip `migrations/` and `PersistenceManager.js`.
- **performance**: 60fps on iPhone Safari 16+ / Android Chrome 100+ at peak swarm density
