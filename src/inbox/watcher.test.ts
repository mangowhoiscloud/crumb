import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { TranscriptWriter } from '../transcript/writer.js';
import { startInboxWatcher } from './watcher.js';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Force chokidar polling in tests for deterministic timing across CI runners
// (Linux inotify, macOS FSEvents, Windows ReadDirectoryChangesW all behave
// slightly differently on the trigger latency for fast back-to-back appends).
const POLLING = { usePolling: true, pollIntervalMs: 30 };

describe('inbox watcher', () => {
  it('appends each new line as a transcript event', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crumb-inbox-'));
    const inboxPath = join(dir, 'inbox.txt');
    const transcriptPath = join(dir, 'transcript.jsonl');
    writeFileSync(inboxPath, '');
    writeFileSync(transcriptPath, '');

    const writer = new TranscriptWriter({ path: transcriptPath, sessionId: 'sess-watcher' });
    const handle = startInboxWatcher({
      inboxPath,
      sessionId: 'sess-watcher',
      writer,
      ...POLLING,
    });

    appendFileSync(inboxPath, '/pause @builder waiting\n');
    appendFileSync(inboxPath, '@planner-lead 콤보 짧게\n');
    await sleep(800);
    await handle.stop();

    const lines = readFileSync(transcriptPath, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      from: 'user',
      kind: 'user.pause',
      body: 'waiting',
      data: { actor: 'builder' },
    });
    expect(lines[1]).toMatchObject({
      from: 'user',
      kind: 'user.intervene',
      body: '콤보 짧게',
      data: { target_actor: 'planner-lead' },
    });
  });

  it('ignores blank and comment lines', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crumb-inbox-'));
    const inboxPath = join(dir, 'inbox.txt');
    const transcriptPath = join(dir, 'transcript.jsonl');
    writeFileSync(inboxPath, '');
    writeFileSync(transcriptPath, '');

    const writer = new TranscriptWriter({ path: transcriptPath, sessionId: 'sess-watcher' });
    const handle = startInboxWatcher({
      inboxPath,
      sessionId: 'sess-watcher',
      writer,
      ...POLLING,
    });

    appendFileSync(inboxPath, '\n# comment line\n   \n/approve\n');
    await sleep(800);
    await handle.stop();

    const lines = readFileSync(transcriptPath, 'utf-8').split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({ kind: 'user.approve' });
  });

  it('handles incremental writes (line not yet terminated)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crumb-inbox-'));
    const inboxPath = join(dir, 'inbox.txt');
    const transcriptPath = join(dir, 'transcript.jsonl');
    writeFileSync(inboxPath, '');
    writeFileSync(transcriptPath, '');

    const writer = new TranscriptWriter({ path: transcriptPath, sessionId: 'sess-watcher' });
    const handle = startInboxWatcher({
      inboxPath,
      sessionId: 'sess-watcher',
      writer,
      ...POLLING,
    });

    appendFileSync(inboxPath, '/pause');
    await sleep(200);
    let lineCount = readFileSync(transcriptPath, 'utf-8').split('\n').filter(Boolean).length;
    expect(lineCount).toBe(0);

    appendFileSync(inboxPath, '\n');
    await sleep(500);
    lineCount = readFileSync(transcriptPath, 'utf-8').split('\n').filter(Boolean).length;
    expect(lineCount).toBe(1);

    await handle.stop();
  });

  // PR-I-A regression — guards against the chokidar coalesce bug where two
  // rapid appends within one tick window get reported as a single 'change'
  // event and the second batch is silently dropped. The dirty-flag re-tick
  // loop in watcher.ts must catch the second batch even though no new fs
  // event fired for it.
  it('does not lose lines when many appends arrive rapidly during a slow drain', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crumb-inbox-burst-'));
    const inboxPath = join(dir, 'inbox.txt');
    const transcriptPath = join(dir, 'transcript.jsonl');
    writeFileSync(inboxPath, '');
    writeFileSync(transcriptPath, '');

    const writer = new TranscriptWriter({ path: transcriptPath, sessionId: 'sess-burst' });
    const handle = startInboxWatcher({
      inboxPath,
      sessionId: 'sess-burst',
      writer,
      ...POLLING,
    });

    // Fire 25 appends back-to-back. With the old `await ticking; return;`
    // pattern any append that landed during the first tick's drain loop was
    // dropped silently — the new dirty-flag re-tick guarantees all 25 land
    // in the transcript.
    for (let i = 0; i < 25; i++) {
      appendFileSync(inboxPath, `/note burst-${i}\n`);
    }
    await sleep(1500);
    await handle.stop();

    const lines = readFileSync(transcriptPath, 'utf-8').split('\n').filter(Boolean);
    expect(lines).toHaveLength(25);
    // Order is preserved (TranscriptWriter is a single-process Promise chain).
    for (let i = 0; i < 25; i++) {
      expect(JSON.parse(lines[i]).body).toBe(`burst-${i}`);
    }
  });
});
