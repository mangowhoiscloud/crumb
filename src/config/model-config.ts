/**
 * Model config — runtime override layer on top of preset binding.
 *
 * `.crumb/config.toml` (gitignored, per-user) lets the operator tweak:
 *   - per-actor (harness, model, effort)
 *   - per-provider (enabled flag)
 *
 * Resolve order ([[bagelcode-system-architecture-v0.1]] §5.1, extended):
 *   1. .crumb/config.toml override (★ NEW — this module)
 *   2. preset.actors.<name>.{harness, provider, model}
 *   3. preset.[defaults]
 *   4. ambient (entry host)
 *   5. system fallback (claude-code + anthropic + claude-opus-4-7 — high-end default)
 *
 * High-end defaults (Anthropic 2026-04 / OpenAI 2026-04 / Google Cloud Next 2026):
 *   - Anthropic: claude-opus-4-7 (premium) > claude-sonnet-4-6 (workhorse) > claude-haiku-4-5
 *   - OpenAI:    gpt-5.5-codex (code-tuned) ≈ gpt-5.5 > gpt-4o
 *   - Google:    gemini-3-1-pro (premium, multimodal) > gemini-3-pro > gemini-2.5-pro > gemini-2.5-flash
 *
 * Effort levels (3 levels, mapped to provider-specific values at adapter spawn):
 *   - low  : OpenAI reasoning.effort=low,  Anthropic thinking_budget=8000,  Gemini thinking_budget=8000
 *   - med  : OpenAI reasoning.effort=med,  Anthropic thinking_budget=24000, Gemini thinking_budget=24000
 *   - high : OpenAI reasoning.effort=high, Anthropic thinking_budget=64000, Gemini thinking_budget=64000
 *
 * NL-editable via `crumb_model` MCP tool / `crumb model` TUI / direct toml edit.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { parse as parseToml } from '@iarna/toml';

import type { Harness, Provider } from '../protocol/types.js';

export type Effort = 'low' | 'med' | 'high';

export type ProviderId = 'claude-local' | 'codex-local' | 'gemini-cli-local';

export interface ActorOverride {
  harness?: Harness;
  provider?: Provider;
  model?: string;
  effort?: Effort;
}

export interface ProviderToggle {
  enabled: boolean;
}

export interface ModelConfig {
  defaults: {
    effort: Effort;
  };
  actors: Record<string, ActorOverride>;
  providers: Record<ProviderId, ProviderToggle>;
}

/** Per-provider model catalog — ranked high → low for ↑/↓ navigation in TUI. */
export const MODEL_CATALOG: Record<Provider, string[]> = {
  anthropic: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  openai: ['gpt-5.5-codex', 'gpt-5.5', 'gpt-4o', 'gpt-4o-mini'],
  google: [
    'gemini-3-1-pro',
    'gemini-3-pro',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
  ],
  none: ['fixture-v1'],
};

/** Harness ↔ Provider canonical mapping. */
export const HARNESS_PROVIDER: Record<Harness, Provider> = {
  'claude-code': 'anthropic',
  codex: 'openai',
  'gemini-cli': 'google',
  'gemini-sdk': 'google',
  'anthropic-sdk': 'anthropic',
  'openai-sdk': 'openai',
  'google-sdk': 'google',
  mock: 'none',
  none: 'none',
};

/** Provider id ↔ harness — only the 3 *local* CLI hosts get toggles. */
export const PROVIDER_HARNESS: Record<ProviderId, Harness> = {
  'claude-local': 'claude-code',
  'codex-local': 'codex',
  'gemini-cli-local': 'gemini-cli',
};

/** All actors recognized by Crumb (4 outer). */
export const ACTORS = ['coordinator', 'planner-lead', 'builder', 'verifier'] as const;

/** Effort levels — left/right cycle in TUI. */
export const EFFORT_LEVELS: Effort[] = ['low', 'med', 'high'];

/** Effort → provider-specific spawn params. */
export interface EffortMapping {
  openai_reasoning_effort: 'low' | 'medium' | 'high';
  anthropic_thinking_budget: number;
  gemini_thinking_budget: number;
}

export function mapEffort(effort: Effort): EffortMapping {
  if (effort === 'low')
    return {
      openai_reasoning_effort: 'low',
      anthropic_thinking_budget: 8000,
      gemini_thinking_budget: 8000,
    };
  if (effort === 'med')
    return {
      openai_reasoning_effort: 'medium',
      anthropic_thinking_budget: 24000,
      gemini_thinking_budget: 24000,
    };
  return {
    openai_reasoning_effort: 'high',
    anthropic_thinking_budget: 64000,
    gemini_thinking_budget: 64000,
  };
}

/**
 * v0.3.1 default config — every actor uses the user's local entry host
 * (`claude-code` for Claude Code sessions). Cross-provider runs remain
 * available but are now opt-in via `crumb run --preset bagelcode-cross-3way`,
 * which overrides builder → codex + verifier → gemini-cli at session-start
 * time. The single-host default keeps a fresh checkout single-auth.
 *
 * All 3 local providers stay enabled so the dispatcher can fall back / swap
 * at runtime via `crumb_model` MCP tool or TUI; only the actor seed bindings
 * changed.
 */
export function defaultConfig(): ModelConfig {
  return {
    defaults: { effort: 'high' },
    actors: {
      // v0.3.1 — coordinator is a quick-thinking router (TradingAgents §4.3
      // split: routing = quick model, deep reasoning = deep model). Hub-
      // Ledger-Spoke decisions are 1–2 turn transcript-head lookups;
      // extended thinking adds latency without raising routing quality.
      coordinator: { harness: 'claude-code', model: 'claude-haiku-4-5', effort: 'low' },
      'planner-lead': { harness: 'claude-code', model: 'claude-opus-4-7', effort: 'high' },
      builder: { harness: 'claude-code', model: 'claude-opus-4-7', effort: 'high' },
      verifier: { harness: 'claude-code', model: 'claude-opus-4-7', effort: 'high' },
    },
    providers: {
      'claude-local': { enabled: true },
      'codex-local': { enabled: true },
      'gemini-cli-local': { enabled: true },
    },
  };
}

const CONFIG_PATH = '.crumb/config.toml';

export function configPath(repoRoot: string): string {
  return resolve(repoRoot, CONFIG_PATH);
}

export function loadConfig(repoRoot: string): ModelConfig {
  const path = configPath(repoRoot);
  if (!existsSync(path)) return defaultConfig();
  const raw = readFileSync(path, 'utf8');
  const parsed = parseToml(raw) as unknown as Partial<ModelConfig>;
  return mergeWithDefaults(parsed);
}

function mergeWithDefaults(partial: Partial<ModelConfig>): ModelConfig {
  const base = defaultConfig();
  return {
    defaults: { ...base.defaults, ...(partial.defaults ?? {}) },
    actors: { ...base.actors, ...(partial.actors ?? {}) },
    providers: { ...base.providers, ...(partial.providers ?? {}) } as Record<
      ProviderId,
      ProviderToggle
    >,
  };
}

export function saveConfig(repoRoot: string, config: ModelConfig): void {
  const path = configPath(repoRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serializeToToml(config), 'utf8');
}

function serializeToToml(c: ModelConfig): string {
  const lines: string[] = [
    '# Crumb model config — runtime override layer on top of preset binding.',
    '# Generated/edited by `crumb model` TUI or `crumb_model` MCP tool.',
    '# See src/config/model-config.ts for resolve order + effort mapping.',
    '',
    '[defaults]',
    `effort = "${c.defaults.effort}"`,
    '',
  ];
  for (const [pid, toggle] of Object.entries(c.providers)) {
    lines.push(`[providers."${pid}"]`);
    lines.push(`enabled = ${toggle.enabled}`);
    lines.push('');
  }
  for (const [actor, override] of Object.entries(c.actors)) {
    lines.push(`[actors."${actor}"]`);
    if (override.harness) lines.push(`harness = "${override.harness}"`);
    if (override.provider) lines.push(`provider = "${override.provider}"`);
    if (override.model) lines.push(`model = "${override.model}"`);
    if (override.effort) lines.push(`effort = "${override.effort}"`);
    lines.push('');
  }
  return lines.join('\n');
}

/** Cycle model up/down in catalog. up=-1 → previous (higher tier), down=+1 → next (lower tier). */
export function cycleModel(current: string, provider: Provider, direction: -1 | 1): string {
  const list = MODEL_CATALOG[provider];
  if (list.length === 0) return current;
  const idx = list.indexOf(current);
  if (idx < 0) return list[0]!;
  const next = (idx + direction + list.length) % list.length;
  return list[next]!;
}

/** Cycle effort left/right. left=-1 (lower), right=+1 (higher). */
export function cycleEffort(current: Effort, direction: -1 | 1): Effort {
  const idx = EFFORT_LEVELS.indexOf(current);
  if (idx < 0) return 'high';
  const next = Math.max(0, Math.min(EFFORT_LEVELS.length - 1, idx + direction));
  return EFFORT_LEVELS[next]!;
}

/** Toggle provider enabled flag in-place. */
export function toggleProvider(config: ModelConfig, pid: ProviderId): ModelConfig {
  const cur = config.providers[pid];
  return {
    ...config,
    providers: {
      ...config.providers,
      [pid]: { enabled: !cur.enabled },
    },
  };
}

/** Format current config as a status table for `crumb model --show` / NL helper. */
export function formatConfig(config: ModelConfig): string {
  const lines: string[] = [];
  lines.push('# Crumb model config');
  lines.push('');
  lines.push(`defaults.effort = ${config.defaults.effort}`);
  lines.push('');
  lines.push('## providers');
  for (const [pid, toggle] of Object.entries(config.providers)) {
    const sym = toggle.enabled ? '✓' : '✗';
    lines.push(`  ${sym} ${pid}`);
  }
  lines.push('');
  lines.push('## actors');
  lines.push('  actor             harness        model                effort');
  for (const [actor, override] of Object.entries(config.actors)) {
    const harness = override.harness ?? '(ambient)';
    const model = override.model ?? '(ambient)';
    const effort = override.effort ?? config.defaults.effort;
    lines.push(`  ${pad(actor, 17)} ${pad(harness, 14)} ${pad(model, 20)} ${effort}`);
  }
  return lines.join('\n');
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}
