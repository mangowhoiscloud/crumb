/**
 * Version graph reader (Studio-local mirror).
 *
 * Reads `~/.crumb/projects/<projectId>/versions/<vN>[-<label>]/manifest.toml`
 * for the M7 Versions panel. Decoupled from `crumb` core per §17.2 — we
 * mirror the schema rather than importing `src/session/version.ts` so the
 * studio package stays standalone-installable.
 *
 * Mirror discipline: keep `VersionManifestSurface` field set aligned with
 * crumb core's `VersionManifest` (`src/session/version.ts:40`). New fields
 * added there should appear here when surfaced in the panel.
 */

import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { parse as parseToml } from '@iarna/toml';

import { getCrumbHomes } from './paths.js';

export interface VersionManifestSurface {
  schema_version?: number;
  name: string;
  label?: string;
  released_at: string;
  source_session?: string;
  source_event_id?: string;
  parent_version?: string;
  goal?: string;
  scorecard?: {
    D1?: number;
    D2?: number;
    D3?: number;
    D4?: number;
    D5?: number;
    D6?: number;
    aggregate?: number;
    verdict?: 'PASS' | 'PARTIAL' | 'FAIL' | 'REJECT';
  };
  artifacts_sha256?: Record<string, string>;
}

export interface VersionRow extends VersionManifestSurface {
  /** Directory name on disk (e.g. `v2-combo-bonus`). */
  dir_name: string;
  /** Absolute path to the version directory — used for artifact serving. */
  version_dir: string;
}

const MANIFEST_FILE = 'manifest.toml';

/**
 * Walk every active CRUMB_HOME for the given project's versions/ dir and
 * return parsed manifests, oldest-first. Multi-home projects with the same
 * synthetic project id are merged across homes.
 */
export async function listProjectVersions(projectId: string): Promise<VersionRow[]> {
  const out: VersionRow[] = [];
  for (const home of getCrumbHomes()) {
    const versionsDir = join(home, 'projects', projectId, 'versions');
    if (!existsSync(versionsDir)) continue;
    let entries: string[];
    try {
      entries = await readdir(versionsDir);
    } catch {
      continue;
    }
    for (const dirName of entries) {
      const versionDir = join(versionsDir, dirName);
      const manifest = await readManifestSafe(versionDir);
      if (!manifest) continue;
      out.push({ ...manifest, dir_name: dirName, version_dir: versionDir });
    }
  }
  return out.sort((a, b) => a.released_at.localeCompare(b.released_at));
}

/**
 * Resolve a single project + version → version directory + manifest.
 * Returns null when the manifest cannot be read (missing / malformed).
 * Used by the artifact serving endpoint to locate `<vN>/artifacts/<rel>`.
 */
export async function resolveProjectVersion(
  projectId: string,
  versionRef: string,
): Promise<VersionRow | null> {
  const all = await listProjectVersions(projectId);
  // Match either the canonical sequential name (`v2`) or the full dir name
  // (`v2-combo-bonus`). Prefer exact dir match first.
  const exact = all.find((v) => v.dir_name === versionRef);
  if (exact) return exact;
  const byName = all.find((v) => v.name === versionRef);
  return byName ?? null;
}

async function readManifestSafe(versionDir: string): Promise<VersionManifestSurface | null> {
  const path = join(versionDir, MANIFEST_FILE);
  if (!existsSync(path)) return null;
  try {
    const raw = await readFile(path, 'utf8');
    return parseToml(raw) as unknown as VersionManifestSurface;
  } catch {
    return null;
  }
}
