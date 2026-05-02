---
name: serve-game
description: >-
  Open a previously generated Crumb game (single-file `game.html` or
  multi-file `index.html` + ES modules + service worker) in the browser.
  Trigger on "이전 게임 열어줘", "전에 만든 거 열어줘", "고양이 퍼즐 열어줘",
  "그 게임 다시 보자", "open the (cat / match-3 / merge / etc.) game",
  "open the previous game", "serve the multi-file game", "demo 열어줘",
  "결과물 열어줘", or any "show me what we built" phrasing. Multi-file
  games (`<script type="module">`, service worker, anything that needs
  CORS) MUST be served over http:// — `file://` protocol blocks ES module
  imports + service worker registration. Single-file games open with
  `file://` directly. The skill auto-detects which case applies, starts
  a local http server when needed, and opens the browser.
allowed-tools: Bash Read Glob Grep
argument-hint: "<optional pitch keyword to disambiguate sessions, e.g. '고양이 퍼즐'>"
when_to_use: >-
  Trigger when the user wants to open / view / play / show a previously
  generated Crumb session's game artifact. Phrases include "이전 게임", "전에
  만든", "그 게임", "결과물", "demo", "open the game", "open the cat puzzle",
  "open the previous game", "serve it", "browser 띄워줘", "play the demo",
  "보여줘". Disambiguate by pitch keyword in the user's message (cat / match-3
  / merge / drag / 60s) when multiple candidates exist. Do NOT trigger on
  generic "open file" requests outside the game-artifact scope.
---

# /serve-game — open a Crumb-generated game in the browser

When the user wants to open a previously generated game from a Crumb session,
auto-detect single-file vs multi-file and serve accordingly.

## Why this matters

Crumb generates two artifact shapes:

| Shape | Layout | Open with |
|---|---|---|
| **Single-file** | `artifacts/game.html` (Phaser inlined or single `<script>`) | `file://` direct (browser allows everything from a single file) |
| **Multi-file** | `artifacts/<game>/index.html` + `src/main.js` + `src/scenes/` + `sw.js` + `manifest.webmanifest` | **MUST** be served over `http://` — `file://` blocks `<script type="module">` imports and `serviceWorker.register` |

Multi-file is the new default (post-2026-05-03). Opening multi-file with `file://` shows
"Loading…" forever because the ES module imports silently fail with "module specifier
does not start with `/`, `./`, or `../` over file:" or the service worker registration
throws. The fix is always: spin up a local http server, open `http://localhost:<port>/`.

## How to trigger

User says any of:
- "이전 게임 열어줘" / "전에 만든 거 열어줘" / "그 게임 다시 보자"
- "고양이 퍼즐 열어줘" / "match-3 게임 열어줘" (pitch keyword disambiguates)
- "open the previous game" / "open the cat puzzle" / "show me what we built"
- "serve the multi-file game" / "demo 열어줘"

Or explicit slash: `/serve-game [<pitch keyword>]`.

## Procedure

### 1. Locate the artifact

Search candidates under `~/.crumb/projects/`. Prefer the most recently modified session
that matches the user's pitch keyword (if given).

```bash
# Find every game artifact (both shapes).
{
  find ~/.crumb/projects -path '*/artifacts/game.html' 2>/dev/null
  find ~/.crumb/projects -path '*/artifacts/*/index.html' 2>/dev/null
  find ~/.crumb/projects -path '*/sessions/*/index.html' 2>/dev/null
} | xargs -I{} sh -c 'printf "%s\t%s\n" "$(stat -f %m "{}" 2>/dev/null || stat -c %Y "{}")" "{}"' \
  | sort -nr | head -10
```

If the user gave a keyword (e.g. "고양이"), additionally grep
`spec.md` / `index.html` / `game.html` siblings to disambiguate:

```bash
grep -liE "고양이|cat|match-3|drag|merge|<keyword>" \
  "$(dirname "$candidate")/spec.md" "$candidate" 2>/dev/null
```

### 2. Decide single vs multi

```bash
candidate="<picked path>"
if grep -qE '<script[^>]+type=["'\'']module["'\'']|navigator\.serviceWorker' "$candidate"; then
  shape="multi"
else
  shape="single"
fi
```

### 3a. Single-file → open `file://` directly

```bash
open "$candidate"
# or on Linux: xdg-open "$candidate"
```

### 3b. Multi-file → serve over http and open

```bash
serve_dir="$(dirname "$candidate")"
# Pick a free port starting at 8765
port=8765
while lsof -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; do
  port=$((port + 1))
done
log="/tmp/crumb-serve-$port.log"
( cd "$serve_dir" && python3 -m http.server "$port" >"$log" 2>&1 & )
sleep 0.5
open "http://localhost:$port/"
echo "served $serve_dir at http://localhost:$port/  (logs: $log)"
echo "stop with: pkill -f 'http.server $port'"
```

Notes:
- **Always background the server** (`( ... & )` subshell) — never block the
  conversation thread.
- **Log file** in `/tmp/` so failures are diagnosable without re-running.
- **Port collision** is real on shared dev boxes — increment until a free
  port is found.
- **macOS** uses `open`, **Linux** uses `xdg-open` (detect with `command -v`).

### 4. Report

After opening, tell the user:
- Which session / pitch was picked (so they can correct if you guessed wrong)
- The URL (or `file://` path)
- The stop command (only when http server was started)

If multiple plausible candidates exist and you cannot disambiguate, list the
top 3 by mtime + 1-line `spec.md` snippet and ask the user to pick.

### 5. Stopping the server

When the user says "그만" / "stop" / "close the server" / "kill it":

```bash
# List active crumb-serve servers
lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | grep python3 | awk '{print $2, $9}'

# Stop the one we started
pkill -f 'http.server <port>'
```

Or aggressively: `pkill -f 'http.server.*876[0-9]'` for the 8760-8769 default range.

## Don'ts

- ❌ Open multi-file games with `file://` — Loading… forever, silent fail.
- ❌ Run `python3 -m http.server` in the foreground — blocks the conversation.
- ❌ Pick a candidate without checking mtime; the user almost always wants
  the most recent.
- ❌ Skip the `pitch keyword` disambiguation when the user supplied one —
  you'll open the wrong game and waste their time.
- ❌ Hardcode `~/.crumb` — read `$CRUMB_HOME` env var first, fall through
  to `~/.crumb` if unset (same convention as the rest of Crumb).

## Examples

**"고양이 퍼즐 열어줘"** →
1. find candidates, grep `cat|고양이|match-3` against spec.md siblings
2. pick the most recent matching `index.html`
3. detect `<script type="module">` → multi-file
4. `python3 -m http.server 8765` in artifact dir, background
5. `open http://localhost:8765/`
6. report: "Opened 고양이 퍼즐 (cat-tap-match3-v1, session 01KQMS9...) at http://localhost:8765/ — to stop: `pkill -f 'http.server 8765'`"

**"그 단순한 demo 열어줘"** →
1. find candidates, grep `single|demo|simple`
2. pick most recent `game.html` (single-file)
3. detect no `type="module"` → single-file
4. `open <path>` directly
5. report: "Opened Drag-Color-Catcher (session 01KQMM7...) — file:// direct open"

## Reference

- Multi-file vs single-file game shape: `agents/specialists/game-design.md` §1 envelope
- Session storage paths: `src/paths.ts` `getCrumbHome()` (honors `$CRUMB_HOME`)
- Frontier convergence on multi-file PWA shape: `wiki/concepts/bagelcode-final-design-2026.md` §3
