/**
 * Crumb CLI dispatcher — `crumb <subcommand>`.
 *  run     : start a new session
 *  event   : append a JSON event to $CRUMB_TRANSCRIPT_PATH (used by subprocess agents)
 *  replay  : re-derive state from an existing transcript (deterministic check)
 *  doctor  : adapter health check
 */

import { resolve } from 'node:path';
import { readdir, readFile, stat } from 'node:fs/promises';
import { ulid } from 'ulid';

import { runSession } from './loop/coordinator.js';
import { readAll } from './transcript/reader.js';
import { TranscriptWriter } from './transcript/writer.js';
import { reduce } from './reducer/index.js';
import { initialState } from './state/types.js';
import { ClaudeLocalAdapter } from './adapters/claude-local.js';
import { CodexLocalAdapter } from './adapters/codex-local.js';
import type { DraftMessage } from './protocol/types.js';

interface ParsedArgs {
  command: string;
  flags: Map<string, string>;
  positional: string[];
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const flags = new Map<string, string>();
  const positional: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith('--')) {
        flags.set(key, next);
        i++;
      } else {
        flags.set(key, 'true');
      }
    } else {
      positional.push(a);
    }
  }
  return { command: command ?? 'help', flags, positional };
}

async function cmdRun(args: ParsedArgs): Promise<void> {
  const goal = args.flags.get('goal');
  if (!goal) throw new Error('--goal required');
  const sessionId = args.flags.get('session') ?? ulid();
  const cwd = process.cwd();
  const sessionDir = resolve(cwd, 'sessions', sessionId);
  const repoRoot = args.flags.get('root') ?? cwd;
  const adapterOverride = args.flags.get('adapter');
  const idleTimeoutMs = Number(args.flags.get('idle-timeout') ?? 60_000);

  // eslint-disable-next-line no-console
  console.log(`[crumb] session=${sessionId} dir=${sessionDir}`);
  // eslint-disable-next-line no-console
  console.log(`[crumb] adapter=${adapterOverride ?? '(per-actor)'} repo=${repoRoot}`);

  const { state } = await runSession({
    goal,
    sessionDir,
    sessionId,
    repoRoot,
    adapterOverride,
    idleTimeoutMs,
  });

  // eslint-disable-next-line no-console
  console.log(`[crumb] done. score_history=${state.progress_ledger.score_history.length} entries`);
  // eslint-disable-next-line no-console
  console.log(`[crumb] transcript: ${resolve(sessionDir, 'transcript.jsonl')}`);
}

async function cmdEvent(): Promise<void> {
  // Read JSON from stdin, validate, append to $CRUMB_TRANSCRIPT_PATH.
  const path = process.env.CRUMB_TRANSCRIPT_PATH;
  const sessionId = process.env.CRUMB_SESSION_ID;
  if (!path || !sessionId) {
    throw new Error('CRUMB_TRANSCRIPT_PATH and CRUMB_SESSION_ID env vars required');
  }
  const raw = await readStdin();
  const draft = JSON.parse(raw) as DraftMessage;
  const writer = new TranscriptWriter({ path, sessionId });
  const msg = await writer.append(draft);
  // eslint-disable-next-line no-console
  process.stdout.write(JSON.stringify({ id: msg.id, ts: msg.ts }) + '\n');
}

async function cmdReplay(args: ParsedArgs): Promise<void> {
  const sessionDir = args.positional[0] ?? args.flags.get('session-dir');
  if (!sessionDir) throw new Error('replay <session-dir> required');
  const transcriptPath = resolve(sessionDir, 'transcript.jsonl');
  const events = await readAll(transcriptPath);
  if (events.length === 0) {
    throw new Error(`empty transcript: ${transcriptPath}`);
  }
  let state = initialState(events[0].session_id);
  let totalEffects = 0;
  for (const e of events) {
    const r = reduce(state, e);
    state = r.state;
    totalEffects += r.effects.length;
  }
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        events: events.length,
        effects_emitted: totalEffects,
        done: state.done,
        score_history: state.progress_ledger.score_history,
        last_message_kind: state.last_message?.kind,
      },
      null,
      2,
    ),
  );
}

async function cmdDoctor(): Promise<void> {
  const adapters = [new ClaudeLocalAdapter(), new CodexLocalAdapter()];
  for (const a of adapters) {
    const r = await a.health();
    const sym = r.ok ? 'ok' : 'FAIL';
    // eslint-disable-next-line no-console
    console.log(`[${sym}] ${a.id}${r.reason ? ` — ${r.reason}` : ''}`);
  }
}

async function cmdLs(args: ParsedArgs): Promise<void> {
  const cwd = args.flags.get('root') ?? process.cwd();
  const dir = resolve(cwd, 'sessions');
  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch {
    // eslint-disable-next-line no-console
    console.log('(no sessions/ directory yet)');
    return;
  }
  for (const e of entries) {
    const t = resolve(dir, e, 'transcript.jsonl');
    try {
      const s = await stat(t);
      const buf = await readFile(t, 'utf8');
      const lines = buf.split('\n').filter((l) => l.trim().length > 0);
      // eslint-disable-next-line no-console
      console.log(`${e}  ${lines.length} events  ${s.size}B`);
    } catch {
      // eslint-disable-next-line no-console
      console.log(`${e}  (no transcript)`);
    }
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks).toString('utf8');
}

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`Crumb v0.1.0 — multi-agent execution harness

Usage:
  crumb run --goal "<game pitch>" [--session <id>] [--adapter mock|claude-local|codex-local]
  crumb event                              # read JSON from stdin, append to transcript
  crumb replay <session-dir>               # re-derive state from transcript
  crumb doctor                             # adapter health check
  crumb ls                                 # list sessions/

Env (subprocess agents only):
  CRUMB_TRANSCRIPT_PATH  full path to transcript.jsonl
  CRUMB_SESSION_ID       ULID
  CRUMB_SESSION_DIR      working directory
  CRUMB_ACTOR            from-actor for emitted events
`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  switch (args.command) {
    case 'run':
      await cmdRun(args);
      break;
    case 'event':
      await cmdEvent();
      break;
    case 'replay':
      await cmdReplay(args);
      break;
    case 'doctor':
      await cmdDoctor();
      break;
    case 'ls':
      await cmdLs(args);
      break;
    case 'help':
    case '--help':
    case '-h':
    default:
      printHelp();
  }
}
