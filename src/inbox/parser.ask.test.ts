/**
 * /ask <enum> grammar — v0.5 PR-Inbox-Console Tier 2.
 *
 * The inbox parser routes `/ask <query>` into a `kind=user.intervene`
 * with `data.ask=<query>` (when query ∈ canned enum) or
 * `data.ask_invalid=<query>` (otherwise). Reducer's pre-switch ack
 * hoist still emits Tier 1 ack regardless; the formatter helper
 * (src/helpers/ask-formatter.ts) reads `data.ask` to produce the Tier 2
 * `kind=note` reply.
 *
 * The enum gate prevents the formatter from running on free-form
 * questions — those would need an LLM (option C, explicitly excluded
 * from v0.5 per the research).
 */

import { describe, expect, it } from 'vitest';

import { parseInboxLine } from './parser.js';

describe('parseInboxLine — /ask <enum>', () => {
  it.each(['status', 'cost', 'next', 'stuck', 'scorecard'])(
    'accepts /ask %s — sets data.ask',
    (q) => {
      const draft = parseInboxLine(`/ask ${q}`, 'sess-1');
      expect(draft).not.toBeNull();
      expect(draft?.kind).toBe('user.intervene');
      expect(draft?.body).toBe(`/ask ${q}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((draft as any)?.data?.ask).toBe(q);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((draft as any)?.data?.ask_invalid).toBeUndefined();
    },
  );

  it('case-insensitive on the query word', () => {
    const draft = parseInboxLine('/ask STATUS', 'sess-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((draft as any)?.data?.ask).toBe('status');
  });

  it('out-of-enum query falls through to data.ask_invalid (still emits ack)', () => {
    const draft = parseInboxLine('/ask whatever', 'sess-1');
    expect(draft?.kind).toBe('user.intervene');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((draft as any)?.data?.ask).toBeUndefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((draft as any)?.data?.ask_invalid).toBe('whatever');
  });

  it('empty /ask (no query word) routes to data.ask_invalid="(empty)"', () => {
    const draft = parseInboxLine('/ask', 'sess-1');
    expect(draft?.kind).toBe('user.intervene');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((draft as any)?.data?.ask_invalid).toBe('(empty)');
  });

  it('extra whitespace / trailing args — only the first word is the query', () => {
    const draft = parseInboxLine('/ask   stuck   please', 'sess-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((draft as any)?.data?.ask).toBe('stuck');
  });

  it('partial match ("stat") does not pass the enum gate', () => {
    const draft = parseInboxLine('/ask stat', 'sess-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((draft as any)?.data?.ask).toBeUndefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((draft as any)?.data?.ask_invalid).toBe('stat');
  });
});
