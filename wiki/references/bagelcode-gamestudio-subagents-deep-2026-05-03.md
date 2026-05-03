---
title: gamestudio-subagents — deep dive (12 personas, prompt structure, genre-relevance) 2026-05-03
category: references
tags: [bagelcode, gamestudio-subagents, claude-code, persona, prompt-structure, technical-artist, game-vibe, godot, 2026]
sources:
  - "https://github.com/pamirtuna/gamestudio-subagents (193⭐, sampled 8 personas via gh api)"
  - "[[bagelcode-gamestudio-subagents-2026]] — first-pass overview"
  - "[[bagelcode-mobile-game-tech-2026]]"
summary: >-
  Re-read the 8 small subagent files (sr_game_designer / mid_game_designer / mechanics_developer /
  technical_artist / qa_agent / game_feel_developer / sr_game_artist / ui_ux_agent) byte-by-byte
  to extract the prompt-structure pattern + the 2 specialists Crumb does NOT yet have
  (technical_artist + game_feel_developer). Maps each gamestudio role to Crumb's actor /
  specialist split and identifies the deepening targets for builder / planner / researcher /
  designer specs.
provenance:
  extracted: 0.85
  inferred: 0.15
created: 2026-05-03
updated: 2026-05-03
---

# gamestudio-subagents — deep dive

> **Successor to** [[bagelcode-gamestudio-subagents-2026]] (first-pass overview, 2026-05-02). This page goes file-by-file on the 8 in-scope subagents (excluding producer / market_analyst / data_scientist / master_orchestrator — out of P0).

## 1. Prompt-structure pattern (every persona)

All 8 files share the same 7-section skeleton:

```
# <Role> Agent Profile

## Role: <one-line title>

You are the <Role> Agent responsible for <one-line scope>.

### Core Responsibilities
- 4-6 bullet points

### Decision-Making Authority      ← (engineering personas only)
### Requires Approval From          ← (engineering personas only)

### <Engine/Tool>-Specific Expertise   ← Godot 4.4.1
- 4-5 sub-areas

### <Code/Doc> Template
[fenced GDScript / GLSL / markdown block, 30-50 lines]

### Quality Checklist
- [ ] 6-8 testable bullets

### Deliverables
- 4-6 final-artifact descriptions
```

**Crumb maps this onto the sandwich §"Position / Contract / Steps / Tools / Don't / Must / Reminders" pattern** — same intent (role + scope + standards + deliverables), tightened to a single-spawn injection envelope.

## 2. Persona-by-persona role mapping

| gamestudio | size | scope | Crumb mapping | gap |
|---|---|---|---|---|
| `sr_game_designer.md` | 1.8 KB | vision + GDD + core pillars | merged into `concept-designer.md` | none — Crumb compresses sr+mid into one specialist |
| `mid_game_designer.md` | 2.9 KB | feature spec + content balancing | merged into `concept-designer.md` (AC list + tuning) | none |
| `mechanics_developer.md` | 3.3 KB | core gameplay engineer (GDScript patterns: Singleton/Observer/State Machine/Pool) | `builder.md` (Phaser 3.80 implementer) | **engine-specific patterns missing** — Phaser ArcadePhysics + Scene-State-Machine + Pool patterns aren't taught |
| `technical_artist.md` | 4.3 KB | shaders/VFX/particle pools, lighting, post-processing | **NONE** — silent gap | **add as inline-read specialist for visual polish** |
| `qa_agent.md` | 5.1 KB | functional/perf/integration test cases + bug template | `verifier.md` + qa-check effect | none — Crumb's deterministic qa.result + CourtEval verifier covers this |
| `game_feel_developer.md` | 4.7 KB | screen shake, tween bounce, particle bursts, audio polish | **NONE** — silent gap | **add as inline-read specialist for game juice** |
| `sr_game_artist.md` | 3.0 KB | style guide, mood board, art pipeline | `visual-designer.md` (palette + motion) | partial — style-guide structure (mood / inspiration / reference) missing |
| `ui_ux_agent.md` | 6.6 KB | UI flow, Control-node hierarchy, accessibility | `visual-designer.md` (HUD layout) | partial — focus-chain / state-machine UI transition pattern absent |

**Two clear specialist gaps in Crumb today**: `technical_artist` (shaders / particle pools / 2D lighting) and `game_feel_developer` (screen shake / tween / hit-stop / audio polish). These are the ones that sharpen across genres — pixel-arcade needs chunky integer screen-shake, 2D sidescroll needs hit-stop + parallax, 3D arcade needs camera shake + bloom.

## 3. The 5 sharpest reusable patterns from gamestudio

### P1. Engine-specific code template per persona
Every engineering persona ships a **fenced code-block template** in its prompt — `mechanics_developer` has a 30-line GDScript skeleton (signal / @export / _ready / setup_system / public/private split), `technical_artist` has a 35-line `.gdshader` skeleton with hint_range uniforms + varyings + vertex/fragment split. The LLM doesn't have to invent the structural surface — it fills the slots.

**Crumb application**: `agents/builder.md` should ship a fenced `Phaser Scene template` per genre profile (one for casual-portrait, one for pixel-arcade, one for sidescroll-2d, one for flash-3d-arcade) so the builder doesn't reinvent the boot scene for every spawn.

### P2. Decision-making authority + approval-required matrix
Engineering personas explicitly declare what they decide vs what they need sign-off on. `mechanics_developer` decides architecture / algorithms / patterns but needs Producer + Sr Designer + QA approval for timeline / scope / quality. Crumb already has this in actor descriptions ("DOES NOT read X / writes Y") but could sharpen it as a formal Authority matrix.

### P3. Quality checklist as compile-time gate
Every persona ends with a `[ ] testable bullets` section. `qa_agent` enumerates 12 specific FPS / memory / loadtime gates ("60 FPS with 20+ asteroids", "memory < 100 MB", "web export < 10s load"). Crumb already has the §"Must" / §"Don't" lists but the gamestudio-style numeric gates make AC-predicate compilation more natural.

### P4. Workflow numbered steps (not just goals)
`sr_game_artist` says: "1. Concept Sketches → 2. Style Tests → 3. Production Art → 4. Technical Review → 5. Integration Testing". Six-step pipelines turn the work into checkpoints. Crumb's planner-lead already does this (Socratic → Concept → Research → Design → Synth) but specialists could enumerate similar workflows.

### P5. Centralized manager class as the polish surface
`game_feel_developer` exports a single `GameJuice.gd` autoload-singleton with `add_screen_shake / create_impact_effect / tween_scale_bounce` methods. This is the **one place** to hook all polish. Builder should mirror this with a `src/systems/JuiceManager.js` (or `EffectManager.js`) when the genre profile demands juice.

## 4. What Crumb deliberately does NOT borrow

| gamestudio pattern | reason |
|---|---|
| 12 separate persona files | Crumb's 4-actor + 2-specialist split is intentional (Lanham start-single-escalate) |
| Master orchestrator persona | Crumb's coordinator is the host harness itself, not an LLM persona |
| Producer / Market Analyst / Data Scientist | out of P0 scope (no live ops, no analytics in 30-min prototype) |
| Engine-specific GDScript / Godot 4.4.1 | Crumb is web-first (Phaser 3.80 / Three.js CDN, no install) |
| `project_manager.py status` directory marker | Crumb has `transcript.jsonl` + `crumb replay` + ULID — strictly stronger |
| Mode-locked-at-init | Crumb has `--preset` + `user.intervene` + dynamic mode escalation |

## 5. Proposed Crumb specialist additions (deep dive output)

### 5.1 New: `agents/specialists/technical-artist.md`

Inline-read by `planner-lead.md` step.design AND `builder.md` (during render-system file emission). Sources: gamestudio `technical_artist.md` (4.3 KB) + `game_feel_developer.md` (4.7 KB), compressed.

Scope per genre profile:
- **casual-portrait**: Phaser TweenManager + simple emitter; no shaders
- **pixel-arcade**: integer-aligned shake (Math.round), palette-locked dither, NO subpixel motion
- **sidescroll-2d**: parallax TileSprite layers (3-5), camera follow + lerp, hit-stop on impact (16-32ms freeze)
- **flash-3d-arcade**: Three.js EffectComposer + UnrealBloomPass + camera shake (perlin noise on Camera position), low-poly material (MeshBasicMaterial / MeshStandardMaterial only, no PBR)

### 5.2 New: `agents/specialists/game-vibe.md`

Inline-read by `builder.md` after the genre-profile render template is selected. Sources: gamestudio `game_feel_developer.md` (4.7 KB), compressed.

Scope per genre profile:
- juice timing constants (anticipation 80ms, follow-through 200ms, hit-pause 16-32ms)
- screen-shake intensity table (small=2px / medium=4px / large=8px integer-snapped)
- audio-feedback layering (4-channel rule: action + impact + ambient + UI)
- pool-size guidance (particle pool 20 / projectile pool 50)

These two specialists turn the silent "polish gap" into a structured deliverable readable by builder + verifier (verifier reads the §"Quality checklist" subsection as D5.vibe evidence).

## 6. Sandwich integration plan

```
agents/
  planner-lead.md
    inline_specialists:
      - concept-designer.md         (existing)
      - visual-designer.md          (existing — refactor to call out the new technical-artist specialist for shader-heavy profiles)
      - game-design.md              (existing — extend with §1.4 genre-profile + §1.5 persistence-profile axes)
      - technical-artist.md         ★ NEW (inline-read by step.design when genre demands it)
  builder.md
    inline_specialists:
      - game-design.md              (existing)
      - technical-artist.md         ★ NEW (inline-read for render-system files when shader/post-process needed)
      - game-vibe.md                ★ NEW (inline-read for systems/JuiceManager.js / EffectManager.js)
  verifier.md
    inline_specialists:
      - game-design.md              (existing — gains the genre-profile / persistence-profile checks)
      - game-vibe.md                ★ NEW (D5.vibe grading rubric + Quality-checklist match)
```

## See also

- [[bagelcode-gamestudio-subagents-2026]] — first-pass overview (2026-05-02)
- [[bagelcode-genre-stack-frontier-2026-05-03]] — sister: 2026 frontier per-genre stack research
- [[bagelcode-genre-profile-decision-2026-05-03]] — synthesis: how to extend Crumb's envelope
- [[bagelcode-mobile-game-tech-2026]] §6 — comparison-table parent
- `agents/specialists/concept-designer.md` — gamestudio sr+mid designer compression target
- `agents/specialists/visual-designer.md` — gamestudio sr_game_artist + ui_ux compression target
