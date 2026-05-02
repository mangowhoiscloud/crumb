/**
 * /crumb suggest — next-action recommendation for the user.
 *
 * Looks at last_message + score_history + stuck_count and emits a ranked list of
 * suggested user actions (approve / veto / redo / pause / wait / done).
 *
 * Read-only. Does not append to transcript itself — caller emits kind=note if desired.
 */

import type { Message } from '../protocol/types.js';
import type { CrumbState } from '../state/types.js';

export interface SuggestionItem {
  action: string;
  rationale: string;
  /** CLI form to invoke. */
  command?: string;
  /** Higher = more likely. */
  weight: number;
}

export interface SuggestionResult {
  primary: SuggestionItem;
  alternatives: SuggestionItem[];
  context: string;
}

const STUCK_THRESHOLD = 5;

export function suggestNext(transcript: Message[], state: CrumbState): SuggestionResult {
  const last = transcript[transcript.length - 1];
  const stuck = state.progress_ledger.stuck_count;
  const lastScore =
    state.progress_ledger.score_history[state.progress_ledger.score_history.length - 1];

  // Done → "open summary" wins regardless of last event.
  if (state.done) {
    return {
      primary: {
        action: 'open summary.html',
        rationale: 'session 종료. 평가용 산출물 확인.',
        command: 'open sessions/<id>/index.html',
        weight: 1.0,
      },
      alternatives: [
        {
          action: '/crumb export <id>',
          rationale: 'OTel / chrome-trace 형식으로 외부 platform 으로',
          command: 'crumb export <id> --format otel-jsonl',
          weight: 0.5,
        },
      ],
      context: 'session done',
    };
  }

  // Stuck → /pause + investigate is highest priority.
  if (stuck >= STUCK_THRESHOLD) {
    return {
      primary: {
        action: '/pause + investigate',
        rationale: `stuck_count=${stuck} (≥${STUCK_THRESHOLD}) — 무한 루프 감지. session 멈추고 transcript 살핀 후 재개.`,
        command: 'crumb event --kind user.pause',
        weight: 1.0,
      },
      alternatives: [
        {
          action: '/crumb debug',
          rationale: 'F1-F7 fault matrix 진단으로 stuck 원인 식별',
          command: 'crumb debug <session-id>',
          weight: 0.9,
        },
        {
          action: '/veto last build',
          rationale: 'builder 가 같은 결과 반복하면 명시 거부로 회귀 강제',
          command: 'crumb event --kind user.veto',
          weight: 0.6,
        },
      ],
      context: `last=${last?.kind ?? '?'} from=${last?.from ?? '?'} stuck=${stuck}/5`,
    };
  }

  // Last is judge.score → branch on verdict + audit.
  if (last?.kind === 'judge.score') {
    const verdict = last.scores?.verdict;
    const audit = last.scores?.audit_violations ?? last.metadata?.audit_violations ?? [];
    const cp = last.metadata?.cross_provider;

    if (verdict === 'PASS' && audit.length === 0) {
      return {
        primary: {
          action: '/approve',
          rationale: `verdict=PASS · audit_violations=[] · cross_provider=${cp ? '✓' : '⚠'} · aggregate=${lastScore?.aggregate.toFixed(1) ?? '—'}/30. 그대로 done 으로 종결.`,
          command: 'crumb event --kind user.approve',
          weight: 1.0,
        },
        alternatives: [
          {
            action: 'open game.html',
            rationale: '산출물 확인 후 명시 승인',
            command: 'open sessions/<id>/artifacts/game.html',
            weight: 0.9,
          },
          {
            action: '/redo (강한 검증)',
            rationale: '추가 verifier round 원하면',
            command: 'crumb event --kind user.intervene --body "rerun verifier"',
            weight: 0.3,
          },
        ],
        context: `verdict=PASS · cross_provider=${cp ? '✓' : '⚠'}`,
      };
    }
    if (verdict === 'PARTIAL') {
      return {
        primary: {
          action: '/redo or /approve (사용자 판단)',
          rationale: `verdict=PARTIAL · aggregate=${lastScore?.aggregate.toFixed(1) ?? '—'}/30. 산출물 검토 후 그대로 승인 OR 한 번 더 회귀.`,
          command: 'crumb event --kind user.approve  # 또는 user.intervene',
          weight: 0.7,
        },
        alternatives: [
          {
            action: '/crumb status (자세히)',
            rationale: 'D1-D6 차원별 점수 확인 후 결정',
            command: 'crumb status <session-id>',
            weight: 0.9,
          },
        ],
        context: `verdict=PARTIAL · audit=${audit.length}`,
      };
    }
    if (verdict === 'FAIL' || verdict === 'REJECT') {
      return {
        primary: {
          action: '/redo with hint',
          rationale: `verdict=${verdict} · planner-lead OR builder-fallback 회귀 필요. user.intervene 으로 hint 전달.`,
          command: 'crumb event --kind user.intervene --body "<수정 hint>"',
          weight: 1.0,
        },
        alternatives: [
          {
            action: '/veto build',
            rationale: 'builder 산출 자체를 거부 (handoff.rollback)',
            command: 'crumb event --kind user.veto',
            weight: 0.6,
          },
        ],
        context: `verdict=${verdict} · audit=${audit.length}`,
      };
    }
  }

  // Last is build (waiting for qa.result) — wait passively.
  if (last?.kind === 'build') {
    return {
      primary: {
        action: 'wait for qa.result',
        rationale: 'dispatcher qa_check effect 진행 중 (deterministic, 보통 < 5s).',
        weight: 1.0,
      },
      alternatives: [
        {
          action: '/crumb status',
          rationale: 'qa.result 도착 전까지 진행 상황 확인',
          command: 'crumb status <session-id>',
          weight: 0.5,
        },
      ],
      context: `last=build · waiting for qa_check effect`,
    };
  }

  // Last is qa.result — verifier spawn 직전.
  if (last?.kind === 'qa.result') {
    return {
      primary: {
        action: 'wait for verifier',
        rationale: `qa.result 도착 — verifier (CourtEval 4 sub-step) spawn 대기 중.`,
        weight: 1.0,
      },
      alternatives: [],
      context: `last=qa.result · waiting for verifier spawn`,
    };
  }

  // Last is question.socratic — user answer 필요.
  if (last?.kind === 'question.socratic') {
    return {
      primary: {
        action: 'answer the planner question',
        rationale: 'planner-lead 가 socratic 질문 발행 — answer.socratic 으로 회신.',
        command: 'crumb event --kind answer.socratic --body "<답변>"',
        weight: 1.0,
      },
      alternatives: [],
      context: `last=question.socratic · awaiting user input`,
    };
  }

  // Default — fall through.
  return {
    primary: {
      action: 'wait',
      rationale: `last=${last?.kind ?? 'none'} · 다음 actor 자동 spawn 대기.`,
      weight: 0.5,
    },
    alternatives: [
      {
        action: '/crumb status',
        rationale: '진행 상황 확인',
        command: 'crumb status <session-id>',
        weight: 0.5,
      },
    ],
    context: `last=${last?.kind ?? 'none'}`,
  };
}

export function formatSuggestion(rec: SuggestionResult): string {
  const lines: string[] = [];
  lines.push(`# Crumb suggest`);
  lines.push('');
  lines.push(`context: ${rec.context}`);
  lines.push('');
  lines.push(`▶ ${rec.primary.action}`);
  lines.push(`  ${rec.primary.rationale}`);
  if (rec.primary.command) lines.push(`  $ ${rec.primary.command}`);
  if (rec.alternatives.length > 0) {
    lines.push('');
    lines.push(`alternatives:`);
    for (const alt of rec.alternatives) {
      lines.push(`  - ${alt.action} — ${alt.rationale}`);
      if (alt.command) lines.push(`    $ ${alt.command}`);
    }
  }
  return lines.join('\n');
}
