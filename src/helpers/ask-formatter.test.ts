/**
 * ask-formatter — unit tests for the v0.5 Tier 2 deterministic state-snapshot
 * formatter. Reducer routes `/ask <enum>` (lands as `user.intervene` with
 * `data.ask=<enum>`) through this helper. Per the helper docstring, output
 * is a pure function of (CrumbState, Message) — no I/O, no time, no randomness
 * (besides reading source.ts which is the inbox event's stamped timestamp).
 *
 * Replay-determinism is the load-bearing invariant tested here: same input →
 * same output, every dispatch.
 */

import { describe, expect, it } from 'vitest';

import { initialState } from '../state/types.js';
import {
  buildAskResponseDraft,
  formatAskResponse,
  isAskQuery,
  type AskQuery,
} from './ask-formatter.js';
import type { Message } from '../protocol/types.js';

const FIXED_TS = '2026-05-04T03:00:00.000Z';

function makeState(): ReturnType<typeof initialState> {
  return initialState('sess-test');
}

function makeAskMessage(query: string): Message {
  return {
    id: '01H0000000000000000000ASK1',
    ts: FIXED_TS,
    session_id: 'sess-test',
    from: 'user',
    kind: 'user.intervene',
    body: `/ask ${query}`,
    data: { ask: query },
  };
}

describe('isAskQuery', () => {
  it('accepts the 5 canned enum values exactly', () => {
    for (const q of ['status', 'cost', 'next', 'stuck', 'scorecard']) {
      expect(isAskQuery(q)).toBe(true);
    }
  });

  it('rejects unknown / typo values', () => {
    for (const q of ['STATUS', 'helpme', '', 'health', null, 42, undefined]) {
      expect(isAskQuery(q)).toBe(false);
    }
  });
});

describe('formatAskResponse', () => {
  it('status — fresh state reports "no events yet" + idle next_speaker', () => {
    const out = formatAskResponse(makeState(), 'status', FIXED_TS);
    expect(out).toContain('session');
    expect(out).toContain('last=no events yet');
    expect(out).toContain('next=(idle)');
    expect(out).toContain('last_active=(none)');
  });

  it('status — populated state reports last/next/active fields', () => {
    const s = makeState();
    s.progress_ledger.session_started_at = '2026-05-04T02:50:00.000Z';
    s.progress_ledger.next_speaker = 'verifier';
    s.progress_ledger.last_active_actor = 'builder';
    s.last_message = {
      id: '01H0000000000000000000LAST',
      ts: FIXED_TS,
      session_id: 'sess-test',
      from: 'builder',
      kind: 'build',
      body: 'multi-file PWA emitted',
    };
    const out = formatAskResponse(s, 'status', FIXED_TS);
    expect(out).toContain('session 10m');
    expect(out).toContain('builder/build');
    expect(out).toContain('next=verifier');
    expect(out).toContain('last_active=builder');
  });

  it('status — done flag surfaces [DONE] tag', () => {
    const s = makeState();
    s.done = true;
    s.progress_ledger.session_started_at = FIXED_TS;
    const out = formatAskResponse(s, 'status', FIXED_TS);
    expect(out).toContain('[DONE]');
  });

  it('cost — reports cumulative tokens + last model', () => {
    const s = makeState();
    s.progress_ledger.session_token_total = 12_345;
    s.last_message = {
      id: '01H0000000000000000000COST',
      ts: FIXED_TS,
      session_id: 'sess-test',
      from: 'builder',
      kind: 'build',
      metadata: { model: 'claude-opus-4-7' },
    };
    const out = formatAskResponse(s, 'cost', FIXED_TS);
    expect(out).toContain('tokens cum=12.3k');
    expect(out).toContain('claude-opus-4-7');
  });

  it('next — idle state reports "idle (no spawn queued)"', () => {
    const out = formatAskResponse(makeState(), 'next', FIXED_TS);
    expect(out).toBe('next: idle (no spawn queued)');
  });

  it('next — populated state names the next_speaker + trigger', () => {
    const s = makeState();
    s.progress_ledger.next_speaker = 'builder';
    s.last_message = {
      id: '01H0000000000000000000SPEC',
      ts: FIXED_TS,
      session_id: 'sess-test',
      from: 'planner-lead',
      kind: 'spec',
    };
    const out = formatAskResponse(s, 'next', FIXED_TS);
    expect(out).toContain('next: builder');
    expect(out).toContain('triggered by planner-lead/spec');
  });

  it('stuck — clean state reports stuck=0/5 + (all closed)', () => {
    const out = formatAskResponse(makeState(), 'stuck', FIXED_TS);
    expect(out).toContain('stuck=0/5');
    expect(out).toContain('(all closed)');
  });

  it('stuck — open breakers and elevated stuck_count surface', () => {
    const s = makeState();
    s.progress_ledger.stuck_count = 3;
    s.progress_ledger.circuit_breaker = {
      builder: { state: 'OPEN', consecutive_failures: 3 },
    };
    const out = formatAskResponse(s, 'stuck', FIXED_TS);
    expect(out).toContain('stuck=3/5');
    expect(out).toContain('builder=OPEN');
  });

  it('scorecard — empty history reports "no judge.score yet"', () => {
    const out = formatAskResponse(makeState(), 'scorecard', FIXED_TS);
    expect(out).toBe('no judge.score yet');
  });

  it('scorecard — populated history reports latest aggregate + verdict', () => {
    const s = makeState();
    s.progress_ledger.score_history = [
      { msg_id: '01H0000000000000000000FAIL', aggregate: 12, verdict: 'FAIL' },
      { msg_id: '01H0000000000000000000PASS', aggregate: 26, verdict: 'PASS' },
    ];
    const out = formatAskResponse(s, 'scorecard', FIXED_TS);
    expect(out).toContain('aggregate=26');
    expect(out).toContain('verdict=PASS');
    expect(out).toContain('history=2');
  });

  it('replay determinism — same (state, query, ts) produces identical output', () => {
    const s = makeState();
    s.progress_ledger.session_started_at = '2026-05-04T02:50:00.000Z';
    s.progress_ledger.session_token_total = 10_000;
    const queries: AskQuery[] = ['status', 'cost', 'next', 'stuck', 'scorecard'];
    for (const q of queries) {
      const a = formatAskResponse(s, q, FIXED_TS);
      const b = formatAskResponse(s, q, FIXED_TS);
      expect(a).toBe(b);
    }
  });
});

describe('buildAskResponseDraft', () => {
  it('returns null when source has no data.ask field', () => {
    const ev: Message = {
      id: '01H0000000000000000000NOPE',
      ts: FIXED_TS,
      session_id: 'sess-test',
      from: 'user',
      kind: 'user.intervene',
      body: 'plain text',
    };
    expect(buildAskResponseDraft(makeState(), ev)).toBeNull();
  });

  it('returns null when data.ask is not in the canned enum', () => {
    const ev = makeAskMessage('not-a-real-query');
    expect(buildAskResponseDraft(makeState(), ev)).toBeNull();
  });

  it('builds a kind=note draft with metadata.in_reply_to=<source.id>', () => {
    const ev = makeAskMessage('status');
    const draft = buildAskResponseDraft(makeState(), ev);
    expect(draft).not.toBeNull();
    expect(draft).toMatchObject({
      kind: 'note',
      from: 'system',
      metadata: {
        deterministic: true,
        tool: 'ask-formatter@v1',
        in_reply_to: ev.id,
        visibility: 'public',
      },
    });
    expect(typeof draft!.body).toBe('string');
    expect(draft!.body.length).toBeGreaterThan(0);
  });

  it('every canned enum produces a non-empty body', () => {
    for (const q of ['status', 'cost', 'next', 'stuck', 'scorecard']) {
      const draft = buildAskResponseDraft(makeState(), makeAskMessage(q));
      expect(draft).not.toBeNull();
      expect(draft!.body.length).toBeGreaterThan(0);
    }
  });
});
