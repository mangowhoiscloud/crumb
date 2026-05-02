/**
 * /crumb config <자연어> — preset 추천 helper.
 *
 * Crumb 추천만 제시, 사용자 선택. 강제 X.
 * See [[bagelcode-system-architecture-v3]] §12 (자연어 보조 장치).
 */

import { listPresets } from '../dispatcher/preset-loader.js';

export interface ConfigRecommendation {
  recommended: string;
  reason: string;
  alternatives: { preset: string; when: string }[];
}

const KEYWORDS: Array<{ patterns: RegExp[]; preset: string; reason: string }> = [
  {
    patterns: [/혼자/, /solo/i, /claude만/i, /max만/i, /최소.*셋업/, /가볍게/],
    preset: 'solo',
    reason: 'Anthropic Claude Max 만 활용. Codex/Gemini 미로그인 환경 안전.',
  },
  {
    patterns: [/api.*key/i, /엔터프라이즈/, /enterprise/i, /production/i, /managed/i, /sdk/i],
    preset: 'sdk-enterprise',
    reason: 'Notion/Rakuten/Sentry production-grade. 3 vendor SDK 직접 호출 (API key 필요).',
  },
  {
    patterns: [/mock/i, /테스트/, /ci/i, /demo/i, /오프라인/i, /도구.*없/, /미설치/],
    preset: 'mock',
    reason: 'deterministic CI / 평가자 어느 도구도 미설치 시 fallback. README 동작 보장.',
  },
  {
    patterns: [/cross/i, /3.*에이전트/, /codex.*gemini/i, /다양한/, /동시/, /협업/, /default/i],
    preset: 'bagelcode-cross-3way',
    reason: '메일 verbatim 정조준. builder=Codex / verifier=Gemini cross-vendor 협업.',
  },
];

export function recommendPreset(
  naturalLanguage: string,
  projectRoot: string = process.cwd(),
): ConfigRecommendation {
  const lower = naturalLanguage.toLowerCase();

  for (const rule of KEYWORDS) {
    if (rule.patterns.some((p) => p.test(lower))) {
      const alternatives = listPresets(projectRoot)
        .filter((p) => p !== rule.preset)
        .map((p) => ({ preset: p, when: alternativeWhen(p) }));
      return { recommended: rule.preset, reason: rule.reason, alternatives };
    }
  }

  // Default fallback when no keyword matches
  const alternatives = listPresets(projectRoot)
    .filter((p) => p !== 'bagelcode-cross-3way')
    .map((p) => ({ preset: p, when: alternativeWhen(p) }));

  return {
    recommended: 'bagelcode-cross-3way',
    reason:
      '키워드 매칭 안 됨 → default 추천. 메일 verbatim 정조준 (Claude Code + Codex + Gemini 3 에이전트).',
    alternatives,
  };
}

function alternativeWhen(preset: string): string {
  switch (preset) {
    case 'solo':
      return 'Codex/Gemini 미로그인 시';
    case 'sdk-enterprise':
      return 'API key 보유 + production-grade 시연 시';
    case 'mock':
      return 'CI / deterministic demo / 어느 도구도 미설치 시';
    case 'bagelcode-cross-3way':
      return '3 에이전트 모두 사용 (default)';
    default:
      return '';
  }
}

/** Format recommendation as human-readable text + emit kind=note body. */
export function formatRecommendation(rec: ConfigRecommendation): string {
  const lines = [`추천 preset: ${rec.recommended}`, `근거: ${rec.reason}`, '', '대안:'];
  for (const alt of rec.alternatives) {
    lines.push(`  - ${alt.preset}: ${alt.when}`);
  }
  lines.push('');
  lines.push(`적용: --preset ${rec.recommended}`);
  return lines.join('\n');
}
