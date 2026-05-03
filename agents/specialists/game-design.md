# Game Design Contract

> The binding game-design contract for Crumb. Replaces the former `design/DESIGN.md` (root) and the never-shipped `agents/specialists/game-stack-constraint.md` planning. Inline-read by `agents/researcher.md` (video evidence schema), `agents/planner-lead.md` step.design (synth output format), `agents/builder.md` (envelope), and `agents/verifier.md` (evidence validation).
>
> Extends `wiki/concepts/bagelcode-mobile-game-tech-2026.md` (Phaser stack rationale) with the v0.3.0 video-evidence schema introduced when `researcher` was promoted to its own actor.

## §1 Hard envelope (every artifact MUST conform)

The non-negotiable technical floor under which every Crumb game artifact runs.
Verifier reads these as D6.portability ground truth via the `qa_check` effect
(`src/dispatcher/qa-runner.ts`).

**Multi-file modular envelope.** Frontier convergence (4 sources in
`wiki/references/bagelcode-mobile-multifile-frontier-2026-05-02.md`:
`Yakoub-ai/phaser4-gamedev`, `OpusGameLabs/game-creator`, Phaser-official Claude
Code tutorial 2026-02, Troy Scott "2D shooter in one evening") shows every
production-quality LLM-generated Phaser game in 2026 ships as a multi-file
modular project. v0.3.1 retired the v0.1.0 single-file fallback — multi-file is
the only profile.

### §1.1 Required profile — `multi-file` (every session)

```
artifacts/game/
  index.html                  # entry; viewport + manifest link + safe-area inset
  manifest.webmanifest        # PWA install descriptor (name / icons / start_url / theme_color)
  sw.js                       # cache-first service worker (offline guarantee)
  icon-192.png                # base64-emitted PNG, Canvas-rendered (or sharp 64×64 SVG re-rasterized)
  icon-512.png
  src/
    main.js                   # Phaser config + scene registration
    config/
      gameConfig.js           # canvas size, scale mode (Phaser.Scale.FIT), physics
      tuning.json             # balance numbers (mirrors artifacts/tuning.json)
    scenes/
      BootScene.js            # asset preload (procedural sprite + atlas generation)
      MenuScene.js
      GameScene.js
      GameOverScene.js
    entities/
      <one-file-per-entity>.js
    systems/
      AudioManager.js         # Web Audio synth — BGM 1 lead + 4 SFX, no <audio> src
      ScoreManager.js
      InputManager.js         # pointer events + drag + touch-action: none
  assets/
    sprites.png               # OPTIONAL — texture atlas if procedural rendering insufficient
    sprites.json              # OPTIONAL — atlas frame map
```

- **Output**: directory under `artifacts/game/` (≤ 5 MB total, ≤ 25 files).
  Procedural sprite generation (Canvas API in `BootScene`) is preferred over
  binary asset files — `OpusGameLabs/game-creator` pattern.
- **No build step**: ES modules + `<script type="module">` + import map in
  `index.html`. Phaser stays on CDN. Vite / webpack / esbuild forbidden — the
  project must run via `npx http-server artifacts/game` or by opening
  `index.html` in a static-file-aware browser. This keeps the LLM's emit
  surface in plain text and avoids a build dependency the evaluator must
  install.
- **Framework**: Phaser 3.80+ via CDN
  ```html
  <script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"></script>
  ```
- **Mobile-first**: viewport meta + `touch-action: none` + safe-area inset
  + portrait fit (Phaser `Scale.FIT` between 320–428 portrait).
- **PWA**: `manifest.webmanifest` + `sw.js` (single-file cache shell). Result:
  evaluator can scan a QR code + install on their phone.
- **Audio (procedural-first)**: Web Audio synth in `systems/AudioManager.js`
  — `OscillatorNode` 3-channel chiptune (square + triangle + noise = NES
  family), 4-step ADSR via `gain.gain.linearRampToValueAtTime`, lookahead
  clock from `AudioContext.currentTime` (Chris Wilson "A Tale of Two Clocks"
  pattern — `setInterval` drift kills loops). Default: 1 BGM lead + 4 SFX
  (jump / hit / coin / lose). Embed `jsfxr` seeds (4 ints) directly in
  `AudioManager.js` for SFX — zero asset bytes.
- **Audio (asset fallback, opt-in)**: When the goal explicitly demands
  produced audio, use ONLY: ElevenLabs Sound Effects (text-to-SFX), Suno v4
  (BGM ≤ 30s loop), Stable Audio 2.0 (CC-BY loop mode), MusicGen
  (`huggingface.co/facebook/musicgen-small`, local infer), or ChipTone
  (browser SFXR successor, free). Bundle ≤ 500 KB combined audio @ ≤ 96 kbps
  mono mp3. Builder MUST record source tool + license + prompt seed in
  `artifacts/game/CREDITS.md` so verifier can audit D5 originality.
- **Performance**: 60fps on iPhone Safari 16+ / Android Chrome 100+.
- **Touch (mobile primary)**: pointer events, ≥44×44 hit zones (WCAG 2.5.5 AAA).
- **Keyboard (desktop fallback, REQUIRED for movement-based games)**:
  - Movement: Arrow keys (↑↓←→) AND WASD — both bound to the same direction
    handler. Crumb's rule: any game with on-screen locomotion (action /
    runner / dungeon / shooter / platformer) MUST register both. Pure tap
    games (match-3, clicker, tap-defender) are exempt.
  - Action / jump: Space (and W or ↑ as alias in movement games).
  - Pause / menu: Esc.
  - Implementation in `systems/InputManager.js`:
    `this.input.keyboard.addKeys('W,A,S,D,SPACE,ESC')` + `createCursorKeys()`
    pointing at the same direction-vector method (`onMoveLeft()` etc).
  - Rationale: qa-check runs Playwright headless Chromium and presses keys
    (`page.keyboard.press('w')`, `'ArrowLeft'`) to verify acceptance criteria
    deterministically. Mobile target stays touch-first; keyboard is the
    desktop testability surface AND a no-cost accessibility win for
    keyboard-only players.
- **Pixel asset policy (procedural-first)**: render sprites in `BootScene`
  via `CanvasRenderingContext2D.fillRect(x, y, 1, 1)` 1-pixel discipline
  with a locked palette (PICO-8 16, NES 25, GameBoy DMG-04 etc — hex array
  from `lospec.com/palette-list`). Phaser config `{ pixelArt: true }` +
  `image-rendering: pixelated` in `index.html`. Integer-scale all positions
  (`Math.round`). 1px black outline + Bayer 2×2 dither delivers retro feel
  without an asset.
- **Pixel asset fallback (atlas, opt-in)**: When procedural emit cannot
  produce the requested fidelity, use ONLY: Aseprite (CLI
  `--format json-array --sheet-type packed`), Retro Diffusion
  (retrodiffusion.ai, palette-locked), PixelLab.ai (sprite + 4-direction
  walk anim), Scenario.gg (LoRA-trained sprite series), or Pyxel Edit.
  Forbidden: MidJourney / DALL-E / Recraft for sprite output (palette + grid
  drift, post-processing burden). Atlas total ≤ 1 MB. Builder MUST record
  source tool + license in `CREDITS.md`.
- **Network**: zero runtime requests after CDN load + SW first-fetch — game
  must run offline.

### §1.2 Persistence profile — `postgres-anon-leaderboard` (optional, opt-in)

A persistence dimension orthogonal to §1.1 / §1.2. When activated, the
generated game persists per-run scores to Postgres via Supabase, and surfaces
a top-100 leaderboard inside the game shell. Anonymous-first — no signup
required for a 60-second run. The profile is **opt-in**, never default.

**Trigger** (any of the below activates the profile during step.spec):

- pitch contains markers: `"leaderboard"`, `"랭킹"`, `"ranking"`, `"점수 저장"`, `"score persistence"`, `"기록"`, `"하이스코어"`, `"high score"`
- explicit user flag: `crumb run ... --persistence postgres`
- preset binding `actors.builder.profile = "multi-file+postgres"` in `.crumb/presets/<name>.toml`

**Backend contract** — Supabase Postgres + anonymous auth + Row-Level Security.
Frontier convergence (Supabase 2025 anon-auth GA + RLS) makes this the only
profile that satisfies §1.1 envelope (static Phaser + browser-direct SDK call,
no Node.js worker between client and DB). Neon / Cloudflare D1 / direct
`postgres://` from browser are **forbidden** under §1.1 (would require a
worker tier outside the static-PWA envelope).

**Required env** (read by builder + verifier from the session env or
`$CRUMB_HOME/.env`; never hardcoded into source):

```
CRUMB_PG_URL              # postgres://... (verifier-only, server-side migrations)
CRUMB_SUPABASE_URL        # https://<ref>.supabase.co
CRUMB_SUPABASE_ANON_KEY   # browser-safe public key (never service_role)
```

**Required schema** — builder MUST emit `artifacts/game/migrations/0001_init.sql`:

```sql
-- players: one row per anonymous browser session
CREATE TABLE players (
  id           uuid PRIMARY KEY DEFAULT auth.uid(),  -- = supabase anon JWT subject
  display_name text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY players_self_read   ON players FOR SELECT USING (true);
CREATE POLICY players_self_write  ON players FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY players_self_update ON players FOR UPDATE USING (id = auth.uid());

-- runs: append-only score events (mirrors transcript invariant)
CREATE TABLE runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    uuid NOT NULL REFERENCES players(id),
  game_slug    text NOT NULL,                        -- e.g. "cat-tap-match3-v1"
  score        int  NOT NULL CHECK (score >= 0),
  duration_ms  int  NOT NULL CHECK (duration_ms > 0),
  seed         text,                                  -- replay seed (rng deterministic)
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX runs_leaderboard_idx ON runs (game_slug, score DESC, created_at DESC);
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY runs_public_read    ON runs FOR SELECT USING (true);
CREATE POLICY runs_self_insert    ON runs FOR INSERT WITH CHECK (player_id = auth.uid());
-- no UPDATE / no DELETE policies → append-only

-- leaderboard_top100: materialized view, refreshed every 60s by pg_cron
CREATE MATERIALIZED VIEW leaderboard_top100 AS
  SELECT game_slug, player_id, MAX(score) AS best_score, MAX(created_at) AS last_run_at
  FROM runs GROUP BY game_slug, player_id
  ORDER BY game_slug, best_score DESC LIMIT 100;
CREATE UNIQUE INDEX leaderboard_top100_idx ON leaderboard_top100 (game_slug, player_id);
SELECT cron.schedule('refresh_leaderboard', '* * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_top100$$);
```

**Client surface** (Phaser scene → `@supabase/supabase-js` direct, browser-safe
anon key only — service_role NEVER ships):

```js
// src/systems/PersistenceManager.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supa = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

await supa.auth.signInAnonymously();                 // BootScene
await supa.from('runs').insert({                     // GameOverScene
  game_slug, score, duration_ms, seed
});
const { data } = await supa.from('leaderboard_top100')
  .select('player_id, best_score').eq('game_slug', GAME_SLUG);
```

**Verifier D2 ground truth** (`src/dispatcher/qa-runner.ts` extension —
emits `kind=qa.result.persistence`):

The `qa_check` effect runs a throwaway docker postgres against the emitted
migration and verifies four invariants. Any failure → `D2 = 0` enforced by
`src/validator/anti-deception.ts`:

| Invariant | Check |
|---|---|
| (a) migration applies | `psql -f 0001_init.sql` exits 0 against fresh `postgres:16-alpine` container |
| (b) anon insert | `auth.signInAnonymously()` then `INSERT INTO runs (...)` returns the row |
| (c) RLS isolation | Cross-player insert (`player_id` of a *different* anon JWT) returns 403 |
| (d) leaderboard MV | After 60s + manual `REFRESH`, `SELECT FROM leaderboard_top100 WHERE game_slug=X` returns ordered rows |

The check is **opt-in**: when neither the trigger markers nor `--persistence
postgres` is set, qa-runner skips the persistence sub-check entirely (D2
unaffected). When the profile is active and `CRUMB_PG_URL` is unset in the
verifier environment, qa-runner emits `kind=note` with `data.reason="postgres_url_missing"`
and downgrades the run to PARTIAL — the spec persists but cannot be verified
end-to-end.

**Forbidden under §1.3**:

- ❌ `service_role` key in client bundle (would let the browser bypass RLS)
- ❌ direct `postgres://` connection from browser (no worker tier in §1.1 envelope)
- ❌ score `UPDATE` or `DELETE` policies on `runs` (append-only invariant —
  mirrors transcript)
- ❌ hardcoded paths or DB URLs — every env value MUST come from
  `$CRUMB_HOME`-resolved env or session env
- ❌ Postgres extensions outside the Supabase managed-extension list
  (uuid-ossp, pgcrypto, pg_cron — the three this spec uses are all included)

**Frontier backing**: Supabase anonymous auth GA (2024-Q3), Postgres Weekly
"Anonymous auth + RLS for game leaderboards" (2025-11), `pg_cron` materialized
view refresh pattern (2024-2025 leaderboard hot-row mitigation).

### §1.3 Genre profile axis (v0.4 — 4 profiles)

Orthogonal to §1.1 (envelope) and §1.2 / §1.4 (persistence). Set via `task_ledger.genre_profile`:
- Studio picker / `crumb run --genre <profile>` — explicit
- researcher named-game lock-in (`agents/researcher.md` §1.5) when `auto-detect` (default)

§1.1 above is the **profile A baseline** (`casual-portrait`). Profiles B–C adapt the envelope per below; profile D (`flash-3d-arcade`) replaces the framework entirely.

#### §1.3.A `casual-portrait` (default — un-flagged sessions land here)

- Stack: Phaser 3.80 + Canvas 2D + portrait 320–428
- Use case: match-3 / merge / clicker / tap-runner / drop-and-stack
- §1.1 envelope applies as-is — no changes

#### §1.3.B `pixel-arcade`

- Stack: Phaser 3.80 + `pixelArt: true` + locked palette + integer-aligned positions
- Orientation: portrait OR landscape
- Use case: top-down pixel adventure / pixel platformer (small) / shmup
- Adaptations to §1.1:
  - `gameConfig.js`: `{ pixelArt: true, roundPixels: true }`
  - `index.html` adds `image-rendering: pixelated` on `<canvas>`
  - All sprite positions integer-aligned (`Math.round`); subpixel motion forbidden
  - Locked palette from lospec.com (16 / 25 colors max — PICO-8 / NES / GameBoy DMG-04)
  - Sprite gen procedural-first (`fillRect(x,y,1,1)` 1-pixel discipline); PixelLab.ai API allowed as fallback (4/8-direction walks)
  - Animation: 4-frame walk @ 8 fps, 2-frame idle @ 4 fps (NES family standard)
  - Screen shake: integer-snapped 2 / 4 / 8 px tiers (no float interpolation — see `agents/specialists/game-vibe.md` §pixel)
  - Anti-aliased text forbidden (use bitmap font sprite)

#### §1.3.C `sidescroll-2d`

- Stack: Phaser 3.80 + ArcadePhysics + landscape 16:9 (640×360 logical, scaled)
- Use case: side-scrolling platformer / horizontal shmup / autoscroll runner
- Adaptations to §1.1:
  - `gameConfig.js`: `{ physics: { default: 'arcade', arcade: { gravity: { y: 800 }, debug: false } } }`
  - File-count cap raised to ≤ 30 (entities/, levels/, systems/state-machines)
  - Bundle cap raised to ≤ 8 MB (allow tilemap atlas)
  - Camera: `cameras.main.startFollow(player, true, 0.1, 0.1)` (smooth lerp)
  - Parallax: 3–5 TileSprite layers at scrollFactor 0.2 / 0.5 / 1.0 / 1.5 / 2.0
  - Hit-stop: on damage, `physics.world.timeScale = 0` for 16–32 ms (see `game-vibe.md` §sidescroll)
  - Coyote time: 80–120 ms grace after leaving floor
  - Jump buffer: 80–120 ms input grace before landing
  - Player state machine: `idle | run | jump | fall | hurt | dead` in `src/entities/Player.js`
  - Level data: 2D array of tile indices in `src/levels/<id>.json` (procedural OR hand-authored; no `.tmx`)
  - Touch fallback: on-screen DPad (left half = move, right half = jump/action) in `src/systems/InputManager.js`

#### §1.3.D `flash-3d-arcade` (envelope-relaxed — opt-in only, never auto-selected)

- Stack: Three.js r170+ via CDN + WebGL2 + landscape 16:9
- Use case: low-poly racer / asteroid shooter / dogfight / 3rd-person runner / first-person arcade (Flash-era newgrounds.com homage)
- **Adaptations REPLACE §1.1** (not extend):
  - Framework: Three.js r170 (CDN unpkg + importmap)
    ```html
    <script type="importmap">
      { "imports": { "three": "https://unpkg.com/three@0.170/build/three.module.js" } }
    </script>
    ```
  - Renderer: `WebGLRenderer({ antialias: true })`, `outputColorSpace = SRGBColorSpace`
  - Geometry: `BoxGeometry / SphereGeometry / CylinderGeometry / TorusGeometry / PlaneGeometry` primitives only (v0.1 of profile D — keeps emit surface in plaintext)
  - Material: `MeshBasicMaterial / MeshStandardMaterial / MeshLambertMaterial` (no `MeshPhysicalMaterial` — LLM struggles with PBR per utsubo 2026)
  - Lighting: `AmbientLight + DirectionalLight` (no shadow maps for v0.1; flat-look "Flash" homage)
  - Camera: `PerspectiveCamera fov=75`; `OrbitControls` (exploration) OR fixed 3rd-person (racer)
  - Scene: ≤ 100 meshes (draw call budget for mobile WebGL2)
  - Post-FX (optional): `EffectComposer + UnrealBloomPass + FilmPass` (Flash-era CRT vibe)
  - Physics (optional): `cannon-es` OR `rapier3d` (CDN-loadable) OR Three-native raycasting only
  - File count: ≤ 30
  - Bundle: ≤ 12 MB (Three.js core ~700 KB + post-fx ~50 KB + cannon-es ~150 KB + own code)
  - Boot scene replaced: `src/main.js` instantiates `Scene + Camera + Renderer + animate()` loop directly (no Phaser scene manager)
- **§2 forbidden list relaxed for this profile only** (Three.js entry inverted; see §2 update below)
- Forbidden under §1.3.D specifically (additive to §2):
  - glTF / FBX / OBJ imports (v0.1 — primitives only)
  - PBR materials with `envMap / roughnessMap / metalnessMap`
  - Real-time shadows (use baked AO via vertex colors)
  - Skinned mesh animation (use `Object3D` translation/rotation)
  - Multiplayer / WebRTC / VR / AR
- Frontier backing: Three.js 270× downloads vs Babylon, 337× vs PlayCanvas (utsubo 2026); llms.txt support (utsubo 2026); Pieter Levels Vibe Coding Game Jam 2025-Q4

### §1.4 Persistence profile axis (v0.4 — 4 profiles)

Orthogonal to §1.3. Set via `task_ledger.persistence_profile`:
- Studio picker / `crumb run --persistence <profile>` — explicit
- planner-lead step.spec auto-set when `kind=goal` body matches leaderboard markers (existing §1.2 trigger preserved)
- Default: `local-only` for un-flagged sessions

#### §1.4.local-only — IndexedDB + Dexie (new default)

Pure browser-side persistence. No env vars. No worker tier. ~50 MB / origin practical (browser-enforced).

- Add to §1.1 file tree: `src/systems/PersistenceManager.js` — Dexie wrapper
- Implementation:
  ```js
  // src/systems/PersistenceManager.js
  import Dexie from 'https://esm.sh/dexie@4'
  const db = new Dexie('crumb-game-<slug>')
  db.version(1).stores({
    runs: '++id, score, duration_ms, seed, created_at',
    best: '&game_slug, best_score'
  })
  export async function saveRun({ score, duration_ms, seed }) {
    return db.runs.add({ score, duration_ms, seed, created_at: Date.now() })
  }
  export async function topScores(limit = 10) {
    return db.runs.orderBy('score').reverse().limit(limit).toArray()
  }
  ```
- qa-runner D2 ground truth: Playwright headless verifies:
  - (a) `Dexie` imports without throwing
  - (b) `db.runs.add(...)` returns numeric id
  - (c) `db.runs.orderBy('score').reverse().limit(10)` returns array
- No env required. **Default behavior for un-flagged sessions** (replaces silent "no persistence").
- Frontier backing: Dexie.org 2026; PkgPulse 2026 (`useLiveQuery` makes IndexedDB the single source of truth).

#### §1.4.postgres-anon — Supabase + anon-auth + RLS

See §1.2 above for full schema + qa.result invariants. Triggered by leaderboard markers (existing trigger logic preserved).

#### §1.4.edge-orm — Cloudflare D1 + Drizzle ORM + Worker (envelope-relaxed)

**Lifts §1.1 "no worker tier" — opt-in only.** Adds a Cloudflare Pages Function (`functions/api/runs.ts`) that the browser hits via `fetch('/api/runs')`.

- Add to file tree:
  - `functions/api/runs.ts` — Cloudflare Pages Function (TypeScript)
  - `functions/schema.ts` — Drizzle schema
  - `wrangler.toml` — Cloudflare config + D1 binding
  - `src/systems/PersistenceManager.js` — `fetch('/api/runs', ...)` wrapper
- Schema:
  ```typescript
  // functions/schema.ts
  import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'
  export const runs = sqliteTable('runs', {
    id:          integer('id').primaryKey({ autoIncrement: true }),
    game_slug:   text('game_slug').notNull(),
    score:       integer('score').notNull(),
    duration_ms: integer('duration_ms').notNull(),
    seed:        text('seed'),
    created_at:  integer('created_at').notNull()
  })
  ```
- Worker:
  ```typescript
  // functions/api/runs.ts
  import { drizzle } from 'drizzle-orm/d1'
  import { runs } from '../schema'
  export const onRequestPost: PagesFunction<{DB: D1Database}> = async (ctx) => {
    const db = drizzle(ctx.env.DB)
    const body = await ctx.request.json()
    await db.insert(runs).values({ ...body, created_at: Date.now() })
    return Response.json({ ok: true })
  }
  ```
- qa-runner D2 ground truth: spawns `wrangler dev` (default port 8787) and verifies:
  - (a) `wrangler dev` boots
  - (b) `POST /api/runs` returns 200 with valid body
  - (c) D1 migration applies cleanly (`wrangler d1 migrations apply <db> --local`)
  - (d) `GET /api/runs?game_slug=<x>&limit=10` returns ordered rows
- **Soft fallback**: when `wrangler` CLI is not on PATH → qa-runner emits `kind=note` with `data.reason="wrangler_not_found"`, downgrades D2 to PARTIAL (mirrors §1.2 `CRUMB_PG_URL`-missing fallback).
- Tradeoff: type-safe end-to-end + single-digit-ms edge queries; but requires `wrangler` CLI (`npm install -g wrangler`) for full qa.result.
- **Forbidden under §1.4.edge-orm specifically**: writing to D1 from anywhere except the Worker (no direct browser → D1 — Workers-only access model is the security boundary).
- Frontier backing: orm.drizzle.team Cloudflare D1 docs ("Drizzle ORM lives on the Edge"); DEV 2025-2026 ("SQLite at the Edge Without the Pain").

#### §1.4.firebase-realtime — alpha (P0 제외)

Reserved profile name. Not implemented in v0.4. Use case: live ghost replay, multi-cursor co-op.

#### §1.4 trigger logic (planner-lead step.spec)

```
if --persistence flag set or task_ledger.persistence_profile pre-populated:
  → use that
elif kind=goal body matches leaderboard markers
     ("랭킹" | "leaderboard" | "ranking" | "high score" | "기록" | "하이스코어" | "점수 저장" | "score persistence"):
  → postgres-anon (existing §1.2 trigger preserved for backward compat)
else:
  → local-only (new default)
```

## §2 Forbidden (v0.4 — genre/persistence-profile-aware)

| Forbidden | Reason | Profile exception? |
|---|---|---|
| ❌ npm bundlers (webpack / vite / parcel / esbuild) | produces output that needs `npm install` to evaluate; defeats "run as the README says" | none |
| ❌ native engine output (Unity / Godot / Unreal binaries) | not portable, not LLM-emit-able in plain text | none |
| ❌ Three.js / Babylon | outside casual mobile envelope (profiles A–C) | **§1.3.D `flash-3d-arcade` allows Three.js r170 only** |
| ❌ Worker / server tier | static-PWA envelope (profiles A–C + persistence local-only / postgres-anon) | **§1.4.edge-orm allows a Cloudflare Pages Function only** |
| ❌ external asset URLs except embedded `data:` URIs and the Phaser CDN | breaks offline run | profile-D extends allowlist to `unpkg.com/three@0.170/*` |
| ❌ Phaser 2 syntax | use 3.80+ (Scene class, ArcadePhysics, etc.) | N/A under §1.3.D (Three.js doesn't use Phaser) |
| ❌ network requests at runtime (game state) | game must run offline after CDN load | **§1.4.edge-orm allows same-origin `/api/*` only** |
| ❌ proprietary game references (IAP, ads, live ops) | P0 scope | none |

## §2.5 Visual identity input — DESIGN.md (VoltAgent format)

When the user drops a DESIGN.md (Google Stitch / VoltAgent
`awesome-design-md` format) into `<session>/inbox/design.md` or
`<session>/artifacts/DESIGN.brand.md`, the planner-lead **inline-reads it
during step.design** and treats the colors / typography / component stylings
/ spacing / motion sections as binding constraints for the Phaser game's
palette + UI vocabulary. The 71 reference files at
`https://github.com/VoltAgent/awesome-design-md/tree/main/design-md` (Stripe /
Vercel / Linear / Sentry / Notion / etc.) are the canonical source of valid
DESIGN.md shape; any user-supplied DESIGN.md MUST follow that 9-section
structure (visual theme / color palette + roles / typography / component
stylings / layout / depth / do's-and-don'ts / responsive / agent prompt
guide).

When NO DESIGN.md is supplied, planner-lead falls back to its own visual
designer specialist (`agents/specialists/visual-designer.md`) for palette
+ motion choices — same code path as before.

## §3 Video evidence schema (v0.3.0 — researcher actor)

When the `researcher` actor extracts mechanics from a gameplay clip, it emits `kind=step.research.video` events conforming to this schema. The schema is the ground truth the planner reads in step.design and the verifier reads for D5 evidence validation.

### §3.1 `MechanicEvidence` — one entry per observed mechanic

```yaml
name: <kebab-case>                        # e.g. "combo-cascade", "timed-boost", "color-bomb"
timestamp_range_s: [<start>, <end>]       # clip-relative seconds, float
frame_observations:                       # 3-5 short bullets, what is visually distinct
  - "tiles flash white at match"
  - "score multiplier text grows from 1x to 5x over ~400ms"
  - "next combo within 200ms triggers cascade"
timing_ms:                                # only fields that were measurable; omit unknowns
  combo_window_ms: <int>                  # max gap between matches that still cascades
  cascade_delay_ms: <int>                 # delay between cascade waves
  animation_duration_ms: <int>            # match-to-clear animation length
  feedback_lag_ms: <int>                  # input → visual response
palette_hint: ["#hex1", "#hex2", ...]     # 3-5 dominant hex codes from tile/background pixels
difficulty_signal: <none | increasing | spike | drop>
envelope_fit: <"fits" | "fits-with-adaptation" | "out-of-envelope">   # v0.3.6
adaptation_note: <string>                 # required when envelope_fit = "fits-with-adaptation";
                                          # e.g. "3D parallax → 2.5D layered Phaser TileSprite"
```

### §3.2 `step.research.video` event shape

```yaml
kind: step.research.video
from: researcher
body: "<one-line summary, e.g. 'Royal Match 30s clip — 4 mechanics extracted'>"
data:
  video_ref: "https://youtu.be/<clip-id>" | "sessions/<id>/inbox/<file>.mp4"
  duration_s: <float>
  frame_rate_used: <1 | 2 | 5 | 10>       # higher = faster-paced gameplay
  mechanics_extracted: [<MechanicEvidence>, ...]   # 1-8 envelope-fit entries
  mechanics_out_of_envelope:              # v0.3.6 — pre-filtered against §1 / §2
    - name: <kebab-case>                  # e.g. "live-pvp-matchmaking"
      forbidden_reason: <string>          # cite the §2 row, e.g. "§2 network requests at runtime"
      frame_observations: [<bullet>, ...] # 1-2 bullets so verifier can audit the filter call
  palette_observed: ["#hex1", ...]        # union of mechanic palette_hints
  timing_summary:                         # consensus across mechanics
    combo_window_ms?: <int>
    cascade_delay_ms?: <int>
    animation_duration_ms?: <int>
metadata:
  deterministic: false                    # ★ LLM output — replay reads cached
  cache_key: <sha256(video_ref + model + prompt_version)>
  provider: google
  model: gemini-3-1-pro
  evidence_kind: video
```

### §3.3 Sampling rate guidance

| Gameplay pace | Recommended `frame_rate_used` | Token cost @ 30s |
|---|---|---|
| Strategy / turn-based / puzzle | 1 fps | ~9K tokens |
| Casual match-3 / runner | 2 fps | ~18K tokens |
| Action / arcade / shmup | 5 fps | ~45K tokens |
| Fast-paced action / fighting / rhythm | 10 fps | ~90K tokens |

Crumb default for casual mobile = **2 fps**. Bump to 5–10 fps only when timing measurements (combo_window_ms, frame-perfect inputs) are critical.

## §4 `step.research` synthesis schema (researcher → planner)

The researcher's final synthesis combines `step.research.video` events into 3 reference games × 3 actionable lessons. Each lesson MUST reduce to a `tuning.json` numeric or a §1 envelope choice.

```yaml
kind: step.research
from: researcher
body: "<3-lesson summary>"
data:
  reference_games:
    - name: <e.g. "Royal Match">
      studio: <e.g. "Dream Games">
      genre: match-3
      key_pattern: <one-line e.g. "first 5 levels = free wins (retention)">
      evidence_refs: [<step.research.video.id>, ...]    # empty if text-only path
  design_lessons:
    - lesson: <e.g. "Combo cascade window 200ms ± 50ms maximizes satisfaction">
      apply_as: <e.g. "tuning.json: combo_window_ms = 200">
      evidence_refs: [<step.research.video.id>, ...]    # ★ required when videos analyzed
metadata:
  deterministic: false
  evidence_summary:
    videos_analyzed: <int>
    total_frames_observed: <int>
```

**Verifier rule (anti-deception)**: when `evidence_summary.videos_analyzed > 0`, every `design_lesson` MUST have non-empty `evidence_refs`. Empty refs → `validator/anti-deception.ts` forces `D5=0` (same firewall pattern as qa.result D2/D6).

## §5 `artifacts/DESIGN.md` synth output format (planner-lead step.design)

Planner-lead's final synth combines step.research + step.design into `artifacts/DESIGN.md`. This is the binding document the builder reads to write the multi-file PWA under `artifacts/game/`.

```markdown
# <Game Title> — DESIGN.md

## §1 Concept (from step.concept)
- core_mechanic: <one-line>
- win_condition: <testable>
- lose_condition: <testable>
- combo_rule: <one-line>
- difficulty_curve: <flat | linear | stepped>

## §2 Palette (from step.design + research evidence)
- background: <#hex>      # contrast ≥ 4.5:1 vs primary
- primary: <#hex>
- secondary: <#hex>
- accent: <#hex>
- text: <#hex>
- evidence_refs: [<step.research.video.id>, ...]   # empty in text-only path

## §3 Motion timings (from research evidence — exact values, not ranges)
- match_animation_ms: <int>          # cite step.research.video.<id>.timing_summary.animation_duration_ms
- combo_window_ms: <int>             # cite ...timing_summary.combo_window_ms
- cascade_delay_ms: <int>            # cite ...timing_summary.cascade_delay_ms
- game_over_ms: <int>
- evidence_refs: [<id>, ...]

## §4 HUD layout (from step.design visual-designer)
- score_position: <top-center | top-right>
- timer_position: <top-left>
- combo_indicator: <one-line>
- safe_area_top_px: <int>            # iPhone notch
- safe_area_bottom_px: <int>         # home indicator

## §5 Accessibility
- contrast_min: 4.5
- colorblind_safe: <true | false>
- hit_zone_min_px: 44

## §6 Stack envelope (from §1 of agents/specialists/game-design.md — non-negotiable)
- framework: Phaser 3.80+ CDN
- bundle_max_kb: 60
- viewport: 320–428 portrait
```

## §6 How each actor reads this file

| Actor | Reads | Why |
|---|---|---|
| `researcher` | §1 envelope (rejects out-of-envelope mechanic suggestions) + §1.3 genre profile axis (proposes profile when `auto-detect`) + §3 video evidence schema + §4 synth schema | Sandwich inline-specialist |
| `planner-lead` step.design | §1 envelope + §1.3 genre profile (selects template + envelope adaptations) + §1.4 persistence profile (selects PersistenceManager template) + §5 DESIGN.md synth format | Sandwich inline-specialist |
| `builder` | §1 envelope + §1.3 (file-tree template + framework + envelope adaptations per profile) + §1.4 (PersistenceManager + qa-runner expectations) + §2 forbidden (binding while writing `artifacts/game/**`) + §5 (reads `artifacts/DESIGN.md` per format) | Sandwich §"Inputs" |
| `verifier` | §1 + §1.3 (per-genre rubric) + §1.4 (per-persistence qa.result invariants) + §2 (D6.portability via qa.result lookup) + §3.3/§4 evidence schema (D5 anti-deception rule) | CourtEval D5/D6 input |

## §6.5 LLM playthrough — verifier responsibility (v0.3.1)

The deterministic `qa_check` effect (htmlhint + Playwright headless smoke
served via `npx http-server artifacts/game/`) gives D2 / D6 ground truth and
is **never replaced** — that's the anti-deception floor. v0.3.1 layers an
**LLM playthrough** on top:

- The verifier's CourtEval Grader sub-step uses **Playwright MCP** (Anthropic's
  Model Context Protocol — `wiki/references/bagelcode-llm-qa-playthrough-2026-05-03.md`)
  to drive a real headless Chromium against the running game and execute a
  short scenario derived from `spec.md` acceptance criteria (e.g. "tap start →
  drag a tile → verify combo counter increments"). This is what
  `microsoft/playwright-mcp` v1.56+ ("planner / generator / healer" agent
  trio, GA in 2025-10) was designed for.
- Each AC item becomes one **playthrough scenario step**; the verifier emits
  `kind=step.judge` (step=`grader`) with `data.scenario_steps` listing
  `{ac_id, action, observation, pass|fail}`.
- D1 (spec_fit) score now requires `evidence` to cite scenario-step msg ids —
  empty evidence → D1 ≤ 2.
- Critic / Defender sub-steps re-read the scenario log; Re-grader closes.
- Vision-driven verification is OPT-IN (Computer Use API): the verifier MAY
  request a screenshot at scenario end and grade visual fidelity vs DESIGN.md
  palette / motion timings. Frontier 2026 evidence (Anthropic
  *Demystifying Evals* + Adnan Masood Apr 2026) recommends rubric-based
  pointwise grading for UX dims; we follow that pattern.

The LLM playthrough is **additive evidence**, never overrides the
deterministic D2 / D6 ground truth from `qa.result`. Anti-deception Rules 1-2
still force-correct any verifier attempt to claim D2 ≠ qa.result.

## §AC-Predicate-Compile — deterministic AC layer (v0.3.5)

The verifier-side LLM playthrough above (§6.5) covers subjective AC
verification; `qa-interactive` covers the **deterministic** layer right
underneath. Together they form a two-tier AC verification model:

```
spec.data.acceptance_criteria  ── strings, may include subjective items ──▶ verifier LLM (D1 / D5)
spec.data.ac_predicates         ── deterministic, browser-side ──────────▶ qa_check effect (D2 ground truth ext)
```

### §AC-Predicate-Compile.1 — `ACPredicateItem` schema

Planner-lead emits one `ACPredicateItem` per deterministic AC at spec-seal:

| field | required | type | semantics |
|---|---|---|---|
| `id` | ✅ | `string` | Stable identifier (e.g. `AC1`, `AC2-cluster-tap`). Used as the key in `qa.result.data.ac_results[].ac_id`. |
| `intent` | ✅ | `string` | One-line natural language; for diagnostic logs. |
| `predicate_js` | ✅ | `string` | A JavaScript expression evaluated in browser context; must return a truthy boolean for PASS. Wrapped in `(() => { return ${predicate_js}; })()` by the runner. May reference `window`, `document`, `Phaser`, `window.__GAME__`. |
| `action_js` | optional | `string \| null` | Pre-action evaluated in browser context before predicate. Use for ACs that need a click / drag / state mutation first (e.g. `document.querySelector('[data-tile][data-row="0"][data-col="0"]').click()`). `null` or absent = no pre-action. |
| `wait_ms` | optional | `int` | Sleep between action and first predicate eval (default 250 ms). Use for animation completion (cluster clear at 220 ms → set 250). |
| `timeout_ms` | optional | `int` | Max wait for predicate to become truthy via `page.waitForFunction` polling (default 3000 ms; capped at `CRUMB_QA_AC_TIMEOUT_MS`). |

### §AC-Predicate-Compile.2 — runner contract

`src/effects/qa-interactive.ts` (no LLM call) executes the items in order:

1. Reuse the local HTTP server + headless Chromium that
   `qa-check-playwright.ts` boots for the static smoke. New context per AC
   to guarantee state isolation; service worker cache survives within the
   browser process.
2. Wait for canvas + Phaser SYS.RUNNING (5) (ArtifactsBench probe — same as
   §1 boot truth).
3. For each `ACPredicateItem`:
   - if `action_js` set → `await page.evaluate(action_js)`
   - sleep `wait_ms` ms
   - `await page.waitForFunction("(() => { return " + predicate_js + "; })()", { timeout: timeout_ms })`
   - any console-error during the AC window → status = `FAIL` with reason
   - timeout → status = `FAIL` with `predicate_did_not_become_truthy`
   - thrown exception in `action_js` or `predicate_js` → status = `FAIL` with `error: <msg>`
   - else → status = `PASS`
4. Aggregate into `ac_results: ACResult[]` plus counters
   `ac_pass_count` / `ac_total`.

### §AC-Predicate-Compile.3 — anti-deception integration

When `ac_predicates.length > 0`, the dispatcher's `qa-runner.ts` runs the
deterministic AC layer and writes the per-AC pass/fail into
`qa.result.data.ac_results[]`. The verifier MUST read these as ground
truth — anti-deception **Rule 1-extended**: judge.score with verdict=PASS
where any `ac_results[].status === 'FAIL'` forces D1 ≤ 2 (mirrors the
existing `exec_exit_code ≠ 0 → D2=0` rule for D1 functional fit).

Karpathy autoresearch immutable-harness rule: predicates are emitted **once
at spec-seal** by the planner. Subsequent verifier rounds read the same
predicates — no re-compilation, no LLM-generated drift. The cost: planner
must invest one socratic round to compile each AC's `predicate_js`. The
benefit: `D1 functional` now has the same anti-deception protection as `D2
exec` and `D6 portability`, closing the LLM-vs-evidence gap documented in
`wiki/findings/bagelcode-frontier-evidence-vs-llm-reasoning-2026-05-03.md`.

### §AC-Predicate-Compile.4 — what NOT to predicate

Predicate compilation is for state-observable assertions only. **Do NOT** try
to compile:

- Visual fidelity ("juicy feedback", "satisfying motion") — verifier LLM
  scenario steps via Playwright MCP (§6.5)
- Multi-input flow narrative ("game over modal flows correctly into restart")
  — verifier MCP playthrough
- Visual contrast values — verifier MCP screenshot grading
- Audio quality / volume balance — out of headless smoke scope (no audio)
- Any AC whose definition depends on aesthetic / stylistic judgement

Heuristic: if the AC's "How to test" column contains a measurable predicate
expression (count, value comparison, classList check, RGB hex match,
attribute check), it goes into `ac_predicates`. If it contains adjectives
("smooth", "responsive", "satisfying"), it stays in
`acceptance_criteria` strings only.

## §7 Migration notes (from former design/DESIGN.md)

The root-level `design/DESIGN.md` has been deleted as of v0.3.0. Three reasons:

1. **Asymmetry**: it lived alone outside `agents/`, while every other planner-input file is under `agents/specialists/`.
2. **Scope drift**: it only covered the §1 envelope (Phaser stack). The new file unifies envelope + video evidence schema + synth format — one file the verifier reads end-to-end.
3. **Researcher promotion**: when `researcher` became its own actor (v0.3.0), the video-evidence schema needed a single source of truth all 4 actors (researcher + planner + builder + verifier) could inline-read. Putting it under `agents/specialists/` matches the existing pattern (`concept-designer.md`, `visual-designer.md`).

## See also

- [[bagelcode-mobile-game-tech-2026]] — Phaser stack rationale, 13 sources
- [[bagelcode-stack-and-genre-2026]] — casual mobile market context
- [[bagelcode-system-architecture-v0.1]] §3.2 — specialist inline-read pattern
- `agents/researcher.md` — primary consumer of §3 video evidence schema
- `agents/planner-lead.md` step.design — primary consumer of §5 synth format
- `agents/builder.md` — primary consumer of §1 envelope
- `agents/verifier.md` — D5 evidence validation against §3
