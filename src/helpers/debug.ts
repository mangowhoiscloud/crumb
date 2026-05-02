/**
 * /crumb debug — F1-F7 routing 장애 진단 helper.
 *
 * Reads last N transcript events + reducer state, runs F1-F7 detector functions,
 * outputs table of {fault_id, detected, evidence_msg_id, suggested_action}.
 *
 * See [[bagelcode-system-architecture-v3]] §8.2 (F1-F7 fault matrix).
 */

import type { Message } from '../protocol/types.js';
import type { CrumbState } from '../state/types.js';

export interface FaultDetection {
  fault_id: string;
  name: string;
  detected: boolean;
  evidence_msg_id?: string;
  evidence_detail?: string;
  suggested_action: string;
}

const STUCK_THRESHOLD = 5;

/** ES2022-compatible findLast. */
function findLast<T>(arr: T[], pred: (x: T) => boolean): T | undefined {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i]!)) return arr[i];
  }
  return undefined;
}

export function diagnose(transcript: Message[], state: CrumbState): FaultDetection[] {
  const last = transcript[transcript.length - 1];
  const detections: FaultDetection[] = [];

  // F1: adapter spawn 실패
  const f1 = findLast(transcript, (m) => m.kind === 'error' && (m.body ?? '').includes('adapter'));
  detections.push({
    fault_id: 'F1',
    name: 'adapter spawn 실패',
    detected: !!f1,
    evidence_msg_id: f1?.id,
    evidence_detail: f1?.body,
    suggested_action:
      'crumb doctor 로 환경 점검. 미로그인 host 발견 시 builder-fallback OR mock preset 으로 전환',
  });

  // F2: subprocess timeout (idle-timeout 발생)
  const f2 = findLast(
    transcript,
    (m) => m.kind === 'error' && !!(m.body ?? '').match(/timeout|idle/i),
  );
  detections.push({
    fault_id: 'F2',
    name: 'subprocess timeout',
    detected: !!f2,
    evidence_msg_id: f2?.id,
    evidence_detail: f2?.body,
    suggested_action: '--idle-timeout 늘리거나 budget guardrails 점검',
  });

  // F3: schema validation 실패
  const f3 = findLast(
    transcript,
    (m) => m.kind === 'error' && !!(m.body ?? '').match(/schema|ajv/i),
  );
  detections.push({
    fault_id: 'F3',
    name: 'schema validation 실패',
    detected: !!f3,
    evidence_msg_id: f3?.id,
    evidence_detail: f3?.body,
    suggested_action: 'sandwich 안 emit 형식 점검 (kind / from enum 일치 여부)',
  });

  // F4: qa.result 누락 (build 후 verify.request 가 qa.result 없이 발생)
  const builds = transcript.filter((m) => m.kind === 'build');
  const qaResults = transcript.filter((m) => m.kind === 'qa.result');
  const f4 = builds.length > qaResults.length;
  detections.push({
    fault_id: 'F4',
    name: 'qa.result 누락',
    detected: f4,
    evidence_detail: f4 ? `${builds.length} builds vs ${qaResults.length} qa.results` : undefined,
    suggested_action: 'dispatcher.qa-runner 동작 점검. mock preset 으로 격리 테스트',
  });

  // F5: self-bias risk (cross_provider=false in judge.score)
  const judgeScores = transcript.filter((m) => m.kind === 'judge.score');
  const sameProvider = findLast(judgeScores, (m) => m.metadata?.cross_provider === false);
  detections.push({
    fault_id: 'F5',
    name: 'self-bias risk (verifier provider == builder provider)',
    detected: !!sameProvider,
    evidence_msg_id: sameProvider?.id,
    suggested_action: 'cross-provider preset (bagelcode-cross-3way) 사용 권장',
  });

  // F6: 무한 루프 (spec.update / build 반복)
  const specUpdates = transcript.filter((m) => m.kind === 'spec.update').length;
  const buildRetries = Math.max(0, builds.length - 1);
  const f6 = specUpdates >= 5 || buildRetries >= 5;
  detections.push({
    fault_id: 'F6',
    name: '무한 루프 (respec / rebuild 반복)',
    detected: f6,
    evidence_detail: `spec_updates=${specUpdates} build_retries=${buildRetries}`,
    suggested_action: 'budget guardrails (max_respec=3) 적용. /crumb pause 로 사용자 개입',
  });

  // F7: env 미상속 (crumb event 호출 실패)
  const f7 = state.progress_ledger.stuck_count >= STUCK_THRESHOLD;
  detections.push({
    fault_id: 'F7',
    name: 'env 미상속 / stuck',
    detected: f7,
    evidence_detail: `stuck_count=${state.progress_ledger.stuck_count}`,
    suggested_action: 'sandwich 안 explicit env export 줄 추가. spike 결과 wiki 인용',
  });

  void last;
  return detections;
}

export function formatDiagnosis(detections: FaultDetection[]): string {
  const detected = detections.filter((d) => d.detected);
  const lines: string[] = [];
  lines.push('# Crumb Routing Diagnosis (F1-F7)');
  lines.push('');
  if (detected.length === 0) {
    lines.push('✅ No faults detected.');
    return lines.join('\n');
  }
  for (const d of detected) {
    lines.push(`## ${d.fault_id} ${d.name}`);
    lines.push(`- evidence: ${d.evidence_detail ?? d.evidence_msg_id ?? 'n/a'}`);
    lines.push(`- action: ${d.suggested_action}`);
    lines.push('');
  }
  return lines.join('\n');
}
