import { describe, expect, it } from 'vitest';

import { parseInboxLine } from './parser.js';

const SID = 'sess-test';

describe('inbox parser', () => {
  // Blank / comment

  it('returns null on blank lines and comments', () => {
    expect(parseInboxLine('', SID)).toBeNull();
    expect(parseInboxLine('   ', SID)).toBeNull();
    expect(parseInboxLine('# comment', SID)).toBeNull();
  });

  // Free text

  it('plain text becomes user.intervene with body', () => {
    const m = parseInboxLine('use only red/green palette', SID);
    expect(m).toMatchObject({
      from: 'user',
      kind: 'user.intervene',
      body: 'use only red/green palette',
    });
    expect(m?.data).toBeUndefined();
  });

  // @<actor> targeting

  it('@<actor> <body> becomes user.intervene with target_actor', () => {
    const m = parseInboxLine('@planner-lead 콤보 보너스 짧게', SID);
    expect(m).toMatchObject({
      from: 'user',
      kind: 'user.intervene',
      body: '콤보 보너스 짧게',
      data: { target_actor: 'planner-lead' },
    });
  });

  it('@<unknown-actor> falls through to free text', () => {
    const m = parseInboxLine('@nobody hello', SID);
    expect(m).toMatchObject({ kind: 'user.intervene', body: '@nobody hello' });
    expect(m?.data).toBeUndefined();
  });

  // /pause /resume

  it('/pause without args becomes global pause', () => {
    const m = parseInboxLine('/pause', SID);
    expect(m).toMatchObject({ kind: 'user.pause' });
    expect(m?.data).toBeUndefined();
  });

  it('/pause @<actor> becomes per-actor pause', () => {
    const m = parseInboxLine('/pause @builder', SID);
    expect(m).toMatchObject({
      kind: 'user.pause',
      data: { actor: 'builder' },
    });
  });

  it('/pause @<actor> reason carries body', () => {
    const m = parseInboxLine('/pause @verifier waiting on screenshot', SID);
    expect(m).toMatchObject({
      kind: 'user.pause',
      body: 'waiting on screenshot',
      data: { actor: 'verifier' },
    });
  });

  it('/resume without args clears global', () => {
    const m = parseInboxLine('/resume', SID);
    expect(m).toMatchObject({ kind: 'user.resume' });
    expect(m?.data).toBeUndefined();
  });

  it('/resume @<actor> clears one actor', () => {
    const m = parseInboxLine('/resume @builder', SID);
    expect(m).toMatchObject({
      kind: 'user.resume',
      data: { actor: 'builder' },
    });
  });

  // /approve /veto

  it('/approve becomes user.approve', () => {
    const m = parseInboxLine('/approve', SID);
    expect(m).toMatchObject({ kind: 'user.approve' });
  });

  it('/veto <id> carries the message id', () => {
    const m = parseInboxLine('/veto 01J0000ABC', SID);
    expect(m).toMatchObject({
      kind: 'user.veto',
      data: { target_msg_id: '01J0000ABC' },
    });
  });

  // /goto /swap /reset-circuit

  it('/goto <actor> body forces routing', () => {
    const m = parseInboxLine('/goto planner-lead redo from spec', SID);
    expect(m).toMatchObject({
      kind: 'user.intervene',
      body: 'redo from spec',
      data: { goto: 'planner-lead' },
    });
  });

  it('/goto <unknown> returns null', () => {
    expect(parseInboxLine('/goto nobody hi', SID)).toBeNull();
  });

  it('/swap <from>=<adapter> writes adapter override', () => {
    const m = parseInboxLine('/swap builder=mock', SID);
    expect(m).toMatchObject({
      kind: 'user.intervene',
      data: { swap: { from: 'builder', to: 'mock' } },
    });
  });

  it('/reset-circuit <actor> targets one actor', () => {
    const m = parseInboxLine('/reset-circuit builder', SID);
    expect(m).toMatchObject({
      kind: 'user.intervene',
      data: { reset_circuit: 'builder' },
    });
  });

  it('/reset-circuit all clears every breaker', () => {
    const m = parseInboxLine('/reset-circuit all', SID);
    expect(m).toMatchObject({
      kind: 'user.intervene',
      data: { reset_circuit: true },
    });
  });

  // /append (v0.2.0 G4 — sandwich override)

  it('/append <text> writes broadcast sandwich_append (no target_actor)', () => {
    const m = parseInboxLine('/append always emit kind=note before kind=verify.result', SID);
    expect(m).toMatchObject({
      kind: 'user.intervene',
      data: { sandwich_append: 'always emit kind=note before kind=verify.result' },
    });
    expect(m?.data?.target_actor).toBeUndefined();
  });

  it('/append @<actor> <text> scopes the append to that actor', () => {
    const m = parseInboxLine('/append @builder use phaser 3.80 only', SID);
    expect(m).toMatchObject({
      kind: 'user.intervene',
      data: { target_actor: 'builder', sandwich_append: 'use phaser 3.80 only' },
    });
    expect(m?.body).toBeUndefined();
  });

  it('/append with empty body returns null (no-op)', () => {
    expect(parseInboxLine('/append', SID)).toBeNull();
    expect(parseInboxLine('/append   ', SID)).toBeNull();
  });

  it('/append @<unknown-actor> falls through to broadcast append (literal text)', () => {
    const m = parseInboxLine('/append @nobody do thing', SID);
    expect(m).toMatchObject({
      kind: 'user.intervene',
      data: { sandwich_append: '@nobody do thing' },
    });
    expect(m?.data?.target_actor).toBeUndefined();
  });

  // /note (free-form annotation, kind=note)

  it('/note <text> becomes kind=note with body', () => {
    const m = parseInboxLine('/note watching for cache hit ratio', SID);
    expect(m).toMatchObject({
      from: 'user',
      kind: 'note',
      body: 'watching for cache hit ratio',
    });
    expect(m?.data).toBeUndefined();
  });

  it('/note with empty body returns null', () => {
    expect(parseInboxLine('/note', SID)).toBeNull();
  });

  // /redo (alias for free-text user.intervene)

  it('/redo <body> aliases free-text user.intervene', () => {
    const m = parseInboxLine('/redo fix the score formula', SID);
    expect(m).toMatchObject({
      kind: 'user.intervene',
      body: 'fix the score formula',
    });
    expect(m?.data).toBeUndefined();
  });

  it('/redo without args still emits user.intervene (no body)', () => {
    const m = parseInboxLine('/redo', SID);
    expect(m).toMatchObject({ kind: 'user.intervene' });
    expect(m?.body).toBeUndefined();
  });

  // Unknown slash

  it('unknown slash command falls through to user.intervene with original line', () => {
    const m = parseInboxLine('/unknown some args', SID);
    expect(m).toMatchObject({
      kind: 'user.intervene',
      body: '/unknown some args',
    });
  });
});
