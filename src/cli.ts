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
import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { ulid } from 'ulid';

import { runSession } from './loop/coordinator.js';
import { readAll } from './transcript/reader.js';
import { TranscriptWriter } from './transcript/writer.js';
import { reduce } from './reducer/index.js';
import { initialState } from './state/types.js';
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
  const repoRoot = args.flags.get('root') ?? cwd;
  // v3.3: sessions live under ~/.crumb/projects/<id>/sessions/<ulid>/.
  // The cwd determines project id (sha256 ambient or pinned via .crumb/project.toml).
  await ensureCrumbHome();
  await ensureProjectDir(cwd);
  const sessionDir = await ensureSessionRoot(cwd, sessionId);
  const adapterOverride = args.flags.get('adapter');
  const presetName = args.flags.get('preset');
  const label = args.flags.get('label');
  const idleTimeoutMs = Number(args.flags.get('idle-timeout') ?? 60_000);

  // eslint-disable-next-line no-console
  console.log(`[crumb] session=${sessionId} dir=${sessionDir}`);
  if (presetName) {
    // eslint-disable-next-line no-console
    console.log(`[crumb] preset=${presetName}`);
  }
  // eslint-disable-next-line no-console
  console.log(`[crumb] adapter=${adapterOverride ?? '(preset or ambient)'} repo=${repoRoot}`);

  // v3.3: write meta.json on start. If --session refers to an existing meta we
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
      presetName,
      idleTimeoutMs,
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
  const target = args.positional[0] ?? args.flags.get('session-dir');
  if (!target) throw new Error('replay <session-id|dir> required');
  const cwd = args.flags.get('root') ?? process.cwd();
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
  const cwd = args.flags.get('root') ?? process.cwd();
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
  const cwd = args.flags.get('root') ?? process.cwd();
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
  const cwd = args.flags.get('root') ?? process.cwd();
  const sessionDir = await resolveStoredSession(target, cwd);
  const { runTui } = await import('./tui/app.js');
  await runTui({ sessionDir });
}

async function cmdExport(args: ParsedArgs): Promise<void> {
  const target = args.positional[0];
  if (!target) throw new Error('export <session-id|dir> required');
  const cwd = args.flags.get('root') ?? process.cwd();
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
 * Project pin mode (v3.3): pin the cwd to a stable ULID so renames/moves
 * preserve project identity. Writes <cwd>/.crumb/project.toml with a fresh
 * ULID; subsequent `crumb run` resolves via the pin instead of sha256(cwd).
 *
 *   crumb init --pin [--label "<name>"]   write <cwd>/.crumb/project.toml
 *
 * Distinct from `crumb doctor`: `init` only checks repo files; `doctor`
 * checks runtime readiness (CLI binaries on PATH, OAuth, adapter health).
 */
async function cmdInit(args: ParsedArgs): Promise<void> {
  const cwd = args.flags.get('root') ?? process.cwd();
  if (args.flags.has('pin')) {
    await writeProjectPin(cwd, args.flags.get('label'));
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
    '# Crumb project pin (v3.3+).',
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
 * gpt-5.5-codex, gemini-2.5-pro) + effort=high + all 3 local providers enabled.
 *
 *   crumb model               interactive TUI (Tab cycle / ↑↓ model / ←→ effort / h harness / p providers)
 *   crumb model --show        print current config and exit
 *   crumb model --apply "<NL instruction>"   apply natural-language change ("verifier 모델을 gemini-2.5-pro 로")
 */
async function cmdModel(args: ParsedArgs): Promise<void> {
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

async function cmdLs(args: ParsedArgs): Promise<void> {
  const cwd = args.flags.get('root') ?? process.cwd();
  // v3.3: list sessions in this project (~/.crumb/projects/<id>/sessions/).
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
  const cwd = args.flags.get('root') ?? process.cwd();
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
  const writer = new TranscriptWriter({ path: transcriptPath, sessionId });
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
async function cmdVersions(args: ParsedArgs): Promise<void> {
  const cwd = args.flags.get('root') ?? process.cwd();
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
    case 'help':
    case '--help':
    case '-h':
    default:
      printHelp();
  }
}
