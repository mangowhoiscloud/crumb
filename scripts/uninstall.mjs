#!/usr/bin/env node
/**
 * Crumb uninstall — clean removal helper.
 *
 *   npm run uninstall
 *
 * Because Crumb does NOT install symlinks (no `npm link`, no global PATH),
 * uninstall is mostly a documentation step. This script:
 *
 *   1. Reports every artifact directory Crumb may have created and where
 *      to delete it from (path-aware — works on macOS / Linux / Windows
 *      and respects $XDG_CACHE_HOME / $LOCALAPPDATA).
 *   2. By default ONLY removes build artifacts inside the repo
 *      (dist/ + packages/*\/dist + node_modules/.cache). Idempotent.
 *   3. Refuses to touch user data (~/.crumb/, sessions/, the playwright
 *      browser cache) unless --purge-data or --purge-browsers is passed
 *      explicitly. The user owns those bytes.
 *
 *   Flags:
 *     --purge-data       additionally remove $CRUMB_HOME (default ~/.crumb)
 *     --purge-browsers   additionally remove the Playwright chromium cache
 *     --dry-run          print what would happen, do not delete anything
 *
 * Path policy: every path is resolved at runtime from os.homedir() / env
 * vars / import.meta.url — nothing is hardcoded to a specific machine.
 */

import { rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { homedir, platform } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const argv = new Set(process.argv.slice(2));
const dryRun = argv.has('--dry-run');
const purgeData = argv.has('--purge-data');
const purgeBrowsers = argv.has('--purge-browsers');

function crumbHomeDir() {
  return process.env.CRUMB_HOME && process.env.CRUMB_HOME.length > 0
    ? process.env.CRUMB_HOME
    : join(homedir(), '.crumb');
}

function playwrightCacheDirs() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return [process.env.PLAYWRIGHT_BROWSERS_PATH];
  if (platform() === 'darwin') return [join(homedir(), 'Library', 'Caches', 'ms-playwright')];
  if (platform() === 'win32') return [join(process.env.LOCALAPPDATA ?? homedir(), 'ms-playwright')];
  return [join(homedir(), '.cache', 'ms-playwright')];
}

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function remove(label, p) {
  if (!(await exists(p))) {
    process.stdout.write(`  · ${label}: not present (${p})\n`);
    return;
  }
  if (dryRun) {
    process.stdout.write(`  · ${label}: would remove ${p}\n`);
    return;
  }
  await rm(p, { recursive: true, force: true });
  process.stdout.write(`  ✓ ${label}: removed ${p}\n`);
}

async function main() {
  process.stdout.write(`\nCrumb uninstall${dryRun ? ' (dry-run)' : ''}\n`);
  process.stdout.write(`────────────────────────────────────────\n`);
  process.stdout.write(`Repo:        ${repoRoot}\n`);
  process.stdout.write(`CRUMB_HOME:  ${crumbHomeDir()}\n\n`);

  process.stdout.write(`Build artifacts (always removed):\n`);
  await remove('root dist', resolve(repoRoot, 'dist'));
  await remove('studio dist', resolve(repoRoot, 'packages', 'studio', 'dist'));
  await remove('studio inline-html', resolve(repoRoot, 'packages', 'studio', 'src', 'studio-html.generated.ts'));
  await remove('node_modules cache', resolve(repoRoot, 'node_modules', '.cache'));
  await remove('tsbuildinfo', resolve(repoRoot, '.tsbuildinfo'));

  process.stdout.write(`\nUser data (${purgeData ? 'removing' : 'opt-in via --purge-data'}):\n`);
  if (purgeData) {
    await remove('CRUMB_HOME (sessions, projects, presets local override)', crumbHomeDir());
  } else {
    process.stdout.write(`  · ${crumbHomeDir()} (skipped — pass --purge-data to remove)\n`);
  }

  process.stdout.write(`\nPlaywright browser cache (${purgeBrowsers ? 'removing' : 'opt-in via --purge-browsers'}):\n`);
  for (const dir of playwrightCacheDirs()) {
    if (purgeBrowsers) await remove('chromium cache', dir);
    else process.stdout.write(`  · ${dir} (skipped — pass --purge-browsers to remove)\n`);
  }

  process.stdout.write(`\nNothing was symlinked to your PATH at install time, so no \`npm unlink\`\n`);
  process.stdout.write(`is needed. To finish removal, simply delete the cloned directory:\n`);
  process.stdout.write(`  rm -rf "${repoRoot}"\n\n`);
  if (!dryRun && !purgeData) {
    process.stdout.write(`(Re-run with --purge-data to also remove ~/.crumb session history.)\n\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`\n✗ Uninstall failed: ${err.message}\n`);
  process.exit(1);
});
