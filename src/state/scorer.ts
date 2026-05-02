/**
 * Layer 1 reducer auto-scorer — D3 / D4 / D5 hybrid auto components.
 *
 * Pure function of (transcript, state) → partial scores. No LLM, no I/O.
 * Verifier reads these as ground truth for D4 and as auto component for D3/D5.
 *
 * See [[bagelcode-system-architecture-v3]] §7 (3-layer scoring), §7.2 (source matrix).
 */

import type { Message, Kind } from '../protocol/types.js';

export interface AutoScores {
  /** D3 observability auto — kind diversity + body length info density. */
  D3_auto: number;
  /** D4 convergence — penalty for spec.update / build retry beyond threshold. */
  D4: number;
  /** D5 intervention auto — fraction of user.intervene events reflected downstream. */
  D5_auto: number;
}

const KIND_DIVERSITY_TARGET: Kind[] = [
  'goal',
  'spec',
  'build',
  'qa.result',
  'verify.result',
  'done',
];

/** D3 — kind diversity (0-3) + body density (0-2). Range 0-5. */
function scoreD3(transcript: Message[]): number {
  const kinds = new Set(transcript.map((m) => m.kind));
  const diversityHits = KIND_DIVERSITY_TARGET.filter((k) => kinds.has(k)).length;
  // Up to 6 target kinds, scaled to 0-3 (3 = all 6 present)
  const diversity = Math.min(3, (diversityHits / KIND_DIVERSITY_TARGET.length) * 3);

  const bodied = transcript.filter((m) => m.body && m.body.length > 0);
  if (bodied.length === 0) return diversity;
  const avgLen = bodied.reduce((s, m) => s + (m.body?.length ?? 0), 0) / bodied.length;
  // Body density: 0-2 score. 80+ chars avg = full credit, scales linearly below.
  const density = Math.min(2, avgLen / 80) * 2;

  return Math.min(5, diversity + density);
}

/** D4 — convergence. 5 = clean 1-pass, drops with respec/rebuild count. */
function scoreD4(transcript: Message[]): number {
  const specUpdates = transcript.filter((m) => m.kind === 'spec.update').length;
  const buildRetries = Math.max(0, transcript.filter((m) => m.kind === 'build').length - 1);
  const vetoChain = transcript.filter((m) => m.kind === 'user.veto').length;

  // Start at 5; penalize each respec/rebuild/veto.
  let score = 5;
  if (specUpdates >= 5) score = 1;
  else if (specUpdates >= 3) score = 2;
  else if (specUpdates >= 1) score = 3;

  if (buildRetries >= 3) score = Math.min(score, 2);
  else if (buildRetries >= 1) score = Math.min(score, 4);

  if (vetoChain >= 3) score = Math.min(score, 2);

  return score;
}

/** D5 — intervention reflection. Fraction of user.intervene followed by spec/build change. */
function scoreD5(transcript: Message[]): number {
  const intervenes = transcript
    .map((m, i) => ({ msg: m, idx: i }))
    .filter((p) => p.msg.kind === 'user.intervene');

  if (intervenes.length === 0) return 5; // No intervention to reflect — full credit by default.

  let reflected = 0;
  for (const { idx } of intervenes) {
    // Check next 5 events: any spec.update / build / artifact.created counts as reflection.
    const window = transcript.slice(idx + 1, idx + 6);
    if (
      window.some(
        (m) => m.kind === 'spec.update' || m.kind === 'build' || m.kind === 'artifact.created',
      )
    ) {
      reflected += 1;
    }
  }
  return (reflected / intervenes.length) * 5;
}

/**
 * Compute Layer 1 auto scores from full transcript.
 * Verifier reads these as D4 lookup + D3.auto + D5.auto components.
 */
export function computeAutoScores(transcript: Message[]): AutoScores {
  return {
    D3_auto: scoreD3(transcript),
    D4: scoreD4(transcript),
    D5_auto: scoreD5(transcript),
  };
}
