# Game Design Contract

> The binding game-design contract for Crumb. Replaces the former `design/DESIGN.md` (root) and the never-shipped `agents/specialists/game-stack-constraint.md` planning. Inline-read by `agents/researcher.md` (video evidence schema), `agents/planner-lead.md` step.design (synth output format), `agents/builder.md` (envelope), `agents/builder-fallback.md` (envelope), and `agents/verifier.md` (evidence validation).
>
> Extends `wiki/concepts/bagelcode-mobile-game-tech-2026.md` (Phaser stack rationale) with the v3.3 video-evidence schema introduced when `researcher` was promoted to its own actor.

## §1 Hard envelope (every artifact MUST conform)

The non-negotiable technical floor under which every Crumb game artifact runs. Verifier reads these as D6.portability ground truth via the `qa_check` effect (`src/dispatcher/qa-runner.ts`).

- **Output**: single-file `game.html` (HTML + inline CSS + inline JS, no external bundle, no asset directory)
- **Framework**: Phaser 3.80+ via CDN
  ```html
  <script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"></script>
  ```
- **Renderer**: Canvas 2D (default — WebGL acceptable but Canvas is the portability target)
- **Bundle**: ≤ 60KB own code (CDN external doesn't count)
- **Performance**: 60fps on iPhone Safari 16+ / Android Chrome 100+
- **Touch**: pointer events, ≥44×44 hit zones (WCAG 2.5.5 AAA)
- **Viewport**: 320–428 portrait, safe-area aware
- **Audio**: WebAudio inline (no `<audio>` src), data URLs only
- **Network**: zero runtime requests after CDN load — game must run offline

## §2 Forbidden

| Forbidden | Reason |
|---|---|
| ❌ npm bundlers (webpack / vite / parcel) | produces multi-file output; breaks single-file invariant |
| ❌ native engine output (Unity / Godot / Unreal binaries) | not portable, not single-file |
| ❌ Three.js / Babylon | outside the casual mobile envelope |
| ❌ external asset URLs except embedded `data:` URIs | breaks offline run |
| ❌ Phaser 2 syntax | use 3.80+ (Scene class, ArcadePhysics, etc.) |
| ❌ network requests at runtime | game must run offline after CDN load |
| ❌ proprietary game references (IAP, ads, live ops) | P0 scope |

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
