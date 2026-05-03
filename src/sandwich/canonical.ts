/**
 * Canonical (byte-identical) sandwich assembly for the W2 CI gate.
 *
 * Produces the same bytes that `assembleSandwich()` in `src/dispatcher/live.ts`
 * would produce **for a fresh session with zero runtime appends and zero local
 * override**. Used by `canonical.test.ts` to lock SHA-256 hashes per actor —
 * any unintended edit to an inlined skill, specialist, or base sandwich .md
 * shifts the hash, fails CI, and tells the developer to either revert the
 * change or regenerate the lockfile (`npm run sandwich:update-hashes`).
 *
 * Why this gate matters: Anthropic prompt cache is content-addressed. Even
 * one whitespace change in a sandwich invalidates every cache entry that
 * depended on the unchanged prefix. Sandwich edits are sometimes necessary,
 * but they should be deliberate and budgeted — never accidental drift.
 *
 * Backed by `wiki/synthesis/bagelcode-pre-verifier-no-scoring-frontier-
 * 2026-05-03.md` (cache-discipline lineage) and the migration plan §13.2
 * (single-source data stewardship).
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

import { parseInlineRefs } from '../dispatcher/live.js';
import type { Actor } from '../protocol/types.js';

/**
 * Actors that emit transcript events (need _event-protocol.md inlined).
 * Mirrors `EMITTING_ACTORS` in dispatcher/live.ts — kept in sync manually
 * because the dispatcher's set is module-private. If the runtime set
 * changes, this canonical assembler must be updated and hashes regenerated.
 */
const EMITTING_ACTORS: ReadonlySet<Actor> = new Set([
  'planner-lead',
  'builder',
  'verifier',
  'researcher',
]);

/**
 * Actors that have a base sandwich .md file under `agents/`. Post-Prune-2
 * the list is 5 (builder-fallback removed). `coordinator.md` exists but
 * coordinator is host-inline so its sandwich is consumed by the host (Claude
 * Code skill / Codex agent / Gemini extension), not via Task spawn — still
 * locked here because the host expects byte-identical content too.
 */
export const ACTORS_WITH_CANONICAL_SANDWICH: Actor[] = [
  'coordinator',
  'planner-lead',
  'researcher',
  'builder',
  'verifier',
];

/**
 * Assemble the canonical sandwich for an actor — same algorithm as runtime
 * `assembleSandwich()` minus the parts that are session-specific (local
 * override, runtime sandwich_appends, output to agent-workspace).
 */
export async function canonicalSandwich(repoRoot: string, actor: Actor): Promise<string> {
  const base = resolve(repoRoot, 'agents', `${actor}.md`);
  if (!existsSync(base)) {
    throw new Error(`canonicalSandwich: missing agents/${actor}.md`);
  }
  const baseContent = await readFile(base, 'utf-8');
  const refs = parseInlineRefs(baseContent);
  const inlineRefs = [
    ...refs.skills.map((p) => ({ kind: 'skill' as const, path: p })),
    ...refs.specialists.map((p) => ({ kind: 'specialist' as const, path: p })),
  ];

  const parts: string[] = [baseContent];

  for (const ref of inlineRefs) {
    const refPath = resolve(repoRoot, ref.path);
    if (!existsSync(refPath)) {
      parts.push(`<!-- inline ${ref.kind} MISSING: ${ref.path} (not found at ${refPath}) -->`);
      continue;
    }
    const refContent = await readFile(refPath, 'utf-8');
    parts.push(
      `<!-- begin inlined ${ref.kind} (${ref.path}) -->\n${refContent}\n<!-- end inlined ${ref.kind} (${ref.path}) -->`,
    );
  }

  if (EMITTING_ACTORS.has(actor)) {
    const ep = resolve(repoRoot, 'agents', '_event-protocol.md');
    if (existsSync(ep)) {
      const epContent = await readFile(ep, 'utf-8');
      parts.push(
        `<!-- begin event protocol (agents/_event-protocol.md) -->\n${epContent}\n<!-- end event protocol -->`,
      );
    }
  }

  return parts.join('\n\n') + '\n';
}

export async function canonicalSandwichHash(repoRoot: string, actor: Actor): Promise<string> {
  const text = await canonicalSandwich(repoRoot, actor);
  return createHash('sha256').update(text).digest('hex');
}
