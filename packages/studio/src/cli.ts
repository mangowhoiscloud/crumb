#!/usr/bin/env node
/**
 * `crumb-studio` CLI entrypoint.
 *
 * Usage:
 *   crumb-studio                         # 127.0.0.1:7321, auto-open browser
 *   crumb-studio --port 8080             # custom port
 *   crumb-studio --bind 0.0.0.0          # expose on LAN / SSH tunnel
 *   crumb-studio --no-open               # headless (CI / SSH)
 *   crumb-studio --home ~/.crumb --home /tmp/crumb-test-home
 *                                           # v0.3.1: watch multiple Crumb homes
 *                                           #       in one server (sessions from
 *                                           #       all roots show up together).
 *
 * Env:
 *   CRUMB_HOMES=/a:/b                       # v0.3.1 multi-home (path-list separator)
 *   CRUMB_HOME=/path/to/.crumb              # legacy single-home
 *   CRUMB_POLL=1                            # force chokidar polling
 *   CRUMB_NO_OPEN=1                         # headless without --no-open flag
 *
 * Resolution order: --home flags (repeatable) > CRUMB_HOMES > CRUMB_HOME > $HOME/.crumb.
 */

import { posix, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

import { openBrowser } from './open-browser.js';
import { startStudioServer } from './server.js';

interface Args {
  port: number;
  bind: string;
  open: boolean;
  pollInterval?: number;
  /** v0.3.1: repeatable --home flag. Empty array → fall through to env / default. */
  homes: string[];
  /**
   * v0.5: write the actual bound port + URL to this file once the server is
   * listening. Used by `crumb run` (PR #115 ensureStudioRunning) to discover
   * which ephemeral port the detached child grabbed when 7321 was occupied.
   */
  portFile?: string;
  /**
   * v0.5 PR-5: stale Studio recovery. `--kill` exits after killing whatever
   * is on the port (no spawn). `--restart` does the kill, then spawns a fresh
   * Studio in the same invocation. Both lookups go through `lsof -ti :PORT`
   * so they only target listeners on the requested port — never unrelated
   * processes. POSIX-only; Windows users should rely on the existing
   * EADDRINUSE walk (PR #117) or kill manually.
   */
  kill?: boolean;
  restart?: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { port: 7321, bind: '127.0.0.1', open: true, homes: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--port' && argv[i + 1]) {
      a.port = Number(argv[++i]);
    } else if (arg === '--bind' && argv[i + 1]) {
      a.bind = argv[++i]!;
    } else if (arg === '--no-open') {
      a.open = false;
    } else if (arg === '--poll-interval' && argv[i + 1]) {
      a.pollInterval = Number(argv[++i]);
    } else if (arg === '--home' && argv[i + 1]) {
      // Repeatable: each --home extends the watch set.
      a.homes.push(argv[++i]!);
    } else if (arg === '--port-file' && argv[i + 1]) {
      a.portFile = argv[++i]!;
    } else if (arg === '--kill') {
      a.kill = true;
    } else if (arg === '--restart') {
      a.restart = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  return a;
}

/** Convert a list of crumb homes into chokidar-friendly transcript globs. */
function homesToGlobs(homes: string[]): string[] {
  return homes.map((home) => {
    const norm = home.split(sep).join('/');
    return posix.join(norm, 'projects', '*', 'sessions', '*', 'transcript.jsonl');
  });
}

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`crumb-studio — live observability studio

Usage:
  crumb-studio [options]

Options:
  --home <path>         Crumb home to watch. Repeatable — passes are merged.
                        v0.3.1: replaces single-CRUMB_HOME limitation; sessions
                        from every listed home appear together.
  --port <n>            HTTP port (default 7321; auto-walks +1 on EADDRINUSE
                        unless CRUMB_STUDIO_STRICT_PORT=1)
  --bind <ip>           Bind address (default 127.0.0.1; use 0.0.0.0 for LAN)
  --no-open             Don't auto-launch a browser
  --poll-interval <ms>  Polling interval when chokidar polling is active (default 250)
  --port-file <path>    Write {port, bind, url} JSON once listening (v0.5 —
                        used by 'crumb run' to discover ephemeral ports)
  --kill                Kill whatever is on --port and exit. POSIX (lsof).
  --restart             Kill whatever is on --port, then spawn a fresh
                        Studio in the same invocation. POSIX (lsof).
  -h, --help            Show this help

Env (precedence: --home > CRUMB_HOMES > CRUMB_HOME > $HOME/.crumb):
  CRUMB_HOMES                v0.3.1 multi-home, path-list separated (':' POSIX, ';' Windows)
  CRUMB_HOME                 Legacy single-home
  CRUMB_POLL=1               Force chokidar polling (WSL / Docker / NFS)
  CRUMB_NO_OPEN=1            Headless mode without --no-open flag
  CRUMB_STUDIO_STRICT_PORT=1 Disable ephemeral port walk (Streamlit/n8n style)

Examples:
  crumb-studio --home ~/.crumb --home /tmp/crumb-test-home
  CRUMB_HOMES=~/.crumb:/path/to/other-home crumb-studio
`);
}

/**
 * v0.5 PR-5 — kill any listener on `port` via `lsof -ti :port | xargs kill`.
 *
 * Returns the list of PIDs that were killed (empty array when port was free).
 * POSIX-only — `lsof` is not on Windows by default; on Windows the
 * EADDRINUSE walk (PR #117) handles port conflicts instead.
 */
function killListenersOnPort(port: number): number[] {
  if (process.platform === 'win32') return [];
  const list = spawnSync('lsof', ['-ti', `:${port}`], { encoding: 'utf8' });
  const pids = (list.stdout ?? '')
    .split('\n')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // already gone — ignore
    }
  }
  return pids;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // v0.5 PR-5: stale-Studio recovery (--kill / --restart) runs before
  // spawning a new server so we never collide with the listener we are
  // about to evict.
  if (args.kill || args.restart) {
    const killed = killListenersOnPort(args.port);
    if (killed.length === 0) {
      // eslint-disable-next-line no-console
      console.log(`  \x1b[33m⚠\x1b[0m  No listener found on port ${args.port}.`);
    } else {
      // eslint-disable-next-line no-console
      console.log(
        `  \x1b[32m✓\x1b[0m  Sent SIGTERM to ${killed.length} pid(s) on port ${args.port}: ${killed.join(', ')}`,
      );
    }
    if (args.kill) {
      // --kill exits here; --restart falls through to the regular spawn path.
      return;
    }
    // Brief settle before binding so the kernel releases the port.
    await new Promise((r) => setTimeout(r, 250));
  }

  const opts: Parameters<typeof startStudioServer>[0] = {
    port: args.port,
    bind: args.bind,
  };
  if (args.pollInterval !== undefined) opts.pollInterval = args.pollInterval;
  // v0.3.1 multi-home: --home flags take precedence over env (CRUMB_HOMES /
  // CRUMB_HOME), which in turn fall through to $HOME/.crumb. The watcher
  // sees an array of globs only when more than one home is active; otherwise
  // we leave opts unset to preserve legacy single-glob behavior.
  if (args.homes.length > 0) {
    opts.globs = homesToGlobs(args.homes);
  }
  const server = await startStudioServer(opts);

  // v0.5 — Persist actual port for parent processes to discover when the
  // ephemeral fallback walked from the requested 7321. Best-effort: a write
  // failure should not block the server.
  if (args.portFile) {
    try {
      const { writeFileSync } = await import('node:fs');
      writeFileSync(
        args.portFile,
        JSON.stringify({ port: server.port, bind: server.bind, url: server.url }),
      );
    } catch {
      // ignore — parent will fall back to the requested port heuristic
    }
  }

  // Vite-style banner — frontier convention (Vite / Next.js / Streamlit /
  // Gradio all converge on this 3-4 line "Local / Network / hint" shape).
  const networkHint =
    args.bind === '127.0.0.1' || args.bind === 'localhost'
      ? 'use --bind 0.0.0.0 to expose'
      : `bound to ${args.bind}`;
  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log(`  \x1b[32m➜\x1b[0m  Crumb Studio   ${server.url}`);
  // eslint-disable-next-line no-console
  console.log(`  \x1b[32m➜\x1b[0m  Network        ${networkHint}`);
  if (args.homes.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`  \x1b[32m➜\x1b[0m  Watching       ${args.homes.length} home(s)`);
    for (const h of args.homes) {
      // eslint-disable-next-line no-console
      console.log(`                    ${h}`);
    }
  }
  // eslint-disable-next-line no-console
  console.log(`  \x1b[32m➜\x1b[0m  Press Ctrl+C to stop`);
  // eslint-disable-next-line no-console
  console.log('');
  openBrowser(server.url, { autoOpen: args.open });

  const shutdown = async (): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log('shutting down…');
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('crumb-studio failed:', err);
  process.exit(1);
});
