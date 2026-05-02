/**
 * Crumb MCP write tools — `crumb_run` (spawn detached session) and
 * `crumb_intervene` (append slash-command line to session inbox.txt).
 *
 * Split from `mcp-server.ts` so the read-only tool registry stays self-contained
 * and the write surface is auditable in isolation. `mcp-server.ts` invokes
 * `registerWriteTools(server, root)` once at the end of `buildServer()`.
 *
 * Both tools are gated by the host CLI's tool-permission model — neither is
 * auto-invoked.
 */

import { spawn } from 'node:child_process';
import { existsSync, openSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ulid } from 'ulid';
import { z } from 'zod';

import {
  ensureCrumbHome,
  ensureProjectDir,
  ensureSessionRoot,
  resolveSessionDir as resolveStoredSession,
} from './paths.js';
import { newMeta, writeMeta } from './session/meta.js';

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function errorResult(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true };
}

/**
 * Resolve the `crumb` invocation command for spawning a detached session.
 * Prefer the built `dist/index.js` (so a global `npm link` works), fall back
 * to `npx tsx src/index.ts` for dev mode. `CRUMB_BIN` env var overrides.
 */
function resolveCrumbCommand(repoRoot: string): { cmd: string; args: string[] } {
  const override = process.env.CRUMB_BIN;
  if (override) return { cmd: override, args: [] };
  const distPath = resolve(repoRoot, 'dist', 'index.js');
  if (existsSync(distPath)) return { cmd: process.execPath, args: [distPath] };
  return { cmd: 'npx', args: ['tsx', resolve(repoRoot, 'src', 'index.ts')] };
}

interface InboxLineSpec {
  action: string;
  body?: string;
  target_actor?: string;
  swap_to?: string;
}

/** Mirror of `src/inbox/parser.ts` slash-command grammar — keep in sync. */
function buildInboxLine(s: InboxLineSpec): string | null {
  const at = s.target_actor ? `@${s.target_actor}` : '';
  const body = s.body?.trim() ?? '';
  switch (s.action) {
    case 'approve':
      return '/approve';
    case 'veto':
      return body ? `/veto ${body}` : '/veto';
    case 'pause':
      return at ? `/pause ${at}${body ? ` ${body}` : ''}` : body ? `/pause ${body}` : '/pause';
    case 'resume':
      return at ? `/resume ${at}` : '/resume';
    case 'redo':
      return body ? `/redo ${body}` : '/redo';
    case 'goto':
      if (!s.target_actor) return null;
      return body ? `/goto ${s.target_actor} ${body}` : `/goto ${s.target_actor}`;
    case 'append':
      if (!body) return null;
      return at ? `/append ${at} ${body}` : `/append ${body}`;
    case 'note':
      if (!body) return null;
      return `/note ${body}`;
    case 'reset_circuit':
      if (!s.target_actor && !body) return null;
      return `/reset-circuit ${s.target_actor ?? body}`;
    case 'swap':
      if (!s.target_actor || !s.swap_to) return null;
      return `/swap ${s.target_actor}=${s.swap_to}`;
    case 'free':
      if (!body) return null;
      return body;
    default:
      return null;
  }
}

export function registerWriteTools(server: McpServer, root: string): void {
  // ─── Tool 9 — spawn a new Crumb session (write, detached subprocess) ────
  server.registerTool(
    'crumb_run',
    {
      title: 'Spawn a new Crumb session',
      description:
        'Spawn a new Crumb game-prototyping session in the background. Returns { session_id, session_dir, log_path } immediately — the actual run happens in a detached subprocess so the host CLI is never blocked. Use after the user pitches a casual game in natural Korean or English ("60초 매치-3 콤보 보너스", "make a 30s tap defender", "캐주얼 퍼즐 만들어줘") OR explicitly types `/crumb <pitch>`. Pair with `crumb_status` for live progress polling. Crumb suggests presets via `crumb_doctor` but never picks one — pass `preset` only when the user named one. Do NOT trigger for general code requests, library questions, non-game tasks, or 3D/FPS/MMO pitches (Phaser single-file fit).',
      inputSchema: {
        goal: z
          .string()
          .min(1)
          .describe(
            'One-line casual-game pitch (Korean or English). Strip "/crumb" prefix and trailing 만들어줘 / 만들어 / make / build.',
          ),
        preset: z
          .string()
          .optional()
          .describe(
            'Preset name from .crumb/presets/. e.g. bagelcode-cross-3way / mock / sdk-enterprise / solo. Omit for ambient (entry host follows). Pass only when user explicitly named one.',
          ),
        adapter: z
          .string()
          .optional()
          .describe(
            'Force every actor to one adapter (debug only): claude-local / codex-local / mock. Overrides preset. Omit in normal use.',
          ),
        idle_timeout_ms: z
          .number()
          .int()
          .min(1000)
          .max(3_600_000)
          .optional()
          .describe('Idle timeout in ms (default 60000). Use 5000 for mock smoke runs.'),
        label: z.string().optional().describe('Human label for `crumb ls` output.'),
      },
    },
    async ({ goal, preset, adapter, idle_timeout_ms, label }) => {
      try {
        const sessionId = ulid();
        await ensureCrumbHome();
        await ensureProjectDir(root);
        const sessionDir = await ensureSessionRoot(root, sessionId);
        await writeMeta(sessionDir, newMeta({ sessionId, goal, preset, label }));

        const logPath = resolve(sessionDir, 'crumb.log');
        const logFd = openSync(logPath, 'a');

        const cliArgs = ['run', '--session', sessionId, '--goal', goal, '--root', root];
        if (preset) cliArgs.push('--preset', preset);
        if (adapter) cliArgs.push('--adapter', adapter);
        if (idle_timeout_ms) cliArgs.push('--idle-timeout', String(idle_timeout_ms));
        if (label) cliArgs.push('--label', label);

        const { cmd, args: prefix } = resolveCrumbCommand(root);
        const child = spawn(cmd, [...prefix, ...cliArgs], {
          cwd: root,
          detached: true,
          stdio: ['ignore', logFd, logFd],
          env: {
            ...process.env,
            CRUMB_AMBIENT_HARNESS: process.env.CRUMB_AMBIENT_HARNESS ?? 'claude-code',
          },
        });
        child.unref();

        const lines = [
          `Crumb session spawned (detached, pid=${child.pid ?? 'unknown'}).`,
          `  session_id  = ${sessionId}`,
          `  session_dir = ${sessionDir}`,
          `  log_path    = ${logPath}`,
          `  preset      = ${preset ?? '(ambient)'}`,
          ``,
          `Poll progress with:`,
          `  mcp__crumb__crumb_status({ session: "${sessionId}" })`,
          ``,
          `Intervene with:`,
          `  mcp__crumb__crumb_intervene({ session: "${sessionId}", action: "approve" | "veto" | ... })`,
        ];
        return textResult(lines.join('\n'));
      } catch (e) {
        return errorResult(
          `Failed to spawn session: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
  );

  // ─── Tool 10 — intervene mid-flight (write, inbox.txt append) ───────────
  server.registerTool(
    'crumb_intervene',
    {
      title: 'Intervene in a running Crumb session',
      description:
        'Send an intervention to a running Crumb session by appending one slash-command line to its inbox.txt (the headless equivalent of the TUI slash bar). The watcher (500ms poll) parses it into a transcript event the same turn. Use when the user wants to approve / veto / pause / resume / redo / goto / append-to-sandwich / leave a note / send free text. Same grammar as TUI muscle memory (see src/inbox/parser.ts).',
      inputSchema: {
        session: z.string().describe('Session ULID or path to sessions/<id>/.'),
        action: z
          .enum([
            'approve',
            'veto',
            'pause',
            'resume',
            'redo',
            'goto',
            'append',
            'note',
            'reset_circuit',
            'swap',
            'free',
          ])
          .describe(
            'approve | veto | pause | resume | redo | goto | append | note | reset_circuit | swap | free. "free" appends raw body as user.intervene.',
          ),
        body: z
          .string()
          .optional()
          .describe(
            'Body / reason / target msg id / free-text. Required for note/free; optional for pause/veto/redo/goto/append.',
          ),
        target_actor: z
          .string()
          .optional()
          .describe(
            'Target actor (planner-lead / builder / verifier / builder-fallback / researcher / coordinator). Used by goto / append / pause-actor / resume-actor / reset_circuit / swap.',
          ),
        swap_to: z
          .string()
          .optional()
          .describe('For action=swap: adapter id to swap to (e.g. mock).'),
      },
    },
    async ({ session, action, body, target_actor, swap_to }) => {
      try {
        const sessionDir = await resolveStoredSession(session, root);
        if (!existsSync(sessionDir)) {
          return errorResult(`session dir not found: ${sessionDir}`);
        }
        const inboxPath = resolve(sessionDir, 'inbox.txt');
        const line = buildInboxLine({ action, body, target_actor, swap_to });
        if (!line) {
          return errorResult(
            `cannot build inbox line for action=${action} (missing required field?)`,
          );
        }
        await appendFile(inboxPath, line + '\n', 'utf8');
        return textResult(`Appended to ${inboxPath}:\n  ${line}`);
      } catch (e) {
        return errorResult(`Failed to intervene: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );
}
