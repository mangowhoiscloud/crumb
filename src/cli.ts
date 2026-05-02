/**
 * Crumb CLI dispatcher — `crumb <subcommand>`.
 *  run     : start a new session
 *  event   : append a JSON event to $CRUMB_TRANSCRIPT_PATH (used by subprocess agents)
 *  replay  : re-derive state from an existing transcript (deterministic check)
 *  resume  : surface mid-flight state + next-speaker suggestion (S15)
 *  doctor  : full environment check
 *  config  : preset 추천
 *  debug   : F1-F7 routing 장애 진단
 *  export  : transcript → OTel GenAI / Anthropic-Trace / Chrome-Trace (§10.3)
 *  ls      : list sessions/
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
  const presetName = args.flags.get('preset');
  const idleTimeoutMs = Number(args.flags.get('idle-timeout') ?? 60_000);

  // eslint-disable-next-line no-console
  console.log(`[crumb] session=${sessionId} dir=${sessionDir}`);
  if (presetName) {
    // eslint-disable-next-line no-console
    console.log(`[crumb] preset=${presetName}`);
  }
  // eslint-disable-next-line no-console
  console.log(`[crumb] adapter=${adapterOverride ?? '(preset or ambient)'} repo=${repoRoot}`);

  const { state } = await runSession({
    goal,
    sessionDir,
    sessionId,
    repoRoot,
    adapterOverride,
    presetName,
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

/**
 * v3 S15 — resume: re-derive state from a transcript and report what's next.
 *
 * P0: surfaces last state + next_speaker so the user can decide how to continue.
 * P1: live re-entry into the coordinator loop (spawns next actor automatically).
 *
 * See [[bagelcode-system-architecture-v3]] §"S15 persistence boost".
 */
async function cmdResume(args: ParsedArgs): Promise<void> {
  const target = args.positional[0];
  if (!target) throw new Error('resume requires a session id or session-dir as positional arg');
  const cwd = args.flags.get('root') ?? process.cwd();
  // Accept either a full path or a bare session id (ULID).
  const sessionDir = target.includes('/') ? resolve(target) : resolve(cwd, 'sessions', target);
  const transcriptPath = resolve(sessionDir, 'transcript.jsonl');
  const events = await readAll(transcriptPath);
  if (events.length === 0) {
    throw new Error(`empty transcript at ${transcriptPath}`);
  }
  let state = initialState(events[0].session_id);
  for (const e of events) {
    state = reduce(state, e).state;
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        session_id: state.session_id,
        events: events.length,
        done: state.done,
        next_speaker: state.progress_ledger.next_speaker,
        last_active_actor: state.progress_ledger.last_active_actor,
        last_kind: state.last_message?.kind ?? null,
        score_history_count: state.progress_ledger.score_history.length,
        stuck_count: state.progress_ledger.stuck_count,
        circuit_breaker: state.progress_ledger.circuit_breaker,
      },
      null,
      2,
    ),
  );

  if (state.done) {
    // eslint-disable-next-line no-console
    console.log('[resume] session already done — nothing to re-enter');
    return;
  }

  // eslint-disable-next-line no-console
  console.log(
    `[resume] session is mid-flight; last event was ${state.last_message?.kind ?? '?'}; ` +
      `next_speaker=${state.progress_ledger.next_speaker ?? '?'}.`,
  );
  // eslint-disable-next-line no-console
  console.log('[resume] P0: re-derived state only. To continue mid-flight, run:');
  // eslint-disable-next-line no-console
  console.log(
    `  crumb run --session ${state.session_id} --goal "${state.task_ledger.goal ?? ''}" --root ${cwd}`,
  );
}

async function cmdDoctor(): Promise<void> {
  // v3 S12: full environment check (3 host OAuth + playwright + htmlhint).
  const { runDoctor, formatReport } = await import('./helpers/doctor.js');
  const report = await runDoctor();
  // eslint-disable-next-line no-console
  console.log(formatReport(report));

  // Legacy adapter health (still useful for adapter circuit-breaker debugging).
  // eslint-disable-next-line no-console
  console.log('\n## Adapter health (subprocess probe)');
  const adapters = [new ClaudeLocalAdapter(), new CodexLocalAdapter()];
  for (const a of adapters) {
    const r = await a.health();
    const sym = r.ok ? '✅' : '❌';
    // eslint-disable-next-line no-console
    console.log(`  ${sym} ${a.id}${r.reason ? ` — ${r.reason}` : ''}`);
  }
}

async function cmdConfig(args: ParsedArgs): Promise<void> {
  // v3 S12: /crumb config <자연어> — preset 추천.
  const naturalLanguage = args.positional.join(' ') || args.flags.get('query') || '';
  if (!naturalLanguage) {
    throw new Error(
      'config requires a natural-language description, e.g.: crumb config "솔로 셋업"',
    );
  }
  const { recommendPreset, formatRecommendation } = await import('./helpers/config.js');
  const rec = recommendPreset(naturalLanguage, args.flags.get('root') ?? process.cwd());
  // eslint-disable-next-line no-console
  console.log(formatRecommendation(rec));
}

async function cmdDebug(args: ParsedArgs): Promise<void> {
  // v3 S12: /crumb debug — F1-F7 routing 장애 진단.
  const target = args.positional[0];
  if (!target) throw new Error('debug requires a session id or session-dir');
  const cwd = args.flags.get('root') ?? process.cwd();
  const sessionDir = target.includes('/') ? resolve(target) : resolve(cwd, 'sessions', target);
  const transcriptPath = resolve(sessionDir, 'transcript.jsonl');
  const events = await readAll(transcriptPath);
  let state = initialState(events[0]?.session_id ?? 'unknown');
  for (const e of events) state = reduce(state, e).state;
  const { diagnose, formatDiagnosis } = await import('./helpers/debug.js');
  const detections = diagnose(events, state);
  // eslint-disable-next-line no-console
  console.log(formatDiagnosis(detections));
}

async function cmdStatus(args: ParsedArgs): Promise<void> {
  const target = args.positional[0];
  if (!target) throw new Error('status requires a session id or session-dir');
  const cwd = args.flags.get('root') ?? process.cwd();
  const sessionDir = target.includes('/') ? resolve(target) : resolve(cwd, 'sessions', target);
  const transcriptPath = resolve(sessionDir, 'transcript.jsonl');
  const events = await readAll(transcriptPath);
  let state = initialState(events[0]?.session_id ?? 'unknown');
  for (const e of events) state = reduce(state, e).state;
  const { computeStatus, formatStatus } = await import('./helpers/status.js');
  // eslint-disable-next-line no-console
  console.log(formatStatus(computeStatus(events, state)));
}

async function cmdExplain(args: ParsedArgs): Promise<void> {
  const query = args.positional.join(' ') || args.flags.get('kind') || '';
  if (!query) throw new Error('explain requires a kind name (e.g.: crumb explain qa.result)');
  const { explainKind, formatExplain } = await import('./helpers/explain.js');
  // eslint-disable-next-line no-console
  console.log(formatExplain(explainKind(query)));
}

async function cmdSuggest(args: ParsedArgs): Promise<void> {
  const target = args.positional[0];
  if (!target) throw new Error('suggest requires a session id or session-dir');
  const cwd = args.flags.get('root') ?? process.cwd();
  const sessionDir = target.includes('/') ? resolve(target) : resolve(cwd, 'sessions', target);
  const transcriptPath = resolve(sessionDir, 'transcript.jsonl');
  const events = await readAll(transcriptPath);
  let state = initialState(events[0]?.session_id ?? 'unknown');
  for (const e of events) state = reduce(state, e).state;
  const { suggestNext, formatSuggestion } = await import('./helpers/suggest.js');
  // eslint-disable-next-line no-console
  console.log(formatSuggestion(suggestNext(events, state)));
}

async function cmdTui(args: ParsedArgs): Promise<void> {
  const target = args.positional[0];
  if (!target) throw new Error('tui <session-id|dir> required');
  const cwd = args.flags.get('root') ?? process.cwd();
  const sessionDir = target.includes('/') ? resolve(target) : resolve(cwd, 'sessions', target);
  const { runTui } = await import('./tui/app.js');
  await runTui({ sessionDir });
}

async function cmdExport(args: ParsedArgs): Promise<void> {
  const target = args.positional[0];
  if (!target) throw new Error('export <session-id|dir> required');
  const cwd = args.flags.get('root') ?? process.cwd();
  const sessionDir = target.includes('/') ? resolve(target) : resolve(cwd, 'sessions', target);
  const transcriptPath = resolve(sessionDir, 'transcript.jsonl');
  const events = await readAll(transcriptPath);
  const formatRaw = args.flags.get('format') ?? 'otel-jsonl';
  const allowed = ['otel-jsonl', 'anthropic-trace', 'chrome-trace'];
  if (!allowed.includes(formatRaw)) {
    throw new Error(`unknown --format ${formatRaw}. allowed: ${allowed.join(', ')}`);
  }
  const { serialize } = await import('./exporter/otel.js');
  const out = serialize(formatRaw as 'otel-jsonl' | 'anthropic-trace' | 'chrome-trace', events);
  process.stdout.write(out);
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
  crumb run --goal "<game pitch>" [--session <id>] [--preset <name>] [--adapter <id>]
  crumb event                              # read JSON from stdin, append to transcript
  crumb replay <session-dir>               # re-derive state from transcript
  crumb resume <session-id|dir>            # re-derive state + surface mid-flight resume command (S15)
  crumb doctor                             # full environment check (3 host OAuth + adapter health)
  crumb config <자연어>                     # preset 추천 (Crumb 추천만, 사용자 선택)
  crumb debug <session-id|dir>             # F1-F7 routing 장애 진단
  crumb status <session-id|dir>            # 진행 상황 + last 10 events + scores
  crumb explain <kind>                     # 39 kind schema lookup
  crumb suggest <session-id|dir>           # 다음 사용자 액션 추천
  crumb tui <session-id|dir>               # blessed live observer (P0)
  crumb export <session-id|dir> [--format otel-jsonl|anthropic-trace|chrome-trace]
                                          # transcript → OTel GenAI / Anthropic / chrome://tracing
  crumb ls                                 # list sessions/

Flags (run):
  --preset <name>     load .crumb/presets/<name>.toml. e.g. bagelcode-cross-3way / mock /
                      sdk-enterprise / solo. provider × harness × model 결정은 사용자 통제권.
                      명시 없으면 ambient (entry host 따라감).
  --adapter <id>      force every actor to one adapter (override preset). claude-local /
                      codex-local / mock. 디버깅용.

Env (subprocess agents only):
  CRUMB_TRANSCRIPT_PATH  full path to transcript.jsonl
  CRUMB_SESSION_ID       ULID
  CRUMB_SESSION_DIR      working directory
  CRUMB_ACTOR            from-actor for emitted events
  CRUMB_AMBIENT_HARNESS  override ambient harness detection (claude-code / codex / gemini-cli)
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
    case 'resume':
      await cmdResume(args);
      break;
    case 'doctor':
      await cmdDoctor();
      break;
    case 'config':
      await cmdConfig(args);
      break;
    case 'debug':
      await cmdDebug(args);
      break;
    case 'status':
      await cmdStatus(args);
      break;
    case 'explain':
      await cmdExplain(args);
      break;
    case 'suggest':
      await cmdSuggest(args);
      break;
    case 'tui':
      await cmdTui(args);
      break;
    case 'export':
      await cmdExport(args);
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
