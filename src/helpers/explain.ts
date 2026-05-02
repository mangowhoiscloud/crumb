/**
 * /crumb explain <kind> — schema 어휘 lookup helper.
 *
 * 43 kinds × 11 identification fields. Static registry — no transcript I/O.
 * Source-of-truth: protocol/schemas/message.schema.json + v3 §3.
 */

import type { Kind } from '../protocol/types.js';

export interface KindInfo {
  kind: Kind;
  category: 'system' | 'workflow' | 'dialogue' | 'step' | 'user' | 'handoff' | 'meta' | 'version';
  description: string;
  emitter: string;
  /** Typical parent_event_id chain. */
  parent?: string;
  /** Notable data/scores fields. */
  payload?: string;
  /** Ground-truth / source-of-truth note (D1-D6). */
  source_of_truth?: string;
  /** Wiki anchor (deep-link reference). */
  ref: string;
}

export const KIND_REGISTRY: Record<Kind, KindInfo> = {
  'session.start': {
    kind: 'session.start',
    category: 'system',
    description: 'Session 시작. ULID 발급 + sessionDir 생성.',
    emitter: 'system (coordinator main loop)',
    payload: 'body=session ${id} started',
    ref: 'v3 §1.L5',
  },
  'session.end': {
    kind: 'session.end',
    category: 'system',
    description: 'Session 종료. summary.html + exports/* 자동 emit.',
    emitter: 'system (coordinator finish)',
    ref: 'v3 §10 (4 surface)',
  },
  'session.forked': {
    kind: 'session.forked',
    category: 'system',
    description:
      'v3.3: Forked session 의 첫 event. 부모 transcript 복사 없이 metadata.crumb.{parent_session_id, fork_event_id} 만 기록 — reducer 가 read 시점에 부모를 fork_event_id 까지 hydrate.',
    emitter: 'system (crumb fork)',
    payload: 'metadata.crumb={parent_session_id, fork_event_id}',
    ref: 'v3.3 fork model — wiki §v4',
  },
  'agent.wake': {
    kind: 'agent.wake',
    category: 'system',
    description: 'Actor subprocess spawn 직후 첫 시그널.',
    emitter: 'dispatcher',
    ref: 'v3 §4.2',
  },
  'agent.stop': {
    kind: 'agent.stop',
    category: 'system',
    description: 'Actor turn 종료. exit code + reason 포함.',
    emitter: 'dispatcher',
    ref: 'v3 §4.2',
  },
  goal: {
    kind: 'goal',
    category: 'workflow',
    description: '사용자 게임 pitch. transcript 첫 의미 event.',
    emitter: 'user',
    ref: 'v3 §4.2',
  },
  'question.socratic': {
    kind: 'question.socratic',
    category: 'workflow',
    description: 'Planner Lead 가 사용자에게 묻는 socratic 질문.',
    emitter: 'planner-lead (step.socratic)',
    ref: 'agents/planner-lead.md',
  },
  'answer.socratic': {
    kind: 'answer.socratic',
    category: 'workflow',
    description: '사용자 답변 — Planner 가 spec 에 반영.',
    emitter: 'user',
    ref: 'agents/planner-lead.md',
  },
  spec: {
    kind: 'spec',
    category: 'workflow',
    description: '확정 spec.md. acceptance criteria + 룰북.',
    emitter: 'planner-lead',
    parent: 'goal / answer.socratic chain',
    payload: 'body=markdown spec, artifacts=[{path:spec.md, sha256}]',
    ref: 'v3 §4.2',
  },
  'spec.update': {
    kind: 'spec.update',
    category: 'workflow',
    description: 'Spec 수정 (user.intervene 또는 verifier FAIL 후 회귀).',
    emitter: 'planner-lead',
    parent: 'user.intervene / handoff.rollback',
    ref: 'v3 §8.2 F6',
  },
  build: {
    kind: 'build',
    category: 'workflow',
    description: 'Builder 의 게임 산출. game.html + DESIGN.md + tuning.json 동시.',
    emitter: 'builder',
    parent: 'spec',
    payload: 'artifacts=[{path:game.html, sha256, role:src}]',
    ref: 'agents/builder.md',
  },
  'qa.result': {
    kind: 'qa.result',
    category: 'workflow',
    description: 'Deterministic ground truth — htmlhint + playwright. LLM 무관.',
    emitter: 'dispatcher (qa_check effect)',
    parent: 'build',
    payload:
      'data={lint_passed, exec_exit_code, phaser_loaded, first_interaction, artifact_sha256, runtime_ms}',
    source_of_truth: 'D2 exec / D6 portability — verifier 가 못 바꿈',
    ref: 'v3 §3.5',
  },
  'verify.request': {
    kind: 'verify.request',
    category: 'workflow',
    description: 'Coordinator 가 verifier 호출.',
    emitter: 'coordinator',
    ref: 'v3 §4.2',
  },
  'verify.result': {
    kind: 'verify.result',
    category: 'workflow',
    description: '(legacy alias of judge.score — 기존 transcript replay 호환)',
    emitter: 'verifier',
    ref: 'v3 §3.3',
  },
  'judge.score': {
    kind: 'judge.score',
    category: 'workflow',
    description: 'Verifier CourtEval 종합 채점. D1-D6 source-of-truth matrix.',
    emitter: 'verifier',
    parent: 'qa.result',
    payload:
      'scores={D1..D6: {score, source, lookup, evidence}, aggregate, verdict, courteval, audit_violations}',
    source_of_truth: 'D1/D3/D5 = LLM | D2/D6 = qa-check | D4 = reducer-auto',
    ref: 'v3 §3.6 + §7',
  },
  done: {
    kind: 'done',
    category: 'workflow',
    description: 'Session 종료 marker. summary.html 자동 생성 trigger.',
    emitter: 'coordinator (after PASS or adaptive_stop)',
    ref: 'v3 §4.2',
  },
  'agent.thought_summary': {
    kind: 'agent.thought_summary',
    category: 'dialogue',
    description: 'Actor 내부 reasoning trace (Anthropic thinking_tokens equivalent).',
    emitter: 'any actor',
    ref: 'v3 §3.3',
  },
  question: {
    kind: 'question',
    category: 'dialogue',
    description: 'Free-form actor question. socratic 외 일반 질의.',
    emitter: 'any actor',
    ref: 'v3 §3.3',
  },
  answer: {
    kind: 'answer',
    category: 'dialogue',
    description: 'Free-form actor answer.',
    emitter: 'any actor',
    ref: 'v3 §3.3',
  },
  debate: {
    kind: 'debate',
    category: 'dialogue',
    description: 'Multi-actor 의견 충돌 — CourtEval critic/defender 외 free-form.',
    emitter: 'any actor',
    ref: 'v3 §3.3',
  },
  note: {
    kind: 'note',
    category: 'dialogue',
    description: '관찰 / metadata 메모. routing 에 영향 X — observability only.',
    emitter: 'coordinator + helpers',
    ref: 'v3 §12 (helper output)',
  },
  'step.socratic': {
    kind: 'step.socratic',
    category: 'step',
    description: 'Planner Lead 단계 — 사용자에게 socratic 질문 발행.',
    emitter: 'planner-lead',
    ref: 'agents/planner-lead.md',
  },
  'step.concept': {
    kind: 'step.concept',
    category: 'step',
    description: 'Planner Lead 단계 — concept-designer specialist inline.',
    emitter: 'planner-lead',
    ref: 'agents/specialists/concept-designer.md',
  },
  'step.research': {
    kind: 'step.research',
    category: 'step',
    description:
      'researcher actor 단계 (v3.3) — 3 reference games × 3 actionable lessons synthesis. video evidence 가 있을 때 evidence_refs 로 step.research.video 연결.',
    emitter: 'researcher',
    ref: 'agents/researcher.md',
  },
  'step.research.video': {
    kind: 'step.research.video',
    category: 'step',
    description:
      'researcher actor 단계 (v3.3) — per-clip video evidence (mechanic / timing / palette extraction via gemini-sdk Files API + YouTube URL Part). metadata.cache_key 로 replay dedup.',
    emitter: 'researcher',
    ref: 'agents/specialists/game-design.md',
  },
  'step.design': {
    kind: 'step.design',
    category: 'step',
    description: 'Planner Lead 단계 — visual-designer specialist inline.',
    emitter: 'planner-lead',
    ref: 'agents/specialists/visual-designer.md',
  },
  'step.judge': {
    kind: 'step.judge',
    category: 'step',
    description: 'Verifier CourtEval 4 sub-step (grader / critic / defender / regrader).',
    emitter: 'verifier',
    parent: 'qa.result',
    payload: 'step ∈ {grader, critic, defender, regrader}',
    ref: 'v3 §3.4 + agents/verifier.md',
  },
  'user.intervene': {
    kind: 'user.intervene',
    category: 'user',
    description: '사용자 자연어 개입 — 다음 spec/build 에 반영.',
    emitter: 'user',
    ref: 'v3 §11',
  },
  'user.veto': {
    kind: 'user.veto',
    category: 'user',
    description: '특정 message 거부. instructionOverride 적용.',
    emitter: 'user',
    payload: 'data={target_msg_id, reason}',
    ref: 'v3 §11.1',
  },
  'user.approve': {
    kind: 'user.approve',
    category: 'user',
    description: '명시 승인. PARTIAL → done 가능.',
    emitter: 'user',
    ref: 'v3 §11.1',
  },
  'user.pause': {
    kind: 'user.pause',
    category: 'user',
    description: '전역 pause. 다음 spawn 차단.',
    emitter: 'user',
    ref: 'v3 §11.1',
  },
  'user.resume': {
    kind: 'user.resume',
    category: 'user',
    description: 'pause 해제.',
    emitter: 'user',
    ref: 'v3 §11.1',
  },
  'handoff.requested': {
    kind: 'handoff.requested',
    category: 'handoff',
    description: 'Actor 가 다음 actor 에게 turn 양도 요청.',
    emitter: 'any actor',
    ref: 'v3 §4.2',
  },
  'handoff.accepted': {
    kind: 'handoff.accepted',
    category: 'handoff',
    description: 'Coordinator 가 handoff 수락 — 다음 actor spawn.',
    emitter: 'coordinator',
    ref: 'v3 §4.2',
  },
  'handoff.rollback': {
    kind: 'handoff.rollback',
    category: 'handoff',
    description: 'FAIL verdict 시 planner-lead OR builder-fallback 으로 회귀.',
    emitter: 'coordinator',
    parent: 'judge.score (FAIL)',
    ref: 'v3 §4.2',
  },
  'artifact.created': {
    kind: 'artifact.created',
    category: 'meta',
    description: 'Actor 가 산출물 emit. sha256 + path 보존.',
    emitter: 'any actor',
    payload: 'artifacts=[{path, sha256, role}]',
    ref: 'v3 §3.1',
  },
  ack: {
    kind: 'ack',
    category: 'meta',
    description: 'ack_required 메시지에 대한 수신 확인.',
    emitter: 'any actor',
    ref: 'v3 §3.1',
  },
  error: {
    kind: 'error',
    category: 'meta',
    description: '복구 가능 / 불가능 에러. F1-F7 진단 입력.',
    emitter: 'dispatcher / actor / validator',
    ref: 'v3 §8.2',
  },
  audit: {
    kind: 'audit',
    category: 'meta',
    description: 'Anti-deception validator 출력. audit_violations 분리 보관.',
    emitter: 'validator',
    payload: 'metadata.audit_violations=[...]',
    ref: 'v3 §7.3',
  },
  'tool.call': {
    kind: 'tool.call',
    category: 'meta',
    description: 'Actor 의 tool 호출 — Bash/Read/Edit/Write 등.',
    emitter: 'any actor (subprocess host)',
    payload: 'data={cwd, add_dir, permission_mode, args}',
    ref: 'v3 §3.3',
  },
  'tool.result': {
    kind: 'tool.result',
    category: 'meta',
    description: 'tool.call 의 결과.',
    emitter: 'any actor',
    parent: 'tool.call',
    ref: 'v3 §3.3',
  },
  hook: {
    kind: 'hook',
    category: 'meta',
    description: '사용자 modal 표면 — PARTIAL verdict / stuck threshold 시.',
    emitter: 'coordinator',
    ref: 'v3 §8.1 (After kind=judge.score PARTIAL → kind=hook)',
  },
  'version.released': {
    kind: 'version.released',
    category: 'version',
    description:
      'v3.3: Session artifacts 가 immutable milestone (versions/<vN>/) 으로 promote 됨. manifest.toml 에 parent_version + scorecard 동결.',
    emitter: 'system (crumb release)',
    payload: 'data={version, label?, parent_version, source_session, source_event_id}',
    ref: 'v3.3 version graph — wiki §v4',
  },
  'version.refinement': {
    kind: 'version.refinement',
    category: 'version',
    description:
      'v3.3: 기존 version 기반의 점진적 개선 표시 (소규모 tweak — D1-D6 scorecard 변동 추적).',
    emitter: 'system (crumb release --refinement-of vN)',
    payload: 'data={version, base_version, scorecard_delta}',
    ref: 'v3.3 version graph — wiki §v4',
  },
};

export interface ExplainResult {
  found: boolean;
  kind?: KindInfo;
  /** Did-you-mean suggestions for partial / typo input. */
  suggestions: Kind[];
}

export function explainKind(query: string): ExplainResult {
  const q = query.trim().toLowerCase();
  if (!q) return { found: false, suggestions: [] };
  const exact = (Object.keys(KIND_REGISTRY) as Kind[]).find((k) => k.toLowerCase() === q);
  if (exact) return { found: true, kind: KIND_REGISTRY[exact], suggestions: [] };
  // Substring matches
  const partials = (Object.keys(KIND_REGISTRY) as Kind[]).filter((k) =>
    k.toLowerCase().includes(q),
  );
  return { found: false, suggestions: partials.slice(0, 5) };
}

export function formatExplain(result: ExplainResult): string {
  if (!result.found) {
    if (result.suggestions.length === 0) {
      return 'no matching kind. try one of: goal / spec / build / qa.result / judge.score / done.';
    }
    return `no exact match. did you mean:\n${result.suggestions.map((k) => `  - ${k}`).join('\n')}`;
  }
  const k = result.kind!;
  const lines: string[] = [];
  lines.push(`# ${k.kind}  (${k.category})`);
  lines.push('');
  lines.push(k.description);
  lines.push('');
  lines.push(`emitter:  ${k.emitter}`);
  if (k.parent) lines.push(`parent:   ${k.parent}`);
  if (k.payload) lines.push(`payload:  ${k.payload}`);
  if (k.source_of_truth) lines.push(`★ truth:   ${k.source_of_truth}`);
  lines.push(`ref:      ${k.ref}`);
  return lines.join('\n');
}
