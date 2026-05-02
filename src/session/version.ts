/**
 * Version graph — immutable milestones under `~/.crumb/projects/<id>/versions/<vN>/`.
 *
 * v0.3.0 introduces a 2-tier session model:
 *  - `sessions/<ulid>/` = WIP attempt (mutable lifecycle: running/paused/done/error/killed)
 *  - `versions/<vN>/`   = released milestone (immutable; manifest.toml + frozen artifacts copy)
 *
 * Naming follows the v0.dev / Lovable hybrid: sequential `v<N>` for sortability + an
 * optional `--label` for human readability. Either form is filesystem-safe; the
 * `<vN>[-<label>]/` directory name is canonical (e.g. `v2-combo-bonus/`).
 *
 * `crumb release <session-ulid>`: snapshot the session's artifacts/ into the next vN,
 * record scorecard from the last judge.score event, and append `kind=version.released`
 * to the source session's transcript. Sessions stay mutable; versions stay frozen.
 *
 * `crumb versions`: enumerate the project's versions with parent_version chain, scorecard
 * deltas, and label tags.
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { parse as parseToml, stringify as stringifyToml, type JsonMap } from '@iarna/toml';

import type { Message, Verdict } from '../protocol/types.js';

export interface VersionScorecard {
  D1?: number;
  D2?: number;
  D3?: number;
  D4?: number;
  D5?: number;
  D6?: number;
  aggregate?: number;
  verdict?: Verdict;
}

export interface VersionManifest {
  schema_version: 1;
  name: string;
  label?: string;
  released_at: string;
  source_session: string;
  source_event_id?: string;
  parent_version?: string;
  goal?: string;
  scorecard?: VersionScorecard;
  artifacts_sha256?: Record<string, string>;
}

const MANIFEST_FILE = 'manifest.toml';

export function manifestPath(versionDir: string): string {
  return join(versionDir, MANIFEST_FILE);
}

/** Filesystem-safe directory name for a version. `v2` or `v2-combo-bonus`. */
export function versionDirName(name: string, label?: string): string {
  if (!label) return name;
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length === 0 ? name : `${name}-${slug}`;
}

/** Find the next sequential `v<N>` by scanning existing version dirs. */
export async function nextSequentialVersion(versionsDir: string): Promise<string> {
  if (!existsSync(versionsDir)) return 'v1';
  const entries = await readdir(versionsDir);
  const numbers = entries
    .map((e) => /^v(\d+)(?:-|$)/.exec(e)?.[1])
    .filter((n): n is string => Boolean(n))
    .map((n) => Number(n));
  if (numbers.length === 0) return 'v1';
  return `v${Math.max(...numbers) + 1}`;
}

/** Read all manifests under a versions/ dir. */
export async function readAllManifests(versionsDir: string): Promise<VersionManifest[]> {
  if (!existsSync(versionsDir)) return [];
  const entries = await readdir(versionsDir);
  const out: VersionManifest[] = [];
  for (const e of entries) {
    const m = await readManifest(join(versionsDir, e));
    if (m) out.push(m);
  }
  return out.sort((a, b) => a.released_at.localeCompare(b.released_at));
}

export async function readManifest(versionDir: string): Promise<VersionManifest | null> {
  const p = manifestPath(versionDir);
  if (!existsSync(p)) return null;
  try {
    const raw = await readFile(p, 'utf8');
    return parseToml(raw) as unknown as VersionManifest;
  } catch {
    return null;
  }
}

export async function writeManifest(versionDir: string, manifest: VersionManifest): Promise<void> {
  await mkdir(versionDir, { recursive: true });
  // @iarna/toml's typed entrypoint needs JsonMap; we strip undefined to match.
  const cleaned: JsonMap = {};
  for (const [k, v] of Object.entries(manifest)) {
    if (v !== undefined) cleaned[k] = v as JsonMap[string];
  }
  await writeFile(manifestPath(versionDir), stringifyToml(cleaned), 'utf8');
}

/** Pull D1-D6 + verdict + aggregate out of the most recent judge.score event. */
export function deriveScorecard(events: Message[]): VersionScorecard | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.kind !== 'judge.score' || !e.scores) continue;
    const s = e.scores;
    const card: VersionScorecard = {};
    if (s.D1?.score !== undefined) card.D1 = s.D1.score;
    if (s.D2?.score !== undefined) card.D2 = s.D2.score;
    if (s.D3?.score !== undefined) card.D3 = s.D3.score;
    if (s.D4?.score !== undefined) card.D4 = s.D4.score;
    if (s.D5?.score !== undefined) card.D5 = s.D5.score;
    if (s.D6?.score !== undefined) card.D6 = s.D6.score;
    if (s.aggregate !== undefined) card.aggregate = s.aggregate;
    if (s.verdict !== undefined) card.verdict = s.verdict;
    return Object.keys(card).length > 0 ? card : undefined;
  }
  return undefined;
}

/** Pick the source_event_id — preferred: kind=done, else last judge.score, else last event. */
export function deriveSourceEventId(events: Message[]): string | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].kind === 'done') return events[i].id;
  }
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].kind === 'judge.score') return events[i].id;
  }
  return events.at(-1)?.id;
}

/**
 * Copy artifacts/* from sessionDir to versionDir/artifacts/, recording sha256 per file.
 * No links — pure copies, so the version is durable even if the source session is deleted.
 */
export async function snapshotArtifacts(
  sessionDir: string,
  versionDir: string,
): Promise<Record<string, string>> {
  const srcDir = join(sessionDir, 'artifacts');
  const dstDir = join(versionDir, 'artifacts');
  if (!existsSync(srcDir)) return {};
  await mkdir(dstDir, { recursive: true });
  const out: Record<string, string> = {};
  const files = await readdir(srcDir);
  for (const f of files) {
    const src = join(srcDir, f);
    const dst = join(dstDir, f);
    await copyFile(src, dst);
    const buf = await readFile(src);
    out[basename(f)] = createHash('sha256').update(buf).digest('hex');
  }
  return out;
}
