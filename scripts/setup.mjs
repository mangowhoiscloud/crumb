#!/usr/bin/env node
/**
 * Crumb setup — single-command bootstrap from a fresh clone.
 *
 *   git clone … && cd crumb && npm run setup
 *
 * Composed of three idempotent steps:
 *   1. install   — `npm install` (postinstall pre-caches Playwright chromium)
 *   2. build     — `npm run build` (root + workspaces, including @crumb/studio)
 *   3. doctor    — `node dist/index.js doctor` (read-only environment probe)
 *
 * No symlinking, no global PATH mutation. Per project policy, `npm link`
 * is forbidden — global symlinks are surprising on shared machines and
 * tangle node_modules resolution under monorepo workspaces. Users invoke
 * the CLI via `npx crumb` / `npx crumb-studio` (npm resolves the workspace
 * `bin` directly), or via the absolute paths printed at the end.
 *
 * Each step is skippable via env var:
 *   CRUMB_SETUP_SKIP_INSTALL=1
 *   CRUMB_SETUP_SKIP_BUILD=1
 *   CRUMB_SETUP_SKIP_DOCTOR=1
 *
 * Idempotent — safe to re-run after `git pull` to update.
 *
 * Path policy: this script computes `repoRoot` from `import.meta.url` and
 * never reads any absolute path baked at install time. Works under any
 * checkout location (evaluator's $HOME, /tmp, network mount, Docker volume).
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
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...opts,
    });
    child.on('exit', (code) => {
      if (code === 0) res();
      else rej(new Error(`${label} failed (exit ${code})`));
    });
    child.on('error', rej);
  });
}

const banner = `\n┌─ Crumb setup ────────────────────────────────────────────────┐
│  install → build → doctor (idempotent — safe to re-run)      │
│  no symlinks, no global PATH mutation                        │
└──────────────────────────────────────────────────────────────┘`;

async function main() {
  // eslint-disable-next-line no-console
  console.log(banner);

  if (process.env.CRUMB_SETUP_SKIP_INSTALL !== '1') {
    await run('install dependencies', 'npm', ['install', '--no-audit', '--no-fund']);
  } else {
    process.stdout.write('\n▸ install (skipped via CRUMB_SETUP_SKIP_INSTALL=1)\n');
  }

  if (process.env.CRUMB_SETUP_SKIP_BUILD !== '1') {
    await run('build', 'npm', ['run', 'build']);
  } else {
    process.stdout.write('\n▸ build (skipped via CRUMB_SETUP_SKIP_BUILD=1)\n');
  }

  if (process.env.CRUMB_SETUP_SKIP_DOCTOR !== '1') {
    // Doctor is best-effort — partial auth (e.g. only Codex logged in) is
    // expected on first run. Don't fail setup if doctor reports degraded.
    try {
      await run('doctor (environment probe)', 'node', ['dist/index.js', 'doctor']);
    } catch (err) {
      process.stdout.write(`  (doctor reported issues — see output above; not fatal)\n`);
    }
  }

  const crumbBin = resolve(repoRoot, 'dist', 'index.js');
  const studioBin = resolve(repoRoot, 'packages', 'studio', 'dist', 'cli.js');

  process.stdout.write(`\n✓ Setup complete.\n\n`);
  process.stdout.write(`How to invoke (no symlinks, no global install):\n`);
  process.stdout.write(`  • npx crumb …           (preferred — workspace bin)\n`);
  process.stdout.write(`  • npx crumb-studio …    (preferred — workspace bin)\n`);
  process.stdout.write(`  • node ${crumbBin}\n`);
  process.stdout.write(`  • node ${studioBin}\n\n`);
  process.stdout.write(`Try a deterministic smoke run (no auth required):\n`);
  process.stdout.write(`  npx crumb run --goal "60s match-3 combo" --adapter mock --idle-timeout 5000\n\n`);
  process.stdout.write(`Live observability studio:\n`);
  process.stdout.write(`  npx crumb-studio        (opens http://127.0.0.1:7321/)\n\n`);
}

main().catch((err) => {
  process.stderr.write(`\n✗ Setup failed: ${err.message}\n`);
  process.exit(1);
});
