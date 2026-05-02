#!/usr/bin/env node
/**
 * `crumb-dashboard` CLI entrypoint.
 *
 * Usage:
 *   crumb-dashboard                         # 127.0.0.1:7321, auto-open browser
 *   crumb-dashboard --port 8080             # custom port
 *   crumb-dashboard --bind 0.0.0.0          # expose on LAN / SSH tunnel
 *   crumb-dashboard --no-open               # headless (CI / SSH)
 *
 * Env:
 *   CRUMB_HOME=/path/to/.crumb              # alternate transcript root
 *   CRUMB_POLL=1                            # force chokidar polling
 *   CRUMB_NO_OPEN=1                         # headless without --no-open flag
 */

import { openBrowser } from './open-browser.js';
import { startDashboardServer } from './server.js';

interface Args {
  port: number;
  bind: string;
  open: boolean;
  pollInterval?: number;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { port: 7321, bind: '127.0.0.1', open: true };
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
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  return a;
}

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`crumb-dashboard — live observability dashboard

Usage:
  crumb-dashboard [options]

Options:
  --port <n>            HTTP port (default 7321)
  --bind <ip>           Bind address (default 127.0.0.1; use 0.0.0.0 for LAN)
  --no-open             Don't auto-launch a browser
  --poll-interval <ms>  Polling interval when chokidar polling is active (default 250)
  -h, --help            Show this help

Env:
  CRUMB_HOME            Alternate ~/.crumb root
  CRUMB_POLL=1          Force chokidar polling (WSL / Docker / NFS)
  CRUMB_NO_OPEN=1       Headless mode without --no-open flag
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const opts: Parameters<typeof startDashboardServer>[0] = {
    port: args.port,
    bind: args.bind,
  };
  if (args.pollInterval !== undefined) opts.pollInterval = args.pollInterval;
  const server = await startDashboardServer(opts);

  // eslint-disable-next-line no-console
  console.log(`crumb dashboard listening on ${server.url}`);
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
  console.error('crumb-dashboard failed:', err);
  process.exit(1);
});
