/**
 * Session meta.json — lifecycle tracking per session.
 *
 * Sits alongside `transcript.jsonl` inside `~/.crumb/projects/<id>/sessions/<ulid>/`.
 * Unlike the transcript (append-only, single source of truth), meta.json is mutable:
 * the coordinator updates `status` as the session progresses (`running` → `done` |
 * `error` | `killed`), and `crumb resume` flips a `paused` session back to `running`.
 *
 * meta.json is a *cache* — losing it doesn't break replay (state is always re-derivable
 * from transcript.jsonl). It exists purely to give `crumb ls` and `crumb resume` a fast
 * O(1) lookup of session lifecycle without scanning the transcript head.
 *
 * For forks: `parent_session_id` + `fork_event_id` carry the same info as the
 * `kind=session.forked` first transcript event; meta.json mirrors them so listing
 * forks doesn't require opening every transcript.
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type SessionStatus = 'running' | 'paused' | 'done' | 'error' | 'killed';

export interface SessionMeta {
  schema_version: 1;
  session_id: string;
  status: SessionStatus;
  started_at: string;
  ended_at?: string;
  goal?: string;
  preset?: string;
  /** Set only on forked sessions. Mirrors the kind=session.forked event. */
  parent_session_id?: string;
  fork_event_id?: string;
  /** Optional human label, e.g. set by `crumb run --label "match-3 v1"`. */
  label?: string;
}

const META_FILE = 'meta.json';

export function metaPath(sessionDir: string): string {
  return join(sessionDir, META_FILE);
}

export async function readMeta(sessionDir: string): Promise<SessionMeta | null> {
  const p = metaPath(sessionDir);
  if (!existsSync(p)) return null;
  try {
    const raw = await readFile(p, 'utf8');
    return JSON.parse(raw) as SessionMeta;
  } catch {
    return null;
  }
}

export async function writeMeta(sessionDir: string, meta: SessionMeta): Promise<void> {
  await writeFile(metaPath(sessionDir), JSON.stringify(meta, null, 2) + '\n', 'utf8');
}

export async function updateMeta(
  sessionDir: string,
  patch: Partial<Omit<SessionMeta, 'schema_version' | 'session_id'>>,
): Promise<SessionMeta | null> {
  const cur = await readMeta(sessionDir);
  if (!cur) return null;
  const next: SessionMeta = { ...cur, ...patch };
  await writeMeta(sessionDir, next);
  return next;
}

export function newMeta(input: {
  sessionId: string;
  goal?: string;
  preset?: string;
  parentSessionId?: string;
  forkEventId?: string;
  label?: string;
  startedAt?: string;
}): SessionMeta {
  return {
    schema_version: 1,
    session_id: input.sessionId,
    status: 'running',
    started_at: input.startedAt ?? new Date().toISOString(),
    goal: input.goal,
    preset: input.preset,
    parent_session_id: input.parentSessionId,
    fork_event_id: input.forkEventId,
    label: input.label,
  };
}
