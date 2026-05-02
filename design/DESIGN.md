# Crumb Live Dashboard — DESIGN.md

> Live observability surface for `crumb` sessions. Single-file HTML + SSE stream
> on top of `~/.crumb/projects/*/sessions/*/transcript.jsonl`. Cross-platform,
> zero CDN, zero build, append-only-safe.

---

## 1. Why this exists

The Bagelcode recruitment task lists "사용자가 협업 과정에 개입하거나 관찰" as a
hard requirement (`wiki/references/bagelcode-recruitment-task.md:43`). Until now
that requirement was met by two surfaces — a blessed-based TUI and a static
`summary.html` rendered after the session ends. Neither surface answers
**"where is my request right now?"** while a session is in flight.

This package fills that gap with one live dashboard that any browser, on any OS
the user already has, can open without installing anything new.

## 2. Observability data model — the 5 frontier dimensions, mapped

We adopt the five common dimensions that every frontier observability platform
in 2026 exposes (per `wiki/references/bagelcode-observability-frontier-2026.md`
§5: Anthropic Claude Console / Google Vertex Unified Trace Viewer / AgentOps /
Phoenix / Langfuse). Each dimension already lives in the transcript schema —
the dashboard just surfaces it in real time.

| Dimension | Source | Emitted by | Surface in dashboard |
|---|---|---|---|
| **Token consumption** (in / out / cache_read / cache_write) | `metadata.tokens_in` etc. | every LLM-bearing event | Header `tokens` + `cache` + per-actor swimlane row totals |
| **Latency** (per turn / per tool) | `metadata.latency_ms` | live dispatcher + adapter | Header `p95 lat` + scorecard live update + p50 in `/api/sessions` |
| **Error rate** | `kind=error` count + `kind=audit` count | reducer + anti-deception validator | Header `err / audit` chip + red audit banner if `audit_count > 0` |
| **Tool call timeline** (with arguments / responses) | `kind=tool.call` (data=args) + `kind=tool.result` (data=output) | adapter wrappers | Swimlane rows show `tool.call` / `tool.result` boxes; click → detail panel renders args + linked result |
| **Cost** (`$ USD`) | `metadata.cost_usd` | adapter post-call | Header `cost` + per-actor breakdown in `/api/sessions` payload |

Frontier-specific dimensions adopted selectively:

| Special dimension | Source | Why we adopt it |
|---|---|---|
| **Replay-with-modifications** (Anthropic Console) | already exists via `crumb replay <id>` | Out of scope for live; deep-link from session row |
| **Reasoning path** (Vertex Unified Trace Viewer) | `parent_event_id` chain | Detail panel shows parent chain, swimlane orders by ts |
| **Sandbox / permission audit** (Anthropic gVisor parity) | `kind=tool.call` `data.cwd` / `add_dir` / `permission_mode` | Detail panel surfaces these fields when present |
| **Multi-turn auto-rater** (Vertex) | `kind=judge.score` × N + `kind=step.judge` per role | Live D1-D6 scorecard updates per `judge.score` event; CourtEval steps populate as separate swimlane events |

**Source-of-truth invariant preserved**: every score dim in the live scorecard
shows its `source` (`verifier-llm` / `qa-check-effect` / `reducer-auto`). The
dashboard never recomputes a verdict — it mirrors what the transcript says,
plus the deterministic combine done in `src/state/scorer.ts` for D3 / D5.

## 3. Architecture (data plane)

```
~/.crumb/projects/<id>/sessions/<ulid>/transcript.jsonl   (append-only SOT)
                       │
                       ▼  chokidar watch (native fs events; polling fallback)
            packages/dashboard
                       │
              ┌────────┴────────────────┐
              │ JsonlTail (per file)    │  cross-platform: fs.stat + fs.read + offset
              ├────────────────────────┤
              │ EventBus (per session +│  fan-out to N SSE subscribers
              │ wildcard set)          │
              ├────────────────────────┤
              │ MetricsAggregator      │  pure (history) → SessionMetrics
              └────────────┬───────────┘
                           ▼
                http://127.0.0.1:7321/      (Node http; no Express)
                   ├── GET /                 → dashboard HTML (single file)
                   ├── GET /api/sessions     → JSON snapshot incl. history + metrics
                   └── GET /api/stream       → SSE stream (LiveEvent JSON lines)
                           │
                           ▼  EventSource (browser native, auto-reconnect)
                browser DOM patch (textContent / innerHTML on diff only)
```

End-to-end p99 latency budget on a single machine:

| Stage | Budget |
|---|---|
| transcript writer flush | ~5 ms |
| chokidar 'change' notify | 10–250 ms (native vs polling) |
| JsonlTail.pull → JSON.parse | <1 ms |
| MetricsAggregator | <1 ms |
| SSE write | ~1 ms |
| Browser DOM patch | ~10 ms |
| **Total** | **<500 ms** (native) / **<700 ms** (polling) |

Heartbeat every 15 s prevents corporate-proxy timeouts. `Cache-Control: no-cache`
+ `X-Accel-Buffering: no` headers prevent intermediate buffering.

## 4. Cross-platform — what each "OS-quirk" we defend against

| Quirk | Affected platform | Mitigation in code | File |
|---|---|---|---|
| inotify limit / WSL no-event | WSL2, Docker, NFS, SMB | `shouldPoll()` + chokidar `usePolling: true` | `poll-detect.ts` + `watcher.ts` |
| CRLF line endings | Windows-edited transcripts | `line.replace(/\r$/, '')` in `JsonlTail.pull` | `jsonl-tail.ts` |
| UTF-8 BOM | Windows / external editors | strip `﻿` on first read | `jsonl-tail.ts` |
| Partial-line writes | any OS, mid-flush | trailing fragment buffer survives the next pull | `jsonl-tail.ts` |
| Path separator (`\` vs `/`) | Windows | chokidar normalizes; we hand it `posix.join(...)` glob | `paths.ts` |
| Browser launcher | macOS / Win / Linux / WSL | `open` / `cmd /c start` / `wslview` / `xdg-open` cascade + stdout fallback | `open-browser.ts` |
| File rotate / truncate | log-rotate setups | offset shrink → reset to 0 | `jsonl-tail.ts` |
| Firewall first-run prompt | Windows / macOS | bind 127.0.0.1 by default; `--bind 0.0.0.0` opt-in | `cli.ts` + `server.ts` |
| Corporate SSE buffering | proxies | `Cache-Control: no-cache` + `X-Accel-Buffering: no` + 15 s heartbeat | `server.ts` |

`CRUMB_HOME` env override + `CRUMB_POLL=1` manual toggle + `CRUMB_NO_OPEN=1`
headless flag give every CI / sandbox / SSH environment a way through.

## 5. Visual identity — Sentry × Linear

The dashboard inlines two design systems chosen from
`https://github.com/VoltAgent/awesome-design-md`:

- **Linear** (`design-md/linear.app/DESIGN.md`) — chassis: layout grid, ink
  scale, hairline borders, surface elevation, lavender primary `#5e6ad2`.
  Linear is the right choice for the timeline / swimlane chrome because it
  reads as "software craft documentation" — dense, technical, quietly luxurious.
- **Sentry** (`design-md/sentry/DESIGN.md`) — audit + error palette: deep purple
  `#1f1633`, lime accent `#c2ef4e`, coral `#ffb287`, audit-pink `#fa7faa`.
  Sentry's identity is built around debugging surfaces, which matches our
  anti-deception audit banner + deterministic-event highlighting.

### Color tokens (consumed by `dashboard-html.ts`)

```css
/* Linear chassis */
--canvas:           #010102;   /* page background */
--surface-1:        #0f1011;   /* cards, sidebars */
--surface-2:        #141516;   /* hovered / selected rows */
--hairline:         #23252a;   /* dividers, lane borders */
--ink:              #f7f8f8;
--ink-muted:        #d0d6e0;
--ink-subtle:       #8a8f98;
--ink-tertiary:     #62666d;
--primary:          #5e6ad2;   /* selected session, focus rings */
--primary-hover:    #828fff;

/* Sentry audit / error layer */
--audit-bg:         #1f1633;   /* anti-deception banner background */
--audit-fg:         #fa7faa;   /* audit text + audit event border */
--lime:             #c2ef4e;   /* deterministic event border + live dot */
--warn:             #ffb287;   /* PARTIAL pill, focus highlight */

/* Crumb 9-actor lane glyphs */
--actor-user:              #5e6ad2;
--actor-coordinator:       #8a8f98;
--actor-planner-lead:      #ffb287;
--actor-researcher:        #79628c;
--actor-builder:           #c2ef4e;
--actor-verifier:          #fa7faa;
--actor-builder-fallback:  #62666d;
--actor-validator:         #ffb287;
--actor-system:            #34343a;
```

### Typography

- UI: `ui-sans-serif, -apple-system, "SF Pro Display", "Segoe UI", system-ui`
  — Linear's Display fallback chain, no web-fonts (no CDN required).
- Mono: `ui-monospace, "SF Mono", Consolas, monospace` — universal across
  macOS / Windows / Linux defaults.
- Uppercase technical labels (Sentry pattern) for header field names + audit
  banner: `letter-spacing: 0.4px; text-transform: uppercase; font-size: 10–11px`.

### Component vocabulary

| Component | Linear / Sentry origin | Purpose in our dashboard |
|---|---|---|
| Session row (sidebar) | Linear `changelog-row` | one row per active / recent session, live dot if streaming |
| Header pill | Linear `status-badge` | verdict (`PASS` / `PARTIAL` / `FAIL`) — color from Sentry palette |
| Swimlane lane | Linear `feature-card` (horizontal variant) | one row per actor; events flow left-to-right by `ts` |
| Event chip | Linear `pricing-tab-default` (smaller) | `kind` label inside the lane; click → detail panel |
| Audit banner | Sentry deep purple + audit-pink | persistent strip when `audit_count > 0` |
| Detail panel | Linear `pricing-card` (right rail) | id / parent / ts / from→to / metadata / body / data |
| Scorecard chip | Linear `feature-card` (compact) | one card per D1-D6, source label below value |

### Motion

- 80ms `ease` for hover / select transitions (Linear).
- 1200ms `fresh` keyframe — newly-arrived swimlane events slide in 6px from the
  left, fade in, then settle. Single visual cue for "this is what just happened."
- 140ms slide for the right detail panel.

### Density & layout

- 240px sidebar (sessions) + flexible main (header + swimlane + scorecard).
- Lane height 36px, max 9 lanes (one per actor) — fits 1080p without scroll.
- Detail panel 420px overlay (right side), dismissible via `×` or Esc.
- Scorecard fixed 6-column grid below swimlane, always visible.

## 6. Module map (file-level spec)

```
packages/dashboard/
  package.json               name=@crumb/dashboard, type=module, bin=crumb-dashboard
  tsconfig.json              extends root, outDir=dist
  src/
    types.ts                 DashboardMessage shape (decoupled from crumb core)
    paths.ts                 getCrumbHome() + defaultTranscriptGlob() + sessionIdFromPath()
    poll-detect.ts           shouldPoll(): WSL / CRUMB_POLL detection
    jsonl-tail.ts            JsonlTail — offset-tracked tail, CRLF/BOM/truncate safe
    metrics.ts               computeMetrics(transcript) → SessionMetrics
    event-bus.ts             EventBus — per-session + wildcard fan-out
    watcher.ts               SessionWatcher — chokidar over the glob, drives bus
    open-browser.ts          openBrowser() — darwin/win/linux/wsl cascade
    server.ts                startDashboardServer() — http + SSE + /api/sessions
    dashboard-html.ts        DASHBOARD_HTML — single-file inline CSS+JS
    cli.ts                   crumb-dashboard binary
    index.ts                 public exports for embedding
    *.test.ts                vitest specs (jsonl-tail, metrics, event-bus, server)
```

## 7. CLI surface

```bash
crumb-dashboard                   # 127.0.0.1:7321, auto-open browser
crumb-dashboard --port 8080       # alternate port
crumb-dashboard --bind 0.0.0.0    # expose on LAN / SSH tunnel
crumb-dashboard --no-open         # headless (CI / SSH only — print URL)
crumb-dashboard --poll-interval 100   # tighten polling cadence (default 250ms)
```

```bash
# Env overrides (all optional)
CRUMB_HOME=/tmp/test-crumb        # override transcript root
CRUMB_POLL=1                      # force polling regardless of OS heuristic
CRUMB_NO_OPEN=1                   # equivalent to --no-open
```

## 8. Don't / Must

**Must**

- Read `transcript.jsonl` only via `JsonlTail` (offset tracked, CRLF/BOM safe).
- Recompute metrics with `MetricsAggregator` only — no second derivation point.
- Bind `127.0.0.1` by default, opt in to `0.0.0.0`.
- Send a heartbeat every 15 s on every open SSE connection.
- Keep `dashboard-html.ts` zero-CDN — no `<script src="https://...">`.

**Don't**

- Modify the transcript file. Append-only invariant is enforced by the writer;
  the dashboard is read-only.
- Use platform-specific syscalls outside the abstractions in
  `poll-detect.ts` / `open-browser.ts`.
- Add a frontend build step (Vite / Webpack / etc.). Inline string is the
  whole client.
- Add `crumb` core as a runtime dependency. The package only re-derives the
  protocol surface in `types.ts`. CI passes both packages independently.

## 9. Roadmap (post-submission)

- `crumb-dashboard --once` → emit a static snapshot HTML for archival; absorbs
  the standalone `summary.html` renderer (`src/summary/render.ts`).
- Long-poll fallback at `/api/poll?session=<id>&since=<ulid>` for SSE-blocked
  proxies.
- Replay-with-modifications deep link from the session row header.
- WebSocket transport (binary frames) for >1 kHz event rates.
