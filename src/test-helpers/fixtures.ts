/**
 * Shared test fixtures — extracted from per-test-file duplicates.
 *
 * Previously `src/reducer/index.test.ts` and `src/state/scorer.test.ts`
 * each defined a near-identical `fixed()` factory that produced a Message
 * with default ULID / ts / session_id, differing only in the default `kind`.
 * Centralizing here keeps the defaults single-sourced; future schema
 * additions only need updating one factory.
 */

import type { Message, Kind } from '../protocol/types.js';

const DEFAULT_ID = '01H0000000000000000000000A';
const DEFAULT_TS = '2026-05-01T00:00:00.000Z';
const DEFAULT_SESSION_ID = 'sess-test';

/**
 * Build a Message with sane defaults plus per-call overrides.
 * @param overrides Partial fields to merge into the default Message shape.
 * @param defaultKind Fallback `kind` when overrides.kind is absent.
 *                    Different test suites prefer different defaults
 *                    (`reducer/` uses `goal`, `scorer/` uses `note`).
 */
export function fixedMessage(
  overrides: Partial<Message> = {},
  defaultKind: Kind = 'goal',
): Message {
  return {
    id: DEFAULT_ID,
    ts: DEFAULT_TS,
    session_id: DEFAULT_SESSION_ID,
    from: 'user',
    kind: defaultKind,
    ...overrides,
  };
}
