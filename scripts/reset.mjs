#!/usr/bin/env node
/**
 * Crumb reset — clean repo state without removing user data.
 *
 *   npm run reset
 *
 * Resets the repo to a fresh-clone-equivalent state:
 *   • removes dist/ + packages/*\/dist + tsbuildinfo
 *   • removes node_modules/ (root + workspaces)
 *   • removes the studio HTML inliner artifact (regenerated at next build)
 *
 * Does NOT touch:
 *   • ~/.crumb/         (user data — sessions, projects, presets local)
 *   • ms-playwright/    (chromium binary cache — costly to re-download)
 *   • git working tree  (uncommitted edits preserved)
 *
 * Useful when (a) the build is in a bad state, (b) the evaluator wants to
 * reproduce "from a fresh clone" without re-cloning, (c) before opening a
 * regression bisect.
 *
 *   --dry-run   show what would be removed without removing
 *
 * Path policy: every path is computed at runtime from import.meta.url; no
 * machine-specific paths.
 */

import { rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const dryRun = process.argv.includes('--dry-run');

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
    process.stdout.write(`  · ${label}: not present\n`);
    return;
  }
  if (dryRun) {
    process.stdout.write(`  · ${label}: would remove ${p}\n`);
    return;
  }
  await rm(p, { recursive: true, force: true });
  process.stdout.write(`  ✓ ${label}: removed\n`);
}

async function main() {
  process.stdout.write(`\nCrumb reset${dryRun ? ' (dry-run)' : ''}\n`);
  process.stdout.write(`Repo: ${repoRoot}\n\n`);
  process.stdout.write(`Build artifacts:\n`);
  await remove('dist/', resolve(repoRoot, 'dist'));
  await remove('packages/studio/dist/', resolve(repoRoot, 'packages', 'studio', 'dist'));
  await remove(
    'packages/studio/src/studio-html.generated.ts',
    resolve(repoRoot, 'packages', 'studio', 'src', 'studio-html.generated.ts'),
  );
  await remove('.tsbuildinfo', resolve(repoRoot, '.tsbuildinfo'));

  process.stdout.write(`\nDependencies:\n`);
  await remove('node_modules/', resolve(repoRoot, 'node_modules'));
  await remove('packages/studio/node_modules/', resolve(repoRoot, 'packages', 'studio', 'node_modules'));

  process.stdout.write(`\nPreserved (intentionally not touched):\n`);
  process.stdout.write(`  · ~/.crumb/                  (sessions, projects)\n`);
  process.stdout.write(`  · Playwright browser cache    (chromium binary)\n`);
  process.stdout.write(`  · git working tree            (uncommitted edits)\n`);

  process.stdout.write(`\n✓ Reset complete. Run \`npm run setup\` to rebuild.\n`);
}

main().catch((err) => {
  process.stderr.write(`\n✗ Reset failed: ${err.message}\n`);
  process.exit(1);
});
