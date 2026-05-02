/**
 * `crumb init` — multi-host entry verifier (Spec-kit `specify init` pattern).
 *
 * The host entries (.claude/skills/crumb/, .codex/agents/crumb.toml,
 * .gemini/extensions/crumb/*) are committed to the repo, so a `git clone`
 * already installs them. This helper verifies they are present and
 * reports missing files — it does NOT scaffold templates from scratch.
 *
 * `crumb init --check` is the primary surface (verify only). The same
 * machinery powers `crumb init --host <name>` which limits the check to
 * a single host. `--format=json` toggles output.
 *
 * Distinct from `crumb doctor` (which checks runtime readiness:
 * CLI binaries on PATH, OAuth tokens, API keys, adapter health).
 *
 * Source pattern: wiki/references/bagelcode-multi-host-harness-research-2026.md
 *   §J Spec-kit `.specify/` (multi-host install per host integration)
 *   §6 Result of decision: separate from `crumb doctor`
 */

import { existsSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

export type HostKind = 'claude' | 'codex' | 'gemini';
export type HostFilter = HostKind | 'all';

const HOST_FILES: Record<HostKind, readonly string[]> = {
  claude: ['.claude/skills/crumb/SKILL.md'],
  codex: ['.codex/agents/crumb.toml'],
  gemini: [
    '.gemini/extensions/crumb/gemini-extension.json',
    '.gemini/extensions/crumb/GEMINI.md',
    '.gemini/extensions/crumb/commands/crumb.toml',
  ],
} as const;

const ROOT_IDENTITY: readonly string[] = ['CRUMB.md', 'AGENTS.md'] as const;

export interface HostStatus {
  host: HostKind;
  files: { path: string; present: boolean }[];
  ok: boolean;
}

export interface CheckResult {
  identity: { path: string; present: boolean }[];
  hosts: HostStatus[];
  ok: boolean;
}

export interface CheckOptions {
  filter?: HostFilter;
  projectRoot: string;
}

/** Verify universal identity + per-host entries. */
export function check(opts: CheckOptions): CheckResult {
  const { projectRoot, filter = 'all' } = opts;

  const identity = ROOT_IDENTITY.map((rel) => ({
    path: rel,
    present: existsSync(resolvePath(projectRoot, rel)),
  }));

  const hostsToCheck: HostKind[] =
    filter === 'all' ? (Object.keys(HOST_FILES) as HostKind[]) : [filter];

  const hosts: HostStatus[] = hostsToCheck.map((host) => {
    const files = HOST_FILES[host].map((rel) => ({
      path: rel,
      present: existsSync(resolvePath(projectRoot, rel)),
    }));
    return {
      host,
      files,
      ok: files.every((f) => f.present),
    };
  });

  const ok = identity.every((i) => i.present) && hosts.every((h) => h.ok);
  return { identity, hosts, ok };
}

/** Human-readable formatter (default). */
export function formatHuman(result: CheckResult): string {
  const lines: string[] = [];
  lines.push('# Crumb host entries');
  lines.push('');
  lines.push('## Universal identity');
  for (const i of result.identity) {
    const sym = i.present ? '✅' : '❌';
    lines.push(`  ${sym}  ${i.path}`);
  }
  lines.push('');
  lines.push('## Host entries');
  for (const h of result.hosts) {
    const headSym = h.ok ? '✅' : '❌';
    lines.push(`  ${headSym}  ${h.host}`);
    for (const f of h.files) {
      const sym = f.present ? '   ✓' : '   ✗';
      lines.push(`  ${sym}  ${f.path}`);
    }
  }
  lines.push('');
  lines.push(result.ok ? 'Status: OK' : 'Status: missing files (see ❌ above)');
  if (!result.ok) {
    lines.push('Hint: re-clone the repo or copy the missing files from origin/main.');
  }
  return lines.join('\n');
}

/** Machine-readable formatter (for scripts / CI). */
export function formatJson(result: CheckResult): string {
  return JSON.stringify(result, null, 2);
}
