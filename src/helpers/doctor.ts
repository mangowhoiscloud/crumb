/**
 * /crumb doctor — environment readiness check.
 *
 * Inspects:
 *   - ~/.claude/ (Claude Code OAuth)
 *   - ~/.codex/auth.json (Codex CLI ChatGPT login)
 *   - ~/.gemini/auth.json or ~/.config/gcloud/ (Gemini CLI Google AI / ADC)
 *   - playwright browser binary
 *   - htmlhint (built-in regex fallback, always OK)
 *
 * Returns table + recommended preset based on what's available.
 *
 * See [[bagelcode-system-architecture-v3]] §3 (auth-manager spec).
 */

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join as joinPath } from 'node:path';
import { spawn } from 'node:child_process';

export interface HostStatus {
  host: string;
  status: 'OK' | 'MISSING' | 'DEGRADED';
  detail: string;
  action_required?: string;
}

export interface DoctorReport {
  hosts: HostStatus[];
  recommended_presets: { preset: string; viable: boolean; reason: string }[];
}

async function tryRun(
  cmd: string,
  args: string[],
  timeoutMs = 2000,
): Promise<{ exitCode: number; stdout: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    proc.stdout?.on('data', (c: Buffer) => (stdout += c.toString('utf-8')));
    const timer = setTimeout(() => proc.kill('SIGKILL'), timeoutMs);
    proc.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 1, stdout });
    });
    proc.on('error', () => {
      clearTimeout(timer);
      resolve({ exitCode: 127, stdout: '' });
    });
  });
}

async function checkClaude(): Promise<HostStatus> {
  const home = homedir();
  const claudeDir = joinPath(home, '.claude');
  if (!existsSync(claudeDir)) {
    return {
      host: 'Claude Code',
      status: 'MISSING',
      detail: '~/.claude/ 없음',
      action_required: 'npm install -g @anthropic-ai/claude-code && claude auth login',
    };
  }
  const v = await tryRun('claude', ['--version']);
  if (v.exitCode !== 0) {
    return {
      host: 'Claude Code',
      status: 'DEGRADED',
      detail: 'claude CLI 실행 실패',
      action_required: 'claude --version 으로 직접 확인',
    };
  }
  return { host: 'Claude Code', status: 'OK', detail: v.stdout.trim() || 'installed' };
}

async function checkCodex(): Promise<HostStatus> {
  const home = homedir();
  const authPath = joinPath(home, '.codex', 'auth.json');
  if (!existsSync(authPath)) {
    return {
      host: 'Codex CLI',
      status: 'MISSING',
      detail: '~/.codex/auth.json 없음',
      action_required: 'codex login (또는 OPENAI_API_KEY env)',
    };
  }
  const v = await tryRun('codex', ['--version']);
  if (v.exitCode !== 0) {
    return {
      host: 'Codex CLI',
      status: 'DEGRADED',
      detail: 'codex CLI 실행 실패',
      action_required: 'codex --version 으로 직접 확인',
    };
  }
  return { host: 'Codex CLI', status: 'OK', detail: v.stdout.trim() || 'installed' };
}

async function checkGemini(): Promise<HostStatus> {
  const home = homedir();
  const auth = joinPath(home, '.gemini', 'auth.json');
  const adc = joinPath(home, '.config', 'gcloud');
  if (!existsSync(auth) && !existsSync(adc) && !process.env.GEMINI_API_KEY) {
    return {
      host: 'Gemini CLI',
      status: 'MISSING',
      detail: '~/.gemini/ + gcloud ADC + GEMINI_API_KEY 모두 없음',
      action_required: 'gemini login (Google AI Pro/Ultra) 또는 GEMINI_API_KEY env',
    };
  }
  const v = await tryRun('gemini', ['--version']);
  if (v.exitCode !== 0) {
    return {
      host: 'Gemini CLI',
      status: 'DEGRADED',
      detail: 'gemini CLI 실행 실패',
      action_required: 'gemini --version 으로 직접 확인',
    };
  }
  return { host: 'Gemini CLI', status: 'OK', detail: v.stdout.trim() || 'installed' };
}

async function checkPlaywright(): Promise<HostStatus> {
  // v3.5 — playwright is now an optionalDependency with auto-postinstall.
  // Detect via npm package presence (not env var) so the doctor reflects
  // ground truth: did `npm install` actually pull the package down?
  // Legacy `PLAYWRIGHT_AVAILABLE=1` still honored as an opt-in override.
  if (process.env.PLAYWRIGHT_AVAILABLE === '1') {
    return { host: 'playwright', status: 'OK', detail: 'PLAYWRIGHT_AVAILABLE=1 (env override)' };
  }
  try {
    const req = (await import('node:module')).createRequire(import.meta.url);
    req.resolve('playwright/package.json');
    return { host: 'playwright', status: 'OK', detail: 'npm package resolvable' };
  } catch {
    return {
      host: 'playwright',
      status: 'MISSING',
      detail: 'npm package not installed (D6 portability skipped)',
      action_required:
        '`npm install` 다시 — playwright 가 optionalDependencies 에 있어 자동 설치됨. 명시적 설치는 `npm i -D playwright`.',
    };
  }
}

async function checkChromiumBinary(): Promise<HostStatus> {
  // qa-check-playwright launches chromium headless. Detect cached binary at
  // the standard playwright cache locations across platforms.
  const { existsSync, readdirSync } = await import('node:fs');
  const { homedir, platform } = await import('node:os');
  const { join } = await import('node:path');
  const macCache = join(homedir(), 'Library', 'Caches', 'ms-playwright');
  const linuxCache = join(homedir(), '.cache', 'ms-playwright');
  const winCache = join(process.env.LOCALAPPDATA ?? homedir(), 'ms-playwright');
  const envCache = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const candidates = [envCache, macCache, linuxCache, winCache].filter((p): p is string => !!p);
  for (const root of candidates) {
    if (!existsSync(root)) continue;
    let entries: string[] = [];
    try {
      entries = readdirSync(root);
    } catch {
      continue;
    }
    if (entries.some((e) => /^chromium(_headless_shell)?(-\d+)?$/.test(e))) {
      return { host: 'chromium binary', status: 'OK', detail: `cached at ${root}` };
    }
  }
  return {
    host: 'chromium binary',
    status: 'MISSING',
    detail: `not found in playwright cache (${platform()})`,
    action_required:
      '`npx playwright install chromium` 또는 `npm install` (postinstall 훅이 자동 설치 시도)',
  };
}

async function checkHtmlhint(): Promise<HostStatus> {
  // qa-check 의 lint 는 자체 regex 사용 — htmlhint dep 불필요
  return { host: 'htmlhint (built-in)', status: 'OK', detail: '자체 regex (4 lint rule)' };
}

export async function runDoctor(): Promise<DoctorReport> {
  const hosts = await Promise.all([
    checkClaude(),
    checkCodex(),
    checkGemini(),
    checkPlaywright(),
    checkChromiumBinary(),
    checkHtmlhint(),
  ]);
  const claudeOk = hosts[0].status === 'OK';
  const codexOk = hosts[1].status === 'OK';
  const geminiOk = hosts[2].status === 'OK';

  const recommended_presets = [
    {
      preset: 'bagelcode-cross-3way',
      viable: claudeOk && codexOk && geminiOk,
      reason:
        claudeOk && codexOk && geminiOk
          ? '✅ 3 host 모두 사용 가능. 메일 verbatim 정조준 default.'
          : '❌ 일부 host 미로그인 — builder/verifier spawn 실패 risk',
    },
    {
      preset: 'solo',
      viable: claudeOk,
      reason: claudeOk ? '✅ Claude 만 로그인 — 단일 host 모드 안전.' : '❌ Claude 도 미설치',
    },
    {
      preset: 'mock',
      viable: true,
      reason: '✅ 항상 동작 (deterministic, 외부 의존 0)',
    },
  ];

  return { hosts, recommended_presets };
}

export function formatReport(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push('🔍 Crumb 환경 점검');
  lines.push('');
  lines.push('| Host                | Status     | Detail                          |');
  lines.push('|---------------------|------------|---------------------------------|');
  for (const h of report.hosts) {
    const sym = h.status === 'OK' ? '✅ OK' : h.status === 'MISSING' ? '⚠ MISSING' : '⚠ DEGRADED';
    lines.push(
      `| ${h.host.padEnd(19)} | ${sym.padEnd(10)} | ${h.detail.slice(0, 31).padEnd(31)} |`,
    );
  }
  lines.push('');
  for (const h of report.hosts) {
    if (h.action_required) lines.push(`  • ${h.host}: ${h.action_required}`);
  }
  lines.push('');
  lines.push('## 추천 preset (현재 환경 기준)');
  for (const p of report.recommended_presets) {
    lines.push(`  - ${p.preset}  ${p.viable ? '✅' : '❌'}  ${p.reason}`);
  }
  return lines.join('\n');
}
