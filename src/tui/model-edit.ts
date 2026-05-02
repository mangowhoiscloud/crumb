/**
 * `crumb model` — interactive blessed UI for editing .crumb/config.toml.
 *
 * Keymap:
 *   Tab               cycle actor (↑↓ across rows)
 *   ↑ / ↓             change model (cycle MODEL_CATALOG[provider])
 *   ← / →             change effort (low ↔ med ↔ high)
 *   h                 cycle harness (claude-code / codex / gemini-cli / mock)
 *   p                 toggle provider activation panel focus → Space toggles
 *   Enter             save to .crumb/config.toml + exit
 *   Esc / q           cancel + exit (no save)
 *
 * Read-only when run with --show: prints formatConfig() and exits.
 */

import blessed from 'blessed';

import type { Harness } from '../dispatcher/preset-loader.js';
import {
  ACTORS,
  HARNESS_PROVIDER,
  MODEL_CATALOG,
  cycleEffort,
  cycleModel,
  defaultConfig,
  formatConfig,
  loadConfig,
  saveConfig,
  toggleProvider,
  type ModelConfig,
  type ProviderId,
} from '../config/model-config.js';

const HARNESS_CYCLE: Harness[] = ['claude-code', 'codex', 'gemini-cli', 'mock'];
const PROVIDER_IDS: ProviderId[] = ['claude-local', 'codex-local', 'gemini-cli-local'];

export interface ModelTuiOptions {
  repoRoot: string;
  /** When true, just print current config and exit (no interactive UI). */
  showOnly?: boolean;
}

export async function runModelTui(opts: ModelTuiOptions): Promise<void> {
  const config: ModelConfig = loadConfig(opts.repoRoot);
  if (opts.showOnly) {
    process.stdout.write(formatConfig(config) + '\n');
    return;
  }

  let state: ModelConfig = config;
  let actorIdx = 0;
  let providerFocus = false;
  let providerIdx = 0;

  const screen = blessed.screen({
    smartCSR: true,
    title: 'Crumb · model config',
    fullUnicode: true,
  });

  const header = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    tags: true,
    border: { type: 'line' },
    style: { border: { fg: 'gray' } },
  });

  const actorsBox = blessed.box({
    parent: screen,
    top: 4,
    left: 0,
    right: 0,
    height: ACTORS.length + 4,
    tags: true,
    label: ' ACTORS  (Tab cycle · ↑↓ model · ←→ effort · h harness) ',
    border: { type: 'line' },
    style: { border: { fg: 'gray' } },
  });

  const providersBox = blessed.box({
    parent: screen,
    top: 4 + ACTORS.length + 4,
    left: 0,
    right: 0,
    height: PROVIDER_IDS.length + 4,
    tags: true,
    label: ' PROVIDERS  (p focus · Space toggle) ',
    border: { type: 'line' },
    style: { border: { fg: 'gray' } },
  });

  const status = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    tags: true,
    border: { type: 'line' },
    style: { border: { fg: 'gray' } },
  });

  function rerender(): void {
    header.setContent(
      `{bold}🍞 Crumb · model config{/}\n` +
        `{gray-fg}Tab: cycle actor · ↑↓ model · ←→ effort · h harness · p providers · Enter save · Esc cancel{/}`,
    );

    const actorLines: string[] = [];
    actorLines.push(
      `  {underline}${pad('actor', 17)}{/}  {underline}${pad('harness', 14)}{/}  {underline}${pad('model', 22)}{/}  {underline}effort{/}`,
    );
    ACTORS.forEach((actor, i) => {
      const a = state.actors[actor]!;
      const cur = i === actorIdx && !providerFocus;
      const cursor = cur ? '{yellow-fg}▶{/}' : ' ';
      const harness = a.harness ?? 'claude-code';
      const model = a.model ?? '—';
      const effort = a.effort ?? state.defaults.effort;
      const focus = (s: string): string => (cur ? `{bold}${s}{/}` : s);
      actorLines.push(
        ` ${cursor} ${focus(pad(actor, 17))}  ${focus(pad(harness, 14))}  ${focus(pad(model, 22))}  ${focus(pad(effort, 6))}`,
      );
    });
    actorsBox.setContent(actorLines.join('\n'));

    const providerLines: string[] = [];
    PROVIDER_IDS.forEach((pid, i) => {
      const cur = providerFocus && i === providerIdx;
      const cursor = cur ? '{yellow-fg}▶{/}' : ' ';
      const enabled = state.providers[pid].enabled;
      const sym = enabled ? '{green-fg}[✓]{/}' : '{red-fg}[ ]{/}';
      const label = cur ? `{bold}${pid}{/}` : pid;
      providerLines.push(` ${cursor} ${sym}  ${label}`);
    });
    providersBox.setContent(providerLines.join('\n'));

    status.setContent(
      providerFocus
        ? '{cyan-fg}PROVIDERS focus{/} · ↑↓ navigate · Space toggle enabled · p back to actors'
        : '{cyan-fg}ACTORS focus{/} · select actor with Tab · cycle harness/model/effort · p providers',
    );

    screen.render();
  }

  function applyModelChange(direction: -1 | 1): void {
    const actor = ACTORS[actorIdx]!;
    const cur = state.actors[actor]!;
    const harness = cur.harness ?? 'claude-code';
    const provider = HARNESS_PROVIDER[harness];
    const next = cycleModel(cur.model ?? MODEL_CATALOG[provider][0]!, provider, direction);
    state = { ...state, actors: { ...state.actors, [actor]: { ...cur, model: next } } };
  }

  function applyEffortChange(direction: -1 | 1): void {
    const actor = ACTORS[actorIdx]!;
    const cur = state.actors[actor]!;
    const next = cycleEffort(cur.effort ?? state.defaults.effort, direction);
    state = { ...state, actors: { ...state.actors, [actor]: { ...cur, effort: next } } };
  }

  function applyHarnessChange(): void {
    const actor = ACTORS[actorIdx]!;
    const cur = state.actors[actor]!;
    const idx = HARNESS_CYCLE.indexOf(cur.harness ?? 'claude-code');
    const next = HARNESS_CYCLE[(idx + 1) % HARNESS_CYCLE.length]!;
    const newProvider = HARNESS_PROVIDER[next];
    // When harness changes, snap model to top of new provider's catalog.
    state = {
      ...state,
      actors: {
        ...state.actors,
        [actor]: {
          ...cur,
          harness: next,
          provider: newProvider,
          model: MODEL_CATALOG[newProvider][0],
        },
      },
    };
  }

  screen.key(['tab'], () => {
    if (providerFocus) {
      providerIdx = (providerIdx + 1) % PROVIDER_IDS.length;
    } else {
      actorIdx = (actorIdx + 1) % (ACTORS.length as number);
    }
    rerender();
  });

  screen.key(['up'], () => {
    if (providerFocus) {
      providerIdx = (providerIdx - 1 + PROVIDER_IDS.length) % PROVIDER_IDS.length;
    } else {
      applyModelChange(-1);
    }
    rerender();
  });

  screen.key(['down'], () => {
    if (providerFocus) {
      providerIdx = (providerIdx + 1) % PROVIDER_IDS.length;
    } else {
      applyModelChange(1);
    }
    rerender();
  });

  screen.key(['left'], () => {
    if (!providerFocus) applyEffortChange(-1);
    rerender();
  });

  screen.key(['right'], () => {
    if (!providerFocus) applyEffortChange(1);
    rerender();
  });

  screen.key(['h'], () => {
    if (!providerFocus) applyHarnessChange();
    rerender();
  });

  screen.key(['p'], () => {
    providerFocus = !providerFocus;
    rerender();
  });

  screen.key(['space'], () => {
    if (!providerFocus) return;
    const pid = PROVIDER_IDS[providerIdx]!;
    state = toggleProvider(state, pid);
    rerender();
  });

  screen.key(['enter'], () => {
    saveConfig(opts.repoRoot, state);
    screen.destroy();
    process.stdout.write(`\nSaved to .crumb/config.toml\n${formatConfig(state)}\n`);
    process.exit(0);
  });

  screen.key(['escape', 'q', 'C-c'], () => {
    screen.destroy();
    process.stdout.write('\nCancelled — config unchanged.\n');
    process.exit(0);
  });

  rerender();
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

/** Programmatic apply for NL helper (does not render TUI). Returns formatted result. */
export function applyNlInstruction(repoRoot: string, instruction: string): string {
  let config = loadConfig(repoRoot);
  const lower = instruction.toLowerCase();
  let changed = false;

  // Provider toggle: "codex 비활성화", "disable codex", "enable gemini"
  for (const pid of PROVIDER_IDS) {
    const tokens = pid.split('-')[0]!; // "claude" / "codex" / "gemini"
    if (lower.includes(tokens)) {
      if (lower.match(/disable|비활성|꺼/)) {
        config = { ...config, providers: { ...config.providers, [pid]: { enabled: false } } };
        changed = true;
      } else if (lower.match(/enable|활성|켜/)) {
        config = { ...config, providers: { ...config.providers, [pid]: { enabled: true } } };
        changed = true;
      }
    }
  }

  // Effort: "effort 다 high 로", "effort all to low"
  const effortMatch = lower.match(/effort.*\b(low|med|medium|high)\b/);
  if (effortMatch) {
    const e = effortMatch[1] === 'medium' ? 'med' : (effortMatch[1] as 'low' | 'med' | 'high');
    if (lower.match(/all|모두|다|every/)) {
      const actors = { ...config.actors };
      for (const a of ACTORS) actors[a] = { ...actors[a]!, effort: e };
      config = { ...config, defaults: { effort: e }, actors };
      changed = true;
    } else {
      // Per-actor effort
      for (const actor of ACTORS) {
        if (lower.includes(actor)) {
          config = {
            ...config,
            actors: { ...config.actors, [actor]: { ...config.actors[actor]!, effort: e } },
          };
          changed = true;
        }
      }
    }
  }

  // Per-actor model: "verifier 모델을 gemini-3-1-pro 로", "set builder model to gpt-4o-mini",
  // "verifier 모델을 gemini-3.1-pro 로" (dot/dash forms are aliased — the catalog mixes
  // both: gemini-2.5-pro uses dots, gemini-3-1-pro uses dashes — we normalize on both
  // sides of the compare so the user can type whichever form is muscle-memory).
  const normalizedLower = normalizeModelIds(lower);
  for (const actor of ACTORS) {
    if (!normalizedLower.includes(actor)) continue;
    for (const provider of Object.keys(MODEL_CATALOG)) {
      for (const model of MODEL_CATALOG[provider as keyof typeof MODEL_CATALOG]) {
        const normalizedModel = normalizeModelIds(model.toLowerCase());
        if (normalizedLower.includes(normalizedModel)) {
          const harness = providerToHarness(provider as keyof typeof MODEL_CATALOG);
          // Save the canonical catalog form, not the normalized form.
          config = {
            ...config,
            actors: {
              ...config.actors,
              [actor]: { ...config.actors[actor]!, harness, model, provider: provider as never },
            },
          };
          changed = true;
        }
      }
    }
  }

  if (!changed) {
    return `# Crumb model — no change applied (instruction not parsed)\n\n${formatConfig(config)}`;
  }
  saveConfig(repoRoot, config);
  return `# Crumb model — applied + saved to .crumb/config.toml\n\n${formatConfig(config)}`;
}

function providerToHarness(provider: keyof typeof MODEL_CATALOG): Harness {
  if (provider === 'anthropic') return 'claude-code';
  if (provider === 'openai') return 'codex';
  if (provider === 'google') return 'gemini-cli';
  return 'mock';
}

/**
 * Normalize Google Gemini model IDs for substring matching — collapse `<digit>.<digit>`
 * into `<digit>-<digit>`. The catalog itself mixes the two forms (gemini-3-1-pro is
 * dash, gemini-2.5-pro is dot), so we apply this normalization to both sides of the
 * compare. The canonical catalog form is preserved when writing back to config.
 */
function normalizeModelIds(input: string): string {
  return input.replace(/(\d)\.(\d)/g, '$1-$2');
}

/** Used by tests + non-interactive callers (formatConfig + apply). */
export function showConfig(repoRoot: string): string {
  return formatConfig(loadConfig(repoRoot));
}

/** Re-export for callers that don't want to import from config/. */
export { defaultConfig, loadConfig, saveConfig };
