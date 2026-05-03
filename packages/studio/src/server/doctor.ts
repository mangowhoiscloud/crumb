/**
 * Lightweight adapter probe for the studio.
 *
 * Mirrors `crumb doctor` (in src/helpers/doctor.ts of the crumb repo) but
 * decoupled — no cross-package import. We extract 6 signals per adapter:
 *   1. binary present in PATH (or env var for SDK)
 *   2. version output (best-effort, doesn't require login)
 *   3. install/auth hint strings for the UI modal
 *   4. authenticated state (read from keychain / config file / env — never
 *      a CLI spawn, so no login-prompt side-effect)
 *   5. plan tier (claude `subscriptionType`, ChatGPT `chatgpt_plan_type`,
 *      etc.) for evaluator-visible display
 *   6. login expiry (for "auth expires in 12h" hint)
 *
 * Auth-state resolution chain (env-first, file-fallback) per the migration
 * plan §13.1 portability invariants:
 *   1. process.env (already exported by user shell)
 *   2. .env.local from cwd (gitignored, per-developer)
 *   3. .env from cwd (committed defaults — should be empty/non-secret)
 *   4. macOS Keychain (claude) / ~/.codex/auth.json (codex) / ~/.gemini/
 *      oauth_creds.json (gemini-cli) — local session credentials
 *   5. unauthenticated
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

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
   * Subscription / plan tier the user is currently logged into. Examples:
   *   claude → 'max' | 'pro' | 'free' | 'team' | 'enterprise'
   *   codex  → 'pro' | 'plus' | 'prolite' | 'free' | 'enterprise' | 'apikey'
   *   gemini-cli → 'advanced' | 'pro' | 'free' | (often unknown — Gemini
   *               doesn't expose plan in its OAuth token)
   *   gemini-sdk / mock → 'apikey' / 'mock'
   * Absent when the auth source doesn't expose a plan signal.
   */
  plan?: string;
  /** ISO-8601 timestamp when the current OAuth/credential expires. */
  login_expires_at?: string;
  /** Email associated with the active session. Privacy: redact display where appropriate. */
  email?: string;
  /** Where the auth signal came from (env var name, keychain, config file path). */
  auth_source?: 'env' | 'env.local' | 'env-file' | 'keychain' | 'config-file' | 'mock' | 'none';
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

/** Track whether loadEnvFiles() has already mutated process.env this session. */
let envFilesLoaded = false;

/**
 * Load `.env` and `.env.local` from cwd into `process.env`. Idempotent — only
 * fills in vars that are NOT already exported by the user shell, so explicit
 * exports always win. Per migration plan §13.1: env-first, file-fallback.
 *
 * Format: `KEY=VALUE` per line, `#` comments, blank lines OK. Values with
 * surrounding `"..."` or `'...'` are unquoted. We DO NOT pull a `dotenv`
 * dependency — the parser is ~15 lines and there is exactly one consumer.
 */
export function loadEnvFiles(cwd: string = process.cwd()): { loaded_files: string[] } {
  if (envFilesLoaded) return { loaded_files: [] };
  envFilesLoaded = true;
  const loaded: string[] = [];
  // Order matters: `.env.local` > `.env` (later only fills gaps).
  for (const name of ['.env.local', '.env']) {
    const p = join(cwd, name);
    if (!existsSync(p)) continue;
    try {
      const raw = readFileSync(p, 'utf8');
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        // env-first: never overwrite an explicit shell export.
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
      loaded.push(name);
    } catch {
      // Malformed .env should not crash the doctor — silently skip.
    }
  }
  return { loaded_files: loaded };
}

export async function probeAdapters(): Promise<AdapterStatus[]> {
  loadEnvFiles();
  return Promise.all(ADAPTERS.map(probeOne));
}

async function probeOne(
  a: Omit<AdapterStatus, 'installed' | 'authenticated' | 'version'>,
): Promise<AdapterStatus> {
  // Mock — always available, no probe needed.
  if (a.id === 'mock') {
    return { ...a, installed: true, authenticated: true, plan: 'mock', auth_source: 'mock' };
  }
  // SDK-based adapter (no binary, env var keyed).
  if (!a.binary && a.env_var) {
    const present = !!process.env[a.env_var] && process.env[a.env_var]!.length > 0;
    return {
      ...a,
      installed: present,
      authenticated: present,
      ...(present ? { plan: 'apikey', auth_source: 'env' as const } : {}),
    };
  }
  // Binary-based adapter — `which <bin>` then best-effort version.
  if (!a.binary) {
    return { ...a, installed: false, authenticated: false };
  }
  const installed = await hasBinary(a.binary);
  if (!installed) return { ...a, installed: false, authenticated: false };
  const version = await tryVersion(a.binary).catch(() => undefined);
  // Auth-detail probe: read keychain / config file. Never spawns the CLI.
  const detail = await probeAuthDetail(a.id);
  return {
    ...a,
    installed: true,
    ...(version ? { version } : {}),
    ...detail,
  };
}

/**
 * Pure-read auth detail per adapter. Reads keychain (claude on macOS) or
 * config file (codex auth.json, gemini-cli oauth_creds.json) without
 * spawning the CLI. Returns the partial AdapterStatus fields.
 */
async function probeAuthDetail(
  id: string,
): Promise<
  Pick<AdapterStatus, 'authenticated' | 'plan' | 'login_expires_at' | 'email' | 'auth_source'>
> {
  switch (id) {
    case 'claude-local':
      return probeClaudeAuth();
    case 'codex-local':
      return probeCodexAuth();
    case 'gemini-cli-local':
      return probeGeminiCliAuth();
    default:
      return { authenticated: null };
  }
}

/**
 * Claude Code: macOS Keychain entry "Claude Code-credentials" holds an OAuth
 * blob with `subscriptionType` (max/pro/free), `rateLimitTier` (granular —
 * "default_claude_max_20x" etc.), and `expiresAt` (epoch ms). On Linux/Win
 * the install layer typically writes ~/.claude/credentials.json with the
 * same JSON shape — we fall back to that.
 */
async function probeClaudeAuth(): Promise<
  Pick<AdapterStatus, 'authenticated' | 'plan' | 'login_expires_at' | 'auth_source'>
> {
  // Linux / Windows / non-keychain fallback first (cheaper).
  const fallbackPath = join(homedir(), '.claude', 'credentials.json');
  if (existsSync(fallbackPath)) {
    try {
      const raw = readFileSync(fallbackPath, 'utf8');
      return parseClaudeOauthBlob(raw, 'config-file');
    } catch {
      // fall through to keychain
    }
  }
  if (platform() !== 'darwin') {
    return { authenticated: null };
  }
  // macOS Keychain — `security find-generic-password -s ... -w` prints just the
  // password (the OAuth JSON blob).
  const blob = await readKeychainPassword('Claude Code-credentials');
  if (!blob) return { authenticated: false };
  return parseClaudeOauthBlob(blob, 'keychain');
}

function parseClaudeOauthBlob(
  raw: string,
  source: 'keychain' | 'config-file',
): Pick<AdapterStatus, 'authenticated' | 'plan' | 'login_expires_at' | 'auth_source'> {
  try {
    const obj = JSON.parse(raw) as {
      claudeAiOauth?: { subscriptionType?: string; expiresAt?: number };
    };
    const oauth = obj.claudeAiOauth;
    if (!oauth) return { authenticated: false };
    const expiresAt = typeof oauth.expiresAt === 'number' ? oauth.expiresAt : 0;
    const live = expiresAt > Date.now();
    return {
      authenticated: live,
      ...(oauth.subscriptionType ? { plan: oauth.subscriptionType } : {}),
      ...(expiresAt ? { login_expires_at: new Date(expiresAt).toISOString() } : {}),
      auth_source: source,
    };
  } catch {
    return { authenticated: false };
  }
}

/**
 * Codex CLI: ~/.codex/auth.json holds `{ auth_mode, OPENAI_API_KEY, tokens.id_token }`.
 * `auth_mode === "apikey"` → API key; `auth_mode === "chatgpt"` → JWT id_token
 * (decode payload for `chatgpt_plan_type`, `email`, `exp`).
 */
function probeCodexAuth(): Pick<
  AdapterStatus,
  'authenticated' | 'plan' | 'login_expires_at' | 'email' | 'auth_source'
> {
  const p = join(homedir(), '.codex', 'auth.json');
  if (!existsSync(p)) return { authenticated: false };
  try {
    const raw = readFileSync(p, 'utf8');
    const obj = JSON.parse(raw) as {
      auth_mode?: string;
      OPENAI_API_KEY?: string | null;
      tokens?: { id_token?: string; access_token?: string };
    };
    if (obj.auth_mode === 'apikey' && obj.OPENAI_API_KEY) {
      return { authenticated: true, plan: 'apikey', auth_source: 'config-file' };
    }
    if (obj.auth_mode === 'chatgpt' && obj.tokens?.id_token) {
      const payload = decodeJwtPayload(obj.tokens.id_token);
      const exp = typeof payload?.exp === 'number' ? payload.exp * 1000 : 0;
      const live = exp > Date.now();
      const auth = (
        payload?.['https://api.openai.com/auth'] as { chatgpt_plan_type?: string } | undefined
      )?.chatgpt_plan_type;
      return {
        authenticated: live,
        ...(auth ? { plan: auth } : {}),
        ...(typeof payload?.email === 'string' ? { email: payload.email } : {}),
        ...(exp ? { login_expires_at: new Date(exp).toISOString() } : {}),
        auth_source: 'config-file',
      };
    }
    return { authenticated: false };
  } catch {
    return { authenticated: false };
  }
}

/**
 * Gemini CLI: ~/.gemini/oauth_creds.json (when logged in via Google OAuth)
 * holds `{ access_token, refresh_token, expiry_date }`. Plan tier is NOT
 * exposed in the OAuth blob (Google AI Studio doesn't surface it via the
 * client) — we report `authenticated: true` + `plan: undefined` and the UI
 * shows just "logged in".
 */
function probeGeminiCliAuth(): Pick<
  AdapterStatus,
  'authenticated' | 'login_expires_at' | 'auth_source'
> {
  const candidates = [
    join(homedir(), '.gemini', 'oauth_creds.json'),
    join(homedir(), '.gemini', 'credentials.json'),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      const raw = readFileSync(p, 'utf8');
      const obj = JSON.parse(raw) as { expiry_date?: number; expires_at?: number };
      const exp = obj.expiry_date ?? obj.expires_at ?? 0;
      const live = exp > Date.now();
      return {
        authenticated: live,
        ...(exp ? { login_expires_at: new Date(exp).toISOString() } : {}),
        auth_source: 'config-file',
      };
    } catch {
      // try next candidate
    }
  }
  return { authenticated: null };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  const payload = parts[1];
  if (!payload) return null;
  try {
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readKeychainPassword(service: string): Promise<string | null> {
  return new Promise((resolve) => {
    const p = spawn('security', ['find-generic-password', '-s', service, '-w'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let out = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        p.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      resolve(null);
    }, 1000);
    p.stdout?.on('data', (d: Buffer) => {
      out += d.toString();
    });
    p.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(code === 0 ? out.trim() : null);
    });
    p.on('error', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(null);
    });
  });
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
