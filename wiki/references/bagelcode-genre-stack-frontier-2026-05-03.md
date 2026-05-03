---
title: Genre stack frontier — pixel / 2D side-scroll / 3D Flash + persistence axes (2026-05-03)
category: references
tags: [bagelcode, genre, stack, phaser, three-js, kaplay, pixellab, drizzle, dexie, supabase, frontier, 2026]
sources:
  - "Phaser blog — vs Kaplay vs Excalibur (2026-04, https://phaser.io/news/2026/04/phaser-vs-kaplay-vs-excalibur-2d-web-game-framework)"
  - "js-game-rendering-benchmark (Shirajuki, 15 frameworks)"
  - "PixelLab.ai — text-to-pixel + Aseprite plugin (2026)"
  - "Sprite-AI — 12 best pixel art generators 2026"
  - "kokutech — Language-to-Sprite Pipeline with LLM Critics (May 2025)"
  - "utsubo — Three.js vs Babylon.js vs PlayCanvas 2026 (270x / 337x download gap)"
  - "utsubo — What's New in Three.js 2026 (WebGPU + llms.txt)"
  - "Drizzle ORM official Cloudflare D1 docs (orm.drizzle.team/docs/connect-cloudflare-d1)"
  - "DEV — Cloudflare D1 + Drizzle ORM SQLite at the Edge (2025-2026)"
  - "Dexie.org — IndexedDB Made Simple (2026)"
  - "PkgPulse — Dexie.js vs localForage vs idb 2026"
  - "Pieter Levels — Vibe Coding Game Jam (2025-Q4)"
summary: >-
  Per-genre 2026 frontier evidence for extending Crumb's envelope from one profile (casual-portrait
  Phaser) to four (casual-portrait / pixel-arcade / sidescroll-2d / flash-3d-arcade) plus four
  persistence profiles (local-only / postgres-anon / edge-orm / firebase-realtime). Every claim
  cites a 2026 source so the verifier's D5 evidence-refs requirement holds when the planner reads
  this page.
provenance:
  extracted: 0.80
  inferred: 0.20
created: 2026-05-03
updated: 2026-05-03
---

# Genre stack frontier — 2026

> **One-line goal**: turn Crumb from a one-genre prototype harness into a multi-genre one without losing the 94% LLM first-attempt success rate that the current Phaser-only choice buys. Each genre below has one **default stack** + one **adaptation rule** for the existing §1 envelope.

## 0. Why one envelope is no longer enough

Current `agents/specialists/game-design.md` §1 envelope assumes:
- Phaser 3.80 portrait 320–428
- match-3 / runner / clicker (no movement-heavy)
- procedural-first rendering, no 3D

User pitches that don't fit this envelope (pixel platformer, 횡스크롤 메가맨, 3D 플래시 아케이드) currently force the researcher's `mechanics_out_of_envelope` filter and the planner falls back to a casual-portrait approximation. Result: the game ships, but as a flattened cousin of the pitch. The fix: name additional profiles + give each one a default stack that LLMs already know well.

## 1. Profile A — `casual-portrait` (existing, unchanged)

**Stack**: Phaser 3.80 + Canvas 2D + portrait 320–428. **First-attempt success**: 94% (seeles.ai, 2026). **Use case**: match-3 / merge / clicker / tap-runner / drop-and-stack.

The existing baseline. No changes.

## 2. Profile B — `pixel-arcade` (refinement of existing)

**Stack**: Phaser 3.80 + `pixelArt: true` + locked palette (PICO-8 / NES / GameBoy DMG-04) + integer-aligned positions. Landscape OR portrait. **Use case**: top-down pixel adventure / pixel platformer (small) / shmup.

### Genre-specific additions over Profile A

| Concern | Default | Source |
|---|---|---|
| Renderer flag | `pixelArt: true` + `roundPixels: true` | Phaser docs |
| CSS | `image-rendering: pixelated` on `<canvas>` | MDN |
| Palette | locked array from lospec.com (16 / 25 colors max) | existing §1.1 spec |
| Sprite gen | procedural via `CanvasRenderingContext2D.fillRect(x,y,1,1)` | existing |
| Sprite fallback | **PixelLab.ai** API for 4/8-direction walks (text→sprite, Aseprite plugin) — 10× faster than hand-drawn walk cycles | PixelLab review 2026, jonathanyu.xyz |
| Atlas tool | Aseprite CLI `--format json-array --sheet-type packed` | existing fallback |
| Animation | 4-frame walk @ 8fps, 2-frame idle @ 4fps | NES family standard |
| Shake | integer-snapped (`Math.round`), 2px / 4px / 8px tiers | game-vibe pattern |
| Forbidden | subpixel motion, hover-animations, vector graphics, anti-aliased text | preserves chunky feel |

### LLM-pipeline reference

> "Researchers have been testing whether LLM agent systems can design pipelines that go from natural language descriptions into animated pixel art sprites" — kokutech, May 2025

→ The Crumb researcher's `step.research.video` schema can accept pixel-game references; the named-game lock-in (`agents/researcher.md` §1.5) already covers Korean Flash classics (레바의 모험, 메이플스토리). What's new: the pixel-arcade profile makes the integer-grid + locked-palette discipline binding for builder, not just suggestive.

## 3. Profile C — `sidescroll-2d` (NEW)

**Stack**: Phaser 3.80 + ArcadePhysics + landscape 16:9 (640×360 logical, scaled). **Use case**: side-scrolling platformer (Megaman-like / Sonic-like / Hollow Knight-lite) / horizontal shmup / autoscroll runner.

### Why Phaser ArcadePhysics specifically

Phaser blog 2026-04 head-to-head: "Phaser sits at about 500 KB and gives you a full 2D game framework. If stability and performance are your priority, Phaser is the strongest choice, handling test games consistently well with particularly strong Safari performance." (vs Kaplay's minimal API + Excalibur's 300 KB intermediate).

For sidescroll specifically, the killer features are:
- `ArcadePhysics.Body.checkCollision.up/down/left/right` for one-way platforms
- `physics.world.gravity.y` global + `body.allowGravity` per-entity
- `tilemapLayer.setCollisionByProperty({ collides: true })` for Tiled-style level data
- Built-in `body.onFloor()` / `body.onWall()` for state-machine triggers

### Profile C contract additions

```
Camera: this.cameras.main.startFollow(player, true, 0.1, 0.1)  // smooth lerp
Tile-based level: src/scenes/GameScene.js loads from src/levels/<level-id>.json
                  format: 2D array of tile indices, generated procedurally OR
                  hand-authored as a JS array literal (no .tmx file dep)
Parallax: 3-5 TileSprite layers at 0.2 / 0.5 / 1.0 / 1.5 / 2.0 scrollFactor
Hit-stop: on damage event, set this.physics.world.timeScale = 0 for 16-32ms
Coyote time: 80-120ms grace after leaving floor before jump disabled
Jump buffer: 80-120ms input grace before landing for jump-on-land
State machine: PlayerState = idle | run | jump | fall | hurt | dead
              implemented in src/entities/Player.js via switch + this.state
Keyboard: ArrowKeys + WASD (existing §1 movement rule applies)
Touch (mobile fallback): on-screen DPad in src/systems/InputManager.js
                          (left half = move, right half = jump/action)
File count: ≤ 30 (more than casual due to entities/, levels/, systems/state-machines)
Bundle: ≤ 8 MB (allow tilemap atlas)
```

### Camera + parallax sources

- Phaser official Cameras docs: `startFollow(target, roundPixels, lerpX, lerpY)`
- Sidescroll parallax pattern: `tileSprite.tilePositionX += this.cameras.main.scrollX * (1 - scrollFactor)` (manual TileSprite, not Phaser's built-in)

### Forbidden under Profile C

- ❌ True 3D (use Profile D)
- ❌ Real-time multiplayer (out of P0)
- ❌ Procedural level generation > 100 tiles (hand-author or pre-generate at boot)
- ❌ Pixel art ≥ 32×32 sprites without atlas (memory)

## 4. Profile D — `flash-3d-arcade` (NEW, opt-in, envelope-relaxed)

**Stack**: Three.js r170+ via CDN + WebGL2 + landscape 16:9. **Use case**: low-poly racer / asteroid shooter / dogfight / runner-in-3D / first-person arcade. Recreates the Flash-era browser-3D vibe (PaperVision3D / Away3D / 2007–2012 newgrounds.com 3D minigames).

### Why this profile justifies lifting the Three.js ban

The current §2 forbidden list says "Three.js / Babylon — outside the casual mobile envelope." That was correct for casual-portrait. For Flash-3D-arcade specifically, the calculus inverts:

| Argument | Source |
|---|---|
| Three.js is "the library of choice for vibe coding" with llms.txt support | utsubo 2026 ("What's New in Three.js 2026") |
| Three.js has 270× more downloads than Babylon, 337× more than PlayCanvas | utsubo 2026 (Three.js vs Babylon vs PlayCanvas) |
| LLM-friendly: clear API + declarative scene graph | utsubo 2026 |
| No-bundler workable: `import * as THREE from 'https://unpkg.com/three@0.170/build/three.module.js'` | Three.js docs |
| Pieter Levels' Vibe Coding Game Jam (2025-Q4) — "build a playable game in under 48 hours using AI tools" — produced predominantly Three.js outputs | Vibe Coding Game Jam |

The Phaser-only "94% first-attempt" stat does not generalize to 3D — for 3D arcade games specifically, **Three.js is the LLM-friendliest choice in 2026 by a wide margin**.

### Profile D envelope

```
Framework: Three.js r170+ via CDN unpkg
            <script type="importmap">
              { "imports": { "three": "https://unpkg.com/three@0.170/build/three.module.js" } }
            </script>
Renderer: WebGLRenderer, antialias=true, sRGBOutputColorSpace
Geometry: BoxGeometry / SphereGeometry / CylinderGeometry / TorusGeometry primitives only
          (no glTF imports for v0.1 of profile D — keeps emit surface in plaintext)
Material: MeshBasicMaterial / MeshStandardMaterial (no MeshPhysicalMaterial — LLM struggles with PBR)
Lighting: AmbientLight + DirectionalLight (no shadows for v0.1; flat-look "Flash" homage)
Camera: PerspectiveCamera fov=75 + OrbitControls (exploration) OR fixed 3rd-person (racer)
Scene: ≤ 100 meshes (keeps draw calls manageable on mobile WebGL2)
Post-FX: optional EffectComposer + UnrealBloomPass + FilmPass (Flash-era CRT vibe)
Physics: cannon-es OR rapier3d (CDN-loadable) OR pure-Three.js raycasting (no physics)
Touch: pointer drag = camera orbit; tap = action
Keyboard: ArrowKeys/WASD (camera), Space (action), Esc (pause)
File count: ≤ 30
Bundle: ≤ 12 MB (Three.js core ~700KB + post-fx ~50KB + cannon-es ~150KB + own code)
        Note: heavier than casual-portrait but justified by genre
```

### Profile D forbidden list

- ❌ glTF / FBX imports (v0.1 — restrict to primitives)
- ❌ PBR materials with `envMap` / `roughnessMap` / `metalnessMap`
- ❌ Real-time shadows (use baked AO via vertex colors)
- ❌ Skinned mesh animation (use Object3D translation/rotation)
- ❌ Multiplayer / WebRTC
- ❌ VR / AR

### Profile D rationale (one-liner for the user)

> "Pixel-arcade and sidescroll-2d stay on Phaser because LLMs already write that 94% right. Flash-3D-arcade lifts the Three.js ban because for browser 3D specifically, Three.js's 270× download lead + llms.txt support make it the LLM-friendliest choice in 2026 — and the user explicitly asked for 3D플래시게임."

## 5. Persistence profiles (orthogonal to genre)

The current `game-design.md` §1.2 has one persistence profile: `postgres-anon-leaderboard` (Supabase). The user asked for "로컬 스토리지 포함(postgres, ts orm 등) 이런 게임 제작에 특화된 스택". Proposed axis:

| Profile | Tier | When to use | Source |
|---|---|---|---|
| **`local-only`** | localStorage / IndexedDB+Dexie | offline, no signup, single-player | Dexie.org 2026 |
| **`postgres-anon`** | Supabase + anon-auth + RLS | leaderboard, no worker tier | existing §1.2 |
| **`edge-orm`** | Cloudflare D1 + Drizzle ORM + Worker | type-safe queries, single-digit-ms edge | Drizzle Cloudflare D1 docs |
| **`firebase-realtime`** | Firebase Realtime DB + anon-auth | live multi-cursor, low-latency push | (alt — not P0) |

### 5.1 `local-only` — IndexedDB + Dexie

**Default for every game.** Pure-browser, hundreds of MB storage, atomic transactions. Dexie's `useLiveQuery` hook makes IndexedDB the single source of truth — re-renders on local change.

```js
// src/systems/PersistenceManager.js
import Dexie from 'https://esm.sh/dexie@4'
const db = new Dexie('crumb-game')
db.version(1).stores({
  runs: '++id, score, duration_ms, seed, created_at',
  best: '&game_slug, best_score'
})
await db.runs.add({ score, duration_ms, seed, created_at: Date.now() })
const top10 = await db.runs.orderBy('score').reverse().limit(10).toArray()
```

Storage envelope: ≤ 50 MB per origin (browser-enforced). For Crumb leaderboards, `best` table holds 1 row per `game_slug` + `runs` table archives. No network, no auth, no env vars.

### 5.2 `postgres-anon` — Supabase (existing §1.2)

Browser-direct, anon-auth + RLS. No worker tier. Migration + RLS schema already specified. **Default when leaderboard markers detected** ("랭킹", "leaderboard", "high score").

### 5.3 `edge-orm` — Cloudflare D1 + Drizzle ORM

**Lifts §1.1 "no worker tier" constraint** — adds an opt-in Cloudflare Worker tier (`functions/api/runs.ts`) with Drizzle ORM. The browser hits the Worker via `fetch('/api/runs', { method: 'POST', ... })`; the Worker queries D1.

```typescript
// functions/api/runs.ts (Cloudflare Pages Function)
import { drizzle } from 'drizzle-orm/d1'
import { runs } from '../schema'
export const onRequestPost: PagesFunction<{DB: D1Database}> = async (ctx) => {
  const db = drizzle(ctx.env.DB)
  const body = await ctx.request.json()
  await db.insert(runs).values(body)
  return Response.json({ ok: true })
}
```

Tradeoffs:
- ✅ Single-digit-ms queries (edge-local SQLite)
- ✅ Type-safe (Drizzle TypeScript types end-to-end)
- ✅ Free tier (Cloudflare Pages + 5GB D1)
- ❌ Adds Worker tier — game is no longer "open index.html, runs"; needs `wrangler dev` locally OR Cloudflare Pages deploy
- ❌ D1 not for high-write (>1k writes/s); Crumb leaderboards usually low-write (1 write per game-over)
- ❌ Verifier qa-runner needs to spawn `wrangler dev` for D2 ground truth (heavier than current docker-postgres)

**When to pick**: when the user wants type-safe ORM queries (the user explicitly said "ts orm") AND is OK with `wrangler dev` as the smoke-test path.

### 5.4 `firebase-realtime` — alt (not P0)

Firebase Realtime DB + anon-auth, multi-client push. Use case: live ghost replay, multi-cursor co-op. Out of scope for first cut.

## 6. Persistence profile × genre profile combo matrix

|  | local-only | postgres-anon | edge-orm |
|---|---|---|---|
| **casual-portrait** | ✅ default | ✅ when "랭킹"/"leaderboard" | ⚠ adds wrangler tier |
| **pixel-arcade** | ✅ default (high-score) | ✅ optional | ⚠ adds wrangler tier |
| **sidescroll-2d** | ✅ default (level progress) | ⚠ rare (mostly local) | ⚠ adds wrangler tier |
| **flash-3d-arcade** | ✅ default (best lap time) | ✅ "global lap time" | ⚠ adds wrangler tier |

**`local-only` becomes the new default** (replaces "no persistence" as the silent fallback). Other profiles activate on explicit triggers. This prevents accidental Supabase env requirements for users who just want a single-player game.

## 7. Studio profile-picker — UI surface

`packages/studio` today is observation-only (SSE transcript tail). To let users pick genre + persistence at session start, add a **"New Session"** form (modal or sidebar) with:

```
[ Pitch text                                                ]
[ Pitch text continues...                                   ]

Genre profile:    ( ) auto-detect (default — researcher decides)
                  ( ) casual-portrait
                  ( ) pixel-arcade
                  ( ) sidescroll-2d
                  ( ) flash-3d-arcade   ⚠ relaxed envelope, opt-in

Persistence:      (•) local-only (default)
                  ( ) postgres-anon       — needs CRUMB_SUPABASE_URL
                  ( ) edge-orm (D1)        — needs Cloudflare Worker dep
                  ( ) firebase-realtime    — alpha, not recommended

Preset:           [ bagelcode-cross-3way    ▾ ]   (existing)

[ Spawn session ]
```

The selected `(genre, persistence, preset)` triple flows via:
- CLI: new `--genre <profile>` + `--persistence <profile>` flags on `crumb run`
- Env: `CRUMB_GENRE_PROFILE` / `CRUMB_PERSISTENCE_PROFILE` (read by planner-lead and builder)
- `task_ledger.genre_profile` / `task_ledger.persistence_profile` (populated by reducer when planner-lead sees the env or socratic answer)

`auto-detect` keeps the current behavior — researcher's named-game lock-in + concept-designer infer the profile from the pitch.

## See also

- [[bagelcode-gamestudio-subagents-deep-2026-05-03]] — sister: gamestudio prompt-structure deep dive
- [[bagelcode-genre-profile-decision-2026-05-03]] — synthesis: lift Three.js ban for opt-in profile D
- [[bagelcode-mobile-game-tech-2026]] — Phaser-only baseline (still valid for profiles A/B/C)
- [[bagelcode-stack-and-genre-2026]] — Bagelcode-vs-Crumb positioning (stays casual-mobile)
- `agents/specialists/game-design.md` §1 — envelope to extend with §1.4 / §1.5
- `packages/studio/src/server.ts` — studio HTTP surface for the new POST /sessions endpoint
