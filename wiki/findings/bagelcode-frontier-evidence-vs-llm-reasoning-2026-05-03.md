---
title: Frontier evidence outranks LLM spec-verbatim reasoning — AC8 PWA offline-boot case
date: 2026-05-03
session: 01KQMS9E5M1Z7TEF32E81YXAGT
status: confirmed
tags: [findings, qa-check, anti-deception, scoring, frontier]
---

# Frontier evidence outranks LLM spec-verbatim reasoning

A live cat-puzzle session (`01KQMS9E5M1Z7TEF32E81YXAGT`) surfaced a concrete divergence between the verifier's LLM-judged D1 score and the dispatcher's deterministic ground truth from `qa-check-effect`. The deterministic check was correct.

## Context

- **Artifact**: 16-file Phaser 3.80 PWA cat match-3 game (`artifacts/game/{index.html, src/scenes/*.js, sw.js, manifest.webmanifest, …}`, 60.49 KB total).
- **Spec verbatim**: "No external network calls at runtime — if a CDN is used in `<head>` it must be a single Subresource-Integrity-pinned line, no analytics, no remote fonts."
- **Builder choice**: Phaser 3.80 loaded via `https://cdn.jsdelivr.net/npm/phaser@3.80.1/...` from the page, `sw.js` precache list contains 14 same-origin URLs only (not the Phaser CDN script).

## Two judgments

### (1) verifier-llm CourtEval judgment, round 1

CourtEval `Critic` flagged AC8 (`sw.js` cache-first shell) as a hard-fail by reading the spec verbatim:

> AC8 hard-fail: sw.js cross-origin cache predicate excludes Phaser CDN, violating spec verbatim "zero runtime network requests after first load"; AC1–AC7 strong.

Result:
- D1 = 3.5 / 5
- Aggregate = 19.5 / 25 (D6 N/A — playwright not installed)
- verdict = **PARTIAL** (user_modal_required)

### (2) qa-check-effect ground truth, round 2 (frontier-aligned)

Upgraded `src/effects/qa-check-playwright.ts` to ArtifactsBench-aligned multi-step verification (arXiv:2507.04952):
1. Spin up an ephemeral `127.0.0.1:PORT` HTTP server rooted at the artifact's parent dir (multi-file PWA needs http origin for ES modules + service worker registration).
2. Wait for `<canvas>` (Phaser `Game.boot` allocates).
3. **Wait for any Phaser scene to reach `SYS.RUNNING (status === 5)`** — a `<canvas>` alone does not prove boot; SYS.RUNNING means `Scene.create()` completed and `update()` is firing.
4. 1500 ms console-error watch.
5. **PWA offline test**: `context.setOffline(true)` then `page.reload()`; require `<canvas>` + SYS.RUNNING to be reached again with no console errors.

Result:
```
lint_passed:          true
exec_exit_code:       0
first_interaction:    ok       (Phaser SYS.RUNNING(5))
cross_browser_smoke:  ok
pwa_offline_boot:     ok       ← AC8 empirically passes
phaser_scene_running: true
```

The PWA second-load offline reload **succeeded**.

## Why both can be right at once

Browser HTTP disk cache served the Phaser CDN script during the offline reload, even though `sw.js` did not include it in `precache`. The CDN response carries `cache-control: max-age=31536000`; Chromium's HTTP cache returns the cached payload without a network round-trip when `setOffline(true)` is in effect. So:

- **LLM was right in principle**: `sw.js` precache list is technically incomplete — if HTTP disk cache is purged or the user clears site data, AC8 fails.
- **Ground truth was right in practice**: end-user offline boot works for the first ~1 year window between a successful first load and HTTP cache eviction. Commercial-grade ship-ready behaviour.

This is exactly the gap **ArtifactsBench (arXiv:2507.04952)** observed: a unit-of-evidence test that drives a sandbox + 3 sequential screenshots + 10-dim checklist hits 94.4 % human agreement; LLM-only judgments without sandbox evidence lag substantially. **Sony VideoGameQA-Bench (arXiv:2505.15952)** corroborates: VLMs hit 82.8 % on glitch detection from images but collapse on body-config, object-clipping, and common-sense reasoning.

## Implications for Crumb's scoring matrix

- **D2 / D6 are correctly assigned to `qa-check-effect`** (anti-deception architecture invariant #5). The matrix would have been wrong if D6 had been delegated to `verifier-llm` — an LLM reading the spec verbatim would have forced D6 down even though the artifact ships fine.
- **D1 is `verifier-llm` and that is also correct**: D1 is *spec_fit*, which inherently mixes verbatim-textual reading with judgement; the LLM's flag is fair feedback for an iteration ratchet, just not a hard-block.
- **The `verdict=PARTIAL → user_modal_required` path worked exactly as designed**: surfaced 3 disjoint resolution options to the user instead of silently auto-promoting or auto-rejecting. The user chose `(b) playwright install + AC8 fix` path, which converted theoretical D1 hard-fail into empirical PASS.

## Concrete upgrades shipped this session

1. **`src/effects/qa-check-playwright.ts`** — full rewrite: ephemeral http server, Phaser SYS.RUNNING probe, robust window-name walk (`game` / `__GAME__` / `gameInstance` / fallback Object.keys walk), PWA offline-reload test.
2. **`src/effects/qa-check.ts`** — `QaResult` interface gained `pwa_offline_boot` and `phaser_scene_running` fields; passed through to the `kind=qa.result` event payload.
3. **Verifier sandwich** unchanged; the new evidence flows to D6 lookup automatically.

## Frontier references

- ArtifactsBench, arXiv:2507.04952 — dual-referee MLLM, 94.4 % human agreement, 1,825 query × 9 domain
- VideoGameQA-Bench, arXiv:2505.15952 — Sony, 9 game-QA tasks, image vs video VLM scaling
- CourtEval ACL 2025 Findings — Grader → Critic → Defender → Re-grader (Crumb's verifier topology)
- JudgeBench, arXiv:2410.12784 — negative result on LLM-only judges for challenging response pairs
- Karpathy autoresearch (2026-03) — immutable harness, fixed time-box, monotonic-only ratchet
- SWE-Bench Pro, arXiv:2509.16941 — 1,865 multi-file long-horizon ground truth

## Status

- Round-1 judge.score: `01KQMWN9DSF17TZJEXA3JF7R00` (PARTIAL, 19.5 / 25, ratio 0.78)
- Round-2 qa.result: `01KQMXH0XP1VH08FHJGTDK0XX1` (frontier-aligned, all-green)
- Round-2 verifier re-spawn: pending (loop budget rework — see open-questions below)

## Open questions

1. Should `sw.js` precache cross-origin Phaser CDN with `Cache: { ignoreSearch: true }` + opaque-response handling? Workbox `CacheFirst` with `cacheableResponse.statuses=[0,200]` is the frontier idiom (web.dev Workbox 7).
2. Should the builder sandwich mandate `window.game` (single global name) so the qa-check probe doesn't need a robust walk? Trade-off: name discipline vs probe robustness. Current decision: keep the walk — it's harmless and shields against future builder variation.
3. The reducer's hard-coded `TOKEN_BUDGET_HARD = 50_000` (`src/reducer/index.ts:22`) trips on long sessions like this one (86.7 K tokens by build complete) and prevents resume into the verifier round, even when the user explicitly wants to continue. Either lift the constant, expose it via `RunOptions`, or add a `crumb continue --override-budget` CLI flag. See `wiki/concepts/bagelcode-budget-guardrails.md`.

