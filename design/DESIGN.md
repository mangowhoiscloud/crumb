# Crumb game DESIGN.md (Builder agent input)

> Binding constraint for Builder agents. Reading this is mandatory before generating game.html.

## §1 Visual Theme & Atmosphere

Mood: vibrant, mobile-first, casual, immediate feedback.
Inspiration: Two Dots, Royal Match, Candy Crush.

Target stack:
- Output: single-file `game.html` (HTML + inline CSS + inline JS)
- Framework: Phaser 3.80+ via CDN
  ```html
  <script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"></script>
  ```
- Renderer: Canvas 2D (default)
- Bundle: ≤ 60KB own code (CDN external)
- Performance: 60fps on iPhone Safari 16+ / Android Chrome 100+
- Touch: pointer events, ≥44×44 hit zones
- Viewport: 320–428 portrait, safe-area aware
- Color: see §2

## §2 Color Palette & Roles

(See `wiki/concepts/bagelcode-mobile-game-tech-2026.md` and `wiki/references/bagelcode-stack-and-genre-2026.md`)

## Forbidden

- npm bundlers (webpack/vite/parcel)
- native engine output (Unity / Godot / Unreal binaries)
- Three.js / Babylon
- external assets except embedded data URLs
- Phaser 2 syntax (use 3.80+)
