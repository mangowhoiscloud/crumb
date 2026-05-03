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
}

const ADAPTERS: Omit<AdapterStatus, 'installed' | 'authenticated' | 'version'>[] = [
  {
    id: 'claude-local',
    display_name: 'Claude Code',
    binary: 'claude',
    models: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
    install_hint: 'curl -fsSL claude.ai/install.sh | bash',
    auth_hint: 'claude  (then /login inside the CLI)',
  },
  {
    id: 'codex-local',
    display_name: 'Codex CLI',
    binary: 'codex',
    models: ['gpt-5.5-codex', 'gpt-5-codex'],
    install_hint: 'npm i -g @openai/codex',
    auth_hint: 'codex login',
  },
  {
    id: 'gemini-cli-local',
    display_name: 'Gemini CLI',
    binary: 'gemini',
    models: ['gemini-3-1-pro', 'gemini-2-5-pro'],
    install_hint: 'npm i -g @google/gemini-cli',
    auth_hint: 'gemini  (then /auth inside the CLI)',
  },
  {
    id: 'gemini-sdk',
    display_name: 'Gemini SDK',
    env_var: 'GEMINI_API_KEY',
    models: ['gemini-3-1-pro'],
    install_hint: 'export GEMINI_API_KEY=...  (get one at https://aistudio.google.com/apikey)',
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

async function probeOne(
  a: Omit<AdapterStatus, 'installed' | 'authenticated' | 'version'>,
): Promise<AdapterStatus> {
  // Mock — always available, no probe needed.
  if (a.id === 'mock') {
    return { ...a, installed: true, authenticated: true };
  }
  // SDK-based adapter (no binary, env var keyed).
  if (!a.binary && a.env_var) {
    const present = !!process.env[a.env_var] && process.env[a.env_var]!.length > 0;
    return { ...a, installed: present, authenticated: present };
  }
  // Binary-based adapter — `which <bin>` then best-effort version.
  if (!a.binary) {
    return { ...a, installed: false, authenticated: false };
  }
  const installed = await hasBinary(a.binary);
  if (!installed) return { ...a, installed: false, authenticated: false };
  const version = await tryVersion(a.binary).catch(() => undefined);
  return {
    ...a,
    installed: true,
    authenticated: null, // unknown without spawning a real auth probe
    ...(version ? { version } : {}),
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
