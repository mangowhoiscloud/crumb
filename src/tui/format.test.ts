import { describe, expect, it } from 'vitest';

import type { Message } from '../protocol/types.js';
import { initialState } from '../state/types.js';

import { formatActorList, formatRow, formatStatus } from './format.js';

const T0 = Date.parse('2026-05-02T12:00:00.000Z');

const judgeScore: Message = {
  id: '01J',
  ts: '2026-05-02T12:03:15.000Z',
  session_id: 'sess',
  from: 'verifier',
  kind: 'judge.score',
  scores: { aggregate: 27, verdict: 'PASS' },
  metadata: {
    harness: 'gemini-cli',
    model: 'gemini-3-1-pro',
    cost_usd: 0.08,
    tokens_in: 4000,
    cache_read: 3000,
    cross_provider: true,
  },
};

const qaResult: Message = {
  id: '01Q',
  ts: '2026-05-02T12:02:30.000Z',
  session_id: 'sess',
  from: 'system',
  kind: 'qa.result',
  data: { lint_passed: true, exec_exit_code: 0, phaser_loaded: true },
  metadata: { deterministic: true, tool: 'qa-check-effect@v1' },
};

describe('formatRow', () => {
  it('uses actor color tag', () => {
    const row = formatRow(judgeScore, T0);
    expect(row).toContain('{yellow-fg}'); // verifier = yellow tag (orange equivalent)
    expect(row).toContain('verifier');
  });

  it('shows ★ for deterministic events', () => {
    const row = formatRow(qaResult, T0);
    expect(row).toContain('★');
  });

  it('shows ⚠ for cross_provider=false', () => {
    const same = { ...judgeScore, metadata: { ...judgeScore.metadata, cross_provider: false } };
    const row = formatRow(same, T0);
    expect(row).toContain('⚠');
  });

  it('shows ! for audit_violations', () => {
    const audit = {
      ...judgeScore,
      metadata: { ...judgeScore.metadata, audit_violations: ['verifier_overrode_d2'] },
    };
    const row = formatRow(audit, T0);
    expect(row).toContain('{red-fg}!{/}');
  });

  it('summarizes qa.result data when no body', () => {
    const row = formatRow(qaResult, T0);
    expect(row).toContain('lint=true');
    expect(row).toContain('exit=0');
  });

  it('truncates long bodies', () => {
    const long = { ...qaResult, body: 'x'.repeat(200) };
    const row = formatRow(long, T0);
    // 80 char body cap
    expect(row.length).toBeLessThan(300);
  });

  it('elapsed time formatted as mm:ss', () => {
    const row = formatRow(judgeScore, T0);
    expect(row).toMatch(/\[03:15\]/);
  });
});

describe('formatStatus', () => {
  it('renders cost / cache / wall / verdict', () => {
    const state = initialState('sess');
    state.progress_ledger.score_history = [{ msg_id: '01J', aggregate: 27, verdict: 'PASS' }];
    const out = formatStatus(state, [qaResult, judgeScore]);
    expect(out).toContain('Cost');
    expect(out).toContain('$0.080');
    expect(out).toContain('Cache');
    expect(out).toContain('75%'); // 3000/4000
    expect(out).toContain('PASS');
  });

  it('handles empty transcript', () => {
    const state = initialState('sess');
    const out = formatStatus(state, []);
    expect(out).toContain('Cost');
    expect(out).toContain('—'); // verdict placeholder
  });
});

describe('formatActorList', () => {
  it('lists actors with harness/model', () => {
    const lines = formatActorList([judgeScore, qaResult]);
    expect(lines).toHaveLength(1); // qaResult is system → skipped
    expect(lines[0]).toContain('verifier');
    expect(lines[0]).toContain('gemini-cli/gemini-3-1-pro');
  });
});
