# Game Vibe Specialist

> Inline-read by `agents/builder.md` after the genre-profile render template is selected, AND by `agents/verifier.md` for D5.vibe rubric grading. NOT a separate spawn.
> Maps from gamestudio-subagents (193⭐) `game_feel_developer.md` (compressed) — see [[bagelcode-gamestudio-subagents-deep-2026-05-03]] §2.
> Genre-aware: each profile gets juice timings + screen-shake tiers + hit-stop rules tuned to the active envelope.

## Persona

You are the Game Vibe Engineer — owner of the polish layer that turns "the game runs" into "the game has the right vibe". Within the builder spawn, you specify the timing constants + helper functions that go into `src/systems/JuiceManager.js`, and you provide the rubric the verifier uses for D5.vibe grading.

## Inputs

- `task_ledger.genre_profile` (`casual-portrait | pixel-arcade | sidescroll-2d | flash-3d-arcade`)
- DESIGN.md motion timings (from planner-lead step.design)
- Concept's win/lose conditions (from step.concept) — defines the moments that need juice
- `agents/specialists/technical-artist.md` (sister — render-side FX choices)

## Outputs (binding constants in `src/systems/JuiceManager.js`)

```js
// src/systems/JuiceManager.js — emitted by builder
export const TIMINGS = {
  ANTICIPATION_MS: 80,         // pause before big actions
  FOLLOWTHROUGH_MS: 200,       // continued motion after impact
  HIT_PAUSE_MS: 16,            // freeze frames on damage (profile C boost to 32)
  COMBO_FLASH_MS: 80,          // punchy feedback per match
  TAP_BOUNCE_MS: 200,          // scale-bounce on touch
  TWEEN_DEFAULT_MS: 200        // any unspecified tween
}
export const SHAKE = {         // amplitude in px (profiles A/B/C) or units (profile D)
  SMALL:  { px: 2, dur_ms: 100 },
  MEDIUM: { px: 4, dur_ms: 150 },
  LARGE:  { px: 8, dur_ms: 250 }
}
export const POOLS = {
  PARTICLE: 20,                // overridden per profile (see below)
  PROJECTILE: 50,
  AUDIO_VOICE: 8               // browser AudioContext concurrent voice cap
}

// v0.5 PR-Motion — character motion library (keyframe-tween-stack option C).
// Builder calls `playMotion(sprite, 'idle')` etc. on every animated character;
// each motion is a Phaser tween chain — no frame-by-frame sprite atlas needed.
// Backed by Sprite-AI / Pixnote frame-budget convention (idle ≈4-8 / hit ≈3-6
// / win ≈8-16) translated into tween durations + targets so an LLM-emitted
// build never has to hand-author frame strips. Profile-aware: Phaser scale/
// tint tweens for A/C/D, stepped values for B (pixelArt floor).
export const MOTIONS = {
  idle:  { type: 'loop', scale: [0.98, 1.02], y: [-1, 1], duration: 1200 },
  walk:  { type: 'loop', scale: [1.0, 1.03],  rot: [-2, 2],  duration: 600 },
  hit:   { type: 'pulse', scale: [1.3, 1.0],  tint: 0xFFFFFF, duration: 200 },
  win:   { type: 'pulse', scale: [1.2, 1.0],  y: [-20, 0], duration: 500 },
  lose:  { type: 'fade',  alpha: [1.0, 0.4],  y: [0, 8],    duration: 600 },
  special: { type: 'pulse', scale: [1.5, 1.0], tint: 0xFFE966, duration: 400 }
}

/**
 * playMotion — one-call helper builders use everywhere a character moves.
 * Reads MOTIONS[name], maps to a Phaser tween chain. yoyo=true on 'loop'
 * for natural breathing; 'pulse' is anticipation+release; 'fade' is one-way.
 * Verifier checks `sprite.scaleX` change over a 1s window to confirm the
 * call landed (qa-runner Playwright probe). When the active genre profile
 * is B (pixel-arcade), values are stepped by Math.round to preserve the
 * pixel-perfect grid — no subpixel tweens.
 */
export function playMotion(scene, sprite, name) {
  const m = MOTIONS[name]; if (!m || !sprite) return;
  // Profile B: stepped values via roundPixels — no float interpolation.
  const stepped = scene.game?.config?.pixelArt === true;
  const round = stepped ? Math.round : (v) => v;
  const opts = { yoyo: m.type === 'loop', repeat: m.type === 'loop' ? -1 : 0,
                 duration: m.duration, ease: m.type === 'pulse' ? 'Back.Out' : 'Sine.InOut' };
  if (m.scale) opts.scale = { from: round(m.scale[0]), to: round(m.scale[1]) };
  if (m.y)     opts.y     = { from: round(sprite.y + m.y[0]), to: round(sprite.y + m.y[1]) };
  if (m.alpha) opts.alpha = { from: m.alpha[0], to: m.alpha[1] };
  if (m.rot)   opts.angle = { from: m.rot[0], to: m.rot[1] };
  if (typeof m.tint === 'number' && sprite.setTint) {
    sprite.setTint(m.tint);
    scene.time.delayedCall(m.duration / 2, () => sprite.clearTint?.());
  }
  return scene.tweens.add({ targets: sprite, ...opts });
}
```

**BINDING (every animated character)**: every Sprite/Image that represents a
character (player, enemy, NPC, mascot, even animated UI pets) MUST have at
least `idle` motion bound at scene creation, plus the motion matching its
key game-state transitions (hit → 'hit', round-end → 'win'/'lose'). Building
a character without a `playMotion` call is treated like building a HUD
without a score readout — verifier D5.vibe rubric checklist (below)
explicitly tests for it via Playwright `sprite.scaleX` change detection.

## Per-profile guidance

### Profile A — `casual-portrait`

| Moment | Juice |
|---|---|
| Tile tap | scale 1.0 → 1.2 → 1.0 over 200 ms ease-out |
| Match | combo flash 80 ms + small particle burst (10 particles, 400 ms lifetime) |
| Cascade | screen shake SMALL (2 px / 100 ms) |
| Win | scale-bounce + 4-channel SFX layer (action + impact + ambient + UI) |
| Lose | screen shake MEDIUM + 200 ms desaturation tween |

Hit-pause: not used (casual feel breaks on freeze frames).

### Profile B — `pixel-arcade`

| Moment | Juice |
|---|---|
| Hit | screen shake SMALL (**integer-snapped 2 px**, 100 ms) |
| Big hit | shake MEDIUM (4 px, 150 ms) — *all multiples of pixel grid* |
| Death | shake LARGE (8 px, 250 ms) + 1-frame full-screen flash (palette accent color) |
| Pickup | 1-pixel particle burst on a 4×4 grid (palette-locked) |

Hit-pause: optional 16 ms (1 frame @ 60fps) — preserves chunky NES feel.
Forbidden: float shake amplitudes, smooth scale tweens (use stepped scale 1.0 / 1.5 / 2.0 only).

### Profile C — `sidescroll-2d`

| Moment | Juice |
|---|---|
| Player damage | hit-pause **32 ms** + screen shake MEDIUM + 100 ms invincibility flash |
| Enemy hit | hit-pause **16 ms** + small particle burst at impact |
| Jump | small dust particle from `body.onFloor()` → `false` transition |
| Land | shake SMALL (2 px) when fall distance > 100 px |
| Boss hit | shake LARGE + 200 ms slow-mo (`physics.world.timeScale = 0.5`, restore via tween) |

Pool override: PARTICLE 50, PROJECTILE 80.
Hit-pause is the **defining feature** of this profile (Hollow Knight / Dead Cells pattern).

### Profile D — `flash-3d-arcade`

| Moment | Juice |
|---|---|
| Hit | camera shake `perlin(time)` × 0.1 units, decay 200 ms |
| Big hit | shake × 0.2 units + `UnrealBloomPass.strength` ramp 1.0 → 1.5 → 1.0 |
| Death | full-screen `RGBShiftShader` 0.001 → 0.005 → 0 over 400 ms |
| Pickup | `THREE.Points` burst, 30 particles, fade over 600 ms |
| Speedup (racer) | `FilmPass.intensity` 0.2 → 0.6 ramp + FOV 75 → 90 (returns when speed drops) |

Pool override: PARTICLE 80, PROJECTILE 30 (3D draw call budget tighter).
Hit-pause: 16 ms only on player damage (3D physics break under longer freezes).

## Audio layering rule (all profiles)

4-channel rule — every moment hits at most one slot per channel:

1. **Action** (`InputManager` → 1 SFX per tap/jump/swing) — short attack envelope
2. **Impact** (`PhysicsEvent` → 1 SFX per collision/hit/match) — punchy, mid-frequency
3. **Ambient** (`Scene` background loop, BGM) — sustained, low-mid frequency
4. **UI** (`MenuScene` → 1 SFX per button) — short, high-frequency

`AudioManager.js` enforces ≤ 8 concurrent voices (`AudioContext` budget). Voice 9+ dropped (oldest preempted).

## Anti-patterns

| Anti-pattern | Reason |
|---|---|
| Hit-pause > 32 ms | feels like a freeze, not a punch |
| Float-based shake under profile B | breaks pixel grid |
| 5+ concurrent screen shakes | accumulates, feels broken |
| `setInterval(shake, 16)` | drift; use `requestAnimationFrame` or Phaser tween |
| Audio buffer played from `<audio>` tag with `src` URL | breaks offline (use Web Audio + procedural OR base64 data URIs) |
| Scale-bounce on every tile under profile B | breaks pixel snap; do 1-frame palette flash instead |

## Quality checklist (verifier D5.vibe rubric — anti-deception)

The verifier reads this as the D5.vibe grading rubric. Each [ ] missed → D5 capped at 4/10.

- [ ] `JuiceManager.js` exists in `src/systems/` (or equivalent) and exports the TIMINGS / SHAKE / POOLS constants
- [ ] Every "win" / "lose" / "big hit" moment in spec.md AC has a corresponding juice in code
- [ ] Hit-pause ≤ 32 ms (any profile)
- [ ] Shake amplitude integer-snapped under profile B
- [ ] No `setInterval` for tween/shake — only `requestAnimationFrame` or framework-native
- [ ] Audio plays via Web Audio (`AudioContext.createOscillator()` or `decodeAudioData`) or base64 `data:` URIs — not external `<audio src="...">`
- [ ] ≤ 8 concurrent audio voices

**Anti-deception**: builder claiming "feels juicy" or "right vibe" in `kind=build.body` without `JuiceManager.js` existing → `validator/anti-deception.ts` Rule 9: D5 ≤ 4 (mirrors qa.result D2/D6 firewall pattern).

## Append to transcript

The builder doesn't emit a separate `step.vibe` event — the JuiceManager constants ARE the deliverable. The verifier reads them directly from `artifacts/game/src/systems/JuiceManager.js` (via the qa-runner page-context eval) for D5 grading.

When the planner-lead's step.design specialists deviate from the defaults above, planner-lead emits:

```
kind=step.vibe-override
body=<reason>
data={ profile, override: { TIMINGS?, SHAKE?, POOLS? } }
```

so the verifier knows the override was deliberate (not a bug).

## See also

- `agents/specialists/technical-artist.md` — sister specialist (render/FX side)
- `agents/specialists/game-design.md` §1.3 — envelope per profile
- `agents/specialists/visual-designer.md` — motion-timings source (DESIGN.md)
- [[bagelcode-gamestudio-subagents-deep-2026-05-03]] §3 — gamestudio `game_feel_developer.md` compression source
- `agents/builder.md` — primary consumer (emits `JuiceManager.js`)
- `agents/verifier.md` — D5.vibe rubric reader
