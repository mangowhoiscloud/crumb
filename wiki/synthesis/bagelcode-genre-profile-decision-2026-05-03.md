---
title: Genre profile decision — extend Crumb's envelope to 4 profiles + 4 persistence axes (2026-05-03)
category: synthesis
tags: [bagelcode, decision, envelope, genre-profile, persistence-profile, three-js-opt-in, studio-picker, 2026]
sources:
  - "[[bagelcode-gamestudio-subagents-deep-2026-05-03]] — gamestudio specialist gaps (technical-artist + game-feel)"
  - "[[bagelcode-genre-stack-frontier-2026-05-03]] — 2026 frontier per-genre stacks"
  - "[[bagelcode-mobile-game-tech-2026]] — current Phaser-only baseline"
  - "agents/specialists/game-design.md §1 envelope (current, single-profile)"
  - "agents/researcher.md §1.5 named-game lock-in (existing genre-aware path)"
summary: >-
  Decision: extend Crumb from one genre profile (casual-portrait Phaser) to four
  (casual-portrait / pixel-arcade / sidescroll-2d / flash-3d-arcade) + four persistence
  profiles (local-only / postgres-anon / edge-orm / firebase-realtime). Lift the §2 Three.js
  ban for the opt-in flash-3d-arcade profile only. Add 2 specialists (technical-artist +
  game-feel). Add Studio profile picker. Phased migration so existing casual-portrait sessions
  remain bit-identical.
provenance:
  extracted: 0.40
  inferred: 0.50
  ambiguous: 0.10
created: 2026-05-03
updated: 2026-05-03
---

# Decision — extend Crumb's envelope to a 4×4 profile matrix

> **One-line decision**: name 4 genre profiles + 4 persistence profiles, default to
> `auto-detect` × `local-only` (preserves current behavior), and lift the §2 Three.js ban
> for the opt-in `flash-3d-arcade` profile only.

## 1. The decisions

### D1. Genre profile axis (4 values)

| Profile | Stack | Default? | Lifts forbidden? |
|---|---|---|---|
| **`casual-portrait`** | Phaser 3.80 portrait 320–428 | yes (current default) | no |
| **`pixel-arcade`** | Phaser 3.80 + pixelArt + locked palette | no | no |
| **`sidescroll-2d`** | Phaser 3.80 ArcadePhysics + landscape 16:9 | no | no |
| **`flash-3d-arcade`** | Three.js r170 CDN + WebGL2 | no | **YES — Three.js allowed for this profile only** |

`auto-detect` (the picker's default) hands the choice to the researcher's named-game lock-in (`agents/researcher.md` §1.5) + concept-designer. Explicit pick overrides.

### D2. Persistence profile axis (4 values)

| Profile | Tier | Default? |
|---|---|---|
| **`local-only`** | localStorage / IndexedDB+Dexie | yes (new default; replaces silent "no persistence") |
| **`postgres-anon`** | Supabase + anon-auth + RLS (existing §1.2) | activates on leaderboard markers |
| **`edge-orm`** | Cloudflare D1 + Drizzle ORM + Worker | opt-in; lifts §1.1 "no worker tier" |
| **`firebase-realtime`** | Firebase RTDB + anon-auth | alpha — out of P0 |

### D3. Two new specialists

`agents/specialists/technical-artist.md` (gamestudio gap) and `agents/specialists/game-feel.md` (gamestudio gap). Inline-read by planner-lead step.design + builder. Genre-aware sub-sections.

### D4. Studio profile picker

`packages/studio/` adds a **New Session** form (genre + persistence + preset). Selection flows via CLI flags + env + `task_ledger`. `auto-detect` stays the default so existing flows are unaffected.

## 2. The tradeoffs (pin to memory)

### T1. Lifting the Three.js ban — risk

The current §2 forbidden list includes "Three.js / Babylon" with reason "outside the casual mobile envelope". For Bagelcode's stack-and-genre context ([[bagelcode-stack-and-genre-2026]] — casual mobile / social casino), this remains true for profiles A/B/C. Profile D opens a path the evaluator may not expect.

**Mitigation**: Profile D is **opt-in only** (never auto-selected by researcher). The user must explicitly pick it via the Studio picker or `--genre flash-3d-arcade`. The default behavior for un-flagged sessions is unchanged. The evaluator running the bagelcode-cross-3way preset on a "match-3" pitch will get the exact same Phaser output as before.

**Why accept the risk**: the user (mango) explicitly asked for "3D 플래시 게임" coverage. The Bagelcode evaluator may also pitch experimental genres ("로켓리그 같은 거 만들어봐"). A harness that says "I refuse — out of envelope" is brittle; one that says "I have a separate Three.js profile for this" is robust. The ban-lift is gated, not blanket.

### T2. Worker tier in `edge-orm` profile

Crumb's static-PWA envelope (§1.1) currently rules out worker tiers — every game is "open the index.html, it works". The edge-orm profile breaks that: it requires `wrangler dev` locally or Cloudflare Pages deploy.

**Mitigation**: edge-orm is **opt-in**, never auto-selected. Default persistence is local-only. The verifier qa-runner gains a `--persistence-profile` switch that knows to spawn `wrangler dev` instead of docker-postgres for D2 ground truth. When the profile is active and `wrangler` isn't installed, qa.result reports PARTIAL (same fallback as the missing CRUMB_PG_URL case in current §1.2).

**Why accept**: type-safe ORM queries are a real, named ask from the user. Drizzle + D1 is the LLM-friendliest 2026 path (Drizzle ORM lives on the Edge per orm.drizzle.team docs). Refusing it would be principled-purity at the cost of a stated requirement.

### T3. Specialist count growth

Adding 2 specialists takes the planner-lead inline-read budget from 3 (concept / visual / game-design) to 4 (+ technical-artist). Builder gains 2 (game-design now + technical-artist + game-feel). Token cost: ~+8KB on the planner spawn, ~+10KB on the builder spawn. Within the 200K Claude Opus 4.7 context window — no concern.

### T4. Genre profile auto-detection drift

If the researcher's named-game lock-in mis-classifies "메이플스토리 같은 게임" as casual-portrait when it should be sidescroll-2d, the planner emits a Phaser-portrait spec → builder implements a flat thing → user disappointed.

**Mitigation**: when `genre_profile` is `auto-detect`, the researcher emits a `kind=note` with `data.proposed_genre_profile=<choice>` + `data.confidence=<float>` so the user (or studio picker UI) can override before the planner seals the spec. Confidence < 0.7 → studio surfaces a confirmation prompt.

## 3. Migration plan (phased, non-destructive)

### Phase 1 — Wiki + decision land (this commit)
- ✅ `wiki/references/bagelcode-gamestudio-subagents-deep-2026-05-03.md`
- ✅ `wiki/references/bagelcode-genre-stack-frontier-2026-05-03.md`
- ✅ `wiki/synthesis/bagelcode-genre-profile-decision-2026-05-03.md` (this file)
- gate: user sign-off before Phase 2

### Phase 2 — `agents/specialists/game-design.md` extension
- §1.4 genre-profile axis (4 profiles, with adaptation per §3 of frontier doc)
- §1.5 persistence-profile axis (4 profiles, table + decision tree)
- §2 Forbidden list updated: Three.js entry now reads "Three.js / Babylon — forbidden EXCEPT under `genre_profile=flash-3d-arcade` (see §1.4.D)"
- §1.1 envelope explicitly says "Phaser 3.80 envelope applies to genre profiles A/B/C; profile D switches to §1.4.D Three.js envelope"

### Phase 3 — Two new specialists
- `agents/specialists/technical-artist.md` (genre-aware shader / VFX / particle pool guidance)
- `agents/specialists/game-feel.md` (genre-aware juice timings, screen-shake tiers, hit-stop rules)
- planner-lead.md and builder.md sandwich frontmatters add `inline_specialists` entries

### Phase 4 — Specialist deepening (existing files)
- `concept-designer.md` — genre-profile-aware mechanic templates (sidescroll: jump arc / coyote time / hit-stop; pixel: integer grid / palette lock; 3D: camera control / lap timer)
- `visual-designer.md` — genre-aware HUD layouts (sidescroll: HP bar + score; pixel: chunk-aligned numbers; 3D: HUD on screen overlay only, no 3D-space text)
- `researcher.md` — `data.proposed_genre_profile` emission when `genre_profile=auto-detect`; `mechanics_out_of_envelope` filter becomes profile-aware (Three.js OK under profile D)
- `builder.md` — genre-profile branch in §"Steps" (4 templates: portrait Phaser / pixel Phaser / sidescroll Phaser / 3D Three.js)

### Phase 5 — CLI / dispatcher / preset plumbing
- `--genre <profile>` flag on `crumb run`
- `--persistence <profile>` flag on `crumb run`
- `task_ledger.genre_profile` / `task_ledger.persistence_profile` (populated by reducer)
- `metadata.genre_profile` / `metadata.persistence_profile` on emitted messages (for studio render)
- `.crumb/presets/*.toml` add optional `[actors.builder]` `genre_profile = "..."` override
- `qa-runner.ts` reads `task_ledger.genre_profile` to pick the smoke-test scenario (different ACs per genre)

### Phase 6 — Studio profile picker
- `packages/studio/src/server.ts` — `POST /sessions` endpoint accepting `{ pitch, genre_profile, persistence_profile, preset }`
- `packages/studio/src/studio-html.ts` — New Session form modal
- `packages/studio/src/server.ts` — render `task_ledger.genre_profile` + `task_ledger.persistence_profile` in the session sidebar
- `crumb run` JSON-output mode used by studio (already exists — `--json` flag)

### Phase 7 — Verifier integration
- D5.feel grading rubric reads `agents/specialists/game-feel.md` Quality-checklist subsection (per genre)
- Anti-deception rule: `judge.score` D5 with no game-feel evidence → D5 ≤ 4
- D6.portability adapts per profile (local-only → no env check; postgres-anon → CRUMB_SUPABASE_URL; edge-orm → wrangler dev pingable)

### Phase 8 — Tests + CI
- `src/dispatcher/preset-loader.test.ts` extended for genre/persistence resolution
- `src/effects/qa-interactive.test.ts` extended for per-profile predicate runners
- `packages/studio/src/server.test.ts` covers POST /sessions

### Phase 9 — Backfill + docs
- `README.md` / `README.ko.md` — document the picker UI + new profiles
- `CHANGELOG.md` — entry under [Unreleased]
- 1 example session per profile (in `examples/` or wiki) so evaluators can play one of each

## 4. What does NOT change

- ✅ All 8 architecture invariants from `AGENTS.md` (transcript / pure reducer / sandwich / 3-layer scoring / append-only / ULID / sandbox / actor split)
- ✅ The 9-actor list (no new actors added)
- ✅ The 39 transcript kinds (`metadata.genre_profile` / `task_ledger.genre_profile` are field additions, not new kinds)
- ✅ Default behavior for un-flagged casual-portrait sessions (bit-identical)
- ✅ `bagelcode-cross-3way` preset semantics (provider × harness × model)
- ✅ The qa_check effect's deterministic ground truth role for D2/D6
- ✅ The pre-verifier no-LLM-scoring frontier convergence
- ✅ Anti-deception rules in `validator/anti-deception.ts` (gain new rules, none weakened)

## 5. Why this is a Crumb-shaped change, not a pivot

- The 4-profile axis is just **another `task_ledger` field + `metadata` field**, mirroring how `cross_provider` was added in v0.1.
- The 2 new specialists follow the **inline-read pattern** ([[bagelcode-paperclip-vs-alternatives]] §3438 35% bloat avoidance) — same shape as the existing 3.
- The Studio picker is a **CLI-flag wrapper** — no new control plane, no new actor.
- Lifting the Three.js ban is **gated to one opt-in profile**, never default — preserves the "94% LLM first-attempt success" baseline for un-flagged sessions.
- All decisions reduce to `(harness × provider × model × genre × persistence)` — a 5-tuple superset of the existing 3-tuple, not a structural overhaul.

## 6. Open questions for the user

1. **Three.js ban**: confirm OK to lift for opt-in `flash-3d-arcade` only (not blanket).
2. **Worker tier**: confirm OK for opt-in `edge-orm` profile (adds `wrangler dev` smoke-test path) — or should we keep static-PWA pure and drop edge-orm?
3. **Specialist scope**: confirm `technical-artist` + `game-feel` as 2 new files, OR fold into existing `visual-designer.md` (one bigger file vs two focused ones — current proposal is two).
4. **Default persistence**: confirm `local-only` (Dexie) becomes the new default, OR keep current behavior (no persistence unless leaderboard markers).
5. **Studio surface**: confirm the New Session form lives inside the existing studio (modal/sidebar) — OR should it be a separate `crumb-launcher` package?
6. **Phasing**: confirm the 9-phase migration is OK to land as one PR per phase (≈9 PRs) or one bundled PR?

## See also

- [[bagelcode-gamestudio-subagents-deep-2026-05-03]] — input: gamestudio prompt-structure + 2 missing specialists
- [[bagelcode-genre-stack-frontier-2026-05-03]] — input: 2026 per-genre frontier evidence
- [[bagelcode-mobile-game-tech-2026]] — context: current Phaser-only baseline
- [[bagelcode-system-architecture-v0.1]] §3.2 — specialist inline-read pattern
- [[bagelcode-paperclip-vs-alternatives]] — Issue #3438 35% bloat avoidance (sandwich loaded inline, not sub-spawned)
- `agents/specialists/game-design.md` §1 — primary extension target (Phase 2)
- `packages/studio/src/server.ts` — primary new-surface target (Phase 6)
