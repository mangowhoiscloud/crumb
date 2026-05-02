import { describe, expect, it } from 'vitest';

import type { Message } from '../protocol/types.js';
import { initialState } from '../state/types.js';

import { renderSummary } from './render.js';

function fixture(): { transcript: Message[]; state: ReturnType<typeof initialState> } {
  const state = initialState('01J9X4SESSION');
  state.task_ledger.goal = '60초 고양이 매치-3 콤보';
  state.task_ledger.artifacts = [
    { path: 'artifacts/game.html', sha256: 'ab12cd34ef56789012345678' },
    { path: 'artifacts/spec.md', sha256: 'feedfacefeedface00000000' },
  ];
  const transcript: Message[] = [
    {
      id: '01J9X4A',
      ts: '2026-05-02T12:00:00.000Z',
      session_id: '01J9X4SESSION',
      from: 'user',
      kind: 'goal',
      body: '60초 고양이 매치-3',
    },
    {
      id: '01J9X4B',
      ts: '2026-05-02T12:01:00.000Z',
      session_id: '01J9X4SESSION',
      from: 'planner-lead',
      kind: 'spec',
      body: '## Spec\n- 7×7 grid\n- combo multiplier 1.5×',
      metadata: { tokens_in: 2000, tokens_out: 800, cache_read: 1500, cost_usd: 0.05 },
    },
    {
      id: '01J9X4C',
      ts: '2026-05-02T12:02:00.000Z',
      session_id: '01J9X4SESSION',
      from: 'builder',
      kind: 'build',
      body: 'game.html generated (320 LOC)',
      metadata: { tokens_in: 5000, tokens_out: 3000, cache_read: 3500, cost_usd: 0.12 },
    },
    {
      id: '01J9X4QA',
      ts: '2026-05-02T12:02:30.000Z',
      session_id: '01J9X4SESSION',
      from: 'system',
      kind: 'qa.result',
      data: { lint_passed: true, exec_exit_code: 0, phaser_loaded: true, first_interaction: 'ok' },
      metadata: { deterministic: true, tool: 'qa-check-effect@v1' },
    },
    {
      id: '01J9X4G',
      ts: '2026-05-02T12:03:00.000Z',
      session_id: '01J9X4SESSION',
      from: 'verifier',
      kind: 'step.judge',
      step: 'grader',
      body: 'initial grade 24/30 — palette + UX OK',
    },
    {
      id: '01J9X4J',
      ts: '2026-05-02T12:03:15.000Z',
      session_id: '01J9X4SESSION',
      from: 'verifier',
      kind: 'judge.score',
      scores: {
        D1: { score: 4.5, source: 'verifier-llm' },
        D2: { score: 5.0, source: 'qa-check-effect', lookup: 'qa.result.exec_exit_code' },
        D3: { score: 4.0, source: 'verifier-llm', semantic: 4.0 },
        D4: { score: 5.0, source: 'reducer-auto' },
        D5: { score: 4.0, source: 'verifier-llm' },
        D6: { score: 4.5, source: 'qa-check-effect' },
        aggregate: 27.0,
        verdict: 'PASS',
        courteval: { grader_msg_id: '01J9X4G' },
        audit_violations: [],
      },
      metadata: {
        harness: 'gemini-cli',
        provider: 'google',
        model: 'gemini-2.5-pro',
        cross_provider: true,
        tokens_in: 4000,
        tokens_out: 1500,
        cache_read: 3000,
        cost_usd: 0.08,
      },
    },
    {
      id: '01J9X4Z',
      ts: '2026-05-02T12:03:30.000Z',
      session_id: '01J9X4SESSION',
      from: 'system',
      kind: 'done',
      body: 'session done',
    },
  ];
  return { transcript, state };
}

describe('renderSummary', () => {
  it('produces a valid HTML doc with all 5 sections', () => {
    const { transcript, state } = fixture();
    const html = renderSummary(transcript, state, { presetName: 'bagelcode-cross-3way' });
    expect(html).toMatch(/<!DOCTYPE html>/);
    expect(html).toContain('id="artifacts"');
    expect(html).toContain('id="scorecard"');
    expect(html).toContain('id="cost"');
    expect(html).toContain('id="courteval"');
    expect(html).toContain('id="timeline"');
  });

  it('surfaces verdict pill and aggregate', () => {
    const { transcript, state } = fixture();
    const html = renderSummary(transcript, state);
    expect(html).toContain('PASS');
    expect(html).toContain('27.0');
  });

  it('renders cross_provider badge when set', () => {
    const { transcript, state } = fixture();
    const html = renderSummary(transcript, state);
    expect(html).toContain('cross-provider ok');
  });

  it('marks deterministic events with ★', () => {
    const { transcript, state } = fixture();
    const html = renderSummary(transcript, state);
    expect(html).toContain('deterministic-star');
  });

  it('renders D1-D6 scorecard rows with source badges', () => {
    const { transcript, state } = fixture();
    const html = renderSummary(transcript, state);
    expect(html).toContain('source-llm');
    expect(html).toContain('source-qa-check');
    expect(html).toContain('source-reducer');
    expect(html).toContain('qa.result.exec_exit_code');
  });

  it('escapes HTML in user-supplied body', () => {
    const { transcript, state } = fixture();
    transcript[0]!.body = '<script>alert(1)</script>';
    const html = renderSummary(transcript, state);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('falls back to autoScore when verifier did not emit a dim', () => {
    const { transcript, state } = fixture();
    const judgeIdx = transcript.findIndex((m) => m.kind === 'judge.score');
    transcript[judgeIdx]!.scores = { aggregate: 0, verdict: 'PARTIAL' };
    const html = renderSummary(transcript, state);
    expect(html).toContain('reducer-auto');
  });

  it('handles empty transcript without throwing', () => {
    const empty: Message[] = [];
    const state = initialState('empty');
    expect(() => renderSummary(empty, state)).not.toThrow();
  });

  it('iframe references game.html artifact', () => {
    const { transcript, state } = fixture();
    const html = renderSummary(transcript, state);
    expect(html).toContain('artifacts/game.html');
    expect(html).toContain('iframe');
  });

  it('CourtEval section finds grader_msg_id event', () => {
    const { transcript, state } = fixture();
    const html = renderSummary(transcript, state);
    expect(html).toContain('initial grade 24/30');
    expect(html).toContain('grader');
  });

  it('W5: Fault diagnosis section reports F1-F7 status', () => {
    const { transcript, state } = fixture();
    const html = renderSummary(transcript, state);
    expect(html).toContain('id="faults"');
    expect(html).toContain('F1');
    expect(html).toContain('F7');
    // clean fixture: cross_provider=true → no F5
    expect(html).toContain('CLEAR');
  });

  it('W5: detects F5 self-bias when cross_provider=false', () => {
    const { transcript, state } = fixture();
    const judge = transcript.find((m) => m.kind === 'judge.score')!;
    judge.metadata!.cross_provider = false;
    const html = renderSummary(transcript, state);
    expect(html).toMatch(/1 detected/);
    expect(html).toContain('self-bias');
  });

  it('W6: score-history sparkline appears when ≥2 judgments', () => {
    const { transcript, state } = fixture();
    state.progress_ledger.score_history = [
      { msg_id: 'a', aggregate: 18, verdict: 'PARTIAL' },
      { msg_id: 'b', aggregate: 27, verdict: 'PASS' },
    ];
    const html = renderSummary(transcript, state);
    expect(html).toContain('<svg');
    expect(html).toContain('polyline');
    expect(html).toContain('18.0 → 27.0');
  });

  it('W6: stuck pill colored by count', () => {
    const { transcript, state } = fixture();
    state.progress_ledger.stuck_count = 3;
    const html = renderSummary(transcript, state);
    expect(html).toContain('3/5');
    expect(html).toContain('pill warn');
  });

  it('W4: tool.call surfaces sandbox cwd / add_dir / permission', () => {
    const { transcript, state } = fixture();
    transcript.push({
      id: '01J9X4TC',
      ts: '2026-05-02T12:02:45.000Z',
      session_id: state.session_id,
      from: 'builder',
      kind: 'tool.call',
      body: 'edit game.html',
      data: { cwd: 'sessions/abc', add_dir: '/source', permission_mode: 'workspace-write' },
    });
    const html = renderSummary(transcript, state);
    expect(html).toContain('cwd:');
    expect(html).toContain('add_dir:');
    expect(html).toContain('workspace-write');
  });
});
