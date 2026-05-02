/**
 * openBrowser — best-effort cross-platform launcher.
 *
 *  - macOS         → `open <url>`
 *  - Windows       → `cmd /c start "" <url>`
 *  - WSL           → `wslview <url>` if available (host-side browser)
 *  - Linux         → `xdg-open <url>`
 *
 * Honors --no-open / CRUMB_NO_OPEN=1 by short-circuiting to stdout, so headless
 * / SSH / CI environments still see the URL.
 */

import { spawnSync, spawn } from 'node:child_process';

import { shouldPoll } from './poll-detect.js';

export function openBrowser(url: string, opts: { autoOpen?: boolean } = {}): void {
  const want = opts.autoOpen ?? process.env.CRUMB_NO_OPEN !== '1';
  if (!want) {
    // eslint-disable-next-line no-console
    console.log(`crumb dashboard: ${url}`);
    return;
  }

  const cmd = chooseCommand();
  if (!cmd) {
    // eslint-disable-next-line no-console
    console.log(`crumb dashboard: open ${url} in your browser`);
    return;
  }

  try {
    const child = spawn(cmd[0]!, [...cmd.slice(1), url], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch {
    // eslint-disable-next-line no-console
    console.log(`crumb dashboard: open ${url} in your browser`);
  }
}

function chooseCommand(): string[] | null {
  if (process.platform === 'darwin') return ['open'];
  if (process.platform === 'win32') return ['cmd', '/c', 'start', ''];
  if (process.platform === 'linux') {
    if (shouldPoll() && hasCommand('wslview')) return ['wslview'];
    if (hasCommand('xdg-open')) return ['xdg-open'];
    return null;
  }
  return null;
}

function hasCommand(name: string): boolean {
  const which = process.platform === 'win32' ? 'where' : 'command';
  const args = process.platform === 'win32' ? [name] : ['-v', name];
  try {
    const r = spawnSync(which, args, { stdio: 'ignore' });
    return r.status === 0;
  } catch {
    return false;
  }
}
