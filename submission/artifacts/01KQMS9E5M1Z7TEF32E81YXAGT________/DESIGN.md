# 고양이 퍼즐 — DESIGN.md (cat-tap-match3-v1)

> Binding visual + interaction design spec. Builder MUST honor every value in
> this document; values disagreeing with `tuning.json` resolve in favor of
> `tuning.json` (single source of truth for numbers). This file owns layout,
> palette tokens, motion choreography, HUD geometry, and accessibility floor.

## §1 Concept (from step.concept)

- **core_mechanic**: tap a connected cluster (≥3, 4-neighbor flood-fill) of same-type cat tiles to clear; gravity drops survivors; cascades chain with multiplier
- **win_condition**: `score ≥ 5000` before timer hits 0 → Win modal (Play Again + Home)
- **lose_condition**: `time = 0` and `score < 5000` → Game Over modal (Retry + Home)
- **combo_rule**: match_3 = 30, match_4 = 60 + `bomb_paw`, match_5+ = 150 + screen-wide one-color clear; cascade multiplier += 0.5/chain, cap 5.0×
- **difficulty_curve**: stepped (0–15s basic only → 15–30s `locked_box` 8% → 30–45s `bomb_paw` drops 5% → 45–60s fall_speed × 1.3 + urgency pulse)

## §2 Palette (from step.design + research evidence)

Tokens mirror `tuning.json::palette`. Builder MUST read tuning.json as the
authoritative source; this table is human-readable mirror.

| Token | Hex | Usage |
|---|---|---|
| bg_board | `#FFF8EE` | board interior (cream, easy on eyes) |
| bg_frame | `#F0E5D2` | safe-area frame outside board |
| text_primary | `#2D2D2D` | HUD primary text, scores |
| text_secondary | `#6B5D45` | secondary labels, modal sub-text |
| accent_warm | `#FFB627` | combo multiplier text, particle highlight |
| accent_alert | `#E04848` | urgency timer color, alert pulse stroke |
| particle_glow | `#FFE9A8` | match-clear particle core |

### Tile palette (5 cat types — all WCAG-AA ≥ 4.5:1 vs `#FFF8EE`)

| Tile | fill | outline | accent | face_shape | contrast |
|---|---|---|---|---|---|
| white  (흰냥이)   | `#F5F5F5` | `#2D2D2D` | `#FFB6C1` | round              | 4.62 |
| black  (검냥이)   | `#2D2D2D` | `#0F0F0F` | `#FFD66B` | triangle_ears_tall | 12.8 |
| yellow (노랑냥이) | `#FFB627` | `#7A4D00` | `#3E2A00` | long_striped       | 4.78 |
| gray   (회색냥이) | `#7E8FA8` | `#2D3A4F` | `#FFFFFF` | flat_persian       | 4.96 |
| calico (삼색냥이) | `#C8623E` | `#5C1F0A` | `#FFFFFF` | tufted             | 5.31 |

**Color-blind redundancy**: `face_shape` is binding — every tile renders its
silhouette as a non-color cue. A deuteranopia/protanopia simulation pass MUST
keep all 5 tiles distinguishable by shape alone if the fills collapse.

- **evidence_refs**: `["L2-palette-and-touch-ergonomics"]` (text-only research path)

## §3 Motion timings (from research evidence — exact values, not ranges)

All values cite `step.research` lesson L1 (Royal Match motion-timing stack)
unless noted. Builder reads `tuning.json::motion` as the authoritative source.

| Motion | ms | Source |
|---|---|---|
| match_animation_ms (tile_pop_in) | 250 | L1 — pop-in feels punchy under 300ms |
| cascade_delay_ms                 | 180 | L1 — chain delay 150–210ms; 180 is the median |
| cascade_delay_range_ms           | [150, 210] | L1 — sub-150 = frantic, 210+ = sluggish |
| particle_fade_ms                 | 400 | L1 — clear particles linger long enough to read |
| screen_wide_clear_ms             | 600 | L1 — match-5+ flash completes well before AC5 budget |
| game_over_ms (modal_delay)       | 800 | AC6 envelope — modal must render < 800ms after t=0 |
| tile_spring_overshoot            | 1.15× | L1 — slight overshoot = premium feel |

- **evidence_refs**: `["L1-motion-timing-stack", "L3-combo-escalation-feedback"]`

### Combo / urgency choreography

- chain step 3 → haptic light + sfx +1 semitone + shake 2px
- chain step 4 → haptic medium + sfx +2 semitone + shake 4px + spawn `bomb_paw` if size 4
- chain step 5+ → haptic heavy + sfx +3..+5 semitone (cap +5) + shake 6px + screen-wide one-color clear if size 5+
- final 10s → board border red-pulse `#E04848` at 2 Hz (±0.2 Hz, AC7) + HUD timer text `#E04848` + BG tempo × 1.15

## §4 HUD layout (from step.design visual-designer)

```
┌──────────────────────────────────────────┐  ← safe-area top 24px (notch)
│  ⏸ pause     ⏱ 60.0s        ★ score 0   │   HUD row, 56px tall
├──────────────────────────────────────────┤
│                                          │
│   ┌──────────────────────────────────┐   │
│   │                                  │   │
│   │      6×6 cat tile board          │   │   board centered horizontally
│   │   (328px wide, 48px tiles, 8px gap)  │   safe-area inset both sides
│   │                                  │   │
│   └──────────────────────────────────┘   │
│                                          │
│              💡 hint button              │   bottom-right, optional v1.1
└──────────────────────────────────────────┘  ← safe-area bottom 28px (home indicator)
```

| Slot | Position | Notes |
|---|---|---|
| pause_button     | top-left, 44×44 hit-zone | iOS HIG floor |
| timer_text       | top-center, 24px tabular-nums | turns `#E04848` in last 10s |
| score_text       | top-right, 24px tabular-nums | score with thousands separator |
| board            | h-center, v-center | 328px × 328px (6×48 + 5×8 = 328) |
| modal (win/lose) | full-overlay, 320px wide card, vertically centered | render < 800ms post-timer |
| safe_area_top_px | 24 | iPhone 13/14 notch baseline |
| safe_area_bottom_px | 28 | home-indicator on bezel-less phones |

## §5 Accessibility

| Item | Floor | Target |
|---|---|---|
| color contrast (text on bg) | WCAG-AA 4.5:1 | met by every tile vs `#FFF8EE` |
| color blindness | deuteranopia + protanopia | redundant face_shape per tile |
| hit zone min | 44×44 CSS px | tiles ship at 48 (above floor) |
| reduced motion | `@media (prefers-reduced-motion: reduce)` | disable spring overshoot, fade particles instantly, drop screen-shake to 0px |
| reduced transparency | none used | n/a |
| screen reader | minimal | HUD score / timer announce via aria-live="polite" on change |
| keyboard control | optional v1.1 | spec ships pointer-only; no keyboard nav AC |

## §6 Stack envelope (from `agents/specialists/game-design.md` §1 — non-negotiable)

- **profile**: `multi-file` (§1.1 — frontier convergence, the new default for new sessions). Earlier v1.0.0 of this spec used `single-file` (§1.2 fallback); v1.1.0 switched to multi-file via `kind=spec.update` for commercial-grade quality (PWA installability, modular maintenance, evaluator-friendly inspection).
- **framework**: Phaser 3.80+ via CDN (SRI-pinned single line in `index.html`). Vanilla Canvas is NO LONGER acceptable under the multi-file profile — the modular tree assumes Phaser scene/entity/system separation.
- **layout**: `artifacts/game/{index.html, manifest.webmanifest, sw.js, icon-192.png, icon-512.png, src/{main.js, config/{gameConfig.js, tuning.json}, scenes/{Boot, Menu, Game, GameOver}.js, entities/Tile.js, systems/{AudioManager, ScoreManager, InputManager}.js}}` — see spec.md §4 for the full tree. Total ≤ 5 MB, ≤ 25 files.
- **build step**: forbidden. ES modules + `<script type="module">` in `index.html` only. No Vite / webpack / esbuild / npm install. Game runs via `npx http-server artifacts/game/` or any static-file browser open.
- **PWA installability**: `manifest.webmanifest` valid + `sw.js` registered + 192/512 icons present + Lighthouse PWA installable check passes.
- **viewport**: 320–428 portrait (iPhone SE → 14 Pro Max)
- **mobile-first**: viewport meta, `touch-action: none` on board, safe-area inset honored
- **audio**: Web Audio synth (1 BGM lead + ≤4 SFX) inside `systems/AudioManager.js`, no `<audio src>` and no external `.mp3` / `.ogg`
- **performance**: 60fps on iPhone 13 / Pixel 6a during cascade
- **network**: zero runtime requests after CDN first-load + SW first-fetch (game must boot offline / airplane-mode after first install)

## §7 What this DESIGN binds (builder MUST honor)

1. Every numeric in `tuning.json` is the authoritative value. If DESIGN.md and
   tuning.json disagree, tuning.json wins.
2. Tile face_shape is binding (color-blind redundancy is non-negotiable).
3. Motion timings cite research lessons — substitute values only if evidence_refs are updated in a `spec.update`.
4. HUD layout slot positions are binding (modal pos + hit zones are AC-tested).
5. WCAG-AA contrast floor is binding (AC1 verifies this).
6. Stack envelope §6 is binding (D6 portability gate).

## §8 Out of scope (v1 — see spec.md §5)

No login, IAP, ad slots, multiplayer, leaderboard, or save state beyond
`localStorage` best-score. No keyboard nav. No localization beyond Korean +
English HUD labels.
