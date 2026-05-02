/**
 * Validate-loader smoke tests — guard against schema-bundling regression.
 *
 * The validator resolves protocol/schemas/message.schema.json relative to
 * the compiled dist/protocol/validate.js path. After `npm i -g`, the schema
 * file MUST be shipped alongside dist/ in the published package — otherwise
 * the first message validation throws ENOENT and every session crashes.
 *
 * package.json `files` field is the allowlist that ships protocol/schemas/.
 * If a future refactor drops it, this test catches the regression locally
 * (npm pack --dry-run + open the schema file) before publish.
 */

import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

describe('package.json files field — schema bundling guard', () => {
  it('protocol/schemas/message.schema.json is reachable from repo root', () => {
    const schemaPath = resolve(REPO_ROOT, 'protocol', 'schemas', 'message.schema.json');
    expect(existsSync(schemaPath)).toBe(true);
    const raw = readFileSync(schemaPath, 'utf-8');
    const json = JSON.parse(raw) as { $id?: string; properties?: Record<string, unknown> };
    expect(json.properties).toBeDefined();
  });

  it('npm pack --dry-run includes protocol/schemas + agents + presets + dist', () => {
    const out = execSync('npm pack --dry-run --json 2>/dev/null', {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    });
    // npm pack --json emits an array with a single object containing { files: [{ path, size, mode }, ...] }
    const parsed = JSON.parse(out) as Array<{ files: Array<{ path: string }> }>;
    const files = parsed[0]?.files.map((f) => f.path) ?? [];
    expect(files.some((p) => p === 'protocol/schemas/message.schema.json')).toBe(true);
    expect(files.some((p) => p === 'agents/coordinator.md')).toBe(true);
    expect(files.some((p) => p === 'agents/builder.md')).toBe(true);
    expect(files.some((p) => p === 'agents/verifier.md')).toBe(true);
    expect(files.some((p) => p === '.crumb/presets/bagelcode-cross-3way.toml')).toBe(true);
    expect(files.some((p) => p === '.crumb/presets/mock.toml')).toBe(true);
    expect(files.some((p) => p === 'AGENTS.md')).toBe(true);
    expect(files.some((p) => p === 'CLAUDE.md')).toBe(true);
    expect(files.some((p) => p === 'GEMINI.md')).toBe(true);
    expect(files.some((p) => p === 'LICENSE')).toBe(true);
    // dist/ pattern is in the allowlist; in CI's `npm test` job there is no
    // build step before tests run, so dist/ is empty on disk and npm pack
    // legitimately won't list any dist/ files. We only assert the allowlist
    // has the dist pattern — the post-build smoke (separate test below) checks
    // the actual built binary is shipped.
    const pkg = JSON.parse(execSync('cat package.json', { cwd: REPO_ROOT, encoding: 'utf-8' })) as {
      files?: string[];
    };
    expect(pkg.files?.includes('dist')).toBe(true);
  }, 30_000);

  it('post-build npm pack ships dist/ binary (skipped when dist/ is empty)', () => {
    const distExists = existsSync(resolve(REPO_ROOT, 'dist', 'cli.js'));
    if (!distExists) {
      // CI test job runs before build; locally `npm run build` precedes a full
      // gate. Skip rather than fail when there is genuinely nothing to ship.
      return;
    }
    const out = execSync('npm pack --dry-run --json 2>/dev/null', {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    });
    const parsed = JSON.parse(out) as Array<{ files: Array<{ path: string }> }>;
    const files = parsed[0]?.files.map((f) => f.path) ?? [];
    expect(files.some((p) => p === 'dist/cli.js')).toBe(true);
    expect(files.some((p) => p === 'dist/index.js')).toBe(true);
    expect(files.some((p) => p === 'dist/protocol/validate.js')).toBe(true);
  }, 30_000);

  it('npm pack --dry-run excludes test artifacts + python bytecode', () => {
    const out = execSync('npm pack --dry-run --json 2>/dev/null', {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    });
    const parsed = JSON.parse(out) as Array<{ files: Array<{ path: string }> }>;
    const files = parsed[0]?.files.map((f) => f.path) ?? [];
    expect(files.some((p) => p.includes('__pycache__'))).toBe(false);
    expect(files.some((p) => p.endsWith('.pyc'))).toBe(false);
    expect(files.some((p) => p.endsWith('.test.ts'))).toBe(false);
    expect(files.some((p) => p.endsWith('.test.js'))).toBe(false);
    expect(files.some((p) => p.endsWith('.test.d.ts'))).toBe(false);
    expect(files.some((p) => p.endsWith('.spec.ts'))).toBe(false);
  }, 30_000);
});
