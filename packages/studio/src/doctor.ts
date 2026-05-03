/**
 * Lightweight adapter probe for the studio.
 *
 * Mirrors `crumb doctor` (in src/helpers/doctor.ts of the crumb repo) but
 * decoupled — no cross-package import. We only need 3 signals per adapter:
 *   1. binary present in PATH (or env var for SDK)
 *   2. version output (best-effort, doesn't require login)
 *   3. install/auth hint strings for the UI modal
 *
 * Authentication state is intentionally `null` (unknown) when the binary is
 * present — actually probing auth would require spawning the CLI which costs
 * time and may surface unwanted side-effects (login prompts). The UI surfaces
 * "auth ✓" only after a successful spawn during a session run.
 */

import { spawn } from 'node:child_process';

export interface AdapterStatus {
  id: string;
  display_name: string;
  /** PATH binary name. Absent for SDK-based adapters that key off env vars. */
  binary?: string;
  /** Env var that grants this adapter access (when no binary). */
  env_var?: string;
  installed: boolean;
  /**
   * Authenticated state:
   *   true  → confirmed (e.g. SDK env var present, mock always true)
   *   null  → unknown (binary installed but we didn't probe login)
   *   false → confirmed not authenticated (binary missing)
   */
  authenticated: boolean | null;
  version?: string;
  /** Models this adapter can drive when fully wired. Static catalogue. */
  models: string[];
  /** UI hint shown in the install/auth modal when `installed` is false. */
  install_hint?: string;
  /** UI hint shown when `installed` is true but auth might be missing. */
  auth_hint?: string;
  /**
   * F5 — env var name that grants API-key auth for this adapter, even when a
   * binary login is the primary path. e.g. claude-local primarily uses
   * `claude /login` but ANTHROPIC_API_KEY also works headless. Surfaced in the
   * setup modal so the user can see at a glance whether the env-var route is live.
   */
  api_key_envvar?: string;
  /** F5 — true when `api_key_envvar` is set in the server process env. */
  api_key_set?: boolean;
}

interface AdapterCatalogEntry extends Omit<
  AdapterStatus,
  'installed' | 'authenticated' | 'version' | 'api_key_set'
> {
  /**
   * F5 — OS-specific install hints. Server picks the entry matching
   * `process.platform`; falls back to the flat `install_hint` when no OS
   * entry matches. The per-OS table is NOT surfaced to the client — the
   * resolved string lands in `install_hint` on the wire.
   */
  install_hint_per_os?: { darwin?: string; linux?: string; win32?: string };
}

const ADAPTERS: AdapterCatalogEntry[] = [
  {
    id: 'claude-local',
    display_name: 'Claude Code',
    binary: 'claude',
    models: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
    install_hint: 'curl -fsSL claude.ai/install.sh | bash',
    install_hint_per_os: {
      darwin: 'curl -fsSL claude.ai/install.sh | bash',
      linux: 'curl -fsSL claude.ai/install.sh | bash',
      win32: 'irm claude.ai/install.ps1 | iex',
    },
    auth_hint: 'claude  (then /login inside the CLI)',
    api_key_envvar: 'ANTHROPIC_API_KEY',
  },
  {
    id: 'codex-local',
    display_name: 'Codex CLI',
    binary: 'codex',
    models: ['gpt-5.5-codex', 'gpt-5-codex'],
    install_hint: 'npm i -g @openai/codex',
    auth_hint: 'codex login',
    api_key_envvar: 'OPENAI_API_KEY',
  },
  {
    id: 'gemini-cli-local',
    display_name: 'Gemini CLI',
    binary: 'gemini',
    models: ['gemini-3-1-pro', 'gemini-2-5-pro'],
    install_hint: 'npm i -g @google/gemini-cli',
    auth_hint: 'gemini  (then /auth inside the CLI)',
    api_key_envvar: 'GEMINI_API_KEY',
  },
  {
    id: 'gemini-sdk',
    display_name: 'Gemini SDK',
    env_var: 'GEMINI_API_KEY',
    models: ['gemini-3-1-pro'],
    install_hint: 'export GEMINI_API_KEY=...  (get one at https://aistudio.google.com/apikey)',
    api_key_envvar: 'GEMINI_API_KEY',
  },
  {
    id: 'mock',
    display_name: 'Mock (deterministic)',
    models: ['mock-default'],
  },
];

const VERSION_TIMEOUT_MS = 1500;

export async function probeAdapters(): Promise<AdapterStatus[]> {
  return Promise.all(ADAPTERS.map(probeOne));
}

async function probeOne(a: AdapterCatalogEntry): Promise<AdapterStatus> {
  // F5 — strip the per-OS table and pick the entry matching process.platform
  // (falling back to the cross-platform default). The wire shape stays a flat
  // string so the client doesn't need OS branching.
  const { install_hint_per_os, ...rest } = a;
  const platform = process.platform as 'darwin' | 'linux' | 'win32';
  const install_hint = install_hint_per_os?.[platform] ?? rest.install_hint;
  // F5 — env var presence check for API-key auth (independent of binary login).
  const api_key_set = a.api_key_envvar
    ? !!process.env[a.api_key_envvar] && process.env[a.api_key_envvar]!.length > 0
    : undefined;
  const base = { ...rest, ...(install_hint ? { install_hint } : {}) };

  // Mock — always available, no probe needed.
  if (a.id === 'mock') {
    return { ...base, installed: true, authenticated: true };
  }
  // SDK-based adapter (no binary, env var keyed).
  if (!a.binary && a.env_var) {
    const present = !!process.env[a.env_var] && process.env[a.env_var]!.length > 0;
    return {
      ...base,
      installed: present,
      authenticated: present,
      ...(api_key_set !== undefined ? { api_key_set } : {}),
    };
  }
  // Binary-based adapter — `which <bin>` then best-effort version.
  if (!a.binary) {
    return { ...base, installed: false, authenticated: false };
  }
  const installed = await hasBinary(a.binary);
  if (!installed) {
    return {
      ...base,
      installed: false,
      authenticated: false,
      ...(api_key_set !== undefined ? { api_key_set } : {}),
    };
  }
  const version = await tryVersion(a.binary).catch(() => undefined);
  return {
    ...base,
    installed: true,
    // F5 — when the API-key envvar is set on a binary adapter, we can confirm
    // headless auth even though the binary's own /login state is unknown.
    authenticated: api_key_set ? true : null,
    ...(version ? { version } : {}),
    ...(api_key_set !== undefined ? { api_key_set } : {}),
  };
}

function hasBinary(name: string): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn('which', [name], { stdio: 'ignore' });
    let settled = false;
    const settle = (v: boolean) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    p.on('exit', (code) => settle(code === 0));
    p.on('error', () => settle(false));
  });
}

function tryVersion(name: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(name, ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        p.kill('SIGKILL');
      } catch {
        // ignore
      }
      reject(new Error('version timeout'));
    }, VERSION_TIMEOUT_MS);
    p.stdout?.on('data', (d: Buffer) => {
      out += d.toString();
    });
    p.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) resolve(out.trim().split('\n')[0] ?? '');
      else reject(new Error(`version exit ${code}`));
    });
    p.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}
