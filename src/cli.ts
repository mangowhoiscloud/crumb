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
import { fileURLToPath } from 'node:url';
import { existsSync, createReadStream, readFileSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { createInterface } from 'node:readline';
import { ulid } from 'ulid';

import { runSession } from './loop/coordinator.js';
import { readAll } from './transcript/reader.js';
import { getTranscriptWriter, type TranscriptWriter } from './transcript/writer.js';
import { reduce } from './reducer/index.js';
import {
  initialState,
  isGenreProfile,
  isPersistenceProfile,
  GENRE_PROFILES,
  PERSISTENCE_PROFILES,
} from './state/types.js';
import { ClaudeLocalAdapter } from './adapters/claude-local.js';
import { CodexLocalAdapter } from './adapters/codex-local.js';
import {
  ensureCrumbHome,
  ensureProjectDir,
  ensureSessionRoot,
  getSessionsDir,
  getVersionsDir,
  resolveSessionDir as resolveStoredSession,
} from './paths.js';
import { formatMigrateResult, migrateLegacySessions } from './session/migrate.js';
import { newMeta, readMeta, updateMeta, writeMeta } from './session/meta.js';
import {
  deriveScorecard,
  deriveSourceEventId,
  nextSequentialVersion,
  readAllManifests,
  readManifest,
  snapshotArtifacts,
  versionDirName,
  writeManifest,
  type VersionManifest,
} from './session/version.js';
import type { DraftMessage, Harness, Message, Provider } from './protocol/types.js';

interface ParsedArgs {
  command: string;
  flags: Map<string, string>;
  /**
   * v0.5 PR-Bindings — repeating-flag values. Currently only `--bind` uses
   * this (the per-actor binding override surface) — every occurrence appends
   * one entry to multi.get('bind') so `--bind a=x --bind b=y` lands as
   * ['a=x','b=y']. Single-occurrence flags continue to use `flags`.
   */
  multi: Map<string, string[]>;
  positional: string[];
}

const REPEATING_FLAGS = new Set(['bind']);

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const flags = new Map<string, string>();
  const multi = new Map<string, string[]>();
  const positional: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = rest[i + 1];
      const value = next && !next.startsWith('--') ? next : 'true';
      if (next && !next.startsWith('--')) i++;
      if (REPEATING_FLAGS.has(key)) {
        const arr = multi.get(key) ?? [];
        arr.push(value);
        multi.set(key, arr);
      } else {
        flags.set(key, value);
      }
    } else {
      positional.push(a);
    }
  }
  return { command: command ?? 'help', flags, multi, positional };
}

/**
 * v0.3.1: locate the repo root by walking up from THIS module's location until a
 * marker (`AGENTS.md` + `agents/` dir) is found. Resolves both `npm link`
 * symlinks and `npm i -g` global installs to the actual repo, so `crumb run`
 * works from any cwd without `--root` (Bagelcode reviewer expectation:
 * clone → npm install → crumb run with no host-specific paths).
 */
/**
 * Read package.json#version once, cached. Falls back to '0.0.0-dev' if the
 * package.json cannot be located (single-file install scenario). Single
 * source of truth for the CLI's --version output and printHelp() banner.
 */
let cachedVersion: string | null = null;
function readPackageVersion(): string {
  if (cachedVersion !== null) return cachedVersion;
  const root = inferRepoRoot();
  if (root) {
    try {
      const raw = readFileSync(resolve(root, 'package.json'), 'utf8');
      const parsed = JSON.parse(raw) as { version?: string };
      if (typeof parsed.version === 'string' && parsed.version.length > 0) {
        cachedVersion = parsed.version;
        return cachedVersion;
      }
    } catch {
      // fall through to default
    }
  }
  cachedVersion = '0.0.0-dev';
  return cachedVersion;
}

function inferRepoRoot(): string | null {
  // import.meta.url resolves to dist/cli.js (after build) or src/cli.ts (tsx);
  // either way the repo root is 2 levels up.
  let dir: string;
  try {
    const here = fileURLToPath(import.meta.url); // .../dist/cli.js or .../src/cli.ts
    dir = resolve(here, '..', '..');
  } catch {
    dir = resolve(process.argv[1] ?? '', '..', '..');
  }
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'AGENTS.md')) && existsSync(resolve(dir, 'agents'))) {
      return dir;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

async function cmdRun(args: ParsedArgs): Promise<void> {
  const goal = args.flags.get('goal');
  if (!goal) throw new Error('--goal required');
  const sessionId = args.flags.get('session') ?? ulid();
  const cwd = process.cwd();
  // v0.3.1: auto-detect repo root from the running script so `crumb` works from
  // any cwd without `--root` (Bagelcode reviewer expectation: clone → npm
  // install → crumb run, no host-specific paths). Fallback chain:
  //   1. --root flag (explicit)
  //   2. CRUMB_REPO_ROOT env (CI / packaged shim)
  //   3. inferred from dist/ install location (npm link / npm i -g) walking up
  //      until a CRUMB.md or AGENTS.md is found
  //   4. cwd (legacy fallback)
  const repoRoot = args.flags.get('root') ?? process.env.CRUMB_REPO_ROOT ?? inferRepoRoot() ?? cwd;
  // v0.3.0: sessions live under ~/.crumb/projects/<id>/sessions/<ulid>/.
  // The cwd determines project id (sha256 ambient or pinned via .crumb/project.toml).
  await ensureCrumbHome();
  await ensureProjectDir(cwd);
  const sessionDir = await ensureSessionRoot(cwd, sessionId);
  const adapterOverride = args.flags.get('adapter');
  const presetName = args.flags.get('preset');
  const label = args.flags.get('label');
  // v0.5 PR-Bindings — `--bind <actor>=<harness>[:<model>]` (repeating).
  // Highest-priority overlay above .crumb/config.toml + preset, so the studio's
  // "Custom binding" grid actually reaches the dispatcher (was UI residue
  // before this PR). When --preset is also given, bindings overlay onto that
  // preset; without --preset, a synthetic preset is constructed via
  // loadBindingsOnly. Skipped when no --bind flags are present (ambient).
  const cliBindings: Array<{ actor: string; harness?: string; model?: string }> = [];
  for (const raw of args.multi.get('bind') ?? []) {
    const m = raw.match(/^([\w-]+)=([\w.-]*)(?::(.+))?$/);
    if (!m) {
      throw new Error(`--bind must be <actor>=<harness>[:<model>]; got: ${raw}`);
    }
    const [, actor, harness, model] = m;
    cliBindings.push({
      actor,
      ...(harness ? { harness } : {}),
      ...(model ? { model } : {}),
    });
  }
  const idleTimeoutMs = Number(args.flags.get('idle-timeout') ?? 60_000);
  // v0.3.1: per-spawn timeout flag (override 10-min default for slow Claude wakes
  // or fast mock runs). Default `undefined` → dispatcher's PER_SPAWN_TIMEOUT_MS.
  const perSpawnTimeoutFlag = args.flags.get('per-spawn-timeout');
  const perSpawnTimeoutMs = perSpawnTimeoutFlag ? Number(perSpawnTimeoutFlag) : undefined;
  // v0.4: --video-refs <url1>,<url2>,... — populates goal.data.video_refs so
  // reducer routes researcher to the gemini-sdk video path. Skipped (text-only)
  // when absent. Studio's "Video research" toggle lands here via /api/crumb/run.
  const videoRefsFlag = args.flags.get('video-refs');
  const videoRefs = videoRefsFlag
    ? videoRefsFlag
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : undefined;
  // v0.4: --genre / --persistence flags pre-select profile axes. When absent
  // the planner-lead resolves auto-detect (genre) / runs §1.4 trigger
  // (persistence). Validate against the enum so a typo dies fast at CLI
  // boundary instead of silently dropping in the reducer.
  const genreProfile = args.flags.get('genre');
  if (genreProfile && !isGenreProfile(genreProfile)) {
    throw new Error(`--genre must be one of: ${GENRE_PROFILES.join(' | ')}; got: ${genreProfile}`);
  }
  const persistenceProfile = args.flags.get('persistence');
  if (persistenceProfile && !isPersistenceProfile(persistenceProfile)) {
    throw new Error(
      `--persistence must be one of: ${PERSISTENCE_PROFILES.join(' | ')}; got: ${persistenceProfile}`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(`[crumb] session=${sessionId} dir=${sessionDir}`);
  if (presetName) {
    // eslint-disable-next-line no-console
    console.log(`[crumb] preset=${presetName}`);
  }
  // eslint-disable-next-line no-console
  console.log(`[crumb] adapter=${adapterOverride ?? '(preset or ambient)'} repo=${repoRoot}`);

  // v0.5 — Studio auto-spawn (Streamlit/Vite frontier convention).
  // Skipped via --no-studio flag or CRUMB_NO_STUDIO=1 env (CI / SSH / headless).
  // Detached + unref'd so it outlives this run; the existing chokidar watcher
  // picks up the new transcript automatically.
  const studioDisabled = args.flags.has('no-studio') || process.env.CRUMB_NO_STUDIO === '1';
  if (!studioDisabled) {
    await ensureStudioRunning(sessionId, sessionDir);
  }

  // v0.3.0: write meta.json on start. If --session refers to an existing meta we
  // patch its status; otherwise create a fresh one. This makes resume + ls O(1).
  const existingMeta = await readMeta(sessionDir);
  if (existingMeta) {
    await updateMeta(sessionDir, { status: 'running' });
  } else {
    await writeMeta(sessionDir, newMeta({ sessionId, goal, preset: presetName, label }));
  }

  try {
    const { state } = await runSession({
      goal,
      sessionDir,
      sessionId,
      repoRoot,
      adapterOverride,
      ...(videoRefs && videoRefs.length > 0 ? { videoRefs } : {}),
      ...(genreProfile ? { genreProfile } : {}),
      ...(persistenceProfile ? { persistenceProfile } : {}),
      presetName,
      ...(cliBindings.length > 0 ? { cliBindings } : {}),
      idleTimeoutMs,
      perSpawnTimeoutMs,
    });

    await updateMeta(sessionDir, {
      status: state.done ? 'done' : 'paused',
      ended_at: new Date().toISOString(),
    });

    // eslint-disable-next-line no-console
    console.log(
      `[crumb] done. score_history=${state.progress_ledger.score_history.length} entries`,
    );
    // eslint-disable-next-line no-console
    console.log(`[crumb] transcript: ${resolve(sessionDir, 'transcript.jsonl')}`);
  } catch (err) {
    await updateMeta(sessionDir, {
      status: 'error',
      ended_at: new Date().toISOString(),
    });
    throw err;
  }
}

/**
 * Forged-event firewall (anti-deception architecture invariants #4-5).
 *
 * Only the dispatcher may emit `from=system` events or `kind=qa.result`. All
 * legitimate paths (qa-runner, sandwich assembler, release/version helpers)
 * call writer.append() directly and never traverse this subprocess CLI. An
 * LLM-driven actor reaching cmdEvent with from='system' or kind='qa.result'
 * is attempting to forge ground truth — reject the forgery and append a
 * `kind=audit` violation so the attempt stays on record.
 *
 * Without this, a verifier subprocess could emit
 *   {"from":"system","kind":"qa.result","data":{"exec_exit_code":0}}
 * and have D2/D6 lookups treat it as deterministic ground truth (anti-
 * deception Rule 1/2 stash exec_exit_code without checking provenance).
 *
 * Returns the actor-emitted Message on success, or a CrumbEventRejection
 * describing the violation. Either way the writer is unchanged for the
 * forged draft — only the audit event is appended.
 */
export interface CrumbEventRejection {
  rejected: true;
  violation: 'forged_system_event_attempt' | 'forged_qa_result_attempt';
  audit_id: string;
}

export async function applyEventFirewall(
  draft: DraftMessage,
  writer: TranscriptWriter,
  ctx: { sessionId: string; actor: string | undefined },
): Promise<{ rejected: false; message: Message } | CrumbEventRejection> {
  const forgedSystem = draft.from === 'system';
  const forgedQaResult = draft.kind === 'qa.result';
  if (forgedSystem || forgedQaResult) {
    const violation = forgedQaResult ? 'forged_qa_result_attempt' : 'forged_system_event_attempt';
    const audit = await writer.append({
      session_id: ctx.sessionId,
      from: 'system',
      kind: 'audit',
      body: `rejected forged event from actor=${ctx.actor ?? 'unknown'}: ${violation} (attempted from=${draft.from}, kind=${draft.kind})`,
      data: {
        violation,
        actor: ctx.actor ?? null,
        attempted_from: draft.from,
        attempted_kind: draft.kind,
        attempted_body: typeof draft.body === 'string' ? draft.body.slice(0, 200) : null,
      },
      metadata: { deterministic: true, tool: 'crumb-event-firewall@v1' },
    });
    return { rejected: true, violation, audit_id: audit.id };
  }
  const message = await writer.append(draft);
  return { rejected: false, message };
}

/**
 * Stamp provenance metadata onto an actor-emitted draft before append.
 *
 *
 *   - `metadata.harness` ← `CRUMB_HARNESS` env (binding-resolved by dispatcher).
 *   - `metadata.provider` ← `CRUMB_PROVIDER` env. Without this, anti-deception
 *     Rule 4 (validator/anti-deception.ts:111) can't compare verifier-vs-
 *     builder providers — the `judgeScore.metadata.provider` it reads would
 *     be undefined.
 *   - `metadata.model` ← `CRUMB_MODEL` env.
 *   - `metadata.cross_provider` ← (CRUMB_PROVIDER !== CRUMB_BUILDER_PROVIDER),
 *     set only on `kind=judge.score`. AGENTS.md §136 invariant.
 *
 * AGENTS.md §135: "Every emitted message sets metadata.harness +
 * metadata.provider + metadata.model per the active preset binding."
 *
 * Actor-supplied metadata wins (no overwrite) — this is provenance fallback,
 * not enforcement.
 */
const VALID_PROVIDERS = new Set(['anthropic', 'openai', 'google', 'none']);
const VALID_HARNESSES = new Set([
  'claude-code',
  'codex',
  'gemini-cli',
  'gemini-sdk',
  'anthropic-sdk',
  'openai-sdk',
  'google-sdk',
  'mock',
  'none',
]);

export function stampEnvMetadata(draft: DraftMessage, env: NodeJS.ProcessEnv): DraftMessage {
  const harness = env.CRUMB_HARNESS;
  const provider = env.CRUMB_PROVIDER;
  const model = env.CRUMB_MODEL;
  const builderProvider = env.CRUMB_BUILDER_PROVIDER;
  const md = { ...(draft.metadata ?? {}) };
  let mutated = false;
  if (harness && VALID_HARNESSES.has(harness) && md.harness === undefined) {
    md.harness = harness as Harness;
    mutated = true;
  }
  if (provider && VALID_PROVIDERS.has(provider) && md.provider === undefined) {
    md.provider = provider as Provider;
    mutated = true;
  }
  if (model && md.model === undefined) {
    md.model = model;
    mutated = true;
  }
  if (
    draft.kind === 'judge.score' &&
    provider &&
    builderProvider &&
    md.cross_provider === undefined
  ) {
    md.cross_provider = provider !== builderProvider;
    mutated = true;
  }
  // v0.5 PR-Inbox-Console — Tier 3 stamp. CRUMB_CONSUMED_INTERVENE_IDS env
  // is a comma-separated list set by the dispatcher at spawn-start (drained
  // from progress_ledger.pending_intervene_ids). Every event the actor
  // emits during this spawn carries it via metadata.consumed_intervene_ids,
  // letting the studio inbox panel group actor responses under the user
  // input that originated them. Never overwrites — actor may set its own.
  const consumedRaw = env.CRUMB_CONSUMED_INTERVENE_IDS;
  if (consumedRaw && md.consumed_intervene_ids === undefined) {
    const ids = consumedRaw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (ids.length > 0) {
      md.consumed_intervene_ids = ids;
      mutated = true;
    }
  }
  return mutated ? { ...draft, metadata: md } : draft;
}

async function cmdEvent(args: ParsedArgs): Promise<void> {
  // `crumb event tail` — stream filtered transcript events (default: strip private).
  if (args.positional[0] === 'tail') {
    await cmdEventTail(args);
    return;
  }
  // `crumb event` (no positional) — read JSON from stdin, validate via firewall +
  // writer, append to $CRUMB_TRANSCRIPT_PATH.
  const path = process.env.CRUMB_TRANSCRIPT_PATH;
  const sessionId = process.env.CRUMB_SESSION_ID;
  const actor = process.env.CRUMB_ACTOR;
  if (!path || !sessionId) {
    throw new Error('CRUMB_TRANSCRIPT_PATH and CRUMB_SESSION_ID env vars required');
  }
  const raw = await readStdin();
  const draft = stampEnvMetadata(JSON.parse(raw) as DraftMessage, process.env);
  const writer = getTranscriptWriter({ path, sessionId });
  const result = await applyEventFirewall(draft, writer, { sessionId, actor });
  if (result.rejected) {
    process.stdout.write(
      JSON.stringify({
        rejected: true,
        violation: result.violation,
        audit_id: result.audit_id,
      }) + '\n',
    );
    process.exitCode = 2;
    return;
  }
  // eslint-disable-next-line no-console
  process.stdout.write(JSON.stringify({ id: result.message.id, ts: result.message.ts }) + '\n');
}

export interface FilterTranscriptOpts {
  /** When true, bypass the visibility filter — admin / replay use case. */
  showAll?: boolean;
  /** Optional kind allowlist; applied AFTER visibility. */
  kinds?: string[];
}

/**
 * Decide whether a transcript JSONL line should be printed by `crumb event tail`.
 * Returns the input line unchanged if it should pass through, or `null` if it
 * should be filtered. Blank / non-JSON lines are filtered as `null`.
 *
 * AGENTS.md "Don't" rule: raw chain-of-thought lives in `kind=agent.thought_summary`
 * with `metadata.visibility="private"` only. The default tail filter strips those
 * so downstream actors (verifier, studio, evaluators) never see the implementer's
 * private deliberation. Use `--all` for replay / debugging.
 */
export function filterTranscriptLine(line: string, opts: FilterTranscriptOpts = {}): string | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;
  let parsed: { kind?: string; metadata?: { visibility?: string } };
  try {
    parsed = JSON.parse(trimmed) as typeof parsed;
  } catch {
    return null;
  }
  if (!opts.showAll && parsed.metadata?.visibility === 'private') {
    return null;
  }
  if (opts.kinds && opts.kinds.length > 0) {
    if (!parsed.kind || !opts.kinds.includes(parsed.kind)) return null;
  }
  return line;
}

async function cmdEventTail(args: ParsedArgs): Promise<void> {
  const path = args.flags.get('path') ?? process.env.CRUMB_TRANSCRIPT_PATH;
  if (!path) {
    throw new Error('CRUMB_TRANSCRIPT_PATH env var or --path required');
  }
  if (!existsSync(path)) {
    throw new Error(`transcript not found: ${path}`);
  }
  const showAll = args.flags.get('all') === 'true' || args.flags.has('all');
  const kindsFlag = args.flags.get('kinds');
  const kinds = kindsFlag
    ? kindsFlag
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : undefined;
  const opts: FilterTranscriptOpts = { showAll, kinds };

  // Stream line-by-line — sessions can have thousands of events; never buffer.
  const stream = createReadStream(path, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    const out = filterTranscriptLine(line, opts);
    if (out !== null) {
      process.stdout.write(out + '\n');
    }
  }
}

async function cmdReplay(args: ParsedArgs): Promise<void> {
  const target = args.positional[0] ?? args.flags.get('session-dir');
  if (!target) throw new Error('replay <session-id|dir> required');
  const cwd = process.cwd();
  const sessionDir = await resolveStoredSession(target, cwd);
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
 * v0.1 S15 — resume: re-derive state from a transcript and report what's next.
 *
 * P0: surfaces last state + next_speaker so the user can decide how to continue.
 * P1: live re-entry into the coordinator loop (spawns next actor automatically).
 *
 * See [[bagelcode-system-architecture-v0.1]] §"S15 persistence boost".
 */
async function cmdResume(args: ParsedArgs): Promise<void> {
  const target = args.positional[0];
  if (!target) throw new Error('resume requires a session id or session-dir as positional arg');
  const cwd = process.cwd();
  // Accept either a full path or a bare session id (ULID).
  const sessionDir = await resolveStoredSession(target, cwd);
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

  // PR-G7-B — `crumb resume <id> --run` re-enters the coordinator loop in
  // process. Without `--run` the legacy print-the-command behavior is kept
  // (callers that scrape stdout). With `--force` a `done` session also
  // re-enters — useful when the prior exit was budget-only (token_exhausted /
  // wall_clock_exhausted) and the user has bumped the budget for the retry.
  const autoRun = args.flags.has('run') || args.flags.has('auto');
  const force = args.flags.has('force');

  if (state.done && !force) {
    // eslint-disable-next-line no-console
    console.log(
      '[resume] session already done — pass --force to re-enter (budget-exhausted retry)',
    );
    return;
  }

  if (!autoRun) {
    // eslint-disable-next-line no-console
    console.log(
      `[resume] session is mid-flight; last event was ${state.last_message?.kind ?? '?'}; ` +
        `next_speaker=${state.progress_ledger.next_speaker ?? '?'}.`,
    );
    // eslint-disable-next-line no-console
    console.log('[resume] re-derived state only. To continue mid-flight, run one of:');
    // eslint-disable-next-line no-console
    console.log(`  crumb resume ${state.session_id} --run`);
    // eslint-disable-next-line no-console
    console.log(
      `  crumb run --session ${state.session_id} --goal "${state.task_ledger.goal ?? ''}" --root ${cwd}`,
    );
    return;
  }

  // --run path: re-enter runSession() with the original goal + repo. This
  // matches the studio's [Resume] button (POST /api/sessions/:id/resume).
  const goal = state.task_ledger.goal ?? '';
  const repoRoot = args.flags.get('root') ?? process.env.CRUMB_REPO_ROOT ?? inferRepoRoot() ?? cwd;
  const adapterOverride = args.flags.get('adapter');
  const presetName = args.flags.get('preset');
  const idleTimeoutMs = Number(args.flags.get('idle-timeout') ?? 60_000);
  const perSpawnTimeoutFlag = args.flags.get('per-spawn-timeout');
  const perSpawnTimeoutMs = perSpawnTimeoutFlag ? Number(perSpawnTimeoutFlag) : undefined;
  // eslint-disable-next-line no-console
  console.log(
    `[resume] re-entering session=${state.session_id} adapter=${adapterOverride ?? '(preset or ambient)'} force=${force}`,
  );
  await updateMeta(sessionDir, { status: 'running' });
  const { runSession } = await import('./loop/coordinator.js');
  try {
    const { state: finalState } = await runSession({
      goal,
      sessionDir,
      sessionId: state.session_id,
      repoRoot,
      adapterOverride,
      presetName,
      idleTimeoutMs,
      perSpawnTimeoutMs,
    });
    await updateMeta(sessionDir, {
      status: finalState.done ? 'done' : 'paused',
      ended_at: new Date().toISOString(),
    });
    // eslint-disable-next-line no-console
    console.log(
      `[resume] re-entry exit: done=${finalState.done} next_speaker=${finalState.progress_ledger.next_speaker ?? '?'}`,
    );
  } catch (err) {
    await updateMeta(sessionDir, {
      status: 'paused',
      ended_at: new Date().toISOString(),
    });
    throw err;
  }
}

async function cmdDoctor(args: ParsedArgs): Promise<void> {
  // v0.4: --self-check exercises the reducer pause/resume state machine
  // synthetically (no subprocess, no transcript writes) so a fresh-machine
  // setup or a post-Prune-N merge can be verified end-to-end. Prints a
  // structured per-step trace and exits non-zero if any transition fails.
  // Backed by wiki/synthesis/bagelcode-studio-big-bang-update-2026-05-03.md §6.8.
  if (args.flags.has('self-check')) {
    const { runSelfCheck, formatSelfCheckReport } = await import('./helpers/self-check.js');
    const report = runSelfCheck();
    // eslint-disable-next-line no-console
    console.log(formatSelfCheckReport(report));
    if (report.pause_resume_lifecycle !== 'ok') {
      process.exit(1);
    }
    return;
  }

  // v0.1 S12: full environment check (3 host OAuth + playwright + htmlhint).
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
  // v0.1 S12: /crumb config <자연어> — preset 추천.
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
  // v0.1 S12: /crumb debug — F1-F7 routing 장애 진단.
  const target = args.positional[0];
  if (!target) throw new Error('debug requires a session id or session-dir');
  const cwd = process.cwd();
  const sessionDir = await resolveStoredSession(target, cwd);
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
  const cwd = process.cwd();
  const sessionDir = await resolveStoredSession(target, cwd);
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
  const cwd = process.cwd();
  const sessionDir = await resolveStoredSession(target, cwd);
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
  const cwd = process.cwd();
  const sessionDir = await resolveStoredSession(target, cwd);
  const { runTui } = await import('./tui/app.js');
  await runTui({ sessionDir });
}

async function cmdExport(args: ParsedArgs): Promise<void> {
  const target = args.positional[0];
  if (!target) throw new Error('export <session-id|dir> required');
  const cwd = process.cwd();
  const sessionDir = await resolveStoredSession(target, cwd);
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

/**
 * `crumb init` — multi-host entry verifier + project pin.
 *
 * Default mode: Spec-kit `specify init` pattern — verify universal identity
 * (CRUMB.md / AGENTS.md) + each host entry (.claude/skills/crumb,
 * .codex/agents/crumb.toml, .gemini/extensions/crumb).
 *
 *   crumb init                       same as --check (verify all)
 *   crumb init --check               verify universal identity + every host entry
 *   crumb init --host <name>         scope to one of: claude | codex | gemini
 *   crumb init --format json         JSON output (default: human-readable)
 *
 * Project pin mode (v0.3.0): pin the cwd to a stable ULID so renames/moves
 * preserve project identity. Writes <cwd>/.crumb/project.toml with a fresh
 * ULID; subsequent `crumb run` resolves via the pin instead of sha256(cwd).
 *
 *   crumb init --pin [--label "<name>"]   write <cwd>/.crumb/project.toml
 *
 * Distinct from `crumb doctor`: `init` only checks repo files; `doctor`
 * checks runtime readiness (CLI binaries on PATH, OAuth, adapter health).
 */
async function cmdInit(args: ParsedArgs): Promise<void> {
  // --root: repo path for entry verification (CRUMB.md / AGENTS.md / host entries).
  // For --pin: cwd is process.cwd() (pinning targets the user's actual location).
  const cwd = args.flags.get('root') ?? process.cwd();
  if (args.flags.has('pin')) {
    await writeProjectPin(process.cwd(), args.flags.get('label'));
    return;
  }
  const hostRaw = args.flags.get('host');
  const formatRaw = args.flags.get('format') ?? 'human';
  if (formatRaw !== 'human' && formatRaw !== 'json') {
    throw new Error(`unknown --format ${formatRaw}. allowed: human, json`);
  }
  let filter: 'claude' | 'codex' | 'gemini' | 'all' = 'all';
  if (hostRaw) {
    if (hostRaw !== 'claude' && hostRaw !== 'codex' && hostRaw !== 'gemini' && hostRaw !== 'all') {
      throw new Error(`unknown --host ${hostRaw}. allowed: claude, codex, gemini, all`);
    }
    filter = hostRaw;
  }
  const { check, formatHuman, formatJson } = await import('./helpers/init.js');
  const result = check({ projectRoot: cwd, filter });
  const out = formatRaw === 'json' ? formatJson(result) : formatHuman(result);
  // eslint-disable-next-line no-console
  console.log(out);
  if (!result.ok) {
    process.exitCode = 1;
  }
}

async function writeProjectPin(cwd: string, label?: string): Promise<void> {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { existsSync } = await import('node:fs');
  const { PROJECT_PIN_DIR, PROJECT_PIN_FILE, resolveProjectId } = await import('./paths.js');
  const pinDir = resolve(cwd, PROJECT_PIN_DIR);
  const pinPath = resolve(pinDir, PROJECT_PIN_FILE);
  if (existsSync(pinPath)) {
    const existing = await resolveProjectId(cwd);
    // eslint-disable-next-line no-console
    console.log(`[crumb init] project already pinned: ${existing}`);
    // eslint-disable-next-line no-console
    console.log(`[crumb init] pin file: ${pinPath}`);
    return;
  }
  await mkdir(pinDir, { recursive: true });
  const id = ulid();
  const lines = [
    '# Crumb project pin (v0.3.0+).',
    '# This file pins the project id for ~/.crumb/projects/<id>/ so that renaming',
    '# or moving the cwd preserves project identity. Without this file the project',
    '# id is derived from sha256(canonical(cwd))[:16] (ambient mode).',
    '',
    `id = "${id}"`,
    `cwd = "${cwd}"`,
    `created_at = "${new Date().toISOString()}"`,
  ];
  if (label) lines.push(`label = "${label}"`);
  await writeFile(pinPath, lines.join('\n') + '\n', 'utf8');
  // eslint-disable-next-line no-console
  console.log(`[crumb init] pinned ${cwd}`);
  // eslint-disable-next-line no-console
  console.log(`[crumb init]   project_id = ${id}`);
  if (label) {
    // eslint-disable-next-line no-console
    console.log(`[crumb init]   label      = ${label}`);
  }
  // eslint-disable-next-line no-console
  console.log(`[crumb init]   pin file   = ${pinPath}`);
}

/**
 * `crumb model` — interactive blessed UI to edit per-actor model + effort + provider activation.
 *
 * Reads/writes .crumb/config.toml. Defaults to all high-end models (claude-opus-4-7,
 * gpt-5.5-codex, gemini-3-1-pro) + effort=high + all 3 local providers enabled.
 * Gemini IDs accept both dot ("gemini-3.1-pro") and dash ("gemini-3-1-pro") forms.
 *
 *   crumb model               interactive TUI (Tab cycle / ↑↓ model / ←→ effort / h harness / p providers)
 *   crumb model --show        print current config and exit
 *   crumb model --apply "<NL instruction>"   apply natural-language change ("verifier 모델을 gemini-3-1-pro 로")
 */
async function cmdModel(args: ParsedArgs): Promise<void> {
  // --root: repo path that holds .crumb/config.toml. Default process.cwd().
  const cwd = args.flags.get('root') ?? process.cwd();
  const { runModelTui, applyNlInstruction, showConfig } = await import('./tui/model-edit.js');
  if (args.flags.has('show')) {
    process.stdout.write(showConfig(cwd) + '\n');
    return;
  }
  const apply = args.flags.get('apply');
  if (apply) {
    process.stdout.write(applyNlInstruction(cwd, apply) + '\n');
    return;
  }
  await runModelTui({ repoRoot: cwd });
}

async function cmdLs(_args: ParsedArgs): Promise<void> {
  const cwd = process.cwd();
  // v0.3.0: list sessions in this project (~/.crumb/projects/<id>/sessions/).
  // Legacy <cwd>/sessions/ is also surfaced with a marker until `crumb migrate`.
  const dir = await getSessionsDir(cwd);
  const entries: SessionListing[] = [];
  await collectListing(dir, false, entries);
  const legacyDir = resolve(cwd, 'sessions');
  if (existsSync(legacyDir)) {
    await collectListing(legacyDir, true, entries);
  }
  if (entries.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`(no sessions yet at ${dir})`);
    return;
  }
  for (const { id, events, size, legacy, status, goal } of entries) {
    const tag = legacy ? '  [legacy]' : '';
    const statusTag = status ? `  [${status}]` : '';
    const goalTag = goal ? `  ${truncate(goal, 60)}` : '';
    // eslint-disable-next-line no-console
    console.log(`${id}  ${events} events  ${size}B${statusTag}${tag}${goalTag}`);
  }
}

interface SessionListing {
  id: string;
  events: number;
  size: number;
  legacy: boolean;
  status?: string;
  goal?: string;
}

async function collectListing(dir: string, legacy: boolean, out: SessionListing[]): Promise<void> {
  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch {
    return;
  }
  for (const e of names) {
    const sessionPath = resolve(dir, e);
    const t = resolve(sessionPath, 'transcript.jsonl');
    let entry: SessionListing = { id: e, events: 0, size: 0, legacy };
    try {
      const s = await stat(t);
      const buf = await readFile(t, 'utf8');
      const lines = buf.split('\n').filter((l) => l.trim().length > 0);
      entry = { ...entry, events: lines.length, size: s.size };
    } catch {
      // transcript missing — keep zeros
    }
    const meta = await readMeta(sessionPath);
    if (meta) {
      entry.status = meta.status;
      entry.goal = meta.goal;
    }
    out.push(entry);
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

/**
 * `crumb migrate [--dry-run]` — relocate legacy `<cwd>/sessions/<id>/` directories
 * (v0.2.0 and older) into `~/.crumb/projects/<id>/sessions/<id>/`. Idempotent —
 * existing destination dirs are left intact and the source remains so the operator
 * can resolve manually.
 */
async function cmdMigrate(args: ParsedArgs): Promise<void> {
  const cwd = process.cwd();
  const dryRun = args.flags.has('dry-run');
  const r = await migrateLegacySessions({ cwd, dryRun });
  // eslint-disable-next-line no-console
  console.log(formatMigrateResult(r));
}

/**
 * `crumb copy-artifacts <session-ulid|vN> --to <dest>`
 *
 * Copy frozen artifacts (game.html / spec.md / DESIGN.md / tuning.json / ...) out of
 * `~/.crumb/projects/<id>/` and into a user-chosen destination. Pure copy, no links —
 * the destination is independent of `~/.crumb/`. The Bagelcode submission story is
 * `crumb copy-artifacts <demo-ulid> --to ./demo/` followed by `git add demo/`.
 *
 * Resolution: positional matches `^v\d+` → version dir; otherwise → session dir
 * (resolveStoredSession with new-global → legacy fallback).
 */
async function cmdCopyArtifacts(args: ParsedArgs): Promise<void> {
  const target = args.positional[0];
  if (!target) throw new Error('copy-artifacts <session-id|vN> required');
  const dest = args.flags.get('to');
  if (!dest) throw new Error('--to <dest> required');
  const cwd = process.cwd();

  const isVersion = /^v\d+/.test(target);
  let srcDir: string;
  let summary: string;
  if (isVersion) {
    const versionsDir = await getVersionsDir(cwd);
    // Accept exact match (v2-combo-bonus) or bare name (v2 with any label).
    const all = await readAllManifests(versionsDir);
    const m =
      all.find((x) => versionDirName(x.name, x.label) === target) ??
      all.find((x) => x.name === target);
    if (!m) throw new Error(`version not found: ${target}`);
    srcDir = resolve(versionsDir, versionDirName(m.name, m.label), 'artifacts');
    summary = `${m.name}${m.label ? `-${m.label}` : ''}`;
  } else {
    const sessionDir = await resolveStoredSession(target, cwd);
    srcDir = resolve(sessionDir, 'artifacts');
    summary = target;
  }
  if (!existsSync(srcDir)) {
    throw new Error(`no artifacts at ${srcDir}`);
  }

  const { copyFile, mkdir } = await import('node:fs/promises');
  const destAbs = resolve(cwd, dest);
  await mkdir(destAbs, { recursive: true });
  const files = await readdir(srcDir);
  let count = 0;
  for (const f of files) {
    await copyFile(resolve(srcDir, f), resolve(destAbs, f));
    count++;
  }
  // eslint-disable-next-line no-console
  console.log(`[crumb copy-artifacts] ${summary} → ${destAbs}  (${count} file(s))`);
}

/**
 * `crumb release <session-ulid> [--as <vN>] [--label "<name>"] [--no-parent]`
 *
 * Promote a WIP session into an immutable milestone under
 * `~/.crumb/projects/<id>/versions/<vN>[-<label>]/`. Snapshots artifacts (real
 * copy, no link), extracts scorecard from the last judge.score event, and
 * appends `kind=version.released` to the source session's transcript so replay
 * re-derives the version event.
 */
async function cmdRelease(args: ParsedArgs): Promise<void> {
  const target = args.positional[0];
  if (!target) throw new Error('release requires a session id or session-dir');
  const cwd = process.cwd();
  const sessionDir = await resolveStoredSession(target, cwd);
  const transcriptPath = resolve(sessionDir, 'transcript.jsonl');
  const events = await readAll(transcriptPath);
  if (events.length === 0) {
    throw new Error(`empty transcript at ${transcriptPath}`);
  }
  const sessionId = events[0].session_id;

  const versionsDir = await getVersionsDir(cwd);
  const explicitName = args.flags.get('as');
  const label = args.flags.get('label');
  const name = explicitName ?? (await nextSequentialVersion(versionsDir));
  if (!/^v\d+$/.test(name) && explicitName !== undefined) {
    throw new Error(`--as must match /^v\\d+$/ (got "${name}")`);
  }

  const dirName = versionDirName(name, label);
  const versionDir = resolve(versionsDir, dirName);
  if (existsSync(versionDir)) {
    throw new Error(`version already exists: ${versionDir}`);
  }

  // parent_version = latest existing version by released_at, unless --no-parent.
  let parentVersion: string | undefined;
  if (!args.flags.has('no-parent')) {
    const existing = await readAllManifests(versionsDir);
    parentVersion = existing.at(-1)?.name;
  }

  const meta = await readMeta(sessionDir);
  const scorecard = deriveScorecard(events);
  const sourceEventId = deriveSourceEventId(events);

  const artifactsSha = await snapshotArtifacts(sessionDir, versionDir);

  const manifest: VersionManifest = {
    schema_version: 1,
    name,
    released_at: new Date().toISOString(),
    source_session: sessionId,
  };
  if (label) manifest.label = label;
  if (sourceEventId) manifest.source_event_id = sourceEventId;
  if (parentVersion) manifest.parent_version = parentVersion;
  if (meta?.goal) manifest.goal = meta.goal;
  if (scorecard) manifest.scorecard = scorecard;
  if (Object.keys(artifactsSha).length > 0) manifest.artifacts_sha256 = artifactsSha;
  await writeManifest(versionDir, manifest);

  // Append kind=version.released to source session transcript so replay re-derives it.
  // manifest_relpath is project-relative (`versions/<dir>/manifest.toml`) so replay is
  // portable across machines — never store absolute paths in the transcript.
  const writer = getTranscriptWriter({ path: transcriptPath, sessionId });
  await writer.append({
    session_id: sessionId,
    from: 'system',
    kind: 'version.released',
    body: `Released as ${name}${label ? ` (label: ${label})` : ''}`,
    data: {
      version: name,
      label: label ?? null,
      parent_version: parentVersion ?? null,
      source_event_id: sourceEventId ?? null,
      manifest_relpath: `versions/${dirName}/manifest.toml`,
    },
    metadata: { deterministic: true, tool: 'crumb-release@v1' },
  });

  // eslint-disable-next-line no-console
  console.log(`[crumb release] ${name}${label ? ` (${label})` : ''} → ${versionDir}`);
  if (parentVersion) {
    // eslint-disable-next-line no-console
    console.log(`[crumb release]   parent_version = ${parentVersion}`);
  }
  if (scorecard) {
    // eslint-disable-next-line no-console
    console.log(
      `[crumb release]   scorecard      = aggregate=${scorecard.aggregate ?? '?'} verdict=${scorecard.verdict ?? '?'}`,
    );
  }
  // eslint-disable-next-line no-console
  console.log(`[crumb release]   artifacts      = ${Object.keys(artifactsSha).length} file(s)`);
}

/** `crumb versions` — list all versions in the current project, oldest first. */
async function cmdVersions(_args: ParsedArgs): Promise<void> {
  const cwd = process.cwd();
  const versionsDir = await getVersionsDir(cwd);
  const all = await readAllManifests(versionsDir);
  if (all.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`(no versions yet at ${versionsDir})`);
    return;
  }
  for (const m of all) {
    const labelTag = m.label ? `  (${m.label})` : '';
    const parentTag = m.parent_version ? `  ← ${m.parent_version}` : '';
    const verdict = m.scorecard?.verdict ?? '?';
    const agg = m.scorecard?.aggregate ?? '?';
    // eslint-disable-next-line no-console
    console.log(
      `${m.name}${labelTag}${parentTag}  ${m.released_at}  verdict=${verdict} aggregate=${agg}`,
    );
  }
  // Re-read latest manifest's parent_version chain for visibility.
  const latest = all.at(-1)!;
  if (await readManifest(resolve(versionsDir, versionDirName(latest.name, latest.label)))) {
    // eslint-disable-next-line no-console
    console.log(`\n[latest] ${latest.name}${latest.label ? ` (${latest.label})` : ''}`);
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * `crumb studio` — front-of-house entrypoint to the Studio web console.
 *
 * Equivalent to `npx crumb-studio`, but reachable from the unified
 * `crumb <verb>` dispatcher so users only have to remember one command. All
 * Studio CLI flags (`--port`, `--bind`, `--no-open`, `--home`,
 * `--poll-interval`, `--port-file`) pass through verbatim.
 *
 * Foreground stdio inherit — Ctrl+C in the parent terminal kills the Studio
 * child cleanly, matching `crumb-studio` standalone behavior. For detached
 * background usage (auto-spawn after `crumb run`), see `ensureStudioRunning`
 * in `cmdRun`.
 *
 * Architecture invariant: Studio is a host-process sibling, never an actor.
 * Routing this through the same dispatcher does not change that — this is
 * just an alias that delegates to `packages/studio/dist/cli.js`.
 */
async function cmdStudio(args: ParsedArgs): Promise<void> {
  const studioBin = resolveStudioBinForSubcommand();
  if (!studioBin) {
    throw new Error(
      'crumb-studio binary not found. Run `npm run build` from the repo root, ' +
        'or set CRUMB_STUDIO_BIN to a packaged shim.',
    );
  }
  // Reconstruct argv from the parsed args. parseArgs collapsed flag names
  // into a Map (with 'true' for boolean flags) and pushed positionals into a
  // separate array; rebuild a flat argv here so the studio CLI's own parser
  // sees the original shape.
  const passthrough: string[] = [];
  for (const [k, v] of args.flags.entries()) {
    if (v === 'true') {
      passthrough.push(`--${k}`);
    } else {
      passthrough.push(`--${k}`, v);
    }
  }
  passthrough.push(...args.positional);

  await new Promise<void>((resolveSpawn, rejectSpawn) => {
    const child = spawn(process.execPath, [studioBin, ...passthrough], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', rejectSpawn);
    child.on('exit', (code) => {
      if (code === 0 || code === null) resolveSpawn();
      else process.exit(code);
    });
    // Forward signals so Ctrl+C / SIGTERM in the parent shell propagates to
    // the child without leaving an orphan studio listening on the port.
    const forward = (sig: NodeJS.Signals) => () => {
      if (!child.killed) child.kill(sig);
    };
    process.on('SIGINT', forward('SIGINT'));
    process.on('SIGTERM', forward('SIGTERM'));
  });
}

function resolveStudioBinForSubcommand(): string | null {
  if (process.env.CRUMB_STUDIO_BIN && existsSync(process.env.CRUMB_STUDIO_BIN)) {
    return process.env.CRUMB_STUDIO_BIN;
  }
  const here = fileURLToPath(import.meta.url);
  const repoRootGuess = inferRepoRoot() ?? resolve(here, '..', '..');
  const workspaceDist = resolve(repoRootGuess, 'packages', 'studio', 'dist', 'cli.js');
  if (existsSync(workspaceDist)) return workspaceDist;
  return null;
}

/**
 * v0.5 Studio auto-spawn (Streamlit / Vite / Gradio frontier convention).
 *
 * Probes http://127.0.0.1:7321 first; if a Studio is already running, prints
 * the deeplink to the just-started session and returns. Otherwise spawns
 * `crumb-studio` as a detached child, so it outlives this run and watches
 * subsequent sessions via chokidar without re-spawn.
 *
 * Disabled by --no-studio flag or CRUMB_NO_STUDIO=1 env (CI / SSH / headless).
 *
 * Architecture invariant: Studio is a read-only observation surface — the
 * append-only transcript stays the single source of truth, mutations route
 * through `crumb pause / veto / approve / redo`, never through Studio's HTTP
 * surface. This auto-spawn does not change that contract.
 */
async function ensureStudioRunning(sessionId: string, sessionDir: string): Promise<void> {
  const port = Number(process.env.CRUMB_STUDIO_PORT ?? 7321);
  const url = `http://127.0.0.1:${port}/`;
  const sessionUrl = `${url}#/session/${sessionId}`;

  const alreadyRunning = await probeStudio(port);
  if (alreadyRunning) {
    // eslint-disable-next-line no-console
    console.log('');
    // eslint-disable-next-line no-console
    console.log(`  \x1b[32m➜\x1b[0m  Studio (existing)  ${url}`);
    // eslint-disable-next-line no-console
    console.log(`  \x1b[32m➜\x1b[0m  Session            ${sessionId}`);
    // eslint-disable-next-line no-console
    console.log(`  \x1b[2m   transcript        ${resolve(sessionDir, 'transcript.jsonl')}\x1b[0m`);
    // eslint-disable-next-line no-console
    console.log('');
    return;
  }

  // Resolve the studio CLI: bin from the linked workspace, or fallback to npx.
  const studioBin = resolveStudioBin();
  if (!studioBin) {
    // eslint-disable-next-line no-console
    console.log('');
    // eslint-disable-next-line no-console
    console.log(
      '  \x1b[33m⚠\x1b[0m  Studio binary not found — run `npm run build` or skip with --no-studio.',
    );
    // eslint-disable-next-line no-console
    console.log('');
    return;
  }

  const child = spawn(process.execPath, [studioBin], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, CRUMB_NO_OPEN: process.env.CRUMB_NO_OPEN ?? '1' },
  });
  child.unref();

  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log(`  \x1b[32m➜\x1b[0m  Crumb Studio    ${url}  \x1b[2m(read-only observation)\x1b[0m`);
  // eslint-disable-next-line no-console
  console.log(`  \x1b[32m➜\x1b[0m  Session         ${sessionId}`);
  // eslint-disable-next-line no-console
  console.log(`  \x1b[32m➜\x1b[0m  Deep link       ${sessionUrl}`);
  // eslint-disable-next-line no-console
  console.log(`  \x1b[2m   Disable        --no-studio  or  CRUMB_NO_STUDIO=1\x1b[0m`);
  // eslint-disable-next-line no-console
  console.log('');
}

async function probeStudio(port: number): Promise<boolean> {
  return new Promise((resolveProbe) => {
    const req = httpRequest(
      { host: '127.0.0.1', port, path: '/', method: 'HEAD', timeout: 200 },
      (res) => {
        res.resume();
        resolveProbe(res.statusCode !== undefined && res.statusCode < 500);
      },
    );
    req.on('error', () => resolveProbe(false));
    req.on('timeout', () => {
      req.destroy();
      resolveProbe(false);
    });
    req.end();
  });
}

function resolveStudioBin(): string | null {
  // Resolution order matches the runtime install paths:
  //   1. CRUMB_STUDIO_BIN env override (CI / packaged shim)
  //   2. workspace dist (built from `npm run build`)
  //   3. globally installed `@crumb/studio`
  if (process.env.CRUMB_STUDIO_BIN && existsSync(process.env.CRUMB_STUDIO_BIN)) {
    return process.env.CRUMB_STUDIO_BIN;
  }
  const here = fileURLToPath(import.meta.url);
  const repoRootGuess = inferRepoRoot() ?? resolve(here, '..', '..');
  const workspaceDist = resolve(repoRootGuess, 'packages', 'studio', 'dist', 'cli.js');
  if (existsSync(workspaceDist)) return workspaceDist;
  return null;
}

function printVersion(): void {
  // eslint-disable-next-line no-console
  console.log(readPackageVersion());
}

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`Crumb v${readPackageVersion()} — multi-agent execution harness

Usage:
  crumb run --goal "<game pitch>" [--session <id>] [--preset <name>] [--adapter <id>] [--bind <actor>=<harness>[:<model>]]…
  crumb event                              # read JSON from stdin, append to transcript
  crumb event tail [--all] [--kinds ...]   # stream transcript events with metadata.visibility=private
                                          # filtered out by default; --all bypasses; --kinds limits to a list
                                          # (uses $CRUMB_TRANSCRIPT_PATH or --path <file>)
  crumb replay <session-dir>               # re-derive state from transcript
  crumb resume <session-id|dir>            # re-derive state + surface mid-flight resume command (S15)
  crumb doctor                             # full environment check (3 host OAuth + adapter health)
  crumb doctor --self-check                # reducer pause/resume lifecycle smoke (fresh-machine portability check)
  crumb config <자연어>                     # preset 추천 (Crumb 추천만, 사용자 선택)
  crumb debug <session-id|dir>             # F1-F7 routing 장애 진단
  crumb status <session-id|dir>            # 진행 상황 + last 10 events + scores
  crumb explain <kind>                     # 39 kind schema lookup
  crumb suggest <session-id|dir>           # 다음 사용자 액션 추천
  crumb tui <session-id|dir>               # blessed live observer (P0)
  crumb model [--show | --apply "NL"]     # per-actor model + effort + provider activation TUI
  crumb export <session-id|dir> [--format otel-jsonl|anthropic-trace|chrome-trace]
                                          # transcript → OTel GenAI / Anthropic / chrome://tracing
  crumb init [--host <name>] [--format human|json]
                                          # verify CRUMB.md/AGENTS.md + host entries
                                          # (.claude/skills/crumb, .codex/agents, .gemini/extensions/crumb)
                                          # distinct from doctor — init is repo files; doctor is runtime
  crumb init --pin [--label "<name>"]      # pin cwd to a stable ULID (writes <cwd>/.crumb/project.toml)
                                          # so renames/moves preserve project identity
  crumb ls                                 # list current project's sessions
                                          # (~/.crumb/projects/<id>/sessions/, plus legacy <cwd>/sessions/ marked [legacy])
  crumb release <session-id> [--as vN] [--label "<name>"] [--no-parent]
                                          # snapshot session artifacts into versions/<vN>[-<label>]/
                                          # (frozen copy + manifest.toml + kind=version.released event)
  crumb versions                           # list released milestones with parent chain
  crumb copy-artifacts <session-id|vN> --to <dest>
                                          # copy frozen artifacts (game.html, spec.md, ...) into <dest>
                                          # Bagelcode submission: crumb copy-artifacts <demo-ulid> --to ./demo/
  crumb migrate [--dry-run]                # move legacy <cwd>/sessions/ → ~/.crumb/projects/<id>/sessions/
                                          # idempotent; --dry-run previews
  crumb studio [--port 7321] [--bind 127.0.0.1] [--no-open] [--home <path>] [--port-file <path>]
                                          # launch the web console (alias for crumb-studio)
                                          # auto-opens http://127.0.0.1:7321/ — Ctrl+C to stop

Flags (run):
  --preset <name>     load .crumb/presets/<name>.toml. e.g. bagelcode-cross-3way / mock /
                      sdk-enterprise / solo. provider × harness × model 결정은 사용자 통제권.
                      명시 없으면 ambient (entry host 따라감).
  --adapter <id>      force every actor to one adapter (override preset). claude-local /
                      codex-local / mock. 디버깅용.
  --bind <actor>=<harness>[:<model>]
                      v0.5 PR-Bindings — per-actor override (repeatable).
                      Highest-priority above .crumb/config.toml + preset.
                      e.g. --bind builder=codex --bind verifier=gemini-cli:gemini-3-1-pro
                      Without --preset: synthesizes a "bindings-only" preset
                      where named actors are overridden, others stay ambient.
  --genre <profile>   v0.4: pre-select genre profile. one of:
                        auto-detect (default — researcher proposes)
                        casual-portrait | pixel-arcade | sidescroll-2d | flash-3d-arcade
                      see agents/specialists/game-design.md §1.3.
  --persistence <p>   v0.4: pre-select persistence profile. one of:
                        local-only (default Dexie) | postgres-anon (Supabase) |
                        edge-orm (Cloudflare D1 + Drizzle, opt-in worker tier) |
                        firebase-realtime (alpha)
                      see agents/specialists/game-design.md §1.4.

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
      await cmdEvent(args);
      break;
    case 'replay':
      await cmdReplay(args);
      break;
    case 'resume':
      await cmdResume(args);
      break;
    case 'doctor':
      await cmdDoctor(args);
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
    case 'model':
      await cmdModel(args);
      break;
    case 'tui':
      await cmdTui(args);
      break;
    case 'init':
      await cmdInit(args);
      break;
    case 'export':
      await cmdExport(args);
      break;
    case 'ls':
      await cmdLs(args);
      break;
    case 'release':
      await cmdRelease(args);
      break;
    case 'versions':
      await cmdVersions(args);
      break;
    case 'copy-artifacts':
      await cmdCopyArtifacts(args);
      break;
    case 'migrate':
      await cmdMigrate(args);
      break;
    case 'studio':
      await cmdStudio(args);
      break;
    case 'version':
    case '--version':
    case '-v':
    case '-V':
      printVersion();
      break;
    case 'help':
    case '--help':
    case '-h':
    default:
      printHelp();
  }
}
