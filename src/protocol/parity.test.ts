/**
 * Schema ↔ TypeScript parity test.
 *
 * `protocol/schemas/message.schema.json` (the JSON Schema source-of-truth
 * for ajv runtime validation) and `src/protocol/types.ts` (the TypeScript
 * Kind union consumed by the reducer / state / scorer) are hand-maintained
 * twins. Without a parity check, adding a new kind to one but forgetting
 * the other creates a silent drift: ajv will accept events the type system
 * doesn't model, or the type system will let through events ajv rejects.
 *
 * This test lifts both into runtime values and compares them. Three layers
 * of protection:
 *
 *   (1) `satisfies readonly Kind[]` — every entry of TS_KINDS must be a
 *       member of the Kind union (else compile error).
 *
 *   (2) `Exclude<Kind, (typeof TS_KINDS)[number]> extends never` — every
 *       Kind must be in TS_KINDS (else compile error). The unused
 *       _missingKinds local pins this assertion at compile time.
 *
 *   (3) The runtime `expect(SCHEMA_KINDS).toEqual(TS_KINDS)` assertion.
 *
 * If a future PR adds a new kind to one of the three sources without
 * updating the other two, exactly one of these three checks fires.
 *
 * Frontier rationale: ICST 2026 (arXiv 2504.04372) — drift between the
 * type system and runtime validation is a class of bug LLMs cannot infer
 * from the code alone (the schema is JSON, the types are TypeScript;
 * neither imports the other). A test that bridges them is the only way
 * to keep both honest. See PR-A audit P0 in
 * `wiki/references/bagelcode-nl-intervention-12-systems-2026-05-02.md`.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Kind } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, '../../protocol/schemas/message.schema.json');

interface SchemaShape {
  properties: { kind: { enum: string[] } };
}

const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as SchemaShape;
const SCHEMA_KINDS: readonly string[] = schema.properties.kind.enum;

// Hand-maintained mirror of the Kind union from types.ts.
// `satisfies readonly Kind[]` enforces every entry is a valid Kind at compile time.
const TS_KINDS = [
  'session.start',
  'session.end',
  'agent.wake',
  'agent.stop',
  'goal',
  'question.socratic',
  'answer.socratic',
  'spec',
  'spec.update',
  'build',
  'qa.result',
  'verify.result',
  'judge.score',
  'done',
  'agent.thought_summary',
  'note',
  'step.socratic',
  'step.concept',
  'step.research',
  'step.research.video',
  'step.design',
  'step.judge',
  'user.intervene',
  'user.veto',
  'user.approve',
  'user.pause',
  'user.resume',
  'handoff.requested',
  'handoff.rollback',
  'artifact.created',
  'version.released',
  'error',
  'audit',
  'tool.call',
  'tool.result',
] as const satisfies readonly Kind[];

// Reverse check — Kind has no member outside TS_KINDS. Compile error if a
// new Kind is added to types.ts but forgotten here.
type _MissingKinds = Exclude<Kind, (typeof TS_KINDS)[number]>;
const _missingKindsCheck: [_MissingKinds] extends [never] ? true : never = true;
void _missingKindsCheck;

describe('schema ↔ TypeScript parity', () => {
  it('protocol/schemas/message.schema.json `kind.enum` matches TS Kind union', () => {
    const sortedSchema = [...SCHEMA_KINDS].sort();
    const sortedTs = [...TS_KINDS].sort();
    expect(sortedSchema).toEqual(sortedTs);
  });

  it('every TS_KIND appears exactly once in the schema enum', () => {
    for (const k of TS_KINDS) {
      expect(SCHEMA_KINDS.filter((s) => s === k)).toHaveLength(1);
    }
  });
});
