/**
 * Preset Loader — (harness × provider × model) 3-tuple resolve with ambient fallback.
 *
 * Resolve order ([[bagelcode-system-architecture-v3]] §5.1):
 *   1. preset.actors.<name>.{harness, provider, model} 명시 사용
 *   2. preset.[defaults] block (선택)
 *   3. ambient (entry host 따라감)
 *   4. system fallback (claude-code + anthropic + claude-sonnet-4-6)
 *
 * Spec source: wiki/concepts/bagelcode-system-architecture-v3.md §5-§6
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve as resolvePath, join as joinPath } from 'node:path';
import { parse as parseToml } from '@iarna/toml';
import type { Harness, Provider } from '../protocol/types.js';

// Re-export so existing importers (tui/model-edit, dispatcher/live, helpers/config)
// keep working without churn. Canonical definitions live in protocol/types.ts —
// the duplicate previously declared here is what created the dispatcher↔config
// cycle dep-cruiser caught.
export type { Harness, Provider };

export interface ActorBinding {
  /** Actor name (coordinator | planner-lead | builder | verifier | builder-fallback). */
  name: string;
  /** Path to sandwich markdown file. */
  sandwich: string;
  /** Resolved harness. */
  harness: Harness;
  /** Resolved provider. */
  provider: Provider;
  /** Resolved model. */
  model: string;
  /** Optional auth method (e.g., 'api-key' for sdk-enterprise preset). */
  auth?: string;
  /** Resolved effort (low/med/high). Provider-specific mapping at adapter spawn. */
  effort?: 'low' | 'med' | 'high';
  /** True if any field came from ambient fallback (for audit log). */
  ambient_resolved: boolean;
}

export interface PresetSpec {
  meta: {
    name: string;
    description?: string;
    recommended?: boolean;
    requires_api_keys?: string[];
    requires_cli?: string[];
    schema?: string;
  };
  actors: Record<string, ActorBinding>;
  effects: Record<string, { tool: string; harness: Harness; provider: Provider }>;
  skills: Record<string, string>;
  specialists: Record<string, Record<string, string>>;
  verifier: {
    mode?: string;
    adaptive_stop_threshold?: number;
    sub_steps?: string[];
  };
  routing: {
    flow?: string[];
    escalate_on_fail?: string;
    escalate_on_stuck?: number;
    adaptive_stop?: boolean;
  };
}

export interface AmbientContext {
  /** Entry host harness — derived from how Crumb was invoked. */
  harness: Harness;
  /** Default model for that host. */
  model: string;
  /** Inferred provider. */
  provider: Provider;
}

const SYSTEM_FALLBACK: AmbientContext = {
  harness: 'claude-code',
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
};

/** Default model per harness — used when ambient model unknown. */
const HARNESS_DEFAULT_MODEL: Record<Harness, { provider: Provider; model: string }> = {
  'claude-code': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  codex: { provider: 'openai', model: 'gpt-5.5-codex' },
  'gemini-cli': { provider: 'google', model: 'gemini-3-1-pro' },
  'gemini-sdk': { provider: 'google', model: 'gemini-3-1-pro' },
  'anthropic-sdk': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  'openai-sdk': { provider: 'openai', model: 'gpt-5.5' },
  'google-sdk': { provider: 'google', model: 'gemini-3-1-pro' },
  mock: { provider: 'none', model: 'fixture-v1' },
  none: { provider: 'none', model: 'none' },
};

/**
 * Detect ambient harness from environment. Order:
 *   1. CRUMB_AMBIENT_HARNESS env (set by entry wrapper)
 *   2. CLAUDECODE / CLAUDE_CODE_SESSION_ID env (Claude Code session)
 *   3. CODEX_SESSION_ID / OPENAI_AGENT_SESSION env (Codex session)
 *   4. GEMINI_SESSION_ID env (Gemini extension)
 *   5. system fallback (claude-code + sonnet-4-6)
 */
export function detectAmbient(env: NodeJS.ProcessEnv = process.env): AmbientContext {
  const explicit = env.CRUMB_AMBIENT_HARNESS as Harness | undefined;
  if (explicit && explicit in HARNESS_DEFAULT_MODEL) {
    const def = HARNESS_DEFAULT_MODEL[explicit];
    return { harness: explicit, ...def };
  }

  if (env.CLAUDECODE === '1' || env.CLAUDE_CODE_SESSION_ID) {
    return { harness: 'claude-code', ...HARNESS_DEFAULT_MODEL['claude-code'] };
  }
  if (env.CODEX_SESSION_ID || env.OPENAI_AGENT_SESSION) {
    return { harness: 'codex', ...HARNESS_DEFAULT_MODEL['codex'] };
  }
  if (env.GEMINI_SESSION_ID || env.GEMINI_CLI_SESSION) {
    return { harness: 'gemini-cli', ...HARNESS_DEFAULT_MODEL['gemini-cli'] };
  }

  return SYSTEM_FALLBACK;
}

/** Resolve a single actor binding via priority order. */
function resolveActor(
  name: string,
  rawActor: Record<string, unknown>,
  ambient: AmbientContext,
): ActorBinding {
  const explicitHarness = rawActor.harness as Harness | undefined;
  const explicitProvider = rawActor.provider as Provider | undefined;
  const explicitModel = rawActor.model as string | undefined;
  const sandwich = (rawActor.sandwich as string) ?? `agents/${name}.md`;
  const auth = rawActor.auth as string | undefined;

  const ambientResolved = !explicitHarness || !explicitModel;

  // Resolve harness: explicit > ambient
  const harness = explicitHarness ?? ambient.harness;

  // Resolve provider: explicit > harness-derived > ambient
  const provider = explicitProvider ?? HARNESS_DEFAULT_MODEL[harness]?.provider ?? ambient.provider;

  // Resolve model: explicit > ambient (only if harness matches) > harness default
  let model: string;
  if (explicitModel) {
    model = explicitModel;
  } else if (harness === ambient.harness) {
    model = ambient.model;
  } else {
    model = HARNESS_DEFAULT_MODEL[harness]?.model ?? SYSTEM_FALLBACK.model;
  }

  return { name, sandwich, harness, provider, model, auth, ambient_resolved: ambientResolved };
}

/**
 * Apply .crumb/config.toml override on top of resolved bindings.
 * Override layers (highest first): config.toml → preset → ambient → fallback.
 * Imported lazily to avoid circular import (model-config imports Harness from this file).
 */
async function applyConfigOverride(
  actors: Record<string, ActorBinding>,
  projectRoot: string,
): Promise<{
  actors: Record<string, ActorBinding>;
  providersEnabled: Record<string, boolean>;
}> {
  const { loadConfig, HARNESS_PROVIDER, PROVIDER_HARNESS } =
    await import('../config/model-config.js');
  const config = loadConfig(projectRoot);
  const out: Record<string, ActorBinding> = {};
  for (const [name, binding] of Object.entries(actors)) {
    const o = config.actors[name];
    if (!o) {
      out[name] = { ...binding, effort: config.defaults.effort };
      continue;
    }
    const harness = o.harness ?? binding.harness;
    const provider = o.provider ?? HARNESS_PROVIDER[harness] ?? binding.provider;
    out[name] = {
      ...binding,
      harness,
      provider,
      model: o.model ?? binding.model,
      effort: o.effort ?? config.defaults.effort,
      ambient_resolved: false, // user-overridden, not ambient
    };
  }
  // Map provider toggles to a flat lookup keyed by Harness for dispatcher checks.
  const providersEnabled: Record<string, boolean> = {};
  for (const [pid, toggle] of Object.entries(config.providers)) {
    const harness = PROVIDER_HARNESS[pid as keyof typeof PROVIDER_HARNESS];
    if (harness) providersEnabled[harness] = toggle.enabled;
  }
  return { actors: out, providersEnabled };
}

/** Load a preset .toml file and resolve all actor bindings against ambient context. */
export function loadPreset(
  presetPath: string,
  ambient: AmbientContext = detectAmbient(),
): PresetSpec {
  if (!existsSync(presetPath)) {
    throw new Error(`Preset not found: ${presetPath}`);
  }
  const raw = parseToml(readFileSync(presetPath, 'utf-8')) as unknown as Record<string, unknown>;

  const meta = (raw.meta as PresetSpec['meta']) ?? { name: 'unknown' };

  const rawActors = (raw.actors as Record<string, Record<string, unknown>>) ?? {};
  const actors: Record<string, ActorBinding> = {};
  for (const [name, rawActor] of Object.entries(rawActors)) {
    actors[name] = resolveActor(name, rawActor, ambient);
  }

  const effects =
    (raw.effects as Record<string, { tool: string; harness: Harness; provider: Provider }>) ?? {};
  const skills = (raw.skills as Record<string, string>) ?? {};
  const specialists = (raw.specialists as Record<string, Record<string, string>>) ?? {};
  const verifier = (raw.verifier as PresetSpec['verifier']) ?? {};
  const routing = (raw.routing as PresetSpec['routing']) ?? {};

  return { meta, actors, effects, skills, specialists, verifier, routing };
}

/** Resolve a preset by name from .crumb/presets/<name>.toml relative to project root. */
export function loadPresetByName(name: string, projectRoot: string = process.cwd()): PresetSpec {
  const path = resolvePath(joinPath(projectRoot, '.crumb', 'presets', `${name}.toml`));
  return loadPreset(path);
}

/**
 * Load preset + apply .crumb/config.toml override + return providers-enabled map.
 * Use this in the runtime path; tests can call loadPreset() directly.
 */
export async function loadPresetWithConfig(
  name: string,
  projectRoot: string = process.cwd(),
): Promise<{ preset: PresetSpec; providersEnabled: Record<string, boolean> }> {
  const preset = loadPresetByName(name, projectRoot);
  const { actors, providersEnabled } = await applyConfigOverride(preset.actors, projectRoot);
  return { preset: { ...preset, actors }, providersEnabled };
}

/** List available preset names by scanning .crumb/presets/. */
export function listPresets(projectRoot: string = process.cwd()): string[] {
  const dir = joinPath(projectRoot, '.crumb', 'presets');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f: string) => f.endsWith('.toml'))
    .map((f: string) => f.replace(/\.toml$/, ''))
    .sort();
}
