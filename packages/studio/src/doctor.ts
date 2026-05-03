/**
 * Lightweight adapter probe for the studio.
 *
 * Mirrors `crumb doctor` (in src/helpers/doctor.ts of the crumb repo) but
 * decoupled — no cross-package import. We need 4 signals per adapter:
 *   1. binary present in PATH (or env var for SDK)
 *   2. version output (best-effort, doesn't require login)
 *   3. auth credential file presence + JWT/OAuth expiry timestamp parse
 *      (codex `~/.codex/auth.json` tokens.id_token JWT exp claim,
 *       gemini `~/.gemini/oauth_creds.json` expiry_date)
 *   4. install/auth hint strings for the UI modal
 *
 * v0.5 PR-Auth: parsing the credential timestamps lets us distinguish
 *   auth_state='ok' (binary + creds + not expired) from
 *   auth_state='expired' (binary + creds but expired — needs `codex login` /
 *                          gemini /auth re-issue) from
 *   auth_state='missing' (binary present but no creds — first login needed)
 *   auth_state='unknown' (binary present, can't probe — Anthropic claude-code
 *                         doesn't expose a stable creds file for us to inspect)
 *
 * The CLI is NEVER spawned for auth — would surface login prompts. Only file
 * read + JWT base64url decode. Failures degrade silently to 'unknown'.
 */

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join as joinPath } from 'node:path';

export type AuthState = 'ok' | 'expired' | 'missing' | 'unknown';

export interface AdapterStatus {
  id: string;
  display_name: string;
  /** PATH binary name. Absent for SDK-based adapters that key off env vars. */
  binary?: string;
  /** Env var that grants this adapter access (when no binary). */
  env_var?: string;
  installed: boolean;
  /**
   * Authenticated state (legacy boolean alias of auth_state, kept for
   * back-compat with `presetIsRunnable` and `updateVideoUI` callers in
   * studio.js):
   *   true  → auth_state === 'ok' (or SDK env present, or mock)
   *   null  → auth_state === 'unknown' (binary installed but probe degraded)
   *   false → auth_state === 'expired' or 'missing' (re-login needed)
   * Treat null as "needs setup hint" + treat false as "definitely needs
   * re-auth"; UI distinguishes via auth_state field directly.
   */
  authenticated: boolean | null;
  /**
   * v0.5 PR-Auth — granular auth state. Studio renders separate badges
   * for 'expired' vs 'missing' so the click → setup modal can show the
   * right command (codex login vs codex /login refresh).
   */
  auth_state: AuthState;
  version?: string;
  /** Models this adapter can drive when fully wired. Static catalogue. */
  models: string[];
  /** UI hint shown in the install/auth modal when `installed` is false. */
  install_hint?: string;
  /** UI hint shown when `installed` is true but auth might be missing. */
  auth_hint?: string;
  /**
   * v0.5 PR-Auth — UNIX seconds at which the parsed credential expires.
   * Surfaced in the setup modal so the user sees "expired 2h ago" vs
   * "expires in 47m". null when we can't read the timestamp (claude-code,
   * mock, missing creds, or parse failure).
   */
  expires_at?: number | null;
}

const ADAPTERS: Omit<AdapterStatus, 'installed' | 'authenticated' | 'auth_state' | 'version'>[] = [
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
  a: Omit<AdapterStatus, 'installed' | 'authenticated' | 'auth_state' | 'version'>,
): Promise<AdapterStatus> {
  // Mock — always available, no probe needed.
  if (a.id === 'mock') {
    return { ...a, installed: true, authenticated: true, auth_state: 'ok' };
  }
  // SDK-based adapter (no binary, env var keyed).
  if (!a.binary && a.env_var) {
    const present = !!process.env[a.env_var] && process.env[a.env_var]!.length > 0;
    return {
      ...a,
      installed: present,
      authenticated: present,
      auth_state: present ? 'ok' : 'missing',
    };
  }
  // Binary-based adapter — `which <bin>` then best-effort version.
  if (!a.binary) {
    return { ...a, installed: false, authenticated: false, auth_state: 'missing' };
  }
  const installed = await hasBinary(a.binary);
  if (!installed) return { ...a, installed: false, authenticated: false, auth_state: 'missing' };
  const version = await tryVersion(a.binary).catch(() => undefined);

  // v0.5 PR-Auth — best-effort credential file parse for granular auth_state.
  // codex / gemini-cli expose a stable creds file; claude-code does not, so
  // it stays auth_state='unknown' (the legacy `null` authenticated value).
  const auth = await probeAuthFile(a.id);

  return {
    ...a,
    installed: true,
    authenticated: auth.state === 'ok' ? true : auth.state === 'unknown' ? null : false,
    auth_state: auth.state,
    ...(auth.expires_at !== undefined ? { expires_at: auth.expires_at } : {}),
    ...(version ? { version } : {}),
  };
}

/**
 * v0.5 PR-Auth — credential file probe.
 *
 * Codex (~/.codex/auth.json):
 *   tokens.id_token is a JWT; the middle base64url segment carries `exp`
 *   (UNIX seconds). We decode it without verification (we don't need
 *   identity, only the expiry). If exp < now → 'expired', else → 'ok'.
 *
 * Gemini CLI (~/.gemini/oauth_creds.json):
 *   the file (when present) carries an `expiry_date` (ms since epoch from
 *   google-auth-library convention). Compare against Date.now().
 *   The file may not exist if the user authenticated via gcloud or env
 *   var — in that case fall through to 'unknown'.
 *
 * Claude (~/.claude/) — no stable creds path; surface 'unknown' so the UI
 * keeps the legacy "binary present, login state unknown" rendering.
 */
async function probeAuthFile(
  id: string,
): Promise<{ state: AuthState; expires_at?: number | null }> {
  if (id === 'codex-local') return probeCodexAuth();
  if (id === 'gemini-cli-local') return probeGeminiAuth();
  return { state: 'unknown' };
}

async function probeCodexAuth(): Promise<{ state: AuthState; expires_at?: number | null }> {
  const path = joinPath(homedir(), '.codex', 'auth.json');
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    return { state: 'missing' };
  }
  let parsed: { tokens?: { id_token?: string; access_token?: string } };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { state: 'unknown' };
  }
  const idToken = parsed.tokens?.id_token;
  if (!idToken || typeof idToken !== 'string') {
    // ApiKey mode (auth_mode='ApiKey') has no id_token but is still 'ok' as
    // long as the file exists and access_token is set.
    return parsed.tokens?.access_token ? { state: 'ok' } : { state: 'missing' };
  }
  const exp = decodeJwtExp(idToken);
  if (exp == null) return { state: 'unknown' };
  const nowS = Math.floor(Date.now() / 1000);
  return { state: exp > nowS ? 'ok' : 'expired', expires_at: exp };
}

async function probeGeminiAuth(): Promise<{ state: AuthState; expires_at?: number | null }> {
  const path = joinPath(homedir(), '.gemini', 'oauth_creds.json');
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    // No oauth_creds.json — user may be using gcloud auth or GEMINI_API_KEY.
    // We don't know either way, so degrade to 'unknown' (binary is present).
    return { state: 'unknown' };
  }
  let parsed: { expiry_date?: number; access_token?: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { state: 'unknown' };
  }
  if (typeof parsed.expiry_date !== 'number') {
    return parsed.access_token ? { state: 'ok' } : { state: 'missing' };
  }
  const nowMs = Date.now();
  const expS = Math.floor(parsed.expiry_date / 1000);
  return {
    state: parsed.expiry_date > nowMs ? 'ok' : 'expired',
    expires_at: expS,
  };
}

function decodeJwtExp(jwt: string): number | null {
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  const payload = parts[1];
  if (!payload) return null;
  try {
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    const decoded = Buffer.from(padded + padding, 'base64').toString('utf8');
    const claims = JSON.parse(decoded);
    return typeof claims.exp === 'number' ? claims.exp : null;
  } catch {
    return null;
  }
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
