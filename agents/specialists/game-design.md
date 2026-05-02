# Game Design Contract

> The binding game-design contract for Crumb. Replaces the former `design/DESIGN.md` (root) and the never-shipped `agents/specialists/game-stack-constraint.md` planning. Inline-read by `agents/researcher.md` (video evidence schema), `agents/planner-lead.md` step.design (synth output format), `agents/builder.md` (envelope), `agents/builder-fallback.md` (envelope), and `agents/verifier.md` (evidence validation).
>
> Extends `wiki/concepts/bagelcode-mobile-game-tech-2026.md` (Phaser stack rationale) with the v3.3 video-evidence schema introduced when `researcher` was promoted to its own actor.

## §1 Hard envelope (every artifact MUST conform)

The non-negotiable technical floor under which every Crumb game artifact runs.
Verifier reads these as D6.portability ground truth via the `qa_check` effect
(`src/dispatcher/qa-runner.ts`).

**v3.4 widening — multi-file modular envelope.** Frontier convergence (4 sources
in `wiki/references/bagelcode-mobile-multifile-frontier-2026-05-02.md`:
`Yakoub-ai/phaser4-gamedev`, `OpusGameLabs/game-creator`, Phaser-official Claude
Code tutorial 2026-02, Troy Scott "2D shooter in one evening") shows every
production-quality LLM-generated Phaser game in 2026 ships as a multi-file
modular project. The previous `single-file game.html ≤60KB` envelope was a
v3.0 simplifier; v3.4 keeps it as a **fallback profile** but the default
target is now the multi-file profile that matches frontier practice.

### §1.1 Default profile — `multi-file` (target for new sessions)

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
- **Audio**: Web Audio synth in `systems/AudioManager.js` (procedural — 1 BGM
  lead + 4 SFX). No external `.mp3` / `.ogg`.
- **Performance**: 60fps on iPhone Safari 16+ / Android Chrome 100+.
- **Touch**: pointer events, ≥44×44 hit zones (WCAG 2.5.5 AAA).
- **Network**: zero runtime requests after CDN load + SW first-fetch — game
  must run offline.

### §1.2 Fallback profile — `single-file` (legacy / constrained envelopes)

When the user explicitly opts in via `--profile single-file` or when the goal
contains "single file" / "단일 파일" markers, builder reverts to the v3.0
shape:

- **Output**: single `artifacts/game.html` (HTML + inline CSS + inline JS).
- **Bundle**: ≤ 60 KB own code.
- Same Phaser-CDN / Canvas / Mobile-first / Audio / Network rules as §1.1.

## §2 Forbidden

| Forbidden | Reason |
|---|---|
| ❌ npm bundlers (webpack / vite / parcel / esbuild) | produces output that needs `npm install` to evaluate; defeats "README대로 실행" |
| ❌ native engine output (Unity / Godot / Unreal binaries) | not portable, not LLM-emit-able in plain text |
| ❌ Three.js / Babylon | outside the casual mobile envelope |
| ❌ external asset URLs except embedded `data:` URIs and the Phaser CDN | breaks offline run |
| ❌ Phaser 2 syntax | use 3.80+ (Scene class, ArcadePhysics, etc.) |
| ❌ network requests at runtime | game must run offline after CDN load |
| ❌ proprietary game references (IAP, ads, live ops) | P0 scope |

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

## §3 Video evidence schema (v3.3 — researcher actor)

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
  mechanics_extracted: [<MechanicEvidence>, ...]   # 1-8 entries
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

Planner-lead's final synth combines step.research + step.design into `artifacts/DESIGN.md`. This is the binding document the builder reads to write `game.html`.

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
| `researcher` | §1 envelope (rejects out-of-envelope mechanic suggestions) + §3 video evidence schema (output format) + §4 synth schema (output format) | Sandwich inline-specialist |
| `planner-lead` step.design | §1 envelope (rejects visual choices that violate it) + §5 DESIGN.md synth format | Sandwich inline-specialist |
| `builder` | §1 envelope + §2 forbidden (binding constraint while writing game.html) + §5 (reads `artifacts/DESIGN.md` per format) | Sandwich §"Inputs" |
| `builder-fallback` | Same as builder | Fallback substitute |
| `verifier` | §1 + §2 (D6.portability via qa.result lookup) + §3.3/§4 evidence schema (D5 anti-deception rule) | CourtEval D5/D6 input |

## §6.5 LLM playthrough — verifier responsibility (v3.4)

The deterministic `qa_check` effect (htmlhint + Playwright headless smoke
served via `npx http-server artifacts/game/`) gives D2 / D6 ground truth and
is **never replaced** — that's the anti-deception floor. v3.4 layers an
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

## §7 Migration notes (from former design/DESIGN.md)

The root-level `design/DESIGN.md` has been deleted as of v3.3. Three reasons:

1. **Asymmetry**: it lived alone outside `agents/`, while every other planner-input file is under `agents/specialists/`.
2. **Scope drift**: it only covered the §1 envelope (Phaser stack). The new file unifies envelope + video evidence schema + synth format — one file the verifier reads end-to-end.
3. **Researcher promotion**: when `researcher` became its own actor (v3.3), the video-evidence schema needed a single source of truth all 4 actors (researcher + planner + builder + verifier) could inline-read. Putting it under `agents/specialists/` matches the existing pattern (`concept-designer.md`, `visual-designer.md`).

## See also

- [[bagelcode-mobile-game-tech-2026]] — Phaser stack rationale, 13 sources
- [[bagelcode-stack-and-genre-2026]] — casual mobile market context
- [[bagelcode-system-architecture-v3]] §3.2 — specialist inline-read pattern
- `agents/researcher.md` — primary consumer of §3 video evidence schema
- `agents/planner-lead.md` step.design — primary consumer of §5 synth format
- `agents/builder.md` — primary consumer of §1 envelope
- `agents/verifier.md` — D5 evidence validation against §3
