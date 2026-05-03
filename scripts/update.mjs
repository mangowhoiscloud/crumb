#!/usr/bin/env node
/**
 * Crumb update — pull latest main + re-run setup.
 *
 *   npm run update
 *
 * Composed of:
 *   1. git fetch origin && git status (informational — show divergence)
 *   2. git pull --ff-only (fast-forward only — never merges or rebases)
 *   3. npm run setup (install + build + doctor)
 *
 * Refuses to run if the working tree is dirty (un-committed changes), so
 * an evaluator can't accidentally lose local edits.
 *
 * Path policy: scripts read import.meta.url for repo root. Nothing baked in.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

function run(label, cmd, args, opts = {}) {
  return new Promise((res, rej) => {
    process.stdout.write(`\n▸ ${label}\n  $ ${cmd} ${args.join(' ')}\n`);
    const child = spawn(cmd, args, {
      cwd: repoRoot,
      stdio: opts.captureStdout ? ['inherit', 'pipe', 'inherit'] : 'inherit',
      shell: process.platform === 'win32',
      ...opts,
    });
    let out = '';
    if (opts.captureStdout) child.stdout.on('data', (d) => (out += d.toString()));
    child.on('exit', (code) => {
      if (code === 0) res(out);
      else rej(new Error(`${label} failed (exit ${code})`));
    });
    child.on('error', rej);
  });
}

async function main() {
  process.stdout.write(`\nCrumb update — fast-forward main + re-run setup\n`);

  // Refuse if dirty.
  const status = await run('check working tree', 'git', ['status', '--porcelain'], {
    captureStdout: true,
  });
  if (status.trim().length > 0) {
    process.stderr.write(
      `\n✗ Working tree has un-committed changes. Commit or stash first, then re-run.\n`,
    );
    process.exit(1);
  }

  await run('fetch', 'git', ['fetch', 'origin']);
  await run('fast-forward to origin/main', 'git', ['pull', '--ff-only']);
  await run('re-run setup', 'npm', ['run', 'setup']);

  process.stdout.write(`\n✓ Update complete.\n`);
}

main().catch((err) => {
  process.stderr.write(`\n✗ Update failed: ${err.message}\n`);
  process.exit(1);
});
