# Kirby Sidescroll v1 — DESIGN.md

## §1 Concept (from step.concept + step.research, named-game weight 0.7)

- Title: **Kirby Sidescroll v1** (slug `kirby-sidescroll-v1`)
- Genre: 2D sidescrolling platformer (profile C — `sidescroll-2d`)
- Reference canon: Kirby's Dream Land (1992), Kirby's Adventure (1993), Kirby Super Star (1996)
- Core mechanic: walk/run + jump + 5-jump float + inhale → mouthful → swallow → copy ability (sword / fire / spark)
- Win condition: defeat **Whispy Wood** end-of-stage boss (HP 6 base, HP 4 with sword)
- Lose condition: HP 0 OR fall off world; 3-life retry → GameOverScene
- Combo rule: inhale (Z hold ≥ 120 ms) → mouthful → 2 s window to swallow → copy ability HUD icon → ability use
- Difficulty curve: 15 s tutorial walk → first ability-bearing enemy at ~25 s → boss arena at ~60 s

## §2 Palette (warm-pastel Nintendo-feel — researcher L5)

| Token | Hex | Role | Notes |
|---|---|---|---|
| background | `#A8D8FF` | sky | high-luminance pastel blue |
| primary | `#F4A8B8` | Kirby protagonist | peach-pink (NOT magenta — peach reads 90s Nintendo) |
| secondary | `#A8D8B5` | foliage | muted mint |
| accent | `#E85058` | apples / hazards | desaturated red |
| enemy_tan | `#E8B870` | Waddler / Flier body | warm tan |
| text | `#3A2840` | HUD / outlines | warm dark |

- Contrast: every gameplay sprite ≥ 4.5:1 vs sky (WCAG AA).
- Outlines: max 1 px, dark `#3A2840`.
- evidence_refs: `[]` (text-only research path; primary_ref = Kirby's Adventure 1993 NES palette homage).

## §3 Motion timings (from researcher L4 — modern juice baseline)

| Token | Value | Source |
|---|---|---|
| coyote_ms | 100 | Celeste / 2020s indie convergence |
| jump_buffer_ms | 100 | same |
| hit_stop_enemy_ms | 16 | Kirby Super Star modern juice |
| hit_stop_player_ms | 32 | same |
| hit_stop_restore_ms | 64 | linear restore curve |
| shake_minor_px | 4 | profile C §1.3.C |
| shake_major_px | 8 | boss damage |
| shake_death_px | 12 | player death |
| shake_lerp_in_ms | 100 | smooth onset |
| shake_lerp_out_ms | 200 | smooth decay |
| float_exhale_animation_ms | 200 | 5-jump cap canon |
| inhale_hold_threshold_ms | 120 | Kirby's Adventure |
| mouthful_swallow_window_ms | 2000 | Kirby's Adventure |
| scene_fade_ms | 400 | scene transitions |
| boss_intro_ms | 800 | shake + zoom-in |
| victory_fanfare_ms | 1200 | C-E-G-C arpeggio |

## §4 HUD layout (visual-designer + profile C §1.3.C)

Landscape 16:9, logical 640×360, Phaser `Scale.FIT`.

```
┌─────────────────────────────────────────────────────────────┐
│ HP♥♥♥♥♥♥          ABILITY:[sword]              LIVES: ×3   │ ← top row (24 px, safe-area top)
│                                                             │
│                                                             │
│            (game scene + 4 parallax layers)                 │
│                                                             │
│                                                             │
│ [DPad◄►]                                       [Z][X][⏸]    │ ← touch overlay (32 px, safe-area bottom)
└─────────────────────────────────────────────────────────────┘
```

- HP: top-left, 6 hearts; depleted = outlined-only.
- Ability slot: top-center, 32×32 frame; icon when held.
- Lives: top-right, `× N`.
- Touch DPad: bottom-left half (≥ 44 px hit zones); JUMP / INHALE / X buttons bottom-right; visible only on `pointer: coarse` (mobile).
- Pause: top-right small button (Esc on desktop).
- Safe area: 24 px top padding (iPhone notch), 32 px bottom (home indicator).

## §5 Accessibility

- `contrast_min`: 4.5 (WCAG AA on all gameplay sprites vs sky).
- `colorblind_safe`: true. Color is never the only signal — apples = red + round, fire = red + flame shape, spark = yellow + spike shape.
- `hit_zone_min_px`: 44 (touch DPad + pause button).
- Reduced-motion fallback: when `prefers-reduced-motion: reduce`, set `shake_*_px = 0` and clamp `hit_stop_*_ms ≤ 8`.

## §6 Stack envelope (binding from `agents/specialists/game-design.md` §1 + §1.3.C)

- Framework: Phaser 3.80+ via CDN (`https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js`)
- Physics: ArcadePhysics, `gravity_y = 800`, no debug
- Viewport: 640×360 logical, `Scale.FIT`, landscape 16:9
- File-count cap: ≤ 30 (profile C exception)
- Bundle cap: ≤ 8 MB (profile C exception)
- Asset strategy: procedural-first sprite gen in BootScene + Web Audio synth (zero asset-byte fallback)
- Audio: 1 BGM lead + 4 SFX via OscillatorNode chiptune family; ADSR via `gain.gain.linearRampToValueAtTime`; lookahead clock from `AudioContext.currentTime` (Chris Wilson pattern)
- Camera: `cameras.main.startFollow(player, true, 0.1, 0.1)` smooth lerp
- Parallax: exactly 4 TileSprite layers (`scrollFactor` 0.0 / 0.2 / 0.5 / 1.5)
- Player state machine: `idle | run | jump | float | inhale | mouthful | spit | hurt | dead`
- Input: keyboard (Arrow ↔ AND WASD AND Space AND Z AND X AND Esc) + touch DPad overlay (mobile primary)
- PWA: `manifest.webmanifest` + `sw.js` cache shell + 192/512 PNG icons (procedural Canvas-rendered)
- Runtime network: zero requests after CDN load + SW first-fetch (offline guarantee)
- Persistence profile: `local-only` — IndexedDB via Dexie 4 in `src/systems/PersistenceManager.js` with `runs` table (`{ score, duration_ms, seed, created_at }`)

## §7 Render & FX (technical-artist — profile C)

- Particles: Phaser `ParticleEmitter` — pool 50, emission cone for hit feedback, 80 ms lifetime
- Hit-stop: `physics.world.timeScale = 0` for 16 ms (enemy) / 32 ms (player), then linear restore to 1.0 over 64 ms
- Camera shake: 2D translation, lerp 100 ms in / 200 ms out, decay back to (0, 0)
- Forbidden under profile C: 3D camera, real shadow maps, parallax > 5 layers, subpixel motion (`Math.round` everything)

## §8 Audio plan (procedural)

| Channel | Source | Pattern |
|---|---|---|
| BGM lead | OscillatorNode (square) | C-major arpeggio loop, 8-bar, 120 bpm |
| BGM bass | OscillatorNode (triangle) | root + fifth, half-time |
| SFX jump | jsfxr seed | quick rising blip, ~80 ms |
| SFX inhale | OscillatorNode + LFO | descending whoosh, 250 ms |
| SFX hit | jsfxr seed | noise burst, ~120 ms |
| SFX victory | OscillatorNode | C-E-G-C ascending, 1200 ms |

## §9 Debug surface (`window.__GAME__`)

Builder MUST expose a debug hook on the global `window` object once GameScene is active, to support deterministic AC predicate checks (per `agents/specialists/game-design.md` §AC-Predicate-Compile) and the verifier MCP playthrough (§6.5).

Required surface:

```js
window.__GAME__ = {
  player:        <Phaser.GameObjects.Sprite>,        // .x .y .state .hp
  boss:          <Phaser.GameObjects.Sprite | null>, // null until boss arena triggered
  abilityHeld:   <"sword" | "fire" | "spark" | null>,
  livesRemaining:<int>,
  scene:         <Phaser.Scene>,                     // currently active
  persistence: {
    saveRun:   ({ score, duration_ms, seed }) => Promise<id>,
    topScores: (limit?) => Promise<Array<{score, duration_ms, seed, created_at}>>
  },
  // optional helpers (recommended; OK to omit if internal API differs):
  teleportPlayer?: (x, y) => void,
  forceAbility?:   (name) => void
};
```

## §10 Acceptance gates → ac_predicates compile

Predicates run in headless Chromium via `qa-interactive`. Most ACs in this spec are subjective gameplay scenarios (movement feel, inhale chain, boss combat) and live in `acceptance_criteria` strings only — verifier grades them via Playwright MCP playthrough. The deterministic structural checks below are predicate-compiled and become D2 ground-truth extension:

- **AC1-scenes** — Phaser game registered with ≥ 5 scenes + canvas mounted (no action; 2 s wait for boot)
- **AC1-debug-hook** — `window.__GAME__` debug surface present (§9 contract)
- **AC8-persist-api** — `window.__GAME__.persistence.{saveRun, topScores}` are callable functions (Dexie wired)
