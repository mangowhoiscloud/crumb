/**
 * Pause/Resume lifecycle smoke test for `crumb doctor --self-check`.
 *
 * Drives the reducer through pause + resume transitions (global + per-actor)
 * synthetically — no real adapter, no subprocess, no transcript file write.
 * Catches regressions where a fresh-machine setup ships a broken reducer
 * (missing TS compile, broken state machine, schema drift after a Prune-N
 * merge). The QA agent calls this to verify Studio + reducer pause/resume
 * works on the user's machine before quoting a session.
 *
 * Backed by `wiki/synthesis/bagelcode-studio-big-bang-update-2026-05-03.md`
 * §6.8 "Pause/Resume portability self-check" + §11.4 LLM hygiene rule.
 */

import { reduce } from '../reducer/index.js';
import { initialState } from '../state/types.js';
import type { Message } from '../protocol/types.js';

export type SelfCheckVerdict = 'ok' | 'degraded' | 'broken';

export interface SelfCheckStep {
  step: string;
  status: 'pass' | 'fail';
  detail?: string;
}

export interface SelfCheckReport {
  pause_resume_lifecycle: SelfCheckVerdict;
  duration_ms: number;
  steps: SelfCheckStep[];
}

/** Synthetic message factory — deterministic IDs (no ULID generation needed
 * because no transcript persistence). */
function syntheticMsg(
  id: string,
  kind: Message['kind'],
  from: Message['from'],
  extra: Partial<Message> = {},
): Message {
  return {
    id,
    ts: '2026-05-03T00:00:00.000Z',
    session_id: 'self-check',
    from,
    kind,
    ...extra,
  } as Message;
}

/**
 * Drive the reducer through the pause/resume lifecycle and report whether
 * each documented transition produced the documented state. Returns a
 * structured verdict + per-step trace. Pure: no I/O, no file writes.
 */
export function runSelfCheck(): SelfCheckReport {
  const t0 = Date.now();
  const steps: SelfCheckStep[] = [];
  let broken = false;

  function check(name: string, predicate: () => true | string): void {
    try {
      const result = predicate();
      if (result === true) {
        steps.push({ step: name, status: 'pass' });
      } else {
        steps.push({ step: name, status: 'fail', detail: result });
        broken = true;
      }
    } catch (err) {
      steps.push({ step: name, status: 'fail', detail: (err as Error).message });
      broken = true;
    }
  }

  let state = initialState('self-check');

  check('initial paused === false', () =>
    state.progress_ledger.paused === false
      ? true
      : `expected false, got ${state.progress_ledger.paused}`,
  );
  check('initial paused_actors is empty', () =>
    state.progress_ledger.paused_actors.length === 0
      ? true
      : `expected [], got [${state.progress_ledger.paused_actors.join(',')}]`,
  );

  // Global pause
  let r = reduce(
    state,
    syntheticMsg('01SELFCHECK000000PAUSEGLOBAL', 'user.pause', 'user', {
      body: 'self-check global pause',
    }),
  );
  state = r.state;
  check('user.pause (global) → paused === true', () =>
    state.progress_ledger.paused === true
      ? true
      : `expected true, got ${state.progress_ledger.paused}`,
  );
  check('user.pause (global) emits a hook effect', () =>
    r.effects.some((e) => e.type === 'hook') ? true : 'no hook effect emitted',
  );

  // Global resume
  r = reduce(state, syntheticMsg('01SELFCHECK000000RESUMEGLOBAL', 'user.resume', 'user'));
  state = r.state;
  check('user.resume (global) → paused === false', () =>
    state.progress_ledger.paused === false
      ? true
      : `expected false, got ${state.progress_ledger.paused}`,
  );

  // Per-actor pause
  r = reduce(
    state,
    syntheticMsg('01SELFCHECK000000PAUSEBUILDER', 'user.pause', 'user', {
      data: { actor: 'builder' } as Message['data'],
      body: 'self-check builder pause',
    }),
  );
  state = r.state;
  check('user.pause (builder) → paused_actors contains builder', () =>
    state.progress_ledger.paused_actors.includes('builder')
      ? true
      : `paused_actors=[${state.progress_ledger.paused_actors.join(',')}]`,
  );
  check('user.pause (builder) does NOT set global paused', () =>
    state.progress_ledger.paused === false
      ? true
      : `global paused leaked to true on per-actor pause`,
  );

  // Per-actor resume
  r = reduce(
    state,
    syntheticMsg('01SELFCHECK000000RESUMEBUILDER', 'user.resume', 'user', {
      data: { actor: 'builder' } as Message['data'],
    }),
  );
  state = r.state;
  check('user.resume (builder) → paused_actors empty', () =>
    state.progress_ledger.paused_actors.length === 0
      ? true
      : `paused_actors=[${state.progress_ledger.paused_actors.join(',')}]`,
  );

  // Idempotency — pausing twice doesn't duplicate
  r = reduce(
    state,
    syntheticMsg('01SELFCHECK000000PAUSEBUILDER2', 'user.pause', 'user', {
      data: { actor: 'verifier' } as Message['data'],
    }),
  );
  state = r.state;
  r = reduce(
    state,
    syntheticMsg('01SELFCHECK000000PAUSEBUILDER3', 'user.pause', 'user', {
      data: { actor: 'verifier' } as Message['data'],
    }),
  );
  state = r.state;
  check('user.pause (verifier) idempotent — paused_actors length === 1', () =>
    state.progress_ledger.paused_actors.length === 1
      ? true
      : `expected length=1, got ${state.progress_ledger.paused_actors.length}`,
  );

  return {
    pause_resume_lifecycle: broken ? 'broken' : 'ok',
    duration_ms: Date.now() - t0,
    steps,
  };
}

export function formatSelfCheckReport(report: SelfCheckReport): string {
  const verdictGlyph = {
    ok: '✅',
    degraded: '⚠️',
    broken: '❌',
  }[report.pause_resume_lifecycle];
  const lines = [
    `${verdictGlyph} pause/resume lifecycle: ${report.pause_resume_lifecycle} (${report.duration_ms}ms)`,
    '',
    ...report.steps.map((s) => {
      const sym = s.status === 'pass' ? '  ✓' : '  ✗';
      const detail = s.detail ? ` — ${s.detail}` : '';
      return `${sym} ${s.step}${detail}`;
    }),
  ];
  return lines.join('\n');
}
