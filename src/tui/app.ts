/**
 * Crumb TUI — blessed-based live observer for a session.
 *
 * Mounts 4 panes on a single screen:
 *   ┌─ Header (session id / goal / preset / verdict) ─┐
 *   │ ▶ TIMELINE (scrollable, auto-tail)             │
 *   │ AGENTS │ ADAPTERS                              │
 *   │ STATUS bar (cost / cache / stuck / verdict)    │
 *   │ COMMAND input (slash commands)                 │
 *   └────────────────────────────────────────────────┘
 *
 * Reads transcript.jsonl via fs reader (read-once + tail). Re-renders the
 * timeline list on each new event. Slash commands write events back via
 * TranscriptWriter — same path the dispatcher uses, so user.* events are
 * indistinguishable from any other source.
 *
 * See [[bagelcode-system-architecture-v3]] §10.1 (TUI = P0 surface).
 */

import { resolve } from 'node:path';

import blessed from 'blessed';

import { reduce } from '../reducer/index.js';
import { initialState, type CrumbState } from '../state/types.js';
import type { Message } from '../protocol/types.js';
import { readAll, tail } from '../transcript/reader.js';
import { TranscriptWriter } from '../transcript/writer.js';
import { parseInboxLine } from '../inbox/parser.js';

import { formatActorList, formatRow, formatStatus } from './format.js';

export interface TuiOptions {
  sessionDir: string;
  /** Session id used for emitted user.* events. */
  sessionId?: string;
}

export async function runTui(opts: TuiOptions): Promise<void> {
  const transcriptPath = resolve(opts.sessionDir, 'transcript.jsonl');
  const initial = await readAll(transcriptPath);
  const sessionId = opts.sessionId ?? initial[0]?.session_id ?? 'unknown';

  const transcript: Message[] = [...initial];
  let state: CrumbState = initialState(sessionId);
  for (const m of transcript) state = reduce(state, m).state;

  const screen = blessed.screen({
    smartCSR: true,
    title: `Crumb · ${sessionId}`,
    fullUnicode: true,
  });

  const header = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    tags: true,
    border: { type: 'line' },
    style: { border: { fg: 'gray' } },
  });

  const timeline = blessed.list({
    parent: screen,
    top: 3,
    left: 0,
    right: 0,
    bottom: 9,
    keys: true,
    vi: true,
    mouse: true,
    scrollable: true,
    tags: true,
    label: ' TIMELINE (j/k Enter Tab) ',
    border: { type: 'line' },
    style: {
      border: { fg: 'gray' },
      selected: { bg: '#3B6FB6', fg: 'white' },
    },
    items: [],
  });

  const agentsBox = blessed.box({
    parent: screen,
    bottom: 6,
    left: 0,
    width: '50%',
    height: 3,
    tags: true,
    label: ' AGENTS ',
    border: { type: 'line' },
    style: { border: { fg: 'gray' } },
  });

  const adaptersBox = blessed.box({
    parent: screen,
    bottom: 6,
    left: '50%',
    right: 0,
    height: 3,
    tags: true,
    label: ' ADAPTERS ',
    border: { type: 'line' },
    style: { border: { fg: 'gray' } },
  });

  const status = blessed.box({
    parent: screen,
    bottom: 3,
    left: 0,
    right: 0,
    height: 3,
    tags: true,
    label: ' STATUS ',
    border: { type: 'line' },
    style: { border: { fg: 'gray' } },
  });

  const cmd = blessed.textbox({
    parent: screen,
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    tags: true,
    label:
      ' /approve /veto /pause /resume /goto /swap /reset-circuit /append /note /redo /q · @actor msg ',
    border: { type: 'line' },
    style: { border: { fg: 'gray' } },
    inputOnFocus: true,
    keys: true,
  });

  const writer = new TranscriptWriter({ path: transcriptPath, sessionId });

  function rerender(): void {
    const t0 = transcript[0]?.ts ? Date.parse(transcript[0].ts) : Date.now();
    const goal = state.task_ledger.goal ?? '(no goal yet)';
    const preset = process.env.CRUMB_PRESET ?? '(ambient)';
    const lastScore =
      state.progress_ledger.score_history[state.progress_ledger.score_history.length - 1];
    const verdictTag =
      lastScore?.verdict === 'PASS'
        ? '{green-fg}'
        : lastScore?.verdict === 'FAIL'
          ? '{red-fg}'
          : '{yellow-fg}';
    const verdictText = lastScore
      ? `${verdictTag}${lastScore.verdict} ${lastScore.aggregate.toFixed(1)}{/}`
      : '{gray-fg}—{/}';
    header.setContent(
      `{bold}🍞 Crumb{/} {gray-fg}${sessionId}{/}  ${verdictText}  preset={cyan-fg}${preset}{/}\n` +
        `${goal}`,
    );

    timeline.setItems(transcript.map((m) => formatRow(m, t0)));
    timeline.scrollTo(transcript.length);

    agentsBox.setContent(formatActorList(transcript).slice(0, 3).join('\n'));
    adaptersBox.setContent(adapterSummary(transcript));
    status.setContent(formatStatus(state, transcript));

    screen.render();
  }

  function adapterSummary(t: Message[]): string {
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const m of t) {
      const id = m.metadata?.harness ? `${m.metadata.harness}/${m.metadata.provider ?? '?'}` : null;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      lines.push(`{green-fg}●{/} ${id}`);
      if (lines.length === 3) break;
    }
    return lines.length > 0 ? lines.join('\n') : '{gray-fg}(none yet){/}';
  }

  // Slash commands → user.* transcript events.
  cmd.key(['enter'], () => {
    const raw = cmd.getValue().trim();
    cmd.clearValue();
    cmd.cancel();
    screen.render();
    if (!raw) return;
    void handleCommand(raw);
  });

  async function handleCommand(input: string): Promise<void> {
    // TUI-local action: /q and /quit terminate the screen, not the session.
    const quit = input.match(/^\/(q|quit)\b/i);
    if (quit) {
      shutdown();
      return;
    }
    // Everything else delegates to the inbox parser so the TUI slash bar and
    // headless inbox.txt share one grammar (full data field passthrough —
    // target_actor, goto, swap, reset_circuit, actor, sandwich_append).
    const draft = parseInboxLine(input, sessionId);
    if (!draft) return;
    await writer.append(draft);
  }

  // Global keys
  screen.key(['q', 'C-c'], () => shutdown());
  screen.key(['tab'], () => {
    if (screen.focused === cmd) timeline.focus();
    else cmd.focus();
    screen.render();
  });
  screen.key([':', '/'], () => {
    cmd.focus();
  });

  let handle: { close: () => void } | null = null;
  let stopped = false;

  function shutdown(): void {
    if (stopped) return;
    stopped = true;
    handle?.close();
    screen.destroy();
    process.stdout.write(
      `\nCrumb TUI exited · ${transcript.length} events · ${
        state.progress_ledger.score_history.length
      } judgments\n`,
    );
    process.exit(0);
  }

  rerender();
  timeline.focus();

  // Tail new events (fromOffset = current size — only show what's appended after start
  // for sessions already partially read).
  let processing: Promise<void> = Promise.resolve();
  handle = await tail(
    transcriptPath,
    (msg) => {
      processing = processing
        .then(() => {
          transcript.push(msg);
          state = reduce(state, msg).state;
          rerender();
        })
        .catch(() => undefined);
    },
    { fromOffset: undefined },
  );
}
